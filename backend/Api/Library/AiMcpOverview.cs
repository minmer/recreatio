using System.ComponentModel;
using Kernel;
using Microsoft.Data.SqlClient;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// 0138 — <c>get_access_overview</c>: WAS DIESER ZUGANG SIEHT, als Baum. Die Bereiche, deren Links gerade gelten
/// (jeder für sich geprüft, wie bei jedem Werkzeug), ihre Stellung zueinander, ihre Zbiory, wie die Bazy wiedzy
/// aufeinander verweisen, und was erlaubt ist (immer nur lesen). Nur Struktur: kein Lernstand, keine Antworten,
/// keine Personen — und ein Bereich AUSSERHALB des Zugangs erscheint nie, nicht einmal sein Name: der Elternteil
/// eines Bereichs ist der nächste freigegebene darüber.
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record CollectionRelation(string Kind, string? Handle, string? CollectionId, string? Name, bool Shared);
    public sealed record AccessCollection(string Id, string Name, string Part, string PartName, bool Ready, int Entries, string? SnapshotMadeAt, bool? SnapshotCurrent,
        string? Handle, IReadOnlyList<CollectionRelation> LinksTo);
    public sealed record AccessArea(string AreaId, string Name, string? ParentAreaId, int Depth, IReadOnlyList<string> Children,
        string LinkExpiresAt, bool WholeArea, IReadOnlyList<string> Permissions, IReadOnlyList<AccessCollection> Collections);
    public sealed record AccessOverview(string Access, string? ConnectionExpiresAt, string? ManageUrl, IReadOnlyList<string> Roots, IReadOnlyList<AccessArea> Areas,
        string Privacy, string Note);

    /// <summary>Nur lesen — jede Freigabe, jeder Bereich, jeder Zbiór.</summary>
    public static readonly IReadOnlyList<string> ReadOnlyPermissions = ["read"];

    /// <summary>
    /// DER BAUM aus den Ketten nach oben (je Bereich seine Vorfahren, der nächste zuerst): der Elternteil ist der
    /// nächste FREIGEGEBENE Vorfahr, die Tiefe die Zahl der freigegebenen Vorfahren. Ohne Datenbank prüfbar.
    /// </summary>
    public static Dictionary<Guid, (Guid? Parent, int Depth, List<Guid> Children)> TreeOf(IReadOnlyDictionary<Guid, IReadOnlyList<Guid>> chains)
    {
        var tree = new Dictionary<Guid, (Guid? Parent, int Depth, List<Guid> Children)>();
        foreach (var (area, chain) in chains)
        {
            var up = chain.Where(a => a != area && chains.ContainsKey(a)).ToList();
            tree[area] = (up.Count == 0 ? null : up[0], up.Count, []);
        }
        foreach (var (area, node) in tree.ToList())
            if (node.Parent is Guid parent) tree[parent].Children.Add(area);
        return tree;
    }

    [McpServerTool(Name = "get_access_overview", Title = "Udostępnione obszary", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("What this access may read, as a tree: every authorized area (each checked on its own, right now) with its nearest authorized parent area and children, when its access link expires, whether it follows the whole area (collections created later join by themselves), the permissions (always read-only), and its collections (Library, Scriptorium, knowledge bases) with snapshot state and the links between knowledge bases (handle, which bases each links to and whether those are shared here). Only structure and configuration: no learner progress, answers or personal data; areas outside the authorization never appear. Areas the user adds to this connection in Recreatio appear at the next call without reconnecting; manageUrl says where the user adds, renews or removes areas.")]
    public static async Task<AccessOverview> GetAccessOverview(IHttpContextAccessor http, Db db, IConfiguration config, CancellationToken cancellationToken)
    {
        var ctx = http.HttpContext ?? throw new McpException("unauthorized: brak kontekstu żądania.");
        var secrets = ctx.Items[AiMcp.SecretsKey] as List<string> ?? [];
        var connection = ctx.Items[AiMcpConnections.ConnectionKey] as AiMcpConnections.Opened;
        var access = connection is not null ? "connection" : ctx.GetRouteValue("link") is not null ? "link" : "token";
        const string privacy = "Structure and configuration only: no learner progress, answers, statistics or personal data are part of any snapshot or of this overview. Areas outside this access never appear — not even their names; a parent shown here is the nearest authorized one.";
        var manage = connection is not null ? AiMcp.ManageUrl(config) : null;
        var note = connection is not null
            ? "This is a managed connection: the user adds, renews or removes areas in Recreatio (manageUrl) and they change here at the next call, without reconnecting."
            : "This access is a fixed list of links (made before managed connections, or a link in the address): to read more areas, the user reconnects once — the new connection can then be extended in Recreatio without reconnecting.";
        if (secrets.Count == 0)
            return new AccessOverview(access, connection?.Expires.ToString("O"), manage, [], [], privacy, note + " No area is authorized right now.");

        using var o = await OpenAsync(http, db, config, cancellationToken);

        /* Die Links: Bereich, Frist, ob sie dem ganzen Bereich folgen, ihre Zbiory. */
        var links = new List<(Guid Access, Guid Area, string Name, DateTimeOffset Expires, bool Whole)>();
        var libraries = new Dictionary<Guid, (Guid Area, string Kind)>();
        await using var sql = await db.OpenAsync(cancellationToken);
        var hasWhole = await AiAccess.HasWholeAreaAsync(sql, null, cancellationToken);
        foreach (var secret in secrets)
        {
            await using (var cmd = new SqlCommand($"""
                SELECT a.id, a.area_id, ar.name, a.expires_at, {(hasWhole ? "a.whole_area" : "CAST(0 AS bit)")}
                FROM app.ai_access a JOIN app.area ar ON ar.id = a.area_id WHERE a.token_sha256 = @hash;
                """, sql))
            {
                cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
                await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
                if (await reader.ReadAsync(cancellationToken))
                    links.Add((reader.GetGuid(0), reader.GetGuid(1), reader.IsDBNull(2) ? "" : reader.GetString(2), reader.GetDateTimeOffset(3), reader.GetBoolean(4)));
            }
        }
        foreach (var link in links)
        {
            await using var cmd = new SqlCommand("""
                SELECT p.library_id, l.kind FROM app.ai_access_part p JOIN app.library l ON l.id = p.library_id AND l.area_id = @area WHERE p.access_id = @id;
                """, sql);
            cmd.Parameters.AddWithValue("@id", link.Access);
            cmd.Parameters.AddWithValue("@area", link.Area);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) libraries.TryAdd(reader.GetGuid(0), (link.Area, reader.GetString(1)));
        }

        /* Die Ketten nach oben — nur, um den nächsten freigegebenen Vorfahren zu finden. */
        var chains = new Dictionary<Guid, IReadOnlyList<Guid>>();
        foreach (var area in links.Select(l => l.Area).Distinct())
        {
            var chain = new List<Guid>();
            await using var cmd = new SqlCommand("""
                WITH up AS (
                    SELECT id, parent_area_id, 0 AS d FROM app.area WHERE id = @area
                    UNION ALL
                    SELECT a.id, a.parent_area_id, up.d + 1 FROM app.area a JOIN up ON a.id = up.parent_area_id WHERE up.d < 40)
                SELECT id FROM up WHERE d > 0 ORDER BY d;
                """, sql);
            cmd.Parameters.AddWithValue("@area", area);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) chain.Add(reader.GetGuid(0));
            chains[area] = chain;
        }
        var tree = TreeOf(chains);

        AccessCollection CollectionOf(Guid library, string kind)
        {
            if (o.Parts.FirstOrDefault(p => p.LibraryId == library) is AiAccess.Snapshot p)
            {
                var worlds = p.Part == "knowledge"
                    ? AiAccess.WorldsOf(p).Select(w => new CollectionRelation("linksToBase", w.Handle, Ids.ToText(w.Id), w.Name, o.Parts.Any(x => x.LibraryId == w.Id))).ToList()
                    : [];
                return new AccessCollection(Ids.ToText(library), p.Name, p.Part, AiAccess.PartLabel(p.Part), true, p.Items.Count, p.MadeAt, p.Current,
                    p.Part == "knowledge" ? p.Handle : null, worlds);
            }
            return new AccessCollection(Ids.ToText(library), AiAccess.PartLabel(kind), kind, AiAccess.PartLabel(kind), false, 0, null, null, null, []);
        }

        var areas = links.GroupBy(l => l.Area).Select(g =>
        {
            var node = tree[g.Key];
            var first = g.OrderByDescending(l => l.Expires).First();
            return new AccessArea(Ids.ToText(g.Key), first.Name, node.Parent is Guid parent ? Ids.ToText(parent) : null, node.Depth,
                node.Children.Select(Ids.ToText).ToList(), first.Expires.ToString("O"), g.Any(l => l.Whole), ReadOnlyPermissions,
                libraries.Where(l => l.Value.Area == g.Key).Select(l => CollectionOf(l.Key, l.Value.Kind))
                    .OrderBy(c => c.Part switch { "books" => 0, "writing" => 1, _ => 2 }).ThenBy(c => c.Name, StringComparer.CurrentCultureIgnoreCase).ToList());
        }).OrderBy(a => a.Depth).ThenBy(a => a.Name, StringComparer.CurrentCultureIgnoreCase).ToList();

        return new AccessOverview(access, connection?.Expires.ToString("O"), manage,
            areas.Where(a => a.ParentAreaId is null).Select(a => a.AreaId).ToList(), areas, privacy, note);
    }
}
