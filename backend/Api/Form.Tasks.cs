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
/// <b>0099 — ZAPROSZENIA:</b> statt eines eigenen Plans die TERMINE eines
/// Kalenders (<c>schedule = 'item'</c>): eine Reihe von Treffen, ein Fest, das
/// Nabożeństwo der Pfarrei. Vor jedem Termin sagt der Mensch będę / jeszcze
/// nie wiem / nie będę (<c>presence</c>) und wählt, wenn es welche gibt, eine
/// FUNKTION darin (die Ministranten beim Fest: krzyż, świece, kadzidło);
/// danach steht, ob er da war — eingetragen von ihm selbst oder von der
/// Kanzlei nach der Liste (<c>done_by</c>).
/// </para>
///
/// <para>
/// <b>Der Dienst prüft nur, was er prüfen kann:</b> dass ein Tag zum Plan (zu
/// den Terminen) gehört, dass er nicht in der Zukunft liegt, dass der Mensch
/// noch antworten oder eintragen darf, und dass eine Funktion nicht voller
/// wird, als sie ist. Ob die Aufgabe erfüllt ist (genug Tage), rechnet der
/// Browser, wie bei den Schritten.
/// </para>
/// </summary>
public static partial class Form
{
    /// <summary>Ein Zeitraum länger als ein Jahr ist keine Aufgabe mehr, sondern ein Leben.</summary>
    private const int MaxTaskDays = 366;

    /// <summary>Wie viele Funktionen ein Termin haben kann.</summary>
    private const int MaxDuties = 30;

    /// <summary>0099 — ein Termin, an dem die Aufgabe gilt: sein Tag (dort, wo der Kalender ist), Beginn und Ende.</summary>
    public sealed record TaskDate(DateOnly Day, DateTimeOffset StartsAt, DateTimeOffset EndsAt);

    /// <summary>Der Plan einer Aufgabe — offen, denn danach wird geprüft.</summary>
    public sealed record TaskPlan(
        DateOnly StartsOn, DateOnly EndsOn, string Schedule, int? Weekdays,
        int? AtMinute, int? Minutes, int? Needed, DateOnly? ShowFrom, DateOnly? ReportUntil,

        /* 0099 — an Terminen eines Kalenders: welcher, ob vorher gefragt wird, wer die Teilnahme
           einträgt, und die Termine selbst (aus dem Kalender gerechnet, nicht gespeichert). */
        Guid? ItemId = null, bool Presence = false, string DoneBy = "person", IReadOnlyList<TaskDate>? Dates = null)
    {
        /// <summary>Bis wann eingetragen werden kann — ohne Angabe eine Woche nach dem Ende.</summary>
        public DateOnly ReportsUntil => ReportUntil ?? EndsOn.AddDays(7);
    }

    /// <summary>Wochentag als Bit: Mo 1, Di 2, Mi 4, Do 8, Fr 16, Sa 32, So 64.</summary>
    public static int WeekdayBit(DateOnly day) => 1 << (((int)day.DayOfWeek + 6) % 7);

    /// <summary>Gilt dieser Tag für den Plan — im Zeitraum, (wöchentlich) an einem der Wochentage, (0099) an einem der Termine?</summary>
    public static bool TaskDay(TaskPlan plan, DateOnly day) =>
        day >= plan.StartsOn && day <= plan.EndsOn
        && (plan.Schedule != "weekly" || ((plan.Weekdays ?? 0) & WeekdayBit(day)) != 0)
        && (plan.Schedule != "item" || (plan.Dates ?? []).Any(d => d.Day == day));

