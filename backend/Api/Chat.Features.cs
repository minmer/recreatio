using System.Text.Json;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

public static partial class Chat
{
    private static void MapFeatures(WebApplication app)
    {
        app.MapPut("/workspace/chat/{id:guid}/policy", PolicyAsync);
        app.MapGet("/workspace/chat-preferences", GetCommonPreferencesAsync);
        app.MapPut("/workspace/chat-preferences", PutCommonPreferencesAsync);
        app.MapGet("/workspace/chat/{id:guid}/features", FeaturesAsync);
        app.MapPut("/workspace/chat/{id:guid}/preferences", PutPreferencesAsync);
        app.MapPost("/workspace/chat/{id:guid}/marks", MarkAsync);
        app.MapPost("/workspace/chat/{id:guid}/typing", TypingAsync);
        app.MapPost("/workspace/chat/{id:guid}/seen", SeenAsync);
        app.MapGet("/workspace/chat/{id:guid}/scheduled", ScheduledAsync);
        app.MapDelete("/workspace/chat/{id:guid}/scheduled/{messageId:guid}", CancelScheduledAsync);
        app.MapPut("/workspace/chat/{id:guid}/scheduled/{messageId:guid}", RescheduleAsync);
        app.MapPost("/workspace/chat/{id:guid}/attachments", UploadAsync).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(52_428_800));
        app.MapGet("/workspace/chat/{id:guid}/attachments/{attachmentId:guid}", DownloadAsync);
        app.MapGet("/seat/{token}/chat/{id:guid}/features", FeaturesAsync);
        app.MapPut("/seat/{token}/chat/{id:guid}/preferences", PutPreferencesAsync);
        app.MapPost("/seat/{token}/chat/{id:guid}/marks", MarkAsync);
        app.MapPost("/seat/{token}/chat/{id:guid}/typing", TypingAsync);
        app.MapPost("/seat/{token}/chat/{id:guid}/seen", SeenAsync);
        app.MapGet("/seat/{token}/chat/{id:guid}/scheduled", ScheduledAsync);
        app.MapDelete("/seat/{token}/chat/{id:guid}/scheduled/{messageId:guid}", CancelScheduledAsync);
        app.MapPut("/seat/{token}/chat/{id:guid}/scheduled/{messageId:guid}", RescheduleAsync);
        app.MapPost("/seat/{token}/chat/{id:guid}/attachments", UploadAsync).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(52_428_800));
        app.MapGet("/seat/{token}/chat/{id:guid}/attachments/{attachmentId:guid}", DownloadAsync);
    }

    private sealed record Actor(ChatRow Chat, Guid Principal, List<Guid> Roles, bool Seat, bool Writes, bool Moderates);
    private static async Task<Actor?> ActorAsync(HttpContext ctx, Db db, SqlConnection c, Guid id)
    {
        if (ctx.Request.RouteValues["token"] is string token)
        {
            var found = await SeatChatAsync(ctx, c, token, id);
            return found is null ? null : new(found.Value.Chat, found.Value.Seat.Id, [], true,
                ChatRules.SeatCanWrite(found.Value.Chat.Kind, found.Value.Chat.PostingPolicy), false);
        }
        var read = await ReadableAsync(ctx, db, c, id);
        if (read is null) return null;
        var (chat, mine, account) = read.Value;
        return new(chat, account, mine, false,
            (await HoldingAsync(c, mine, chat.AreaId, SpeakersOf(chat), ctx.RequestAborted)).Count > 0,
            await ModeratesAsync(c, chat, mine, ctx.RequestAborted));
    }

    private static async Task<bool> SeatMayPostAsync(HttpContext ctx, ChatRow chat)
    {
        if (ChatRules.SeatCanWrite(chat.Kind, chat.PostingPolicy)) return true;
        await Fail(ctx, 403, "Ten kanał pozwala Ci tylko czytać.");
        return false;
    }
    private static async Task<bool> ValidSendAtAsync(HttpContext ctx, DateTimeOffset? sendAt)
    {
        if (ChatRules.ValidSchedule(sendAt, DateTimeOffset.UtcNow)) return true;
        await Fail(ctx, 400, "Wybierz przyszły termin w ciągu najbliższego roku.");
        return false;
    }
    public sealed record PolicyRequest(string PostingPolicy);
    private static async Task PolicyAsync(HttpContext ctx, Db db, Guid id, PolicyRequest body)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id);
        if (actor is null) return;
        if (!actor.Moderates) { await Fail(ctx, 403, "Tylko prowadzący zmienia zasady rozmowy."); return; }
        if (body.PostingPolicy is not ("legacy" or "members" or "writers")) { await Fail(ctx, 400, "Nieznana zasada."); return; }
        await using var cmd = new SqlCommand("UPDATE app.chat SET posting_policy = @policy WHERE id = @id;", c);
        cmd.Parameters.AddWithValue("@id", id); cmd.Parameters.AddWithValue("@policy", body.PostingPolicy);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { saved = true });
    }

    public sealed record AvailabilityWindow(int Day, int Start, int End);
    public sealed record Preferences(string TimeZone = "UTC", AvailabilityWindow[]? Windows = null,
        bool UseAvailability = false, bool Muted = false, bool Archived = false, bool ReadReceipts = false, bool ShareAvailability = false);
    public sealed record PreferenceRequest(Preferences? Settings);
    private static async Task<Preferences?> PreferencesOfAsync(SqlConnection c, Guid principal, Guid scope, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT settings FROM app.chat_preference WHERE principal_id = @p AND scope_id = @s;", c);
        cmd.Parameters.AddWithValue("@p", principal); cmd.Parameters.AddWithValue("@s", scope);
        var json = await cmd.ExecuteScalarAsync(ct) as string;
        return json is null ? null : JsonSerializer.Deserialize<Preferences>(json);
    }
    private static async Task SavePreferencesAsync(HttpContext ctx, SqlConnection c, Guid principal, Guid scope, Preferences? prefs)
    {
        if (prefs is not null)
        {
            try { TimeZoneInfo.FindSystemTimeZoneById(prefs.TimeZone); }
            catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException)
            { await Fail(ctx, 400, "Nieznana strefa czasowa."); return; }
            if (prefs.Windows is { Length: > 28 } || prefs.Windows?.Any(w => w is null || w.Day is < 0 or > 6 || w.Start < 0 || w.End > 1440 || w.Start >= w.End) == true)
            { await Fail(ctx, 400, "Nieprawidłowe godziny dostępności."); return; }
        }
        await using var tx = (SqlTransaction)await c.BeginTransactionAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            DELETE FROM app.chat_preference WITH (UPDLOCK, HOLDLOCK) WHERE principal_id = @p AND scope_id = @s;
            IF @json IS NOT NULL INSERT INTO app.chat_preference(principal_id, scope_id, settings) VALUES (@p, @s, @json);
            """, c, tx);
        cmd.Parameters.AddWithValue("@p", principal); cmd.Parameters.AddWithValue("@s", scope);
        cmd.Parameters.AddWithValue("@json", prefs is null ? DBNull.Value : JsonSerializer.Serialize(prefs));
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { saved = true });
    }
    private static async Task GetCommonPreferencesAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db); if (who is null) { ctx.Response.StatusCode = 401; return; }
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { settings = await PreferencesOfAsync(c, who.Value.AccountId, Guid.Empty, ctx.RequestAborted) ?? new() });
    }
    private static async Task PutCommonPreferencesAsync(HttpContext ctx, Db db, PreferenceRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db); if (who is null) { ctx.Response.StatusCode = 401; return; }
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        await SavePreferencesAsync(ctx, c, who.Value.AccountId, Guid.Empty, body.Settings);
    }
    private static async Task PutPreferencesAsync(HttpContext ctx, Db db, Guid id, PreferenceRequest body)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        await SavePreferencesAsync(ctx, c, actor.Principal, id, body.Settings);
    }
    /// <summary>
    /// 0067 — SOLL DIESE ROZMOWA JETZT LEISE SEIN? Stumm, archiviert, oder
    /// außerhalb der eigenen Zeiten — dann zählt sie, aber sie meldet sich
    /// nicht (keine Benachrichtigung auf dem Telefon).
    /// </summary>
    internal static async Task<bool> QuietAsync(SqlConnection c, Guid account, Guid chatId, CancellationToken ct)
    {
        var prefs = await PreferencesOfAsync(c, account, chatId, ct) ?? await PreferencesOfAsync(c, account, Guid.Empty, ct) ?? new();
        try { return prefs.Muted || prefs.Archived || !AvailableAt(prefs, DateTimeOffset.UtcNow); }
        catch (TimeZoneNotFoundException) { return prefs.Muted || prefs.Archived; }
    }

    public static bool AvailableAt(Preferences prefs, DateTimeOffset at)
    {
        if (!prefs.UseAvailability) return true;
        var local = TimeZoneInfo.ConvertTime(at, TimeZoneInfo.FindSystemTimeZoneById(prefs.TimeZone));
        var minute = local.Hour * 60 + local.Minute;
        return prefs.Windows?.Any(w => w.Day == (int)local.DayOfWeek && minute >= w.Start && minute < w.End) == true;
    }
    public sealed record SeenRequest(DateTimeOffset Through);
    private static async Task SeenAsync(HttpContext ctx, Db db, Guid id, SeenRequest body)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        await using var cmd = new SqlCommand("""
            MERGE app.chat_presence WITH (HOLDLOCK) AS t USING (SELECT @id chat_id, @p principal_id) s
            ON t.chat_id = s.chat_id AND t.principal_id = s.principal_id
            WHEN MATCHED THEN UPDATE SET read_at = CASE WHEN t.read_at > @through THEN t.read_at ELSE @through END, is_seat = @seat
            WHEN NOT MATCHED THEN INSERT(chat_id, principal_id, typing_until, read_at, is_seat)
                VALUES (@id, @p, SYSDATETIMEOFFSET(), @through, @seat);
            """, c);
        cmd.Parameters.AddWithValue("@id", id); cmd.Parameters.AddWithValue("@p", actor.Principal); cmd.Parameters.AddWithValue("@seat", actor.Seat);
        cmd.Parameters.AddWithValue("@through", body.Through > DateTimeOffset.UtcNow ? DateTimeOffset.UtcNow : body.Through);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); await ctx.Response.WriteAsJsonAsync(new { read = true });
    }
    private static async Task<List<object>> ReceiptsAsync(HttpContext ctx, SqlConnection c, Actor actor)
    {
        var rows = new List<(Guid Principal, bool Seat, DateTimeOffset At)>();
        await using (var cmd = new SqlCommand("SELECT TOP 200 principal_id, is_seat, read_at FROM app.chat_presence WHERE chat_id = @id AND principal_id <> @p AND read_at IS NOT NULL ORDER BY read_at DESC;", c))
        {
            cmd.Parameters.AddWithValue("@id", actor.Chat.Id); cmd.Parameters.AddWithValue("@p", actor.Principal);
            await using var r = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await r.ReadAsync(ctx.RequestAborted)) rows.Add((r.GetGuid(0), r.GetBoolean(1), r.GetDateTimeOffset(2)));
        }
        var result = new List<object>();
        foreach (var row in rows)
        {
            var prefs = await PreferencesOfAsync(c, row.Principal, actor.Chat.Id, ctx.RequestAborted)
                ?? await PreferencesOfAsync(c, row.Principal, Guid.Empty, ctx.RequestAborted) ?? new();
            if (!prefs.ReadReceipts && !prefs.ShareAvailability) continue;
            List<Guid> roles = [];
            if (row.Seat)
            {
                await using var live = new SqlCommand($"SELECT COUNT(*) FROM app.access s WHERE s.id = @p AND s.area_id = @area AND {LiveSeat("s")};", c);
                live.Parameters.AddWithValue("@p", row.Principal); live.Parameters.AddWithValue("@area", actor.Chat.AreaId); live.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                if ((int)(await live.ExecuteScalarAsync(ctx.RequestAborted))! == 0) continue;
            }
            else
            {
                var mine = (await Workspace.RolesOfAsync(c, row.Principal, ctx.RequestAborted)).Select(r => r.Id).ToList();
                roles = await HoldingAsync(c, mine, actor.Chat.AreaId, Readers, ctx.RequestAborted);
                if (roles.Count == 0) continue;
            }
            result.Add(new { roleIds = roles.Select(Ids.ToText), seatId = row.Seat ? Ids.ToText(row.Principal) : null,
                readAt = prefs.ReadReceipts ? row.At : (DateTimeOffset?)null,
                available = prefs.ShareAvailability ? AvailableAt(prefs, DateTimeOffset.UtcNow) : (bool?)null });
        }
        return result;
    }
    private static async Task FeaturesAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        var common = await PreferencesOfAsync(c, actor.Principal, Guid.Empty, ctx.RequestAborted) ?? new();
        var own = await PreferencesOfAsync(c, actor.Principal, id, ctx.RequestAborted);
        var marks = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT k.message_id, k.principal_id, k.kind, k.value FROM app.chat_mark k
            JOIN app.chat_message m ON m.id = k.message_id
            WHERE m.chat_id = @id AND m.schedule_state = N'sent' AND m.deleted_at IS NULL
              AND (k.kind <> N'star' OR k.principal_id = @p);
            """, c))
        {
            cmd.Parameters.AddWithValue("@id", id); cmd.Parameters.AddWithValue("@p", actor.Principal);
            await using var r = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await r.ReadAsync(ctx.RequestAborted)) marks.Add(new { messageId = Ids.ToText(r.GetGuid(0)), mine = r.GetGuid(1) == actor.Principal, kind = r.GetString(2), value = r.GetString(3) });
        }
        await using var typing = new SqlCommand("SELECT COUNT(*) FROM app.chat_presence WHERE chat_id = @id AND principal_id <> @p AND typing_until > SYSDATETIMEOFFSET();", c);
        typing.Parameters.AddWithValue("@id", id); typing.Parameters.AddWithValue("@p", actor.Principal);
        await ctx.Response.WriteAsJsonAsync(new { common, settings = own, effective = own ?? common,
            receipts = await ReceiptsAsync(ctx, c, actor), lastMessageAt = actor.Chat.LastMessageAt,
            canWrite = actor.Writes, postingPolicy = actor.Chat.PostingPolicy, marks,
            typing = (int)(await typing.ExecuteScalarAsync(ctx.RequestAborted))! });
    }
    public sealed record MarkRequest(Guid MessageId, string Kind, string? Value);
    private static async Task MarkAsync(HttpContext ctx, Db db, Guid id, MarkRequest body)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        if (body.Kind is not ("reaction" or "star" or "pin") || body.Value?.Length > 32)
        { await Fail(ctx, 400, "Nieprawidłowe oznaczenie."); return; }
        if (body.Kind == "pin" && !actor.Moderates) { await Fail(ctx, 403, "Przypina prowadzący rozmowę."); return; }
        await using var tx = (SqlTransaction)await c.BeginTransactionAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            IF EXISTS (SELECT 1 FROM app.chat_message WHERE id = @m AND chat_id = @id AND schedule_state = N'sent' AND deleted_at IS NULL)
            BEGIN
                DELETE FROM app.chat_mark WITH (UPDLOCK, HOLDLOCK) WHERE message_id = @m AND (principal_id = @p OR @kind = N'pin') AND kind = @kind;
                IF @value IS NOT NULL INSERT INTO app.chat_mark(message_id, principal_id, kind, value) VALUES (@m, @p, @kind, @value);
            END
            """, c, tx);
        cmd.Parameters.AddWithValue("@id", id); cmd.Parameters.AddWithValue("@m", body.MessageId);
        cmd.Parameters.AddWithValue("@p", actor.Principal); cmd.Parameters.AddWithValue("@kind", body.Kind);
        cmd.Parameters.AddWithValue("@value", (object?)body.Value ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { saved = true });
    }
    private static async Task TypingAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        if (!actor.Writes) { ctx.Response.StatusCode = 403; return; }
        await using var cmd = new SqlCommand("""
            MERGE app.chat_presence WITH (HOLDLOCK) AS t USING (SELECT @id chat_id, @p principal_id) s
            ON t.chat_id = s.chat_id AND t.principal_id = s.principal_id
            WHEN MATCHED THEN UPDATE SET typing_until = DATEADD(second, 6, SYSDATETIMEOFFSET())
            WHEN NOT MATCHED THEN INSERT(chat_id, principal_id, typing_until) VALUES (@id, @p, DATEADD(second, 6, SYSDATETIMEOFFSET()));
            """, c);
        cmd.Parameters.AddWithValue("@id", id); cmd.Parameters.AddWithValue("@p", actor.Principal);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); await ctx.Response.WriteAsJsonAsync(new { saved = true });
    }
    private static string OwnerPredicate(Actor a) => a.Seat ? "author_access_id = @p" :
        a.Roles.Count == 0 ? "1 = 0" : "author_role_id IN (" + string.Join(",", a.Roles.Select((_, i) => $"@r{i}")) + ")";
    private static void OwnerParameters(SqlCommand cmd, Actor a)
    {
        cmd.Parameters.AddWithValue("@p", a.Principal);
        for (var i = 0; i < a.Roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", a.Roles[i]);
    }
    private static async Task ScheduledAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        await using var cmd = new SqlCommand($"""
            SELECT TOP 100 id, scheduled_at, schedule_state, epoch, body_sealed, author_role_id, author_access_id, created_at FROM app.chat_message
            WHERE chat_id = @id AND schedule_state IN (N'pending', N'failed') AND {OwnerPredicate(actor)} ORDER BY scheduled_at;
            """, c);
        cmd.Parameters.AddWithValue("@id", id); OwnerParameters(cmd, actor);
        var rows = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await r.ReadAsync(ctx.RequestAborted)) rows.Add(new { messageId = Ids.ToText(r.GetGuid(0)), sendAt = r.GetDateTimeOffset(1), state = r.GetString(2), epoch = r.GetInt32(3),
            bodySealed = r.IsDBNull(4) ? null : Base64Url.Encode((byte[])r[4]),
            authorRoleId = r.IsDBNull(5) ? null : Ids.ToText(r.GetGuid(5)), authorSeatId = r.IsDBNull(6) ? null : Ids.ToText(r.GetGuid(6)),
            createdAt = r.GetDateTimeOffset(7), deletedAt = (DateTimeOffset?)null });
        await ctx.Response.WriteAsJsonAsync(new { messages = rows });
    }
    public sealed record ScheduleRequest(DateTimeOffset SendAt);
    private static async Task RescheduleAsync(HttpContext ctx, Db db, Guid id, Guid messageId, ScheduleRequest body)
    {
        if (!await ValidSendAtAsync(ctx, body.SendAt)) return;
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        if (!actor.Writes) { ctx.Response.StatusCode = 403; return; }
        await using var cmd = new SqlCommand($"UPDATE app.chat_message SET scheduled_at = @due WHERE id = @m AND chat_id = @id AND schedule_state = N'pending' AND {OwnerPredicate(actor)};", c);
        cmd.Parameters.AddWithValue("@id", id); cmd.Parameters.AddWithValue("@m", messageId); cmd.Parameters.AddWithValue("@due", body.SendAt); OwnerParameters(cmd, actor);
        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0) { ctx.Response.StatusCode = 409; return; }
        await ctx.Response.WriteAsJsonAsync(new { saved = true });
    }
    private static async Task CancelScheduledAsync(HttpContext ctx, Db db, Guid id, Guid messageId)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        await using var cmd = new SqlCommand($"UPDATE app.chat_message SET schedule_state = N'cancelled', body_sealed = NULL WHERE id = @m AND chat_id = @id AND schedule_state IN (N'pending', N'failed') AND {OwnerPredicate(actor)};", c);
        cmd.Parameters.AddWithValue("@id", id); cmd.Parameters.AddWithValue("@m", messageId); OwnerParameters(cmd, actor);
        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        if (changed == 0) { ctx.Response.StatusCode = 404; return; }
        await ctx.Response.WriteAsJsonAsync(new { cancelled = true });
    }
}
