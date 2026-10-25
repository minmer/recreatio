using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Was frei ist: Angebote prüfen, berechnen und zeigen.</summary>
public static partial class Bookings
{
    /* ======================================================================
       DIE REGEL
       ====================================================================== */

    public enum Verdict
    {
        /// <summary>Passt.</summary>
        Open,

        /// <summary>Der Gastgeber hat noch sein Fenster — ohne seinen Code nicht.</summary>
        InviteNeeded,

        /// <summary>Das Fenster ist zu, und es sitzen schon zwei darauf.</summary>
        Locked,

        /// <summary>Kein Platz mehr — oder das Haus ist ganz belegt.</summary>
        Full,

        /// <summary>Dieser Mensch haelt es schon.</summary>
        Mine,

        /// <summary>Geschlossen — von der Kanzlei oder vom Gastgeber (0049), auch wenn noch Platz ist.</summary>
        Closed
    }

    /// <summary>
    /// Die Regel fuer ANGEBOTENE Zeiten — die aus 0029, unveraendert.
    ///
    /// <code>
    ///   haelt er es schon                   Mine
    ///   belegt >= Plaetze                   Full
    ///   belegt == 0                         Open   (und er wird Gastgeber)
    ///   keine Einladungen (invite_hours 0)  Open
    ///   niemand haelt das Vorrecht          Open   (abgegeben, oder der Gastgeber ging)
    ///   Fenster offen:
    ///       richtiger Code                  Open
    ///       sonst                           InviteNeeded
    ///   Fenster zu:
    ///       belegt == 1                     Open   (faellt an alle zurueck)
    ///       sonst                           Locked
    /// </code>
    ///
    /// <para>
    /// <b>Warum das Fenster.</b> Wer zuerst zugreift, soll sich aussuchen
    /// duerfen, mit wem er hingeht — drei Tage lang. Danach faellt ein Termin,
    /// auf dem erst einer sitzt, wieder an alle: sonst blockierte ein einzelner
    /// Platz einen ganzen Termin, bloss weil niemand seinen Code bekommen hat.
    /// </para>
    ///
    /// <para>
    /// <b>Wer nicht einladen will, gibt das Vorrecht ab</b> (<see cref="UnhostAsync"/>).
    /// Dann gibt es keinen Gastgeber mehr, und was frei ist, ist frei — sofort,
    /// nicht erst nach dem Fenster. Dasselbe, wenn der Gastgeber seinen Termin
    /// zurueckgibt: die anderen sitzen weiter, die freien Plaetze gehoeren allen.
    /// </para>
    /// </summary>
    public static Verdict JudgeOffer(
        int capacity, int inviteHours, int taken, bool mine,
        byte[]? hostHash, DateTimeOffset? inviteUntil, string? code, DateTimeOffset now,
        int minPersons = 2, bool closed = false)
    {
        if (mine) return Verdict.Mine;

        /* Geschlossen ist geschlossen — auch mit freien Plaetzen, auch mit Code (0049). */
        if (closed) return Verdict.Closed;
        if (taken >= capacity) return Verdict.Full;
        if (taken == 0 || inviteHours == 0) return Verdict.Open;
        if (hostHash is null) return Verdict.Open;

        var windowOpen = inviteUntil is not null && inviteUntil > now;

        if (windowOpen)
        {
            return hostHash is not null && !string.IsNullOrWhiteSpace(code)
                   && CryptographicOperations.FixedTimeEquals(hostHash, HashCode(code))
                ? Verdict.Open
                : Verdict.InviteNeeded;
        }

        /*
         * NACH DEM FENSTER: wer genug beisammen hat, behaelt den Termin; wer
         * weniger hat, teilt die freien Plaetze mit allen (0049). Die Zahl
         * setzt die Kanzlei; 2 ist, was bisher galt.
         */
        return taken >= Math.Max(1, minPersons) ? Verdict.Locked : Verdict.Open;
    }

