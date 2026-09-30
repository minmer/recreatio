using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DER EIGENE KALENDER (0054) — alles, was ich sehe, an einer Stelle; und
/// eintragen, ändern, löschen, wie man es von jedem Kalender kennt.
///
/// <para>
/// <b>Ein Termin gehört Leuten, nicht einem Kalender.</b> Der Mensch wählt,
/// WER ihn sieht — sich allein, oder einen Bereich —, und der Terminarz dieses
/// Bereichs entsteht dabei von selbst (<see cref="EnsureCalendarAsync"/>).
/// Einen Kalender anzulegen und zu benennen, war ein Handgriff, den niemand
/// verstand: für ihn waren es die Termine dieser Gruppe.
/// </para>
///
/// <para>
/// <b>Was ich sehe</b>: die Termine jedes Bereichs, dessen Schlüssel ich halte
/// (nicht jeden öffentlichen Aushang des Landes), und meine Buchungen.
/// Versiegelt geht alles hinaus wie immer; geöffnet wird im Browser.
/// </para>
///
/// <para>
/// <b>Messen und Beichten ändert man hier nicht.</b> An ihnen hängen
/// Intentionen, an Terminen mit Angeboten Buchungen — und die hängen am
/// Beginn eines Vorkommens. Ein Kalender, der sie nebenbei verschöbe, liesse
/// sie stumm ins Leere zeigen. Sie haben ihre eigene Stelle.
/// </para>
/// </summary>
public static class Agenda
{
    private static readonly string[] SealableFields = ["title", "location", "notes"];

