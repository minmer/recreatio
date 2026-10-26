using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Ein Eintrag im Kalender — anlegen, ändern, eine Ausnahme in seiner Reihe.</summary>
public static partial class Calendar
{
    /* -- Ein Eintrag -------------------------------------------------------- */

    /// <summary>Ein versiegeltes Feld, wie der Browser es schickt.</summary>
    public sealed record SealedField(string Field, string AreaId, int Epoch, string Sealed);

    public sealed record ItemRequest(
        string OwnerRoleId, string VisibilityAreaId, string? Kind,
        string Date, string Time, int? Minutes, bool? AllDay,
        string? TitlePublic, string? Status,
        string? Repeat, int? Every, int? Weekdays, string? Until, int? Count,
        IReadOnlyList<SealedField>? Fields,

        /*
         * DIE KENNUNG ENTSTEHT IM BROWSER — wie beim Bereich und beim Platz.
         *
         * Sie MUSS es, sobald ein Feld versiegelt wird: die AAD eines Feldes
         * nennt den Eintrag, und der Browser versiegelt, bevor der Dienst
         * antwortet. Muenzte der Dienst die Kennung, naennte jede Huelle eine
         * andere als die, unter der sie liegt — und ginge nie wieder auf.
         *
         * Genau das war der Fall, und es fiel nicht auf, weil derselbe Irrtum
         * beim Oeffnen wiederholt wurde: der Pruefstand versiegelte und oeffnete
         * mit SEINER Kennung und war sich mit sich selbst einig.
         */
        string? ItemId,

        /* 0054 — die Zone, falls der Terminarz des Bereichs dabei erst entsteht. */
        string? TimeZone = null,

        /*
         * 0058 — WAS DIESER TERMIN FÜR SICH SAGT (NULL: wie der Kalender):
         * ob man ihn reservieren kann, wie viele Plätze er hat, und wer ihn
         * reservieren darf ("" = jeder, der ihn findet).
         */
        bool? Bookable = null, int? Capacity = null, string? ReserveAreaId = null,

        /* 0058 — beim Ändern: in DIESEN Kalender (sonst bleibt er, wo er ist). */
        string? CalendarId = null,

        /*
         * 0070 — TEIL EINES TERMINS: unter welchem (NULL: wie bisher; "": keiner),
         * an welcher Stelle; und aus welcher Rozmowa / welchem Thema er entstand.
         */
        string? ParentItemId = null, int? Position = null, string? ChatId = null, string? TopicId = null,

        /*
         * 0132 — DAS SCHEMA UND SEINE WERTE. `SchemeId`: fehlt — bleibt (neu: das
         * universelle); "" — das universelle; sonst ein Schema DIESES Kalenders.
         * `Values`: fehlt — bleiben; sonst ersetzen sie alle Werte am Termin.
         * `PlanOrigin`: woher aus einem Plan (nur beim Anlegen, nur für die Vorschau).
         */
        string? SchemeId = null, IReadOnlyList<ValueIn>? Values = null, string? PlanOrigin = null);

    /// <summary>
    /// Einen Eintrag anlegen.
    ///
    /// <para>
    /// <b>Datum und Uhrzeit kommen als ORTSZEIT.</b> Wer „18:00" eintraegt,
    /// meint 18 Uhr dort, wo es stattfindet — nicht einen Augenblick auf der
    /// Weltuhr. Erst hier wird daraus, mit der Zone des Kalenders, ein Zeitpunkt.
    /// </para>
    ///
    /// <para>
    /// <b>Der Sichtbarkeitsbereich muss einer sein, in dem man schreiben darf.</b>
    /// Sonst legte man einen Eintrag unter einen fremden Schluessel und
    /// entzoege ihn damit sich selbst — oder schoebe ihn in eine Oeffentlichkeit,
    /// die einem nicht gehoert.
    /// </para>
    /// </summary>
    internal static async Task AddItemAsync(HttpContext ctx, Db db, Guid id, ItemRequest body)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        var status = (body.Status ?? "planned").Trim().ToLowerInvariant();
        var repeat = (body.Repeat ?? "none").Trim().ToLowerInvariant();

        /* 0058 — ohne Angabe: was ein Termin in DIESEM Kalender ist. */
        if (kind == "")
        {
            await using var connectionForKind = await db.OpenAsync(ctx.RequestAborted);
            await using var find = new SqlCommand("SELECT item_kind FROM app.calendar WHERE id = @id;", connectionForKind);
            find.Parameters.AddWithValue("@id", id);
            kind = await find.ExecuteScalarAsync(ctx.RequestAborted) as string ?? "appointment";
        }

