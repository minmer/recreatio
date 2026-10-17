using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Einen Eintrag der Agenda lesen, ändern, löschen — und an jemand anderen übergeben.</summary>
public static partial class Agenda
{
    /* ======================================================================
       ÄNDERN UND LÖSCHEN
       ====================================================================== */

    private sealed record Parsed(
        string Kind, string Status, string Repeat, Guid Owner, Guid Visibility, DateOnly Day, TimeOnly Hour,
        List<(string Field, Guid AreaId, int Epoch, byte[] Blob)> Fields);

    /// <summary>Dieselben Regeln wie beim Anlegen — ohne sie hier ein zweites Mal anders zu fassen.</summary>
    private static Parsed? Parse(Calendar.ItemRequest body, out string error)
    {
        error = string.Empty;
        var kind = (body.Kind ?? "appointment").Trim().ToLowerInvariant();
        var status = (body.Status ?? "planned").Trim().ToLowerInvariant();
        var repeat = (body.Repeat ?? "none").Trim().ToLowerInvariant();

        /*
         * 0079 — JEDE ART wird hier geändert, auch Messe, Beichte, Nabożeństwo.
         * Vorher verwies der Kalender bei Messen auf „Msze i intencje", und dort
         * gab es kein Ändern: eine Messe liess sich anlegen und nie wieder
         * anfassen. Was an ihr hängt (die Intentionen), wandert jetzt mit
         * (`Mass.Carry.cs`).
         */
        if (!Calendar.ItemKinds.Contains(kind)) { error = "Nieznany rodzaj wpisu."; return null; }
        if (status is not ("planned" or "confirmed" or "cancelled")) { error = "Stan: planowane, potwierdzone albo odwołane."; return null; }
        if (repeat is not ("none" or "daily" or "weekly" or "monthly" or "yearly")) { error = "Nieznane powtórzenie."; return null; }

        if (!Guid.TryParse(body.OwnerRoleId, out var owner) || !Guid.TryParse(body.VisibilityAreaId, out var visibility))
        {
            error = "Nieczytelna kennung."; return null;
        }

        if (!DateOnly.TryParse(body.Date, out var day) || !TimeOnly.TryParse(body.Time, out var hour))
        {
            error = "Nie ma takiej daty albo godziny."; return null;
        }

        var fields = new List<(string, Guid, int, byte[])>();
        foreach (var one in body.Fields ?? [])
        {
            var name = (one.Field ?? string.Empty).Trim().ToLowerInvariant();
            if (!SealableFields.Contains(name)) { error = "Zapieczętować można tytuł, miejsce, notatkę albo link."; return null; }
            if (!Guid.TryParse(one.AreaId, out var area) || one.Epoch < 1) { error = "Nieczytelny obszar albo epoka pola."; return null; }

            byte[] blob;
            try { blob = Base64Url.Decode(one.Sealed ?? string.Empty); }
            catch (FormatException) { error = "Nieczytelna zapieczętowana treść."; return null; }
            if (blob.Length == 0) { error = "Puste pole nie jest zapieczętowane."; return null; }

            fields.Add((name, area, one.Epoch, blob));
        }

        if (fields.Select(f => f.Item1).Distinct().Count() != fields.Count) { error = "To samo pole dwa razy."; return null; }

        return new Parsed(kind, status, repeat, owner, visibility, day, hour, fields);
    }

    private sealed record Existing(Guid CalendarId, Guid AreaId, string Zone, string Kind,
        DateTimeOffset StartsAt, DateTimeOffset EndsAt, bool AllDay,
        string RepeatKind, int RepeatEvery, int? Weekdays, DateTimeOffset? Until, int? Count);

