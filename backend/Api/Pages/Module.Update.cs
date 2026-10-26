using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Einen Baustein ändern (Name, Bereich, Gegenstand, Klausel, Gruppe) und entfernen.</summary>
public static partial class Module
{
    /* -- Aendern ------------------------------------------------------------- */

    /// <summary>Eine Frage, unter dem Schluessel des NEUEN Bereichs versiegelt (0042).</summary>
    public sealed record ResealIn(
        string FieldId, string LabelSealed, string? HelpSealed, string? OptionsSealed, int LabelEpoch);

    public sealed record UpdateRequest(
        string? Name, string? AreaId, bool ClearArea = false, string? Config = null,
        string? ForKind = null,

        /* 0042 — das Formular als Ganzes. */
        bool? Closed = null, IReadOnlyList<ResealIn>? Reseal = null,

        /* 0043 — der Aufbau, unter dem Schluessel des neuen Bereichs. */
        string? DesignSealed = null, int? DesignEpoch = null,

        /* 0077 — wie oft eine Erweiterung ausgefüllt wird. Nur, solange nichts eingetragen ist. */
        string? Repeat = null,

        /* 0096 — wer ein Unterformular ausfüllt (person | office), solange nichts eingetragen ist. */
        string? Audience = null,

        /* 0096 — in welche Gruppe von Formularen (oder aus ihr heraus). */
        string? GroupId = null, bool ClearGroup = false,

        /* 0097 — der neue Name eines Formulars, versiegelt unter dem Schlüssel seines (neuen) Bereichs. */
        string? NameSealed = null, int? NameEpoch = null);

    /// <summary>
    /// Umbenennen, den Bereich setzen, die Einstellung aendern.
    ///
    /// <para>
    /// <b>Den Bereich zu WECHSELN ist kein Umbenennen.</b> Was unter dem alten
    /// Schluessel liegt, bleibt darunter liegen — der Dienst kann es nicht
    /// umschluesseln, er hat keinen Schluessel. Deshalb ist es nur erlaubt,
    /// solange der Baustein nichts traegt: keine Felder, keine Einsendungen.
    /// Andernfalls stuende danach ein Bereich an einem Baustein, dessen Inhalt
    /// woanders liegt, und niemand saehe den Widerspruch.
    /// </para>
    /// </summary>
    private static async Task UpdateAsync(HttpContext ctx, Db db, Guid id, UpdateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ReadAsync(connection, id, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego modułu nie ma.");
            return;
        }

        if (!await MayTendAsync(ctx, db, connection, found.Value, who.Value.AccountId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego modułu nie prowadzisz.");
            return;
        }

        /*
         * 0077 — WIE OFT. Zu ändern nur an einer Erweiterung, und nur, solange
         * nichts eingetragen ist: jede Einsendung trägt den Zeitraum IHRER Art,
         * und ein „2026-10" passt in keine Woche.
         */
        string? repeat = null;

        if (!string.IsNullOrWhiteSpace(body.Repeat))
        {
            repeat = body.Repeat.Trim().ToLowerInvariant();

            if (!Rounds.IsKind(repeat))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Powtarzanie: once, day, week, month albo year.");
                return;
            }

            if (repeat == found.Value.Repeat)
            {
                repeat = null;
            }
            else if (found.Value.ExtendsId is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Powtarza się tylko rozszerzenie — zwykły formularz jest samą listą osób.");
                return;
            }
            else if (found.Value.Entries > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "To rozszerzenie ma już wpisy — powtarzanie zmienia się tylko w pustym.");
                return;
            }
        }

        /*
         * 0096 — WER EIN UNTERFORMULAR AUSFÜLLT: die Person über ihren Link, oder
         * nur die Kanzlei. Zu ändern, solange nichts eingetragen ist — wer schon
         * ausgefüllt hat, tat es unter der alten Regel.
         */
        string? audience = null;
        if (!string.IsNullOrWhiteSpace(body.Audience))
        {
            audience = body.Audience.Trim().ToLowerInvariant();
            if (audience is not ("person" or "office"))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Kto wypełnia: person albo office.");
                return;
            }

