using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Wer an einer Adresse was darf — und wie man es weitergibt.
///
/// <para>
/// <b>Zwei Wege zu einem Recht, und nur zwei.</b> Entweder eine meiner Rollen
/// FÜHRT die Adresse (oder die nächsthöhere), oder eine meiner Rollen hält ein
/// Zertifikat darauf. Ein dritter Weg wäre eine Hintertür; deshalb beantwortet
/// diese eine Stelle die Frage für alle, die sie stellen.
/// </para>
///
/// <para>
/// <b>Die Stufen stehen im Kernel</b> (3.5), und ihre Ordnung ist hier genau
/// das, was gebraucht wird:
/// </para>
///
/// <code>
///   write            darf die Seite ändern
///   write + certify  darf ändern UND Unterseiten öffnen sowie weitergeben
///   certify allein   darf aufnehmen, ohne selbst hineinzusehen
/// </code>
///
/// <para>
/// <c>certify</c> deckt nichts ab und wird von nichts abgedeckt — wer beides
/// braucht, bekommt zwei Zertifikate. Das ist keine Umständlichkeit, sondern
/// die Stelle, an der jemand einmal hinsehen muss.
/// </para>
///
/// <para>
/// <b>Vererbt wird nach unten.</b> Ein Zertifikat auf <c>parish</c> gilt auch
/// auf <c>parish/aktualnosci</c>: die Unterseite ist Teil dessen, was der
/// Führende führt. Andersherum gilt es nie.
/// </para>
/// </summary>
public static class Access
{
    /// <summary>Ein Zertifikat ohne Ende ist eine Zusage auf immer (E-07).</summary>
    private static readonly TimeSpan MaxLife = TimeSpan.FromDays(365 * 5);
    private static readonly TimeSpan DefaultLife = TimeSpan.FromDays(365);
    private static readonly TimeSpan ClockSlack = TimeSpan.FromHours(1);

    public static void Map(WebApplication app)
    {
        /*
         * Ohne `{*path}` in der Route: ein Fangmuster muss am Ende stehen, und
         * hier steht hinter dem Pfad noch etwas. Der Pfad reist deshalb im
         * Rumpf beziehungsweise in der Abfrage.
         */
        app.MapPost("/workspace/subpage", OpenAsync);
        app.MapGet("/workspace/grants", ListAsync);
        app.MapPost("/workspace/grants", IssueAsync);
        app.MapPost("/workspace/grants/{id:guid}/revoke", RevokeAsync);
    }

    /* -- Was jemand an einer Adresse darf ----------------------------------- */

    /// <summary>
    /// <see cref="ViaRoleId"/> ist die Rolle, ÜBER DIE es gilt. Ohne sie liesse
    /// sich nicht beantworten, warum jemand etwas darf — und ein Recht, das
    /// sich nicht erklären lässt, lässt sich auch nicht zurechtrücken.
    /// </summary>
    public readonly record struct Grip(
        bool MayWrite, bool MayCertify, Guid? OwnerRoleId, string? OwnerPath, Guid? ViaRoleId);

