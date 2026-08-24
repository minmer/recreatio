using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 3.5 und 24.5 — Die Berechtigungspruefung. <b>Eine Abfrage, nicht zwanzig.</b>
///
/// 24.5 verlangt das ausdruecklich, und der Grund ist nicht Eleganz: eine
/// Anzeige mit dreissig Nachrichten wuerde sonst dreissig Rundreisen zur
/// Datenbank machen, jede mit einem rekursiven Lauf durch den Rollengraphen.
/// Der Altbestand hat genau so gearbeitet, und deshalb wurde dort gecacht, und
/// deshalb wirkte ein Entzug erst nach dem Ablauf des Caches.
///
/// Hier laeuft der Graphlauf IN der Datenbank, als rekursiver CTE, und die
/// Zertifikatspruefung haengt am selben Ausdruck. Kein Zwischenspeicher, kein
/// Entzug, der zu spaet wirkt.
///
/// <b>Was hier NICHT entschieden wird.</b> Ob <c>admin</c> auch
/// <c>read</c> einschliesst, steht im Kernel (<see cref="RcCapabilities"/>) und
/// nicht in dieser Abfrage. Die Ordnung zweimal zu schreiben — einmal in C#,
/// einmal in SQL — heisst, sie irgendwann einmal zu aendern.
/// </summary>
public sealed class RcPermissions(RcDb db)
{
    /// <summary>
    /// 3.14 — Dieselbe Grenze wie im Kernel. Der rekursive CTE braucht sie
    /// zwingend: ein Kreis in den Daten wuerde ihn sonst laufen lassen, bis
    /// SQL Server abbricht — und das ist ein Fehler zur Anzeigezeit, nicht beim
    /// Einfuegen der Kante.
    /// </summary>
    public const int MaxDepth = RcRoleGraph.MaxDepth;

    /// <summary>
    /// Der gemeinsame Kopf jeder Abfrage: die Rollen, die dieses Konto erreicht.
    ///
    /// Widerrufene Kanten, abgelaufene Kanten und widerrufene Rollen fallen
    /// dabei heraus — an dieser einen Stelle, damit kein Aufrufer es vergessen
    /// kann.
    /// </summary>
    private const string ReachableCte = """
        WITH reachable (role_id, depth) AS (
            SELECT e.to_role_id, 0
            FROM dbo.rc_role_edge e
            JOIN dbo.rc_role r ON r.id = e.to_role_id AND r.revoked_at IS NULL
            WHERE e.from_account_id = @account
              AND e.revoked_at IS NULL
              AND (e.expires_at IS NULL OR e.expires_at > @now)
            UNION ALL
            SELECT e.to_role_id, p.depth + 1
            FROM dbo.rc_role_edge e
            JOIN reachable p ON p.role_id = e.from_role_id
            JOIN dbo.rc_role r ON r.id = e.to_role_id AND r.revoked_at IS NULL
            WHERE e.revoked_at IS NULL
              AND (e.expires_at IS NULL OR e.expires_at > @now)
              AND p.depth < @maxDepth
        )
        """;

