using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Firmung — Jahrgang, Kandidaten, Treffen.
///
/// <b>Der empfindlichste Teil der Plattform.</b> Kandidaten sind
/// Minderjaehrige; was hier steht, ist besondere Kategorie nach 12.9 ohne
/// Abwaegung — Religionszugehoerigkeit ist es per Definition, und alles andere
/// haengt daran.
///
/// <b>Ein eigener Bereich, nicht der der Pfarrei.</b> Wer den Messplan pflegt,
/// hat damit nicht auch Zugriff auf die Akten der Kinder. Genau dafuer ist ein
/// Bereich die Einheit der Sichtbarkeit.
///
/// <b>Drei Dinge aus dem Altbestand werden nicht uebernommen:</b> Notizen im
/// Klartext, rohe Token in der Zeile, und ein einziger verschluesselter
/// Klumpen fuer alle Felder. Das dritte ist das heimtueckischste — mit einem
/// Klumpen laesst sich der Datensatz eines Kindes gegen den eines anderen
/// tauschen, ohne dass etwas auffaellt.
/// </summary>
public static class RcConfirmation
{
    public static void MapRcConfirmation(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/confirmation-groups", ListGroupsAsync).Produces<RcConfirmationGroupsResponse>();
        app.MapPost("/rc/confirmation-groups", CreateGroupAsync).Produces<RcConfirmationGroupCreatedResponse>();

        app.MapGet("/rc/confirmation-groups/{id:guid}/candidates", CandidatesAsync)
            .Produces<RcCandidatesResponse>();
        app.MapPost("/rc/confirmation-groups/{id:guid}/candidates", AddCandidateAsync)
            .Produces<RcCandidateCreatedResponse>();

        app.MapPost("/rc/candidates/{id:guid}/notes", AddNoteAsync).Produces<RcCandidateNoteAddedResponse>();
        app.MapPost("/rc/candidates/{id:guid}/withdraw", WithdrawCandidateAsync)
            .Produces<RcCandidateWithdrawnResponse>();

        app.MapGet("/rc/confirmation-groups/{id:guid}/slots", SlotsAsync).Produces<RcMeetingSlotsResponse>();
        app.MapPost("/rc/confirmation-groups/{id:guid}/slots", AddSlotAsync)
            .Produces<RcMeetingSlotCreatedResponse>();
        app.MapPost("/rc/meeting-slots/{id:guid}/book", BookAsync).Produces<RcMeetingBookedResponse>();
    }

    // -- AAD ------------------------------------------------------------------

    private static RcAad NameAad(Guid id) => Aad(id, RcField.CandidateName);
    private static RcAad BornAad(Guid id) => Aad(id, RcField.CandidateBorn);
    private static RcAad ContactAad(Guid id) => Aad(id, RcField.CandidateContact);
    private static RcAad SchoolAad(Guid id) => Aad(id, RcField.CandidateSchool);
    private static RcAad BaptismAad(Guid id) => Aad(id, RcField.CandidateBaptism);

    private static RcAad Aad(Guid candidateId, RcField field) =>
        RcAad.Create("confirmation", "candidate", candidateId, field, 1);

    private static RcAad NoteAad(Guid noteId) =>
        RcAad.Create("confirmation", "note", noteId, RcField.CandidateNote, 1);

    // -- Jahrgang -------------------------------------------------------------

    public sealed record CreateGroupRequest(string ParishId, string AreaId, string Name,
        DateOnly? StartsOn, DateOnly? EndsOn);

