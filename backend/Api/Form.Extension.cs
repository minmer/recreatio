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
    /// <summary>Mehr Schritte als das ist keine Liste mehr, sondern ein Handbuch.</summary>
    private const int MaxSteps = 30;

    private static void MapExtension(WebApplication app)
    {
        app.MapGet("/workspace/part/{id:guid}/steps", StepsAsync);
        app.MapPost("/workspace/part/{id:guid}/steps", SaveStepsAsync);
        app.MapPost("/workspace/registration/{id:guid}/step", MarkAsync);
        app.MapPost("/workspace/part/{id:guid}/entry", EntryAsync);
    }

    /* -- Was ein Formular ist -------------------------------------------------- */

    /// <summary>Erweitert dieses Formular ein anderes, und wer fuellt es aus?</summary>
    internal readonly record struct Shape(Guid? ExtendsId, string Audience);

    internal static async Task<Shape?> ShapeAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT extends_id, audience FROM app.module WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", moduleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new Shape(reader.IsDBNull(0) ? null : reader.GetGuid(0), reader.GetString(1));
    }

    /// <summary>Die Einsendung einer Erweiterung zu dieser Einsendung — oder <c>null</c>.</summary>
    private static async Task<Guid?> ExtensionOfAsync(
        SqlConnection connection, Guid extensionId, Guid baseRegistrationId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT TOP 1 id FROM app.registration WHERE part_id = @part AND base_id = @base;", connection);
        cmd.Parameters.AddWithValue("@part", extensionId);
        cmd.Parameters.AddWithValue("@base", baseRegistrationId);

        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    /// <summary>Je Einsendung: was sie erweitert — welche Erweiterung, welche Einsendung, wann.</summary>
    private static async Task<Dictionary<Guid, List<object>>> ExtensionsOfAsync(
        SqlConnection connection, IReadOnlyList<Guid> registrationIds, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();
        if (registrationIds.Count == 0) return out_;

        var names = string.Join(", ", registrationIds.Select((_, i) => $"@b{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT base_id, part_id, id, submitted_at, confirmed_at
            FROM app.registration
            WHERE base_id IN ({names});
            """, connection);

        for (var i = 0; i < registrationIds.Count; i++) cmd.Parameters.AddWithValue($"@b{i}", registrationIds[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var key = reader.GetGuid(0);
            if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];

            list.Add(new
            {
                moduleId = Ids.ToText(reader.GetGuid(1)),
                registrationId = Ids.ToText(reader.GetGuid(2)),
                submittedAt = reader.GetDateTimeOffset(3),
                confirmedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4)
            });
        }

        return out_;
    }

    /// <summary>Je Einsendung: welche Schritte abgehakt sind, wann, und ob vom Menschen selbst.</summary>
    private static async Task<Dictionary<Guid, List<object>>> MarksOfAsync(
        SqlConnection connection, IReadOnlyList<Guid> registrationIds, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();
        if (registrationIds.Count == 0) return out_;

        var names = string.Join(", ", registrationIds.Select((_, i) => $"@m{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT registration_id, step_id, done_at, by_person
            FROM app.step_mark
            WHERE registration_id IN ({names});
            """, connection);

        for (var i = 0; i < registrationIds.Count; i++) cmd.Parameters.AddWithValue($"@m{i}", registrationIds[i]);

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
        string DoneBy, bool VisibleToPerson, DateTimeOffset? DueAt);

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
        dueAt = s.DueAt
    };

    private static async Task<List<StepRow>> ReadStepsAsync(
        SqlConnection connection, Guid moduleId, bool personOnly, CancellationToken ct)
    {
        var steps = new List<StepRow>();

        await using var cmd = new SqlCommand($"""
            SELECT id, position, area_id, epoch, label_sealed, help_sealed, done_by, visible_to_person, due_at
            FROM app.form_step
            WHERE module_id = @m {(personOnly ? "AND visible_to_person = 1" : "")}
            ORDER BY position;
            """, connection);
        cmd.Parameters.AddWithValue("@m", moduleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            steps.Add(new StepRow(
                reader.GetGuid(0), reader.GetInt32(1), reader.GetGuid(2), reader.GetInt32(3),
                (byte[])reader[4], reader.IsDBNull(5) ? null : (byte[])reader[5],
                reader.GetString(6), reader.GetBoolean(7),
                reader.IsDBNull(8) ? null : reader.GetDateTimeOffset(8)));
        }

        return steps;
    }

    /// <summary>Die Erweiterungen eines Formulars — Name, wer sie ausfuellt, ob sie offen sind.</summary>
    private static async Task<List<object>> ExtensionModulesAsync(
        SqlConnection connection, Guid moduleId, string? audience, CancellationToken ct)
    {
        var out_ = new List<object>();

        await using var cmd = new SqlCommand($"""
            SELECT id, name, audience, closed_at, created_at
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
                name = reader.GetString(1),
                audience = reader.GetString(2),
                closed = !reader.IsDBNull(3)
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
        string DoneBy, bool VisibleToPerson, DateTimeOffset? DueAt);

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

        var parsed = new List<(Guid Id, int Epoch, byte[] Label, byte[]? Help, string DoneBy, bool Visible, DateTimeOffset? Due)>();

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

            var doneBy = (one.DoneBy ?? string.Empty).Trim().ToLowerInvariant();
            if (doneBy is not ("office" or "person"))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Odhacza kancelaria (office) albo osoba (person).");
                return;
            }

            /* Was der Mensch abhaken soll, muss er sehen. */
            parsed.Add((stepId, one.Epoch, label, Optional(one.HelpSealed), doneBy,
                doneBy == "person" || one.VisibleToPerson, one.DueAt));
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
                               done_by = @doneBy, visible_to_person = @visible, due_at = @due
                         WHERE id = @id AND module_id = @m;
                    ELSE
                        INSERT INTO app.form_step
                            (id, module_id, position, area_id, epoch, label_sealed, help_sealed,
                             done_by, visible_to_person, due_at, created_at)
                        VALUES (@id, @m, @pos, @area, @epoch, @label, @help, @doneBy, @visible, @due, @now);
                    """, connection, tx);

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
            WHERE s.id = @step AND r.id = @reg
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

    public sealed record EntryRequest(string BaseRegistrationId, IReadOnlyList<ValueIn>? Values);

    /// <summary>
    /// DIE KANZLEI FUELLT EINE ERWEITERUNG AUS — fuer einen Menschen, zu seiner
    /// Einsendung.
    ///
    /// <para>
    /// Eine Erweiterung „nur fuer den Koordinator" ist genau das: seine Notizen
    /// zu jedem Kandidaten. Die Werte gehen unter die Annahme ihres Bereichs wie
    /// jede Antwort; eine Huelle fuer den Platz gibt es NICHT — der Mensch sieht
    /// davon nichts. Fuellt die Kanzlei eine Erweiterung aus, die sonst der
    /// Mensch ausfuellt (er hat es auf Papier gebracht), darf sie die Huelle fuer
    /// seinen Platz mitschicken; dann liest er es wie seine eigene Angabe.
    /// </para>
    ///
    /// <para>Einmal je Mensch — danach berichtigt sie, wie jede Einsendung.</para>
    /// </summary>
    private static async Task EntryAsync(HttpContext ctx, Db db, Guid id, EntryRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.BaseRegistrationId, out var baseId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zgłoszenie.");
            return;
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
        if (shape?.ExtendsId is not Guid baseModule)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Ten formularz niczego nie rozszerza.");
            return;
        }

        Guid? access;

        await using (var find = new SqlCommand(
            "SELECT access_id FROM app.registration WHERE id = @base AND part_id = @part;", connection))
        {
            find.Parameters.AddWithValue("@base", baseId);
            find.Parameters.AddWithValue("@part", baseModule);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma zgłoszenia, które to uzupełnia.");
                return;
            }

            access = reader.IsDBNull(0) ? null : reader.GetGuid(0);
        }

        if (await ExtensionOfAsync(connection, id, baseId, ctx.RequestAborted) is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "To jest już uzupełnione — popraw odpowiedzi.");
            return;
        }

        var person = shape.Value.Audience == "person";
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

            /* Was nur die Kanzlei sieht, bekommt keine Huelle fuer den Platz. */
            parsed.Add((fieldId, sealedValue, wrapped, person && access is not null ? Optional(one.SeatKeySealed) : null));
        }

        var registrationId = Ids.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.registration (id, part_id, access_id, submitted_at, base_id)
                VALUES (@id, @part, @access, @now, @base);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", registrationId);
                insert.Parameters.AddWithValue("@part", id);

                /* Nur was der Mensch sieht, haengt an seinem Platz. */
                insert.Parameters.AddWithValue("@access", person && access is not null ? access.Value : DBNull.Value);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@base", baseId);
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

        await ctx.Response.WriteAsJsonAsync(new { registrationId = Ids.ToText(registrationId), baseId = Ids.ToText(baseId) });
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
                SELECT m.id, m.name, m.closed_at,
                       (SELECT TOP 1 x.id FROM app.registration x WHERE x.part_id = m.id AND x.base_id = @reg)
                FROM app.module m
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
                        name = reader.GetString(1),
                        closed = !reader.IsDBNull(2),
                        registrationId = reader.IsDBNull(3) ? null : Ids.ToText(reader.GetGuid(3))
                    });
                }
            }

            var steps = await ReadStepsAsync(connection, part, personOnly: true, ct);

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
                marks
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

        var fields = await ReadFieldsAsync(connection, sheet.ModuleId, ct);

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (await Area.MayAsync(connection, accountId, areaId, Capability.Read, ct)) return true;
        }

        return false;
    }
}
