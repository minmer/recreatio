using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0047 — Formulare, die ein anderes ERWEITERN, und die Schritte eines Menschen.
///
/// <para>
/// <b>Eine Erweiterung ist ein gewoehnliches Formular</b> — mit Fragen, Aufbau,
/// Logik —, das zu einem anderen gehoert und sagt, wer es ausfuellt: der Mensch
/// selbst ueber seinen Link (<c>person</c>), oder nur die Kanzlei
/// (<c>office</c>). Seine Einsendung zeigt auf die, die sie ergaenzt
/// (<c>registration.base_id</c>).
/// </para>
///
/// <para>
/// <b>Die Schritte</b> sind, was ein Mensch noch tun oder die Kanzlei noch
/// abhaken muss. Ein Teil ergibt sich von selbst und steht nirgends: die
/// Durchsicht der Angaben (0046) und je Erweiterung „Uzupełnij". Der andere
/// Teil wird von Hand angelegt — nur er steht in <c>form_step</c>. Ob ein
/// Schritt erledigt ist, rechnet der BROWSER aus (dieselbe Funktion bei der
/// Kanzlei und beim Menschen); der Dienst haelt nur, was er ohnehin weiss:
/// welche Einsendungen es gibt und was abgehakt ist.
/// </para>
/// </summary>
public static partial class Form
{
    /// <summary>Mehr Schritte als das ist keine Liste mehr, sondern ein Handbuch (0098: mit den Aufgaben eines Jahres).</summary>
    private const int MaxSteps = 60;

    private static void MapExtension(WebApplication app)
    {
        app.MapGet("/workspace/part/{id:guid}/steps", StepsAsync);
        app.MapPost("/workspace/part/{id:guid}/steps", SaveStepsAsync);
        app.MapPost("/workspace/registration/{id:guid}/step", MarkAsync);

        /* 0098 — eine Aufgabe: was der Mensch sagt, an welchen Tagen er sie getan hat (die Kanzlei für ihn). */
        app.MapPost("/workspace/registration/{id:guid}/task", OfficeTaskAsync);

        /* 0099 — zu einem Termin: będę / nie wiem / nie będę, die Funktion, und die Liste (die Kanzlei für ihn). */
        app.MapPost("/workspace/registration/{id:guid}/presence", OfficePresenceAsync);
        app.MapPost("/workspace/part/{id:guid}/entry", EntryAsync);
    }

    /* -- Was ein Formular ist -------------------------------------------------- */

    /// <summary>Erweitert dieses Formular ein anderes, wer fuellt es aus — und wie oft (0077)?</summary>
    internal readonly record struct Shape(Guid? ExtendsId, string Audience, string Repeat = Rounds.Once);

