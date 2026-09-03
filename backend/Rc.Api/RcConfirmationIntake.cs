using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Die Selbstanmeldung zur Firmung — von jemandem OHNE Konto.
///
/// <b>Das Problem.</b> Ein Kandidat konnte bisher nur von innen entstehen:
/// jemand mit dem Epochenschluessel des Bereichs tippt die Daten ein. Ein
/// Jugendlicher, der sich selbst anmeldet, hat weder Konto noch Schluessel —
/// und der Server darf seine Daten nicht im Klartext bekommen, nur weil er
/// keinen hat.
///
/// <b>Der Weg</b> ist derselbe wie bei Veranstaltungen (<see cref="RcRegistrations"/>):
///
/// <code>
///   1. Die Gruppe hat ein RSA-Paar. Der oeffentliche Teil geht MIT dem
///      Formular hinaus.
///   2. Der Browser wuerfelt einen Sitzungsschluessel, versiegelt damit jedes
///      Feld und verpackt den Sitzungsschluessel unter dem oeffentlichen
///      Annahmeschluessel.
///   3. Der Server legt beides hin. Er kann nichts davon oeffnen.
///   4. Wer den Epochenschluessel hat, packt den privaten Annahmeschluessel
///      aus, damit den Sitzungsschluessel, damit die Felder.
/// </code>
///
/// <b>Der Portallink</b> ist das, was der Anmeldende zurueckbekommt: sein
/// einziger Weg zu den eigenen Daten, solange er kein Konto hat. Gespeichert
/// wird nur sein Abdruck — wer die Datenbank liest, sieht, DASS es ein Portal
/// gibt, und kommt nicht hinein.
///
/// <b>Die Zustimmung der Eltern bleibt auf Papier.</b> Kandidaten sind in aller
/// Regel minderjaehrig; eine Einwilligung, die ein Kind selbst anklickt, traegt
/// nicht. Das Formular nimmt die Anmeldung entgegen und setzt
/// <c>paper_received = 0</c> — die Pfarrei sieht damit, von wem noch etwas
/// fehlt.
/// </summary>
public static class RcConfirmationIntake
{
    public static void MapRcConfirmationIntake(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/public/confirmation/{slug}", FormAsync).Produces<RcConfirmationFormResponse>();
        app.MapPost("/rc/public/confirmation/{slug}/apply", ApplyAsync).Produces<RcCandidateAppliedResponse>();
        app.MapGet("/rc/public/candidate/{token}", PortalAsync).Produces<RcCandidatePortalResponse>();
        app.MapPost("/rc/public/candidate/{token}/bind", BindAsync).Produces<RcCandidateBoundResponse>();
        app.MapPost("/rc/public/candidate/{token}/revoke", RevokeAsync).Produces<RcCandidateRevokedResponse>();
        app.MapPost("/rc/confirmation-groups/{id:guid}/applications", OpenAsync).Produces<RcApplicationsOpenResponse>();
    }

    private static RcAad IntakeAad(Guid groupId) =>
        RcAad.Create("confirmation", "group", groupId, RcField.EventIntakeKey, 1);

    // -- Das Formular ---------------------------------------------------------

