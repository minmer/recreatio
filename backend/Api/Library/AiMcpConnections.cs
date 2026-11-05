using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// MCP-VERBINDUNGEN, DIE BEREICHE DAZUBEKOMMEN (0138, 2026-11-05).
///
/// <para>
/// <b>Warum.</b> Bis 0138 WAR das OAuth-Token eines Assistenten die Liste der Links, die der Mensch
/// bei der Anmeldung ankreuzte. Ein Link aus einem anderen Bereich kam nie dazu: ChatGPT sah nur
/// den Bereich der ersten Anmeldung (z. B. „CogitaTemp"), auch wenn andere Bereiche längst einen
/// Link hatten. Jetzt bekommt der Assistent eine Verbindung (<c>rcm~&lt;geheimnis&gt;</c>), und der
/// Mensch fügt ihr in der App Bereiche hinzu oder nimmt sie heraus — ohne neue Anmeldung.
/// </para>
///
/// <para>
/// <b>Die Schlüssel.</b> Die Verbindung hat ein RSA-Paar. Der öffentliche Schlüssel liegt offen: mit
/// ihm verpackt der Dienst das Geheimnis eines hinzugefügten Links (der Browser des Menschen hat es
/// geöffnet und gereicht, wie bei der Zustimmung). Der private liegt versiegelt unter
/// HKDF(Token) — geöffnet wird er nur, während eine Anfrage das Token trägt. Die Datenbank allein
/// öffnet also keinen Link, genau wie vorher.
/// </para>
///
/// <para>
/// <b>Jeder Bereich für sich.</b> Ein Link zählt bei jeder Anfrage nur, wenn er selbst gilt (fertig,
/// nicht abgelaufen, sein Urheber prowadzi den Bereich — <see cref="AiAccess.LinkWorksAsync"/>) UND
/// der Besitzer der Verbindung den Bereich noch prowadzi. Fällt ein Bereich weg, bleiben die
/// anderen; ohne einen einzigen geltenden Bereich bleibt die Verbindung bestehen und sagt, wo man
/// einen hinzufügt.
/// </para>
/// </summary>
public static class AiMcpConnections
{
    /// <summary>So beginnt das Token einer Verbindung — „~" kommt in keinem Link-Geheimnis vor (base64url).</summary>
    public const string Prefix = "rcm~";
    public const int MaxLinks = 20;
    public static readonly TimeSpan Life = TimeSpan.FromDays(365);
    private static readonly TimeSpan UnclaimedFor = TimeSpan.FromHours(1);
    internal const string ConnectionKey = "ai.mcp.connection";

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/ai-connections", ListAsync);
        app.MapDelete("/workspace/ai-connections/{id:guid}", RevokeAsync);
        app.MapPost("/workspace/ai-connections/{id:guid}/links", AddAsync);
        app.MapDelete("/workspace/ai-connections/{id:guid}/links/{accessId:guid}", RemoveAsync);
    }

    /* -- Etiketten ------------------------------------------------------------------------------ */

    /// <summary>Das Geheimnis eines Verbindungstokens, sonst <c>null</c> (auch für alte Tokens).</summary>
    public static string? SecretOf(string? token)
    {
        var t = token?.Trim();
        return t is not null && t.StartsWith(Prefix, StringComparison.Ordinal) ? AiAccess.TokenOf(t[Prefix.Length..]) : null;
    }

    public static Aad PrivateAad(Guid connectionId) => Aad.Create("ai", "mcp", connectionId, Field.AiMcpConnection, 1);

    /// <summary>Das verpackte Geheimnis eines Links ist an die Verbindung UND an den Link gebunden.</summary>
    public static Aad LinkAad(Guid connectionId, Guid accessId) => Aad.Create("ai", $"mcp-{Ids.ToText(connectionId)}", accessId, Field.AiMcpLink, 1);

    public static byte[] TokenKey(string secret, Guid connectionId) =>
        Crypto.Derive(Encoding.UTF8.GetBytes(secret), Crypto.InfoAiMcpConnection(connectionId), Crypto.KeySize);

    /// <summary>Ein neues Paar: der öffentliche Schlüssel (SPKI) und der private, versiegelt unter dem Token.</summary>
    public static (byte[] Public, byte[] PrivateSealed) NewKeys(string secret, Guid connectionId)
    {
        using var rsa = RSA.Create(4096);
        var pkcs8 = rsa.ExportPkcs8PrivateKey();
        var key = TokenKey(secret, connectionId);
        try
        {
            return (rsa.ExportSubjectPublicKeyInfo(), Crypto.Seal(key, PrivateAad(connectionId), pkcs8));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(pkcs8);
            CryptographicOperations.ZeroMemory(key);
        }
    }

    public static byte[] WrapLink(byte[] publicKey, Guid connectionId, Guid accessId, string linkSecret)
    {
        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(publicKey, out _);
        return Crypto.WrapKey(rsa, LinkAad(connectionId, accessId), Encoding.UTF8.GetBytes(linkSecret));
    }

    /// <summary>Der private Schlüssel aus dem Token — falsches Token oder falsche Verbindung: <see cref="DecryptException"/>.</summary>
    public static RSA OpenPrivate(string secret, Guid connectionId, byte[] privateSealed)
    {
        var key = TokenKey(secret, connectionId);
        byte[]? pkcs8 = null;
        try
        {
            pkcs8 = Crypto.Open(key, PrivateAad(connectionId), privateSealed);
            var rsa = RSA.Create();
            rsa.ImportPkcs8PrivateKey(pkcs8, out _);
            return rsa;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
            if (pkcs8 is not null) CryptographicOperations.ZeroMemory(pkcs8);
        }
    }

    public static string? UnwrapLink(RSA privateKey, Guid connectionId, Guid accessId, byte[] wrapped)
    {
        try { return AiAccess.TokenOf(Encoding.UTF8.GetString(Crypto.UnwrapKey(privateKey, LinkAad(connectionId, accessId), wrapped))); }
        catch (DecryptException) { return null; }
    }

    /* -- Gibt es die Tabellen? (ein Dienst vor 0138 arbeitet wie bisher) ---------------------- */

    internal static async Task<bool> ReadyAsync(SqlConnection connection, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT CASE WHEN OBJECT_ID('app.ai_mcp_link', 'U') IS NULL THEN 0 ELSE 1 END;", connection);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0) == 1;
    }

    private static async Task TidyAsync(SqlConnection connection, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            DELETE FROM app.ai_mcp_connection
            WHERE expires_at < SYSDATETIMEOFFSET()
               OR (claimed_at IS NULL AND created_at < DATEADD(hour, -1, SYSDATETIMEOFFSET()));
            """, connection);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /* -- Anlegen (bei der Zustimmung, AiOAuth.ApproveAsync) ------------------------------------ */

    /// <summary>Gilt dieser Link, und prowadzi <paramref name="account"/> seinen Bereich? Dann seine Kennung.</summary>
    internal static async Task<Guid?> LinkOfLeaderAsync(Db db, SqlConnection connection, Guid account, string secret, CancellationToken ct)
    {
        Guid id, area;
        await using (var cmd = new SqlCommand("""
            SELECT id, area_id FROM app.ai_access WHERE token_sha256 = @hash AND key_wrapped IS NOT NULL AND expires_at > SYSDATETIMEOFFSET();
            """, connection))
        {
            cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;
            id = reader.GetGuid(0);
            area = reader.GetGuid(1);
        }
        if (!await Area.MayAsync(connection, account, area, Capability.Admin, ct)) return null;
        return await AiAccess.LinkWorksAsync(db, secret, ct) ? id : null;
    }

    /// <summary>
    /// EINE VERBINDUNG ANLEGEN — noch nicht eingelöst (<c>claimed_at</c> leer): das Token geht nur
    /// versiegelt unter dem OAuth-Code weiter. Zurück: Kennung und Token.
    /// </summary>
    internal static async Task<(Guid Id, string Token)> CreateAsync(SqlConnection connection, Guid account, string clientId, string clientName,
        IReadOnlyList<(Guid AccessId, string Secret)> links, CancellationToken ct)
    {
        await TidyAsync(connection, ct);
        var id = Ids.NewId(DateTimeOffset.UtcNow);
        var secret = Token.NewSecret();
        var (publicKey, privateSealed) = NewKeys(secret, id);
        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        await using (var cmd = new SqlCommand("""
            INSERT INTO app.ai_mcp_connection (id, account_id, client_id, client_name, token_sha256, public_key, private_sealed, created_at, expires_at)
            VALUES (@id, @account, @client, @name, @hash, @public, @private, @now, @expires);
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@account", account);
            cmd.Parameters.AddWithValue("@client", clientId.Length > 512 ? clientId[..512] : clientId);
            cmd.Parameters.AddWithValue("@name", clientName);
            cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
            cmd.Parameters.Add("@public", System.Data.SqlDbType.VarBinary, 1024).Value = publicKey;
            cmd.Parameters.Add("@private", System.Data.SqlDbType.VarBinary, -1).Value = privateSealed;
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@expires", now + Life);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        foreach (var (accessId, linkSecret) in links.DistinctBy(l => l.AccessId))
            await PutLinkAsync(connection, tx, id, publicKey, accessId, linkSecret, ct);
        await tx.CommitAsync(ct);
        return (id, Prefix + secret);
    }

    private static async Task PutLinkAsync(SqlConnection connection, SqlTransaction? tx, Guid id, byte[] publicKey, Guid accessId, string linkSecret, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            MERGE app.ai_mcp_link AS t
            USING (SELECT @id AS connection_id, @access AS access_id) AS s
               ON t.connection_id = s.connection_id AND t.access_id = s.access_id
            WHEN MATCHED THEN UPDATE SET secret_wrapped = @wrapped, added_at = SYSDATETIMEOFFSET()
            WHEN NOT MATCHED THEN INSERT (connection_id, access_id, secret_wrapped, added_at) VALUES (@id, @access, @wrapped, SYSDATETIMEOFFSET());
            """, connection, tx);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@access", accessId);
        cmd.Parameters.Add("@wrapped", System.Data.SqlDbType.VarBinary, 1024).Value = WrapLink(publicKey, id, accessId, linkSecret);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Der Assistent hat seinen Code eingelöst: ab jetzt zählt die Verbindung. Zurück: bis wann sie gilt.</summary>
    internal static async Task<DateTimeOffset?> ClaimAsync(SqlConnection connection, string token, CancellationToken ct)
    {
        var secret = SecretOf(token);
        if (secret is null) return null;
        await using var cmd = new SqlCommand("""
            UPDATE app.ai_mcp_connection SET claimed_at = SYSDATETIMEOFFSET()
            OUTPUT inserted.expires_at
            WHERE token_sha256 = @hash AND claimed_at IS NULL AND expires_at > SYSDATETIMEOFFSET();
            """, connection);
        cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
        return await cmd.ExecuteScalarAsync(ct) as DateTimeOffset?;
    }

    /* -- Öffnen (bei jeder MCP-Anfrage, AiMcp.GateAsync) ------------------------------------------ */

    public sealed record Opened(Guid Id, Guid Owner, DateTimeOffset Expires, List<string> Secrets);

    /// <summary>
    /// DIE VERBINDUNG HINTER EINEM TOKEN, mit den Geheimnissen der Links, die gerade gelten — jeder
    /// Bereich für sich geprüft. <c>null</c>: kein solches Token, abgelaufen, widerrufen.
    /// </summary>
    internal static async Task<Opened?> OpenAsync(Db db, string token, CancellationToken ct)
    {
        var secret = SecretOf(token);
        if (secret is null) return null;
        await using var connection = await db.OpenAsync(ct);
        if (!await ReadyAsync(connection, ct)) return null;

        Guid id, owner;
        DateTimeOffset expires;
        byte[] privateSealed;
        await using (var cmd = new SqlCommand("""
            SELECT id, account_id, expires_at, private_sealed FROM app.ai_mcp_connection
            WHERE token_sha256 = @hash AND claimed_at IS NOT NULL AND expires_at > SYSDATETIMEOFFSET();
            """, connection))
        {
            cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;
            id = reader.GetGuid(0);
            owner = reader.GetGuid(1);
            expires = reader.GetDateTimeOffset(2);
            privateSealed = (byte[])reader[3];
        }

        var links = new List<(Guid Access, Guid Area, byte[] Wrapped)>();
        await using (var cmd = new SqlCommand("""
            SELECT l.access_id, a.area_id, l.secret_wrapped FROM app.ai_mcp_link l
            JOIN app.ai_access a ON a.id = l.access_id
            WHERE l.connection_id = @id ORDER BY l.added_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) links.Add((reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2]));
        }

        var secrets = new List<string>();
        RSA privateKey;
        try { privateKey = OpenPrivate(secret, id, privateSealed); }
        catch (DecryptException) { return null; }
        using (privateKey)
        {
            foreach (var (access, area, wrapped) in links)
            {
                /* Jeder Bereich für sich: der Besitzer der Verbindung prowadzi ihn noch, und der Link selbst gilt. */
                if (!await Area.MayAsync(connection, owner, area, Capability.Admin, ct)) continue;
                if (UnwrapLink(privateKey, id, access, wrapped) is not string one) continue;
                if (await AiAccess.LinkWorksAsync(db, one, ct)) secrets.Add(one);
            }
        }

        await using (var used = new SqlCommand("UPDATE app.ai_mcp_connection SET last_used_at = SYSDATETIMEOFFSET() WHERE id = @id;", connection))
        {
            used.Parameters.AddWithValue("@id", id);
            await used.ExecuteNonQueryAsync(ct);
        }
        return new Opened(id, owner, expires, secrets);
    }

    /* -- Verwalten (in der App, mit der Sitzung des Besitzers) ------------------------------------- */

    public sealed record AddRequest(string? Secret);

    private static async Task<(Guid Account, SqlConnection Connection)?> OwnerAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }
        var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await ReadyAsync(connection, ctx.RequestAborted))
        {
            await connection.DisposeAsync();
            ctx.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await ctx.Response.WriteAsJsonAsync(new { error = "not_ready", message = "Migration 0138 is not applied yet." });
            return null;
        }
        return (who.Value.AccountId, connection);
    }

    /// <summary>Die Verbindung, wenn sie diesem Konto gehört und eingelöst ist — sonst <c>null</c> (404, auch für fremde).</summary>
    private static async Task<byte[]?> OwnedAsync(SqlConnection connection, Guid account, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT public_key FROM app.ai_mcp_connection
            WHERE id = @id AND account_id = @account AND claimed_at IS NOT NULL AND expires_at > SYSDATETIMEOFFSET();
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@account", account);
        return await cmd.ExecuteScalarAsync(ct) as byte[];
    }

    private static Task NotFound(HttpContext ctx)
    {
        ctx.Response.StatusCode = StatusCodes.Status404NotFound;
        return ctx.Response.WriteAsJsonAsync(new { error = "not_found" });
    }

    /// <summary>
    /// MEINE VERBINDUNGEN — je Verbindung der Assistent, seit wann, bis wann, zuletzt benutzt, und je
    /// Bereich: welcher Link, bis wann er gilt, ob er gerade gilt (und wenn nicht, warum). Namen und
    /// Behälter setzt der Browser aus seinen eigenen Listen ein.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var owner = await OwnerAsync(ctx, db);
        if (owner is null) return;
        var (account, connection) = owner.Value;
        await using var _ = connection;
        var ct = ctx.RequestAborted;
        await TidyAsync(connection, ct);

        var rows = new List<(Guid Id, string Client, DateTimeOffset Created, DateTimeOffset Expires, DateTimeOffset? Used)>();
        await using (var cmd = new SqlCommand("""
            SELECT id, client_name, created_at, expires_at, last_used_at FROM app.ai_mcp_connection
            WHERE account_id = @account AND claimed_at IS NOT NULL ORDER BY created_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@account", account);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                rows.Add((reader.GetGuid(0), reader.GetString(1), reader.GetDateTimeOffset(2), reader.GetDateTimeOffset(3), reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4)));
        }

        var hasWhole = await AiAccess.HasWholeAreaAsync(connection, null, ct);
        var links = new List<(Guid Connection, Guid Access, Guid Area, string AreaName, Guid Creator, DateTimeOffset Expires, bool Ready, bool Whole, DateTimeOffset Added)>();
        if (rows.Count > 0)
        {
            await using var cmd = new SqlCommand($"""
                SELECT l.connection_id, a.id, a.area_id, ar.name, a.account_id, a.expires_at, CAST(CASE WHEN a.key_wrapped IS NULL THEN 0 ELSE 1 END AS bit),
                       {(hasWhole ? "a.whole_area" : "CAST(0 AS bit)")}, l.added_at
                FROM app.ai_mcp_link l
                JOIN app.ai_mcp_connection c ON c.id = l.connection_id
                JOIN app.ai_access a ON a.id = l.access_id
                JOIN app.area ar ON ar.id = a.area_id
                WHERE c.account_id = @account
                ORDER BY l.added_at;
                """, connection);
            cmd.Parameters.AddWithValue("@account", account);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                links.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.IsDBNull(3) ? "" : reader.GetString(3), reader.GetGuid(4),
                    reader.GetDateTimeOffset(5), reader.GetBoolean(6), reader.GetBoolean(7), reader.GetDateTimeOffset(8)));
        }

        var leads = new Dictionary<(Guid, Guid), bool>();
        async Task<bool> Leads(Guid who, Guid area)
        {
            if (!leads.TryGetValue((who, area), out var yes)) leads[(who, area)] = yes = await Area.MayAsync(connection, who, area, Capability.Admin, ct);
            return yes;
        }

        var now = DateTimeOffset.UtcNow;
        var outRows = new List<object>();
        foreach (var r in rows)
        {
            var areas = new List<object>();
            foreach (var l in links.Where(l => l.Connection == r.Id))
            {
                var status = !l.Ready ? "pending"
                    : l.Expires <= now ? "expired"
                    : !await Leads(account, l.Area) ? "notLeader"
                    : !await Leads(l.Creator, l.Area) ? "creatorLeft"
                    : "ok";
                areas.Add(new
                {
                    accessId = Ids.ToText(l.Access),
                    areaId = Ids.ToText(l.Area),
                    areaName = l.AreaName,
                    expiresAt = l.Expires,
                    wholeArea = l.Whole,
                    addedAt = l.Added,
                    status
                });
            }
            outRows.Add(new { id = Ids.ToText(r.Id), client = r.Client, createdAt = r.Created, expiresAt = r.Expires, lastUsedAt = r.Used, areas, max = MaxLinks });
        }
        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new { connections = outRows });
    }

    /// <summary>
    /// EINEN BEREICH HINZUFÜGEN — der Browser des Besitzers hat das Geheimnis eines Links geöffnet
    /// (nur wer den Bereich prowadzi, kann das). Der Dienst prüft wie bei der Zustimmung und verpackt
    /// es an den öffentlichen Schlüssel der Verbindung; das Geheimnis selbst wird nicht gespeichert.
    /// Der Assistent sieht den Bereich bei seiner nächsten Anfrage — ohne neue Anmeldung.
    /// </summary>
    private static async Task AddAsync(HttpContext ctx, Db db, Guid id, AddRequest body)
    {
        var owner = await OwnerAsync(ctx, db);
        if (owner is null) return;
        var (account, connection) = owner.Value;
        await using var _ = connection;
        var ct = ctx.RequestAborted;
        var publicKey = await OwnedAsync(connection, account, id, ct);
        if (publicKey is null) { await NotFound(ctx); return; }

        var secret = AiAccess.TokenOf(body.Secret);
        var accessId = secret is null ? null : await LinkOfLeaderAsync(db, connection, account, secret, ct);
        if (secret is null || accessId is null)
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            await ctx.Response.WriteAsJsonAsync(new { error = "link_not_allowed" });
            return;
        }

        await using (var count = new SqlCommand("SELECT COUNT(*) FROM app.ai_mcp_link WHERE connection_id = @id AND access_id <> @access;", connection))
        {
            count.Parameters.AddWithValue("@id", id);
            count.Parameters.AddWithValue("@access", accessId.Value);
            if ((int)(await count.ExecuteScalarAsync(ct) ?? 0) >= MaxLinks)
            {
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new { error = "too_many", max = MaxLinks });
                return;
            }
        }

        /* Ein Bereich hat in einer Verbindung einen Link: ein anderer Link desselben Bereichs wird ersetzt. */
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        await using (var drop = new SqlCommand("""
            DELETE l FROM app.ai_mcp_link l JOIN app.ai_access a ON a.id = l.access_id
            WHERE l.connection_id = @id AND l.access_id <> @access
              AND a.area_id = (SELECT area_id FROM app.ai_access WHERE id = @access);
            """, connection, tx))
        {
            drop.Parameters.AddWithValue("@id", id);
            drop.Parameters.AddWithValue("@access", accessId.Value);
            await drop.ExecuteNonQueryAsync(ct);
        }
        await PutLinkAsync(connection, tx, id, publicKey, accessId.Value, secret, ct);
        await tx.CommitAsync(ct);
        await ctx.Response.WriteAsJsonAsync(new { added = true, accessId = Ids.ToText(accessId.Value) });
    }

    /// <summary>EINEN BEREICH HERAUSNEHMEN — die anderen bleiben; der Link selbst bleibt (andere Verbindungen, /ai/…).</summary>
    private static async Task RemoveAsync(HttpContext ctx, Db db, Guid id, Guid accessId)
    {
        var owner = await OwnerAsync(ctx, db);
        if (owner is null) return;
        var (account, connection) = owner.Value;
        await using var _ = connection;
        if (await OwnedAsync(connection, account, id, ctx.RequestAborted) is null) { await NotFound(ctx); return; }
        await using var cmd = new SqlCommand("DELETE FROM app.ai_mcp_link WHERE connection_id = @id AND access_id = @access;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@access", accessId);
        var removed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) > 0;
        await ctx.Response.WriteAsJsonAsync(new { removed });
    }

    /// <summary>DIE VERBINDUNG WIDERRUFEN — das Token gilt ab der nächsten Anfrage nicht mehr; die Links bleiben.</summary>
    private static async Task RevokeAsync(HttpContext ctx, Db db, Guid id)
    {
        var owner = await OwnerAsync(ctx, db);
        if (owner is null) return;
        var (account, connection) = owner.Value;
        await using var _ = connection;
        await using var cmd = new SqlCommand("DELETE FROM app.ai_mcp_connection WHERE id = @id AND account_id = @account;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@account", account);
        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0) { await NotFound(ctx); return; }
        await ctx.Response.WriteAsJsonAsync(new { revoked = true });
    }
}
