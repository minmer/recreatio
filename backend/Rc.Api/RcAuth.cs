using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 3.9 und 21.8 — Anlegen, Entsperren, Sperren, Abmelden.
///
/// <b>Der Ablauf in einem Bild</b>
/// <code>
///   /rc/auth/salt     → Salz (echt oder Schein) — der Browser braucht es zum Rechnen
///   /rc/auth/register → erstes Konto anlegen; danach nur ueber Einladung
///   /rc/auth/unlock   → PasswordKey pruefen, MasterKey oeffnen, Bund versiegeln, Cookie
///   /rc/auth/lock     → Bund vergessen; die Sitzung bleibt gueltig
///   /rc/auth/logout   → Sitzung widerrufen; Bund vergessen; Cookie loeschen
/// </code>
///
/// <b>Was hier NICHT passiert.</b> Das Passwort erreicht den Server nie. Was
/// ankommt, ist der PasswordKey — das Ergebnis eines Argon2id-Laufs im Browser.
/// Der Server rechnet daraus den Anmeldenachweis (zweites Salz, zweiter Lauf)
/// und benutzt denselben PasswordKey, um den MasterKey zu oeffnen.
///
/// Das ist BEFUND 35: 21.8 laesst beide Laeufe aus dem Passwort entstehen und
/// zwingt sie damit beide in den Browser. Hier zahlt das Telefon einen Lauf und
/// ein Angreifer mit der Datenbank zwei — die Kosten sind vertauscht, und zwar
/// zugunsten der richtigen Seite. Als Abweichung gemeldet.
/// </summary>
public static class RcAuth
{
    /// <summary>
    /// Eigenes Anmeldeverfahren neben dem des Altbestands (2.1). Der Neuaufbau
    /// erbt dessen Cookie NICHT: waere es dasselbe, wuerde eine Anmeldung dort
    /// hier gelten, und die Trennung waere nur noch ein Pfadpraefix.
    /// </summary>
    public const string Scheme = "rc.cookie";
    public const string CookieName = "rc.auth";

    public static void MapRcAuth(this IEndpointRouteBuilder app)
    {
        // KEINE Ausnahme vom Schutzwert — auch nicht fuer die Anmeldung. Der
        // Wert kommt aus /rc/csrf und braucht kein Konto; "noch nicht
        // angemeldet" ist deshalb kein Grund. Die Anmeldung ist im Gegenteil
        // gerade der Vorgang, den eine fremde Seite gern ausloesen wuerde.
        // 15.6 — Produces<T>() ist die einzige Stelle, an der die Antwortform
        // sichtbar wird: die Endpunkte schreiben ueber RcResults direkt in den
        // Antwortstrom und geben Task zurueck, also kann sie niemand ableiten.
        //
        // Das ist keine Doppelung, sondern eine Erklaerung — und weil sie
        // danebensteht, faellt beim Lesen auf, wenn Endpunkt und Zusage
        // auseinanderlaufen.
        app.MapPost("/rc/auth/salt", SaltAsync).Produces<RcSaltResponse>();
        app.MapPost("/rc/auth/register", RegisterAsync).Produces<RcRegisteredResponse>();
        app.MapPost("/rc/auth/unlock", UnlockAsync).Produces<RcSessionStartedResponse>();
        app.MapPost("/rc/auth/lock", LockAsync).Produces<RcLockedResponse>();
        app.MapPost("/rc/auth/logout", LogoutAsync).Produces<RcLoggedOutResponse>();
        app.MapGet("/rc/auth/me", MeAsync).Produces<RcMeResponse>();
        app.MapPost("/rc/auth/cache-mode", SetCacheModeAsync).Produces<RcCacheModeResponse>();
    }

    // -- 3.9 — Bequem oder sicher ---------------------------------------------

    public sealed record CacheModeRequest(int Mode);

    /// <summary>
    /// E-240 — Die Wahl gehoert dem Menschen, dessen Schluessel es ist.
    ///
    /// <c>0</c> bequem: der Bund liegt versiegelt im Serverspeicher.
    /// <c>1</c> sicher: im Speicher liegt nichts; jede Anfrage baut aus
    /// <c>master_key_sealed</c> neu auf.
    ///
    /// Die Umstellung auf „sicher" vergisst sofort, was schon liegt. Eine
    /// Einstellung, die erst nach dem naechsten Abmelden wirkt, waere
    /// schlimmer als keine — sie zeigte einen Zustand an, den es noch nicht
    /// gibt.
    /// </summary>
    private static async Task SetCacheModeAsync(HttpContext ctx, RcMasterKey keys, CacheModeRequest body)
    {
        var session = ctx.RcSession();
        if (session is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status401Unauthorized,
                RcErrorCodes.SessionExpired, "Dafuer musst du angemeldet sein.");
            return;
        }

