using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-10-22 — MITGLIEDSCHAFTEN ERNEUERN SICH SELBST.
///
/// <para>
/// Ein Zertifikat muss ablaufen (E-07: ohne Ablauf wäre es eine Zusage auf
/// immer). Damit Rechte trotzdem bleiben, schreibt der Browser eines Menschen,
/// der im Bereich aufnehmen darf (<c>certify</c>/<c>admin</c>), jedes
/// Zertifikat neu, sobald es ein Jahr alt ist — es gilt zwei Jahre
/// (<see cref="MaxLife"/>), es bleibt also immer ein Jahr Vorlauf. Erneuert
/// wird nur, was noch besteht: eine Rolle, deren Zertifikat nicht
/// zurückgenommen ist und deren Schlüssel nicht vernichtet ist. Wer
/// hinausgenommen wurde (<c>drop</c> nimmt alle ihre Zertifikate zurück),
/// kommt so nicht wieder herein; wer niemanden mehr hat, der ihn erneuert,
/// läuft aus — das ist der Sinn des Ablaufs.
/// </para>
///
/// <code>
///   GET  /workspace/area/{id}/renewals   was hier fällig ist, und mit welcher meiner Rollen ich unterschreibe
///   POST /workspace/area/{id}/renew      die neuen Zertifikate (keine neuen Schlüssel)
/// </code>
///
/// Was fällig ist, sagt auch die Glocke (<c>renewals.waiting</c> im Digest),
/// damit der Browser nicht jeden Bereich fragen muss.
/// </summary>
public static partial class Area
{
    /// <summary>Wann ein Zertifikat erneuert wird: wenn ihm weniger als ein Jahr bleibt.</summary>
    internal static readonly TimeSpan RenewBefore = TimeSpan.FromDays(365);

    private const int MaxRenewals = 200;

    /// <summary>
    /// SQL: die Mitgliedschaften (Rolle × Stufe) eines Bereichs <c>{area}</c>,
    /// deren jüngstes nicht zurückgenommenes Zertifikat vor <c>@due</c> endet —
    /// und deren Rolle den Schlüssel noch hat.
    /// </summary>
    internal static string DueMemberships(string area) => $"""
        SELECT c.subject_role_id, c.capability
        FROM app.certificate c
        JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
        WHERE c.scope_kind = N'area' AND c.scope_id = {area} AND c.revoked_at IS NULL
          AND EXISTS (SELECT 1 FROM app.key_grant g
                       WHERE g.key_kind = N'epoch' AND g.key_ref = c.scope_id
                         AND g.role_id = c.subject_role_id AND g.destroyed_at IS NULL)
        GROUP BY c.subject_role_id, c.capability
        HAVING MAX(c.expires_at) < @due
        """;

    public sealed record RenewItem(string RoleId, Proof Certificate);

    public sealed record RenewRequest(string IssuerRoleId, List<RenewItem>? Renewals);

