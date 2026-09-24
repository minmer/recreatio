using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Etwas, das man sich fuer eine Zeit nehmen kann (0039).
///
/// <para>
/// <b>Zwei Faelle, eine Pruefung.</b> Ein Firmling nimmt sich einen Platz bei
/// einem Treffen mit dem Priester; eine Gruppe fragt nach einem Haus in Hortus
/// Dei. Beides ist: jemand nimmt sich einen Teil von etwas Begrenztem, fuer
/// eine Zeit. Was sich unterscheidet, sind Regeln am Ding (`app.resource`) —
/// wer die Zeit waehlt, was die Grenze zaehlt, Puffer, wer bestaetigt, ob der
/// Erste einladen darf. Die Frage „passt das noch" wird hier EINMAL
/// beantwortet, fuer beide.
/// </para>
///
/// <para>
/// <b>Unter einer Sperre, und das ist der Grund fuer diese Datei.</b> 0029
/// zaehlte die belegten Plaetze und schrieb die Buchung in einem zweiten
/// Schritt. Zwei Menschen im selben Augenblick lasen beide „einer frei" und
/// bekamen beide einen. Hier wird die Wurzel des Dings gesperrt, bevor gezaehlt
/// wird, und erst nach dem Schreiben freigegeben — wer danach kommt, zaehlt den
/// Vorgaenger mit.
/// </para>
///
/// <para>
/// <b>Die Wurzel und nicht das Ding</b>, weil in einem Baum auch das Haus das
/// Zimmer belegt: wer das ganze Haus nimmt, waehrend ein anderer das Zimmer
/// darin nimmt, muss mit ihm in dieselbe Schlange.
/// </para>
/// </summary>
public static class Bookings
{
    /// <summary>Sechs Zeichen, wie in 0029: er wird abgetippt, nicht kopiert.</summary>
    private const int CodeLength = 6;

    /* Ohne 0, O, 1, I, L — auf Papier und per SMS sind sie dasselbe Zeichen. */
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private const int MaxName = 200;

    private static readonly string[] Kinds = ["person", "room", "house", "place", "other"];

    public static void Map(WebApplication app)
    {
        /* -- die Kanzlei ---------------------------------------------------- */
        app.MapGet("/workspace/resources", ListAsync);
        app.MapPost("/workspace/resource", CreateAsync);
        app.MapPost("/workspace/resource/{id:guid}", UpdateAsync);
        app.MapGet("/workspace/resource/{id:guid}/claims", OfficeClaimsAsync);
        app.MapPost("/workspace/claim/{id:guid}/decide", OfficeDecideAsync);

        /*
         * -- wer sich etwas nimmt -------------------------------------------
         *
         * Ohne Konto: der Platz (`seat`) ist der Ausweis. Der Dienst sieht nur
         * das Token — der Schluessel, der die Einsendung oeffnet, bleibt im
         * Browser und wird hier gar nicht gebraucht.
         */
        app.MapGet("/resource/offers", OffersAsync);
        app.MapPost("/resource/claim", ClaimAsync);
        app.MapPost("/resource/release", ReleaseAsync);
        app.MapPost("/resource/ask", AskAsync);
        app.MapPost("/resource/decide", HostDecideAsync);
    }

    /* ======================================================================
       DAS DING
       ====================================================================== */

    internal sealed record ResourceRow(
        Guid Id, Guid AreaId, Guid? ParentId, Guid? CalendarId, string Name, string Kind,
        string Mode, bool ByNight, int CheckInMin, int CheckOutMin, int Capacity,
        int BufferBefore, int BufferAfter, string Approval, int InviteHours, int LeadDays);

    private const string ResourceColumns = """
        id, area_id, parent_id, calendar_id, name, kind, mode, by_night, check_in_min,
        check_out_min, capacity, buffer_before, buffer_after, approval, invite_hours, lead_days
        """;

    private static ResourceRow ReadResource(SqlDataReader r) => new(
        r.GetGuid(0), r.GetGuid(1),
        r.IsDBNull(2) ? null : r.GetGuid(2),
        r.IsDBNull(3) ? null : r.GetGuid(3),
        r.GetString(4), r.GetString(5), r.GetString(6), r.GetBoolean(7),
        r.GetInt32(8), r.GetInt32(9), r.GetInt32(10), r.GetInt32(11), r.GetInt32(12),
        r.GetString(13), r.GetInt32(14), r.GetInt32(15));

    private static async Task<ResourceRow?> ResourceAsync(
        SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            $"SELECT {ResourceColumns} FROM app.resource WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadResource(reader) : null;
    }

