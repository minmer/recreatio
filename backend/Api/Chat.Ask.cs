using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// „NAPISZ DO NAS" (0081) — der Mensch mit dem Link fängt die Rozmowa „einer
/// mit einem" (<see cref="AudienceMode.One"/>) selbst an.
///
/// <para>
/// <b>Der Baustein ist ein Ding mit Odbiorcy</b> (<see cref="Audience"/>,
/// Art <c>module</c>): SEIN Bereich — eigens angelegt, mit genau den Rollen,
/// die antworten — und SEINE Formulare (<c>app.audience_form</c>). Anfangen
/// darf, wer eines davon ausgefüllt hat (<see cref="Audience.PeopleOf"/>);
/// die Rozmowa liegt am Bereich des Bausteins, und nur er bekommt ihren
/// Schlüssel — die anderen aus dem Formular sehen sie nicht.
/// </para>
///
/// <para>
/// <b>Schlüssel gibt es noch keinen.</b> Die Rozmowa entsteht leer; den
/// Chatschlüssel verpackt ihm die App eines Mitglieds, sobald sie die Glocke
/// fragt (`waiting` in <c>/workspace/notifications</c>). Bis dahin hält sein
/// Browser, was er schreibt.
/// </para>
/// </summary>
public static partial class Chat
{
    private static void MapAsk(WebApplication app)
    {
        app.MapGet("/seat/{token}/ask/{moduleId:guid}", AskListAsync);
        app.MapPost("/seat/{token}/ask/{moduleId:guid}", AskStartAsync);
    }

    public sealed record AskRequest(string AreaId);

    /// <summary>
    /// Der Platz hinter dem Token und an wen er über diesen Baustein schreiben
    /// kann — der Bereich des Bausteins, wenn er zu dessen Menschen gehört;
    /// sonst niemand. Ohne lebenden Platz oder Baustein: null (und 404).
    /// </summary>
    private static async Task<(Guid Seat, List<(Guid Area, string Name)> To)?> AskOfAsync(
        HttpContext ctx, SqlConnection connection, string token, Guid moduleId)
    {
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego tu nie ma.");
            return null;
        }

        var to = new List<(Guid, string)>();
        await using (var cmd = new SqlCommand($"""
            SELECT m.area_id, a.name
            FROM app.module m
            JOIN app.area a ON a.id = m.area_id
            JOIN app.access s ON s.id = @seat
            WHERE m.id = @module AND m.kind = N'seat-ask'
              AND {Audience.PeopleOf("module", "m.id", "m.area_id")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);
            cmd.Parameters.AddWithValue("@module", moduleId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) to.Add((reader.GetGuid(0), reader.GetString(1)));
        }

        return (seat.Value.Id, to);
    }

    private static async Task<Guid?> SeatChatAtAsync(SqlConnection connection, Guid seat, Guid area, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT id FROM app.chat WHERE seat_id = @seat AND area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@seat", seat);
        cmd.Parameters.AddWithValue("@area", area);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    /// <summary>An wen dieser Baustein den Menschen schreiben lässt — und ob die Rozmowa schon da ist.</summary>
    private static async Task AskListAsync(HttpContext ctx, Db db, string token, Guid moduleId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var found = await AskOfAsync(ctx, connection, token, moduleId);
        if (found is null) return;

        var to = new List<object>();
        foreach (var (area, name) in found.Value.To)
        {
            var chat = await SeatChatAtAsync(connection, found.Value.Seat, area, ctx.RequestAborted);
            to.Add(new { areaId = Ids.ToText(area), name, chatId = chat is null ? null : Ids.ToText(chat.Value) });
        }

        await ctx.Response.WriteAsJsonAsync(new { to });
    }

    /// <summary>
    /// DIE ROZMOWA ANFANGEN. Gibt es sie schon (er, oder der Bereich, hat
    /// schon angefangen), ist SIE es.
    /// </summary>
    private static async Task AskStartAsync(HttpContext ctx, Db db, Push push, string token, Guid moduleId, AskRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var found = await AskOfAsync(ctx, connection, token, moduleId);
        if (found is null) return;

        if (!Guid.TryParse(body.AreaId, out var areaId) || !found.Value.To.Any(t => t.Area == areaId))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Z Twojego linku nie można tu napisać.");
            return;
        }

        var seat = found.Value.Seat;
        var had = await SeatChatAtAsync(connection, seat, areaId, ctx.RequestAborted);
        if (had is not null)
        {
            await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(had.Value), started = false });
            return;
        }

        var chatId = Ids.NewId();
        await using (var insert = new SqlCommand("""
            INSERT INTO app.chat (id, area_id, kind, pair_key, created_by_role_id, created_at, posting_policy, seat_id)
            VALUES (@id, @area, N'seat', NULL, NULL, @now, N'members', @seat);
            """, connection))
        {
            insert.Parameters.AddWithValue("@id", chatId);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@seat", seat);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try
            {
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Ein zweites Fenster (oder der Bereich) war schneller — dann ist es diese.
                var first = await SeatChatAtAsync(connection, seat, areaId, ctx.RequestAborted);
                await ctx.Response.WriteAsJsonAsync(new { chatId = first is null ? null : Ids.ToText(first.Value), started = false });
                return;
            }
        }

        /* Die Mitglieder wecken — ihre App gibt ihm dann den Schlüssel (`waiting`). */
        push.Chat(chatId, null);
        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(chatId), started = true });
    }
}
