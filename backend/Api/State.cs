using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DER GEMERKTE STAND (0054) — was man zuletzt offen hatte, und in welcher
/// Reihenfolge man es benutzt.
///
/// <para>
/// Nach dem Neuladen stand bisher das alphabetisch Erste da — der erste
/// Kalender, der erste Bereich —, gleich woran man gerade arbeitete. Jetzt
/// merkt sich der Browser, was man zuletzt gewählt hat, und legt es hier ab:
/// <b>versiegelt unter dem Schlüssel des Kontos</b>. Der Dienst weiss nicht,
/// was man zuletzt angesehen hat; er hebt eine Hülle auf und gibt sie zurück.
/// Auf jedem Gerät, an dem man sich anmeldet, gilt derselbe Stand.
/// </para>
/// </summary>
public static class State
{
    private const int MaxState = 64 * 1024;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/state", GetAsync);
        app.MapPost("/workspace/state", PutAsync);
    }

    private static async Task GetAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand(
            "SELECT state_sealed, updated_at FROM app.account_state WHERE account_id = @account;", connection);
        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await ctx.Response.WriteAsJsonAsync(new { stateSealed = (string?)null, updatedAt = (DateTimeOffset?)null });
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            stateSealed = Base64Url.Encode((byte[])reader[0]),
            updatedAt = reader.GetDateTimeOffset(1)
        });
    }

    public sealed record PutRequest(string StateSealed);

    private static async Task PutAsync(HttpContext ctx, Db db, PutRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        byte[] blob;
        try { blob = Base64Url.Decode(body.StateSealed ?? string.Empty); }
        catch (FormatException)
        {
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            await ctx.Response.WriteAsJsonAsync(new { error = "Nieczytelny stan." });
            return;
        }

        if (blob.Length is 0 or > MaxState)
        {
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            await ctx.Response.WriteAsJsonAsync(new { error = "Stan jest pusty albo za duży." });
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * Zwei Tabs schreiben oft kurz nacheinander; wer zuletzt kommt, gilt.
         * Unter Sperre, sonst gewönne ab und zu keiner, sondern ein Fehler.
         */
        await using var cmd = new SqlCommand("""
            MERGE app.account_state WITH (HOLDLOCK) AS t
            USING (SELECT @account AS account_id) AS s ON t.account_id = s.account_id
            WHEN MATCHED THEN UPDATE SET state_sealed = @blob, updated_at = @now
            WHEN NOT MATCHED THEN INSERT (account_id, state_sealed, updated_at) VALUES (@account, @blob, @now);
            """, connection);
        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);
        cmd.Parameters.AddWithValue("@blob", blob);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 1205 or 2601 or 2627)
        {
            // Gleichzeitig geschrieben — der andere hat gewonnen, und beim nächsten Mal dieser.
        }

        await ctx.Response.WriteAsJsonAsync(new { saved = true });
    }
}
