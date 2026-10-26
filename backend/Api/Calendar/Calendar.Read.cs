using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Kalender lesen: Einträge, die öffentliche Sicht, die Reihe ausrechnen.</summary>
public static partial class Calendar
{
    /* -- Lesen -------------------------------------------------------------- */

    private static async Task ItemsAsync(
        HttpContext ctx, Db db, Guid id, string? from, string? to, string? kind, string? seat, string? links)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * AUCH DER PLATZ, DER OBEN AUF DER SEITE GEWÄHLT IST, UND DIE LINKS IN
         * DIESEM BROWSER (0073). Ohne Konto las ein Link den Kalender einer
         * Seite — und wer sich anmeldete, sah dort nichts mehr, weil das Konto
         * den Bereich nicht hält. Angemeldet zu sein darf nicht WENIGER zeigen
         * als nicht angemeldet zu sein.
         */
        var linkRoles = await HeldLinks.RolesAsync(connection, links, ctx.RequestAborted);
        var seatId = await SeatOfAsync(connection, seat, ctx.RequestAborted);
        await ShowAsync(ctx, connection, id, who.Value.AccountId, from, to, kind, seatId, linkRoles);
    }

    /// <summary>
    /// Der Aushang — und, mit <c>?seat=</c>, das Gemeinsame einer Klasse.
    ///
    /// <para>
    /// Ein Schueler ohne Konto haelt den Klassenschluessel: er steckt in seinem
    /// Platz (<c>app.access_grant</c>, 0024). Was ihm fehlte, war ein Weg, die
    /// Zeilen dazu zu bekommen — dieser hier. Er gibt genau die Bereiche frei,
    /// die sein Platz aufschliesst, und keinen weiteren.
    /// </para>
    ///
    /// <para>
    /// Der Schluessel kommt dabei NICHT vor: der Dienst gibt versiegelte Felder
    /// heraus, wie immer. Das Token sagt nur, WELCHE er herausgeben darf.
    /// </para>
    /// </summary>
    private static async Task PublicAsync(
        HttpContext ctx, Db db, Guid id, string? from, string? to, string? kind, string? seat, string? links)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* 0073 — die Links mit Zugang, die der Browser hält: was ihre Rollen lesen, liest er. */
        var linkRoles = await HeldLinks.RolesAsync(connection, links, ctx.RequestAborted);

        var seatId = await SeatOfAsync(connection, seat, ctx.RequestAborted);

        await ShowAsync(ctx, connection, id, null, from, to, kind, seatId, linkRoles);
    }

    /// <summary>Der Platz zu einem Token — nur einer, der gilt und (wo verlangt) bestätigt ist.</summary>
    private static async Task<Guid?> SeatOfAsync(SqlConnection connection, string? seat, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(seat)) return null;

        await using var find = new SqlCommand("""
            SELECT id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now)
              AND (verify_hash IS NULL OR verified_at IS NOT NULL);
            """, connection);

        find.Parameters.AddWithValue("@token",
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(seat.Trim())));
        find.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        return await find.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private sealed record Row(
        Guid Id, Guid OwnerRoleId, string Kind, DateTimeOffset StartsAt, DateTimeOffset EndsAt,
        bool AllDay, string? TitlePublic, Guid VisibilityAreaId, string Status,
        string RepeatKind, int RepeatEvery, int? Weekdays, DateTimeOffset? Until, int? Count,
        Guid? ParentItemId = null, int? Position = null, Guid? SchemeId = null);

    private sealed record Shown(
        Guid ItemId, Guid OwnerRoleId, string Kind, DateTimeOffset OccurrenceAt,
        DateTimeOffset StartsAt, DateTimeOffset EndsAt, bool AllDay,
        string? TitlePublic, Guid VisibilityAreaId, string Status,
        Guid? ParentItemId = null, int? Position = null, Guid? SchemeId = null);

    private static async Task ShowAsync(
        HttpContext ctx, SqlConnection connection, Guid calendarId, Guid? accountId,
        string? from, string? to, string? kind, Guid? seatId = null, IReadOnlyList<Guid>? linkRoles = null)
    {
        var found = await CalendarOfAsync(connection, calendarId, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        if (!Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        /*
         * WELCHE BEREICHE KANN DIESER LESER OEFFNEN? Das ist die ganze
         * Sichtbarkeitspruefung — keine Spalte, die der Dienst deuten muesste,
         * sondern eine Zuteilung oder ein offengelegter Schluessel.
         */
        var readable = await ReadableAreasAsync(connection, accountId, ctx.RequestAborted, seatId, linkRoles);

        /* 0058 — der Kalender stellt sich vor: sein Name und wie seine Termine gemeint sind (für den Baustein auf einer Seite). */
        string? calendarTitle = null, calendarDescription = null, calendarKind = null;
        await using (var about = new SqlCommand("SELECT title, description, item_kind FROM app.calendar WHERE id = @id;", connection))
        {
            about.Parameters.AddWithValue("@id", calendarId);
            await using var reader = await about.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                calendarTitle = reader.GetString(0);
                calendarDescription = reader.IsDBNull(1) ? null : reader.GetString(1);
                calendarKind = reader.GetString(2);
            }
        }

        if (readable.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new
            {
                calendarId = Ids.ToText(calendarId),
                areaId = Ids.ToText(found.Value.AreaId),
                title = calendarTitle,
                description = calendarDescription,
                itemKind = calendarKind,
                timeZone = found.Value.Zone,
                fromUtc = since,
                toUtc = till,
                occurrences = Array.Empty<object>()
            });
            return;
        }

        var wanted = string.IsNullOrWhiteSpace(kind) ? null : kind.Trim().ToLowerInvariant();
        var rows = new List<Row>();

        /* 0132 — das Schema jedes Termins, und seine Werte (versiegelt hinaus wie die Felder). */
        var schemesReady = await Schema.RecordsAsync(connection, ctx.RequestAborted);

        var areaNames = string.Join(", ", readable.Select((_, i) => $"@a{i}"));
        var byKind = wanted is null ? "" : "AND kind = @kind";

        await using (var cmd = new SqlCommand($"""
            SELECT id, owner_role_id, kind, starts_at, ends_at, all_day,
                   title_public, visibility_area_id, status,
                   repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                   parent_item_id, position,
                   {(schemesReady ? "scheme_id" : "CAST(NULL AS uniqueidentifier)")}
            FROM app.calendar_item
            WHERE calendar_id = @cal
              AND starts_at <= @to
              AND (repeat_kind = N'none' OR repeat_until IS NULL OR repeat_until >= @from)
              AND visibility_area_id IN ({areaNames})
              /* 0130 — ein nach einer Meldung gesperrter Termin steht nicht mehr im Kalender. */
              AND NOT {Takedowns.Exists("item", "calendar_item.id")}
              {byKind};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@cal", calendarId);
            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);
            if (wanted is not null) cmd.Parameters.AddWithValue("@kind", wanted);
            for (var i = 0; i < readable.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", readable[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add(new Row(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetDateTimeOffset(3), reader.GetDateTimeOffset(4), reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.GetGuid(7), reader.GetString(8), reader.GetString(9),
                    reader.GetInt32(10),
                    reader.IsDBNull(11) ? null : reader.GetByte(11),
                    reader.IsDBNull(12) ? null : reader.GetDateTimeOffset(12),
                    reader.IsDBNull(13) ? null : reader.GetInt32(13),
                    reader.IsDBNull(14) ? null : reader.GetGuid(14),
                    reader.IsDBNull(15) ? null : reader.GetInt32(15),
                    reader.IsDBNull(16) ? null : reader.GetGuid(16)));
            }
        }

        var itemIds = rows.Select(r => r.Id).ToList();
        var exceptions = await ExceptionsAsync(connection, itemIds, ctx.RequestAborted);
        var fields = await FieldsAsync(connection, itemIds, ctx.RequestAborted);
        var values = await ValuesAsync(connection, itemIds, since, till, ctx.RequestAborted);

        var zone = Zones.Of(found.Value.Zone);
        var shown = new List<Shown>();

        foreach (var row in rows)
        {
            var span = row.EndsAt - row.StartsAt;

            foreach (var at in Occurrences(row.StartsAt, row.RepeatKind, row.RepeatEvery,
                         row.Weekdays, row.Until, row.Count, since, till, zone))
            {
                var starts = at;

                /*
                 * Nachgeschlagen wird am URSPRUENGLICHEN Beginn — auch bei einem
                 * verschobenen Vorkommen. Sonst verloere eine verschobene Messe
                 * ihre eigene Verschiebung.
                 */
                if (exceptions.TryGetValue((row.Id, at), out var exception))
                {
                    if (exception.Cancelled) continue;
                    if (exception.MovedTo is not null) starts = exception.MovedTo.Value;
                }

                if (starts < since || starts > till) continue;

                shown.Add(new Shown(row.Id, row.OwnerRoleId, row.Kind, at,
                    starts, starts + span, row.AllDay, row.TitlePublic, row.VisibilityAreaId, row.Status,
                    row.ParentItemId, row.Position, row.SchemeId));
            }
        }

        shown.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));

        await ctx.Response.WriteAsJsonAsync(new
        {
            calendarId = Ids.ToText(calendarId),

            /* Der Bereich des Kalenders — damit die Seite weiss, ob jemand (ein Link) hier eintragen darf. */
            areaId = Ids.ToText(found.Value.AreaId),
            title = calendarTitle,
            description = calendarDescription,
            itemKind = calendarKind,
            timeZone = found.Value.Zone,
            fromUtc = since,
            toUtc = till,

            occurrences = shown.Select(o => new
            {
                itemId = Ids.ToText(o.ItemId),
                ownerRoleId = Ids.ToText(o.OwnerRoleId),
                kind = o.Kind,

                // Der Name des Vorkommens in der Reihe — die Adresse, unter der
                // Intentionen und Ausnahmen daran haengen.
                occurrenceAt = o.OccurrenceAt,

                startsAt = o.StartsAt,
                endsAt = o.EndsAt,
                allDay = o.AllDay,
                status = o.Status,
                titlePublic = o.TitlePublic,
                visibilityAreaId = Ids.ToText(o.VisibilityAreaId),

                /* 0070 — Teil welches Termins: der Aushang zeigt Teile unter ihrem Ganzen. */
                parentItemId = o.ParentItemId is null ? null : Ids.ToText(o.ParentItemId.Value),
                position = o.Position,

                /*
                 * Versiegelt hinaus, je Feld mit SEINEM Bereich und seiner
                 * Epoche. Was davon aufgeht, entscheidet der Schluesselbund des
                 * Lesers — hier wird nichts geoeffnet und nichts verschwiegen.
                 */
                fields = fields.TryGetValue(o.ItemId, out var list)
                    ? list.Select(f => new
                    {
                        field = f.Field,
                        areaId = Ids.ToText(f.AreaId),
                        epoch = f.Epoch,
                        @sealed = Base64Url.Encode(f.Blob)
                    })
                    : [],

                /* 0132 — das Schema (NULL: das universelle) und die Werte am Termin und an diesem Vorkommen. */
                schemeId = o.SchemeId is null ? null : Ids.ToText(o.SchemeId.Value),
                values = ValuesAt(values, o.ItemId, o.OccurrenceAt)
            })
        });
    }

    /// <summary>
    /// Die Bereiche, die dieser Leser oeffnen kann.
    ///
    /// <para>
    /// Zwei Quellen, und beide sind nachpruefbar: eine Zuteilung
    /// (<c>app.key_grant</c>, Art <c>epoch</c>) oder eine offengelegte Epoche
    /// (<c>app.area_epoch.key_public</c>, 0019).
    /// </para>
    ///
    /// <para>
    /// Ohne Konto bleibt nur die zweite — und genau das ist der Aushang.
    /// </para>
    /// </summary>
    internal static async Task<List<Guid>> ReadableAreasAsync(
        SqlConnection connection, Guid? accountId, CancellationToken ct, Guid? seatId = null, IReadOnlyList<Guid>? linkRoles = null)
    {
        var areas = new HashSet<Guid>();

        /* 0073 — was die Links mit Zugang in diesem Browser lesen (HeldLinks). */
        if (linkRoles is { Count: > 0 }) areas.UnionWith(await HeldLinks.KeyedAreasAsync(connection, linkRoles, ct));

        /*
         * Was ein PLATZ aufschliesst (0024). Der dritte Weg neben Zuteilung und
         * Offenlegung — und der einzige, der ohne Konto auskommt.
         */
        if (seatId is not null)
        {
            /* 0091 — und die Bereiche der Rolle seines Formulars. */
            await using var granted = new SqlCommand("""
                SELECT area_id FROM app.access_grant WHERE access_id = @seat
                UNION
                SELECT area_id FROM app.access_role_area WHERE access_id = @seat;
                """, connection);

            granted.Parameters.AddWithValue("@seat", seatId.Value);

            await using var reader = await granted.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        }

        await using (var open = new SqlCommand(
            "SELECT DISTINCT area_id FROM app.area_epoch WHERE key_public IS NOT NULL;", connection))
        {
            await using var reader = await open.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        }

        if (accountId is null) return [.. areas];

        var mine = await Workspace.RolesOfAsync(connection, accountId.Value, ct);
        if (mine.Count == 0) return [.. areas];

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using (var held = new SqlCommand($"""
            SELECT DISTINCT key_ref FROM app.key_grant
            WHERE key_kind = N'epoch' AND destroyed_at IS NULL
              AND role_id IN ({names});
            """, connection))
        {
            for (var i = 0; i < mine.Count; i++) held.Parameters.AddWithValue($"@r{i}", mine[i].Id);

            await using var reader = await held.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        }

        return [.. areas];
    }

    /* -- Die Reihe ausrechnen ----------------------------------------------- */

    /// <summary>
    /// Was aus einer Reihe im Fenster wird.
    ///
    /// <para>
    /// <b>Gezaehlt wird in ORTSTAGEN, nicht in 24-Stunden-Schritten.</b> Der
    /// Abstand zweier Termine ist „eine Woche" und nicht „604800 Sekunden"; an
    /// den beiden Umstellungswochenenden sind das verschiedene Dinge. Deshalb
    /// wandert hier ein Datum, und die Uhrzeit wird jedes Mal neu an die Zone
    /// gehaengt.
    /// </para>
    ///
    /// <para>
    /// Rein und ohne Datenbank — deshalb laesst sie sich pruefen, und deshalb
    /// steht sie oeffentlich.
    /// </para>
    /// </summary>
    public static List<DateTimeOffset> Occurrences(
        DateTimeOffset first, string repeatKind, int every, int? weekdays,
        DateTimeOffset? until, int? count, DateTimeOffset from, DateTimeOffset to, TimeZoneInfo zone)
    {
        var found = new List<DateTimeOffset>();
        if (to < from) return found;

        var wall = TimeZoneInfo.ConvertTime(first, zone).DateTime;
        var time = wall.TimeOfDay;
        var step = Math.Max(1, every);

        if (repeatKind == "none")
        {
            if (first >= from && first <= to) found.Add(first);
            return found;
        }

        var last = until is null ? to : (until.Value < to ? until.Value : to);
        var mask = weekdays ?? 0;
        var made = 0;

        for (var i = 0; i < MaxOccurrences; i++)
        {
            DateTime day;

            switch (repeatKind)
            {
                case "daily": day = wall.Date.AddDays((long)i * step); break;
                case "weekly": day = wall.Date.AddDays(i); break;
                case "monthly": day = wall.Date.AddMonths(i * step); break;
                case "yearly": day = wall.Date.AddYears(i * step); break;
                default: return found;
            }

            var at = Zones.AtLocal(day + time, zone);
            if (at > last) break;

            /*
             * Woechentlich wird TAEGLICH geprueft und nach der Maske gefiltert.
             * Dasselbe Ergebnis wie ein Sprung ueber ganze Wochen, aber ohne die
             * Frage, in welcher Woche die Reihe anfaengt — und genau die
             * beantwortet der Altbestand an zwei Stellen verschieden.
             */
            if (repeatKind == "weekly")
            {
                if ((mask & Zones.BitOf(at.DayOfWeek)) == 0) continue;

                if (step > 1)
                {
                    var weeks = (int)Math.Floor((day.Date - StartOfWeek(wall.Date)).TotalDays / 7.0);
                    if (weeks % step != 0) continue;
                }
            }

            /*
             * Die Anzahl zaehlt ALLE Vorkommen der Reihe, auch die vor dem
             * Fenster. Zaehlte sie nur die sichtbaren, braechte ein Blick auf
             * den naechsten Monat neue hervor, die es nicht gibt.
             */
            made++;
            if (count is not null && made > count.Value) break;

            if (at < from) continue;
            found.Add(at);
        }

        return found;
    }

    /// <summary>Montag der Woche, in der dieses Datum liegt.</summary>
    private static DateTime StartOfWeek(DateTime day) =>
        day.AddDays(day.DayOfWeek == DayOfWeek.Sunday ? -6 : -((int)day.DayOfWeek - 1));
}
