using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Rozmowy hinter einem persönlichen Link (0053): Schlüssel an Plätze, Identität, Nachrichten des Platzes.</summary>
public static partial class Chat
{
    /* ======================================================================
       0053 — DER MENSCH MIT DEM LINK
       ====================================================================== */

    /// <summary>Eine verpackte Huelle fasst einen Schluessel von 32 Bytes — mehr nimmt niemand an.</summary>
    private const int MaxWrapped = 512;

    /// <summary>Die privaten Haelften eines Platzes, versiegelt — zwei P-256-Schluessel.</summary>
    private const int MaxIdentity = 2048;

    public sealed record SeatKeyIn(string SeatId, int Epoch, string KeyWrapped);

    public sealed record GrantSeatsRequest(string ByRoleId, IReadOnlyList<SeatKeyIn>? Keys);

    /// <summary>
    /// DEN CHATSCHLUESSEL WEITERGEBEN — an die Plaetze des Bereichs, die darauf
    /// warten. Verpackt hat ihn der Browser eines Mitglieds, unter dem
    /// oeffentlichen Schluessel des Platzes; hier wird er nur abgelegt.
    ///
    /// <para>
    /// <b>Wer weitergibt, entscheidet nicht, wer dazugehoert.</b> Das sagt der
    /// Bereich: annehmen kann nur ein lebendiger Platz DIESES Bereichs. Das
    /// Mitglied liefert bloss den Schluessel, den es ohnehin haelt — deshalb
    /// darf das jedes, nicht erst, wer hineinlaesst.
    /// </para>
    ///
    /// <para>
    /// <b>Die erste Huelle bleibt.</b> Eine zweite derselben Epoche ersetzt sie
    /// nicht — sonst koennte ein Mitglied eine gute durch eine leere ersetzen.
    /// </para>
    /// </summary>
    private static async Task GrantSeatsAsync(HttpContext ctx, Db db, Guid id, GrantSeatsRequest body)
    {
        if (!Guid.TryParse(body.ByRoleId, out var byRole))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var keys = body.Keys ?? [];
        if (keys.Count > 500)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za dużo naraz — najwyżej 500.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        if (!HasSeats(chat))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Osoby z linkiem są tylko w rozmowie i kanale obszaru oraz w rozmowie z nimi samymi.");
            return;
        }

        if (!mine.Contains(byRole)
            || !(await HoldingAsync(connection, [byRole], chat.AreaId, Readers, ctx.RequestAborted)).Contains(byRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie ma klucza tego obszaru.");
            return;
        }

        int current;
        await using (var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", chat.AreaId);
            current = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        var parsed = new List<(Guid Seat, int Epoch, byte[] Key)>();
        foreach (var one in keys)
        {
            byte[] wrapped;
            try { wrapped = Base64Url.Decode(one.KeyWrapped ?? string.Empty); }
            catch (FormatException) { wrapped = []; }

            if (!Guid.TryParse(one.SeatId, out var seatId) || one.Epoch < 1 || one.Epoch > current
                || wrapped.Length is 0 or > MaxWrapped)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz dla osoby z linkiem.");
                return;
            }

            parsed.Add((seatId, one.Epoch, wrapped));
        }

        var now = DateTimeOffset.UtcNow;
        var granted = 0;

        foreach (var (seatId, epoch, wrapped) in parsed)
        {
            await using var insert = new SqlCommand($"""
                INSERT INTO app.chat_seat_key (chat_id, access_id, epoch, key_wrapped, granted_by_role_id, granted_at)
                SELECT @chat, s.id, @epoch, @key, @by, @now
                FROM app.access s
                JOIN app.seat_identity i ON i.access_id = s.id
                JOIN app.chat c ON c.id = @chat
                WHERE s.id = @seat AND {SeatOfChat} AND {LiveSeat("s")}
                  AND NOT EXISTS (SELECT 1 FROM app.chat_seat_key k
                                   WHERE k.chat_id = @chat AND k.access_id = @seat AND k.epoch = @epoch);
                """, connection);

            insert.Parameters.AddWithValue("@chat", chat.Id);
            insert.Parameters.AddWithValue("@seat", seatId);
            insert.Parameters.AddWithValue("@epoch", epoch);
            insert.Parameters.AddWithValue("@key", wrapped);
            insert.Parameters.AddWithValue("@by", byRole);
            insert.Parameters.AddWithValue("@now", now);

            try
            {
                granted += await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Ein zweites Fenster war schneller — die erste Huelle bleibt, und sie ist da.
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(chat.Id), granted });
    }

