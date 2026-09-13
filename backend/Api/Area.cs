using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Bereiche — die Schlüssel, und sonst nichts.
///
/// <para>
/// <b>Drei Ordnungen, die einander nicht besitzen.</b> Der Bereich ist ein
/// benannter SCHLÜSSEL mit seinen Epochen. Die Rolle HÄLT Schlüssel, ist aber
/// keiner. Die Seite (<see cref="Slug"/>) hat ihre eigene Hierarchie und weiss
/// von beidem nichts. Sie treffen sich in Zertifikaten und Zuteilungen — nicht
/// in Fremdschlüsselspalten.
/// </para>
///
/// <para>
/// <b>Der Dienst sieht keinen Schlüssel.</b> Der Epochenschlüssel entsteht im
/// Browser, wird dort für den öffentlichen Verpackungsschlüssel jeder
/// Mitgliedsrolle verpackt und kommt als undurchsichtiger Block hier an. Der
/// Altbestand öffnete dafür den Hauptschlüssel im Auftrag; dieser Dienst kann
/// das nicht, und das ist der Gewinn.
/// </para>
///
/// <para>
/// <b>DARF und KANN sind zwei Dinge</b> (0001): ein Zertifikat ohne Schlüssel
/// darf lesen und kann es nicht; ein Schlüssel ohne Zertifikat kann und darf
/// nicht. Deshalb verlangt das Weitergeben ein Zertifikat und nicht den blossen
/// Besitz des Schlüssels — sonst wäre Besitz die Berechtigung, und die Trennung
/// wäre aufgegeben.
/// </para>
/// </summary>
public static class Area
{
    public const int MaxName = 200;

    /// <summary>Ein Schlüssel ist 32 Byte. Alles andere ist keiner.</summary>
    public const int KeySize = 32;

    private static readonly TimeSpan MembershipLife = TimeSpan.FromDays(365 * 2);
    private static readonly TimeSpan MaxLife = TimeSpan.FromDays(365 * 5);
    private static readonly TimeSpan ClockSlack = TimeSpan.FromHours(1);

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/area", CreateAsync);
        app.MapGet("/workspace/areas", ListAsync);
        app.MapGet("/workspace/area/{id:guid}/members", MembersAsync);

        /*
         * MEINE eigenen Huellen. Ohne sie kann ein Browser nach einem Neuladen
         * seinen eigenen Epochenschluessel nicht wiederfinden — und damit weder
         * offenlegen noch ein neues Feld versiegeln. Der Schluessel laege dann
         * allein im Speicher des Tabs, in dem der Bereich entstanden ist.
         */
        app.MapGet("/workspace/area/{id:guid}/keys", MyKeysAsync);
        app.MapPost("/workspace/area/{id:guid}/grant", GrantAsync);
        app.MapPost("/workspace/area/{id:guid}/publish", PublishAsync);

