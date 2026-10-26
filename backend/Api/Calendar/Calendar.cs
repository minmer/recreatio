using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Der Kalender — am BEREICH, nicht am Koerper.
///
/// <para>
/// 0004 sagt es: „Der Kalender weiss nicht, was eine Pfarrei ist. Er weiss, was
/// ein Bereich ist — deshalb landen Messen und Scholaproben im selben
/// Tagesblick." Daran haengt diese Datei.
/// </para>
///
/// <para>
/// <b>Sichtbarkeit ist ein SCHLUESSEL, kein Schalter.</b> Jeder Eintrag nennt
/// einen Bereich (<c>visibility_area_id</c>); wer dessen Schluessel hat — oder
/// dessen Epoche offenliegt —, sieht ihn. Wer nicht, bekommt die Zeile gar
/// nicht. Nicht ihren Inhalt unlesbar, sondern die Zeile nicht: dass dort etwas
/// steht, waere schon eine Auskunft ueber den Tag.
/// </para>
///
/// <para>
/// <b>Jedes verschluesselte Feld nennt seinen eigenen Bereich</b>
/// (<c>app.calendar_field</c>). Dieselbe Messe kann damit ihre Zeit unter einem
/// offengelegten Bereich tragen und ihre Notiz unter dem der Kanzlei.
/// </para>
///
/// <para>
/// <b>Der Dienst oeffnet nichts.</b> Huellen gehen hinaus, wie sie liegen —
/// mitsamt Bereich und Epoche. Wer sie aufbekommt, entscheidet sich am
/// Schluesselbund des Lesers.
/// </para>
///
/// <para>
/// <b>Die ZEIT bleibt im Klartext.</b> Das ist die Grenze, die dieses Modul
/// benutzbar macht: freie Zeiten finden und Wiederholungen ausrechnen geht
/// sonst nicht, ohne alles herunterzuladen. Geschuetzt wird es dadurch, dass
/// die ZEILE nicht herausgeht — nicht dadurch, dass die Zeit verschluesselt
/// waere.
/// </para>
/// </summary>
public static partial class Calendar
{
    public const int MaxTitle = 200;

    /// <summary>Ohne Deckel bestellte ein Aufruf mit `from=2020&amp;to=2100` hunderttausend Vorkommen.</summary>
    public static readonly TimeSpan MaxWindow = TimeSpan.FromDays(400);

    private const int MaxOccurrences = 2000;

    /// <summary>
    /// Die Arten eines Eintrags — wie `ck_item_kind` (0079: dazu `devotion`, das Nabożeństwo).
    /// EINE Liste: vorher stand sie an vier Stellen, und jede neue Art haette
    /// an einer davon gefehlt.
    /// </summary>
    public static readonly string[] ItemKinds = ["appointment", "task", "mass", "confession", "visit", "devotion"];

    /// <summary>
    /// DER GOTTESDIENST — was im Messplan steht: Messe, Beichte, Nabożeństwo.
    /// Nur die Messe traegt Intentionen (`Mass.AddIntentionAsync`).
    /// </summary>
    public static readonly string[] ServiceKinds = ["mass", "confession", "devotion"];

    /// <summary>Die Felder, die versiegelt liegen duerfen — wie `ck_calendar_field_name`.</summary>
    private static readonly string[] SealableFields = ["title", "location", "notes", "link", "link_label"];

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/calendar", CreateAsync);
        app.MapGet("/workspace/calendars", ListAsync);

        app.MapPost("/workspace/calendar/{id:guid}/item", AddItemAsync);
        app.MapGet("/workspace/calendar/{id:guid}/items", ItemsAsync);

        app.MapPost("/workspace/item/{id:guid}/occurrence", ExceptionAsync);

        /* 0058 — die Regeln eines Kalenders als Ganzes, und wer bei einem Termin da sein muss (Calendar.Settings.cs). */
        app.MapPost("/workspace/calendar/{id:guid}/settings", SettingsAsync);
        app.MapPost("/workspace/item/{id:guid}/people", PeopleAsync);

        /*
         * Der Aushang — ohne Konto. Sichtbar ist, was unter einem Bereich mit
         * offengelegter Epoche liegt; alles andere faellt hier nicht bloss
         * unlesbar, sondern gar nicht an.
         */
        app.MapGet("/calendar/{id:guid}/public", PublicAsync);

        /* 0070 — ein Termin mit seinen Teilen (Calendar.Program.cs); mit Konto mehr, ohne der Aushang. */
        app.MapGet("/calendar/program/{id:guid}", ProgramAsync);
        app.MapPost("/workspace/item/{id:guid}/program", MoveInProgramAsync);

