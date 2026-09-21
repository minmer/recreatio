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
         * Die Gestalt eines Bereichs (0035): wie weit er nach aussen offen
         * steht, und was jemand sieht, der ueber ein Formular hereinkommt.
         */
        app.MapPost("/workspace/area/{id:guid}/public", SetPublicAsync);
        app.MapPost("/workspace/area/{id:guid}/seat-level", SetSeatLevelAsync);
        app.MapPost("/workspace/area/{id:guid}/drop", DropAsync);

        /*
         * DIE VORLAGE DES PORTALS (0028) — eine ganz gewoehnliche Seite, deren
         * Bausteine jeder Platz dieses Bereichs zu sehen bekommt. Eine Vorlage
         * je Bereich: alle sehen denselben Aufbau, verschieden ist nur, was in
         * den persoenlichen Bausteinen steht.
         */
        app.MapGet("/workspace/area/{id:guid}/portal", PortalAsync);
        app.MapPost("/workspace/area/{id:guid}/portal", SetPortalAsync);

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
        string AreaId, string Name, string RoleId, string WrappedKey, IReadOnlyList<Proof> Certificates,

        /// <summary>Unter welchem Bereich er liegt — `null` heisst: ganz aussen (0035).</summary>
        string? ParentAreaId = null);

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

        /*
         * DER VATER (0035). Wer einen inneren Bereich anlegt, muss den
         * aeusseren VERWALTEN — sonst haengte sich jeder mit Lesezugang einen
         * Bereich unter fremde Ordnung.
         */
        Guid? parentId = null;

        if (body.ParentAreaId is not null)
        {
            if (!Guid.TryParse(body.ParentAreaId, out var asked))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru nadrzędnego.");
                return;
            }

            parentId = asked;
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
         * WER INNEN ANLEGT, MUSS AUSSEN VERWALTEN (0035).
         *
         * Sonst haengte sich jeder, der die Messe nur liest, einen Bereich
         * unter sie — und die Verschachtelung waere eine Behauptung ueber
         * Ordnung statt einer Ordnung.
         *
         * Und die Rolle, auf die der neue Bereich laeuft, muss im aeusseren
         * stehen: die Voraussetzung gilt vom ersten Zertifikat an, nicht erst
         * ab dem zweiten.
         */
        if (parentId is not null)
        {
            if (!await MayAsync(connection, who.Value.AccountId, parentId.Value,
                    Capability.Admin, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nadrzędnego nie ma.");
                return;
            }

            if (!await InAreaAsync(connection, null, parentId.Value, [roleId], ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Ta rola nie należy do obszaru nadrzędnego — najpierw dodaj ją tam.");
                return;
            }
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
                INSERT INTO app.area (id, name, current_epoch, created_at, parent_area_id)
                VALUES (@id, @name, 1, @now, @parent);
                """, connection, tx))
            {
                area.Parameters.AddWithValue("@id", areaId);
                area.Parameters.AddWithValue("@name", name);
                area.Parameters.AddWithValue("@now", now);
                area.Parameters.AddWithValue("@parent", (object?)parentId ?? DBNull.Value);
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
                     WHERE e.area_id = a.id AND e.key_public IS NOT NULL) AS published,
                   a.parent_area_id, a.public_level, a.seat_level,

                   /*
                       MEINE eigene Stufe — die staerkste, die eine meiner
                       Rollen traegt. Ohne sie muesste die Oberflaeche raten,
                       ob sie einen Knopf anbieten darf, und ein Knopf, der
                       beim Druecken 403 sagt, ist schlimmer als keiner.

                       `certify` steht neben der Leiter (3.5) und wird deshalb
                       getrennt gemeldet, nicht in dieselbe Spalte gequetscht.
                   */
                   (SELECT TOP 1 c.capability FROM app.certificate c
                     WHERE c.scope_kind = N'area' AND c.scope_id = a.id
                       AND c.revoked_at IS NULL AND c.expires_at > @now
                       AND c.capability <> N'certify'
                       AND c.subject_role_id IN ({names})
                     ORDER BY CASE c.capability
                                WHEN N'admin' THEN 3 WHEN N'write' THEN 2 ELSE 1 END DESC) AS mine,

                   CAST(CASE WHEN EXISTS (
                        SELECT 1 FROM app.certificate c
                         WHERE c.scope_kind = N'area' AND c.scope_id = a.id
                           AND c.revoked_at IS NULL AND c.expires_at > @now
                           AND c.capability = N'certify'
                           AND c.subject_role_id IN ({names})) THEN 1 ELSE 0 END AS bit) AS mayCertify
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
                publishedEpochs = reader.GetInt32(4),

                /* Wo er liegt — `null` heisst: ganz aussen. */
                parentAreaId = reader.IsDBNull(5) ? null : Ids.ToText(reader.GetGuid(5)),

                /* Was von aussen geht, und was ein Formularmensch sieht (0035). */
                publicLevel = reader.GetString(6),
                seatLevel = reader.GetString(7),

                /* Und was ICH hier darf — damit die Oberflaeche nicht raet. */
                myLevel = reader.IsDBNull(8) ? null : reader.GetString(8),
                mayCertify = reader.GetBoolean(9)
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
            SELECT r.id, r.kind, r.wrap_public_key, c.capability
            FROM app.certificate c
            JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
            WHERE c.scope_kind = N'area' AND c.scope_id = @area
              AND c.revoked_at IS NULL AND c.expires_at > @now;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        /*
         * EINE ZEILE JE ROLLE, mit ALLEN ihren Stufen.
         *
         * Die Abfrage liefert je Zertifikat eine Zeile — eine Rolle mit
         * `admin` und `certify` kaeme also zweimal. Das waere zweierlei
         * falsch: die Liste zaehlte Menschen doppelt, und wer sie anzeigt,
         * muesste selbst gruppieren.
         *
         * Zusammengefasst wird zu einer LISTE und nicht zu einem Wert:
         * `certify` steht neben der Leiter (3.5), und „die hoechste Stufe"
         * verschluckte genau den Fall, fuer den es sie gibt — den Pfarrer, der
         * jemanden aufnimmt, ohne selbst hineinzusehen.
         */
        var found = new Dictionary<Guid, (string Kind, byte[] Wrap, List<string> Caps)>();
        var order = new List<Guid>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            var roleId = reader.GetGuid(0);

            if (!found.TryGetValue(roleId, out var row))
            {
                row = (reader.GetString(1), (byte[])reader[2], []);
                found[roleId] = row;
                order.Add(roleId);
            }

            var capability = reader.GetString(3);
            if (!row.Caps.Contains(capability)) row.Caps.Add(capability);
        }

        var members = order.Select(roleId =>
        {
            var row = found[roleId];

            return (object)new
            {
                roleId = Ids.ToText(roleId),
                kind = row.Kind,
                wrapPublicKey = Base64Url.Encode(row.Wrap),

                /* Alle Stufen dieser Rolle — `read`/`write`/`admin` und `certify`. */
                capabilities = row.Caps
            };
        }).ToList();

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

        /*
         * DIE VORAUSSETZUNG DER VERSCHACHTELUNG (0035).
         *
         * Wer in einen inneren Bereich soll, muss im aeusseren stehen. Das ist
         * keine Vererbung — aussen zu stehen gibt innen NICHTS —, sondern eine
         * Bedingung: die Spenden liegen innerhalb der Messe, und wer von den
         * Spenden etwas wissen darf, gehoert zuerst zur Messe.
         *
         * Geprueft wird die blosse Zugehoerigkeit, nicht die Hoehe: wer die
         * Messe nur liest, darf in den Spendenbereich aufgenommen werden — mit
         * welcher Stufe dort, entscheidet dieser Bereich selbst.
         *
         * ABGELEHNT WIRD MIT GRUND. Ein blosses 403 liesse den Verwalter
         * raten, warum eine Zusage nicht ankommt, die er gerade unterschrieben
         * hat.
         */
        var parent = await ParentOfAsync(connection, null, id, ctx.RequestAborted);

        if (parent is not null
            && !await InAreaAsync(connection, null, parent.Value, [subjectId], ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ta rola nie należy do obszaru nadrzędnego — najpierw dodaj ją tam.");
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
    /* -- Die Vorlage des Portals (0028) ------------------------------------ */

    public sealed record PortalRequest(string? Path);

    private static async Task PortalAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            SELECT s.path FROM app.area_portal p
            JOIN app.slug s ON s.id = p.slug_id
            WHERE p.area_id = @area;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            path = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as string
        });
    }

    /// <summary>
    /// Eine Seite zur Vorlage des Portals erklaeren — oder die Erklaerung
    /// zuruecknehmen (<c>path = null</c>).
    ///
    /// <para>
    /// <b>ZWEI Rechte, wie beim Formularfeld.</b> Wer die Vorlage bestimmt,
    /// entscheidet, was jeder Platz dieses Bereichs zu sehen bekommt — dafuer
    /// braucht er das Recht am BEREICH. Und er bindet eine fremde Seite ein —
    /// dafuer braucht er das Recht an DIESER ADRESSE. Eines allein genuegte,
    /// um eine fremde Seite in ein fremdes Portal zu haengen.
    /// </para>
    ///
    /// <para>
    /// <b>Oeffentlich sollte sie nicht sein</b>, und der Dienst sagt es, statt
    /// es zu erzwingen: eine Vorlage ohne <c>internal_for_role_id</c> (0026)
    /// steht auch unter ihrer eigenen Adresse. Manchmal ist genau das gewollt —
    /// deshalb ein Hinweis in der Antwort und keine Ablehnung.
    /// </para>
    /// </summary>
    private static async Task SetPortalAsync(HttpContext ctx, Db db, Guid id, PortalRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        if (string.IsNullOrWhiteSpace(body.Path))
        {
            await using var drop = new SqlCommand(
                "DELETE FROM app.area_portal WHERE area_id = @area;", connection);

            drop.Parameters.AddWithValue("@area", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), path = (string?)null });
            return;
        }

        var path = Slug.Normalise(body.Path);

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        Guid slugId;
        bool isInternal;

        await using (var find = new SqlCommand(
            "SELECT id, internal_for_role_id FROM app.slug WHERE path = @p;", connection))
        {
            find.Parameters.AddWithValue("@p", path);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }

            slugId = reader.GetGuid(0);
            isInternal = !reader.IsDBNull(1);
        }

        await using (var save = new SqlCommand("""
            MERGE app.area_portal AS target
            USING (SELECT @area AS area_id) AS source ON target.area_id = source.area_id
            WHEN MATCHED THEN UPDATE SET slug_id = @slug
            WHEN NOT MATCHED THEN INSERT (area_id, slug_id, created_at) VALUES (@area, @slug, @now);
            """, connection))
        {
            save.Parameters.AddWithValue("@area", id);
            save.Parameters.AddWithValue("@slug", slugId);
            save.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            path,

            /*
             * Keine Ablehnung, eine Auskunft: die Vorlage steht sonst auch unter
             * ihrer eigenen Adresse, und wer das nicht will, macht sie intern.
             */
            warning = isInternal ? null
                : "Ta strona jest publiczna — każdy, kto zna jej adres, zobaczy szablon portalu. "
                  + "Przypisz ją roli w drzewie adresów, żeby zniknęła dla postronnych."
        });
    }

    /// <summary>
    /// Ob <paramref name="roleIds"/> im Bereich <paramref name="areaId"/> steht —
    /// irgendeine Stufe genuegt.
    ///
    /// <para>
    /// <b>Die Voraussetzung der Verschachtelung</b> (0035): wer in einen inneren
    /// Bereich soll, muss im aeusseren stehen. Geprueft wird die blosse
    /// Zugehoerigkeit und nicht die Hoehe — wer die Messe nur liest, darf
    /// trotzdem in den Spendenbereich aufgenommen werden, und mit welcher Stufe
    /// dort, entscheidet der Spendenbereich selbst.
    /// </para>
    /// </summary>
    private static async Task<bool> InAreaAsync(
        SqlConnection connection, SqlTransaction? tx, Guid areaId, IReadOnlyList<Guid> roleIds,
        CancellationToken ct)
    {
        if (roleIds.Count == 0) return false;

        var names = string.Join(", ", roleIds.Select((_, i) => $"@p{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT TOP 1 1 FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area
              AND revoked_at IS NULL AND expires_at > @now
              AND subject_role_id IN ({names});
            """, connection, tx);

        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < roleIds.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", roleIds[i]);

        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>Der Vater eines Bereichs, oder <c>null</c>.</summary>
    private static async Task<Guid?> ParentOfAsync(
        SqlConnection connection, SqlTransaction? tx, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT parent_area_id FROM app.area WHERE id = @id;", connection, tx);

        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    /// <summary>
    /// Wuerde <paramref name="child"/> unter <paramref name="parent"/> einen
    /// Kreis schliessen?
    ///
    /// <para>
    /// Eine Pruefbedingung faengt nur den unmittelbaren Fall (ein Bereich ist
    /// nicht sein eigener Vater). <c>A &gt; B &gt; A</c> muss der Dienst
    /// abfangen, und zwar IN der Transaktion — sonst entsteht zwischen Pruefung
    /// und Schreiben genau die Kante, die den Kreis schliesst.
    /// </para>
    /// </summary>
    private static async Task<bool> WouldLoopAsync(
        SqlConnection connection, SqlTransaction? tx, Guid child, Guid parent, CancellationToken ct)
    {
        var at = (Guid?)parent;

        /* Tiefenbegrenzung wie beim Rollengraphen: gegen Kreise hilft die
           besuchte Menge, gegen unbezahlbar tiefe Baeume die Zahl. */
        for (var depth = 0; depth < 32 && at is not null; depth++)
        {
            if (at == child) return true;
            at = await ParentOfAsync(connection, tx, at.Value, ct);
        }

        return false;
    }

    public sealed record PublicRequest(string Level, string? Key);

    /// <summary>
    /// Wie weit dieser Bereich nach aussen offen steht (0035).
    ///
    /// <code>
    ///   none    niemand von aussen
    ///   read    jeder darf lesen        (Messzeiten)
    ///   write   jeder darf lesen und einsenden
    /// </code>
    ///
    /// <para>
    /// <b>Absicht und Schluessel gehen zusammen.</b> Lesen von aussen ist
    /// nicht eine Erlaubnis, sondern ein SCHLUESSEL: wer ihn hat, liest. Diese
    /// Stelle setzt deshalb beides in einem Zug — wer hochsetzt, schickt den
    /// veroeffentlichten Epochenschluessel mit; wer auf <c>none</c> zurueckgeht,
    /// nimmt ihn zurueck.
    /// </para>
    ///
    /// <para>
    /// <b>Zuruecknehmen ist kein Ungeschehenmachen</b>, und der Dienst tut auch
    /// nicht so. Wer den Schluessel gelesen hat, hat ihn; was aufhoert, ist der
    /// Zugriff auf das, was danach kommt. Solange es keine Epochenrotation
    /// gibt, gilt das uneingeschraenkt, und die Oberflaeche hat es zu sagen.
    /// </para>
    /// </summary>
    private static async Task SetPublicAsync(HttpContext ctx, Db db, Guid id, PublicRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var level = (body.Level ?? string.Empty).Trim().ToLowerInvariant();

        if (level is not ("none" or "read" or "write"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Otwartość: none, read albo write.");
            return;
        }

        byte[]? key = null;

        if (level != "none")
        {
            try { key = Base64Url.Decode(body.Key ?? string.Empty); }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
                return;
            }

            if (key.Length != KeySize)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Żeby otworzyć obszar, trzeba podać jego klucz epoki (32 bajty).");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var set = new SqlCommand(
                "UPDATE app.area SET public_level = @level WHERE id = @id;", connection, tx))
            {
                set.Parameters.AddWithValue("@level", level);
                set.Parameters.AddWithValue("@id", id);
                await set.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var epoch = new SqlCommand("""
                UPDATE app.area_epoch SET key_public = @key
                WHERE area_id = @area AND epoch = (SELECT current_epoch FROM app.area WHERE id = @area);
                """, connection, tx))
            {
                epoch.Parameters.AddBlob("@key", key);
                epoch.Parameters.AddWithValue("@area", id);
                await epoch.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), publicLevel = level });
    }

    public sealed record SeatLevelRequest(string Level);

    /// <summary>
    /// Was jemand sieht, der ueber ein FORMULAR hereinkommt (0035).
    ///
    /// <code>
    ///   own     nur das Eigene (Vorgabe)
    ///   read    dazu das Gemeinsame lesen
    ///   write   dazu beitragen
    /// </code>
    ///
    /// <para>
    /// <b>Das Eigene ist nie die Frage.</b> Wer sich anmeldet, bekommt einen
    /// Platz und damit vollen Zugriff auf seine eigene Einsendung — sie gehoert
    /// ihm. Hier geht es nur um das Uebrige.
    /// </para>
    ///
    /// <para>
    /// <b>Die Stufe haengt am BEREICH und nicht am Formular.</b> Das Formular
    /// sagt, wohin es fuehrt; was man dort sieht, sagt der Verwalter — einmal,
    /// und nicht je Anmeldung.
    /// </para>
    /// </summary>
    private static async Task SetSeatLevelAsync(HttpContext ctx, Db db, Guid id, SeatLevelRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var level = (body.Level ?? string.Empty).Trim().ToLowerInvariant();

        if (level is not ("own" or "read" or "write"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Dostęp z formularza: own, read albo write.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using (var set = new SqlCommand(
            "UPDATE app.area SET seat_level = @level WHERE id = @id;", connection))
        {
            set.Parameters.AddWithValue("@level", level);
            set.Parameters.AddWithValue("@id", id);
            await set.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), seatLevel = level });
    }

    public sealed record DropRequest(string RoleId);

    /// <summary>
    /// Eine Rolle wieder hinausnehmen.
    ///
    /// <para>
    /// <b>Zuerst die inneren Bereiche.</b> Faellt jemand aussen weg, waehrend
    /// er innen noch steht, ist die Voraussetzung der Verschachtelung verletzt —
    /// und zwar still. Der Dienst lehnt deshalb ab und nennt, wo es klemmt,
    /// statt eine Ordnung zu hinterlassen, die ihre eigene Regel bricht.
    /// </para>
    ///
    /// <para>
    /// <b>Und was er gelesen hat, hat er gelesen.</b> Das Zertifikat faellt,
    /// die Zuteilung faellt — der Schluessel, den sein Browser einmal
    /// ausgepackt hat, faellt nicht. Ohne Epochenrotation gibt es dagegen kein
    /// Mittel, und es waere unredlich, hier etwas anderes anzudeuten.
    /// </para>
    /// </summary>
    private static async Task DropAsync(HttpContext ctx, Db db, Guid id, DropRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var subjectId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Certify, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tu nikogo nie wypuszczasz.");
            return;
        }

        /* Steht die Rolle in einem Bereich, der IN diesem liegt? */
        await using (var inner = new SqlCommand("""
            SELECT TOP 1 a.name
            FROM app.area a
            JOIN app.certificate c ON c.scope_kind = N'area' AND c.scope_id = a.id
                                  AND c.revoked_at IS NULL AND c.expires_at > @now
                                  AND c.subject_role_id = @role
            WHERE a.parent_area_id = @area;
            """, connection))
        {
            inner.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            inner.Parameters.AddWithValue("@role", subjectId);
            inner.Parameters.AddWithValue("@area", id);

            if (await inner.ExecuteScalarAsync(ctx.RequestAborted) is string where)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Ta rola jest jeszcze w obszarze „{where}”, który leży w tym. Najpierw usuń ją stamtąd.");
                return;
            }
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var cmd = new SqlCommand("""
                UPDATE app.certificate SET revoked_at = @now
                WHERE scope_kind = N'area' AND scope_id = @area
                  AND subject_role_id = @role AND revoked_at IS NULL;

                UPDATE app.key_grant SET destroyed_at = @now
                WHERE key_kind = N'epoch' AND key_ref = @area
                  AND role_id = @role AND destroyed_at IS NULL;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                cmd.Parameters.AddWithValue("@area", id);
                cmd.Parameters.AddWithValue("@role", subjectId);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
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
            dropped = true,

            /* Ehrlich gesagt, nicht verschwiegen. */
            note = "Klucz, który ta rola już otworzyła, zostaje u niej. Odcięty jest dostęp do tego, co dalej."
        });
    }

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
