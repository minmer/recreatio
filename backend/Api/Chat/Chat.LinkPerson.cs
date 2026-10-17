using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE PERSON EINES LINKS (0095) — wer mit einem Link mit Zugang ohne Konto da
/// ist, stellt sich vor und spricht dann als er selbst.
///
/// <para>
/// <b>Warum nicht als der Link.</b> Ein Link gehört allen, die ihn haben; schriebe
/// der Browser als Linkrolle, stünde an jeder Nachricht derselbe Name, und jeder
/// mit dem Link könnte die Worte des anderen ändern. Deshalb wird aus dem Link
/// eine PERSON: Vor- und Nachname, ein eigener Platz (<c>app.access</c>,
/// <c>origin = 'link'</c>) mit eigenem Geheimnis in diesem Browser — und der
/// Platz hält die Linkrolle (<c>access_role</c>, 0091). Damit gehört er zu den
/// Menschen der Bereiche, die der Link öffnet, und schreibt in ihren Rozmowy
/// wie jeder Mensch mit Link: mit eigener Unterschrift (P-256, 0053).
/// </para>
///
/// <para>
/// <b>Der Dienst sieht nichts davon offen</b> außer dem Namen, den auch die
/// Kanzlei an jedem Platz offen führt. Den Platzschlüssel bekommt er versiegelt —
/// unter dem Linkgeheimnis des Platzes (für den Browser), unter dem Schlüssel
/// des Bereichs (für die Kanzlei) — und den Schlüssel der Linkrolle unter dem
/// Platzschlüssel.
/// </para>
/// </summary>
public static partial class Chat
{
    /// <summary>So viele Personen trägt ein Link höchstens — mehr ist kein Link mehr, sondern ein Leck.</summary>
    private const int MaxLinkPersons = 2000;

    private static void MapLinkPersons(WebApplication app)
    {
        app.MapPost("/links/chats", LinkChatsAsync);
        app.MapPost("/links/person", LinkPersonAsync);

        /* Lesen braucht keine Person: wer den Bereich über den Link liest, liest seine Rozmowa. */
        app.MapPost("/links/chat/{id:guid}", LinkChatAsync);
        app.MapPost("/links/chat/{id:guid}/messages", LinkMessagesAsync);
        app.MapPost("/seat/{token}/name", SeatNameAsync);
    }

    public sealed record LinkChatsRequest(string[]? Proofs);

    /*
     * 0097 — der Name kommt versiegelt: unter dem Schlüssel des Bereichs
     * (NameSealed / NameEpoch, für die anderen in der Rozmowa) und unter dem
     * Platzschlüssel (OwnNameSealed, für ihn selbst). Vor- und Nachname im
     * Klartext (ein alter Browser) nimmt der Dienst nicht mehr an.
     */
    public sealed record LinkPersonRequest(
        string? Proof, string? AreaId, int Epoch, string? SeatId, string? TokenSha256, string? SeatKeySealed,
        string? SeatKeyForArea, string? LinkSealed, string? RoleKeySealed,
        string? UnderPath = null, string? NameSealed = null, int? NameEpoch = null, string? OwnNameSealed = null);

    public sealed record SeatNameRequest(string? OwnNameSealed, string? NameSealed = null, int? NameEpoch = null);

    public sealed record LinkReadRequest(
        string[]? Proofs, string? Before = null, string? After = null, string? Changed = null,
        string? BeforeId = null, string? AfterId = null, int? Limit = null);

    /*
     * WAS EIN LINK LESEN DARF: die Rozmowy der Bereiche, die er liest — die
     * Rozmowa des Bereichs, sein Kanał, die einer Gruppe. Nicht die mit EINEM
     * Menschen (`seat`), nicht die zu zweit, nicht Notatki: die gehören jemandem.
     */
    private static readonly string[] LinkReadable = ["area", "channel", "group"];

    /// <summary>Die Beweise aus dem Körper einer Anfrage — Base64URL, je 32 Bytes.</summary>
    private static List<byte[]> ProofsOf(string[]? texts) => (texts ?? [])
        .Select(p => Base64Url.TryDecode(p, out var bytes) && bytes.Length == 32 ? bytes : null)
        .Where(p => p is not null).Select(p => p!).Take(HeldLinks.Max).ToList();

