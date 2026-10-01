using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// PROGRAM (0070) — Termine in Terminen, und woher ein Termin kommt.
///
/// <para>
/// Ein Teil ist ein gewöhnlicher Termin mit <c>parent_item_id</c>: er hat seine
/// eigene Zeit, seinen Ort, seine Notiz und — wichtig — seine eigene
/// Sichtbarkeit. Der Aushang eines Programms zeigt deshalb nur die Teile, die
/// der Leser sehen darf; ein verborgener Teil nimmt seine Unterpunkte mit.
/// </para>
///
/// <para>
/// <b>Woher</b> (<c>chat_id</c>, <c>topic_id</c>): ein Termin, der aus einer
/// Rozmowa entstand. Nennen darf die Rozmowa nur, wer sie lesen kann — sonst
/// liesse sich herausfinden, ob es eine Kennung gibt.
/// </para>
/// </summary>
public static partial class Calendar
{
    /// <summary>So tief dürfen Teile ineinander stecken — tiefer ist kein Programm mehr, sondern ein Irrtum.</summary>
    public const int MaxProgramDepth = 8;

    /// <summary>Was ein Eintrag über sein Ganzes und seine Herkunft sagt — geprüft.</summary>
    internal readonly record struct ProgramLink(bool KeepParent, Guid? Parent, int? Position, bool KeepChat, Guid? Chat, Guid? Topic);

    internal static void BindProgramLink(SqlCommand cmd, ProgramLink link)
    {
        cmd.Parameters.AddWithValue("@keepParent", link.KeepParent ? 1 : 0);
        cmd.Parameters.AddWithValue("@parent", (object?)link.Parent ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@position", (object?)link.Position ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@keepChat", link.KeepChat ? 1 : 0);
        cmd.Parameters.AddWithValue("@chat", (object?)link.Chat ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@topic", (object?)link.Topic ?? DBNull.Value);
    }

    /// <summary>
    /// Darf dieses Konto die Rozmowa (und ihr Thema) an etwas hängen? Nur wer
    /// sie lesen kann; und das Thema muss in DIESER Rozmowa liegen.
    /// </summary>
    internal static async Task<bool> ChatLinkAllowedAsync(
        SqlConnection connection, Guid accountId, Guid chatId, Guid? topicId, CancellationToken ct)
    {
        Guid areaId;
        await using (var cmd = new SqlCommand("SELECT area_id FROM app.chat WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", chatId);
            if (await cmd.ExecuteScalarAsync(ct) is not Guid found) return false;
            areaId = found;
        }

        if (!await Area.MayAsync(connection, accountId, areaId, Capability.Read, ct)) return false;
        if (topicId is null) return true;

        await using var topic = new SqlCommand("SELECT 1 FROM app.topic WHERE id = @id AND chat_id = @chat;", connection);
        topic.Parameters.AddWithValue("@id", topicId.Value);
        topic.Parameters.AddWithValue("@chat", chatId);
        return await topic.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>
    /// Prüft, was ein Antrag über das Ganze und die Herkunft sagt. <c>null</c>:
    /// abgelehnt, die Antwort ist geschrieben. <paramref name="itemId"/> ist der
    /// Eintrag selbst (beim Ändern) — er darf nicht unter sich selbst landen.
    /// </summary>
    internal static async Task<ProgramLink?> ProgramLinkAsync(
        HttpContext ctx, SqlConnection connection, Guid accountId, Guid? itemId, ItemRequest body)
    {
        var keepParent = body.ParentItemId is null;
        Guid? parent = null;

        if (!keepParent && body.ParentItemId!.Trim().Length > 0)
        {
            if (!Guid.TryParse(body.ParentItemId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung terminu nadrzędnego.");
                return null;
            }

            var area = await AreaOfItemAsync(connection, wanted, ctx.RequestAborted);
            if (area is null || !await Area.MayAsync(connection, accountId, area.Value, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Terminu nadrzędnego nie ma — albo nie możesz w nim pisać.");
                return null;
            }

            /* Den Weg nach oben gehen: trifft er sich selbst, wäre es ein Kreis; ist er zu lang, ein Irrtum. */
            Guid? current = wanted;
            for (var depth = 0; current is not null; depth++)
            {
                if (current == itemId)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "Termin nie może być częścią samego siebie.");
                    return null;
                }

                if (depth >= MaxProgramDepth)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, $"Program może mieć najwyżej {MaxProgramDepth} poziomów.");
                    return null;
                }

                await using var up = new SqlCommand("SELECT parent_item_id FROM app.calendar_item WHERE id = @id;", connection);
                up.Parameters.AddWithValue("@id", current.Value);
                current = await up.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
            }

            parent = wanted;
        }

        var keepChat = body.ChatId is null;
        Guid? chat = null, topic = null;

        if (!keepChat && body.ChatId!.Trim().Length > 0)
        {
            if (!Guid.TryParse(body.ChatId, out var c)
                || (!string.IsNullOrWhiteSpace(body.TopicId) && !Guid.TryParse(body.TopicId, out _)))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung rozmowy albo tematu.");
                return null;
            }

            Guid? t = string.IsNullOrWhiteSpace(body.TopicId) ? null : Guid.Parse(body.TopicId);
            if (!await ChatLinkAllowedAsync(connection, accountId, c, t, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tej rozmowy albo tematu nie widzisz.");
                return null;
            }

            chat = c;
            topic = t;
        }

        int? position = body.Position is null ? null : Math.Clamp(body.Position.Value, 0, 100_000);
        return new ProgramLink(keepParent, parent, position, keepChat, chat, topic);
    }

