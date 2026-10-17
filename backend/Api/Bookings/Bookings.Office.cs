using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Die Kanzlei: Termine sehen, schliessen, eintragen, entfernen.</summary>
public static partial class Bookings
{
    /* ======================================================================
       DIE KANZLEI: WER WAS HAELT
       ====================================================================== */

    /// <summary>
    /// Wer was haelt — MIT Namen, fuer die, die den Bereich lesen duerfen.
    ///
    /// <para>
    /// Der Name ist der, den die Kanzlei dem Platz gab — 0097: versiegelt, unter
    /// dem Schluessel des Bereichs des Platzes (oder am Anspruch, unter dem des
    /// Dings); geoeffnet wird er im Browser der Kanzlei.
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
        var now = DateTimeOffset.UtcNow;

        /* Bitten, ueber die niemand mehr entscheidet — erst beantworten, dann zeigen (0050). */
        await SettleWaitingAsync(connection, resource, now, ctx.RequestAborted);

        var claims = new List<object>();

        await using (var cmd = new SqlCommand($"""
            SELECT c.id, c.starts_at, c.ends_at, c.status, c.awaits, c.group_id,
                   c.invite_sha256, c.role_id, c.created_at,
                   c.item_id, c.occurrence_at, c.invite_until, c.by_office, c.access_id,
                   c.host_confirmed_at,

                   /* Ein Platz ohne Namen: wann er sich angemeldet hat — damit die Kanzlei ihn findet. */
                   (SELECT MIN(g.submitted_at) FROM app.registration g WHERE g.access_id = c.access_id),

                   /* 0097 — die Namen, versiegelt: der des Platzes (sein Bereich), der am Anspruch (der des Dings). */
                   a.name_sealed, a.name_epoch, a.area_id,
                   c.holder_name_sealed, c.holder_name_epoch, c.holder_name_wrapped
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
                /* Nur was die Regel des Gastgebers braucht — dieselbe wie beim Nehmen. */
                var office = new ClaimRow(
                    reader.GetGuid(0), id, reader.GetDateTimeOffset(1), reader.GetDateTimeOffset(2),
                    null, null, null, null, reader.GetGuid(5), reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4),
                    reader.IsDBNull(6) ? null : (byte[])reader[6],
                    reader.IsDBNull(11) ? null : reader.GetDateTimeOffset(11),
                    null,
                    reader.IsDBNull(14) ? null : reader.GetDateTimeOffset(14),
                    reader.GetDateTimeOffset(8));

                claims.Add(new
                {
                    claimId = Ids.ToText(reader.GetGuid(0)),
                    startsAt = reader.GetDateTimeOffset(1),
                    endsAt = reader.GetDateTimeOffset(2),
                    status = reader.GetString(3),
                    awaits = reader.IsDBNull(4) ? null : reader.GetString(4),
                    groupId = Ids.ToText(reader.GetGuid(5)),
                    /* Gastgeber — wer ja sagte, oder wer noch in seiner Bedenkzeit ist (0050). */
                    hosting = Hosts(office, now),
                    hostPending = HostUndecided(office, now),
                    seatNameSealed = Names.B64(reader, 16),
                    seatNameEpoch = Names.Int(reader, 17),
                    seatAreaId = reader.IsDBNull(18) ? null : Ids.ToText(reader.GetGuid(18)),
                    holderNameSealed = Names.B64(reader, 19),
                    holderNameEpoch = Names.Int(reader, 20),
                    holderNameWrapped = Names.B64(reader, 21),
                    registeredAt = reader.IsDBNull(15) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(15),
                    roleId = reader.IsDBNull(7) ? null : Ids.ToText(reader.GetGuid(7)),
                    createdAt = reader.GetDateTimeOffset(8),

                    /* Welcher Termin — damit der Kalender weiss, wer auf welchem sitzt (0045). */
                    itemId = reader.IsDBNull(9) ? null : Ids.ToText(reader.GetGuid(9)),
                    occurrenceAt = reader.IsDBNull(10) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(10),

                    /* Wie lange er noch Gastgeber ist — bis dahin nur mit seinem Code. */
                    inviteUntil = reader.IsDBNull(11) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(11),

                    /* Von der Kanzlei eingetragen (0049) — und ob mit Link oder nur mit Namen. */
                    byOffice = reader.GetBoolean(12),
                    withLink = !reader.IsDBNull(13),

                    /* 0097 — welcher Platz: an seine Kennung ist die Hülle seines Namens gebunden. */
                    seatId = reader.IsDBNull(13) ? null : Ids.ToText(reader.GetGuid(13))
                });
            }
        }

        var closedAll = await ClosedInAsync(connection, resource.Id, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            resource = await Shape(connection, resource, ctx.RequestAborted),
            claims,

            /* Welche Termine geschlossen sind, und von wem (0049). */
            closed = closedAll.Select(one => new
            {
                itemId = Ids.ToText(one.Key.Item),
                occurrenceAt = one.Key.At,
                closedBy = one.Value
            })
        });
    }

    /* ======================================================================
       0049 — DIE KANZLEI UND DER GASTGEBER AM TERMIN
       ====================================================================== */

    /// <summary>Geschlossen — und von wem? <c>null</c>: offen.</summary>
    private static async Task<string?> ClosedByAsync(
        SqlConnection connection, SqlTransaction? tx, Guid itemId, DateTimeOffset occurrenceAt, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT closed_by FROM app.offer_state WHERE item_id = @item AND occurrence_at = @at;", connection, tx);
        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", occurrenceAt);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    /// <summary>Alle geschlossenen Termine eines Dings — je Vorkommen, wer geschlossen hat.</summary>
    private static async Task<Dictionary<(Guid Item, DateTimeOffset At), string>> ClosedInAsync(
        SqlConnection connection, Guid resourceId, CancellationToken ct)
    {
        var out_ = new Dictionary<(Guid, DateTimeOffset), string>();

        await using var cmd = new SqlCommand(
            "SELECT item_id, occurrence_at, closed_by FROM app.offer_state WHERE resource_id = @r;", connection);
        cmd.Parameters.AddWithValue("@r", resourceId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) out_[(reader.GetGuid(0), reader.GetDateTimeOffset(1))] = reader.GetString(2);
        return out_;
    }

    /// <summary>Schliessen oder oeffnen — die eine Stelle, die die Zeile schreibt.</summary>
    private static async Task SetClosedAsync(
        SqlConnection connection, SqlTransaction? tx, Guid resourceId, Guid itemId, DateTimeOffset occurrenceAt,
        string? by, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(by is null
            ? "DELETE FROM app.offer_state WHERE item_id = @item AND occurrence_at = @at;"
            : """
              UPDATE app.offer_state SET closed_by = @by, closed_at = @now
               WHERE item_id = @item AND occurrence_at = @at;
              IF @@ROWCOUNT = 0
                  INSERT INTO app.offer_state (item_id, occurrence_at, resource_id, closed_by, closed_at)
                  VALUES (@item, @at, @r, @by, @now);
              """, connection, tx);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", occurrenceAt);
        cmd.Parameters.AddWithValue("@r", resourceId);
        cmd.Parameters.AddWithValue("@by", (object?)by ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// WAS DER GASTGEBER SCHLOSS, GILT NUR, SOLANGE ES IHN GIBT. Gibt er sein
    /// Vorrecht ab, gibt er den Termin zurueck oder traegt ihn die Kanzlei aus,
    /// faellt seine Schliessung mit — sonst stuende ein Termin zu, den niemand
    /// mehr oeffnen kann ausser der Kanzlei. Was die Kanzlei schloss, bleibt.
    /// </summary>
    private static async Task DropHostCloseAsync(SqlConnection connection, SqlTransaction? tx, Guid claimId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            DELETE s
              FROM app.offer_state s
              JOIN app.claim c ON c.item_id = s.item_id AND c.occurrence_at = s.occurrence_at
             WHERE c.id = @id AND s.closed_by = N'host'
               AND NOT EXISTS (SELECT 1 FROM app.claim h
                                WHERE h.item_id = s.item_id AND h.occurrence_at = s.occurrence_at
                                  AND h.status = N'confirmed' AND h.invite_sha256 IS NOT NULL);
            """, connection, tx);
        cmd.Parameters.AddWithValue("@id", claimId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Das Ding — und ob dieser Mensch darin als Kanzlei handeln darf.</summary>
    private static async Task<ResourceRow?> OfficeResourceAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        var resource = await ResourceAsync(connection, id, ctx.RequestAborted);
        if (resource is null
            || !await Area.MayAsync(connection, who.Value.AccountId, resource.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zasobu nie ma.");
            return null;
        }

        return resource;
    }

    public sealed record OfficeCloseRequest(string ItemId, string OccurrenceAt, bool Closed);

    /// <summary>
    /// DIE KANZLEI SCHLIESST EINEN TERMIN — auch mit freien Plaetzen — oder
    /// oeffnet ihn wieder. Was sie oeffnet, war vielleicht vom Gastgeber
    /// geschlossen; sie darf das, er umgekehrt nicht.
    /// </summary>
    private static async Task OfficeCloseAsync(HttpContext ctx, Db db, Guid id, OfficeCloseRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var resource = await OfficeResourceAsync(ctx, db, connection, id);
        if (resource is null) return;

        if (!Guid.TryParse(body.ItemId, out var itemId) || !DateTimeOffset.TryParse(body.OccurrenceAt, out var at)
            || await OfferAsync(connection, resource, itemId, at, ctx.RequestAborted) is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo go odwołano.");
            return;
        }

        await SetClosedAsync(connection, null, resource.Id, itemId, at, body.Closed ? "office" : null, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(itemId), occurrenceAt = at, closed = body.Closed });
    }

    /* 0097 — `Name` (Klartext) nimmt der Dienst nicht mehr: der Name ohne Link kommt versiegelt. */
    public sealed record OfficeAddRequest(string ItemId, string OccurrenceAt, string? SeatId, string? Name,
        string? NameSealed = null, int? NameEpoch = null, string? ClaimId = null);

    /// <summary>
    /// DIE KANZLEI TRAEGT JEMANDEN EIN — auch ueber die Plaetze hinaus, auch in
    /// einen geschlossenen Termin, auch ueber die Grenze je Person: sie weiss,
    /// warum. Mit Link (ein Platz, den sie lesen darf — dann sieht der Mensch
    /// den Termin bei sich) oder nur mit Namen, fuer jemanden ohne Link.
    /// </summary>
    private static async Task OfficeAddAsync(HttpContext ctx, Db db, Guid id, OfficeAddRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var resource = await OfficeResourceAsync(ctx, db, connection, id);
        if (resource is null) return;

        if (!Guid.TryParse(body.ItemId, out var itemId) || !DateTimeOffset.TryParse(body.OccurrenceAt, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz termin.");
            return;
        }

        var offer = await OfferAsync(connection, resource, itemId, at, ctx.RequestAborted);
        if (offer is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo go odwołano.");
            return;
        }

        /* 0058 — die Plätze DIESES Termins. */
        resource = ForOffer(resource, offer);

        Guid? seatId = null;

        /* 0097 — ein Name ohne Link kommt versiegelt, unter dem Schlüssel des Bereichs des Dings. */
        var (named, namedEpoch, namedError) = Names.Read(body.NameSealed, body.NameEpoch);
        if (namedError is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, namedError);
            return;
        }

        if (named is not null && await Names.EpochProblemAsync(connection, null, resource.AreaId, namedEpoch, person: true, ctx.RequestAborted) is { } problem)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, problem);
            return;
        }