    /// <summary>
    /// Der Baum um ein Ding — seine Vorfahren und seine Nachkommen.
    ///
    /// <para>
    /// <b>Aus EINER Abfrage.</b> Die Dinge eines Bereichs sind wenige (ein Ort,
    /// ein paar Haeuser, ihre Zimmer); sie alle zu holen und den Baum hier zu
    /// bauen ist billiger als eine rekursive Abfrage und liest sich besser.
    /// </para>
    /// </summary>
    private static async Task<(Guid Root, HashSet<Guid> Above, HashSet<Guid> Below)> TreeAsync(
        SqlConnection connection, SqlTransaction? tx, ResourceRow resource, CancellationToken ct)
    {
        var parent = new Dictionary<Guid, Guid?>();

        await using (var cmd = new SqlCommand(
            "SELECT id, parent_id FROM app.resource WHERE area_id = @a;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@a", resource.AreaId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                parent[reader.GetGuid(0)] = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var above = new HashSet<Guid>();
        var root = resource.Id;

        /* Hinauf — und nicht endlos, falls die Datenbank je einen Kreis haette. */
        for (var at = resource.ParentId; at is not null && above.Add(at.Value); )
        {
            root = at.Value;
            at = parent.TryGetValue(at.Value, out var up) ? up : null;
        }

        var below = new HashSet<Guid>();
        var queue = new Queue<Guid>([resource.Id]);

        while (queue.Count > 0)
        {
            var here = queue.Dequeue();
            foreach (var (child, up) in parent)
                if (up == here && below.Add(child)) queue.Enqueue(child);
        }

        return (root, above, below);
    }

    /* ======================================================================
       WER ES HAELT
       ====================================================================== */

    private sealed record ClaimRow(
        Guid Id, Guid ResourceId, DateTimeOffset StartsAt, DateTimeOffset EndsAt,
        Guid? ItemId, DateTimeOffset? OccurrenceAt, Guid? AccessId, Guid? RoleId, Guid GroupId,
        string Status, string? Awaits, byte[]? InviteSha256, DateTimeOffset? InviteUntil);

    private const string ClaimColumns = """
        id, resource_id, starts_at, ends_at, item_id, occurrence_at, access_id, role_id,
        group_id, status, awaits, invite_sha256, invite_until
        """;

    private static ClaimRow ReadClaim(SqlDataReader r) => new(
        r.GetGuid(0), r.GetGuid(1), r.GetDateTimeOffset(2), r.GetDateTimeOffset(3),
        r.IsDBNull(4) ? null : r.GetGuid(4),
        r.IsDBNull(5) ? null : r.GetDateTimeOffset(5),
        r.IsDBNull(6) ? null : r.GetGuid(6),
        r.IsDBNull(7) ? null : r.GetGuid(7),
        r.GetGuid(8), r.GetString(9),
        r.IsDBNull(10) ? null : r.GetString(10),
        r.IsDBNull(11) ? null : (byte[])r[11],
        r.IsDBNull(12) ? null : r.GetDateTimeOffset(12));

    /// <summary>
    /// ZAEHLT GEGEN DIE GRENZE?
    ///
    /// <para>
    /// Was steht, zaehlt. Was auf die KANZLEI wartet, zaehlt auch — sonst zeigte
    /// der Kalender frei, was schon erfragt ist. Was auf den GASTGEBER wartet,
    /// zaehlt nicht: eine Bitte um Mitnahme soll nicht den Platz blockieren,
    /// den der Gastgeber vielleicht jemand anderem geben will. Sie wird beim
    /// Ja noch einmal gegen die Grenze geprueft.
    /// </para>
    /// </summary>
    private static bool Counts(ClaimRow c) =>
        c.Status == "confirmed" || (c.Status == "pending" && c.Awaits == "office");

    private static bool Live(ClaimRow c) => c.Status is "confirmed" or "pending";

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
        Mine
    }

    /// <summary>
    /// Die Regel fuer ANGEBOTENE Zeiten — die aus 0029, unveraendert.
    ///
    /// <code>
    ///   haelt er es schon                   Mine
    ///   belegt >= Plaetze                   Full
    ///   belegt == 0                         Open   (und er wird Gastgeber)
    ///   keine Einladungen (invite_hours 0)  Open
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
    /// </summary>
    public static Verdict JudgeOffer(
        int capacity, int inviteHours, int taken, bool mine,
        byte[]? hostHash, DateTimeOffset? inviteUntil, string? code, DateTimeOffset now)
    {
        if (mine) return Verdict.Mine;
        if (taken >= capacity) return Verdict.Full;
        if (taken == 0 || inviteHours == 0) return Verdict.Open;

        var windowOpen = inviteUntil is not null && inviteUntil > now;

        if (windowOpen)
        {
            return hostHash is not null && !string.IsNullOrWhiteSpace(code)
                   && CryptographicOperations.FixedTimeEquals(hostHash, HashCode(code))
                ? Verdict.Open
                : Verdict.InviteNeeded;
        }

        return taken == 1 ? Verdict.Open : Verdict.Locked;
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

    private sealed record Offer(Guid ItemId, DateTimeOffset OccurrenceAt,
        DateTimeOffset StartsAt, DateTimeOffset EndsAt);

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

        await using (var cmd = new SqlCommand($"""
            SELECT id, starts_at, ends_at, repeat_kind, repeat_every, repeat_weekdays,
                   repeat_until, repeat_count
            FROM app.calendar_item
            WHERE calendar_id = @c AND kind = N'appointment' AND status <> N'cancelled'
              AND starts_at <= @to
              AND (repeat_kind = N'none' OR repeat_until IS NULL OR repeat_until >= @from)
              {(onlyItem is null ? "" : "AND id = @item")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@c", resource.CalendarId.Value);
            cmd.Parameters.AddWithValue("@from", from);
            cmd.Parameters.AddWithValue("@to", to);
            if (onlyItem is not null) cmd.Parameters.AddWithValue("@item", onlyItem.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add((reader.GetGuid(0), reader.GetDateTimeOffset(1), reader.GetDateTimeOffset(2),
                    reader.GetString(3), reader.GetInt32(4),
                    reader.IsDBNull(5) ? null : reader.GetByte(5),
                    reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6),
                    reader.IsDBNull(7) ? null : reader.GetInt32(7)));
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

                offers.Add(new Offer(item.Id, at, starts, starts + span));
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
       NEHMEN
       ====================================================================== */

    public sealed record ClaimRequest(
        string ResourceId, string? ItemId, string? OccurrenceAt,
        string? StartsAt, string? EndsAt, string? Seat, string? Code, string? GroupId);

    private static async Task ClaimAsync(HttpContext ctx, Db db, ClaimRequest body)
    {
        await TakeAsync(ctx, db, body, asking: false);
    }

    public sealed record AskRequest(string ResourceId, string ItemId, string OccurrenceAt, string? Seat);

    /// <summary>
    /// Um Mitnahme bitten — der zweite Weg hinein, wenn der Code fehlt.
    ///
    /// <para>
    /// <b>Kein eigener Buchungsweg.</b> Es entsteht dieselbe Zeile wie beim
    /// Nehmen, nur wartend und mit dem Gastgeber als dem, der ja sagen muss.
    /// Sagt er ja, steht sie — es gibt EINEN Weg auf einen Termin, nicht zwei.
    /// </para>
    /// </summary>
    private static async Task AskAsync(HttpContext ctx, Db db, AskRequest body)
    {
        await TakeAsync(ctx, db,
            new ClaimRequest(body.ResourceId, body.ItemId, body.OccurrenceAt, null, null, body.Seat, null, null),
            asking: true);
    }

    /// <summary>
    /// Sich etwas nehmen — oder darum bitten. EINE Pruefung, beide Faelle.
    /// </summary>
    private static async Task TakeAsync(HttpContext ctx, Db db, ClaimRequest body, bool asking)
    {
        if (!Guid.TryParse(body.ResourceId, out var resourceId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zasób.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, body.Seat, ctx.RequestAborted);
        if (me is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var resource = await ResourceAsync(connection, resourceId, ctx.RequestAborted);
        if (resource is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego nie da się zarezerwować.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        /*
         * -- WELCHE ZEIT ------------------------------------------------------
         *
         * Vor der Sperre: das Angebot zu pruefen liest nur, und ob es den
         * Termin gibt, ist nicht das, worum zwei Menschen gleichzeitig
         * streiten. Gestritten wird um die Plaetze — die werden unter der
         * Sperre gezaehlt.
         */
        DateTimeOffset starts, ends;
        Guid? itemId = null;
        DateTimeOffset? occurrenceAt = null;

        if (resource.Mode == "offered")
        {
            if (!Guid.TryParse(body.ItemId, out var item)
                || !DateTimeOffset.TryParse(body.OccurrenceAt, out var at))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz jeden z podanych terminów.");
                return;
            }

            var offer = await OfferAsync(connection, resource, item, at, ctx.RequestAborted);
            if (offer is null)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo go odwołano.");
                return;
            }

            (starts, ends, itemId, occurrenceAt) = (offer.StartsAt, offer.EndsAt, item, at);
        }
        else
        {
            if (asking)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Tu nie ma gospodarza, którego można by prosić.");
                return;
            }

            if (!DateTimeOffset.TryParse(body.StartsAt, out starts)
                || !DateTimeOffset.TryParse(body.EndsAt, out ends) || ends <= starts)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Podaj od kiedy do kiedy.");
                return;
            }

            if (starts < now.AddDays(resource.LeadDays))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, resource.LeadDays == 0
                    ? "Ten czas już minął."
                    : $"Zapytać można najwcześniej na {resource.LeadDays} dni naprzód.");
                return;
            }
        }

        if (starts <= now)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Ten termin już minął.");
            return;
        }

        Guid? group = null;
        if (!string.IsNullOrWhiteSpace(body.GroupId))
        {
            if (!Guid.TryParse(body.GroupId, out var g))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna grupa.");
                return;
            }
            group = g;
        }

        var tree = await TreeAsync(connection, null, resource, ctx.RequestAborted);
        var claimId = Ids.NewId();
        string? code = null;
        string status;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            /*
             * -- DIE SPERRE -------------------------------------------------------
             *
             * Auf die WURZEL des Baums. Bis zum Ende dieser Transaktion wartet
             * jeder andere, der in diesem Baum etwas nimmt — und zaehlt danach
             * mit, was hier geschrieben wurde.
             */
            await using (var hold = new SqlCommand(
                "SELECT id FROM app.resource WITH (UPDLOCK, HOLDLOCK) WHERE id = @root;", connection, tx))
            {
                hold.Parameters.AddWithValue("@root", tree.Root);
                await hold.ExecuteScalarAsync(ctx.RequestAborted);
            }

            /* Eine genannte Gruppe muss DIESEM Menschen gehoeren. */
            if (group is not null)
            {
                await using var own = new SqlCommand(
                    "SELECT COUNT(*) FROM app.claim WHERE group_id = @g AND (access_id IS NULL OR access_id <> @me);",
                    connection, tx);
                own.Parameters.AddWithValue("@g", group.Value);
                own.Parameters.AddWithValue("@me", me.Value);

                if ((int)(await own.ExecuteScalarAsync(ctx.RequestAborted))! > 0)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status403Forbidden, "To nie Twoja rezerwacja.");
                    return;
                }
            }

            var verdict = resource.Mode == "offered"
                ? await JudgeOfferAsync(connection, tx, resource, itemId!.Value, occurrenceAt!.Value,
                    me.Value, body.Code, now, ctx.RequestAborted)
                : await JudgeOpenAsync(connection, tx, resource, tree.Above, tree.Below,
                    starts, ends, me.Value, ctx.RequestAborted);

            /*
             * Um Mitnahme bitten geht genau dann, wenn Nehmen am Code scheitert.
             * In jedem anderen Fall waere die Bitte entweder unnoetig (es ist
             * frei) oder sinnlos (es ist voll).
             */
            if (asking)
            {
                if (verdict != Verdict.InviteNeeded)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Refuse(ctx, verdict == Verdict.Open ? Verdict.Mine : verdict,
                        verdict == Verdict.Open ? "Ten termin jest wolny — po prostu go weź." : null);
                    return;
                }

                status = "pending";
            }
            else if (verdict != Verdict.Open)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await Refuse(ctx, verdict, null);
                return;
            }
            else
            {
                status = resource.Approval == "office" ? "pending" : "confirmed";
            }

            /* Gastgeber wird, wer ein angebotenes Termin als Erster nimmt. */
            var firstOnOffer = !asking && resource.Mode == "offered" && resource.InviteHours > 0
                && await TakenAsync(connection, tx, resource.Id, itemId!.Value, occurrenceAt!.Value,
                    ctx.RequestAborted) == 0;

            if (firstOnOffer) code = NewCode();

            await using (var insert = new SqlCommand("""
                INSERT INTO app.claim
                    (id, resource_id, starts_at, ends_at, item_id, occurrence_at, access_id,
                     group_id, status, awaits, invite_sha256, invite_until, created_at)
                VALUES
                    (@id, @r, @s, @e, @item, @at, @me,
                     @group, @status, @awaits, @hash, @until, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", claimId);
                insert.Parameters.AddWithValue("@r", resource.Id);
                insert.Parameters.AddWithValue("@s", starts);
                insert.Parameters.AddWithValue("@e", ends);
                insert.Parameters.AddWithValue("@item", (object?)itemId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@at", (object?)occurrenceAt ?? DBNull.Value);
                insert.Parameters.AddWithValue("@me", me.Value);
                insert.Parameters.AddWithValue("@group", group ?? claimId);
                insert.Parameters.AddWithValue("@status", status);
                insert.Parameters.AddWithValue("@awaits",
                    status == "pending" ? (asking ? "host" : "office") : DBNull.Value);
                insert.Parameters.AddBlob("@hash", code is null ? null : HashCode(code));
                insert.Parameters.AddWithValue("@until",
                    code is null ? DBNull.Value : now.AddHours(resource.InviteHours));
                insert.Parameters.AddWithValue("@now", now);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Refuse(ctx, Verdict.Mine, null);
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            claimId = Ids.ToText(claimId),
            resourceId = Ids.ToText(resource.Id),
            startsAt = starts,
            endsAt = ends,
            status,
            awaits = status == "pending" ? (asking ? "host" : "office") : null,

            /*
             * DER CODE STEHT GENAU EINMAL HIER. Gespeichert ist nur sein
             * Abdruck; wer ihn verliert, gibt den Termin zurueck und nimmt ihn
             * neu — einen zweiten Weg zu bauen hiesse, ein Geheimnis
             * nachschlagbar zu machen.
             */
            inviteCode = code,
            inviteUntil = code is null ? (DateTimeOffset?)null : now.AddHours(resource.InviteHours)
        });
    }

    private static async Task<Verdict> JudgeOfferAsync(
        SqlConnection connection, SqlTransaction tx, ResourceRow resource, Guid itemId,
        DateTimeOffset occurrenceAt, Guid me, string? code, DateTimeOffset now, CancellationToken ct)
    {
        var claims = await OfferClaimsAsync(connection, tx, resource.Id, itemId, occurrenceAt, ct);

        var host = claims.FirstOrDefault(c => c.Status == "confirmed" && c.InviteSha256 is not null);

        return JudgeOffer(
            resource.Capacity, resource.InviteHours,
            claims.Count(Counts),
            claims.Any(c => Live(c) && c.AccessId == me),
            host?.InviteSha256, host?.InviteUntil, code, now);
    }

    private static async Task<Verdict> JudgeOpenAsync(
        SqlConnection connection, SqlTransaction tx, ResourceRow resource,
        HashSet<Guid> above, HashSet<Guid> below,
        DateTimeOffset starts, DateTimeOffset ends, Guid me, CancellationToken ct)
    {
        var reach = resource.BufferBefore + resource.BufferAfter;
        var family = new List<Guid>([resource.Id, .. above, .. below]);

        var claims = new List<ClaimRow>();
        var names = string.Join(", ", family.Select((_, i) => $"@f{i}"));

        await using (var cmd = new SqlCommand($"""
            SELECT {ClaimColumns} FROM app.claim
            WHERE resource_id IN ({names})
              AND status IN (N'pending', N'confirmed')
              AND starts_at < @hi AND ends_at > @lo;
            """, connection, tx))
        {
            for (var i = 0; i < family.Count; i++) cmd.Parameters.AddWithValue($"@f{i}", family[i]);
            cmd.Parameters.AddWithValue("@lo", starts.AddMinutes(-reach));
            cmd.Parameters.AddWithValue("@hi", ends.AddMinutes(reach));

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) claims.Add(ReadClaim(reader));
        }

        var counted = claims.Where(Counts).ToList();

        /* Genau dasselbe noch einmal zu nehmen ist kein neuer Wunsch. */
        if (claims.Any(c => c.ResourceId == resource.Id && c.AccessId == me
                            && c.StartsAt == starts && c.EndsAt == ends))
            return Verdict.Mine;

        /*
         * DAS GANZE ODER EIN TEIL DAVON.
         *
         * Haelt jemand das Haus, ist jedes Zimmer darin belegt — und haelt
         * jemand ein Zimmer, laesst sich das Haus nicht mehr ganz nehmen. Beides
         * unabhaengig von der Zahl der Plaetze: ein Ganzes ist ganz.
         */
        bool touches(ClaimRow c) =>
            c.StartsAt.AddMinutes(-resource.BufferBefore) < ends.AddMinutes(resource.BufferAfter)
            && starts.AddMinutes(-resource.BufferBefore) < c.EndsAt.AddMinutes(resource.BufferAfter);

        if (counted.Any(c => (above.Contains(c.ResourceId) || below.Contains(c.ResourceId)) && touches(c)))
            return Verdict.Full;

        var busiest = Busiest(
            counted.Where(c => c.ResourceId == resource.Id).Select(c => (c.StartsAt, c.EndsAt)),
            starts, ends, resource.BufferBefore, resource.BufferAfter);

        return busiest + 1 > resource.Capacity ? Verdict.Full : Verdict.Open;
    }

    private static async Task<List<ClaimRow>> OfferClaimsAsync(
        SqlConnection connection, SqlTransaction? tx, Guid resourceId, Guid itemId,
        DateTimeOffset occurrenceAt, CancellationToken ct)
    {
        var claims = new List<ClaimRow>();

        await using var cmd = new SqlCommand($"""
            SELECT {ClaimColumns} FROM app.claim
            WHERE resource_id = @r AND item_id = @item AND occurrence_at = @at
              AND status IN (N'pending', N'confirmed');
            """, connection, tx);

        cmd.Parameters.AddWithValue("@r", resourceId);
        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", occurrenceAt);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) claims.Add(ReadClaim(reader));

        return claims;
    }

    private static async Task<int> TakenAsync(
        SqlConnection connection, SqlTransaction tx, Guid resourceId, Guid itemId,
        DateTimeOffset occurrenceAt, CancellationToken ct) =>
        (await OfferClaimsAsync(connection, tx, resourceId, itemId, occurrenceAt, ct)).Count(Counts);

    private static Task Refuse(HttpContext ctx, Verdict verdict, string? message) =>
        Fail(ctx, verdict switch
        {
            Verdict.Mine or Verdict.Full => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status403Forbidden
        }, message ?? verdict switch
        {
            Verdict.Mine => "To już jest Twoje.",
            Verdict.Full => "Nie ma już miejsca w tym czasie.",
            Verdict.InviteNeeded => "Ten termin trzyma teraz ktoś inny — potrzebny jest kod od niego. Możesz też poprosić.",
            _ => "Na ten termin nie da się już dopisać."
        });

    /* ======================================================================
       ZURUECKGEBEN
       ====================================================================== */

    public sealed record ReleaseRequest(string ClaimId, string? Seat);

    /// <summary>
    /// Zurueckgeben.
    ///
    /// <para>
    /// <b>Die Zeile BLEIBT</b> (`released`) — die Kanzlei soll sehen, dass da
    /// einmal jemand sass, und wer zweimal nimmt und zweimal zurueckgibt, ist
    /// eine Auskunft, kein Nichts. Eine wartende Bitte zurueckzuziehen ist
    /// dasselbe: sie hoert auf zu warten.
    /// </para>
    /// </summary>
    private static async Task ReleaseAsync(HttpContext ctx, Db db, ReleaseRequest body)
    {
        if (!Guid.TryParse(body.ClaimId, out var claimId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rezerwacja.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, body.Seat, ctx.RequestAborted);
        if (me is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.claim
               SET status = N'released', awaits = NULL, released_at = @now,
                   invite_sha256 = NULL, invite_until = NULL
             WHERE id = @id AND access_id = @me AND status IN (N'pending', N'confirmed');
            """, connection);

        cmd.Parameters.AddWithValue("@id", claimId);
        cmd.Parameters.AddWithValue("@me", me.Value);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma czego oddać.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { claimId = Ids.ToText(claimId), released = true });
    }

    /* ======================================================================
       JA ODER NEIN
       ====================================================================== */

    public sealed record DecideRequest(string ClaimId, bool Accept, string? Seat);

    /// <summary>
    /// Der GASTGEBER sagt ja oder nein zu einer Bitte um Mitnahme.
    ///
    /// <para>
    /// <b>Beim Ja wird noch einmal gezaehlt</b>, unter derselben Sperre wie beim
    /// Nehmen: eine wartende Bitte hielt keinen Platz (sie sollte nicht
    /// blockieren, was der Gastgeber jemand anderem geben will), also kann der
    /// Termin inzwischen voll sein.
    /// </para>
    /// </summary>
    private static async Task HostDecideAsync(HttpContext ctx, Db db, DecideRequest body)
    {
        if (!Guid.TryParse(body.ClaimId, out var claimId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna prośba.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, body.Seat, ctx.RequestAborted);
        if (me is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var ask = await ClaimByIdAsync(connection, null, claimId, ctx.RequestAborted);
        if (ask is null || ask.Status != "pending" || ask.Awaits != "host" || ask.ItemId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej prośby nie ma.");
            return;
        }

        var resource = await ResourceAsync(connection, ask.ResourceId, ctx.RequestAborted);
        if (resource is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej prośby nie ma.");
            return;
        }

        var tree = await TreeAsync(connection, null, resource, ctx.RequestAborted);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var hold = new SqlCommand(
                "SELECT id FROM app.resource WITH (UPDLOCK, HOLDLOCK) WHERE id = @root;", connection, tx))
            {
                hold.Parameters.AddWithValue("@root", tree.Root);
                await hold.ExecuteScalarAsync(ctx.RequestAborted);
            }

            var claims = await OfferClaimsAsync(connection, tx, resource.Id, ask.ItemId.Value,
                ask.OccurrenceAt!.Value, ctx.RequestAborted);

            /* Nur wer den Termin HAELT, entscheidet — nicht wer bloss darauf sitzt. */
            var host = claims.FirstOrDefault(c => c.Status == "confirmed" && c.InviteSha256 is not null);

            if (host is null || host.AccessId != me)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status403Forbidden, "O tym decyduje gospodarz terminu.");
                return;
            }

            if (body.Accept && claims.Count(Counts) >= resource.Capacity)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await Refuse(ctx, Verdict.Full, "Termin jest już pełny — nie da się nikogo dopisać.");
                return;
            }

            await Decided(connection, tx, [claimId], body.Accept, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            claimId = Ids.ToText(claimId),
            status = body.Accept ? "confirmed" : "declined"
        });
    }

    public sealed record OfficeDecideRequest(bool Accept);

    /// <summary>
    /// Die KANZLEI sagt ja oder nein — zur ganzen Anfrage auf einmal.
    ///
    /// <para>
    /// <b>Die Gruppe, nicht die Zeile.</b> Wer das Haus fuer drei Naechte und
    /// die Kapelle fuer einen Nachmittag erfragt, hat EINE Anfrage gestellt. Ja
    /// zum Haus und stillschweigend nichts zur Kapelle waere eine halbe Antwort,
    /// die niemand bemerkt, bis die Gruppe vor einer verschlossenen Tuer steht.
    /// </para>
    /// </summary>
    private static async Task OfficeDecideAsync(HttpContext ctx, Db db, Guid id, OfficeDecideRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var claim = await ClaimByIdAsync(connection, null, id, ctx.RequestAborted);
        var resource = claim is null ? null : await ResourceAsync(connection, claim.ResourceId, ctx.RequestAborted);

        if (claim is null || resource is null
            || !await Area.MayAsync(connection, who.Value.AccountId, resource.AreaId,
                   Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rezerwacji nie ma.");
            return;
        }

        var group = new List<Guid>();

        await using (var cmd = new SqlCommand("""
            SELECT id FROM app.claim
            WHERE group_id = @g AND status = N'pending' AND awaits = N'office';
            """, connection))
        {
            cmd.Parameters.AddWithValue("@g", claim.GroupId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) group.Add(reader.GetGuid(0));
        }

        if (group.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Tu nie ma już nic do rozstrzygnięcia.");
            return;
        }

        await Decided(connection, null, group, body.Accept, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            groupId = Ids.ToText(claim.GroupId),
            decided = group.Count,
            status = body.Accept ? "confirmed" : "declined"
        });
    }

    private static async Task Decided(
        SqlConnection connection, SqlTransaction? tx, IReadOnlyList<Guid> ids, bool accept, CancellationToken ct)
    {
        var names = string.Join(", ", ids.Select((_, i) => $"@i{i}"));

        await using var cmd = new SqlCommand($"""
            UPDATE app.claim
               SET status = @s, awaits = NULL, decided_at = @now
             WHERE id IN ({names}) AND status = N'pending';
            """, connection, tx);

        cmd.Parameters.AddWithValue("@s", accept ? "confirmed" : "declined");
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < ids.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", ids[i]);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<ClaimRow?> ClaimByIdAsync(
        SqlConnection connection, SqlTransaction? tx, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            $"SELECT {ClaimColumns} FROM app.claim WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadClaim(reader) : null;
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
        HttpContext ctx, Db db, string? resource, string? seat, string? from, string? to)
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

        var me = await SeatOfAsync(connection, seat, ctx.RequestAborted);

        var rules = new
        {
            resourceId = Ids.ToText(found.Id),
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
            leadDays = found.LeadDays
        };

        /* Was DIESER Platz haelt — in jedem Fall. */
        var mine = me is null
            ? []
            : await MineAsync(connection, found.Id, me.Value, ctx.RequestAborted);

        if (found.Mode == "offered")
        {
            var offers = await OffersOfAsync(connection, found, since, till, null, ctx.RequestAborted);
            var shown = new List<object>();

            foreach (var offer in offers)
            {
                var claims = await OfferClaimsAsync(connection, null, found.Id, offer.ItemId,
                    offer.OccurrenceAt, ctx.RequestAborted);

                var taken = claims.Count(Counts);
                var host = claims.FirstOrDefault(c => c.Status == "confirmed" && c.InviteSha256 is not null);
                var myClaim = me is null ? null : claims.FirstOrDefault(c => c.AccessId == me);

                var verdict = JudgeOffer(found.Capacity, found.InviteHours, taken,
                    myClaim is not null, host?.InviteSha256, host?.InviteUntil, null, now);

                var hosting = host is not null && me is not null && host.AccessId == me;

                shown.Add(new
                {
                    itemId = Ids.ToText(offer.ItemId),
                    occurrenceAt = offer.OccurrenceAt,
                    startsAt = offer.StartsAt,
                    endsAt = offer.EndsAt,
                    taken,
                    capacity = found.Capacity,
                    state = verdict.ToString().ToLowerInvariant(),
                    inviteUntil = host?.InviteUntil,

                    myClaimId = myClaim is null ? null : Ids.ToText(myClaim.Id),
                    myStatus = myClaim?.Status,
                    hosting,

                    /* Wer um Mitnahme bittet — nur fuer den Gastgeber, und nur der
                       Name, den die Kanzlei dem Platz gab. */
                    asks = hosting
                        ? await AsksAsync(connection, claims, ctx.RequestAborted)
                        : []
                });
            }

            await ctx.Response.WriteAsJsonAsync(new { resource = rules, offers = shown, mine });
            return;
        }

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
        SqlConnection connection, Guid resourceId, Guid me, CancellationToken ct)
    {
        var mine = new List<object>();

        await using var cmd = new SqlCommand($"""
            SELECT {ClaimColumns} FROM app.claim
            WHERE resource_id = @r AND access_id = @me AND status <> N'released'
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
                hosting = c.InviteSha256 is not null,
                inviteUntil = c.InviteUntil
            });
        }

        return mine;
    }

    private static async Task<List<object>> AsksAsync(
        SqlConnection connection, List<ClaimRow> claims, CancellationToken ct)
    {
        var asks = new List<object>();

        foreach (var c in claims.Where(c => c.Status == "pending" && c.Awaits == "host"))
        {
            string? name = null;

            if (c.AccessId is not null)
            {
                await using var cmd = new SqlCommand(
                    "SELECT recipient_name FROM app.access WHERE id = @a;", connection);
                cmd.Parameters.AddWithValue("@a", c.AccessId.Value);
                name = await cmd.ExecuteScalarAsync(ct) as string;
            }

            asks.Add(new { claimId = Ids.ToText(c.Id), name });
        }

        return asks;
    }

    /* ======================================================================
       DIE KANZLEI: DINGE
       ====================================================================== */

    /// <summary>Die Dinge in Bereichen, die ich lesen darf.</summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var rows = new List<ResourceRow>();

        await using (var cmd = new SqlCommand(
            $"SELECT {ResourceColumns} FROM app.resource ORDER BY name;", connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) rows.Add(ReadResource(reader));
        }

        var readable = new Dictionary<Guid, bool>();
        var shown = new List<object>();

        foreach (var row in rows)
        {
            if (!readable.TryGetValue(row.AreaId, out var may))
            {
                may = await Area.MayAsync(connection, who.Value.AccountId, row.AreaId,
                    Capability.Read, ctx.RequestAborted);
                readable[row.AreaId] = may;
            }

            if (!may) continue;

            shown.Add(await Shape(connection, row, ctx.RequestAborted));
        }

        await ctx.Response.WriteAsJsonAsync(new { resources = shown });
    }

