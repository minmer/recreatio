using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Odwiedziny chorych — trasy, osoby, wizyty.
///
/// <b>Trzy pytania, trzy tabele.</b> Czyja trasa (grupa), kto na niej stoi i w
/// jakiej kolejności (osoba), co się wydarzyło danego dnia (wizyta).
///
/// <b>Nie ma tu drogi publicznej i nie będzie.</b> Przy mszach rozdział szedł
/// inaczej: intencję czyta się na głos, więc jej treść jest jawna. Tutaj nie ma
/// nic, co byłoby czytane na głos. Że ktoś jest odwiedzany w domu, znaczy, że
/// nie wychodzi — a to informacja o zdrowiu i o tym, że pod tym adresem mieszka
/// ktoś bezbronny. Każdy endpoint pyta o prawo do obszaru.
///
/// <b>Jawna zostaje kolejność i stan.</b> Bez nich nie da się ułożyć trasy ani
/// policzyć chorych, a jedno i drugie robi się bez otwierania nazwisk. To ta
/// sama granica co w kalendarzu: czas jawny, treść zamknięta.
///
/// <b>Wizyta wisi przy WYSTĄPIENIU objazdu</b> — <c>(item_id, occurrence_at)</c>,
/// ten sam adres co wyjątki kalendarza i intencje mszalne. U tej samej osoby w
/// marcu było co innego niż w kwietniu.
/// </summary>
public static class RcSick
{
    /// <summary>Objazd chorych jako wpis kalendarza.</summary>
    public const string ItemType = "sick_round";

    public static readonly string[] Kinds = ["regular", "single"];
    public static readonly string[] PersonStates = ["active", "paused", "deceased", "ended"];
    public static readonly string[] VisitStates = ["done", "missed", "moved"];

    public static void MapRcSick(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/areas/{id:guid}/sick-groups", GroupsAsync).Produces<RcSickGroupsResponse>();
        app.MapPost("/rc/areas/{id:guid}/sick-groups", AddGroupAsync).Produces<RcSickGroupCreatedResponse>();
        app.MapPost("/rc/sick-groups/{id:guid}", UpdateGroupAsync).Produces<RcSickGroupUpdatedResponse>();

        app.MapGet("/rc/sick-groups/{id:guid}/people", PeopleAsync).Produces<RcSickPeopleResponse>();
        app.MapPost("/rc/sick-groups/{id:guid}/people", AddPersonAsync).Produces<RcSickPersonCreatedResponse>();
        app.MapPost("/rc/sick-people/{id:guid}", UpdatePersonAsync).Produces<RcSickPersonUpdatedResponse>();

        app.MapPost("/rc/sick-people/{id:guid}/visits", RecordVisitAsync).Produces<RcSickVisitRecordedResponse>();
    }

    private static RcAad NameAad(Guid id) => Aad(id, RcField.SickPersonName);
    private static RcAad AddressAad(Guid id) => Aad(id, RcField.SickPersonAddress);
    private static RcAad PhoneAad(Guid id) => Aad(id, RcField.SickPersonPhone);
    private static RcAad NoteAad(Guid id) => Aad(id, RcField.SickPersonNote);

    private static RcAad Aad(Guid personId, RcField field) =>
        RcAad.Create("sick", "person", personId, field, 1);

    private static RcAad VisitNoteAad(Guid visitId) =>
        RcAad.Create("sick", "visit", visitId, RcField.SickVisitNote, 1);

    // -- Trasy ----------------------------------------------------------------

    public sealed record GroupView(
        string GroupId, string Name, string Kind, string? PriestRoleId, string? ItemId,
        bool Ended, int ActivePeople);

    public sealed record RcSickGroupsResponse(IReadOnlyList<GroupView> Groups);
    public sealed record RcSickGroupCreatedResponse(string GroupId, string Name);
    public sealed record RcSickGroupUpdatedResponse(string GroupId, bool Updated);

    public sealed record AddGroupRequest(string? Name, string? Kind, string? PriestRoleId, string? ItemId);
    public sealed record UpdateGroupRequest(
        string? Name, string? PriestRoleId, string? ItemId, bool? Ended);

