namespace Rc.Kernel;

/// <summary>
/// 3.14 — Der Rollengraph, und warum er kreisfrei bleiben muss.
///
/// Eine Kante sagt: <i>wer hier steht, kommt dort hin</i>. Ein Kreis sagt
/// dasselbe im Kreis herum — und weil Erreichbarkeit im Graphen zugleich
/// Schluesselerreichbarkeit ist (siehe <see cref="RcRoleKeys"/>), bedeutet ein
/// Kreis nicht bloss eine haessliche Struktur, sondern zwei Rollen, die
/// einander gegenseitig aufschliessen. Wer eine davon bekommt, bekommt beide,
/// und niemand hat das je entschieden.
///
/// Die Pruefung laeuft auf KLARTEXTFELDERN. Das ist kein Zufall: 3.14 legt den
/// strukturellen Teil einer Kante offen, damit die Zyklenpruefung ohne
/// Entschluesselung auskommt. Verschluesselt ist der Anzeigename, nicht die
/// Struktur — sonst muesste der Server zum Pruefen entschluesseln, und dann
/// koennte er es auch sonst.
///
/// <b>Diese Klasse kennt keine Datenbank.</b> Sie bekommt Kanten und antwortet.
/// Dadurch ist sie ohne SQL Server pruefbar, und die Pruefreihe kann Faelle
/// bauen, die in einer echten Datenbank herzustellen muehsam waeren.
/// </summary>
public static class RcRoleGraph
{
    /// <summary>
    /// Eine gerichtete Kante: <paramref name="From"/> erreicht
    /// <paramref name="To"/>. Widerrufene Kanten gehoeren nicht hinein — sie
    /// werden beim Laden ausgefiltert, nicht hier.
    /// </summary>
    public readonly record struct Edge(Guid From, Guid To);

    /// <summary>Wie tief gelaufen wird. 3.14 nennt keine Zahl; diese ist eine Entscheidung.</summary>
    public const int MaxDepth = 32;

    /// <summary>
    /// Alle Rollen, die von <paramref name="start"/> aus erreichbar sind,
    /// einschliesslich <paramref name="start"/> selbst.
    ///
    /// Die Tiefenbegrenzung ist kein Schutz vor Kreisen — dagegen hilft die
    /// besuchte Menge. Sie ist ein Schutz davor, dass eine sehr tiefe Hierarchie
    /// eine einzelne Anzeige unbezahlbar macht.
    /// </summary>
    public static HashSet<Guid> Reachable(Guid start, IReadOnlyCollection<Edge> edges, int maxDepth = MaxDepth)
    {
        var outgoing = Index(edges);
        var seen = new HashSet<Guid> { start };
        var frontier = new List<Guid> { start };

        for (var depth = 0; depth < maxDepth && frontier.Count > 0; depth++)
        {
            var next = new List<Guid>();
            foreach (var node in frontier)
            {
                if (!outgoing.TryGetValue(node, out var targets)) continue;
                foreach (var target in targets)
                {
                    if (seen.Add(target)) next.Add(target);
                }
            }
            frontier = next;
        }

        return seen;
    }

    /// <summary>
    /// Alle Rollen, die ein Konto ueber seine Wurzelkanten erreicht. Ein Konto
    /// haengt ueber <c>rc_role_edge.from_account_id</c> am Graphen — in aller
    /// Regel an genau einer persoenlichen Rolle.
    /// </summary>
    public static HashSet<Guid> ReachableFromAll(
        IReadOnlyCollection<Guid> starts, IReadOnlyCollection<Edge> edges, int maxDepth = MaxDepth)
    {
        var all = new HashSet<Guid>();
        foreach (var start in starts) all.UnionWith(Reachable(start, edges, maxDepth));
        return all;
    }

    /// <summary>
    /// Ob die Kante <paramref name="from"/> → <paramref name="to"/> einen Kreis
    /// schliessen wuerde.
    ///
    /// Die Frage ist nicht „gibt es irgendwo einen Kreis", sondern „entsteht
    /// hier einer" — und die laesst sich billig beantworten: ein Kreis entsteht
    /// genau dann, wenn <paramref name="from"/> von <paramref name="to"/> aus
    /// schon erreichbar ist. Eine Kante auf sich selbst zaehlt mit.
    /// </summary>
    public static bool WouldCreateCycle(Guid from, Guid to, IReadOnlyCollection<Edge> edges) =>
        from == to || Reachable(to, edges, int.MaxValue).Contains(from);

    /// <summary>
    /// Findet einen bestehenden Kreis, falls es einen gibt. Fuer die Pruefung
    /// eines geerbten Datenbestands: wenn die Kante-fuer-Kante-Pruefung je
    /// gefehlt hat, liegt der Kreis schon drin und die Kantenpruefung findet
    /// ihn nie.
    /// </summary>
    public static IReadOnlyList<Guid>? FindCycle(IReadOnlyCollection<Edge> edges)
    {
        var outgoing = Index(edges);
        var state = new Dictionary<Guid, int>(); // 0 unbesucht, 1 auf dem Pfad, 2 fertig
        var path = new List<Guid>();

        foreach (var node in outgoing.Keys)
        {
            var found = Walk(node);
            if (found is not null) return found;
        }
        return null;

        IReadOnlyList<Guid>? Walk(Guid node)
        {
            if (state.TryGetValue(node, out var s))
            {
                if (s != 1) return null;
                // Auf dem eigenen Pfad wieder angekommen: der Kreis ist das
                // Stueck des Pfades ab diesem Knoten.
                return path[path.IndexOf(node)..].Append(node).ToList();
            }

            state[node] = 1;
            path.Add(node);

            if (outgoing.TryGetValue(node, out var targets))
            {
                foreach (var target in targets)
                {
                    var found = Walk(target);
                    if (found is not null) return found;
                }
            }

            path.RemoveAt(path.Count - 1);
            state[node] = 2;
            return null;
        }
    }

    private static Dictionary<Guid, List<Guid>> Index(IReadOnlyCollection<Edge> edges)
    {
        var outgoing = new Dictionary<Guid, List<Guid>>();
        foreach (var edge in edges)
        {
            if (!outgoing.TryGetValue(edge.From, out var list))
            {
                list = [];
                outgoing[edge.From] = list;
            }
            list.Add(edge.To);
        }
        return outgoing;
    }
}

/// <summary>
/// 3.14 — Der Versuch, einen Kreis zu schliessen, ist ein Fehler mit eigenem
/// Code. Ein allgemeines „ungueltig" waere hier besonders unfreundlich: der
/// Mensch davor hat etwas Sinnvolles gewollt und muss erfahren, warum es nicht
/// geht.
/// </summary>
public sealed class RcRoleCycleException(Guid from, Guid to)
    : Exception($"Die Kante {RcId.ToText(from)} -> {RcId.ToText(to)} wuerde einen Kreis schliessen.")
{
    public Guid From { get; } = from;
    public Guid To { get; } = to;
    public string Code => RcErrorCodes.RoleCycle;
}
