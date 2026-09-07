using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Was Teilnehmer beitragen: Haken auf der Liste, eigener Fortschritt,
/// Teilnehmerkarte, Fragen.
///
/// <b>Die eine Entscheidung, die diese vier zusammenhaelt: WER schreibt hier.</b>
///
/// Ein Teilnehmer hat kein Konto. Im alten Modul war ein persoenlicher Link die
/// Kennung — wer ihn hatte, war er. Hier weist er sich mit dem BELEG seiner
/// Anmeldung aus, demselben, mit dem er sie zuruecknehmen kann
/// (<c>rc_event_registration.claim_hash</c>). Dasselbe Verfahren, dieselbe
/// Grenze, und vor allem: nur EIN Geheimnis. Ein zweites danebenzustellen hiesse
/// zwei Sperren zu pflegen, und beim naechsten Umbau vergisst jemand die zweite.
///
/// Der Preis ist derselbe wie beim Einladungslink (3.12): wer den Beleg hat,
/// kommt hinein. Er ist kein Ausweis, sondern ein Schluessel — und die
/// Oberflaeche sagt das auch.
///
/// <b>Die Liste ist die Ausnahme.</b> Sie fuehrt die VERWALTUNG: wer abgehakt
/// hat, wer bezahlt hat, wer mitfaehrt. Dafuer braucht es Schreibrecht am
/// Bereich, keinen Beleg — ein Teilnehmer, der seinen eigenen Haken setzen
/// koennte, waere keine Liste, sondern eine Umfrage.
/// </summary>
public static class RcEventParticipation
{
    public static void MapRcEventParticipation(this IEndpointRouteBuilder app)
    {
        // -- Liste: von der Verwaltung gefuehrt --------------------------------
        app.MapGet("/rc/event-parts/{id:guid}/roster", ReadRosterAsync)
            .Produces<RcEventRosterResponse>();
        app.MapPost("/rc/event-parts/{id:guid}/roster", MarkRosterAsync)
            .Produces<RcEventRosterMarkedResponse>();

        // -- Fortschritt: der Teilnehmer fuer sich selbst ----------------------
        app.MapPost("/rc/event-parts/{id:guid}/progress", ReadProgressAsync)
            .Produces<RcEventProgressResponse>();
        app.MapPost("/rc/event-parts/{id:guid}/progress/set", SetProgressAsync)
            .Produces<RcEventProgressResponse>();

        // -- Teilnehmerkarte ---------------------------------------------------
        app.MapPost("/rc/event-parts/{id:guid}/card", SubmitCardAsync)
            .Produces<RcEventCardSubmittedResponse>();
        app.MapGet("/rc/event-parts/{id:guid}/cards", ListCardsAsync)
            .Produces<RcEventCardsResponse>();

        // -- Fragen ------------------------------------------------------------
        app.MapGet("/rc/event-parts/{id:guid}/topics", ListTopicsAsync)
            .Produces<RcEventTopicsResponse>();
        app.MapPost("/rc/event-parts/{id:guid}/topics", AskAsync)
            .Produces<RcEventTopicCreatedResponse>();
        app.MapGet("/rc/event-topics/{id:guid}", ReadTopicAsync)
            .Produces<RcEventTopicResponse>();
        app.MapPost("/rc/event-topics/{id:guid}/messages", ReplyAsync)
            .Produces<RcEventTopicRepliedResponse>();
        app.MapPost("/rc/event-topics/{id:guid}/moderate", ModerateAsync)
            .Produces<RcEventTopicModeratedResponse>();
    }

    // -- Die Liste ------------------------------------------------------------

    public sealed record RosterCell(string RowKey, string Code, string? Value, string? UpdatedBy);

