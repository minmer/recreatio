using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// PUSH (0075) — das Telefon sofort wecken.
///
/// <para>
/// <b>Das Signal sagt nichts.</b> Bei einer neuen Nachricht, Anmeldung oder
/// einem eingelösten Link geht über Firebase Cloud Messaging nur
/// <c>{"kind":"check"}</c> an die Geräte der Konten, die es betrifft. Das
/// Telefon holt dann selbst die Zahlen (<c>/notify/digest</c>, wie der
/// Arbeiter von 0067) und meldet, was über das Gesehene hinaus neu ist —
/// stumme Rozmowy, Ruhezeiten und die eigene Nachricht melden sich so von
/// selbst nicht. Google sieht ein Gerät und einen Zeitpunkt, keinen Bereich,
/// keinen Namen, keinen Text.
/// </para>
///
/// <para>
/// <b>Wen es betrifft</b>, wird rückwärts durch den Rollengraphen gefunden:
/// von den Rollen mit Zugang zum Bereich über die <c>holds</c>-Kanten hinauf
/// bis zu den Konten (<c>account.person_role_id</c>) — dieselbe Richtung, in
/// der <see cref="Workspace.RolesOfAsync"/> hinabsteigt, nur umgekehrt.
/// </para>
///
/// <para>
/// <b>Ohne Firebase</b> (keine Zugangsdaten in <c>Push:Fcm</c>) bleibt es beim
/// Fragen im Takt; hier wird dann nur protokolliert, wen es geweckt hätte.
/// Gesendet wird aus einer Warteschlange im Hintergrund: eine Nachricht wartet
/// nie auf Google.
/// </para>
/// </summary>
public sealed class Push(Db db, IConfiguration configuration, IHostEnvironment environment, ILogger<Push> logger) : BackgroundService
{
    public readonly record struct Wake(string Kind, Guid Id, Guid? ExceptAccount);

