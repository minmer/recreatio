using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0129 — WER FÜR DIE DATEN GERADESTEHT (Administrator danych), als Datensatz mit Geschichte.
///
/// <para>
/// <b>Ein Datensatz je Organisation</b>, im Klartext (die Klausel muss lesen können,
/// wer kein Konto hat), mit einem HEIMATBEREICH, dessen Prowadzący ihn ändern; jede
/// Änderung ist eine Fassung. <b>Ein Bereich gilt unter einem Datensatz</b> durch einen
/// ANSCHLUSS, den eine Rolle des Heimatbereichs UNTERSCHREIBT (Kernel:
/// <see cref="ControllerAttachmentRecord"/>) — wer einen fremden Datensatz will, bittet,
/// und der Heimatbereich unterschreibt oder lehnt ab; oder er bietet an, und der andere
/// nimmt an. Wer beide führt, tut es in einem Schritt.
/// </para>
///
/// <para>
/// <b>Was gilt:</b> der gültige Anschluss des nächsten Bereichs in der Kette (der Bereich
/// selbst, dann seine Eltern, höchstens 16 Stufen) — für jeden Zeitpunkt, auch einen
/// vergangenen: Anschlüsse enden mit Datum statt zu verschwinden, Datensätze werden
/// geschlossen statt gelöscht, und wo die Löschung eines Kontos einen Bereich von seinen
/// Eltern abschnitt, steht das in <c>area_parent_ended</c>.
/// </para>
///
/// <para>
/// <b>Ohne Datensatz sammelt niemand:</b> Formulare, Reservierungen und Rozmowy eines
/// Bereichs (auch „Napisz do nas") nehmen nichts an, und eine öffentliche Seite braucht
/// jemanden, der für sie geradesteht. Ein Gespräch zweier Menschen braucht niemanden.
/// </para>
/// </summary>
public static partial class Controllers
{
    /// <summary>Die Fassung der Bedingungen der Auftragsverarbeitung (umowa powierzenia), die heute gilt.</summary>
    public const string TermsVersion = "2026-10";

    /// <summary>Wie die Oberfläche es sagt, wenn niemand geradesteht.</summary>
    internal const string Nobody =
        "Nikt nie odpowiada tu za dane osobowe, więc nic tu nie zbieramy. Wskazuje go ten, kto prowadzi obszar (Ustawienia → Administrator danych).";

    private const int MaxDepth = 16;

    /// <summary>Was für einen Bereich gilt: der Datensatz in seiner Fassung, und woher.</summary>
    internal sealed record Info(
        Guid Id, int Version, string Name, string? Address, string? Email, string? Phone,
        string? DpoName, string? DpoContact, string? Authority,
        Guid HomeAreaId, Guid FromAreaId, Guid AttachmentId);

    public static void Map(WebApplication app)
    {
        /* Die Einstellungen eines Bereichs — und die alten Aufrufe, die Browser von gestern noch schicken. */
        app.MapGet("/workspace/area/{id:guid}/controller", AreaGetAsync);
        app.MapPost("/workspace/area/{id:guid}/controller", AreaPostAsync);

        app.MapGet("/workspace/controllers", ListAsync);
        app.MapPost("/workspace/controllers", CreateAsync);
        app.MapPost("/workspace/controller/{id:guid}", VersionAsync);
        app.MapPost("/workspace/controller/{id:guid}/close", CloseAsync);
        app.MapPost("/workspace/controller/{id:guid}/terms", TermsAsync);
        app.MapPost("/workspace/controller/{id:guid}/offer", OfferAsync);
        app.MapPost("/workspace/attachment/{id:guid}/decide", DecideAsync);
        app.MapPost("/workspace/attachment/{id:guid}/end", EndAsync);

        /* Wer für eine Seite geradesteht (und die Seiten darunter). */
        app.MapPost("/workspace/slug/controller", PageSetAsync);

        /*
         * ÖFFENTLICH: die Klausel eines Bereichs, und der Datensatz mit seiner Geschichte
         * und der Unterschrift, die ihn für einen Bereich gelten lässt — für jeden, der
         * die Klausel sieht, nachprüfbar.
         */
        app.MapGet("/area/{id:guid}/controller", PublicOfAreaAsync);
        app.MapGet("/controller/{id:guid}", ProofAsync);
    }

    /* -- Was gilt ------------------------------------------------------------------- */

