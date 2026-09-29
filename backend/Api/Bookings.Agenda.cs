using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE RESERVIERUNGEN IM EIGENEN KALENDER (0057).
///
/// <para>
/// <b>Was ein Priester an seinem Kalender sehen will</b>: nicht nur, DASS am
/// Samstag um 9:40 ein Termin angeboten ist, sondern wer von den Kandidaten
/// darauf sitzt, wie viel noch frei ist — und wer auf ein Ja wartet. Bisher
/// stand das nur unter „Rezerwacje", Ding für Ding; im Kalender stand an der
/// Stelle ein leeres „Termin".
/// </para>
///
/// <para>
/// <b>Dieselben Regeln wie unter „Rezerwacje"</b>, keine eigenen: Namen sieht,
/// wer den Bereich des Dings lesen darf (<see cref="OfficeClaimsAsync"/>),
/// entscheiden darf, wer darin schreibt. Was zählt, zählt nach
/// <see cref="Counts"/>; Bitten, über die niemand mehr entscheidet, werden
/// vorher beantwortet, wie dort.
/// </para>
///
/// <code>
///   offers     jedes angebotene Vorkommen im Zeitraum — mit Plätzen und Namen
///   bookings   frei gewählte Zeiten (ein Haus, ein Saal) im Zeitraum
///   waiting    alles, was auf ein Ja der Kanzlei wartet — ohne Zeitraum,
///              denn eine Anfrage für November wartet auch im September
/// </code>
/// </summary>
public static partial class Bookings
{
    private sealed record Held(
        ClaimRow Row, string? Name, DateTimeOffset? RegisteredAt, bool ByOffice, bool WithLink);

    /// <summary>
    /// WER HÄLT WAS an einem Ding — lebende Ansprüche (wartend oder bestätigt),
    /// mit dem Namen, den die Kanzlei dem Platz gab, oder dem, den die Person
    /// beim Nehmen offen mitschickte.
    /// </summary>
    private static async Task<List<Held>> HeldAsync(
        SqlConnection connection, Guid resourceId, DateTimeOffset? from, DateTimeOffset? to, bool onlyWaiting,
        CancellationToken ct)
    {
        var held = new List<Held>();

        await using var cmd = new SqlCommand($"""
            SELECT {string.Join(", ", ClaimColumns.Split(',').Select(c => "c." + c.Trim()))},
                   COALESCE(a.recipient_name, c.holder_name), c.by_office,
                   (SELECT MIN(g.submitted_at) FROM app.registration g WHERE g.access_id = c.access_id)
            FROM app.claim c
            LEFT JOIN app.access a ON a.id = c.access_id
            WHERE c.resource_id = @r
              AND {(onlyWaiting ? "c.status = N'pending' AND c.awaits = N'office' AND c.ends_at > @now" : "c.status IN (N'pending', N'confirmed')")}
              {(from is null ? "" : "AND c.ends_at > @from")}
              {(to is null ? "" : "AND c.starts_at < @to")}
            ORDER BY c.starts_at, c.created_at;
            """, connection);

        cmd.Parameters.AddWithValue("@r", resourceId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.AddDays(-1));
        if (from is not null) cmd.Parameters.AddWithValue("@from", from.Value);
        if (to is not null) cmd.Parameters.AddWithValue("@to", to.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var row = ReadClaim(reader);
            held.Add(new Held(
                row,
                reader.IsDBNull(17) ? null : reader.GetString(17),
                reader.IsDBNull(19) ? null : reader.GetDateTimeOffset(19),
                !reader.IsDBNull(18) && reader.GetBoolean(18),
                row.AccessId is not null));
        }

        return held;
    }

    /// <summary>Ein Anspruch, wie ihn der Kalender zeigt.</summary>
    private static object ShapeHeld(Held one, DateTimeOffset now) => new
    {
        claimId = Ids.ToText(one.Row.Id),
        startsAt = one.Row.StartsAt,
        endsAt = one.Row.EndsAt,
        status = one.Row.Status,
        awaits = one.Row.Awaits,
        groupId = Ids.ToText(one.Row.GroupId),
        name = one.Name,
        registeredAt = one.RegisteredAt,
        roleId = one.Row.RoleId is null ? null : Ids.ToText(one.Row.RoleId.Value),
        createdAt = one.Row.CreatedAt,
        hosting = Hosts(one.Row, now),
        hostPending = HostUndecided(one.Row, now),
        byOffice = one.ByOffice,
        withLink = one.WithLink,
        itemId = one.Row.ItemId is null ? null : Ids.ToText(one.Row.ItemId.Value),
        occurrenceAt = one.Row.OccurrenceAt
    };