    /// <summary>
    /// Die Regel fuer FREI GEWAEHLTE Zeiten — was gleichzeitig ist, zaehlt.
    ///
    /// <para>
    /// <b>Gleichzeitig, nicht „ueberschneidet sich irgendwie".</b> Bei zwei
    /// Plaetzen passen eine Gruppe von 9 bis 10 und eine von 11 bis 12 neben
    /// eine dritte von 9 bis 12 — zu keinem Zeitpunkt sind es mehr als zwei.
    /// Einfach die Ueberschneidungen zu zaehlen, saehe drei und lehnte ab.
    /// </para>
    ///
    /// <para>
    /// <b>Die Puffer gehoeren zu beiden Seiten.</b> Wer um 18 Uhr geht, hinter
    /// dem wird eine Stunde geputzt; wer um 20 Uhr kommt, fuer den wird eine
    /// halbe Stunde vorbereitet. Zwischen zwei Gruppen muessen also beide
    /// liegen: `after + before`. Deshalb wird Belegung gegen Belegung geprueft,
    /// jede um ihre Puffer verlaengert.
    /// </para>
    /// </summary>
    public static int Busiest(
        IEnumerable<(DateTimeOffset Starts, DateTimeOffset Ends)> others,
        DateTimeOffset starts, DateTimeOffset ends, int before, int after)
    {
        var lo = starts.AddMinutes(-before);
        var hi = ends.AddMinutes(after);

        var events = new List<(DateTimeOffset At, int Step)>();

        foreach (var (s, e) in others)
        {
            var from = s.AddMinutes(-before);
            var to = e.AddMinutes(after);

            if (from >= hi || to <= lo) continue;

            /* Nur das Stueck innerhalb meines Fensters zaehlt. */
            events.Add((from < lo ? lo : from, +1));
            events.Add((to > hi ? hi : to, -1));
        }

        /* Bei gleichem Zeitpunkt erst gehen, dann kommen: wer um 12 geht und wer
           um 12 kommt, sind nicht gleichzeitig da. */
        events.Sort((a, b) => a.At != b.At ? a.At.CompareTo(b.At) : a.Step.CompareTo(b.Step));

        var now = 0;
        var most = 0;

        foreach (var (_, step) in events)
        {
            now += step;
            if (now > most) most = now;
        }

        return most;
    }

    /* ======================================================================
       EIN ANGEBOT IST EIN TERMIN IM KALENDER
       ====================================================================== */

    /// <summary>
    /// Ein angebotenes Vorkommen. <c>Capacity</c> und <c>ReserveAreaId</c>:
    /// was DIESER Termin für sich sagt (0058) — NULL heisst: wie das Ding.
    /// </summary>
    private sealed record Offer(Guid ItemId, DateTimeOffset OccurrenceAt,
        DateTimeOffset StartsAt, DateTimeOffset EndsAt, int? Capacity = null, Guid? ReserveAreaId = null);

    /// <summary>Das Ding, wie es für DIESEN Termin gilt — mit dessen eigenen Plätzen.</summary>
    private static ResourceRow ForOffer(ResourceRow resource, Offer offer) =>
        offer.Capacity is int capacity ? resource with { Capacity = capacity } : resource;

    /// <summary>Wie viele Plätze ein Termin hat — seine eigenen, sonst die des Dings.</summary>
    private static async Task<int> ItemCapacityAsync(
        SqlConnection connection, SqlTransaction? tx, ResourceRow resource, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT capacity FROM app.calendar_item WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", itemId);
        return await cmd.ExecuteScalarAsync(ct) is int own ? own : resource.Capacity;
    }

    /// <summary>
    /// DARF DIESER HALTER HIER RESERVIEREN (0058)? Ein Platz, wenn er zu dem
    /// Bereich gehört (oder einem darunter) oder ihn aufschliesst; eine Person,
    /// wenn eine der Rollen ihres Kontos dort steht. „Darunter", weil eine
    /// Gruppe in der Pfarrei zur Pfarrei gehört: offen für die Pfarrei heisst
    /// auch offen für die Firmgruppe darin.
    /// </summary>
    internal static async Task<bool> MayReserveAsync(
        SqlConnection connection, SqlTransaction? tx, Guid areaId, Guid holder, bool isRole,
        IReadOnlyList<Guid> accountRoles, CancellationToken ct)
    {
        var family = new List<Guid> { areaId };
        await using (var below = new SqlCommand("""
            WITH down AS (
                SELECT id FROM app.area WHERE parent_area_id = @a
                UNION ALL
                SELECT c.id FROM app.area c JOIN down d ON c.parent_area_id = d.id
            )
            SELECT id FROM down OPTION (MAXRECURSION 32);
            """, connection, tx))
        {
            below.Parameters.AddWithValue("@a", areaId);
            await using var reader = await below.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) family.Add(reader.GetGuid(0));
        }

