using Microsoft.Data.SqlClient;
namespace Api;
/// <summary>Persistent delivery with current permissions checked and publication locked across instances.</summary>
public sealed class ChatDelivery(Db db, Push push, ILogger<ChatDelivery> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        do
        {
            try { await DeliverAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception e) { logger.LogError(e, "Scheduled chat delivery failed; will retry"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
    public async Task DeliverAsync(CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var ready = await OnlineReadyAsync(c, ct);
        await using var tx = (SqlTransaction)await c.BeginTransactionAsync(ct);
        /* 0080 — im Kanał schreibt nur, wer im Bereich schreibt; dabei ist ein Platz, wie ChatRules.SeatOfChat sagt. */
        await using var cmd = new SqlCommand($"""
            DECLARE @now datetimeoffset(7) = SYSDATETIMEOFFSET();
            DECLARE @sent TABLE(chat_id uniqueidentifier, silent bit);
            UPDATE m WITH (UPDLOCK)
            SET schedule_state = CASE WHEN a.current_epoch = m.epoch AND (
                (m.author_role_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM app.certificate cert JOIN app.role r ON r.id = cert.subject_role_id
                    WHERE r.id = m.author_role_id AND r.revoked_at IS NULL
                      AND cert.scope_kind = N'area' AND cert.scope_id = c.area_id
                      AND cert.revoked_at IS NULL AND cert.expires_at > @now
                      AND (cert.capability IN (N'write', N'admin') OR (cert.capability = N'read' AND c.kind <> N'channel'
                           AND c.posting_policy = N'members'))))
                OR (m.author_access_id IS NOT NULL AND c.kind IN (N'area', N'seat') AND c.posting_policy <> N'writers' AND EXISTS (
                    SELECT 1 FROM app.access s WHERE s.id = m.author_access_id AND {ChatRules.SeatOfChat}
                      AND s.revoked_at IS NULL AND s.status = N'active' AND (s.expires_at IS NULL OR s.expires_at > @now)
                      AND (s.verify_hash IS NULL OR s.verified_at IS NOT NULL)))) THEN N'sent' ELSE N'failed' END,
                created_at = @now, changed_at = @now, wait_online_from = NULL
            OUTPUT CASE WHEN inserted.schedule_state = N'sent' THEN inserted.chat_id END, inserted.silent INTO @sent
            FROM app.chat_message m JOIN app.chat c ON c.id = m.chat_id JOIN app.area a ON a.id = c.area_id
            WHERE m.schedule_state = N'pending' AND (m.scheduled_at <= @now OR m.id IN ({ReadyList(ready.Count)}));
            UPDATE app.chat SET last_message_at = @now WHERE id IN (SELECT chat_id FROM @sent WHERE chat_id IS NOT NULL);
            DELETE FROM app.chat_presence WHERE read_at IS NULL AND typing_until < DATEADD(day, -1, @now);
            /* 0111 — wer ein halbes Jahr nicht da war, hat kein „ostatnio" mehr (und kein Platz, den es nicht mehr gibt). */
            DELETE o FROM app.online o WHERE o.seen_at < DATEADD(day, -180, @now)
               OR (NOT EXISTS (SELECT 1 FROM app.account x WHERE x.id = o.principal_id) AND NOT EXISTS (SELECT 1 FROM app.access s WHERE s.id = o.principal_id));
            /* 0111 — geweckt wird nur für eine, die nicht „bez dźwięku" ging. */
            SELECT DISTINCT chat_id FROM @sent WHERE chat_id IS NOT NULL AND silent = 0;
            """, c, tx);
        for (var i = 0; i < ready.Count; i++) cmd.Parameters.AddWithValue($"@ready{i}", ready[i]);
        var sent = new List<Guid>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            do { while (await reader.ReadAsync(ct)) if (reader.FieldCount == 1 && !reader.IsDBNull(0)) sent.Add(reader.GetGuid(0)); } while (await reader.NextResultAsync(ct));
        }
        await tx.CommitAsync(ct);
        /* 0075 — eine geplante Nachricht weckt, wenn sie hinausgeht. */
        foreach (var chatId in sent) push.Chat(chatId, null);
    }

    private static string ReadyList(int count) => count == 0 ? "NULL" : string.Join(",", Enumerable.Range(0, count).Select(i => $"@ready{i}"));

    /// <summary>
    /// 0111 — DIE AUF „ONLINE" WARTEN und jetzt gehen dürfen: in ihrer Rozmowa
    /// ist jemand anderes als der Absender gerade in der App (sein Lebenszeichen
    /// jünger als <see cref="Chat.OnlineFor"/>) — und zeigt das (ShareOnline).
    /// Wer es nicht zeigt, weckt sie nicht: sonst verriete die Zustellzeit, wann
    /// er da war. Wer in der Rozmowa ist, sagt chat_presence (gelesen oder getippt).
    /// </summary>
    private static async Task<List<Guid>> OnlineReadyAsync(SqlConnection c, CancellationToken ct)
    {
        var waiting = new List<(Guid Message, Guid Chat, Guid Principal)>();
        await using (var cmd = new SqlCommand("""
            SELECT TOP 500 m.id, m.chat_id, p.principal_id
            FROM app.chat_message m
            JOIN app.chat_presence p ON p.chat_id = m.chat_id AND p.principal_id <> m.wait_online_from
            JOIN app.online o ON o.principal_id = p.principal_id AND o.seen_at > @since
            WHERE m.schedule_state = N'pending' AND m.wait_online_from IS NOT NULL;
            """, c))
        {
            cmd.Parameters.AddWithValue("@since", DateTimeOffset.UtcNow - Chat.OnlineFor);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) waiting.Add((r.GetGuid(0), r.GetGuid(1), r.GetGuid(2)));
        }
        var ready = new List<Guid>();
        var shares = new Dictionary<(Guid, Guid), bool>();
        foreach (var (message, chat, principal) in waiting)
        {
            if (ready.Contains(message)) continue;
            if (!shares.TryGetValue((principal, chat), out var yes))
                shares[(principal, chat)] = yes = await Chat.SharesOnlineAsync(c, principal, chat, ct);
            if (yes) ready.Add(message);
        }
        return ready;
    }
}
