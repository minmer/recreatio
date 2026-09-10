using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Der Terminplan — alles, was dieses Konto in einem Zeitraum vor sich hat.
///
/// <b>Warum es das braucht.</b> Ein Mensch hat EINEN Tag. Er hat nicht einen
/// Pfarrkalender-Tag und daneben einen Veranstaltungs-Tag: er hat Mittwoch, und
/// darin stehen die Messe um 18:00, die Beichte davor, der Krankenbesuch am
/// Vormittag und die Fahrt am Wochenende. Wer dafuer vier Listen oeffnen muss,
/// uebersieht die fuenfte — und Uebersehen ist bei Terminen kein Schoenheits-,
/// sondern ein Sachfehler.
///
/// <b>Das meiste steht schon zusammen.</b> Messe, Beichte und Krankenbesuch
/// sind Kalendereintraege (<c>rc_calendar_item</c>) mit eigener Art; sie liegen
/// nur in verschiedenen KALENDERN, und die gehoeren verschiedenen Bereichen.
/// Diese Datei sammelt sie ueber alle Kalender, die der Leser lesen darf.
///
/// <b>Veranstaltungen sind der Sonderfall.</b> Sie stehen NICHT im Kalender,
/// sondern in <c>rc_event</c> mit eigenem Anfang und Ende — sie sind keine
/// Termine an einem Ort, sondern Vorhaben mit einer eigenen Seite. Sie hier
/// mitzunehmen ist trotzdem richtig: wer am 28. August faehrt, hat an dem Tag
/// keine Zeit fuer eine Beerdigung, und das muss man sehen, ohne den Katalog zu
/// oeffnen. Sie kommen darum als eigene Art <c>event</c> herein und tragen ihre
/// Adresse mit, damit der Plan zu ihnen fuehren kann.
///
/// <b>Was NICHT passiert: eine zweite Wahrheit.</b> Hier wird nichts
/// gespeichert und nichts entschieden. Der Plan liest, was anderswo steht, und
/// nutzt dieselbe Ausbreitung der Wiederholungen und dieselbe Sichtbarkeitsregel
/// wie der einzelne Kalender — ein zweiter Rechenweg fuer „welche Vorkommen hat
/// diese Reihe" wuerde irgendwann anders antworten als der erste.
/// </summary>
public static class RcAgenda
{
    public static void MapRcAgenda(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/agenda", ReadAsync).Produces<RcAgendaResponse>();
    }

    /// <summary>
    /// Ein Eintrag im Plan, mit dem Weg dorthin.
    ///
    /// <c>Source</c> sagt, WOHER er kommt — welcher Kalender, welche
    /// Veranstaltung. Ohne das ist ein Plan eine Liste von Zeiten, aus der man
    /// nicht zurueckfindet; mit ihm ist jede Zeile ein Weg.
    /// </summary>
    public sealed record Entry(
        string Kind,
        string SourceId,
        string SourceTitle,
        DateTimeOffset StartsUtc,
        DateTimeOffset EndsUtc,
        bool AllDay,
        string? Title,
        string? Location,
        string Status,
        bool Mine,
        string? Unreadable,
        /// <summary>Die Adresse, unter der der Eintrag zu Hause ist.</summary>
        string? Href);

