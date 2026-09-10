using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Dyżury — kto spowiada, kto celebruje, kto jedzie do chorych.
///
/// <b>Jedna tabela, nie trzy.</b> „Kto obsługuje to wystąpienie" jest tym samym
/// pytaniem przy spowiedzi, przy mszy i przy objeździe. Trzy osobne mechanizmy
/// rozjechałyby się przy pierwszej poprawce.
///
/// <b>Nazwisko jest wpisywane, nie wybierane z listy ról.</b> Nazwy ról leżą
/// zapieczętowane i otwiera je klucz TEJ roli — kancelaria trzyma swoje role, nie
/// cudze. Lista „wybierz kapłana" byłaby listą identyfikatorów bez nazwisk.
/// Grafik i tak powstaje przez wpisanie nazwisk; `roleId` dopisuje się wtedy,
/// gdy ktoś naprawdę zwiąże dyżur z rolą.
///
/// <b>Stały grafik i wyjątek.</b> Wiersz bez daty obowiązuje w całej serii („w
/// soboty spowiada ks. Jan"); wiersz z datą dotyczy jednego wystąpienia i
/// ZASTĘPUJE stały. Kto wpisuje zastępstwo na 24 grudnia, chce, żeby stały
/// dyżurny tego dnia zniknął — a nie stał obok kogoś, kogo nie będzie.
/// </summary>
public static class RcDuty
{
    public static void MapRcDuty(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/calendar-items/{id:guid}/duties", ListAsync).Produces<RcDutiesResponse>();
        app.MapPost("/rc/calendar-items/{id:guid}/duties", AddAsync).Produces<RcDutyAddedResponse>();
        app.MapPost("/rc/duties/{id:guid}/remove", RemoveAsync).Produces<RcDutyRemovedResponse>();
    }

    public sealed record DutyView(
        string DutyId, DateTimeOffset? OccurrenceUtc, string Name, string? RoleId,
        int SortOrder, string? Note, bool IsPublic);

    public sealed record RcDutiesResponse(string ItemId, IReadOnlyList<DutyView> Duties);
    public sealed record RcDutyAddedResponse(string DutyId, string Name);
    public sealed record RcDutyRemovedResponse(string DutyId, bool Removed);

    public sealed record AddDutyRequest(
        string? Name, DateTimeOffset? OccurrenceUtc, string? RoleId,
        int? SortOrder, string? Note, bool? IsPublic);

    /// <summary>
    /// Grafik wpisu — stały i wyjątki razem.
    ///
    /// Oba naraz, bo tylko wtedy widać, co właściwie obowiązuje: sam stały
    /// grafik nie mówi, że na 24 grudnia jest zastępstwo, a same wyjątki nie
    /// mówią, kto bywa normalnie.
    /// </summary>
    private static async Task ListAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var cmd = new SqlCommand("""
            SELECT id, occurrence_at, name, role_id, sort_order, note, is_public
            FROM dbo.rc_calendar_duty
            WHERE item_id = @item
            ORDER BY occurrence_at, sort_order, created_at;
            """, connection);

        cmd.Parameters.AddWithValue("@item", id);

