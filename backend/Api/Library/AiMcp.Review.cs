using System.ComponentModel;
using System.Text.Json.Nodes;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// 2026-11-16 — DIE DURCHSICHT EINES WERKS FÜR DIE KI. Der Autor liest eine Struktur (oft aus einer KI) im Gang des Werks
/// und sagt je Knoten: angenommen, zu überarbeiten, zu streichen — mit Notizen an die KI, als Gespräch, zum ganzen
/// Knoten oder zu einem Akapit. Das steht in der Abschrift jedes Knotens (<c>review</c>, <c>thread</c>); hier liest die KI
/// es gesammelt, in Lesereihenfolge, bevor sie den endgültigen Text schreibt. Antworten gehen über den Import zurück
/// (Notizen mit "by": "ai" — ein Import ergänzt das Gespräch, er ersetzt es nicht).
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record WorkReviewNode(string Id, string? Number, string Title, string? Level, string Review, string? Synopsis, string? Purpose, JsonArray Notes, int OpenNotes);
    public sealed record WorkReviewResult(string ProjectId, string Title, string Path, JsonObject Summary, IReadOnlyList<WorkReviewNode> Nodes, int Total, string Note);

    [McpServerTool(Name = "get_work_review", Title = "Dzieło — przegląd autora", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("The author's review of a work's structure, in reading order: per node the verdict (review: accepted = keep as it is; revise = rework it following the notes; remove = do not write it; empty = not reviewed yet) and the conversation with the author (notes: id, by author|ai, text, at, reply = the note it answers, para = the paragraph of the node's text it is about, 1-based, done = settled). Read it before writing or rewriting: follow every open author note, never write nodes marked remove, keep accepted ones. Answer notes in the import (format \"scriptorium\", the node's \"thread\" with your notes only, \"by\": \"ai\", \"reply\": the author's note id) — the import adds them to the conversation. Filter: status (accepted / revise / remove / none / notes = with open notes).")]
    public static async Task<WorkReviewResult> GetWorkReview(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Project id, key or title; empty when only one work is shared.")] string? project = null,
        [Description("Only: accepted, revise, remove, none (not reviewed) or notes (with open notes); empty: all nodes.")] string? status = null,
        [Description("Path (edition) key or name for the reading order; empty: the first.")] string? path = null,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        return ReviewOf(FindWork(o.Parts, project), status, path);
    }

    /// <summary>Der Kern von <c>get_work_review</c> — ohne Link prüfbar.</summary>
    public static WorkReviewResult ReviewOf(WorkAt w, string? status, string? path)
    {
        var chosen = PathOf(w.Brief, path);
        var order = Arr(chosen, "order").Select(x => x?.GetValue<string>() ?? "").ToList();
        var numbers = Arr(chosen, "numbers").Select(x => x?.GetValue<string>() ?? "").ToList();
        var nodes = Arr(w.Brief, "nodes").OfType<JsonObject>().Where(n => S(n, "id") is not null).ToList();
        /* In Lesereihenfolge des Weges; was nicht auf ihm liegt (eine andere Fassung), dahinter. */
        int Rank(JsonObject n) { var i = order.IndexOf(S(n, "id")!); return i < 0 ? int.MaxValue : i; }
        var wanted = (status ?? "").Trim().ToLowerInvariant();
        var list = new List<WorkReviewNode>();
        foreach (var n in nodes.OrderBy(Rank))
        {
            var review = S(n, "review") ?? "";
            var notes = Arr(n, "thread");
            var open = notes.OfType<JsonObject>().Count(x => S(x, "done") is null && !(x["done"] is JsonValue v && v.TryGetValue<bool>(out var b) && b));
            var keep = wanted switch
            {
                "" => true,
                "none" => review == "",
                "notes" => open > 0,
                _ => review == wanted
            };
            if (!keep) continue;
            var at = order.IndexOf(S(n, "id")!);
            list.Add(new WorkReviewNode(S(n, "id")!, at >= 0 && at < numbers.Count ? numbers[at] : null, S(n, "title") ?? "", S(n, "level"), review,
                S(n, "synopsis"), S(n, "purpose"), (JsonArray)notes.DeepClone(), open));
        }
        var summary = w.Brief["review"] is JsonObject r ? (JsonObject)r.DeepClone() : [];
        return new WorkReviewResult(S(w.Brief, "project")!, S(w.Brief, "title") ?? "", S(chosen, "key") ?? "", summary, list, list.Count,
            $"{Note(w.From)} Verdicts: accepted = keep; revise = rework by the notes; remove = do not write; empty = not reviewed. Open notes are instructions from the author.");
    }
}
