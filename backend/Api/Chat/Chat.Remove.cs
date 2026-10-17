using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0105 — EINE ROZMOWA LÖSCHEN, für alle, unwiderruflich.
///
/// <para>
/// <b>Wer darf:</b> wer ihren Bereich führt (admin/certify — dieselben, die
/// Nachrichten anderer zurücknehmen); in einer Rozmowa zu zweit (`direct`),
/// die keinen Moderator hat, jeder der beiden. Wer nur liest, bekommt 403.
/// </para>
///
/// <para>
/// <b>Was geht:</b> die Nachrichten mit ihren Fassungen, Markierungen und
/// Anhängen (auch die Dateien), die Tematy, wer bis wann gelesen hat, die
/// Schlüssel für die Plätze, die Einstellungen je Rozmowa und die Formulare an
/// einem Kanał. <b>Was bleibt:</b> der Bereich (er trägt mehr als die Rozmowa —
/// Kalender, Aufgaben, Menschen); Aufgaben und Termine, die aus einer Nachricht
/// entstanden, bleiben — nur ohne den Verweis auf sie. Eine neue Rozmowa an
/// demselben Bereich lässt sich danach wieder anfangen.
/// </para>
/// </summary>
public static partial class Chat
{
    private static void MapRemove(WebApplication app) =>
        app.MapDelete("/workspace/chat/{id:guid}", RemoveAsync);

    private static async Task RemoveAsync(HttpContext ctx, Db db, IConfiguration config, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var read = await ReadableAsync(ctx, db, connection, id);
        if (read is null) return;
        var (chat, mine, _) = read.Value;

        var may = chat.Kind == "direct"
            ? (await HoldingAsync(connection, mine, chat.AreaId, Writers, ctx.RequestAborted)).Count > 0
            : await ModeratesAsync(connection, chat, mine, ctx.RequestAborted);
        if (!may)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Rozmowę usuwa ktoś, kto prowadzi jej obszar.");
            return;
        }

        var files = new List<Guid>();
        int messages;
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            try
            {
                await using var cmd = new SqlCommand("""
                    SET NOCOUNT ON;
                    DECLARE @topics TABLE (id uniqueidentifier PRIMARY KEY);
                    INSERT INTO @topics (id) SELECT id FROM app.topic WHERE chat_id = @chat;
                    DECLARE @count int = (SELECT COUNT(*) FROM app.chat_message WHERE chat_id = @chat);

                    /* Was aus der Rozmowa entstand, bleibt — ohne den Verweis. */
                    UPDATE app.task SET chat_id = NULL, topic_id = NULL, message_id = NULL
                     WHERE chat_id = @chat OR topic_id IN (SELECT id FROM @topics);
                    UPDATE app.calendar_item SET chat_id = NULL, topic_id = NULL
                     WHERE chat_id = @chat OR topic_id IN (SELECT id FROM @topics);

                    DELETE FROM app.chat_mark WHERE message_id IN (SELECT id FROM app.chat_message WHERE chat_id = @chat);
                    SELECT id FROM app.chat_attachment WHERE chat_id = @chat;
                    DELETE FROM app.chat_attachment WHERE chat_id = @chat;
                    DELETE FROM app.chat_presence WHERE chat_id = @chat;
                    DELETE FROM app.chat_preference WHERE scope_id = @chat;
                    DELETE FROM app.chat_message_version WHERE message_id IN (SELECT id FROM app.chat_message WHERE chat_id = @chat);
                    DELETE FROM app.audience_form WHERE subject_kind = N'chat' AND subject_id = @chat;
                    DELETE FROM app.chat_read WHERE chat_id = @chat;
                    DELETE FROM app.chat_seat_key WHERE chat_id = @chat;
                    DELETE FROM app.chat_message WHERE chat_id = @chat;

                    DELETE FROM app.topic_message WHERE topic_id IN (SELECT id FROM @topics);
                    UPDATE app.topic SET parent_topic_id = NULL WHERE parent_topic_id IN (SELECT id FROM @topics);
                    DELETE FROM app.topic WHERE id IN (SELECT id FROM @topics);
                    DELETE FROM app.chat WHERE id = @chat;

                    SELECT @count;
                    """, connection, tx);
                cmd.Parameters.AddWithValue("@chat", chat.Id);

                await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
                {
                    while (await reader.ReadAsync(ctx.RequestAborted)) files.Add(reader.GetGuid(0));
                    await reader.NextResultAsync(ctx.RequestAborted);
                    messages = await reader.ReadAsync(ctx.RequestAborted) ? reader.GetInt32(0) : 0;
                }

                await tx.CommitAsync(ctx.RequestAborted);
            }
            catch
            {
                await tx.RollbackAsync(CancellationToken.None);
                throw;
            }
        }

        /* Die Dateien erst nach dem Commit — eine Zeile ohne Datei wäre schlimmer als eine Datei ohne Zeile. */
        foreach (var file in files)
        {
            try { File.Delete(AttachmentFile(config, file)); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }

        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(chat.Id), removed = true, messages, files = files.Count });
    }
}
