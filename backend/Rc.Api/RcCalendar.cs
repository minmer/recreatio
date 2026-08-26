using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Kalender — Termine, Aufgaben, Wiederholungen.
///
/// <b>Zeit ist nicht Inhalt.</b> WANN jemand belegt ist, liegt im Klartext;
/// WOMIT er belegt ist, liegt versiegelt. Ein Kalender, der die Zeiten
/// mitverschluesselt, kann drei Dinge nicht mehr: freie Zeiten finden, ohne
/// alles herunterzuladen; Ueberschneidungen melden, bevor jemand doppelt
/// zusagt; eine Wiederholung ausrechnen, ohne den Schluessel zu haben.
///
/// Das ist kein Verlust an Schutz, sondern eine ehrliche Grenze: dass jemand
/// Dienstag um zehn belegt ist, verraet ungleich weniger als wobei.
///
/// <b><c>title_public</c> ist kein entschluesselter Titel.</b> Es ist das, was
/// andere sehen duerfen — oft nichts (dann steht dort NULL und die Oberflaeche
/// sagt „belegt"), manchmal „Sitzung", nie „Gespraech mit Frau K. wegen der
/// Kuendigung". Beides in einem Feld zu fuehren hiesse, dass jede Anzeige
/// entscheiden muss, wie viel sie verraet — und irgendeine entscheidet falsch.
/// </summary>
public static class RcCalendar
{
    public static readonly string[] Visibilities = ["private", "area", "public"];
    public static readonly string[] Statuses = ["planned", "confirmed", "cancelled", "completed"];
    public static readonly string[] TaskStates = ["todo", "doing", "done", "cancelled"];

    public static void MapRcCalendar(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/calendars", ListAsync).Produces<RcCalendarsResponse>();
        app.MapPost("/rc/calendars", CreateAsync).Produces<RcCalendarCreatedResponse>();

        app.MapGet("/rc/calendars/{id:guid}/items", ItemsAsync).Produces<RcCalendarItemsResponse>();
        app.MapPost("/rc/calendars/{id:guid}/items", AddItemAsync).Produces<RcCalendarItemCreatedResponse>();

        app.MapPost("/rc/calendar-items/{id:guid}/occurrences/{at}/cancel", CancelOccurrenceAsync)
            .Produces<RcOccurrenceChangedResponse>();
        app.MapPost("/rc/calendar-items/{id:guid}/occurrences/{at}/move", MoveOccurrenceAsync)
            .Produces<RcOccurrenceChangedResponse>();
    }

    private static RcAad TitleAad(Guid itemId) =>
        RcAad.Create("calendar", "item", itemId, RcField.CalendarEventTitle, 1);

    private static RcAad LocationAad(Guid itemId) =>
        RcAad.Create("calendar", "item", itemId, RcField.CalendarEventLocation, 1);

    private static RcAad NotesAad(Guid itemId) =>
        RcAad.Create("calendar", "item", itemId, RcField.CalendarItemNotes, 1);

    // -- Kalender -------------------------------------------------------------

