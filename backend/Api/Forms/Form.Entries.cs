using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Was nur die Kanzlei ausfüllt, und was ein Platz zu tun hat.</summary>
public static partial class Form
{
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
                SELECT m.id, m.closed_at, x.id, m.repeat_kind, x.round_key, m.area_id, m.name_sealed, m.name_epoch,
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
                        areaId = reader.IsDBNull(5) ? null : Ids.ToText(reader.GetGuid(5)),
                        nameSealed = Names.B64(reader, 6),
                        nameEpoch = Names.Int(reader, 7),
                        closed = !reader.IsDBNull(1),
                        registrationId = reader.IsDBNull(2) ? null : Ids.ToText(reader.GetGuid(2)),

                        /* 0077 — wie oft, und welchen Zeitraum die juengste Einsendung traegt. */
                        repeat = reader.GetString(3),
                        round = reader.IsDBNull(4) ? null : reader.GetString(4),

                        /* 0099 — ohne Fragen kein Schritt „Uzupełnij". */
                        questions = reader.GetInt32(8)
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

            /* 0100 — „Wybierz termin": der Termin, den sein Platz hält. */
            var booked = await BookingMarksAsync(connection, "@reg", c => c.Parameters.AddWithValue("@reg", registrationId), ct);
            if (booked.TryGetValue(registrationId, out var bookedMarks)) marks.AddRange(bookedMarks);

            /* 0102 — „Przeczytaj wiadomości": nichts Ungelesenes in den gewählten Rozmowy. */
            var read = await ChatMarksAsync(connection, "@reg", c => c.Parameters.AddWithValue("@reg", registrationId), ct);
            if (read.TryGetValue(registrationId, out var readMarks)) marks.AddRange(readMarks);

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
