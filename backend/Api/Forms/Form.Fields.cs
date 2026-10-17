using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Fragen eines Formulars pflegen: anlegen, lesen, entfernen, zurückholen, ändern (0042).</summary>
public static partial class Form
{
    /* -- Felder pflegen ----------------------------------------------------- */

    /// <summary>
    /// <c>AreaId</c> ist, wohin die ANTWORTEN gehen. <c>LabelAreaId</c> /
    /// <c>LabelEpoch</c> (0042), unter welchem Schluessel die FRAGE liegt — der
    /// Bereich des Formulars. Fehlen sie, liegt die Frage wie vor 0042 unter
    /// <c>AreaId</c> / <c>Epoch</c>.
    /// </summary>
    public sealed record FieldRequest(
        string FieldId, string AreaId, int Epoch, string Kind, int Position,
        string LabelSealed, string? HelpSealed, string? OptionsSealed,
        bool? IsRequired, bool? IsHalfWidth, string? IdentityRole,
        string? LabelAreaId = null, int? LabelEpoch = null,

        /* Darf der Mensch die Antwort ueber seinen Link berichtigen (0044)? Vorgabe: ja. */
        bool? SelfEdit = null,

        /* 0093 — schreibt und berichtigt NUR der Mensch (die Kanzlei liest, aendert nie)? Vorgabe: nein. */
        bool? PersonOnly = null);

    /// <summary>
    /// Ein Feld anlegen.
    ///
    /// <para>
    /// <b>Zwei Rechte, und beide werden gebraucht.</b> Wer ein Feld hinstellt,
    /// aendert die SEITE — dafuer braucht er das Recht an der Adresse. Und er
    /// bestimmt, unter welchem Schluessel die Antworten liegen — dafuer braucht
    /// er das Recht am BEREICH. Eines allein genuegt nicht: sonst legte
    /// jemand, der nur die Seite fuehrt, Antworten in einen fremden Bereich.
    /// </para>
    /// </summary>
    private static async Task AddFieldAsync(HttpContext ctx, Db db, Guid id, FieldRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.FieldId, out var fieldId) || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (!Kinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany rodzaj pola.");
            return;
        }

        /*
         * WELCHE ANGABE DIESES FELD IST (0038).
         *
         * Dieselben Woerter wie in `person_value` — sonst laesst sich ein
         * Bogen nicht aus den Angaben eines Menschen ausfuellen: „name" ist
         * nicht dasselbe wie „Vorname", und „contact" ist Telefon oder
         * E-Mail oder beides.
         *
         * `name` und `contact` bleiben gueltig: sie stehen in vorhandenen
         * Zeilen, und zu raten, was gemeint war, waere schlimmer als sie
         * stehenzulassen.
         */
        var identity = (body.IdentityRole ?? "none").Trim().ToLowerInvariant();

