using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0091 — WOZU GIBT JEDE MEINER ROLLEN ZUGANG?
///
/// <para>
/// Ein Link und ein Formular geben jetzt eine ROLLE, und die Rolle sagt, in
/// welche Bereiche sie führt. Wer wählt, muss das sehen: „Rada parafialna —
/// Rada (pisze), Ogłoszenia (czyta)". Die Namen der Rollen liegen versiegelt
/// (der Browser öffnet sie); die Bereiche liegen offen.
/// </para>
///
/// <para>
/// Je Rolle, die das Konto erreicht: die Bereiche über sie und alles, was sie
/// hält (die stärkste Stufe je Bereich), die Rollen, die sie unmittelbar hält,
/// und ob sie die Rolle eines Links ist (die bietet niemand zur Wahl an).
/// </para>
/// </summary>
public static partial class Roles
{
    private static async Task ReachAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var ids = mine.Where(r => r.Kind is "role" or "group").Select(r => r.Id).ToList();
        if (ids.Count == 0) { await ctx.Response.WriteAsJsonAsync(new { roles = Array.Empty<object>() }); return; }

        var names = string.Join(", ", ids.Select((_, i) => $"@r{i}"));
        var now = DateTimeOffset.UtcNow;

        /* Unmittelbar: wer hält wen, welche Bereiche je Rolle, welche Rollen Links sind. */
        var holds = new Dictionary<Guid, List<Guid>>();
        var edges = new List<RoleGraph.Edge>();
        await using (var cmd = new SqlCommand("""
            SELECT e.from_role_id, e.to_role_id FROM app.role_edge e
            JOIN app.role r ON r.id = e.to_role_id AND r.revoked_at IS NULL
            WHERE e.revoked_at IS NULL AND e.edge_kind = N'holds';
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var from = reader.GetGuid(0);
                if (!holds.TryGetValue(from, out var list)) holds[from] = list = [];
                list.Add(reader.GetGuid(1));
                edges.Add(new RoleGraph.Edge(from, reader.GetGuid(1)));
            }
        }

        var direct = new Dictionary<Guid, List<(Guid Area, string Name, string Capability)>>();
        await using (var cmd = new SqlCommand("""
            SELECT c.subject_role_id, a.id, a.name, c.capability
            FROM app.certificate c JOIN app.area a ON a.id = c.scope_id
            WHERE c.scope_kind = N'area' AND c.revoked_at IS NULL AND c.expires_at > @now
              AND c.capability IN (N'read', N'write', N'admin');
            """, connection))
        {
            cmd.Parameters.AddWithValue("@now", now);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var role = reader.GetGuid(0);
                if (!direct.TryGetValue(role, out var list)) direct[role] = list = [];
                list.Add((reader.GetGuid(1), reader.GetString(2), reader.GetString(3)));
            }
        }

        var links = new HashSet<Guid>();
        await using (var cmd = new SqlCommand($"SELECT DISTINCT role_id FROM app.invitation WHERE purpose = N'area-link' AND role_id IN ({names});", connection))
        {
            for (var i = 0; i < ids.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", ids[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) links.Add(reader.GetGuid(0));
        }

        var roles = new List<object>();
        foreach (var id in ids)
        {
            /* Über alles, was sie hält — nur `holds`, wie beim Konto (RoleGraph.Reachable). */
            var reach = RoleGraph.Reachable(id, edges);
            var areas = new Dictionary<Guid, (string Name, string Capability)>();
            foreach (var role in reach)
            {
                if (!direct.TryGetValue(role, out var list)) continue;
                foreach (var (area, name, capability) in list)
                {
                    if (!areas.TryGetValue(area, out var had) || Rank(capability) > Rank(had.Capability)) areas[area] = (name, capability);
                }
            }

            roles.Add(new
            {
                roleId = Ids.ToText(id),
                link = links.Contains(id),
                holds = (holds.TryGetValue(id, out var held) ? held : []).Select(Ids.ToText).ToList(),
                areas = areas.OrderBy(a => a.Value.Name).Select(a => new { areaId = Ids.ToText(a.Key), name = a.Value.Name, capability = a.Value.Capability }).ToList()
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { roles });

        static int Rank(string c) => c switch { "admin" => 3, "write" => 2, "read" => 1, _ => 0 };
    }
}