    /// <summary>
    /// Die Kette eines Bereichs zu einem Zeitpunkt: die Verbindungen von heute, und die,
    /// die eine Löschung später abgeschnitten hat. Eine Verbindung ändert sich sonst nie.
    /// </summary>
    private const string ChainSql = """
        WITH links AS (
            SELECT a.id AS area_id, a.parent_area_id FROM app.area a WHERE a.parent_area_id IS NOT NULL
            UNION ALL
            SELECT p.area_id, p.parent_area_id FROM app.area_parent_ended p WHERE p.ended_at > @at
        ),
        chain AS (
            SELECT CAST(@area AS uniqueidentifier) AS id, 0 AS depth
            UNION ALL
            SELECT l.parent_area_id, c.depth + 1 FROM chain c JOIN links l ON l.area_id = c.id WHERE c.depth < 16
        )
        """;

    /// <summary>Der Datensatz, der für einen Bereich gilt — jetzt oder zu <paramref name="at"/>.</summary>
    internal static async Task<Info?> OfAreaAsync(
        SqlConnection connection, Guid areaId, CancellationToken ct, DateTimeOffset? at = null, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand(ChainSql + """
            SELECT TOP 1 ch.id, x.id, d.id, d.home_area_id,
                   v.version, v.name, v.address, v.email, v.phone, v.dpo_name, v.dpo_contact, v.authority
            FROM chain ch
            JOIN app.controller_attachment x ON x.area_id = ch.id AND x.live_from <= @at
                 AND (x.state = N'live' OR (x.state = N'ended' AND x.ended_at > @at))
            JOIN app.data_controller d ON d.id = x.controller_id
            CROSS APPLY (SELECT TOP 1 vv.* FROM app.data_controller_version vv
                          WHERE vv.controller_id = d.id AND vv.written_at <= @at
                          ORDER BY vv.version DESC) v
            ORDER BY ch.depth
            OPTION (MAXRECURSION 20);
            """, connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@at", at ?? DateTimeOffset.UtcNow);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        string? Text(int i) => reader.IsDBNull(i) ? null : reader.GetString(i);
        return new Info(reader.GetGuid(2), reader.GetInt32(4), reader.GetString(5), Text(6), Text(7), Text(8),
            Text(9), Text(10), Text(11), reader.GetGuid(3), reader.GetGuid(0), reader.GetGuid(1));
    }

    /// <summary>Wie der Datensatz hinausgeht — dieselben Namen wie bisher (<c>name, address, email, fromAreaId</c>), und mehr.</summary>
    internal static object? Json(Info? c, string? fromAreaName = null) => c is null ? null : new
    {
        id = Ids.ToText(c.Id),
        version = c.Version,
        name = c.Name,
        address = c.Address,
        email = c.Email,
        phone = c.Phone,
        dpo = c.DpoName is null && c.DpoContact is null ? null : new { name = c.DpoName, contact = c.DpoContact },
        authority = c.Authority,
        homeAreaId = Ids.ToText(c.HomeAreaId),
        fromAreaId = Ids.ToText(c.FromAreaId),
        fromAreaName
    };

    /// <summary>Der Name eines Bereichs (Klartext, 0019) — oder <c>null</c>.</summary>
    internal static async Task<string?> AreaNameAsync(SqlConnection connection, Guid areaId, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand("SELECT name FROM app.area WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    /* -- Wer für eine Seite geradesteht ------------------------------------------------ */

    /// <summary>
    /// Die nächste Adresse (sie selbst oder darüber), die einen Bereich nennt — und was für
    /// ihn gilt. Eine Seite ohne Bereich darüber hat niemanden.
    /// </summary>
    internal static async Task<(Info? Info, Guid? AreaId, string? FromPath)> OfPageAsync(
        SqlConnection connection, string path, CancellationToken ct)
    {
        var paths = new List<string> { path };
        paths.AddRange(Slug.Ancestors(path));
        var names = string.Join(", ", paths.Select((_, i) => $"@p{i}"));

        Guid? areaId = null;
        string? from = null;
        await using (var cmd = new SqlCommand($"""
            SELECT TOP 1 path, controller_area_id FROM app.slug
            WHERE path IN ({names}) AND controller_area_id IS NOT NULL
            ORDER BY LEN(path) DESC;
            """, connection))
        {
            for (var i = 0; i < paths.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", paths[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct)) { from = reader.GetString(0); areaId = reader.GetGuid(1); }
        }

        if (areaId is null) return (null, null, null);
        return (await OfAreaAsync(connection, areaId.Value, ct), areaId, from);
    }

    /// <summary>
    /// <c>null</c>, wenn die Seite gespeichert werden darf; sonst warum nicht: eine
    /// ÖFFENTLICHE Seite (an keinen Bereich gebunden) braucht jemanden, der für sie geradesteht.
    /// </summary>
    internal static async Task<string?> PageGateAsync(SqlConnection connection, Guid slugId, string path, CancellationToken ct)
    {
        await using (var cmd = new SqlCommand("SELECT COUNT(*) FROM app.slug_area WHERE slug_id = @slug;", connection))
        {
            cmd.Parameters.AddWithValue("@slug", slugId);
            if ((int)(await cmd.ExecuteScalarAsync(ct))! > 0) return null;
        }
        return (await OfPageAsync(connection, path, ct)).Info is null
            ? "Ta strona jest publiczna, a nikt nie odpowiada za jej treść. Wskaż obszar, który za nią odpowiada (Strony → Ustawienia strony → Kto odpowiada za tę stronę)."
            : null;
    }

    /* -- Rollen und Unterschriften ----------------------------------------------------- */

    /// <summary>Meine Rollen mit einem gültigen <c>admin</c> auf dem Bereich — in der Reihenfolge meiner Rollen, je mit dem Zertifikat.</summary>
    internal static async Task<List<(Guid RoleId, Guid CertificateId)>> AdminRolesAsync(
        SqlConnection connection, IReadOnlyList<Guid> mine, Guid areaId, CancellationToken ct, SqlTransaction? tx = null)
    {
        var found = new List<(Guid, Guid)>();
        if (mine.Count == 0) return found;
        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT subject_role_id, id FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area AND capability = N'admin'
              AND revoked_at IS NULL AND expires_at > @now AND subject_role_id IN ({names})
            ORDER BY expires_at DESC;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);

        var rows = new List<(Guid Role, Guid Cert)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
            while (await reader.ReadAsync(ct)) rows.Add((reader.GetGuid(0), reader.GetGuid(1)));

        foreach (var role in mine)
        {
            var hit = rows.FirstOrDefault(r => r.Role == role);
            if (hit.Role != Guid.Empty) found.Add((hit.Role, hit.Cert));
        }
        return found;
    }

    public sealed record SignedAttachment(string? SignerRoleId, long SignedAt, string? Signature);

    /// <summary>
    /// Prüft die Unterschrift einer Zusage: die Rolle ist meine, führt den Heimatbereich
    /// (<c>admin</c>), ihr Schlüssel hat genau diese Bytes unterschrieben, und die Zeit
    /// stimmt auf eine Stunde. Gibt Rolle und Zertifikat zurück — oder warum nicht.
    /// </summary>
    private static async Task<(Guid Role, Guid Certificate, DateTimeOffset At, byte[] Signature)?> SignedByAsync(
        SqlConnection connection, SqlTransaction? tx, IReadOnlyList<Guid> mine, SignedAttachment? signed,
        Guid attachmentId, Guid controllerId, Guid areaId, Guid homeAreaId, CancellationToken ct)
    {
        if (signed is null || !Guid.TryParse(signed.SignerRoleId, out var role) || string.IsNullOrWhiteSpace(signed.Signature)) return null;

        byte[] signature;
        try { signature = Base64Url.Decode(signed.Signature); } catch (FormatException) { return null; }
        if (signature.Length is 0 or > 1024) return null;

        var at = DateTimeOffset.FromUnixTimeSeconds(signed.SignedAt);
        if ((at - DateTimeOffset.UtcNow).Duration() > Area.ClockSlack) return null;

        var admin = (await AdminRolesAsync(connection, mine, homeAreaId, ct, tx)).FirstOrDefault(r => r.RoleId == role);
        if (admin.RoleId == Guid.Empty) return null;

        await using var cmd = new SqlCommand("SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection, tx);
        cmd.Parameters.AddWithValue("@id", role);
        if (await cmd.ExecuteScalarAsync(ct) is not byte[] spki) return null;

        var record = new ControllerAttachmentRecord
        {
            AttachmentId = attachmentId, ControllerId = controllerId, AreaId = areaId, HomeAreaId = homeAreaId,
            SignerRoleId = role, SignedUtc = at
        };

        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(spki, out _);
            if (!record.Verify(rsa, signature)) return null;
        }
        catch (CryptographicException) { return null; }

        return (role, admin.CertificateId, at, signature);
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }

    /* -- Öffentlich ------------------------------------------------------------------- */

    /// <summary>Die Klausel eines Bereichs — für die Stellen, die sie ohne Konto zeigen (Reservierung, Einladung).</summary>
    private static async Task PublicOfAreaAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var info = await OfAreaAsync(connection, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), controller = Json(info) });
    }