    /// <summary>
    /// Was der Browser braucht, um eine Anmeldung zu verschliessen.
    ///
    /// Der oeffentliche Annahmeschluessel ist kein Geheimnis: mit ihm laesst
    /// sich VERSCHLIESSEN und nichts oeffnen. Er darf deshalb ohne Konto
    /// herausgehen — genau dafuer ist er da.
    /// </summary>
    private static async Task FormAsync(HttpContext ctx, RcDb db, string slug)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT TOP 1 g.id, g.name, g.applications_open, g.intake_public_key, g.intake_epoch
            FROM dbo.rc_confirmation_group g
            JOIN dbo.rc_parish p ON p.id = g.parish_id
            WHERE p.slug = @slug AND g.lifecycle <> N'closed'
            ORDER BY g.created_at DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@slug", slug);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await RcResults.WriteJsonAsync(ctx, new RcConfirmationFormResponse(null, null, false, null, null));
            return;
        }

        var open = reader.GetBoolean(2) && !reader.IsDBNull(3);

        await RcResults.WriteJsonAsync(ctx, new RcConfirmationFormResponse(
            RcId.ToText(reader.GetGuid(0)),
            reader.GetString(1),
            open,

            // Ohne Annahmeschluessel kein Formular: der Browser koennte nichts
            // verschliessen und muesste im Klartext senden.
            open ? Convert.ToBase64String((byte[])reader[3]) : null,
            open && !reader.IsDBNull(4) ? reader.GetInt32(4) : null));
    }

    // -- Anmelden -------------------------------------------------------------

    /// <summary>Ein versiegeltes Feld. Der Server sieht nur Geheimtext.</summary>
    public sealed record SealedField(string Field, string Sealed);

    /// <param name="PortalTokenHash">
    /// SHA-256 des Portalgeheimnisses, das der BROWSER gewuerfelt hat.
    /// </param>
    /// <param name="PortalTokenWrapped">
    /// Dasselbe Geheimnis, verpackt unter dem oeffentlichen Annahmeschluessel
    /// der Gruppe — damit die Pfarrei den Link herstellen und verschicken kann.
    /// </param>
    public sealed record ApplyRequest(
        IReadOnlyList<SealedField> Fields, string SessionKeyWrapped, bool RodoAccepted,
        string PortalTokenHash, string PortalTokenWrapped);

    /// <summary>
    /// Die Anmeldung entgegennehmen.
    ///
    /// <b>Es entsteht sofort ein Kandidat</b> und kein Zwischending. Das ist
    /// eine Entscheidung: ein eigener Zustand „beantragt" waere eine zweite
    /// Liste, die jemand pflegen muss, und eine Anmeldung, die dort liegen
    /// bleibt, ist schlimmer als eine, die eingetragen ist und wieder
    /// ausgetragen werden kann.
    ///
    /// <b>Ohne Zustimmung zur Datenschutzerklaerung geht nichts.</b> Sie wird
    /// hier geprueft und nicht nur im Formular: ein Haken, den nur die
    /// Oberflaeche verlangt, ist kein Haken.
    /// </summary>
    private static async Task ApplyAsync(HttpContext ctx, RcDb db, string slug, ApplyRequest body)
    {
        if (!body.RodoAccepted)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.ConsentMissing,
                "Ohne Zustimmung zur Datenschutzerklaerung kann die Anmeldung nicht entgegengenommen werden.");
            return;
        }

        if (body.Fields is null || body.Fields.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Anmeldung ist leer.");
            return;
        }

        if (body.Fields.Count > 20)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Zu viele Felder.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid groupId;
        int intakeEpoch;
        await using (var find = new SqlCommand("""
            SELECT TOP 1 g.id, g.intake_epoch
            FROM dbo.rc_confirmation_group g
            JOIN dbo.rc_parish p ON p.id = g.parish_id
            WHERE p.slug = @slug AND g.applications_open = 1
              AND g.intake_public_key IS NOT NULL AND g.lifecycle <> N'closed'
            ORDER BY g.created_at DESC;
            """, connection))
        {
            find.Parameters.AddWithValue("@slug", slug);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                    RcErrorCodes.ApplicationsClosed, "Hier werden zurzeit keine Anmeldungen entgegengenommen.");
                return;
            }
            groupId = reader.GetGuid(0);
            intakeEpoch = reader.IsDBNull(1) ? 1 : reader.GetInt32(1);
        }

        /*
         * DAS PORTALGEHEIMNIS SIEHT DER SERVER NIE.
         *
         * Es wird im BROWSER gewuerfelt. Hierher kommen nur zwei Dinge:
         *
         *   der Abdruck        — zum Nachschlagen, oeffnet nichts
         *   die verpackte Form — unter dem oeffentlichen Annahmeschluessel der
         *                        Gruppe, damit die Pfarrei den Link herstellen
         *                        und per SMS verschicken kann
         *
         * Vorher wuerfelte der Server selbst. Der Abdruck lag dann zwar allein
         * in der Datenbank, aber das Geheimnis war einen Augenblick lang hier:
         * im Arbeitsspeicher, in einem Absturzabbild, in einer Ablaufspur. Wer
         * „nur der Abdruck wird gespeichert" sagt, darf es nicht vorher in der
         * Hand gehabt haben.
         */
        var tokenHash = SafeBase64(body.PortalTokenHash);
        var tokenWrapped = SafeBase64(body.PortalTokenWrapped);

        if (tokenHash is null || tokenHash.Length != 32 || tokenWrapped is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Zugang zur Anmeldung fehlt oder ist unbrauchbar.");
            return;
        }

        var candidateId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        var sealedByField = body.Fields.ToDictionary(f => f.Field, f => f.Sealed);
        byte[]? Field(string name) =>
            sealedByField.TryGetValue(name, out var text) ? SafeBase64(text) : null;

        var nameSealed = Field("name");
        if (nameSealed is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Name fehlt.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_candidate
                    (id, group_id, epoch, name_sealed, born_sealed, contact_sealed, school_sealed,
                     consent_given, paper_received, quiz_passed, status,
                     portal_token_hash, portal_token_wrapped, applied_at, created_at, updated_at)
                VALUES (@id, @group, @epoch, @name, @born, @contact, @school,
                        1, 0, 0, N'enrolled',
                        @token, @wrapped, @now, @now, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", candidateId);
                insert.Parameters.AddWithValue("@group", groupId);

                // Die Felder liegen NICHT unter der Epoche des Bereichs, sondern
                // unter dem Sitzungsschluessel. Die Zahl steht hier trotzdem —
                // sie sagt, welche Epoche galt, als die Anmeldung ankam.
                insert.Parameters.AddWithValue("@epoch", intakeEpoch);

                insert.Parameters.AddWithValue("@name", nameSealed);
                insert.Parameters.AddWithValue("@born", (object?)Field("born") ?? DBNull.Value);
                insert.Parameters.AddWithValue("@contact", (object?)Field("contact") ?? DBNull.Value);
                insert.Parameters.AddWithValue("@school", (object?)Field("school") ?? DBNull.Value);
                insert.Parameters.AddWithValue("@token", tokenHash);
                insert.Parameters.AddWithValue("@wrapped", tokenWrapped);
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var intake = new SqlCommand("""
                INSERT INTO dbo.rc_candidate_intake
                    (candidate_id, session_key_wrapped, intake_epoch, created_at)
                VALUES (@id, @key, @epoch, @now);
                """, connection, tx))
            {
                intake.Parameters.AddWithValue("@id", candidateId);
                intake.Parameters.AddWithValue("@key", SafeBase64(body.SessionKeyWrapped) ?? []);
                intake.Parameters.AddWithValue("@epoch", intakeEpoch);
                intake.Parameters.AddWithValue("@now", now);
                await intake.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        /*
         * Die Antwort traegt KEIN Geheimnis. Der Browser hat es gewuerfelt und
         * kennt es noch — er baut den Link daraus selbst.
         *
         * Das ist der Unterschied zwischen „der Server gibt den Link heraus"
         * und „der Server hat ihn nie gehabt".
         */
        await RcResults.WriteJsonAsync(ctx, new RcCandidateAppliedResponse(
            RcId.ToText(candidateId)), StatusCodes.Status201Created);
    }

    // -- Das Portal des Kandidaten -------------------------------------------

    /// <summary>
    /// Was jemand mit dem Portallink sieht.
    ///
    /// <b>Nicht seine Daten.</b> Sie liegen unter einem Sitzungsschluessel, der
    /// unter dem oeffentlichen Annahmeschluessel verpackt ist — der Server kann
    /// sie nicht oeffnen, und der Link enthaelt keinen Schluessel dafuer. Was
    /// hier steht, ist der STAND: dass die Anmeldung angekommen ist, in welcher
    /// Gruppe, und was noch fehlt.
    ///
    /// Das ist keine Einschraenkung, die sich beheben liesse — es ist die Folge
    /// davon, dass der Server nichts lesen kann. Waeren die Daten hier lesbar,
    /// waeren sie es auch fuer den Betreiber.
    /// </summary>
    private static async Task PortalAsync(HttpContext ctx, RcDb db, string token)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ByTokenAsync(connection, token, ctx.RequestAborted);
        if (found is null) { await NotFound(ctx); return; }

        if (found.RevokedAt is not null)
        {
            // Ein entwerteter Link ist kein Fehler und kein Geheimnis: wer ihn
            // noch hat, soll erfahren, dass er nicht mehr gilt, statt vor einer
            // Seite zu stehen, die nichts sagt.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status410Gone,
                RcErrorCodes.PortalRevoked,
                "Dieser Zugang wurde abgeschaltet. Die Anmeldung liegt jetzt beim verbundenen Konto.");
            return;
        }

        /*
         * DIE FELDER GEHEN VERSIEGELT HINAUS.
         *
         * Der Server kann sie nicht oeffnen — er reicht Geheimtext durch. Der
         * Schluessel steht im Link, hinter der Raute, und ist nie hier
         * angekommen. Erst der Browser des Lesers setzt beides zusammen.
         */
        await RcResults.WriteJsonAsync(ctx, new RcCandidatePortalResponse(
            RcId.ToText(found.CandidateId),
            found.GroupName,
            found.ParishSlug,
            found.Status,
            found.PaperReceived,
            found.Bound,
            found.Fields));
    }

    public sealed record BindRequest(string? Unused);

    /// <summary>
    /// Den Portallink mit dem angemeldeten Konto verbinden.
    ///
    /// Danach findet man seine Anmeldung ueber das Konto und ist nicht mehr auf
    /// den Link angewiesen. Der Link bleibt gueltig — ihn zu entwerten waere
    /// eine Falle fuer den, der ihn auf einem zweiten Geraet gespeichert hat.
    ///
    /// <b>Zweimal binden ist kein Fehler</b>, solange es dasselbe Konto ist.
    /// Ein anderes Konto wird abgewiesen: eine Anmeldung gehoert einem
    /// Menschen, und der Link ist kein Weg, sie jemandem wegzunehmen.
    /// </summary>
    private static async Task BindAsync(HttpContext ctx, RcDb db, string token)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ByTokenAsync(connection, token, ctx.RequestAborted);
        if (found is null) { await NotFound(ctx); return; }

        if (found.AccountId is Guid owner && owner != session.AccountId)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                "Diese Anmeldung gehoert bereits zu einem anderen Konto.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_candidate SET account_id = @account, updated_at = @now WHERE id = @id;",
            connection);
        cmd.Parameters.AddWithValue("@account", session.AccountId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", found.CandidateId);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCandidateBoundResponse(
            RcId.ToText(found.CandidateId), true));
    }

    /// <summary>
    /// Den Portallink abschalten.
    ///
    /// <b>Erst wenn ein Konto verbunden ist.</b> Vorher waere es ein Schnitt
    /// ins eigene Fleisch: kein Konto und kein Link heisst, dass niemand mehr
    /// an die Anmeldung kommt — auch der Anmeldende nicht. Die Datenbank
    /// erzwingt dieselbe Regel (ck_rc_candidate_portal_revoke), damit sie nicht
    /// nur hier steht.
    ///
    /// <b>Wozu ueberhaupt.</b> Der Link ging per SMS hinaus und liegt danach in
    /// einem Nachrichtenverlauf, vielleicht auf einem alten Geraet. Wer ihn
    /// nicht mehr braucht, soll ihn schliessen koennen.
    /// </summary>
    private static async Task RevokeAsync(HttpContext ctx, RcDb db, string token)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ByTokenAsync(connection, token, ctx.RequestAborted);
        if (found is null) { await NotFound(ctx); return; }

        if (found.AccountId != session.AccountId)
        {
            // Wer den Link hat, darf lesen. Abschalten darf nur, wem die
            // Anmeldung gehoert — sonst waere der Link ein Weg, sie jemandem
            // wegzunehmen.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied,
                "Diesen Zugang kann nur das verbundene Konto abschalten.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_candidate SET portal_revoked_at = @now, updated_at = @now " +
            "WHERE id = @id AND portal_revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@id", found.CandidateId);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCandidateRevokedResponse(
            RcId.ToText(found.CandidateId), true));
    }

    // -- Das Formular oeffnen -------------------------------------------------

    public sealed record OpenRequest(bool Open);

    /// <summary>
    /// Anmeldungen zulassen oder schliessen.
    ///
    /// Beim ERSTEN Oeffnen entsteht der Annahmeschluessel. Ihn schon beim
    /// Anlegen der Gruppe zu erzeugen hiesse, mehrere Sekunden zu warten fuer
    /// etwas, das die meisten Gruppen nie brauchen.
    /// </summary>
    private static async Task OpenAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, OpenRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId;
        bool hasKey;
        await using (var find = new SqlCommand(
            "SELECT area_id, CASE WHEN intake_public_key IS NULL THEN 0 ELSE 1 END " +
            "FROM dbo.rc_confirmation_group WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await NotFound(ctx); return; }
            areaId = reader.GetGuid(0);
            hasKey = reader.GetInt32(1) == 1;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        byte[]? intakePublic = null;
        byte[]? intakeSealed = null;
        int? intakeEpoch = null;

        if (body.Open && !hasKey)
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
                areaId, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Bereich.");
                return;
            }

            intakeEpoch = keys.Keys.Max();
            using var intake = RSA.Create(4096);
            intakePublic = intake.ExportSubjectPublicKeyInfo();
            intakeSealed = RcCrypto.Seal(keys[intakeEpoch.Value], IntakeAad(id), intake.ExportPkcs8PrivateKey());
        }

        await using var cmd = new SqlCommand(
            intakePublic is null
                ? "UPDATE dbo.rc_confirmation_group SET applications_open = @open WHERE id = @id;"
                : """
                  UPDATE dbo.rc_confirmation_group
                  SET applications_open = @open, intake_public_key = @pub,
                      intake_private_sealed = @sealed, intake_epoch = @epoch
                  WHERE id = @id;
                  """, connection);

        cmd.Parameters.AddWithValue("@open", body.Open);
        cmd.Parameters.AddWithValue("@id", id);
        if (intakePublic is not null)
        {
            cmd.Parameters.AddWithValue("@pub", intakePublic);
            cmd.Parameters.AddWithValue("@sealed", intakeSealed!);
            cmd.Parameters.AddWithValue("@epoch", intakeEpoch!.Value);
        }
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcApplicationsOpenResponse(
            RcId.ToText(id), body.Open));
    }

    // -- Gemeinsames ----------------------------------------------------------

    private sealed record Found(
        Guid CandidateId, string GroupName, string ParishSlug, string Status,
        bool PaperReceived, bool Bound, Guid? AccountId, DateTimeOffset? RevokedAt,
        IReadOnlyList<SealedField> Fields);

    /// <summary>
    /// Den Kandidaten zu einem Portallink finden.
    ///
    /// Gesucht wird ueber den ABDRUCK. Ein kaputter Link ergibt keinen Abdruck,
    /// der irgendwo steht — und wird damit behandelt wie ein falscher, nicht
    /// wie ein Fehler.
    /// </summary>
    private static async Task<Found?> ByTokenAsync(
        SqlConnection connection, string token, CancellationToken ct)
    {
        // Derselbe Abdruck wie beim Anlegen — aus derselben Quelle.
        var hash = RcToken.HashSecret(token);

        await using var cmd = new SqlCommand("""
            SELECT c.id, g.name, p.slug, c.status, c.paper_received, c.account_id,
                   c.portal_revoked_at, c.name_sealed, c.born_sealed, c.contact_sealed, c.school_sealed
            FROM dbo.rc_candidate c
            JOIN dbo.rc_confirmation_group g ON g.id = c.group_id
            JOIN dbo.rc_parish p ON p.id = g.parish_id
            WHERE c.portal_token_hash = @hash;
            """, connection);
        cmd.Parameters.AddWithValue("@hash", hash);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        var accountId = reader.IsDBNull(5) ? (Guid?)null : reader.GetGuid(5);

        var fields = new List<SealedField>();
        void Add(string name, int column)
        {
            if (!reader.IsDBNull(column))
                fields.Add(new SealedField(name, Convert.ToBase64String((byte[])reader[column])));
        }

        Add("name", 7);
        Add("born", 8);
        Add("contact", 9);
        Add("school", 10);

        return new Found(
            reader.GetGuid(0), reader.GetString(1), reader.GetString(2),
            reader.GetString(3), reader.GetBoolean(4), accountId is not null, accountId,
            reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6),
            fields);
    }

    /// <summary>
    /// Geheimtext aus dem Browser. Er kommt als Base64 — kaputt heisst hier
    /// <c>null</c> und nicht Ausnahme: ein falsch kodiertes Feld ist eine
    /// schlechte Anmeldung, kein Fehler des Dienstes.
    /// </summary>
    private static byte[]? SafeBase64(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        try { return Convert.FromBase64String(text.Trim()); }
        catch (FormatException) { return null; }
    }

    private static Task NotFound(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.NotFoundOrNoAccess, "Diesen Zugang gibt es nicht.");
}
