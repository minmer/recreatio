using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// NACHRICHTEN IN FASSUNGEN (0058) — bearbeiten, die Geschichte zeigen,
/// Gelöschtes zurückholen.
///
/// <para>
/// <b>Jede Fassung ist unterschrieben.</b> <see cref="MessageVersionRecord"/>
/// trägt seit 0052 eine Nummer; die Unterschrift gilt dem Abdruck der Hülle
/// MIT dieser Nummer. So kann der Betreiber keine Fassung einschieben, die nie
/// geschrieben wurde, und keine ältere als neue ausgeben.
/// </para>
///
/// <para>
/// <b>Bearbeiten darf nur, wer geschrieben hat</b> — und nur, solange er hier
/// noch schreibt. Wer moderiert, darf löschen, aber keinem die Worte ändern.
/// </para>
///
/// <para>
/// <b>Die Geschichte sieht, wer die Rozmowa liest</b>: dass und wie eine
/// Nachricht geändert wurde, gehört zu ihr. Die Fassungen einer GELÖSCHTEN
/// Nachricht sieht nur, wer sie zurückholen dürfte — sonst wäre Löschen nur ein
/// Verstecken vor denen, die nicht nachsehen.
/// </para>
///
/// <para>
/// <b>Zurückholen</b> darf der Verfasser, wenn er selbst gelöscht hat, und
/// wer moderiert, immer. Was ein Moderator gelöscht hat, holt der Verfasser
/// nicht einfach zurück.
/// </para>
/// </summary>
public static partial class Chat
{
    public sealed record EditRequest(int Version, int Epoch, string BodySealed, string Signature, long SignedAt);

    private sealed record MessageRow(
        Guid Id, Guid ChatId, Guid? AuthorRole, Guid? AuthorSeat, int Version, bool Deleted,
        Guid? DeletedByRole, Guid? DeletedBySeat);

