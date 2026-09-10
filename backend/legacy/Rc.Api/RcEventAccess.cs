using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Der persoenliche Zugang zu einer Veranstaltung.
///
/// <b>Was das alte Modul hier konnte und rc nicht.</b> Dort bekommt ein
/// Teilnehmer ohne Konto eine Adresse, und die oeffnet GENAU die internen
/// Seiten, die ihm zugeteilt wurden — kein Rechteleiter, eine Zeile je Seite,
/// und ihr Fehlen ist die Absage. rc hatte dafuer nur den Anmeldebeleg: er sagt
/// „ich bin der, der sich angemeldet hat", oeffnet aber nichts, was
/// verschluesselt liegt.
///
/// <b>Wie der Schluessel an den Link kommt.</b>
///
/// <code>
///   token_sha256      zum Nachschlagen der Zeile
///   epoch_key_sealed  Seal(HKDF(token), aad, Epochenschluessel)
/// </code>
///
/// Beide Haelften sind noetig. Der Abdruck erlaubt das Finden und verraet den
/// Schluessel nicht — aus SHA-256 rechnet niemand das Token zurueck. Die Huelle
/// ist ohne Token nicht zu oeffnen: wer die Datenbank vollstaendig besitzt, hat
/// Abdruecke und Huellen und kommt an keine einzige interne Seite.
///
/// <b>Der Dienst sieht den Epochenschluessel kurz.</b> Er muss — sonst koennte
/// er die Seite nicht ausliefern. Das ist dieselbe Lage wie bei einem
/// angemeldeten Mitglied, dessen Schluessel er ebenso fuer die Dauer einer
/// Anfrage in der Hand hat; etwas anderes zu behaupten waere gelogen.
///
/// <b>Das Token steht in der ADRESSE</b>, anders als der Anmeldebeleg. Das ist
/// eine bewusste Abweichung von 3.12: ein Link soll sich per SMS verschicken
/// lassen, und ein Geheimnis, das man erst abtippen muss, wird aus der
/// Nachricht kopiert, in der es steht. Der Preis steht in der Oberflaeche: wer
/// den Link hat, kommt hinein.
/// </summary>
public static class RcEventAccess
{
    public static void MapRcEventAccess(this IEndpointRouteBuilder app)
    {
        // -- Der Leser mit Link -----------------------------------------------
        app.MapGet("/rc/event-access/{token}", ReadAsync).Produces<RcEventAccessViewResponse>();

        // -- Die Verwaltung ----------------------------------------------------
        app.MapGet("/rc/events/{id:guid}/access", ListAsync).Produces<RcEventAccessListResponse>();
        app.MapPost("/rc/events/{id:guid}/access", GrantAsync).Produces<RcEventAccessGrantedResponse>();
        app.MapPost("/rc/event-access/{id:guid}/update", UpdateAsync).Produces<RcEventAccessUpdatedResponse>();
        app.MapPost("/rc/event-access/{id:guid}/status", StatusAsync).Produces<RcEventAccessUpdatedResponse>();
        app.MapPost("/rc/event-access/{id:guid}/delete", DeleteAsync).Produces<RcEventDeletedResponse>();
    }

    /// <summary>
    /// 32 Byte aus dem Zufall des Betriebssystems, base64url.
    ///
    /// Das Token IST die ganze Berechtigung — es darf also nicht aus etwas
    /// entstehen, das jemand erraten kann: keine Zaehler, keine Zeitstempel,
    /// kein Name.
    /// </summary>
    private static string NewToken() => RcBase64Url.Encode(RandomNumberGenerator.GetBytes(32));

