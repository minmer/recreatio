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
        app.MapPost("/rc/parishes/{id:guid}/confirmation", SetUpAsync).Produces<RcConfirmationSetUpResponse>();
        app.MapGet("/rc/parishes/{id:guid}/confirmation", ReadSetUpAsync).Produces<RcConfirmationSetUpResponse>();
        app.MapGet("/rc/confirmation-groups/{id:guid}/links", LinksAsync).Produces<RcCandidateLinksResponse>();
        app.MapPost("/rc/candidates/{id:guid}/progress", ProgressAsync).Produces<RcCandidateProgressResponse>();
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

        /*
         * WENIGSTENS EIN NAMENSTEIL.
         *
         * Vorher war das eine Feld `name` Pflicht. Jetzt sind es zwei — und
         * beide zu verlangen waere zu streng: es gibt Menschen mit einem Namen,
         * und ein Formular, das sie abweist, weist sie ab.
         *
         * Dieselbe Regel steht als Bedingung in der Datenbank
         * (ck_rc_candidate_has_name), damit sie nicht nur hier gilt.
         */
        var givenSealed = Field("given");
        var surnameSealed = Field("surname");

        if (givenSealed is null && surnameSealed is null)
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
                    (id, group_id, epoch, given_sealed, surname_sealed, born_sealed,
                     contact_sealed, address_sealed, school_sealed,
                     consent_given, paper_received, quiz_passed, status,
                     portal_token_hash, portal_token_wrapped, applied_at, created_at, updated_at)
                VALUES (@id, @group, @epoch, @given, @surname, @born,
                        @contact, @address, @school,
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

                insert.Parameters.AddWithValue("@given", (object?)givenSealed ?? DBNull.Value);
                insert.Parameters.AddWithValue("@surname", (object?)surnameSealed ?? DBNull.Value);
                insert.Parameters.AddWithValue("@born", (object?)Field("born") ?? DBNull.Value);

                // Telefonnummern: mehrere, eine je Zeile, in EINEM Feld. Sie
                // gehoeren derselben Person und werden zusammen gelesen.
                insert.Parameters.AddWithValue("@contact", (object?)Field("phone") ?? DBNull.Value);
                insert.Parameters.AddWithValue("@address", (object?)Field("address") ?? DBNull.Value);
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

    /// <param name="LeaderRoleId">
    /// Die persoenliche Rolle dessen, der das Firmjahr fuehrt. Unter IHR
    /// entsteht die Amtsrolle, der der Annahmeschluessel gehoert.
    ///
    /// Fehlt sie beim ersten Oeffnen, wird nicht geraten: es gibt keine
    /// vernuenftige Vorgabe fuer „wer fuehrt das hier".
    /// </param>
    public sealed record OpenRequest(bool Open, string? LeaderRoleId);

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
        Guid tenantId;
        bool hasKey;
        string groupName;
        await using (var find = new SqlCommand(
            "SELECT area_id, tenant_id, name, CASE WHEN intake_public_key IS NULL THEN 0 ELSE 1 END " +
            "FROM dbo.rc_confirmation_group g " +
            "JOIN dbo.rc_area a ON a.id = g.area_id WHERE g.id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await NotFound(ctx); return; }
            areaId = reader.GetGuid(0);
            tenantId = reader.GetGuid(1);
            groupName = reader.GetString(2);
            hasKey = reader.GetInt32(3) == 1;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        /*
         * NUR OFFEN ODER ZU — der Schluessel steht schon.
         */
        if (!body.Open || hasKey)
        {
            await using var flip = new SqlCommand(
                "UPDATE dbo.rc_confirmation_group SET applications_open = @open WHERE id = @id;", connection);
            flip.Parameters.AddWithValue("@open", body.Open);
            flip.Parameters.AddWithValue("@id", id);
            await flip.ExecuteNonQueryAsync(ctx.RequestAborted);

            await RcResults.WriteJsonAsync(ctx, new RcApplicationsOpenResponse(
                RcId.ToText(id), body.Open, null));
            return;
        }

        /*
         * DAS ERSTE OEFFNEN: DER SCHLUESSEL BEKOMMT EINEN EIGENTUEMER.
         *
         * Er gehoert NICHT dem Bereich, sondern einer Rolle — der Person, die
         * das Firmjahr fuehrt. Der Unterschied ist die ganze Absicht: „den
         * Bereich lesen duerfen" bekommt jemand, um an einem Messplan zu
         * arbeiten; die Anmeldungen der Kinder zu oeffnen ist etwas anderes.
         *
         * Die Rolle laesst sich weitergeben wie jede andere
         * (POST /rc/roles/{id}/holders). Das ist der Unterschied zwischen
         * „niemand sonst kann es" und „nur wer es bekommen hat" — das Erste
         * waere eine Sackgasse, sobald jemand krank wird.
         */
        if (!Guid.TryParse(body.LeaderRoleId, out var leaderPersonRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed,
                "Beim ersten Oeffnen muss dastehen, wer das Firmjahr fuehrt.");
            return;
        }

        using var opened = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var leaderKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, opened.MasterKey, leaderPersonRoleId, ctx.RequestAborted);

        if (leaderKey is null) { await RcAreas.NotForYou(ctx); return; }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(
            connection, [leaderPersonRoleId], ctx.RequestAborted);

        if (!identities.TryGetValue(leaderPersonRoleId, out var leaderPerson))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        Guid officeId;
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            try
            {
                byte[] officeKey;
                (officeId, officeKey) = await RcRoles.InsertHeldRoleAsync(
                    connection, tx, leaderPersonRoleId, leaderKey, leaderPerson, tenantId,
                    RcRoleKinds.Office, groupName, ctx.RequestAborted);

                try
                {
                    using var intake = RSA.Create(4096);

                    await using var write = new SqlCommand("""
                        UPDATE dbo.rc_confirmation_group
                        SET applications_open = 1, leader_role_id = @leader,
                            intake_public_key = @pub, intake_private_sealed = @sealed, intake_epoch = 0
                        WHERE id = @id;
                        """, connection, tx);

                    write.Parameters.AddWithValue("@leader", officeId);
                    write.Parameters.AddWithValue("@pub", intake.ExportSubjectPublicKeyInfo());

                    // Versiegelt unter dem AMTSSCHLUESSEL. intake_epoch = 0
                    // sagt: dieser Schluessel haengt nicht mehr an einer Epoche
                    // des Bereichs — ein Epochenschnitt macht ihn nicht
                    // unbrauchbar, und niemand muss raten, unter welcher er lag.
                    write.Parameters.AddWithValue("@sealed",
                        RcCrypto.Seal(officeKey, IntakeAad(id), intake.ExportPkcs8PrivateKey()));

                    write.Parameters.AddWithValue("@id", id);
                    await write.ExecuteNonQueryAsync(ctx.RequestAborted);
                }
                finally
                {
                    System.Security.Cryptography.CryptographicOperations.ZeroMemory(officeKey);
                }

                await tx.CommitAsync(ctx.RequestAborted);
            }
            catch
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                throw;
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcApplicationsOpenResponse(
            RcId.ToText(id), true, RcId.ToText(officeId)));
    }

    // -- Einrichten -----------------------------------------------------------

    public sealed record SetUpRequest(string PersonRoleId, string? Name);

    /// <summary>
    /// Ein Firmjahr einrichten — Bereich, Gruppe, Amtsrolle und
    /// Annahmeschluessel in EINER Transaktion.
    ///
    /// <b>Warum nicht der Browser das zusammensetzt.</b> Es waeren vier
    /// Aufrufe, und zwischen zwei Anfragen gibt es kein Zurueck: brach der
    /// zweite ab, blieb ein Bereich stehen, der zu nichts gehoert. Genau das
    /// ist bei der Pfarrei schon passiert und als Liste gleichnamiger Bereiche
    /// sichtbar geworden.
    ///
    /// <b>Der eigene Bereich ist Absicht.</b> Die Akten der Kinder haengen
    /// nicht am Bereich der Pfarrei: wer den Messplan pflegt, bekommt damit
    /// keinen Zugang zu ihnen.
    ///
    /// <b>Wer einrichtet, fuehrt zunaechst.</b> Die Amtsrolle entsteht unter
    /// seiner persoenlichen Rolle. Weitergeben geht danach wie bei jeder
    /// anderen Rolle — das ist der Unterschied zwischen „nur ich" und „ich,
    /// bis ich jemanden dazunehme".
    /// </summary>
    private static async Task SetUpAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, SetUpRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.PersonRoleId, out var personRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Das ist keine Rollenkennung.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid parishArea;
        string parishName;
        await using (var find = new SqlCommand(
            "SELECT area_id, name FROM dbo.rc_parish WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await NotFound(ctx); return; }
            parishArea = reader.GetGuid(0);
            parishName = reader.GetString(1);
        }

        // Einrichten darf, wer die Pfarrei verwaltet.
        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, parishArea,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        // Zweimal einrichten ist kein Fehler — es ist ein Wunsch, der schon
        // erfuellt ist. Die bestehende Einrichtung kommt zurueck.
        var already = await SetUpOfAsync(connection, id, ctx.RequestAborted);
        if (already is not null)
        {
            await RcResults.WriteJsonAsync(ctx, already);
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var personKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, personRoleId, ctx.RequestAborted);
        if (personKey is null) { await RcAreas.NotForYou(ctx); return; }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [personRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(personRoleId, out var person))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var tenantId = await RcAreas.TenantOfRoleAsync(connection, personRoleId, ctx.RequestAborted);
        if (tenantId == Guid.Empty)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var name = Trim(body.Name, 120) ?? $"Bierzmowanie — {parishName}";
        var groupId = RcId.NewId();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            // Die Amtsrolle ZUERST: sie kommt in den Bereich, bevor dessen
            // erste Epoche geschnitten wird, und bekommt damit den Schluessel.
            var (officeId, officeKey) = await RcRoles.InsertHeldRoleAsync(
                connection, tx, personRoleId, personKey, person, tenantId,
                RcRoleKinds.Office, name, ctx.RequestAborted);

            try
            {
                var areaId = await RcAreas.InsertAreaAsync(connection, tx, personRoleId, personKey,
                    person, tenantId, name, false, ctx.RequestAborted, officeId);

                using var intake = RSA.Create(4096);

                await using (var insert = new SqlCommand("""
                    INSERT INTO dbo.rc_confirmation_group
                        (id, parish_id, area_id, name, lifecycle, created_at,
                         leader_role_id, intake_public_key, intake_private_sealed,
                         intake_epoch, applications_open)
                    VALUES (@id, @parish, @area, @name, N'preparing', @now,
                            @leader, @pub, @sealed, 0, 0);
                    """, connection, tx))
                {
                    insert.Parameters.AddWithValue("@id", groupId);
                    insert.Parameters.AddWithValue("@parish", id);
                    insert.Parameters.AddWithValue("@area", areaId);
                    insert.Parameters.AddWithValue("@name", name);
                    insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                    insert.Parameters.AddWithValue("@leader", officeId);
                    insert.Parameters.AddWithValue("@pub", intake.ExportSubjectPublicKeyInfo());

                    // Unter dem AMTSSCHLUESSEL, nicht unter der Epoche des
                    // Bereichs: wer den Bereich lesen darf, oeffnet damit noch
                    // keine Anmeldung.
                    insert.Parameters.AddWithValue("@sealed",
                        RcCrypto.Seal(officeKey, IntakeAad(groupId), intake.ExportPkcs8PrivateKey()));

                    await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
                }
            }
            finally
            {
                System.Security.Cryptography.CryptographicOperations.ZeroMemory(officeKey);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        var made = await SetUpOfAsync(connection, id, ctx.RequestAborted);
        await RcResults.WriteJsonAsync(ctx, made!, StatusCodes.Status201Created);
    }

    /// <summary>Was fuer diese Pfarrei eingerichtet ist — oder nichts.</summary>
    private static async Task ReadSetUpAsync(HttpContext ctx, RcDb db, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var found = await SetUpOfAsync(connection, id, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx,
            found ?? new RcConfirmationSetUpResponse(null, null, null, null, false));
    }

    private static async Task<RcConfirmationSetUpResponse?> SetUpOfAsync(
        SqlConnection connection, Guid parishId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT TOP 1 id, area_id, name, leader_role_id, applications_open
            FROM dbo.rc_confirmation_group
            WHERE parish_id = @parish AND lifecycle <> N'closed'
            ORDER BY created_at DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@parish", parishId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new RcConfirmationSetUpResponse(
            RcId.ToText(reader.GetGuid(0)),
            RcId.ToText(reader.GetGuid(1)),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : RcId.ToText(reader.GetGuid(3)),
            reader.GetBoolean(4));
    }

    private static string? Trim(string? text, int max)
    {
        var t = text?.Trim();
        return string.IsNullOrEmpty(t) ? null : (t.Length > max ? t[..max] : t);
    }

    // -- Die Portallinks fuer die Pfarrei -------------------------------------

    /// <summary>
    /// Die Portalgeheimnisse aller Selbstanmeldungen — damit die Pfarrei den
    /// Link noch einmal herstellen und per SMS schicken kann.
    ///
    /// <b>Hier packt der Dienst aus, und das ist eine Abweichung, die dasteht.</b>
    /// Beim Anmelden hat er das Geheimnis nie gehabt: der Browser hat es
    /// gewuerfelt und nur den Abdruck geschickt. Auf DIESEM Weg entsiegelt er
    /// es — fuer die Dauer einer Anfrage, im Auftrag dessen, der die Amtsrolle
    /// haelt.
    ///
    /// Anders geht es nicht: die Rollenschluessel liegen im Schluesselspeicher
    /// des Dienstes und nicht im Browser. Wer den Link ohne diese Abweichung
    /// haben will, muesste die Rollenschluessel herausgeben — und das waere
    /// die groessere.
    ///
    /// Es ist dieselbe Abweichung wie beim Lesen der Kandidatenfelder
    /// (<c>CandidatesAsync</c>): der Dienst oeffnet fuer den Schluesselhalter,
    /// waehrend dieser fragt, und behaelt nichts.
    /// </summary>
    private static async Task LinksAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var rsa = await IntakeKeyAsync(connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted);
        if (rsa is null)
        {
            // Wer die Amtsrolle nicht haelt, bekommt keine Links — und eine
            // leere Liste sagt genau das, ohne zu verraten, wie viele es gibt.
            await RcResults.WriteJsonAsync(ctx, new RcCandidateLinksResponse([]));
            return;
        }

        using (rsa)
        {
            await using var cmd = new SqlCommand("""
                SELECT id, portal_token_wrapped, portal_revoked_at
                FROM dbo.rc_candidate
                WHERE group_id = @group AND portal_token_wrapped IS NOT NULL
                ORDER BY created_at;
                """, connection);
            cmd.Parameters.AddWithValue("@group", id);

            var links = new List<CandidateLink>();
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var candidateId = reader.GetGuid(0);
                var revoked = !reader.IsDBNull(2);

                if (revoked)
                {
                    // Ein abgeschalteter Link wird NICHT herausgegeben. Ihn
                    // trotzdem zu zeigen hiesse, dass „abschalten" nur die
                    // Anzeige betrifft.
                    links.Add(new CandidateLink(RcId.ToText(candidateId), null, true));
                    continue;
                }

                try
                {
                    var secret = System.Text.Encoding.UTF8.GetString(
                        rsa.Decrypt((byte[])reader[1], RSAEncryptionPadding.OaepSHA256));
                    links.Add(new CandidateLink(RcId.ToText(candidateId), secret, false));
                }
                catch (CryptographicException)
                {
                    links.Add(new CandidateLink(RcId.ToText(candidateId), null, false));
                }
            }

            await RcResults.WriteJsonAsync(ctx, new RcCandidateLinksResponse(links));
        }
    }

    public sealed record CandidateLink(string CandidateId, string? Secret, bool Revoked);

    // -- Der Stand eines Kandidaten -------------------------------------------

    public sealed record ProgressRequest(bool? PaperReceived, bool? QuizPassed);

    /// <summary>
    /// Was noch fehlt, abhaken.
    ///
    /// <b>Diese Merker sind Klartext</b> — sie betreffen den VORGANG und nicht
    /// die Person. Ohne sie liesse sich nicht zaehlen, von wem noch etwas
    /// aussteht, ohne jeden Datensatz zu entschluesseln.
    ///
    /// <b>Was nicht mitgeschickt wird, bleibt stehen.</b> Zwei Haken in einem
    /// Formular, von denen einer versehentlich zurueckgesetzt wird, weil das
    /// andere Feld leer war, ist ein Fehler, den niemand bemerkt.
    /// </summary>
    private static async Task ProgressAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, ProgressRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId;
        await using (var find = new SqlCommand(
            "SELECT g.area_id FROM dbo.rc_candidate c " +
            "JOIN dbo.rc_confirmation_group g ON g.id = c.group_id WHERE c.id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found) { await NotFound(ctx); return; }
            areaId = found;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_candidate
            SET paper_received = COALESCE(@paper, paper_received),
                quiz_passed    = COALESCE(@quiz, quiz_passed),
                updated_at     = @now
            WHERE id = @id;
            """, connection);

        cmd.Parameters.Add("@paper", System.Data.SqlDbType.Bit).Value =
            (object?)body.PaperReceived ?? DBNull.Value;
        cmd.Parameters.Add("@quiz", System.Data.SqlDbType.Bit).Value =
            (object?)body.QuizPassed ?? DBNull.Value;
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCandidateProgressResponse(RcId.ToText(id), true));
    }

    // -- Die Anmeldungen lesen ------------------------------------------------

    /// <summary>
    /// Die Sitzungsschluessel aller Selbstanmeldungen einer Gruppe.
    ///
    /// <b>Der Weg dorthin hat drei Stufen</b>, und jede kann zu Recht
    /// scheitern:
    ///
    /// <code>
    ///   1. Amtsrolle erreichbar?    sonst leer — wer sie nicht haelt, liest nicht
    ///   2. privaten Annahme-        entsiegelt unter dem Amtsschluessel
    ///      schluessel oeffnen
    ///   3. je Anmeldung den         RSA-OAEP, mit demselben Platz, den der
    ///      Sitzungsschluessel          Browser beim Verpacken benutzt hat
    ///      auspacken
    /// </code>
    ///
    /// <b>Ein leeres Ergebnis ist kein Fehler.</b> Es heisst: dieses Konto
    /// haelt die Amtsrolle nicht. Die Kandidaten bleiben in der Liste und
    /// stehen als unlesbar da — dass jemand angemeldet ist, gehoert zur
    /// Auskunft, auch wenn seine Angaben es nicht tun.
    /// </summary>
    /// <summary>
    /// Der private Annahmeschluessel einer Gruppe — oder <c>null</c>.
    ///
    /// <c>null</c> heisst immer dasselbe und nie einen Fehler: diese Gruppe
    /// nimmt nichts an, oder dieses Konto haelt die Amtsrolle nicht. Beide
    /// Faelle enden bei „du liest hier nichts", und sie zu unterscheiden waere
    /// eine Auskunft ueber fremde Rollen.
    ///
    /// <b>Der Aufrufer entsorgt.</b> Ein RSA-Schluessel, der laenger lebt als
    /// die Anfrage, ist ein RSA-Schluessel in einem Absturzabbild.
    /// </summary>
    private static async Task<RSA?> IntakeKeyAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, Guid groupId, CancellationToken ct)
    {
        Guid leaderRoleId;
        byte[] intakeSealed;

        await using (var cmd = new SqlCommand(
            "SELECT leader_role_id, intake_private_sealed FROM dbo.rc_confirmation_group WHERE id = @id;",
            connection))
        {
            cmd.Parameters.AddWithValue("@id", groupId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;
            if (reader.IsDBNull(0) || reader.IsDBNull(1)) return null;

            leaderRoleId = reader.GetGuid(0);
            intakeSealed = (byte[])reader[1];
        }

        var leaderKey = await RcRoleAccess.RoleKeyAsync(connection, accountId, masterKey, leaderRoleId, ct);
        if (leaderKey is null) return null;

        byte[] privateKey;
        try { privateKey = RcCrypto.Open(leaderKey, IntakeAad(groupId), intakeSealed); }
        catch (RcDecryptException) { return null; }

        var rsa = RSA.Create();
        try { rsa.ImportPkcs8PrivateKey(privateKey, out _); }
        catch { rsa.Dispose(); return null; }
        finally { System.Security.Cryptography.CryptographicOperations.ZeroMemory(privateKey); }

        return rsa;
    }

    internal static async Task<Dictionary<Guid, byte[]>> SessionKeysAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, Guid groupId, CancellationToken ct)
    {
        var found = new Dictionary<Guid, byte[]>();

        Guid leaderRoleId;
        byte[] intakeSealed;
        await using (var cmd = new SqlCommand(
            "SELECT leader_role_id, intake_private_sealed FROM dbo.rc_confirmation_group WHERE id = @id;",
            connection))
        {
            cmd.Parameters.AddWithValue("@id", groupId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return found;
            if (reader.IsDBNull(0) || reader.IsDBNull(1)) return found;

            leaderRoleId = reader.GetGuid(0);
            intakeSealed = (byte[])reader[1];
        }

        var rsa = await IntakeKeyAsync(connection, accountId, masterKey, groupId, ct);
        if (rsa is null) return found;
        using var _ = rsa;

        await using var keys = new SqlCommand("""
            SELECT i.candidate_id, i.session_key_wrapped
            FROM dbo.rc_candidate_intake i
            JOIN dbo.rc_candidate c ON c.id = i.candidate_id
            WHERE c.group_id = @group;
            """, connection);
        keys.Parameters.AddWithValue("@group", groupId);

        await using var rows = await keys.ExecuteReaderAsync(ct);
        while (await rows.ReadAsync(ct))
        {
            var candidateId = rows.GetGuid(0);
            try
            {
                // Derselbe Platz wie beim Verpacken im Browser. Ein anderer
                // ergaebe hier eine Ausnahme statt eines falschen Schluessels —
                // das ist die freundlichere Sorte Fehler.
                found[candidateId] = rsa.Decrypt((byte[])rows[1], RSAEncryptionPadding.OaepSHA256);
            }
            catch (CryptographicException)
            {
                // Eine Anmeldung, die nicht aufgeht, verschweigt die anderen
                // nicht. Sie erscheint als unlesbar.
            }
        }

        return found;
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
                   c.portal_revoked_at, c.name_sealed, c.born_sealed, c.contact_sealed, c.school_sealed,
                   c.given_sealed, c.surname_sealed, c.address_sealed
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
        Add("phone", 9);
        Add("school", 10);
        Add("given", 11);
        Add("surname", 12);
        Add("address", 13);

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
    /// <summary>
    /// Was vom Browser kommt, in Bytes zurueckverwandeln.
    ///
    /// <b>BASE64URL, nicht gewoehnliches Base64.</b> Der Browser verschliesst
    /// mit <c>rcToBase64Url</c> — also mit <c>-</c> und <c>_</c> und ohne
    /// Fuellzeichen. <see cref="Convert.FromBase64String"/> kennt diese
    /// Schreibweise nicht und wirft; hier stand genau das, und deshalb kam
    /// jede Anmeldung als 400 zurueck: der verpackte Zugang liess sich nicht
    /// lesen, obwohl er in Ordnung war.
    ///
    /// <see cref="RcBase64Url"/> nimmt BEIDE Schreibweisen an — die Umkehrung
    /// ist eindeutig. Das ist auch der Grund, warum es diese Klasse gibt: es
    /// gab schon drei handgeschriebene Fassungen der Kodierung, und dies war
    /// die vierte.
    /// </summary>
    internal static byte[]? SafeBase64(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        return RcBase64Url.TryDecode(text.Trim(), out var bytes) ? bytes : null;
    }

    private static Task NotFound(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.NotFoundOrNoAccess, "Diesen Zugang gibt es nicht.");
}