    /// <summary>
    /// Den Plan aus dem, was der Browser schickt — oder warum nicht. Bei Terminen
    /// (<c>item</c>) prüft der Aufrufer danach, ob im Zeitraum welche liegen.
    /// </summary>
    public static (TaskPlan? Plan, string? Error) ReadTaskPlan(
        string? startsOn, string? endsOn, string? schedule, int? weekdays, int? atMinute, int? minutes, int? needed,
        string? showFrom, string? reportUntil, string? itemId = null, bool presence = false, string? doneBy = null)
    {
        static DateOnly? Day(string? text) =>
            DateOnly.TryParseExact((text ?? string.Empty).Trim(), "yyyy-MM-dd", out var d) ? d : null;

        var starts = Day(startsOn);
        var ends = Day(endsOn);
        if (starts is null || ends is null) return (null, "Zadanie potrzebuje okresu: od kiedy do kiedy.");
        if (ends < starts) return (null, "Koniec okresu jest przed jego początkiem.");
        if (ends.Value.DayNumber - starts.Value.DayNumber + 1 > MaxTaskDays) return (null, "Okres zadania: najwyżej rok.");

        var kind = (schedule ?? "any").Trim().ToLowerInvariant();
        if (kind is not ("any" or "daily" or "weekly" or "item"))
            return (null, "Kiedy: any (w dowolnym dniu), daily (codziennie), weekly (w wybrane dni tygodnia) albo item (terminy z kalendarza).");
        if (kind == "weekly" && weekdays is not (>= 1 and <= 127)) return (null, "Wybierz dni tygodnia.");
        if (atMinute is not null and (< 0 or > 1439)) return (null, "Nieczytelna godzina.");
        if (minutes is not null and (< 1 or > 1440)) return (null, "Czas trwania: od 1 minuty do doby.");
        if (needed is not null and (< 1 or > 400)) return (null, "Ile razy: od 1.");

        Guid? item = null;
        if (kind == "item")
        {
            if (!Guid.TryParse(itemId, out var found)) return (null, "Wybierz termin z kalendarza.");
            item = found;
        }
        if (presence && kind != "item") return (null, "O obecność pyta się tylko przy terminach z kalendarza.");

        var by = (doneBy ?? "person").Trim().ToLowerInvariant();
        if (by is not ("person" or "office")) return (null, "Wykonanie zaznacza osoba (person) albo kancelaria (office).");

        var plan = new TaskPlan(starts.Value, ends.Value, kind, kind == "weekly" ? weekdays : null,
            kind == "item" ? null : atMinute, kind == "item" ? null : minutes, needed, Day(showFrom), Day(reportUntil),
            item, presence, by);

        if (plan.ShowFrom is { } from && from > plan.StartsOn) return (null, "„Widoczne od\" nie może być po początku okresu.");
        if (plan.ReportUntil is { } until && until < plan.EndsOn) return (null, "„Zaznaczać do\" nie może być przed końcem okresu.");

        if (kind != "item")
        {
            var count = 0;
            for (var d = plan.StartsOn; d <= plan.EndsOn; d = d.AddDays(1)) if (TaskDay(plan, d)) count++;
            if (count == 0) return (null, "W tym okresie nie wypada żaden z wybranych dni.");
            if (plan.Needed is { } n && plan.Schedule != "any" && n > count) return (null, $"W tym okresie jest tylko {count} takich dni.");
        }

        return (plan, null);
    }

    /// <summary>0099 — die Termine sind bekannt: liegt im Zeitraum einer, und reicht ihre Zahl für „ile razy"?</summary>
    public static string? DatesProblem(TaskPlan plan) =>
        (plan.Dates ?? []).Count == 0 ? "W tym okresie ten termin się nie odbywa — wybierz inny okres albo inny termin."
        : plan.Needed is { } n && n > plan.Dates!.Count ? $"W tym okresie {TermsText(plan.Dates!.Count)} — mniej, niż potrzeba."
        : null;

    /// <summary>„jest tylko 1 termin", „są tylko 3 terminy", „jest tylko 5 terminów".</summary>
    private static string TermsText(int n) =>
        n == 1 ? "jest tylko 1 termin"
        : n % 10 is >= 2 and <= 4 && n % 100 is < 12 or > 14 ? $"są tylko {n} terminy"
        : $"jest tylko {n} terminów";

