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

    /* -- Ein Eintrag -------------------------------------------------------- */

    /// <summary>Ein versiegeltes Feld, wie der Browser es schickt.</summary>
    public sealed record SealedField(string Field, string AreaId, int Epoch, string Sealed);

    public sealed record ItemRequest(
        string OwnerRoleId, string VisibilityAreaId, string? Kind,
        string Date, string Time, int? Minutes, bool? AllDay,
        string? TitlePublic, string? Status,
        string? Repeat, int? Every, int? Weekdays, string? Until, int? Count,
        IReadOnlyList<SealedField>? Fields,

        /*
         * DIE KENNUNG ENTSTEHT IM BROWSER — wie beim Bereich und beim Platz.
         *
         * Sie MUSS es, sobald ein Feld versiegelt wird: die AAD eines Feldes
         * nennt den Eintrag, und der Browser versiegelt, bevor der Dienst
         * antwortet. Muenzte der Dienst die Kennung, naennte jede Huelle eine
         * andere als die, unter der sie liegt — und ginge nie wieder auf.
         *
         * Genau das war der Fall, und es fiel nicht auf, weil derselbe Irrtum
         * beim Oeffnen wiederholt wurde: der Pruefstand versiegelte und oeffnete
         * mit SEINER Kennung und war sich mit sich selbst einig.
         */
        string? ItemId,

        /* 0054 — die Zone, falls der Terminarz des Bereichs dabei erst entsteht. */
        string? TimeZone = null,

        /*
         * 0058 — WAS DIESER TERMIN FÜR SICH SAGT (NULL: wie der Kalender):
         * ob man ihn reservieren kann, wie viele Plätze er hat, und wer ihn
         * reservieren darf ("" = jeder, der ihn findet).
         */
        bool? Bookable = null, int? Capacity = null, string? ReserveAreaId = null,

        /* 0058 — beim Ändern: in DIESEN Kalender (sonst bleibt er, wo er ist). */
        string? CalendarId = null,

        /*
         * 0070 — TEIL EINES TERMINS: unter welchem (NULL: wie bisher; "": keiner),
         * an welcher Stelle; und aus welcher Rozmowa / welchem Thema er entstand.
         */
        string? ParentItemId = null, int? Position = null, string? ChatId = null, string? TopicId = null);

    /// <summary>
    /// Einen Eintrag anlegen.
    ///
    /// <para>
    /// <b>Datum und Uhrzeit kommen als ORTSZEIT.</b> Wer „18:00" eintraegt,
    /// meint 18 Uhr dort, wo es stattfindet — nicht einen Augenblick auf der
    /// Weltuhr. Erst hier wird daraus, mit der Zone des Kalenders, ein Zeitpunkt.
    /// </para>
    ///
    /// <para>
    /// <b>Der Sichtbarkeitsbereich muss einer sein, in dem man schreiben darf.</b>
    /// Sonst legte man einen Eintrag unter einen fremden Schluessel und
    /// entzoege ihn damit sich selbst — oder schoebe ihn in eine Oeffentlichkeit,
    /// die einem nicht gehoert.
    /// </para>
    /// </summary>
    internal static async Task AddItemAsync(HttpContext ctx, Db db, Guid id, ItemRequest body)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        var status = (body.Status ?? "planned").Trim().ToLowerInvariant();
        var repeat = (body.Repeat ?? "none").Trim().ToLowerInvariant();

        /* 0058 — ohne Angabe: was ein Termin in DIESEM Kalender ist. */
        if (kind == "")
        {
            await using var connectionForKind = await db.OpenAsync(ctx.RequestAborted);
            await using var find = new SqlCommand("SELECT item_kind FROM app.calendar WHERE id = @id;", connectionForKind);
            find.Parameters.AddWithValue("@id", id);
            kind = await find.ExecuteScalarAsync(ctx.RequestAborted) as string ?? "appointment";
        }

        var ownRules = await ItemRulesAsync(ctx, db, body);
        if (ownRules is null) return;

        if (!ItemKinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Rodzaj: spotkanie, zadanie, msza, spowiedź, nabożeństwo albo odwiedziny.");
            return;
        }

        if (status is not ("planned" or "confirmed" or "cancelled"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Stan: planowane, potwierdzone albo odwołane.");
            return;
        }

        if (repeat is not ("none" or "daily" or "weekly" or "monthly" or "yearly"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Powtórzenie: raz, codziennie, co tydzień, co miesiąc albo co rok.");
            return;
        }

        if (!Guid.TryParse(body.OwnerRoleId, out var ownerRoleId)
            || !Guid.TryParse(body.VisibilityAreaId, out var visibilityAreaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (!DateOnly.TryParse(body.Date, out var day) || !TimeOnly.TryParse(body.Time, out var hour))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej daty albo godziny.");
            return;
        }

        var fields = body.Fields ?? [];
        var sealedFields = new List<(string Field, Guid AreaId, int Epoch, byte[] Blob)>();

        foreach (var one in fields)
        {
            var name = (one.Field ?? string.Empty).Trim().ToLowerInvariant();

            if (!SealableFields.Contains(name))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Zapieczętować można tytuł, miejsce, notatkę albo link.");
                return;
            }

            if (!Guid.TryParse(one.AreaId, out var fieldArea) || one.Epoch < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar albo epoka pola.");
                return;
            }

            byte[] blob;
            try { blob = Base64Url.Decode(one.Sealed ?? string.Empty); }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana treść.");
                return;
            }

            if (blob.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Puste pole nie jest zapieczętowane.");
                return;
            }

            sealedFields.Add((name, fieldArea, one.Epoch, blob));
        }

        if (sealedFields.Select(f => f.Field).Distinct().Count() != sealedFields.Count)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To samo pole dwa razy.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await CalendarOfAsync(connection, id, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        var (areaId, zoneId) = found.Value;

        if (!await Area.MayAsync(connection, caller, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        /*
         * JEDER genannte Bereich muss einer sein, in dem man schreiben darf —
         * der des Daseins wie der jedes Feldes. Ohne diese Runde liesse sich
         * eine Huelle unter einen fremden Bereich haengen: sie stuende dort,
         * niemand koennte sie oeffnen, und der Fremde faende sie in seiner
         * Epoche wieder, ohne je davon gehoert zu haben.
         */
        foreach (var needed in sealedFields.Select(f => f.AreaId).Append(visibilityAreaId).Distinct())
        {
            if (!await Area.MayAsync(connection, caller, needed, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden,
                    "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
                return;
            }
        }

        /* Wem er gehört: einer eigenen Rolle — bei einem Link der Linkrolle selbst. */
        var mine = caller.Roles;
        if (!mine.Any(r => r.Id == ownerRoleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        // Dem Konto wird nichts gegeben (0040) — nur Personen und Rollen darunter.
        if (Workspace.IsAccount(mine, ownerRoleId))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
            return;
        }

        var zone = Zones.Of(zoneId);
        var allDay = body.AllDay ?? false;
        var starts = Zones.AtLocal(day.ToDateTime(allDay ? new TimeOnly(0, 0) : hour), zone);
        /* 0054 — ein ganztägiger Termin kann mehrere Tage dauern, ein anderer bis zu zwei Wochen (eine Rüstzeit). */
        var ends = starts.AddMinutes(allDay
            ? 24 * 60 * Math.Clamp((body.Minutes ?? 1440) / 1440, 1, 60)
            : Math.Clamp(body.Minutes ?? 60, 1, 24 * 60 * 14));

        /*
         * EINE REIHE MUSS EIN ENDE HABEN — ein Datum oder eine Anzahl
         * (ck_item_repeat_end). Ohne das liesse sie sich nicht ausrechnen, nur
         * abschneiden, und jede Ansicht schnitte woanders ab.
         */
        DateTimeOffset? until = null;

        if (repeat != "none")
        {
            if (!string.IsNullOrWhiteSpace(body.Until) && DateOnly.TryParse(body.Until, out var end))
            {
                until = Zones.AtLocal(end.ToDateTime(new TimeOnly(23, 59, 59)), zone);
            }
            else if (body.Count is null or < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Seria musi mieć koniec — podaj ostatni dzień albo liczbę powtórzeń.");
                return;
            }
        }

        int? weekdays = repeat == "weekly"
            ? ((body.Weekdays ?? 0) == 0 ? Zones.BitOf(starts.DayOfWeek) : (body.Weekdays!.Value & 127))
            : null;

        /*
         * Ohne Kennung nur dann, wenn nichts versiegelt wird. Sonst entstuende
         * eine Huelle, die niemand je wieder oeffnet — und zwar lautlos.
         */
        Guid itemId;

        if (string.IsNullOrWhiteSpace(body.ItemId))
        {
            if (sealedFields.Count > 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Wpis z zapieczętowanym polem musi przyjść z własną kennung — "
                    + "inaczej etykieta wskazuje na co innego niż zapis.");
                return;
            }

            itemId = Ids.NewId();
        }
        else if (!Guid.TryParse(body.ItemId, out itemId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung wpisu.");
            return;
        }

        /* 0070 — Teil welches Termins, aus welcher Rozmowa. */
        var link = await ProgramLinkAsync(ctx, connection, caller, null, body);
        if (link is null) return;

        var now = DateTimeOffset.UtcNow;
        var titlePublic = (body.TitlePublic ?? string.Empty).Trim();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.calendar_item
                    (id, calendar_id, owner_role_id, kind, starts_at, ends_at, all_day,
                     title_public, visibility_area_id, status,
                     repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                     bookable, capacity, reserve_area_id,
                     created_at, updated_at, parent_item_id, position, chat_id, topic_id)
                VALUES (@id, @cal, @owner, @kind, @starts, @ends, @allday,
                        @public, @varea, @status,
                        @rkind, @revery, @rdays, @runtil, @rcount,
                        @bookable, @capacity, @reserve,
                        @now, @now, @parent, @position, @chat, @topic);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@bookable", (object?)ownRules.Value.Bookable ?? DBNull.Value);
                insert.Parameters.AddWithValue("@capacity", (object?)ownRules.Value.Capacity ?? DBNull.Value);
                insert.Parameters.AddWithValue("@reserve", (object?)ownRules.Value.ReserveAreaId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@id", itemId);
                insert.Parameters.AddWithValue("@cal", id);
                insert.Parameters.AddWithValue("@owner", ownerRoleId);
                insert.Parameters.AddWithValue("@kind", kind);
                insert.Parameters.AddWithValue("@starts", starts);
                insert.Parameters.AddWithValue("@ends", ends);
                insert.Parameters.AddWithValue("@allday", allDay);
                insert.Parameters.AddWithValue("@public", titlePublic == ""
                    ? DBNull.Value
                    : titlePublic[..Math.Min(titlePublic.Length, MaxTitle)]);
                insert.Parameters.AddWithValue("@varea", visibilityAreaId);
                insert.Parameters.AddWithValue("@status", status);
                insert.Parameters.AddWithValue("@rkind", repeat);
                insert.Parameters.AddWithValue("@revery", Math.Clamp(body.Every ?? 1, 1, 52));
                insert.Parameters.AddWithValue("@rdays", (object?)weekdays ?? DBNull.Value);
                insert.Parameters.AddWithValue("@runtil", (object?)until ?? DBNull.Value);
                insert.Parameters.AddWithValue("@rcount", (object?)body.Count ?? DBNull.Value);
                insert.Parameters.AddWithValue("@now", now);
                BindProgramLink(insert, link.Value);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (field, fieldArea, epoch, blob) in sealedFields)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.calendar_field (item_id, field, area_id, epoch, sealed_blob, updated_at)
                    VALUES (@item, @field, @area, @epoch, @blob, @now);
                    """, connection, tx);

                add.Parameters.AddWithValue("@item", itemId);
                add.Parameters.AddWithValue("@field", field);
                add.Parameters.AddWithValue("@area", fieldArea);
                add.Parameters.AddWithValue("@epoch", epoch);
                add.Parameters.AddWithValue("@blob", blob);
                add.Parameters.AddWithValue("@now", now);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            itemId = Ids.ToText(itemId),
            calendarId = Ids.ToText(id),
            kind,
            startsAt = starts,
            endsAt = ends,
            visibilityAreaId = Ids.ToText(visibilityAreaId),
            timeZone = zoneId,
            fields = sealedFields.Count
        });
    }

    /* -- Eine Ausnahme in der Reihe ----------------------------------------- */

    /// <param name="Restore">0079 — die Ausnahme aufheben: das Vorkommen steht wieder, wie die Reihe es sagt.</param>
    public sealed record ExceptionRequest(string OriginalStart, bool? Cancelled, string? MovedTo, bool? Restore = null);

    /// <summary>
    /// Ein einzelnes Vorkommen absagen oder verschieben.
    ///
    /// <para>
    /// Angesprochen wird es ueber seinen URSPRUENGLICHEN Beginn — sein Name in
    /// der Reihe. Er bleibt auch nach einer Verschiebung stehen; verloere er
    /// ihn, liesse sich die Verschiebung nie aufheben, und die Intentionen
    /// daran haetten keine Adresse mehr.
    /// </para>
    /// </summary>
    private static async Task ExceptionAsync(HttpContext ctx, Db db, Guid id, ExceptionRequest body)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!DateTimeOffset.TryParse(body.OriginalStart, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var original))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        DateTimeOffset? movedTo = null;

        if (!string.IsNullOrWhiteSpace(body.MovedTo))
        {
            if (!DateTimeOffset.TryParse(body.MovedTo, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var moved))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny nowy termin.");
                return;
            }
            movedTo = moved;
        }

        var cancelled = body.Cancelled ?? false;
        var restore = body.Restore ?? false;

        if (!cancelled && movedTo is null && !restore)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Wyjątek bez treści: albo odwołanie, albo przeniesienie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var area = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (area is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        if (!await Area.MayAsync(connection, caller, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        /*
         * 0079 — WIEDERHERSTELLEN. Eine abgesagte Messe liess sich bisher nicht
         * zurückholen: wer sich verklickt hatte, musste eine neue anlegen — und
         * die Intentionen hingen an der alten. Die Ausnahme fällt einfach fort.
         */
        if (restore)
        {
            await using var undo = new SqlCommand(
                "DELETE FROM app.calendar_exception WHERE item_id = @item AND original_start = @at;", connection);
            undo.Parameters.AddWithValue("@item", id);
            undo.Parameters.AddWithValue("@at", original);
            var undone = await undo.ExecuteNonQueryAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(id), originalStart = original, restored = undone > 0 });
            return;
        }

        /*
         * 0079 — EINE MESSE MIT INTENTIONEN WIRD NICHT STILL ABGESAGT. Die
         * Intentionen hingen sonst an einem Vorkommen, das der Plan nicht mehr
         * zeigt — angenommen, und nirgends gelesen. Erst verlegen (`Mass`),
         * dann absagen. Verschieben geht immer: die Adresse bleibt.
         */
        if (cancelled)
        {
            var live = await Mass.LiveCountAsync(connection, null, id, original, ctx.RequestAborted);
            if (live > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Na tę mszę są przyjęte intencje ({live}) — przenieś je na inną mszę, zanim ją odwołasz.");
                return;
            }
        }

        /*
         * Ein zweiter Aufruf zu demselben Vorkommen ersetzt den ersten. Sonst
         * braeuchte die Oberflaeche zwei Wege — anlegen und aendern — fuer eine
         * Entscheidung, die der Mensch als eine erlebt.
         */
        await using var upsert = new SqlCommand("""
            UPDATE app.calendar_exception
               SET cancelled = @cancelled, moved_to = @moved
             WHERE item_id = @item AND original_start = @at;

            IF @@ROWCOUNT = 0
                INSERT INTO app.calendar_exception
                    (item_id, original_start, cancelled, moved_to, created_at)
                VALUES (@item, @at, @cancelled, @moved, @now);
            """, connection);

        upsert.Parameters.AddWithValue("@item", id);
        upsert.Parameters.AddWithValue("@at", original);
        upsert.Parameters.AddWithValue("@cancelled", cancelled);
        upsert.Parameters.AddWithValue("@moved", (object?)movedTo ?? DBNull.Value);
        upsert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await upsert.ExecuteNonQueryAsync(ctx.RequestAborted);

        /*
         * WER AUF EINEM ABGESAGTEN TERMIN SASS, sitzt auf nichts mehr. Die
         * Ansprueche darauf werden abgelehnt — sonst stuende bei ihm weiter
         * „Twój termin: …" fuer einen Termin, den es nicht gibt, und die Grenze
         * je Person zaehlte ihn mit.
         */
        var declined = 0;

        /*
         * 0058 — WER AUF EINEM VERSCHOBENEN TERMIN SITZT, sitzt auf der neuen
         * Zeit. Der Name des Vorkommens bleibt (sein ursprünglicher Beginn);
         * die Zeit an der Reservierung folgt, damit „Twój termin" stimmt.
         */
        if (!cancelled && movedTo is not null)
        {
            await using var follow = new SqlCommand("""
                UPDATE c
                   SET starts_at = @moved, ends_at = DATEADD(second, DATEDIFF(second, c.starts_at, c.ends_at), @moved)
                  FROM app.claim c
                 WHERE c.item_id = @item AND c.occurrence_at = @at AND c.status IN (N'pending', N'confirmed');
                """, connection);
            follow.Parameters.AddWithValue("@item", id);
            follow.Parameters.AddWithValue("@at", original);
            follow.Parameters.AddWithValue("@moved", movedTo.Value);
            await follow.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        if (cancelled)
        {
            await using var drop = new SqlCommand("""
                UPDATE app.claim
                   SET status = N'declined', awaits = NULL, decided_at = @now,
                       invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
                 WHERE item_id = @item AND occurrence_at = @at
                   AND status IN (N'pending', N'confirmed');
                """, connection);

            drop.Parameters.AddWithValue("@item", id);
            drop.Parameters.AddWithValue("@at", original);
            drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            declined = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            itemId = Ids.ToText(id),
            originalStart = original,
            cancelled,
            movedTo,
            declined
        });
    }

    /* -- Lesen -------------------------------------------------------------- */

    private static async Task ItemsAsync(
        HttpContext ctx, Db db, Guid id, string? from, string? to, string? kind, string? seat, string? links)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * AUCH DER PLATZ, DER OBEN AUF DER SEITE GEWÄHLT IST, UND DIE LINKS IN
         * DIESEM BROWSER (0073). Ohne Konto las ein Link den Kalender einer
         * Seite — und wer sich anmeldete, sah dort nichts mehr, weil das Konto
         * den Bereich nicht hält. Angemeldet zu sein darf nicht WENIGER zeigen
         * als nicht angemeldet zu sein.
         */
        var linkRoles = await HeldLinks.RolesAsync(connection, links, ctx.RequestAborted);
        var seatId = await SeatOfAsync(connection, seat, ctx.RequestAborted);
        await ShowAsync(ctx, connection, id, who.Value.AccountId, from, to, kind, seatId, linkRoles);
    }

    /// <summary>
    /// Der Aushang — und, mit <c>?seat=</c>, das Gemeinsame einer Klasse.
    ///
    /// <para>
    /// Ein Schueler ohne Konto haelt den Klassenschluessel: er steckt in seinem
    /// Platz (<c>app.access_grant</c>, 0024). Was ihm fehlte, war ein Weg, die
    /// Zeilen dazu zu bekommen — dieser hier. Er gibt genau die Bereiche frei,
    /// die sein Platz aufschliesst, und keinen weiteren.
    /// </para>
    ///
    /// <para>
    /// Der Schluessel kommt dabei NICHT vor: der Dienst gibt versiegelte Felder
    /// heraus, wie immer. Das Token sagt nur, WELCHE er herausgeben darf.
    /// </para>
    /// </summary>
    private static async Task PublicAsync(
        HttpContext ctx, Db db, Guid id, string? from, string? to, string? kind, string? seat, string? links)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* 0073 — die Links mit Zugang, die der Browser hält: was ihre Rollen lesen, liest er. */
        var linkRoles = await HeldLinks.RolesAsync(connection, links, ctx.RequestAborted);

        var seatId = await SeatOfAsync(connection, seat, ctx.RequestAborted);

        await ShowAsync(ctx, connection, id, null, from, to, kind, seatId, linkRoles);
    }

    /// <summary>Der Platz zu einem Token — nur einer, der gilt und (wo verlangt) bestätigt ist.</summary>
    private static async Task<Guid?> SeatOfAsync(SqlConnection connection, string? seat, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(seat)) return null;

        await using var find = new SqlCommand("""
            SELECT id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now)
              AND (verify_hash IS NULL OR verified_at IS NOT NULL);
            """, connection);

        find.Parameters.AddWithValue("@token",
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(seat.Trim())));
        find.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        return await find.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private sealed record Row(
        Guid Id, Guid OwnerRoleId, string Kind, DateTimeOffset StartsAt, DateTimeOffset EndsAt,
        bool AllDay, string? TitlePublic, Guid VisibilityAreaId, string Status,
        string RepeatKind, int RepeatEvery, int? Weekdays, DateTimeOffset? Until, int? Count,
        Guid? ParentItemId = null, int? Position = null);

    private sealed record Shown(
        Guid ItemId, Guid OwnerRoleId, string Kind, DateTimeOffset OccurrenceAt,
        DateTimeOffset StartsAt, DateTimeOffset EndsAt, bool AllDay,
        string? TitlePublic, Guid VisibilityAreaId, string Status,
        Guid? ParentItemId = null, int? Position = null);

    private static async Task ShowAsync(
        HttpContext ctx, SqlConnection connection, Guid calendarId, Guid? accountId,
        string? from, string? to, string? kind, Guid? seatId = null, IReadOnlyList<Guid>? linkRoles = null)
    {
        var found = await CalendarOfAsync(connection, calendarId, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        if (!Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        /*
         * WELCHE BEREICHE KANN DIESER LESER OEFFNEN? Das ist die ganze
         * Sichtbarkeitspruefung — keine Spalte, die der Dienst deuten muesste,
         * sondern eine Zuteilung oder ein offengelegter Schluessel.
         */
        var readable = await ReadableAreasAsync(connection, accountId, ctx.RequestAborted, seatId, linkRoles);

        /* 0058 — der Kalender stellt sich vor: sein Name und wie seine Termine gemeint sind (für den Baustein auf einer Seite). */
        string? calendarTitle = null, calendarDescription = null, calendarKind = null;
        await using (var about = new SqlCommand("SELECT title, description, item_kind FROM app.calendar WHERE id = @id;", connection))
        {
            about.Parameters.AddWithValue("@id", calendarId);
            await using var reader = await about.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                calendarTitle = reader.GetString(0);
                calendarDescription = reader.IsDBNull(1) ? null : reader.GetString(1);
                calendarKind = reader.GetString(2);
            }
        }

        if (readable.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new
            {
                calendarId = Ids.ToText(calendarId),
                areaId = Ids.ToText(found.Value.AreaId),
                title = calendarTitle,
                description = calendarDescription,
                itemKind = calendarKind,
                timeZone = found.Value.Zone,
                fromUtc = since,
                toUtc = till,
                occurrences = Array.Empty<object>()
            });
            return;
        }

        var wanted = string.IsNullOrWhiteSpace(kind) ? null : kind.Trim().ToLowerInvariant();
        var rows = new List<Row>();

        var areaNames = string.Join(", ", readable.Select((_, i) => $"@a{i}"));
        var byKind = wanted is null ? "" : "AND kind = @kind";

        await using (var cmd = new SqlCommand($"""
            SELECT id, owner_role_id, kind, starts_at, ends_at, all_day,
                   title_public, visibility_area_id, status,
                   repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                   parent_item_id, position
            FROM app.calendar_item
            WHERE calendar_id = @cal
              AND starts_at <= @to
              AND (repeat_kind = N'none' OR repeat_until IS NULL OR repeat_until >= @from)
              AND visibility_area_id IN ({areaNames})
              {byKind};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@cal", calendarId);
            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);
            if (wanted is not null) cmd.Parameters.AddWithValue("@kind", wanted);
            for (var i = 0; i < readable.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", readable[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add(new Row(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetDateTimeOffset(3), reader.GetDateTimeOffset(4), reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.GetGuid(7), reader.GetString(8), reader.GetString(9),
                    reader.GetInt32(10),
                    reader.IsDBNull(11) ? null : reader.GetByte(11),
                    reader.IsDBNull(12) ? null : reader.GetDateTimeOffset(12),
                    reader.IsDBNull(13) ? null : reader.GetInt32(13),
                    reader.IsDBNull(14) ? null : reader.GetGuid(14),
                    reader.IsDBNull(15) ? null : reader.GetInt32(15)));
            }
        }

        var itemIds = rows.Select(r => r.Id).ToList();
        var exceptions = await ExceptionsAsync(connection, itemIds, ctx.RequestAborted);
        var fields = await FieldsAsync(connection, itemIds, ctx.RequestAborted);

        var zone = Zones.Of(found.Value.Zone);
        var shown = new List<Shown>();

        foreach (var row in rows)
        {
            var span = row.EndsAt - row.StartsAt;

            foreach (var at in Occurrences(row.StartsAt, row.RepeatKind, row.RepeatEvery,
                         row.Weekdays, row.Until, row.Count, since, till, zone))
            {
                var starts = at;

                /*
                 * Nachgeschlagen wird am URSPRUENGLICHEN Beginn — auch bei einem
                 * verschobenen Vorkommen. Sonst verloere eine verschobene Messe
                 * ihre eigene Verschiebung.
                 */
                if (exceptions.TryGetValue((row.Id, at), out var exception))
                {
                    if (exception.Cancelled) continue;
                    if (exception.MovedTo is not null) starts = exception.MovedTo.Value;
                }

                if (starts < since || starts > till) continue;

                shown.Add(new Shown(row.Id, row.OwnerRoleId, row.Kind, at,
                    starts, starts + span, row.AllDay, row.TitlePublic, row.VisibilityAreaId, row.Status,
                    row.ParentItemId, row.Position));
            }
        }

        shown.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));

        await ctx.Response.WriteAsJsonAsync(new
        {
            calendarId = Ids.ToText(calendarId),

            /* Der Bereich des Kalenders — damit die Seite weiss, ob jemand (ein Link) hier eintragen darf. */
            areaId = Ids.ToText(found.Value.AreaId),
            title = calendarTitle,
            description = calendarDescription,
            itemKind = calendarKind,
            timeZone = found.Value.Zone,
            fromUtc = since,
            toUtc = till,

            occurrences = shown.Select(o => new
            {
                itemId = Ids.ToText(o.ItemId),
                ownerRoleId = Ids.ToText(o.OwnerRoleId),
                kind = o.Kind,

                // Der Name des Vorkommens in der Reihe — die Adresse, unter der
                // Intentionen und Ausnahmen daran haengen.
                occurrenceAt = o.OccurrenceAt,

                startsAt = o.StartsAt,
                endsAt = o.EndsAt,
                allDay = o.AllDay,
                status = o.Status,
                titlePublic = o.TitlePublic,
                visibilityAreaId = Ids.ToText(o.VisibilityAreaId),

                /* 0070 — Teil welches Termins: der Aushang zeigt Teile unter ihrem Ganzen. */
                parentItemId = o.ParentItemId is null ? null : Ids.ToText(o.ParentItemId.Value),
                position = o.Position,

                /*
                 * Versiegelt hinaus, je Feld mit SEINEM Bereich und seiner
                 * Epoche. Was davon aufgeht, entscheidet der Schluesselbund des
                 * Lesers — hier wird nichts geoeffnet und nichts verschwiegen.
                 */
                fields = fields.TryGetValue(o.ItemId, out var list)
                    ? list.Select(f => new
                    {
                        field = f.Field,
                        areaId = Ids.ToText(f.AreaId),
                        epoch = f.Epoch,
                        @sealed = Base64Url.Encode(f.Blob)
                    })
                    : []
            })
        });
    }

    /// <summary>
    /// Die Bereiche, die dieser Leser oeffnen kann.
    ///
    /// <para>
    /// Zwei Quellen, und beide sind nachpruefbar: eine Zuteilung
    /// (<c>app.key_grant</c>, Art <c>epoch</c>) oder eine offengelegte Epoche
    /// (<c>app.area_epoch.key_public</c>, 0019).
    /// </para>
    ///
    /// <para>
    /// Ohne Konto bleibt nur die zweite — und genau das ist der Aushang.
    /// </para>
    /// </summary>
    internal static async Task<List<Guid>> ReadableAreasAsync(
        SqlConnection connection, Guid? accountId, CancellationToken ct, Guid? seatId = null, IReadOnlyList<Guid>? linkRoles = null)
    {
        var areas = new HashSet<Guid>();

        /* 0073 — was die Links mit Zugang in diesem Browser lesen (HeldLinks). */
        if (linkRoles is { Count: > 0 }) areas.UnionWith(await HeldLinks.KeyedAreasAsync(connection, linkRoles, ct));

        /*
         * Was ein PLATZ aufschliesst (0024). Der dritte Weg neben Zuteilung und
         * Offenlegung — und der einzige, der ohne Konto auskommt.
         */
        if (seatId is not null)
        {
            await using var granted = new SqlCommand(
                "SELECT area_id FROM app.access_grant WHERE access_id = @seat;", connection);

            granted.Parameters.AddWithValue("@seat", seatId.Value);

            await using var reader = await granted.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        }

        await using (var open = new SqlCommand(
            "SELECT DISTINCT area_id FROM app.area_epoch WHERE key_public IS NOT NULL;", connection))
        {
            await using var reader = await open.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        }

        if (accountId is null) return [.. areas];

        var mine = await Workspace.RolesOfAsync(connection, accountId.Value, ct);
        if (mine.Count == 0) return [.. areas];

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using (var held = new SqlCommand($"""
            SELECT DISTINCT key_ref FROM app.key_grant
            WHERE key_kind = N'epoch' AND destroyed_at IS NULL
              AND role_id IN ({names});
            """, connection))
        {
            for (var i = 0; i < mine.Count; i++) held.Parameters.AddWithValue($"@r{i}", mine[i].Id);

            await using var reader = await held.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        }

        return [.. areas];
    }

    /* -- Die Reihe ausrechnen ----------------------------------------------- */

    /// <summary>
    /// Was aus einer Reihe im Fenster wird.
    ///
    /// <para>
    /// <b>Gezaehlt wird in ORTSTAGEN, nicht in 24-Stunden-Schritten.</b> Der
    /// Abstand zweier Termine ist „eine Woche" und nicht „604800 Sekunden"; an
    /// den beiden Umstellungswochenenden sind das verschiedene Dinge. Deshalb
    /// wandert hier ein Datum, und die Uhrzeit wird jedes Mal neu an die Zone
    /// gehaengt.
    /// </para>
    ///
    /// <para>
    /// Rein und ohne Datenbank — deshalb laesst sie sich pruefen, und deshalb
    /// steht sie oeffentlich.
    /// </para>
    /// </summary>
    public static List<DateTimeOffset> Occurrences(
        DateTimeOffset first, string repeatKind, int every, int? weekdays,
        DateTimeOffset? until, int? count, DateTimeOffset from, DateTimeOffset to, TimeZoneInfo zone)
    {
        var found = new List<DateTimeOffset>();
        if (to < from) return found;

        var wall = TimeZoneInfo.ConvertTime(first, zone).DateTime;
        var time = wall.TimeOfDay;
        var step = Math.Max(1, every);

        if (repeatKind == "none")
        {
            if (first >= from && first <= to) found.Add(first);
            return found;
        }

        var last = until is null ? to : (until.Value < to ? until.Value : to);
        var mask = weekdays ?? 0;
        var made = 0;

        for (var i = 0; i < MaxOccurrences; i++)
        {
            DateTime day;

            switch (repeatKind)
            {
                case "daily": day = wall.Date.AddDays((long)i * step); break;
                case "weekly": day = wall.Date.AddDays(i); break;
                case "monthly": day = wall.Date.AddMonths(i * step); break;
                case "yearly": day = wall.Date.AddYears(i * step); break;
                default: return found;
            }

            var at = Zones.AtLocal(day + time, zone);
            if (at > last) break;

            /*
             * Woechentlich wird TAEGLICH geprueft und nach der Maske gefiltert.
             * Dasselbe Ergebnis wie ein Sprung ueber ganze Wochen, aber ohne die
             * Frage, in welcher Woche die Reihe anfaengt — und genau die
             * beantwortet der Altbestand an zwei Stellen verschieden.
             */
            if (repeatKind == "weekly")
            {
                if ((mask & Zones.BitOf(at.DayOfWeek)) == 0) continue;

                if (step > 1)
                {
                    var weeks = (int)Math.Floor((day.Date - StartOfWeek(wall.Date)).TotalDays / 7.0);
                    if (weeks % step != 0) continue;
                }
            }

            /*
             * Die Anzahl zaehlt ALLE Vorkommen der Reihe, auch die vor dem
             * Fenster. Zaehlte sie nur die sichtbaren, braechte ein Blick auf
             * den naechsten Monat neue hervor, die es nicht gibt.
             */
            made++;
            if (count is not null && made > count.Value) break;

            if (at < from) continue;
            found.Add(at);
        }

        return found;
    }

    /// <summary>Montag der Woche, in der dieses Datum liegt.</summary>
    private static DateTime StartOfWeek(DateTime day) =>
        day.AddDays(day.DayOfWeek == DayOfWeek.Sunday ? -6 : -((int)day.DayOfWeek - 1));

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