    /// <summary>Der Platz hinter dem Token und der Chat — wenn der Platz dazugehoert (<see cref="SeatOfChat"/>). Sonst 404.</summary>
    private static async Task<((Guid Id, Guid AreaId) Seat, ChatRow Chat)?> SeatChatAsync(
        HttpContext ctx, SqlConnection connection, string token, Guid chatId)
    {
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        var chat = seat is null ? null : await ChatOfAsync(connection, chatId, ctx.RequestAborted);

        /*
         * 0069 — die Rozmowa seines Bereichs, oder seine eigene; keine eines anderen Platzes.
         * 0080 — und die Rozmowa und der Kanał, zu denen eines seiner Formulare gehoert; die
         * eigene auch an einem anderen Bereich als dem seines Platzes.
         */
        var belongs = false;
        if (seat is not null && chat is not null && HasSeats(chat))
        {
            await using var cmd = new SqlCommand($"""
                SELECT 1 FROM app.chat c JOIN app.access s ON s.id = @seat
                WHERE c.id = @chat AND {SeatOfChat};
                """, connection);
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);
            cmd.Parameters.AddWithValue("@chat", chat.Id);
            belongs = await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null;
        }

        if (seat is null || chat is null || !belongs)
        {
            // Wie ueberall unter `/seat/`: was es nicht gibt und was nicht zu diesem Link gehoert, sieht gleich aus.
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rozmowy nie ma.");
            return null;
        }

