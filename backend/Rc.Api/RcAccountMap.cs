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

    /// <summary>Ein Knoten. <c>kind</c> ist <c>account</c> oder eine Rollenart.</summary>
    public sealed record NodeView(
        string Id, string Kind, string? Name, int Depth, bool HasKey, bool IsAccount);

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
            ? []
            : await LoadEdgesAsync(connection, session.AccountId, ids, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcAccountMapResponse(nodes, edges));
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
