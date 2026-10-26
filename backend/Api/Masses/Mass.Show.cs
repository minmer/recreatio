using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Der Aushang: der Plan der Messen und Andachten mit ihren Intentionen.</summary>
public static partial class Mass
{
    /* -- Der Aushang --------------------------------------------------------- */

    private static Task PlanAsync(HttpContext ctx, Db db, string? calendar, string? from, string? to) =>
        ShowAsync(ctx, db, calendar, from, to, null);

    private static async Task OfficeAsync(
        HttpContext ctx, Db db, string? calendar, string? from, string? to, string? kinds)
    {
        /* 0079 — ein Konto, oder die Links mit Zugang in diesem Browser (`Caller`) — wie im Kalender. */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Kinds(kinds, out var wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany rodzaj wpisu.");
            return;
        }

        await ShowAsync(ctx, db, calendar, from, to, caller, wanted);
    }

    private sealed record Row(
        Guid Id, Guid CalendarId, string CalendarTitle, string AreaName, string Zone,
        string Kind, string? TitlePublic, DateTimeOffset StartsAt, DateTimeOffset EndsAt,
        string Status, string RepeatKind, int RepeatEvery,
        int? Weekdays, DateTimeOffset? Until, int? Count, Guid AreaId);

    /// <param name="Skipped">0079 — dieses eine Vorkommen ist abgesagt (eine Ausnahme), nicht die Reihe.</param>
    private sealed record Service(
        Row Item, DateTimeOffset OccurrenceAt, DateTimeOffset StartsAt, DateTimeOffset EndsAt,
        bool Skipped = false, bool Moved = false);

    /// <summary>
    /// Welche Arten der Plan zeigt.
    ///
    /// <para>
    /// <b>Die Vorgabe ist der Gottesdienst</b> — Messe und Beichte. Der
    /// oeffentliche Plan kennt nichts anderes und darf nichts anderes kennen:
    /// ein Firmungstermin, der in der Gablota zwischen den Messen stuende,
    /// waere dort eine Ankuendigung, die niemand gemacht hat.
    /// </para>
    ///
    /// <para>
    /// <b>Die Kanzlei darf fragen</b>, und zwar nur nach Arten, die es gibt
    /// (<c>ck_item_kind</c>). Was nicht in der Liste steht, wird nicht etwa
    /// stillschweigend uebergangen — es faellt als Absage heraus, sonst bekaeme
    /// jemand einen leeren Plan und suchte den Fehler bei sich.
    /// </para>
    /// </summary>
    private static readonly string[] Services = Calendar.ServiceKinds;

    private static bool Kinds(string? asked, out List<string> kinds)
    {
        kinds = [];

        if (string.IsNullOrWhiteSpace(asked)) { kinds = [.. Services]; return true; }

        foreach (var one in asked.Split(',', StringSplitOptions.RemoveEmptyEntries
                                             | StringSplitOptions.TrimEntries))
        {
            var kind = one.ToLowerInvariant();

            if (!Calendar.ItemKinds.Contains(kind)) return false;

            if (!kinds.Contains(kind)) kinds.Add(kind);
        }

        return kinds.Count > 0;
    }

