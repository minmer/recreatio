using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Einen Termin nehmen, erfragen und freigeben.</summary>
public static partial class Bookings
{
    /* ======================================================================
       NEHMEN
       ====================================================================== */

    public sealed record ClaimRequest(
        string ResourceId, string? ItemId, string? OccurrenceAt,
        string? StartsAt, string? EndsAt, string? Seat, string? Code, string? GroupId,

        /* -- 0045 ---------------------------------------------------------- */

        /* Statt eines Platzes: eine eigene Person (mit Anmeldung). */
        string? RoleId = null,

        /* 0045: wie sie heisst — 0097: nicht mehr offen; ein mitgeschickter Klartext wird nicht gespeichert. */
        string? Name = null,

        /* Die Kennung, die der Browser gewuerfelt hat — der Code ist an sie gebunden. */
        string? ClaimId = null,

        /*
         * Der Code des Gastgebers, im Browser gewuerfelt: sein Abdruck, und
         * er selbst versiegelt unter dem Schluessel des Halters. Gebraucht
         * nur, wenn dieser Anspruch der erste auf dem Termin ist.
         */
        string? InviteSha256 = null,
        string? InviteSealed = null,

        /* Einen eigenen Termin gegen diesen tauschen — in EINEM Schritt. */
        string? Replaces = null,

        /*
         * 0097 — der Name, versiegelt. Für die Kanzlei: unter dem Schlüssel des
         * Bereichs des Dings (HolderNameEpoch) ODER mit einem Wegwerfschlüssel,
         * der für die Annahme des Bereichs verpackt ist (HolderNameWrapped). Für
         * den Gastgeber, wenn er um Mitnahme bittet: AskNameSealed (ECIES auf
         * seinen Schlüssel). Wird DIESER Anspruch der Gastgeber: sein Paar.
         */
        string? HolderNameSealed = null, int? HolderNameEpoch = null, string? HolderNameWrapped = null,
        string? AskNameSealed = null, string? HostWrapPublic = null, string? HostWrapPrivateSealed = null);

    private static async Task ClaimAsync(HttpContext ctx, Db db, ClaimRequest body)
    {
        await TakeAsync(ctx, db, body, asking: false);
    }

    public sealed record AskRequest(
        string ResourceId, string ItemId, string OccurrenceAt, string? Seat,
        string? RoleId = null, string? Name = null,
        string? HolderNameSealed = null, int? HolderNameEpoch = null, string? HolderNameWrapped = null,
        string? AskNameSealed = null,

        /* 0097 — die Kennung würfelt der Browser: an sie sind die Hüllen des Namens gebunden. */
        string? ClaimId = null);

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
            new ClaimRequest(body.ResourceId, body.ItemId, body.OccurrenceAt, null, null, body.Seat, null, null,
                RoleId: body.RoleId,
                HolderNameSealed: body.HolderNameSealed, HolderNameEpoch: body.HolderNameEpoch,
                HolderNameWrapped: body.HolderNameWrapped, AskNameSealed: body.AskNameSealed, ClaimId: body.ClaimId),
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

