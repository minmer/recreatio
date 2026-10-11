using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// ZADANIA DLA OSÓB (0098) — eine Aufgabe, die eine Zeit lang dasteht: „W
/// październiku różaniec, codziennie o 18:00", „W piątki października różaniec
/// po angielsku", „Obejrzyj film". Eine weitere Art von Schritt (form_step,
/// <c>kind = 'task'</c>); der Mensch sagt przyjmuję / pomijam / odmawiam und
/// trägt die Tage ein, an denen er es getan hat.
///
/// <para>
/// <b>Der Dienst prüft nur, was er prüfen kann:</b> dass ein Tag im Zeitraum
/// liegt und zum Plan passt, dass er nicht in der Zukunft liegt, und dass der
/// Mensch noch eintragen darf (<c>report_until</c>). Ob die Aufgabe erfüllt
/// ist (genug Tage), rechnet der Browser, wie bei den Schritten.
/// </para>
/// </summary>
public static partial class Form
{
    /// <summary>Ein Zeitraum länger als ein Jahr ist keine Aufgabe mehr, sondern ein Leben.</summary>
    private const int MaxTaskDays = 366;

    /// <summary>Der Plan einer Aufgabe — offen, denn danach wird geprüft.</summary>
    public sealed record TaskPlan(
        DateOnly StartsOn, DateOnly EndsOn, string Schedule, int? Weekdays,
        int? AtMinute, int? Minutes, int? Needed, DateOnly? ShowFrom, DateOnly? ReportUntil)
    {
        /// <summary>Bis wann eingetragen werden kann — ohne Angabe eine Woche nach dem Ende.</summary>
        public DateOnly ReportsUntil => ReportUntil ?? EndsOn.AddDays(7);
    }

    /// <summary>Wochentag als Bit: Mo 1, Di 2, Mi 4, Do 8, Fr 16, Sa 32, So 64.</summary>
    public static int WeekdayBit(DateOnly day) => 1 << (((int)day.DayOfWeek + 6) % 7);

    /// <summary>Gilt dieser Tag für den Plan — im Zeitraum, und (wöchentlich) an einem der Wochentage?</summary>
    public static bool TaskDay(TaskPlan plan, DateOnly day) =>
        day >= plan.StartsOn && day <= plan.EndsOn
        && (plan.Schedule != "weekly" || ((plan.Weekdays ?? 0) & WeekdayBit(day)) != 0);

    /// <summary>
    /// Den Plan aus dem, was der Browser schickt — oder warum nicht.
    /// </summary>
    public static (TaskPlan? Plan, string? Error) ReadTaskPlan(
        string? startsOn, string? endsOn, string? schedule, int? weekdays, int? atMinute, int? minutes, int? needed,
        string? showFrom, string? reportUntil)
    {
        static DateOnly? Day(string? text) =>
            DateOnly.TryParseExact((text ?? string.Empty).Trim(), "yyyy-MM-dd", out var d) ? d : null;

        var starts = Day(startsOn);
        var ends = Day(endsOn);
        if (starts is null || ends is null) return (null, "Zadanie potrzebuje okresu: od kiedy do kiedy.");
        if (ends < starts) return (null, "Koniec okresu jest przed jego początkiem.");
        if (ends.Value.DayNumber - starts.Value.DayNumber + 1 > MaxTaskDays) return (null, "Okres zadania: najwyżej rok.");

        var kind = (schedule ?? "any").Trim().ToLowerInvariant();
        if (kind is not ("any" or "daily" or "weekly")) return (null, "Kiedy: any (w dowolnym dniu), daily (codziennie) albo weekly (w wybrane dni tygodnia).");
        if (kind == "weekly" && weekdays is not (>= 1 and <= 127)) return (null, "Wybierz dni tygodnia.");
        if (atMinute is not null and (< 0 or > 1439)) return (null, "Nieczytelna godzina.");
        if (minutes is not null and (< 1 or > 1440)) return (null, "Czas trwania: od 1 minuty do doby.");
        if (needed is not null and (< 1 or > 400)) return (null, "Ile razy: od 1.");

        var plan = new TaskPlan(starts.Value, ends.Value, kind, kind == "weekly" ? weekdays : null,
            atMinute, minutes, needed, Day(showFrom), Day(reportUntil));

        if (plan.ShowFrom is { } from && from > plan.StartsOn) return (null, "„Widoczne od\" nie może być po początku okresu.");
        if (plan.ReportUntil is { } until && until < plan.EndsOn) return (null, "„Zaznaczać do\" nie może być przed końcem okresu.");

        var count = 0;
        for (var d = plan.StartsOn; d <= plan.EndsOn; d = d.AddDays(1)) if (TaskDay(plan, d)) count++;
        if (count == 0) return (null, "W tym okresie nie wypada żaden z wybranych dni.");
        if (plan.Needed is { } n && plan.Schedule != "any" && n > count) return (null, $"W tym okresie jest tylko {count} takich dni.");

        return (plan, null);
    }