        if (!string.IsNullOrWhiteSpace(body.SeatId))
        {
            if (!Guid.TryParse(body.SeatId, out var seat))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna osoba.");
                return;
            }

            /* Ein Platz, den diese Kanzlei sieht — und der noch gilt. Sein Name steht an ihm, nicht am Anspruch. */
            await using var find = new SqlCommand("""
                SELECT area_id FROM app.access
                WHERE id = @id AND revoked_at IS NULL AND status = N'active';
                """, connection);
            find.Parameters.AddWithValue("@id", seat);

            Guid seatArea;
            await using (var reader = await find.ExecuteReaderAsync(ctx.RequestAborted))
            {
                if (!await reader.ReadAsync(ctx.RequestAborted))
                {
                    await Fail(ctx, StatusCodes.Status404NotFound, "Tej osoby nie ma albo jej link wycofano.");
                    return;
                }
                seatArea = reader.GetGuid(0);
            }

            var who = await Auth.WhoAsync(ctx, db);
            if (!await Area.MayAsync(connection, who!.Value.AccountId, seatArea, Capability.Read, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tej osoby nie ma albo jej link wycofano.");
                return;
            }

            seatId = seat;
        }
        else if (named is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz osobę albo wpisz imię i nazwisko.");
            return;
        }

        /* 0097 — die Kennung würfelt der Browser: an sie ist die Hülle des Namens gebunden. */
        var claimId = Guid.TryParse(body.ClaimId, out var chosen) && chosen != Guid.Empty ? chosen : Ids.NewId();