    /// <summary>
    /// 0058 — DIE RESERVIERUNGEN WANDERN MIT. Ändert sich die Zeit eines
    /// Termins, an dem Reservierungen hängen, rücken sie mit: das n-te
    /// Vorkommen der alten Reihe wird das n-te der neuen. Wer auf einem
    /// Vorkommen sass, das es nicht mehr gibt (die Reihe wurde kürzer), wird
    /// abgelehnt — er soll es erfahren, statt auf nichts zu sitzen. Dasselbe
    /// gilt für geschlossene Termine (`offer_state`) und für „wer da sein muss".
    /// </summary>
    private static async Task<(int Moved, int Dropped)> CarryAlongAsync(
        SqlConnection connection, SqlTransaction tx, Guid itemId, Existing was,
        DateTimeOffset starts, DateTimeOffset ends, string repeat, int every, int? weekdays,
        DateTimeOffset? until, int? count, CancellationToken ct)
    {
        var keys = new List<DateTimeOffset>();
        await using (var find = new SqlCommand("""
            SELECT DISTINCT occurrence_at FROM app.claim WHERE item_id = @id AND occurrence_at IS NOT NULL
            UNION SELECT occurrence_at FROM app.offer_state WHERE item_id = @id
            UNION SELECT occurrence_at FROM app.calendar_presence WHERE item_id = @id AND occurrence_at IS NOT NULL;
            """, connection, tx))
        {
            find.Parameters.AddWithValue("@id", itemId);
            await using var reader = await find.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) keys.Add(reader.GetDateTimeOffset(0));
        }

        if (keys.Count == 0) return (0, 0);

        var zone = Zones.Of(was.Zone);
        var last = keys.Max();
        var old = Calendar.Occurrences(was.StartsAt, was.RepeatKind, was.RepeatEvery, was.Weekdays, was.Until, was.Count,
            was.StartsAt, last, zone);
        var fresh = Calendar.Occurrences(starts, repeat, every, weekdays, until, count,
            starts, until ?? starts.AddYears(10), zone);
        var span = ends - starts;

        var moved = 0;
        var dropped = 0;

        foreach (var key in keys)
        {
            var index = old.FindIndex(o => o == key);
            DateTimeOffset? target = index >= 0 && index < fresh.Count ? fresh[index] : null;

            if (target is null)
            {
                await using var drop = new SqlCommand("""
                    UPDATE app.claim
                       SET status = N'declined', awaits = NULL, decided_at = @now,
                           invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
                     WHERE item_id = @id AND occurrence_at = @at AND status IN (N'pending', N'confirmed');
                    DELETE FROM app.offer_state WHERE item_id = @id AND occurrence_at = @at;
                    DELETE FROM app.calendar_presence WHERE item_id = @id AND occurrence_at = @at;
                    """, connection, tx);
                drop.Parameters.AddWithValue("@id", itemId);
                drop.Parameters.AddWithValue("@at", key);
                drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                dropped += await drop.ExecuteNonQueryAsync(ct) > 0 ? 1 : 0;
                continue;
            }

            if (target.Value == key && span == was.EndsAt - was.StartsAt) continue;

            await using var move = new SqlCommand("""
                UPDATE app.claim SET occurrence_at = @to, starts_at = @to, ends_at = @end
                 WHERE item_id = @id AND occurrence_at = @at;
                UPDATE app.offer_state SET occurrence_at = @to WHERE item_id = @id AND occurrence_at = @at;
                UPDATE app.calendar_presence SET occurrence_at = @to WHERE item_id = @id AND occurrence_at = @at;
                """, connection, tx);
            move.Parameters.AddWithValue("@id", itemId);
            move.Parameters.AddWithValue("@at", key);
            move.Parameters.AddWithValue("@to", target.Value);
            move.Parameters.AddWithValue("@end", target.Value + span);
            await move.ExecuteNonQueryAsync(ct);
            moved++;
        }

