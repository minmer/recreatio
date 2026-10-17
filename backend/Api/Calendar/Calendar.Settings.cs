using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// EIN KALENDER ALS GANZES (0058) — wie seine Termine funktionieren, wer sie
/// führt, wer sie sieht, wer sie reservieren darf; und wer bei einem Termin
/// da sein muss.
///
/// <code>
///   führt          der Bereich des Kalenders (area_id): wer dort schreibt, trägt ein und ändert
///   sieht          visibility_area_id — Vorgabe für jeden neuen Termin (NULL: der Bereich selbst)
///   reserviert     das Ding des Kalenders (app.resource): wer, wie viele, ob die Kanzlei bestätigt,
///                  und ob ALLE Termine Angebote sind oder nur die, die es sagen
///   Art, Dauer     was ein Termin hier ist (Treffen, Messe …) und wie lange er normalerweise dauert
///   Beschreibung   in Worten, wie die Termine gemeint sind — für die, die ihn sehen
/// </code>
///
/// <para>
/// <b>Die Vorgaben gelten für NEUE Termine</b> — ein einzelner Termin kann
/// jede für sich ändern (sichtbar für andere Leute, mehr Plätze, nur für eine
/// Gruppe). Die Reservierungsregeln wirken dagegen auf alle Termine, die nicht
/// selbst etwas anderes sagen: sie sind das Ding hinter dem Kalender.
/// </para>
/// </summary>
public static partial class Calendar
{
    /// <summary>
    /// Reservieren an einem Kalender. <c>Mode</c>: <c>none</c> (niemand),
    /// <c>all</c> (jeder Termin ist ein Angebot), <c>marked</c> (nur Termine,
    /// die es sagen). <c>ReserveAreaId</c>: nur für diese Gruppe ("" = jeder).
    /// </summary>
    public sealed record BookingRules(string? Mode, int? Capacity, string? Approval, string? ReserveAreaId, int? PerPerson);

    public sealed record SettingsRequest(
        string? Title, string? Description, string? ItemKind, string? VisibilityAreaId, int? DurationMinutes,
        BookingRules? Booking, bool? Archived);

    private static readonly string[] CalendarKinds = ["appointment", "mass", "confession", "visit", "devotion"];

    /// <summary>Die Regeln prüfen — gemeinsam für Anlegen und Ändern. <c>null</c>: der Fehler ist geschrieben.</summary>
    private static async Task<(string? Description, string? Kind, Guid? Visibility, bool VisibilityGiven, int? Duration)?> RulesAsync(
        HttpContext ctx, SqlConnection connection, Guid accountId, string? description, string? itemKind,
        string? visibilityAreaId, int? duration)
    {
        var text = description?.Trim();
        if (text is { Length: > 1000 })
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Opis kalendarza: najwyżej 1000 znaków.");
            return null;
        }

        var kind = itemKind?.Trim().ToLowerInvariant();
        if (kind is not null && !CalendarKinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj terminów: spotkanie, msza, spowiedź albo odwiedziny.");
            return null;
        }