    /// <summary>Heute, dort, wo die Pfarrei ist.</summary>
    private static DateOnly Today() =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zones.Of(Zones.Home)).DateTime);

    /// <summary>
    /// 0099 — DIE TERMINE eines Kalendereintrags im Zeitraum: wie der Kalender
    /// sie rechnet (dieselbe Reihe, dieselben Ausnahmen wie die Buchungen),
    /// verschoben, wo verschoben, ohne die abgesagten. Ein Tag je Termin — der
    /// Tag, an dem er tatsächlich beginnt, dort, wo der Kalender ist. Gibt es
    /// den Eintrag nicht mehr, gibt es keine Termine.
    /// </summary>
    internal static async Task<List<TaskDate>> ItemDatesAsync(
        SqlConnection connection, Guid itemId, DateOnly startsOn, DateOnly endsOn, CancellationToken ct)
    {
        var dates = new List<TaskDate>();
        DateTimeOffset first, last;
        string repeat, zoneName;
        int every;
        int? weekdays, count;
        DateTimeOffset? until;

        await using (var cmd = new SqlCommand("""
            SELECT i.starts_at, i.ends_at, i.repeat_kind, i.repeat_every, i.repeat_weekdays, i.repeat_until, i.repeat_count,
                   i.status, c.time_zone
            FROM app.calendar_item i
            JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", itemId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct) || reader.GetString(7) == "cancelled") return dates;

            first = reader.GetDateTimeOffset(0);
            last = reader.GetDateTimeOffset(1);
            repeat = reader.GetString(2);
            every = reader.GetInt32(3);
            weekdays = reader.IsDBNull(4) ? null : reader.GetByte(4);
            until = reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5);
            count = reader.IsDBNull(6) ? null : reader.GetInt32(6);
            zoneName = reader.IsDBNull(8) ? Zones.Home : reader.GetString(8);
        }

        var zone = Zones.Of(zoneName);
        var span = last - first;

        /* Ein Monat Rand auf beiden Seiten: ein verschobener Termin kann hinein- oder hinauswandern. */
        var from = Zones.AtLocal(startsOn.AddDays(-31).ToDateTime(TimeOnly.MinValue), zone);
        var to = Zones.AtLocal(endsOn.AddDays(32).ToDateTime(TimeOnly.MinValue), zone);
        var exceptions = await Calendar.ExceptionsAsync(connection, [itemId], ct);

        foreach (var at in Calendar.Occurrences(first, repeat, every, weekdays, until, count, from, to, zone))
        {
            var starts = at;
            if (exceptions.TryGetValue((itemId, at), out var exception))
            {
                if (exception.Cancelled) continue;
                if (exception.MovedTo is not null) starts = exception.MovedTo.Value;
            }

            var day = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(starts, zone).DateTime);
            if (day < startsOn || day > endsOn || dates.Any(d => d.Day == day)) continue;
            dates.Add(new TaskDate(day, starts, starts + span));
        }

        dates.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));
        return dates;
    }

    /// <summary>
    /// 0099 — darf dieses Konto den Termin sehen: liest es den Bereich seines
    /// Kalenders oder den, für den der Termin sichtbar ist?
    /// </summary>
    private static async Task<bool> MayReadItemAsync(SqlConnection connection, Guid accountId, Guid itemId, CancellationToken ct)
    {
        var areas = new List<Guid>();
        await using (var cmd = new SqlCommand("""
            SELECT c.area_id, i.visibility_area_id
            FROM app.calendar_item i JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", itemId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return false;
            if (!reader.IsDBNull(0)) areas.Add(reader.GetGuid(0));
            if (!reader.IsDBNull(1)) areas.Add(reader.GetGuid(1));
        }

        foreach (var area in areas)
            if (await Area.MayAsync(connection, accountId, area, Capability.Read, ct)) return true;
        return false;
    }

    /// <summary>Gibt der Plan Termine an, holt sie — sonst bleibt er, wie er ist.</summary>
    internal static async Task<TaskPlan> WithDatesAsync(SqlConnection connection, TaskPlan plan, CancellationToken ct) =>
        plan.Schedule == "item" && plan.ItemId is { } item
            ? plan with { Dates = await ItemDatesAsync(connection, item, plan.StartsOn, plan.EndsOn, ct) }
            : plan;

    private static async Task<TaskPlan?> PlanOfAsync(SqlConnection connection, Guid stepId, CancellationToken ct)
    {
        TaskPlan plan;
        await using (var cmd = new SqlCommand("""
            SELECT starts_on, ends_on, schedule, weekdays, at_minute, minutes, needed, show_from, report_until,
                   item_id, presence, done_by
            FROM app.form_step WHERE id = @id AND kind = N'task';
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", stepId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;

            static DateOnly D(SqlDataReader r, int i) => DateOnly.FromDateTime(r.GetDateTime(i));
            plan = new TaskPlan(D(reader, 0), D(reader, 1), reader.GetString(2),
                Names.Int(reader, 3), Names.Int(reader, 4), Names.Int(reader, 5), Names.Int(reader, 6),
                reader.IsDBNull(7) ? null : D(reader, 7), reader.IsDBNull(8) ? null : D(reader, 8),
                reader.IsDBNull(9) ? null : reader.GetGuid(9), reader.GetBoolean(10), reader.GetString(11));
        }

        return await WithDatesAsync(connection, plan, ct);
    }

    /// <summary>Gehört die Aufgabe zu dieser Einsendung — und (beim Menschen) die Einsendung zu seinem Platz?</summary>
    private static async Task<bool> TaskOfAsync(
        SqlConnection connection, Guid stepId, Guid registrationId, bool byPerson, Guid? seatId, CancellationToken ct)
    {
        await using var check = new SqlCommand($"""
            SELECT COUNT(*)
            FROM app.form_step s
            JOIN app.registration r ON r.part_id = s.module_id
            WHERE s.id = @step AND r.id = @reg AND s.kind = N'task' AND r.withdrawn_at IS NULL
              {(byPerson ? "AND r.access_id = @seat" : "")};
            """, connection);
        check.Parameters.AddWithValue("@step", stepId);
        check.Parameters.AddWithValue("@reg", registrationId);
        if (byPerson) check.Parameters.AddWithValue("@seat", (object?)seatId ?? DBNull.Value);
        return (int)(await check.ExecuteScalarAsync(ct) ?? 0) > 0;
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
        if (!await TaskOfAsync(connection, stepId, registrationId, byPerson, seatId, ct)) return null;

        var plan = await PlanOfAsync(connection, stepId, ct);
        if (plan is null) return null;

        var wanted = (answer ?? string.Empty).Trim().ToLowerInvariant();
        if (answer is not null && wanted is not ("accepted" or "passed" or "refused" or "none"))
            return (400, "Odpowiedź: accepted, passed, refused albo none.");

        /* 0099 — trägt die Kanzlei die Teilnahme ein (nach der Liste), trägt der Mensch sie nicht selbst ein. */
        if (byPerson && days is not null && plan.DoneBy == "office")
            return (403, "Obecność zaznacza kancelaria.");

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

    /* -- 0099: ein Termin — będę / nie wiem / nie będę, die Funktion, und ob er da war ------------- */

    /// <summary>
    /// <c>Answer</c>: yes, maybe, no, „none" (zurücknehmen) oder <c>null</c> (bleibt).
    /// <c>DutyId</c>: eine Funktion, „" (keine) oder <c>null</c> (bleibt).
    /// <c>Attendance</c>: present, absent, excused, „none" oder <c>null</c> (bleibt).
    /// </summary>
    public sealed record PresenceRequest(
        string? RegistrationId, string? StepId, string? Day, string? Answer, string? DutyId, string? Attendance);

    internal static async Task<(int Status, string? Error)?> SetPresenceAsync(
        SqlConnection connection, Guid stepId, Guid registrationId, PresenceRequest body,
        bool byPerson, Guid? seatId, CancellationToken ct)
    {
        if (!await TaskOfAsync(connection, stepId, registrationId, byPerson, seatId, ct)) return null;

        var plan = await PlanOfAsync(connection, stepId, ct);
        if (plan is null) return null;

        /*
         * 0100 — JEDE AUFGABE nimmt Antworten je Tag (der Kalender auf ihrer Karte):
         * bei Terminen ihre Termine, sonst die Tage ihres Plans — ein solcher Tag
         * beginnt um Mitternacht, dort, wo die Pfarrei ist.
         */
        if (!DateOnly.TryParseExact((body.Day ?? string.Empty).Trim(), "yyyy-MM-dd", out var day)) return (400, "Nieczytelny dzień.");
        var date = plan.Schedule == "item"
            ? (plan.Dates ?? []).FirstOrDefault(d => d.Day == day)
            : TaskDay(plan, day)
                ? new TaskDate(day, Zones.AtLocal(day.ToDateTime(TimeOnly.MinValue), Zones.Of(Zones.Home)),
                    Zones.AtLocal(day.AddDays(1).ToDateTime(TimeOnly.MinValue), Zones.Of(Zones.Home)))
                : null;
        if (date is null) return (400, plan.Schedule == "item" ? "Tego terminu nie ma w tym zadaniu." : $"Dzień {day:yyyy-MM-dd} nie należy do tego zadania.");

        var answer = body.Answer?.Trim().ToLowerInvariant();
        if (answer is not (null or "yes" or "maybe" or "no" or "none")) return (400, "Odpowiedź: yes, maybe, no albo none.");

        Guid? duty = null;
        var dutyGiven = body.DutyId is not null;
        if (dutyGiven && body.DutyId!.Trim() != "")
        {
            if (!Guid.TryParse(body.DutyId, out var parsed)) return (400, "Nieczytelna funkcja.");
            duty = parsed;
        }

        var attendance = body.Attendance?.Trim().ToLowerInvariant();
        if (attendance is not (null or "present" or "absent" or "excused" or "none")) return (400, "Obecność: present, absent, excused albo none.");

        var now = DateTimeOffset.UtcNow;

        if (dutyGiven && !plan.Presence) return (400, "Funkcje są tylko przy terminach z pytaniem o obecność.");

        if (answer is not null || dutyGiven)
        {
            /* Termine mit Fragen vorher: der Mensch sagt es bis zum Beginn; dann nur noch die Kanzlei. */
            if (byPerson && plan.Presence && now >= date.StartsAt) return (409, "Ten termin już się zaczął — odpowiedź zmienia już tylko kancelaria.");

            /* Sonst bis „zaznaczać do" — wie die Tage. */
            if (byPerson && !plan.Presence && Today() > plan.ReportsUntil) return (409, "To zadanie już się skończyło — powiedz o tym w kancelarii.");
        }

        if (attendance is not null)
        {
            if (date.StartsAt > now && date.Day > Today()) return (409, "Obecność zaznacza się w dniu terminu albo po nim.");

            if (byPerson)
            {
                if (plan.DoneBy != "person") return (403, "Obecność zaznacza kancelaria.");
                if (attendance is not ("present" or "none")) return (400, "Możesz zaznaczyć tylko swoją obecność.");
                if (Today() > plan.ReportsUntil) return (409, "Na zaznaczanie jest już za późno — powiedz o tym w kancelarii.");
            }
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);

        try
        {
            string? had = null, absence = null;
            Guid? hadDuty = null;
            var exists = false;

            await using (var read = new SqlCommand("""
                SELECT answer, duty_id, absence FROM app.task_presence WITH (UPDLOCK, HOLDLOCK)
                WHERE step_id = @step AND registration_id = @reg AND day = @day;
                """, connection, tx))
            {
                read.Parameters.AddWithValue("@step", stepId);
                read.Parameters.AddWithValue("@reg", registrationId);
                read.Parameters.AddWithValue("@day", day.ToDateTime(TimeOnly.MinValue));
                await using var reader = await read.ExecuteReaderAsync(ct);
                if (await reader.ReadAsync(ct))
                {
                    exists = true;
                    had = reader.IsDBNull(0) ? null : reader.GetString(0);
                    hadDuty = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                    absence = reader.IsDBNull(2) ? null : reader.GetString(2);
                }
            }

            var newAnswer = answer switch { null => had, "none" => null, _ => answer };
            var newDuty = dutyGiven ? duty : hadDuty;
            if (newAnswer != "yes") newDuty = null;

            /* Die Funktion: gibt es sie in dieser Aufgabe — und ist darin noch Platz? */
            if (newDuty is { } wantedDuty && wantedDuty != hadDuty)
            {
                int? capacity = null;
                var known = false;
                await using (var cap = new SqlCommand("SELECT capacity FROM app.task_duty WHERE id = @duty AND step_id = @step;", connection, tx))
                {
                    cap.Parameters.AddWithValue("@duty", wantedDuty);
                    cap.Parameters.AddWithValue("@step", stepId);
                    await using var reader = await cap.ExecuteReaderAsync(ct);
                    if (await reader.ReadAsync(ct))
                    {
                        known = true;
                        capacity = reader.IsDBNull(0) ? null : reader.GetInt32(0);
                    }
                }

                if (!known)
                {
                    await tx.RollbackAsync(ct);
                    return (400, "Takiej funkcji nie ma w tym terminie.");
                }

                if (capacity is { } room)
                {
                    await using var taken = new SqlCommand("""
                        SELECT COUNT(*) FROM app.task_presence WITH (UPDLOCK, HOLDLOCK)
                        WHERE step_id = @step AND day = @day AND duty_id = @duty AND answer = N'yes' AND registration_id <> @reg;
                        """, connection, tx);
                    taken.Parameters.AddWithValue("@step", stepId);
                    taken.Parameters.AddWithValue("@day", day.ToDateTime(TimeOnly.MinValue));
                    taken.Parameters.AddWithValue("@duty", wantedDuty);
                    taken.Parameters.AddWithValue("@reg", registrationId);
                    if ((int)(await taken.ExecuteScalarAsync(ct) ?? 0) >= room)
                    {
                        await tx.RollbackAsync(ct);
                        return (409, "Ta funkcja jest już zajęta — wybierz inną.");
                    }
                }
            }

            /* Da gewesen: eine Zeile in task_day (danach zählt die Aufgabe); nicht da: absent / excused hier. */
            var newAbsence = attendance switch { null => absence, "absent" => "absent", "excused" => "excused", _ => null };

            if (attendance is not null)
            {
                await using var mark = new SqlCommand(attendance == "present"
                    ? """
                      IF NOT EXISTS (SELECT 1 FROM app.task_day WHERE step_id = @step AND registration_id = @reg AND day = @day)
                          INSERT INTO app.task_day (step_id, registration_id, day, marked_at, by_person)
                          VALUES (@step, @reg, @day, @now, @byPerson);
                      """
                    : "DELETE FROM app.task_day WHERE step_id = @step AND registration_id = @reg AND day = @day;", connection, tx);
                mark.Parameters.AddWithValue("@step", stepId);
                mark.Parameters.AddWithValue("@reg", registrationId);
                mark.Parameters.AddWithValue("@day", day.ToDateTime(TimeOnly.MinValue));
                mark.Parameters.AddWithValue("@now", now);
                mark.Parameters.AddWithValue("@byPerson", byPerson);
                await mark.ExecuteNonQueryAsync(ct);
            }

            var changed = newAnswer != had || newDuty != hadDuty || newAbsence != absence;
            if (changed)
            {
                await using var write = new SqlCommand(newAnswer is null && newAbsence is null
                    ? "DELETE FROM app.task_presence WHERE step_id = @step AND registration_id = @reg AND day = @day;"
                    : exists
                        ? """
                          UPDATE app.task_presence SET answer = @answer, duty_id = @duty, absence = @absence,
                                 answered_at = @now, by_person = @byPerson
                           WHERE step_id = @step AND registration_id = @reg AND day = @day;
                          """
                        : """
                          INSERT INTO app.task_presence (step_id, registration_id, day, answer, duty_id, absence, answered_at, by_person)
                          VALUES (@step, @reg, @day, @answer, @duty, @absence, @now, @byPerson);
                          """, connection, tx);
                write.Parameters.AddWithValue("@step", stepId);
                write.Parameters.AddWithValue("@reg", registrationId);
                write.Parameters.AddWithValue("@day", day.ToDateTime(TimeOnly.MinValue));
                write.Parameters.AddWithValue("@answer", (object?)newAnswer ?? DBNull.Value);
                write.Parameters.AddWithValue("@duty", (object?)newDuty ?? DBNull.Value);
                write.Parameters.AddWithValue("@absence", (object?)newAbsence ?? DBNull.Value);
                write.Parameters.AddWithValue("@now", now);
                write.Parameters.AddWithValue("@byPerson", byPerson);
                await write.ExecuteNonQueryAsync(ct);
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
        await WriteOfficeTaskAsync(ctx, connection, id, done);
    }

    /// <summary>0099 — die Kanzlei: będę / nie wiem / nie będę, die Funktion, und die Liste (da / nicht da / entschuldigt).</summary>
    private static async Task OfficePresenceAsync(HttpContext ctx, Db db, Guid id, PresenceRequest body)
    {
        if (!Guid.TryParse(body.StepId, out var stepId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zadanie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayTendAsync(ctx, db, connection, id)) return;

        var done = await SetPresenceAsync(connection, stepId, id, body, byPerson: false, seatId: null, ctx.RequestAborted);
        await WriteOfficeTaskAsync(ctx, connection, id, done);
    }

    private static async Task WriteOfficeTaskAsync(HttpContext ctx, SqlConnection connection, Guid id, (int Status, string? Error)? done)
    {
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
    /// Je Einsendung: was der Mensch zu jeder Aufgabe gesagt hat, an welchen
    /// Tagen er sie getan hat und (0099) was er zu jedem Termin sagt.
    /// <paramref name="registrationIdsSql"/> nennt die Einsendungen (eine
    /// Unterabfrage oder ein Parameter).
    /// </summary>
    internal static async Task<Dictionary<Guid, List<object>>> TasksOfAsync(
        SqlConnection connection, string registrationIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        var answers = new Dictionary<(Guid Reg, Guid Step), (string? Answer, DateTimeOffset? At, bool ByPerson)>();
        var days = new Dictionary<(Guid Reg, Guid Step), List<string>>();
        var presence = new Dictionary<(Guid Reg, Guid Step), List<object>>();

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

        await using (var cmd = new SqlCommand($"""
            SELECT registration_id, step_id, day, answer, duty_id, absence, answered_at, by_person
            FROM app.task_presence WHERE registration_id IN ({registrationIdsSql})
            ORDER BY day;
            """, connection))
        {
            bind(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var key = (reader.GetGuid(0), reader.GetGuid(1));
                if (!presence.TryGetValue(key, out var list)) presence[key] = list = [];
                list.Add(new
                {
                    day = DateOnly.FromDateTime(reader.GetDateTime(2)).ToString("yyyy-MM-dd"),
                    answer = reader.IsDBNull(3) ? null : reader.GetString(3),
                    dutyId = reader.IsDBNull(4) ? null : Ids.ToText(reader.GetGuid(4)),
                    absence = reader.IsDBNull(5) ? null : reader.GetString(5),
                    answeredAt = reader.GetDateTimeOffset(6),
                    byPerson = reader.GetBoolean(7)
                });
            }
        }

        var out_ = new Dictionary<Guid, List<object>>();
        foreach (var key in answers.Keys.Union(days.Keys).Union(presence.Keys))
        {
            if (!out_.TryGetValue(key.Item1, out var list)) out_[key.Item1] = list = [];
            var said = answers.TryGetValue(key, out var a) ? a : (null, null, false);
            list.Add(new
            {
                stepId = Ids.ToText(key.Item2),
                answer = said.Answer,
                answeredAt = said.At,
                byPerson = said.ByPerson,
                days = days.TryGetValue(key, out var d) ? d : [],
                presence = presence.TryGetValue(key, out var p) ? p : []
            });
        }

        return out_;
    }

    /// <summary>
    /// 0099 — WIE VOLL DIE FUNKTIONEN SIND, je Aufgabe und Termin: nur die Zahl
    /// (wer, sieht nur die Kanzlei). Der Mensch sieht so, was noch frei ist.
    /// </summary>
    internal static async Task<List<object>> DutiesTakenAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        var out_ = new List<object>();
        await using var cmd = new SqlCommand("""
            SELECT p.step_id, p.day, p.duty_id, COUNT(*)
            FROM app.task_presence p
            JOIN app.form_step s ON s.id = p.step_id
            JOIN app.registration r ON r.id = p.registration_id
            WHERE s.module_id = @m AND p.duty_id IS NOT NULL AND p.answer = N'yes' AND r.withdrawn_at IS NULL
            GROUP BY p.step_id, p.day, p.duty_id;
            """, connection);
        cmd.Parameters.AddWithValue("@m", moduleId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            out_.Add(new
            {
                stepId = Ids.ToText(reader.GetGuid(0)),
                day = DateOnly.FromDateTime(reader.GetDateTime(1)).ToString("yyyy-MM-dd"),
                dutyId = Ids.ToText(reader.GetGuid(2)),
                count = reader.GetInt32(3)
            });
        }
        return out_;
    }
}