    /// <summary>
    /// Der Messplan.
    ///
    /// <para>
    /// <b>Ueber alle Kalender, mit der Angabe WO.</b> Ein Mensch, der eine Messe
    /// sucht, sucht eine Messe — nicht den Kalender, in dem sie gefuehrt wird.
    /// Deshalb steht bei jedem Vorkommen, aus welchem Kalender und aus welchem
    /// Bereich es stammt.
    /// </para>
    ///
    /// <para>
    /// Ohne <paramref name="calendar"/> wird ueber alle lesbaren gesammelt; mit
    /// ihm bleibt es bei einem — das ist der Fall des Moduls auf einer Seite.
    /// </para>
    /// </summary>
    private static async Task ShowAsync(
        HttpContext ctx, Db db, string? calendar, string? from, string? to, Caller? caller,
        IReadOnlyList<string>? kinds = null)
    {
        kinds ??= Services;

        if (!Calendar.Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        Guid? only = null;
        if (!string.IsNullOrWhiteSpace(calendar))
        {
            if (!Guid.TryParse(calendar, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung kalendarza.");
                return;
            }
            only = wanted;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * Dieselbe Frage wie im Kalender, und ausdruecklich dieselbe Antwort:
         * welche Bereiche kann dieser Leser oeffnen. Eine zweite Fassung davon
         * waere eine zweite Meinung darueber, was oeffentlich ist.
         */
        var office = caller is not null;
        var readable = await Calendar.ReadableAreasAsync(connection, caller?.AccountId, ctx.RequestAborted,
            linkRoles: caller is { ByLinks: true } ? caller.RoleIds : null);

        if (readable.Count == 0)
        {
            await Empty(ctx, since, till);
            return;
        }

        var rows = new List<Row>();
        var areaNames = string.Join(", ", readable.Select((_, i) => $"@a{i}"));

        /* Gebunden und nicht eingesetzt — eine Art ist ein Wert, kein Stueck SQL. */
        var kindNames = string.Join(", ", kinds.Select((_, i) => $"@k{i}"));

        await using (var cmd = new SqlCommand($"""
            SELECT i.id, i.calendar_id, c.title, a.name, c.time_zone,
                   i.kind, i.title_public, i.starts_at, i.ends_at, i.status,
                   i.repeat_kind, i.repeat_every, i.repeat_weekdays, i.repeat_until, i.repeat_count, c.area_id
            FROM app.calendar_item i
            JOIN app.calendar c ON c.id = i.calendar_id
            JOIN app.area a     ON a.id = c.area_id
            WHERE i.kind IN ({kindNames})
              AND i.starts_at <= @to
              AND (i.repeat_kind = N'none' OR i.repeat_until IS NULL OR i.repeat_until >= @from)
              AND i.visibility_area_id IN ({areaNames})
              {(only is null ? "" : "AND i.calendar_id = @only")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);
            if (only is not null) cmd.Parameters.AddWithValue("@only", only.Value);
            for (var i = 0; i < readable.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", readable[i]);
            for (var i = 0; i < kinds.Count; i++) cmd.Parameters.AddWithValue($"@k{i}", kinds[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add(new Row(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
                    reader.GetString(4), reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.GetDateTimeOffset(7), reader.GetDateTimeOffset(8), reader.GetString(9),
                    reader.GetString(10), reader.GetInt32(11),
                    reader.IsDBNull(12) ? null : reader.GetByte(12),
                    reader.IsDBNull(13) ? null : reader.GetDateTimeOffset(13),
                    reader.IsDBNull(14) ? null : reader.GetInt32(14),
                    reader.GetGuid(15)));
            }
        }

        if (rows.Count == 0)
        {
            await Empty(ctx, since, till);
            return;
        }

        var itemIds = rows.Select(r => r.Id).ToList();
        var exceptions = await ExceptionsAsync(connection, itemIds, ctx.RequestAborted);
        var intentions = await IntentionsAsync(
            connection, itemIds, since, till, office, ctx.RequestAborted);

        /* 0132 — was das Schema offen nennt (Obchód, Kolor szat …): Beschriftung und Wert, nichts Versiegeltes. */
        var values = await Calendar.ValuesAsync(connection, itemIds, since, till, ctx.RequestAborted, publicOnly: true);

        var services = new List<Service>();

        foreach (var row in rows)
        {
            var zone = Zones.Of(row.Zone);
            var span = row.EndsAt - row.StartsAt;

            foreach (var at in Calendar.Occurrences(
                row.StartsAt, row.RepeatKind, row.RepeatEvery, row.Weekdays,
                row.Until, row.Count, since, till, zone))
            {
                var starts = at;
                var skipped = false;
                var moved = false;

                /*
                 * 0079 — EINE ABGESAGTE MESSE STEHT DA, als abgesagt. Vorher fiel sie
                 * still aus dem Plan: wer am Aushang 18:00 nicht fand, kam trotzdem —
                 * und die Kanzlei konnte sie nicht zurückholen, weil sie sie nicht sah.
                 */
                if (exceptions.TryGetValue((row.Id, at), out var exception))
                {
                    if (exception.Cancelled) skipped = true;
                    else if (exception.MovedTo is not null) { starts = exception.MovedTo.Value; moved = true; }
                }

                if (starts < since || starts > till) continue;

                services.Add(new Service(row, at, starts, starts + span, skipped, moved));
            }
        }

        services.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));

        /* 0079 — wer die Messe feiert (Kto odprawia, `calendar_presence`) — nur für die Kanzlei. */
        var people = !office
            ? null
            : await Calendar.PeopleOfAsync(connection, itemIds, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            fromUtc = since,
            toUtc = till,

            masses = services.Select(s => new
            {
                itemId = Ids.ToText(s.Item.Id),
                kind = s.Item.Kind,

                // Der Name des Vorkommens — die Adresse der Intentionen.
                occurrenceAt = s.OccurrenceAt,
                startsAt = s.StartsAt,
                endsAt = s.EndsAt,
                status = s.Skipped ? "cancelled" : s.Item.Status,
                title = s.Item.TitlePublic,

                /* 0079 — nur dieses Vorkommen abgesagt (zurückholbar) — oder verlegt (die Adresse bleibt). */
                skipped = s.Skipped,
                moved = s.Moved,

                // WO sie ist. Ohne das ist ein Sammelplan eine Liste von Uhrzeiten.
                calendarId = Ids.ToText(s.Item.CalendarId),
                calendarTitle = s.Item.CalendarTitle,
                areaName = s.Item.AreaName,
                timeZone = s.Item.Zone,

                /* 0079 — für die Kanzlei: der Bereich (wer schreibt, versiegelt Geber und Gabe darunter) und wer feiert. */
                areaId = !office ? null : Ids.ToText(s.Item.AreaId),
                people = people is null ? null : Calendar.PeopleAt(people, s.Item.Id, s.OccurrenceAt)
                    .Select(p => new { roleId = Ids.ToText(p.Role), duty = p.Duty }),

                /*
                 * Am Schaukasten steht auch die ART. Wer eine Intention gibt, hat
                 * ein Recht zu wissen, ob sie allein oder mit anderen zusammen
                 * gelesen wird. Der Priester steht dort NICHT — wer zelebriert,
                 * ist eine Frage der Dienstordnung, und die haengt nicht aus.
                 *
                 * Nachgeschlagen wird am URSPRUENGLICHEN Beginn, nicht am
                 * verschobenen: sonst verloere eine verlegte Messe ihre
                 * Intentionen genau dann, wenn sie verlegt wird.
                 */
                intentions = intentions
                    .Where(i => i.ItemId == s.Item.Id && i.At == s.OccurrenceAt)
                    .OrderBy(i => i.Ordinal)
                    .Select(i => Told(i, office)),

                /* 0132 — die offenen Werte des Schemas: am Termin und an diesem Vorkommen. */
                values = Calendar.PublicValuesAt(values, s.Item.Id, s.OccurrenceAt)
            })
        });
    }

    /// <summary>
    /// Was von einer Intention hinausgeht.
    ///
    /// <para>
    /// Am Aushang: Reihenfolge, Text, Art. In der Kanzlei zusaetzlich Kennung,
    /// Stand, Zelebrant — und die versiegelten Felder, wie sie liegen. Geoeffnet
    /// wird hier nichts.
    /// </para>
    /// </summary>
    private static object Told(Held i, bool office) => office
        ? (object)new
        {
            intentionId = Ids.ToText(i.Id),
            ordinal = i.Ordinal,
            text = i.Text,
            kind = i.Kind,
            status = i.Status,
            celebrantRoleId = i.Celebrant is null ? null : Ids.ToText(i.Celebrant.Value),
            fields = i.Fields.Select(f => new
            {
                field = f.Field,
                areaId = Ids.ToText(f.AreaId),
                epoch = f.Epoch,
                @sealed = Base64Url.Encode(f.Blob)
            })
        }
        : new { ordinal = i.Ordinal, text = i.Text, kind = i.Kind };

    private static Task Empty(HttpContext ctx, DateTimeOffset since, DateTimeOffset till) =>
        ctx.Response.WriteAsJsonAsync(new
        {
            fromUtc = since,
            toUtc = till,
            masses = Array.Empty<object>()
        });
}