    /// <summary>
    /// Der Datensatz mit allen Fassungen — und, für einen Bereich, die Zusage, die ihn
    /// dort gelten lässt: die kanonischen Felder, die Unterschrift, der öffentliche
    /// Schlüssel der unterschreibenden Rolle und das Zertifikat, das sie dazu befugte (mit
    /// dessen Unterschrift und dem Schlüssel des Ausstellers). Welche anderen Bereiche ihn
    /// nutzen, steht hier nicht — das sehen nur die Prowadzący seiner Heimat.
    /// </summary>
    private static async Task ProofAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid home;
        DateTimeOffset? closedAt;
        string? closedReason;
        await using (var cmd = new SqlCommand(
            "SELECT home_area_id, closed_at, closed_reason FROM app.data_controller WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego administratora danych."); return; }
            home = reader.GetGuid(0);
            closedAt = reader.IsDBNull(1) ? null : reader.GetDateTimeOffset(1);
            closedReason = reader.IsDBNull(2) ? null : reader.GetString(2);
        }

        var versions = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT version, name, address, email, phone, dpo_name, dpo_contact, authority, written_at
            FROM app.data_controller_version WHERE controller_id = @id ORDER BY version;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                string? T(int i) => reader.IsDBNull(i) ? null : reader.GetString(i);
                versions.Add(new
                {
                    version = reader.GetInt32(0), name = reader.GetString(1), address = T(2), email = T(3), phone = T(4),
                    dpo = T(5) is null && T(6) is null ? null : new { name = T(5), contact = T(6) },
                    authority = T(7), writtenAt = reader.GetDateTimeOffset(8)
                });
            }
        }

        object? proof = null;
        if (Guid.TryParse(ctx.Request.Query["area"].ToString(), out var area)
            && await OfAreaAsync(connection, area, ctx.RequestAborted) is { } info && info.Id == id)
        {
            proof = await ProofOfAsync(connection, info.AttachmentId, ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            id = Ids.ToText(id),
            homeAreaId = Ids.ToText(home),
            homeAreaName = await AreaNameAsync(connection, home, ctx.RequestAborted),
            closedAt, closedReason, versions, proof
        });
    }

    private static async Task<object?> ProofOfAsync(SqlConnection connection, Guid attachmentId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT x.id, x.area_id, x.controller_id, d.home_area_id, x.live_from, x.signed_by_role_id, x.signed_at, x.signature,
                   signer.sign_public_key,
                   c.id, c.subject_role_id, c.scope_id, c.capability, c.issued_by_role_id, c.issued_at, c.expires_at, c.signature,
                   issuer.sign_public_key, a.name
            FROM app.controller_attachment x
            JOIN app.data_controller d ON d.id = x.controller_id
            LEFT JOIN app.role signer ON signer.id = x.signed_by_role_id
            LEFT JOIN app.certificate c ON c.id = x.certificate_id
            LEFT JOIN app.role issuer ON issuer.id = c.issued_by_role_id
            LEFT JOIN app.area a ON a.id = x.area_id
            WHERE x.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", attachmentId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        var signedBy = reader.IsDBNull(5) ? (Guid?)null : reader.GetGuid(5);
        string? B64(int i) => reader.IsDBNull(i) ? null : Base64Url.Encode((byte[])reader[i]);

        return new
        {
            attachmentId = Ids.ToText(reader.GetGuid(0)),
            areaId = Ids.ToText(reader.GetGuid(1)),
            areaName = reader.IsDBNull(18) ? null : reader.GetString(18),
            controllerId = Ids.ToText(reader.GetGuid(2)),
            homeAreaId = Ids.ToText(reader.GetGuid(3)),
            liveFrom = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),

            /* Ein Eintrag von vor 0129 wanderte ohne Unterschrift — das wird gesagt, nicht verborgen. */
            signed = signedBy is null ? null : new
            {
                signerRoleId = Ids.ToText(signedBy.Value),
                signedAt = reader.IsDBNull(6) ? (long?)null : reader.GetDateTimeOffset(6).ToUnixTimeSeconds(),
                signature = B64(7),
                signerPublicKey = B64(8),
                certificate = reader.IsDBNull(9) ? null : new
                {
                    id = Ids.ToText(reader.GetGuid(9)),
                    subjectRoleId = Ids.ToText(reader.GetGuid(10)),
                    scopeKind = "area",
                    scopeId = Ids.ToText(reader.GetGuid(11)),
                    capability = reader.GetString(12),
                    issuedByRoleId = Ids.ToText(reader.GetGuid(13)),
                    issuedAt = reader.GetDateTimeOffset(14).ToUnixTimeSeconds(),
                    expiresAt = reader.GetDateTimeOffset(15).ToUnixTimeSeconds(),
                    signature = B64(16),
                    issuerPublicKey = B64(17)
                }
            }
        };
    }
}