        if (!IdentityRoles.Contains(identity))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Rola pola: none albo jedna z danych osoby (given_name, surname, …).");
            return;
        }

        if (body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Epoka zaczyna się od 1.");
            return;
        }

        byte[] label;
        try { label = Base64Url.Decode(body.LabelSealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana etykieta.");
            return;
        }

        if (label.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Pole potrzebuje etykiety.");
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

        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Pod obszar, w którym nie możesz pisać, nie skierujesz odpowiedzi.");
            return;
        }

        var (labelArea, labelEpoch, labelFail) = LabelPlace(sheet, body.LabelAreaId, body.LabelEpoch);
        if (labelFail is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, labelFail);
            return;
        }

        await using var insert = new SqlCommand("""
            INSERT INTO app.slug_field
                (id, part_id, area_id, kind, position, label_sealed, help_sealed, options_sealed,
                 epoch, is_required, is_half_width, identity_role, created_at,
                 label_area_id, label_epoch, self_edit, person_only)
            VALUES (@id, @part, @area, @kind, @pos, @label, @help, @options,
                    @epoch, @required, @half, @identity, @now,
                    @labelArea, @labelEpoch, @selfEdit, @personOnly);
            """, connection);

        insert.Parameters.AddWithValue("@labelArea", (object?)labelArea ?? DBNull.Value);
        insert.Parameters.AddWithValue("@labelEpoch", (object?)labelEpoch ?? DBNull.Value);

        insert.Parameters.AddWithValue("@id", fieldId);
        insert.Parameters.AddWithValue("@part", id);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.AddWithValue("@pos", body.Position);
        insert.Parameters.AddWithValue("@label", label);
        insert.Parameters.AddBlob("@help", Optional(body.HelpSealed));
        insert.Parameters.AddBlob("@options", Optional(body.OptionsSealed));
        insert.Parameters.AddWithValue("@epoch", body.Epoch);
        insert.Parameters.AddWithValue("@required", body.IsRequired ?? false);
        insert.Parameters.AddWithValue("@half", body.IsHalfWidth ?? false);
        /* 0093 — was nur der Mensch schreibt, muss er auch berichtigen koennen: sonst koennte es niemand. */
        insert.Parameters.AddWithValue("@selfEdit", (body.SelfEdit ?? true) || body.PersonOnly == true);
        insert.Parameters.AddWithValue("@personOnly", body.PersonOnly == true);
        insert.Parameters.AddWithValue("@identity", identity);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Takie pole już istnieje.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { fieldId = Ids.ToText(fieldId), partId = Ids.ToText(id) });
    }

    private static async Task FieldsAsync(HttpContext ctx, Db db, Guid id)
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
         * Dieselben zwei Achsen wie bei den Einsendungen: wer die Seite fuehrt,
         * oder wer einen der Bereiche liest, in die gefragt wird. Die
         * Beschriftungen liegen unter dem Epochenschluessel des Bereichs — wer
         * ihn hat, soll seine eigenen Fragen auch sehen duerfen, ohne dass ihm
         * jemand die Seite gibt.
         */
        var mayWrite = await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted);

        if (!mayWrite)
        {
            var asked = await ReadFieldsAsync(connection, id, ctx.RequestAborted, withRemoved: true);
            var any = false;

            foreach (var areaId in asked.Select(f => f.AreaId).Distinct())
            {
                if (await Area.MayAsync(connection, who.Value.AccountId, areaId,
                        Capability.Read, ctx.RequestAborted))
                {
                    any = true;
                    break;
                }
            }

            if (!any)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden,
                    "Ani tego adresu nie prowadzisz, ani nie czytasz obszaru, o który pyta ten formularz.");
                return;
            }
        }

        /*
         * DURCH `Told` — wie beim oeffentlichen Bogen, und das ist keine
         * Schoenheitsfrage.
         *
         * `FieldRow` ist die Zeile, wie sie in der Datenbank steht: `Id`,
         * `Label` als `byte[]`. Direkt hinausgeschrieben wird daraus `id` und ein
         * Base64 nach Standardalphabet — der Browser sucht aber `fieldId` und
         * `labelSealed` in Base64Url. Er fand beides nicht, und weil sich
         * `undefined` still weiterreichen laesst, kam kein Fehler heraus,
         * sondern eine Ansicht, die sich selbst widersprach: die Beschriftung
         * ging nie auf (die AAD wurde ueber `undefined` gebildet), und keine
         * Antwort fand ihre Frage (verglichen wurde gegen `undefined`). In der
         * Kanzlei stand „zapieczętowane" und „pytanie usunięte", waehrend
         * draussen jeder denselben Bogen lesen und ausfuellen konnte.
         *
         * Der oeffentliche Weg war immer richtig. Nur dieser eine nicht.
         */
        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(id),
            fields = (await ReadFieldsAsync(connection, id, ctx.RequestAborted, withRemoved: true)).Select(Told),
            design = await DesignAsync(connection, id, ctx.RequestAborted)
        });
    }

    /// <summary>
    /// Ein Feld entfernen.
    ///
    /// <para>
    /// <b>Nur, solange keine Antwort darauf zeigt.</b> Sonst faende sich eine
    /// Einsendung mit einem Wert ohne Frage — und niemand koennte mehr sagen,
    /// worauf jemand geantwortet hat. Wer die Frage loswerden will, nachdem
    /// geantwortet wurde, verbirgt den Baustein; die Antworten bleiben lesbar.
    /// </para>
    /// </summary>
    private static async Task RemoveFieldAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid partId;
        await using (var find = new SqlCommand("SELECT part_id FROM app.slug_field WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego pola nie ma.");
                return;
            }
            partId = found;
        }

        var sheet = await SheetAsync(connection, partId, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        partId = sheet.ModuleId;

        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        /*
         * 0086 — EINE FRAGE EINES WYMAGANIE bleibt, solange es eingeschaltet
         * ist: ohne Geburtsdatum weiss das Formular nicht, wer minderjährig ist,
         * ohne die Zustimmung druckt es nichts. Verschieben darf man sie.
         */
        var locked = await LockedFieldsAsync(connection, partId, ctx.RequestAborted);
        if (locked.TryGetValue(id, out var need))
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"To pytanie należy do wymagania „{need}” — można je przesunąć albo zmienić jego brzmienie, ale usunąć dopiero po wyłączeniu wymagania.");
            return;
        }

        bool answered;
        await using (var used = new SqlCommand(
            "SELECT TOP 1 1 FROM app.registration_value WHERE field_id = @id;", connection))
        {
            used.Parameters.AddWithValue("@id", id);
            answered = await used.ExecuteScalarAsync(ctx.RequestAborted) is not null;
        }

        /*
         * 0086 — MIT ANTWORTEN wird sie vom Formular GENOMMEN, nicht gelöscht:
         * niemand bekommt sie mehr, ihre Antworten stehen weiter in der Tabelle
         * der Kanzlei. Ohne Antworten ist sie wirklich weg.
         */
        if (answered)
        {
            await using var off = new SqlCommand(
                "UPDATE app.slug_field SET removed_at = @now WHERE id = @id AND removed_at IS NULL;", connection);
            off.Parameters.AddWithValue("@id", id);
            off.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await off.ExecuteNonQueryAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new { fieldId = Ids.ToText(id), removed = true, kept = true });
            return;
        }

        await using var drop = new SqlCommand("DELETE FROM app.slug_field WHERE id = @id;", connection);
        drop.Parameters.AddWithValue("@id", id);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { fieldId = Ids.ToText(id), removed = true, kept = false });
    }

    /// <summary>0086 — eine vom Formular genommene Frage zurückholen; sie wird wieder gestellt.</summary>
    private static async Task RestoreFieldAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid partId;
        await using (var find = new SqlCommand("SELECT part_id FROM app.slug_field WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego pola nie ma.");
                return;
            }
            partId = found;
        }

        var sheet = await SheetAsync(connection, partId, ctx.RequestAborted);
        if (sheet is null || !await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        await using var back = new SqlCommand("UPDATE app.slug_field SET removed_at = NULL WHERE id = @id;", connection);
        back.Parameters.AddWithValue("@id", id);
        await back.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { fieldId = Ids.ToText(id), restored = true });
    }

    /// <summary>
    /// 0086 — DIE FRAGEN DER EINGESCHALTETEN WYMAGANIA (`config.needs`):
    /// Kennung → Name des Wymaganie. Die Einstellung liest der Dienst ohnehin
    /// (sie ist nicht versiegelt) — also prüft er auch hier und nicht nur der Browser.
    /// </summary>
    internal static async Task<Dictionary<Guid, string>> LockedFieldsAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT config FROM app.module WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", moduleId);
        return LockedFields(await cmd.ExecuteScalarAsync(ct) as string);
    }

    /// <summary>Dasselbe aus dem Text der Einstellung — ohne Datenbank, zum Prüfen.</summary>
    public static Dictionary<Guid, string> LockedFields(string? config)
    {
        var out_ = new Dictionary<Guid, string>();
        if (string.IsNullOrWhiteSpace(config)) return out_;

        try
        {
            var flat = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(config);
            if (flat is null || !flat.TryGetValue("needs", out var needs) || string.IsNullOrWhiteSpace(needs)) return out_;

            /* Eine Liste: [{ "id", "label", "fields": [kennungen], … }] (formTemplates.ts). */
            using var doc = System.Text.Json.JsonDocument.Parse(needs);
            if (doc.RootElement.ValueKind != System.Text.Json.JsonValueKind.Array) return out_;

            foreach (var need in doc.RootElement.EnumerateArray())
            {
                if (need.ValueKind != System.Text.Json.JsonValueKind.Object) continue;
                var id = need.TryGetProperty("id", out var i) && i.ValueKind == System.Text.Json.JsonValueKind.String ? i.GetString() ?? "" : "";
                var label = need.TryGetProperty("label", out var l) && l.ValueKind == System.Text.Json.JsonValueKind.String
                    ? l.GetString() ?? id : id;
                if (!need.TryGetProperty("fields", out var fields) || fields.ValueKind != System.Text.Json.JsonValueKind.Array) continue;
                foreach (var one in fields.EnumerateArray())
                {
                    if (one.ValueKind == System.Text.Json.JsonValueKind.String && Guid.TryParse(one.GetString(), out var fieldId))
                        out_.TryAdd(fieldId, label);
                }
            }
        }
        catch (System.Text.Json.JsonException)
        {
            /* Unlesbar heisst: nichts gesperrt — eine kaputte Einstellung darf das Formular nicht festnageln. */
        }

        return out_;
    }

    /* -- Eine Frage aendern (0042) ------------------------------------------ */

    /// <summary>Ein Wertschluessel, fuer die Annahme eines ANDEREN Bereichs neu verpackt.</summary>
    public sealed record MovedValue(string RegistrationId, string WrappedKey, string? OfficeKeySealed);

    /// <summary>
    /// <c>MoveTo</c>: wohin die Antworten ab jetzt gehen — mit JEDER vorhandenen
    /// Antwort neu verpackt (<c>Moved</c>). Der Wert selbst bleibt, wie er ist:
    /// jede Antwort hat ihren eigenen Schluessel, und nur dessen Huellen
    /// wechseln. Auch die des Menschen (<c>seat_key_sealed</c>) bleibt.
    /// </summary>
    public sealed record FieldUpdate(
        string LabelSealed, string? HelpSealed, string? OptionsSealed,
        string? LabelAreaId, int? LabelEpoch,
        string? Kind, bool? IsRequired, bool? IsHalfWidth, string? IdentityRole,
        string? MoveTo = null, IReadOnlyList<MovedValue>? Moved = null,

        /* Fehlt es, bleibt es, wie es war (0044). */
        bool? SelfEdit = null,

        /* 0093 — nur der Mensch schreibt und berichtigt; fehlt es, bleibt es, wie es war. */
        bool? PersonOnly = null);

    /// <summary>
    /// Eine vorhandene Frage aendern.
    ///
    /// <para>
    /// <b>Fast alles geht.</b> Text, Hilfe, Auswahl — neu versiegelt im
    /// Browser, unter dem Schluessel des Formulars. Pflicht, halbe Breite,
    /// welche Angabe sie ist. Die FORM nur, solange niemand geantwortet hat:
    /// aus einer Datumsantwort wird durch eine neue Form kein Datum.
    /// </para>
    ///
    /// <para>
    /// <b>Und wohin die Antworten gehen.</b> Der Dienst kann nichts
    /// umschluesseln — aber er muss es auch nicht: der Browser der Kanzlei hat
    /// jeden Wertschluessel geoeffnet und fuer die Annahme des neuen Bereichs
    /// verpackt. Der Dienst prueft, dass es ALLE sind, und tauscht die Huellen
    /// in einer Transaktion. Eine Antwort, die vergessen wuerde, laege danach
    /// unter einem Schluessel, den niemand mehr zur Hand nimmt.
    /// </para>
    /// </summary>
    private static async Task UpdateFieldAsync(HttpContext ctx, Db db, Guid id, FieldUpdate body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        byte[] label;
        try { label = Base64Url.Decode(body.LabelSealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana etykieta.");
            return;
        }

        if (label.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Pole potrzebuje etykiety.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid partId, areaNow;
        string kindNow;

        await using (var find = new SqlCommand(
            "SELECT part_id, area_id, kind FROM app.slug_field WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego pola nie ma.");
                return;
            }

            partId = reader.GetGuid(0);
            areaNow = reader.GetGuid(1);
            kindNow = reader.GetString(2);
        }

        var sheet = await SheetAsync(connection, partId, ctx.RequestAborted);
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

        /*
         * Die Frage muss unter dem Schluessel des FORMULARS liegen, wenn es
         * einen Bereich hat. Hat es keinen, unter dem ihrer Antworten — dann
         * kommt nichts mit, und die Zeile bleibt, wie vor 0042.
         */
        var (labelArea, labelEpoch, labelFail) = LabelPlace(sheet, body.LabelAreaId, body.LabelEpoch);
        if (labelFail is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, labelFail);
            return;
        }

        if (sheet.AreaId is not null && labelArea is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Pytanie pieczętuje się kluczem obszaru formularza.");
            return;
        }

        var identity = (body.IdentityRole ?? "none").Trim().ToLowerInvariant();
        if (!IdentityRoles.Contains(identity))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Rola pola: none albo jedna z danych osoby (given_name, surname, …).");
            return;
        }

        var kind = (body.Kind ?? kindNow).Trim().ToLowerInvariant();
        if (!Kinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany rodzaj pola.");
            return;
        }

        var answered = new List<Guid>();

        await using (var who2 = new SqlCommand(
            "SELECT registration_id FROM app.registration_value WHERE field_id = @id;", connection))
        {
            who2.Parameters.AddWithValue("@id", id);
            await using var reader = await who2.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) answered.Add(reader.GetGuid(0));
        }

        if (kind != kindNow && answered.Count > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Na to pytanie już odpowiadano — rodzaju odpowiedzi nie da się zmienić.");
            return;
        }

        /* -- Wohin die Antworten gehen ------------------------------------- */

        Guid? moveTo = null;
        var moved = new Dictionary<Guid, (byte[] Wrapped, byte[]? Office)>();

        if (!string.IsNullOrWhiteSpace(body.MoveTo))
        {
            if (!Guid.TryParse(body.MoveTo, out var target))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar docelowy.");
                return;
            }

            if (target != areaNow)
            {
                if (!await Area.MayAsync(connection, who.Value.AccountId, target, Capability.Write, ctx.RequestAborted))
                {
                    await Fail(ctx, StatusCodes.Status403Forbidden,
                        "Pod obszar, w którym nie możesz pisać, nie skierujesz odpowiedzi.");
                    return;
                }

                await using (var has = new SqlCommand(
                    "SELECT TOP 1 1 FROM app.intake WHERE area_id = @a;", connection))
                {
                    has.Parameters.AddWithValue("@a", target);
                    if (await has.ExecuteScalarAsync(ctx.RequestAborted) is null)
                    {
                        await Fail(ctx, StatusCodes.Status409Conflict,
                            "Obszar docelowy nie ma klucza przyjmowania — najpierw go utwórz.");
                        return;
                    }
                }

                foreach (var one in body.Moved ?? [])
                {
                    if (!Guid.TryParse(one.RegistrationId, out var reg))
                    {
                        await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zgłoszenie.");
                        return;
                    }

                    try
                    {
                        var wrapped = Base64Url.Decode(one.WrappedKey ?? string.Empty);
                        if (wrapped.Length == 0) throw new FormatException();
                        moved[reg] = (wrapped, Optional(one.OfficeKeySealed));
                    }
                    catch (FormatException)
                    {
                        await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna koperta odpowiedzi.");
                        return;
                    }
                }

                /* ALLE — sonst bliebe eine Antwort unter dem alten Schluessel zurueck. */
                if (!moved.Keys.ToHashSet().SetEquals(answered))
                {
                    await Fail(ctx, StatusCodes.Status409Conflict,
                        "Nie wszystkie odpowiedzi zostały przepakowane — otwórz zgłoszenia i spróbuj jeszcze raz.");
                    return;
                }

                moveTo = target;
            }
        }

        /* Ohne Formularbereich liegt die Frage unter dem ihrer Antworten — also dem neuen. */
        if (sheet.AreaId is null && moveTo is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Formularz nie ma własnego obszaru — ustaw go najpierw, wtedy pytanie da się przenieść.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var save = new SqlCommand("""
                UPDATE app.slug_field
                   SET label_sealed = @label, help_sealed = @help, options_sealed = @options,
                       label_area_id = @labelArea, label_epoch = @labelEpoch,
                       kind = @kind, is_required = @required, is_half_width = @half,
                       identity_role = @identity,
                       person_only = COALESCE(@personOnly, person_only),
                       self_edit = CASE WHEN COALESCE(@personOnly, person_only) = 1 THEN 1 ELSE COALESCE(@selfEdit, self_edit) END,
                       area_id = COALESCE(@moveTo, area_id)
                 WHERE id = @id;
                """, connection, tx))
            {
                save.Parameters.AddWithValue("@label", label);
                save.Parameters.AddBlob("@help", Optional(body.HelpSealed));
                save.Parameters.AddBlob("@options", Optional(body.OptionsSealed));
                save.Parameters.AddWithValue("@labelArea", (object?)labelArea ?? DBNull.Value);
                save.Parameters.AddWithValue("@labelEpoch", (object?)labelEpoch ?? DBNull.Value);
                save.Parameters.AddWithValue("@kind", kind);
                save.Parameters.AddWithValue("@required", body.IsRequired ?? false);
                save.Parameters.AddWithValue("@half", body.IsHalfWidth ?? false);
                save.Parameters.AddWithValue("@identity", identity);
                save.Parameters.AddWithValue("@moveTo", (object?)moveTo ?? DBNull.Value);
                save.Parameters.Add("@selfEdit", System.Data.SqlDbType.Bit).Value = (object?)body.SelfEdit ?? DBNull.Value;
                save.Parameters.Add("@personOnly", System.Data.SqlDbType.Bit).Value = (object?)body.PersonOnly ?? DBNull.Value;
                save.Parameters.AddWithValue("@id", id);
                await save.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (reg, (wrapped, office)) in moved)
            {
                await using var swap = new SqlCommand("""
                    UPDATE app.registration_value
                       SET wrapped_key = @wrapped, office_key_sealed = @office
                     WHERE registration_id = @reg AND field_id = @id;
                    """, connection, tx);
                swap.Parameters.AddWithValue("@wrapped", wrapped);
                swap.Parameters.AddBlob("@office", office);
                swap.Parameters.AddWithValue("@reg", reg);
                swap.Parameters.AddWithValue("@id", id);
                await swap.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            fieldId = Ids.ToText(id),
            areaId = Ids.ToText(moveTo ?? areaNow),
            moved = moved.Count
        });
    }
}