    /// <summary>
    /// Darf dieses Konto <paramref name="needed"/> in diesem Geltungsbereich?
    ///
    /// Die Antwort nennt die Rolle und das Zertifikat, ueber die es gilt. Eine
    /// Berechtigung, die sich nicht erklaeren laesst, laesst sich auch nicht
    /// zurechtruecken — und irgendwann fragt jemand, warum er etwas sieht.
    /// </summary>
    public async Task<RcPermissionResult> CheckAsync(
        Guid accountId, RcScopeKind scopeKind, Guid scopeId, RcCapability needed, CancellationToken ct = default)
    {
        var accepted = Accepting(needed);
        var names = string.Join(", ", accepted.Select((_, i) => $"@cap{i}"));

        await using var connection = await db.OpenAsync(ct);
        await using var cmd = new SqlCommand($"""
            {ReachableCte}
            SELECT TOP 1 c.id, c.subject_role_id
            FROM dbo.rc_certificate c
            JOIN reachable rr ON rr.role_id = c.subject_role_id
            WHERE c.scope_kind = @scopeKind
              AND c.scope_id   = @scopeId
              AND c.capability IN ({names})
              AND c.revoked_at IS NULL
              AND c.expires_at > @now
            OPTION (MAXRECURSION {MaxDepth});
            """, connection);

        var now = DateTimeOffset.UtcNow;
        cmd.Parameters.AddWithValue("@account", accountId);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@maxDepth", MaxDepth);
        cmd.Parameters.AddWithValue("@scopeKind", RcCapabilities.ScopeText(scopeKind));
        cmd.Parameters.AddWithValue("@scopeId", scopeId);
        for (var i = 0; i < accepted.Count; i++) cmd.Parameters.AddWithValue($"@cap{i}", accepted[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return RcPermissionResult.Denied;

        return new RcPermissionResult(true, reader.GetGuid(1), reader.GetGuid(0));
    }

    /// <summary>
    /// Alle Rollen, die dieses Konto erreicht. Fuer die Anzeige „unter welchem
    /// Namen schreibe ich hier" und fuer den Schluesselweg.
    /// </summary>
    public async Task<IReadOnlyList<RcReachableRole>> ReachableRolesAsync(Guid accountId, CancellationToken ct = default)
    {
        await using var connection = await db.OpenAsync(ct);
        return await ReachableRolesAsync(connection, accountId, ct);
    }

    public static async Task<IReadOnlyList<RcReachableRole>> ReachableRolesAsync(
        SqlConnection connection, Guid accountId, CancellationToken ct = default)
    {
        await using var cmd = new SqlCommand($"""
            {ReachableCte}
            SELECT r.id, r.kind, r.tenant_id, MIN(rr.depth) AS depth
            FROM reachable rr
            JOIN dbo.rc_role r ON r.id = rr.role_id
            GROUP BY r.id, r.kind, r.tenant_id
            ORDER BY depth, r.kind
            OPTION (MAXRECURSION {MaxDepth});
            """, connection);

        cmd.Parameters.AddWithValue("@account", accountId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@maxDepth", MaxDepth);

        var roles = new List<RcReachableRole>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            roles.Add(new RcReachableRole(reader.GetGuid(0), reader.GetString(1), reader.GetGuid(2), reader.GetInt32(3)));
        }
        return roles;
    }

    /// <summary>
    /// 3.14 — Vor dem Einfuegen einer Kante. Die Pruefung laeuft auf den
    /// Klartextfeldern; sie braucht keine Entschluesselung, weil der
    /// strukturelle Teil einer Kante offen liegt.
    /// </summary>
    public static async Task AssertNoCycleAsync(
        SqlConnection connection, SqlTransaction? tx, Guid fromRoleId, Guid toRoleId, CancellationToken ct = default)
    {
        if (fromRoleId == toRoleId) throw new RcRoleCycleException(fromRoleId, toRoleId);

        // Waere fromRole von toRole aus schon erreichbar, schlOesse die neue
        // Kante den Kreis. Der Lauf beginnt deshalb bei toRole.
        await using var cmd = new SqlCommand($"""
            WITH reachable (role_id, depth) AS (
                SELECT @to, 0
                UNION ALL
                SELECT e.to_role_id, p.depth + 1
                FROM dbo.rc_role_edge e
                JOIN reachable p ON p.role_id = e.from_role_id
                WHERE e.revoked_at IS NULL AND p.depth < @maxDepth
            )
            SELECT TOP 1 1 FROM reachable WHERE role_id = @from
            OPTION (MAXRECURSION {MaxDepth});
            """, connection, tx);

        cmd.Parameters.AddWithValue("@to", toRoleId);
        cmd.Parameters.AddWithValue("@from", fromRoleId);
        cmd.Parameters.AddWithValue("@maxDepth", MaxDepth);

        if (await cmd.ExecuteScalarAsync(ct) is not null)
            throw new RcRoleCycleException(fromRoleId, toRoleId);
    }

    /// <summary>
    /// Welche eingetragenen Stufen die verlangte abdecken. Die Ordnung kommt
    /// aus dem Kernel, damit sie genau einmal existiert.
    /// </summary>
    private static IReadOnlyList<string> Accepting(RcCapability needed) =>
        new[] { RcCapability.Read, RcCapability.Write, RcCapability.Admin, RcCapability.Certify }
            .Where(held => RcCapabilities.Covers(held, needed))
            .Select(RcCapabilities.ToText)
            .ToList();
}

public sealed record RcReachableRole(Guid RoleId, string Kind, Guid TenantId, int Depth);