        await using var insert = new SqlCommand("""
            INSERT INTO app.claim
                (id, resource_id, starts_at, ends_at, item_id, occurrence_at, access_id, role_id,
                 group_id, status, awaits, holder_name_sealed, holder_name_epoch, by_office, created_at, decided_at)
            VALUES
                (@id, @r, @s, @e, @item, @at, @access, NULL,
                 @id, N'confirmed', NULL, @named, @namedEpoch, 1, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", claimId);
        insert.Parameters.AddWithValue("@r", resource.Id);
        insert.Parameters.AddWithValue("@s", offer.StartsAt);
        insert.Parameters.AddWithValue("@e", offer.EndsAt);
        insert.Parameters.AddWithValue("@item", itemId);
        insert.Parameters.AddWithValue("@at", at);
        insert.Parameters.AddWithValue("@access", (object?)seatId ?? DBNull.Value);
        insert.Parameters.AddBlob("@named", seatId is null ? named : null);
        insert.Parameters.AddWithValue("@namedEpoch", seatId is null && named is not null ? namedEpoch : DBNull.Value);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta osoba jest już zapisana na ten termin.");
            return;
        }

        var taken = (await OfferClaimsAsync(connection, null, resource.Id, itemId, at, ctx.RequestAborted)).Count(Counts);

        await ctx.Response.WriteAsJsonAsync(new
        {
            claimId = Ids.ToText(claimId),
            taken,
            capacity = resource.Capacity,
            over = taken > resource.Capacity
        });
    }

    /// <summary>
    /// DIE KANZLEI TRAEGT JEMANDEN AUS — egal, wie er darauf kam. War er der
    /// Gastgeber, gibt es danach keinen mehr: die freien Plaetze gehoeren allen.
    /// </summary>
    private static async Task OfficeRemoveAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var claim = await ClaimByIdAsync(connection, null, id, ctx.RequestAborted);
        if (claim is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rezerwacji nie ma.");
            return;
        }

        var resource = await OfficeResourceAsync(ctx, db, connection, claim.ResourceId);
        if (resource is null) return;

        await using var cmd = new SqlCommand("""
            UPDATE app.claim
               SET status = N'declined', awaits = NULL, decided_at = @now,
                   invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
             WHERE id = @id AND status IN (N'pending', N'confirmed');
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta osoba nie jest już zapisana.");
            return;
        }

