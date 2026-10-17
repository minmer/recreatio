using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Aufgaben abhaken, überspringen, zurücknehmen.</summary>
public static partial class Tasks
{
    public sealed record DoneRequest(string ByRoleId, string? OccurrenceAt);

    /// <summary>
    /// ABHAKEN. Bei <c>window</c> ein bestimmtes Vorkommen — eines, das es in
    /// der Reihe wirklich gibt; bei <c>after</c> jetzt, und die Uhr beginnt neu.
    /// Wer im Bereich schreibt, darf es — und es steht dabei, wer.
    /// </summary>
    private static Task DoneAsync(HttpContext ctx, Db db, Guid id, DoneRequest body) =>
        SettleAsync(ctx, db, id, body, "done");

    /// <summary>
    /// ABSAGEN — „dieses eine Mal nicht".
    ///
    /// <para>
    /// Derselbe Vorgang wie das Abhaken, mit dem anderen Ausgang: das Vorkommen
    /// ist entschieden und drängt nicht mehr, aber es behauptet niemand, es sei
    /// getan. Es steht auch nicht in der Geschichte der Erledigungen — wer nach
    /// einem Jahr nachsieht, wie oft die Blumen gegossen wurden, soll die Male
    /// gezählt bekommen, an denen sie gegossen wurden.
    /// </para>
    ///
    /// <para>
    /// Bei <c>after</c> stellt es trotzdem die Uhr: sonst stünde die Aufgabe
    /// zehn Minuten später wieder da und die Absage wäre keine.
    /// </para>
    /// </summary>
    private static Task SkipAsync(HttpContext ctx, Db db, Guid id, DoneRequest body) =>
        SettleAsync(ctx, db, id, body, "skipped");

    private static async Task SettleAsync(HttpContext ctx, Db db, Guid id, DoneRequest body, string state)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ByRoleId, out var by))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var task = await StoredAsync(connection, id, ctx.RequestAborted);
        if (task is null || !await Area.MayAsync(connection, who.Value.AccountId, task.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == by) || Workspace.IsAccount(mine, by))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja osoba ani rola.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        DateTimeOffset at;

        if (task.Kind is "window" or "period")
        {
            if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out at))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Które wystąpienie?");
                return;
            }

            if (!OccurrencesOf(task, at.AddSeconds(-1), at.AddSeconds(1)).Any(o => o == at))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego wystąpienia w serii nie ma.");
                return;
            }

            if (at > now.AddDays(1))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "To wystąpienie jest dopiero przed nami.");
                return;
            }
        }
        else
        {
            at = now;
        }

        /*
            Umentscheiden geht: wer erst absagt und dann doch giesst, hakt ab,
            und die Zeile nimmt den neuen Ausgang an. Nur das erste Mal legt sie
            an — deshalb UPDATE statt eines zweiten Eintrags.
        */
        await using var insert = new SqlCommand("""
            UPDATE app.task_done
               SET state = @state, done_at = @now, done_by_role_id = @by
             WHERE task_id = @task AND occurrence_at = @at AND state <> @state;

            IF NOT EXISTS (SELECT 1 FROM app.task_done WHERE task_id = @task AND occurrence_at = @at)
                INSERT INTO app.task_done (task_id, occurrence_at, done_at, done_by_role_id, state)
                VALUES (@task, @at, @now, @by, @state);
            """, connection);
        insert.Parameters.AddWithValue("@task", id);
        insert.Parameters.AddWithValue("@at", at);
        insert.Parameters.AddWithValue("@now", now);
        insert.Parameters.AddWithValue("@by", by);
        insert.Parameters.AddWithValue("@state", state);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Zwei Fenster, ein Häkchen — es steht schon da.
        }

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), occurrenceAt = at, doneAt = now, state });
    }

    public sealed record UndoneRequest(string OccurrenceAt);

    /// <summary>Ein Häkchen zurücknehmen — aus Versehen gesetzt, oder doch nicht getan.</summary>
    private static async Task UndoneAsync(HttpContext ctx, Db db, Guid id, UndoneRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Które wystąpienie?");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaOf = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (areaOf is null || !await Area.MayAsync(connection, who.Value.AccountId, areaOf.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        await using var drop = new SqlCommand(
            "DELETE FROM app.task_done WHERE task_id = @task AND occurrence_at = @at;", connection);
        drop.Parameters.AddWithValue("@task", id);
        drop.Parameters.AddWithValue("@at", at);
        var gone = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), undone = gone > 0 });
    }
}
