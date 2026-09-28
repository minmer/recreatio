using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// ROZMOWY (0052) — Chats auf dem Kern der Bereiche.
///
/// <para>
/// <b>Jeder Chat liegt an einem Bereich</b>, und der Zugang zum Chat IST der
/// Zugang zum Bereich: wer ihn lesen darf, liest mit; wer darin schreiben
/// darf, schreibt; wer darin hineinlaesst, nimmt Menschen in den Chat. Es
/// gibt deshalb keine eigene Mitgliederliste und keine eigene Schluessel —
/// nur zwei Oberflaechen fuer dieselbe Sache: die Einstellungen des Bereichs
/// und die des Chats.
/// </para>
///
/// <code>
///   area     ein bestehender Bereich bekommt seinen Chat
///   group    der Browser legt fuer die Gruppe einen eigenen Bereich an
///   direct   zu zweit — zwei Personen oder Rollen, ebenfalls mit Bereich
/// </code>
///
/// <para>
/// <b>Der Dienst liest keine Nachricht.</b> Sie liegt unter dem
/// Epochenschluessel des Bereichs; jede ist von der Rolle ihres Verfassers
/// unterschrieben (<see cref="MessageVersionRecord"/>, Version 1), und die
/// Unterschrift wird hier geprueft — der Dienst kann niemandem ein Wort in
/// den Mund legen.
/// </para>
/// </summary>
public static class Chat
{
    /// <summary>Eine Nachricht, versiegelt — mehr schreibt niemand in eine Zeile.</summary>
    private const int MaxBody = 24_000;

    private const int MaxName = 1_024;

    /// <summary>Wie weit die Uhr des Browsers danebenliegen darf — der Zeitpunkt geht in die Unterschrift ein.</summary>
    private static readonly TimeSpan ClockSlack = TimeSpan.FromMinutes(15);

    private static readonly string[] Readers = ["read", "write", "admin"];
    private static readonly string[] Writers = ["write", "admin"];

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/chats", ListAsync);
        app.MapPost("/workspace/chats", CreateAsync);
        app.MapGet("/workspace/chat/{id:guid}", ShowAsync);
        app.MapGet("/workspace/chat/{id:guid}/messages", MessagesAsync);
        app.MapPost("/workspace/chat/{id:guid}/messages", PostAsync);
        app.MapPost("/workspace/chat/{id:guid}/read", ReadAsync);
        app.MapPost("/workspace/chat/message/{id:guid}/delete", DeleteAsync);

        /* Wie jemand in einem Bereich heisst — fuer die anderen Mitglieder, versiegelt. */
        app.MapPost("/workspace/area/{id:guid}/names", NameAsync);
        app.MapGet("/workspace/area/{id:guid}/names", AreaNamesAsync);

