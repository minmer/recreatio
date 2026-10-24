using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// OAUTH 2.1 FÜR DEN MCP-SERVER (0127) — so, wie ChatGPT und die MCP-Spezifikation es verlangen:
/// Autorisierungscode mit PKCE (S256), Metadaten des geschützten Dienstes (RFC 9728) und des
/// Ausstellers (RFC 8414), Selbstanmeldung (RFC 7591) und Client-ID-Metadatendokumente (CIMD),
/// <c>iss</c> in jeder Antwort an den Rücksprung (RFC 9207).
///
/// <para>
/// <b>Was ausgestellt wird, ist nichts Neues.</b> Der Mensch meldet sich im Browser bei Recreatio
/// an (<c>#/polacz-ai/{anfrage}</c>) und wählt Dostęp-dla-AI-Links (0126) von Bereichen, die er
/// prowadzi — oder legt einen an. Sein Browser öffnet deren Geheimnisse (nur er kann es: sie liegen
/// unter dem Schlüssel des Bereichs) und reicht sie hierher; das Zugangstoken des Assistenten IST
/// diese Liste. Bis der Assistent den Code einlöst, liegen die Geheimnisse versiegelt unter einem
/// Schlüssel aus dem Code (gespeichert nur als Hash), danach gar nicht mehr. Damit gilt alles vom
/// Link weiter: dieselben Behälter, dieselbe Frist, gelöscht ist gelöscht, und der Dienst öffnet
/// eine Abschrift nur, während eine Anfrage das Token trägt.
/// </para>
/// </summary>
public static class AiOAuth
{
    private static readonly TimeSpan RequestLife = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan CodeLife = TimeSpan.FromMinutes(5);
    private const int MaxLinks = 10;