        /*
         * ÖFFENTLICH, und das ist der ganze Punkt. Wer einen veröffentlichten
         * Epochenschlüssel holt, braucht kein Konto — sonst wäre „öffentlich"
         * bloss ein anderes Wort für „angemeldet".
         */
        app.MapGet("/area/{id:guid}/key", PublicKeyAsync);
    }

    /* -- Anlegen ------------------------------------------------------------ */

    /// <summary>Ein Zertifikat, wie der Browser es unterschrieben hat.</summary>
    public sealed record Proof(string Id, string Capability, long IssuedAt, long ExpiresAt, string Signature);

    public sealed record CreateRequest(
        string AreaId, string Name, string RoleId, string WrappedKey, IReadOnlyList<Proof> Certificates);

    /// <summary>
    /// Einen Bereich anlegen.
    ///
    /// <para>
    /// <b>Die Kennung kommt aus dem Browser.</b> Die AAD des Epochenschlüssels
    /// nennt den Bereich — ohne seine Kennung lässt sich der Schlüssel nicht
    /// verpacken. Der Dienst könnte sie erst NACH dem Einfügen vergeben, und
    /// dann wäre der Schlüssel unter einer falschen AAD verpackt und für immer
    /// zu. Deshalb würfelt der Browser sie, wie er es bei Zertifikaten schon tut.
    /// </para>
    ///
    /// <para>
    /// <b>Alles in EINER Transaktion.</b> Bereich, Epoche, Zuteilung und
    /// Zertifikate gehören zusammen: ein Bereich ohne Zuteilung wäre ein
    /// Schlüssel, den niemand hat, und ein Bereich ohne Zertifikat einer, in den
    /// niemand jemanden lassen darf. Beides ist unbrauchbar und bliebe stehen.
    /// </para>
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var name = (body.Name ?? string.Empty).Trim();

        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Obszar potrzebuje nazwy.");
            return;
        }

        if (!Guid.TryParse(body.AreaId, out var areaId) || areaId == Guid.Empty
            || !Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        byte[] wrapped;
        try { wrapped = Base64Url.Decode(body.WrappedKey ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        if (wrapped.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Bez klucza obszar jest nie do otwarcia.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        var issuer = await PublicSignKeyAsync(connection, roleId, ctx.RequestAborted);
        if (issuer is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma.");
            return;
        }

        /*
         * ZWEI Zertifikate, nicht eines. `certify` steht NEBEN der Leiter und
         * nicht darunter (Kernel 3.5): `admin` deckt es nicht ab. Wer einen
         * Bereich anlegt und niemanden hineinlassen könnte, hätte ein teures
         * Nichts.
         */
        var wanted = new[] { Capability.Admin, Capability.Certify };
        var proofs = body.Certificates ?? [];

        if (!wanted.All(c => proofs.Any(p =>
                Capabilities.TryParse(p.Capability, out var parsed) && parsed == c)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Brakuje zaświadczeń: obszar potrzebuje „admin” i „certify”.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var records = new List<(CertificateRecord Record, byte[] Signature)>();

        foreach (var proof in proofs)
        {
            if (!Guid.TryParse(proof.Id, out var certificateId)
                || !Capabilities.TryParse(proof.Capability, out var capability))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zaświadczenie.");
                return;
            }

            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(proof.IssuedAt);
            var expiresAt = DateTimeOffset.FromUnixTimeSeconds(proof.ExpiresAt);

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
            try { signature = Base64Url.Decode(proof.Signature ?? string.Empty); }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny podpis.");
                return;
            }

            var record = new CertificateRecord
            {
                Id = certificateId,
                SubjectRoleId = roleId,
                ScopeKind = ScopeKind.Area,
                ScopeId = areaId,
                Capability = capability,
                IssuedByRoleId = roleId,
                IssuedUtc = issuedAt,
                ExpiresUtc = expiresAt
            };

            if (!Verify(record, issuer, signature))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis się nie zgadza.");
                return;
            }

            records.Add((record, signature));
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var area = new SqlCommand("""
                INSERT INTO app.area (id, name, current_epoch, created_at)
                VALUES (@id, @name, 1, @now);
                """, connection, tx))
            {
                area.Parameters.AddWithValue("@id", areaId);
                area.Parameters.AddWithValue("@name", name);
                area.Parameters.AddWithValue("@now", now);
                await area.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var epoch = new SqlCommand("""
                INSERT INTO app.area_epoch (area_id, epoch, reason, cut_by_role_id, created_at)
                VALUES (@area, 1, N'initial', @role, @now);
                """, connection, tx))
            {
                epoch.Parameters.AddWithValue("@area", areaId);
                epoch.Parameters.AddWithValue("@role", roleId);
                epoch.Parameters.AddWithValue("@now", now);
                await epoch.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await GrantKeyAsync(connection, tx, roleId, areaId, 1, wrapped, roleId, now, ctx.RequestAborted);

            foreach (var (record, signature) in records)
            {
                await InsertCertificateAsync(connection, tx, record, signature, ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Taki obszar już istnieje.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(areaId),
            name,
            epoch = 1,
            roleId = Ids.ToText(roleId)
        });
    }

    /* -- Zeigen ------------------------------------------------------------- */

    /// <summary>
    /// Die Bereiche, an denen eine meiner Rollen ein Zertifikat hält — mit den
    /// Epochen, für die ich auch einen Schlüssel habe.
    ///
    /// <para>
    /// Beides getrennt ausgewiesen, weil es zwei verschiedene Dinge sind. Ein
    /// Bereich, den ich lesen DARF, dessen Schlüssel ich aber nicht habe, ist
    /// kein Fehler: er heisst „vor deiner Zeit".
    /// </para>
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { areas = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT a.id, a.name, a.current_epoch,
                   (SELECT COUNT(*) FROM app.key_grant g
                     WHERE g.key_kind = N'epoch' AND g.key_ref = a.id
                       AND g.destroyed_at IS NULL AND g.role_id IN ({names})) AS held,
                   (SELECT COUNT(*) FROM app.area_epoch e
                     WHERE e.area_id = a.id AND e.key_public IS NOT NULL) AS published
            FROM app.area a
            WHERE EXISTS (
                SELECT 1 FROM app.certificate c
                 WHERE c.scope_kind = N'area' AND c.scope_id = a.id
                   AND c.revoked_at IS NULL AND c.expires_at > @now
                   AND c.subject_role_id IN ({names}))
            ORDER BY a.name;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var areas = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            areas.Add(new
            {
                areaId = Ids.ToText(reader.GetGuid(0)),
                name = reader.GetString(1),
                currentEpoch = reader.GetInt32(2),

                // Wie viele Epochen ich öffnen kann, und wie viele offenliegen.
                heldEpochs = reader.GetInt32(3),
                publishedEpochs = reader.GetInt32(4)
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { areas });
    }

    /// <summary>
    /// Wer in diesem Bereich ist — mit dem öffentlichen Verpackungsschlüssel.
    ///
    /// <para>
    /// Den braucht der Browser, um einem Neuen den Epochenschlüssel zu
    /// verpacken. Er ist öffentlich; ihn herauszugeben verrät nichts, was nicht
    /// ohnehin an der Rolle steht.
    /// </para>
    /// </summary>
    private static async Task MembersAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            // „Darfst du nicht" und „gibt es nicht" bekommen dieselbe Antwort.
            // Sonst wäre die Fehlermeldung ein Verzeichnis aller Bereiche.
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            SELECT DISTINCT r.id, r.kind, r.wrap_public_key
            FROM app.certificate c
            JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
            WHERE c.scope_kind = N'area' AND c.scope_id = @area
              AND c.revoked_at IS NULL AND c.expires_at > @now;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var members = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            members.Add(new
            {
                roleId = Ids.ToText(reader.GetGuid(0)),
                kind = reader.GetString(1),
                wrapPublicKey = Base64Url.Encode((byte[])reader[2])
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), members });
    }

    /// <summary>
    /// Die Huellen der Epochenschluessel, die MEINE Rollen halten.
    ///
    /// <para>
    /// <b>Der Dienst gibt hier nichts preis.</b> Was hinausgeht, ist genau das,
    /// was ohnehin schon fuer diese Rolle verpackt in der Zuteilung liegt — mit
    /// dem RSA-Privatschluessel dieser Rolle, den nur der Browser hat. Ohne ihn
    /// ist es Rauschen.
    /// </para>
    ///
    /// <para>
    /// Warum es das ueberhaupt gibt: der Epochenschluessel entsteht im Browser
    /// und lebt im Speicher des Tabs. Nach einem Neuladen waere er fort, und mit
    /// ihm die Faehigkeit, die Epoche offenzulegen oder ein weiteres Feld zu
    /// versiegeln. Das ist derselbe Weg, auf dem der Bund (`keys.ts`) schon die
    /// Rollenschluessel zurueckholt — nur eben fuer die Epoche.
    /// </para>
    /// </summary>
    private static async Task MyKeysAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);

        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), keys = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT role_id, key_epoch, sealed_blob
            FROM app.key_grant
            WHERE key_kind = N'epoch' AND key_ref = @area
              AND destroyed_at IS NULL AND key_epoch IS NOT NULL
              AND role_id IN ({names})
            ORDER BY key_epoch;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var keys = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            keys.Add(new
            {
                // WELCHE Rolle sie aufbekommt. Ohne das muesste der Browser
                // jeden Rollenschluessel durchprobieren.
                roleId = Ids.ToText(reader.GetGuid(0)),
                epoch = reader.GetInt32(1),
                sealedBlob = Base64Url.Encode((byte[])reader[2])
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), keys });
    }

    /* -- Weitergeben -------------------------------------------------------- */

    public sealed record GrantRequest(
        string RoleId, int Epoch, string WrappedKey, string IssuerRoleId, Proof Certificate);

    /// <summary>
    /// Einem anderen den Epochenschlüssel geben — und das Recht dazu.
    ///
    /// <para>
    /// <b>Zuteilung und Zertifikat entstehen zusammen</b>, in einer Transaktion.
    /// Getrennt entstünde entweder ein Recht ohne Schlüssel (darf, kann nicht)
    /// oder ein Schlüssel ohne Recht (kann, darf nicht) — und beides sieht von
    /// aussen aus wie ein Fehler der Plattform.
    /// </para>
    /// </summary>
    private static async Task GrantAsync(HttpContext ctx, Db db, Guid id, GrantRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var subjectId)
            || !Guid.TryParse(body.IssuerRoleId, out var issuerId)
            || !Guid.TryParse(body.Certificate?.Id ?? string.Empty, out var certificateId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Epoka zaczyna się od 1.");
            return;
        }

        if (!Capabilities.TryParse(body.Certificate!.Capability, out var capability))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Stopień: read, write, admin albo certify.");
            return;
        }

        byte[] wrapped, signature;
        try
        {
            wrapped = Base64Url.Decode(body.WrappedKey ?? string.Empty);
            signature = Base64Url.Decode(body.Certificate.Signature ?? string.Empty);
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz albo podpis.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == issuerId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nic nie wystawisz.");
            return;
        }

        // DARF: ohne `certify` lässt hier niemand jemanden herein.
        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Certify, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tu nikogo nie wpuszczasz.");
            return;
        }

        var issuer = await PublicSignKeyAsync(connection, issuerId, ctx.RequestAborted);
        if (issuer is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var issuedAt = DateTimeOffset.FromUnixTimeSeconds(body.Certificate.IssuedAt);
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(body.Certificate.ExpiresAt);

        if (issuedAt > now + ClockSlack || issuedAt < now - ClockSlack
            || expiresAt <= issuedAt || expiresAt > now + MaxLife)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Data albo ważność zaświadczenia się nie zgadza.");
            return;
        }

        var record = new CertificateRecord
        {
            Id = certificateId,
            SubjectRoleId = subjectId,
            ScopeKind = ScopeKind.Area,
            ScopeId = id,
            Capability = capability,
            IssuedByRoleId = issuerId,
            IssuedUtc = issuedAt,
            ExpiresUtc = expiresAt
        };

        if (!Verify(record, issuer, signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis się nie zgadza.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await GrantKeyAsync(connection, tx, subjectId, id, body.Epoch, wrapped, issuerId, now,
                ctx.RequestAborted);

            await InsertCertificateAsync(connection, tx, record, signature, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta rola ma już ten klucz.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            roleId = Ids.ToText(subjectId),
            epoch = body.Epoch
        });
    }

    /* -- Offenlegen --------------------------------------------------------- */

    public sealed record PublishRequest(int Epoch, string Key);

    /// <summary>
    /// Einen Epochenschlüssel offenlegen.
    ///
    /// <para>
    /// <b>Das ist keine Einstellung, sondern eine Tatsache.</b> Danach steht der
    /// Schlüssel da, und jeder öffnet, was unter dieser Epoche liegt. Der Dienst
    /// muss dafür nichts beachten — es gibt nichts mehr zu verschweigen.
    /// </para>
    ///
    /// <para>
    /// <b>Und es ist nicht rückgängig zu machen.</b> Wer ihn gesehen hat, hat
    /// ihn. `key_public` wieder zu leeren verschlösse nichts; wer Künftiges
    /// schützen will, schneidet eine neue Epoche. Deshalb nimmt diese Stelle
    /// auch keinen Rückzieher entgegen — ein Knopf, der nichts bewirkt, wäre
    /// eine Lüge.
    /// </para>
    /// </summary>
    private static async Task PublishAsync(HttpContext ctx, Db db, Guid id, PublishRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        byte[] key;
        try { key = Base64Url.Decode(body.Key ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        if (key.Length != KeySize)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Klucz ma 32 bajty.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * `admin` und nicht `certify`: jemanden hereinzulassen ist eine
         * Entscheidung über EINEN Menschen, das Offenlegen eine über ALLE. Das
         * ist nicht dieselbe Schwere.
         */
        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.area_epoch SET key_public = @key
            WHERE area_id = @area AND epoch = @epoch AND key_public IS NULL;
            """, connection);

        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@epoch", body.Epoch);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            /*
             * Entweder gibt es die Epoche nicht, oder sie liegt schon offen.
             * Beides ist kein Schaden: im zweiten Fall ist das Ziel erreicht,
             * und den ersten Fall auszuweisen hiesse, die Epochen eines
             * fremden Bereichs abzählen zu lassen.
             */
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Tej epoki nie ma albo jest już jawna.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            epoch = body.Epoch,
            published = true
        });
    }

    /// <summary>
    /// Einen offengelegten Epochenschlüssel holen — OHNE Konto.
    ///
    /// <para>
    /// Das ist die Gegenseite von <see cref="PublishAsync"/> und der Grund,
    /// warum „öffentlich" hier etwas bedeutet: ein Besucher, den die Plattform
    /// nicht kennt, bekommt den Schlüssel und öffnet damit, was offen sein soll.
    /// </para>
    ///
    /// <para>
    /// Eine nicht offengelegte Epoche antwortet wie eine, die es nicht gibt.
    /// Der Unterschied ginge sonst als Verzeichnis hinaus.
    /// </para>
    /// </summary>
    private static async Task PublicKeyAsync(HttpContext ctx, Db db, Guid id, int? epoch)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand(epoch is null
            ? """
              SELECT TOP 1 epoch, key_public FROM app.area_epoch
              WHERE area_id = @area AND key_public IS NOT NULL
              ORDER BY epoch DESC;
              """
            : """
              SELECT epoch, key_public FROM app.area_epoch
              WHERE area_id = @area AND epoch = @epoch AND key_public IS NOT NULL;
              """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        if (epoch is not null) cmd.Parameters.AddWithValue("@epoch", epoch.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nic tu nie jest jawne.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            epoch = reader.GetInt32(0),
            key = Base64Url.Encode((byte[])reader[1])
        });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>
    /// Darf diese Person hier, was sie vorhat?
    ///
    /// <para>
    /// Gefragt wird über ALLE erreichbaren Rollen — Erreichbarkeit im
    /// Rollengraphen IST der Weg zum Schlüssel (Kernel: RoleKeys), und eine
    /// zweite Auffassung davon liefe irgendwann anders.
    /// </para>
    /// </summary>
    /*
     * `internal`, nicht `private`: der Kalender fragt dieselbe Frage, und zwar
     * an vier Stellen. Eine zweite Fassung davon waere eine zweite Meinung
     * darueber, wer wo darf — und die eine davon liefe irgendwann anders.
     */
    internal static async Task<bool> MayAsync(
        SqlConnection connection, Guid accountId, Guid areaId, Capability needed, CancellationToken ct)
    {
        var mine = await Workspace.RolesOfAsync(connection, accountId, ct);
        if (mine.Count == 0) return false;

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT capability FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area
              AND revoked_at IS NULL AND expires_at > @now
              AND subject_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var held = new List<Capability>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (Capabilities.TryParse(reader.GetString(0), out var capability)) held.Add(capability);
        }

        return Capabilities.CoversAny(held, needed);
    }

    private static async Task<byte[]?> PublicSignKeyAsync(
        SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection);

        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) as byte[];
    }

    private static async Task GrantKeyAsync(
        SqlConnection connection, SqlTransaction tx, Guid roleId, Guid areaId, int epoch,
        byte[] wrapped, Guid byRoleId, DateTimeOffset now, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.key_grant
                (id, role_id, key_kind, key_ref, key_epoch, sealed_blob, granted_by_role_id, created_at)
            VALUES (@id, @role, N'epoch', @area, @epoch, @blob, @by, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", Ids.NewId());
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@epoch", epoch);
        cmd.Parameters.AddWithValue("@blob", wrapped);
        cmd.Parameters.AddWithValue("@by", byRoleId);
        cmd.Parameters.AddWithValue("@now", now);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task InsertCertificateAsync(
        SqlConnection connection, SqlTransaction tx, CertificateRecord record, byte[] signature,
        CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.certificate
                (id, subject_role_id, scope_kind, scope_id, capability, issued_by_role_id,
                 signature, issued_at, expires_at)
            VALUES (@id, @subject, N'area', @scope, @cap, @by, @sig, @issued, @expires);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", record.Id);
        cmd.Parameters.AddWithValue("@subject", record.SubjectRoleId);
        cmd.Parameters.AddWithValue("@scope", record.ScopeId);
        cmd.Parameters.AddWithValue("@cap", Capabilities.ToText(record.Capability));
        cmd.Parameters.AddWithValue("@by", record.IssuedByRoleId);
        cmd.Parameters.AddWithValue("@sig", signature);
        cmd.Parameters.AddWithValue("@issued", record.IssuedUtc);
        cmd.Parameters.AddWithValue("@expires", record.ExpiresUtc);

        await cmd.ExecuteNonQueryAsync(ct);
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
