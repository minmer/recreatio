using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Anmeldungen zu einer Veranstaltung.
///
/// <b>Hier hoert das Oeffentliche auf.</b> Ein Formular kann jeder sehen — es
/// steht auf einer Seite, die verschickt werden soll. Was jemand
/// hineingeschrieben hat, ist IMMER versiegelt, auch bei einer voellig
/// oeffentlichen Veranstaltung. Die Beschriftung ist oeffentlich, die Antwort
/// nie.
///
/// <b>Ohne Konto einsenden ist der Normalfall</b> und kein Mangel. Wer sich zu
/// einem Pfarrfest anmeldet, legt sich dafuer kein Konto an. Er bekommt einen
/// Beleg — und nur dessen SHA-256 wird gespeichert. Wer die Tabelle
/// vollstaendig besitzt, kann eine Anmeldung damit nicht aufrufen; nur wer den
/// Beleg hat, kann es.
///
/// <b>Ruecknahme ist keine Loeschung der Zeile</b> (12.3.2). Die Werte werden
/// vernichtet, die Zeile bleibt: sonst stimmten die Zahlen nicht mehr, und
/// „waren es nun achtzig oder einundachtzig" ist genau die Frage, die eine
/// Anmeldeliste beantworten soll.
/// </summary>
public static class RcRegistrations
{
    public static void MapRcRegistrations(this IEndpointRouteBuilder app)
    {
        // Ohne Konto erreichbar: das ist der Zweck.
        app.MapPost("/rc/event-parts/{id:guid}/registrations", SubmitAsync)
            .Produces<RcRegistrationSubmittedResponse>();

        app.MapGet("/rc/event-parts/{id:guid}/registrations", ListAsync)
            .Produces<RcRegistrationsResponse>();

        app.MapPost("/rc/registrations/{id:guid}/withdraw", WithdrawAsync)
            .Produces<RcRegistrationWithdrawnResponse>();
    }

    private static RcAad AnswerAad(Guid registrationId, Guid fieldId) =>
        // Die Kennung im Etikett ist die der ANMELDUNG; das Feld steckt in der
        // Fassungsnummer nicht, also traegt es hier keinen eigenen Platz. Zwei
        // Werte derselben Anmeldung unterscheiden sich ueber die Zeile, die sie
        // haelt — uq_rc_event_reg_value sorgt dafuer, dass es je Feld genau eine
        // gibt, und damit ist der Platz eindeutig.
        RcAad.Create("events", "registration", registrationId, RcField.EventAnswer, 1);

    /// <summary>
    /// Der Platz des VERPACKTEN Sitzungsschluessels.
    ///
    /// Er gehoert der Anmeldung (deshalb deren Kennung) und ist ein Schluessel,
    /// keine Antwort (deshalb das Feld intake_key). Beide Seiten muessen hier
    /// dasselbe bilden — der erste Anlauf verpackte im Browser unter der
    /// Antwort-AAD und packte auf dem Server unter der Veranstaltungs-AAD aus.
    /// Beide Seiten waren fuer sich schluessig, und nichts ging auf.
    ///
    /// Der gemeinsame Testvektor konnte das NICHT finden: er prueft das Format,
    /// nicht die Verabredung darueber, welcher Platz gemeint ist. Gefunden hat
    /// es der Durchgang gegen den laufenden Dienst.
    /// </summary>
    private static RcAad WrapAad(Guid registrationId) =>
        RcAad.Create("events", "registration", registrationId, RcField.EventIntakeKey, 1);

    // -- Einsenden ------------------------------------------------------------

    /// <summary>
    /// Eine Antwort. <paramref name="Value"/> ist Klartext und NUR fuer den Weg
    /// zulaessig, auf dem ein Mitglied mit eigenem Schluessel einsendet.
    /// </summary>
    public sealed record Answer(string FieldId, string Value);

    /// <summary>
    /// Eine bereits versiegelte Antwort. Der Browser des Anmelders hat sie
    /// verschlossen; der Server sieht nur Geheimtext und reicht ihn durch.
    /// </summary>
    public sealed record SealedAnswer(string FieldId, string Sealed);