        /* Ein Platz — oder eine eigene Person, mit Anmeldung (0045). */
        var holder = await HolderAsync(ctx, db, connection, body.Seat, body.RoleId, ctx.RequestAborted);
        if (holder is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var me = holder.Value.Id;

        var resource = await ResourceAsync(connection, resourceId, ctx.RequestAborted);
        if (resource is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego nie da się zarezerwować.");
            return;
        }

        /* 0129 — eine Reservierung sammelt Daten über Menschen: ohne jemanden, der für den Bereich geradesteht, nicht. */
        if (await Controllers.OfAreaAsync(connection, resource.AreaId, ctx.RequestAborted) is null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Controllers.Nobody);
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
        Guid? audience = resource.ReserveAreaId;

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

            /* 0058 — ab hier gelten die Plätze dieses Termins, und nur seine Leute dürfen ihn nehmen. */
            resource = ForOffer(resource, offer);
            audience = offer.ReserveAreaId ?? resource.ReserveAreaId;
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

        /*
         * 0058 — FÜR WEN DER TERMIN IST. Offen für einen Bereich heisst: für
         * seine Mitglieder und Plätze (und die der Bereiche darunter) — für
         * niemanden sonst, auch wenn er den Termin auf einer Seite findet.
         */
        if (audience is Guid only)
        {
            var roles = holder.Value.IsRole
                ? (await Workspace.RolesOfAsync(connection, (await Auth.WhoAsync(ctx, db))!.Value.AccountId, ctx.RequestAborted))
                    .Select(r => r.Id).ToList()
                : new List<Guid>();

            if (!await MayReserveAsync(connection, null, only, me, holder.Value.IsRole, roles, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden,
                    $"Ten termin mogą rezerwować tylko osoby z grupy „{await AreaNameAsync(connection, only, ctx.RequestAborted)}”.");
                return;
            }
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

        Guid? replaces = null;
        if (!string.IsNullOrWhiteSpace(body.Replaces))
        {
            if (!Guid.TryParse(body.Replaces, out var r))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rezerwacja do zamiany.");
                return;
            }
            replaces = r;
        }

        /*
         * DIE KENNUNG — vom Browser, wenn er eine mitbringt: an sie ist der
         * versiegelte Code gebunden. Eine, die es schon gibt, laeuft unten in
         * den Schluessel und wird abgelehnt.
         */
        var claimId = Guid.TryParse(body.ClaimId, out var chosenId) ? chosenId : Ids.NewId();

        /* Der Code aus dem Browser: Abdruck und Siegel — beides oder keins. */
        byte[]? offeredHash = null, offeredSealed = null;
        if (!string.IsNullOrWhiteSpace(body.InviteSha256) || !string.IsNullOrWhiteSpace(body.InviteSealed))
        {
            try
            {
                offeredHash = Base64Url.Decode(body.InviteSha256 ?? string.Empty);
                offeredSealed = Base64Url.Decode(body.InviteSealed ?? string.Empty);
            }
            catch (FormatException) { offeredHash = null; }

            if (offeredHash is null || offeredHash.Length != 32 || offeredSealed is null
                || offeredSealed.Length is 0 or > 4096)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny kod gospodarza.");
                return;
            }
        }

        /*
         * 0097 — DER NAME, VERSIEGELT. Unter dem Bereichsschlüssel (die Epoche
         * muss es geben, und sie darf nicht offen sein) oder für die Annahme —
         * eines von beiden. Was nicht passt, wird weggelassen: der Termin steht
         * trotzdem, die Kanzlei sieht dann „bez nazwy".
         */
        var holderSealed = Names.Blob(body.HolderNameSealed);
        int? holderEpoch = null;
        var holderWrapped = Names.Blob(body.HolderNameWrapped);
        if (holderSealed is not null)
        {
            if (holderWrapped is null && body.HolderNameEpoch is int e && e >= 1
                && await Names.EpochProblemAsync(connection, null, resource.AreaId, e, person: true, ctx.RequestAborted) is null)
            {
                holderEpoch = e;
            }
            else if (holderWrapped is null || body.HolderNameEpoch is not null)
            {
                holderSealed = null;
                holderWrapped = null;
            }
        }
        else holderWrapped = null;

        var askSealed = asking ? Names.Blob(body.AskNameSealed) : null;
        var hostPublic = Names.Blob(body.HostWrapPublic, min: 60, max: 256);
        var hostPrivate = Names.Blob(body.HostWrapPrivateSealed, max: 512);
        if (hostPublic is null || hostPrivate is null) { hostPublic = null; hostPrivate = null; }