        var ownRules = await ItemRulesAsync(ctx, db, body);
        if (ownRules is null) return;

        if (!ItemKinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Rodzaj: spotkanie, zadanie, msza, spowiedź, nabożeństwo albo odwiedziny.");
            return;
        }

        if (status is not ("planned" or "confirmed" or "cancelled"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Stan: planowane, potwierdzone albo odwołane.");
            return;
        }

        if (repeat is not ("none" or "daily" or "weekly" or "monthly" or "yearly"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Powtórzenie: raz, codziennie, co tydzień, co miesiąc albo co rok.");
            return;
        }

        if (!Guid.TryParse(body.OwnerRoleId, out var ownerRoleId)
            || !Guid.TryParse(body.VisibilityAreaId, out var visibilityAreaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (!DateOnly.TryParse(body.Date, out var day) || !TimeOnly.TryParse(body.Time, out var hour))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej daty albo godziny.");
            return;
        }

        var fields = body.Fields ?? [];
        var sealedFields = new List<(string Field, Guid AreaId, int Epoch, byte[] Blob)>();

        foreach (var one in fields)
        {
            var name = (one.Field ?? string.Empty).Trim().ToLowerInvariant();

            if (!SealableFields.Contains(name))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Zapieczętować można tytuł, miejsce, notatkę albo link.");
                return;
            }

            if (!Guid.TryParse(one.AreaId, out var fieldArea) || one.Epoch < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar albo epoka pola.");
                return;
            }

            byte[] blob;
            try { blob = Base64Url.Decode(one.Sealed ?? string.Empty); }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana treść.");
                return;
            }

            if (blob.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Puste pole nie jest zapieczętowane.");
                return;
            }

            sealedFields.Add((name, fieldArea, one.Epoch, blob));
        }

        if (sealedFields.Select(f => f.Field).Distinct().Count() != sealedFields.Count)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To samo pole dwa razy.");
            return;
        }