    private static async Task<object> Shape(SqlConnection connection, ResourceRow row, CancellationToken ct)
    {
        int pending;

        await using (var cmd = new SqlCommand("""
            SELECT COUNT(*) FROM app.claim
            WHERE resource_id = @r AND status = N'pending' AND awaits = N'office';
            """, connection))
        {
            cmd.Parameters.AddWithValue("@r", row.Id);
            pending = (int)(await cmd.ExecuteScalarAsync(ct))!;
        }

        return new
        {
            resourceId = Ids.ToText(row.Id),
            areaId = Ids.ToText(row.AreaId),
            parentId = row.ParentId is null ? null : Ids.ToText(row.ParentId.Value),
            calendarId = row.CalendarId is null ? null : Ids.ToText(row.CalendarId.Value),
            name = row.Name,
            kind = row.Kind,
            mode = row.Mode,
            byNight = row.ByNight,
            checkInMin = row.CheckInMin,
            checkOutMin = row.CheckOutMin,
            capacity = row.Capacity,
            bufferBefore = row.BufferBefore,
            bufferAfter = row.BufferAfter,
            approval = row.Approval,
            inviteHours = row.InviteHours,
            leadDays = row.LeadDays,

            /* Was auf ein Ja der Kanzlei wartet — die Zahl, die zuerst zaehlt. */
            pending
        };
    }

