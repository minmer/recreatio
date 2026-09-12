using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Anmelden.
///
/// <code>
///   Browser                                Dienst
///   Passwort
///     │ Argon2id(password_salt)
///     ▼
///   PasswordKey ───────────────────────►  Argon2id(login_salt)
///     │                                     │
///     └── bleibt im Browser                 └── Vergleich, Sitzung, Keks
/// </code>
///
/// <para>
/// Das Passwort verlässt den Browser nie — auch nicht gehasht. Der Dienst kann
/// es nicht kennen und deshalb nicht verlieren. Gerechnet wird im Kernel
/// (<see cref="Password"/>, <see cref="AccountSecrets"/>, <see cref="Token"/>).
/// </para>
/// </summary>
public static class Auth
{
    /// <summary>
    /// Lang genug, dass niemand mitten in der Arbeit hinausfliegt; kurz genug,
    /// dass ein vergessener Rechner im Pfarrbüro nicht wochenlang offensteht.
    /// </summary>
    private static readonly TimeSpan SessionLife = TimeSpan.FromDays(14);

    public const string Cookie = "session";

    public static void Map(WebApplication app)
    {
        app.MapPost("/auth/register", RegisterAsync);
        app.MapGet("/auth/salt", SaltAsync);
        app.MapPost("/auth/login", LoginAsync);
        app.MapPost("/auth/logout", LogoutAsync);
        app.MapGet("/session", SessionAsync);
    }

    public sealed record RegisterRequest(string LoginId, string PasswordSaltBase64Url, string PasswordKeyBase64Url);
    public sealed record LoginRequest(string LoginId, string PasswordKeyBase64Url);

    /// <summary>
    /// Das Salz geht offen heraus: der Browser braucht es, bevor jemand
    /// angemeldet ist. Es ist kein Geheimnis, sondern das, was zwei gleiche
    /// Passwörter verschieden rechnen lässt.
    ///
    /// <para>
    /// Ein unbekannter Name bekommt ein festes, aus dem Namen abgeleitetes —
    /// sonst wäre diese Adresse eine Liste aller vorhandenen Konten.
    /// </para>
    /// </summary>
    private static async Task SaltAsync(HttpContext ctx, Db db, string loginId)
    {
        var name = Normalise(loginId);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand(
            "SELECT password_salt FROM app.account WHERE login_id = @n;", connection);
        cmd.Parameters.AddWithValue("@n", name);

        var found = await cmd.ExecuteScalarAsync(ctx.RequestAborted);
        var salt = found is byte[] real ? real : DecoySalt(name);

        await ctx.Response.WriteAsJsonAsync(new { passwordSaltBase64Url = Base64Url.Encode(salt) });
    }

    /// <summary>
    /// Aus dem Namen abgeleitet und nicht zufällig: zufällig wäre es bei jedem
    /// Aufruf ein anderes, und genau daran liesse sich ablesen, dass kein Konto
    /// dahintersteht.
    /// </summary>
    private static byte[] DecoySalt(string name) =>
        SHA256.HashData(Encoding.UTF8.GetBytes("api:decoy-salt:" + name))
              .AsSpan(0, Password.SaltBytes).ToArray();

    private static async Task RegisterAsync(HttpContext ctx, Db db, RegisterRequest body)
    {
        var name = Normalise(body.LoginId);

        if (name.Length is < 3 or > 64)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nazwa konta: od 3 do 64 znaków.");
            return;
        }