    /// <summary>
    /// Zwei Wege, einer davon der Normalfall.
    ///
    /// <b>Von aussen</b> (kein Konto): <paramref name="SealedAnswers"/> und
    /// <paramref name="SessionKeyWrapped"/>. Der Browser wuerfelt einen
    /// Sitzungsschluessel, versiegelt damit die Antworten und verpackt ihn
    /// unter dem oeffentlichen Annahmeschluessel der Veranstaltung. Der Server
    /// kann keines von beiden oeffnen — er legt sie nur hin.
    ///
    /// <b>Von innen</b> (Mitglied mit Schluessel): <paramref name="Answers"/>
    /// im Klartext ueber TLS, der Server versiegelt unter dem
    /// Epochenschluessel. Das ist kein Rueckschritt: wer den Epochenschluessel
    /// ohnehin hat, gewinnt nichts dadurch, selbst zu versiegeln — und der
    /// Server erfaehrt nichts, was er nicht ohnehin herausgeben duerfte.
    /// </summary>
    /// <param name="RegistrationId">
    /// Die Kennung der Anmeldung — vom EINSENDER vergeben, wenn er selbst
    /// versiegelt hat.
    ///
    /// Das sieht nach einer Schwaeche aus und ist keine. Die Kennung steckt in
    /// der AAD jeder versiegelten Antwort (3.13); wer versiegelt, muss sie also
    /// VOR dem Versiegeln kennen. Vergaebe der Server sie, waeren die Huellen
    /// unter einer anderen Kennung verschlossen als der, unter der sie liegen —
    /// und nichts ginge je wieder auf. Aufgefallen waere das nicht beim
    /// Absenden, sondern Wochen spaeter beim ersten Blick in die Liste.
    ///
    /// Missbrauch faengt die Datenbank ab: die Kennung ist eindeutig, eine
    /// zweite Anmeldung darunter wird abgewiesen. Ueberschreiben kann damit
    /// niemand etwas.
    /// </param>
    public sealed record SubmitRequest(
        Answer[]? Answers, SealedAnswer[]? SealedAnswers, string? SessionKeyWrapped,
        string? RoleId, string? ConsentTextId, string? RegistrationId);

    private static async Task SubmitAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, SubmitRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var part = await LoadFormAsync(connection, id, ctx.RequestAborted);
        if (part is null) { await RcAreas.NotForYou(ctx); return; }

