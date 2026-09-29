using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// AUFGABEN (0054) — was zu tun ist, und wann.
///
/// <code>
///   window   ein Zeitfenster, das wiederkehren kann: ein Gebet zwischen 21:00
///            und 21:15, jeden Tag. Erledigt wird ein VORKOMMEN; eines, dessen
///            Fenster vorbei ist, ohne dass es erledigt wurde, ist versäumt.
///   after    ein Abstand nach dem letzten Erledigen: Blumen gießen alle drei
///            Tage. Fällig ist sie, wenn der Abstand um ist; wer sie erledigt,
///            stellt die Uhr neu.
/// </code>
///
/// <para>
/// <b>Wie ein Termin gehört eine Aufgabe Leuten</b> — sich allein (dem
/// eigenen Bereich) oder einem Bereich. Titel und Notiz liegen versiegelt
/// unter dessen Schlüssel; wer dort schreibt, darf sie auch abhaken, und es
/// steht dabei, wer.
/// </para>
///
/// <para>
/// <b>Die Zeit bleibt im Klartext</b>, aus demselben Grund wie im Kalender:
/// sonst liesse sich nicht ausrechnen, was fällig ist, ohne alles
/// herunterzuladen. Die Reihe rechnet dieselbe Funktion wie der Kalender
/// (<see cref="Calendar.Occurrences"/>) — zwei Fassungen liefen auseinander.
/// </para>
/// </summary>
public static class Tasks
{
    private const int MaxTitle = 4096;
    private const int MaxNotes = 64 * 1024;
    private const int MaxEveryMinutes = 366 * 24 * 60;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/tasks", ListAsync);
        app.MapPost("/workspace/tasks", CreateAsync);
        app.MapPost("/workspace/task/{id:guid}", UpdateAsync);
        app.MapPost("/workspace/task/{id:guid}/archive", ArchiveAsync);
        app.MapPost("/workspace/task/{id:guid}/done", DoneAsync);
        app.MapPost("/workspace/task/{id:guid}/skip", SkipAsync);
        app.MapPost("/workspace/task/{id:guid}/undone", UndoneAsync);
    }

    public sealed record TaskRequest(
        string? TaskId, string AreaId, string OwnerRoleId, string Kind,
        string Date, string Time, int? WindowMinutes, int? EveryMinutes,
        string? Repeat, int? Every, int? Weekdays, string? Until, int? Count,
        int Epoch, string TitleSealed, string? NotesSealed, string? TimeZone);

    private sealed record Parsed(
        Guid AreaId, Guid Owner, string Kind, string Zone, DateTimeOffset StartsAt, int WindowMinutes,
        int? EveryMinutes, string Repeat, int Every, int? Weekdays, DateTimeOffset? Until, int? Count,
        int Epoch, byte[] Title, byte[]? Notes);

    private static Parsed? Parse(TaskRequest body, out string error)
    {
        error = string.Empty;
        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (kind is not ("window" or "after")) { error = "Rodzaj zadania: o określonej porze albo co pewien czas."; return null; }

        if (!Guid.TryParse(body.AreaId, out var area) || !Guid.TryParse(body.OwnerRoleId, out var owner))
        {
            error = "Nieczytelna kennung."; return null;
        }

        var zoneName = string.IsNullOrWhiteSpace(body.TimeZone) || Zones.Find(body.TimeZone.Trim()) is null
            ? Zones.Home : body.TimeZone.Trim();
        var zone = Zones.Of(zoneName);

        if (!DateOnly.TryParse(body.Date, out var day) || !TimeOnly.TryParse(body.Time, out var hour))
        {
            error = "Nie ma takiej daty albo godziny."; return null;
        }

        var repeat = (body.Repeat ?? "none").Trim().ToLowerInvariant();
        if (repeat is not ("none" or "daily" or "weekly" or "monthly" or "yearly")) { error = "Nieznane powtórzenie."; return null; }

        int? every = null;
        var window = Math.Clamp(body.WindowMinutes ?? 0, 0, 10080);

        if (kind == "after")
        {
            if (body.EveryMinutes is null or < 1 or > MaxEveryMinutes)
            {
                error = "Co ile? Od minuty do roku."; return null;
            }
            every = body.EveryMinutes;
            repeat = "none";
            window = 0;
        }

        byte[] title;
        byte[]? notes = null;
        try
        {
            title = Base64Url.Decode(body.TitleSealed ?? string.Empty);
            if (!string.IsNullOrWhiteSpace(body.NotesSealed)) notes = Base64Url.Decode(body.NotesSealed);
        }
        catch (FormatException) { error = "Nieczytelna zapieczętowana treść."; return null; }

        if (title.Length is 0 or > MaxTitle) { error = "Zadanie potrzebuje nazwy."; return null; }
        if (notes is not null && notes.Length > MaxNotes) { error = "Notatka jest za długa."; return null; }
        if (body.Epoch < 1) { error = "Nieczytelna epoka."; return null; }

        var starts = Zones.AtLocal(day.ToDateTime(hour), zone);

        DateTimeOffset? until = null;
        if (repeat != "none" && !string.IsNullOrWhiteSpace(body.Until) && DateOnly.TryParse(body.Until, out var end))
        {
            until = Zones.AtLocal(end.ToDateTime(new TimeOnly(23, 59, 59)), zone);
        }

        int? weekdays = repeat == "weekly"
            ? ((body.Weekdays ?? 0) == 0 ? Zones.BitOf(starts.DayOfWeek) : (body.Weekdays!.Value & 127))
            : null;

        return new Parsed(area, owner, kind, zoneName, starts, window, every, repeat,
            Math.Clamp(body.Every ?? 1, 1, 52), weekdays, until, repeat == "none" ? null : body.Count,
            body.Epoch, title, notes);
    }

    /// <summary>Darf dieses Konto hier schreiben, und ist die Person seine? Sonst die Antwort, warum nicht.</summary>
    private static async Task<string?> RefusalAsync(SqlConnection connection, Guid accountId, Parsed task, CancellationToken ct)
    {
        if (!await Area.MayAsync(connection, accountId, task.AreaId, Capability.Write, ct))
            return "W tym obszarze nie możesz dodawać zadań.";

        var mine = await Workspace.RolesOfAsync(connection, accountId, ct);
        if (!mine.Any(r => r.Id == task.Owner) || Workspace.IsAccount(mine, task.Owner))
            return "To nie jest Twoja osoba ani rola.";

        await using var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", task.AreaId);
        var current = (int)(await cmd.ExecuteScalarAsync(ct))!;
        return task.Epoch > current ? "Nie ma takiej epoki obszaru." : null;
    }

    private static void Bind(SqlCommand cmd, Parsed task, DateTimeOffset now)
    {
        cmd.Parameters.AddWithValue("@area", task.AreaId);
        cmd.Parameters.AddWithValue("@owner", task.Owner);
        cmd.Parameters.AddWithValue("@kind", task.Kind);
        cmd.Parameters.AddWithValue("@zone", task.Zone);
        cmd.Parameters.AddWithValue("@starts", task.StartsAt);
        cmd.Parameters.AddWithValue("@window", task.WindowMinutes);
        cmd.Parameters.AddWithValue("@everym", (object?)task.EveryMinutes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@rkind", task.Repeat);
        cmd.Parameters.AddWithValue("@revery", task.Every);
        cmd.Parameters.AddWithValue("@rdays", (object?)task.Weekdays ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@runtil", (object?)task.Until ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@rcount", (object?)task.Count ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@epoch", task.Epoch);
        cmd.Parameters.AddBlob("@title", task.Title);
        cmd.Parameters.AddBlob("@notes", task.Notes);
        cmd.Parameters.AddWithValue("@now", now);
    }

    /// <summary>
    /// Eine Aufgabe anlegen. Die Kennung kommt aus dem Browser: die AAD von
    /// Titel und Notiz nennt sie, und versiegelt wird, bevor der Dienst antwortet.
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, TaskRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.TaskId, out var id))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zadanie musi przyjść z własną kennung — jej nazwa jest w pieczęci.");
            return;
        }

        var task = Parse(body, out var error);
        if (task is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var refused = await RefusalAsync(connection, who.Value.AccountId, task, ctx.RequestAborted);
        if (refused is not null) { await Fail(ctx, StatusCodes.Status403Forbidden, refused); return; }

        await using var insert = new SqlCommand("""
            INSERT INTO app.task
                (id, area_id, owner_role_id, kind, time_zone, starts_at, window_minutes, every_minutes,
                 repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                 epoch, title_sealed, notes_sealed, created_at, updated_at)
            VALUES (@id, @area, @owner, @kind, @zone, @starts, @window, @everym,
                    @rkind, @revery, @rdays, @runtil, @rcount,
                    @epoch, @title, @notes, @now, @now);
            """, connection);
        insert.Parameters.AddWithValue("@id", id);
        Bind(insert, task, DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "To zadanie już jest.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), startsAt = task.StartsAt });
    }

    /// <summary>Eine Aufgabe ändern — Zeit, Art, Leute, Titel. Was schon erledigt war, bleibt erledigt.</summary>
    private static async Task UpdateAsync(HttpContext ctx, Db db, Guid id, TaskRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var task = Parse(body, out var error);
        if (task is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaOf = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (areaOf is null || !await Area.MayAsync(connection, who.Value.AccountId, areaOf.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        var refused = await RefusalAsync(connection, who.Value.AccountId, task, ctx.RequestAborted);
        if (refused is not null) { await Fail(ctx, StatusCodes.Status403Forbidden, refused); return; }

        await using var update = new SqlCommand("""
            UPDATE app.task
               SET area_id = @area, owner_role_id = @owner, kind = @kind, time_zone = @zone, starts_at = @starts,
                   window_minutes = @window, every_minutes = @everym,
                   repeat_kind = @rkind, repeat_every = @revery, repeat_weekdays = @rdays,
                   repeat_until = @runtil, repeat_count = @rcount,
                   epoch = @epoch, title_sealed = @title, notes_sealed = @notes, updated_at = @now
             WHERE id = @id;
            """, connection);
        update.Parameters.AddWithValue("@id", id);
        Bind(update, task, DateTimeOffset.UtcNow);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), startsAt = task.StartsAt });
    }

    /// <summary>Weglegen — nicht löschen: wer sie abgehakt hat, und wann, bleibt nachzulesen.</summary>
    private static async Task ArchiveAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaOf = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (areaOf is null || !await Area.MayAsync(connection, who.Value.AccountId, areaOf.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE app.task SET archived_at = @now, updated_at = @now WHERE id = @id AND archived_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), archived = true });
    }

    private sealed record Stored(
        Guid Id, Guid AreaId, Guid Owner, string Kind, string Zone, DateTimeOffset StartsAt, int WindowMinutes,
        int? EveryMinutes, string Repeat, int Every, int? Weekdays, DateTimeOffset? Until, int? Count,
        int Epoch, byte[] Title, byte[]? Notes, DateTimeOffset CreatedAt);

    private const string Columns = """
        id, area_id, owner_role_id, kind, time_zone, starts_at, window_minutes, every_minutes,
        repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
        epoch, title_sealed, notes_sealed, created_at
        """;

    private static Stored Read(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), reader.GetString(4),
        reader.GetDateTimeOffset(5), reader.GetInt32(6), reader.IsDBNull(7) ? null : reader.GetInt32(7),
        reader.GetString(8), reader.GetInt32(9), reader.IsDBNull(10) ? null : reader.GetByte(10),
        reader.IsDBNull(11) ? null : reader.GetDateTimeOffset(11), reader.IsDBNull(12) ? null : reader.GetInt32(12),
        reader.GetInt32(13), (byte[])reader[14], reader.IsDBNull(15) ? null : (byte[])reader[15],
        reader.GetDateTimeOffset(16));

    /// <summary>Die Vorkommen einer Aufgabe mit Fenster — dieselbe Rechnung wie im Kalender.</summary>
    private static List<DateTimeOffset> OccurrencesOf(Stored task, DateTimeOffset from, DateTimeOffset to) =>
        Calendar.Occurrences(task.StartsAt, task.Repeat, task.Every, task.Weekdays, task.Until, task.Count,
            from, to, Zones.Of(task.Zone));

    /// <summary>
    /// MEINE AUFGABEN — die der Bereiche, deren Schlüssel ich halte, mit dem,
    /// was im Fenster fällig ist und was davon erledigt wurde.
    ///
    /// <para>
    /// Für <c>window</c>: jedes Vorkommen im Zeitraum, mit „erledigt von, um".
    /// Für <c>after</c>: wann zuletzt erledigt, und wann wieder fällig — das
    /// rechnet der Dienst, damit jede Ansicht dieselbe Antwort hat.
    /// </para>
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db, string? from, string? to)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Calendar.Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var held = await Agenda.HeldAreasAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var tasks = new List<Stored>();

        if (held.Count > 0)
        {
            var names = string.Join(", ", held.Select((_, i) => $"@h{i}"));
            await using var cmd = new SqlCommand(
                $"SELECT {Columns} FROM app.task WHERE archived_at IS NULL AND area_id IN ({names}) ORDER BY created_at;",
                connection);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) tasks.Add(Read(reader));
        }

        /* Was erledigt wurde — im Zeitraum (und für `after` das jeweils letzte, gleich wann). */
        var done = new Dictionary<Guid, List<(DateTimeOffset At, DateTimeOffset DoneAt, Guid By, string State)>>();
        if (tasks.Count > 0)
        {
            var names = string.Join(", ", tasks.Select((_, i) => $"@t{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT d.task_id, d.occurrence_at, d.done_at, d.done_by_role_id, d.state
                FROM app.task_done d
                WHERE d.task_id IN ({names})
                  AND (d.occurrence_at BETWEEN @from AND @to
                       OR d.occurrence_at = (SELECT MAX(x.occurrence_at) FROM app.task_done x WHERE x.task_id = d.task_id))
                ORDER BY d.task_id, d.occurrence_at;
                """, connection);
            cmd.Parameters.AddWithValue("@from", since.AddDays(-1));
            cmd.Parameters.AddWithValue("@to", till);
            for (var i = 0; i < tasks.Count; i++) cmd.Parameters.AddWithValue($"@t{i}", tasks[i].Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var task = reader.GetGuid(0);
                if (!done.TryGetValue(task, out var list)) done[task] = list = [];
                list.Add((reader.GetDateTimeOffset(1), reader.GetDateTimeOffset(2), reader.GetGuid(3), reader.GetString(4)));
            }
        }

        var now = DateTimeOffset.UtcNow;

        await ctx.Response.WriteAsJsonAsync(new
        {
            now,
            fromUtc = since,
            toUtc = till,
            tasks = tasks.Select(task =>
            {
                var mine = done.TryGetValue(task.Id, out var list) ? list : [];

                /*
                    Zwei „zuletzt": das letzte ERLEDIGEN steht in der Geschichte
                    und zählt als getan; die letzte ENTSCHEIDUNG — erledigt oder
                    abgesagt — stellt die Uhr. Wer „dieses Mal nicht" sagt, hat
                    die Blumen nicht gegossen, soll aber auch nicht in zehn
                    Minuten wieder gefragt werden.
                */
                var settled = mine.Count == 0 ? ((DateTimeOffset At, DateTimeOffset DoneAt, Guid By, string State)?)null : mine.MaxBy(d => d.At);
                var doneOnes = mine.Where(d => d.State == "done").ToList();
                var last = doneOnes.Count == 0 ? ((DateTimeOffset At, DateTimeOffset DoneAt, Guid By, string State)?)null : doneOnes.MaxBy(d => d.At);

                return new
                {
                    taskId = Ids.ToText(task.Id),
                    areaId = Ids.ToText(task.AreaId),
                    ownerRoleId = Ids.ToText(task.Owner),
                    kind = task.Kind,
                    timeZone = task.Zone,
                    startsAt = task.StartsAt,
                    windowMinutes = task.WindowMinutes,
                    everyMinutes = task.EveryMinutes,
                    repeatKind = task.Repeat,
                    repeatEvery = task.Every,
                    repeatWeekdays = task.Weekdays,
                    repeatUntil = task.Until,
                    repeatCount = task.Count,
                    epoch = task.Epoch,
                    titleSealed = Base64Url.Encode(task.Title),
                    notesSealed = task.Notes is null ? null : Base64Url.Encode(task.Notes),
                    createdAt = task.CreatedAt,

                    /* window: die Vorkommen im Zeitraum, jedes mit „erledigt". */
                    occurrences = (task.Kind == "window" ? OccurrencesOf(task, since.AddMinutes(-task.WindowMinutes), till) : new List<DateTimeOffset>())
                        .Select(at =>
                        {
                            var hit = mine.FirstOrDefault(d => d.At == at);
                            var settledHere = hit != default;
                            var skipped = settledHere && hit.State == "skipped";

                            return new
                            {
                                at,
                                endsAt = at.AddMinutes(task.WindowMinutes),
                                doneAt = settledHere && !skipped ? hit.DoneAt : (DateTimeOffset?)null,
                                doneBy = settledHere && !skipped ? Ids.ToText(hit.By) : null,
                                skippedAt = skipped ? hit.DoneAt : (DateTimeOffset?)null,
                                skippedBy = skipped ? Ids.ToText(hit.By) : null
                            };
                        }).ToList(),

                    /* after: zuletzt erledigt, und wann wieder fällig. */
                    lastDoneAt = last?.DoneAt,
                    lastDoneBy = last is null ? null : Ids.ToText(last.Value.By),
                    dueAt = task.Kind != "after" ? (DateTimeOffset?)null
                        : settled is null ? task.StartsAt
                        : settled.Value.DoneAt.AddMinutes(task.EveryMinutes ?? 0),
                    skippedAt = task.Kind == "after" && settled is not null && settled.Value.State == "skipped" ? settled.Value.DoneAt : (DateTimeOffset?)null,

                    /*
                        Der NAME der letzten Entscheidung, nicht ihr Augenblick:
                        wer sich umentscheidet, behaelt das Vorkommen und bekommt
                        ein neues done_at. Zum Zuruecknehmen zaehlt der Name.
                    */
                    lastSettledAt = task.Kind == "after" ? settled?.At : (DateTimeOffset?)null,
                    history = (task.Kind == "after" ? doneOnes : new List<(DateTimeOffset At, DateTimeOffset DoneAt, Guid By, string State)>()).OrderByDescending(d => d.At).Take(10)
                        .Select(d => new { doneAt = d.DoneAt, doneBy = Ids.ToText(d.By) }).ToList()
                };
            })
        });
    }

    public sealed record DoneRequest(string ByRoleId, string? OccurrenceAt);

    /// <summary>
    /// ABHAKEN. Bei <c>window</c> ein bestimmtes Vorkommen — eines, das es in
    /// der Reihe wirklich gibt; bei <c>after</c> jetzt, und die Uhr beginnt neu.
    /// Wer im Bereich schreibt, darf es — und es steht dabei, wer.
    /// </summary>
    private static Task DoneAsync(HttpContext ctx, Db db, Guid id, DoneRequest body) =>
        SettleAsync(ctx, db, id, body, "done");

    /// <summary>
    /// ABSAGEN — „dieses eine Mal nicht".
    ///
    /// <para>
    /// Derselbe Vorgang wie das Abhaken, mit dem anderen Ausgang: das Vorkommen
    /// ist entschieden und drängt nicht mehr, aber es behauptet niemand, es sei
    /// getan. Es steht auch nicht in der Geschichte der Erledigungen — wer nach
    /// einem Jahr nachsieht, wie oft die Blumen gegossen wurden, soll die Male
    /// gezählt bekommen, an denen sie gegossen wurden.
    /// </para>
    ///
    /// <para>
    /// Bei <c>after</c> stellt es trotzdem die Uhr: sonst stünde die Aufgabe
    /// zehn Minuten später wieder da und die Absage wäre keine.
    /// </para>
    /// </summary>
    private static Task SkipAsync(HttpContext ctx, Db db, Guid id, DoneRequest body) =>
        SettleAsync(ctx, db, id, body, "skipped");

    private static async Task SettleAsync(HttpContext ctx, Db db, Guid id, DoneRequest body, string state)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ByRoleId, out var by))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var task = await StoredAsync(connection, id, ctx.RequestAborted);
        if (task is null || !await Area.MayAsync(connection, who.Value.AccountId, task.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == by) || Workspace.IsAccount(mine, by))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja osoba ani rola.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        DateTimeOffset at;

        if (task.Kind == "window")
        {
            if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out at))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Które wystąpienie?");
                return;
            }

            if (!OccurrencesOf(task, at.AddSeconds(-1), at.AddSeconds(1)).Any(o => o == at))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego wystąpienia w serii nie ma.");
                return;
            }

            if (at > now.AddDays(1))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "To wystąpienie jest dopiero przed nami.");
                return;
            }
        }
        else
        {
            at = now;
        }

        /*
            Umentscheiden geht: wer erst absagt und dann doch giesst, hakt ab,
            und die Zeile nimmt den neuen Ausgang an. Nur das erste Mal legt sie
            an — deshalb UPDATE statt eines zweiten Eintrags.
        */
        await using var insert = new SqlCommand("""
            UPDATE app.task_done
               SET state = @state, done_at = @now, done_by_role_id = @by
             WHERE task_id = @task AND occurrence_at = @at AND state <> @state;

            IF NOT EXISTS (SELECT 1 FROM app.task_done WHERE task_id = @task AND occurrence_at = @at)
                INSERT INTO app.task_done (task_id, occurrence_at, done_at, done_by_role_id, state)
                VALUES (@task, @at, @now, @by, @state);
            """, connection);
        insert.Parameters.AddWithValue("@task", id);
        insert.Parameters.AddWithValue("@at", at);
        insert.Parameters.AddWithValue("@now", now);
        insert.Parameters.AddWithValue("@by", by);
        insert.Parameters.AddWithValue("@state", state);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Zwei Fenster, ein Häkchen — es steht schon da.
        }

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), occurrenceAt = at, doneAt = now, state });
    }

    public sealed record UndoneRequest(string OccurrenceAt);

    /// <summary>Ein Häkchen zurücknehmen — aus Versehen gesetzt, oder doch nicht getan.</summary>
    private static async Task UndoneAsync(HttpContext ctx, Db db, Guid id, UndoneRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Które wystąpienie?");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaOf = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (areaOf is null || !await Area.MayAsync(connection, who.Value.AccountId, areaOf.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        await using var drop = new SqlCommand(
            "DELETE FROM app.task_done WHERE task_id = @task AND occurrence_at = @at;", connection);
        drop.Parameters.AddWithValue("@task", id);
        drop.Parameters.AddWithValue("@at", at);
        var gone = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), undone = gone > 0 });
    }

    private static async Task<Guid?> AreaOfAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM app.task WHERE id = @id AND archived_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static async Task<Stored?> StoredAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"SELECT {Columns} FROM app.task WHERE id = @id AND archived_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Read(reader) : null;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