    /// <summary>Was man hier ändern darf. Alles andere hat seine eigene Stelle (Msze i intencje, Rezerwacje).</summary>
    private static readonly string[] OwnKinds = ["appointment", "visit", "task"];

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/agenda", AgendaAsync);
        app.MapPost("/workspace/area/{id:guid}/item", AddToAreaAsync);
        app.MapPost("/workspace/item/{id:guid}", UpdateAsync);
        app.MapPost("/workspace/item/{id:guid}/delete", DeleteAsync);
    }

    /* ======================================================================
       DER TERMINARZ EINES BEREICHS
       ====================================================================== */

    /// <summary>
    /// Der Terminarz eines Bereichs — und wenn es noch keinen gibt, jetzt.
    /// Er heisst wie sein Bereich; zwei Fenster, die ihn zugleich anlegen,
    /// bekommen denselben (<c>uq_calendar_area</c>).
    /// </summary>
    internal static async Task<Guid> EnsureCalendarAsync(SqlConnection connection, Guid areaId, string zone, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            await using (var find = new SqlCommand(
                "SELECT TOP 1 id FROM app.calendar WHERE area_id = @area AND archived_at IS NULL ORDER BY is_default DESC, created_at;", connection))
            {
                find.Parameters.AddWithValue("@area", areaId);
                if (await find.ExecuteScalarAsync(ct) is Guid found) return found;
            }

            string name;
            await using (var named = new SqlCommand("SELECT name FROM app.area WHERE id = @area;", connection))
            {
                named.Parameters.AddWithValue("@area", areaId);
                name = await named.ExecuteScalarAsync(ct) as string ?? "Terminy";
            }

            var id = Ids.NewId();
            await using var insert = new SqlCommand("""
                INSERT INTO app.calendar (id, area_id, title, time_zone, created_at, is_default)
                VALUES (@id, @area, @title, @zone, @now,
                        CASE WHEN EXISTS (SELECT 1 FROM app.calendar WHERE area_id = @area AND is_default = 1) THEN 0 ELSE 1 END);
                """, connection);
            insert.Parameters.AddWithValue("@id", id);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@title", name.Length > Calendar.MaxTitle ? name[..Calendar.MaxTitle] : name);
            insert.Parameters.AddWithValue("@zone", zone);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try
            {
                await insert.ExecuteNonQueryAsync(ct);
                return id;
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Ein zweites Fenster war schneller — dessen gilt; die nächste Runde findet ihn.
            }
        }

        throw new InvalidOperationException("Terminarz obszaru nie powstał.");
    }

    /// <summary>
    /// EINEN TERMIN FÜR DIESE LEUTE — der Terminarz ihres Bereichs entsteht
    /// dabei von selbst. Danach geht es den Weg jedes Eintrags
    /// (<see cref="Calendar.AddItemAsync"/>), mit allen seinen Prüfungen.
    /// </summary>
    private static async Task AddToAreaAsync(HttpContext ctx, Db db, Guid id, Calendar.ItemRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        Guid calendarId;
        await using (var connection = await db.OpenAsync(ctx.RequestAborted))
        {
            if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma — albo nie możesz w nim pisać.");
                return;
            }

            var zone = string.IsNullOrWhiteSpace(body.TimeZone) || Zones.Find(body.TimeZone.Trim()) is null
                ? Zones.Home
                : body.TimeZone.Trim();

            calendarId = await EnsureCalendarAsync(connection, id, zone, ctx.RequestAborted);
        }

        await Calendar.AddItemAsync(ctx, db, calendarId, body);
    }

    /* ======================================================================
       ALLES, WAS ICH SEHE
       ====================================================================== */

    /// <summary>Die Bereiche, deren Schlüssel eine meiner Rollen hält — MEINE Gruppen, nicht jeder Aushang.</summary>
    internal static async Task<List<Guid>> HeldAreasAsync(SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        var mine = await Workspace.RolesOfAsync(connection, accountId, ct);
        if (mine.Count == 0) return [];

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var held = new SqlCommand($"""
            SELECT DISTINCT key_ref FROM app.key_grant
            WHERE key_kind = N'epoch' AND destroyed_at IS NULL AND role_id IN ({names});
            """, connection);
        for (var i = 0; i < mine.Count; i++) held.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var areas = new List<Guid>();
        await using var reader = await held.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        return areas;
    }

    private sealed record Row(
        Guid Id, Guid OwnerRoleId, string Kind, DateTimeOffset StartsAt, DateTimeOffset EndsAt, bool AllDay,
        string? TitlePublic, Guid VisibilityAreaId, string Status,
        string RepeatKind, int RepeatEvery, int? Weekdays, DateTimeOffset? Until, int? Count,
        Guid CalendarId, Guid AreaId, string Zone,
        bool? Bookable = null, int? Capacity = null, Guid? ReserveAreaId = null);

    /// <summary>
    /// DER EIGENE KALENDER: jedes Vorkommen jedes Termins in meinen Bereichen,
    /// mit der Reihe dahinter (zum Ändern), und meine Buchungen. Aufgaben
    /// kommen über <c>/workspace/tasks</c> — sie haben ihre eigene Uhr.
    /// </summary>
    private static async Task AgendaAsync(HttpContext ctx, Db db, string? from, string? to)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Calendar.Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var held = await HeldAreasAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var readable = await Calendar.ReadableAreasAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);

        var rows = new List<Row>();

        if (held.Count > 0 && readable.Count > 0)
        {
            var heldNames = string.Join(", ", held.Select((_, i) => $"@h{i}"));
            var readNames = string.Join(", ", readable.Select((_, i) => $"@a{i}"));

            /*
             * 0058 — WAS ICH SEHE: Termine der Kalender meiner Bereiche — UND
             * Termine anderer Kalender, die unter einem meiner Bereiche sichtbar
             * sind (der Kalender des Pfarrers, den die Pfarrei sieht). Die
             * Schranke bleibt der Schlüssel: `visibility_area_id` muss lesbar sein.
             */
            await using var cmd = new SqlCommand($"""
                SELECT i.id, i.owner_role_id, i.kind, i.starts_at, i.ends_at, i.all_day,
                       i.title_public, i.visibility_area_id, i.status,
                       i.repeat_kind, i.repeat_every, i.repeat_weekdays, i.repeat_until, i.repeat_count,
                       i.calendar_id, c.area_id, c.time_zone, i.bookable, i.capacity, i.reserve_area_id
                FROM app.calendar_item i
                JOIN app.calendar c ON c.id = i.calendar_id
                WHERE (c.area_id IN ({heldNames}) OR i.visibility_area_id IN ({heldNames}))
                  AND i.visibility_area_id IN ({readNames})
                  AND c.archived_at IS NULL
                  AND i.starts_at <= @to
                  AND (i.repeat_kind = N'none' OR i.repeat_until IS NULL OR i.repeat_until >= @from);
                """, connection);

            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);
            for (var i = 0; i < readable.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", readable[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add(new Row(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetDateTimeOffset(3), reader.GetDateTimeOffset(4), reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.GetGuid(7), reader.GetString(8), reader.GetString(9), reader.GetInt32(10),
                    reader.IsDBNull(11) ? null : reader.GetByte(11),
                    reader.IsDBNull(12) ? null : reader.GetDateTimeOffset(12),
                    reader.IsDBNull(13) ? null : reader.GetInt32(13),
                    reader.GetGuid(14), reader.GetGuid(15), reader.GetString(16),
                    reader.IsDBNull(17) ? null : reader.GetBoolean(17),
                    reader.IsDBNull(18) ? null : reader.GetInt32(18),
                    reader.IsDBNull(19) ? null : reader.GetGuid(19)));
            }
        }

        var itemIds = rows.Select(r => r.Id).ToList();
        var exceptions = await Calendar.ExceptionsAsync(connection, itemIds, ctx.RequestAborted);
        var fields = await Calendar.FieldsAsync(connection, itemIds, ctx.RequestAborted);

        /* 0058 — wer bei welchem Termin da sein muss, und ob ich es bin. */
        var people = await Calendar.PeopleOfAsync(connection, itemIds, ctx.RequestAborted);
        var myRoles = mine.Select(r => r.Id).ToHashSet();

        var occurrences = new List<object>();
        foreach (var row in rows)
        {
            var span = row.EndsAt - row.StartsAt;
            var zone = Zones.Of(row.Zone);

            foreach (var at in Calendar.Occurrences(row.StartsAt, row.RepeatKind, row.RepeatEvery,
                         row.Weekdays, row.Until, row.Count, since.AddDays(-1), till, zone))
            {
                var starts = at;
                var moved = false;

                if (exceptions.TryGetValue((row.Id, at), out var exception))
                {
                    if (exception.Cancelled) continue;
                    if (exception.MovedTo is not null) { starts = exception.MovedTo.Value; moved = true; }
                }

                if (starts + span < since || starts > till) continue;

                var present = Calendar.PeopleAt(people, row.Id, at);

                occurrences.Add(new
                {
                    itemId = Ids.ToText(row.Id),
                    calendarId = Ids.ToText(row.CalendarId),
                    areaId = Ids.ToText(row.AreaId),
                    ownerRoleId = Ids.ToText(row.OwnerRoleId),
                    kind = row.Kind,
                    occurrenceAt = at,
                    startsAt = starts,
                    endsAt = starts + span,
                    allDay = row.AllDay,
                    status = row.Status,
                    titlePublic = row.TitlePublic,
                    visibilityAreaId = Ids.ToText(row.VisibilityAreaId),
                    moved,

                    /* 0058 — was dieser Termin fürs Reservieren für sich sagt (NULL: wie der Kalender). */
                    bookable = row.Bookable,
                    capacity = row.Capacity,
                    reserveAreaId = row.ReserveAreaId is null ? null : Ids.ToText(row.ReserveAreaId.Value),

                    /* 0058 — wer da sein muss; `mine`: eine meiner Rollen. */
                    people = present.Select(p => new { roleId = Ids.ToText(p.Role), duty = p.Duty }),
                    mine = present.Any(p => myRoles.Contains(p.Role)),

                    /* Die Reihe dahinter — wer „całą serię" ändert, braucht sie ganz. */
                    series = new
                    {
                        startsAt = row.StartsAt,
                        endsAt = row.EndsAt,
                        repeatKind = row.RepeatKind,
                        repeatEvery = row.RepeatEvery,
                        repeatWeekdays = row.Weekdays,
                        repeatUntil = row.Until,
                        repeatCount = row.Count,
                        timeZone = row.Zone
                    },

                    fields = fields.TryGetValue(row.Id, out var list)
                        ? list.Select(f => new
                        {
                            field = f.Field,
                            areaId = Ids.ToText(f.AreaId),
                            epoch = f.Epoch,
                            @sealed = Base64Url.Encode(f.Blob)
                        })
                        : []
                });
            }
        }

        /* MEINE BUCHUNGEN — was ich mir genommen habe, steht in meinem Kalender. */
        var claims = new List<object>();
        if (mine.Count > 0)
        {
            var roleNames = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT cl.id, cl.resource_id, r.name, r.area_id, cl.starts_at, cl.ends_at, cl.status, cl.role_id
                FROM app.claim cl
                JOIN app.resource r ON r.id = cl.resource_id
                WHERE cl.role_id IN ({roleNames})
                  AND cl.status IN (N'pending', N'confirmed')
                  AND cl.starts_at < @to AND cl.ends_at > @from;
                """, connection);
            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                claims.Add(new
                {
                    claimId = Ids.ToText(reader.GetGuid(0)),
                    resourceId = Ids.ToText(reader.GetGuid(1)),
                    resourceName = reader.GetString(2),
                    areaId = Ids.ToText(reader.GetGuid(3)),
                    startsAt = reader.GetDateTimeOffset(4),
                    endsAt = reader.GetDateTimeOffset(5),
                    status = reader.GetString(6),
                    roleId = Ids.ToText(reader.GetGuid(7))
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { fromUtc = since, toUtc = till, occurrences, claims });
    }

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

        if (!OwnKinds.Contains(kind)) { error = "Tu zmienia się spotkania, odwiedziny i zadania — msze w „Msze i intencje”."; return null; }
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
            if (!SealableFields.Contains(name)) { error = "Zapieczętować można tytuł, miejsce albo notatkę."; return null; }
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
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var parsed = Parse(body, out var error);
        if (parsed is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var was = await ExistingAsync(connection, id, ctx.RequestAborted);
        if (was is null || !await Area.MayAsync(connection, who.Value.AccountId, was.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz go zmieniać.");
            return;
        }

        if (!OwnKinds.Contains(was.Kind))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Msze i spowiedzi zmienia się w „Msze i intencje” — wiszą na nich intencje.");
            return;
        }

        foreach (var needed in parsed.Fields.Select(f => f.AreaId).Append(parsed.Visibility).Distinct())
        {
            if (!await Area.MayAsync(connection, who.Value.AccountId, needed, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
                return;
            }
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
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
                || !await Area.MayAsync(connection, who.Value.AccountId, targetCalendar.AreaId, Capability.Write, ctx.RequestAborted))
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
                       bookable = @bookable, capacity = @capacity, reserve_area_id = @reserve, updated_at = @now
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
            claimsMoved = carried.Moved, claimsDropped = carried.Dropped
        });
    }

    /// <summary>
    /// EINEN TERMIN LÖSCHEN — die ganze Reihe, mit ihren Ausnahmen und Feldern.
    /// Hängt an ihm noch etwas (eine Buchung), bleibt er: dann wird er
    /// abgesagt, nicht gelöscht — wer ihn hielt, soll erfahren, dass er fort ist.
    /// </summary>
    private static async Task DeleteAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var was = await ExistingAsync(connection, id, ctx.RequestAborted);
        if (was is null || !await Area.MayAsync(connection, who.Value.AccountId, was.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz go usunąć.");
            return;
        }

        if (!OwnKinds.Contains(was.Kind))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Msze i spowiedzi usuwa się w „Msze i intencje”.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using var drop = new SqlCommand("""
                DELETE FROM app.calendar_field WHERE item_id = @id;
                DELETE FROM app.calendar_exception WHERE item_id = @id;
                DELETE FROM app.calendar_presence WHERE item_id = @id;
                DELETE FROM app.calendar_item WHERE id = @id;
                """, connection, tx);
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
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

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