    private readonly Channel<Wake> queue = Channel.CreateBounded<Wake>(new BoundedChannelOptions(2000)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true
    });

    private readonly Fcm? fcm = Fcm.From(configuration, environment.ContentRootPath, logger);

    /// <summary>Schickt dieser Dienst überhaupt Push? (Für die Einstellungen der App.)</summary>
    public bool Available => fcm is not null;

    /// <summary>Eine neue Nachricht in dieser Rozmowa — alle, die mitlesen, ausser dem Konto, das schrieb.</summary>
    public void Chat(Guid chatId, Guid? author) => queue.Writer.TryWrite(new Wake("chat", chatId, author));

    /// <summary>Eine neue Anmeldung über dieses Formular — wer die Anmeldungen des Bereichs liest.</summary>
    public void Form(Guid moduleId) => queue.Writer.TryWrite(new Wake("form", moduleId, null));

    /// <summary>Jemand kam über diesen Link herein — wer ihn angelegt hat.</summary>
    public void Link(Guid invitationId, Guid? joiner) => queue.Writer.TryWrite(new Wake("link", invitationId, joiner));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var wake in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await WakeAsync(wake, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogWarning(e, "Push for {Kind} {Id} failed", wake.Kind, wake.Id);
            }
        }
    }

    private async Task WakeAsync(Wake wake, CancellationToken ct)
    {
        await using var connection = await db.OpenAsync(ct);

        /* Woher die Empfänger kommen: die Rollen mit Zugang zu einem Bereich — oder eine Rolle selbst. */
        string seed;
        switch (wake.Kind)
        {
            case "chat":
                seed = """
                    SELECT DISTINCT c.subject_role_id FROM app.certificate c
                    WHERE c.scope_kind = N'area' AND c.revoked_at IS NULL AND c.expires_at > @now
                      AND c.capability IN (N'read', N'write', N'admin')
                      AND c.scope_id = (SELECT area_id FROM app.chat WHERE id = @id)
                    """;
                break;
            case "form":
                seed = """
                    SELECT DISTINCT c.subject_role_id FROM app.certificate c
                    WHERE c.scope_kind = N'area' AND c.revoked_at IS NULL AND c.expires_at > @now
                      AND c.capability IN (N'read', N'write', N'admin')
                      AND c.scope_id = (SELECT area_id FROM app.module WHERE id = @id)
                    """;
                break;
            case "link":
                /* Nur Links mit Zugang — nur die zählt die Glocke (sonst weckte es für nichts). */
                seed = "SELECT created_by_role_id FROM app.invitation WHERE id = @id AND purpose = N'area-link'";
                break;
            default:
                return;
        }

        var devices = new List<(Guid Id, string Token)>();
        await using (var cmd = new SqlCommand($"""
            WITH up (role_id, depth) AS (
                SELECT s.subject_role_id, 0 FROM ({seed}) AS s(subject_role_id)
                UNION ALL
                SELECT e.from_role_id, u.depth + 1
                FROM up u
                JOIN app.role_edge e ON e.to_role_id = u.role_id AND e.revoked_at IS NULL AND e.edge_kind = N'holds'
                JOIN app.role r ON r.id = e.from_role_id AND r.revoked_at IS NULL
                WHERE u.depth < {RoleGraph.MaxDepth}
            )
            SELECT DISTINCT d.id, d.push_token
            FROM (SELECT DISTINCT role_id FROM up) u
            JOIN app.account a ON a.person_role_id = u.role_id
            JOIN app.notify_device d ON d.account_id = a.id AND d.revoked_at IS NULL AND d.push_token IS NOT NULL
            WHERE @except IS NULL OR a.id <> @except
            OPTION (MAXRECURSION {RoleGraph.MaxDepth + 1});
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", wake.Id);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@except", (object?)wake.ExceptAccount ?? DBNull.Value);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) devices.Add((reader.GetGuid(0), reader.GetString(1)));
        }

        if (devices.Count == 0) return;
        if (fcm is null)
        {
            logger.LogInformation("Push off — would wake {Count} device(s) for {Kind} {Id}", devices.Count, wake.Kind, wake.Id);
            return;
        }

        foreach (var (deviceId, token) in devices)
        {
            var (ok, gone, error) = await fcm.SendAsync(token, ct);
            await using var mark = new SqlCommand(gone
                ? "UPDATE app.notify_device SET push_token = NULL, push_error = @error WHERE id = @id;"
                : ok
                    ? "UPDATE app.notify_device SET push_at = @now, push_error = NULL WHERE id = @id;"
                    : "UPDATE app.notify_device SET push_error = @error WHERE id = @id;", connection);
            mark.Parameters.AddWithValue("@id", deviceId);
            mark.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            mark.Parameters.AddWithValue("@error", (object?)Clip(error) ?? DBNull.Value);
            await mark.ExecuteNonQueryAsync(ct);
        }
    }

    private static string? Clip(string? text) => text is null ? null : text.Length <= 200 ? text : text[..200];
}

/// <summary>
/// Firebase Cloud Messaging, HTTP v1 — ohne SDK: ein Dienstkonto (JSON aus
/// der Firebase-Konsole), daraus ein signiertes JWT, dafür ein Zugangstoken
/// (eine Stunde gültig, hier zwischengespeichert), damit die Nachricht.
/// </summary>
public sealed class Fcm
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };

    private readonly string projectId;
    private readonly string clientEmail;
    private readonly RSA key;
    private readonly string endpoint;
    private readonly string tokenUrl;
    private (string Token, DateTimeOffset Until)? access;
    private readonly SemaphoreSlim gate = new(1, 1);

    public Fcm(string projectId, string clientEmail, RSA key, string endpoint, string tokenUrl)
    {
        this.projectId = projectId;
        this.clientEmail = clientEmail;
        this.key = key;
        this.endpoint = endpoint.TrimEnd('/');
        this.tokenUrl = tokenUrl;
    }

    /// <summary>
    /// Aus der Einstellung <c>Push:Fcm:ServiceAccount</c> (das JSON selbst) oder
    /// <c>Push:Fcm:ServiceAccountFile</c> (ein Pfad). Fehlt beides: kein Push.
    /// <c>Push:Fcm:Endpoint</c> und <c>Push:Fcm:TokenUrl</c> nur für Prüfstände.
    ///
    /// <para>Ein RELATIVER Pfad gilt vom Ordner des Dienstes aus — erst dem
    /// Inhaltsordner (beim Entwickeln <c>backend/Api</c>, auf dem Server der
    /// Ordner der App), dann dem der DLL (<c>bin/…</c>, wohin der Bau
    /// <c>secrets/</c> mitkopiert). Steht ein Pfad da, und die Datei fehlt,
    /// sagt das Protokoll es — sonst bliebe Push still aus, ohne dass jemand es merkt.</para>
    /// </summary>
    public static Fcm? From(IConfiguration configuration, string contentRoot, ILogger logger)
    {
        var json = configuration["Push:Fcm:ServiceAccount"];
        var file = configuration["Push:Fcm:ServiceAccountFile"];
        if (string.IsNullOrWhiteSpace(json) && !string.IsNullOrWhiteSpace(file))
        {
            var found = (Path.IsPathRooted(file) ? [file] : new[] { Path.Combine(contentRoot, file), Path.Combine(AppContext.BaseDirectory, file) })
                .Select(Path.GetFullPath)
                .FirstOrDefault(File.Exists);
            if (found is null)
            {
                logger.LogWarning("Push:Fcm:ServiceAccountFile {File} not found (from {Root}) — push stays off", file, contentRoot);
                return null;
            }
            json = File.ReadAllText(found);
        }
        if (string.IsNullOrWhiteSpace(json)) return null;

        try
        {
            var account = JsonNode.Parse(json)!;
            var rsa = RSA.Create();
            rsa.ImportFromPem(account["private_key"]!.GetValue<string>());
            var project = account["project_id"]!.GetValue<string>();
            logger.LogInformation("Push on — Firebase project {Project}", project);
            return new Fcm(
                project,
                account["client_email"]!.GetValue<string>(),
                rsa,
                configuration["Push:Fcm:Endpoint"] ?? "https://fcm.googleapis.com",
                configuration["Push:Fcm:TokenUrl"] ?? account["token_uri"]?.GetValue<string>() ?? "https://oauth2.googleapis.com/token");
        }
        catch (Exception e)
        {
            logger.LogError(e, "Push:Fcm service account is unreadable — push stays off");
            return null;
        }
    }

    /// <summary>Das JWT, mit dem Google das Zugangstoken herausgibt (RS256, eine Stunde).</summary>
    public string Assertion(DateTimeOffset now)
    {
        static string B64(byte[] bytes) => Base64Url.Encode(bytes);
        var header = B64(Encoding.UTF8.GetBytes("""{"alg":"RS256","typ":"JWT"}"""));
        var claims = B64(JsonSerializer.SerializeToUtf8Bytes(new
        {
            iss = clientEmail,
            scope = "https://www.googleapis.com/auth/firebase.messaging",
            aud = tokenUrl,
            iat = now.ToUnixTimeSeconds(),
            exp = now.AddHours(1).ToUnixTimeSeconds()
        }));
        var signed = $"{header}.{claims}";
        var signature = key.SignData(Encoding.ASCII.GetBytes(signed), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        return $"{signed}.{B64(signature)}";
    }

    private async Task<string> AccessTokenAsync(CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            var now = DateTimeOffset.UtcNow;
            if (access is { } cached && cached.Until > now.AddMinutes(1)) return cached.Token;

            using var response = await Http.PostAsync(tokenUrl, new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "urn:ietf:params:oauth:grant-type:jwt-bearer",
                ["assertion"] = Assertion(now)
            }), ct);
            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct));
            if (!response.IsSuccessStatusCode || body?["access_token"] is null)
                throw new InvalidOperationException($"FCM token refused: {(int)response.StatusCode}");

            var token = body["access_token"]!.GetValue<string>();
            var seconds = body["expires_in"]?.GetValue<int>() ?? 3600;
            access = (token, now.AddSeconds(seconds));
            return token;
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>
    /// Ein Wecksignal an ein Gerät. <c>gone</c>: das Gerät gibt es bei FCM nicht
    /// mehr (App gelöscht, Kennung erneuert) — dann wird nicht mehr dorthin geschickt.
    /// </summary>
    public async Task<(bool Ok, bool Gone, string? Error)> SendAsync(string deviceToken, CancellationToken ct)
    {
        try
        {
            var bearer = await AccessTokenAsync(ct);
            var message = new
            {
                message = new
                {
                    token = deviceToken,
                    data = new Dictionary<string, string> { ["kind"] = "check" },
                    android = new { priority = "HIGH", ttl = "900s", collapse_key = "recreatio-check" }
                }
            };
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{endpoint}/v1/projects/{projectId}/messages:send")
            {
                Content = JsonContent.Create(message)
            };
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", bearer);
            using var response = await Http.SendAsync(request, ct);
            if (response.IsSuccessStatusCode) return (true, false, null);

            var text = await response.Content.ReadAsStringAsync(ct);
            var gone = (int)response.StatusCode == 404 || text.Contains("UNREGISTERED", StringComparison.Ordinal);
            return (false, gone, $"FCM {(int)response.StatusCode}");
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or InvalidOperationException or JsonException)
        {
            return (false, false, e.Message);
        }
    }
}