        /*
         * DIE VISITENKARTE EINER ROLLE — Art und oeffentlicher Schluessel, zu
         * einer Kennung, die jemand weitergegeben hat („Twój kod do rozmów").
         * Damit laesst sich ein Mensch aus einem anderen Konto in einen
         * Bereich nehmen: der Browser verpackt ihm den Schluessel.
         */
        app.MapGet("/workspace/role/{id:guid}/card", CardAsync);
    }

    /* ======================================================================
       WER DARF
       ====================================================================== */

    /// <summary>Die Rollen dieses Kontos — und welche davon den Bereich mit einer dieser Stufen tragen.</summary>
    private static async Task<List<Guid>> HoldingAsync(
        SqlConnection connection, IReadOnlyList<Guid> roles, Guid areaId, string[] capabilities, CancellationToken ct)
    {
        var found = new List<Guid>();
        if (roles.Count == 0) return found;

        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));
        var caps = string.Join(", ", capabilities.Select((_, i) => $"@c{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT subject_role_id FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area
              AND revoked_at IS NULL AND expires_at > @now
              AND capability IN ({caps})
              AND subject_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i]);
        for (var i = 0; i < capabilities.Length; i++) cmd.Parameters.AddWithValue($"@c{i}", capabilities[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) found.Add(reader.GetGuid(0));
        return found;
    }

    private sealed record ChatRow(Guid Id, Guid AreaId, string Kind, string? PairKey, DateTimeOffset CreatedAt,
        DateTimeOffset? LastMessageAt);

    private static async Task<ChatRow?> ChatOfAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, kind, pair_key, created_at, last_message_at FROM app.chat WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new ChatRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetDateTimeOffset(4),
            reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5));
    }

    /// <summary>Der Chat — wenn dieses Konto ihn lesen darf; sonst null (und 404 geschrieben).</summary>
    private static async Task<(ChatRow Chat, List<Guid> Mine, Guid Account)?> ReadableAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        var chat = await ChatOfAsync(connection, id, ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();

        if (chat is null || (await HoldingAsync(connection, mine, chat.AreaId, Readers, ctx.RequestAborted)).Count == 0)
        {
            // „Darfst du nicht" und „gibt es nicht" bekommen dieselbe Antwort.
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rozmowy nie ma.");
            return null;
        }

        return (chat, mine, who.Value.AccountId);
    }

    /* ======================================================================
       DIE LISTE
       ====================================================================== */

    /// <summary>
    /// Meine Rozmowy — jede, deren Bereich eine meiner Rollen lesen darf, die
    /// neueste zuerst; mit ihren Mitgliedern (Kennung, Art), den versiegelten
    /// Namen und dem, was ich noch nicht gelesen habe.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { chats = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        var rows = new List<(Guid Id, Guid Area, string AreaName, string Kind, DateTimeOffset Created, DateTimeOffset? Last, int Unread)>();

        await using (var cmd = new SqlCommand($"""
            SELECT c.id, c.area_id, a.name, c.kind, c.created_at, c.last_message_at,
                   (SELECT COUNT(*) FROM app.chat_message m
                     WHERE m.chat_id = c.id AND m.deleted_at IS NULL
                       AND (r.read_at IS NULL OR m.created_at > r.read_at)
                       AND m.author_role_id NOT IN ({names})) AS unread
            FROM app.chat c
            JOIN app.area a ON a.id = c.area_id
            LEFT JOIN app.chat_read r ON r.chat_id = c.id AND r.account_id = @account
            WHERE c.area_id IN (
                SELECT scope_id FROM app.certificate
                WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now
                  AND capability IN (N'read', N'write', N'admin')
                  AND subject_role_id IN ({names}))
            ORDER BY COALESCE(c.last_message_at, c.created_at) DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@account", who.Value.AccountId);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
                    reader.GetDateTimeOffset(4), reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5),
                    reader.GetInt32(6)));
            }
        }

        var members = await MembersOfAsync(connection, rows.Select(r => r.Area).Distinct().ToList(), ctx.RequestAborted);
        var sealedNames = await NamesOfAsync(connection, rows.Select(r => r.Area).Distinct().ToList(), ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            chats = rows.Select(r => new
            {
                chatId = Ids.ToText(r.Id),
                areaId = Ids.ToText(r.Area),
                areaName = r.AreaName,
                kind = r.Kind,
                createdAt = r.Created,
                lastMessageAt = r.Last,
                unread = r.Unread,
                members = members.TryGetValue(r.Area, out var m) ? m : [],
                names = sealedNames.TryGetValue(r.Area, out var n) ? n : []
            })
        });
    }

    /// <summary>Die Mitglieder der Bereiche — je Rolle einmal, mit ihren Stufen und oeffentlichen Schluesseln.</summary>
    private static async Task<Dictionary<Guid, List<object>>> MembersOfAsync(
        SqlConnection connection, IReadOnlyList<Guid> areas, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();
        if (areas.Count == 0) return out_;

        var names = string.Join(", ", areas.Select((_, i) => $"@a{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT c.scope_id, r.id, r.kind, r.wrap_public_key, r.sign_public_key, c.capability
            FROM app.certificate c
            JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
            WHERE c.scope_kind = N'area' AND c.scope_id IN ({names})
              AND c.revoked_at IS NULL AND c.expires_at > @now
            ORDER BY c.scope_id, r.id;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < areas.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areas[i]);

        var grouped = new Dictionary<(Guid Area, Guid Role), (string Kind, byte[] Wrap, byte[] Sign, List<string> Caps)>();
        var order = new List<(Guid, Guid)>();

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var key = (reader.GetGuid(0), reader.GetGuid(1));
                if (!grouped.TryGetValue(key, out var row))
                {
                    row = (reader.GetString(2), (byte[])reader[3], (byte[])reader[4], []);
                    grouped[key] = row;
                    order.Add(key);
                }
                var capability = reader.GetString(5);
                if (!row.Caps.Contains(capability)) row.Caps.Add(capability);
            }
        }

        foreach (var key in order)
        {
            var row = grouped[key];
            if (!out_.TryGetValue(key.Item1, out var list)) out_[key.Item1] = list = [];
            list.Add(new
            {
                roleId = Ids.ToText(key.Item2),
                kind = row.Kind,
                wrapPublicKey = Base64Url.Encode(row.Wrap),
                signPublicKey = Base64Url.Encode(row.Sign),
                capabilities = row.Caps
            });
        }

        return out_;
    }

    /// <summary>Die versiegelten Namen der Mitglieder — je Bereich.</summary>
    private static async Task<Dictionary<Guid, List<object>>> NamesOfAsync(
        SqlConnection connection, IReadOnlyList<Guid> areas, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();
        if (areas.Count == 0) return out_;

        var names = string.Join(", ", areas.Select((_, i) => $"@a{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT area_id, role_id, name_sealed, epoch FROM app.area_member_name WHERE area_id IN ({names});
            """, connection);
        for (var i = 0; i < areas.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areas[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var area = reader.GetGuid(0);
            if (!out_.TryGetValue(area, out var list)) out_[area] = list = [];
            list.Add(new
            {
                roleId = Ids.ToText(reader.GetGuid(1)),
                nameSealed = Base64Url.Encode((byte[])reader[2]),
                epoch = reader.GetInt32(3)
            });
        }

        return out_;
    }

    /* ======================================================================
       ANLEGEN
       ====================================================================== */

    public sealed record CreateRequest(string ChatId, string AreaId, string Kind, string AsRoleId, string? WithRoleId);

    /// <summary>
    /// EINEN CHAT ANLEGEN — am Bereich, den der Browser dafuer gewaehlt oder
    /// gerade angelegt hat.
    ///
    /// <para>
    /// <b>Ein Bereich, ein Chat.</b> Zu einem bestehenden Bereich darf ihn
    /// anlegen, wer dort schreibt; zu einem eigenen (Gruppe, zu zweit), wer ihn
    /// fuehrt — das ist, wer ihn eben angelegt hat. Zu zweit gibt es jede
    /// Paarung nur einmal: wer eine zweite anlegen will, bekommt die erste.
    /// </para>
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ChatId, out var chatId) || !Guid.TryParse(body.AreaId, out var areaId)
            || !Guid.TryParse(body.AsRoleId, out var asRole))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (body.Kind is not ("area" or "group" or "direct"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj rozmowy: area, group albo direct.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (!mine.Contains(asRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nie rozmawiasz.");
            return;
        }

        var needed = body.Kind == "area" ? Writers : ["admin"];
        if (!(await HoldingAsync(connection, [asRole], areaId, needed, ctx.RequestAborted)).Contains(asRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, body.Kind == "area"
                ? "Rozmowę obszaru zakłada ktoś, kto w nim pisze."
                : "Ta rola nie prowadzi obszaru tej rozmowy.");
            return;
        }

        string? pair = null;
        if (body.Kind == "direct")
        {
            if (!Guid.TryParse(body.WithRoleId, out var with) || with == asRole)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Rozmowa we dwoje potrzebuje drugiej osoby albo roli.");
                return;
            }

            /* Beide stehen schon im Bereich — der Browser hat den zweiten eben hineingenommen. */
            if (!(await HoldingAsync(connection, [with], areaId, Writers, ctx.RequestAborted)).Contains(with))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Druga strona nie jest jeszcze w obszarze tej rozmowy.");
                return;
            }

            var sorted = new[] { Ids.ToText(asRole), Ids.ToText(with) }.OrderBy(x => x, StringComparer.Ordinal).ToArray();
            pair = $"{sorted[0]}|{sorted[1]}";

            await using var existing = new SqlCommand("SELECT id FROM app.chat WHERE pair_key = @pair;", connection);
            existing.Parameters.AddWithValue("@pair", pair);
            if (await existing.ExecuteScalarAsync(ctx.RequestAborted) is Guid already)
            {
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new
                {
                    error = "Ta rozmowa już istnieje.",
                    verdict = "exists",
                    chatId = Ids.ToText(already)
                });
                return;
            }
        }

        await using var insert = new SqlCommand("""
            INSERT INTO app.chat (id, area_id, kind, pair_key, created_by_role_id, created_at)
            VALUES (@id, @area, @kind, @pair, @by, @now);
            """, connection);
        insert.Parameters.AddWithValue("@id", chatId);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@kind", body.Kind);
        insert.Parameters.AddWithValue("@pair", (object?)pair ?? DBNull.Value);
        insert.Parameters.AddWithValue("@by", asRole);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten obszar ma już swoją rozmowę.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(chatId), areaId = Ids.ToText(areaId), kind = body.Kind });
    }

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
            createdAt = chat.CreatedAt,
            lastMessageAt = chat.LastMessageAt,
            readAt,

            /* Welche meiner Rollen hier schreiben duerfen — die Oberflaeche bietet nur sie an. */
            writers = (await HoldingAsync(connection, mine, chat.AreaId, Writers, ctx.RequestAborted)).Select(Ids.ToText),
            certifiers = (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).Select(Ids.ToText),
            members = members.TryGetValue(chat.AreaId, out var m) ? m : [],
            names = names.TryGetValue(chat.AreaId, out var n) ? n : []
        });
    }

    /// <summary>
    /// Die Nachrichten — die neuesten (\`before\` fuer weiter zurueck) oder,
    /// fuer das Nachladen, die nach \`after\`.
    /// </summary>
    private static async Task MessagesAsync(HttpContext ctx, Db db, Guid id, string? before, string? after, int? limit)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;

        var take = Math.Clamp(limit ?? 60, 1, 200);
        var hasBefore = DateTimeOffset.TryParse(before, out var b);
        var hasAfter = DateTimeOffset.TryParse(after, out var a);

        var messages = new List<object>();

        await using (var cmd = new SqlCommand($"""
            SELECT TOP {take} id, author_role_id, epoch, body_sealed, created_at, deleted_at, signature, signed_at
            FROM app.chat_message
            WHERE chat_id = @chat
              {(hasBefore ? "AND created_at < @before" : "")}
              {(hasAfter ? "AND created_at > @after" : "")}
            ORDER BY created_at {(hasAfter ? "ASC" : "DESC")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@chat", id);
            if (hasBefore) cmd.Parameters.AddWithValue("@before", b);
            if (hasAfter) cmd.Parameters.AddWithValue("@after", a);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                messages.Add(new
                {
                    messageId = Ids.ToText(reader.GetGuid(0)),
                    authorRoleId = Ids.ToText(reader.GetGuid(1)),
                    epoch = reader.GetInt32(2),
                    bodySealed = reader.IsDBNull(3) ? null : Base64Url.Encode((byte[])reader[3]),
                    createdAt = reader.GetDateTimeOffset(4),
                    deletedAt = reader.IsDBNull(5) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(5),
                    signature = Base64Url.Encode((byte[])reader[6]),
                    signedAt = reader.GetDateTimeOffset(7)
                });
            }
        }

        /* Immer in der Reihenfolge, in der sie geschrieben wurden — die aelteste zuerst. */
        if (!hasAfter) messages.Reverse();

        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(id), messages });
    }

    public sealed record PostRequest(string MessageId, string AuthorRoleId, int Epoch, string BodySealed,
        string Signature, long SignedAt);

    /// <summary>
    /// EINE NACHRICHT — versiegelt im Browser, von der Rolle des Verfassers
    /// unterschrieben. Schreiben darf eine Rolle, die SELBST im Bereich
    /// schreibt; die Unterschrift wird hier gegen ihren oeffentlichen Schluessel
    /// geprueft.
    /// </summary>
    private static async Task PostAsync(HttpContext ctx, Db db, Guid id, PostRequest body)
    {
        if (!Guid.TryParse(body.MessageId, out var messageId) || !Guid.TryParse(body.AuthorRoleId, out var author))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        byte[] sealedBody, signature;
        try
        {
            sealedBody = Base64Url.Decode(body.BodySealed ?? string.Empty);
            signature = Base64Url.Decode(body.Signature ?? string.Empty);
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna wiadomość albo podpis.");
            return;
        }

        if (sealedBody.Length is 0 or > MaxBody)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wiadomość jest pusta albo za długa.");
            return;
        }

        var signedAt = DateTimeOffset.FromUnixTimeSeconds(body.SignedAt);
        var now = DateTimeOffset.UtcNow;
        if (signedAt > now + ClockSlack || signedAt < now - ClockSlack)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Czas podpisu nie zgadza się z zegarem.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;
        var (chat, mine, account) = seen.Value;

        if (!mine.Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nie piszesz.");
            return;
        }

        if (!(await HoldingAsync(connection, [author], chat.AreaId, Writers, ctx.RequestAborted)).Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola w tej rozmowie tylko czyta.");
            return;
        }

        int currentEpoch;
        await using (var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", chat.AreaId);
            currentEpoch = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        if (body.Epoch < 1 || body.Epoch > currentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        byte[]? signKey;
        await using (var cmd = new SqlCommand("SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            cmd.Parameters.AddWithValue("@id", author);
            signKey = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
        }

        var bodyHash = SHA256.HashData(sealedBody);
        var record = new MessageVersionRecord
        {
            Id = messageId,
            MessageId = messageId,
            Version = 1,
            AuthorRoleId = author,
            BodyHash = bodyHash,
            CreatedUtc = signedAt
        };

        if (signKey is null || !VerifySignature(record, signKey, signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis wiadomości się nie zgadza.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.chat_message
                    (id, chat_id, author_role_id, epoch, body_sealed, body_sha256, signature, signed_at, created_at)
                VALUES (@id, @chat, @author, @epoch, @body, @hash, @sig, @signed, @now);
                UPDATE app.chat SET last_message_at = @now WHERE id = @chat;
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", messageId);
                insert.Parameters.AddWithValue("@chat", chat.Id);
                insert.Parameters.AddWithValue("@author", author);
                insert.Parameters.AddWithValue("@epoch", body.Epoch);
                insert.Parameters.AddWithValue("@body", sealedBody);
                insert.Parameters.AddWithValue("@hash", bodyHash);
                insert.Parameters.AddWithValue("@sig", signature);
                insert.Parameters.AddWithValue("@signed", signedAt);
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta wiadomość już jest.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        /* Was ich selbst schreibe, habe ich gelesen — ausserhalb der Nachricht: ein Streit darum darf sie nicht kosten. */
        await MarkReadAsync(connection, null, chat.Id, account, now, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(messageId), createdAt = now });
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

        Guid chatId, author;
        await using (var cmd = new SqlCommand(
            "SELECT chat_id, author_role_id FROM app.chat_message WHERE id = @id AND deleted_at IS NULL;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
                return;
            }
            chatId = reader.GetGuid(0);
            author = reader.GetGuid(1);
        }

        var seen = await ReadableAsync(ctx, db, connection, chatId);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        /* Zu zweit loescht niemand die Worte des anderen — auch nicht, wer den Bereich angelegt hat. */
        var mayModerate = chat.Kind != "direct"
            && (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).Count > 0;
        if (!mine.Contains(author) && !mayModerate)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Usunąć może tylko autor albo ten, kto prowadzi rozmowę.");
            return;
        }

        await using var drop = new SqlCommand(
            "UPDATE app.chat_message SET body_sealed = NULL, deleted_at = @now WHERE id = @id;", connection);
        drop.Parameters.AddWithValue("@id", id);
        drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), deleted = true });
    }

    /* ======================================================================
       NAMEN UND VISITENKARTEN
       ====================================================================== */

    public sealed record NameRequest(string RoleId, string NameSealed, int Epoch, string ByRoleId);

    /// <summary>
    /// WIE JEMAND IN DIESEM BEREICH HEISST — versiegelt unter dessen Schluessel.
    /// Den eigenen Namen setzt man selbst; einen fremden setzt, wer im Bereich
    /// hineinlaesst (er weiss, wen er eben aufgenommen hat).
    /// </summary>
    private static async Task NameAsync(HttpContext ctx, Db db, Guid id, NameRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var roleId) || !Guid.TryParse(body.ByRoleId, out var byRole))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        byte[] name;
        try { name = Base64Url.Decode(body.NameSealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna nazwa.");
            return;
        }

        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nazwa jest pusta albo za długa.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (!mine.Contains(byRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nic nie ustawisz.");
            return;
        }

        var own = roleId == byRole
            && (await HoldingAsync(connection, [roleId], id, Readers, ctx.RequestAborted)).Contains(roleId);
        var certifies = (await HoldingAsync(connection, [byRole], id, ["admin", "certify"], ctx.RequestAborted)).Contains(byRole);

        if (!own && !certifies)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Nazwę ustawia sama osoba albo ten, kto wpuszcza do obszaru.");
            return;
        }

        /* Nur fuer jemanden, der wirklich im Bereich steht. */
        if (!(await HoldingAsync(connection, [roleId], id, [.. Readers, "certify"], ctx.RequestAborted)).Contains(roleId))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tej roli nie ma w obszarze.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.area_member_name
               SET name_sealed = @name, epoch = @epoch, set_by_role_id = @by, updated_at = @now
             WHERE area_id = @area AND role_id = @role;
            IF @@ROWCOUNT = 0
                INSERT INTO app.area_member_name (area_id, role_id, name_sealed, epoch, set_by_role_id, updated_at)
                VALUES (@area, @role, @name, @epoch, @by, @now);
            """, connection);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@name", name);
        cmd.Parameters.AddWithValue("@epoch", body.Epoch);
        cmd.Parameters.AddWithValue("@by", byRole);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), roleId = Ids.ToText(roleId), named = true });
    }

    /// <summary>Die Namen der Mitglieder eines Bereichs, versiegelt — fuer die Seite des Bereichs.</summary>
    private static async Task AreaNamesAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var names = await NamesOfAsync(connection, [id], ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), names = names.TryGetValue(id, out var n) ? n : [] });
    }

    /// <summary>
    /// Die Visitenkarte einer Rolle: Art und oeffentlicher Schluessel. Mit
    /// Anmeldung; kein Konto (0040) — das nimmt nichts entgegen.
    /// </summary>
    private static async Task CardAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand(
            "SELECT kind, wrap_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted) || reader.GetString(0) == "account")
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma osoby ani roli o takim kodzie.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            roleId = Ids.ToText(id),
            kind = reader.GetString(0),
            wrapPublicKey = Base64Url.Encode((byte[])reader[1])
        });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