        var duties = new List<DutyView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            duties.Add(new DutyView(
                RcId.ToText(reader.GetGuid(0)),
                reader.IsDBNull(1) ? null : reader.GetDateTimeOffset(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : RcId.ToText(reader.GetGuid(3)),
                reader.GetInt32(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.GetBoolean(6)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcDutiesResponse(RcId.ToText(id), duties));
    }

    private static async Task AddAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AddDutyRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var name = (body.Name ?? string.Empty).Trim();
        if (name.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Dyżur bez nazwiska nikogo nie wyznacza.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var dutyId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_calendar_duty
                (id, item_id, occurrence_at, name, role_id, sort_order, note, is_public,
                 created_at, updated_at)
            VALUES (@id, @item, @at, @name, @role, @ord, @note, @public, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", dutyId);
        insert.Parameters.AddWithValue("@item", id);
        insert.Parameters.Add("@at", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)body.OccurrenceUtc ?? DBNull.Value;
        insert.Parameters.AddWithValue("@name", name);
        insert.Parameters.Add("@role", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.RoleId, out var role) ? role : DBNull.Value;
        insert.Parameters.AddWithValue("@ord", body.SortOrder ?? 0);

        var note = (body.Note ?? string.Empty).Trim();
        insert.Parameters.Add("@note", System.Data.SqlDbType.NVarChar, 200).Value =
            note.Length == 0 ? DBNull.Value : note;

        insert.Parameters.Add("@public", System.Data.SqlDbType.Bit).Value = body.IsPublic ?? false;
        insert.Parameters.AddWithValue("@now", now);

        /*
         * Ten sam człowiek nie stoi dwa razy w tym samym dyżurze. Regułę trzyma
         * baza; tutaj tłumaczy się jej złamanie na zdanie, które ktoś zrozumie —
         * bez tego przyszedłby 500 z naruszeniem klucza.
         */
        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Ta osoba jest już wpisana na ten dyżur.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcDutyAddedResponse(RcId.ToText(dutyId), name));
    }

    /// <summary>
    /// Skreślić z grafiku.
    ///
    /// Tu usunięcie jest właściwe: dyżur, który się nie odbył, bo kogoś
    /// wykreślono przed nim, nie jest zdarzeniem, które parafia pamięta. To co
    /// innego niż zmarły na liście chorych albo odwołana msza.
    /// </summary>
    private static async Task RemoveAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfDutyAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var cmd = new SqlCommand(
            "DELETE FROM dbo.rc_calendar_duty WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        var gone = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcDutyRemovedResponse(RcId.ToText(id), gone > 0));
    }

    // -- Dla planu publicznego ------------------------------------------------

    /// <summary>
    /// Jawne dyżury wpisu, gotowe do rozdania po wystąpieniach.
    ///
    /// <b>Tylko `is_public`.</b> Grafik wewnętrzny zostaje wewnątrz; parafia,
    /// która chce mieć „spowiedź: ks. Jan" w gablocie, zaznacza to świadomie.
    ///
    /// Zwraca stały grafik osobno od wyjątków, bo rozstrzygnięcie należy do
    /// wywołującego: wystąpienie z własnymi wierszami ZASTĘPUJE stały grafik.
    /// </summary>
    internal static async Task<(IReadOnlyList<string> Standing,
        IReadOnlyDictionary<DateTimeOffset, List<string>> ByOccurrence)>
        PublicDutiesAsync(SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT occurrence_at, name FROM dbo.rc_calendar_duty
            WHERE item_id = @item AND is_public = 1
            ORDER BY sort_order, created_at;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);

        var standing = new List<string>();
        var byOccurrence = new Dictionary<DateTimeOffset, List<string>>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var name = reader.GetString(1);

            if (reader.IsDBNull(0)) { standing.Add(name); continue; }

            var at = reader.GetDateTimeOffset(0);
            if (!byOccurrence.TryGetValue(at, out var list))
            {
                list = [];
                byOccurrence[at] = list;
            }
            list.Add(name);
        }

        return (standing, byOccurrence);
    }

    // -- Wspólne --------------------------------------------------------------

    private static async Task<Guid?> AreaOfItemAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id FROM dbo.rc_calendar_item i
            JOIN dbo.rc_calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", itemId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static async Task<Guid?> AreaOfDutyAsync(
        SqlConnection connection, Guid dutyId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id FROM dbo.rc_calendar_duty d
            JOIN dbo.rc_calendar_item i ON i.id = d.item_id
            JOIN dbo.rc_calendar c ON c.id = i.calendar_id
            WHERE d.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", dutyId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static Task NotFound(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.NotFoundOrNoAccess, "Tego wpisu nie ma.");
}
