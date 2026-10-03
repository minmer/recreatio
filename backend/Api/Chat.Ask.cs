using System.Text.Json;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// „NAPISZ DO NAS" (0081) — der Mensch mit dem Link fängt die Rozmowa „einer
/// mit einem" (<see cref="AudienceMode.One"/>) selbst an.
///
/// <para>
/// <b>Der Baustein sagt, an wen.</b> Ein Baustein der Art <c>seat-ask</c>
/// nennt in <c>to</c> die Bereiche, an die man schreiben kann — die Rollen
/// darin antworten. Angeboten wird davon, was mit dem Menschen zu tun hat
/// (<see cref="Audience.MayMeetAsync"/>, dieselbe Regel, nach der ein Bereich
/// ihn anschreiben darf): ein Baustein holt niemandem Menschen, mit denen er
/// nichts zu tun hat, und niemand schreibt an einen Bereich, den kein
/// Baustein anbietet.
/// </para>
///
/// <para>
/// <b>Schlüssel gibt es noch keinen.</b> Die Rozmowa entsteht leer; den
/// Chatschlüssel verpackt ihm ein Mitglied, sobald dessen App sie sieht
/// (die Glocke fragt danach, `waiting` in <c>/workspace/notifications</c>).
/// Bis dahin hält sein Browser, was er schreibt.
/// </para>
/// </summary>
public static partial class Chat
{
    private const string AskKind = "seat-ask";

    private static void MapAsk(WebApplication app)
    {
        app.MapGet("/seat/{token}/ask/{moduleId:guid}", AskListAsync);
        app.MapPost("/seat/{token}/ask/{moduleId:guid}", AskStartAsync);
    }

    public sealed record AskRequest(string AreaId);

    /// <summary>
    /// Der Platz hinter dem Token und die Bereiche, an die er über diesen
    /// Baustein schreiben kann — in der Reihenfolge des Bausteins, mit Namen.
    /// Sonst null (und 404 geschrieben).
    /// </summary>
    private static async Task<(Guid Seat, List<(Guid Area, string Name)> To)?> AskOfAsync(
        HttpContext ctx, SqlConnection connection, string token, Guid moduleId)
    {
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);

        string? config = null;
        if (seat is not null)
        {
            await using var cmd = new SqlCommand("SELECT config FROM app.module WHERE id = @id AND kind = @kind;", connection);
            cmd.Parameters.AddWithValue("@id", moduleId);
            cmd.Parameters.AddWithValue("@kind", AskKind);
            config = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as string;
        }

        if (seat is null || config is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego tu nie ma.");
            return null;
        }

        var wanted = new List<Guid>();
        try
        {
            using var doc = JsonDocument.Parse(config);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("to", out var to) && to.ValueKind == JsonValueKind.String)
            {
                foreach (var one in (to.GetString() ?? string.Empty).Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
                {
                    if (Guid.TryParse(one, out var id) && !wanted.Contains(id)) wanted.Add(id);
                }
            }
        }
        catch (JsonException)
        {
            // Eine unlesbare Tafel bietet niemanden an.
        }

        var out_ = new List<(Guid, string)>();
        foreach (var area in wanted.Take(20))
        {
            if (!await Audience.MayMeetAsync(connection, seat.Value.Id, area, ctx.RequestAborted)) continue;

            await using var name = new SqlCommand("SELECT name FROM app.area WHERE id = @id;", connection);
            name.Parameters.AddWithValue("@id", area);
            if (await name.ExecuteScalarAsync(ctx.RequestAborted) is string called) out_.Add((area, called));
        }

        return (seat.Value.Id, out_);
    }

    private static async Task<Guid?> SeatChatAtAsync(SqlConnection connection, Guid seat, Guid area, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT id FROM app.chat WHERE seat_id = @seat AND area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@seat", seat);
        cmd.Parameters.AddWithValue("@area", area);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    /// <summary>An wen dieser Baustein den Menschen schreiben lässt — und wo er es schon tut.</summary>
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
    /// DIE ROZMOWA ANFANGEN — mit einem der angebotenen Bereiche. Gibt es sie
    /// schon (er, oder der Bereich, hat schon angefangen), ist SIE es.
    /// </summary>
    private static async Task AskStartAsync(HttpContext ctx, Db db, Push push, string token, Guid moduleId, AskRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var found = await AskOfAsync(ctx, connection, token, moduleId);
        if (found is null) return;

        if (!Guid.TryParse(body.AreaId, out var areaId) || !found.Value.To.Any(t => t.Area == areaId))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tu nie można napisać do tej grupy.");
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
