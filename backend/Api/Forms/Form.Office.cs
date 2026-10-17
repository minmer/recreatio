using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Was die Kanzlei sieht und tut: Einsendungen lesen, ausblenden, löschen, berichtigen.</summary>
public static partial class Form
{
    /* -- Was die Kanzlei sieht ---------------------------------------------- */

    private static async Task RegistrationsAsync(HttpContext ctx, Db db, Guid id)
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

        id = sheet.ModuleId;

        /*
         * ZWEI ACHSEN, und die zweite ist die, auf die es hier ankommt.
         *
         * Bis hierher stand allein das Schreibrecht an der ADRESSE. Das ist die
         * falsche Achse: die Antworten liegen unter dem Annahmeschluessel des
         * BEREICHS, und den haelt die Kanzlei — nicht, wer die Seite fuehrt. Es
         * war genau der Fall aus 0001, nur umgedreht: der eine DARF und KANN
         * nicht, der andere KANN und DARF nicht.
         *
         * Deshalb: sehen darf, wer die Seite fuehrt ODER einen der Bereiche
         * lesen darf, in die dieses Formular schreibt.
         */
        var mayWrite = await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted);
        var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted, withRemoved: true);

        var mine = new HashSet<Guid>();

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (await Area.MayAsync(connection, who.Value.AccountId, areaId,
                    Capability.Read, ctx.RequestAborted))
            {
                mine.Add(areaId);
            }
        }

        if (!mayWrite && mine.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Ani tego adresu nie prowadzisz, ani nie czytasz obszaru, do którego trafiają odpowiedzi.");
            return;
        }

        /*
         * Und HERAUS gehen nur die Werte der Bereiche, die dieser Mensch lesen
         * darf. Eine Huelle an jemanden zu schicken, der den Schluessel dazu
         * nie bekommt, nuetzt ihm nichts und liegt dann an einer Stelle mehr.
         *
         * Wer die Seite fuehrt, ohne einen Bereich zu lesen, sieht deshalb DASS
         * es Einsendungen gibt und wann — nicht, was darin steht. Das ist keine
         * Einschraenkung, sondern die Wahrheit: oeffnen koennte er sie ohnehin
         * nicht.
         */
        var readable = fields.Where(f => mine.Contains(f.AreaId)).Select(f => f.Id).ToHashSet();

        var rows = new List<(Guid Id, Guid? Seat, DateTimeOffset At, DateTimeOffset? Gone, bool Hidden, DateTimeOffset? Confirmed, Guid? Base, string Round, bool ByOffice)>();

        /*
         * Versteckte kommen nur mit, wenn danach gefragt wird — sonst waere
         * „ukryj" ein Knopf ohne Wirkung. Und sie kommen als VERSTECKT, damit
         * die Oberflaeche sie nicht wieder unter die uebrigen mischt.
         */
        var withHidden = ctx.Request.Query["hidden"] == "1";

        /*
         * 0077 — NUR EIN ABSCHNITT DER ZEIT. Eine wiederkehrende Erweiterung
         * traegt je Mensch und Zeitraum eine Einsendung; nach ein paar Jahren
         * sind das tausende. Die Liste fragt deshalb nach einem Abschnitt
         * (from und to, beide einschliesslich) — die Schluessel einer Art
         * ordnen sich als Text so, wie die Zeit laeuft.
         */
        var from = ctx.Request.Query["from"].ToString();
        var to = ctx.Request.Query["to"].ToString();

        if (from.Length > 10 || to.Length > 10)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny okres.");
            return;
        }

        /*
         * WELCHE Einsendungen — als EINE Bedingung, die alle Abfragen unten
         * teilen. Vorher ging je Einsendung ein Parameter hinaus; bei 2100
         * hoert der Server auf zu zaehlen.
         */
        var which = "part_id = @part"
            + (withHidden ? "" : " AND is_hidden = 0")
            + (from.Length == 0 ? "" : " AND round_key >= @from")
            + (to.Length == 0 ? "" : " AND round_key <= @to");

        void Bind(SqlCommand command)
        {
            command.Parameters.AddWithValue("@part", id);
            if (from.Length > 0) command.Parameters.AddWithValue("@from", from);
            if (to.Length > 0) command.Parameters.AddWithValue("@to", to);
        }

        var theseIds = $"SELECT id FROM app.registration WHERE {which}";

        await using (var cmd = new SqlCommand($"""
            SELECT id, access_id, submitted_at, withdrawn_at, is_hidden, confirmed_at, base_id, round_key, by_office
            FROM app.registration
            WHERE {which}
            ORDER BY submitted_at DESC;
            """, connection))
        {
            Bind(cmd);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((
                    reader.GetGuid(0),
                    reader.IsDBNull(1) ? null : reader.GetGuid(1),
                    reader.GetDateTimeOffset(2),
                    reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3),
                    reader.GetBoolean(4),
                    reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5),
                    reader.IsDBNull(6) ? null : reader.GetGuid(6),
                    reader.GetString(7),
                    reader.GetBoolean(8)));
            }
        }

        var byRegistration = new Dictionary<Guid, List<object>>();

        if (rows.Count > 0)
        {
            await using var cmd = new SqlCommand(
                $"SELECT registration_id, field_id, value_sealed, wrapped_key, office_key_sealed "
                + $"FROM app.registration_value WHERE registration_id IN ({theseIds});", connection);

            Bind(cmd);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var key = reader.GetGuid(0);
                var fieldId = reader.GetGuid(1);

                // Ein Feld aus einem Bereich, den dieser Mensch nicht liest.
                if (!readable.Contains(fieldId)) continue;

                if (!byRegistration.TryGetValue(key, out var list)) byRegistration[key] = list = [];

                list.Add(new
                {
                    fieldId = Ids.ToText(fieldId),
                    @sealed = Base64Url.Encode((byte[])reader[2]),

                    /* Verpackt unter der oeffentlichen Haelfte — zu oeffnen mit
                       dem privaten Annahmeschluessel, den nur das Amt hat. */
                    /*
                     * ZWEI WEGE ZUM SELBEN SCHLUESSEL (0037).
                     *
                     * `wrappedKey` ist der RSA-Umschlag der Annahme — der Weg,
                     * auf dem der Wert hereinkam. `officeKeySealed` ist
                     * derselbe Schluessel, vom Amt unter dem Schluessel SEINER
                     * ROLLE neu versiegelt.
                     *
                     * Sobald der zweite dasteht, faellt der erste: was
                     * jahrelang liegenbleibt, soll AES sein und nicht RSA.
                     * Genau einer von beiden ist immer da — die
                     * Pruefbedingung der Tabelle laesst nichts anderes zu.
                     */
                    wrappedKey = reader.IsDBNull(3) ? null : Base64Url.Encode((byte[])reader[3]),
                    officeKeySealed = reader.IsDBNull(4) ? null : Base64Url.Encode((byte[])reader[4])
                });
            }
        }

        /* Die Bestaetigungen dieser Einsendungen — der Leser oben ist zu (MARS). */
        var byCheck = new Dictionary<Guid, List<object>>();

        if (rows.Count > 0)
        {
            await using var cmd = new SqlCommand(
                $"SELECT registration_id, field_id, sent_at, expires_at, verified_at, origin "
                + $"FROM app.value_check WHERE registration_id IN ({theseIds});", connection);

            Bind(cmd);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var key = reader.GetGuid(0);
                if (!byCheck.TryGetValue(key, out var list)) byCheck[key] = list = [];

                list.Add(new
                {
                    fieldId = Ids.ToText(reader.GetGuid(1)),
                    sentAt = reader.GetDateTimeOffset(2),
                    expiresAt = reader.GetDateTimeOffset(3),
                    verifiedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),

                    /* `sms` = ein Link wurde geklickt, `self` = im Portal bestaetigt.
                       Zwei verschiedene Auskuenfte (0031) — nie dieselbe Zeile. */
                    origin = reader.GetString(5)
                });
            }
        }

        /* 0047 — was diese Einsendungen erweitert, und was an ihnen abgehakt ist. */
        var extensions = rows.Count == 0 ? [] : await ExtensionsOfAsync(connection, theseIds, Bind, ctx.RequestAborted);
        var stepMarks = rows.Count == 0 ? [] : await MarksOfAsync(connection, theseIds, Bind, ctx.RequestAborted);

        /* 0098 — was jeder zu den Aufgaben gesagt hat, und an welchen Tagen er sie getan hat. */
        var taskState = rows.Count == 0 ? [] : await TasksOfAsync(connection, theseIds, Bind, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(id),
            registrations = rows.Select(r => new
            {
                registrationId = Ids.ToText(r.Id),

                /* Bei einer Erweiterung: die Einsendung, die sie ergänzt (0047). */
                baseId = r.Base is null ? null : Ids.ToText(r.Base.Value),

                /* 0077 — der Zeitraum einer wiederkehrenden Erweiterung ('' sonst), und ob die Kanzlei eingetragen hat. */
                round = r.Round,
                byOffice = r.ByOffice,
                extensions = extensions.TryGetValue(r.Id, out var ext) ? ext : [],
                marks = stepMarks.TryGetValue(r.Id, out var done) ? done : [],
                tasks = taskState.TryGetValue(r.Id, out var said) ? said : [],
                seatId = r.Seat is null ? null : Ids.ToText(r.Seat.Value),
                submittedAt = r.At,
                withdrawnAt = r.Gone,
                hidden = r.Hidden,

                /* Der Mensch hat seine GANZE Einsendung durchgesehen und bestaetigt (0046). */
                confirmedAt = r.Confirmed,
                values = byRegistration.TryGetValue(r.Id, out var list) ? list : [],

                /*
                 * Welche Werte bestaetigt sind (0030) — die STELLE, nicht der
                 * Inhalt. Der Dienst sagt „dieses Feld dieser Einsendung wurde
                 * bestaetigt" und weiss weiterhin nicht, welche Nummer das ist.
                 */
                checks = byCheck.TryGetValue(r.Id, out var marks) ? marks : []
            })
        });
    }

    public sealed record HideRequest(bool Hidden);

    /// <summary>
    /// Eine Einsendung aus der Liste nehmen — oder zurueckholen.
    ///
    /// <para>
    /// <b>Das loescht nichts.</b> Die versiegelten Antworten bleiben, wo sie
    /// sind; es aendert sich, was die Kanzlei vor sich sieht. Fuer eine
    /// Doppeleinsendung oder einen Probelauf ist das genau richtig — und fuer
    /// jemanden, der um Loeschung bittet, genau falsch. Dafuer steht
    /// <see cref="RemoveAsync"/> daneben.
    /// </para>
    /// </summary>
    private static async Task HideAsync(HttpContext ctx, Db db, Guid id, HideRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        await using var cmd = new SqlCommand(
            "UPDATE app.registration SET is_hidden = @hidden WHERE id = @id;", connection);

        cmd.Parameters.AddWithValue("@hidden", body.Hidden);
        cmd.Parameters.AddWithValue("@id", id);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(id),
            hidden = body.Hidden
        });
    }

    /// <summary>
    /// Eine Einsendung LOESCHEN — die Antworten mit.
    ///
    /// <para>
    /// <b>Danach gibt es sie nicht mehr.</b> Kein Papierkorb, kein Merkmal: die
    /// Zeilen in <c>registration_value</c> verschwinden, und mit ihnen die
    /// einzigen Bytes, in denen die Angaben je standen. Der Dienst konnte sie
    /// nie lesen und kann sie erst recht nicht wiederherstellen.
    /// </para>
    ///
    /// <para>
    /// <b>Der PLATZ bleibt stehen.</b> Er ist der Zugang eines Menschen und
    /// nicht seine Einsendung; naehme man ihn mit, naehme man dem Firmling auch
    /// die Nachricht der Kanzlei und den gemeinsamen Kalender. Sein Portal
    /// zeigt danach kein „Twoje zgłoszenie" mehr — was zutrifft.
    /// </para>
    /// </summary>
    private static async Task RemoveAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            int values;

            /*
             * MIT IHREN ERWEITERUNGEN (0047): was der Koordinator oder der
             * Mensch zu dieser Einsendung ergänzt hat, gehört zu ihr und geht
             * mit ihr — samt allem, was daran abgehakt war.
             */
            await using (var cmd = new SqlCommand("""
                DELETE FROM app.step_mark WHERE registration_id = @id
                    OR registration_id IN (SELECT id FROM app.registration WHERE base_id = @id);
                DELETE FROM app.task_answer WHERE registration_id = @id;
                DELETE FROM app.task_day WHERE registration_id = @id;
                DELETE FROM app.task_presence WHERE registration_id = @id;
                DELETE FROM app.value_check
                 WHERE registration_id = @id
                    OR registration_id IN (SELECT id FROM app.registration WHERE base_id = @id);
                DELETE FROM app.registration_value
                 WHERE registration_id = @id
                    OR registration_id IN (SELECT id FROM app.registration WHERE base_id = @id);
                SELECT @@ROWCOUNT;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                values = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
            }

            await using (var cmd = new SqlCommand("""
                DELETE FROM app.registration WHERE base_id = @id;
                DELETE FROM app.registration WHERE id = @id;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new
            {
                registrationId = Ids.ToText(id),
                removed = true,
                values
            });
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    public sealed record OfficeValue(string FieldId, string Sealed, string WrappedKey, string? SeatKeySealed);

    /// <summary>0093 — was die Kanzlei hoert, wenn sie eine Antwort aendern will, die nur der Mensch schreibt.</summary>
    internal const string PersonOnlyWords = "Tę odpowiedź wpisuje i poprawia tylko sama osoba — kancelaria może ją czytać, ale nie zmieniać.";

    /// <summary>0093 — ist unter diesen Fragen eine, die nur der Mensch schreibt?</summary>
    internal static async Task<bool> TouchesPersonOnlyAsync(SqlConnection connection, IReadOnlyList<Guid> fieldIds, CancellationToken ct)
    {
        if (fieldIds.Count == 0) return false;
        var names = string.Join(", ", fieldIds.Distinct().Select((_, i) => $"@f{i}"));
        await using var cmd = new SqlCommand($"SELECT COUNT(*) FROM app.slug_field WHERE person_only = 1 AND id IN ({names});", connection);
        var i = 0;
        foreach (var id in fieldIds.Distinct()) cmd.Parameters.AddWithValue($"@f{i++}", id);
        return (int)(await cmd.ExecuteScalarAsync(ct))! > 0;
    }

    public sealed record OfficeReviseRequest(IReadOnlyList<OfficeValue> Values);

    /// <summary>
    /// Eine Einsendung von der Kanzlei aus berichtigen.
    ///
    /// <para>
    /// <b>Der Dienst sieht auch hier nichts.</b> Er bekommt dieselben Huellen
    /// wie bei der ersten Einsendung und legt sie hin. Wer berichtigt, hat den
    /// Annahmeschluessel im Browser — der Dienst hat ihn nie.
    /// </para>
    ///
    /// <para>
    /// <b><c>SeatKeySealed</c> gehoert dazu, wenn es einen Platz gibt.</b>
    /// Liesse man es weg, staende die berichtigte Nummer nur noch fuer das Amt
    /// da und waere fuer den Menschen selbst verschwunden — eine Korrektur, die
    /// ihm etwas WEGNIMMT. Die Oberflaeche holt den Platzschluessel dafuer
    /// ueber die Epoche oder die Annahme (0027).
    /// </para>
    ///
    /// <para>
    /// Ersetzt wird Feld fuer Feld, und nur was mitkommt — wie beim Menschen
    /// selbst.
    /// </para>
    /// </summary>
    private static async Task ReviseAsOfficeAsync(
        HttpContext ctx, Db db, Guid id, OfficeReviseRequest body)
    {
        var values = body.Values ?? [];

        if (values.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie podano żadnej poprawki.");
            return;
        }

        var parsed = new List<(Guid Field, byte[] Sealed, byte[] Wrapped, byte[]? ForSeat)>();

        foreach (var one in values)
        {
            if (!Guid.TryParse(one.FieldId, out var fieldId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung pola.");
                return;
            }

            var sealedValue = Optional(one.Sealed);
            var wrapped = Optional(one.WrappedKey);

            if (sealedValue is null || sealedValue.Length == 0 || wrapped is null || wrapped.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna poprawka.");
                return;
            }

            parsed.Add((fieldId, sealedValue, wrapped, Optional(one.SeatKeySealed)));
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        /* 0093 — was nur der Mensch schreibt, aendert die Kanzlei nicht. */
        if (await TouchesPersonOnlyAsync(connection, parsed.Select(p => p.Field).ToList(), ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, PersonOnlyWords);
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            foreach (var (fieldId, sealedValue, wrapped, forSeat) in parsed)
            {
                await using (var drop = new SqlCommand("""
                    DELETE FROM app.registration_value
                     WHERE registration_id = @reg AND field_id = @field;
                    """, connection, tx))
                {
                    drop.Parameters.AddWithValue("@reg", id);
                    drop.Parameters.AddWithValue("@field", fieldId);
                    await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                /*
                 * EINE BESTAETIGUNG GILT DEM WERT, NICHT DEM MENSCHEN (0030).
                 * Wer die Nummer aendert, hat eine ANDERE Nummer — und die ist
                 * ungeprueft. Das hier zu tun statt es jemandem aufzutragen ist
                 * der Unterschied zwischen einer Regel und einer Bitte.
                 */
                await using (var stale = new SqlCommand("""
                    DELETE FROM app.value_check
                     WHERE registration_id = @reg AND field_id = @field;
                    """, connection, tx))
                {
                    stale.Parameters.AddWithValue("@reg", id);
                    stale.Parameters.AddWithValue("@field", fieldId);
                    await stale.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await using var add = new SqlCommand("""
                    INSERT INTO app.registration_value
                        (registration_id, field_id, value_sealed, wrapped_key, seat_key_sealed)
                    VALUES (@reg, @field, @value, @wrapped, @seat);
                    """, connection, tx);

                add.Parameters.AddWithValue("@reg", id);
                add.Parameters.AddWithValue("@field", fieldId);
                add.Parameters.AddBlob("@value", sealedValue);
                add.Parameters.AddBlob("@wrapped", wrapped);
                add.Parameters.AddBlob("@seat", forSeat);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 547)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "To pytanie już nie należy do tego formularza.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(id),
            revised = parsed.Count
        });
    }
}
