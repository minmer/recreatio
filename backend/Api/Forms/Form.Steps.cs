using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Die Schritte eines Formulars für die Kanzlei: lesen, speichern, abhaken.</summary>
public static partial class Form
{
    /* -- Die Schritte, fuer die Kanzlei ---------------------------------------------- */

    private sealed record StepRow(
        Guid Id, int Position, Guid AreaId, int Epoch, byte[] Label, byte[]? Help,
        string DoneBy, bool VisibleToPerson, DateTimeOffset? DueAt,

        /* 0098 — ein Znacznik (mark) oder eine Aufgabe mit Zeitraum (task), und deren Plan. */
        string Kind = "mark", TaskPlan? Plan = null,

        /* 0099 — die Funktionen in ihren Terminen, und der Kalender des Termins (für den Editor). */
        IReadOnlyList<DutyRow>? Duties = null, Guid? CalendarId = null,

        /* 0100 — „Wybierz termin": bei welchem Zasób (und wie er heisst — der Name hängt aus). */
        Guid? ResourceId = null, string? ResourceName = null,

        /* 0102 — „Przeczytaj wiadomości": welche Rozmowy (all | seat | area | channel), an welchem Bereich, und wie er heisst. */
        string? ChatKind = null, Guid? ChatAreaId = null, string? ChatAreaName = null,

        /* 0109 — „Naucz się": welche Bibliothek (und welche Wiederholung darin), bis zu welcher Kenntnis (0–1). */
        Guid? LearnLibraryId = null, Guid? LearnRevisionId = null, double? LearnThreshold = null);

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
        booking = s.Kind != "booking" ? null : new
        {
            resourceId = s.ResourceId is { } resource ? Ids.ToText(resource) : null,
            resourceName = s.ResourceName
        },
        chat = s.Kind != "chat" ? null : new
        {
            kind = s.ChatKind ?? "all",
            areaId = s.ChatAreaId is { } chatArea ? Ids.ToText(chatArea) : null,
            areaName = s.ChatAreaName
        },
        learn = s.Kind != "learn" ? null : new
        {
            libraryId = s.LearnLibraryId is { } library ? Ids.ToText(library) : null,
            revisionId = s.LearnRevisionId is { } revision ? Ids.ToText(revision) : null,
            threshold = s.LearnThreshold ?? 0.8
        },
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
                   item_id, presence, resource_id, (SELECT x.name FROM app.resource x WHERE x.id = form_step.resource_id),
                   chat_kind, chat_area_id, (SELECT x.name FROM app.area x WHERE x.id = form_step.chat_area_id),
                   learn_library_id, learn_revision_id, learn_threshold
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
                    kind, plan)
                {
                    ResourceId = reader.IsDBNull(21) ? null : reader.GetGuid(21),
                    ResourceName = reader.IsDBNull(22) ? null : reader.GetString(22),
                    ChatKind = reader.IsDBNull(23) ? null : reader.GetString(23),
                    ChatAreaId = reader.IsDBNull(24) ? null : reader.GetGuid(24),
                    ChatAreaName = reader.IsDBNull(25) ? null : reader.GetString(25),
                    LearnLibraryId = reader.IsDBNull(26) ? null : reader.GetGuid(26),
                    LearnRevisionId = reader.IsDBNull(27) ? null : reader.GetGuid(27),
                    LearnThreshold = reader.IsDBNull(28) ? null : reader.GetDouble(28)
                });
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
            SELECT id, audience, closed_at, created_at, repeat_kind, area_id, name_sealed, name_epoch,
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

                /* 0097 — der Name, versiegelt unter dem Schlüssel seines Bereichs. */
                areaId = reader.IsDBNull(5) ? null : Ids.ToText(reader.GetGuid(5)),
                nameSealed = Names.B64(reader, 6),
                nameEpoch = Names.Int(reader, 7),
                audience = reader.GetString(1),
                closed = !reader.IsDBNull(2),

                /* 0077 — wie oft sie je Mensch ausgefuellt wird. */
                repeat = reader.GetString(4),

                /* 0099 — ohne Fragen ist sie noch kein Schritt: es gibt nichts auszufuellen. */
                questions = reader.GetInt32(8)
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
            WHERE s.id = @step AND r.id = @reg AND {(personOnly ? "s.kind IN (N'mark', N'learn')" : "s.kind = N'mark'")}
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
}