    /// <summary>
    /// Bitten um Mitnahme, über die niemand mehr entscheidet — erst beantworten,
    /// dann zeigen (0050). Dieselbe Runde wie unter „Rezerwacje".
    /// </summary>
    private static async Task SettleWaitingAsync(
        SqlConnection connection, ResourceRow resource, DateTimeOffset now, CancellationToken ct)
    {
        var waiting = new List<(Guid Item, DateTimeOffset At)>();

        await using (var find = new SqlCommand("""
            SELECT DISTINCT item_id, occurrence_at FROM app.claim
            WHERE resource_id = @r AND status = N'pending' AND awaits = N'host'
              AND item_id IS NOT NULL AND ends_at > @now;
            """, connection))
        {
            find.Parameters.AddWithValue("@r", resource.Id);
            find.Parameters.AddWithValue("@now", now);
            await using var reader = await find.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) waiting.Add((reader.GetGuid(0), reader.GetDateTimeOffset(1)));
        }

        foreach (var (item, at) in waiting)
        {
            var onIt = await OfferClaimsAsync(connection, null, resource.Id, item, at, ct);
            await SettleAsksAsync(connection, resource, item, at, onIt, now, ct);
        }
    }

    /// <summary>
    /// DIE RESERVIERUNGEN FÜR DEN EIGENEN KALENDER — für jedes Ding in einem
    /// Bereich, den ich lesen darf.
    /// </summary>
    private static async Task AgendaAsync(HttpContext ctx, Db db, string? from, string? to)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Calendar.Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        var ct = ctx.RequestAborted;
        await using var connection = await db.OpenAsync(ct);
        var now = DateTimeOffset.UtcNow;

        var rows = new List<ResourceRow>();
        await using (var cmd = new SqlCommand($"SELECT {ResourceColumns} FROM app.resource ORDER BY name;", connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) rows.Add(ReadResource(reader));
        }

        var reads = new Dictionary<Guid, bool>();
        var writes = new Dictionary<Guid, bool>();

        var resources = new List<object>();
        var offers = new List<object>();
        var bookings = new List<object>();
        var waiting = new List<object>();

        foreach (var row in rows)
        {
            if (!reads.TryGetValue(row.AreaId, out var mayRead))
            {
                mayRead = await Area.MayAsync(connection, who.Value.AccountId, row.AreaId, Capability.Read, ct);
                reads[row.AreaId] = mayRead;
            }

            if (!mayRead) continue;

            if (!writes.TryGetValue(row.AreaId, out var mayDecide))
            {
                mayDecide = await Area.MayAsync(connection, who.Value.AccountId, row.AreaId, Capability.Write, ct);
                writes[row.AreaId] = mayDecide;
            }

            resources.Add(new
            {
                resourceId = Ids.ToText(row.Id),
                areaId = Ids.ToText(row.AreaId),
                calendarId = row.CalendarId is null ? null : Ids.ToText(row.CalendarId.Value),
                name = row.Name,
                kind = row.Kind,
                mode = row.Mode,
                capacity = row.Capacity,
                approval = row.Approval,
                minPersons = row.MinPersons,
                mayDecide
            });

            if (row.Mode == "offered")
            {
                await SettleWaitingAsync(connection, row, now, ct);

                var slots = await OffersOfAsync(connection, row, since, till, null, ct);
                if (slots.Count > 0)
                {
                    var held = await HeldAsync(connection, row.Id, since.AddDays(-1), till.AddDays(1), false, ct);
                    var closed = await ClosedInAsync(connection, row.Id, ct);

                    foreach (var slot in slots)
                    {
                        var on = held.Where(h => h.Row.ItemId == slot.ItemId && h.Row.OccurrenceAt == slot.OccurrenceAt).ToList();
                        closed.TryGetValue((slot.ItemId, slot.OccurrenceAt), out var closedBy);

                        offers.Add(new
                        {
                            resourceId = Ids.ToText(row.Id),
                            itemId = Ids.ToText(slot.ItemId),
                            occurrenceAt = slot.OccurrenceAt,
                            startsAt = slot.StartsAt,
                            endsAt = slot.EndsAt,
                            capacity = row.Capacity,
                            taken = on.Count(h => Counts(h.Row)),
                            closedBy,
                            claims = on.Select(h => ShapeHeld(h, now))
                        });
                    }
                }
            }
            else
            {
                foreach (var one in await HeldAsync(connection, row.Id, since, till, false, ct))
                {
                    bookings.Add(new { resourceId = Ids.ToText(row.Id), claim = ShapeHeld(one, now) });
                }
            }

            /* Was auf ein Ja wartet — nur für die, die es geben dürfen, und ohne Zeitraum. */
            if (mayDecide)
            {
                foreach (var one in await HeldAsync(connection, row.Id, null, null, true, ct))
                {
                    waiting.Add(new { resourceId = Ids.ToText(row.Id), claim = ShapeHeld(one, now) });
                }
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { fromUtc = since, toUtc = till, resources, offers, bookings, waiting });
    }
}