    internal static async Task<Shape?> ShapeAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT extends_id, audience, repeat_kind FROM app.module WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", moduleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new Shape(reader.IsDBNull(0) ? null : reader.GetGuid(0), reader.GetString(1), reader.GetString(2));
    }

    /// <summary>
    /// Die Einsendung einer Erweiterung zu dieser Einsendung, fuer DIESEN
    /// Zeitraum (0077; bei einer einmaligen der leere) — oder <c>null</c>.
    /// </summary>
    private static async Task<Guid?> ExtensionOfAsync(
        SqlConnection connection, Guid extensionId, Guid baseRegistrationId, string round, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT TOP 1 id FROM app.registration WHERE part_id = @part AND base_id = @base AND round_key = @round;",
            connection);
        cmd.Parameters.AddWithValue("@part", extensionId);
        cmd.Parameters.AddWithValue("@base", baseRegistrationId);
        cmd.Parameters.AddWithValue("@round", round);

        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    /// <summary>
    /// Je Einsendung: was sie erweitert — welche Erweiterung, welche Einsendung, wann.
    ///
    /// <para>
    /// <b>Je Erweiterung EINE Zeile: die juengste</b> (0077). Eine wiederkehrende
    /// Erweiterung haette sonst je Mensch hunderte — und gefragt ist hier nur,
    /// ob der LAUFENDE Zeitraum ausgefuellt ist. Weil nichts in die Zukunft
    /// eingetragen wird, ist das genau dann der Fall, wenn die juengste ihn
    /// traegt (<c>round</c>). <c>rounds</c> sagt, wie viele es insgesamt sind.
    /// </para>
    ///
    /// <para>
    /// <c>baseIdsSql</c>: eine Unterabfrage, die die Einsendungen nennt — keine
    /// Liste von Parametern: eine Liste mit 2100 Menschen sprengte sie.
    /// </para>
    /// </summary>
    private static async Task<Dictionary<Guid, List<object>>> ExtensionsOfAsync(
        SqlConnection connection, string baseIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();

        await using var cmd = new SqlCommand($"""
            SELECT x.base_id, x.part_id, x.id, x.submitted_at, x.confirmed_at, x.round_key, x.n
            FROM (
                SELECT r.base_id, r.part_id, r.id, r.submitted_at, r.confirmed_at, r.round_key,
                       ROW_NUMBER() OVER (PARTITION BY r.base_id, r.part_id ORDER BY r.round_key DESC, r.submitted_at DESC) AS place,
                       COUNT(*) OVER (PARTITION BY r.base_id, r.part_id) AS n
                FROM app.registration r
                WHERE r.base_id IN ({baseIdsSql})
            ) x
            WHERE x.place = 1;
            """, connection);

        bind(cmd);

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var key = reader.GetGuid(0);
                if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];

                list.Add(new
                {
                    moduleId = Ids.ToText(reader.GetGuid(1)),
                    registrationId = Ids.ToText(reader.GetGuid(2)),
                    submittedAt = reader.GetDateTimeOffset(3),
                    confirmedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),

                    /* 0077 — der Zeitraum der juengsten Einsendung, und wie viele es gibt. */
                    round = reader.GetString(5),
                    rounds = reader.GetInt32(6)
                });
            }
        }

        return out_;
    }

    /// <summary>Je Einsendung: welche Schritte abgehakt sind, wann, und ob vom Menschen selbst.</summary>
    private static async Task<Dictionary<Guid, List<object>>> MarksOfAsync(
        SqlConnection connection, string registrationIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();

        await using var cmd = new SqlCommand($"""
            SELECT registration_id, step_id, done_at, by_person
            FROM app.step_mark
            WHERE registration_id IN ({registrationIdsSql});
            """, connection);

        bind(cmd);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var key = reader.GetGuid(0);
            if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];

            list.Add(new
            {
                stepId = Ids.ToText(reader.GetGuid(1)),
                doneAt = reader.GetDateTimeOffset(2),
                byPerson = reader.GetBoolean(3)
            });
        }

        return out_;
    }

    /* -- Die Schritte, fuer die Kanzlei ---------------------------------------------- */

    private sealed record StepRow(
        Guid Id, int Position, Guid AreaId, int Epoch, byte[] Label, byte[]? Help,
        string DoneBy, bool VisibleToPerson, DateTimeOffset? DueAt,

        /* 0098 — ein Znacznik (mark) oder eine Aufgabe mit Zeitraum (task), und deren Plan. */
        string Kind = "mark", TaskPlan? Plan = null,

        /* 0099 — die Funktionen in ihren Terminen, und der Kalender des Termins (für den Editor). */
        IReadOnlyList<DutyRow>? Duties = null, Guid? CalendarId = null);

    /// <summary>0099 — eine Funktion in den Terminen einer Aufgabe; die Beschriftung versiegelt.</summary>
    private sealed record DutyRow(Guid Id, int Position, Guid AreaId, int Epoch, byte[] Label, int? Capacity);

    private static string? DayText(DateOnly? day) => day?.ToString("yyyy-MM-dd");

    private static object ToldStep(StepRow s) => new
    {
        stepId = Ids.ToText(s.Id),
        position = s.Position,
        areaId = Ids.ToText(s.AreaId),
        epoch = s.Epoch,
        labelSealed = Base64Url.Encode(s.Label),
        helpSealed = s.Help is null ? null : Base64Url.Encode(s.Help),
        doneBy = s.DoneBy,
        visibleToPerson = s.VisibleToPerson,
        dueAt = s.DueAt,
        kind = s.Kind,
        task = s.Plan is null ? null : new
        {
            startsOn = DayText(s.Plan.StartsOn),
            endsOn = DayText(s.Plan.EndsOn),
            schedule = s.Plan.Schedule,
            weekdays = s.Plan.Weekdays,
            atMinute = s.Plan.AtMinute,
            minutes = s.Plan.Minutes,
            needed = s.Plan.Needed,
            showFrom = DayText(s.Plan.ShowFrom),
            reportUntil = DayText(s.Plan.ReportUntil),

            /* 0099 — an Terminen eines Kalenders: welcher, ob vorher gefragt wird, die Termine, die Funktionen. */
            itemId = s.Plan.ItemId is { } item ? Ids.ToText(item) : null,
            calendarId = s.CalendarId is { } calendar ? Ids.ToText(calendar) : null,
            presence = s.Plan.Presence,
            dates = s.Plan.Dates?.Select(d => new { day = DayText(d.Day), startsAt = d.StartsAt, endsAt = d.EndsAt }),
            duties = (s.Duties ?? []).Select(d => new
            {
                dutyId = Ids.ToText(d.Id),
                position = d.Position,
                areaId = Ids.ToText(d.AreaId),
                epoch = d.Epoch,
                labelSealed = Base64Url.Encode(d.Label),
                capacity = d.Capacity
            })
        }
    };

    private static async Task<List<StepRow>> ReadStepsAsync(
        SqlConnection connection, Guid moduleId, bool personOnly, CancellationToken ct)
    {
        var steps = new List<StepRow>();

        await using var cmd = new SqlCommand($"""
            SELECT id, position, area_id, epoch, label_sealed, help_sealed, done_by, visible_to_person, due_at,
                   kind, starts_on, ends_on, schedule, weekdays, at_minute, minutes, needed, show_from, report_until,
                   item_id, presence
            FROM app.form_step
            WHERE module_id = @m {(personOnly ? "AND visible_to_person = 1" : "")}
            ORDER BY position;
            """, connection);
        cmd.Parameters.AddWithValue("@m", moduleId);

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                static DateOnly? Day(SqlDataReader r, int i) => r.IsDBNull(i) ? null : DateOnly.FromDateTime(r.GetDateTime(i));
                var kind = reader.GetString(9);
                var plan = kind == "task" && Day(reader, 10) is { } starts && Day(reader, 11) is { } ends
                    ? new TaskPlan(starts, ends, reader.GetString(12), Names.Int(reader, 13), Names.Int(reader, 14),
                        Names.Int(reader, 15), Names.Int(reader, 16), Day(reader, 17), Day(reader, 18),
                        reader.IsDBNull(19) ? null : reader.GetGuid(19), reader.GetBoolean(20), reader.GetString(6))
                    : null;

                steps.Add(new StepRow(
                    reader.GetGuid(0), reader.GetInt32(1), reader.GetGuid(2), reader.GetInt32(3),
                    (byte[])reader[4], reader.IsDBNull(5) ? null : (byte[])reader[5],
                    reader.GetString(6), reader.GetBoolean(7),
                    reader.IsDBNull(8) ? null : reader.GetDateTimeOffset(8),
                    kind, plan));
            }
        }

        /*
         * 0099 — AUFGABEN AN TERMINEN: die Termine aus dem Kalender (gerechnet,
         * nicht gespeichert — wird einer verschoben oder abgesagt, gilt das hier
         * gleich), der Kalender des Termins und die Funktionen darin.
         */
        if (!steps.Any(s => s.Plan is not null)) return steps;

        var duties = new Dictionary<Guid, List<DutyRow>>();
        await using (var cmd2 = new SqlCommand("""
            SELECT d.step_id, d.id, d.position, d.area_id, d.epoch, d.label_sealed, d.capacity
            FROM app.task_duty d JOIN app.form_step s ON s.id = d.step_id
            WHERE s.module_id = @m
            ORDER BY d.step_id, d.position;
            """, connection))
        {
            cmd2.Parameters.AddWithValue("@m", moduleId);
            await using var reader = await cmd2.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var step = reader.GetGuid(0);
                if (!duties.TryGetValue(step, out var list)) duties[step] = list = [];
                list.Add(new DutyRow(reader.GetGuid(1), reader.GetInt32(2), reader.GetGuid(3), reader.GetInt32(4),
                    (byte[])reader[5], reader.IsDBNull(6) ? null : reader.GetInt32(6)));
            }
        }

        for (var i = 0; i < steps.Count; i++)
        {
            var s = steps[i];
            if (s.Plan is null) continue;

            Guid? calendar = null;
            if (s.Plan.ItemId is { } item)
            {
                await using var cal = new SqlCommand("SELECT calendar_id FROM app.calendar_item WHERE id = @id;", connection);
                cal.Parameters.AddWithValue("@id", item);
                calendar = await cal.ExecuteScalarAsync(ct) is Guid found ? found : null;
            }

            steps[i] = s with
            {
                Plan = await WithDatesAsync(connection, s.Plan, ct),
                Duties = duties.TryGetValue(s.Id, out var own) ? own : null,
                CalendarId = calendar
            };
        }

        return steps;
    }

    /// <summary>Die Erweiterungen eines Formulars — Name, wer sie ausfuellt, ob sie offen sind.</summary>
    private static async Task<List<object>> ExtensionModulesAsync(
        SqlConnection connection, Guid moduleId, string? audience, CancellationToken ct)
    {
        var out_ = new List<object>();

        await using var cmd = new SqlCommand($"""
            SELECT id, name, audience, closed_at, created_at, repeat_kind, area_id, name_sealed, name_epoch,
                   (SELECT COUNT(*) FROM app.slug_field f WHERE f.part_id = module.id AND f.removed_at IS NULL)
            FROM app.module
            WHERE extends_id = @m {(audience is null ? "" : "AND audience = @audience")}
            ORDER BY created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@m", moduleId);
        if (audience is not null) cmd.Parameters.AddWithValue("@audience", audience);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            out_.Add(new
            {
                moduleId = Ids.ToText(reader.GetGuid(0)),

                /* 0097 — versiegelt unter dem Schlüssel seines Bereichs; offen nur ein alter, bis er versiegelt ist. */
                name = reader.IsDBNull(1) ? null : reader.GetString(1),
                areaId = reader.IsDBNull(6) ? null : Ids.ToText(reader.GetGuid(6)),
                nameSealed = Names.B64(reader, 7),
                nameEpoch = Names.Int(reader, 8),
                audience = reader.GetString(2),
                closed = !reader.IsDBNull(3),

                /* 0077 — wie oft sie je Mensch ausgefuellt wird. */
                repeat = reader.GetString(5),

                /* 0099 — ohne Fragen ist sie noch kein Schritt: es gibt nichts auszufuellen. */
                questions = reader.GetInt32(9)
            });
        }

        return out_;
    }

    /// <summary>
    /// Die Schritte eines Formulars — die von Hand angelegten, und die
    /// Erweiterungen, aus denen sich die uebrigen von selbst ergeben.
    /// </summary>
    private static async Task StepsAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        if (!await MaySeeSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var steps = await ReadStepsAsync(connection, sheet.ModuleId, personOnly: false, ctx.RequestAborted);
        var extensions = await ExtensionModulesAsync(connection, sheet.ModuleId, null, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(sheet.ModuleId),
            steps = steps.Select(ToldStep),
            extensions
        });
    }

    public sealed record StepIn(
        string StepId, string AreaId, int Epoch, string LabelSealed, string? HelpSealed,
        string DoneBy, bool VisibleToPerson, DateTimeOffset? DueAt,

        /* 0098 — eine Aufgabe mit Zeitraum (task) statt eines Znacznik (mark), und ihr Plan. */
        string? Kind = null, TaskIn? Task = null);

    public sealed record TaskIn(
        string? StartsOn, string? EndsOn, string? Schedule, int? Weekdays, int? AtMinute, int? Minutes, int? Needed,
        string? ShowFrom, string? ReportUntil,

        /* 0099 — an einem Termin eines Kalenders, vorher fragen, und die Funktionen darin. */
        string? ItemId = null, bool? Presence = null, IReadOnlyList<DutyIn>? Duties = null);

    /// <summary>0099 — eine Funktion: ihre Kennung, die Beschriftung (versiegelt wie die der Aufgabe), wie viele sie nehmen können.</summary>
    public sealed record DutyIn(string? DutyId, string? LabelSealed, int? Capacity);

    public sealed record StepsRequest(IReadOnlyList<StepIn>? Steps);

    /// <summary>
    /// DIE VON HAND ANGELEGTEN SCHRITTE — als Ganzes gespeichert, in dieser
    /// Reihenfolge. Was nicht mehr in der Liste steht, geht, und mit ihm, was
    /// daran abgehakt war.
    /// </summary>
    private static async Task SaveStepsAsync(HttpContext ctx, Db db, Guid id, StepsRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var given = body.Steps ?? [];

        if (given.Count > MaxSteps)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Najwyżej {MaxSteps} kroków.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var shape = await ShapeAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        if (shape?.ExtendsId is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Kroki należą do formularza, który się rozszerza — nie do rozszerzenia.");
            return;
        }

        if (sheet.AreaId is not Guid formArea)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Formularz nie ma własnego obszaru — kroki pieczętuje się jego kluczem.");
            return;
        }

        var parsed = new List<(Guid Id, int Epoch, byte[] Label, byte[]? Help, string DoneBy, bool Visible, DateTimeOffset? Due, TaskPlan? Plan,
            List<(Guid Id, byte[] Label, int? Capacity)> Duties)>();

        foreach (var one in given)
        {
            if (!Guid.TryParse(one.StepId, out var stepId) || !Guid.TryParse(one.AreaId, out var area)
                || area != formArea || one.Epoch < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Krok pieczętuje się kluczem obszaru formularza.");
                return;
            }

            var label = Optional(one.LabelSealed);
            if (label is null || label.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Krok bez nazwy.");
                return;
            }

            /* 0098 — eine Aufgabe: der Mensch sagt, was er damit macht; sie hat einen Zeitraum statt einer Frist. */
            TaskPlan? plan = null;
            if ((one.Kind ?? "mark").Trim().ToLowerInvariant() == "task")
            {
                var t = one.Task;
                var (read, problem) = ReadTaskPlan(t?.StartsOn, t?.EndsOn, t?.Schedule, t?.Weekdays, t?.AtMinute, t?.Minutes, t?.Needed,
                    t?.ShowFrom, t?.ReportUntil, t?.ItemId, t?.Presence == true, one.DoneBy);
                if (read is null)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, problem ?? "Nieczytelny plan zadania.");
                    return;
                }

                /*
                 * 0099 — AN EINEM TERMIN: wer die Aufgabe anlegt, muss den Kalender lesen
                 * (sonst könnte er Termine fremder Gruppen erfragen), und im Zeitraum
                 * müssen Termine liegen.
                 */
                if (read.ItemId is { } item)
                {
                    if (!await MayReadItemAsync(connection, who.Value.AccountId, item, ctx.RequestAborted))
                    {
                        await Fail(ctx, StatusCodes.Status404NotFound, "Tego terminu nie ma — albo nie widzisz jego kalendarza.");
                        return;
                    }

                    read = await WithDatesAsync(connection, read, ctx.RequestAborted);
                    if (DatesProblem(read) is { } none)
                    {
                        await Fail(ctx, StatusCodes.Status400BadRequest, none);
                        return;
                    }
                }

                var duties = new List<(Guid Id, byte[] Label, int? Capacity)>();
                foreach (var d in t?.Duties ?? [])
                {
                    var dutyLabel = Optional(d.LabelSealed);
                    if (!Guid.TryParse(d.DutyId, out var dutyId) || dutyLabel is null || dutyLabel.Length == 0
                        || d.Capacity is not (null or (>= 1 and <= 500)))
                    {
                        await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna funkcja (nazwa, ile osób: 1–500).");
                        return;
                    }
                    duties.Add((dutyId, dutyLabel, d.Capacity));
                }

                if (duties.Count > 0 && !read.Presence)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Funkcje wybiera się razem z „będę\" — włącz pytanie o obecność.");
                    return;
                }
                if (duties.Count > MaxDuties || duties.Select(d => d.Id).Distinct().Count() != duties.Count)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, $"Najwyżej {MaxDuties} funkcji, każda raz.");
                    return;
                }

                plan = read;
                parsed.Add((stepId, one.Epoch, label, Optional(one.HelpSealed), read.DoneBy, true, null, plan, duties));
                continue;
            }

            var doneBy = (one.DoneBy ?? string.Empty).Trim().ToLowerInvariant();
            if (doneBy is not ("office" or "person"))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Odhacza kancelaria (office) albo osoba (person).");
                return;
            }

            /* Was der Mensch abhaken soll, muss er sehen. */
            parsed.Add((stepId, one.Epoch, label, Optional(one.HelpSealed), doneBy,
                doneBy == "person" || one.VisibleToPerson, one.DueAt, null, []));
        }

        if (parsed.Select(p => p.Id).Distinct().Count() != parsed.Count)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Dwa kroki o tej samej kennung.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            var keep = parsed.Select(p => p.Id).ToList();
            var names = keep.Count == 0 ? "NULL" : string.Join(", ", keep.Select((_, i) => $"@k{i}"));

            await using (var drop = new SqlCommand($"""
                DELETE FROM app.step_mark
                 WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @m AND id NOT IN ({names}));
                DELETE FROM app.task_answer
                 WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @m AND id NOT IN ({names}));
                DELETE FROM app.task_day
                 WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @m AND id NOT IN ({names}));
                DELETE FROM app.task_presence
                 WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @m AND id NOT IN ({names}));
                DELETE FROM app.task_duty
                 WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @m AND id NOT IN ({names}));
                DELETE FROM app.form_step WHERE module_id = @m AND id NOT IN ({names});
                """, connection, tx))
            {
                drop.Parameters.AddWithValue("@m", sheet.ModuleId);
                for (var i = 0; i < keep.Count; i++) drop.Parameters.AddWithValue($"@k{i}", keep[i]);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            var position = 0;

            foreach (var one in parsed)
            {
                await using var save = new SqlCommand("""
                    IF EXISTS (SELECT 1 FROM app.form_step WHERE id = @id)
                        UPDATE app.form_step
                           SET position = @pos, area_id = @area, epoch = @epoch,
                               label_sealed = @label, help_sealed = @help,
                               done_by = @doneBy, visible_to_person = @visible, due_at = @due,
                               kind = @kind, starts_on = @starts, ends_on = @ends, schedule = @schedule, weekdays = @weekdays,
                               at_minute = @at, minutes = @minutes, needed = @needed, show_from = @showFrom, report_until = @reportUntil,
                               item_id = @item, presence = @presence
                         WHERE id = @id AND module_id = @m;
                    ELSE
                        INSERT INTO app.form_step
                            (id, module_id, position, area_id, epoch, label_sealed, help_sealed,
                             done_by, visible_to_person, due_at, created_at,
                             kind, starts_on, ends_on, schedule, weekdays, at_minute, minutes, needed, show_from, report_until,
                             item_id, presence)
                        VALUES (@id, @m, @pos, @area, @epoch, @label, @help, @doneBy, @visible, @due, @now,
                                @kind, @starts, @ends, @schedule, @weekdays, @at, @minutes, @needed, @showFrom, @reportUntil,
                                @item, @presence);

                    /* 0098 — Tage, die nach einem geänderten Plan nicht mehr dazugehören, gehen
                       (1900-01-01 war ein Montag: so ergibt sich das Bit des Wochentags ohne DATEFIRST). */
                    IF @kind = N'task'
                    BEGIN
                        DELETE FROM app.task_day
                         WHERE step_id = @id
                           AND (day < @starts OR day > @ends
                                OR (@schedule = N'weekly' AND (@weekdays & POWER(2, DATEDIFF(day, '19000101', day) % 7)) = 0));
                        /* 0100 — die Antworten je Tag ebenso. */
                        DELETE FROM app.task_presence
                         WHERE step_id = @id
                           AND (day < @starts OR day > @ends
                                OR (@schedule = N'weekly' AND (@weekdays & POWER(2, DATEDIFF(day, '19000101', day) % 7)) = 0));
                    END
                    ELSE
                    BEGIN
                        DELETE FROM app.task_day WHERE step_id = @id;
                        DELETE FROM app.task_answer WHERE step_id = @id;
                        DELETE FROM app.task_presence WHERE step_id = @id;
                        DELETE FROM app.task_duty WHERE step_id = @id;
                    END

                    /* 0099 — ohne Fragen vorher keine Funktionen (die Antworten je Tag bleiben — 0100: jede Aufgabe hat sie). */
                    IF @presence = 0
                        UPDATE app.task_presence SET duty_id = NULL WHERE step_id = @id AND duty_id IS NOT NULL;
                    """, connection, tx);

                var plan = one.Plan;
                object Day(DateOnly? d) => d is null ? DBNull.Value : d.Value.ToDateTime(TimeOnly.MinValue);
                save.Parameters.AddWithValue("@kind", plan is null ? "mark" : "task");
                save.Parameters.Add("@starts", System.Data.SqlDbType.Date).Value = Day(plan?.StartsOn);
                save.Parameters.Add("@ends", System.Data.SqlDbType.Date).Value = Day(plan?.EndsOn);
                save.Parameters.AddWithValue("@schedule", (object?)plan?.Schedule ?? DBNull.Value);
                save.Parameters.AddWithValue("@weekdays", (object?)plan?.Weekdays ?? DBNull.Value);
                save.Parameters.AddWithValue("@at", (object?)plan?.AtMinute ?? DBNull.Value);
                save.Parameters.AddWithValue("@minutes", (object?)plan?.Minutes ?? DBNull.Value);
                save.Parameters.AddWithValue("@needed", (object?)plan?.Needed ?? DBNull.Value);
                save.Parameters.Add("@showFrom", System.Data.SqlDbType.Date).Value = Day(plan?.ShowFrom);
                save.Parameters.Add("@reportUntil", System.Data.SqlDbType.Date).Value = Day(plan?.ReportUntil);
                save.Parameters.Add("@item", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)plan?.ItemId ?? DBNull.Value;
                save.Parameters.AddWithValue("@presence", plan?.Presence == true);

                save.Parameters.AddWithValue("@id", one.Id);
                save.Parameters.AddWithValue("@m", sheet.ModuleId);
                save.Parameters.AddWithValue("@pos", position++);
                save.Parameters.AddWithValue("@area", formArea);
                save.Parameters.AddWithValue("@epoch", one.Epoch);
                save.Parameters.AddBlob("@label", one.Label);
                save.Parameters.AddBlob("@help", one.Help);
                save.Parameters.AddWithValue("@doneBy", one.DoneBy);
                save.Parameters.AddWithValue("@visible", one.Visible);
                save.Parameters.AddWithValue("@due", (object?)one.Due ?? DBNull.Value);
                save.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

                await save.ExecuteNonQueryAsync(ctx.RequestAborted);

                if (plan is null) continue;

                /* 0099 — Tage, die nicht mehr unter den Terminen sind, gehen (auch ihre Antworten). */
                if (plan.Schedule == "item")
                {
                    var keepDays = (plan.Dates ?? []).Select(d => d.Day).ToList();
                    var dayNames = keepDays.Count == 0 ? "NULL" : string.Join(", ", keepDays.Select((_, i) => $"@d{i}"));
                    await using var stale = new SqlCommand($"""
                        DELETE FROM app.task_day WHERE step_id = @id AND day NOT IN ({dayNames});
                        DELETE FROM app.task_presence WHERE step_id = @id AND day NOT IN ({dayNames});
                        """, connection, tx);
                    stale.Parameters.AddWithValue("@id", one.Id);
                    for (var i = 0; i < keepDays.Count; i++)
                        stale.Parameters.Add($"@d{i}", System.Data.SqlDbType.Date).Value = keepDays[i].ToDateTime(TimeOnly.MinValue);
                    await stale.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                /* 0099 — die Funktionen: als Ganzes, in dieser Reihenfolge; wer eine verschwundene hatte, hat keine mehr. */
                var dutyIds = one.Duties.Select(d => d.Id).ToList();
                var dutyNames = dutyIds.Count == 0 ? "NULL" : string.Join(", ", dutyIds.Select((_, i) => $"@u{i}"));
                await using (var drop = new SqlCommand($"""
                    UPDATE app.task_presence SET duty_id = NULL WHERE step_id = @id AND duty_id IS NOT NULL AND duty_id NOT IN ({dutyNames});
                    DELETE FROM app.task_duty WHERE step_id = @id AND id NOT IN ({dutyNames});
                    """, connection, tx))
                {
                    drop.Parameters.AddWithValue("@id", one.Id);
                    for (var i = 0; i < dutyIds.Count; i++) drop.Parameters.AddWithValue($"@u{i}", dutyIds[i]);
                    await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                var place = 0;
                foreach (var duty in one.Duties)
                {
                    await using var put = new SqlCommand("""
                        IF EXISTS (SELECT 1 FROM app.task_duty WHERE id = @duty AND step_id <> @id)
                            THROW 50099, N'duty of another step', 1;
                        IF EXISTS (SELECT 1 FROM app.task_duty WHERE id = @duty)
                            UPDATE app.task_duty SET position = @pos, area_id = @area, epoch = @epoch, label_sealed = @label, capacity = @capacity
                             WHERE id = @duty;
                        ELSE
                            INSERT INTO app.task_duty (id, step_id, position, area_id, epoch, label_sealed, capacity)
                            VALUES (@duty, @id, @pos, @area, @epoch, @label, @capacity);
                        """, connection, tx);
                    put.Parameters.AddWithValue("@duty", duty.Id);
                    put.Parameters.AddWithValue("@id", one.Id);
                    put.Parameters.AddWithValue("@pos", place++);
                    put.Parameters.AddWithValue("@area", formArea);
                    put.Parameters.AddWithValue("@epoch", one.Epoch);
                    put.Parameters.AddBlob("@label", duty.Label);
                    put.Parameters.AddWithValue("@capacity", (object?)duty.Capacity ?? DBNull.Value);
                    await put.ExecuteNonQueryAsync(ctx.RequestAborted);
                }
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        var steps = await ReadStepsAsync(connection, sheet.ModuleId, personOnly: false, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { partId = Ids.ToText(sheet.ModuleId), steps = steps.Select(ToldStep) });
    }

    public sealed record MarkRequest(string StepId, bool Done);

    /// <summary>
    /// Einen Schritt abhaken — oder den Haken wieder wegnehmen. Die Kanzlei darf
    /// jeden Schritt ihrer Einsendungen abhaken, auch einen, den sonst der
    /// Mensch selbst abhakt (er hat es ihr auf Papier gegeben).
    /// </summary>
    private static async Task MarkAsync(HttpContext ctx, Db db, Guid id, MarkRequest body)
    {
        if (!Guid.TryParse(body.StepId, out var stepId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny krok.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        var done = await SetMarkAsync(connection, stepId, id, body.Done, byPerson: false,
            personOnly: false, seatId: null, ctx.RequestAborted);

        if (done is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego kroku nie ma przy tym zgłoszeniu.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { registrationId = Ids.ToText(id), stepId = Ids.ToText(stepId), doneAt = done.Value.At });
    }

    /// <summary>
    /// Den Haken setzen oder nehmen — fuer die Kanzlei und fuer den Menschen.
    ///
    /// <para>
    /// Der Schritt muss zu DEM Formular gehoeren, aus dem die Einsendung ist;
    /// beim Menschen ausserdem einer sein, den er selbst abhakt, und die
    /// Einsendung muss an seinem Platz haengen. <c>null</c> heisst: passt nicht.
    /// </para>
    /// </summary>
    internal static async Task<(DateTimeOffset? At, bool Ok)?> SetMarkAsync(
        SqlConnection connection, Guid stepId, Guid registrationId, bool done, bool byPerson,
        bool personOnly, Guid? seatId, CancellationToken ct)
    {
        await using (var check = new SqlCommand($"""
            SELECT COUNT(*)
            FROM app.form_step s
            JOIN app.registration r ON r.part_id = s.module_id
            WHERE s.id = @step AND r.id = @reg AND s.kind = N'mark'
              {(personOnly ? "AND s.done_by = N'person' AND r.access_id = @seat AND r.withdrawn_at IS NULL" : "")};
            """, connection))
        {
            check.Parameters.AddWithValue("@step", stepId);
            check.Parameters.AddWithValue("@reg", registrationId);
            if (personOnly) check.Parameters.AddWithValue("@seat", (object?)seatId ?? DBNull.Value);

            if ((int)(await check.ExecuteScalarAsync(ct) ?? 0) == 0) return null;
        }

        var now = DateTimeOffset.UtcNow;

        await using var cmd = new SqlCommand(done
            ? """
              IF NOT EXISTS (SELECT 1 FROM app.step_mark WHERE step_id = @step AND registration_id = @reg)
                  INSERT INTO app.step_mark (step_id, registration_id, done_at, by_role_id, by_person)
                  VALUES (@step, @reg, @now, NULL, @byPerson);
              """
            : "DELETE FROM app.step_mark WHERE step_id = @step AND registration_id = @reg;", connection);

        cmd.Parameters.AddWithValue("@step", stepId);
        cmd.Parameters.AddWithValue("@reg", registrationId);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@byPerson", byPerson);
        await cmd.ExecuteNonQueryAsync(ct);

        return (done ? now : null, true);
    }

    /* -- Was nur die Kanzlei ausfuellt ------------------------------------------------ */

    public sealed record EntryRequest(
        string? BaseRegistrationId, IReadOnlyList<ValueIn>? Values,

        /* 0077 — fuer welchen Zeitraum (bei einer wiederkehrenden Erweiterung): 2026-10, 2026-W40, … */
        string? Round = null);

    /// <summary>
    /// DIE KANZLEI TRAEGT EIN — zwei Faelle, ein Weg.
    ///
    /// <para>
    /// <b>Eine Erweiterung, fuer einen Menschen, zu seiner Einsendung</b> (0047).
    /// Eine Erweiterung „nur fuer den Koordinator" ist genau das: seine Notizen
    /// zu jedem Kandidaten. Die Werte gehen unter die Annahme ihres Bereichs wie
    /// jede Antwort; eine Huelle fuer den Platz gibt es NICHT — der Mensch sieht
    /// davon nichts. Fuellt die Kanzlei eine Erweiterung aus, die sonst der
    /// Mensch ausfuellt (er hat es auf Papier gebracht), darf sie die Huelle fuer
    /// seinen Platz mitschicken; dann liest er es wie seine eigene Angabe.
    /// Einmal je Mensch — und bei einer WIEDERKEHRENDEN (0077) einmal je Mensch
    /// und Zeitraum (<c>round</c>); danach berichtigt sie, wie jede Einsendung.
    /// </para>
    ///
    /// <para>
    /// <b>Einen Menschen selbst, in ein gewoehnliches Formular</b> (0077) — ohne
    /// <c>baseRegistrationId</c>. Wer am Telefon zusagt, auf einem Zettel steht
    /// oder gar nicht selbst handelt (ein Kranker, den der Priester besucht),
    /// kommt so auf die Liste: eine Einsendung ohne Platz, Rolle und Quittung
    /// (<c>by_office</c>). Das gilt auch fuer ein geschlossenes Formular — zu
    /// ist es fuer die, die sich selbst eintragen.
    /// </para>
    /// </summary>
    private static async Task EntryAsync(HttpContext ctx, Db db, Guid id, EntryRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        Guid? baseId = null;

        if (!string.IsNullOrWhiteSpace(body.BaseRegistrationId))
        {
            if (!Guid.TryParse(body.BaseRegistrationId, out var given))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zgłoszenie.");
                return;
            }

            baseId = given;
        }

        var values = body.Values ?? [];
        if (values.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Puste zgłoszenie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        id = sheet.ModuleId;

        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var shape = await ShapeAsync(connection, id, ctx.RequestAborted);
        if (shape is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego formularza nie ma.");
            return;
        }

        var extension = shape.Value.ExtendsId is not null;

        if (extension && baseId is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "To rozszerzenie — wpis należy do zgłoszenia, które uzupełnia.");
            return;
        }

        if (!extension && baseId is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Ten formularz niczego nie rozszerza.");
            return;
        }

        /* 0077 — der Zeitraum: seiner Art entsprechend, und nie aus der Zukunft. */
        var round = (body.Round ?? string.Empty).Trim();
        var now = DateTimeOffset.UtcNow;

        if (!Rounds.Valid(shape.Value.Repeat, round))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                shape.Value.Repeat == Rounds.Once
                    ? "Ten formularz wypełnia się raz — bez okresu."
                    : "Nieczytelny okres wpisu.");
            return;
        }

        if (!Rounds.NotAhead(shape.Value.Repeat, round, now))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten okres jeszcze się nie zaczął.");
            return;
        }

        Guid? access = null;

        if (baseId is not null)
        {
            await using (var find = new SqlCommand(
                "SELECT access_id FROM app.registration WHERE id = @base AND part_id = @part;", connection))
            {
                find.Parameters.AddWithValue("@base", baseId.Value);
                find.Parameters.AddWithValue("@part", shape.Value.ExtendsId!.Value);

                await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
                if (!await reader.ReadAsync(ctx.RequestAborted))
                {
                    await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma zgłoszenia, które to uzupełnia.");
                    return;
                }

                access = reader.IsDBNull(0) ? null : reader.GetGuid(0);
            }

            if (await ExtensionOfAsync(connection, id, baseId.Value, round, ctx.RequestAborted) is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "To jest już uzupełnione — popraw odpowiedzi.");
                return;
            }
        }

        var person = extension && shape.Value.Audience == "person";
        var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted);
        var known = fields.Select(f => f.Id).ToHashSet();
        var parsed = new List<(Guid Field, byte[] Sealed, byte[] Wrapped, byte[]? ForSeat)>();

        foreach (var one in values)
        {
            var sealedValue = Optional(one.Sealed);
            var wrapped = Optional(one.WrappedKey);

            if (!Guid.TryParse(one.FieldId, out var fieldId) || !known.Contains(fieldId)
                || sealedValue is null || sealedValue.Length == 0 || wrapped is null || wrapped.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna odpowiedź.");
                return;
            }

            /* 0093 — was nur der Mensch schreibt, traegt die Kanzlei auch nicht an seiner Stelle ein. */
            if (fields.First(f => f.Id == fieldId).PersonOnly)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, PersonOnlyWords);
                return;
            }

            /* Was nur die Kanzlei sieht, bekommt keine Huelle fuer den Platz. */
            parsed.Add((fieldId, sealedValue, wrapped, person && access is not null ? Optional(one.SeatKeySealed) : null));
        }

        var registrationId = Ids.NewId();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.registration (id, part_id, access_id, submitted_at, base_id, round_key, by_office)
                VALUES (@id, @part, @access, @now, @base, @round, @byOffice);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", registrationId);
                insert.Parameters.AddWithValue("@part", id);

                /* Nur was der Mensch sieht, haengt an seinem Platz. */
                insert.Parameters.AddWithValue("@access", person && access is not null ? access.Value : DBNull.Value);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@base", (object?)baseId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@round", round);
                insert.Parameters.AddWithValue("@byOffice", true);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (fieldId, sealedValue, wrapped, forSeat) in parsed)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.registration_value
                        (registration_id, field_id, value_sealed, wrapped_key, seat_key_sealed)
                    VALUES (@reg, @field, @value, @wrapped, @seat);
                    """, connection, tx);

                add.Parameters.AddWithValue("@reg", registrationId);
                add.Parameters.AddWithValue("@field", fieldId);
                add.Parameters.AddWithValue("@value", sealedValue);
                add.Parameters.AddWithValue("@wrapped", wrapped);
                add.Parameters.AddBlob("@seat", forSeat);
                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "To jest już uzupełnione — popraw odpowiedzi.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(registrationId),
            baseId = baseId is null ? null : Ids.ToText(baseId.Value),
            round
        });
    }

    /* -- Fuer den Platz: was zu tun ist ----------------------------------------------- */

    /// <summary>
    /// WAS DIESER MENSCH NOCH TUN MUSS — je Einsendung seines Platzes, die kein
    /// Zusatz ist: die Erweiterungen, die ER ausfuellt (erledigt oder nicht),
    /// und die Schritte, die er sieht, mit ihrem Haken.
    ///
    /// <para>
    /// Was nur die Kanzlei ausfuellt oder sieht, steht hier nicht — nicht einmal,
    /// dass es das gibt.
    /// </para>
    /// </summary>
    internal static async Task<List<object>> SeatFormsAsync(SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        var bases = new List<(Guid Id, Guid Part, DateTimeOffset? Confirmed)>();

        await using (var cmd = new SqlCommand("""
            SELECT r.id, r.part_id, r.confirmed_at
            FROM app.registration r
            JOIN app.module m ON m.id = r.part_id
            WHERE r.access_id = @seat AND r.base_id IS NULL AND m.extends_id IS NULL
              AND r.withdrawn_at IS NULL
            ORDER BY r.submitted_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@seat", seatId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                bases.Add((reader.GetGuid(0), reader.GetGuid(1),
                    reader.IsDBNull(2) ? null : reader.GetDateTimeOffset(2)));
            }
        }

        var out_ = new List<object>();

        foreach (var (registrationId, part, confirmed) in bases)
        {
            var extensions = new List<object>();

            await using (var cmd = new SqlCommand("""
                SELECT m.id, m.name, m.closed_at, x.id, m.repeat_kind, x.round_key, m.area_id, m.name_sealed, m.name_epoch,
                       (SELECT COUNT(*) FROM app.slug_field f WHERE f.part_id = m.id AND f.removed_at IS NULL)
                FROM app.module m
                OUTER APPLY (
                    /* 0077 — die juengste: bei einer wiederkehrenden die des letzten Zeitraums. */
                    SELECT TOP 1 r.id, r.round_key FROM app.registration r
                    WHERE r.part_id = m.id AND r.base_id = @reg
                    ORDER BY r.round_key DESC, r.submitted_at DESC
                ) x
                WHERE m.extends_id = @part AND m.audience = N'person'
                ORDER BY m.created_at;
                """, connection))
            {
                cmd.Parameters.AddWithValue("@part", part);
                cmd.Parameters.AddWithValue("@reg", registrationId);

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    extensions.Add(new
                    {
                        moduleId = Ids.ToText(reader.GetGuid(0)),

                        /* 0097 — der Mensch öffnet den Namen mit dem Schlüssel, mit dem er die Fragen öffnet. */
                        name = reader.IsDBNull(1) ? null : reader.GetString(1),
                        areaId = reader.IsDBNull(6) ? null : Ids.ToText(reader.GetGuid(6)),
                        nameSealed = Names.B64(reader, 7),
                        nameEpoch = Names.Int(reader, 8),
                        closed = !reader.IsDBNull(2),
                        registrationId = reader.IsDBNull(3) ? null : Ids.ToText(reader.GetGuid(3)),

                        /* 0077 — wie oft, und welchen Zeitraum die juengste Einsendung traegt. */
                        repeat = reader.GetString(4),
                        round = reader.IsDBNull(5) ? null : reader.GetString(5),

                        /* 0099 — ohne Fragen kein Schritt „Uzupełnij". */
                        questions = reader.GetInt32(9)
                    });
                }
            }

            var steps = await ReadStepsAsync(connection, part, personOnly: true, ct);

            /* 0098 — was er zu den Aufgaben gesagt hat, und an welchen Tagen er sie getan hat. */
            var tasks = await TasksOfAsync(connection, "@reg", c => c.Parameters.AddWithValue("@reg", registrationId), ct);

            /* 0099 — wie voll die Funktionen in den Terminen sind (nur Zahlen). */
            var taken = steps.Any(s => s.Duties is { Count: > 0 }) ? await DutiesTakenAsync(connection, part, ct) : [];

            /* Nur die Haken an Schritten, die er sieht — von den übrigen nicht einmal, dass es sie gibt. */
            var marks = new List<object>();
            await using (var cmd = new SqlCommand("""
                SELECT m.step_id, m.done_at, m.by_person
                FROM app.step_mark m
                JOIN app.form_step s ON s.id = m.step_id
                WHERE m.registration_id = @reg AND s.visible_to_person = 1;
                """, connection))
            {
                cmd.Parameters.AddWithValue("@reg", registrationId);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    marks.Add(new
                    {
                        stepId = Ids.ToText(reader.GetGuid(0)),
                        doneAt = reader.GetDateTimeOffset(1),
                        byPerson = reader.GetBoolean(2)
                    });
                }
            }

            out_.Add(new
            {
                formId = Ids.ToText(part),
                registrationId = Ids.ToText(registrationId),
                confirmedAt = confirmed,
                extensions,
                steps = steps.Select(ToldStep),
                marks,
                tasks = tasks.TryGetValue(registrationId, out var said) ? said : [],
                taken
            });
        }

        return out_;
    }

    /// <summary>
    /// Wer ein Formular SEHEN darf — wer es pflegt, oder wer einen der Bereiche
    /// liest, in die es schreibt. Dieselbe Regel wie fuer die Einsendungen.
    /// </summary>
    private static async Task<bool> MaySeeSheetAsync(
        SqlConnection connection, Guid accountId, Sheet sheet, CancellationToken ct)
    {
        if (await MayWriteSheetAsync(connection, accountId, sheet, ct)) return true;

        var fields = await ReadFieldsAsync(connection, sheet.ModuleId, ct, withRemoved: true);

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (await Area.MayAsync(connection, accountId, areaId, Capability.Read, ct)) return true;
        }

        return false;
    }
}
