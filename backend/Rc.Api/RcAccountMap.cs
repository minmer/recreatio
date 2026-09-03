using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Die Uebersicht ueber ein Konto: welche Rollen es traegt und WIE sie
/// zusammenhaengen.
///
/// <b>Warum das nicht <c>/rc/roles</c> tut.</b> Jene Liste nennt jede
/// erreichbare Rolle mit ihrer Tiefe — also mit der Laenge des kuerzesten Weges,
/// aber ohne den Weg selbst. Fuer eine Liste reicht das. Fuer eine Zeichnung
/// nicht: eine Tiefe sagt, wie weit etwas weg ist, aber nicht, WORUEBER es
/// haengt. Zwei Rollen der Tiefe 2 koennen an derselben Rolle haengen oder an
/// zwei verschiedenen, und genau dieser Unterschied ist das, was jemand sehen
/// will, der wissen moechte, was sein Konto eigentlich alles kann.
///
/// <b>Der Wurzelknoten ist das Konto</b>, nicht die persoenliche Rolle. Das ist
/// keine Kosmetik: Kanten mit <c>from_account_id</c> gehen wirklich vom Konto
/// aus (3.4) und nicht von einer Rolle. Zeichnete man die persoenliche Rolle
/// als Wurzel, verschwaende die Unterscheidung zwischen „das Konto haelt diese
/// Rolle" und „diese Rolle traegt jene" — und das sind zwei verschiedene Dinge
/// mit zwei verschiedenen Folgen beim Entzug.
///
/// <b>Was hier NICHT steht:</b> Schluessel. Der Graph nennt Kennungen, Arten,
/// Namen und Kanten. Ob ein Schluessel erreichbar ist, steht als <c>hasKey</c>
/// dabei — das ist eine Auskunft ueber den Zustand, kein Schluesselmaterial.
/// </summary>
public static class RcAccountMap
{
    public static void MapRcAccountMap(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/account/map", MapAsync).Produces<RcAccountMapResponse>();
    }

    /// <summary>
    /// Ein Knoten. <c>kind</c> ist <c>account</c>, <c>area</c> oder eine
    /// Rollenart.
    ///
    /// <c>nodeType</c> trennt, was <c>kind</c> nicht trennen kann: ein Bereich
    /// ist keine Rolle, auch wenn beide als Kasten erscheinen. Die Oberflaeche
    /// darf an einem Bereich nicht dieselben Handgriffe anbieten wie an einer
    /// Rolle — umbenennen zum Beispiel laeuft ueber einen anderen Weg.
    /// </summary>
    public sealed record NodeView(
        string Id, string Kind, string? Name, int Depth, bool HasKey, bool IsAccount,
        string NodeType = "role");

    /// <summary>
    /// Eine Kante. <c>relation</c> ist <c>holds</c>, <c>inherits</c> oder
    /// <c>supervises</c> — vom Modul gedeutet, vom Kernel nur weitergereicht (3.1).
    /// </summary>
    public sealed record EdgeView(string Id, string From, string To, string Relation);

    private static async Task MapAsync(HttpContext ctx, RcDb db, RcMasterKey masterKeys)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var reachable = await RcPermissions.ReachableRolesAsync(connection, session.AccountId, ctx.RequestAborted);
        var ids = reachable.Select(r => r.RoleId).ToList();