        /*
         * Das Salz kommt vom Browser, weil er damit gerechnet hat. Ein hier
         * gewürfeltes wäre ein anderes — die nächste Anmeldung rechnete mit dem
         * gespeicherten und scheiterte, immer.
         */
        if (!TryDecode(body.PasswordSaltBase64Url, Password.SaltBytes, out var passwordSalt))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna sól hasła.");
            return;
        }

        if (!TryDecode(body.PasswordKeyBase64Url, Password.OutputBytes, out var passwordKey))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz hasła.");
            return;
        }

        try
        {
            var accountId = Ids.NewId();

            // Zufällig, nicht abgeleitet: beim Passwortwechsel wird dadurch
            // genau eine Hülle neu versiegelt statt alles darunter.
            var masterKey = Crypto.NewSymmetricKey();
            try
            {
                var secrets = AccountSecrets.Create(accountId, passwordKey, masterKey, passwordSalt);

                /*
                 * DIE PERSÖNLICHE ROLLE ENTSTEHT HIER — und nur hier.
                 *
                 * Ihr Schlüssel wird aus dem Hauptschlüssel abgeleitet, und den
                 * hält der Dienst genau in diesem Augenblick. Danach liegt er
                 * versiegelt unter dem PasswordKey und ist für ihn fort:
                 * nachgeholt wäre die Rolle eine Zeile, die niemand mehr öffnen
                 * kann.
                 *
                 * Gerechnet wird VOR der Transaktion. Zwei RSA-4096-Paare
                 * dauern Sekunden; in der Transaktion wären das Sekunden mit
                 * gehaltenen Sperren.
                 */
                var (personRoleId, person) = MakePersonRole(masterKey);

                var now = DateTimeOffset.UtcNow;

                await using var connection = await db.OpenAsync(ctx.RequestAborted);

                /*
                 * Konto und Rolle entstehen zusammen oder gar nicht. Ein Konto
                 * ohne Rolle wäre ein Mensch, der sich anmelden kann und nichts
                 * halten kann — und niemandem fiele es auf, bis er das erste
                 * Mal etwas übernehmen will.
                 */
                await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

                await using (var insert = new SqlCommand("""
                    INSERT INTO app.account
                        (id, login_id, password_salt, login_salt, login_verifier,
                         master_key_sealed, created_at)
                    VALUES (@id, @name, @psalt, @lsalt, @verifier, @master, @now);
                    """, connection, tx))
                {
                    insert.Parameters.AddWithValue("@id", accountId);
                    insert.Parameters.AddWithValue("@name", name);
                    insert.Parameters.AddWithValue("@psalt", secrets.PasswordSalt);
                    insert.Parameters.AddWithValue("@lsalt", secrets.LoginSalt);
                    insert.Parameters.AddWithValue("@verifier", secrets.LoginVerifier);
                    insert.Parameters.AddWithValue("@master", secrets.MasterKeySealed);
                    insert.Parameters.AddWithValue("@now", now);

                    try
                    {
                        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
                    }
                    catch (SqlException e) when (e.Number is 2601 or 2627)
                    {
                        await tx.RollbackAsync(ctx.RequestAborted);

                        // Beim Anlegen ist die Auskunft unvermeidlich; beim
                        // Anmelden wird sie nicht gegeben.
                        await Fail(ctx, StatusCodes.Status409Conflict, "Ta nazwa konta jest już zajęta.");
                        return;
                    }
                }

                await InsertPersonRoleAsync(
                    connection, tx, accountId, personRoleId, person, now, ctx.RequestAborted);

                await StartSessionAsync(ctx, connection, accountId, tx);
                await tx.CommitAsync(ctx.RequestAborted);

                await ctx.Response.WriteAsJsonAsync(new { accountId = Ids.ToText(accountId), loginId = name });
            }
            finally
            {
                CryptographicOperations.ZeroMemory(masterKey);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(passwordKey);
        }
    }

    private static async Task LoginAsync(HttpContext ctx, Db db, LoginRequest body)
    {
        var name = Normalise(body.LoginId);

        if (!TryDecode(body.PasswordKeyBase64Url, Password.OutputBytes, out var passwordKey))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz hasła.");
            return;
        }

        try
        {
            await using var connection = await db.OpenAsync(ctx.RequestAborted);
            await using var cmd = new SqlCommand("""
                SELECT id, password_salt, login_salt, login_verifier, master_key_sealed,
                       person_role_id, disabled_at
                FROM app.account WHERE login_id = @n;
                """, connection);
            cmd.Parameters.AddWithValue("@n", name);

            var accountId = Guid.Empty;
            byte[]? passwordSalt = null, loginSalt = null, verifier = null, masterSealed = null;
            Guid? personRoleId = null;
            var disabled = false;

            await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
            {
                if (await reader.ReadAsync(ctx.RequestAborted))
                {
                    accountId = reader.GetGuid(0);
                    passwordSalt = (byte[])reader[1];
                    loginSalt = (byte[])reader[2];
                    verifier = (byte[])reader[3];
                    masterSealed = (byte[])reader[4];
                    personRoleId = reader.IsDBNull(5) ? null : reader.GetGuid(5);
                    disabled = !reader.IsDBNull(6);
                }
            }

            /*
             * Eine Antwort für „kein Konto" und „falsches Passwort" — zwei
             * unterscheidbare wären eine Auskunft darüber, welche Namen
             * vergeben sind.
             *
             * Auch der Aufwand bleibt gleich: bei unbekanntem Namen wird gegen
             * einen Scheinwert gerechnet. Sonst verriete die Antwortzeit, was
             * die Antwort verschweigt.
             */
            var ok = loginSalt is not null && verifier is not null
                ? Password.VerifyLogin(passwordKey, loginSalt, verifier)
                : Decoy(passwordKey, name);

            if (!ok || disabled)
            {
                await Fail(ctx, StatusCodes.Status401Unauthorized, "Nazwa konta albo hasło się nie zgadza.");
                return;
            }

            /*
             * EIN KONTO OHNE PERSÖNLICHE ROLLE ist ein Konto, das sich anmelden
             * und sonst nichts kann: keine Adresse übernehmen, nichts halten.
             * Solche gibt es aus der Zeit vor 0006.
             *
             * Hier ist die einzige Stelle, an der sie zu heilen sind — nur bei
             * der Anmeldung hat der Dienst den PasswordKey und kommt damit an
             * den Hauptschlüssel, aus dem der Rollenschlüssel abgeleitet wird.
             * Das geschieht genau einmal je Konto und dauert so lange wie das
             * Anlegen.
             */
            if (personRoleId is null
                && passwordSalt is not null && loginSalt is not null
                && verifier is not null && masterSealed is not null)
            {
                var secrets = new AccountSecrets
                {
                    PasswordSalt = passwordSalt,
                    LoginSalt = loginSalt,
                    LoginVerifier = verifier,
                    MasterKeySealed = masterSealed
                };

                var masterKey = secrets.UnsealMasterKey(accountId, passwordKey);
                try
                {
                    var (roleId, keys) = MakePersonRole(masterKey);
                    await InsertPersonRoleAsync(
                        connection, null, accountId, roleId, keys, DateTimeOffset.UtcNow, ctx.RequestAborted);
                }
                finally
                {
                    CryptographicOperations.ZeroMemory(masterKey);
                }
            }

            await StartSessionAsync(ctx, connection, accountId);
            await ctx.Response.WriteAsJsonAsync(new { accountId = Ids.ToText(accountId), loginId = name });
        }
        finally
        {
            CryptographicOperations.ZeroMemory(passwordKey);
        }
    }

    /// <summary>
    /// Die persönliche Rolle — gerechnet, noch nichts geschrieben.
    ///
    /// <para>
    /// Getrennt vom Schreiben, weil zwei RSA-4096-Paare Sekunden dauern; auf
    /// dem Mietserver sind es fünfzehn. In einer offenen Transaktion wären das
    /// fünfzehn Sekunden mit gehaltenen Sperren.
    /// </para>
    /// </summary>
    private static (Guid Id, RoleIdentity Keys) MakePersonRole(byte[] masterKey)
    {
        var roleId = Ids.NewId();
        var roleKey = RoleKeys.PersonalRoleKey(masterKey, roleId);

        try { return (roleId, RoleKeys.Create(roleId, roleKey)); }
        finally { CryptographicOperations.ZeroMemory(roleKey); }
    }

    /// <summary>Rolle eintragen und das Konto darauf zeigen lassen — beides oder keines.</summary>
    private static async Task InsertPersonRoleAsync(
        SqlConnection connection, SqlTransaction? tx, Guid accountId, Guid roleId,
        RoleIdentity keys, DateTimeOffset now, CancellationToken ct)
    {
        await using var insert = new SqlCommand("""
            INSERT INTO app.role
                (id, kind, wrap_public_key, sign_public_key,
                 wrap_private_sealed, sign_private_sealed, created_at)
            VALUES (@role, N'person', @wrap, @sign, @wrapSealed, @signSealed, @now);

            UPDATE app.account SET person_role_id = @role WHERE id = @account;
            """, connection, tx);

        insert.Parameters.AddWithValue("@role", roleId);
        insert.Parameters.AddWithValue("@wrap", keys.WrapPublicKey);
        insert.Parameters.AddWithValue("@sign", keys.SignPublicKey);
        insert.Parameters.AddWithValue("@wrapSealed", keys.WrapPrivateSealed);
        insert.Parameters.AddWithValue("@signSealed", keys.SignPrivateSealed);
        insert.Parameters.AddWithValue("@now", now);
        insert.Parameters.AddWithValue("@account", accountId);

        await insert.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Derselbe Rechenaufwand für einen Namen, den es nicht gibt. Immer <c>false</c>.</summary>
    private static bool Decoy(byte[] passwordKey, string name)
    {
        var made = Password.DeriveLoginVerifier(passwordKey, DecoySalt(name));
        return CryptographicOperations.FixedTimeEquals(made, new byte[made.Length]);
    }

    /// <summary>
    /// Das Geheimnis entsteht im Kernel und wird nur gehasht gespeichert — der
    /// Klartext existiert im Keks des Browsers und sonst nirgends.
    /// </summary>
    private static async Task StartSessionAsync(
        HttpContext ctx, SqlConnection connection, Guid accountId, SqlTransaction? tx = null)
    {
        var secret = Token.NewSecret();
        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO app.session (id, account_id, token_sha256, created_at, expires_at)
            VALUES (@id, @account, @hash, @now, @until);
            """, connection, tx);

        insert.Parameters.AddWithValue("@id", Ids.NewId(now));
        insert.Parameters.AddWithValue("@account", accountId);
        insert.Parameters.AddWithValue("@hash", Token.HashSecret(secret));
        insert.Parameters.AddWithValue("@now", now);
        insert.Parameters.AddWithValue("@until", now + SessionLife);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        ctx.Response.Cookies.Append(Cookie, secret, new CookieOptions
        {
            // Kein Zugriff aus JavaScript; `None`, weil Browser und Dienst auf
            // verschiedenen Herkünften liegen.
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = now + SessionLife,
            Path = "/"
        });
    }

    private static async Task SessionAsync(HttpContext ctx, Db db)
    {
        var who = await WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await ctx.Response.WriteAsJsonAsync(new
        {
            accountId = Ids.ToText(who.Value.AccountId),
            loginId = who.Value.LoginId
        });
    }

    private static async Task LogoutAsync(HttpContext ctx, Db db)
    {
        var secret = ctx.Request.Cookies[Cookie];

        if (!string.IsNullOrEmpty(secret))
        {
            await using var connection = await db.OpenAsync(ctx.RequestAborted);
            await using var cmd = new SqlCommand(
                "UPDATE app.session SET revoked_at = @now WHERE token_sha256 = @hash AND revoked_at IS NULL;",
                connection);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@hash", Token.HashSecret(secret));
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        ctx.Response.Cookies.Delete(Cookie, new CookieOptions
        {
            HttpOnly = true, Secure = true, SameSite = SameSiteMode.None, Path = "/"
        });

        await ctx.Response.WriteAsJsonAsync(new { ok = true });
    }

    /// <summary>Wer gerade angemeldet ist — oder <c>null</c>.</summary>
    public static async Task<(Guid AccountId, string LoginId)?> WhoAsync(HttpContext ctx, Db db)
    {
        var secret = ctx.Request.Cookies[Cookie];
        if (string.IsNullOrEmpty(secret)) return null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT a.id, a.login_id
            FROM app.session s
            JOIN app.account a ON a.id = s.account_id
            WHERE s.token_sha256 = @hash
              AND s.revoked_at IS NULL
              AND s.expires_at > @now
              AND a.disabled_at IS NULL;
            """, connection);

        cmd.Parameters.AddWithValue("@hash", Token.HashSecret(secret));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted)) return null;

        return (reader.GetGuid(0), reader.GetString(1));
    }

    /// <summary>Gross und klein sind derselbe Name — sonst legt jemand versehentlich ein zweites Konto an.</summary>
    private static string Normalise(string? loginId) =>
        (loginId ?? string.Empty).Trim().ToLowerInvariant();

    private static bool TryDecode(string? encoded, int length, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrWhiteSpace(encoded)) return false;

        try
        {
            var decoded = Base64Url.Decode(encoded);
            if (decoded.Length != length) return false;

            bytes = decoded;
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
