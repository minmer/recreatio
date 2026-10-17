using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Bereiche zeigen, ihre Mitglieder und Schlüssel; Zugang weitergeben.</summary>
public static partial class Area
{
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
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* Ein Konto — oder die Links mit Zugang in diesem Browser: dieselbe Liste, aus ihren Rollen. */
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var mine = caller.Roles;
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
                       getrennt gemeldet — wer `admin` hat, darf es mit.
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
                           AND c.capability IN (N'certify', N'admin')
                           AND c.subject_role_id IN ({names})) THEN 1 ELSE 0 END AS bit) AS mayCertify,

                   /* 0054 — der eigene Bereich einer MEINER Personen. */
                   CAST(CASE WHEN a.personal_role_id IN ({names}) THEN 1 ELSE 0 END AS bit) AS personal,

                   /* Der eigene Bereich einer Rozmowa (Gruppe, zu zweit) — in Auswahllisten ein eigener Abschnitt. */
                   (SELECT TOP 1 c.kind FROM app.chat c WHERE c.area_id = a.id AND c.kind IN (N'group', N'direct'))
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
                mayCertify = reader.GetBoolean(9),

                /* 0054 — „Tylko ja": nirgends anbieten, wo etwas geteilt wird. */
                personal = reader.GetBoolean(10),
                ownChat = reader.IsDBNull(11) ? null : reader.GetString(11)
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
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* Auch ein Link, der den Bereich liest: wer einen Termin einträgt, wählt, wer da sein muss. */
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!await MayAsync(connection, caller, id, Capability.Read, ctx.RequestAborted))
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
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* Auch die Linkrollen eines Browsers: ihre Hüllen öffnet nur, wer das Geheimnis des Links kennt. */
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!await MayAsync(connection, caller, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var mine = caller.Roles;

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

        /* DER EMPFAENGER DARF KEIN KONTO SEIN (0040) — auch kein fremdes. */
        if (await Workspace.IsAnyAccountAsync(connection, null, subjectId, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
            return;
        }

        // DARF: ohne `certify` lässt hier niemand jemanden herein.
        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Certify, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tu nikogo nie wpuszczasz.");
            return;
        }

        /*
         * „TYLKO JA" (0054) HEISST: NUR ICH. Der eigene Bereich nimmt die
         * Person, der er gehört — eine neue Epoche für sie selbst —, sonst
         * niemanden. Wer etwas mit anderen teilen will, wählt deren Gruppe.
         */
        var personalOwner = await PersonalOwnerAsync(connection, id, ctx.RequestAborted);
        if (personalOwner is not null && personalOwner != subjectId)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, PersonalStaysPersonal);
            return;
        }

        /*
         * JEDER BEREICH HAT SEINE EIGENEN ROLLEN.
         *
         * Hier stand die Voraussetzung der Verschachtelung (0035): wer in
         * einen inneren Bereich soll, muss im aeusseren stehen. Sie ist
         * gefallen. Ein Katechet der Firmgruppe muss nicht zur ganzen Pfarrei
         * gehoeren, um die Gruppe zu fuehren — und wer ihn trotzdem aussen
         * haben wollte, musste ihn dort erst anlegen, nur um ihn innen
         * aufnehmen zu duerfen. Die Verschachtelung ordnet die Bereiche; wer
         * in welchem steht, entscheidet jeder fuer sich.
         */

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
}