    /// <summary>
    /// Trasy obszaru — ile ich jest i ilu chorych na każdej.
    ///
    /// <b>Liczba idzie bez otwierania nazwisk.</b> „Ilu chorych ma ks. Michał"
    /// to pytanie o planowanie, nie o ludzi; odpowiedź na nie nie powinna
    /// wymagać klucza. Dlatego liczy SQL, a nie przeglądarka po odszyfrowaniu.
    /// </summary>
    private static async Task GroupsAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT g.id, g.name, g.kind, g.priest_role_id, g.item_id, g.ended_at,
                   (SELECT COUNT(*) FROM dbo.rc_sick_person p
                    WHERE p.group_id = g.id AND p.status = N'active')
            FROM dbo.rc_sick_group g
            WHERE g.area_id = @area
            ORDER BY g.ended_at, g.kind, g.name;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);

        var groups = new List<GroupView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            groups.Add(new GroupView(
                RcId.ToText(reader.GetGuid(0)), reader.GetString(1), reader.GetString(2),
                reader.IsDBNull(3) ? null : RcId.ToText(reader.GetGuid(3)),
                reader.IsDBNull(4) ? null : RcId.ToText(reader.GetGuid(4)),
                !reader.IsDBNull(5), reader.GetInt32(6)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcSickGroupsResponse(groups));
    }

    private static async Task AddGroupAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AddGroupRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var name = (body.Name ?? string.Empty).Trim();
        if (name.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Trasa bez nazwy nie da się wybrać z listy.");
            return;
        }

        var kind = (body.Kind ?? "regular").Trim().ToLowerInvariant();
        if (!Kinds.Contains(kind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Trasa jest stała albo jednorazowa.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var groupId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_sick_group
                (id, area_id, name, kind, priest_role_id, item_id, created_at, updated_at)
            VALUES (@id, @area, @name, @kind, @priest, @item, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", groupId);
        insert.Parameters.AddWithValue("@area", id);
        insert.Parameters.AddWithValue("@name", name);
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.Add("@priest", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.PriestRoleId, out var priest) ? priest : DBNull.Value;
        insert.Parameters.Add("@item", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.ItemId, out var item) ? item : DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcSickGroupCreatedResponse(
            RcId.ToText(groupId), name));
    }

    private static async Task UpdateGroupAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, UpdateGroupRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfGroupAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        /*
         * COALESCE: czego nie podano, zostaje. Wywołanie, które przypisuje
         * kapłana, nie może przy okazji wyczyścić nazwy — a tak zrobiłby update
         * piszący wszystkie kolumny.
         */
        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_sick_group
            SET name           = COALESCE(@name, name),
                priest_role_id = COALESCE(@priest, priest_role_id),
                item_id        = COALESCE(@item, item_id),
                ended_at       = CASE WHEN @ended IS NULL THEN ended_at
                                      WHEN @ended = 1 THEN COALESCE(ended_at, @now)
                                      ELSE NULL END,
                updated_at     = @now
            WHERE id = @id;
            """, connection);

        var name = body.Name?.Trim();
        cmd.Parameters.Add("@name", System.Data.SqlDbType.NVarChar, 200).Value =
            string.IsNullOrEmpty(name) ? DBNull.Value : name;
        cmd.Parameters.Add("@priest", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.PriestRoleId, out var priest) ? priest : DBNull.Value;
        cmd.Parameters.Add("@item", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.ItemId, out var item) ? item : DBNull.Value;
        cmd.Parameters.Add("@ended", System.Data.SqlDbType.Bit).Value =
            (object?)body.Ended ?? DBNull.Value;
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcSickGroupUpdatedResponse(
            RcId.ToText(id), changed > 0));
    }

    // -- Osoby ----------------------------------------------------------------

    public sealed record PersonView(
        string PersonId, int Ordinal, string Status,
        string? Name, string? Address, string? Phone, string? Note, string? Unreadable,
        VisitView? Visit);

    /// <summary>Co się wydarzyło u tej osoby w pytanym objeździe.</summary>
    public sealed record VisitView(
        string VisitId, bool Communion, bool Confession, bool Anointing, string State);

    public sealed record RcSickPeopleResponse(
        string GroupId, DateTimeOffset? OccurrenceUtc, IReadOnlyList<PersonView> People);

    public sealed record RcSickPersonCreatedResponse(string PersonId, int Ordinal);
    public sealed record RcSickPersonUpdatedResponse(string PersonId, bool Updated);

    public sealed record AddPersonRequest(
        string? Name, string? Address, string? Phone, string? Note, int? Ordinal);

    public sealed record UpdatePersonRequest(
        string? Name, string? Address, string? Phone, string? Note,
        string? Status, int? Ordinal);

    /// <summary>
    /// Lista trasy — w KOLEJNOŚCI ODWIEDZIN, nie alfabetycznie.
    ///
    /// <b>Z wizytą danego objazdu, jeśli podano <c>at</c>.</b> Kapłan w drodze
    /// pyta „u kogo już byłem", a nie „kto jest na liście" — i pyta o to przy
    /// każdym nazwisku. Dwa wywołania na to samo pytanie znaczyłyby, że lista
    /// i odhaczenia mogą się rozjechać w połowie objazdu.
    /// </summary>
    private static async Task PeopleAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, string? at)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfGroupAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        DateTimeOffset? when = null;
        if (!string.IsNullOrWhiteSpace(at))
        {
            if (!DateTimeOffset.TryParse(at, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var parsed))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                    RcErrorCodes.IdMalformed, "To nie jest chwila.");
                return;
            }
            when = parsed;
        }

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(
            connection, session.AccountId, held.MasterKey, areaId.Value, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT p.id, p.ordinal, p.status, p.epoch,
                   p.name_sealed, p.address_sealed, p.phone_sealed, p.note_sealed,
                   v.id, v.communion, v.confession, v.anointing, v.state
            FROM dbo.rc_sick_person p
            LEFT JOIN dbo.rc_sick_visit v
                   ON v.person_id = p.id AND v.occurrence_at = @at
            WHERE p.group_id = @group
            ORDER BY p.ordinal, p.created_at;
            """, connection);

        cmd.Parameters.AddWithValue("@group", id);
        cmd.Parameters.Add("@at", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)when ?? DBNull.Value;

        var people = new List<PersonView>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var personId = reader.GetGuid(0);
                var epoch = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3);

                string? name = null, address = null, phone = null, note = null, unreadable = null;

                if (epoch is not null)
                {
                    if (!keys.TryGetValue(epoch.Value, out var key))
                    {
                        /*
                         * 15.9 — osoba NIE znika z listy. Że ktoś na niej stoi,
                         * jest informacją potrzebną do planowania; bez klucza
                         * zamknięte zostaje tylko to, kto to jest.
                         */
                        unreadable = RcErrorCodes.CryptoMissingEpoch;
                    }
                    else
                    {
                        name = Open(key, NameAad(personId), reader, 4);
                        address = Open(key, AddressAad(personId), reader, 5);
                        phone = Open(key, PhoneAad(personId), reader, 6);
                        note = Open(key, NoteAad(personId), reader, 7);
                    }
                }

                VisitView? visit = null;
                if (!reader.IsDBNull(8))
                {
                    visit = new VisitView(
                        RcId.ToText(reader.GetGuid(8)), reader.GetBoolean(9),
                        reader.GetBoolean(10), reader.GetBoolean(11), reader.GetString(12));
                }

                people.Add(new PersonView(
                    RcId.ToText(personId), reader.GetInt32(1), reader.GetString(2),
                    name, address, phone, note, unreadable, visit));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcSickPeopleResponse(
            RcId.ToText(id), when, people));
    }

    private static string? Open(byte[] key, RcAad aad, SqlDataReader reader, int column)
    {
        if (reader.IsDBNull(column)) return null;
        try { return Encoding.UTF8.GetString(RcCrypto.Open(key, aad, (byte[])reader[column])); }
        catch (RcDecryptException) { return null; }
    }

    private static async Task AddPersonAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddPersonRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var name = (body.Name ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Bez nazwiska nie wiadomo, do kogo się jedzie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfGroupAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(
            connection, session.AccountId, held.MasterKey, areaId.Value, ctx.RequestAborted);

        if (keys.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingEpoch,
                "Bez klucza obszaru nie da się zapisać nazwiska tak, żeby dało się je otworzyć.");
            return;
        }

        var personId = RcId.NewId();
        var epoch = keys.Keys.Max();
        var key = keys[epoch];
        var now = DateTimeOffset.UtcNow;

        var ordinal = body.Ordinal ?? await NextOrdinalAsync(connection, id, ctx.RequestAborted);

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_sick_person
                (id, group_id, ordinal, epoch,
                 name_sealed, address_sealed, phone_sealed, note_sealed,
                 status, created_at, updated_at)
            VALUES (@id, @group, @ord, @epoch,
                    @name, @address, @phone, @note,
                    N'active', @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", personId);
        insert.Parameters.AddWithValue("@group", id);
        insert.Parameters.AddWithValue("@ord", ordinal);
        insert.Parameters.AddWithValue("@epoch", epoch);
        Seal(insert, "@name", key, NameAad(personId), name);
        Seal(insert, "@address", key, AddressAad(personId), body.Address);
        Seal(insert, "@phone", key, PhoneAad(personId), body.Phone);
        Seal(insert, "@note", key, NoteAad(personId), body.Note);
        insert.Parameters.AddWithValue("@now", now);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcSickPersonCreatedResponse(
            RcId.ToText(personId), ordinal));
    }

    private static void Seal(SqlCommand cmd, string name, byte[] key, RcAad aad, string? text)
    {
        var value = (text ?? string.Empty).Trim();
        cmd.Parameters.Add(name, System.Data.SqlDbType.VarBinary).Value =
            value.Length == 0
                ? DBNull.Value
                : RcCrypto.Seal(key, aad, Encoding.UTF8.GetBytes(value));
    }

    /// <summary>
    /// Na koniec trasy, nie na początek.
    ///
    /// Kto dochodzi do listy, nie staje przez to pierwszy w kolejności objazdu —
    /// trasa ma swój porządek, a nowy adres wpina się w niego ręcznie.
    /// </summary>
    private static async Task<int> NextOrdinalAsync(
        SqlConnection connection, Guid groupId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT ISNULL(MAX(ordinal), -1) + 1 FROM dbo.rc_sick_person WHERE group_id = @group;",
            connection);
        cmd.Parameters.AddWithValue("@group", groupId);
        return await cmd.ExecuteScalarAsync(ct) is int next ? next : 0;
    }

    private static async Task UpdatePersonAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, UpdatePersonRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var status = body.Status?.Trim().ToLowerInvariant();
        if (status is not null && !PersonStates.Contains(status))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Takiego stanu nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfPersonAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        /*
         * Zmiana kolejności albo stanu nie wymaga klucza — i nie powinna go
         * wymagać. Kapłan porządkujący trasę nie otwiera przy tym nazwisk.
         */
        var touchesSealed = body.Name is not null || body.Address is not null
            || body.Phone is not null || body.Note is not null;

        int? epoch = null;
        byte[]? key = null;

        if (touchesSealed)
        {
            using var held = await masterKeys.OpenAsync(
                connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(
                connection, session.AccountId, held.MasterKey, areaId.Value, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.CryptoMissingEpoch, "Bez klucza obszaru nie da się tego zapisać.");
                return;
            }

            epoch = keys.Keys.Max();
            key = keys[epoch.Value];
        }

        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_sick_person
            SET status         = COALESCE(@status, status),
                ordinal        = COALESCE(@ord, ordinal),
                epoch          = COALESCE(@epoch, epoch),
                name_sealed    = COALESCE(@name, name_sealed),
                address_sealed = COALESCE(@address, address_sealed),
                phone_sealed   = COALESCE(@phone, phone_sealed),
                note_sealed    = COALESCE(@note, note_sealed),
                updated_at     = @now
            WHERE id = @id;
            """, connection);

        cmd.Parameters.Add("@status", System.Data.SqlDbType.NVarChar, 20).Value =
            (object?)status ?? DBNull.Value;
        cmd.Parameters.Add("@ord", System.Data.SqlDbType.Int).Value =
            (object?)body.Ordinal ?? DBNull.Value;
        cmd.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value =
            (object?)epoch ?? DBNull.Value;

        if (key is null)
        {
            foreach (var field in new[] { "@name", "@address", "@phone", "@note" })
                cmd.Parameters.Add(field, System.Data.SqlDbType.VarBinary).Value = DBNull.Value;
        }
        else
        {
            Seal(cmd, "@name", key, NameAad(id), body.Name);
            Seal(cmd, "@address", key, AddressAad(id), body.Address);
            Seal(cmd, "@phone", key, PhoneAad(id), body.Phone);
            Seal(cmd, "@note", key, NoteAad(id), body.Note);
        }

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcSickPersonUpdatedResponse(
            RcId.ToText(id), changed > 0));
    }

    // -- Wizyty ---------------------------------------------------------------

    public sealed record RcSickVisitRecordedResponse(string VisitId, string State);

    public sealed record RecordVisitRequest(
        string? ItemId, DateTimeOffset? OccurrenceUtc,
        bool? Communion, bool? Confession, bool? Anointing,
        string? State, string? Note);

    /// <summary>
    /// Odhaczyć wizytę — komunia, spowiedź, namaszczenie.
    ///
    /// <b>Trzy pola, nie jedno.</b> Zwykle idą razem, ale bywa spowiedź bez
    /// komunii i bywa sama komunia. Jedno pole „co dano" z trzema wartościami
    /// nie uniosłoby czwartego przypadku — a namaszczenie jest sakramentem,
    /// przy którym „mniej więcej tak było" nie wystarcza.
    ///
    /// <b>Drugie odhaczenie poprawia pierwsze, nie dopisuje drugiego.</b> Jedna
    /// wizyta u jednej osoby w jednym objeździe; trzyma to również baza
    /// (uq_rc_sick_visit_once). Bez tego dwa kliknięcia dałyby dwa wiersze, a
    /// lista pokazywałaby raz jedno, raz drugie.
    /// </summary>
    private static async Task RecordVisitAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, RecordVisitRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.ItemId, out var itemId) || body.OccurrenceUtc is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Wizyta należy do objazdu — brakuje wpisu albo chwili.");
            return;
        }

        var state = (body.State ?? "done").Trim().ToLowerInvariant();
        if (!VisitStates.Contains(state))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Takiego stanu wizyty nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfPersonAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var visitId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        int? epoch = null;
        byte[]? noteSealed = null;

        var note = (body.Note ?? string.Empty).Trim();
        if (note.Length > 0)
        {
            using var held = await masterKeys.OpenAsync(
                connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(
                connection, session.AccountId, held.MasterKey, areaId.Value, ctx.RequestAborted);

            if (keys.Count > 0)
            {
                epoch = keys.Keys.Max();
                noteSealed = RcCrypto.Seal(
                    keys[epoch.Value], VisitNoteAad(visitId), Encoding.UTF8.GetBytes(note));
            }
        }

        /*
         * MERGE, bo odhaczenie jest poprawialne: ktoś zaznaczy komunię, potem
         * przypomni sobie o spowiedzi. Drugi wiersz zamiast poprawki znaczyłby
         * dwie wizyty tego samego dnia.
         */
        await using var cmd = new SqlCommand("""
            MERGE dbo.rc_sick_visit AS target
            USING (SELECT @person AS person_id, @item AS item_id, @at AS occurrence_at) AS source
               ON target.person_id = source.person_id
              AND target.item_id = source.item_id
              AND target.occurrence_at = source.occurrence_at
            WHEN MATCHED THEN UPDATE SET
                communion = @com, confession = @conf, anointing = @anoint,
                state = @state,
                epoch = COALESCE(@epoch, target.epoch),
                note_sealed = COALESCE(@note, target.note_sealed),
                updated_at = @now
            WHEN NOT MATCHED THEN
                INSERT (id, person_id, item_id, occurrence_at,
                        communion, confession, anointing, state,
                        epoch, note_sealed, created_at, updated_at)
                VALUES (@id, @person, @item, @at,
                        @com, @conf, @anoint, @state,
                        @epoch, @note, @now, @now)
            OUTPUT inserted.id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", visitId);
        cmd.Parameters.AddWithValue("@person", id);
        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.Add("@at", System.Data.SqlDbType.DateTimeOffset).Value = body.OccurrenceUtc.Value;
        cmd.Parameters.Add("@com", System.Data.SqlDbType.Bit).Value = body.Communion ?? false;
        cmd.Parameters.Add("@conf", System.Data.SqlDbType.Bit).Value = body.Confession ?? false;
        cmd.Parameters.Add("@anoint", System.Data.SqlDbType.Bit).Value = body.Anointing ?? false;
        cmd.Parameters.AddWithValue("@state", state);
        cmd.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = (object?)epoch ?? DBNull.Value;
        cmd.Parameters.Add("@note", System.Data.SqlDbType.VarBinary).Value =
            (object?)noteSealed ?? DBNull.Value;
        cmd.Parameters.AddWithValue("@now", now);

        var written = await cmd.ExecuteScalarAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcSickVisitRecordedResponse(
            RcId.ToText(written is Guid found ? found : visitId), state));
    }

    // -- Wspólne --------------------------------------------------------------

    private static async Task<Guid?> AreaOfGroupAsync(
        SqlConnection connection, Guid groupId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT area_id FROM dbo.rc_sick_group WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", groupId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static async Task<Guid?> AreaOfPersonAsync(
        SqlConnection connection, Guid personId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT g.area_id FROM dbo.rc_sick_person p
            JOIN dbo.rc_sick_group g ON g.id = p.group_id
            WHERE p.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", personId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static Task NotFound(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.NotFoundOrNoAccess, "Tego nie ma.");
}