        await DropHostCloseAsync(connection, null, id, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { claimId = Ids.ToText(id), removed = true });
    }

    public sealed record HostCloseRequest(string ClaimId, bool Closed, string? Seat, string? RoleId = null);

    /// <summary>
    /// DER GASTGEBER SCHLIESST SEINEN TERMIN — sobald so viele darauf sitzen,
    /// wie die Kanzlei als Mindestzahl gesetzt hat. Dann kommt niemand mehr
    /// dazu, und nach seinem Fenster oeffnet sich der Termin nicht fuer andere.
    /// Er kann ihn wieder oeffnen — ausser die Kanzlei hat ihn geschlossen.
    /// </summary>
    private static async Task HostCloseAsync(HttpContext ctx, Db db, HostCloseRequest body)
    {
        if (!Guid.TryParse(body.ClaimId, out var claimId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rezerwacja.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var holder = await HolderAsync(ctx, db, connection, body.Seat, body.RoleId, ctx.RequestAborted);
        var claim = holder is null ? null : await ClaimByIdAsync(connection, null, claimId, ctx.RequestAborted);

        if (claim is null || !claim.HeldBy(holder!.Value.Id) || !Hosts(claim, DateTimeOffset.UtcNow)
            || claim.ItemId is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Zamknąć termin może tylko jego gospodarz.");
            return;
        }

        if (!SaidYes(claim))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Najpierw zdecyduj, czy chcesz być gospodarzem tego terminu.");
            return;
        }

        var resource = await ResourceAsync(connection, claim.ResourceId, ctx.RequestAborted);
        if (resource is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma.");
            return;
        }

        var item = claim.ItemId.Value;
        var at = claim.OccurrenceAt!.Value;
        var by = await ClosedByAsync(connection, null, item, at, ctx.RequestAborted);

        if (by == "office")
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten termin zamknęła kancelaria — tylko ona może go otworzyć.");
            return;
        }

        if (body.Closed)
        {
            var taken = (await OfferClaimsAsync(connection, null, resource.Id, item, at, ctx.RequestAborted)).Count(Counts);
            if (taken < resource.MinPersons)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Zamknąć można, gdy zapisanych jest co najmniej {resource.MinPersons} — teraz jest {taken}.");
                return;
            }
        }

        await SetClosedAsync(connection, null, resource.Id, item, at, body.Closed ? "host" : null, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { claimId = Ids.ToText(claimId), closed = body.Closed });
    }
}