            if (audience == found.Value.Audience) audience = null;
            else if (found.Value.ExtendsId is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "To ustawia się tylko w podformularzu.");
                return;
            }
            else if (found.Value.Entries > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten podformularz ma już wpisy — kto wypełnia, zmienia się tylko w pustym.");
                return;
            }
        }

        /* 0096 — in eine Gruppe (die ich sehe) oder aus ihr heraus. */
        Guid? groupWanted = null;
        var groupTouched = body.ClearGroup || !string.IsNullOrWhiteSpace(body.GroupId);
        var groupMine = groupTouched ? await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted) : [];
        if (!body.ClearGroup && !string.IsNullOrWhiteSpace(body.GroupId))
        {
            if (!Guid.TryParse(body.GroupId, out var g) || !(await GroupAccessAsync(connection, g, groupMine, ctx.RequestAborted)).Sees)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej grupy nie ma.");
                return;
            }
            if (found.Value.Kind != "form")
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Do grupy formularzy trafiają tylko formularze.");
                return;
            }
            groupWanted = g;
        }

        Guid? areaId = found.Value.AreaId;
        var moving = false;

        if (body.ClearArea)
        {
            /*
             * NICHT INS NICHTS. Wer einen Baustein pflegen darf, entscheidet
             * sein Bereich ODER die Seite, auf der er steht. Faellt der
             * Bereich weg, waehrend er nirgends steht, bliebe ein Ding uebrig,
             * das niemand mehr aendern und niemand mehr loeschen kann.
             *
             * Das ist kein hypothetischer Fall: er entsteht beim ersten
             * Versuch, einen frisch angelegten Baustein aus seinem Bereich zu
             * nehmen.
             */
            if (found.Value.Used == 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Ten moduł nie stoi na żadnej stronie — bez obszaru nikt nie mógłby go już tknąć. "
                    + "Najpierw postaw go gdzieś albo przenieś do innego obszaru.");
                return;
            }

            areaId = null;
            moving = found.Value.AreaId is not null;
        }
        else if (!string.IsNullOrWhiteSpace(body.AreaId))
        {
            if (!Guid.TryParse(body.AreaId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru.");
                return;
            }

            moving = wanted != found.Value.AreaId;
            areaId = wanted;

            if (moving && !await Area.MayAsync(connection, who.Value.AccountId, wanted,
                    Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
                return;
            }
        }

        /*
         * UMZIEHEN MIT NEU VERSIEGELTEN FRAGEN (0042).
         *
         * Der Dienst kann nichts umschluesseln — der Browser aber schon: er
         * hat den alten Schluessel und den neuen, oeffnet jede Frage und
         * versiegelt sie neu. Kommen ALLE Fragen mit, ist der Umzug erlaubt;
         * die ANTWORTEN bleiben ohnehin, wo sie sind — sie gehoeren dem
         * Bereich ihrer Frage, nicht dem des Formulars.
         *
         * Ins Nichts nicht: ohne Bereich haette eine Frage keinen Schluessel,
         * unter dem sie liegen koennte.
         */
        var resealed = new Dictionary<Guid, (byte[] Label, byte[]? Help, byte[]? Options, int Epoch)>();

        /*
         * DER AUFBAU ZIEHT MIT (0043). Er liegt unter demselben Schluessel wie
         * die Fragen; ohne neue Huelle bliebe er unter dem alten, und das
         * Formular zeigte seine Fragen, aber nicht mehr seine Ordnung.
         */
        var hasDesign = false;
        await using (var look = new SqlCommand("SELECT 1 FROM app.form_design WHERE module_id = @id;", connection))
        {
            look.Parameters.AddWithValue("@id", id);
            hasDesign = await look.ExecuteScalarAsync(ctx.RequestAborted) is not null;
        }

        byte[]? designSealed = null;

        if (moving && hasDesign)
        {
            if (areaId is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Formularz z układem potrzebuje obszaru — układ jest zapieczętowany jego kluczem.");
                return;
            }

            try { designSealed = Base64Url.Decode(body.DesignSealed ?? string.Empty); }
            catch (FormatException) { designSealed = null; }

            if (designSealed is null || designSealed.Length == 0 || body.DesignEpoch is null or < 1)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Żeby zmienić obszar, trzeba przepieczętować też układ formularza — odśwież i spróbuj jeszcze raz.");
                return;
            }
        }

        if (moving && found.Value.Fields > 0)
        {
            if (areaId is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Formularz z pytaniami potrzebuje obszaru — pytania są zapieczętowane jego kluczem.");
                return;
            }

            foreach (var one in body.Reseal ?? [])
            {
                if (!Guid.TryParse(one.FieldId, out var fieldId) || one.LabelEpoch < 1)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne pytanie do przepieczętowania.");
                    return;
                }

                try
                {
                    var label = Base64Url.Decode(one.LabelSealed ?? string.Empty);
                    if (label.Length == 0) throw new FormatException();

                    resealed[fieldId] = (label,
                        string.IsNullOrWhiteSpace(one.HelpSealed) ? null : Base64Url.Decode(one.HelpSealed),
                        string.IsNullOrWhiteSpace(one.OptionsSealed) ? null : Base64Url.Decode(one.OptionsSealed),
                        one.LabelEpoch);
                }
                catch (FormatException)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne pytanie do przepieczętowania.");
                    return;
                }
            }

            var all = new HashSet<Guid>();
            await using (var ask = new SqlCommand("SELECT id FROM app.slug_field WHERE part_id = @id;", connection))
            {
                ask.Parameters.AddWithValue("@id", id);
                await using var reader = await ask.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) all.Add(reader.GetGuid(0));
            }

            if (!all.SetEquals(resealed.Keys))
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Żeby zmienić obszar, trzeba przepieczętować wszystkie pytania — odśwież i spróbuj jeszcze raz.");
                return;
            }
        }

        /*
         * WOVON ER HANDELT, steht fest, sobald etwas eingegangen ist (0038).
         *
         * An `for_kind` haengt, woran der Platz einer Einsendung haengt: an
         * einem Menschen, an einer Gruppe, an einem Amt. Waere das im
         * Nachhinein umstellbar, stuenden vorhandene Plaetze an einer Aussage,
         * die zu ihrer Entstehung niemand getroffen hat — und niemand saehe es
         * ihnen an. Solange nichts eingegangen ist, ist es eine Einstellung wie
         * jede andere.
         */
        var forKind = (body.ForKind ?? found.Value.ForKind).Trim().ToLowerInvariant();

        if (Array.IndexOf(Subjects, forKind) < 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Moduł dotyczy: none, person, group albo role.");
            return;
        }

        if (forKind != found.Value.ForKind && found.Value.Entries > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten moduł ma już zgłoszenia — tego, kogo dotyczy, nie da się już zmienić.");
            return;
        }

        /*
         * 0097 — DER NAME EINES FORMULARS kommt nur versiegelt, unter dem
         * Schlüssel des Bereichs, in dem es danach steht. Zieht es um, muss er
         * mit (wie die Fragen und der Aufbau) — sonst läge er unter einem
         * Schlüssel, den der neue Bereich nicht hat.
         */
        var isForm = found.Value.Kind == "form";
        string? name = null;
        var (nameSealed, nameEpoch, nameError) = Names.Read(body.NameSealed, body.NameEpoch);

        if (nameError is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, nameError);
            return;
        }

        if (isForm)
        {
            if (!string.IsNullOrWhiteSpace(body.Name) && nameSealed is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nazwa formularza idzie zapieczętowana kluczem jego obszaru.");
                return;
            }

            if (areaId is null && (nameSealed is not null || found.Value.HasSealedName))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Formularz potrzebuje obszaru — pod jego kluczem leży nazwa.");
                return;
            }

            if (nameSealed is not null)
            {
                if (await Names.EpochProblemAsync(connection, null, areaId!.Value, nameEpoch, person: false, ctx.RequestAborted) is { } problem)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, problem);
                    return;
                }
            }
            else if (moving && found.Value.HasSealedName)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Żeby zmienić obszar, trzeba przepieczętować też nazwę formularza — odśwież i spróbuj jeszcze raz.");
                return;
            }
        }
        else
        {
            name = (body.Name ?? found.Value.Name ?? string.Empty).Trim();
            if (name.Length is 0 or > MaxName)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nazwa: od 1 do {MaxName} znaków.");
                return;
            }
        }

        if ((body.Config?.Length ?? 0) > MaxConfig)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Ustawienia: najwyżej {MaxConfig} znaków.");
            return;
        }

        /* 0121 — ein Baustein auf einer versiegelten Seite ändert sich im Editor DIESER Seite: nur dort ist ihr Schlüssel. */
        if (body.Config is not null && await Page.ModuleSealConflictAsync(connection, id, body.Config, ctx.RequestAborted) is { } sealConflict)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, sealConflict);
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var cmd = new SqlCommand("""
                UPDATE app.module
                   SET name = @name,
                       name_sealed = CASE WHEN @nameSealed IS NULL THEN name_sealed ELSE @nameSealed END,
                       name_epoch = CASE WHEN @nameSealed IS NULL THEN name_epoch ELSE @nameEpoch END,
                       area_id = @area,
                       /* 0133 — zieht das Formular um, ziehen seine Fragen mit (sie werden unter dem neuen Bereich versiegelt). */
                       label_area_id = CASE WHEN area_id IS NULL OR @area IS NULL OR area_id <> @area THEN NULL ELSE label_area_id END,
                       for_kind = @for,
                       config = CASE WHEN @config IS NULL THEN config ELSE @config END,
                       repeat_kind = COALESCE(@repeat, repeat_kind),
                       closed_at = CASE WHEN @closed IS NULL THEN closed_at
                                        WHEN @closed = 1 THEN COALESCE(closed_at, @now)
                                        ELSE NULL END
                 WHERE id = @id;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@name", (object?)name ?? DBNull.Value);
                cmd.Parameters.AddBlob("@nameSealed", nameSealed);
                cmd.Parameters.AddWithValue("@nameEpoch", nameSealed is null ? DBNull.Value : nameEpoch);
                cmd.Parameters.AddWithValue("@for", forKind);
                cmd.Parameters.AddWithValue("@area", (object?)areaId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@config", (object?)body.Config ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@closed", body.Closed is null ? DBNull.Value : body.Closed.Value);
                cmd.Parameters.AddWithValue("@repeat", (object?)repeat ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                cmd.Parameters.AddWithValue("@id", id);

                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (audience is not null)
            {
                await using var who2 = new SqlCommand("UPDATE app.module SET audience = @aud WHERE id = @id;", connection, tx);
                who2.Parameters.AddWithValue("@aud", audience);
                who2.Parameters.AddWithValue("@id", id);
                await who2.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (groupTouched)
            {
                await PlaceInGroupAsync(connection, tx, found.Value, groupWanted, groupMine, ctx.RequestAborted);
            }

            if (designSealed is not null)
            {
                await using var design = new SqlCommand("""
                    UPDATE app.form_design SET area_id = @area, epoch = @epoch, sealed = @sealed, updated_at = @now
                     WHERE module_id = @id;
                    """, connection, tx);
                design.Parameters.AddWithValue("@area", areaId!.Value);
                design.Parameters.AddWithValue("@epoch", body.DesignEpoch!.Value);
                design.Parameters.AddWithValue("@sealed", designSealed);
                design.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                design.Parameters.AddWithValue("@id", id);
                await design.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (fieldId, (label, help, options, epoch)) in resealed)
            {
                await using var seal = new SqlCommand("""
                    UPDATE app.slug_field
                       SET label_sealed = @label, help_sealed = @help, options_sealed = @options,
                           label_area_id = @area, label_epoch = @epoch
                     WHERE id = @field AND part_id = @id;
                    """, connection, tx);
                seal.Parameters.AddWithValue("@label", label);
                seal.Parameters.AddBlob("@help", help);
                seal.Parameters.AddBlob("@options", options);
                seal.Parameters.AddWithValue("@area", areaId!.Value);
                seal.Parameters.AddWithValue("@epoch", epoch);
                seal.Parameters.AddWithValue("@field", fieldId);
                seal.Parameters.AddWithValue("@id", id);
                await seal.ExecuteNonQueryAsync(ctx.RequestAborted);
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
            moduleId = Ids.ToText(id),
            areaId = areaId is null ? null : Ids.ToText(areaId.Value),
            name,
            forKind
        });
    }

    /* -- Entfernen ----------------------------------------------------------- */

    /// <summary>
    /// Einen Baustein loeschen.
    ///
    /// <para>
    /// <b>Nicht, solange er irgendwo steht</b> — sonst verschwaende eine Seite
    /// mitten im Betrieb einen Kasten, und niemand wuesste warum. Und nicht,
    /// solange er Einsendungen traegt: die gehoeren den Menschen, die sie
    /// geschickt haben.
    /// </para>
    /// </summary>
    /// <param name="fromPages">
    /// 0099 — nur fuer ein UNTERFORMULAR: es auch von den Seiten nehmen, auf
    /// denen es steht — wenn der Aufrufer jede davon bearbeiten darf. Wer ein
    /// Unterformular loswerden will, soll nicht erst jede Seite suchen muessen.
    /// </param>
    private static async Task RemoveAsync(HttpContext ctx, Db db, Guid id, bool? fromPages)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ReadAsync(connection, id, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego modułu nie ma.");
            return;
        }

        if (!await MayTendAsync(ctx, db, connection, found.Value, who.Value.AccountId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego modułu nie prowadzisz.");
            return;
        }

        var offPages = fromPages == true && found.Value.ExtendsId is not null && found.Value.Used > 0;

        if (found.Value.Used > 0 && !offPages)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten moduł stoi jeszcze na {found.Value.Used} stronach — najpierw go stamtąd zdejmij.");
            return;
        }

        if (offPages)
        {
            var paths = new List<string>();
            await using (var where = new SqlCommand("""
                SELECT DISTINCT s.path FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id WHERE p.module_id = @id;
                """, connection))
            {
                where.Parameters.AddWithValue("@id", id);
                await using var reader = await where.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) paths.Add(reader.GetString(0));
            }

            foreach (var path in paths)
            {
                if (!(await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted)).MayWrite)
                {
                    await Fail(ctx, StatusCodes.Status403Forbidden,
                        $"Ten podformularz stoi na stronie „{(path == Slug.Home ? "recreatio.pl" : path)}\", której nie edytujesz — tam trzeba go zdjąć.");
                    return;
                }
            }
        }

        if (found.Value.Entries > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten moduł ma zgłoszenia — one należą do tych, którzy je wysłali.");
            return;
        }

        await using (var ext = new SqlCommand(
            "SELECT COUNT(*) FROM app.module WHERE extends_id = @id;", connection))
        {
            ext.Parameters.AddWithValue("@id", id);
            if ((int)(await ext.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Ten formularz ma rozszerzenia — najpierw usuń je.");
                return;
            }
        }

        /* Alles oder nichts — eine Seite ohne den Baustein, aber mit seinen Fragen, hilft niemandem. */
        await using var cmd = new SqlCommand("""
            SET XACT_ABORT ON;
            BEGIN TRANSACTION;
            IF @offPages = 1 DELETE FROM app.slug_part WHERE module_id = @id;
            /* 0091 — ein Rollenzugang „über dieses Formular" bleibt, nur ohne das Formular. */
            UPDATE app.access_role SET module_id = NULL WHERE module_id = @id;
            /*
               0120 — seine Rollen gehen mit; seine virtuellen Bereiche bleiben als
               gewöhnliche Bereiche stehen (Kleinbereiche hat ein Formular ohne
               Einsendungen keine). Bewacht: ohne die Migration fehlen die Tabellen.
            */
            IF OBJECT_ID(N'app.module_role', N'U') IS NOT NULL
                DELETE FROM app.module_role WHERE module_id = @id;
            IF OBJECT_ID(N'app.virtual_area', N'U') IS NOT NULL
                DELETE FROM app.virtual_area WHERE module_id = @id;
            DELETE FROM app.slug_field WHERE part_id = @id;
            DELETE FROM app.form_design WHERE module_id = @id;
            DELETE FROM app.task_answer WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @id);
            DELETE FROM app.task_day WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @id);
            DELETE FROM app.task_presence WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @id);
            DELETE FROM app.task_duty WHERE step_id IN (SELECT id FROM app.form_step WHERE module_id = @id);
            DELETE FROM app.form_step WHERE module_id = @id;
            DELETE FROM app.audience_form WHERE module_id = @id OR (subject_kind = N'module' AND subject_id = @id);
            DELETE FROM app.module WHERE id = @id;
            COMMIT TRANSACTION;
            """, connection);

        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@offPages", offPages);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { moduleId = Ids.ToText(id), removed = true });
    }
}