    public static async Task<Grip> OfAsync(
        SqlConnection connection, Guid accountId, string path, CancellationToken ct)
    {
        var paths = new List<string> { path };
        paths.AddRange(Slug.Ancestors(path));

        // Die Adresse selbst UND alles darüber: ein Zertifikat weiter oben gilt
        // hier mit.
        var rows = new List<(Guid Id, string Path, Guid? Owner)>();

        var names = string.Join(", ", paths.Select((_, i) => $"@p{i}"));
        await using (var cmd = new SqlCommand(
            $"SELECT id, path, claimed_by_role_id FROM app.slug WHERE path IN ({names});", connection))
        {
            for (var i = 0; i < paths.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", paths[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((reader.GetGuid(0), reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetGuid(2)));
            }
        }

        if (rows.Count == 0) return new Grip(false, false, null, null, null);

        // Die nächstliegende Heimat entscheidet, nicht die oberste.
        var owner = rows.Where(r => r.Owner is not null)
            .OrderByDescending(r => r.Path.Length)
            .Select(r => (r.Path, RoleId: r.Owner!.Value))
            .FirstOrDefault();

        var mine = await Workspace.RolesOfAsync(connection, accountId, ct);
        var mineIds = mine.Select(r => r.Id).ToHashSet();

        if (owner.Path is not null && mineIds.Contains(owner.RoleId))
        {
            // Wer führt, darf alles daran — ohne Zertifikat auf sich selbst.
            return new Grip(true, true, owner.RoleId, owner.Path, owner.RoleId);
        }

        if (mineIds.Count == 0)
        {
            return new Grip(false, false,
                owner.Path is null ? null : owner.RoleId, owner.Path, null);
        }

        var held = new List<(Capability Capability, Guid RoleId)>();

        var scopes = string.Join(", ", rows.Select((_, i) => $"@s{i}"));
        var roles = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using (var cmd = new SqlCommand($"""
            SELECT capability, subject_role_id
            FROM app.certificate
            WHERE scope_kind = N'slug'
              AND scope_id IN ({scopes})
              AND subject_role_id IN ({roles})
              AND revoked_at IS NULL
              AND expires_at > @now;
            """, connection))
        {
            for (var i = 0; i < rows.Count; i++) cmd.Parameters.AddWithValue($"@s{i}", rows[i].Id);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (Capabilities.TryParse(reader.GetString(0), out var capability))
                {
                    held.Add((capability, reader.GetGuid(1)));
                }
            }
        }

        var mayWrite = Capabilities.CoversAny(held.Select(h => h.Capability), Capability.Write);
        var mayCertify = Capabilities.CoversAny(held.Select(h => h.Capability), Capability.Certify);

        var via = held
            .FirstOrDefault(h => Capabilities.Covers(h.Capability, Capability.Write)
                              || Capabilities.Covers(h.Capability, Capability.Certify));