        var keys = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);
        var sealedNames = await RcRoles.LoadDisplayNamesAsync(connection, ids, ctx.RequestAborted);

        // Das Konto als Wurzel. Seine Kennung steht schon in der Sitzung —
        // sie ist hier Knotenname und nicht Geheimnis.
        var accountNode = RcId.ToText(session.AccountId);
        var nodes = new List<NodeView>
        {
            new(accountNode, "account", null, -1, true, true)
        };

        foreach (var r in reachable)
        {
            string? name = null;
            if (keys.TryGetValue(r.RoleId, out var key) && sealedNames.TryGetValue(r.RoleId, out var sealedName))
            {
                // Ein Name, der sich nicht oeffnen laesst, ist kein Grund, die
                // Rolle zu verschweigen: dass sie DA ist, gehoert zur Auskunft.
                try { name = RcRoles.OpenDisplayName(r.RoleId, key, sealedName); }
                catch (RcDecryptException) { }
            }

            nodes.Add(new NodeView(
                RcId.ToText(r.RoleId), r.Kind, name, r.Depth,
                keys.ContainsKey(r.RoleId), false));
        }

        var edges = ids.Count == 0
            ? new List<EdgeView>()
            : await LoadEdgesAsync(connection, session.AccountId, ids, ctx.RequestAborted);

        /*
         * DIE BEREICHE GEHOEREN DAZU.
         *
         * Ein Bereich haengt an Rollen — jede mit einem Zertifikat darauf ist
         * Mitglied. Fehlten sie in der Zeichnung, waere die Auskunft
         * unvollstaendig an genau der Stelle, an der jemand nachsieht: „warum
         * kann diese Rolle das lesen?" wird von einem Bereich beantwortet, und
         * von nichts sonst.
         *
         * Die Kante geht von der ROLLE zum Bereich und nennt die Vollmacht.
         * Andersherum stuende der Bereich als Ursprung da, und er ist keiner:
         * er verleiht nichts, er wird gehalten.
         */
        if (ids.Count > 0)
        {
            var (areaNodes, areaEdges) = await LoadAreasAsync(
                connection, session.AccountId, held.MasterKey, ids, reachable, ctx.RequestAborted);
            nodes.AddRange(areaNodes);
            edges.AddRange(areaEdges);
        }

        await RcResults.WriteJsonAsync(ctx, new RcAccountMapResponse(nodes, edges));
    }

    /// <summary>
    /// Die Bereiche, an denen die erreichbaren Rollen haengen.
    ///
    /// <b>Der Titel ist verschluesselt</b> und liegt unter dem Epochenschluessel
    /// (9.13). Er wird geoeffnet, wo das geht; wo nicht, bleibt der Kasten
    /// namenlos stehen. Dass ein Bereich DA ist, gehoert zur Auskunft — auch
    /// wenn dieses Konto seinen Namen nicht lesen kann.
    ///
    /// <b>Die Tiefe</b> ist die des naechstgelegenen Mitglieds plus eins: ein
    /// Bereich steht rechts von den Rollen, die ihn halten.
    /// </summary>
    private static async Task<(List<NodeView> Nodes, List<EdgeView> Edges)> LoadAreasAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, IReadOnlyList<Guid> roleIds,
        IReadOnlyList<RcReachableRole> reachable, CancellationToken ct)
    {
        var names = string.Join(", ", roleIds.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT c.scope_id, c.subject_role_id, c.capability
            FROM dbo.rc_certificate c
            WHERE c.scope_kind = @scopeKind
              AND c.revoked_at IS NULL
              AND c.expires_at > @now
              AND c.subject_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@scopeKind", RcCapabilities.ScopeText(RcScopeKind.Area));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < roleIds.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roleIds[i]);

        var links = new List<(Guid AreaId, Guid RoleId, string Capability)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
                links.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2)));
        }

        if (links.Count == 0) return ([], []);

        var depthOf = reachable.ToDictionary(r => r.RoleId, r => r.Depth);
        var areaIds = links.Select(l => l.AreaId).Distinct().ToList();
        var titles = await RcAreas.OpenTitlesAsync(connection, accountId, masterKey, areaIds, ct);

        var nodes = areaIds.Select(areaId =>
        {
            var deepest = links.Where(l => l.AreaId == areaId)
                .Select(l => depthOf.TryGetValue(l.RoleId, out var d) ? d : 0)
                .DefaultIfEmpty(0)
                .Min();

            titles.TryGetValue(areaId, out var title);
            return new NodeView(RcId.ToText(areaId), "area", title, deepest + 1,
                title is not null, false, "area");
        }).ToList();

        var edges = links.Select(l => new EdgeView(
            $"{RcId.ToText(l.RoleId)}-{RcId.ToText(l.AreaId)}-{l.Capability}",
            RcId.ToText(l.RoleId),
            RcId.ToText(l.AreaId),
            l.Capability)).ToList();

        return (nodes, edges);
    }

    /// <summary>
    /// Die Kanten INNERHALB des Erreichbaren.
    ///
    /// Die Einschraenkung auf <paramref name="roleIds"/> an BEIDEN Enden ist
    /// nicht Sparsamkeit, sondern die Grenze der Auskunft: eine Kante, deren
    /// Ausgangspunkt dieses Konto nicht erreicht, gehoert nicht zu seiner
    /// Uebersicht — sie zeichnete einen Teil eines fremden Graphen mit.
    /// </summary>
    private static async Task<List<EdgeView>> LoadEdgesAsync(
        SqlConnection connection, Guid accountId, IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        var names = string.Join(", ", roleIds.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT id, from_role_id, from_account_id, to_role_id, edge_kind
            FROM dbo.rc_role_edge
            WHERE revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > @now)
              AND to_role_id IN ({names})
              AND (from_account_id = @account OR from_role_id IN ({names}))
            ORDER BY seq;
            """, connection);

        cmd.Parameters.AddWithValue("@account", accountId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < roleIds.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roleIds[i]);

        var account = RcId.ToText(accountId);
        var edges = new List<EdgeView>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var from = reader.IsDBNull(1) ? account : RcId.ToText(reader.GetGuid(1));
            edges.Add(new EdgeView(
                RcId.ToText(reader.GetGuid(0)), from, RcId.ToText(reader.GetGuid(3)), reader.GetString(4)));
        }
        return edges;
    }
}
