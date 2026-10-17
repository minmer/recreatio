using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Gastgeber und Kanzlei entscheiden über Anfragen.</summary>
public static partial class Bookings
{
    /* ======================================================================
       JA ODER NEIN
       ====================================================================== */

    public sealed record DecideRequest(string ClaimId, bool Accept, string? Seat, string? RoleId = null);

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

        var holder = await HolderAsync(ctx, db, connection, body.Seat, body.RoleId, ctx.RequestAborted);
        if (holder is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var me = holder.Value.Id;

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
            var host = claims.FirstOrDefault(c => Hosts(c, DateTimeOffset.UtcNow));

            if (host is null || !host.HeldBy(me))
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status403Forbidden, "O tym decyduje gospodarz terminu.");
                return;
            }

            if (body.Accept && claims.Count(Counts) >= await ItemCapacityAsync(connection, tx, resource, ask.ItemId.Value, ctx.RequestAborted))
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

    public sealed record UnhostRequest(string ClaimId, string? Seat, string? RoleId = null);

    /// <summary>
    /// DAS VORRECHT ABGEBEN — „ich lade niemanden ein".
    ///
    /// <para>
    /// Der Gastgeber hielt die freien Plaetze fuer die, denen er seinen Code
    /// gibt. Will er niemanden mitbringen, blockierte er sie bis zum Ende des
    /// Fensters fuer nichts. Gibt er ab, gehoeren sie sofort allen.
    /// </para>
    ///
    /// <para>
    /// <b>Wer ihn schon gebeten hat, wartet nicht ins Leere.</b> Es gibt
    /// niemanden mehr, der ja sagen koennte — also werden die Bitten der Reihe
    /// nach angenommen, solange Platz ist, und die uebrigen abgelehnt. Unter
    /// derselben Sperre wie jedes Nehmen.
    /// </para>
    /// </summary>
    private static async Task UnhostAsync(HttpContext ctx, Db db, UnhostRequest body)
    {
        if (!Guid.TryParse(body.ClaimId, out var claimId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rezerwacja.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var holder = await HolderAsync(ctx, db, connection, body.Seat, body.RoleId, ctx.RequestAborted);
        var claim = holder is null ? null : await ClaimByIdAsync(connection, null, claimId, ctx.RequestAborted);

        if (claim is null || !claim.HeldBy(holder!.Value.Id) || claim.InviteSha256 is null
            || claim.Status != "confirmed" || claim.ItemId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie jesteś gospodarzem tego terminu.");
            return;
        }

        var resource = await ResourceAsync(connection, claim.ResourceId, ctx.RequestAborted);
        if (resource is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie jesteś gospodarzem tego terminu.");
            return;
        }

        var tree = await TreeAsync(connection, null, resource, ctx.RequestAborted);
        var accepted = new List<Guid>();
        var declined = new List<Guid>();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var hold = new SqlCommand(
                "SELECT id FROM app.resource WITH (UPDLOCK, HOLDLOCK) WHERE id = @root;", connection, tx))
            {
                hold.Parameters.AddWithValue("@root", tree.Root);
                await hold.ExecuteScalarAsync(ctx.RequestAborted);
            }

            await using (var drop = new SqlCommand("""
                UPDATE app.claim
                   SET invite_sha256 = NULL, invite_until = NULL, invite_sealed = NULL
                 WHERE id = @id;
                """, connection, tx))
            {
                drop.Parameters.AddWithValue("@id", claimId);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            var claims = await OfferClaimsAsync(connection, tx, resource.Id, claim.ItemId.Value,
                claim.OccurrenceAt!.Value, ctx.RequestAborted);

            var counted = claims.Count(Counts);
            var capacity = await ItemCapacityAsync(connection, tx, resource, claim.ItemId.Value, ctx.RequestAborted);

            /* Die Kennungen sind zeitlich geordnet — wer zuerst bat, kommt zuerst. */
            foreach (var ask in claims.Where(c => c.Status == "pending" && c.Awaits == "host").OrderBy(c => c.Id))
            {
                if (counted < capacity) { accepted.Add(ask.Id); counted++; }
                else declined.Add(ask.Id);
            }

            if (accepted.Count > 0) await Decided(connection, tx, accepted, true, ctx.RequestAborted);
            if (declined.Count > 0) await Decided(connection, tx, declined, false, ctx.RequestAborted);

            await DropHostCloseAsync(connection, tx, claimId, ctx.RequestAborted);

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
            hosting = false,
            accepted = accepted.Count,
            declined = declined.Count
        });
    }

    public sealed record HostConfirmRequest(string ClaimId, string? Seat, string? RoleId = null);

    /// <summary>
    /// „TAK — ZAPRASZAM ZNAJOMYCH" (0050). Der Erste sagt ja, und sein Fenster
    /// beginnt JETZT, mit so vielen Stunden, wie die Kanzlei gesetzt hat. Ein
    /// Nein ist das Abgeben des Vorrechts (`/resource/unhost`).
    ///
    /// <para>
    /// <b>Nur in der Bedenkzeit.</b> Sind die 15 Minuten um, gehoeren die
    /// freien Plaetze schon allen — ein spaetes Ja naehme sie ihnen wieder weg.
    /// </para>
    /// </summary>
    private static async Task HostConfirmAsync(HttpContext ctx, Db db, HostConfirmRequest body)
    {
        if (!Guid.TryParse(body.ClaimId, out var claimId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rezerwacja.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var holder = await HolderAsync(ctx, db, connection, body.Seat, body.RoleId, ctx.RequestAborted);
        var claim = holder is null ? null : await ClaimByIdAsync(connection, null, claimId, ctx.RequestAborted);

        if (claim is null || !claim.HeldBy(holder!.Value.Id) || claim.InviteSha256 is null
            || claim.Status != "confirmed" || claim.ItemId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie jesteś pierwszą osobą na tym terminie.");
            return;
        }

        var resource = await ResourceAsync(connection, claim.ResourceId, ctx.RequestAborted);
        if (resource is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie jesteś pierwszą osobą na tym terminie.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        /* Schon ja gesagt — dann bleibt es dabei, mit dem Fenster von damals. */
        if (SaidYes(claim))
        {
            await ctx.Response.WriteAsJsonAsync(new { claimId = Ids.ToText(claimId), hosting = true, inviteUntil = claim.InviteUntil });
            return;
        }

        var until = now.AddHours(resource.InviteHours);

        await using var cmd = new SqlCommand("""
            UPDATE app.claim
               SET host_confirmed_at = @now, invite_until = @until
             WHERE id = @id AND status = N'confirmed' AND invite_sha256 IS NOT NULL
               AND host_confirmed_at IS NULL AND invite_until > @now;
            """, connection);
        cmd.Parameters.AddWithValue("@id", claimId);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@until", until);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Minęło {HostDecisionMinutes} minut bez odpowiedzi — wolne miejsca są już dostępne dla wszystkich.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { claimId = Ids.ToText(claimId), hosting = true, inviteUntil = until });
    }

    /// <summary>
    /// BITTEN, UEBER DIE NIEMAND MEHR ENTSCHEIDET (0050).
    ///
    /// <para>
    /// Wer um Mitnahme bat, wartet auf den Gastgeber. Laesst der Erste seine
    /// 15 Minuten verstreichen oder laeuft das Fenster eines Gastgebers ab, ist
    /// niemand mehr da, der ja sagen koennte — und die Bitte hinge fuer immer.
    /// Deshalb bekommt sie hier ihre Antwort, genau wie beim Abgeben des
    /// Vorrechts: der Reihe nach angenommen, solange Platz ist — ausser die
    /// Gruppe ist komplett (Mindestzahl erreicht) oder der Termin geschlossen;
    /// dann abgelehnt.
    /// </para>
    ///
    /// <para>
    /// Nachgeholt beim Lesen, unter derselben Sperre wie jedes Nehmen.
    /// <c>true</c>: es wurde etwas entschieden.
    /// </para>
    /// </summary>
    private static async Task<bool> SettleAsksAsync(
        SqlConnection connection, ResourceRow resource, Guid itemId, DateTimeOffset at,
        List<ClaimRow> seen, DateTimeOffset now, CancellationToken ct)
    {
        if (!seen.Any(c => c.Status == "pending" && c.Awaits == "host") || HostWindowOpen(seen, now)) return false;

        var tree = await TreeAsync(connection, null, resource, ct);
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);

        try
        {
            await using (var hold = new SqlCommand(
                "SELECT id FROM app.resource WITH (UPDLOCK, HOLDLOCK) WHERE id = @root;", connection, tx))
            {
                hold.Parameters.AddWithValue("@root", tree.Root);
                await hold.ExecuteScalarAsync(ct);
            }

            var claims = await OfferClaimsAsync(connection, tx, resource.Id, itemId, at, ct);
            var asks = claims.Where(c => c.Status == "pending" && c.Awaits == "host").OrderBy(c => c.Id).ToList();

            if (asks.Count == 0 || HostWindowOpen(claims, now))
            {
                await tx.CommitAsync(ct);
                return false;
            }

            var counted = claims.Count(Counts);
            var shut = await ClosedByAsync(connection, tx, itemId, at, ct) is not null
                       || (claims.Any(c => Hosts(c, now)) && counted >= Math.Max(1, resource.MinPersons));

            var accepted = new List<Guid>();
            var declined = new List<Guid>();
            var capacity = await ItemCapacityAsync(connection, tx, resource, itemId, ct);

            foreach (var ask in asks)
            {
                if (!shut && counted < capacity) { accepted.Add(ask.Id); counted++; }
                else declined.Add(ask.Id);
            }

            if (accepted.Count > 0) await Decided(connection, tx, accepted, true, ct);
            if (declined.Count > 0) await Decided(connection, tx, declined, false, ct);

            await tx.CommitAsync(ct);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
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
}