    private static async Task ReadAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        DateTimeOffset? from, DateTimeOffset? to)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        /*
         * Ohne Zeitraum die naechsten vier Wochen. Ein Plan ohne Grenze waere
         * eine Frage nach allem, was je stattfindet — und bei einer Messe, die
         * sich taeglich wiederholt, ist „alles" unbegrenzt.
         */
        var start = from ?? DateTimeOffset.UtcNow.Date;
        var end = to ?? start.AddDays(28);

        if (end <= start)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das Ende liegt vor dem Anfang.");
            return;
        }

        // Dieselbe Grenze wie beim einzelnen Kalender, und aus demselben Grund:
        // eine taegliche Reihe erzeugt sonst still Zehntausende Vorkommen.
        if (end - start > TimeSpan.FromDays(400))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Dieser Zeitraum ist zu weit; hoechstens ein Jahr.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        /*
         * Welche Rollen der Leser haelt. EINMAL geholt und an jeden Kalender
         * weitergereicht: der Aufruf laeuft durch den Rollengraphen, und ihn je
         * Kalender zu wiederholen machte den Plan mit jedem Bereich langsamer.
         */
        var mine = (await RcRoleAccess.AllRoleKeysAsync(
            connection, session.AccountId, held.MasterKey, ctx.RequestAborted)).Keys.ToHashSet();

        var entries = new List<Entry>();

        // -- Die Kalender ------------------------------------------------------

        var calendars = new List<(Guid Id, Guid AreaId, string Title, string Zone)>();
        await using (var cmd = new SqlCommand(
            "SELECT id, area_id, title, time_zone FROM dbo.rc_calendar ORDER BY title;", connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                calendars.Add((reader.GetGuid(0), reader.GetGuid(1),
                    reader.GetString(2), reader.GetString(3)));
        }

        foreach (var calendar in calendars)
        {
            // 3.4 — Gefiltert wird je Zeile ueber den Kernel. Eine Abfrage, die
            // die Berechtigung nachbaut, ist eine zweite Auswertungslogik.
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                calendar.AreaId, RcCapability.Read, ctx.RequestAborted);
            if (!may.Allowed) continue;

            var keys = await RcAreaKeys.EpochKeysAsync(
                connection, session.AccountId, held.MasterKey, calendar.AreaId, ctx.RequestAborted);

            var occurrences = await RcCalendar.ExpandForAgendaAsync(
                connection, calendar.Id, calendar.Zone, start, end, keys, mine, ctx.RequestAborted);

            foreach (var one in occurrences)
            {
                entries.Add(new Entry(
                    one.ItemType, RcId.ToText(calendar.Id), calendar.Title,
                    one.StartsUtc, one.EndsUtc, one.AllDay,
                    one.Title ?? one.TitlePublic, one.Location, one.Status, one.Mine, one.Unreadable,
                    null));
            }
        }

        // -- Die Veranstaltungen -----------------------------------------------

        /*
         * Nur, was einen Zeitraum HAT und in das Fenster ragt. Eine
         * Veranstaltung ohne Datum ist ein Vorhaben, kein Termin — sie im Plan
         * zu zeigen hiesse, sie auf einen Tag zu legen, den niemand gewaehlt
         * hat.
         */
        var events = new List<(Guid Id, Guid AreaId, string Collection, string Slug, string Title,
            DateTimeOffset Starts, DateTimeOffset Ends, string Lifecycle)>();

        await using (var cmd = new SqlCommand("""
            SELECT e.id, e.area_id, c.slug, e.slug, e.title,
                   e.starts_at, ISNULL(e.ends_at, e.starts_at), e.lifecycle
            FROM dbo.rc_event e
            JOIN dbo.rc_event_collection c ON c.id = e.collection_id
            WHERE e.starts_at IS NOT NULL
              AND e.starts_at < @to
              AND ISNULL(e.ends_at, e.starts_at) >= @from
            ORDER BY e.starts_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@from", start);
            cmd.Parameters.AddWithValue("@to", end);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                events.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetString(3), reader.GetString(4),
                    reader.GetDateTimeOffset(5), reader.GetDateTimeOffset(6), reader.GetString(7)));
        }

        foreach (var one in events)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                one.AreaId, RcCapability.Read, ctx.RequestAborted);
            if (!may.Allowed) continue;

            entries.Add(new Entry(
                "event", RcId.ToText(one.Id), one.Collection,
                one.Starts, one.Ends,

                /*
                 * Eine Veranstaltung ist GANZTAEGIG, solange niemand eine
                 * Uhrzeit gesetzt hat. Sie mit 00:00 in die Stundenspalte zu
                 * legen behauptete einen Beginn um Mitternacht.
                 */
                one.Starts.TimeOfDay == TimeSpan.Zero && one.Ends.TimeOfDay == TimeSpan.Zero,

                one.Title, null,
                one.Lifecycle == "published" ? "confirmed" : "planned",
                true, null,
                $"#/new/event/{one.Collection}/{one.Slug}"));
        }

        entries.Sort((a, b) =>
        {
            var byTime = a.StartsUtc.CompareTo(b.StartsUtc);
            // Bei gleicher Zeit nach Titel, damit die Reihenfolge zwischen zwei
            // Aufrufen dieselbe bleibt — sonst springt der Plan beim Neuladen.
            return byTime != 0 ? byTime
                : string.CompareOrdinal(a.Title ?? "", b.Title ?? "");
        });

        await RcResults.WriteJsonAsync(ctx, new RcAgendaResponse(start, end, entries));
    }
}