        /*
         * 0132 — Schemata und Pläne eines Kalenders (versiegelt), die Werte eines
         * Vorkommens, und die Einträge an Vorkommen (Intentionen, Anmeldungen …).
         */
        app.MapGet("/workspace/calendar/{id:guid}/docs", DocsAsync);
        app.MapPost("/workspace/calendar/{id:guid}/doc", SaveDocAsync);
        app.MapPost("/workspace/calendar-doc/{id:guid}/delete", DeleteDocAsync);
        app.MapPost("/workspace/item/{id:guid}/values", DayValuesAsync);
        app.MapGet("/workspace/item/{id:guid}/records", ItemRecordsAsync);
        app.MapGet("/workspace/calendar/{id:guid}/records", CalendarRecordsAsync);
        app.MapPost("/workspace/item/{id:guid}/record", AddRecordAsync);
        app.MapPost("/workspace/record/{id:guid}", UpdateRecordAsync);
        app.MapPost("/workspace/record/{id:guid}/delete", DeleteRecordAsync);
    }

    /* -- Anlegen ------------------------------------------------------------ */

    public sealed record CreateRequest(string AreaId, string Title, string? TimeZone,

        /*
         * 0058 — `Create`: wirklich einen WEITEREN Kalender anlegen. Ohne das
         * bleibt es beim Terminarz des Bereichs (0054): wer „Otwórz terminarz"
         * drückt, meint die Termine dieser Leute, und den gibt es einmal.
         */
        bool? Create = null,
        string? Description = null, string? ItemKind = null, string? VisibilityAreaId = null,
        int? DurationMinutes = null, BookingRules? Booking = null);

    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var title = (body.Title ?? string.Empty).Trim();

        if (title.Length is 0 or > MaxTitle)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Kalendarz potrzebuje nazwy.");
            return;
        }

        if (!Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru.");
            return;
        }

        /*
         * Die Zone faellt HIER auf und nicht erst beim Ausrechnen einer
         * Wiederholung — dort waere es ein Fehler beim Lesen, und niemand
         * wuesste, woher er kommt.
         */
        var zoneId = string.IsNullOrWhiteSpace(body.TimeZone) ? Zones.Home : body.TimeZone.Trim();

        if (Zones.Find(zoneId) is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                $"Ten serwer nie zna strefy czasowej „{zoneId}”.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        /* 0058 — ein weiterer Kalender mit eigenen Regeln. */
        if (body.Create == true)
        {
            await CreateWithRulesAsync(ctx, connection, who.Value.AccountId, areaId, title, zoneId, body);
            return;
        }

        /*
         * 0054 — DER TERMINARZ DES BEREICHS. Hat der Bereich schon einen, ist es
         * dieser: wer „Otwórz terminarz" drückt, meint die Termine dieser Leute.
         * (Seit 0058 kann ein Bereich mehrere Kalender haben — dieser ist sein
         * Standard.)
         */
        await using (var had = new SqlCommand(
            "SELECT TOP 1 id, title, time_zone FROM app.calendar WHERE area_id = @area AND archived_at IS NULL ORDER BY is_default DESC, created_at;", connection))
        {
            had.Parameters.AddWithValue("@area", areaId);
            await using var reader = await had.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                await ctx.Response.WriteAsJsonAsync(new
                {
                    calendarId = Ids.ToText(reader.GetGuid(0)),
                    areaId = Ids.ToText(areaId),
                    title = reader.GetString(1),
                    timeZone = reader.GetString(2),
                    existed = true
                });
                return;
            }
        }

        var id = Ids.NewId();

        await using var insert = new SqlCommand("""
            INSERT INTO app.calendar (id, area_id, title, time_zone, created_at, is_default)
            VALUES (@id, @area, @title, @zone, @now,
                    CASE WHEN EXISTS (SELECT 1 FROM app.calendar WHERE area_id = @area AND is_default = 1) THEN 0 ELSE 1 END);
            """, connection);

        insert.Parameters.AddWithValue("@id", id);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@title", title);
        insert.Parameters.AddWithValue("@zone", zoneId);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            calendarId = Ids.ToText(id),
            areaId = Ids.ToText(areaId),
            title,
            timeZone = zoneId
        });
    }

    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var mine = caller.Roles;
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { calendars = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        /*
         * 0058 — WELCHE KALENDER: die der Bereiche, in denen ich stehe, UND die,
         * die ich über ihre Sichtbarkeit sehe (der Kalender des Pfarrers, den
         * die ganze Pfarrei sieht). Ob ich darin schreibe, steht dabei.
         */
        await using var cmd = new SqlCommand($"""
            SELECT c.id, c.area_id, c.title, c.time_zone, a.name,
                   c.description, c.item_kind, c.visibility_area_id, c.duration_minutes, c.is_default, c.archived_at,
                   CASE WHEN EXISTS (
                       SELECT 1 FROM app.certificate t
                        WHERE t.scope_kind = N'area' AND t.scope_id = c.area_id
                          AND t.revoked_at IS NULL AND t.expires_at > @now
                          AND t.capability IN (N'write', N'admin')
                          AND t.subject_role_id IN ({names})) THEN 1 ELSE 0 END AS may_write,
                   r.id, r.capacity, r.approval, r.reserve_area_id, r.bookable_default, r.per_person,
                   v.name
            FROM app.calendar c
            JOIN app.area a ON a.id = c.area_id
            LEFT JOIN app.area v ON v.id = c.visibility_area_id
            OUTER APPLY (
                SELECT TOP 1 x.id, x.capacity, x.approval, x.reserve_area_id, x.bookable_default, x.per_person
                FROM app.resource x WHERE x.calendar_id = c.id AND x.mode = N'offered'
                ORDER BY x.created_at
            ) r
            WHERE EXISTS (
                SELECT 1 FROM app.certificate t
                 WHERE t.scope_kind = N'area' AND t.scope_id IN (c.area_id, c.visibility_area_id)
                   AND t.revoked_at IS NULL AND t.expires_at > @now
                   AND t.subject_role_id IN ({names}))
            ORDER BY a.name, c.is_default DESC, c.title;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var calendars = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            var bookable = !reader.IsDBNull(12);
            calendars.Add(new
            {
                calendarId = Ids.ToText(reader.GetGuid(0)),
                areaId = Ids.ToText(reader.GetGuid(1)),
                title = reader.GetString(2),
                timeZone = reader.GetString(3),
                areaName = reader.GetString(4),

                /* 0058 — wie die Termine dieses Kalenders funktionieren. */
                description = reader.IsDBNull(5) ? null : reader.GetString(5),
                itemKind = reader.GetString(6),
                visibilityAreaId = reader.IsDBNull(7) ? null : Ids.ToText(reader.GetGuid(7)),
                visibilityAreaName = reader.IsDBNull(18) ? null : reader.GetString(18),
                durationMinutes = reader.GetInt32(8),
                isDefault = reader.GetBoolean(9),
                archived = !reader.IsDBNull(10),
                mayWrite = reader.GetInt32(11) == 1,
                booking = !bookable ? null : new
                {
                    resourceId = Ids.ToText(reader.GetGuid(12)),
                    mode = reader.GetBoolean(16) ? "all" : "marked",
                    capacity = reader.GetInt32(13),
                    approval = reader.GetString(14),
                    reserveAreaId = reader.IsDBNull(15) ? null : Ids.ToText(reader.GetGuid(15)),
                    perPerson = reader.GetInt32(17)
                }
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { calendars });
    }

/* -- Gemeinsames -------------------------------------------------------- */

    /* `internal`: die Buchungen (`Bookings`) pruefen ein Vorkommen gegen DIESELBEN
       Ausnahmen — eine zweite Fassung liefe auseinander, und dann liesse sich ein
       gestrichener Termin buchen. */
    internal static async Task<Dictionary<(Guid, DateTimeOffset), (bool Cancelled, DateTimeOffset? MovedTo)>>
        ExceptionsAsync(SqlConnection connection, List<Guid> itemIds, CancellationToken ct)
    {
        var map = new Dictionary<(Guid, DateTimeOffset), (bool, DateTimeOffset?)>();
        if (itemIds.Count == 0) return map;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));

        await using var cmd = new SqlCommand(
            $"SELECT item_id, original_start, cancelled, moved_to FROM app.calendar_exception "
            + $"WHERE item_id IN ({names});", connection);

        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            map[(reader.GetGuid(0), reader.GetDateTimeOffset(1))] =
                (reader.GetBoolean(2), reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3));
        }

        return map;
    }

    internal sealed record Held(string Field, Guid AreaId, int Epoch, byte[] Blob);

    internal static async Task<Dictionary<Guid, List<Held>>> FieldsAsync(
        SqlConnection connection, List<Guid> itemIds, CancellationToken ct)
    {
        var map = new Dictionary<Guid, List<Held>>();
        if (itemIds.Count == 0) return map;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));

        await using var cmd = new SqlCommand(
            $"SELECT item_id, field, area_id, epoch, sealed_blob FROM app.calendar_field "
            + $"WHERE item_id IN ({names}) ORDER BY item_id, field;", connection);

        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var item = reader.GetGuid(0);
            if (!map.TryGetValue(item, out var list)) map[item] = list = [];

            list.Add(new Held(reader.GetString(1), reader.GetGuid(2), reader.GetInt32(3), (byte[])reader[4]));
        }

        return map;
    }

    internal static async Task<(Guid AreaId, string Zone)?> CalendarOfAsync(
        SqlConnection connection, Guid calendarId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT area_id, time_zone FROM app.calendar WHERE id = @id;", connection);

        cmd.Parameters.AddWithValue("@id", calendarId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return (reader.GetGuid(0), reader.GetString(1));
    }

    internal static async Task<Guid?> AreaOfItemAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id
            FROM app.calendar_item i
            JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", itemId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    internal static bool Window(string? from, string? to, out DateTimeOffset since, out DateTimeOffset till)
    {
        var now = DateTimeOffset.UtcNow;

        since = now.AddDays(-1);
        till = now.AddDays(14);

        if (!string.IsNullOrWhiteSpace(from)
            && !DateTimeOffset.TryParse(from, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out since))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(to)
            && !DateTimeOffset.TryParse(to, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out till))
        {
            return false;
        }

        return till >= since && till - since <= MaxWindow;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
