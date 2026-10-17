using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Die Schritte eines Formulars speichern: Arten, Aufgaben mit Plan oder Terminen, Funktionen.</summary>
public static partial class Form
{
    public sealed record StepIn(
        string StepId, string AreaId, int Epoch, string LabelSealed, string? HelpSealed,
        string DoneBy, bool VisibleToPerson, DateTimeOffset? DueAt,

        /* 0098 — eine Aufgabe mit Zeitraum (task) statt eines Znacznik (mark), und ihr Plan. */
        string? Kind = null, TaskIn? Task = null,

        /* 0100 — „Wybierz termin" (booking): bei welchem Zasób. */
        string? ResourceId = null,

        /* 0102 — „Przeczytaj wiadomości" (chat): welche Rozmowy (all | seat | area | channel), an welchem Bereich (leer: an jedem). */
        string? ChatKind = null, string? ChatAreaId = null,

        /* 0109 — „Naucz się" (learn): die Bibliothek, wahlweise eine Wiederholung darin, und bis zu welcher Kenntnis (0–1). */
        string? LearnLibraryId = null, string? LearnRevisionId = null, double? LearnThreshold = null);

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
            List<(Guid Id, byte[] Label, int? Capacity)> Duties, Guid? Resource, (string Kind, Guid? Area)? Chat,
            (Guid Library, Guid? Revision, double Threshold)? Learn)>();

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
                parsed.Add((stepId, one.Epoch, label, Optional(one.HelpSealed), read.DoneBy, true, null, plan, duties, null, null, null));
                continue;
            }

            /*
             * 0100 — „WYBIERZ TERMIN": erledigt sich, wenn der Mensch bei diesem Zasób
             * einen Termin nimmt. Wer ihn anlegt, muss den Zasób sehen dürfen.
             */
            if ((one.Kind ?? "mark").Trim().ToLowerInvariant() == "booking")
            {
                Guid? resourceArea = null;
                if (Guid.TryParse(one.ResourceId, out var resource))
                {
                    await using var find = new SqlCommand("SELECT area_id FROM app.resource WHERE id = @id;", connection);
                    find.Parameters.AddWithValue("@id", resource);
                    resourceArea = await find.ExecuteScalarAsync(ctx.RequestAborted) is Guid a ? a : null;
                }
                if (resourceArea is null || !await Area.MayAsync(connection, who.Value.AccountId, resourceArea.Value, Capability.Read, ctx.RequestAborted))
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz zasób, przy którym osoba wybiera termin.");
                    return;
                }
                parsed.Add((stepId, one.Epoch, label, Optional(one.HelpSealed), "person", true, one.DueAt, null, [], resource, null, null));
                continue;
            }

            /*
             * 0102 — „PRZECZYTAJ WIADOMOŚCI": erledigt, solange in den gewählten
             * Rozmowy seines Platzes nichts Ungelesenes liegt. Ein Bereich, wenn
             * genannt, muss einer sein, den der Anlegende lesen darf.
             */
            if ((one.Kind ?? "mark").Trim().ToLowerInvariant() == "chat")
            {
                var chatKind = (one.ChatKind ?? "all").Trim().ToLowerInvariant();
                if (chatKind is not ("all" or "seat" or "area" or "channel"))
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz, w której rozmowie osoba ma przeczytać wiadomości.");
                    return;
                }
                Guid? chatArea = null;
                if (!string.IsNullOrWhiteSpace(one.ChatAreaId))
                {
                    if (!Guid.TryParse(one.ChatAreaId, out var a)
                        || !await Area.MayAsync(connection, who.Value.AccountId, a, Capability.Read, ctx.RequestAborted))
                    {
                        await Fail(ctx, StatusCodes.Status400BadRequest, "Tej rozmowy tu nie znasz — wybierz jedną ze swoich.");
                        return;
                    }
                    chatArea = a;
                }
                parsed.Add((stepId, one.Epoch, label, Optional(one.HelpSealed), "person", true, null, null, [], null, (chatKind, chatArea), null));
                continue;
            }

            /*
             * 0109 — „NAUCZ SIĘ" [L5, P09]: erledigt, wenn die Kenntnis des Menschen in
             * dieser Bibliothek (oder dieser Wiederholung) die Schwelle erreicht. Die
             * Kenntnis rechnet sein Browser — der Dienst sieht sie nicht; die Kanzlei
             * liest die Antworten im Bereich, in den sie gehen. Wer den Schritt anlegt,
             * muss die Bibliothek lesen dürfen.
             */
            if ((one.Kind ?? "mark").Trim().ToLowerInvariant() == "learn")
            {
                Guid? libraryArea = null;
                if (Guid.TryParse(one.LearnLibraryId, out var learnLibrary))
                {
                    await using var find = new SqlCommand("SELECT area_id FROM app.library WHERE id = @id;", connection);
                    find.Parameters.AddWithValue("@id", learnLibrary);
                    libraryArea = await find.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
                }
                if (libraryArea is null || !await Area.MayAsync(connection, who.Value.AccountId, libraryArea.Value, Capability.Read, ctx.RequestAborted))
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz bibliotekę, z której osoba ma się nauczyć.");
                    return;
                }
                Guid? learnRevision = null;
                if (!string.IsNullOrWhiteSpace(one.LearnRevisionId))
                {
                    if (!Guid.TryParse(one.LearnRevisionId, out var revision))
                    {
                        await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna powtórka.");
                        return;
                    }
                    await using var entry = new SqlCommand("SELECT 1 FROM app.library_entry WHERE id = @id AND library_id = @library AND deleted_at IS NULL;", connection);
                    entry.Parameters.AddWithValue("@id", revision);
                    entry.Parameters.AddWithValue("@library", learnLibrary);
                    if (await entry.ExecuteScalarAsync(ctx.RequestAborted) is null)
                    {
                        await Fail(ctx, StatusCodes.Status400BadRequest, "Tej powtórki nie ma w wybranej bibliotece.");
                        return;
                    }
                    learnRevision = revision;
                }
                var threshold = one.LearnThreshold ?? 0.8;
                if (double.IsNaN(threshold) || threshold < 0 || threshold > 1)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Próg: od 0 do 100%.");
                    return;
                }
                parsed.Add((stepId, one.Epoch, label, Optional(one.HelpSealed), "person", true, one.DueAt, null, [], null, null, (learnLibrary, learnRevision, threshold)));
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
                doneBy == "person" || one.VisibleToPerson, one.DueAt, null, [], null, null, null));
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
                               item_id = @item, presence = @presence, resource_id = @resource,
                               chat_kind = @chatKind, chat_area_id = @chatArea,
                               learn_library_id = @learnLibrary, learn_revision_id = @learnRevision, learn_threshold = @learnThreshold
                         WHERE id = @id AND module_id = @m;
                    ELSE
                        INSERT INTO app.form_step
                            (id, module_id, position, area_id, epoch, label_sealed, help_sealed,
                             done_by, visible_to_person, due_at, created_at,
                             kind, starts_on, ends_on, schedule, weekdays, at_minute, minutes, needed, show_from, report_until,
                             item_id, presence, resource_id, chat_kind, chat_area_id,
                             learn_library_id, learn_revision_id, learn_threshold)
                        VALUES (@id, @m, @pos, @area, @epoch, @label, @help, @doneBy, @visible, @due, @now,
                                @kind, @starts, @ends, @schedule, @weekdays, @at, @minutes, @needed, @showFrom, @reportUntil,
                                @item, @presence, @resource, @chatKind, @chatArea,
                                @learnLibrary, @learnRevision, @learnThreshold);

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
                save.Parameters.AddWithValue("@kind", one.Learn is not null ? "learn" : one.Chat is not null ? "chat" : one.Resource is not null ? "booking" : plan is null ? "mark" : "task");
                save.Parameters.Add("@learnLibrary", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)one.Learn?.Library ?? DBNull.Value;
                save.Parameters.Add("@learnRevision", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)one.Learn?.Revision ?? DBNull.Value;
                save.Parameters.Add("@learnThreshold", System.Data.SqlDbType.Float).Value = (object?)one.Learn?.Threshold ?? DBNull.Value;
                save.Parameters.AddWithValue("@chatKind", (object?)one.Chat?.Kind ?? DBNull.Value);
                save.Parameters.Add("@chatArea", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)one.Chat?.Area ?? DBNull.Value;
                save.Parameters.Add("@resource", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)one.Resource ?? DBNull.Value;
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
}