    /// <summary>
    /// DER AUSHANG EINES PROGRAMMS — ein Termin mit allem, was darunter hängt,
    /// so weit der Leser es sehen darf. Ohne Konto: was unter einem
    /// offengelegten Bereich liegt (der Baustein „program" auf einer Seite,
    /// das Widget auf einer fremden Seite).
    /// </summary>
    private static async Task ProgramAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var readable = (await ReadableAreasAsync(connection, who?.AccountId, ctx.RequestAborted)).ToHashSet();

        var rows = new List<(Guid Id, Guid? Parent, int? Position, string Kind, DateTimeOffset Starts, DateTimeOffset Ends,
            bool AllDay, string? TitlePublic, Guid Visibility, string Status, string Repeat, int Depth)>();
        Guid calendarId = Guid.Empty;
        string zone = Zones.Home, calendarTitle = "";

        await using (var cmd = new SqlCommand($"""
            WITH tree AS (
                SELECT id, parent_item_id, 0 AS depth FROM app.calendar_item WHERE id = @id
                UNION ALL
                SELECT c.id, c.parent_item_id, t.depth + 1
                FROM app.calendar_item c JOIN tree t ON c.parent_item_id = t.id
                WHERE t.depth < {MaxProgramDepth})
            SELECT i.id, i.parent_item_id, i.position, i.kind, i.starts_at, i.ends_at, i.all_day,
                   i.title_public, i.visibility_area_id, i.status, i.repeat_kind, t.depth,
                   cal.id, cal.time_zone, cal.title
            FROM tree t
            JOIN app.calendar_item i ON i.id = t.id
            JOIN app.calendar cal ON cal.id = i.calendar_id
            ORDER BY t.depth, COALESCE(i.position, 2147483647), i.starts_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetInt32(2),
                    reader.GetString(3), reader.GetDateTimeOffset(4), reader.GetDateTimeOffset(5), reader.GetBoolean(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7), reader.GetGuid(8), reader.GetString(9), reader.GetString(10),
                    reader.GetInt32(11)));

                if (reader.GetInt32(11) == 0)
                {
                    calendarId = reader.GetGuid(12);
                    zone = reader.GetString(13);
                    calendarTitle = reader.GetString(14);
                }
            }
        }

        /* Was der Leser nicht sehen darf, fällt — mit allem, was darunter hängt. */
        var shown = new HashSet<Guid>();
        foreach (var row in rows)
        {
            if (!readable.Contains(row.Visibility)) continue;
            if (row.Depth > 0 && (row.Parent is null || !shown.Contains(row.Parent.Value))) continue;
            shown.Add(row.Id);
        }

        if (rows.Count == 0 || !shown.Contains(id))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma.");
            return;
        }

        var visible = rows.Where(r => shown.Contains(r.Id)).ToList();
        var fields = await FieldsAsync(connection, visible.Select(r => r.Id).ToList(), ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            itemId = Ids.ToText(id),
            calendarId = Ids.ToText(calendarId),
            calendarTitle,
            timeZone = zone,
            items = visible.Select(r => new
            {
                itemId = Ids.ToText(r.Id),
                parentItemId = r.Depth == 0 || r.Parent is null ? null : Ids.ToText(r.Parent.Value),
                position = r.Position,
                depth = r.Depth,
                kind = r.Kind,
                startsAt = r.Starts,
                endsAt = r.Ends,
                allDay = r.AllDay,
                status = r.Status,
                repeatKind = r.Repeat,
                titlePublic = r.TitlePublic,
                visibilityAreaId = Ids.ToText(r.Visibility),
                fields = fields.TryGetValue(r.Id, out var list)
                    ? list.Select(f => new { field = f.Field, areaId = Ids.ToText(f.AreaId), epoch = f.Epoch, @sealed = Base64Url.Encode(f.Blob) })
                    : []
            })
        });
    }
}