        var tree = await TreeAsync(connection, null, resource, ctx.RequestAborted);
        string? code = null;
        byte[]? hash = null, sealedCode = null;
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
                    "SELECT COUNT(*) FROM app.claim WHERE group_id = @g AND COALESCE(access_id, role_id) <> @me;",
                    connection, tx);
                own.Parameters.AddWithValue("@g", group.Value);
                own.Parameters.AddWithValue("@me", me);

                if ((int)(await own.ExecuteScalarAsync(ctx.RequestAborted))! > 0)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status403Forbidden, "To nie Twoja rezerwacja.");
                    return;
                }
            }

            /* Was getauscht wird, muss seins sein, hier, und noch stehen. */
            if (replaces is not null)
            {
                var old = await ClaimByIdAsync(connection, tx, replaces.Value, ctx.RequestAborted);
                if (old is null || !old.HeldBy(me) || old.ResourceId != resource.Id || !Live(old))
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma czego zamienić.");
                    return;
                }
            }

            /*
             * -- JE MENSCH HOECHSTENS SO VIELE (0045) ------------------------------
             *
             * Unter derselben Sperre wie die Plaetze: zwei Klicks im selben
             * Augenblick sollen nicht beide unter der Grenze durchrutschen. Was
             * getauscht wird, zaehlt nicht mit — es geht ja gerade.
             */
            if (resource.PerPerson > 0)
            {
                await using var count = new SqlCommand("""
                    SELECT COUNT(*) FROM app.claim
                    WHERE resource_id = @r AND (access_id = @me OR role_id = @me)
                      AND status IN (N'pending', N'confirmed') AND ends_at > @now
                      AND (@old IS NULL OR id <> @old);
                    """, connection, tx);
                count.Parameters.AddWithValue("@r", resource.Id);
                count.Parameters.AddWithValue("@me", me);
                count.Parameters.AddWithValue("@now", now);
                count.Parameters.Add("@old", System.Data.SqlDbType.UniqueIdentifier).Value =
                    (object?)replaces ?? DBNull.Value;

                if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! >= resource.PerPerson)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status409Conflict, resource.PerPerson == 1
                        ? "Możesz mieć tylko jeden termin — zamień go albo najpierw oddaj."
                        : $"Możesz mieć najwyżej {resource.PerPerson} terminy — zamień jeden albo najpierw oddaj.");
                    return;
                }
            }

            var verdict = resource.Mode == "offered"
                ? await JudgeOfferAsync(connection, tx, resource, itemId!.Value, occurrenceAt!.Value,
                    me, body.Code, now, ctx.RequestAborted)
                : await JudgeOpenAsync(connection, tx, resource, tree.Above, tree.Below,
                    starts, ends, me, ctx.RequestAborted);

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

            if (firstOnOffer)
            {
                /*
                 * Bringt der Browser seinen Code mit, kennt der Dienst ihn nicht
                 * einmal — nur den Abdruck und das Siegel. Sonst wuerfelt er ihn
                 * wie bisher und sagt ihn genau einmal.
                 */
                if (offeredHash is not null)
                {
                    (hash, sealedCode) = (offeredHash, offeredSealed);
                }
                else
                {
                    code = NewCode();
                    hash = HashCode(code);
                }
            }

            /* Der Tausch: der alte geht in DERSELBEN Transaktion. */
            if (replaces is not null)
            {
                await using var drop = new SqlCommand("""
                    UPDATE app.claim
                       SET status = N'released', awaits = NULL, released_at = @now,
                           invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
                     WHERE id = @old;
                    """, connection, tx);
                drop.Parameters.AddWithValue("@old", replaces.Value);
                drop.Parameters.AddWithValue("@now", now);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var insert = new SqlCommand("""
                INSERT INTO app.claim
                    (id, resource_id, starts_at, ends_at, item_id, occurrence_at, access_id, role_id,
                     group_id, status, awaits, invite_sha256, invite_until, invite_sealed,
                     created_at,
                     holder_name_sealed, holder_name_epoch, holder_name_wrapped, ask_name_sealed,
                     host_wrap_public, host_wrap_private_sealed)
                VALUES
                    (@id, @r, @s, @e, @item, @at, @access, @role,
                     @group, @status, @awaits, @hash, @until, @sealed,
                     @now,
                     @holderSealed, @holderEpoch, @holderWrapped, @askSealed,
                     @hostPublic, @hostPrivate);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", claimId);
                insert.Parameters.AddWithValue("@r", resource.Id);
                insert.Parameters.AddWithValue("@s", starts);
                insert.Parameters.AddWithValue("@e", ends);
                insert.Parameters.AddWithValue("@item", (object?)itemId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@at", (object?)occurrenceAt ?? DBNull.Value);
                insert.Parameters.AddWithValue("@access", holder.Value.IsRole ? DBNull.Value : (object)me);
                insert.Parameters.AddWithValue("@role", holder.Value.IsRole ? (object)me : DBNull.Value);
                insert.Parameters.AddWithValue("@group", group ?? claimId);
                insert.Parameters.AddWithValue("@status", status);
                insert.Parameters.AddWithValue("@awaits",
                    status == "pending" ? (asking ? "host" : "office") : DBNull.Value);
                insert.Parameters.AddBlob("@hash", hash);
                /*
                 * ERST DIE BEDENKZEIT (0050) — nicht gleich das ganze Fenster.
                 * Sagt er ja, beginnt es dann; sagt er nichts, faellt der
                 * Termin nach 15 Minuten an alle.
                 */
                insert.Parameters.AddWithValue("@until",
                    hash is null ? DBNull.Value : now.AddMinutes(HostDecisionMinutes));
                insert.Parameters.AddBlob("@sealed", sealedCode);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddBlob("@holderSealed", holderSealed);
                insert.Parameters.AddWithValue("@holderEpoch", (object?)holderEpoch ?? DBNull.Value);
                insert.Parameters.AddBlob("@holderWrapped", holderWrapped);
                insert.Parameters.AddBlob("@askSealed", askSealed);

                /* Sein Paar nur, wenn er wirklich der Gastgeber wird (0050) — sonst brauchte es niemand. */
                insert.Parameters.AddBlob("@hostPublic", hash is null ? null : hostPublic);
                insert.Parameters.AddBlob("@hostPrivate", hash is null ? null : hostPrivate);

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
             * DER CODE — nur, wenn der Dienst ihn gewuerfelt hat, und dann
             * genau einmal. Hat der Browser ihn mitgebracht, steht hier nichts:
             * er kennt ihn, und versiegelt liegt er fuer ihn bereit.
             */
            inviteCode = code,
            hosting = hash is not null,
            hostPending = hash is not null,
            inviteUntil = hash is null ? (DateTimeOffset?)null : now.AddMinutes(HostDecisionMinutes),
            replaced = replaces is null ? null : Ids.ToText(replaces.Value)
        });
    }

    private static async Task<Verdict> JudgeOfferAsync(
        SqlConnection connection, SqlTransaction tx, ResourceRow resource, Guid itemId,
        DateTimeOffset occurrenceAt, Guid me, string? code, DateTimeOffset now, CancellationToken ct)
    {
        var claims = await OfferClaimsAsync(connection, tx, resource.Id, itemId, occurrenceAt, ct);

        var host = claims.FirstOrDefault(c => Hosts(c, now));

        return JudgeOffer(
            resource.Capacity, resource.InviteHours,
            claims.Count(Counts),
            claims.Any(c => Live(c) && c.HeldBy(me)),
            host?.InviteSha256, host?.InviteUntil, code, now,
            resource.MinPersons,
            await ClosedByAsync(connection, tx, itemId, occurrenceAt, ct) is not null);
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
        if (claims.Any(c => c.ResourceId == resource.Id && c.HeldBy(me)
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

    /// <summary>
    /// Nein — mit dem Grund in Worten UND als Wort fuer die Oberflaeche
    /// (`verdict`): nur so kann sie sagen, dass in der Zwischenzeit jemand
    /// anderes schneller war, statt einen Satz zu zeigen, der nicht dazu passt.
    /// </summary>
    private static Task Refuse(HttpContext ctx, Verdict verdict, string? message)
    {
        ctx.Response.StatusCode = verdict switch
        {
            Verdict.Mine or Verdict.Full => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status403Forbidden
        };

        return ctx.Response.WriteAsJsonAsync(new
        {
            error = message ?? verdict switch
            {
                Verdict.Mine => "To już jest Twoje.",
                Verdict.Full => "Nie ma już miejsca w tym czasie.",
                Verdict.InviteNeeded => "Ten termin trzyma teraz ktoś inny — potrzebny jest kod od niego. Możesz też poprosić.",
                Verdict.Closed => "Ten termin jest zamknięty — nie da się już na niego zapisać.",
                _ => "Na ten termin nie da się już dopisać."
            },
            verdict = verdict.ToString().ToLowerInvariant()
        });
    }

    /* ======================================================================
       ZURUECKGEBEN
       ====================================================================== */

    public sealed record ReleaseRequest(string ClaimId, string? Seat, string? RoleId = null);

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

        var holder = await HolderAsync(ctx, db, connection, body.Seat, body.RoleId, ctx.RequestAborted);
        if (holder is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.claim
               SET status = N'released', awaits = NULL, released_at = @now,
                   invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
             WHERE id = @id AND (access_id = @me OR role_id = @me)
               AND status IN (N'pending', N'confirmed');
            """, connection);

        cmd.Parameters.AddWithValue("@id", claimId);
        cmd.Parameters.AddWithValue("@me", holder.Value.Id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma czego oddać.");
            return;
        }

        await DropHostCloseAsync(connection, null, claimId, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { claimId = Ids.ToText(claimId), released = true });
    }
}