    private static async Task CreateGroupAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, CreateGroupRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.ParishId, out var parishId) || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Pfarrei oder Bereich fehlen.");
            return;
        }

        var name = body.Name?.Trim() ?? "";
        if (name.Length is 0 or > 120)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Name fehlt oder ist zu lang.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        // BEIDE Berechtigungen. Die Pfarrei zu verwalten genuegt nicht, um
        // einen Jahrgang in einen fremden Bereich zu haengen — sonst waere der
        // eigene Bereich fuer die Akten ein Vorschlag und keine Grenze.
        var parishArea = await AreaOfParishAsync(connection, parishId, ctx.RequestAborted);
        if (parishArea == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        foreach (var scope in new[] { parishArea, areaId })
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, scope,
                RcCapability.Admin, ctx.RequestAborted);
            if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }
        }

        var groupId = RcId.NewId();
        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_confirmation_group
                (id, parish_id, area_id, name, starts_on, ends_on, created_at)
            VALUES (@id, @parish, @area, @name, @from, @to, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", groupId);
        insert.Parameters.AddWithValue("@parish", parishId);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@name", name);
        insert.Parameters.Add("@from", System.Data.SqlDbType.Date).Value =
            body.StartsOn is null ? DBNull.Value : body.StartsOn.Value.ToDateTime(TimeOnly.MinValue);
        insert.Parameters.Add("@to", System.Data.SqlDbType.Date).Value =
            body.EndsOn is null ? DBNull.Value : body.EndsOn.Value.ToDateTime(TimeOnly.MinValue);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "An diesem Bereich haengt bereits ein Jahrgang.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcConfirmationGroupCreatedResponse(
            RcId.ToText(groupId), name), StatusCodes.Status201Created);
    }

    public sealed record GroupSummary(string GroupId, string ParishId, string AreaId,
        string Name, string Lifecycle, int Candidates, int Slots);

    private static async Task ListGroupsAsync(HttpContext ctx, RcDb db, RcPermissions permissions)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT g.id, g.parish_id, g.area_id, g.name, g.lifecycle,
                   (SELECT COUNT(*) FROM dbo.rc_candidate c
                     WHERE c.group_id = g.id AND c.status <> 'withdrawn'),
                   (SELECT COUNT(*) FROM dbo.rc_meeting_slot s WHERE s.group_id = g.id)
            FROM dbo.rc_confirmation_group g ORDER BY g.created_at DESC;
            """, connection);

        var all = new List<GroupSummary>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                all.Add(new GroupSummary(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    RcId.ToText(reader.GetGuid(2)), reader.GetString(3), reader.GetString(4),
                    reader.GetInt32(5), reader.GetInt32(6)));
        }

        var visible = new List<GroupSummary>();
        foreach (var group in all)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                Guid.Parse(group.AreaId), RcCapability.Read, ctx.RequestAborted);
            if (may.Allowed) visible.Add(group);
        }

        await RcResults.WriteJsonAsync(ctx, new RcConfirmationGroupsResponse(visible));
    }

    // -- Kandidaten -----------------------------------------------------------

    public sealed record AddCandidateRequest(string Name, string? Born, string? Contact,
        string? School, string? Baptism, string? ConsentTextId);

    private static async Task AddCandidateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddCandidateRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var name = body.Name?.Trim() ?? "";
        if (name.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Name fehlt oder ist zu lang.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var group = await LoadGroupAsync(connection, id, ctx.RequestAborted);
        if (group is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, group.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            group.AreaId, ctx.RequestAborted);
        if (keys.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Jahrgang.");
            return;
        }

        var epoch = keys.Keys.Max();
        var key = keys[epoch];
        var candidateId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_candidate
                (id, group_id, epoch, name_sealed, born_sealed, contact_sealed,
                 school_sealed, baptism_sealed, consent_text_id, created_at, updated_at)
            VALUES (@id, @group, @epoch, @name, @born, @contact,
                    @school, @baptism, @consent, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", candidateId);
        insert.Parameters.AddWithValue("@group", id);
        insert.Parameters.AddWithValue("@epoch", epoch);
        insert.Parameters.AddWithValue("@name",
            RcCrypto.Seal(key, NameAad(candidateId), Encoding.UTF8.GetBytes(name)));

        Seal(insert, "@born", key, BornAad(candidateId), Trim(body.Born, 100));
        Seal(insert, "@contact", key, ContactAad(candidateId), Trim(body.Contact, 500));
        Seal(insert, "@school", key, SchoolAad(candidateId), Trim(body.School, 300));
        Seal(insert, "@baptism", key, BaptismAad(candidateId), Trim(body.Baptism, 300));

        insert.Parameters.Add("@consent", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.ConsentTextId, out var consent) ? consent : DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCandidateCreatedResponse(
            RcId.ToText(candidateId), name), StatusCodes.Status201Created);
    }

    public sealed record NoteView(string NoteId, string AuthorRoleId, string? Text,
        bool ForFamily, DateTimeOffset CreatedUtc, string? Unreadable);

    public sealed record CandidateView(string CandidateId, string? Name, string? Born,
        string? Contact, string? School, string? Baptism,
        bool ConsentGiven, bool PaperReceived, bool QuizPassed,
        string Status, int Bookings, IReadOnlyList<NoteView> Notes, string? Unreadable);

    private static async Task CandidatesAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var group = await LoadGroupAsync(connection, id, ctx.RequestAborted);
        if (group is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, group.AreaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            group.AreaId, ctx.RequestAborted);

        /*
         * DIE SELBSTANMELDUNGEN LIEGEN ANDERS.
         *
         * Wer sich von aussen anmeldet, hat keinen Epochenschluessel. Seine
         * Felder liegen unter einem Sitzungsschluessel, der unter dem
         * oeffentlichen Annahmeschluessel der Gruppe verpackt ist — und dessen
         * privater Teil gehoert der AMTSROLLE, nicht dem Bereich.
         *
         * Deshalb zwei Wege im selben Durchgang: `epoch > 0` heisst von innen
         * eingetragen, `epoch = 0` heisst von aussen angemeldet. Wer die
         * Amtsrolle nicht haelt, sieht die zweiten als unlesbar — und sieht,
         * DASS sie da sind.
         */
        var sessionKeys = await RcConfirmationIntake.SessionKeysAsync(
            connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT c.id, c.epoch, c.name_sealed, c.born_sealed, c.contact_sealed,
                   c.school_sealed, c.baptism_sealed,
                   c.consent_given, c.paper_received, c.quiz_passed, c.status,
                   (SELECT COUNT(*) FROM dbo.rc_meeting_booking b WHERE b.candidate_id = c.id)
            FROM dbo.rc_candidate c WHERE c.group_id = @group ORDER BY c.created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@group", id);

        var rows = new List<(Guid Id, int Epoch, byte[] Name, byte[]? Born, byte[]? Contact,
            byte[]? School, byte[]? Baptism, bool Consent, bool Paper, bool Quiz, string Status, int Bookings)>();

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                rows.Add((reader.GetGuid(0), reader.GetInt32(1), (byte[])reader[2],
                    reader.IsDBNull(3) ? null : (byte[])reader[3],
                    reader.IsDBNull(4) ? null : (byte[])reader[4],
                    reader.IsDBNull(5) ? null : (byte[])reader[5],
                    reader.IsDBNull(6) ? null : (byte[])reader[6],
                    reader.GetBoolean(7), reader.GetBoolean(8), reader.GetBoolean(9),
                    reader.GetString(10), reader.GetInt32(11)));
        }

        var views = new List<CandidateView>();
        foreach (var row in rows)
        {
            string? unreadable = null;
            string? name = null, born = null, contact = null, school = null, baptism = null;
            // Von aussen angemeldet: der Schluessel gehoert der Anmeldung.

            var key = row.Epoch == 0
                ? (sessionKeys.TryGetValue(row.Id, out var own) ? own : null)
                : (keys.TryGetValue(row.Epoch, out var epochKey) ? epochKey : null);

            if (key is null)
            {
                // 15.9 — Der Kandidat faellt NICHT aus der Liste. Dass jemand
                // da ist, den man nicht lesen kann, ist eine Auskunft; ein Loch
                // in der Liste ist keine, und die Zahlen stimmten dann nicht.
                unreadable = RcErrorCodes.CryptoMissingEpoch;
            }
            else
            {
                name = OpenOrNull(key, NameAad(row.Id), row.Name, ref unreadable);
                born = OpenOrNull(key, BornAad(row.Id), row.Born, ref unreadable);
                contact = OpenOrNull(key, ContactAad(row.Id), row.Contact, ref unreadable);
                school = OpenOrNull(key, SchoolAad(row.Id), row.School, ref unreadable);
                baptism = OpenOrNull(key, BaptismAad(row.Id), row.Baptism, ref unreadable);
            }

            views.Add(new CandidateView(
                RcId.ToText(row.Id), name, born, contact, school, baptism,
                row.Consent, row.Paper, row.Quiz, row.Status, row.Bookings,
                await NotesAsync(connection, row.Id, keys, ctx.RequestAborted), unreadable));
        }

        await RcResults.WriteJsonAsync(ctx, new RcCandidatesResponse(views));
    }

    private static async Task<List<NoteView>> NotesAsync(
        SqlConnection connection, Guid candidateId,
        IReadOnlyDictionary<int, byte[]> keys, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT id, author_role_id, epoch, text_sealed, for_family, created_at
            FROM dbo.rc_candidate_note WHERE candidate_id = @id ORDER BY created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@id", candidateId);

        var notes = new List<NoteView>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var noteId = reader.GetGuid(0);
            var epoch = reader.GetInt32(2);

            string? text = null, unreadable = null;
            if (!keys.TryGetValue(epoch, out var key)) unreadable = RcErrorCodes.CryptoMissingEpoch;
            else text = OpenOrNull(key, NoteAad(noteId), (byte[])reader[3], ref unreadable);

            notes.Add(new NoteView(RcId.ToText(noteId), RcId.ToText(reader.GetGuid(1)),
                text, reader.GetBoolean(4), reader.GetDateTimeOffset(5), unreadable));
        }
        return notes;
    }

    public sealed record AddNoteRequest(string AuthorRoleId, string Text, bool? ForFamily);

    private static async Task AddNoteAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddNoteRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var text = body.Text?.Trim() ?? "";
        if (text.Length is 0 or > 20_000)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Notiz ist leer oder zu lang.");
            return;
        }

        if (!Guid.TryParse(body.AuthorRoleId, out var authorRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das ist keine Rollenkennung.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfCandidateAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        // Unter fremdem Namen schreibt niemand eine Notiz ueber ein Kind.
        if (await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey,
                authorRoleId, ctx.RequestAborted) is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Unter diesem Namen kannst du nicht schreiben.");
            return;
        }

        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            areaId, ctx.RequestAborted);

        if (keys.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Jahrgang.");
            return;
        }

        var epoch = keys.Keys.Max();
        var noteId = RcId.NewId();

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_candidate_note
                (id, candidate_id, author_role_id, epoch, text_sealed, for_family, created_at)
            VALUES (@id, @cand, @author, @epoch, @text, @family, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", noteId);
        insert.Parameters.AddWithValue("@cand", id);
        insert.Parameters.AddWithValue("@author", authorRoleId);
        insert.Parameters.AddWithValue("@epoch", epoch);
        insert.Parameters.AddWithValue("@text",
            RcCrypto.Seal(keys[epoch], NoteAad(noteId), Encoding.UTF8.GetBytes(text)));
        insert.Parameters.AddWithValue("@family", body.ForFamily ?? false);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCandidateNoteAddedResponse(
            RcId.ToText(noteId), body.ForFamily ?? false), StatusCodes.Status201Created);
    }

    /// <summary>
    /// 12.3 — Austritt vernichtet die Felder und laesst die Zeile stehen.
    ///
    /// Die Zeile bleibt, damit die Zahlen des Jahrgangs stimmen: „waren es nun
    /// vierzig oder einundvierzig" ist genau die Frage, die eine Kandidatenliste
    /// beantworten soll. Was drinstand, ist weg — auch die Notizen.
    /// </summary>
    private static async Task WithdrawCandidateAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfCandidateAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var update = new SqlCommand("""
            UPDATE dbo.rc_candidate
               SET status = 'withdrawn', withdrawn_at = @now, updated_at = @now,
                   born_sealed = NULL, contact_sealed = NULL,
                   school_sealed = NULL, baptism_sealed = NULL
             WHERE id = @id AND status <> 'withdrawn';
            """, connection);

        update.Parameters.AddWithValue("@id", id);
        update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var changed = await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCandidateWithdrawnResponse(
            RcId.ToText(id), changed > 0));
    }

    // -- Treffen --------------------------------------------------------------

    public sealed record AddSlotRequest(DateTimeOffset StartsUtc, int? DurationMinutes,
        int? Capacity, string? Label, string? Stage);

    private static async Task AddSlotAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AddSlotRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var group = await LoadGroupAsync(connection, id, ctx.RequestAborted);
        if (group is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, group.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var capacity = body.Capacity ?? 1;
        var duration = body.DurationMinutes ?? 60;

        if (capacity is < 1 or > 500 || duration is < 5 or > 600)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Plaetze oder Dauer liegen ausserhalb des Moeglichen.");
            return;
        }

        var slotId = RcId.NewId();
        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_meeting_slot
                (id, group_id, starts_at, duration_min, capacity, label, stage, created_at)
            VALUES (@id, @group, @starts, @dur, @cap, @label, @stage, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", slotId);
        insert.Parameters.AddWithValue("@group", id);
        insert.Parameters.AddWithValue("@starts", body.StartsUtc);
        insert.Parameters.AddWithValue("@dur", duration);
        insert.Parameters.AddWithValue("@cap", capacity);
        insert.Parameters.Add("@label", System.Data.SqlDbType.NVarChar, 120).Value =
            (object?)Trim(body.Label, 120) ?? DBNull.Value;
        insert.Parameters.AddWithValue("@stage", Trim(body.Stage, 32) ?? "year1");
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcMeetingSlotCreatedResponse(
            RcId.ToText(slotId), body.StartsUtc, capacity), StatusCodes.Status201Created);
    }

    public sealed record SlotView(string SlotId, DateTimeOffset StartsUtc, int DurationMinutes,
        int Capacity, int Booked, string? Label, string Stage, bool IsOpen);

    private static async Task SlotsAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var group = await LoadGroupAsync(connection, id, ctx.RequestAborted);
        if (group is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, group.AreaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        // Die Zaehlung laeuft in der Datenbank. Sie ist der Grund, warum die
        // Zeiten und Plaetze im Klartext liegen — sonst muesste jeder Blick auf
        // den Belegungsstand jeden Datensatz entschluesseln.
        await using var cmd = new SqlCommand("""
            SELECT s.id, s.starts_at, s.duration_min, s.capacity,
                   (SELECT COUNT(*) FROM dbo.rc_meeting_booking b WHERE b.slot_id = s.id),
                   s.label, s.stage, s.is_open
            FROM dbo.rc_meeting_slot s WHERE s.group_id = @group ORDER BY s.starts_at;
            """, connection);
        cmd.Parameters.AddWithValue("@group", id);

        var views = new List<SlotView>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                views.Add(new SlotView(
                    RcId.ToText(reader.GetGuid(0)), reader.GetDateTimeOffset(1),
                    reader.GetInt32(2), reader.GetInt32(3), reader.GetInt32(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    reader.GetString(6), reader.GetBoolean(7)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcMeetingSlotsResponse(views));
    }

    public sealed record BookRequest(string CandidateId);

    /// <summary>
    /// Einen Platz belegen.
    ///
    /// <b>Die Kapazitaet wird in einer SERIALISIERBAREN Transaktion geprueft.</b>
    /// Zwei gleichzeitige Anmeldungen auf den letzten Platz sind der Normalfall
    /// — bei einem Jahrgang, dem morgens um acht die Liste freigeschaltet wird,
    /// sogar der Regelfall. Eine Pruefung ausserhalb der Transaktion ist genau
    /// dann falsch, wenn es darauf ankommt: beide sehen „ein Platz frei", beide
    /// buchen, und der Katechet steht mit einem Stuhl zu wenig da.
    /// </summary>
    private static async Task BookAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, BookRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.CandidateId, out var candidateId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das ist keine Kandidatenkennung.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId = Guid.Empty, groupId = Guid.Empty;
        await using (var head = new SqlCommand("""
            SELECT g.area_id, g.id FROM dbo.rc_meeting_slot s
            JOIN dbo.rc_confirmation_group g ON g.id = s.group_id WHERE s.id = @id;
            """, connection))
        {
            head.Parameters.AddWithValue("@id", id);
            await using var reader = await head.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            areaId = reader.GetGuid(0);
            groupId = reader.GetGuid(1);
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);

        try
        {
            // Der Kandidat muss zu DIESEM Jahrgang gehoeren. Sonst liesse sich
            // ein Kind eines anderen Jahrgangs in eine fremde Liste eintragen.
            await using (var check = new SqlCommand(
                "SELECT COUNT(*) FROM dbo.rc_candidate WHERE id = @c AND group_id = @g AND status = 'enrolled';",
                connection, tx))
            {
                check.Parameters.AddWithValue("@c", candidateId);
                check.Parameters.AddWithValue("@g", groupId);
                if (await check.ExecuteScalarAsync(ctx.RequestAborted) is not int n || n == 0)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                        RcErrorCodes.PermissionDenied, "Dieser Kandidat gehoert nicht zu diesem Jahrgang.");
                    return;
                }
            }

            // ZUERST: hat dieser Kandidat den Platz schon? Wer bereits sitzt,
            // nimmt keinen neuen — ihm zu sagen, das Treffen sei voll, waere
            // falsch und verwirrend. Der erste Anlauf hier pruefte die
            // Kapazitaet vorher und antwortete genau so.
            await using (var already = new SqlCommand(
                "SELECT COUNT(*) FROM dbo.rc_meeting_booking WHERE slot_id = @s AND candidate_id = @c;",
                connection, tx))
            {
                already.Parameters.AddWithValue("@s", id);
                already.Parameters.AddWithValue("@c", candidateId);

                if (await already.ExecuteScalarAsync(ctx.RequestAborted) is int have && have > 0)
                {
                    await tx.CommitAsync(ctx.RequestAborted);
                    await RcResults.WriteJsonAsync(ctx, new RcMeetingBookedResponse(
                        RcId.ToText(id), RcId.ToText(candidateId), have, have));
                    return;
                }
            }

            int capacity = 0, booked = 0;
            bool open = false;

            await using (var count = new SqlCommand("""
                SELECT s.capacity, s.is_open,
                       (SELECT COUNT(*) FROM dbo.rc_meeting_booking b WHERE b.slot_id = s.id)
                FROM dbo.rc_meeting_slot s WHERE s.id = @id;
                """, connection, tx))
            {
                count.Parameters.AddWithValue("@id", id);
                await using var reader = await count.ExecuteReaderAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted))
                {
                    capacity = reader.GetInt32(0);
                    open = reader.GetBoolean(1);
                    booked = reader.GetInt32(2);
                }
            }

            if (!open)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.PermissionDenied, "Dieses Treffen nimmt keine Anmeldungen mehr an.");
                return;
            }

            if (booked >= capacity)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.PermissionDenied, "Dieses Treffen ist voll.");
                return;
            }

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_meeting_booking (id, slot_id, candidate_id, booked_at)
                VALUES (@id, @slot, @cand, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", RcId.NewId());
                insert.Parameters.AddWithValue("@slot", id);
                insert.Parameters.AddWithValue("@cand", candidateId);
                insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);

            await RcResults.WriteJsonAsync(ctx, new RcMeetingBookedResponse(
                RcId.ToText(id), RcId.ToText(candidateId), booked + 1, capacity),
                StatusCodes.Status201Created);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);

            // Zweimal denselben Platz zu buchen ist kein Fehler, sondern ein
            // zweiter Klick. Der eindeutige Index faengt es ab; hier wird es
            // zu einer Antwort, die niemanden erschreckt.
            await RcResults.WriteJsonAsync(ctx, new RcMeetingBookedResponse(
                RcId.ToText(id), body.CandidateId, 0, 0));
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    // -- Kleinkram ------------------------------------------------------------

    private sealed record GroupRow(Guid Id, Guid AreaId, string Lifecycle);

    private static async Task<GroupRow?> LoadGroupAsync(
        SqlConnection connection, Guid groupId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, lifecycle FROM dbo.rc_confirmation_group WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", groupId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new GroupRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2))
            : null;
    }

    private static async Task<Guid> AreaOfCandidateAsync(
        SqlConnection connection, Guid candidateId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT g.area_id FROM dbo.rc_candidate c
            JOIN dbo.rc_confirmation_group g ON g.id = c.group_id WHERE c.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", candidateId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static async Task<Guid> AreaOfParishAsync(
        SqlConnection connection, Guid parishId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM dbo.rc_parish WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", parishId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static void Seal(SqlCommand cmd, string name, byte[] key, RcAad aad, string? value)
    {
        cmd.Parameters.Add(name, System.Data.SqlDbType.VarBinary).Value = value is null
            ? DBNull.Value
            : RcCrypto.Seal(key, aad, Encoding.UTF8.GetBytes(value));
    }

    private static string? Trim(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }

    private static string? OpenOrNull(byte[] key, RcAad aad, byte[]? blob, ref string? reason)
    {
        if (blob is null) return null;
        try { return Encoding.UTF8.GetString(RcCrypto.Open(key, aad, blob)); }
        catch (RcDecryptException e) { reason ??= e.Code; return null; }
    }
}
