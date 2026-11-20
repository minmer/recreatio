using System.ComponentModel;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kernel;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// 2026-11-20 (Eigentümer: „Kommentare an Folien, Fragen und Karten — mit Arten und einem Text —, die die KI über MCP liest und beim
/// nächsten Update der Welt nutzt") — RÜCKMELDUNGEN DER LERNENDEN UND PRÜFENDEN, nur lesend.
///
/// <para>
/// Die Baza trägt sie als Dokumente <c>feedback</c> (<c>frontend/src/app/cogita/feedback.ts</c>); der Browser legt sie in die
/// Abschrift der Baza (<c>setup.feedback</c>) — mit den bleibenden Namen (<c>@…</c>), wie ein Import sie benutzt. Kein Name eines
/// Menschen, keine Kennung eines Kontos: nur, was über den Inhalt gesagt wurde.
/// </para>
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record FeedbackCollection(string Id, string Name, int Open, int Done, JsonArray Items);
    public sealed record FeedbackResult(IReadOnlyList<FeedbackCollection> Collections, int Total, string Note);

    private const string FeedbackNote =
        "Feedback left in the app on cards, questions and slides of the authorized knowledge bases, newest first, open items before done ones. " +
        "category is one of good, wrong, answer, language, unclear, hard, easy, display, other (means says it in words); target names what it is about with lasting names " +
        "(entity = the question, slide or entry as \"@name\", template = the card template, card = the card key, shownAs = how it looked). " +
        "Use it when preparing an update: fix what is wrong, keep what is marked good, and say in your report which feedback items you addressed (by id) — " +
        "the user marks them done in the app. Nothing is changed from here; the user imports the corrected JSON (get_import_format knowledge-base). " +
        "The data comes from the base's snapshot (rebuilt 45 s after a change while someone who writes there has a tab open).";

    [McpServerTool(Name = "get_feedback", Title = "Uwagi do kart i slajdów", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Feedback that people left in the app on cards, questions and slides of the authorized knowledge bases (Cogita): category (good, wrong, answer, language, unclear, hard, easy, display, other), the comment, when, open or done, and what it is about with lasting names (entity \"@name\", template \"@name\", card key). Read it before updating a course to fix what users reported and keep what they marked good.")]
    public static async Task<FeedbackResult> GetFeedback(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Optional knowledge base id, name or handle — only its feedback.")] string? collection = null,
        [Description("Optional: open (default), done or all.")] string state = "open",
        [Description("Optional category filter: good, wrong, answer, language, unclear, hard, easy, display, other.")] string? category = null,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var bases = o.Parts.Where(p => p.Part == "knowledge").ToList();
        if (!string.IsNullOrWhiteSpace(collection))
        {
            var wanted = collection.Trim();
            bases = bases.Where(x => string.Equals(Ids.ToText(x.LibraryId), wanted, StringComparison.OrdinalIgnoreCase) || AiAccess.Fold(x.Name) == AiAccess.Fold(wanted)
                || (x.Handle is string h && wanted.TrimStart('@').ToLowerInvariant() == h)).ToList();
            if (bases.Count == 0) throw new McpException($"not_found: no authorized knowledge base „{collection}”. See list_collections.");
        }
        return FeedbackOf(bases, state, category);
    }

    /// <summary>Der Kern von <c>get_feedback</c> — ohne Link prüfbar.</summary>
    public static FeedbackResult FeedbackOf(IEnumerable<AiAccess.Snapshot> bases, string state = "open", string? category = null)
    {
        var want = (state ?? "open").Trim().ToLowerInvariant();
        var cat = string.IsNullOrWhiteSpace(category) ? null : category.Trim().ToLowerInvariant();
        var list = new List<FeedbackCollection>();
        var total = 0;
        foreach (var p in bases)
        {
            if (p.Setup.ValueKind != JsonValueKind.Object || !p.Setup.TryGetProperty("feedback", out var fb) || fb.ValueKind != JsonValueKind.Array) continue;
            var all = JsonNode.Parse(fb.GetRawText())!.AsArray();
            Scrub(all);
            var open = all.Count(x => x?["state"]?.GetValue<string>() != "done");
            var items = new JsonArray();
            foreach (var x in all)
            {
                if (x is not JsonObject item) continue;
                var s = item["state"]?.GetValue<string>() == "done" ? "done" : "open";
                if (want != "all" && s != want) continue;
                if (cat is not null && item["category"]?.GetValue<string>() != cat) continue;
                items.Add(item.DeepClone());
            }
            total += items.Count;
            list.Add(new FeedbackCollection(Ids.ToText(p.LibraryId), p.Name, open, all.Count - open, items));
        }
        return new FeedbackResult(list, total, FeedbackNote);
    }
}