    /// <summary>
    /// Meine Rollen, die hier aufnehmen dürfen (lebendes <c>certify</c> oder
    /// <c>admin</c>) — die erste unterschreibt.
    /// </summary>
    private static async Task<List<Guid>> CertifyingRolesAsync(
        SqlConnection connection, List<Guid> mine, Guid areaId, CancellationToken ct)
    {
        if (mine.Count == 0) return [];
        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT subject_role_id FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area AND revoked_at IS NULL AND expires_at > @now
              AND capability IN (N'admin', N'certify') AND subject_role_id IN ({names});
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
        var found = new List<Guid>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) found.Add(reader.GetGuid(0));
        /* In der Reihenfolge meiner Rollen — dieselbe Wahl bei jedem Aufruf. */
        return mine.Where(found.Contains).ToList();
    }

    private static async Task RenewalsAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var issuers = await CertifyingRolesAsync(connection, mine, id, ctx.RequestAborted);
        if (issuers.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand(DueMemberships("@area") + ";", connection);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@due", DateTimeOffset.UtcNow + RenewBefore);

        var due = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                due.Add(new { roleId = Ids.ToText(reader.GetGuid(0)), capability = reader.GetString(1) });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), issuerRoleId = Ids.ToText(issuers[0]), due });
    }

    private static async Task RenewAsync(HttpContext ctx, Db db, Guid id, RenewRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var items = body.Renewals ?? [];
        if (!Guid.TryParse(body.IssuerRoleId, out var issuerId) || items.Count == 0 || items.Count > MaxRenewals)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednego do {MaxRenewals} zaświadczeń, z rolą, która je podpisuje.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();

        /* DARF: die unterschreibende Rolle ist meine und darf hier aufnehmen — wie beim Hereinlassen. */
        if (!(await CertifyingRolesAsync(connection, mine, id, ctx.RequestAborted)).Contains(issuerId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tu nikomu nie przedłużasz dostępu.");
            return;
        }

        var issuerKey = await PublicSignKeyAsync(connection, issuerId, ctx.RequestAborted);
        if (issuerKey is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma."); return; }

        var now = DateTimeOffset.UtcNow;

        /* Was hier noch besteht — und was ein anderer Browser eben schon erneuert hat. */
        var open = new HashSet<(Guid, string)>();
        var fresh = new HashSet<(Guid, string)>();
        await using (var cmd = new SqlCommand("""
            SELECT c.subject_role_id, c.capability, MAX(c.expires_at)
            FROM app.certificate c
            WHERE c.scope_kind = N'area' AND c.scope_id = @area AND c.revoked_at IS NULL
              AND EXISTS (SELECT 1 FROM app.key_grant g
                           WHERE g.key_kind = N'epoch' AND g.key_ref = c.scope_id
                             AND g.role_id = c.subject_role_id AND g.destroyed_at IS NULL)
            GROUP BY c.subject_role_id, c.capability;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var line = (reader.GetGuid(0), reader.GetString(1));
                open.Add(line);
                if (reader.GetDateTimeOffset(2) >= now + RenewBefore) fresh.Add(line);
            }
        }

        var accepted = new List<(CertificateRecord Record, byte[] Signature)>();
        var skipped = 0;
        foreach (var item in items)
        {
            if (!Guid.TryParse(item.RoleId, out var subjectId)
                || !Guid.TryParse(item.Certificate?.Id ?? string.Empty, out var certificateId)
                || !Capabilities.TryParse(item.Certificate!.Capability, out var capability))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zaświadczenie.");
                return;
            }

            var line = (subjectId, Capabilities.ToText(capability));
            /* Nur Bestehendes: wer hinausgenommen wurde, kommt so nicht zurück. */
            if (!open.Contains(line))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ta rola nie ma już tego dostępu — przedłużyć można tylko to, co trwa.");
                return;
            }
            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(item.Certificate.IssuedAt);
            var expiresAt = DateTimeOffset.FromUnixTimeSeconds(item.Certificate.ExpiresAt);
            if (issuedAt > now + ClockSlack || issuedAt < now - ClockSlack || expiresAt <= issuedAt || expiresAt > now + MaxLife)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Data albo ważność zaświadczenia się nie zgadza.");
                return;
            }

            byte[] signature;
            try { signature = Base64Url.Decode(item.Certificate.Signature ?? string.Empty); }
            catch (FormatException) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny podpis."); return; }

            var record = new CertificateRecord
            {
                Id = certificateId,
                SubjectRoleId = subjectId,
                ScopeKind = ScopeKind.Area,
                ScopeId = id,
                Capability = capability,
                IssuedByRoleId = issuerId,
                IssuedUtc = issuedAt,
                ExpiresUtc = expiresAt
            };
            if (!Verify(record, issuerKey, signature))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis się nie zgadza.");
                return;
            }
            /* Erst prüfen, dann überspringen: ein falsches Zertifikat wird nie still übergangen. */
            if (fresh.Contains(line)) { skipped += 1; continue; }
            accepted.Add((record, signature));
            fresh.Add(line);
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            foreach (var (record, signature) in accepted)
            {
                await InsertCertificateAsync(connection, tx, record, signature, ctx.RequestAborted);
            }
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), renewed = accepted.Count, skipped });
    }
}