        return (moved, dropped);
    }

    private static async Task<Existing?> ExistingAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT i.calendar_id, c.area_id, c.time_zone, i.kind, i.starts_at, i.ends_at, i.all_day,
                   i.repeat_kind, i.repeat_every, i.repeat_weekdays, i.repeat_until, i.repeat_count
            FROM app.calendar_item i JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new Existing(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
            reader.GetDateTimeOffset(4), reader.GetDateTimeOffset(5), reader.GetBoolean(6),
            reader.GetString(7), reader.GetInt32(8),
            reader.IsDBNull(9) ? null : reader.GetByte(9),
            reader.IsDBNull(10) ? null : reader.GetDateTimeOffset(10),
            reader.IsDBNull(11) ? null : reader.GetInt32(11));
    }

    /// <summary>
    /// EINEN TERMIN ÄNDERN — die ganze Reihe. (Ein einzelnes Vorkommen
    /// verschieben oder absagen geht wie bisher über <c>/occurrence</c>.)
    ///
    /// <para>
    /// Ändert sich die ZEIT der Reihe, verlieren ihre Ausnahmen ihren Namen —
    /// sie hiessen nach Beginnen, die es nicht mehr gibt — und fallen weg. Hängt
    /// an ihr eine Buchung, bleibt die Zeit, wie sie ist: jemand hat sich diese
    /// Stunde genommen.
    /// </para>
    /// </summary>
    private static async Task UpdateAsync(HttpContext ctx, Db db, Guid id, Calendar.ItemRequest body)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var parsed = Parse(body, out var error);
        if (parsed is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var was = await ExistingAsync(connection, id, ctx.RequestAborted);
        if (was is null || !await Area.MayAsync(connection, caller, was.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz go zmieniać.");
            return;
        }

        /* Eine Messe mit Intentionen wird nichts anderes — sie stünden sonst an einer Beichte. */
        if (was.Kind == "mass" && parsed.Kind != "mass"
            && await Mass.LiveCountAsync(connection, null, id, null, ctx.RequestAborted) > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Na tę mszę są przyjęte intencje — nie może stać się innym wpisem. Przenieś je najpierw na inne msze.");
            return;
        }

        foreach (var needed in parsed.Fields.Select(f => f.AreaId).Append(parsed.Visibility).Distinct())
        {
            if (!await Area.MayAsync(connection, caller, needed, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
                return;
            }
        }

        var mine = caller.Roles;
        if (!mine.Any(r => r.Id == parsed.Owner) || Workspace.IsAccount(mine, parsed.Owner))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja osoba ani rola.");
            return;
        }

        var zone = Zones.Of(was.Zone);
        var allDay = body.AllDay ?? false;
        var starts = Zones.AtLocal(parsed.Day.ToDateTime(allDay ? new TimeOnly(0, 0) : parsed.Hour), zone);
        var ends = starts.AddMinutes(allDay ? 24 * 60 * Math.Clamp((body.Minutes ?? 1440) / 1440, 1, 60) : Math.Clamp(body.Minutes ?? 60, 1, 24 * 60 * 14));

        DateTimeOffset? until = null;
        if (parsed.Repeat != "none")
        {
            if (!string.IsNullOrWhiteSpace(body.Until) && DateOnly.TryParse(body.Until, out var end))
            {
                until = Zones.AtLocal(end.ToDateTime(new TimeOnly(23, 59, 59)), zone);
            }
            else if (body.Count is null or < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Seria musi mieć koniec — podaj ostatni dzień albo liczbę powtórzeń.");
                return;
            }
        }

        int? weekdays = parsed.Repeat == "weekly"
            ? ((body.Weekdays ?? 0) == 0 ? Zones.BitOf(starts.DayOfWeek) : (body.Weekdays!.Value & 127))
            : null;
        var every = Math.Clamp(body.Every ?? 1, 1, 52);
        var count = parsed.Repeat == "none" ? null : body.Count;

        var timing = starts != was.StartsAt || ends != was.EndsAt || allDay != was.AllDay
            || parsed.Repeat != was.RepeatKind || every != was.RepeatEvery || weekdays != was.Weekdays
            || until != was.Until || count != was.Count;

        /*
         * 0058 — DIE ZEIT DARF SICH ÄNDERN, auch wenn schon jemand reserviert
         * hat: die Reservierungen rücken mit (`CarryAlongAsync`). Bisher blieb
         * der Termin dann stehen, und wer ihn wirklich verlegen musste, konnte
         * nur absagen und neu anlegen — und alle verloren ihren Platz.
         */
        var ownRules = await Calendar.ItemRulesAsync(ctx, db, body);
        if (ownRules is null) return;

        /*
         * WELCHER KALENDER. Ausdrücklich genannt (0058): dieser, wenn man darin
         * schreibt. Sonst wie 0054: andere Leute, anderer Terminarz — wer einen
         * Termin einem anderen Bereich gibt, meint: jetzt gehört er DIESEN Leuten.
         */
        Guid calendarId;
        if (!string.IsNullOrWhiteSpace(body.CalendarId))
        {
            if (!Guid.TryParse(body.CalendarId, out var target)
                || await Calendar.CalendarOfAsync(connection, target, ctx.RequestAborted) is not { } targetCalendar
                || !await Area.MayAsync(connection, caller, targetCalendar.AreaId, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Do tego kalendarza nie możesz wpisywać.");
                return;
            }
            calendarId = target;
        }
        else
        {
            calendarId = parsed.Visibility == was.AreaId
                ? was.CalendarId
                : await EnsureCalendarAsync(connection, parsed.Visibility, was.Zone, ctx.RequestAborted);
        }

        /* 0070 — Teil welches Termins. NULL: bleibt; "": kein Teil mehr; sonst dieser. */
        var link = await Calendar.ProgramLinkAsync(ctx, connection, caller, id, body);
        if (link is null) return;

        /*
         * 0079 — DIE INTENTIONEN GEHEN MIT, nach dem Tag. Fehlt einer ihr Tag,
         * wird nichts geändert und gesagt, welche es sind.
         */
        Mass.Carried? intentions = null;
        if (timing)
        {
            intentions = await Mass.PlanCarryAsync(connection, null, id, null,
                new Mass.Series(starts, parsed.Repeat, every, weekdays, until, count, zone), sameItem: true, ctx.RequestAborted);

            if (intentions.Lost.Count > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, Mass.LostMessage(intentions.Lost, zone));
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        var titlePublic = (body.TitlePublic ?? string.Empty).Trim();
        (int Moved, int Dropped) carried = (0, 0);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var update = new SqlCommand("""
                UPDATE app.calendar_item
                   SET calendar_id = @cal, owner_role_id = @owner, kind = @kind, starts_at = @starts, ends_at = @ends, all_day = @allday,
                       title_public = @public, visibility_area_id = @varea, status = @status,
                       repeat_kind = @rkind, repeat_every = @revery, repeat_weekdays = @rdays,
                       repeat_until = @runtil, repeat_count = @rcount,
                       bookable = @bookable, capacity = @capacity, reserve_area_id = @reserve, updated_at = @now,
                       parent_item_id = CASE WHEN @keepParent = 1 THEN parent_item_id ELSE @parent END,
                       position = CASE WHEN @keepParent = 1 THEN position ELSE @position END,
                       chat_id = CASE WHEN @keepChat = 1 THEN chat_id ELSE @chat END,
                       topic_id = CASE WHEN @keepChat = 1 THEN topic_id ELSE @topic END
                 WHERE id = @id;
                DELETE FROM app.calendar_field WHERE item_id = @id;
                """, connection, tx))
            {
                update.Parameters.AddWithValue("@bookable", (object?)ownRules.Value.Bookable ?? DBNull.Value);
                update.Parameters.AddWithValue("@capacity", (object?)ownRules.Value.Capacity ?? DBNull.Value);
                update.Parameters.AddWithValue("@reserve", (object?)ownRules.Value.ReserveAreaId ?? DBNull.Value);
                update.Parameters.AddWithValue("@id", id);
                update.Parameters.AddWithValue("@cal", calendarId);
                update.Parameters.AddWithValue("@owner", parsed.Owner);
                update.Parameters.AddWithValue("@kind", parsed.Kind);
                update.Parameters.AddWithValue("@starts", starts);
                update.Parameters.AddWithValue("@ends", ends);
                update.Parameters.AddWithValue("@allday", allDay);
                update.Parameters.AddWithValue("@public", titlePublic == "" ? DBNull.Value : titlePublic[..Math.Min(titlePublic.Length, Calendar.MaxTitle)]);
                update.Parameters.AddWithValue("@varea", parsed.Visibility);
                update.Parameters.AddWithValue("@status", parsed.Status);
                update.Parameters.AddWithValue("@rkind", parsed.Repeat);
                update.Parameters.AddWithValue("@revery", every);
                update.Parameters.AddWithValue("@rdays", (object?)weekdays ?? DBNull.Value);
                update.Parameters.AddWithValue("@runtil", (object?)until ?? DBNull.Value);
                update.Parameters.AddWithValue("@rcount", (object?)count ?? DBNull.Value);
                update.Parameters.AddWithValue("@now", now);
                Calendar.BindProgramLink(update, link.Value);
                await update.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (field, area, epoch, blob) in parsed.Fields)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.calendar_field (item_id, field, area_id, epoch, sealed_blob, updated_at)
                    VALUES (@item, @field, @area, @epoch, @blob, @now);
                    """, connection, tx);
                add.Parameters.AddWithValue("@item", id);
                add.Parameters.AddWithValue("@field", field);
                add.Parameters.AddWithValue("@area", area);
                add.Parameters.AddWithValue("@epoch", epoch);
                add.Parameters.AddWithValue("@blob", blob);
                add.Parameters.AddWithValue("@now", now);
                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (timing)
            {
                carried = await CarryAlongAsync(connection, tx, id, was, starts, ends, parsed.Repeat, every, weekdays,
                    until, count, ctx.RequestAborted);

                if (intentions is not null) await Mass.ApplyCarryAsync(connection, tx, id, id, intentions, ctx.RequestAborted);

                await using var drop = new SqlCommand("DELETE FROM app.calendar_exception WHERE item_id = @id;", connection, tx);
                drop.Parameters.AddWithValue("@id", id);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
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
            itemId = Ids.ToText(id), startsAt = starts, endsAt = ends, timing,
            /* 0058 — wie viele Reservierungen mitgerückt sind, und wie viele keinen Termin mehr hatten. */
            claimsMoved = carried.Moved, claimsDropped = carried.Dropped,

            /* 0079 — wie viele Vorkommen ihre Intentionen mitgenommen haben. */
            intentionsMoved = intentions?.Count ?? 0
        });
    }

    /// <summary>
    /// EINEN TERMIN LÖSCHEN — die ganze Reihe, mit ihren Ausnahmen und Feldern.
    /// Hängt an ihm noch etwas (eine Buchung), bleibt er: dann wird er
    /// abgesagt, nicht gelöscht — wer ihn hielt, soll erfahren, dass er fort ist.
    /// </summary>
    private static async Task DeleteAsync(HttpContext ctx, Db db, Guid id)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var was = await ExistingAsync(connection, id, ctx.RequestAborted);
        if (was is null || !await Area.MayAsync(connection, caller, was.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz go usunąć.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            /*
             * 0070 — DIE TEILE GEHEN MIT: wer die Rekolekcje löscht, meint ihre
             * Konferenzen mit. Von unten nach oben, damit kein Teil auf einen
             * Termin zeigt, den es nicht mehr gibt.
             */
            await using var drop = new SqlCommand("""
                WITH tree AS (
                    SELECT id, 0 AS depth FROM app.calendar_item WHERE id = @id
                    UNION ALL
                    SELECT c.id, t.depth + 1 FROM app.calendar_item c JOIN tree t ON c.parent_item_id = t.id WHERE t.depth < 16)
                SELECT id, depth INTO #gone FROM tree;

                /*
                    0079 — ANGENOMMENE INTENTIONEN halten die Messe: wer die Reihe
                    loswerden will, beendet sie (Kończy się) — die gelesenen
                    Intentionen der vergangenen Wochen bleiben dann stehen.
                    Zurückgezogene gehen mit.
                */
                IF EXISTS (SELECT 1 FROM app.mass_intention WHERE item_id IN (SELECT id FROM #gone)
                           AND status IN (N'accepted', N'celebrated'))
                    THROW 50079, N'intentions', 1;
                DELETE FROM app.mass_intention_field
                 WHERE intention_id IN (SELECT id FROM app.mass_intention WHERE item_id IN (SELECT id FROM #gone));
                DELETE FROM app.mass_intention WHERE item_id IN (SELECT id FROM #gone);
                DELETE FROM app.calendar_field WHERE item_id IN (SELECT id FROM #gone);
                DELETE FROM app.calendar_exception WHERE item_id IN (SELECT id FROM #gone);
                DELETE FROM app.calendar_presence WHERE item_id IN (SELECT id FROM #gone);
                DECLARE @depth int = (SELECT MAX(depth) FROM #gone);
                WHILE @depth >= 0
                BEGIN
                    DELETE FROM app.calendar_item WHERE id IN (SELECT id FROM #gone WHERE depth = @depth);
                    SET @depth = @depth - 1;
                END
                DROP TABLE #gone;
                """, connection, tx);
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 50079)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Na tej mszy są przyjęte intencje — przenieś je na inne msze albo zakończ serię (Kończy się: w dniu…) zamiast ją usuwać.");
            return;
        }
        catch (SqlException e) when (e.Number == 547)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Do tego terminu są przypięte rezerwacje — odwołaj go zamiast usuwać.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(id), deleted = true });
    }

    /* ======================================================================
       „TA I NASTĘPNE" — EINE REIHE AB EINEM TAG ÜBERGEBEN (0079)
       ====================================================================== */

    public sealed record HandoverRequest(string? To, string? From);

    /// <summary>
    /// DIE REIHE ENDET VOR DIESEM TAG, und eine neue übernimmt ab ihm — mit
    /// allem, was an ihren Vorkommen hängt.
    ///
    /// <para>
    /// <b>Das ist die Änderung, die eine Pfarrei wirklich macht.</b> „Ab dem
    /// 1. November ist die Abendmesse um 17:00" — nicht „die Abendmesse war
    /// immer um 17:00". Die ganze Reihe zu ändern schriebe die vergangenen
    /// Messen um, mitsamt ihren gelesenen Intentionen. Hier bleibt die alte
    /// Reihe, wie sie war, bis zum Vortag; die neue (vom Browser angelegt, weil
    /// ihre Felder unter IHRER Kennung versiegelt sind) bekommt ab dem Tag:
    /// </para>
    ///
    /// <code>
    ///   Intentionen         nach dem Tag — fehlt einer der Tag, wird nichts geändert
    ///   Wer da sein muss    je Vorkommen nach dem Tag; die Liste der Reihe, wenn die neue keine hat
    ///   Reservierungen      nach dem Tag, im selben Kalender; sonst abgelehnt, wie beim Absagen
    /// </code>
    ///
    /// <para>
    /// Schlägt es fehl, löscht der Browser die neue Reihe wieder — sie trägt
    /// dann noch nichts.
    /// </para>
    /// </summary>
    private static async Task HandoverAsync(HttpContext ctx, Db db, Guid id, HandoverRequest body)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.To, out var to) || to == id
            || !DateTimeOffset.TryParse(body.From, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var from))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin albo dzień.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var was = await ExistingAsync(connection, id, ctx.RequestAborted);
        var next = await ExistingAsync(connection, to, ctx.RequestAborted);
        if (was is null || next is null
            || !await Area.MayAsync(connection, caller, was.AreaId, Capability.Write, ctx.RequestAborted)
            || !await Area.MayAsync(connection, caller, next.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz go zmieniać.");
            return;
        }

        if (was.RepeatKind == "none")
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest seria — zmień ten jeden termin.");
            return;
        }

        var zone = Zones.Of(was.Zone);
        var cut = TimeZoneInfo.ConvertTime(from, zone).Date;
        var since = Zones.AtLocal(cut, zone);
        var until = Zones.AtLocal(cut.AddDays(-1).Add(new TimeSpan(23, 59, 59)), zone);

        var before = Calendar.Occurrences(was.StartsAt, was.RepeatKind, was.RepeatEvery, was.Weekdays,
            was.Until, was.Count, was.StartsAt, until, zone);
        if (before.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Od tego dnia zaczyna się cała seria — zmień ją w całości.");
            return;
        }

        var series = new Mass.Series(next.StartsAt, next.RepeatKind, next.RepeatEvery, next.Weekdays,
            next.Until, next.Count, Zones.Of(next.Zone));

        var intentions = await Mass.PlanCarryAsync(connection, null, id, since, series, sameItem: false, ctx.RequestAborted);
        if (intentions.Lost.Count > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Mass.LostMessage(intentions.Lost, zone));
            return;
        }

        var span = next.EndsAt - next.StartsAt;
        var sameCalendar = was.CalendarId == next.CalendarId;
        var now = DateTimeOffset.UtcNow;
        var people = 0;
        var occurrences = 0;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            /* Die alte Reihe endet am Vortag. Eine Anzahl bleibt stehen — sie kann früher enden, nie später. */
            await using (var end = new SqlCommand("""
                UPDATE app.calendar_item SET repeat_until = @until, updated_at = @now WHERE id = @id;
                DELETE FROM app.calendar_exception WHERE item_id = @id AND original_start >= @since;
                """, connection, tx))
            {
                end.Parameters.AddWithValue("@id", id);
                end.Parameters.AddWithValue("@until", until);
                end.Parameters.AddWithValue("@since", since);
                end.Parameters.AddWithValue("@now", now);
                await end.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await Mass.ApplyCarryAsync(connection, tx, id, to, intentions, ctx.RequestAborted);

            /* Wer bei einzelnen Vorkommen da sein muss — nach dem Tag; ohne Tag fällt es fort. */
            var keys = new List<DateTimeOffset>();
            await using (var find = new SqlCommand("""
                SELECT occurrence_at FROM app.calendar_presence WHERE item_id = @id AND occurrence_at >= @since
                UNION SELECT occurrence_at FROM app.claim WHERE item_id = @id AND occurrence_at >= @since
                UNION SELECT occurrence_at FROM app.offer_state WHERE item_id = @id AND occurrence_at >= @since;
                """, connection, tx))
            {
                find.Parameters.AddWithValue("@id", id);
                find.Parameters.AddWithValue("@since", since);
                await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) keys.Add(reader.GetDateTimeOffset(0));
            }

            foreach (var (key, target) in Mass.ByDay(keys, series))
            {
                await using var carry = new SqlCommand(target is not null && sameCalendar ? """
                    UPDATE app.calendar_presence SET item_id = @to, occurrence_at = @target WHERE item_id = @id AND occurrence_at = @at;
                    UPDATE app.claim SET item_id = @to, occurrence_at = @target, starts_at = @target, ends_at = @end
                     WHERE item_id = @id AND occurrence_at = @at;
                    UPDATE app.offer_state SET item_id = @to, occurrence_at = @target WHERE item_id = @id AND occurrence_at = @at;
                    """ : target is not null ? """
                    UPDATE app.calendar_presence SET item_id = @to, occurrence_at = @target WHERE item_id = @id AND occurrence_at = @at;
                    UPDATE app.claim
                       SET status = N'declined', awaits = NULL, decided_at = @now,
                           invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
                     WHERE item_id = @id AND occurrence_at = @at AND status IN (N'pending', N'confirmed');
                    DELETE FROM app.offer_state WHERE item_id = @id AND occurrence_at = @at;
                    """ : """
                    DELETE FROM app.calendar_presence WHERE item_id = @id AND occurrence_at = @at;
                    UPDATE app.claim
                       SET status = N'declined', awaits = NULL, decided_at = @now,
                           invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
                     WHERE item_id = @id AND occurrence_at = @at AND status IN (N'pending', N'confirmed');
                    DELETE FROM app.offer_state WHERE item_id = @id AND occurrence_at = @at;
                    """, connection, tx);
                carry.Parameters.AddWithValue("@id", id);
                carry.Parameters.AddWithValue("@at", key);
                carry.Parameters.AddWithValue("@to", to);
                carry.Parameters.AddWithValue("@target", (object?)target ?? DBNull.Value);
                carry.Parameters.AddWithValue("@end", target is null ? DBNull.Value : target.Value + span);
                carry.Parameters.AddWithValue("@now", now);
                await carry.ExecuteNonQueryAsync(ctx.RequestAborted);
                occurrences++;
            }

            /* Die Liste der REIHE — „kto odprawia" — gilt weiter, wenn die neue Reihe noch keine hat. */
            var seriesPeople = new List<(Guid Role, string Duty)>();
            await using (var list = new SqlCommand("""
                SELECT p.role_id, p.duty FROM app.calendar_presence p
                WHERE p.item_id = @id AND p.occurrence_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM app.calendar_presence q WHERE q.item_id = @to AND q.occurrence_at IS NULL);
                """, connection, tx))
            {
                list.Parameters.AddWithValue("@id", id);
                list.Parameters.AddWithValue("@to", to);
                await using var reader = await list.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) seriesPeople.Add((reader.GetGuid(0), reader.GetString(1)));
            }

            foreach (var (role, duty) in seriesPeople)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.calendar_presence (id, item_id, occurrence_at, role_id, duty, created_at)
                    VALUES (@pid, @to, NULL, @role, @duty, @now);
                    """, connection, tx);
                add.Parameters.AddWithValue("@pid", Ids.NewId());
                add.Parameters.AddWithValue("@to", to);
                add.Parameters.AddWithValue("@role", role);
                add.Parameters.AddWithValue("@duty", duty);
                add.Parameters.AddWithValue("@now", now);
                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
                people++;
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
            itemId = Ids.ToText(id),
            to = Ids.ToText(to),
            until,
            intentions = intentions.Count,
            people,
            occurrences
        });
    }
}
