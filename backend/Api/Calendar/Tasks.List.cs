using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Aufgaben lesen: die Liste mit ihren Vorkommen und Erinnerungen, und was jetzt offen ist.</summary>
public static partial class Tasks
{
    private sealed record Stored(
        Guid Id, Guid AreaId, Guid Owner, string Kind, string Zone, DateTimeOffset StartsAt, int WindowMinutes,
        int? EveryMinutes, string Repeat, int Every, int? Weekdays, DateTimeOffset? Until, int? Count,
        int Epoch, byte[] Title, byte[]? Notes, DateTimeOffset CreatedAt,
        int Remind = 0, Guid? ChatId = null, Guid? TopicId = null, Guid? MessageId = null);

    private const string Columns = """
        id, area_id, owner_role_id, kind, time_zone, starts_at, window_minutes, every_minutes,
        repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
        epoch, title_sealed, notes_sealed, created_at, remind_mask, chat_id, topic_id, message_id
        """;

    private static Stored Read(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), reader.GetString(4),
        reader.GetDateTimeOffset(5), reader.GetInt32(6), reader.IsDBNull(7) ? null : reader.GetInt32(7),
        reader.GetString(8), reader.GetInt32(9), reader.IsDBNull(10) ? null : reader.GetByte(10),
        reader.IsDBNull(11) ? null : reader.GetDateTimeOffset(11), reader.IsDBNull(12) ? null : reader.GetInt32(12),
        reader.GetInt32(13), (byte[])reader[14], reader.IsDBNull(15) ? null : (byte[])reader[15],
        reader.GetDateTimeOffset(16), reader.GetByte(17),
        reader.IsDBNull(18) ? null : reader.GetGuid(18), reader.IsDBNull(19) ? null : reader.GetGuid(19),
        reader.IsDBNull(20) ? null : reader.GetGuid(20));

    /// <summary>
    /// Die Vorkommen einer Aufgabe mit Fenster — dieselbe Rechnung wie im
    /// Kalender; bei einem Zeitraum (0066) die eigene: Beginn plus ein
    /// Vielfaches des Abstands.
    /// </summary>
    private static List<DateTimeOffset> OccurrencesOf(Stored task, DateTimeOffset from, DateTimeOffset to) =>
        task.Kind == "period"
            ? Periods(task.StartsAt, task.EveryMinutes ?? 0, from, to, Zones.Of(task.Zone))
            : Calendar.Occurrences(task.StartsAt, task.Repeat, task.Every, task.Weekdays, task.Until, task.Count,
                from, to, Zones.Of(task.Zone));

    /// <summary>
    /// DIE ZEITRÄUME im Fenster — jeder beginnt <paramref name="everyMinutes"/>
    /// nach dem vorigen.
    ///
    /// <para>
    /// <b>Ganze Tage zählen in Ortstagen</b>, wie im Kalender: „alle 14 Tage um
    /// 9:00" bleibt 9:00, auch über die Zeitumstellung. Ein Abstand, der kein
    /// Vielfaches eines Tages ist („alle 36 Stunden"), läuft auf der Weltuhr.
    /// </para>
    ///
    /// <para>Rein und ohne Datenbank — deshalb öffentlich und prüfbar.</para>
    /// </summary>
    public static List<DateTimeOffset> Periods(DateTimeOffset first, int everyMinutes, DateTimeOffset from, DateTimeOffset to, TimeZoneInfo zone)
    {
        var found = new List<DateTimeOffset>();
        if (everyMinutes < 1 || to < from || first > to) return found;

        /* Wo anfangen: das letzte Vorkommen, das vor `from` beginnt — ohne alle davor zu zählen. */
        var skip = first >= from ? 0 : (long)Math.Floor((from - first).TotalMinutes / everyMinutes);
        var byDays = everyMinutes % 1440 == 0;
        var wall = TimeZoneInfo.ConvertTime(first, zone).DateTime;

        for (var i = skip; found.Count < MaxPeriods; i++)
        {
            var at = byDays
                ? Zones.AtLocal(wall.AddDays(i * (everyMinutes / 1440)), zone)
                : first.AddMinutes(i * everyMinutes);
            if (at > to) break;
            if (at >= from) found.Add(at);
        }

        return found;
    }

    /// <summary>
    /// 0088 — DIE VORKOMMEN, DIE LIEGEN BLIEBEN: vor dem gezeigten Zeitraum
    /// (<paramref name="shownFrom"/>), vorbei, und weder erledigt noch abgesagt.
    /// Rein und ohne Datenbank — deshalb öffentlich und prüfbar.
    /// </summary>
    public static List<DateTimeOffset> LeftOpen(
        IEnumerable<DateTimeOffset> occurrences, int windowMinutes, IReadOnlySet<DateTimeOffset> decided,
        DateTimeOffset shownFrom, DateTimeOffset now) =>
        occurrences.Where(at => at < shownFrom && at.AddMinutes(windowMinutes) < now && !decided.Contains(at)).ToList();

    /// <summary>
    /// 0066 — WANN ERINNERT WIRD an ein Vorkommen von <paramref name="windowMinutes"/>
    /// Dauer: am Anfang, in der Mitte, gegen Ende (eine Viertelstunde davor;
    /// bei einem kürzeren Fenster an dessen Ende). Ohne Dauer gibt es nur den Anfang.
    /// </summary>
    public static List<(string Kind, DateTimeOffset At)> RemindersOf(DateTimeOffset at, int windowMinutes, int mask)
    {
        var list = new List<(string, DateTimeOffset)>();
        if ((mask & 1) != 0) list.Add(("start", at));
        if (windowMinutes > 0)
        {
            if ((mask & 2) != 0) list.Add(("middle", at.AddMinutes(windowMinutes / 2.0)));
            if ((mask & 4) != 0) list.Add(("end", at.AddMinutes(windowMinutes >= 60 ? windowMinutes - 15 : windowMinutes)));
        }
        return list;
    }

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
    private static async Task ListAsync(HttpContext ctx, Db db, string? from, string? to, Guid? chat)
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
                $"SELECT {Columns} FROM app.task WHERE archived_at IS NULL AND area_id IN ({names}) {(chat is null ? "" : "AND chat_id = @chat")} ORDER BY created_at;",
                connection);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);
            if (chat is not null) cmd.Parameters.AddWithValue("@chat", chat.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) tasks.Add(Read(reader));
        }

        /*
         * Was erledigt wurde — bis zum Ende des Zeitraums, auch davor (0088): ob
         * ein Vorkommen von vor Wochen noch offen ist, weiss nur, wer auch seine
         * Entscheidungen kennt. Für `after` zählt ohnehin die jeweils letzte.
         */
        var done = new Dictionary<Guid, List<(DateTimeOffset At, DateTimeOffset DoneAt, Guid By, string State)>>();
        if (tasks.Count > 0)
        {
            var names = string.Join(", ", tasks.Select((_, i) => $"@t{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT d.task_id, d.occurrence_at, d.done_at, d.done_by_role_id, d.state
                FROM app.task_done d
                WHERE d.task_id IN ({names})
                  AND (d.occurrence_at <= @to
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

                /*
                    0088 — WAS LIEGEN BLIEB, BLEIBT SICHTBAR: die Vorkommen VOR dem
                    Zeitraum, die vorbei sind und weder erledigt noch abgesagt —
                    gleich wie lange her. Der Kalender stellt sie auf heute.
                */
                var shownFrom = since.AddMinutes(-task.WindowMinutes);
                var decided = mine.Select(d => d.At).ToHashSet();
                var left = task.Kind == "after" || task.StartsAt >= shownFrom
                    ? new List<DateTimeOffset>()
                    : LeftOpen(OccurrencesOf(task, task.StartsAt, shownFrom), task.WindowMinutes, decided, shownFrom, now);
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

                    /* 0066 — Erinnerungen und woher die Aufgabe kommt. */
                    remind = task.Remind,
                    chatId = task.ChatId is null ? null : Ids.ToText(task.ChatId.Value),
                    topicId = task.TopicId is null ? null : Ids.ToText(task.TopicId.Value),
                    messageId = task.MessageId is null ? null : Ids.ToText(task.MessageId.Value),

                    /* window, period: die Vorkommen im Zeitraum, jedes mit „erledigt". */
                    occurrences = (task.Kind != "after" ? OccurrencesOf(task, since.AddMinutes(-task.WindowMinutes), till) : new List<DateTimeOffset>())
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
                                skippedBy = skipped ? Ids.ToText(hit.By) : null,

                                /* 0066 — wann erinnert wird; ein entschiedenes Vorkommen erinnert nicht mehr. */
                                reminders = RemindersOf(at, task.WindowMinutes, settledHere ? 0 : task.Remind)
                                    .Select(r => new { kind = r.Kind, at = r.At }).ToList()
                            };
                        }).ToList(),

                    /* 0088 — offen geblieben, vor dem Zeitraum: die jüngsten, und wie viele es noch mehr sind. */
                    overdue = left.Skip(Math.Max(0, left.Count - MaxOverdue)).Select(at => new
                    {
                        at,
                        endsAt = at.AddMinutes(task.WindowMinutes),
                        doneAt = (DateTimeOffset?)null,
                        doneBy = (string?)null,
                        skippedAt = (DateTimeOffset?)null,
                        skippedBy = (string?)null,
                        reminders = new List<object>()
                    }).ToList(),
                    overdueMore = Math.Max(0, left.Count - MaxOverdue),

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

    /// <summary>
    /// 0067 — FÜR DIE POWIADOMIENIA: wie viele Aufgaben dieser Bereiche JETZT
    /// offen sind (ein laufendes, nicht entschiedenes Vorkommen; oder bei
    /// <c>after</c> fällig) — nur Zahlen, keine Titel.
    /// </summary>
    internal static async Task<int> OpenNowAsync(SqlConnection connection, IReadOnlyList<Guid> held, DateTimeOffset now, CancellationToken ct)
    {
        if (held.Count == 0) return 0;

        var tasks = new List<Stored>();
        var names = string.Join(", ", held.Select((_, i) => $"@h{i}"));
        await using (var cmd = new SqlCommand($"SELECT {Columns} FROM app.task WHERE archived_at IS NULL AND area_id IN ({names});", connection))
        {
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) tasks.Add(Read(reader));
        }
        if (tasks.Count == 0) return 0;

        var settled = new HashSet<(Guid, DateTimeOffset)>();
        var lastSettled = new Dictionary<Guid, DateTimeOffset>();
        var ids = string.Join(", ", tasks.Select((_, i) => $"@t{i}"));
        await using (var cmd = new SqlCommand($"""
            SELECT task_id, occurrence_at, done_at FROM app.task_done
            WHERE task_id IN ({ids})
              AND (occurrence_at >= @since
                   OR occurrence_at = (SELECT MAX(x.occurrence_at) FROM app.task_done x WHERE x.task_id = task_done.task_id));
            """, connection))
        {
            cmd.Parameters.AddWithValue("@since", now.AddMinutes(-MaxWindowMinutes));
            for (var i = 0; i < tasks.Count; i++) cmd.Parameters.AddWithValue($"@t{i}", tasks[i].Id);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var task = reader.GetGuid(0);
                settled.Add((task, reader.GetDateTimeOffset(1)));
                var doneAt = reader.GetDateTimeOffset(2);
                if (!lastSettled.TryGetValue(task, out var was) || doneAt > was) lastSettled[task] = doneAt;
            }
        }

        var open = 0;
        foreach (var task in tasks)
        {
            if (task.Kind == "after")
            {
                var due = lastSettled.TryGetValue(task.Id, out var last) ? last.AddMinutes(task.EveryMinutes ?? 0) : task.StartsAt;
                if (due <= now) open++;
                continue;
            }

            if (OccurrencesOf(task, now.AddMinutes(-task.WindowMinutes), now)
                .Any(at => at.AddMinutes(task.WindowMinutes) >= now && !settled.Contains((task.Id, at))))
            {
                open++;
            }
        }

        return open;
    }
}
