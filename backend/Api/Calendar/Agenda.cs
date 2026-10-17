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
    private static readonly string[] SealableFields = ["title", "location", "notes", "link", "link_label"];


    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/agenda", AgendaAsync);
        app.MapPost("/workspace/area/{id:guid}/item", AddToAreaAsync);
        app.MapPost("/workspace/item/{id:guid}", UpdateAsync);
        app.MapPost("/workspace/item/{id:guid}/delete", DeleteAsync);

        /* 0079 — „ta i następne”: eine Reihe ab einem Tag an eine neue übergeben. */
        app.MapPost("/workspace/item/{id:guid}/handover", HandoverAsync);
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
    internal static async Task<List<Guid>> HeldAreasAsync(SqlConnection connection, Guid accountId, CancellationToken ct) =>
        await HeldAreasAsync(connection, await Workspace.RolesOfAsync(connection, accountId, ct), ct);

    private static async Task<List<Guid>> HeldAreasAsync(SqlConnection connection, List<Workspace.RoleRow> mine, CancellationToken ct)
    {
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
        bool? Bookable = null, int? Capacity = null, Guid? ReserveAreaId = null,
        Guid? ParentItemId = null, int? Position = null, Guid? ChatId = null, Guid? TopicId = null);

    /// <summary>
    /// DER EIGENE KALENDER: jedes Vorkommen jedes Termins in meinen Bereichen,
    /// mit der Reihe dahinter (zum Ändern), und meine Buchungen. Aufgaben
    /// kommen über <c>/workspace/tasks</c> — sie haben ihre eigene Uhr.
    /// </summary>
    private static async Task AgendaAsync(HttpContext ctx, Db db, string? from, string? to)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Calendar.Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * WESSEN Kalender: der des Kontos — oder, ohne Konto, der der Links in
         * diesem Browser. Für sie gilt dieselbe Schranke: was ihre Rollen halten
         * und lesen.
         */
        var mine = caller.Roles;
        var held = await HeldAreasAsync(connection, mine, ctx.RequestAborted);
        var readable = await Calendar.ReadableAreasAsync(connection, caller.AccountId, ctx.RequestAborted,
            linkRoles: caller.ByLinks ? caller.RoleIds : null);

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
                       i.calendar_id, c.area_id, c.time_zone, i.bookable, i.capacity, i.reserve_area_id,
                       i.parent_item_id, i.position, i.chat_id, i.topic_id
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
                    reader.IsDBNull(19) ? null : reader.GetGuid(19),
                    reader.IsDBNull(20) ? null : reader.GetGuid(20),
                    reader.IsDBNull(21) ? null : reader.GetInt32(21),
                    reader.IsDBNull(22) ? null : reader.GetGuid(22),
                    reader.IsDBNull(23) ? null : reader.GetGuid(23)));
            }
        }

        var itemIds = rows.Select(r => r.Id).ToList();
        var exceptions = await Calendar.ExceptionsAsync(connection, itemIds, ctx.RequestAborted);
        var fields = await Calendar.FieldsAsync(connection, itemIds, ctx.RequestAborted);

        /* 0058 — wer bei welchem Termin da sein muss, und ob ich es bin. */
        var people = await Calendar.PeopleOfAsync(connection, itemIds, ctx.RequestAborted);

        /* 0079 — wie viele Intentionen an jeder Messe hängen. */
        var intentionCounts = await Mass.CountsAsync(connection,
            rows.Where(r => r.Kind == "mass").Select(r => r.Id).Distinct().ToList(), since.AddDays(-1), till, ctx.RequestAborted);
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

                    /* 0070 — Teil welches Termins, an welcher Stelle; aus welcher Rozmowa. */
                    parentItemId = row.ParentItemId is null ? null : Ids.ToText(row.ParentItemId.Value),
                    position = row.Position,
                    chatId = row.ChatId is null ? null : Ids.ToText(row.ChatId.Value),
                    topicId = row.TopicId is null ? null : Ids.ToText(row.TopicId.Value),

                    /* 0079 — an einer Messe: wie viele Intentionen (angenommen oder gefeiert). */
                    intentions = row.Kind == "mass" ? intentionCounts.GetValueOrDefault((row.Id, at)) : (int?)null,

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

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
