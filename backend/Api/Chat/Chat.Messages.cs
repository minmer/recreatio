using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Eine Rozmowa zeigen; Nachrichten lesen, senden, als gelesen markieren, löschen.</summary>
public static partial class Chat
{
    /* ======================================================================
       EIN CHAT
       ====================================================================== */

    private static async Task ShowAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;
        var (chat, mine, account) = seen.Value;

        string areaName;
        int currentEpoch;
        await using (var cmd = new SqlCommand("SELECT name, current_epoch FROM app.area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", chat.AreaId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            areaName = reader.GetString(0);
            currentEpoch = reader.GetInt32(1);
        }

        DateTimeOffset? readAt;
        await using (var cmd = new SqlCommand(
            "SELECT read_at FROM app.chat_read WHERE chat_id = @chat AND account_id = @account;", connection))
        {
            cmd.Parameters.AddWithValue("@chat", chat.Id);
            cmd.Parameters.AddWithValue("@account", account);
            readAt = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as DateTimeOffset?;
        }

        var members = await MembersOfAsync(connection, [chat.AreaId], ctx.RequestAborted);
        var names = await NamesOfAsync(connection, [chat.AreaId], ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(chat.Id),
            areaId = Ids.ToText(chat.AreaId),
            areaName,
            currentEpoch,
            kind = chat.Kind,
            postingPolicy = chat.PostingPolicy,
            createdAt = chat.CreatedAt,
            lastMessageAt = chat.LastMessageAt,
            readAt,

            /* Welche meiner Rollen hier schreiben duerfen — die Oberflaeche bietet nur sie an. */
            writers = (await HoldingAsync(connection, mine, chat.AreaId, SpeakersOf(chat), ctx.RequestAborted)).Select(Ids.ToText),
            certifiers = (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).Select(Ids.ToText),
            members = members.TryGetValue(chat.AreaId, out var m) ? m : [],
            names = names.TryGetValue(chat.AreaId, out var n) ? n : [],

            /* 0053 — die Menschen mit Link, und ob ihr Schluessel schon bei ihnen ist (0069: in der eines Platzes nur er). */
            seatId = chat.SeatId is null ? null : Ids.ToText(chat.SeatId.Value),
            seats = HasSeats(chat) ? await SeatsOfAsync(connection, chat, ctx.RequestAborted) : [],

            /* 0080 — die Formulare, deren Menschen hier dabei sind (Audience). */
            forms = chat.Kind is "area" or "channel" ? await Audience.FormsOfAsync(connection, "chat", chat.Id, ctx.RequestAborted) : []
        });
    }

    /// <summary>
    /// Ein lebendiger Platz, der nicht mehr auf seine erste Bestaetigung wartet
    /// — dieselbe Bedingung wie <c>Seat.LiveSeatAsync(gated: true)</c>, als SQL
    /// fuer eine Unterabfrage. Braucht <c>@now</c>.
    /// </summary>
    private static string LiveSeat(string a) => Audience.LiveSeat(a);

    /// <summary>
    /// DIE PLAETZE EINER ROZMOWA — die des Bereichs und seiner Formulare (0080),
    /// in der mit einem Platz nur er — mit dem oeffentlichen Schluessel, unter
    /// den ein Mitglied ihnen den Chatschluessel verpackt, und den Epochen, fuer
    /// die er schon da ist.
    ///
    /// <para>
    /// Der Name ist der, den die Kanzlei am Platz fuehrt — 0097: versiegelt unter
    /// dem Schluessel des Bereichs des Platzes (`nameSealed`).
    /// </para>
    /// </summary>
    private static async Task<List<object>> SeatsOfAsync(SqlConnection connection, ChatRow chat, CancellationToken ct)
    {
        var rows = new List<(Guid Id, byte[]? Wrap, string? Via, Guid Area, byte[]? Sealed, int? Epoch)>();

        await using (var cmd = new SqlCommand($"""
            SELECT s.id, i.wrap_public_key,
                   /* 0095 — eine Person aus einem Link: der Name des Links (in Klammern hinter ihrem). */
                   CASE WHEN s.invitation_id IS NULL THEN NULL
                        ELSE COALESCE(NULLIF(LTRIM(RTRIM((SELECT iv.label FROM app.invitation iv WHERE iv.id = s.invitation_id))), N''), N'Link') END,
                   s.area_id, s.name_sealed, s.name_epoch
            FROM app.chat c
            JOIN app.access s ON {SeatOfChat}
            LEFT JOIN app.seat_identity i ON i.access_id = s.id
            WHERE c.id = @chat AND {LiveSeat("s")}
            ORDER BY s.created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@chat", chat.Id);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((reader.GetGuid(0),
                    reader.IsDBNull(1) ? null : (byte[])reader[1], reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.GetGuid(3), reader.IsDBNull(4) ? null : (byte[])reader[4], Names.Int(reader, 5)));
            }
        }

        var epochs = new Dictionary<Guid, List<int>>();
        await using (var cmd = new SqlCommand(
            "SELECT access_id, epoch FROM app.chat_seat_key WHERE chat_id = @chat;", connection))
        {
            cmd.Parameters.AddWithValue("@chat", chat.Id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var seat = reader.GetGuid(0);
                if (!epochs.TryGetValue(seat, out var list)) epochs[seat] = list = [];
                list.Add(reader.GetInt32(1));
            }
        }

        return rows.Select(r => (object)new
        {
            seatId = Ids.ToText(r.Id),
            nameSealed = r.Sealed is null ? null : Base64Url.Encode(r.Sealed),
            nameEpoch = r.Epoch,
            areaId = Ids.ToText(r.Area),
            via = r.Via,

            /* `null`: er hat die Rozmowa noch nie geoeffnet — dann gibt es nichts, wofuer man verpacken koennte. */
            wrapPublicKey = r.Wrap is null ? null : Base64Url.Encode(r.Wrap),
            epochs = epochs.TryGetValue(r.Id, out var e) ? e : []
        }).ToList();
    }

    /// <summary>
    /// Die Nachrichten — die neuesten (\`before\` fuer weiter zurueck) oder,
    /// fuer das Nachladen, die nach \`after\`.
    /// </summary>
    private static async Task MessagesAsync(
        HttpContext ctx, Db db, Guid id, string? before, string? after, int? limit, string? changed, Guid? beforeId, Guid? afterId, Guid? topic)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;

        var now = DateTimeOffset.UtcNow;
        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(id),
            messages = await ReadMessagesAsync(connection, id, before, after, limit, ctx.RequestAborted, changed, beforeId, afterId, topic),
            asOf = now
        });
    }

    /// <summary>
    /// Die Nachrichten eines Chats, versiegelt — fuer ein Mitglied und fuer
    /// einen Platz dieselben. Verfasser ist eine Rolle ODER ein Platz (0053).
    /// </summary>
    private static async Task<List<object>> ReadMessagesAsync(
        SqlConnection connection, Guid id, string? before, string? after, int? limit, CancellationToken ct,
        string? changed = null, Guid? beforeId = null, Guid? afterId = null, Guid? topic = null)
    {
        var take = Math.Clamp(limit ?? 60, 1, 200);
        var hasBefore = DateTimeOffset.TryParse(before, out var b);
        var hasAfter = DateTimeOffset.TryParse(after, out var a);

        /*
         * 0059 — WAS SICH GEÄNDERT HAT, seit der Leser zuletzt gefragt hat:
         * bearbeitet, gelöscht, wiederhergestellt. Ohne das käme eine
         * bearbeitete Nachricht von gestern bei niemandem an, der die Rozmowa
         * offen hat — er holt sonst nur das Neue.
         */
        var hasChanged = DateTimeOffset.TryParse(changed, out var c);
        if (hasChanged) { hasBefore = false; hasAfter = false; }

        var messages = new List<object>();

        await using (var cmd = new SqlCommand($"""
            SELECT TOP {take} id, author_role_id, epoch, body_sealed, created_at, deleted_at, signature, signed_at,
                   author_access_id, version, edited_at, deleted_by_role_id, deleted_by_access_id, topic_id, author_person_id,
                   CASE WHEN {Takedowns.Exists("message", "chat_message.id")} THEN 1 ELSE 0 END
            FROM app.chat_message
            WHERE chat_id = @chat AND schedule_state = N'sent'
              {(topic is null ? "" : "AND topic_id = @topic")}
              {(hasBefore ? "AND (created_at < @before OR (created_at = @before AND id < @beforeId))" : "")}
              {(hasAfter ? "AND (created_at > @after OR (created_at = @after AND id > @afterId))" : "")}
              {(hasChanged ? "AND changed_at > @changed" : "")}
            ORDER BY created_at {(hasAfter || hasChanged ? "ASC" : "DESC")}, id {(hasAfter || hasChanged ? "ASC" : "DESC")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@chat", id);
            if (hasBefore) { cmd.Parameters.AddWithValue("@before", b); cmd.Parameters.AddWithValue("@beforeId", (object?)beforeId ?? DBNull.Value); }
            if (hasAfter) { cmd.Parameters.AddWithValue("@after", a); cmd.Parameters.AddWithValue("@afterId", (object?)afterId ?? DBNull.Value); }
            if (hasChanged) cmd.Parameters.AddWithValue("@changed", c);
            if (topic is not null) cmd.Parameters.AddWithValue("@topic", topic.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                Guid? authorRole = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                Guid? authorSeat = reader.IsDBNull(8) ? null : reader.GetGuid(8);
                Guid? byRole = reader.IsDBNull(11) ? null : reader.GetGuid(11);
                Guid? bySeat = reader.IsDBNull(12) ? null : reader.GetGuid(12);
                var deleted = !reader.IsDBNull(5);

                /* 0130 — nach einer Meldung gesperrt: der Inhalt geht an niemanden hinaus, die Stelle bleibt. */
                var blocked = reader.GetInt32(15) == 1;

                messages.Add(new
                {
                    messageId = Ids.ToText(reader.GetGuid(0)),
                    authorRoleId = authorRole is null ? null : Ids.ToText(authorRole.Value),
                    authorSeatId = authorSeat is null ? null : Ids.ToText(authorSeat.Value),
                    epoch = reader.GetInt32(2),
                    bodySealed = blocked || reader.IsDBNull(3) ? null : Base64Url.Encode((byte[])reader[3]),
                    blocked,
                    createdAt = reader.GetDateTimeOffset(4),
                    deletedAt = deleted ? reader.GetDateTimeOffset(5) : (DateTimeOffset?)null,
                    signature = Base64Url.Encode((byte[])reader[6]),
                    signedAt = reader.GetDateTimeOffset(7),

                    /* 0058 — die wievielte Fassung, und seit wann bearbeitet. */
                    version = reader.GetInt32(9),
                    editedAt = reader.IsDBNull(10) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(10),

                    /* Wer gelöscht hat: der Verfasser selbst oder wer moderiert — davon hängt ab, wer zurückholen darf. */
                    deletedBy = !deleted ? null
                        : (byRole is not null && byRole == authorRole) || (bySeat is not null && bySeat == authorSeat) ? "author"
                        : "moderator",

                    /* 0068 — zu welchem Thema. */
                    topicId = reader.IsDBNull(13) ? null : Ids.ToText(reader.GetGuid(13)),

                    /* 0095 — welche Person durch die Rolle sprach (fehlt bei älteren Nachrichten und bei Plätzen). */
                    authorPersonId = reader.IsDBNull(14) ? null : Ids.ToText(reader.GetGuid(14))
                });
            }
        }

        /* Immer in der Reihenfolge, in der sie geschrieben wurden — die aelteste zuerst. */
        if (!hasAfter && !hasChanged) messages.Reverse();

        return messages;
    }

    public sealed record PostRequest(string MessageId, string AuthorRoleId, int Epoch, string BodySealed,
        string Signature, long SignedAt, DateTimeOffset? SendAt = null, string? TopicId = null,

        /* 0095 — welche Person des Kontos durch die Rolle spricht (bei einer Person: sie selbst). */
        string? PersonId = null,

        /* 0111 — „gdy będzie online" (wartet auf jemanden, der zeigt, dass er da ist) und „bez dźwięku" (kein Push). */
        bool WhenOnline = false, bool Silent = false);

    /// <summary>Was an einer Nachricht zu pruefen ist, bevor jemand gefragt wird, wer sie schreibt.</summary>
    private sealed record Incoming(Guid MessageId, int Epoch, byte[] Body, byte[] BodyHash, byte[] Signature,
        DateTimeOffset SignedAt);

    /// <summary>Die Huelle, die Unterschrift und die Uhr — gleich, ob eine Rolle oder ein Platz schreibt.</summary>
    private static async Task<Incoming?> IncomingAsync(
        HttpContext ctx, string? messageIdText, int epoch, string? bodyText, string? signatureText, long signedAtUnix)
    {
        if (!Guid.TryParse(messageIdText, out var messageId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return null;
        }

        byte[] sealedBody, signature;
        try
        {
            sealedBody = Base64Url.Decode(bodyText ?? string.Empty);
            signature = Base64Url.Decode(signatureText ?? string.Empty);
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna wiadomość albo podpis.");
            return null;
        }

        if (sealedBody.Length is 0 or > MaxBody)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wiadomość jest pusta albo za długa.");
            return null;
        }

        DateTimeOffset signedAt;
        try { signedAt = DateTimeOffset.FromUnixTimeSeconds(signedAtUnix); }
        catch (ArgumentOutOfRangeException) { await Fail(ctx, 400, "Nieprawidłowy czas podpisu."); return null; }
        var now = DateTimeOffset.UtcNow;
        if (signedAt > now + ClockSlack || signedAt < now - ClockSlack)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Czas podpisu nie zgadza się z zegarem.");
            return null;
        }

        return new Incoming(messageId, epoch, sealedBody, SHA256.HashData(sealedBody), signature, signedAt);
    }

    /// <summary>Gibt es die Epoche, unter der geschrieben wurde? Sonst 400.</summary>
    private static async Task<bool> EpochExistsAsync(
        HttpContext ctx, SqlConnection connection, ChatRow chat, int epoch)
    {
        await using var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", chat.AreaId);
        var current = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))!;

        if (epoch >= 1 && epoch <= current) return true;

        await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
        return false;
    }

    /// <summary>
    /// Was unterschrieben wird — fuer eine Rolle und fuer einen Platz derselbe
    /// Datensatz; im Feld des Verfassers steht die Kennung dessen, der schreibt.
    /// </summary>
    private static MessageVersionRecord RecordOf(Incoming message, Guid author) => new()
    {
        Id = message.MessageId,
        MessageId = message.MessageId,
        Version = 1,
        AuthorRoleId = author,
        BodyHash = message.BodyHash,
        CreatedUtc = message.SignedAt
    };

    /// <summary>Die Zeile — und der Chat bekommt seinen Zeitpunkt. 409, wenn es sie schon gibt.</summary>
    private static async Task<DateTimeOffset?> InsertAsync(
        HttpContext ctx, SqlConnection connection, ChatRow chat, Incoming message, Guid? authorRole, Guid? authorSeat, DateTimeOffset? sendAt = null,
        string? topicText = null, Guid? authorPerson = null, Guid? waitOnlineFrom = null, bool silent = false)
    {
        /*
         * 0129 — DIE ROZMOWA EINES BEREICHS (auch „Napisz do nas" und die eines Platzes) sammelt
         * Daten über Menschen: ohne jemanden, der für den Bereich geradesteht, nimmt sie nichts an.
         * Ein Gespräch zweier Menschen, eine eigene Gruppe, die eigenen Notizen brauchen niemanden.
         */
        if (chat.Kind is "area" or "channel" or "seat" && await Controllers.OfAreaAsync(connection, chat.AreaId, ctx.RequestAborted) is null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Controllers.Nobody);
            return null;
        }

        /* 0111 — wer auf „online" wartet, wartet höchstens ein Jahr (dann geht sie trotzdem hinaus). */
        if (waitOnlineFrom is not null) sendAt = DateTimeOffset.UtcNow.AddDays(364);
        /* 0068 — das Thema muss in DIESER Rozmowa liegen. */
        var topic = await TopicOfChatAsync(ctx, connection, chat, topicText);
        if (topic is { Ok: false }) return null;

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.chat_message
                    (id, chat_id, author_role_id, author_access_id, epoch, body_sealed, body_sha256,
                     signature, signed_at, created_at, scheduled_at, schedule_state, topic_id, author_person_id, wait_online_from, silent)
                VALUES (@id, @chat, @author, @seat, @epoch, @body, @hash, @sig, @signed, @now, @due, @state, @topic, @person, @wait, @silent);
                INSERT INTO app.chat_message_version
                    (message_id, version, epoch, body_sealed, body_sha256, signature, signed_at, created_at)
                VALUES (@id, 1, @epoch, @body, @hash, @sig, @signed, @now);
                UPDATE app.chat SET last_message_at = @now WHERE id = @chat AND @state = N'sent';
                UPDATE app.topic SET last_message_at = @now WHERE id = @topic AND @state = N'sent';
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@topic", (object?)topic?.Id ?? DBNull.Value);
                insert.Parameters.AddWithValue("@due", (object?)sendAt ?? DBNull.Value);
                insert.Parameters.AddWithValue("@state", sendAt is null ? "sent" : "pending");
                insert.Parameters.AddWithValue("@id", message.MessageId);
                insert.Parameters.AddWithValue("@chat", chat.Id);
                insert.Parameters.AddWithValue("@author", (object?)authorRole ?? DBNull.Value);
                insert.Parameters.AddWithValue("@seat", (object?)authorSeat ?? DBNull.Value);
                insert.Parameters.AddWithValue("@person", (object?)authorPerson ?? DBNull.Value);
                insert.Parameters.AddWithValue("@wait", (object?)waitOnlineFrom ?? DBNull.Value);
                insert.Parameters.AddWithValue("@silent", silent);
                insert.Parameters.AddWithValue("@epoch", message.Epoch);
                insert.Parameters.AddWithValue("@body", message.Body);
                insert.Parameters.AddWithValue("@hash", message.BodyHash);
                insert.Parameters.AddWithValue("@sig", message.Signature);
                insert.Parameters.AddWithValue("@signed", message.SignedAt);
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
            return now;
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta wiadomość już jest.");
            return null;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    /// <summary>
    /// EINE NACHRICHT — versiegelt im Browser, von der Rolle des Verfassers
    /// unterschrieben. Schreiben darf eine Rolle, die SELBST im Bereich
    /// schreibt — in der Rozmowa eines Bereichs jede, die ihn liest (0053); die
    /// Unterschrift wird hier gegen ihren oeffentlichen Schluessel geprueft.
    /// </summary>
    private static async Task PostAsync(HttpContext ctx, Db db, Push push, Guid id, PostRequest body)
    {
        if (!Guid.TryParse(body.AuthorRoleId, out var author))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var message = await IncomingAsync(ctx, body.MessageId, body.Epoch, body.BodySealed, body.Signature, body.SignedAt);
        if (message is null) return;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;
        var (chat, mine, account) = seen.Value;

        if (!mine.Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nie piszesz.");
            return;
        }

        if (!(await HoldingAsync(connection, [author], chat.AreaId, SpeakersOf(chat), ctx.RequestAborted)).Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola w tej rozmowie tylko czyta.");
            return;
        }

        /* 0095 — WER SPRICHT: eine Person des Kontos, die die Rolle hält. */
        var speaking = await SpeakingAsync(connection, account, author, body.PersonId, ctx.RequestAborted);
        if (speaking.Person is null)
        {
            await Fail(ctx, speaking.Status, speaking.Error ?? "Do rozmowy potrzebna jest osoba.");
            return;
        }

        if (!await EpochExistsAsync(ctx, connection, chat, message.Epoch)) return;

        byte[]? signKey;
        await using (var cmd = new SqlCommand("SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            cmd.Parameters.AddWithValue("@id", author);
            signKey = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
        }

        if (signKey is null || !VerifySignature(RecordOf(message, author), signKey, message.Signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis wiadomości się nie zgadza.");
            return;
        }

        if (!await ValidSendAtAsync(ctx, body.SendAt) || !await OneWayAsync(ctx, body.SendAt, body.WhenOnline)) return;
        var at = await InsertAsync(ctx, connection, chat, message, author, null, body.SendAt, body.TopicId, speaking.Person,
            body.WhenOnline ? account : null, body.Silent);
        if (at is null) return;
        var now = body.SendAt is null && !body.WhenOnline;

        /* Was ich selbst schreibe, habe ich gelesen — ausserhalb der Nachricht: ein Streit darum darf sie nicht kosten. */
        if (now) await MarkReadAsync(connection, null, chat.Id, account, at.Value, ctx.RequestAborted);

        /* 0075 — die anderen wecken (eine geplante Nachricht weckt, wenn sie hinausgeht: ChatDelivery) — 0111: „bez dźwięku" weckt niemanden. */
        if (now && !body.Silent) push.Chat(chat.Id, account);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(message.MessageId), createdAt = at.Value });
    }

    /// <summary>
    /// 0095 — WELCHE PERSON DES KONTOS DURCH <paramref name="author"/> SPRICHT
    /// (<see cref="ChatRules.PersonFor"/>): die Rolle selbst, wenn sie eine
    /// Person ist; sonst die genannte unter denen, die die Rolle halten — ohne
    /// Angabe die einzige.
    /// </summary>
    internal static async Task<ChatRules.Speaking> SpeakingAsync(
        SqlConnection connection, Guid account, Guid author, string? personText, CancellationToken ct)
    {
        Guid? asked = null;
        if (!string.IsNullOrWhiteSpace(personText))
        {
            if (!Guid.TryParse(personText, out var named)) return new ChatRules.Speaking(null, 400, "Nieczytelna kennung osoby.");
            asked = named;
        }

        var roles = await Workspace.RolesOfAsync(connection, account, ct);
        var isPerson = roles.Any(r => r.Id == author && r.Kind == "person");
        var candidates = new List<Guid>();

        if (!isPerson)
        {
            foreach (var person in roles.Where(r => r.Kind == "person"))
            {
                if ((await Workspace.ClosureAsync(connection, [person.Id], ct)).Any(r => r.Id == author)) candidates.Add(person.Id);
            }
        }

        return ChatRules.PersonFor(author, isPerson, candidates, asked);
    }

    private static bool VerifySignature(MessageVersionRecord record, byte[] spki, byte[] signature)
    {
        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(spki, out _);
            return record.Verify(rsa, signature);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    /// <summary>
    /// Die Unterschrift eines PLATZES (0053) — ECDSA P-256 ueber denselben
    /// Abdruck, im Format, das WebCrypto liefert (r‖s, IEEE P1363).
    /// </summary>
    private static bool VerifySeatSignature(MessageVersionRecord record, byte[] spki, byte[] signature)
    {
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(spki, out _);
            return ecdsa.KeySize == 256 && ecdsa.VerifyHash(record.Hash(), signature);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static async Task MarkReadAsync(
        SqlConnection connection, SqlTransaction? tx, Guid chatId, Guid account, DateTimeOffset at, CancellationToken ct)
    {
        /*
         * EIN MERGE UNTER SPERRE — und nur nach bestem Vermoegen. Zwei Fenster
         * desselben Kontos melden oft im selben Augenblick „gelesen"; wer dabei
         * verliert (1205, 2627), hat nichts verloren: der andere hat es schon
         * eingetragen, und das naechste Nachladen traegt es wieder ein.
         */
        await using var cmd = new SqlCommand("""
            MERGE app.chat_read WITH (HOLDLOCK) AS t
            USING (SELECT @chat AS chat_id, @account AS account_id) AS s
               ON t.chat_id = s.chat_id AND t.account_id = s.account_id
            WHEN MATCHED AND t.read_at < @at THEN UPDATE SET read_at = @at
            WHEN NOT MATCHED THEN INSERT (chat_id, account_id, read_at) VALUES (@chat, @account, @at);
            """, connection, tx);
        cmd.Parameters.AddWithValue("@chat", chatId);
        cmd.Parameters.AddWithValue("@account", account);
        cmd.Parameters.AddWithValue("@at", at);

        try
        {
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (SqlException e) when (tx is null && e.Number is 1205 or 2601 or 2627)
        {
            // Gleichzeitig gelesen — der andere hat es eingetragen.
        }
    }

    /// <summary>Gelesen bis jetzt — fuer „nowe wiadomości" auf allen Geraeten dieses Kontos.</summary>
    private static async Task ReadAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;

        await MarkReadAsync(connection, null, id, seen.Value.Account, DateTimeOffset.UtcNow, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(id), read = true });
    }

    /// <summary>
    /// EINE NACHRICHT ZURUECKNEHMEN — der Verfasser, oder wer im Bereich
    /// hineinlaesst. Die Zeile bleibt (dass hier etwas stand, ist eine
    /// Auskunft), die Huelle geht.
    /// </summary>
    private static async Task DeleteAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid chatId;
        Guid? author;
        Guid? person;
        await using (var cmd = new SqlCommand(
            "SELECT chat_id, author_role_id, author_person_id FROM app.chat_message WHERE id = @id AND deleted_at IS NULL AND schedule_state = N'sent';", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
                return;
            }
            chatId = reader.GetGuid(0);

            /* NULL: ein Platz hat sie geschrieben (0053) — dann nimmt sie nur er selbst zurueck, oder wer moderiert. */
            author = reader.IsDBNull(1) ? null : reader.GetGuid(1);

            /* 0095 — und die Person, die durch die Rolle sprach: eine andere Person derselben Gruppe ist nicht der Verfasser. */
            person = reader.IsDBNull(2) ? null : reader.GetGuid(2);
        }

        var seen = await ReadableAsync(ctx, db, connection, chatId);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        /* Zu zweit loescht niemand die Worte des anderen — auch nicht, wer den Bereich angelegt hat. */
        var mayModerate = chat.Kind != "direct"
            && (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).Count > 0;
        var own = author is Guid role && mine.Contains(role) && (person is not Guid speaker || mine.Contains(speaker));
        if (!own && !mayModerate)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Usunąć może tylko autor albo ten, kto prowadzi rozmowę.");
            return;
        }

        /*
         * 0058 — DIE HÜLLE GEHT AUS DER ZEILE, DIE FASSUNGEN BLEIBEN. So lässt
         * sich die Nachricht wiederherstellen. Wer gelöscht hat, steht dabei:
         * der Verfasser selbst, oder wer moderiert — dann holt sie auch nur
         * jemand zurück, der moderiert.
         */
        Guid? by = own
            ? author
            : (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).FirstOrDefault();

        await using var drop = new SqlCommand("""
            UPDATE app.chat_message
               SET body_sealed = NULL, deleted_at = @now, changed_at = @now,
                   deleted_by_role_id = @by, deleted_by_access_id = NULL
             WHERE id = @id;
            """, connection);
        drop.Parameters.AddWithValue("@id", id);
        drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        drop.Parameters.AddWithValue("@by", by is null || by == Guid.Empty ? DBNull.Value : by.Value);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), deleted = true });
    }
}