    public sealed record CreateCalendarRequest(string AreaId, string Title, string? TimeZone);

    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, CreateCalendarRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.AreaId, out var areaId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das ist keine Bereichskennung.");
            return;
        }

        var title = body.Title?.Trim() ?? "";
        if (title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Titel fehlt oder ist zu lang.");
            return;
        }

        // Eine unbekannte Zeitzone faellt HIER auf und nicht erst, wenn eine
        // Wiederholung ausgerechnet werden soll — dort waere es ein Fehler
        // beim Lesen, und niemand wuesste, woher er kommt.
        var zoneId = body.TimeZone?.Trim();
        if (!string.IsNullOrEmpty(zoneId) && !TryZone(zoneId, out _))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Zeitzone kennt der Dienst nicht.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var tenantId = await TenantOfAreaAsync(connection, areaId, ctx.RequestAborted);
        if (tenantId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var calendarId = RcId.NewId();
        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_calendar (id, area_id, tenant_id, title, time_zone, created_at)
            VALUES (@id, @area, @tenant, @title, @tz, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", calendarId);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@tenant", tenantId);
        insert.Parameters.AddWithValue("@title", title);
        insert.Parameters.AddWithValue("@tz", string.IsNullOrEmpty(zoneId) ? "Europe/Warsaw" : zoneId);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCalendarCreatedResponse(
            RcId.ToText(calendarId), title), StatusCodes.Status201Created);
    }

    public sealed record CalendarSummary(string CalendarId, string AreaId, string Title,
        string TimeZone, int Items);

    private static async Task ListAsync(HttpContext ctx, RcDb db, RcPermissions permissions)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT c.id, c.area_id, c.title, c.time_zone,
                   (SELECT COUNT(*) FROM dbo.rc_calendar_item i WHERE i.calendar_id = c.id)
            FROM dbo.rc_calendar c ORDER BY c.title;
            """, connection);

        var all = new List<CalendarSummary>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                all.Add(new CalendarSummary(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.GetString(2), reader.GetString(3), reader.GetInt32(4)));
        }

        var visible = new List<CalendarSummary>();
        foreach (var calendar in all)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                Guid.Parse(calendar.AreaId), RcCapability.Read, ctx.RequestAborted);
            if (may.Allowed) visible.Add(calendar);
        }

        await RcResults.WriteJsonAsync(ctx, new RcCalendarsResponse(visible));
    }

    // -- Eintraege ------------------------------------------------------------

    public sealed record AddItemRequest(
        string OwnerRoleId, string? ItemType,
        DateTimeOffset StartsUtc, DateTimeOffset EndsUtc, bool? AllDay,
        string? TitlePublic, string? Visibility, string? Status,
        string? Title, string? Location, string? Notes,
        string? RepeatKind, int? RepeatEvery, int? RepeatWeekdays,
        DateTimeOffset? RepeatUntil, int? RepeatCount,
        string? TaskState);

    private static async Task AddItemAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddItemRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.OwnerRoleId, out var ownerRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das ist keine Rollenkennung.");
            return;
        }

        if (body.EndsUtc < body.StartsUtc)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Ein Termin endet nicht vor seinem Anfang.");
            return;
        }

        var itemType = body.ItemType?.Trim().ToLowerInvariant() ?? "appointment";
        if (itemType is not ("appointment" or "task"))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Es gibt Termine und Aufgaben, sonst nichts.");
            return;
        }

        var visibility = body.Visibility?.Trim().ToLowerInvariant() ?? "private";
        var status = body.Status?.Trim().ToLowerInvariant() ?? "planned";
        var repeatKind = body.RepeatKind?.Trim().ToLowerInvariant() ?? RcRecurrence.None;

        if (!Visibilities.Contains(visibility) || !Statuses.Contains(status))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Sichtbarkeit oder Zustand gibt es nicht.");
            return;
        }

        // Eine Wiederholung braucht ein Ende. Ohne eines liesse sie sich nicht
        // ausrechnen, nur abschneiden — und jede Ansicht schnitte woanders ab.
        if (repeatKind != RcRecurrence.None)
        {
            var hasEnd = body.RepeatUntil is not null ^ body.RepeatCount is not null;
            if (!hasEnd)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                    RcErrorCodes.PermissionDenied,
                    "Eine Wiederholung braucht ein Ende: entweder ein Datum oder eine Anzahl.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var calendar = await LoadCalendarAsync(connection, id, ctx.RequestAborted);
        if (calendar is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, calendar.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var itemId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        // Der versiegelte Teil ist freiwillig: ein Termin, der nur „Sitzung"
        // heisst und sonst nichts verbirgt, braucht keinen Schluessel.
        var hasSealed = !string.IsNullOrWhiteSpace(body.Title)
                     || !string.IsNullOrWhiteSpace(body.Location)
                     || !string.IsNullOrWhiteSpace(body.Notes);

        byte[]? titleSealed = null, locationSealed = null, notesSealed = null;
        int? epoch = null;

        if (hasSealed)
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
                calendar.AreaId, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Kalender.");
                return;
            }

            epoch = keys.Keys.Max();
            var key = keys[epoch.Value];

            titleSealed = SealOrNull(key, TitleAad(itemId), Trim(body.Title, 500));
            locationSealed = SealOrNull(key, LocationAad(itemId), Trim(body.Location, 500));
            notesSealed = SealOrNull(key, NotesAad(itemId), Trim(body.Notes, 20_000));
        }

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_calendar_item
                (id, calendar_id, owner_role_id, item_type,
                 starts_at, ends_at, all_day, title_public, visibility, status,
                 epoch, title_sealed, location_sealed, notes_sealed,
                 repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                 task_state, created_at, updated_at)
            VALUES (@id, @cal, @owner, @type,
                    @starts, @ends, @allday, @public, @vis, @status,
                    @epoch, @titleS, @locS, @notesS,
                    @rkind, @revery, @rdays, @runtil, @rcount,
                    @task, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", itemId);
        insert.Parameters.AddWithValue("@cal", id);
        insert.Parameters.AddWithValue("@owner", ownerRoleId);
        insert.Parameters.AddWithValue("@type", itemType);
        insert.Parameters.AddWithValue("@starts", body.StartsUtc);
        insert.Parameters.AddWithValue("@ends", body.EndsUtc);
        insert.Parameters.AddWithValue("@allday", body.AllDay ?? false);
        insert.Parameters.Add("@public", System.Data.SqlDbType.NVarChar, 200).Value =
            (object?)Trim(body.TitlePublic, 200) ?? DBNull.Value;
        insert.Parameters.AddWithValue("@vis", visibility);
        insert.Parameters.AddWithValue("@status", status);

        insert.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = (object?)epoch ?? DBNull.Value;
        insert.Parameters.Add("@titleS", System.Data.SqlDbType.VarBinary).Value = (object?)titleSealed ?? DBNull.Value;
        insert.Parameters.Add("@locS", System.Data.SqlDbType.VarBinary).Value = (object?)locationSealed ?? DBNull.Value;
        insert.Parameters.Add("@notesS", System.Data.SqlDbType.VarBinary).Value = (object?)notesSealed ?? DBNull.Value;

        insert.Parameters.AddWithValue("@rkind", repeatKind);
        insert.Parameters.AddWithValue("@revery", Math.Clamp(body.RepeatEvery ?? 1, 1, 366));
        insert.Parameters.Add("@rdays", System.Data.SqlDbType.TinyInt).Value =
            repeatKind == RcRecurrence.Weekly
                ? (object)(byte)Math.Clamp(body.RepeatWeekdays ?? WeekdayOf(body.StartsUtc, calendar.Zone), 1, 127)
                : DBNull.Value;
        insert.Parameters.Add("@runtil", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)body.RepeatUntil ?? DBNull.Value;
        insert.Parameters.Add("@rcount", System.Data.SqlDbType.Int).Value =
            (object?)body.RepeatCount ?? DBNull.Value;

        insert.Parameters.Add("@task", System.Data.SqlDbType.NVarChar, 16).Value =
            itemType == "task" ? (body.TaskState?.Trim().ToLowerInvariant() ?? "todo") : DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcCalendarItemCreatedResponse(
            RcId.ToText(itemId), itemType, repeatKind), StatusCodes.Status201Created);
    }

    private static byte WeekdayOf(DateTimeOffset utc, TimeZoneInfo zone) =>
        RcRecurrence.WeekdayBit(TimeZoneInfo.ConvertTime(utc, zone).DayOfWeek);

    // -- Lesen ----------------------------------------------------------------

    /// <summary>
    /// Ein einzelnes Vorkommen, ausgerechnet.
    /// </summary>
    /// <param name="OriginalStartUtc">
    /// Der Name dieses Termins in der Reihe. Er bleibt auch nach einer
    /// Verschiebung stehen — Ausnahmen haengen daran, und ohne ihn liesse sich
    /// eine Verschiebung nie wieder aufheben.
    /// </param>
    /// <param name="TitlePublic">
    /// Was andere sehen duerfen. <c>null</c> heisst nicht „kein Titel", sondern
    /// „nur belegt" — und die Oberflaeche muss das so sagen.
    /// </param>
    public sealed record OccurrenceView(
        string ItemId, DateTimeOffset OriginalStartUtc, DateTimeOffset StartsUtc, DateTimeOffset EndsUtc,
        bool Moved, bool AllDay, string ItemType, string Visibility, string Status,
        string? TitlePublic, string? Title, string? Location, string? Notes,
        string? TaskState, bool Mine, string? Unreadable);

    private static async Task ItemsAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, DateTimeOffset? from, DateTimeOffset? to)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var calendar = await LoadCalendarAsync(connection, id, ctx.RequestAborted);
        if (calendar is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, calendar.AreaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var start = from ?? DateTimeOffset.UtcNow.AddDays(-7);
        var end = to ?? start.AddDays(60);

        // Ein zu weites Fenster ist kein Angriff, sondern ein Versehen — und es
        // erzeugt sonst still Zehntausende von Vorkommen.
        if (end - start > TimeSpan.FromDays(400))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Dieser Zeitraum ist zu weit; hoechstens ein Jahr.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            calendar.AreaId, ctx.RequestAborted);

        // Welche Rollen der Leser haelt — dieselbe Frage, die auch "unter
        // welchem Namen schreibe ich" beantwortet. Gebraucht wird hier nur die
        // Menge der Kennungen, aber es gibt keinen billigeren Weg dorthin, und
        // einen zweiten zu bauen hiesse zwei Wege, die auseinanderlaufen.
        var mine = (await RcRoleAccess.AllRoleKeysAsync(
            connection, session.AccountId, held.MasterKey, ctx.RequestAborted)).Keys.ToHashSet();

        // Nur was ueberhaupt hineinragen KANN: eine Reihe, die vor dem Fenster
        // endet, wird gar nicht erst ausgerechnet.
        await using var cmd = new SqlCommand("""
            SELECT id, owner_role_id, item_type, starts_at, ends_at, all_day,
                   title_public, visibility, status,
                   epoch, title_sealed, location_sealed, notes_sealed,
                   repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                   task_state
            FROM dbo.rc_calendar_item
            WHERE calendar_id = @cal
              AND (repeat_kind <> 'none' OR ends_at >= @from)
              AND starts_at < @to
              AND (repeat_until IS NULL OR repeat_until >= @from)
            ORDER BY starts_at;
            """, connection);

        cmd.Parameters.AddWithValue("@cal", id);
        cmd.Parameters.AddWithValue("@from", start);
        cmd.Parameters.AddWithValue("@to", end);

        var rows = new List<ItemRow>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                rows.Add(new ItemRow(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetDateTimeOffset(3), reader.GetDateTimeOffset(4), reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.GetString(7), reader.GetString(8),
                    reader.IsDBNull(9) ? null : reader.GetInt32(9),
                    reader.IsDBNull(10) ? null : (byte[])reader[10],
                    reader.IsDBNull(11) ? null : (byte[])reader[11],
                    reader.IsDBNull(12) ? null : (byte[])reader[12],
                    reader.GetString(13), reader.GetInt32(14),
                    reader.IsDBNull(15) ? null : reader.GetByte(15),
                    reader.IsDBNull(16) ? null : reader.GetDateTimeOffset(16),
                    reader.IsDBNull(17) ? null : reader.GetInt32(17),
                    reader.IsDBNull(18) ? null : reader.GetString(18)));
        }

        var views = new List<OccurrenceView>();
        foreach (var row in rows)
        {
            var isMine = mine.Contains(row.OwnerRoleId);

            // `private` heisst: nur der Eigentuemer sieht den Eintrag ueberhaupt.
            // Nicht „nur er sieht den Inhalt" — er faellt fuer alle anderen ganz
            // aus der Liste. Ihnen zu zeigen, DASS dort etwas Privates steht,
            // waere schon eine Auskunft ueber den Tag.
            if (row.Visibility == "private" && !isMine) continue;

            var exceptions = await LoadExceptionsAsync(connection, row.Id, ctx.RequestAborted);

            var rule = new RcRecurrence.Rule(row.RepeatKind, row.RepeatEvery, row.RepeatWeekdays,
                row.RepeatUntil, row.RepeatCount);

            var occurrences = RcRecurrence.Expand(row.StartsAt, row.EndsAt, rule, calendar.Zone,
                start, end, exceptions);

            string? title = null, location = null, notes = null, unreadable = null;

            if (row.Epoch is not null)
            {
                if (!keys.TryGetValue(row.Epoch.Value, out var key))
                {
                    // 15.9 — Der Termin faellt NICHT aus dem Kalender. Die Zeit
                    // ist ohnehin sichtbar; nur was dahintersteht, bleibt zu.
                    unreadable = RcErrorCodes.CryptoMissingEpoch;
                }
                else
                {
                    title = OpenOrNull(key, TitleAad(row.Id), row.TitleSealed, ref unreadable);
                    location = OpenOrNull(key, LocationAad(row.Id), row.LocationSealed, ref unreadable);
                    notes = OpenOrNull(key, NotesAad(row.Id), row.NotesSealed, ref unreadable);
                }
            }

            foreach (var occurrence in occurrences)
            {
                views.Add(new OccurrenceView(
                    RcId.ToText(row.Id), occurrence.OriginalStart, occurrence.Start, occurrence.End,
                    occurrence.Moved, row.AllDay, row.ItemType, row.Visibility, row.Status,
                    row.TitlePublic, title, location, notes, row.TaskState, isMine, unreadable));
            }
        }

        views.Sort((a, b) => a.StartsUtc.CompareTo(b.StartsUtc));

        await RcResults.WriteJsonAsync(ctx, new RcCalendarItemsResponse(
            RcId.ToText(id), calendar.TimeZone, start, end, views));
    }

    // -- Ausnahmen ------------------------------------------------------------

    public sealed record MoveRequest(DateTimeOffset NewStartUtc, DateTimeOffset NewEndUtc);

    private static Task CancelOccurrenceAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, string at) =>
        WriteExceptionAsync(ctx, db, permissions, id, at, "cancelled", null, null);

    private static Task MoveOccurrenceAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, string at, MoveRequest body) =>
        WriteExceptionAsync(ctx, db, permissions, id, at, "moved", body.NewStartUtc, body.NewEndUtc);

    /// <summary>
    /// Eine Ausnahme schreiben — und dabei die Reihe NICHT aufloesen.
    ///
    /// Der bequeme Weg waere, bei der ersten Aenderung jeden Termin einzeln
    /// hinzuschreiben. Danach waere „jeden Montag" keine Regel mehr, sondern
    /// fuenfzig Zeilen, und die Regel liesse sich nie wieder aendern.
    /// </summary>
    private static async Task WriteExceptionAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, string at,
        string kind, DateTimeOffset? newStart, DateTimeOffset? newEnd)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!DateTimeOffset.TryParse(at, null,
            System.Globalization.DateTimeStyles.RoundtripKind, out var occurrenceAt))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das ist kein Zeitpunkt.");
            return;
        }

        if (kind == "moved" && (newStart is null || newEnd is null || newEnd < newStart))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Eine Verschiebung braucht Anfang und Ende.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId = Guid.Empty;
        await using (var head = new SqlCommand("""
            SELECT c.area_id FROM dbo.rc_calendar_item i
            JOIN dbo.rc_calendar c ON c.id = i.calendar_id WHERE i.id = @id;
            """, connection))
        {
            head.Parameters.AddWithValue("@id", id);
            if (await head.ExecuteScalarAsync(ctx.RequestAborted) is Guid g) areaId = g;
        }

        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        // Dieselbe Ausnahme zweimal ist kein Fehler: sie wird ersetzt. Wer
        // einen verschobenen Termin noch einmal verschiebt, erwartet genau das.
        await using var upsert = new SqlCommand("""
            MERGE dbo.rc_calendar_exception AS target
            USING (SELECT @item AS item_id, @at AS occurrence_at) AS source
               ON target.item_id = source.item_id AND target.occurrence_at = source.occurrence_at
            WHEN MATCHED THEN UPDATE SET kind = @kind, new_starts_at = @ns, new_ends_at = @ne
            WHEN NOT MATCHED THEN
                INSERT (item_id, occurrence_at, kind, new_starts_at, new_ends_at, created_at)
                VALUES (@item, @at, @kind, @ns, @ne, @now);
            """, connection);

        upsert.Parameters.AddWithValue("@item", id);
        upsert.Parameters.AddWithValue("@at", occurrenceAt);
        upsert.Parameters.AddWithValue("@kind", kind);
        upsert.Parameters.Add("@ns", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)newStart ?? DBNull.Value;
        upsert.Parameters.Add("@ne", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)newEnd ?? DBNull.Value;
        upsert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await upsert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcOccurrenceChangedResponse(
            RcId.ToText(id), occurrenceAt, kind));
    }

    // -- Kleinkram ------------------------------------------------------------

    private sealed record ItemRow(
        Guid Id, Guid OwnerRoleId, string ItemType,
        DateTimeOffset StartsAt, DateTimeOffset EndsAt, bool AllDay,
        string? TitlePublic, string Visibility, string Status,
        int? Epoch, byte[]? TitleSealed, byte[]? LocationSealed, byte[]? NotesSealed,
        string RepeatKind, int RepeatEvery, byte? RepeatWeekdays,
        DateTimeOffset? RepeatUntil, int? RepeatCount, string? TaskState);

    private sealed record CalendarRow(Guid Id, Guid AreaId, string TimeZone, TimeZoneInfo Zone);

    private static async Task<CalendarRow?> LoadCalendarAsync(
        SqlConnection connection, Guid calendarId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, time_zone FROM dbo.rc_calendar WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", calendarId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        var zoneId = reader.GetString(2);

        // Eine Zeitzone, die es nicht mehr gibt, darf den Kalender nicht
        // unlesbar machen. UTC ist die einzige Wahl, die nie ueberrascht —
        // und sie ist sichtbar falsch, statt still falsch.
        var zone = TryZone(zoneId, out var found) ? found! : TimeZoneInfo.Utc;

        return new CalendarRow(reader.GetGuid(0), reader.GetGuid(1), zoneId, zone);
    }

    /// <summary>
    /// Zeitzonen heissen unter Windows anders als unter Linux. Der Dienst soll
    /// auf beidem laufen, also werden beide Namen versucht.
    /// </summary>
    public static bool TryZone(string id, out TimeZoneInfo? zone)
    {
        try { zone = TimeZoneInfo.FindSystemTimeZoneById(id); return true; }
        catch (TimeZoneNotFoundException) { }
        catch (InvalidTimeZoneException) { }

        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windows)
            && windows is not null)
        {
            try { zone = TimeZoneInfo.FindSystemTimeZoneById(windows); return true; }
            catch (TimeZoneNotFoundException) { }
        }

        if (TimeZoneInfo.TryConvertWindowsIdToIanaId(id, out var iana) && iana is not null)
        {
            try { zone = TimeZoneInfo.FindSystemTimeZoneById(iana); return true; }
            catch (TimeZoneNotFoundException) { }
        }

        zone = null;
        return false;
    }

    private static async Task<List<RcRecurrence.Exception>> LoadExceptionsAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT occurrence_at, kind, new_starts_at, new_ends_at
            FROM dbo.rc_calendar_exception WHERE item_id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", itemId);

        var list = new List<RcRecurrence.Exception>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(new RcRecurrence.Exception(
                reader.GetDateTimeOffset(0), reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetDateTimeOffset(2),
                reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3)));
        return list;
    }

    private static async Task<Guid> TenantOfAreaAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT tenant_id FROM dbo.rc_area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static string? Trim(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }

    private static byte[]? SealOrNull(byte[] key, RcAad aad, string? value) =>
        value is null ? null : RcCrypto.Seal(key, aad, Encoding.UTF8.GetBytes(value));

    private static string? OpenOrNull(byte[] key, RcAad aad, byte[]? blob, ref string? reason)
    {
        if (blob is null) return null;
        try { return Encoding.UTF8.GetString(RcCrypto.Open(key, aad, blob)); }
        catch (RcDecryptException e) { reason ??= e.Code; return null; }
    }
}