        return new Grip(mayWrite, mayCertify,
            owner.Path is null ? null : owner.RoleId, owner.Path,
            via.RoleId == Guid.Empty ? null : via.RoleId);
    }

    /* -- Eine Unterseite öffnen --------------------------------------------- */

    public sealed record OpenRequest(string Path, string RoleId, string? Note);

    /// <summary>
    /// Eine Unterseite entsteht VON OBEN — ohne Code.
    ///
    /// <para>
    /// Ein Code ist das Mittel, eine Adresse an jemanden zu geben, den man nicht
    /// erreicht. Wer <c>parish</c> führt, erreicht sich selbst: ein Geheimnis,
    /// das man sich selbst schickt, ist Umstand ohne Gewinn. Deshalb steht in
    /// der Zeile kein Hash, sondern NULL (0012) — und die Adresse ist von
    /// Anfang an vergeben.
    /// </para>
    ///
    /// <para>
    /// Die Rolle muss eine EIGENE sein. Einer fremden Rolle eine Adresse zu
    /// geben, wäre eine Verfügung über jemanden, der nicht gefragt wurde; wer
    /// anderen Zugang geben will, stellt ein Zertifikat aus.
    /// </para>
    /// </summary>
    private static async Task OpenAsync(HttpContext ctx, Db db, OpenRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Slug.Normalise(body.Path);

        if (!Slug.IsWellFormed(path) || Slug.IsReserved(path))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.");
            return;
        }

        var ancestors = Slug.Ancestors(path);
        if (ancestors.Count == 0)
        {
            // Eine Adresse auf oberster Ebene hat kein „oben", das sie öffnen
            // könnte. Die gibt es weiterhin nur mit Code.
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "To nie jest podstrona. Adres najwyższego poziomu bierze się kodem.");
            return;
        }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        // Gefragt wird am ELTERNPFAD: dort hängt das Recht, darunter etwas zu
        // öffnen. Die neue Adresse selbst kennt noch niemand.
        var parent = string.Join('/', path.Split('/')[..^1]);
        var grip = await OfAsync(connection, who.Value.AccountId, parent, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Adresu nadrzędnego nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tu nie możesz otwierać podstron — do tego trzeba prawa „certify”.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO app.slug
                (id, path, claim_code_sha256, note, claimed_by_role_id, claimed_by_account_id,
                 claimed_at, created_at)
            VALUES (@id, @path, NULL, @note, @role, @account, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", Ids.NewId());
        insert.Parameters.AddWithValue("@path", path);
        insert.Parameters.AddWithValue("@note", (object?)body.Note?.Trim() ?? DBNull.Value);
        insert.Parameters.AddWithValue("@role", roleId);
        insert.Parameters.AddWithValue("@account", who.Value.AccountId);
        insert.Parameters.AddWithValue("@now", now);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten adres już istnieje.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { path, roleId = Ids.ToText(roleId), claimedAt = now });
    }

    /* -- Zugang geben ------------------------------------------------------- */

    /// <summary>Das Zertifikat, wie der Browser es unterschrieben hat.</summary>
    public sealed record CertificateProof(string Id, long IssuedAt, long ExpiresAt, string Signature);

    public sealed record GrantRequest(
        string Path, string SubjectRoleId, string IssuerRoleId, string Capability, CertificateProof Certificate);

    private static async Task IssueAsync(HttpContext ctx, Db db, GrantRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Slug.Normalise(body.Path);
        if (!Slug.IsWellFormed(path))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        if (!Guid.TryParse(body.SubjectRoleId, out var subjectId)
            || !Guid.TryParse(body.IssuerRoleId, out var issuerId)
            || !Guid.TryParse(body.Certificate.Id, out var certificateId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (!Capabilities.TryParse(body.Capability, out var capability))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Stopień: read, write, admin albo certify.");
            return;
        }

        var issuedAt = DateTimeOffset.FromUnixTimeSeconds(body.Certificate.IssuedAt);
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(body.Certificate.ExpiresAt);
        var now = DateTimeOffset.UtcNow;

        if (issuedAt > now + ClockSlack || issuedAt < now - ClockSlack)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Data podpisu nie zgadza się z zegarem.");
            return;
        }

        if (expiresAt <= issuedAt || expiresAt > now + MaxLife)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                $"Ważność: od jednego dnia do {MaxLife.Days / 365} lat.");
            return;
        }

        byte[] signature;
        try { signature = Base64Url.Decode(body.Certificate.Signature); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny podpis.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == issuerId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nie możesz nic wystawić.");
            return;
        }

        var grip = await OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tu nie możesz nikogo dopuścić — do tego trzeba prawa „certify”.");
            return;
        }

        Guid slugId;
        await using (var find = new SqlCommand("SELECT id FROM app.slug WHERE path = @path;", connection))
        {
            find.Parameters.AddWithValue("@path", path);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }
            slugId = found;
        }

        byte[] issuerPublic;
        await using (var find = new SqlCommand(
            "SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            find.Parameters.AddWithValue("@id", issuerId);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not byte[] spki)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma.");
                return;
            }
            issuerPublic = spki;
        }

        await using (var find = new SqlCommand(
            "SELECT COUNT(*) FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            find.Parameters.AddWithValue("@id", subjectId);
            if ((int)(await find.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) == 0)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma.");
                return;
            }
        }

        var record = new CertificateRecord
        {
            Id = certificateId,
            SubjectRoleId = subjectId,
            ScopeKind = ScopeKind.Slug,
            ScopeId = slugId,
            Capability = capability,
            IssuedByRoleId = issuerId,
            IssuedUtc = issuedAt,
            ExpiresUtc = expiresAt
        };

        if (!Verify(record, issuerPublic, signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis się nie zgadza.");
            return;
        }

        // Zweimal dasselbe Recht an dieselbe Rolle ist kein Fehler, aber auch
        // kein Gewinn: es entstünde eine zweite Zeile, die niemand zurücknimmt,
        // wenn er die erste zurücknimmt.
        await using (var same = new SqlCommand("""
            SELECT COUNT(*) FROM app.certificate
            WHERE scope_kind = N'slug' AND scope_id = @scope AND subject_role_id = @subject
              AND capability = @cap AND revoked_at IS NULL AND expires_at > @now;
            """, connection))
        {
            same.Parameters.AddWithValue("@scope", slugId);
            same.Parameters.AddWithValue("@subject", subjectId);
            same.Parameters.AddWithValue("@cap", Capabilities.ToText(capability));
            same.Parameters.AddWithValue("@now", now);

            if ((int)(await same.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ta rola ma już to prawo do tego adresu.");
                return;
            }
        }

        await using var insert = new SqlCommand("""
            INSERT INTO app.certificate
                (id, subject_role_id, scope_kind, scope_id, capability, issued_by_role_id,
                 signature, issued_at, expires_at)
            VALUES (@id, @subject, N'slug', @scope, @cap, @by, @sig, @issued, @expires);
            """, connection);

        insert.Parameters.AddWithValue("@id", certificateId);
        insert.Parameters.AddWithValue("@subject", subjectId);
        insert.Parameters.AddWithValue("@scope", slugId);
        insert.Parameters.AddWithValue("@cap", Capabilities.ToText(capability));
        insert.Parameters.AddWithValue("@by", issuerId);
        insert.Parameters.AddWithValue("@sig", signature);
        insert.Parameters.AddWithValue("@issued", issuedAt);
        insert.Parameters.AddWithValue("@expires", expiresAt);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            id = Ids.ToText(certificateId),
            path,
            subjectRoleId = Ids.ToText(subjectId),
            capability = Capabilities.ToText(capability),
            expiresAt
        });
    }

    /* -- Zeigen und zurücknehmen -------------------------------------------- */

    private static async Task ListAsync(HttpContext ctx, Db db, string path)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var grip = await OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (!grip.MayWrite && !grip.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ten adres nie jest Twój.");
            return;
        }

        /*
         * Die Kennung der Zeile geht mit hinaus. Der Browser braucht sie, weil
         * sie als `scopeId` in der kanonischen Form eines Zertifikats steht —
         * er unterschreibt sie mit und kann sie sonst nirgends herbekommen.
         */
        Guid? slugId = null;
        await using (var find = new SqlCommand("SELECT id FROM app.slug WHERE path = @path;", connection))
        {
            find.Parameters.AddWithValue("@path", wanted);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is Guid found) slugId = found;
        }

        var paths = new List<string> { wanted };
        paths.AddRange(Slug.Ancestors(wanted));
        var names = string.Join(", ", paths.Select((_, i) => $"@p{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT c.id, s.path, c.subject_role_id, c.capability, c.issued_by_role_id, c.expires_at
            FROM app.certificate c
            JOIN app.slug s ON s.id = c.scope_id
            WHERE c.scope_kind = N'slug' AND s.path IN ({names})
              AND c.revoked_at IS NULL AND c.expires_at > @now
            ORDER BY LEN(s.path), c.issued_at;
            """, connection);

        for (var i = 0; i < paths.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", paths[i]);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var grants = new List<object>();

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var on = reader.GetString(1);
                grants.Add(new
                {
                    id = Ids.ToText(reader.GetGuid(0)),
                    path = on,

                    // Von weiter oben geerbt: hier sichtbar, aber hier nicht
                    // zurückzunehmen — das geht dort, wo es ausgestellt wurde.
                    inherited = on != wanted,
                    subjectRoleId = Ids.ToText(reader.GetGuid(2)),
                    capability = reader.GetString(3),
                    issuedByRoleId = Ids.ToText(reader.GetGuid(4)),
                    expiresAt = reader.GetDateTimeOffset(5)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            path = wanted,
            slugId = slugId is null ? null : Ids.ToText(slugId.Value),
            ownerRoleId = grip.OwnerRoleId is null ? null : Ids.ToText(grip.OwnerRoleId.Value),
            ownerPath = grip.OwnerPath,
            mayWrite = grip.MayWrite,
            mayCertify = grip.MayCertify,
            grants
        });
    }

    private static async Task RevokeAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        string path;
        await using (var find = new SqlCommand("""
            SELECT s.path FROM app.certificate c
            JOIN app.slug s ON s.id = c.scope_id
            WHERE c.id = @id AND c.scope_kind = N'slug' AND c.revoked_at IS NULL;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not string found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego prawa tu nie ma.");
                return;
            }
            path = found;
        }

        // Zurücknehmen darf, wer auch geben darf — an DER Adresse, an der das
        // Zertifikat hängt.
        var grip = await OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tu nie możesz nic odbierać.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE app.certificate SET revoked_at = @now WHERE id = @id AND revoked_at IS NULL;", connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        // Zurücknehmen wirkt SOFORT: es gibt keinen Zwischenspeicher, der es
        // verzögern könnte. Genau das war im Altbestand anders.
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { ok = true });
    }

    private static bool Verify(CertificateRecord record, byte[] issuerSpki, byte[] signature)
    {
        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(issuerSpki, out _);
            return record.Verify(rsa, signature);
        }
        catch (CryptographicException)
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