        /* 0132 — die Werte nach dem Schema, und woher aus einem Plan. */
        if (!ParseValues(body.Values, MaxItemValues, labels: true, sealedAllowed: true, allowEmpty: false,
                out var values, out var valueError))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, valueError);
            return;
        }

        if (!ValidOrigin(body.PlanOrigin))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne pochodzenie z planu.");
            return;
        }

        var planOrigin = string.IsNullOrEmpty(body.PlanOrigin) ? null : body.PlanOrigin;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await CalendarOfAsync(connection, id, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        var (areaId, zoneId) = found.Value;

        if (!await Area.MayAsync(connection, caller, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        /*
         * JEDER genannte Bereich muss einer sein, in dem man schreiben darf —
         * der des Daseins wie der jedes Feldes. Ohne diese Runde liesse sich
         * eine Huelle unter einen fremden Bereich haengen: sie stuende dort,
         * niemand koennte sie oeffnen, und der Fremde faende sie in seiner
         * Epoche wieder, ohne je davon gehoert zu haben.
         */
        foreach (var needed in sealedFields.Select(f => f.AreaId)
                     .Concat(values.Where(v => v.Blob is not null).Select(v => v.AreaId!.Value))
                     .Append(visibilityAreaId).Distinct())
        {
            if (!await Area.MayAsync(connection, caller, needed, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden,
                    "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
                return;
            }
        }

        /*
         * 0132 — vor der Migration gibt es weder Schemata noch Werte. Wer keine
         * schickt, merkt davon nichts; wer welche schickt, erfährt es.
         */
        var schemesReady = await Schema.RecordsAsync(connection, ctx.RequestAborted);
        if (!schemesReady && (values.Count > 0 || !string.IsNullOrWhiteSpace(body.SchemeId) || planOrigin is not null))
        {
            await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NeedsMigration);
            return;
        }

        Guid? schemeId = null;
        if (schemesReady && body.SchemeId is not null)
        {
            var scheme = await SchemeOfAsync(ctx, connection, id, body.SchemeId, ctx.RequestAborted);
            if (!scheme.Ok) return;
            schemeId = scheme.Scheme;
        }

        /* Wem er gehört: einer eigenen Rolle — bei einem Link der Linkrolle selbst. */
        var mine = caller.Roles;
        if (!mine.Any(r => r.Id == ownerRoleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        // Dem Konto wird nichts gegeben (0040) — nur Personen und Rollen darunter.
        if (Workspace.IsAccount(mine, ownerRoleId))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
            return;
        }

        var zone = Zones.Of(zoneId);
        var allDay = body.AllDay ?? false;
        var starts = Zones.AtLocal(day.ToDateTime(allDay ? new TimeOnly(0, 0) : hour), zone);
        /* 0054 — ein ganztägiger Termin kann mehrere Tage dauern, ein anderer bis zu zwei Wochen (eine Rüstzeit). */
        var ends = starts.AddMinutes(allDay
            ? 24 * 60 * Math.Clamp((body.Minutes ?? 1440) / 1440, 1, 60)
            : Math.Clamp(body.Minutes ?? 60, 1, 24 * 60 * 14));

        /*
         * EINE REIHE MUSS EIN ENDE HABEN — ein Datum oder eine Anzahl
         * (ck_item_repeat_end). Ohne das liesse sie sich nicht ausrechnen, nur
         * abschneiden, und jede Ansicht schnitte woanders ab.
         */
        DateTimeOffset? until = null;

        if (repeat != "none")
        {
            if (!string.IsNullOrWhiteSpace(body.Until) && DateOnly.TryParse(body.Until, out var end))
            {
                until = Zones.AtLocal(end.ToDateTime(new TimeOnly(23, 59, 59)), zone);
            }
            else if (body.Count is null or < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Seria musi mieć koniec — podaj ostatni dzień albo liczbę powtórzeń.");
                return;
            }
        }

        int? weekdays = repeat == "weekly"
            ? ((body.Weekdays ?? 0) == 0 ? Zones.BitOf(starts.DayOfWeek) : (body.Weekdays!.Value & 127))
            : null;

        /*
         * Ohne Kennung nur dann, wenn nichts versiegelt wird. Sonst entstuende
         * eine Huelle, die niemand je wieder oeffnet — und zwar lautlos.
         */
        Guid itemId;

        if (string.IsNullOrWhiteSpace(body.ItemId))
        {
            if (sealedFields.Count > 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Wpis z zapieczętowanym polem musi przyjść z własną kennung — "
                    + "inaczej etykieta wskazuje na co innego niż zapis.");
                return;
            }

            itemId = Ids.NewId();
        }
        else if (!Guid.TryParse(body.ItemId, out itemId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung wpisu.");
            return;
        }

        /* 0070 — Teil welches Termins, aus welcher Rozmowa. */
        var link = await ProgramLinkAsync(ctx, connection, caller, null, body);
        if (link is null) return;

        var now = DateTimeOffset.UtcNow;
        var titlePublic = (body.TitlePublic ?? string.Empty).Trim();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand($"""
                INSERT INTO app.calendar_item
                    (id, calendar_id, owner_role_id, kind, starts_at, ends_at, all_day,
                     title_public, visibility_area_id, status,
                     repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                     bookable, capacity, reserve_area_id,
                     created_at, updated_at, parent_item_id, position, chat_id, topic_id
                     {(schemesReady ? ", scheme_id, plan_origin" : "")})
                VALUES (@id, @cal, @owner, @kind, @starts, @ends, @allday,
                        @public, @varea, @status,
                        @rkind, @revery, @rdays, @runtil, @rcount,
                        @bookable, @capacity, @reserve,
                        @now, @now, @parent, @position, @chat, @topic
                        {(schemesReady ? ", @scheme, @origin" : "")});
                """, connection, tx))
            {
                if (schemesReady)
                {
                    insert.Parameters.AddWithValue("@scheme", (object?)schemeId ?? DBNull.Value);
                    insert.Parameters.AddWithValue("@origin", (object?)planOrigin ?? DBNull.Value);
                }

                insert.Parameters.AddWithValue("@bookable", (object?)ownRules.Value.Bookable ?? DBNull.Value);
                insert.Parameters.AddWithValue("@capacity", (object?)ownRules.Value.Capacity ?? DBNull.Value);
                insert.Parameters.AddWithValue("@reserve", (object?)ownRules.Value.ReserveAreaId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@id", itemId);
                insert.Parameters.AddWithValue("@cal", id);
                insert.Parameters.AddWithValue("@owner", ownerRoleId);
                insert.Parameters.AddWithValue("@kind", kind);
                insert.Parameters.AddWithValue("@starts", starts);
                insert.Parameters.AddWithValue("@ends", ends);
                insert.Parameters.AddWithValue("@allday", allDay);
                insert.Parameters.AddWithValue("@public", titlePublic == ""
                    ? DBNull.Value
                    : titlePublic[..Math.Min(titlePublic.Length, MaxTitle)]);
                insert.Parameters.AddWithValue("@varea", visibilityAreaId);
                insert.Parameters.AddWithValue("@status", status);
                insert.Parameters.AddWithValue("@rkind", repeat);
                insert.Parameters.AddWithValue("@revery", Math.Clamp(body.Every ?? 1, 1, 52));
                insert.Parameters.AddWithValue("@rdays", (object?)weekdays ?? DBNull.Value);
                insert.Parameters.AddWithValue("@runtil", (object?)until ?? DBNull.Value);
                insert.Parameters.AddWithValue("@rcount", (object?)body.Count ?? DBNull.Value);
                insert.Parameters.AddWithValue("@now", now);
                BindProgramLink(insert, link.Value);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (field, fieldArea, epoch, blob) in sealedFields)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.calendar_field (item_id, field, area_id, epoch, sealed_blob, updated_at)
                    VALUES (@item, @field, @area, @epoch, @blob, @now);
                    """, connection, tx);

                add.Parameters.AddWithValue("@item", itemId);
                add.Parameters.AddWithValue("@field", field);
                add.Parameters.AddWithValue("@area", fieldArea);
                add.Parameters.AddWithValue("@epoch", epoch);
                add.Parameters.AddWithValue("@blob", blob);
                add.Parameters.AddWithValue("@now", now);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            /* 0132 — die Werte am Termin. */
            if (schemesReady && values.Count > 0)
            {
                await ReplaceItemValuesAsync(connection, tx, itemId, null, values, now, ctx.RequestAborted);
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
            itemId = Ids.ToText(itemId),
            calendarId = Ids.ToText(id),
            kind,
            startsAt = starts,
            endsAt = ends,
            visibilityAreaId = Ids.ToText(visibilityAreaId),
            timeZone = zoneId,
            fields = sealedFields.Count,
            schemeId = schemeId is null ? null : Ids.ToText(schemeId.Value),
            values = values.Count
        });
    }

    /* -- Eine Ausnahme in der Reihe ----------------------------------------- */

    /// <param name="Restore">0079 — die Ausnahme aufheben: das Vorkommen steht wieder, wie die Reihe es sagt.</param>
    public sealed record ExceptionRequest(string OriginalStart, bool? Cancelled, string? MovedTo, bool? Restore = null);

    /// <summary>
    /// Ein einzelnes Vorkommen absagen oder verschieben.
    ///
    /// <para>
    /// Angesprochen wird es ueber seinen URSPRUENGLICHEN Beginn — sein Name in
    /// der Reihe. Er bleibt auch nach einer Verschiebung stehen; verloere er
    /// ihn, liesse sich die Verschiebung nie aufheben, und die Intentionen
    /// daran haetten keine Adresse mehr.
    /// </para>
    /// </summary>
    private static async Task ExceptionAsync(HttpContext ctx, Db db, Guid id, ExceptionRequest body)
    {
        /* Ein Konto — oder die Links mit Zugang in diesem Browser (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!DateTimeOffset.TryParse(body.OriginalStart, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var original))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        DateTimeOffset? movedTo = null;

        if (!string.IsNullOrWhiteSpace(body.MovedTo))
        {
            if (!DateTimeOffset.TryParse(body.MovedTo, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var moved))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny nowy termin.");
                return;
            }
            movedTo = moved;
        }

        var cancelled = body.Cancelled ?? false;
        var restore = body.Restore ?? false;

        if (!cancelled && movedTo is null && !restore)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Wyjątek bez treści: albo odwołanie, albo przeniesienie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var area = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (area is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        if (!await Area.MayAsync(connection, caller, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        /*
         * 0079 — WIEDERHERSTELLEN. Eine abgesagte Messe liess sich bisher nicht
         * zurückholen: wer sich verklickt hatte, musste eine neue anlegen — und
         * die Intentionen hingen an der alten. Die Ausnahme fällt einfach fort.
         */
        if (restore)
        {
            await using var undo = new SqlCommand(
                "DELETE FROM app.calendar_exception WHERE item_id = @item AND original_start = @at;", connection);
            undo.Parameters.AddWithValue("@item", id);
            undo.Parameters.AddWithValue("@at", original);
            var undone = await undo.ExecuteNonQueryAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(id), originalStart = original, restored = undone > 0 });
            return;
        }

        /*
         * 0079 — EINE MESSE MIT INTENTIONEN WIRD NICHT STILL ABGESAGT. Die
         * Intentionen hingen sonst an einem Vorkommen, das der Plan nicht mehr
         * zeigt — angenommen, und nirgends gelesen. Erst verlegen (`Mass`),
         * dann absagen. Verschieben geht immer: die Adresse bleibt.
         */
        if (cancelled)
        {
            var live = await Mass.LiveCountAsync(connection, null, id, original, ctx.RequestAborted, IntentionList);
            if (live > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Na tę mszę są przyjęte intencje ({live}) — przenieś je na inną mszę, zanim ją odwołasz.");
                return;
            }

            /* 0132 — und jede andere Liste (Anmeldungen …): sie hingen sonst an einem Termin, den es nicht gibt. */
            var held = await Mass.LiveCountAsync(connection, null, id, original, ctx.RequestAborted);
            if (held > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Na tym terminie są wpisy ({held}) — przenieś je albo wycofaj, zanim go odwołasz.");
                return;
            }
        }

        /*
         * Ein zweiter Aufruf zu demselben Vorkommen ersetzt den ersten. Sonst
         * braeuchte die Oberflaeche zwei Wege — anlegen und aendern — fuer eine
         * Entscheidung, die der Mensch als eine erlebt.
         */
        await using var upsert = new SqlCommand("""
            UPDATE app.calendar_exception
               SET cancelled = @cancelled, moved_to = @moved
             WHERE item_id = @item AND original_start = @at;

            IF @@ROWCOUNT = 0
                INSERT INTO app.calendar_exception
                    (item_id, original_start, cancelled, moved_to, created_at)
                VALUES (@item, @at, @cancelled, @moved, @now);
            """, connection);

        upsert.Parameters.AddWithValue("@item", id);
        upsert.Parameters.AddWithValue("@at", original);
        upsert.Parameters.AddWithValue("@cancelled", cancelled);
        upsert.Parameters.AddWithValue("@moved", (object?)movedTo ?? DBNull.Value);
        upsert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await upsert.ExecuteNonQueryAsync(ctx.RequestAborted);

        /*
         * WER AUF EINEM ABGESAGTEN TERMIN SASS, sitzt auf nichts mehr. Die
         * Ansprueche darauf werden abgelehnt — sonst stuende bei ihm weiter
         * „Twój termin: …" fuer einen Termin, den es nicht gibt, und die Grenze
         * je Person zaehlte ihn mit.
         */
        var declined = 0;

        /*
         * 0058 — WER AUF EINEM VERSCHOBENEN TERMIN SITZT, sitzt auf der neuen
         * Zeit. Der Name des Vorkommens bleibt (sein ursprünglicher Beginn);
         * die Zeit an der Reservierung folgt, damit „Twój termin" stimmt.
         */
        if (!cancelled && movedTo is not null)
        {
            await using var follow = new SqlCommand("""
                UPDATE c
                   SET starts_at = @moved, ends_at = DATEADD(second, DATEDIFF(second, c.starts_at, c.ends_at), @moved)
                  FROM app.claim c
                 WHERE c.item_id = @item AND c.occurrence_at = @at AND c.status IN (N'pending', N'confirmed');
                """, connection);
            follow.Parameters.AddWithValue("@item", id);
            follow.Parameters.AddWithValue("@at", original);
            follow.Parameters.AddWithValue("@moved", movedTo.Value);
            await follow.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        if (cancelled)
        {
            await using var drop = new SqlCommand("""
                UPDATE app.claim
                   SET status = N'declined', awaits = NULL, decided_at = @now,
                       invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
                 WHERE item_id = @item AND occurrence_at = @at
                   AND status IN (N'pending', N'confirmed');
                """, connection);

            drop.Parameters.AddWithValue("@item", id);
            drop.Parameters.AddWithValue("@at", original);
            drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            declined = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            itemId = Ids.ToText(id),
            originalStart = original,
            cancelled,
            movedTo,
            declined
        });
    }
}
