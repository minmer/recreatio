using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// TEMATY (0068) — Fäden in einer Rozmowa, und was daran hängt.
///
/// <para>
/// Ein Thema hat einen versiegelten Titel (unter dem Chatschlüssel, damit auch
/// ein Platz ihn liest), ist offen oder geschlossen, und sammelt Nachrichten,
/// Aufgaben und Termine. Anlegen darf, wer in der Rozmowa schreibt — Mitglied
/// oder Platz; umbenennen und schließen, wer es angelegt hat oder moderiert.
/// </para>
///
/// <para>
/// <b>Was daran hängt</b> (<c>/linked</c>): Termine mit <c>chat_id</c> und
/// Aufgaben mit <c>chat_id</c> — beide liegen in IHREM Bereich und gehen nur an
/// den, der ihn lesen kann. Die Rozmowa zeigt also nicht mehr, als der Leser
/// ohnehin sehen dürfte.
/// </para>
/// </summary>
public static partial class Chat
{
    private const int MaxTopicTitle = 4096;

    private static void MapTopics(WebApplication app)
    {
        app.MapGet("/workspace/chat/{id:guid}/topics", TopicsAsync);
        app.MapPost("/workspace/chat/{id:guid}/topics", CreateTopicAsync);
        app.MapPost("/workspace/chat/topic/{id:guid}", UpdateTopicAsync);
        app.MapPost("/workspace/chat/message/{id:guid}/topic", MoveToTopicAsync);
        app.MapGet("/workspace/chat/{id:guid}/linked", LinkedAsync);

        app.MapGet("/seat/{token}/chat/{id:guid}/topics", TopicsAsync);
        app.MapPost("/seat/{token}/chat/{id:guid}/topics", CreateTopicAsync);
    }

    public sealed record TopicRequest(string TopicId, string TitleSealed, int Epoch, string? ByRoleId);

    public sealed record TopicUpdateRequest(string? TitleSealed, int? Epoch, bool? Closed);

    public sealed record MoveRequest(string? TopicId);

    /// <summary>Das Thema einer neuen Nachricht — wenn es eines in dieser Rozmowa ist. <c>Ok = false</c>: die Antwort ist geschrieben.</summary>
    private static async Task<(bool Ok, Guid? Id)?> TopicOfChatAsync(HttpContext ctx, SqlConnection connection, ChatRow chat, string? topicText)
    {
        if (string.IsNullOrWhiteSpace(topicText)) return null;

        if (!Guid.TryParse(topicText, out var topic))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung tematu.");
            return (false, null);
        }