        if (body.Mode is not (RcMasterKey.Comfortable or RcMasterKey.Secure))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Betriebsart gibt es nicht.");
            return;
        }

        var forgotten = await keys.SetCacheModeAsync(session.AccountId, body.Mode, ctx.RequestAborted);
        await RcResults.WriteJsonAsync(ctx, new RcCacheModeResponse(body.Mode, forgotten));
    }

    // -- Salz -----------------------------------------------------------------

    public sealed record SaltRequest(string Username);

    /// <summary>
    /// Antwortet IMMER mit einem Salz. Fuer ein bekanntes Konto mit dem echten,
    /// sonst mit einem abgeleiteten Scheinsalz (<see cref="RcServerSecret"/>).
    ///
    /// Ohne das waere dieser Endpunkt ein Verzeichnis aller Benutzernamen, und
    /// die einheitliche Fehlermeldung beim Entsperren waere wertlos.
    /// </summary>
    private static async Task SaltAsync(HttpContext ctx, RcDb db, RcServerSecret secret, SaltRequest body)
    {
        var username = Normalize(body.Username);
        if (username is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.AuthCredentialsInvalid, "Benutzername fehlt.");
            return;
        }

        var account = await LoadAccountAsync(db, username, ctx.RequestAborted);
        var salt = account?.PasswordSalt ?? secret.DecoySalt(username);

        await RcResults.WriteJsonAsync(ctx, new RcSaltResponse(
            RcBase64Url.Encode(salt), RcArgon2Parameters.Current));
    }

    // -- Anlegen --------------------------------------------------------------

    public sealed record RegisterRequest(string Username, string PasswordKey, string PasswordSalt, string? DisplayName);

    /// <summary>
    /// <b>Anmelden kann sich jeder.</b> Ein Konto ist kein Zutritt: es ist ein
    /// Ort, an dem Schluessel liegen. Wer sich anmeldet, bekommt seine
    /// persoenliche Rolle und seinen eigenen Geltungsbereich — und sonst
    /// nichts. In fremde Bereiche fuehrt ausschliesslich eine Einladung
    /// (<see cref="RcInvitations"/>), und die verbindet sich mit dem Konto,
    /// das dann schon besteht.
    ///
    /// Diese Trennung ist der Grund, warum offene Anmeldung hier ungefaehrlich
    /// ist: ein frisches Konto erreicht nichts, was ihm nicht jemand
    /// ausdruecklich gegeben hat.
    ///
    /// <b>Was offene Anmeldung dafuer kostet.</b> Ein Argon2id-Lauf und zwei
    /// RSA-4096-Paare, ohne dass jemand dafuer eingeladen sein muss. Ohne
    /// Ratensperre waere das der bequemste Weg, den Dienst umzuwerfen —
    /// deshalb zaehlt der Riegel hier genauso mit wie bei der Anmeldung.
    /// </summary>
    private static async Task RegisterAsync(
        HttpContext ctx, RcDb db, RcKeyVault vault, RcLoginGuard guard, RegisterRequest body)
    {
        var username = Normalize(body.Username);
        if (username is null || username.Length < 3)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.AuthCredentialsInvalid, "Benutzername muss mindestens drei Zeichen haben.");
            return;
        }

        if (!RcBase64Url.TryDecode(body.PasswordKey, out var passwordKey)
            || passwordKey.Length != RcPassword.OutputBytes)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.AuthPasswordWeak, "Der Passwortschluessel hat die falsche Laenge.");
            return;
        }

        if (!RcBase64Url.TryDecode(body.PasswordSalt, out var passwordSalt)
            || passwordSalt.Length != RcPassword.SaltBytes)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.AuthCredentialsInvalid, "Das Salz hat die falsche Laenge.");
            return;
        }

        // Anlegen ist teuer (Argon2id plus zwei RSA-4096-Paare) und steht
        // jedem offen. Ohne Zaehler je Absender waere genau das die
        // Angriffsflaeche. Der Benutzername zaehlt hier nicht mit: er ist bei
        // jedem Versuch ein anderer, sonst waere es kein Anlegen.
        var remoteAddress = ctx.Connection.RemoteIpAddress?.ToString();
        if (guard.IsBlocked($"a:{remoteAddress}", DateTimeOffset.UtcNow))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status429TooManyRequests,
                RcErrorCodes.AuthRateLimited, "Zu viele Versuche. Bitte spaeter erneut versuchen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var accountId = RcId.NewId();
        var masterKey = RcCrypto.NewSymmetricKey();
        RcAccountSecrets secrets;

        // Der Anmeldenachweis kostet einen Argon2id-Lauf — auch beim Anlegen
        // gilt der Speicherriegel.
        using (await guard.EnterAsync(ctx.RequestAborted))
        {
            secrets = RcAccountSecrets.Create(accountId, passwordKey, masterKey, passwordSalt);
        }

        // Konto UND Gruendung in EINER Transaktion. Ein Konto ohne persoenliche
        // Rolle koennte sich anmelden und sonst nichts — und niemand koennte ihm
        // nachtraeglich eine geben, weil dazu ein Zertifikat noetig waere, das
        // es nicht gibt. Ein halber Erfolg waere hier ein ganzer Schaden.
        RcFoundation foundation;
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted))
        {
            try
            {
                await using (var insert = new SqlCommand(
                    "INSERT INTO dbo.rc_account " +
                    "(id, username, login_verifier, login_salt, password_salt, master_key_sealed, created_at) " +
                    "VALUES (@id, @username, @verifier, @loginSalt, @passwordSalt, @sealed, @now);",
                    connection, tx))
                {
                    insert.Parameters.AddWithValue("@id", accountId);
                    insert.Parameters.AddWithValue("@username", username);
                    insert.Parameters.AddWithValue("@verifier", secrets.LoginVerifier);
                    insert.Parameters.AddWithValue("@loginSalt", secrets.LoginSalt);
                    insert.Parameters.AddWithValue("@passwordSalt", secrets.PasswordSalt);
                    insert.Parameters.AddWithValue("@sealed", secrets.MasterKeySealed);
                    insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                    await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                // Zwei RSA-4096-Paare — das dauert Sekunden (21.6) und laeuft
                // deshalb unter demselben Riegel wie Argon2id.
                using (await guard.EnterAsync(ctx.RequestAborted))
                {
                    foundation = await RcRoles.FoundAsync(
                        connection, tx, accountId, masterKey,
                        Truncate(body.DisplayName?.Trim(), 96) is { Length: > 0 } given ? given : username,
                        ctx.RequestAborted);
                }

                await tx.CommitAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                CryptographicOperations.ZeroMemory(masterKey);

                // Ein vergebener Name ist ein Fehlversuch wie jeder andere:
                // sonst waere das Anlegen ein bequemes Verzeichnis aller Namen.
                guard.RecordFailure(username, remoteAddress, DateTimeOffset.UtcNow);
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.AuthUsernameTaken, "Dieser Benutzername ist vergeben.");
                return;
            }
        }

        // Anlegen entsperrt sofort — sonst muesste der Browser denselben teuren
        // Lauf ein zweites Mal machen, nur um sich anzumelden.
        var session = await StartSessionAsync(ctx, connection, accountId, masterKey, passwordKey, vault, 0);
        CryptographicOperations.ZeroMemory(masterKey);

        await RcResults.WriteJsonAsync(ctx, new RcRegisteredResponse(
            session.AccountId, session.SessionId, session.ExpiresUtc, session.CacheMode, session.IdleMinutes,
            RcId.ToText(foundation.TenantId), RcId.ToText(foundation.PersonalRoleId)));
    }

    // -- Entsperren -----------------------------------------------------------

    public sealed record UnlockRequest(string Username, string PasswordKey, string? DeviceNote);

    private static async Task UnlockAsync(
        HttpContext ctx, RcDb db, RcKeyVault vault, RcLoginGuard guard, RcServerSecret secret, UnlockRequest body)
    {
        var now = DateTimeOffset.UtcNow;
        var username = Normalize(body.Username) ?? "";
        var remote = ctx.Connection.RemoteIpAddress?.ToString();

        if (guard.IsBlocked(username, remote, now))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status429TooManyRequests,
                RcErrorCodes.AuthRateLimited, "Zu viele Versuche. Bitte spaeter erneut versuchen.");
            return;
        }

        if (!RcBase64Url.TryDecode(body.PasswordKey, out var passwordKey)
            || passwordKey.Length != RcPassword.OutputBytes)
        {
            guard.RecordFailure(username, remote, now);
            await Deny(ctx);
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var account = await LoadAccountAsync(connection, username, ctx.RequestAborted);

        using (await guard.EnterAsync(ctx.RequestAborted))
        {
            if (account is null)
            {
                // Derselbe Aufwand wie bei einem echten Konto. Ohne diesen Lauf
                // waere ein unbekannter Name an der Antwortzeit zu erkennen —
                // und das Scheinsalz aus /rc/auth/salt umsonst.
                _ = RcPassword.DeriveLoginVerifier(passwordKey, secret.DecoySalt(username));
                guard.RecordFailure(username, remote, now);
                await Deny(ctx);
                return;
            }

            if (!RcPassword.VerifyLogin(passwordKey, account.LoginSalt, account.LoginVerifier))
            {
                guard.RecordFailure(username, remote, now);
                await Deny(ctx);
                return;
            }
        }

        // Erst NACH der Passwortpruefung. Andersherum verriete die Meldung
        // "Konto stillgelegt", dass der Name existiert, ohne das Passwort zu kennen.
        if (account.DisabledUtc is not null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.AuthAccountDisabled, "Dieses Konto ist stillgelegt.");
            return;
        }

        byte[] masterKey;
        try
        {
            masterKey = account.Secrets.UnsealMasterKey(account.Id, passwordKey);
        }
        catch (RcDecryptException)
        {
            // Der Nachweis stimmte, die Huelle nicht. Das ist kein falsches
            // Passwort, sondern ein Datenschaden — und muss unterscheidbar
            // bleiben, sonst sucht man den Fehler beim Nutzer.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status500InternalServerError,
                RcErrorCodes.CryptoMalformed, "Der Schluessel dieses Kontos laesst sich nicht oeffnen.");
            return;
        }

        guard.RecordSuccess(username);
        var session = await StartSessionAsync(
            ctx, connection, account.Id, masterKey, passwordKey, vault, account.CacheMode, body.DeviceNote);
        CryptographicOperations.ZeroMemory(masterKey);

        await RcResults.WriteJsonAsync(ctx, session);
    }

    /// <summary>Ein Code, eine Meldung — gleich, ob Name oder Passwort falsch war.</summary>
    private static Task Deny(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status401Unauthorized,
            RcErrorCodes.AuthCredentialsInvalid, "Benutzername oder Passwort stimmt nicht.");

    // -- Sperren und Abmelden -------------------------------------------------

    /// <summary>
    /// 3.9 — Sperren ist NICHT Abmelden. Der Bund verschwindet, die Sitzung
    /// bleibt. Wer sein Telefon weglegt, will nicht neu angemeldet werden, aber
    /// auch nicht, dass der Schluessel im Serverspeicher wartet.
    /// </summary>
    private static async Task LockAsync(HttpContext ctx, RcKeyVault vault)
    {
        var session = ctx.RcSession();
        if (session is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status401Unauthorized,
                RcErrorCodes.SessionExpired, "Keine Sitzung.");
            return;
        }

        var forgotten = vault.Forget(RcId.ToText(session.SessionId));
        await RcResults.WriteJsonAsync(ctx, new RcLockedResponse(true, forgotten));
    }

    private static async Task LogoutAsync(HttpContext ctx, RcDb db, RcKeyVault vault)
    {
        var session = ctx.RcSession();
        if (session is not null)
        {
            vault.Forget(RcId.ToText(session.SessionId));

            await using var connection = await db.OpenAsync(ctx.RequestAborted);
            await using var cmd = new SqlCommand(
                "UPDATE dbo.rc_session SET revoked_at = @now WHERE id = @id AND revoked_at IS NULL;", connection);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@id", session.SessionId);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.SignOutAsync(Scheme);
        await RcResults.WriteJsonAsync(ctx, new RcLoggedOutResponse(true));
    }

    private static async Task MeAsync(HttpContext ctx, RcKeyVault vault)
    {
        var session = ctx.RcSession();
        if (session is null)
        {
            await RcResults.WriteJsonAsync(ctx, new RcMeResponse(false));
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcMeResponse(
            true, RcId.ToText(session.AccountId), RcId.ToText(session.SessionId),
            vault.Holds(RcId.ToText(session.SessionId)), session.Username));
    }

    // -- Gemeinsames ----------------------------------------------------------


    private static async Task<RcSessionStartedResponse> StartSessionAsync(
        HttpContext ctx, SqlConnection connection, Guid accountId,
        byte[] masterKey, byte[] passwordKey, RcKeyVault vault, int cacheMode, string? deviceNote = null)
    {
        var sessionId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddDays(30);

        await using (var cmd = new SqlCommand(
            "INSERT INTO dbo.rc_session (id, account_id, created_at, last_activity_at, expires_at, device_note) " +
            "VALUES (@id, @account, @now, @now, @expires, @note);", connection))
        {
            cmd.Parameters.AddWithValue("@id", sessionId);
            cmd.Parameters.AddWithValue("@account", accountId);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@expires", expires);
            cmd.Parameters.AddWithValue("@note", (object?)Truncate(deviceNote, 128) ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        // 3.9 — Im bequemen Modus wird der Bund versiegelt abgelegt, im
        // sicheren gar nicht. Das if steht in RcMasterKey und nur dort; hier
        // waere es die zweite Stelle, an der jemand die Wahl des Nutzers
        // uebergehen koennte.
        //
        // Der Bund haelt vorerst nur den Wurzelschluessel. Rollenschluessel
        // entstehen daraus (21.6) oder liegen als Zuteilung bereit.
        using (var bundle = new RcKeyBundle(accountId, masterKey))
        {
            if (cacheMode != RcMasterKey.Secure)
                vault.Store(RcId.ToText(sessionId), passwordKey, bundle);
        }

        var identity = new ClaimsIdentity(
        [
            new Claim(RcSessionMiddleware.ClaimAccountId, RcId.ToText(accountId)),
            new Claim(RcSessionMiddleware.ClaimSessionId, RcId.ToText(sessionId))
        ], Scheme);

        await ctx.SignInAsync(Scheme, new ClaimsPrincipal(identity), new AuthenticationProperties
        {
            IsPersistent = true,
            ExpiresUtc = expires
        });

        return new RcSessionStartedResponse(RcId.ToText(accountId), RcId.ToText(sessionId), expires, cacheMode,
            (int)vault.IdleTimeout.TotalMinutes);
    }

    private sealed record AccountRow(
        Guid Id, byte[] PasswordSalt, byte[] LoginSalt, byte[] LoginVerifier,
        RcAccountSecrets Secrets, int CacheMode, DateTimeOffset? DisabledUtc);

    private static async Task<AccountRow?> LoadAccountAsync(RcDb db, string username, CancellationToken ct)
    {
        await using var connection = await db.OpenAsync(ct);
        return await LoadAccountAsync(connection, username, ct);
    }

    private static async Task<AccountRow?> LoadAccountAsync(SqlConnection connection, string username, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, password_salt, login_salt, login_verifier, master_key_sealed, cache_mode, disabled_at " +
            "FROM dbo.rc_account WHERE username = @username;", connection);
        cmd.Parameters.AddWithValue("@username", username);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        var passwordSalt = (byte[])reader[1];
        var loginSalt = (byte[])reader[2];
        var loginVerifier = (byte[])reader[3];

        return new AccountRow(
            reader.GetGuid(0), passwordSalt, loginSalt, loginVerifier,
            new RcAccountSecrets
            {
                PasswordSalt = passwordSalt,
                LoginSalt = loginSalt,
                LoginVerifier = loginVerifier,
                MasterKeySealed = (byte[])reader[4]
            },
            reader.GetByte(5),
            reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6));
    }

    private static string? Normalize(string? username)
    {
        var trimmed = username?.Trim();
        return string.IsNullOrEmpty(trimmed) || trimmed.Length > 64 ? null : trimmed;
    }

    private static string? Truncate(string? text, int max) =>
        text is null ? null : text.Length <= max ? text : text[..max];

    /// <summary>
    /// Das eigene Anmeldeverfahren. <c>SlidingExpiration</c> ist aus: die
    /// Lebensdauer steht in <c>rc_session</c>, und zwei Uhren, die dasselbe
    /// messen sollen, gehen irgendwann auseinander.
    /// </summary>
    public static void ConfigureRcCookie(CookieAuthenticationOptions options, RcCookiePolicy policy)
    {
        options.Cookie.Name = CookieName;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = policy.SameSite;
        options.Cookie.SecurePolicy = policy.SecurePolicy;
        options.SlidingExpiration = false;
        options.ExpireTimeSpan = TimeSpan.FromDays(30);

        // Kein Umleiten auf eine Anmeldeseite. Die API antwortet mit JSON nach
        // 15.7; eine 302 auf HTML waere fuer einen erzeugten Klienten (15.6)
        // nicht von Erfolg zu unterscheiden.
        options.Events.OnRedirectToLogin = c =>
        {
            c.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = c =>
        {
            c.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    }
}