        // Ein Entwurf nimmt nichts entgegen. Sonst saessen nach der
        // Veroeffentlichung Anmeldungen in der Liste, die jemand beim
        // Ausprobieren erzeugt hat.
        if (part.Lifecycle != RcEvents.LifecyclePublished)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Veranstaltung nimmt noch keine Anmeldungen entgegen.");
            return;
        }

        var fields = await LoadFieldsAsync(connection, id, ctx.RequestAborted);
        if (fields.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Dieses Formular hat keine Felder.");
            return;
        }

        // Klartext (von innen) und Geheimtext (von aussen) werden getrennt
        // gesammelt. Welcher Weg gilt, entscheidet sich weiter unten am
        // Schluessel — hier wird nur eingesammelt, was da ist.
        var answers = new Dictionary<Guid, string>();
        foreach (var answer in body.Answers ?? [])
        {
            if (!Guid.TryParse(answer.FieldId, out var fieldId) || !fields.ContainsKey(fieldId)) continue;
            var value = answer.Value?.Trim() ?? "";
            if (value.Length > 0) answers[fieldId] = value;
        }

        var sealedAnswers = new Dictionary<Guid, byte[]>();
        foreach (var answer in body.SealedAnswers ?? [])
        {
            if (!Guid.TryParse(answer.FieldId, out var fieldId) || !fields.ContainsKey(fieldId)) continue;
            if (RcBase64Url.TryDecode(answer.Sealed, out var blob)) sealedAnswers[fieldId] = blob;
        }

        // Pflichtfelder werden HIER geprueft und nicht nur im Browser. Eine
        // Regel, die der Klient durchsetzt, ist keine Regel.
        var missing = fields.Values
            .Where(f => f.IsRequired && !answers.ContainsKey(f.Id) && !sealedAnswers.ContainsKey(f.Id))
            .Select(f => f.Label)
            .ToArray();

        if (missing.Length > 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                $"Es fehlen Pflichtangaben: {string.Join(", ", missing)}.");
            return;
        }

        var session = ctx.RcSession();
        var now = DateTimeOffset.UtcNow;

        // Wer selbst versiegelt hat, bringt die Kennung mit — sie steckt in
        // seinen Huellen. Wer nicht, bekommt eine vom Server.
        var registrationId = Guid.TryParse(body.RegistrationId, out var offered)
            ? offered
            : RcId.NewId();

        // Welcher der beiden Wege gilt, entscheidet sich hier — und zwar am
        // Schluessel, nicht an einem Merker aus der Anfrage. Wer einen
        // Epochenschluessel hat, ist drin; wer keinen hat, kommt von aussen.
        // Ein Feld "istVonAussen" waere eine Angabe, die der Absender selbst
        // macht, und damit keine.
        byte[]? epochKey = null;
        byte[]? wrapped = null;
        var epoch = part.CurrentEpoch;

        if (session is not null && ctx.RcHasUnlockPiece())
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
                part.AreaId, ctx.RequestAborted);

            if (keys.Count > 0)
            {
                epoch = keys.Keys.Max();
                epochKey = keys[epoch];
            }
        }

        if (epochKey is null)
        {
            // Der Weg von aussen. Der Browser hat schon versiegelt; hier wird
            // nur noch nachgesehen, dass beides da ist.
            //
            // NICHT geprueft wird, ob sich der verpackte Schluessel oeffnen
            // laesst — der Server kann das per Bau nicht, und genau das ist der
            // Punkt. Wer Unsinn einsendet, hat eine Anmeldung erzeugt, die
            // niemand lesen kann; das faellt beim Ansehen der Liste auf und
            // steht dort als unlesbar (15.9), statt hier stillschweigend
            // durchzurutschen.
            if (string.IsNullOrEmpty(body.SessionKeyWrapped)
                || !RcBase64Url.TryDecode(body.SessionKeyWrapped, out var wrappedBytes))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                    RcErrorCodes.CryptoMissingKey,
                    "Ohne verpackten Sitzungsschluessel nimmt dieses Formular nichts entgegen.");
                return;
            }

            if ((body.SealedAnswers?.Length ?? 0) == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                    RcErrorCodes.PermissionDenied, "Es wurden keine Antworten mitgeschickt.");
                return;
            }

            // Die Kennung MUSS mitkommen: unter ihr wurde versiegelt. Sie hier
            // stillschweigend zu wuerfeln hiesse, Huellen anzunehmen, die
            // niemand je oeffnen kann.
            if (!Guid.TryParse(body.RegistrationId, out _))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                    RcErrorCodes.PermissionDenied,
                    "Wer selbst versiegelt, muss die Kennung der Anmeldung mitschicken.");
                return;
            }

            wrapped = wrappedBytes;
        }

        string? claim = null;
        byte[]? claimHash = null;
        Guid? submitter = null;

        if (session is not null && Guid.TryParse(body.RoleId, out var roleId))
        {
            submitter = roleId;
        }
        else
        {
            // 10.3.1 — Derselbe Baustein wie ueberall: ein Geheimnis aus dem
            // Zufallsgenerator, gespeichert wird nur sein Abdruck.
            claim = RcBase64Url.Encode(RandomNumberGenerator.GetBytes(24));
            claimHash = SHA256.HashData(Encoding.UTF8.GetBytes(claim));
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_event_registration
                    (id, event_id, part_id, epoch, submitter_role_id, claim_hash, submitted_at,
                     consent_text_id, session_key_wrapped)
                VALUES (@id, @event, @part, @epoch, @role, @claim, @now, @consent, @wrapped);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", registrationId);
                insert.Parameters.AddWithValue("@event", part.EventId);
                insert.Parameters.AddWithValue("@part", id);
                insert.Parameters.AddWithValue("@epoch", epoch);
                insert.Parameters.Add("@role", System.Data.SqlDbType.UniqueIdentifier).Value =
                    (object?)submitter ?? DBNull.Value;
                insert.Parameters.Add("@claim", System.Data.SqlDbType.Binary, 32).Value =
                    (object?)claimHash ?? DBNull.Value;
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.Add("@consent", System.Data.SqlDbType.UniqueIdentifier).Value =
                    Guid.TryParse(body.ConsentTextId, out var consent) ? consent : DBNull.Value;
                insert.Parameters.Add("@wrapped", System.Data.SqlDbType.VarBinary, 1024).Value =
                    (object?)wrapped ?? DBNull.Value;

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            // Von innen: hier versiegeln. Von aussen: durchreichen, was schon
            // versiegelt ankam. In beiden Faellen landet nur Geheimtext in der
            // Zeile — der Unterschied ist, WER verschlossen hat.
            var toStore = epochKey is not null
                ? answers.ToDictionary(a => a.Key,
                    a => RcCrypto.Seal(epochKey, AnswerAad(registrationId, a.Key), Encoding.UTF8.GetBytes(a.Value)))
                : sealedAnswers;

            foreach (var (fieldId, blob) in toStore)
            {
                await using var insert = new SqlCommand("""
                    INSERT INTO dbo.rc_event_registration_value (registration_id, field_id, value_sealed)
                    VALUES (@reg, @field, @value);
                    """, connection, tx);

                insert.Parameters.AddWithValue("@reg", registrationId);
                insert.Parameters.AddWithValue("@field", fieldId);
                insert.Parameters.AddWithValue("@value", blob);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Anmeldung gibt es schon.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcRegistrationSubmittedResponse(
            RcId.ToText(registrationId), claim, now), StatusCodes.Status201Created);
    }

    // -- Ansehen --------------------------------------------------------------

    public sealed record RegistrationView(
        string RegistrationId, DateTimeOffset SubmittedUtc, bool Withdrawn,
        string? SubmitterRoleId, IReadOnlyList<AnswerView> Answers, string? Unreadable);

    /// <summary>
    /// <paramref name="DataClass"/> reist MIT der Antwort. Wer eine Liste
    /// ansieht, soll sehen, welche Spalte eine besondere Kategorie ist — nicht
    /// erst, wenn er sie exportiert hat.
    /// </summary>
    public sealed record AnswerView(string FieldId, string Label, string? Value, string DataClass);

    private static async Task ListAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var part = await LoadFormAsync(connection, id, ctx.RequestAborted);
        if (part is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, part.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            part.AreaId, ctx.RequestAborted);

        var fields = await LoadFieldsAsync(connection, id, ctx.RequestAborted);

        // Der private Annahmeschluessel. Er liegt selbst unter einem
        // Epochenschluessel — wer den nicht hat, kann auch die Anmeldungen von
        // aussen nicht oeffnen, und das ist richtig so.
        using var intake = await OpenIntakeAsync(connection, part.EventId, keys, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT r.id, r.epoch, r.submitted_at, r.withdrawn_at, r.submitter_role_id, r.session_key_wrapped
            FROM dbo.rc_event_registration r
            WHERE r.part_id = @part
            ORDER BY r.submitted_at DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@part", id);

        var rows = new List<(Guid Id, int Epoch, DateTimeOffset At, DateTimeOffset? Withdrawn,
            Guid? Role, byte[]? Wrapped)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                rows.Add((reader.GetGuid(0), reader.GetInt32(1), reader.GetDateTimeOffset(2),
                    reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3),
                    reader.IsDBNull(4) ? null : reader.GetGuid(4),
                    reader.IsDBNull(5) ? null : (byte[])reader[5]));
        }

        var views = new List<RegistrationView>();
        foreach (var row in rows)
        {
            string? unreadable = null;
            var answers = new List<AnswerView>();

            // Zwei Herkuenfte, zwei Wege zum Schluessel:
            //   von innen  — der Epochenschluessel der Anmeldung
            //   von aussen — der Sitzungsschluessel, verpackt unter dem
            //                Annahmeschluessel der Veranstaltung
            byte[]? key = null;

            if (row.Wrapped is not null)
            {
                if (intake is null)
                {
                    unreadable = RcErrorCodes.CryptoMissingKey;
                }
                else
                {
                    try
                    {
                        key = RcCrypto.UnwrapKey(intake, WrapAad(row.Id), row.Wrapped);
                    }
                    catch (RcDecryptException e)
                    {
                        // Eine Einsendung mit unbrauchbarem Schluessel. Sie
                        // bleibt in der Liste stehen, mit Grund (15.9): sie
                        // still zu unterschlagen hiesse, dass niemand merkt,
                        // dass jemand sich angemeldet hat.
                        unreadable = e.Code;
                    }
                }
            }
            else if (!keys.TryGetValue(row.Epoch, out key))
            {
                // 15.9 — Sie faellt NICHT aus der Liste. Wer spaeter dazukam,
                // soll sehen, DASS es Anmeldungen aus der Zeit davor gibt.
                unreadable = RcErrorCodes.CryptoMissingEpoch;
            }

            if (key is not null)
            {
                foreach (var (fieldId, sealedValue) in await LoadValuesAsync(connection, row.Id, ctx.RequestAborted))
                {
                    if (!fields.TryGetValue(fieldId, out var field)) continue;

                    string? value = null;
                    if (sealedValue is not null)
                    {
                        try { value = Encoding.UTF8.GetString(RcCrypto.Open(key, AnswerAad(row.Id, fieldId), sealedValue)); }
                        catch (RcDecryptException e) { unreadable ??= e.Code; }
                    }

                    answers.Add(new AnswerView(RcId.ToText(fieldId), field.Label, value, field.DataClass));
                }
            }

            views.Add(new RegistrationView(
                RcId.ToText(row.Id), row.At, row.Withdrawn is not null,
                row.Role is null ? null : RcId.ToText(row.Role.Value),
                answers.OrderBy(a => fields[Guid.Parse(a.FieldId)].SortOrder).ToList(), unreadable));
        }

        await RcResults.WriteJsonAsync(ctx, new RcRegistrationsResponse(views));
    }

    // -- Zuruecknehmen --------------------------------------------------------

    public sealed record WithdrawRequest(string? Claim);

    /// <summary>
    /// 12.3.2 — Loeschung durch Schluesselvernichtung, hier als
    /// Wertvernichtung: die Zeile bleibt, damit die Zahlen stimmen, der Inhalt
    /// ist weg. Anders als bei einem Ketteneintrag gibt es hier keinen Grund,
    /// den Geheimtext aufzuheben — er gehoert dem Einsender, nicht dem Beweis.
    ///
    /// Zurueckziehen darf, wem die Anmeldung gehoert: entweder ueber seinen
    /// Beleg oder ueber seine Rolle. Die Leitung der Veranstaltung darf es
    /// AUCH — nicht aus Bequemlichkeit, sondern weil sonst niemand einer
    /// Loeschbitte nachkommen koennte, deren Beleg verloren ist.
    /// </summary>
    private static async Task WithdrawAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, WithdrawRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var load = new SqlCommand("""
            SELECT r.claim_hash, r.submitter_role_id, r.withdrawn_at, e.area_id
            FROM dbo.rc_event_registration r
            JOIN dbo.rc_event e ON e.id = r.event_id
            WHERE r.id = @id;
            """, connection);
        load.Parameters.AddWithValue("@id", id);

        byte[]? claimHash = null;
        Guid? submitter = null, areaId = null;
        bool already = false;

        await using (var reader = await load.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            claimHash = reader.IsDBNull(0) ? null : (byte[])reader[0];
            submitter = reader.IsDBNull(1) ? null : reader.GetGuid(1);
            already = !reader.IsDBNull(2);
            areaId = reader.GetGuid(3);
        }

        // Schon zurueckgenommen: kein Fehler. Wer zweimal klickt, soll nicht
        // erschrecken — es ist ja bereits geschehen.
        if (already)
        {
            await RcResults.WriteJsonAsync(ctx, new RcRegistrationWithdrawnResponse(RcId.ToText(id), 0));
            return;
        }

        var session = ctx.RcSession();
        var allowed = false;

        if (claimHash is not null && !string.IsNullOrEmpty(body.Claim))
        {
            // Zeitkonstant. Ein Vergleich, der frueher abbricht, verraet, wie
            // viele Zeichen stimmten.
            var offered = SHA256.HashData(Encoding.UTF8.GetBytes(body.Claim));
            allowed = CryptographicOperations.FixedTimeEquals(offered, claimHash);
        }

        // Wer unter einem Namen eingesandt hat, darf unter demselben Namen
        // zuruecknehmen. Geprueft wird der SCHLUESSEL der Rolle, nicht eine
        // Behauptung: nur wer ihn oeffnen kann, haelt die Rolle wirklich.
        //
        // Hier stand zuerst eine Pruefung auf Lesezugriff im Bereich. Das war zu
        // weit: dann haette jedes Mitglied die Anmeldung jedes anderen
        // zuruecknehmen koennen — und dabei ausgesehen, als sei es der
        // Einsender gewesen.
        if (!allowed && session is not null && submitter is not null && ctx.RcHasUnlockPiece())
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            allowed = await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey,
                submitter.Value, ctx.RequestAborted) is not null;
        }

        // Und die Leitung des Bereichs. Nicht aus Bequemlichkeit, sondern weil
        // sonst niemand einer Loeschbitte nachkommen koennte, deren Beleg
        // verloren ist.
        if (!allowed && session is not null)
        {
            allowed = (await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId!.Value,
                RcCapability.Admin, ctx.RequestAborted)).Allowed;
        }

        if (!allowed) { await RcAreas.NotForYou(ctx); return; }

        var destroyed = 0;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            await using (var clear = new SqlCommand(
                "UPDATE dbo.rc_event_registration_value SET value_sealed = NULL WHERE registration_id = @id;",
                connection, tx))
            {
                clear.Parameters.AddWithValue("@id", id);
                destroyed = await clear.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var mark = new SqlCommand(
                "UPDATE dbo.rc_event_registration SET withdrawn_at = @now WHERE id = @id;", connection, tx))
            {
                mark.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                mark.Parameters.AddWithValue("@id", id);
                await mark.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcRegistrationWithdrawnResponse(RcId.ToText(id), destroyed));
    }

    // -- Kleinkram ------------------------------------------------------------

    /// <summary>
    /// Den privaten Annahmeschluessel oeffnen — oder <c>null</c>, wenn der
    /// Leser den passenden Epochenschluessel nicht hat.
    ///
    /// <c>null</c> ist hier KEIN Fehler, sondern eine Auskunft: es heisst, dass
    /// dieser Leser die von aussen eingegangenen Anmeldungen nicht sehen kann.
    /// Die Liste zeigt sie trotzdem, als unlesbar.
    /// </summary>
    private static async Task<RSA?> OpenIntakeAsync(
        SqlConnection connection, Guid eventId, IReadOnlyDictionary<int, byte[]> keys, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT intake_private_sealed, intake_epoch FROM dbo.rc_event WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", eventId);

        byte[]? sealedKey = null;
        int epoch = 0;

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct) || reader.IsDBNull(0)) return null;
            sealedKey = (byte[])reader[0];
            epoch = reader.GetInt32(1);
        }

        if (!keys.TryGetValue(epoch, out var epochKey)) return null;

        try
        {
            var pkcs8 = RcCrypto.Open(epochKey, RcEvents.IntakeAad(eventId), sealedKey);
            var rsa = RSA.Create();
            rsa.ImportPkcs8PrivateKey(pkcs8, out _);
            return rsa;
        }
        catch (RcDecryptException)
        {
            return null;
        }
    }

    private sealed record FormRow(Guid EventId, Guid AreaId, string Lifecycle, int CurrentEpoch);

    private static async Task<FormRow?> LoadFormAsync(SqlConnection connection, Guid partId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT e.id, e.area_id, e.lifecycle, a.current_epoch
            FROM dbo.rc_event_part p
            JOIN dbo.rc_event_page g ON g.id = p.page_id
            JOIN dbo.rc_event e      ON e.id = g.event_id
            JOIN dbo.rc_area a       ON a.id = e.area_id
            WHERE p.id = @id AND p.kind = 'form';
            """, connection);
        cmd.Parameters.AddWithValue("@id", partId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new FormRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetInt32(3))
            : null;
    }

    private sealed record FieldRow(Guid Id, string Label, bool IsRequired, string DataClass, int SortOrder);

    private static async Task<Dictionary<Guid, FieldRow>> LoadFieldsAsync(
        SqlConnection connection, Guid partId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT id, label, is_required, data_class, sort_order
            FROM dbo.rc_event_field WHERE part_id = @part ORDER BY sort_order, seq;
            """, connection);
        cmd.Parameters.AddWithValue("@part", partId);

        var fields = new Dictionary<Guid, FieldRow>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var id = reader.GetGuid(0);
            fields[id] = new FieldRow(id, reader.GetString(1), reader.GetBoolean(2),
                reader.GetString(3), reader.GetInt32(4));
        }
        return fields;
    }

    private static async Task<List<(Guid FieldId, byte[]? Value)>> LoadValuesAsync(
        SqlConnection connection, Guid registrationId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT field_id, value_sealed FROM dbo.rc_event_registration_value
            WHERE registration_id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", registrationId);

        var values = new List<(Guid, byte[]?)>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            values.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : (byte[])reader[1]));
        return values;
    }
}