        await using var cmd = new SqlCommand("SELECT 1 FROM app.topic WHERE id = @id AND chat_id = @chat;", connection);
        cmd.Parameters.AddWithValue("@id", topic);
        cmd.Parameters.AddWithValue("@chat", chat.Id);
        if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego tematu w tej rozmowie nie ma.");
            return (false, null);
        }

        return (true, topic);
    }

    /// <summary>Die Themen einer Rozmowa — die offenen zuerst, mit dem, was an ihnen hängt.</summary>
    private static async Task TopicsAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, connection, id);
        if (actor is null) return;

        var topics = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT t.id, t.title_sealed, t.epoch, t.created_at, t.closed_at, t.last_message_at,
                   t.created_by_role_id, t.created_by_access_id,
                   (SELECT COUNT(*) FROM app.chat_message m WHERE m.topic_id = t.id AND m.deleted_at IS NULL AND m.schedule_state = N'sent'),
                   (SELECT COUNT(*) FROM app.task k WHERE k.topic_id = t.id AND k.archived_at IS NULL),
                   (SELECT COUNT(*) FROM app.calendar_item i WHERE i.topic_id = t.id)
            FROM app.topic t
            WHERE t.chat_id = @chat
            ORDER BY CASE WHEN t.closed_at IS NULL THEN 0 ELSE 1 END, COALESCE(t.last_message_at, t.created_at) DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@chat", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                topics.Add(new
                {
                    topicId = Ids.ToText(reader.GetGuid(0)),
                    titleSealed = Base64Url.Encode((byte[])reader[1]),
                    epoch = reader.GetInt32(2),
                    createdAt = reader.GetDateTimeOffset(3),
                    closedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),
                    lastMessageAt = reader.IsDBNull(5) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(5),
                    createdByRoleId = reader.IsDBNull(6) ? null : Ids.ToText(reader.GetGuid(6)),
                    createdBySeatId = reader.IsDBNull(7) ? null : Ids.ToText(reader.GetGuid(7)),
                    messages = reader.GetInt32(8),
                    tasks = reader.GetInt32(9),
                    items = reader.GetInt32(10)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(id), topics });
    }

    /// <summary>Ein Thema aufmachen — wer in der Rozmowa schreibt, als Mitglied (mit seiner Rolle) oder als Platz.</summary>
    private static async Task CreateTopicAsync(HttpContext ctx, Db db, Guid id, TopicRequest body)
    {
        if (!Guid.TryParse(body.TopicId, out var topicId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Temat musi przyjść z własną kennung — jej nazwa jest w pieczęci.");
            return;
        }

        if (!Base64Url.TryDecode(body.TitleSealed, out var title) || title.Length is 0 or > MaxTopicTitle || body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Temat potrzebuje nazwy.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, connection, id);
        if (actor is null) return;

        if (!actor.Writes)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W tej rozmowie tylko czytasz.");
            return;
        }

        Guid? byRole = null;
        if (!actor.Seat)
        {
            if (!Guid.TryParse(body.ByRoleId, out var role) || !actor.Roles.Contains(role))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nie piszesz.");
                return;
            }
            byRole = role;
        }

        if (!await EpochExistsAsync(ctx, connection, actor.Chat, body.Epoch)) return;

        await using var insert = new SqlCommand("""
            INSERT INTO app.topic (id, area_id, title_sealed, epoch, created_at, chat_id, created_by_role_id, created_by_access_id)
            VALUES (@id, @area, @title, @epoch, @now, @chat, @role, @seat);
            """, connection);
        insert.Parameters.AddWithValue("@id", topicId);
        insert.Parameters.AddWithValue("@area", actor.Chat.AreaId);
        insert.Parameters.AddWithValue("@title", title);
        insert.Parameters.AddWithValue("@epoch", body.Epoch);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        insert.Parameters.AddWithValue("@chat", actor.Chat.Id);
        insert.Parameters.AddWithValue("@role", (object?)byRole ?? DBNull.Value);
        insert.Parameters.AddWithValue("@seat", actor.Seat ? actor.Principal : (object)DBNull.Value);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten temat już jest.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { topicId = Ids.ToText(topicId) });
    }

    private static async Task<(Guid Chat, Guid? ByRole)?> TopicRowAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT chat_id, created_by_role_id FROM app.topic WHERE id = @id AND chat_id IS NOT NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return (reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1));
    }

    /// <summary>Umbenennen, schließen, wieder öffnen — wer es aufgemacht hat oder wer moderiert.</summary>
    private static async Task UpdateTopicAsync(HttpContext ctx, Db db, Guid id, TopicUpdateRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var row = await TopicRowAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego tematu nie ma."); return; }

        var actor = await ActorAsync(ctx, db, connection, row.Value.Chat);
        if (actor is null) return;

        var mayChange = actor.Moderates || (row.Value.ByRole is not null && actor.Roles.Contains(row.Value.ByRole.Value))
            || (actor.Writes && row.Value.ByRole is null);
        if (!mayChange)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ten temat zmienia ten, kto go założył, albo moderator.");
            return;
        }

        byte[]? title = null;
        if (body.TitleSealed is not null)
        {
            if (!Base64Url.TryDecode(body.TitleSealed, out var t) || t.Length is 0 or > MaxTopicTitle || body.Epoch is null or < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Temat potrzebuje nazwy.");
                return;
            }
            if (!await EpochExistsAsync(ctx, connection, actor.Chat, body.Epoch.Value)) return;
            title = t;
        }

        await using var update = new SqlCommand("""
            UPDATE app.topic
               SET title_sealed = COALESCE(@title, title_sealed),
                   epoch = COALESCE(@epoch, epoch),
                   closed_at = CASE WHEN @closed IS NULL THEN closed_at WHEN @closed = 1 THEN COALESCE(closed_at, @now) ELSE NULL END
             WHERE id = @id;
            """, connection);
        update.Parameters.AddWithValue("@id", id);
        update.Parameters.Add("@title", System.Data.SqlDbType.VarBinary, -1).Value = (object?)title ?? DBNull.Value;
        update.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = title is null ? DBNull.Value : body.Epoch!.Value;
        update.Parameters.Add("@closed", System.Data.SqlDbType.Bit).Value = body.Closed is null ? DBNull.Value : body.Closed.Value;
        update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { topicId = Ids.ToText(id), updated = true });
    }

    /// <summary>Eine Nachricht einem Thema zuordnen (oder keinem) — ihr Verfasser oder wer moderiert.</summary>
    private static async Task MoveToTopicAsync(HttpContext ctx, Db db, Guid id, MoveRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid chatId;
        Guid? author;
        await using (var cmd = new SqlCommand("SELECT chat_id, author_role_id FROM app.chat_message WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma."); return; }
            chatId = reader.GetGuid(0);
            author = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var actor = await ActorAsync(ctx, db, connection, chatId);
        if (actor is null) return;

        if (!actor.Moderates && !(author is not null && actor.Roles.Contains(author.Value)))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Przenieść może autor albo moderator.");
            return;
        }

        var topic = await TopicOfChatAsync(ctx, connection, actor.Chat, body.TopicId);
        if (topic is { Ok: false }) return;

        await using var update = new SqlCommand("UPDATE app.chat_message SET topic_id = @topic, changed_at = @now WHERE id = @id;", connection);
        update.Parameters.AddWithValue("@id", id);
        update.Parameters.AddWithValue("@topic", (object?)topic?.Id ?? DBNull.Value);
        update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), topicId = topic?.Id is null ? null : Ids.ToText(topic.Value.Id!.Value) });
    }

    /// <summary>
    /// WAS AN DER ROZMOWA HÄNGT — Termine, deren Bereich der Leser lesen kann
    /// (mit ihren Hüllen, wie im Kalender). Aufgaben holt der Browser über
    /// <c>/workspace/tasks?chat=</c>, mit ihren Vorkommen.
    /// </summary>
    private static async Task LinkedAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;

        var readable = await Calendar.ReadableAreasAsync(connection, seen.Value.Account, ctx.RequestAborted);
        var items = new List<(Guid Id, Guid? Topic, Guid Calendar, string Kind, DateTimeOffset Starts, DateTimeOffset Ends, bool AllDay,
            string? TitlePublic, Guid Visibility, string Status, string Repeat, Guid? Parent)>();

        if (readable.Count > 0)
        {
            var names = string.Join(", ", readable.Select((_, i) => $"@a{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT TOP 200 i.id, i.topic_id, i.calendar_id, i.kind, i.starts_at, i.ends_at, i.all_day,
                       i.title_public, i.visibility_area_id, i.status, i.repeat_kind, i.parent_item_id
                FROM app.calendar_item i
                WHERE i.chat_id = @chat AND i.visibility_area_id IN ({names})
                ORDER BY i.starts_at;
                """, connection);
            cmd.Parameters.AddWithValue("@chat", id);
            for (var i = 0; i < readable.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", readable[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                items.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3),
                    reader.GetDateTimeOffset(4), reader.GetDateTimeOffset(5), reader.GetBoolean(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7), reader.GetGuid(8), reader.GetString(9), reader.GetString(10),
                    reader.IsDBNull(11) ? null : reader.GetGuid(11)));
            }
        }

        var fields = await Calendar.FieldsAsync(connection, items.Select(i => i.Id).ToList(), ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(id),
            items = items.Select(i => new
            {
                itemId = Ids.ToText(i.Id),
                topicId = i.Topic is null ? null : Ids.ToText(i.Topic.Value),
                calendarId = Ids.ToText(i.Calendar),
                parentItemId = i.Parent is null ? null : Ids.ToText(i.Parent.Value),
                kind = i.Kind,
                startsAt = i.Starts,
                endsAt = i.Ends,
                allDay = i.AllDay,
                status = i.Status,
                repeatKind = i.Repeat,
                titlePublic = i.TitlePublic,
                visibilityAreaId = Ids.ToText(i.Visibility),
                fields = fields.TryGetValue(i.Id, out var list)
                    ? list.Select(f => new { field = f.Field, areaId = Ids.ToText(f.AreaId), epoch = f.Epoch, @sealed = Base64Url.Encode(f.Blob) })
                    : []
            })
        });
    }
}