    /// <summary>Heute, dort, wo die Pfarrei ist.</summary>
    private static DateOnly Today() =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zones.Of(Zones.Home)).DateTime);

    private static async Task<TaskPlan?> PlanOfAsync(SqlConnection connection, Guid stepId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT starts_on, ends_on, schedule, weekdays, at_minute, minutes, needed, show_from, report_until
            FROM app.form_step WHERE id = @id AND kind = N'task';
            """, connection);
        cmd.Parameters.AddWithValue("@id", stepId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        static DateOnly D(SqlDataReader r, int i) => DateOnly.FromDateTime(r.GetDateTime(i));
        return new TaskPlan(D(reader, 0), D(reader, 1), reader.GetString(2),
            Names.Int(reader, 3), Names.Int(reader, 4), Names.Int(reader, 5), Names.Int(reader, 6),
            reader.IsDBNull(7) ? null : D(reader, 7), reader.IsDBNull(8) ? null : D(reader, 8));
    }

    public sealed record TaskRequest(string? RegistrationId, string? StepId, string? Answer, IReadOnlyList<string>? Days);

    /// <summary>
    /// Was jemand zu einer Aufgabe sagt — und an welchen Tagen er sie getan hat.
    /// <c>Answer</c>: accepted, passed, refused, „none" (zurücknehmen) oder
    /// <c>null</c> (bleibt). <c>Days</c>: ALLE Tage (ersetzt), oder <c>null</c> (bleiben).
    /// Wer Tage einträgt, hat die Aufgabe angenommen.
    /// <c>null</c> heisst: passt nicht (fremd); sonst der Status und ein Grund.
    /// </summary>
    internal static async Task<(int Status, string? Error)?> SetTaskAsync(
        SqlConnection connection, Guid stepId, Guid registrationId, string? answer, IReadOnlyList<string>? days,
        bool byPerson, Guid? seatId, CancellationToken ct)
    {
        await using (var check = new SqlCommand($"""
            SELECT COUNT(*)
            FROM app.form_step s
            JOIN app.registration r ON r.part_id = s.module_id
            WHERE s.id = @step AND r.id = @reg AND s.kind = N'task' AND r.withdrawn_at IS NULL
              {(byPerson ? "AND r.access_id = @seat" : "")};
            """, connection))
        {
            check.Parameters.AddWithValue("@step", stepId);
            check.Parameters.AddWithValue("@reg", registrationId);
            if (byPerson) check.Parameters.AddWithValue("@seat", (object?)seatId ?? DBNull.Value);
            if ((int)(await check.ExecuteScalarAsync(ct) ?? 0) == 0) return null;
        }

        var plan = await PlanOfAsync(connection, stepId, ct);
        if (plan is null) return null;

        var wanted = (answer ?? string.Empty).Trim().ToLowerInvariant();
        if (answer is not null && wanted is not ("accepted" or "passed" or "refused" or "none"))
            return (400, "Odpowiedź: accepted, passed, refused albo none.");

        var today = Today();
        var chosen = new SortedSet<DateOnly>();

        if (days is not null)
        {
            if (days.Count > MaxTaskDays) return (400, "Za dużo dni.");
            foreach (var one in days)
            {
                if (!DateOnly.TryParseExact((one ?? string.Empty).Trim(), "yyyy-MM-dd", out var day)) return (400, "Nieczytelny dzień.");
                if (!TaskDay(plan, day)) return (400, $"Dzień {day:yyyy-MM-dd} nie należy do tego zadania.");
                if (day > today) return (409, "Dni z przyszłości jeszcze się nie zaznacza.");
                chosen.Add(day);
            }

            /* Der Mensch trägt bis `report_until` ein; die Kanzlei (er hat es ihr gesagt) auch danach. */
            if (byPerson && today > plan.ReportsUntil) return (409, "Na zaznaczanie dni tego zadania jest już za późno — powiedz o tym w kancelarii.");
        }

        if (byPerson && answer is not null && today > plan.ReportsUntil)
            return (409, "To zadanie już się skończyło.");

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);

        try
        {
            /* Tage eintragen heisst: angenommen. */
            if (days is not null && chosen.Count > 0 && answer is null) wanted = "accepted";

            if (wanted == "none")
            {
                await using var drop = new SqlCommand("DELETE FROM app.task_answer WHERE step_id = @step AND registration_id = @reg;", connection, tx);
                drop.Parameters.AddWithValue("@step", stepId);
                drop.Parameters.AddWithValue("@reg", registrationId);
                await drop.ExecuteNonQueryAsync(ct);
            }
            else if (wanted != "")
            {
                await using var set = new SqlCommand("""
                    UPDATE app.task_answer SET answer = @answer, answered_at = @now, by_person = @byPerson
                     WHERE step_id = @step AND registration_id = @reg AND answer <> @answer;
                    IF NOT EXISTS (SELECT 1 FROM app.task_answer WHERE step_id = @step AND registration_id = @reg)
                        INSERT INTO app.task_answer (step_id, registration_id, answer, answered_at, by_person)
                        VALUES (@step, @reg, @answer, @now, @byPerson);
                    """, connection, tx);
                set.Parameters.AddWithValue("@step", stepId);
                set.Parameters.AddWithValue("@reg", registrationId);
                set.Parameters.AddWithValue("@answer", wanted);
                set.Parameters.AddWithValue("@now", now);
                set.Parameters.AddWithValue("@byPerson", byPerson);
                await set.ExecuteNonQueryAsync(ct);
            }

            if (days is not null)
            {
                var names = chosen.Count == 0 ? "NULL" : string.Join(", ", chosen.Select((_, i) => $"@d{i}"));
                await using var sync = new SqlCommand($"""
                    DELETE FROM app.task_day WHERE step_id = @step AND registration_id = @reg AND day NOT IN ({names});
                    """, connection, tx);
                sync.Parameters.AddWithValue("@step", stepId);
                sync.Parameters.AddWithValue("@reg", registrationId);
                var i = 0;
                foreach (var day in chosen) sync.Parameters.AddWithValue($"@d{i++}", day.ToDateTime(TimeOnly.MinValue));
                await sync.ExecuteNonQueryAsync(ct);

                foreach (var day in chosen)
                {
                    await using var add = new SqlCommand("""
                        IF NOT EXISTS (SELECT 1 FROM app.task_day WHERE step_id = @step AND registration_id = @reg AND day = @day)
                            INSERT INTO app.task_day (step_id, registration_id, day, marked_at, by_person)
                            VALUES (@step, @reg, @day, @now, @byPerson);
                        """, connection, tx);
                    add.Parameters.AddWithValue("@step", stepId);
                    add.Parameters.AddWithValue("@reg", registrationId);
                    add.Parameters.AddWithValue("@day", day.ToDateTime(TimeOnly.MinValue));
                    add.Parameters.AddWithValue("@now", now);
                    add.Parameters.AddWithValue("@byPerson", byPerson);
                    await add.ExecuteNonQueryAsync(ct);
                }
            }

            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }

        return (200, null);
    }

    /// <summary>Die Kanzlei trägt für einen Menschen ein (er hat es ihr gesagt, oder sie hat ihn gesehen).</summary>
    private static async Task OfficeTaskAsync(HttpContext ctx, Db db, Guid id, TaskRequest body)
    {
        if (!Guid.TryParse(body.StepId, out var stepId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zadanie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayTendAsync(ctx, db, connection, id)) return;

        var done = await SetTaskAsync(connection, stepId, id, body.Answer, body.Days, byPerson: false, seatId: null, ctx.RequestAborted);
        if (done is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego zadania nie ma przy tym zgłoszeniu.");
            return;
        }
        if (done.Value.Error is { } error)
        {
            await Fail(ctx, done.Value.Status, error);
            return;
        }

        var state = await TasksOfAsync(connection, "@reg", cmd => cmd.Parameters.AddWithValue("@reg", id), ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { registrationId = Ids.ToText(id), tasks = state.TryGetValue(id, out var list) ? list : [] });
    }

    /// <summary>
    /// Je Einsendung: was der Mensch zu jeder Aufgabe gesagt hat und an welchen
    /// Tagen er sie getan hat. <paramref name="registrationIdsSql"/> nennt die
    /// Einsendungen (eine Unterabfrage oder ein Parameter).
    /// </summary>
    internal static async Task<Dictionary<Guid, List<object>>> TasksOfAsync(
        SqlConnection connection, string registrationIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        var answers = new Dictionary<(Guid Reg, Guid Step), (string? Answer, DateTimeOffset? At, bool ByPerson)>();
        var days = new Dictionary<(Guid Reg, Guid Step), List<string>>();

        await using (var cmd = new SqlCommand($"""
            SELECT registration_id, step_id, answer, answered_at, by_person
            FROM app.task_answer WHERE registration_id IN ({registrationIdsSql});
            """, connection))
        {
            bind(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                answers[(reader.GetGuid(0), reader.GetGuid(1))] = (reader.GetString(2), reader.GetDateTimeOffset(3), reader.GetBoolean(4));
        }

        await using (var cmd = new SqlCommand($"""
            SELECT registration_id, step_id, day
            FROM app.task_day WHERE registration_id IN ({registrationIdsSql})
            ORDER BY day;
            """, connection))
        {
            bind(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var key = (reader.GetGuid(0), reader.GetGuid(1));
                if (!days.TryGetValue(key, out var list)) days[key] = list = [];
                list.Add(DateOnly.FromDateTime(reader.GetDateTime(2)).ToString("yyyy-MM-dd"));
            }
        }

        var out_ = new Dictionary<Guid, List<object>>();
        foreach (var key in answers.Keys.Union(days.Keys))
        {
            if (!out_.TryGetValue(key.Item1, out var list)) out_[key.Item1] = list = [];
            var said = answers.TryGetValue(key, out var a) ? a : (null, null, false);
            list.Add(new
            {
                stepId = Ids.ToText(key.Item2),
                answer = said.Answer,
                answeredAt = said.At,
                byPerson = said.ByPerson,
                days = days.TryGetValue(key, out var d) ? d : []
            });
        }

        return out_;
    }
}
