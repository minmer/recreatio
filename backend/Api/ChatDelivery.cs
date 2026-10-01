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
        await using var tx = (SqlTransaction)await c.BeginTransactionAsync(ct);
        await using var cmd = new SqlCommand("""
            DECLARE @now datetimeoffset(7) = SYSDATETIMEOFFSET();
            DECLARE @sent TABLE(chat_id uniqueidentifier);
            UPDATE m WITH (UPDLOCK)
            SET schedule_state = CASE WHEN a.current_epoch = m.epoch AND (
                (m.author_role_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM app.certificate cert JOIN app.role r ON r.id = cert.subject_role_id
                    WHERE r.id = m.author_role_id AND r.revoked_at IS NULL
                      AND cert.scope_kind = N'area' AND cert.scope_id = c.area_id
                      AND cert.revoked_at IS NULL AND cert.expires_at > @now
                      AND (cert.capability IN (N'write', N'admin') OR (cert.capability = N'read'
                           AND (c.posting_policy = N'members' OR (c.posting_policy = N'legacy' AND c.kind IN (N'area', N'seat')))))))
                OR (m.author_access_id IS NOT NULL AND c.kind IN (N'area', N'seat') AND c.posting_policy <> N'writers' AND EXISTS (
                    SELECT 1 FROM app.access s WHERE s.id = m.author_access_id AND s.area_id = c.area_id
                      AND (c.seat_id IS NULL OR c.seat_id = s.id)
                      AND s.revoked_at IS NULL AND s.status = N'active' AND (s.expires_at IS NULL OR s.expires_at > @now)
                      AND (s.verify_hash IS NULL OR s.verified_at IS NOT NULL)))) THEN N'sent' ELSE N'failed' END,
                created_at = @now, changed_at = @now
            OUTPUT CASE WHEN inserted.schedule_state = N'sent' THEN inserted.chat_id END INTO @sent
            FROM app.chat_message m JOIN app.chat c ON c.id = m.chat_id JOIN app.area a ON a.id = c.area_id
            WHERE m.schedule_state = N'pending' AND m.scheduled_at <= @now;
            UPDATE app.chat SET last_message_at = @now WHERE id IN (SELECT chat_id FROM @sent WHERE chat_id IS NOT NULL);
            DELETE FROM app.chat_presence WHERE read_at IS NULL AND typing_until < DATEADD(day, -1, @now);
            SELECT DISTINCT chat_id FROM @sent WHERE chat_id IS NOT NULL;
            """, c, tx);
        var sent = new List<Guid>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            do { while (await reader.ReadAsync(ct)) if (reader.FieldCount == 1 && !reader.IsDBNull(0)) sent.Add(reader.GetGuid(0)); } while (await reader.NextResultAsync(ct));
        }
        await tx.CommitAsync(ct);
        /* 0075 — eine geplante Nachricht weckt, wenn sie hinausgeht. */
        foreach (var chatId in sent) push.Chat(chatId, null);
    }
}