        if (duration is not null and (< 5 or > 20160))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Czas trwania: od 5 minut do 2 tygodni.");
            return null;
        }

        Guid? visibility = null;
        var given = visibilityAreaId is not null;
        if (!string.IsNullOrWhiteSpace(visibilityAreaId))
        {
            if (!Guid.TryParse(visibilityAreaId, out var v))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna grupa, która widzi.");
                return null;
            }

            /* Wer die Termine für diese Leute sichtbar macht, versiegelt unter ihrem Schlüssel — also muss er dort schreiben. */
            if (!await Area.MayAsync(connection, accountId, v, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Widoczność: tylko dla grupy, w której możesz pisać.");
                return null;
            }

            visibility = v;
        }

        return (text == "" ? null : text, kind, visibility, given, duration);
    }

    /// <summary>Ein weiterer Kalender im Bereich — mit seinen Regeln.</summary>
    private static async Task CreateWithRulesAsync(
        HttpContext ctx, SqlConnection connection, Guid accountId, Guid areaId, string title, string zone, CreateRequest body)
    {
        var rules = await RulesAsync(ctx, connection, accountId, body.Description, body.ItemKind, body.VisibilityAreaId, body.DurationMinutes);
        if (rules is null) return;

        var id = Ids.NewId();
        await using (var insert = new SqlCommand("""
            INSERT INTO app.calendar
                (id, area_id, title, time_zone, created_at, is_default, description, item_kind, visibility_area_id, duration_minutes)
            VALUES (@id, @area, @title, @zone, @now,
                    CASE WHEN EXISTS (SELECT 1 FROM app.calendar WHERE area_id = @area AND is_default = 1) THEN 0 ELSE 1 END,
                    @description, @kind, @visibility, @duration);
            """, connection))
        {
            insert.Parameters.AddWithValue("@id", id);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@title", title);
            insert.Parameters.AddWithValue("@zone", zone);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            insert.Parameters.AddWithValue("@description", (object?)rules.Value.Description ?? DBNull.Value);
            insert.Parameters.AddWithValue("@kind", rules.Value.Kind ?? "appointment");
            insert.Parameters.AddWithValue("@visibility", (object?)rules.Value.Visibility ?? DBNull.Value);
            insert.Parameters.AddWithValue("@duration", rules.Value.Duration ?? 60);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        if (body.Booking is not null && !await ApplyBookingAsync(ctx, connection, id, areaId, title, body.Booking)) return;

        await ctx.Response.WriteAsJsonAsync(new
        {
            calendarId = Ids.ToText(id),
            areaId = Ids.ToText(areaId),
            title,
            timeZone = zone,
            created = true
        });
    }

    /// <summary>Die Regeln eines Kalenders ändern — wer im Bereich des Kalenders schreibt.</summary>
    private static async Task SettingsAsync(HttpContext ctx, Db db, Guid id, SettingsRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await CalendarOfAsync(connection, id, ctx.RequestAborted);
        if (found is null || !await Area.MayAsync(connection, who.Value.AccountId, found.Value.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma — albo nie możesz go zmieniać.");
            return;
        }

        var title = body.Title?.Trim();
        if (title is not null && title.Length is 0 or > MaxTitle)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Kalendarz potrzebuje nazwy.");
            return;
        }

        var rules = await RulesAsync(ctx, connection, who.Value.AccountId, body.Description, body.ItemKind, body.VisibilityAreaId, body.DurationMinutes);
        if (rules is null) return;

        await using (var update = new SqlCommand("""
            UPDATE app.calendar
               SET title = COALESCE(@title, title),
                   description = CASE WHEN @descGiven = 1 THEN @description ELSE description END,
                   item_kind = COALESCE(@kind, item_kind),
                   visibility_area_id = CASE WHEN @visGiven = 1 THEN @visibility ELSE visibility_area_id END,
                   duration_minutes = COALESCE(@duration, duration_minutes),
                   archived_at = CASE WHEN @archived IS NULL THEN archived_at
                                      WHEN @archived = 1 THEN COALESCE(archived_at, @now) ELSE NULL END
             WHERE id = @id;
            UPDATE app.resource SET name = COALESCE(@title, name), updated_at = @now
             WHERE calendar_id = @id AND mode = N'offered' AND @title IS NOT NULL;
            """, connection))
        {
            update.Parameters.AddWithValue("@id", id);
            update.Parameters.AddWithValue("@title", (object?)title ?? DBNull.Value);
            update.Parameters.AddWithValue("@descGiven", body.Description is not null);
            update.Parameters.AddWithValue("@description", (object?)rules.Value.Description ?? DBNull.Value);
            update.Parameters.AddWithValue("@kind", (object?)rules.Value.Kind ?? DBNull.Value);
            update.Parameters.AddWithValue("@visGiven", rules.Value.VisibilityGiven);
            update.Parameters.AddWithValue("@visibility", (object?)rules.Value.Visibility ?? DBNull.Value);
            update.Parameters.AddWithValue("@duration", (object?)rules.Value.Duration ?? DBNull.Value);
            update.Parameters.AddWithValue("@archived", body.Archived is null ? DBNull.Value : body.Archived.Value);
            update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await update.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        if (body.Booking is not null)
        {
            string name;
            await using (var named = new SqlCommand("SELECT title FROM app.calendar WHERE id = @id;", connection))
            {
                named.Parameters.AddWithValue("@id", id);
                name = (string)(await named.ExecuteScalarAsync(ctx.RequestAborted))!;
            }

            if (!await ApplyBookingAsync(ctx, connection, id, found.Value.AreaId, name, body.Booking)) return;
        }

        await ctx.Response.WriteAsJsonAsync(new { calendarId = Ids.ToText(id), saved = true });
    }

    /// <summary>
    /// RESERVIEREN AM KALENDER: das Ding dahinter anlegen oder ändern. Aus
    /// „niemand" wird kein Löschen — hängen schon Reservierungen daran, bleiben
    /// sie; es kommen nur keine neuen Angebote mehr dazu.
    /// </summary>
    private static async Task<bool> ApplyBookingAsync(
        HttpContext ctx, SqlConnection connection, Guid calendarId, Guid areaId, string title, BookingRules rules)
    {
        var mode = (rules.Mode ?? "all").Trim().ToLowerInvariant();
        if (mode is not ("none" or "all" or "marked"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rezerwacje: nikt, wszystkie terminy albo tylko oznaczone.");
            return false;
        }

        var approval = (rules.Approval ?? "none").Trim().ToLowerInvariant();
        if (approval is not ("none" or "office"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Potwierdzanie: od razu albo przez prowadzących.");
            return false;
        }

        if (rules.Capacity is not null and (< 1 or > 10000))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Miejsc na termin: od 1 do 10000.");
            return false;
        }

        if (rules.PerPerson is not null and (< 0 or > 1000))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Terminów na osobę: od 0 (bez limitu) do 1000.");
            return false;
        }

        Guid? audience = null;
        if (!string.IsNullOrWhiteSpace(rules.ReserveAreaId))
        {
            if (!Guid.TryParse(rules.ReserveAreaId, out var a))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna grupa, która może rezerwować.");
                return false;
            }
            audience = a;
        }

        Guid? resourceId;
        await using (var find = new SqlCommand(
            "SELECT TOP 1 id FROM app.resource WHERE calendar_id = @c AND mode = N'offered' ORDER BY created_at;", connection))
        {
            find.Parameters.AddWithValue("@c", calendarId);
            resourceId = await find.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
        }

        var now = DateTimeOffset.UtcNow;

        if (mode == "none")
        {
            if (resourceId is null) return true;
            await using var off = new SqlCommand("""
                UPDATE app.resource SET bookable_default = 0, updated_at = @now WHERE id = @r;
                UPDATE app.calendar_item SET bookable = NULL WHERE calendar_id = @c AND bookable = 1;
                """, connection);
            off.Parameters.AddWithValue("@r", resourceId.Value);
            off.Parameters.AddWithValue("@c", calendarId);
            off.Parameters.AddWithValue("@now", now);
            await off.ExecuteNonQueryAsync(ctx.RequestAborted);
            return true;
        }

        if (resourceId is null)
        {
            await using var add = new SqlCommand("""
                INSERT INTO app.resource
                    (id, area_id, parent_id, calendar_id, name, kind, mode, by_night, check_in_min, check_out_min,
                     capacity, buffer_before, buffer_after, approval, invite_hours, lead_days, per_person, min_persons,
                     reserve_area_id, bookable_default, created_at, updated_at)
                VALUES (@id, @area, NULL, @c, @name, N'other', N'offered', 0, 960, 600,
                        @cap, 0, 0, @appr, 0, 0, @pp, 2, @reserve, @all, @now, @now);
                """, connection);
            add.Parameters.AddWithValue("@id", Ids.NewId());
            add.Parameters.AddWithValue("@area", areaId);
            add.Parameters.AddWithValue("@c", calendarId);
            add.Parameters.AddWithValue("@name", title.Length > 200 ? title[..200] : title);
            add.Parameters.AddWithValue("@cap", rules.Capacity ?? 1);
            add.Parameters.AddWithValue("@appr", approval);
            add.Parameters.AddWithValue("@pp", rules.PerPerson ?? 0);
            add.Parameters.AddWithValue("@reserve", (object?)audience ?? DBNull.Value);
            add.Parameters.AddWithValue("@all", mode == "all");
            add.Parameters.AddWithValue("@now", now);
            await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            return true;
        }

        await using var set = new SqlCommand("""
            UPDATE app.resource
               SET capacity = COALESCE(@cap, capacity), approval = @appr, per_person = COALESCE(@pp, per_person),
                   reserve_area_id = @reserve, bookable_default = @all, updated_at = @now
             WHERE id = @r;
            """, connection);
        set.Parameters.AddWithValue("@r", resourceId.Value);
        set.Parameters.AddWithValue("@cap", (object?)rules.Capacity ?? DBNull.Value);
        set.Parameters.AddWithValue("@appr", approval);
        set.Parameters.AddWithValue("@pp", (object?)rules.PerPerson ?? DBNull.Value);
        set.Parameters.AddWithValue("@reserve", (object?)audience ?? DBNull.Value);
        set.Parameters.AddWithValue("@all", mode == "all");
        set.Parameters.AddWithValue("@now", now);
        await set.ExecuteNonQueryAsync(ctx.RequestAborted);
        return true;
    }

    /// <summary>Was ein einzelner Termin fürs Reservieren sagt — geprüft. <c>null</c>: der Fehler ist geschrieben.</summary>
    internal static async Task<(bool? Bookable, int? Capacity, Guid? ReserveAreaId)?> ItemRulesAsync(
        HttpContext ctx, Db db, ItemRequest body)
    {
        if (body.Capacity is not null and (< 1 or > 10000))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Miejsc na ten termin: od 1 do 10000.");
            return null;
        }

        Guid? audience = null;
        if (!string.IsNullOrWhiteSpace(body.ReserveAreaId))
        {
            if (!Guid.TryParse(body.ReserveAreaId, out var a))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna grupa, która może rezerwować.");
                return null;
            }

            await using var connection = await db.OpenAsync(ctx.RequestAborted);
            await using var cmd = new SqlCommand("SELECT COUNT(*) FROM app.area WHERE id = @a;", connection);
            cmd.Parameters.AddWithValue("@a", a);
            if ((int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))! == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Takiej grupy nie ma.");
                return null;
            }

            audience = a;
        }

        return (body.Bookable, body.Capacity, audience);
    }

    /* ======================================================================
       WER DA SEIN MUSS
       ====================================================================== */

    public sealed record PersonOnDuty(string RoleId, string? Duty);

    /// <summary><c>OccurrenceAt</c>: nur dieses Vorkommen (übersteuert die Reihe); fehlt es, die ganze Reihe.</summary>
    public sealed record PeopleRequest(string? OccurrenceAt, IReadOnlyList<PersonOnDuty>? People);

    /// <summary>
    /// WER BEI DIESEM TERMIN DA SEIN MUSS — der Pfarrer, der diese Messe
    /// feiert; die Katechetin, die dieses Treffen leitet. Ersetzt die Liste
    /// für die Reihe oder für ein Vorkommen. Wer den Kalender führt, trägt ein.
    /// </summary>
    private static async Task PeopleAsync(HttpContext ctx, Db db, Guid id, PeopleRequest body)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        DateTimeOffset? occurrence = null;
        if (!string.IsNullOrWhiteSpace(body.OccurrenceAt))
        {
            if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var at))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
                return;
            }
            occurrence = at;
        }

        var people = new List<(Guid Role, string Duty)>();
        foreach (var one in body.People ?? [])
        {
            if (!Guid.TryParse(one.RoleId, out var role))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna osoba.");
                return;
            }

            var duty = (one.Duty ?? "present").Trim().ToLowerInvariant();
            if (duty is not ("present" or "celebrant" or "lead"))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Rola przy terminie: obecny, celebrans albo prowadzący.");
                return;
            }

            if (people.All(p => p.Role != role)) people.Add((role, duty));
        }

        if (people.Count > 20)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Najwyżej 20 osób przy jednym terminie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var area = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, caller, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz go zmieniać.");
            return;
        }

        foreach (var (role, _) in people)
        {
            await using var exists = new SqlCommand("SELECT COUNT(*) FROM app.role WHERE id = @r AND revoked_at IS NULL;", connection);
            exists.Parameters.AddWithValue("@r", role);
            if ((int)(await exists.ExecuteScalarAsync(ctx.RequestAborted))! == 0)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej osoby nie ma.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var clear = new SqlCommand(occurrence is null
                ? "DELETE FROM app.calendar_presence WHERE item_id = @item AND occurrence_at IS NULL;"
                : "DELETE FROM app.calendar_presence WHERE item_id = @item AND occurrence_at = @at;", connection, tx))
            {
                clear.Parameters.AddWithValue("@item", id);
                if (occurrence is not null) clear.Parameters.AddWithValue("@at", occurrence.Value);
                await clear.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (role, duty) in people)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.calendar_presence (id, item_id, occurrence_at, role_id, duty, created_at)
                    VALUES (@id, @item, @at, @role, @duty, @now);
                    """, connection, tx);
                add.Parameters.AddWithValue("@id", Ids.NewId());
                add.Parameters.AddWithValue("@item", id);
                add.Parameters.AddWithValue("@at", (object?)occurrence ?? DBNull.Value);
                add.Parameters.AddWithValue("@role", role);
                add.Parameters.AddWithValue("@duty", duty);
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

        await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(id), occurrenceAt = occurrence, people = people.Count });
    }

    /// <summary>Wer bei diesen Terminen da sein muss — je Termin die Reihe (NULL) und einzelne Vorkommen.</summary>
    internal static async Task<Dictionary<Guid, List<(DateTimeOffset? At, Guid Role, string Duty)>>> PeopleOfAsync(
        SqlConnection connection, List<Guid> itemIds, CancellationToken ct)
    {
        var map = new Dictionary<Guid, List<(DateTimeOffset?, Guid, string)>>();
        if (itemIds.Count == 0) return map;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));
        await using var cmd = new SqlCommand(
            $"SELECT item_id, occurrence_at, role_id, duty FROM app.calendar_presence WHERE item_id IN ({names});", connection);
        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var item = reader.GetGuid(0);
            if (!map.TryGetValue(item, out var list)) map[item] = list = [];
            list.Add((reader.IsDBNull(1) ? null : reader.GetDateTimeOffset(1), reader.GetGuid(2), reader.GetString(3)));
        }

        return map;
    }

    /// <summary>Für EIN Vorkommen: seine eigene Liste, wenn es eine hat — sonst die der Reihe.</summary>
    internal static List<(Guid Role, string Duty)> PeopleAt(
        Dictionary<Guid, List<(DateTimeOffset? At, Guid Role, string Duty)>> map, Guid item, DateTimeOffset occurrence)
    {
        if (!map.TryGetValue(item, out var list)) return [];
        var own = list.Where(p => p.At is not null && p.At.Value == occurrence).Select(p => (p.Role, p.Duty)).ToList();
        return own.Count > 0 ? own : list.Where(p => p.At is null).Select(p => (p.Role, p.Duty)).ToList();
    }
}