    public sealed record ResourceBody(
        string? ResourceId, string? AreaId, string? ParentId, string? CalendarId,
        string? Name, string? Kind, string? Mode, bool? ByNight, int? CheckInMin, int? CheckOutMin,
        int? Capacity, int? BufferBefore, int? BufferAfter, string? Approval,
        int? InviteHours, int? LeadDays);

    private static async Task CreateAsync(HttpContext ctx, Db db, ResourceBody body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ResourceId, out var id) || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zasób albo obszar.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var draft = new ResourceRow(id, areaId, null, null, "", "other", "offered", false,
            960, 600, 1, 0, 0, "none", 0, 0);

        var (row, error) = await Merge(connection, draft, body, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error!);
            return;
        }

        await using (var cmd = new SqlCommand("""
            INSERT INTO app.resource
                (id, area_id, parent_id, calendar_id, name, kind, mode, by_night, check_in_min,
                 check_out_min, capacity, buffer_before, buffer_after, approval, invite_hours,
                 lead_days, created_at, updated_at)
            VALUES
                (@id, @area, @parent, @cal, @name, @kind, @mode, @night, @in, @out,
                 @cap, @bb, @ba, @appr, @inv, @lead, @now, @now);
            """, connection))
        {
            Bind(cmd, row);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Taki zasób już jest.");
                return;
            }
            catch (SqlException e) when (e.Number == 547)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Tak się nie da — sprawdź tryb, kalendarz i liczby.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(await Shape(connection, row, ctx.RequestAborted));
    }

    private static async Task UpdateAsync(HttpContext ctx, Db db, Guid id, ResourceBody body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ResourceAsync(connection, id, ctx.RequestAborted);
        if (found is null
            || !await Area.MayAsync(connection, who.Value.AccountId, found.AreaId,
                   Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zasobu nie ma.");
            return;
        }

        var (row, error) = await Merge(connection, found, body, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error!);
            return;
        }

        await using (var cmd = new SqlCommand("""
            UPDATE app.resource
               SET parent_id = @parent, calendar_id = @cal, name = @name, kind = @kind,
                   mode = @mode, by_night = @night, check_in_min = @in, check_out_min = @out,
                   capacity = @cap, buffer_before = @bb, buffer_after = @ba, approval = @appr,
                   invite_hours = @inv, lead_days = @lead, updated_at = @now
             WHERE id = @id;
            """, connection))
        {
            Bind(cmd, row);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
            catch (SqlException e) when (e.Number == 547)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Tak się nie da — sprawdź tryb, kalendarz i liczby.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(await Shape(connection, row, ctx.RequestAborted));
    }

    /// <summary>
    /// Was hereinkommt, ueber das, was dasteht — und gepruefter, als die
    /// Datenbank es koennte.
    ///
    /// <para>
    /// <b>Vater und Kalender muessen im SELBEN Bereich liegen.</b> Sonst haengte
    /// jemand sein Zimmer unter ein fremdes Haus, oder boete Termine aus einem
    /// Kalender an, den er nicht fuehrt — und ein Fremdschluessel merkte das
    /// nicht, weil es die Zeile ja gibt.
    /// </para>
    /// </summary>
    private static async Task<(ResourceRow? Row, string? Error)> Merge(
        SqlConnection connection, ResourceRow was, ResourceBody body, CancellationToken ct)
    {
        var name = (body.Name ?? was.Name).Trim();
        if (name.Length is 0 or > MaxName) return (null, $"Nazwa: od 1 do {MaxName} znaków.");

        var kind = (body.Kind ?? was.Kind).Trim().ToLowerInvariant();
        if (Array.IndexOf(Kinds, kind) < 0) return (null, "Rodzaj: person, room, house, place albo other.");

        var mode = (body.Mode ?? was.Mode).Trim().ToLowerInvariant();
        if (mode is not ("offered" or "open")) return (null, "Tryb: offered albo open.");

        var approval = (body.Approval ?? was.Approval).Trim().ToLowerInvariant();
        if (approval is not ("none" or "office")) return (null, "Zatwierdzanie: none albo office.");

        var parent = was.ParentId;
        if (body.ParentId is not null)
        {
            if (body.ParentId == "") parent = null;
            else if (!Guid.TryParse(body.ParentId, out var p)) return (null, "Nieczytelny zasób nadrzędny.");
            else
            {
                if (p == was.Id) return (null, "Zasób nie może leżeć sam w sobie.");

                var up = await ResourceAsync(connection, p, ct);
                if (up is null || up.AreaId != was.AreaId)
                    return (null, "Zasób nadrzędny musi być w tym samym obszarze.");

                parent = p;
            }
        }

        var calendar = was.CalendarId;
        if (body.CalendarId is not null)
        {
            if (body.CalendarId == "") calendar = null;
            else if (!Guid.TryParse(body.CalendarId, out var c)) return (null, "Nieczytelny kalendarz.");
            else
            {
                await using var cmd = new SqlCommand(
                    "SELECT area_id FROM app.calendar WHERE id = @c;", connection);
                cmd.Parameters.AddWithValue("@c", c);

                if (await cmd.ExecuteScalarAsync(ct) is not Guid area || area != was.AreaId)
                    return (null, "Kalendarz musi należeć do tego samego obszaru.");

                calendar = c;
            }
        }

        if (mode == "offered" && calendar is null)
            return (null, "Kto podaje terminy, potrzebuje kalendarza, w którym one stoją.");

        int pick(int? given, int before) => given ?? before;

        return (was with
        {
            ParentId = parent,
            CalendarId = calendar,
            Name = name,
            Kind = kind,
            Mode = mode,
            ByNight = body.ByNight ?? was.ByNight,
            CheckInMin = pick(body.CheckInMin, was.CheckInMin),
            CheckOutMin = pick(body.CheckOutMin, was.CheckOutMin),
            Capacity = pick(body.Capacity, was.Capacity),
            BufferBefore = pick(body.BufferBefore, was.BufferBefore),
            BufferAfter = pick(body.BufferAfter, was.BufferAfter),
            Approval = approval,
            InviteHours = pick(body.InviteHours, was.InviteHours),
            LeadDays = pick(body.LeadDays, was.LeadDays)
        }, null);
    }

    private static void Bind(SqlCommand cmd, ResourceRow row)
    {
        cmd.Parameters.AddWithValue("@id", row.Id);
        cmd.Parameters.AddWithValue("@area", row.AreaId);
        cmd.Parameters.AddWithValue("@parent", (object?)row.ParentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@cal", (object?)row.CalendarId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@name", row.Name);
        cmd.Parameters.AddWithValue("@kind", row.Kind);
        cmd.Parameters.AddWithValue("@mode", row.Mode);
        cmd.Parameters.AddWithValue("@night", row.ByNight);
        cmd.Parameters.AddWithValue("@in", row.CheckInMin);
        cmd.Parameters.AddWithValue("@out", row.CheckOutMin);
        cmd.Parameters.AddWithValue("@cap", row.Capacity);
        cmd.Parameters.AddWithValue("@bb", row.BufferBefore);
        cmd.Parameters.AddWithValue("@ba", row.BufferAfter);
        cmd.Parameters.AddWithValue("@appr", row.Approval);
        cmd.Parameters.AddWithValue("@inv", row.InviteHours);
        cmd.Parameters.AddWithValue("@lead", row.LeadDays);
    }

    /* ======================================================================
       DIE KANZLEI: WER WAS HAELT
       ====================================================================== */

    /// <summary>
    /// Wer was haelt — MIT Namen, fuer die, die den Bereich lesen duerfen.
    ///
    /// <para>
    /// Der Name ist der, den die Kanzlei dem Platz gab (`recipient_name`,
    /// offen, damit sie ihn zuordnen kann). Was jemand im Formular geschrieben
    /// hat, liegt versiegelt beim Formular und wird dort geoeffnet.
    /// </para>
    /// </summary>
    private static async Task OfficeClaimsAsync(
        HttpContext ctx, Db db, Guid id, string? from, string? to)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var resource = await ResourceAsync(connection, id, ctx.RequestAborted);
        if (resource is null
            || !await Area.MayAsync(connection, who.Value.AccountId, resource.AreaId,
                   Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zasobu nie ma.");
            return;
        }

        var since = DateTimeOffset.TryParse(from, out var f) ? f : DateTimeOffset.UtcNow.AddDays(-7);
        var till = DateTimeOffset.TryParse(to, out var t) && t > since ? t : since.AddDays(120);

        var claims = new List<object>();

        await using (var cmd = new SqlCommand($"""
            SELECT c.id, c.starts_at, c.ends_at, c.status, c.awaits, c.group_id,
                   c.invite_sha256, a.recipient_name, c.role_id, c.created_at
            FROM app.claim c
            LEFT JOIN app.access a ON a.id = c.access_id
            WHERE c.resource_id = @r AND c.status <> N'released'
              AND c.starts_at < @to AND c.ends_at > @from
            ORDER BY
                /* Was wartet, zuerst — das ist, weswegen man hier hereinschaut. */
                CASE WHEN c.status = N'pending' AND c.awaits = N'office' THEN 0 ELSE 1 END,
                c.starts_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@r", id);
            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                claims.Add(new
                {
                    claimId = Ids.ToText(reader.GetGuid(0)),
                    startsAt = reader.GetDateTimeOffset(1),
                    endsAt = reader.GetDateTimeOffset(2),
                    status = reader.GetString(3),
                    awaits = reader.IsDBNull(4) ? null : reader.GetString(4),
                    groupId = Ids.ToText(reader.GetGuid(5)),
                    hosting = !reader.IsDBNull(6),
                    name = reader.IsDBNull(7) ? null : reader.GetString(7),
                    roleId = reader.IsDBNull(8) ? null : Ids.ToText(reader.GetGuid(8)),
                    createdAt = reader.GetDateTimeOffset(9)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            resource = await Shape(connection, resource, ctx.RequestAborted),
            claims
        });
    }

    /* ======================================================================
       KLEINKRAM
       ====================================================================== */

    private static async Task<Guid?> SeatOfAsync(
        SqlConnection connection, string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        await using var cmd = new SqlCommand("""
            SELECT id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now);
            """, connection);

        cmd.Parameters.AddWithValue("@token", SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static string NewCode()
    {
        var chars = new char[CodeLength];
        for (var i = 0; i < CodeLength; i++)
            chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(chars);
    }

    internal static byte[] HashCode(string code) =>
        SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim().ToUpperInvariant()));

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
