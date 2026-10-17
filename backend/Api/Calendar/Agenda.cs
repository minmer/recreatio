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
public static partial class Agenda
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

private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