        return (seat.Value, chat);
    }

    /// <summary>
    /// DIE ROZMOWY DIESES LINKS — die seines Bereichs, die seiner Formulare
    /// (0080) und die mit ihm selbst, mit den Huellen des
    /// Chatschluessels, soweit ein Mitglied sie schon weitergegeben hat, und
    /// mit seiner eigenen Identitaet (oder <c>null</c>: noch keine).
    /// </summary>
    private static async Task SeatChatsAsync(HttpContext ctx, Db db, string token)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var identity = await IdentityOfAsync(connection, seat.Value.Id, ctx.RequestAborted);

        var chats = new List<(Guid Id, Guid Area, string Name, int Epoch, DateTimeOffset? Last, string Kind, int Unread, DateTimeOffset? ReadAt)>();

        /*
         * 0102 — GELESEN ÜBER DEN LINK ODER MIT DEM KONTO: was er in der App als
         * seine Person gelesen hat, steht hier nicht noch einmal als neu
         * (`ChatReaders`, dieselbe Rechnung wie der Schritt „Przeczytaj wiadomości").
         */
        await using (var cmd = new SqlCommand($"""
            SET NOCOUNT ON;
            DECLARE @keys TABLE (k uniqueidentifier PRIMARY KEY, seat uniqueidentifier NULL, role uniqueidentifier NULL);
            INSERT INTO @keys (k, seat, role) VALUES (@seat, @seat, NULL);
            {ChatReaders.Fill}

            SELECT c.id, c.area_id, a.name, a.current_epoch, c.last_message_at, c.kind,
                   (SELECT COUNT(*) FROM app.chat_message m
                     WHERE m.chat_id = c.id AND {ChatReaders.Unread("@seat", "@seat", ChatReaders.ReadPoint("@seat", "c.id"))}) AS unread,
                   {ChatReaders.ReadPoint("@seat", "c.id")} AS read_at
            FROM app.chat c
            JOIN app.area a ON a.id = c.area_id
            JOIN app.access s ON s.id = @seat
            WHERE {SeatOfChat}
            ORDER BY CASE c.kind WHEN N'seat' THEN 0 WHEN N'channel' THEN 1 ELSE 2 END, a.name;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                chats.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetInt32(3),
                    reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4), reader.GetString(5), reader.GetInt32(6),
                    reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7)));
            }
        }

        var keys = new Dictionary<Guid, List<object>>();
        await using (var cmd = new SqlCommand(
            "SELECT chat_id, epoch, key_wrapped FROM app.chat_seat_key WHERE access_id = @seat;", connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var chat = reader.GetGuid(0);
                if (!keys.TryGetValue(chat, out var list)) keys[chat] = list = [];
                list.Add(new { epoch = reader.GetInt32(1), keyWrapped = Base64Url.Encode((byte[])reader[2]) });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seat.Value.Id),
            identity,
            chats = chats.Select(c => new
            {
                chatId = Ids.ToText(c.Id),
                areaId = Ids.ToText(c.Area),
                areaName = c.Name,
                currentEpoch = c.Epoch,
                lastMessageAt = c.Last,

                /* 0069 — `seat`: die Rozmowa nur mit der Kanzlei; `area`: die mit allen im Bereich. 0080 — `channel`: er liest. */
                kind = c.Kind,
                unread = c.Unread,

                /* 0102 — bis wann er gelesen hat: davor steht im Verlauf „Nieprzeczytane". */
                readAt = c.ReadAt,
                keys = keys.TryGetValue(c.Id, out var k) ? k : []
            })
        });
    }

    private static async Task<object?> IdentityOfAsync(SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT wrap_public_key, sign_public_key, private_sealed FROM app.seat_identity WHERE access_id = @seat;",
            connection);
        cmd.Parameters.AddWithValue("@seat", seatId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new
        {
            wrapPublicKey = Base64Url.Encode((byte[])reader[0]),
            signPublicKey = Base64Url.Encode((byte[])reader[1]),
            privateSealed = Base64Url.Encode((byte[])reader[2])
        };
    }

    public sealed record IdentityRequest(string WrapPublicKey, string SignPublicKey, string PrivateSealed);

    /// <summary>Ist das ein oeffentlicher P-256-Schluessel — zum Empfangen oder zum Pruefen?</summary>
    private static bool IsP256(byte[] spki, bool forSigning)
    {
        try
        {
            if (forSigning)
            {
                using var ecdsa = ECDsa.Create();
                ecdsa.ImportSubjectPublicKeyInfo(spki, out var read);
                return read == spki.Length && ecdsa.KeySize == 256;
            }

            using var ecdh = ECDiffieHellman.Create();
            ecdh.ImportSubjectPublicKeyInfo(spki, out var used);
            return used == spki.Length && ecdh.KeySize == 256;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    /// <summary>
    /// DIE IDENTITAET EINES PLATZES — beim ersten Oeffnen einer Rozmowa im
    /// Browser erzeugt. Die erste bleibt: wer sie ersetzen koennte, koennte
    /// sich die Schluessel eines anderen verpacken lassen. Zurueck kommt die,
    /// die gilt — auch wenn es nicht die eben geschickte ist.
    /// </summary>
    private static async Task SeatIdentityAsync(HttpContext ctx, Db db, string token, IdentityRequest body)
    {
        byte[] wrap, sign, sealedPrivate;
        try
        {
            wrap = Base64Url.Decode(body.WrapPublicKey ?? string.Empty);
            sign = Base64Url.Decode(body.SignPublicKey ?? string.Empty);
            sealedPrivate = Base64Url.Decode(body.PrivateSealed ?? string.Empty);
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        if (wrap.Length > 256 || sign.Length > 256 || !IsP256(wrap, false) || !IsP256(sign, true)
            || sealedPrivate.Length is 0 or > MaxIdentity)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using (var insert = new SqlCommand("""
            INSERT INTO app.seat_identity (access_id, wrap_public_key, sign_public_key, private_sealed, created_at)
            SELECT @seat, @wrap, @sign, @private, @now
            WHERE NOT EXISTS (SELECT 1 FROM app.seat_identity WHERE access_id = @seat);
            """, connection))
        {
            insert.Parameters.AddWithValue("@seat", seat.Value.Id);
            insert.Parameters.AddWithValue("@wrap", wrap);
            insert.Parameters.AddWithValue("@sign", sign);
            insert.Parameters.AddWithValue("@private", sealedPrivate);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try
            {
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Ein zweites Fenster desselben Links war schneller — dessen gilt.
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seat.Value.Id),
            identity = await IdentityOfAsync(connection, seat.Value.Id, ctx.RequestAborted)
        });
    }

    private static async Task SeatMessagesAsync(
        HttpContext ctx, Db db, string token, Guid id, string? before, string? after, int? limit, string? changed, Guid? beforeId, Guid? afterId, Guid? topic)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await SeatChatAsync(ctx, connection, token, id);
        if (found is null) return;

        var now = DateTimeOffset.UtcNow;
        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(id),
            messages = await ReadMessagesAsync(connection, id, before, after, limit, ctx.RequestAborted, changed, beforeId, afterId, topic),
            asOf = now
        });
    }

    public sealed record SeatPostRequest(string MessageId, int Epoch, string BodySealed, string Signature, long SignedAt, DateTimeOffset? SendAt = null,
        string? TopicId = null, bool WhenOnline = false, bool Silent = false);

    /// <summary>
    /// EINE NACHRICHT VOM LINK — versiegelt unter dem Chatschluessel,
    /// unterschrieben mit dem Schluessel des Platzes. Verfasser ist der Platz;
    /// welcher, sagt das Token und nicht der Absender.
    /// </summary>
    private static async Task SeatPostAsync(HttpContext ctx, Db db, Push push, string token, Guid id, SeatPostRequest body)
    {
        var message = await IncomingAsync(ctx, body.MessageId, body.Epoch, body.BodySealed, body.Signature, body.SignedAt);
        if (message is null) return;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await SeatChatAsync(ctx, connection, token, id);
        if (found is null) return;
        var (seat, chat) = found.Value;

        if (!await EpochExistsAsync(ctx, connection, chat, message.Epoch)) return;

        byte[]? signKey;
        await using (var cmd = new SqlCommand(
            "SELECT sign_public_key FROM app.seat_identity WHERE access_id = @seat;", connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Id);
            signKey = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
        }

        if (signKey is null || !VerifySeatSignature(RecordOf(message, seat.Id), signKey, message.Signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis wiadomości się nie zgadza.");
            return;
        }

        if (!await SeatMayPostAsync(ctx, chat) || !await ValidSendAtAsync(ctx, body.SendAt) || !await OneWayAsync(ctx, body.SendAt, body.WhenOnline)) return;
        var at = await InsertAsync(ctx, connection, chat, message, null, seat.Id, body.SendAt, body.TopicId, null,
            body.WhenOnline ? seat.Id : null, body.Silent);
        if (at is null) return;
        if (body.SendAt is null && !body.WhenOnline && !body.Silent) push.Chat(chat.Id, null);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(message.MessageId), createdAt = at.Value });
    }

    /// <summary>Die eigene Nachricht zuruecknehmen — nur die eigene.</summary>
    private static async Task SeatDeleteAsync(HttpContext ctx, Db db, string token, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid chatId;
        Guid? author;
        await using (var cmd = new SqlCommand(
            "SELECT chat_id, author_access_id FROM app.chat_message WHERE id = @id AND deleted_at IS NULL AND schedule_state = N'sent';", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
                return;
            }
            chatId = reader.GetGuid(0);
            author = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var found = await SeatChatAsync(ctx, connection, token, chatId);
        if (found is null) return;

        if (author != found.Value.Seat.Id)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Usunąć możesz tylko swoją wiadomość.");
            return;
        }

        await using var drop = new SqlCommand("""
            UPDATE app.chat_message
               SET body_sealed = NULL, deleted_at = @now, changed_at = @now,
                   deleted_by_access_id = @seat, deleted_by_role_id = NULL
             WHERE id = @id;
            """, connection);
        drop.Parameters.AddWithValue("@id", id);
        drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        drop.Parameters.AddWithValue("@seat", found.Value.Seat.Id);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), deleted = true });
    }
}