    /// <summary>
    /// Die Rozmowa — wenn ein Link dieses Browsers ihren Bereich liest; sonst
    /// null (und 404: „gibt es nicht" und „darfst du nicht" sehen gleich aus).
    /// </summary>
    private static async Task<(ChatRow Chat, HeldLinks.Held Link)?> LinkReadableAsync(
        HttpContext ctx, SqlConnection connection, Guid id, string[]? proofs)
    {
        var held = await HeldLinks.ValidAsync(connection, ProofsOf(proofs), ctx.RequestAborted);
        var chat = held.Count == 0 ? null : await ChatOfAsync(connection, id, ctx.RequestAborted);

        if (chat is not null && LinkReadable.Contains(chat.Kind))
        {
            foreach (var link in held)
            {
                if ((await LinkAreasAsync(connection, link.RoleId, ctx.RequestAborted)).Contains(chat.AreaId)) return (chat, link);
            }
        }

        await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rozmowy nie ma.");
        return null;
    }

    /// <summary>
    /// EINE ROZMOWA ZUM LESEN, ohne Konto und ohne Person — für den Link, der
    /// ihren Bereich liest: der Bereich, die versiegelten Namen (der Browser
    /// öffnet sie mit dem Schlüssel aus dem Link), die Menschen mit Link — und
    /// ob man hier, vorgestellt, auch schreiben könnte.
    /// </summary>
    private static async Task LinkChatAsync(HttpContext ctx, Db db, Guid id, LinkReadRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var found = await LinkReadableAsync(ctx, connection, id, body.Proofs);
        if (found is null) return;
        var (chat, link) = found.Value;

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

        var names = await NamesOfAsync(connection, [chat.AreaId], ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(chat.Id),
            kind = chat.Kind,
            areaId = Ids.ToText(chat.AreaId),
            areaName,
            currentEpoch,
            names = names.TryGetValue(chat.AreaId, out var n) ? n : [],
            seats = HasSeats(chat) ? await SeatsOfAsync(connection, chat, ctx.RequestAborted) : [],
            invitationId = Ids.ToText(link.InvitationId),
            linkRoleId = Ids.ToText(link.RoleId),
            label = await Seat.LinkLabelAsync(connection, link.InvitationId, ctx.RequestAborted),

            /* Vorgestellt (eine Person des Links) schreibt man hier mit — im Kanał und in einer Gruppe nicht. */
            joinable = chat.Kind == "area" && ChatRules.SeatCanWrite(chat.Kind, chat.PostingPolicy)
        });
    }

    /// <summary>Die Nachrichten zum Lesen — dieselben, versiegelten, wie für ein Mitglied.</summary>
    private static async Task LinkMessagesAsync(HttpContext ctx, Db db, Guid id, LinkReadRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await LinkReadableAsync(ctx, connection, id, body.Proofs) is null) return;

        Guid? beforeId = Guid.TryParse(body.BeforeId, out var b) ? b : null;
        Guid? afterId = Guid.TryParse(body.AfterId, out var a) ? a : null;
        var now = DateTimeOffset.UtcNow;
        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(id),
            messages = await ReadMessagesAsync(connection, id, body.Before, body.After, body.Limit, ctx.RequestAborted, body.Changed, beforeId, afterId),
            asOf = now
        });
    }

    /// <summary>Die Bereiche, die eine Linkrolle (und was sie hält) mindestens liest.</summary>
    private static async Task<HashSet<Guid>> LinkAreasAsync(SqlConnection connection, Guid linkRole, CancellationToken ct)
    {
        var reach = (await Workspace.ClosureAsync(connection, [linkRole], ct)).Select(r => r.Id).ToList();
        var areas = new HashSet<Guid>();
        if (reach.Count == 0) return areas;

        var names = string.Join(", ", reach.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT c.scope_id FROM app.certificate c
            WHERE c.scope_kind = N'area' AND c.revoked_at IS NULL AND c.expires_at > @now
              AND c.capability IN (N'read', N'write', N'admin') AND c.subject_role_id IN ({names});
            """, connection);
        for (var i = 0; i < reach.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", reach[i]);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        return areas;
    }

    /// <summary>
    /// DIE ROZMOWY, DIE DIE LINKS DIESES BROWSERS ÖFFNEN — die eines Bereichs und
    /// sein Kanał (nur dort sind Menschen mit Link dabei). Je Rozmowa der Link,
    /// über den sie offen ist; ohne Konto, mit den Beweisen der Links.
    /// </summary>
    private static async Task LinkChatsAsync(HttpContext ctx, Db db, LinkChatsRequest body)
    {
        var proofs = (body.Proofs ?? [])
            .Select(p => Base64Url.TryDecode(p, out var bytes) && bytes.Length == 32 ? bytes : null)
            .Where(p => p is not null).Select(p => p!).Take(HeldLinks.Max).ToList();

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var held = await HeldLinks.ValidAsync(connection, proofs, ctx.RequestAborted);

        var via = new Dictionary<Guid, HeldLinks.Held>();
        foreach (var link in held)
        {
            foreach (var area in await LinkAreasAsync(connection, link.RoleId, ctx.RequestAborted)) via.TryAdd(area, link);
        }

        var labels = new Dictionary<Guid, string>();
        foreach (var link in held) labels[link.InvitationId] = await Seat.LinkLabelAsync(connection, link.InvitationId, ctx.RequestAborted);

        var chats = new List<object>();
        if (via.Count > 0)
        {
            var areas = via.Keys.ToList();
            var names = string.Join(", ", areas.Select((_, i) => $"@a{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT c.id, c.kind, c.area_id, a.name, a.current_epoch, c.posting_policy
                FROM app.chat c JOIN app.area a ON a.id = c.area_id
                WHERE c.kind IN (N'area', N'channel', N'group') AND c.area_id IN ({names})
                ORDER BY a.name, c.kind;
                """, connection);
            for (var i = 0; i < areas.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areas[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var link = via[reader.GetGuid(2)];
                chats.Add(new
                {
                    chatId = Ids.ToText(reader.GetGuid(0)),
                    kind = reader.GetString(1),
                    areaId = Ids.ToText(reader.GetGuid(2)),
                    areaName = reader.GetString(3),
                    currentEpoch = reader.GetInt32(4),
                    invitationId = Ids.ToText(link.InvitationId),
                    linkRoleId = Ids.ToText(link.RoleId),

                    /* Wie der Link heisst — in der Rozmowa steht er in Klammern hinter der Person. */
                    label = labels[link.InvitationId],

                    /* Vorgestellt schreibt man hier mit; sonst liest man (Kanał, Gruppe). */
                    joinable = reader.GetString(1) == "area" && ChatRules.SeatCanWrite(reader.GetString(1), reader.GetString(5))
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { chats });
    }

    /// <summary>
    /// SICH VORSTELLEN — aus dem Link wird eine Person: ein Platz mit Vor- und
    /// Nachnamen, der die Linkrolle hält. Der Bereich ist einer, den der Link
    /// liest; unter seinem Schlüssel liegt der Platzschlüssel für die Kanzlei.
    /// </summary>
    private static async Task LinkPersonAsync(HttpContext ctx, Db db, LinkPersonRequest body)
    {
        var (named, namedEpoch, namedError) = Names.Read(body.NameSealed, body.NameEpoch);
        var ownName = Names.Blob(body.OwnNameSealed);
        if (namedError is not null || named is null || ownName is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podaj imię i nazwisko.");
            return;
        }

        if (!Base64Url.TryDecode(body.Proof ?? string.Empty, out var proof) || proof.Length != 32
            || !Guid.TryParse(body.AreaId, out var areaId) || !Guid.TryParse(body.SeatId, out var seatId) || body.Epoch < 1
            || !Base64Url.TryDecode(body.TokenSha256 ?? string.Empty, out var tokenHash) || tokenHash.Length != 32
            || !Base64Url.TryDecode(body.SeatKeySealed ?? string.Empty, out var forLink) || forLink.Length is 0 or > 4096
            || !Base64Url.TryDecode(body.SeatKeyForArea ?? string.Empty, out var forArea) || forArea.Length is 0 or > 4096)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne dane osoby.");
            return;
        }

        byte[]? linkSealed = null, roleKey = null;
        if (!string.IsNullOrWhiteSpace(body.LinkSealed) && (!Base64Url.TryDecode(body.LinkSealed, out linkSealed) || linkSealed.Length > 4096)
            || !string.IsNullOrWhiteSpace(body.RoleKeySealed) && (!Base64Url.TryDecode(body.RoleKeySealed, out roleKey) || roleKey.Length > 4096))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne dane osoby.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var link = (await HeldLinks.ValidAsync(connection, [proof], ctx.RequestAborted)).FirstOrDefault();
        if (link is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ten link już nie działa.");
            return;
        }

        if (!(await LinkAreasAsync(connection, link.RoleId, ctx.RequestAborted)).Contains(areaId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ten link nie otwiera tego obszaru.");
            return;
        }

        await using (var cmd = new SqlCommand("""
            SELECT (SELECT current_epoch FROM app.area WHERE id = @area),
                   (SELECT COUNT(*) FROM app.access WHERE invitation_id = @link);
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", areaId);
            cmd.Parameters.AddWithValue("@link", link.InvitationId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            if (reader.IsDBNull(0) || body.Epoch > reader.GetInt32(0))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Klucz obszaru się zmienił — odśwież stronę i spróbuj jeszcze raz.");
                return;
            }

            if (reader.GetInt32(1) >= MaxLinkPersons)
            {
                await Fail(ctx, StatusCodes.Status429TooManyRequests, "Przez ten link przedstawiło się już zbyt wiele osób.");
                return;
            }
        }

        if (await Names.EpochProblemAsync(connection, null, areaId, namedEpoch, person: true, ctx.RequestAborted) is { } problem)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, problem);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.access
                    (id, area_id, token_sha256, seat_key_sealed, epoch, name_sealed, name_epoch, own_name_sealed,
                     origin, created_by_role_id, created_at, seat_key_for_area, link_sealed, invitation_id)
                VALUES (@id, @area, @token, @forLink, @epoch, @named, @namedEpoch, @ownName,
                        N'link', @role, @now, @forArea, @linkSealed, @link);

                INSERT INTO app.access_role (access_id, role_id, module_id, key_sealed, granted_at, sealed_at, sealed_by_role_id)
                VALUES (@id, @role, NULL, @roleKey, @now,
                        CASE WHEN @roleKey IS NULL THEN NULL ELSE @now END,
                        CASE WHEN @roleKey IS NULL THEN NULL ELSE @role END);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", seatId);
                insert.Parameters.AddWithValue("@area", areaId);
                insert.Parameters.Add("@token", System.Data.SqlDbType.VarBinary, 32).Value = tokenHash;
                insert.Parameters.AddBlob("@forLink", forLink);
                insert.Parameters.AddWithValue("@epoch", body.Epoch);
                insert.Parameters.AddBlob("@named", named);
                insert.Parameters.AddWithValue("@namedEpoch", namedEpoch);
                insert.Parameters.AddBlob("@ownName", ownName);
                insert.Parameters.AddWithValue("@role", link.RoleId);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddBlob("@forArea", forArea);
                insert.Parameters.AddBlob("@linkSealed", linkSealed);
                insert.Parameters.AddWithValue("@link", link.InvitationId);
                insert.Parameters.AddBlob("@roleKey", roleKey);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            /* Wohin der Platz gehört — die Seite, auf der er sich vorgestellt hat (das Portal findet dorthin zurück). */
            if (!string.IsNullOrWhiteSpace(body.UnderPath))
            {
                await using var bind = new SqlCommand("""
                    INSERT INTO app.access_slug (access_id, slug_id)
                    SELECT @id, s.id FROM app.slug s WHERE s.path = @path;
                    """, connection, tx);
                bind.Parameters.AddWithValue("@id", seatId);
                bind.Parameters.AddWithValue("@path", body.UnderPath.Trim().Trim('/'));
                await bind.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Taka osoba już jest.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seatId),
            areaId = Ids.ToText(areaId),
            via = await Seat.LinkLabelAsync(connection, link.InvitationId, ctx.RequestAborted)
        });
    }

    /// <summary>
    /// DER NAME AM EIGENEN PLATZ — Vor- und Nachname, wenn er noch keinen trägt.
    /// In einer Rozmowa spricht eine Person (0095); ein Platz ohne Namen (von der
    /// Kanzlei ohne Namen ausgestellt, ein altes Formular) nennt ihn hier einmal.
    /// Einen vorhandenen ändert er nicht — das tut die Kanzlei.
    ///
    /// <para>
    /// 0097 — versiegelt: unter seinem Platzschlüssel immer, unter dem Schlüssel
    /// des Bereichs, wenn dieser Browser ihn hat (sonst tut es die Kanzlei).
    /// </para>
    /// </summary>
    private static async Task SeatNameAsync(HttpContext ctx, Db db, string token, SeatNameRequest body)
    {
        var ownName = Names.Blob(body.OwnNameSealed);
        var (named, namedEpoch, namedError) = Names.Read(body.NameSealed, body.NameEpoch);
        if (ownName is null || namedError is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podaj imię i nazwisko.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        if (named is not null
            && (await Seat.AreaOfAsync(connection, seat.Value.Id, ctx.RequestAborted) is not Guid area
                || await Names.EpochProblemAsync(connection, null, area, namedEpoch, person: true, ctx.RequestAborted) is not null))
        {
            named = null;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.access
               SET own_name_sealed = @own,
                   name_sealed = COALESCE(@named, name_sealed),
                   name_epoch = CASE WHEN @named IS NULL THEN name_epoch ELSE @epoch END
             WHERE id = @id AND own_name_sealed IS NULL AND name_sealed IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", seat.Value.Id);
        cmd.Parameters.AddBlob("@own", ownName);
        cmd.Parameters.AddBlob("@named", named);
        cmd.Parameters.AddWithValue("@epoch", named is null ? DBNull.Value : namedEpoch);

        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) > 0;
        await ctx.Response.WriteAsJsonAsync(new { seatId = Ids.ToText(seat.Value.Id), changed });
    }
}