    private static async Task ReadRosterAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        // Lesen reicht: wer die Liste fuehrt, sieht sie meist bevor er schreibt.
        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
            owner.Value.AreaId, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var cells = new List<RosterCell>();
        await using (var cmd = new SqlCommand(
            "SELECT row_key, code, value, updated_by FROM dbo.rc_event_roster WHERE part_id = @id;",
            connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                cells.Add(new RosterCell(
                    reader.GetString(0), reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3)));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventRosterResponse(cells));
    }

    public sealed record MarkRosterRequest(string? RowKey, string? Code, string? Value, string? By);

    /// <summary>
    /// Eine Zelle setzen oder loeschen.
    ///
    /// <b>Ein leerer Wert LOESCHT die Zeile</b>, statt eine mit leerem Text zu
    /// hinterlassen. Sonst liesse sich „nie gesetzt" nicht von „zurueckgenommen"
    /// unterscheiden, und genau daran haengt, ob jemand vergessen wurde oder
    /// abgesagt hat.
    /// </summary>
    private static async Task MarkRosterAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, MarkRosterRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var rowKey = (body.RowKey ?? string.Empty).Trim();
        var code = (body.Code ?? string.Empty).Trim();

        if (rowKey.Length is 0 or > 120 || code.Length is 0 or > 60)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Zeile oder Spalte fehlen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await RcEventEditing.MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        var value = (body.Value ?? string.Empty).Trim();

        if (value.Length == 0)
        {
            await using var drop = new SqlCommand(
                "DELETE FROM dbo.rc_event_roster WHERE part_id = @part AND row_key = @row AND code = @code;",
                connection);
            drop.Parameters.AddWithValue("@part", id);
            drop.Parameters.AddWithValue("@row", rowKey);
            drop.Parameters.AddWithValue("@code", code);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

            await RcResults.WriteJsonAsync(ctx, new RcEventRosterMarkedResponse(rowKey, code, null));
            return;
        }

        /*
         * Setzen oder Ueberschreiben in EINER Anweisung. Zwei Betreuer haken
         * gleichzeitig ab; ein „erst pruefen, dann einfuegen" liefe zwischen
         * beiden Schritten in die Eindeutigkeitsbedingung — als Fehler, wo
         * beide dasselbe wollten.
         */
        await using (var upsert = new SqlCommand("""
            UPDATE dbo.rc_event_roster
               SET value = @value, updated_by = @by, updated_at = @now
             WHERE part_id = @part AND row_key = @row AND code = @code;

            IF @@ROWCOUNT = 0
                INSERT INTO dbo.rc_event_roster
                    (id, event_id, part_id, row_key, code, value, updated_by, updated_at)
                VALUES (@id, @event, @part, @row, @code, @value, @by, @now);
            """, connection))
        {
            upsert.Parameters.AddWithValue("@id", RcId.NewId());
            upsert.Parameters.AddWithValue("@event", owner.Value.EventId);
            upsert.Parameters.AddWithValue("@part", id);
            upsert.Parameters.AddWithValue("@row", rowKey);
            upsert.Parameters.AddWithValue("@code", code);
            upsert.Parameters.Add("@value", System.Data.SqlDbType.NVarChar, 400).Value =
                value.Length > 400 ? value[..400] : value;
            upsert.Parameters.Add("@by", System.Data.SqlDbType.NVarChar, 120).Value =
                (object?)Trim(body.By, 120) ?? DBNull.Value;
            upsert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await upsert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventRosterMarkedResponse(rowKey, code, value));
    }

    // -- Fortschritt ----------------------------------------------------------

    public sealed record ProgressRequest(string? Claim, string? ItemKey, bool? Done);

    /// <summary>
    /// Was dieser Teilnehmer abgehakt hat.
    ///
    /// <b>POST, obwohl es ein Lesen ist.</b> Der Beleg reist im Rumpf: in einer
    /// Adresse stuende er im Verlauf des Browsers, im Verweis der naechsten
    /// Seite und im Protokoll jedes Zwischenservers. Dieselbe Entscheidung wie
    /// bei <c>POST /rc/registrations/claim</c>.
    /// </summary>
    private static async Task ReadProgressAsync(
        HttpContext ctx, RcDb db, Guid id, ProgressRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var registration = await RegistrationOfClaimAsync(connection, body.Claim, ctx.RequestAborted);
        if (registration is null) { await NoSuchClaim(ctx); return; }

        await RcResults.WriteJsonAsync(ctx,
            new RcEventProgressResponse(await DoneKeysAsync(connection, id, registration.Value, ctx.RequestAborted)));
    }

    private static async Task SetProgressAsync(
        HttpContext ctx, RcDb db, Guid id, ProgressRequest body)
    {
        var itemKey = (body.ItemKey ?? string.Empty).Trim();
        if (itemKey.Length is 0 or > 120)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Punkt fehlt.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var registration = await RegistrationOfClaimAsync(connection, body.Claim, ctx.RequestAborted);
        if (registration is null) { await NoSuchClaim(ctx); return; }

        if (body.Done == true)
        {
            await using var set = new SqlCommand("""
                IF NOT EXISTS (SELECT 1 FROM dbo.rc_event_progress
                                WHERE part_id = @part AND registration_id = @reg AND item_key = @key)
                    INSERT INTO dbo.rc_event_progress (id, part_id, registration_id, item_key, done_at)
                    VALUES (@id, @part, @reg, @key, @now);
                """, connection);

            set.Parameters.AddWithValue("@id", RcId.NewId());
            set.Parameters.AddWithValue("@part", id);
            set.Parameters.AddWithValue("@reg", registration.Value);
            set.Parameters.AddWithValue("@key", itemKey);
            set.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await set.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        else
        {
            // Der Haken verschwindet als ZEILE. Ein „false" liesse sich von
            // „nie gesetzt" nicht unterscheiden.
            await using var drop = new SqlCommand(
                "DELETE FROM dbo.rc_event_progress WHERE part_id = @part AND registration_id = @reg AND item_key = @key;",
                connection);
            drop.Parameters.AddWithValue("@part", id);
            drop.Parameters.AddWithValue("@reg", registration.Value);
            drop.Parameters.AddWithValue("@key", itemKey);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx,
            new RcEventProgressResponse(await DoneKeysAsync(connection, id, registration.Value, ctx.RequestAborted)));
    }

    private static async Task<IReadOnlyList<string>> DoneKeysAsync(
        SqlConnection connection, Guid partId, Guid registrationId, CancellationToken ct)
    {
        var keys = new List<string>();
        await using var cmd = new SqlCommand(
            "SELECT item_key FROM dbo.rc_event_progress WHERE part_id = @part AND registration_id = @reg;",
            connection);
        cmd.Parameters.AddWithValue("@part", partId);
        cmd.Parameters.AddWithValue("@reg", registrationId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) keys.Add(reader.GetString(0));
        return keys;
    }

    // -- Teilnehmerkarte ------------------------------------------------------

    public sealed record SubmitCardRequest(
        string? CardId,
        string? Claim, string? DataSealed, string? ConsentsSealed, string? SessionKeyWrapped,
        string? ClauseText, bool? IsMinor, string? SignerRole);

    /// <summary>
    /// Die Karte abgeben.
    ///
    /// <b>Versiegelt wird im BROWSER, nicht hier.</b> Genau wie bei einer
    /// Anmeldung: der Browser wuerfelt einen Sitzungsschluessel, verpackt ihn
    /// mit dem oeffentlichen Annahmeschluessel der Veranstaltung und schickt
    /// beides fertig verschlossen. Der Dienst legt Bytes ab, die er nicht
    /// oeffnen kann.
    ///
    /// Das ist keine Umstaendlichkeit, sondern die ganze Zusage. Wuerde der
    /// Dienst hier Klartext entgegennehmen und selbst versiegeln, stuende der
    /// Inhalt — Ernaehrung, Unvertraeglichkeit, Medikamente — fuer die Dauer
    /// einer Anfrage im Arbeitsspeicher eines Rechners, den der Teilnehmer
    /// nicht kennt.
    ///
    /// <b>Der Wortlaut der Klausel wird MITGESCHRIEBEN, nicht verwiesen.</b>
    /// Die Klausel an der Sammlung darf sich aendern; eine Einwilligung gilt
    /// aber unter dem Text, der damals dastand. Ein Verweis machte aus jeder
    /// spaeteren Aenderung eine rueckwirkende — und das darf sie nicht sein.
    /// Deshalb steht er hier im Klartext: wer nachliest, was er unterschrieben
    /// hat, soll dafuer keinen Schluessel brauchen.
    /// </summary>
    private static async Task SubmitCardAsync(
        HttpContext ctx, RcDb db, Guid id, SubmitCardRequest body)
    {
        if (!RcBase64Url.TryDecode(body.DataSealed ?? string.Empty, out var sealedData)
            || sealedData.Length == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Karte fehlt oder ist nicht lesbar verpackt.");
            return;
        }

        if (!RcBase64Url.TryDecode(body.SessionKeyWrapped ?? string.Empty, out var wrapped)
            || wrapped.Length == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Ohne verpackten Sitzungsschluessel ist die Karte nicht zu oeffnen.");
            return;
        }

        byte[]? sealedConsents = null;
        if ((body.ConsentsSealed ?? string.Empty).Length > 0
            && !RcBase64Url.TryDecode(body.ConsentsSealed!, out sealedConsents))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Einwilligungen sind nicht lesbar verpackt.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var registration = await RegistrationOfClaimAsync(connection, body.Claim, ctx.RequestAborted);
        if (registration is null) { await NoSuchClaim(ctx); return; }

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        /*
         * Die Epoche der Veranstaltung, unter der ihr Annahmeschluessel liegt.
         * Sie wird MITGESCHRIEBEN: der Bereich schneidet spaeter neue Epochen,
         * und wer die Karte oeffnen will, muss wissen, welcher Schluessel
         * gemeint ist. Aus der aktuellen abgeleitet liesse sich eine alte
         * Karte irgendwann nicht mehr oeffnen.
         */
        var epoch = await IntakeEpochAsync(connection, owner.Value.EventId, ctx.RequestAborted);
        if (epoch is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Diese Veranstaltung kann nichts entgegennehmen.");
            return;
        }

        /*
         * DIE KENNUNG KOMMT AUS DEM BROWSER.
         *
         * Sie steht im Etikett (AAD), unter dem die Karte verschlossen wurde.
         * Wuerfelte der Dienst hier eine eigene, passte sein Etikett nicht zu
         * dem, unter dem versiegelt wurde — und die Karte liesse sich nie mehr
         * oeffnen. Genau dieser Fehler ist bei den Firmkandidaten schon einmal
         * passiert: beide Seiten waren fuer sich schluessig, und nichts ging
         * auf.
         */
        if (!Guid.TryParse(body.CardId, out var cardId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Karte hat keine brauchbare Kennung.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using (var insert = new SqlCommand("""
            INSERT INTO dbo.rc_event_card
                (id, event_id, part_id, registration_id, epoch,
                 data_sealed, consents_sealed, session_key_wrapped,
                 clause_text, is_minor, signer_role, submitted_at, updated_at)
            VALUES (@id, @event, @part, @reg, @epoch,
                    @data, @consents, @wrapped,
                    @clause, @minor, @signer, @now, @now);
            """, connection))
        {
            insert.Parameters.AddWithValue("@id", cardId);
            insert.Parameters.AddWithValue("@event", owner.Value.EventId);
            insert.Parameters.AddWithValue("@part", id);
            insert.Parameters.AddWithValue("@reg", registration.Value);
            insert.Parameters.AddWithValue("@epoch", epoch.Value);
            insert.Parameters.AddWithValue("@data", sealedData);
            insert.Parameters.Add("@consents", System.Data.SqlDbType.VarBinary, -1).Value =
                (object?)sealedConsents ?? DBNull.Value;
            insert.Parameters.AddWithValue("@wrapped", wrapped);
            insert.Parameters.Add("@clause", System.Data.SqlDbType.NVarChar, -1).Value =
                (object?)Trim(body.ClauseText, 100_000) ?? DBNull.Value;
            insert.Parameters.AddWithValue("@minor", body.IsMinor ?? false);
            insert.Parameters.AddWithValue("@signer",
                body.SignerRole == "guardian" ? "guardian" : "participant");
            insert.Parameters.AddWithValue("@now", now);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx,
            new RcEventCardSubmittedResponse(RcId.ToText(cardId), now), StatusCodes.Status201Created);
    }

    /// <summary>
    /// Eine Karte, GEOEFFNET.
    ///
    /// <c>unreadable</c> steht dort, wo sie sich nicht aufmachen liess — sie
    /// faellt dann NICHT aus der Liste (15.9). Sie still zu unterschlagen
    /// hiesse, dass niemand merkt, dass jemand eine abgegeben hat.
    /// </summary>
    public sealed record CardView(
        string CardId, bool IsMinor, string SignerRole, string? ClauseText,
        string? DataJson, string? ConsentsJson, string? Unreadable,
        DateTimeOffset SubmittedUtc);

    /// <summary>
    /// Die Karten dieses Teils.
    ///
    /// <b>Geoeffnet wird HIER, mit dem Amtsschluessel des Lesers.</b> Ein
    /// frueherer Entwurf gab sie versiegelt heraus und schrieb dazu, der
    /// Browser mache sie auf. Das konnte er nicht: der private
    /// Annahmeschluessel liegt beim Dienst, und der Teilnehmer, der die Karte
    /// abgegeben hat, hat ihn erst recht nicht. Die Karten waeren fuer immer
    /// zu gewesen — bemerkt erst, wenn jemand die erste hatte lesen wollen.
    ///
    /// <b>Und WER sie oeffnen darf, entscheidet das AMT, nicht der Bereich.</b>
    /// Hier stehen Ernaehrung, Unvertraeglichkeit, Medikamente. Wer zum
    /// Bereich gehoert, weil er beim Aufbau hilft, hat damit nichts zu tun.
    /// </summary>
    private static async Task ListCardsAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
            owner.Value.AreaId, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        using var intake = await RcRegistrations.OpenEventIntakeAsync(
            connection, owner.Value.EventId, session.AccountId, held.MasterKey, ctx.RequestAborted);

        var rows = new List<(Guid Id, bool Minor, string Signer, string? Clause,
            byte[] Data, byte[]? Consents, byte[]? Wrapped, DateTimeOffset At)>();

        await using (var cmd = new SqlCommand("""
            SELECT id, is_minor, signer_role, clause_text, data_sealed, consents_sealed,
                   session_key_wrapped, submitted_at
            FROM dbo.rc_event_card WHERE part_id = @id
            ORDER BY submitted_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetBoolean(1), reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    (byte[])reader[4],
                    reader.IsDBNull(5) ? null : (byte[])reader[5],
                    reader.IsDBNull(6) ? null : (byte[])reader[6],
                    reader.GetDateTimeOffset(7)));
            }
        }

        var views = new List<CardView>();
        foreach (var row in rows)
        {
            string? unreadable = null;
            string? data = null, consents = null;

            if (intake is null || row.Wrapped is null)
            {
                unreadable = RcErrorCodes.CryptoMissingKey;
            }
            else
            {
                try
                {
                    var key = RcCrypto.UnwrapKey(intake, CardWrapAad(row.Id), row.Wrapped);
                    var aad = CardAad(row.Id);

                    data = Encoding.UTF8.GetString(RcCrypto.Open(key, aad, row.Data));
                    if (row.Consents is not null)
                        consents = Encoding.UTF8.GetString(RcCrypto.Open(key, aad, row.Consents));
                }
                catch (RcDecryptException e)
                {
                    unreadable = e.Code;
                }
            }

            views.Add(new CardView(
                RcId.ToText(row.Id), row.Minor, row.Signer, row.Clause,
                data, consents, unreadable, row.At));
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventCardsResponse(views));
    }

    /*
      DIE ETIKETTEN DER KARTE.

      Sie muessen bitgenau denen entsprechen, die der Browser beim Verschliessen
      benutzt (`rcSealCard`). Inhalt und Schluessel liegen dabei an
      VERSCHIEDENEN Plaetzen — derselbe Unterschied, an dem die erste Fassung
      der Anmeldung gescheitert ist: beide Seiten waren fuer sich schluessig,
      und nichts ging auf.
    */
    private static RcAad CardAad(Guid cardId) =>
        RcAad.Create("events", "card", cardId, RcField.EventAnswer, 1);

    private static RcAad CardWrapAad(Guid cardId) =>
        RcAad.Create("events", "card", cardId, RcField.EventIntakeKey, 1);

    // -- Fragen ---------------------------------------------------------------

    public sealed record TopicView(
        string TopicId, string AuthorName, string Title, string Status,
        int MessageCount, DateTimeOffset CreatedUtc, DateTimeOffset LastMessageUtc);

    public sealed record TopicMessageView(
        string MessageId, string AuthorName, string Body, bool IsOfficial, DateTimeOffset CreatedUtc);

    private static async Task ListTopicsAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        var session = ctx.RcSession();
        var manages = session is not null
            && (await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                    owner.Value.AreaId, RcCapability.Write, ctx.RequestAborted)).Allowed;

        var views = new List<TopicView>();
        await using (var cmd = new SqlCommand("""
            SELECT id, author_name, title, status, message_count, created_at, last_message_at
            FROM dbo.rc_event_topic
            WHERE part_id = @id AND (@manages = 1 OR status <> N'hidden')
            ORDER BY last_message_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@manages", manages ? 1 : 0);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                views.Add(new TopicView(
                    RcId.ToText(reader.GetGuid(0)), reader.GetString(1), reader.GetString(2),
                    reader.GetString(3), reader.GetInt32(4),
                    reader.GetDateTimeOffset(5), reader.GetDateTimeOffset(6)));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventTopicsResponse(views));
    }

    public sealed record AskRequest(string? Claim, string? AuthorName, string? Title, string? Body);

    private static async Task AskAsync(HttpContext ctx, RcDb db, Guid id, AskRequest body)
    {
        var title = (body.Title ?? string.Empty).Trim();
        var text = (body.Body ?? string.Empty).Trim();

        if (title.Length is 0 or > 200 || text.Length == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Frage oder Betreff fehlen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var registration = await RegistrationOfClaimAsync(connection, body.Claim, ctx.RequestAborted);
        if (registration is null) { await NoSuchClaim(ctx); return; }

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        var topicId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var author = Trim(body.AuthorName, 120) ?? "Uczestnik";

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var cmd = new SqlCommand("""
                INSERT INTO dbo.rc_event_topic
                    (id, event_id, part_id, registration_id, author_name, title,
                     status, created_at, last_message_at, message_count)
                VALUES (@id, @event, @part, @reg, @author, @title, N'open', @now, @now, 1);
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", topicId);
                cmd.Parameters.AddWithValue("@event", owner.Value.EventId);
                cmd.Parameters.AddWithValue("@part", id);
                cmd.Parameters.AddWithValue("@reg", registration.Value);
                cmd.Parameters.AddWithValue("@author", author);
                cmd.Parameters.AddWithValue("@title", title);
                cmd.Parameters.AddWithValue("@now", now);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await InsertMessageAsync(connection, tx, topicId, registration, author, text, false, now, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx,
            new RcEventTopicCreatedResponse(RcId.ToText(topicId)), StatusCodes.Status201Created);
    }

    private static async Task ReadTopicAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid partId;
        string title, status;
        await using (var head = new SqlCommand(
            "SELECT part_id, title, status FROM dbo.rc_event_topic WHERE id = @id;", connection))
        {
            head.Parameters.AddWithValue("@id", id);
            await using var reader = await head.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            partId = reader.GetGuid(0);
            title = reader.GetString(1);
            status = reader.GetString(2);
        }

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, partId, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        var session = ctx.RcSession();
        var manages = session is not null
            && (await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                    owner.Value.AreaId, RcCapability.Write, ctx.RequestAborted)).Allowed;

        // Ein verborgenes Thema gibt es fuer Fremde nicht — so, als waere es
        // nie da gewesen. „Verborgen" anzuzeigen waere ein Verzeichnis dessen,
        // was jemand aus der Ansicht genommen hat.
        if (status == "hidden" && !manages) { await RcAreas.NotForYou(ctx); return; }

        var messages = new List<TopicMessageView>();
        await using (var cmd = new SqlCommand("""
            SELECT id, author_name, body, is_official, created_at
            FROM dbo.rc_event_topic_message
            WHERE topic_id = @id AND (@manages = 1 OR is_hidden = 0)
            ORDER BY created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@manages", manages ? 1 : 0);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                messages.Add(new TopicMessageView(
                    RcId.ToText(reader.GetGuid(0)), reader.GetString(1), reader.GetString(2),
                    reader.GetBoolean(3), reader.GetDateTimeOffset(4)));
            }
        }

        await RcResults.WriteJsonAsync(ctx,
            new RcEventTopicResponse(RcId.ToText(id), title, status, messages));
    }

    public sealed record ReplyRequest(string? Claim, string? AuthorName, string? Body);

    /// <summary>
    /// Antworten — als Teilnehmer mit Beleg, oder als Verwaltung mit Konto.
    ///
    /// Eine Antwort der Verwaltung steht anders da (<c>is_official</c>): wer
    /// eine verbindliche Auskunft sucht, soll sie von einer Vermutung
    /// unterscheiden koennen.
    /// </summary>
    private static async Task ReplyAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, ReplyRequest body)
    {
        var text = (body.Body ?? string.Empty).Trim();
        if (text.Length == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Antwort ist leer.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid partId;
        await using (var head = new SqlCommand(
            "SELECT part_id FROM dbo.rc_event_topic WHERE id = @id;", connection))
        {
            head.Parameters.AddWithValue("@id", id);
            if (await head.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcAreas.NotForYou(ctx);
                return;
            }
            partId = found;
        }

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, partId, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        var session = ctx.RcSession();
        var official = session is not null
            && (await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                    owner.Value.AreaId, RcCapability.Write, ctx.RequestAborted)).Allowed;

        Guid? registration = null;
        if (!official)
        {
            registration = await RegistrationOfClaimAsync(connection, body.Claim, ctx.RequestAborted);
            if (registration is null) { await NoSuchClaim(ctx); return; }
        }

        var now = DateTimeOffset.UtcNow;
        var author = Trim(body.AuthorName, 120) ?? (official ? "Organizator" : "Uczestnik");

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await InsertMessageAsync(connection, tx, id, registration, author, text, official, now, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx, new RcEventTopicRepliedResponse(RcId.ToText(id), true));
    }

    public sealed record ModerateRequest(string? Status);

    private static async Task ModerateAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, ModerateRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var status = (body.Status ?? string.Empty).Trim();
        if (status is not ("open" or "answered" or "hidden"))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diesen Zustand gibt es nicht.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid partId;
        await using (var head = new SqlCommand(
            "SELECT part_id FROM dbo.rc_event_topic WHERE id = @id;", connection))
        {
            head.Parameters.AddWithValue("@id", id);
            if (await head.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcAreas.NotForYou(ctx);
                return;
            }
            partId = found;
        }

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, partId, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await RcEventEditing.MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        await using (var cmd = new SqlCommand(
            "UPDATE dbo.rc_event_topic SET status = @status WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@status", status);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventTopicModeratedResponse(RcId.ToText(id), status));
    }

    private static async Task InsertMessageAsync(
        SqlConnection connection, SqlTransaction tx, Guid topicId, Guid? registrationId,
        string author, string body, bool official, DateTimeOffset now, CancellationToken ct)
    {
        await using (var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_event_topic_message
                (id, topic_id, registration_id, author_name, body, is_hidden, is_official, created_at)
            VALUES (@id, @topic, @reg, @author, @body, 0, @official, @now);
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", RcId.NewId());
            cmd.Parameters.AddWithValue("@topic", topicId);
            cmd.Parameters.Add("@reg", System.Data.SqlDbType.UniqueIdentifier).Value =
                (object?)registrationId ?? DBNull.Value;
            cmd.Parameters.AddWithValue("@author", author);
            cmd.Parameters.AddWithValue("@body", body);
            cmd.Parameters.AddWithValue("@official", official);
            cmd.Parameters.AddWithValue("@now", now);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // Der Zaehler wird MITGEFUEHRT, nicht bei jeder Liste gezaehlt: die
        // Uebersicht liest ihn je Thema, und ein COUNT je Zeile wuerde die
        // Liste mit ihrer Laenge langsamer machen.
        await using (var bump = new SqlCommand("""
            UPDATE dbo.rc_event_topic
               SET message_count = message_count + 1, last_message_at = @now
             WHERE id = @id;
            """, connection, tx))
        {
            bump.Parameters.AddWithValue("@now", now);
            bump.Parameters.AddWithValue("@id", topicId);
            await bump.ExecuteNonQueryAsync(ct);
        }
    }

    // -- Gemeinsames ----------------------------------------------------------

    /// <summary>
    /// Der Beleg zur Anmeldung. <c>null</c>, wenn er nicht passt — und dieselbe
    /// Antwort fuer „falscher Beleg" wie fuer „gibt es nicht": alles andere
    /// waere ein Orakel, an dem sich Belege erraten liessen.
    /// </summary>
    private static async Task<Guid?> RegistrationOfClaimAsync(
        SqlConnection connection, string? claim, CancellationToken ct)
    {
        var text = (claim ?? string.Empty).Trim();
        if (text.Length is 0 or > 200) return null;

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(text));

        await using var cmd = new SqlCommand(
            "SELECT id FROM dbo.rc_event_registration WHERE claim_hash = @hash AND withdrawn_at IS NULL;",
            connection);
        cmd.Parameters.AddWithValue("@hash", hash);

        return await cmd.ExecuteScalarAsync(ct) is Guid id ? id : null;
    }

    private static Task NoSuchClaim(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            "registration.not_found", "Zu diesem Beleg gibt es keine Anmeldung.");

    /// <summary>
    /// Unter welcher Epoche der Annahmeschluessel der Veranstaltung liegt.
    /// <c>null</c>, wenn sie keinen hat — dann kann sie nichts entgegennehmen.
    /// </summary>
    private static async Task<int?> IntakeEpochAsync(
        SqlConnection connection, Guid eventId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT intake_epoch FROM dbo.rc_event WHERE id = @id AND intake_public_key IS NOT NULL;",
            connection);
        cmd.Parameters.AddWithValue("@id", eventId);

        return await cmd.ExecuteScalarAsync(ct) is int epoch ? epoch : null;
    }

    private static string? Trim(string? value, int max)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length == 0) return null;
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }
}