        var areas = string.Join(", ", family.Select((_, i) => $"@f{i}"));

        if (!isRole)
        {
            await using var seat = new SqlCommand($"""
                SELECT CASE WHEN EXISTS (SELECT 1 FROM app.access WHERE id = @h AND area_id IN ({areas}))
                              OR EXISTS (SELECT 1 FROM app.access_grant WHERE access_id = @h AND area_id IN ({areas}))
                              OR EXISTS (SELECT 1 FROM app.access_role_area WHERE access_id = @h AND area_id IN ({areas}))
                            THEN 1 ELSE 0 END;
                """, connection, tx);
            seat.Parameters.AddWithValue("@h", holder);
            for (var i = 0; i < family.Count; i++) seat.Parameters.AddWithValue($"@f{i}", family[i]);
            return (int)(await seat.ExecuteScalarAsync(ct))! == 1;
        }

        var roles = accountRoles.Count > 0 ? accountRoles : [holder];
        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM app.certificate
                 WHERE scope_kind = N'area' AND scope_id IN ({areas})
                   AND revoked_at IS NULL AND expires_at > @now
                   AND subject_role_id IN ({names})) THEN 1 ELSE 0 END;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < family.Count; i++) cmd.Parameters.AddWithValue($"@f{i}", family[i]);
        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i]);
        return (int)(await cmd.ExecuteScalarAsync(ct))! == 1;
    }

    private static async Task<string> AreaNameAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT name FROM app.area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) as string ?? "wybranej grupy";
    }

    /// <summary>
    /// Die angebotenen Termine eines Dings in einem Zeitraum.
    ///
    /// <para>
    /// <b>Jeder Termin (`appointment`) im Kalender des Dings IST ein Angebot.</b>
    /// Es gibt keine eigene Liste „buchbar": der Kalender sagt schon, wann der
    /// Priester da ist. Gestrichene Vorkommen fallen heraus, verschobene stehen
    /// an ihrer neuen Zeit — dieselben Ausnahmen wie ueberall (`Calendar`).
    /// </para>
    /// </summary>
    private static async Task<List<Offer>> OffersOfAsync(
        SqlConnection connection, ResourceRow resource, DateTimeOffset from, DateTimeOffset to,
        Guid? onlyItem, CancellationToken ct)
    {
        var offers = new List<Offer>();
        if (resource.CalendarId is null) return offers;

        var items = new List<(Guid Id, DateTimeOffset Starts, DateTimeOffset Ends, string Kind,
            int Every, int? Weekdays, DateTimeOffset? Until, int? Count)>();
        string zoneName;

        await using (var zone = new SqlCommand(
            "SELECT time_zone FROM app.calendar WHERE id = @c;", connection))
        {
            zone.Parameters.AddWithValue("@c", resource.CalendarId.Value);
            zoneName = await zone.ExecuteScalarAsync(ct) as string ?? Zones.Home;
        }

        /*
         * 0058 — NICHT JEDER TERMIN IST EIN ANGEBOT. Einer sagt es für sich
         * (`bookable`), sonst gilt, was das Ding für seinen Kalender sagt
         * (`bookable_default`, bisher immer ja). So steht die Ratssitzung nicht
         * mehr zur Buchung, nur weil sie im selben Kalender liegt.
         */
        var own = new Dictionary<Guid, (int? Capacity, Guid? ReserveAreaId)>();

        await using (var cmd = new SqlCommand($"""
            SELECT id, starts_at, ends_at, repeat_kind, repeat_every, repeat_weekdays,
                   repeat_until, repeat_count, capacity, reserve_area_id
            FROM app.calendar_item
            WHERE calendar_id = @c AND kind = N'appointment' AND status <> N'cancelled'
              AND COALESCE(bookable, @default) = 1
              AND starts_at <= @to
              AND (repeat_kind = N'none' OR repeat_until IS NULL OR repeat_until >= @from)
              {(onlyItem is null ? "" : "AND id = @item")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@c", resource.CalendarId.Value);
            cmd.Parameters.AddWithValue("@from", from);
            cmd.Parameters.AddWithValue("@to", to);
            cmd.Parameters.AddWithValue("@default", resource.BookableDefault);
            if (onlyItem is not null) cmd.Parameters.AddWithValue("@item", onlyItem.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add((reader.GetGuid(0), reader.GetDateTimeOffset(1), reader.GetDateTimeOffset(2),
                    reader.GetString(3), reader.GetInt32(4),
                    reader.IsDBNull(5) ? null : reader.GetByte(5),
                    reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6),
                    reader.IsDBNull(7) ? null : reader.GetInt32(7)));
                own[reader.GetGuid(0)] = (reader.IsDBNull(8) ? null : reader.GetInt32(8),
                    reader.IsDBNull(9) ? null : reader.GetGuid(9));
            }
        }

        var exceptions = await Calendar.ExceptionsAsync(
            connection, items.Select(i => i.Id).ToList(), ct);
        var tz = Zones.Of(zoneName);

        foreach (var item in items)
        {
            var span = item.Ends - item.Starts;

            foreach (var at in Calendar.Occurrences(item.Starts, item.Kind, item.Every,
                         item.Weekdays, item.Until, item.Count, from, to, tz))
            {
                var starts = at;

                if (exceptions.TryGetValue((item.Id, at), out var exception))
                {
                    if (exception.Cancelled) continue;
                    if (exception.MovedTo is not null) starts = exception.MovedTo.Value;
                }

                var (capacity, audience) = own[item.Id];
                offers.Add(new Offer(item.Id, at, starts, starts + span, capacity, audience));
            }
        }

        offers.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));
        return offers;
    }

    /// <summary>Genau dieses Vorkommen — oder nichts, wenn es keins ist.</summary>
    private static async Task<Offer?> OfferAsync(
        SqlConnection connection, ResourceRow resource, Guid itemId, DateTimeOffset occurrenceAt,
        CancellationToken ct)
    {
        /* Ein Fenster um das Vorkommen — eng genug, um nur dieses zu finden. */
        var found = await OffersOfAsync(connection, resource,
            occurrenceAt.AddMinutes(-1), occurrenceAt.AddMinutes(1), itemId, ct);

        return found.FirstOrDefault(o => o.OccurrenceAt == occurrenceAt);
    }

    /* ======================================================================
       WAS FREI IST — fuer jeden, ohne Namen
       ====================================================================== */

    /// <summary>
    /// Was man sich nehmen kann — und, mit einem Platz, was man schon haelt.
    ///
    /// <para>
    /// <b>Nie, WER etwas haelt.</b> Ein Besucher sieht „zwei von drei belegt"
    /// oder „Freitag 14 bis 18 belegt" — nicht, von wem. Auch der Gastgeber
    /// sieht von den Bittenden nur, dass es sie gibt, und den Namen, den die
    /// Kanzlei dem Platz gegeben hat.
    /// </para>
    /// </summary>
    private static async Task OffersAsync(
        HttpContext ctx, Db db, string? resource, string? seat, string? role, string? from, string? to)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        ResourceRow? found = Guid.TryParse(resource, out var resourceId)
            ? await ResourceAsync(connection, resourceId, ctx.RequestAborted)
            : null;

        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego nie da się zarezerwować.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var since = DateTimeOffset.TryParse(from, out var f) && f > now ? f : now;
        var till = DateTimeOffset.TryParse(to, out var t) && t > since ? t : since.AddDays(60);
        if (till > since.AddDays(400)) till = since.AddDays(400);

        /* Ein Platz — oder eine eigene Person, mit Anmeldung (0045). */
        var holderRow = await HolderAsync(ctx, db, connection, seat, role, ctx.RequestAborted);
        var me = holderRow?.Id;

        /* 0058 — für „wer darf reservieren": die Rollen des Kontos hinter der Person. */
        var holderRoles = new List<Guid>();
        if (holderRow is { IsRole: true } && await Auth.WhoAsync(ctx, db) is { } signedIn)
        {
            holderRoles = (await Workspace.RolesOfAsync(connection, signedIn.AccountId, ctx.RequestAborted))
                .Select(r => r.Id).ToList();
        }

        var rules = new
        {
            resourceId = Ids.ToText(found.Id),

            /* 0097 — unter dem Schlüssel (oder für die Annahme) dieses Bereichs versiegelt eine Person ihren Namen für die Kanzlei. */
            areaId = Ids.ToText(found.AreaId),
            name = found.Name,
            kind = found.Kind,
            mode = found.Mode,
            byNight = found.ByNight,
            checkInMin = found.CheckInMin,
            checkOutMin = found.CheckOutMin,
            capacity = found.Capacity,
            bufferBefore = found.BufferBefore,
            bufferAfter = found.BufferAfter,
            approval = found.Approval,
            inviteHours = found.InviteHours,
            leadDays = found.LeadDays,
            perPerson = found.PerPerson,
            minPersons = found.MinPersons,
            reserveAreaId = found.ReserveAreaId is null ? null : Ids.ToText(found.ReserveAreaId.Value),
            bookableDefault = found.BookableDefault,

            /* 0129 — wer für die Daten der Reservierung geradesteht (die Klausel auf der Karte); null: niemand, dann nimmt sie nichts an. */
            controller = Controllers.Json(await Controllers.OfAreaAsync(connection, found.AreaId, ctx.RequestAborted))
        };

        if (found.Mode == "offered")
        {
            var offers = await OffersOfAsync(connection, found, since, till, null, ctx.RequestAborted);
            var shown = new List<object>();
            var closedAll = await ClosedInAsync(connection, found.Id, ctx.RequestAborted);

            foreach (var offer in offers)
            {
                var claims = await OfferClaimsAsync(connection, null, found.Id, offer.ItemId,
                    offer.OccurrenceAt, ctx.RequestAborted);

                /* Bitten, ueber die niemand mehr entscheidet, bekommen jetzt ihre Antwort (0050). */
                if (await SettleAsksAsync(connection, found, offer.ItemId, offer.OccurrenceAt, claims, now,
                        ctx.RequestAborted))
                {
                    claims = await OfferClaimsAsync(connection, null, found.Id, offer.ItemId,
                        offer.OccurrenceAt, ctx.RequestAborted);
                }

                var taken = claims.Count(Counts);
                var host = claims.FirstOrDefault(c => Hosts(c, now));
                var myClaim = me is null ? null : claims.FirstOrDefault(c => c.HeldBy(me.Value));

                closedAll.TryGetValue((offer.ItemId, offer.OccurrenceAt), out var closedBy);

                /*
                 * 0058 — FÜR WEN: ist der Termin für eine Gruppe, und gehört
                 * dieser Halter nicht dazu (oder ist keiner bekannt), steht er
                 * für ihn geschlossen da — nehmen liesse ihn der Dienst ohnehin nicht.
                 */
                var audience = offer.ReserveAreaId ?? found.ReserveAreaId;
                var notForMe = audience is Guid only && myClaim is null
                    && (holderRow is null || !await MayReserveAsync(connection, null, only, holderRow.Value.Id,
                        holderRow.Value.IsRole, holderRoles, ctx.RequestAborted));

                var verdict = JudgeOffer(offer.Capacity ?? found.Capacity, found.InviteHours, taken,
                    myClaim is not null, host?.InviteSha256, host?.InviteUntil, null, now,
                    found.MinPersons, closedBy is not null || notForMe);

                var hosting = host is not null && me is not null && host.HeldBy(me.Value);

                shown.Add(new
                {
                    itemId = Ids.ToText(offer.ItemId),
                    occurrenceAt = offer.OccurrenceAt,
                    startsAt = offer.StartsAt,
                    endsAt = offer.EndsAt,
                    taken,
                    capacity = offer.Capacity ?? found.Capacity,
                    state = verdict.ToString().ToLowerInvariant(),
                    forOthers = notForMe,
                    inviteUntil = host?.InviteUntil,

                    /* Der Erste entscheidet noch, ob er einlaedt — bis `inviteUntil` (0050). */
                    hostPending = host is not null && HostUndecided(host, now),

                    /* 0097 — sein öffentlicher Schlüssel: wer um Mitnahme bittet, versiegelt seinen Namen darauf. */
                    hostWrapPublic = host?.HostPublic is null ? null : Base64Url.Encode(host.HostPublic),

                    myClaimId = myClaim is null ? null : Ids.ToText(myClaim.Id),
                    myStatus = myClaim?.Status,
                    hosting,

                    /* Geschlossen, und von wem (0049) — der Gastgeber darf nur seins wieder öffnen. */
                    closedBy,

                    /* Wer um Mitnahme bittet — nur fuer den Gastgeber: der Name,
                       versiegelt auf seinen Schluessel (0097). */
                    asks = hosting
                        ? Asks(claims)
                        : []
                });
            }

            /* Was DIESER Platz haelt — nach dem Beantworten der Bitten, damit es stimmt. */
            var mineNow = me is null ? [] : await MineAsync(connection, found.Id, me.Value, now, ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new { resource = rules, offers = shown, mine = mineNow });
            return;
        }

        var mine = me is null ? [] : await MineAsync(connection, found.Id, me.Value, now, ctx.RequestAborted);

        /* -- frei gewaehlt: was belegt ist, ohne Namen ------------------------ */

        var tree = await TreeAsync(connection, null, found, ctx.RequestAborted);
        var family = new List<Guid>([found.Id, .. tree.Above, .. tree.Below]);
        var names = string.Join(", ", family.Select((_, i) => $"@f{i}"));
        var busy = new List<object>();

        await using (var cmd = new SqlCommand($"""
            SELECT resource_id, starts_at, ends_at, status, awaits FROM app.claim
            WHERE resource_id IN ({names}) AND status IN (N'pending', N'confirmed')
              AND starts_at < @to AND ends_at > @from
            ORDER BY starts_at;
            """, connection))
        {
            for (var i = 0; i < family.Count; i++) cmd.Parameters.AddWithValue($"@f{i}", family[i]);
            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var status = reader.GetString(3);
                var awaits = reader.IsDBNull(4) ? null : reader.GetString(4);
                if (status == "pending" && awaits == "host") continue;

                var own = reader.GetGuid(0) == found.Id;

                busy.Add(new
                {
                    startsAt = reader.GetDateTimeOffset(1),
                    endsAt = reader.GetDateTimeOffset(2),

                    /* Ein Teil des Hauses oder das ganze darueber — beides belegt
                       ganz, unabhaengig von den Plaetzen. */
                    whole = !own,
                    tentative = status == "pending"
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { resource = rules, busy, mine });
    }

    private static async Task<List<object>> MineAsync(
        SqlConnection connection, Guid resourceId, Guid me, DateTimeOffset now, CancellationToken ct)
    {
        var mine = new List<object>();

        await using var cmd = new SqlCommand($"""
            SELECT {ClaimColumns} FROM app.claim
            WHERE resource_id = @r AND (access_id = @me OR role_id = @me) AND status <> N'released'
            ORDER BY starts_at;
            """, connection);

        cmd.Parameters.AddWithValue("@r", resourceId);
        cmd.Parameters.AddWithValue("@me", me);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var c = ReadClaim(reader);
            mine.Add(new
            {
                claimId = Ids.ToText(c.Id),
                startsAt = c.StartsAt,
                endsAt = c.EndsAt,
                itemId = c.ItemId is null ? null : Ids.ToText(c.ItemId.Value),
                occurrenceAt = c.OccurrenceAt,
                groupId = Ids.ToText(c.GroupId),
                status = c.Status,
                awaits = c.Awaits,
                hosting = Hosts(c, now),

                /* Er hat ihn als Erster und soll sagen, ob er einlaedt — bis `inviteUntil` (0050). */
                hostPending = HostUndecided(c, now),
                inviteUntil = c.InviteUntil,

                /* Der Code, versiegelt unter dem Schluessel des Halters — lesen kann ihn nur er (0045). */
                inviteSealed = c.InviteSealed is null ? null : Base64Url.Encode(c.InviteSealed),

                /* 0097 — sein privater Schlüssel (unter dem des Halters): damit öffnet er die Namen derer, die bitten. */
                hostWrapPrivateSealed = c.HostPrivate is null ? null : Base64Url.Encode(c.HostPrivate)
            });
        }

        return mine;
    }

    /// <summary>0097 — wer bittet: der Name für den Gastgeber, versiegelt auf seinen Schlüssel.</summary>
    private static List<object> Asks(List<ClaimRow> claims) =>
        claims.Where(c => c.Status == "pending" && c.Awaits == "host")
            .Select(c => (object)new { claimId = Ids.ToText(c.Id), nameSealed = c.AskSealed is null ? null : Base64Url.Encode(c.AskSealed) })
            .ToList();
}