    private static byte[] Lookup(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));

    /// <summary>
    /// Der Schluessel, unter dem der Epochenschluessel liegt.
    ///
    /// ABGELEITET, nicht das Token selbst: derselbe Grund wie ueberall in
    /// diesem Haus — eine Zeichenfolge, die an zwei Stellen dasselbe tut,
    /// verknuepft die beiden Stellen. Und die Ableitung ist eine andere als
    /// der Abdruck, sonst waere der gespeicherte Abdruck der Schluessel.
    /// </summary>
    private static byte[] WrapKeyOf(string token) =>
        RcCrypto.Derive(Encoding.UTF8.GetBytes(token), $"recreatio:v1:event-access:{token.Length}", 32);

    private static RcAad AccessAad(Guid accessId) =>
        RcAad.Create("events", "access", accessId, RcField.EventIntakeKey, 1);

    // -- Lesen mit Link -----------------------------------------------------

    /// <summary>
    /// Was dieser Link oeffnet.
    ///
    /// <b>Die oeffentliche Seite kommt IMMER mit.</b> Sonst haette der
    /// Empfaenger keinen Weg zurueck zu dem, was alle sehen, ausser einer
    /// zweiten Adresse, die ihm niemand geschickt hat.
    ///
    /// <b>Eine nicht zugeteilte Seite steht nicht in der Antwort</b> — nicht
    /// „gesperrt", sondern gar nicht. Gefiltert wird in der Abfrage, nicht im
    /// Browser: was nicht mitgeschickt wird, kann auch nicht durchsickern.
    /// </summary>
    private static async Task ReadAsync(HttpContext ctx, RcDb db, string token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200)
        {
            await RcAreas.NotForYou(ctx);
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid accessId, eventId;
        byte[] sealedKey;
        int epoch;
        string recipient;
        string? personalNote;
        bool firstOpen;

        await using (var head = new SqlCommand("""
            SELECT a.id, a.event_id, a.epoch_key_sealed, a.epoch, a.recipient_name,
                   a.personal_note, a.contact_verified_at
            FROM dbo.rc_event_access a
            WHERE a.token_sha256 = @hash AND a.status = N'active';
            """, connection))
        {
            head.Parameters.AddWithValue("@hash", Lookup(token));
            await using var reader = await head.ExecuteReaderAsync(ctx.RequestAborted);

            // Dieselbe Antwort fuer „falsches Token" wie fuer „gibt es nicht":
            // alles andere waere ein Orakel, an dem sich Token erraten liessen.
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }

            accessId = reader.GetGuid(0);
            eventId = reader.GetGuid(1);
            sealedKey = (byte[])reader[2];
            epoch = reader.GetInt32(3);
            recipient = reader.GetString(4);
            personalNote = reader.IsDBNull(5) ? null : reader.GetString(5);
            firstOpen = reader.IsDBNull(6);
        }

        byte[] epochKey;
        try
        {
            epochKey = RcCrypto.Open(WrapKeyOf(token), AccessAad(accessId), sealedKey);
        }
        catch (RcDecryptException)
        {
            // Zeile gefunden, Huelle geht nicht auf. Das kann nur heissen, dass
            // der Bereich neu verschluesselt wurde — ein Betriebsfehler, kein
            // Benutzerfehler, und er gehoert benannt.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey,
                "Dieser Zugang laesst sich nicht mehr oeffnen. Bitte einen neuen anfordern.");
            return;
        }

        /*
         * Das ERSTE Oeffnen wird getrennt festgehalten von der Zaehlung.
         *
         * Das Token reist an genau eine Stelle: an die Nummer, an die der
         * Veranstalter es geschickt hat. Dass es aufgeht, beweist damit, dass
         * diese Nummer den Menschen erreicht — eine Auskunft, die kein
         * Besuchszaehler gibt.
         */
        await using (var seen = new SqlCommand("""
            UPDATE dbo.rc_event_access
               SET view_count = view_count + 1,
                   last_viewed_at = @now,
                   contact_verified_at = ISNULL(contact_verified_at, @now)
             WHERE id = @id;
            """, connection))
        {
            seen.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            seen.Parameters.AddWithValue("@id", accessId);
            await seen.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        var granted = new List<Guid>();
        await using (var cmd = new SqlCommand(
            "SELECT page_id FROM dbo.rc_event_access_page WHERE access_id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", accessId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) granted.Add(reader.GetGuid(0));
        }

        var notes = new List<RcEventAccessNote>();
        await using (var cmd = new SqlCommand(
            "SELECT label, value FROM dbo.rc_event_access_note WHERE access_id = @id ORDER BY sort_order;",
            connection))
        {
            cmd.Parameters.AddWithValue("@id", accessId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                notes.Add(new RcEventAccessNote(reader.GetString(0), reader.GetString(1)));
        }

        var view = await RcEvents.ReadForAccessAsync(
            connection, eventId, granted, epoch, epochKey, ctx.RequestAborted);

        CryptographicOperations.ZeroMemory(epochKey);

        if (view is null) { await RcAreas.NotForYou(ctx); return; }

        await RcResults.WriteJsonAsync(ctx, new RcEventAccessViewResponse(
            recipient, personalNote, firstOpen, notes, view));
    }

    // -- Zuteilen -------------------------------------------------------------

    public sealed record GrantRequest(
        string? RecipientName, string? RecipientContact,
        string[]? PageIds, string? PersonalNote, string? InternalNote,
        RcEventAccessNote[]? Notes);

    /// <summary>
    /// Einen Zugang ausstellen.
    ///
    /// <b>Das Token kommt EINMAL zurueck</b> und wird nirgends gespeichert —
    /// nur sein Abdruck. Wer es verliert, bekommt ein neues; wer die Tabelle
    /// hat, bekommt keins. Dieselbe Regel wie beim Anmeldebeleg, und aus
    /// demselben Grund.
    /// </summary>
    private static async Task GrantAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, GrantRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var recipient = (body.RecipientName ?? string.Empty).Trim();
        if (recipient.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Ohne Namen laesst sich kein Zugang fuehren.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId;
        await using (var cmd = new SqlCommand(
            "SELECT area_id FROM dbo.rc_event WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcAreas.NotForYou(ctx);
                return;
            }
            areaId = found;
        }

        if (!await RcEventEditing.MayWriteAreaAsync(ctx, permissions, session.AccountId, areaId)) return;

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        /*
         * Der Zugang bekommt die AKTUELLE Epoche mit auf den Weg. Schneidet der
         * Bereich spaeter eine neue, oeffnet dieser Link weiterhin, was zu
         * seiner Zeit gehoerte — und nichts von dem, was danach kam. Das ist
         * dieselbe Regel wie bei Nachrichten: wer spaeter dazukommt, sieht das
         * Frueheres nicht, und umgekehrt.
         */
        var keys = await RcAreaKeys.EpochKeysAsync(
            connection, session.AccountId, held.MasterKey, areaId, ctx.RequestAborted);

        if (keys.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer diesen Bereich fehlt dir der Schluessel.");
            return;
        }

        var epoch = keys.Keys.Max();
        var accessId = RcId.NewId();
        var token = NewToken();
        var now = DateTimeOffset.UtcNow;

        var sealedKey = RcCrypto.Seal(WrapKeyOf(token), AccessAad(accessId), keys[epoch]);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_event_access
                    (id, event_id, token_sha256, epoch_key_sealed, epoch,
                     recipient_name, recipient_contact, registration_id, status,
                     personal_note, internal_note, view_count, created_at, updated_at)
                VALUES (@id, @event, @hash, @sealed, @epoch,
                        @name, @contact, NULL, N'active',
                        @personal, @internal, 0, @now, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", accessId);
                insert.Parameters.AddWithValue("@event", id);
                insert.Parameters.AddWithValue("@hash", Lookup(token));
                insert.Parameters.AddWithValue("@sealed", sealedKey);
                insert.Parameters.AddWithValue("@epoch", epoch);
                insert.Parameters.AddWithValue("@name", recipient);
                Text(insert, "@contact", body.RecipientContact, 200);
                Text(insert, "@personal", body.PersonalNote, 1000);
                Text(insert, "@internal", body.InternalNote, 1000);
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await WritePagesAsync(connection, tx, accessId, id, body.PageIds, ctx.RequestAborted);
            await WriteNotesAsync(connection, tx, accessId, body.Notes, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx,
            new RcEventAccessGrantedResponse(RcId.ToText(accessId), token),
            StatusCodes.Status201Created);
    }

    // -- Fuehren --------------------------------------------------------------

    public sealed record AccessView(
        string AccessId, string RecipientName, string? RecipientContact, string Status,
        string? PersonalNote, string? InternalNote,
        bool ContactVerified, int ViewCount, DateTimeOffset? LastViewedUtc,
        IReadOnlyList<string> PageIds, IReadOnlyList<RcEventAccessNote> Notes,
        DateTimeOffset CreatedUtc);

    private static async Task ListAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId;
        await using (var cmd = new SqlCommand(
            "SELECT area_id FROM dbo.rc_event WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcAreas.NotForYou(ctx);
                return;
            }
            areaId = found;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var rows = new List<AccessView>();
        await using (var cmd = new SqlCommand("""
            SELECT id, recipient_name, recipient_contact, status, personal_note, internal_note,
                   contact_verified_at, view_count, last_viewed_at, created_at
            FROM dbo.rc_event_access WHERE event_id = @id
            ORDER BY created_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add(new AccessView(
                    RcId.ToText(reader.GetGuid(0)), reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    !reader.IsDBNull(6), reader.GetInt32(7),
                    reader.IsDBNull(8) ? null : reader.GetDateTimeOffset(8),
                    [], [], reader.GetDateTimeOffset(9)));
            }
        }

        // Seiten und Angaben je Zugang. Zwei Abfragen statt zwei je Zeile: eine
        // Liste von hundert Zugaengen waere sonst zweihundert Rundreisen.
        var pages = new Dictionary<string, List<string>>();
        await using (var cmd = new SqlCommand("""
            SELECT p.access_id, p.page_id FROM dbo.rc_event_access_page p
            JOIN dbo.rc_event_access a ON a.id = p.access_id
            WHERE a.event_id = @id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var key = RcId.ToText(reader.GetGuid(0));
                if (!pages.TryGetValue(key, out var list)) pages[key] = list = [];
                list.Add(RcId.ToText(reader.GetGuid(1)));
            }
        }

        var notes = new Dictionary<string, List<RcEventAccessNote>>();
        await using (var cmd = new SqlCommand("""
            SELECT n.access_id, n.label, n.value FROM dbo.rc_event_access_note n
            JOIN dbo.rc_event_access a ON a.id = n.access_id
            WHERE a.event_id = @id ORDER BY n.sort_order;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var key = RcId.ToText(reader.GetGuid(0));
                if (!notes.TryGetValue(key, out var list)) notes[key] = list = [];
                list.Add(new RcEventAccessNote(reader.GetString(1), reader.GetString(2)));
            }
        }

        var views = rows.Select(row => row with
        {
            PageIds = pages.TryGetValue(row.AccessId, out var p) ? p : [],
            Notes = notes.TryGetValue(row.AccessId, out var n) ? n : []
        }).ToList();

        await RcResults.WriteJsonAsync(ctx, new RcEventAccessListResponse(views));
    }

    public sealed record UpdateRequest(
        string? RecipientName, string? RecipientContact,
        string[]? PageIds, string? PersonalNote, string? InternalNote,
        RcEventAccessNote[]? Notes);

    private static async Task UpdateAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, UpdateRequest body)
    {
        var owner = await OpenForWriteAsync(ctx, db, permissions, id);
        if (owner is null) return;

        var (connection, eventId) = owner.Value;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var cmd = new SqlCommand("""
                UPDATE dbo.rc_event_access
                   SET recipient_name = ISNULL(@name, recipient_name),
                       recipient_contact = @contact,
                       personal_note = @personal,
                       internal_note = @internal,
                       updated_at = @now
                 WHERE id = @id;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                Text(cmd, "@name", body.RecipientName, 200);
                Text(cmd, "@contact", body.RecipientContact, 200);
                Text(cmd, "@personal", body.PersonalNote, 1000);
                Text(cmd, "@internal", body.InternalNote, 1000);
                cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (body.PageIds is not null)
            {
                await using (var wipe = new SqlCommand(
                    "DELETE FROM dbo.rc_event_access_page WHERE access_id = @id;", connection, tx))
                {
                    wipe.Parameters.AddWithValue("@id", id);
                    await wipe.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await WritePagesAsync(connection, tx, id, eventId, body.PageIds, ctx.RequestAborted);
            }

            if (body.Notes is not null)
            {
                await using (var wipe = new SqlCommand(
                    "DELETE FROM dbo.rc_event_access_note WHERE access_id = @id;", connection, tx))
                {
                    wipe.Parameters.AddWithValue("@id", id);
                    await wipe.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await WriteNotesAsync(connection, tx, id, body.Notes, ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx, new RcEventAccessUpdatedResponse(RcId.ToText(id), true));
    }

    public sealed record StatusRequest(string? Status);

    /// <summary>
    /// Zuruecknehmen oder wieder freigeben.
    ///
    /// <b>Zurueckgenommen, nicht geloescht.</b> Wer den Link schon geoeffnet
    /// hat, soll in der Liste bleiben — samt der Auskunft, dass seine Nummer
    /// erreichbar war. Loeschen ist die andere, unwiderrufliche Sache.
    /// </summary>
    private static async Task StatusAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, StatusRequest body)
    {
        var status = (body.Status ?? string.Empty).Trim();
        if (status is not ("active" or "revoked"))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diesen Zustand gibt es nicht.");
            return;
        }

        var owner = await OpenForWriteAsync(ctx, db, permissions, id);
        if (owner is null) return;

        await using (var cmd = new SqlCommand(
            "UPDATE dbo.rc_event_access SET status = @status, updated_at = @now WHERE id = @id;",
            owner.Value.Connection))
        {
            cmd.Parameters.AddWithValue("@status", status);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventAccessUpdatedResponse(RcId.ToText(id), true));
    }

    private static async Task DeleteAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var owner = await OpenForWriteAsync(ctx, db, permissions, id);
        if (owner is null) return;

        var connection = owner.Value.Connection;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            foreach (var sql in new[]
            {
                "DELETE FROM dbo.rc_event_access_note WHERE access_id = @id;",
                "DELETE FROM dbo.rc_event_access_page WHERE access_id = @id;",
                "DELETE FROM dbo.rc_event_access WHERE id = @id;"
            })
            {
                await using var cmd = new SqlCommand(sql, connection, tx);
                cmd.Parameters.AddWithValue("@id", id);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx, new RcEventDeletedResponse(RcId.ToText(id), true));
    }

    // -- Gemeinsames ----------------------------------------------------------

    private static async Task<(SqlConnection Connection, Guid EventId)?> OpenForWriteAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid accessId)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return null; }

        var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId, eventId;
        await using (var cmd = new SqlCommand("""
            SELECT e.area_id, e.id FROM dbo.rc_event_access a
            JOIN dbo.rc_event e ON e.id = a.event_id
            WHERE a.id = @id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", accessId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await connection.DisposeAsync();
                await RcAreas.NotForYou(ctx);
                return null;
            }
            areaId = reader.GetGuid(0);
            eventId = reader.GetGuid(1);
        }

        if (!await RcEventEditing.MayWriteAreaAsync(ctx, permissions, session.AccountId, areaId))
        {
            await connection.DisposeAsync();
            return null;
        }

        return (connection, eventId);
    }

    /// <summary>
    /// Die zugeteilten Seiten schreiben.
    ///
    /// Eine Kennung, die nicht zu DIESER Veranstaltung gehoert, wird
    /// uebergangen — sonst liesse sich ueber einen Zugang eine fremde Seite
    /// zuteilen, und das faellt niemandem auf, bis jemand sie liest.
    /// </summary>
    private static async Task WritePagesAsync(
        SqlConnection connection, SqlTransaction tx, Guid accessId, Guid eventId,
        string[]? pageIds, CancellationToken ct)
    {
        foreach (var text in pageIds ?? [])
        {
            if (!Guid.TryParse(text, out var pageId)) continue;

            await using var cmd = new SqlCommand("""
                INSERT INTO dbo.rc_event_access_page (id, access_id, page_id)
                SELECT @id, @access, @page
                WHERE EXISTS (SELECT 1 FROM dbo.rc_event_page
                               WHERE id = @page AND event_id = @event)
                  AND NOT EXISTS (SELECT 1 FROM dbo.rc_event_access_page
                                   WHERE access_id = @access AND page_id = @page);
                """, connection, tx);

            cmd.Parameters.AddWithValue("@id", RcId.NewId());
            cmd.Parameters.AddWithValue("@access", accessId);
            cmd.Parameters.AddWithValue("@page", pageId);
            cmd.Parameters.AddWithValue("@event", eventId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    private static async Task WriteNotesAsync(
        SqlConnection connection, SqlTransaction tx, Guid accessId,
        RcEventAccessNote[]? notes, CancellationToken ct)
    {
        var order = 0;
        foreach (var note in notes ?? [])
        {
            var label = (note.Label ?? string.Empty).Trim();
            var value = (note.Value ?? string.Empty).Trim();
            if (label.Length == 0) continue;

            await using var cmd = new SqlCommand("""
                INSERT INTO dbo.rc_event_access_note (id, access_id, sort_order, label, value)
                VALUES (@id, @access, @sort, @label, @value);
                """, connection, tx);

            cmd.Parameters.AddWithValue("@id", RcId.NewId());
            cmd.Parameters.AddWithValue("@access", accessId);
            cmd.Parameters.AddWithValue("@sort", order++);
            cmd.Parameters.Add("@label", System.Data.SqlDbType.NVarChar, 160).Value =
                label.Length > 160 ? label[..160] : label;
            cmd.Parameters.Add("@value", System.Data.SqlDbType.NVarChar, 600).Value =
                value.Length > 600 ? value[..600] : value;
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    private static void Text(SqlCommand cmd, string name, string? value, int max)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length > max) trimmed = trimmed[..max];

        cmd.Parameters.Add(name, System.Data.SqlDbType.NVarChar, max).Value =
            trimmed.Length == 0 ? DBNull.Value : trimmed;
    }
}