    private static readonly HttpClient Http = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(5) };
    private static readonly ConcurrentDictionary<string, (DateTime At, (string Name, string[] Redirects)? Client)> Documents = new();

    public static void Map(WebApplication app)
    {
        app.MapGet("/.well-known/oauth-protected-resource", ResourceAsync).RequireCors(AiMcp.OpenCors);
        app.MapGet("/.well-known/oauth-protected-resource/mcp", ResourceAsync).RequireCors(AiMcp.OpenCors);
        app.MapGet("/.well-known/oauth-authorization-server", IssuerAsync).RequireCors(AiMcp.OpenCors);
        app.MapGet("/.well-known/oauth-authorization-server/mcp", IssuerAsync).RequireCors(AiMcp.OpenCors);
        app.MapPost("/oauth/register", RegisterAsync).RequireCors(AiMcp.OpenCors);
        app.MapGet("/oauth/authorize", AuthorizeAsync);
        app.MapPost("/oauth/token", TokenAsync).RequireCors(AiMcp.OpenCors).DisableAntiforgery();

        /* Im Browser des Menschen, mit seiner Sitzung (die App ruft das). */
        app.MapGet("/oauth/request/{id:guid}", RequestAsync);
        app.MapPost("/oauth/approve", ApproveAsync);
        app.MapPost("/oauth/deny", DenyAsync);
    }

    private static string Issuer(HttpRequest request) => AiAccess.PublicRoot(request);
    private static string Resource(HttpRequest request) => $"{AiAccess.PublicRoot(request)}/mcp";

    /* -- Metadaten ----------------------------------------------------------------------------------- */

    private static IResult ResourceAsync(HttpContext ctx) => Results.Json(new
    {
        resource = Resource(ctx.Request),
        authorization_servers = new[] { Issuer(ctx.Request) },
        scopes_supported = new[] { AiMcp.Scope },
        bearer_methods_supported = new[] { "header" },
        resource_name = "Recreatio — Biblioteka, Skryptorium, Wiedza (tylko odczyt)"
    });

    private static IResult IssuerAsync(HttpContext ctx)
    {
        var issuer = Issuer(ctx.Request);
        return Results.Json(new
        {
            issuer,
            authorization_endpoint = $"{issuer}/oauth/authorize",
            token_endpoint = $"{issuer}/oauth/token",
            registration_endpoint = $"{issuer}/oauth/register",
            response_types_supported = new[] { "code" },
            grant_types_supported = new[] { "authorization_code" },
            code_challenge_methods_supported = new[] { "S256" },
            token_endpoint_auth_methods_supported = new[] { "none" },
            scopes_supported = new[] { AiMcp.Scope },
            client_id_metadata_document_supported = true,
            authorization_response_iss_parameter_supported = true
        });
    }

    /* -- Assistenten ----------------------------------------------------------------------------------- */

    public sealed record Registration(string[]? Redirect_uris, string? Client_name, string? Token_endpoint_auth_method);

    /// <summary>Eine Rücksprungadresse, die ein Assistent haben darf: https, oder http nur auf diesem Rechner (Inspector).</summary>
    public static bool IsRedirect(string? uri) =>
        Uri.TryCreate(uri, UriKind.Absolute, out var u) && u.Fragment.Length == 0
        && (u.Scheme == "https" || (u.Scheme == "http" && (u.Host == "localhost" || u.Host == "127.0.0.1" || u.Host == "[::1]")));

    /// <summary>SELBSTANMELDUNG (RFC 7591) — ein öffentlicher Client ohne Geheimnis, mit seinen Rücksprüngen.</summary>
    private static async Task<IResult> RegisterAsync(HttpContext ctx, Db db)
    {
        Registration? body;
        try { body = await ctx.Request.ReadFromJsonAsync<Registration>(ctx.RequestAborted); }
        catch (JsonException) { body = null; }
        var redirects = body?.Redirect_uris?.Where(r => !string.IsNullOrWhiteSpace(r)).Select(r => r.Trim()).Distinct().ToArray() ?? [];
        if (redirects.Length is 0 or > 10 || !redirects.All(IsRedirect))
            return Results.Json(new { error = "invalid_redirect_uri", error_description = "redirect_uris: 1–10 adresów https (albo http://localhost)." }, statusCode: 400);
        if (body!.Token_endpoint_auth_method is string method && method != "none")
            return Results.Json(new { error = "invalid_client_metadata", error_description = "Tylko klienci publiczni z PKCE (token_endpoint_auth_method: none)." }, statusCode: 400);

        var name = (body.Client_name ?? "").Trim();
        if (name.Length == 0) name = new Uri(redirects[0]).Host;
        if (name.Length > 200) name = name[..200];
        var clientId = $"rc-{Token.NewSecret()}";
        var now = DateTimeOffset.UtcNow;
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            INSERT INTO app.ai_oauth_client (client_id, name, redirect_uris, created_at) VALUES (@id, @name, @redirects, @now);
            """, connection);
        cmd.Parameters.AddWithValue("@id", clientId);
        cmd.Parameters.AddWithValue("@name", name);
        cmd.Parameters.AddWithValue("@redirects", JsonSerializer.Serialize(redirects));
        cmd.Parameters.AddWithValue("@now", now);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        return Results.Json(new
        {
            client_id = clientId,
            client_id_issued_at = now.ToUnixTimeSeconds(),
            client_name = name,
            redirect_uris = redirects,
            token_endpoint_auth_method = "none",
            grant_types = new[] { "authorization_code" },
            response_types = new[] { "code" }
        }, statusCode: 201);
    }

    /// <summary>
    /// Wer ist dieser Client? Ein selbst angemeldeter (Datenbank) oder ein CIMD-Dokument unter einer
    /// https-Adresse eines bekannten Anbieters (<c>Api:OAuthClientHosts</c>; ChatGPT, Claude).
    /// </summary>
    private static async Task<(string Name, string[] Redirects)?> ClientAsync(Db db, IConfiguration config, string clientId, CancellationToken ct)
    {
        if (clientId.StartsWith("https://", StringComparison.Ordinal))
        {
            if (!Uri.TryCreate(clientId, UriKind.Absolute, out var url) || !TrustedHost(config, url.Host)) return null;
            if (Documents.TryGetValue(clientId, out var cached) && DateTime.UtcNow - cached.At < TimeSpan.FromMinutes(10)) return cached.Client;
            (string, string[])? found = null;
            try
            {
                using var response = await Http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
                if (response.IsSuccessStatusCode && response.Content.Headers.ContentLength is null or < 65536)
                {
                    using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                    var root = doc.RootElement;
                    if (root.TryGetProperty("client_id", out var id) && id.GetString() == clientId
                        && root.TryGetProperty("redirect_uris", out var r) && r.ValueKind == JsonValueKind.Array)
                    {
                        var redirects = r.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).Where(IsRedirect).ToArray();
                        var name = root.TryGetProperty("client_name", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString()! : url.Host;
                        if (redirects.Length > 0) found = (name.Length > 200 ? name[..200] : name, redirects);
                    }
                }
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException) { found = null; }
            Documents[clientId] = (DateTime.UtcNow, found);
            return found;
        }

        await using var connection = await db.OpenAsync(ct);
        await using var cmd = new SqlCommand("SELECT name, redirect_uris FROM app.ai_oauth_client WHERE client_id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", clientId.Length > 64 ? "" : clientId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return (reader.GetString(0), JsonSerializer.Deserialize<string[]>(reader.GetString(1)) ?? []);
    }

    public static bool TrustedHost(IConfiguration config, string host)
    {
        var hosts = (config["Api:OAuthClientHosts"] ?? "chatgpt.com,openai.com,claude.ai,anthropic.com")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return hosts.Any(h => host.Equals(h, StringComparison.OrdinalIgnoreCase) || host.EndsWith("." + h, StringComparison.OrdinalIgnoreCase));
    }

    /* -- Anmelden ---------------------------------------------------------------------------------- */

    private static readonly Regex Challenge = new("^[A-Za-z0-9._~-]{43,128}$", RegexOptions.CultureInvariant);

    /// <summary>Die Antwort an den Rücksprung — immer mit <c>iss</c> (RFC 9207).</summary>
    public static string Back(string redirect, string issuer, IEnumerable<(string Key, string? Value)> values)
    {
        var query = string.Join('&', values.Where(v => v.Value is not null).Append((Key: "iss", Value: (string?)issuer)).Select(v => $"{v.Key}={Uri.EscapeDataString(v.Value!)}"));
        return redirect + (redirect.Contains('?') ? "&" : "?") + query;
    }

    private static IResult Page(int status, string text) =>
        Results.Content($"<!doctype html><meta charset=\"utf-8\"><title>Recreatio</title><p style=\"font:16px system-ui;max-width:40rem;margin:3rem auto\">{System.Net.WebUtility.HtmlEncode(text)}</p>", "text/html; charset=utf-8", statusCode: status);

    /// <summary>
    /// DER ANFANG — der Assistent schickt den Menschen hierher. Erst Client und Rücksprung (sonst
    /// kein Rücksprung, nur eine Seite), dann alles Übrige (Fehler an den Rücksprung); danach weiter
    /// in die App, wo er sich anmeldet und Links wählt.
    /// </summary>
    private static async Task<IResult> AuthorizeAsync(HttpContext ctx, Db db, IConfiguration config)
    {
        var q = ctx.Request.Query;
        var clientId = q["client_id"].ToString();
        var redirect = q["redirect_uri"].ToString();
        var issuer = Issuer(ctx.Request);
        if (clientId.Length is 0 or > 512) return Page(400, "Brak client_id.");
        var client = await ClientAsync(db, config, clientId, ctx.RequestAborted);
        if (client is null) return Page(400, "Nieznany klient OAuth.");
        if (redirect.Length == 0 && client.Value.Redirects.Length == 1) redirect = client.Value.Redirects[0];
        if (!client.Value.Redirects.Contains(redirect, StringComparer.Ordinal)) return Page(400, "Ten adres powrotu nie należy do tego klienta.");

        var state = q["state"].ToString();
        IResult Fail(string error, string description) =>
            Results.Redirect(Back(redirect, issuer, [("error", error), ("error_description", description), ("state", state.Length == 0 ? null : state)]));

        if (q["response_type"] != "code") return Fail("unsupported_response_type", "Tylko response_type=code.");
        if (q["code_challenge_method"] != "S256" || !Challenge.IsMatch(q["code_challenge"].ToString())) return Fail("invalid_request", "Wymagane PKCE z code_challenge_method=S256.");
        var resource = q["resource"].ToString();
        if (resource.Length > 0 && resource.TrimEnd('/') != Resource(ctx.Request) && resource.TrimEnd('/') != issuer)
            return Fail("invalid_target", "Ten serwer wydaje dostęp tylko do " + Resource(ctx.Request));
        var scope = q["scope"].ToString();
        if (state.Length > 1000) return Fail("invalid_request", "state jest za długi.");

        var id = Ids.NewId(DateTimeOffset.UtcNow);
        var now = DateTimeOffset.UtcNow;
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using (var tidy = new SqlCommand("DELETE FROM app.ai_oauth_grant WHERE expires_at < SYSDATETIMEOFFSET();", connection))
            await tidy.ExecuteNonQueryAsync(ctx.RequestAborted);
        await using (var cmd = new SqlCommand("""
            INSERT INTO app.ai_oauth_grant (id, client_id, client_name, issuer, redirect_uri, code_challenge, state, resource, scope, created_at, expires_at)
            VALUES (@id, @client, @name, @issuer, @redirect, @challenge, @state, @resource, @scope, @now, @expires);
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@client", clientId);
            cmd.Parameters.AddWithValue("@name", client.Value.Name);
            /* Der Aussteller, unter dem der Assistent ankam — die Zustimmung kommt vielleicht über einen anderen Weg (die App). */
            cmd.Parameters.AddWithValue("@issuer", issuer);
            cmd.Parameters.AddWithValue("@redirect", redirect);
            cmd.Parameters.AddWithValue("@challenge", q["code_challenge"].ToString());
            cmd.Parameters.AddWithValue("@state", state.Length == 0 ? DBNull.Value : state);
            cmd.Parameters.AddWithValue("@resource", resource.Length == 0 ? DBNull.Value : resource);
            cmd.Parameters.AddWithValue("@scope", scope.Length == 0 ? DBNull.Value : scope[..Math.Min(scope.Length, 200)]);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@expires", now + RequestLife);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        return Results.Redirect($"{AiMcpTools.AppOrigin(config)}/#/polacz-ai/{Ids.ToText(id)}");
    }

    private sealed record Grant(Guid Id, string ClientId, string ClientName, string Issuer, string Redirect, string Challenge, string? State, string? Resource, string? Scope, DateTimeOffset Expires, bool Approved, byte[]? Sealed);

    private static async Task<Grant?> GrantAsync(SqlConnection connection, string where, Action<SqlParameterCollection> bind, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"""
            SELECT id, client_id, client_name, issuer, redirect_uri, code_challenge, state, resource, scope, expires_at, approved_at, secrets_sealed
            FROM app.ai_oauth_grant WHERE {where} AND expires_at > SYSDATETIMEOFFSET();
            """, connection);
        bind(cmd.Parameters);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new Grant(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.GetDateTimeOffset(9), !reader.IsDBNull(10), reader.IsDBNull(11) ? null : (byte[])reader[11]);
    }

    /// <summary>Für die Seite der App: wer fragt, wohin es zurückgeht, wie lange noch.</summary>
    private static async Task<IResult> RequestAsync(HttpContext ctx, Db db, Guid id)
    {
        if (await Auth.WhoAsync(ctx, db) is null) return Results.StatusCode(401);
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var grant = await GrantAsync(connection, "id = @id AND approved_at IS NULL", p => p.AddWithValue("@id", id), ctx.RequestAborted);
        if (grant is null) return Results.Json(new { error = "Ta prośba o połączenie wygasła albo została już obsłużona — zacznij od nowa w aplikacji asystenta." }, statusCode: 404);
        return Results.Json(new
        {
            id = Ids.ToText(grant.Id),
            client = grant.ClientName,
            clientId = grant.ClientId.StartsWith("https://", StringComparison.Ordinal) ? grant.ClientId : null,
            redirectHost = new Uri(grant.Redirect).Host,
            scope = grant.Scope,
            expiresAt = grant.Expires
        });
    }

    public sealed record ApproveRequest(string? Grant, string[]? Secrets);

    /// <summary>
    /// ZUSTIMMEN — die Links, die der Mensch wählte (ihre Geheimnisse hat sein Browser geöffnet). Jeder
    /// muss gelten und in einem Bereich liegen, den er prowadzi. Dann ein Code; die Geheimnisse liegen
    /// bis zum Einlösen unter einem Schlüssel aus diesem Code.
    /// </summary>
    private static async Task<IResult> ApproveAsync(HttpContext ctx, Db db, ApproveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) return Results.StatusCode(401);
        if (!Guid.TryParse(body.Grant, out var id)) return Results.Json(new { error = "Nieczytelna prośba." }, statusCode: 400);
        var secrets = (body.Secrets ?? []).Select(AiAccess.TokenOf).OfType<string>().Distinct().ToList();
        if (secrets.Count is 0 or > MaxLinks) return Results.Json(new { error = $"Wybierz od 1 do {MaxLinks} linków." }, statusCode: 400);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var grant = await GrantAsync(connection, "id = @id AND approved_at IS NULL", p => p.AddWithValue("@id", id), ctx.RequestAborted);
        if (grant is null) return Results.Json(new { error = "Ta prośba o połączenie wygasła — zacznij od nowa w aplikacji asystenta." }, statusCode: 404);

        foreach (var secret in secrets)
        {
            await using var cmd = new SqlCommand("""
                SELECT area_id FROM app.ai_access WHERE token_sha256 = @hash AND key_wrapped IS NOT NULL AND expires_at > SYSDATETIMEOFFSET();
                """, connection);
            cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
            var area = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
            if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value, Capability.Admin, ctx.RequestAborted)
                || !await AiAccess.LinkWorksAsync(db, secret, ctx.RequestAborted))
                return Results.Json(new { error = "Jeden z wybranych linków nie działa albo nie prowadzisz jego obszaru." }, statusCode: 403);
        }

        var code = Token.NewSecret();
        var key = Crypto.Derive(Encoding.UTF8.GetBytes(code), Crypto.InfoAiOAuthCode(id), Crypto.KeySize);
        byte[] sealedSecrets;
        try { sealedSecrets = Crypto.Seal(key, CodeAad(id), JsonSerializer.Serialize(secrets)); }
        finally { CryptographicOperations.ZeroMemory(key); }

        await using (var update = new SqlCommand("""
            UPDATE app.ai_oauth_grant
               SET account_id = @account, approved_at = SYSDATETIMEOFFSET(), code_sha256 = @code, secrets_sealed = @sealed, links = @links, expires_at = @expires
             WHERE id = @id AND approved_at IS NULL;
            """, connection))
        {
            update.Parameters.AddWithValue("@id", id);
            update.Parameters.AddWithValue("@account", who.Value.AccountId);
            update.Parameters.Add("@code", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(code);
            update.Parameters.Add("@sealed", System.Data.SqlDbType.VarBinary, 4000).Value = sealedSecrets;
            update.Parameters.AddWithValue("@links", secrets.Count);
            update.Parameters.AddWithValue("@expires", DateTimeOffset.UtcNow + CodeLife);
            if (await update.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
                return Results.Json(new { error = "Ta prośba została już obsłużona." }, statusCode: 409);
        }
        return Results.Json(new { redirect = Back(grant.Redirect, grant.Issuer, [("code", code), ("state", grant.State)]) });
    }

    public sealed record DenyRequest(string? Grant);

    private static async Task<IResult> DenyAsync(HttpContext ctx, Db db, DenyRequest body)
    {
        if (await Auth.WhoAsync(ctx, db) is null) return Results.StatusCode(401);
        if (!Guid.TryParse(body.Grant, out var id)) return Results.Json(new { error = "Nieczytelna prośba." }, statusCode: 400);
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var grant = await GrantAsync(connection, "id = @id AND approved_at IS NULL", p => p.AddWithValue("@id", id), ctx.RequestAborted);
        if (grant is null) return Results.Json(new { error = "Ta prośba już nie czeka." }, statusCode: 404);
        await using (var drop = new SqlCommand("DELETE FROM app.ai_oauth_grant WHERE id = @id;", connection))
        {
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        return Results.Json(new { redirect = Back(grant.Redirect, grant.Issuer, [("error", "access_denied"), ("error_description", "Odmówiono dostępu."), ("state", grant.State)]) });
    }

    public static Aad CodeAad(Guid grantId) => Aad.Create("ai", "oauth", grantId, Field.AiOAuthCode, 1);

    /// <summary>PKCE S256: base64url(SHA-256(ASCII(verifier))) muss der Challenge gleichen (in fester Zeit).</summary>
    public static bool PkceMatches(string verifier, string challenge) =>
        verifier.Length is >= 43 and <= 128
        && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Base64Url.Encode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)))), Encoding.ASCII.GetBytes(challenge));

    /* -- Der Code wird zum Token --------------------------------------------------------------------- */

    private static IResult TokenError(string error, string description) =>
        Results.Json(new { error, error_description = description }, statusCode: 400);

    /// <summary>
    /// CODE GEGEN TOKEN — einmal: Client, Rücksprung, PKCE und (wenn genannt) resource müssen passen.
    /// Das Token sind die freigegebenen Links; es gilt, solange der kürzeste von ihnen gilt.
    /// </summary>
    private static async Task<IResult> TokenAsync(HttpContext ctx, Db db)
    {
        ctx.Response.Headers.CacheControl = "no-store";
        if (!ctx.Request.HasFormContentType) return TokenError("invalid_request", "Oczekiwano application/x-www-form-urlencoded.");
        var form = await ctx.Request.ReadFormAsync(ctx.RequestAborted);
        if (form["grant_type"] != "authorization_code") return TokenError("unsupported_grant_type", "Tylko authorization_code.");
        var code = form["code"].ToString();
        if (AiAccess.TokenOf(code) is null) return TokenError("invalid_grant", "Nieczytelny kod.");

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var grant = await GrantAsync(connection, "code_sha256 = @code", p => p.Add("@code", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(code), ctx.RequestAborted);
        if (grant is null || !grant.Approved || grant.Sealed is null) return TokenError("invalid_grant", "Kod nie istnieje, wygasł albo został już użyty.");

        /* Einmal: weg, bevor geprüft wird — ein zweiter Versuch mit demselben Code findet nichts. */
        await using (var drop = new SqlCommand("DELETE FROM app.ai_oauth_grant WHERE id = @id;", connection))
        {
            drop.Parameters.AddWithValue("@id", grant.Id);
            if (await drop.ExecuteNonQueryAsync(ctx.RequestAborted) == 0) return TokenError("invalid_grant", "Kod został już użyty.");
        }

        if (form["client_id"].ToString() is { Length: > 0 } client && client != grant.ClientId) return TokenError("invalid_grant", "Kod należy do innego klienta.");
        if (form["redirect_uri"].ToString() is { Length: > 0 } back && back != grant.Redirect) return TokenError("invalid_grant", "Inny adres powrotu niż przy autoryzacji.");
        if (!PkceMatches(form["code_verifier"].ToString(), grant.Challenge)) return TokenError("invalid_grant", "code_verifier nie pasuje (PKCE).");
        var resource = form["resource"].ToString().TrimEnd('/');
        if (resource.Length > 0 && resource != Resource(ctx.Request) && resource != Issuer(ctx.Request)) return TokenError("invalid_target", "Inny serwer niż ten.");

        List<string> secrets;
        var key = Crypto.Derive(Encoding.UTF8.GetBytes(code), Crypto.InfoAiOAuthCode(grant.Id), Crypto.KeySize);
        try { secrets = JsonSerializer.Deserialize<List<string>>(Crypto.OpenText(key, CodeAad(grant.Id), grant.Sealed)) ?? []; }
        catch (DecryptException) { return TokenError("invalid_grant", "Kod nie pasuje."); }
        finally { CryptographicOperations.ZeroMemory(key); }

        /* Wie lange: bis der erste der Links abläuft. */
        var expires = DateTimeOffset.MaxValue;
        foreach (var secret in secrets)
        {
            await using var cmd = new SqlCommand("SELECT expires_at FROM app.ai_access WHERE token_sha256 = @hash;", connection);
            cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is DateTimeOffset at && at < expires) expires = at;
        }
        if (expires == DateTimeOffset.MaxValue) return TokenError("invalid_grant", "Udostępnione linki już nie istnieją.");
        var lifetime = (long)Math.Max(60, (expires - DateTimeOffset.UtcNow).TotalSeconds);
        return Results.Json(new
        {
            access_token = string.Join('.', secrets),
            token_type = "Bearer",
            expires_in = lifetime,
            scope = grant.Scope ?? AiMcp.Scope
        });
    }
}