    private static async Task<MessageRow?> MessageOfAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT id, chat_id, author_role_id, author_access_id, version, deleted_at, deleted_by_role_id, deleted_by_access_id
            FROM app.chat_message WHERE id = @id AND schedule_state = N'sent';
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new MessageRow(reader.GetGuid(0), reader.GetGuid(1),
            reader.IsDBNull(2) ? null : reader.GetGuid(2),
            reader.IsDBNull(3) ? null : reader.GetGuid(3),
            reader.GetInt32(4), !reader.IsDBNull(5),
            reader.IsDBNull(6) ? null : reader.GetGuid(6),
            reader.IsDBNull(7) ? null : reader.GetGuid(7));
    }

    /// <summary>Wer in einer Rozmowa (nicht zu zweit) moderiert — admin oder certify im Bereich.</summary>
    private static async Task<bool> ModeratesAsync(SqlConnection connection, ChatRow chat, List<Guid> mine, CancellationToken ct) =>
        chat.Kind != "direct" && (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ct)).Count > 0;

    /* ======================================================================
       BEARBEITEN
       ====================================================================== */

    /// <summary>
    /// Die neue Fassung schreiben — die alte bleibt in der Geschichte. Nur
    /// wenn die Nummer die nächste ist: zwei Fenster, die zugleich bearbeiten,
    /// überschreiben einander nicht still (409).
    /// </summary>
    private static async Task<DateTimeOffset?> WriteVersionAsync(
        HttpContext ctx, SqlConnection connection, MessageRow message, Incoming next, int version)
    {
        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var update = new SqlCommand("""
                UPDATE app.chat_message
                   SET epoch = @epoch, body_sealed = @body, body_sha256 = @hash, signature = @sig, signed_at = @signed,
                       version = @version, edited_at = @now, changed_at = @now
                 WHERE id = @id AND version = @previous AND deleted_at IS NULL;
                """, connection, tx))
            {
                update.Parameters.AddWithValue("@id", message.Id);
                update.Parameters.AddWithValue("@epoch", next.Epoch);
                update.Parameters.AddWithValue("@body", next.Body);
                update.Parameters.AddWithValue("@hash", next.BodyHash);
                update.Parameters.AddWithValue("@sig", next.Signature);
                update.Parameters.AddWithValue("@signed", next.SignedAt);
                update.Parameters.AddWithValue("@version", version);
                update.Parameters.AddWithValue("@previous", version - 1);
                update.Parameters.AddWithValue("@now", now);

                if (await update.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status409Conflict,
                        "Ta wiadomość zmieniła się w międzyczasie — odśwież i spróbuj jeszcze raz.");
                    return null;
                }
            }

            await using (var keep = new SqlCommand("""
                INSERT INTO app.chat_message_version
                    (message_id, version, epoch, body_sealed, body_sha256, signature, signed_at, created_at)
                VALUES (@id, @version, @epoch, @body, @hash, @sig, @signed, @now);
                """, connection, tx))
            {
                keep.Parameters.AddWithValue("@id", message.Id);
                keep.Parameters.AddWithValue("@version", version);
                keep.Parameters.AddWithValue("@epoch", next.Epoch);
                keep.Parameters.AddWithValue("@body", next.Body);
                keep.Parameters.AddWithValue("@hash", next.BodyHash);
                keep.Parameters.AddWithValue("@sig", next.Signature);
                keep.Parameters.AddWithValue("@signed", next.SignedAt);
                keep.Parameters.AddWithValue("@now", now);
                await keep.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
            return now;
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Taka wersja już jest.");
            return null;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    /// <summary>Was unterschrieben wird — dieselbe Nachricht, die nächste Nummer.</summary>
    private static MessageVersionRecord VersionRecordOf(Guid messageId, Incoming next, Guid author, int version) => new()
    {
        Id = messageId,
        MessageId = messageId,
        Version = version,
        AuthorRoleId = author,
        BodyHash = next.BodyHash,
        CreatedUtc = next.SignedAt
    };

    private static async Task EditAsync(HttpContext ctx, Db db, Guid id, EditRequest body)
    {
        var next = await IncomingAsync(ctx, id.ToString(), body.Epoch, body.BodySealed, body.Signature, body.SignedAt);
        if (next is null) return;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var message = await MessageOfAsync(connection, id, ctx.RequestAborted);
        if (message is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
            return;
        }

        var seen = await ReadableAsync(ctx, db, connection, message.ChatId);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        if (message.AuthorRole is not Guid author || !mine.Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Zmienić możesz tylko swoją wiadomość.");
            return;
        }

        if (message.Deleted)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Usuniętej wiadomości nie zmienisz — najpierw ją przywróć.");
            return;
        }

        if (!(await HoldingAsync(connection, [author], chat.AreaId, SpeakersOf(chat), ctx.RequestAborted)).Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola w tej rozmowie już tylko czyta.");
            return;
        }

        if (body.Version != message.Version + 1)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta wiadomość zmieniła się w międzyczasie — odśwież i spróbuj jeszcze raz.");
            return;
        }

        if (!await EpochExistsAsync(ctx, connection, chat, next.Epoch)) return;

        byte[]? signKey;
        await using (var cmd = new SqlCommand("SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            cmd.Parameters.AddWithValue("@id", author);
            signKey = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
        }

        if (signKey is null || !VerifySignature(VersionRecordOf(id, next, author, body.Version), signKey, next.Signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis tej wersji się nie zgadza.");
            return;
        }

        var at = await WriteVersionAsync(ctx, connection, message, next, body.Version);
        if (at is null) return;

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), version = body.Version, editedAt = at.Value });
    }

    private static async Task SeatEditAsync(HttpContext ctx, Db db, string token, Guid id, EditRequest body)
    {
        var next = await IncomingAsync(ctx, id.ToString(), body.Epoch, body.BodySealed, body.Signature, body.SignedAt);
        if (next is null) return;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var message = await MessageOfAsync(connection, id, ctx.RequestAborted);
        if (message is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
            return;
        }

        var found = await SeatChatAsync(ctx, connection, token, message.ChatId);
        if (found is null) return;
        var (seat, chat) = found.Value;
        if (!await SeatMayPostAsync(ctx, chat)) return;

        if (message.AuthorSeat != seat.Id)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Zmienić możesz tylko swoją wiadomość.");
            return;
        }

        if (message.Deleted)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Usuniętej wiadomości nie zmienisz — najpierw ją przywróć.");
            return;
        }

        if (body.Version != message.Version + 1)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta wiadomość zmieniła się w międzyczasie — odśwież i spróbuj jeszcze raz.");
            return;
        }

        if (!await EpochExistsAsync(ctx, connection, chat, next.Epoch)) return;

        byte[]? signKey;
        await using (var cmd = new SqlCommand("SELECT sign_public_key FROM app.seat_identity WHERE access_id = @seat;", connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Id);
            signKey = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
        }

        if (signKey is null || !VerifySeatSignature(VersionRecordOf(id, next, seat.Id, body.Version), signKey, next.Signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis tej wersji się nie zgadza.");
            return;
        }

        var at = await WriteVersionAsync(ctx, connection, message, next, body.Version);
        if (at is null) return;

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), version = body.Version, editedAt = at.Value });
    }

    /* ======================================================================
       ZURÜCKHOLEN
       ====================================================================== */

    /// <summary>Die jüngste Fassung wieder in die Zeile — oder 409, wenn es keine gibt (vor 0058 gelöscht).</summary>
    private static async Task<bool> BringBackAsync(HttpContext ctx, SqlConnection connection, Guid id)
    {
        await using var cmd = new SqlCommand("""
            UPDATE m
               SET epoch = v.epoch, body_sealed = v.body_sealed, body_sha256 = v.body_sha256,
                   signature = v.signature, signed_at = v.signed_at, version = v.version,
                   deleted_at = NULL, deleted_by_role_id = NULL, deleted_by_access_id = NULL, changed_at = @now
              FROM app.chat_message m
              JOIN app.chat_message_version v ON v.message_id = m.id
             WHERE m.id = @id AND m.deleted_at IS NOT NULL
               AND v.version = (SELECT MAX(x.version) FROM app.chat_message_version x WHERE x.message_id = m.id);
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) > 0) return true;

        await Fail(ctx, StatusCodes.Status409Conflict,
            "Tej wiadomości nie da się przywrócić — usunięto ją, zanim rozmowy zapamiętywały wersje.");
        return false;
    }

    private static async Task RestoreAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var message = await MessageOfAsync(connection, id, ctx.RequestAborted);
        if (message is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
            return;
        }

        var seen = await ReadableAsync(ctx, db, connection, message.ChatId);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        if (!message.Deleted)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta wiadomość nie jest usunięta.");
            return;
        }

        var ownDeletion = message.AuthorRole is Guid author && mine.Contains(author) && message.DeletedByRole == author;
        if (!ownDeletion && !await ModeratesAsync(connection, chat, mine, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Przywrócić może autor, jeśli sam usunął — albo ten, kto prowadzi rozmowę.");
            return;
        }

        if (ownDeletion && !await ModeratesAsync(connection, chat, mine, ctx.RequestAborted)
            && (await HoldingAsync(connection, [message.AuthorRole!.Value], chat.AreaId, SpeakersOf(chat), ctx.RequestAborted)).Count == 0)
        { await Fail(ctx, 403, "W tej rozmowie już tylko czytasz."); return; }

        if (!await BringBackAsync(ctx, connection, id)) return;
        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), restored = true });
    }

    private static async Task SeatRestoreAsync(HttpContext ctx, Db db, string token, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var message = await MessageOfAsync(connection, id, ctx.RequestAborted);
        if (message is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
            return;
        }

        var found = await SeatChatAsync(ctx, connection, token, message.ChatId);
        if (found is null) return;

        if (!await SeatMayPostAsync(ctx, found.Value.Chat)) return;

        if (!message.Deleted)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta wiadomość nie jest usunięta.");
            return;
        }

        if (message.AuthorSeat != found.Value.Seat.Id || message.DeletedBySeat != found.Value.Seat.Id)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Przywrócić możesz tylko to, co sam usunąłeś.");
            return;
        }

        if (!await BringBackAsync(ctx, connection, id)) return;
        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), restored = true });
    }

    /* ======================================================================
       DIE GESCHICHTE
       ====================================================================== */

    private static async Task<List<object>> VersionListAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        var list = new List<object>();
        await using var cmd = new SqlCommand("""
            SELECT version, epoch, body_sealed, signature, signed_at, created_at
            FROM app.chat_message_version WHERE message_id = @id ORDER BY version;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(new
            {
                version = reader.GetInt32(0),
                epoch = reader.GetInt32(1),
                bodySealed = Base64Url.Encode((byte[])reader[2]),
                signature = Base64Url.Encode((byte[])reader[3]),
                signedAt = reader.GetDateTimeOffset(4),
                createdAt = reader.GetDateTimeOffset(5)
            });
        }

        return list;
    }

    private static async Task VersionsAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var message = await MessageOfAsync(connection, id, ctx.RequestAborted);
        if (message is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
            return;
        }

        var seen = await ReadableAsync(ctx, db, connection, message.ChatId);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        if (message.Deleted)
        {
            var ownDeletion = message.AuthorRole is Guid author && mine.Contains(author) && message.DeletedByRole == author;
            if (!ownDeletion && !await ModeratesAsync(connection, chat, mine, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Wersje usuniętej wiadomości widzi tylko ten, kto może ją przywrócić.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            messageId = Ids.ToText(id),
            authorRoleId = message.AuthorRole is null ? null : Ids.ToText(message.AuthorRole.Value),
            authorSeatId = message.AuthorSeat is null ? null : Ids.ToText(message.AuthorSeat.Value),
            versions = await VersionListAsync(connection, id, ctx.RequestAborted)
        });
    }

    private static async Task SeatVersionsAsync(HttpContext ctx, Db db, string token, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var message = await MessageOfAsync(connection, id, ctx.RequestAborted);
        if (message is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
            return;
        }

        var found = await SeatChatAsync(ctx, connection, token, message.ChatId);
        if (found is null) return;

        if (message.Deleted && (message.AuthorSeat != found.Value.Seat.Id || message.DeletedBySeat != found.Value.Seat.Id))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Wersje usuniętej wiadomości widzi tylko ten, kto może ją przywrócić.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            messageId = Ids.ToText(id),
            authorRoleId = message.AuthorRole is null ? null : Ids.ToText(message.AuthorRole.Value),
            authorSeatId = message.AuthorSeat is null ? null : Ids.ToText(message.AuthorSeat.Value),
            versions = await VersionListAsync(connection, id, ctx.RequestAborted)
        });
    }
}
