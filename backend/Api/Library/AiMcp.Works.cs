using System.ComponentModel;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kernel;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// DAS WERK ÜBER MCP (2026-11-15, documentation/WORK.md). Ein Projekt des Skryptorium kann ein Werk sein, gebaut vom
/// Ganzen bis zur kleinsten Einheit: Knoten mit Zweck, Rolle, Ziel, Dimensionen und Wegen, ein Regelbuch, Vorlagen, das
/// Wissen des Werks (Cogita) und das Register der Vorkommen. Der Browser rechnet das alles mit DEMSELBEN Code wie die
/// App (<c>scriptorium/work/workBrief.ts</c>) in die Abschrift (<c>works</c>); hier wird nur gelesen und gefiltert —
/// keine Prüfung läuft ein zweites Mal, die Befunde sind die der App.
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record WorkPathSummary(string Key, string Name, JsonObject Choose, int Nodes, int Must, int Should, int Info);
    public sealed record WorkBriefingResult(
        string CollectionId, string Collection, string ProjectId, string Title, string? Url, string? SnapshotMadeAt, bool SnapshotCurrent,
        JsonObject Work, IReadOnlyList<WorkPathSummary> Paths, string Path, JsonArray Findings, int FindingsTotal, string Note);
    public sealed record WorkContextResult(
        string ProjectId, string Path, string NodeId, string? Number, int? Position, bool OnPath, JsonObject Node,
        JsonArray Chain, JsonObject? Previous, JsonObject? Next, JsonArray Cells, JsonArray Introduced, JsonArray Deliver,
        JsonArray Rules, JsonArray Phases, JsonArray Findings, string? Text, string? TextUrl, string Note);
    public sealed record WorkChecksPath(string Key, string Name, int Must, int Should, int Info, JsonArray Findings);
    public sealed record WorkChecksResult(string ProjectId, string Title, IReadOnlyList<WorkChecksPath> Paths, string Note);

    /// <summary>Ein Werk einer Abschrift: sein Skryptorium und sein Dokument.</summary>
    public sealed record WorkAt(AiAccess.Snapshot From, JsonObject Brief);

    private const int MaxBriefFindings = 60;

    /* -- Werkzeuge ----------------------------------------------------------------------------- */

    [McpServerTool(Name = "get_work_briefing", Title = "Dzieło — odprawa", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("The whole briefing of a work (a Scriptorium project built from the whole down to its smallest unit): the rulebook with the reasons (rules: rule, why, weight must/should, scope — node subtree, role, template, dimension value, entity —, good/bad examples, automatic check), the structure tree (nodes with parent, order, depth, level name, title, purpose, key thought = synopsis, role and what it brings, target words/minutes, status, words written, split by a dimension / variant, text id, marks of the concepts occurring there: entity + role intro/def/ex/use/recall), dimensions and paths (editions: one value per dimension), unit templates, the knowledge of the work (persons, places, terms with definition, usage, preferred and forbidden forms, requirements, phases valid from/until a node), plus per path the number of findings and the first findings of the chosen path. Find a project by id, key or title; empty when only one work is shared. Then use get_work_context for one node and get_work_checks for all findings.")]
    public static async Task<WorkBriefingResult> GetWorkBriefing(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Project id, key or title; empty when only one work is shared.")] string? project = null,
        [Description("Path (edition) key or name; empty: the first.")] string? path = null,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        return BriefingOf(o, project, path);
    }

    [McpServerTool(Name = "get_work_context", Title = "Dzieło — kontekst węzła", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Everything a writer needs at one node of a work on one path (edition) — exactly what the app shows beside the editor: the node (purpose, role, key thought, target, words), its chain of parents, the key thoughts of the previous and next node, the neighbouring cells in the dimensions (the same chapter for another audience), everything already introduced on this path before it (with where it was introduced and whether it is defined — use only these freely), what this node must introduce or define (also below it), the rules in scope with their reasons, the phases of persons/places valid here (their description at this point), the open findings at this node, and its text rendered. Node by id, key, its number on the path (\"2.3\") or title.")]
    public static async Task<WorkContextResult> GetWorkContext(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Project id, key or title; empty when only one work is shared.")] string? project,
        [Description("Node id, key, number on the path (e.g. \"2.3\") or title.")] string node,
        [Description("Path (edition) key or name; empty: the first.")] string? path = null,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        return ContextOf(o, project, node, path);
    }

    [McpServerTool(Name = "get_work_checks", Title = "Dzieło — kontrola", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("The check report of a work, exactly as the app computes it (one implementation): per path (edition) every finding with code, weight (must / should / info), node, entity, rule, message, why it is a problem and what would fix it. Checks: used before introduced / never introduced / only introduced in another edition, introduced but never used, introduced twice, a prerequisite introduced later, no definition or example where a rule requires it, a person or place used where none of its phases is valid, a forbidden synonym or wrong form of a glossary term, a \"new\" node that introduces nothing, a summary that introduces something or recalls what was never introduced, length far from the target, no purpose or role, a gap in the dimension table, a changed template or missing template parts, machine-checkable rules (sentence length, word limits, forbidden/required words, exactly one new thing), unresolved citations, quotes that differ from the Library's full text. Filter by path and node. After writing, call it again (the snapshot is rebuilt after the user's import) to self-check.")]
    public static async Task<WorkChecksResult> GetWorkChecks(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Project id, key or title; empty when only one work is shared.")] string? project = null,
        [Description("Path (edition) key or name; empty: all paths.")] string? path = null,
        [Description("Only findings at this node (id, key, number on the path or title).")] string? node = null,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        return ChecksOf(o, project, path, node);
    }

    /* -- Kerne (ohne Link prüfbar) ------------------------------------------------------------------ */

    /// <summary>Alle Werke der Abschriften dieses Zugangs.</summary>
    public static List<WorkAt> WorksIn(IEnumerable<AiAccess.Snapshot> parts)
    {
        var out_ = new List<WorkAt>();
        foreach (var p in parts)
        {
            if (p.Works.ValueKind != JsonValueKind.Array) continue;
            foreach (var w in p.Works.EnumerateArray())
                if (w.ValueKind == JsonValueKind.Object && JsonNode.Parse(w.GetRawText()) is JsonObject brief && S(brief, "project") is not null) out_.Add(new WorkAt(p, brief));
        }
        return out_;
    }

    /// <summary>Ein Werk nach Kennung, Schlüssel oder Titel.</summary>
    public static WorkAt FindWork(IEnumerable<AiAccess.Snapshot> parts, string? project)
    {
        var all = WorksIn(parts);
        if (all.Count == 0) throw new McpException("not_found: among the shared collections there is no work (a Scriptorium project with structure nodes) — or its Scriptorium's snapshot was built before works existed; it is rebuilt when someone who writes there opens Recreatio.");
        if (string.IsNullOrWhiteSpace(project))
        {
            if (all.Count == 1) return all[0];
            throw new McpException($"ambiguous: several works are shared — give project: {string.Join(", ", all.Select(w => $"„{S(w.Brief, "title")}” ({S(w.Brief, "project")})"))}.");
        }
        var wanted = project.Trim().TrimStart('@');
        var hits = all.Where(w => string.Equals(S(w.Brief, "project"), wanted, StringComparison.OrdinalIgnoreCase)
            || string.Equals(S(w.Brief, "key"), wanted, StringComparison.OrdinalIgnoreCase)).ToList();
        if (hits.Count == 0) hits = all.Where(w => AiAccess.Fold(S(w.Brief, "title")) == AiAccess.Fold(wanted)).ToList();
        if (hits.Count == 0) hits = all.Where(w => AiAccess.Fold(S(w.Brief, "title")).Contains(AiAccess.Fold(wanted), StringComparison.Ordinal)).ToList();
        if (hits.Count == 1) return hits[0];
        if (hits.Count == 0) throw new McpException($"not_found: no shared work „{project}”. Works: {string.Join(", ", all.Select(w => $"„{S(w.Brief, "title")}” ({S(w.Brief, "project")})"))}.");
        throw new McpException($"ambiguous: several works match „{project}”: {string.Join(", ", hits.Select(w => $"„{S(w.Brief, "title")}” ({S(w.Brief, "project")})"))}.");
    }

    private static JsonArray Arr(JsonObject o, string key) => o[key] as JsonArray ?? [];
    private static string? S(JsonObject? o, string key) => o?[key] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
    private static int? I(JsonObject? o, string key) => o?[key] is JsonValue v && v.TryGetValue<double>(out var d) ? (int)d : null;
    private static JsonObject Clone(JsonNode? n) => n is JsonObject o ? (JsonObject)o.DeepClone() : [];

    /// <summary>Ein Weg nach Schlüssel oder Name (leer: der erste).</summary>
    private static JsonObject PathOf(JsonObject brief, string? path)
    {
        var paths = Arr(brief, "paths").OfType<JsonObject>().ToList();
        if (paths.Count == 0) throw new McpException("not_ready: this work has no computed paths in the snapshot.");
        if (string.IsNullOrWhiteSpace(path)) return paths[0];
        var wanted = path.Trim();
        return paths.FirstOrDefault(p => string.Equals(S(p, "key"), wanted, StringComparison.OrdinalIgnoreCase))
            ?? paths.FirstOrDefault(p => AiAccess.Fold(S(p, "name")) == AiAccess.Fold(wanted))
            ?? throw new McpException($"not_found: no path „{path}”. Paths: {string.Join(", ", paths.Select(p => $"{S(p, "key")} ({S(p, "name")})"))}.");
    }

    private static (int Must, int Should, int Info) Counts(JsonArray findings)
    {
        int must = 0, should = 0, info = 0;
        foreach (var f in findings.OfType<JsonObject>())
            switch (S(f, "weight")) { case "must": must++; break; case "should": should++; break; default: info++; break; }
        return (must, should, info);
    }

    private static string Note(AiAccess.Snapshot from) => from.Current
        ? $"Computed in the browser by the same code the app uses (snapshot of {from.MadeAt})."
        : $"STALE SNAPSHOT: the Scriptorium changed after {from.MadeAt} (ChangedAt {from.ChangedAt}); what you read is the earlier state. It is rebuilt when someone who writes there has Recreatio open.";

    /// <summary>Der Kern von <c>get_work_briefing</c>.</summary>
    public static WorkBriefingResult BriefingOf(AiAccess.Opened o, string? project, string? path)
    {
        var w = FindWork(o.Parts, project);
        var chosen = PathOf(w.Brief, path);
        var work = Clone(w.Brief);
        work.Remove("paths");
        var summaries = Arr(w.Brief, "paths").OfType<JsonObject>().Select(p =>
        {
            var (must, should, info) = Counts(Arr(p, "findings"));
            return new WorkPathSummary(S(p, "key") ?? "", S(p, "name") ?? "", Clone(p["choose"]), Arr(p, "order").Count, must, should, info);
        }).ToList();
        var findings = Arr(chosen, "findings");
        var first = new JsonArray(findings.Take(MaxBriefFindings).Select(f => (JsonNode?)f!.DeepClone()).ToArray());
        var projectId = S(w.Brief, "project")!;
        var item = o.Get(projectId);
        return new WorkBriefingResult(Ids.ToText(w.From.LibraryId), w.From.Name, projectId, S(w.Brief, "title") ?? "", item is null ? null : o.Url(item),
            w.From.MadeAt, w.From.Current, work, summaries, S(chosen, "key") ?? "", first, findings.Count,
            $"{Note(w.From)} Findings shown: the first {first.Count} of {findings.Count} on path „{S(chosen, "name") ?? S(chosen, "key")}” (all: get_work_checks). Node context: get_work_context.");
    }

    /// <summary>Ein Knoten nach Kennung, Schlüssel, Nummer auf dem Weg oder Titel.</summary>
    private static JsonObject NodeOf(JsonObject brief, JsonObject path, string node)
    {
        var nodes = Arr(brief, "nodes").OfType<JsonObject>().ToList();
        var wanted = node.Trim().TrimStart('@');
        var hit = nodes.FirstOrDefault(n => string.Equals(S(n, "id"), wanted, StringComparison.OrdinalIgnoreCase))
            ?? nodes.FirstOrDefault(n => string.Equals(S(n, "key"), wanted, StringComparison.OrdinalIgnoreCase));
        if (hit is null)
        {
            var numbers = Arr(path, "numbers").Select(x => x?.GetValue<string>()).ToList();
            var at = numbers.IndexOf(wanted.TrimEnd('.'));
            if (at >= 0 && Arr(path, "order")[at]?.GetValue<string>() is string id) hit = nodes.FirstOrDefault(n => S(n, "id") == id);
        }
        if (hit is null)
        {
            var titled = nodes.Where(n => AiAccess.Fold(S(n, "title")) == AiAccess.Fold(wanted)).ToList();
            if (titled.Count > 1) throw new McpException($"ambiguous: several nodes are called „{node}” — give the id or number: {string.Join(", ", titled.Select(n => S(n, "id")))}.");
            hit = titled.FirstOrDefault();
        }
        return hit ?? throw new McpException($"not_found: no node „{node}” in this work (by id, key, number on the path or title).");
    }

    /// <summary>Der Kern von <c>get_work_context</c> — dieselbe Auswahl wie <c>workContext.ts</c>, aus dem Gerechneten.</summary>
    public static WorkContextResult ContextOf(AiAccess.Opened o, string? project, string node, string? path) => ContextOf(FindWork(o.Parts, project), node, path, o);

    public static WorkContextResult ContextOf(WorkAt w, string node, string? path, AiAccess.Opened? o)
    {
        var brief = w.Brief;
        var chosen = PathOf(brief, path);
        var target = NodeOf(brief, chosen, node);
        var id = S(target, "id")!;
        var nodes = Arr(brief, "nodes").OfType<JsonObject>().Where(n => S(n, "id") is not null).GroupBy(n => S(n, "id")!).ToDictionary(g => g.Key, g => g.First());
        var order = Arr(chosen, "order").Select(x => x?.GetValue<string>() ?? "").ToList();
        var numbers = Arr(chosen, "numbers").Select(x => x?.GetValue<string>() ?? "").ToList();
        var pos = order.IndexOf(id);
        string? NumberOf(string nid) { var i = order.IndexOf(nid); return i >= 0 && i < numbers.Count ? numbers[i] : null; }
        JsonObject Brief(JsonObject n)
        {
            var x = new JsonObject { ["id"] = S(n, "id"), ["title"] = S(n, "title") ?? "" };
            if (NumberOf(S(n, "id")!) is string num) x["number"] = num;
            if (S(n, "synopsis") is string syn) x["synopsis"] = syn;
            if (S(n, "purpose") is string pur) x["purpose"] = pur;
            if (S(n, "role") is string role) x["role"] = role;
            /* 2026-11-16 — das Urteil des Autors auch an den Nachbarn und Vorfahren (ein Kapitel „zu überarbeiten"). */
            if (S(n, "review") is string review) x["review"] = review;
            return x;
        }
        var knowledge = Arr(brief, "knowledge").OfType<JsonObject>().Where(k => S(k, "id") is not null).GroupBy(k => S(k, "id")!).ToDictionary(g => g.Key, g => g.First());
        string Label(string eid) => knowledge.TryGetValue(eid, out var k) ? S(k, "label") ?? eid : eid;
        int DepthOf(string nid) => nodes.TryGetValue(nid, out var n) ? I(n, "depth") ?? 0 : 0;

        /* Die Kette darüber. */
        var chain = new List<JsonObject>();
        var seen = new HashSet<string> { id };
        for (var up = S(target, "parent"); up is not null && nodes.TryGetValue(up, out var parent) && seen.Add(up); up = S(parent, "parent")) chain.Insert(0, Brief(parent));

        /* Davor (auf derselben Ebene, sonst der direkt davor) und danach. */
        JsonObject? previous = null, next = null;
        if (pos > 0)
        {
            var depth = DepthOf(id);
            var at = pos - 1;
            for (var i = pos - 1; i >= 0; i--) if (DepthOf(order[i]) == depth) { at = i; break; }
            if (nodes.TryGetValue(order[at], out var p)) previous = Brief(p);
        }
        if (pos >= 0 && pos + 1 < order.Count && nodes.TryGetValue(order[pos + 1], out var nx)) next = Brief(nx);

        /* Nachbarzellen: unter dem nächsten geteilten Knoten darüber die anderen Fassungen. */
        var cells = new JsonArray();
        var child = target;
        for (var up = S(target, "parent"); up is not null && nodes.TryGetValue(up, out var parent); up = S(parent, "parent"))
        {
            if (S(parent, "split") is string split && S(child, "variant") is string variant)
            {
                foreach (var other in nodes.Values.Where(n => S(n, "parent") == up && S(n, "variant") is string v && v != variant))
                {
                    var c = Brief(other);
                    c["dimension"] = split;
                    c["value"] = S(other, "variant");
                    cells.Add(c);
                }
                break;
            }
            child = parent;
            if (cells.Count > 0) break;
        }

        /* Bis hierher eingeführt: aus den ersten Einführungen des Weges. */
        var introduced = new JsonArray();
        var defined = new HashSet<string>();
        if (pos >= 0)
        {
            foreach (var nid in order.Take(pos))
                if (nodes.TryGetValue(nid, out var n))
                    foreach (var m in Arr(n, "marks").OfType<JsonObject>()) if (S(m, "role") == "def" && S(m, "entity") is string e) defined.Add(e);
            if (chosen["firstIntro"] is JsonObject first)
            {
                foreach (var (entity, at) in first.OrderBy(kv => Label(kv.Key), StringComparer.CurrentCultureIgnoreCase))
                {
                    var where = at?.GetValue<string>();
                    var i = where is null ? -1 : order.IndexOf(where);
                    if (i < 0 || i >= pos) continue;
                    introduced.Add(new JsonObject
                    {
                        ["entity"] = entity, ["label"] = Label(entity),
                        ["kind"] = knowledge.TryGetValue(entity, out var k) ? S(k, "kind") : null,
                        ["at"] = nodes.TryGetValue(where!, out var an) ? $"{NumberOf(where!)} {S(an, "title")}".Trim() : where,
                        ["defined"] = defined.Contains(entity)
                    });
                }
            }
        }

        /* Was hier (und darunter) einzuführen oder zu definieren ist. */
        var deliver = new JsonArray();
        var below = new List<string> { id };
        if (pos >= 0) for (var i = pos + 1; i < order.Count && DepthOf(order[i]) > DepthOf(id); i++) below.Add(order[i]);
        var delivered = new HashSet<string>();
        foreach (var nid in below)
            if (nodes.TryGetValue(nid, out var n))
                foreach (var m in Arr(n, "marks").OfType<JsonObject>())
                    if (S(m, "role") is "intro" or "def" && S(m, "entity") is string e && delivered.Add($"{e}:{S(m, "role")}"))
                        deliver.Add(new JsonObject { ["entity"] = e, ["label"] = Label(e), ["role"] = S(m, "role"), ["node"] = nid == id ? null : nid });

        /* Regeln: überall auf dem Weg + hier dazu. */
        var ctx = chosen["context"] is JsonObject all && all[id] is JsonObject here ? here : null;
        var ruleIds = Arr(chosen, "rulesEverywhere").Select(x => x?.GetValue<string>()).Concat(ctx is null ? [] : Arr(ctx, "rules").Select(x => x?.GetValue<string>())).OfType<string>().Distinct().ToList();
        var rulesById = Arr(brief, "rules").OfType<JsonObject>().Where(r => S(r, "id") is not null).GroupBy(r => S(r, "id")!).ToDictionary(g => g.Key, g => g.First());
        var rules = new JsonArray(ruleIds.Where(rulesById.ContainsKey).Select(r => (JsonNode?)rulesById[r].DeepClone()).ToArray());

        /* Phasen, die hier gelten. */
        var phases = new JsonArray();
        if (ctx is not null)
        {
            var wantedPhases = Arr(ctx, "phases").Select(x => x?.GetValue<string>()).OfType<string>().ToHashSet();
            foreach (var k in knowledge.Values)
                foreach (var ph in Arr(k, "phases").OfType<JsonObject>())
                    if (S(ph, "id") is string pid && wantedPhases.Contains(pid))
                        phases.Add(new JsonObject { ["entity"] = S(k, "id"), ["label"] = S(k, "label"), ["phase"] = pid, ["phaseLabel"] = S(ph, "label"), ["description"] = S(ph, "description") });
        }

        var findings = new JsonArray(Arr(chosen, "findings").OfType<JsonObject>().Where(f => S(f, "node") == id).Select(f => (JsonNode?)f.DeepClone()).ToArray());

        string? text = null, textUrl = null;
        if (o is not null && S(target, "text") is string tid && o.Get(tid) is AiAccess.Item item)
        {
            text = AiAccess.Render(item, o);
            textUrl = o.Url(item);
        }
        var note = pos < 0
            ? $"This node does not lie on path „{S(chosen, "name") ?? S(chosen, "key")}” (it is a version for other readers): no position, neighbours or introduced concepts. {Note(w.From)}"
            : $"Use freely only what is listed under Introduced; introduce what is listed under Deliver; follow the Rules (weight must first). {Note(w.From)}";
        return new WorkContextResult(S(brief, "project")!, S(chosen, "key") ?? "", id, NumberOf(id), pos < 0 ? null : pos, pos >= 0, Clone(target),
            new JsonArray(chain.Select(c => (JsonNode?)c).ToArray()), previous, next, cells, introduced, deliver, rules, phases, findings, text, textUrl, note);
    }

    /// <summary>Der Kern von <c>get_work_checks</c>: die Befunde, wie sie gespeichert sind.</summary>
    public static WorkChecksResult ChecksOf(AiAccess.Opened o, string? project, string? path, string? node) => ChecksOf(FindWork(o.Parts, project), path, node);

    public static WorkChecksResult ChecksOf(WorkAt w, string? path, string? node)
    {
        var paths = string.IsNullOrWhiteSpace(path) ? Arr(w.Brief, "paths").OfType<JsonObject>().ToList() : [PathOf(w.Brief, path)];
        var list = paths.Select(p =>
        {
            var only = node is null ? null : S(NodeOf(w.Brief, p, node), "id");
            var found = new JsonArray(Arr(p, "findings").OfType<JsonObject>().Where(f => only is null || S(f, "node") == only).Select(f => (JsonNode?)f.DeepClone()).ToArray());
            var (must, should, info) = Counts(found);
            return new WorkChecksPath(S(p, "key") ?? "", S(p, "name") ?? "", must, should, info, found);
        }).ToList();
        return new WorkChecksResult(S(w.Brief, "project")!, S(w.Brief, "title") ?? "", list,
            $"{Note(w.From)} A report, never a block: weight must = a real break of „introduced before used” or a must-rule; should = worth fixing; info = concept gaps (purpose, role).");
    }
}
