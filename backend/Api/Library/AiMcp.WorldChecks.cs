using System.Collections.Concurrent;
using System.ComponentModel;
using System.Text.Json;
using Kernel;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// 2026-11-22 (Eigentümer, „Gute Welten", I2) — DIE KONTROLLE EINER WELT, nur lesend: was eine Baza wiedzy nach dem Leitfaden
/// <c>guide-good-world</c> noch braucht — je Baza, Turm und Pfad ein Befund mit Code, Gewicht (must / should / info), dem Eintrag
/// mit seinem bleibenden Namen und einem Satz, was ihn behebt. Sie blockiert nie einen Import.
///
/// <para>
/// <b>Derselbe Code wie in der App</b> (Wiedza → „Do zrobienia" → „Kontrola świata"): <c>frontend/src/app/cogita/worldChecks.ts</c>,
/// gebündelt in <c>ImportCheck.js</c> und mit Jint ausgeführt (<see cref="ImportCheck.RunWorldChecksAsync"/>) — auf der
/// Abschrift der Baza (die des Zugangs, mit ihren Uwagi). Eine Rechnung dauert bei einer grossen Welt Sekunden; das Ergebnis
/// bleibt je Abschrift und Sprache eine Weile liegen, damit Seiten (<c>offset</c>) nicht jedes Mal neu rechnen.
/// </para>
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record WorldCheckRef(string Id, string Name, string Label);
    public sealed record WorldFindingInfo(string Code, string Weight, string Message, string Fix, WorldCheckRef? Entity, WorldCheckRef? Tower, WorldCheckRef? Path, string? Step);
    public sealed record WorldCodeCount(string Code, string Weight, int Count);
    public sealed record WorldChecksResult(
        string Collection, string CollectionId, bool? SnapshotCurrent, string? MadeAt, string Note,
        int Towers, int Paths, int Questions, int Slides, int FeedbackOpen,
        int Must, int Should, int Info, IReadOnlyList<WorldCodeCount> Codes,
        int Total, int Offset, int? Next, IReadOnlyList<WorldFindingInfo> Findings, long Milliseconds, bool Cached);

    /// <summary>Höchstens so viele Befunde je Antwort (die übrigen mit <c>offset</c>).</summary>
    private const int WorldChecksMax = 300;
    private const int WorldChecksDefault = 100;
    private static readonly TimeSpan WorldChecksKeep = TimeSpan.FromMinutes(15);
    private static readonly ConcurrentDictionary<string, (DateTime At, string Json, long Ms)> WorldChecksMemo = new();
    private static readonly ConcurrentDictionary<string, Lazy<Task<ImportCheck.Outcome>>> WorldChecksRunning = new();

    private const string WorldChecksNote =
        "World checks of the guide guide-good-world (read it first: get_import_format guide-good-world): findings per base, tower and path — code, weight " +
        "(must: the app does not work as intended; should: a rule of the guide is broken; info: a suggestion), the entity with its lasting name (as an import " +
        "uses it), its tower and path, the step of the path, and how to fix it. Nothing is blocked: the owner can import anyway — treat the list as your to-do list " +
        "next to get_feedback. Codes: world.* (linear: the towers form one line like a text; oneLevel: no levels of detail; noThreads: no order across the source — no character or topic threads; dimensions: info, what the world has), question.* (flash, untaught, noTower, noFeedback, classInTower), tower.* (noCore, longestCorrect, positions), slide.long, path.* " +
        "(severalTowers, slidesInRow, questionsInRow, longClosing, noQuestions), line.ticket, fork.*, mistakeTag.*, tag.*, levels.standard, feedback.open, " +
        "flow.preview and preview.* (the import preview's own messages for the whole base), map.* (the world map's notes for authors). The data is the base's " +
        "AI snapshot (rebuilt 45 s after a change while someone who writes there has a tab open, and right after an import) — when SnapshotCurrent is false, " +
        "run it again after the owner opens the base. Filter with weight, code (exact or a prefix such as \"tower.\"), entity; page with offset.";

    [McpServerTool(Name = "get_world_checks", Title = "Kontrola świata", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Check a knowledge base (a Cogita world) against the guide for good worlds (guide-good-world) — exactly as the app computes it (one implementation): every finding with code, weight (must / should / info), the entity with its lasting name, its tower and path (and step), the message and a fix hint. Checks: first whether the world is many-dimensional, not a text (world.linear, world.oneLevel, world.noThreads, and world.dimensions as info — levels of detail, blocks, deepenings, overviews, question paths, tags across parts, joining towers), flash questions (the app must grade every question), questions no slide teaches in their prerequisite chain, questions belonging to no tower, one/many options without feedback, towers without a key question (core), class questions (votes, predictions: 'use': 'lesson' or asked as 'predict') that sit in a tower instead of only in teaching paths, help after a wrong answer that shows a slide of the main path again (import warning repeatsMain), the correct option longest in more than 30 % of a tower's choice questions or always at the same position, slides over ~130 words, paths through more than one tower, more than 3 slides or 2 questions in a row outside the closing block, closing blocks over 4 questions, line tickets requiring more than the first tower, fork labels over 32 / hints over 100 characters, error tags without help in the path, map tags and error tags used once or nearly duplicated, conquest levels different from the recommended standard (info), open feedback items, plus the import preview's messages for the whole base and the world map's notes for authors. Never blocks anything. Run it before you start improving a world and again after the owner's import.")]
    public static async Task<WorldChecksResult> GetWorldChecks(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Knowledge base id, name or handle; empty when only one knowledge base is authorized.")] string? collection = null,
        [Description("Only these weights: must, should, info (comma-separated).")] string? weight = null,
        [Description("Only this code (exact, e.g. tower.noCore) or codes starting with it (e.g. \"tower.\").")] string? code = null,
        [Description("Only findings about this entity, tower or path: its id, lasting name (\"@…\") or a part of its label.")] string? entity = null,
        [Description("Skip so many findings (paging; the result says the next offset).")] int offset = 0,
        [Description("At most so many findings (default 100, at most 300).")] int limit = WorldChecksDefault,
        [Description("Language of the messages: pl (default), en or de.")] string? language = null,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var p = KnowledgeBaseFor(o, collection)
            ?? throw new McpException("not_found: no knowledge base given — several (or none) are authorized. Give collection (see list_collections).");
        var lang = ImportCheck.LanguageOf(language);
        var key = $"{Ids.ToText(p.LibraryId)}|{p.MadeAt}|{lang}";
        var cached = WorldChecksMemo.TryGetValue(key, out var had) && DateTime.UtcNow - had.At < WorldChecksKeep;
        string json;
        long ms;
        if (cached) { json = had.Json; ms = had.Ms; }
        else
        {
            ImportCheck.Outcome outcome;
            /* 2026-11-22 — dieselbe Abschrift in derselben Sprache rechnet nur EINMAL zugleich: wer währenddessen fragt, wartet auf
               dieselbe Rechnung (sonst legt jede gleichzeitige Anfrage ihre eigene Maschine mit der ganzen Baza in den Speicher). */
            var run = WorldChecksRunning.GetOrAdd(key, k => new Lazy<Task<ImportCheck.Outcome>>(async () =>
            {
                try { return await ImportCheck.RunWorldChecksAsync(ImportCheck.BaseJsonOf(p), lang, CancellationToken.None); }
                finally { WorldChecksRunning.TryRemove(k, out var _); }
            }));
            try
            {
                outcome = await run.Value.WaitAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (ImportCheck.BusyException busy) { throw new McpException(busy.Message); }
            catch (Exception e) when (e is not McpException)
            {
                throw new McpException($"check_failed: the world check did not run ({e.GetType().Name}: {e.Message}).");
            }
            json = outcome.Json;
            ms = outcome.Milliseconds;
            foreach (var old in WorldChecksMemo.Where(kv => DateTime.UtcNow - kv.Value.At >= WorldChecksKeep).Select(kv => kv.Key).ToList()) WorldChecksMemo.TryRemove(old, out _);
            if (WorldChecksMemo.Count > 32) WorldChecksMemo.Clear();
            WorldChecksMemo[key] = (DateTime.UtcNow, json, ms);
        }
        return WorldChecksOf(json, p.Name, Ids.ToText(p.LibraryId), p.Current, p.MadeAt, weight, code, entity, offset, limit, ms, cached);
    }

    /// <summary>Der Kern von <c>get_world_checks</c> — aus dem JSON des Skripts, ohne Link prüfbar (<c>Api.Tests</c>).</summary>
    public static WorldChecksResult WorldChecksOf(string json, string collection, string collectionId, bool? current, string? madeAt,
        string? weight = null, string? code = null, string? entity = null, int offset = 0, int limit = WorldChecksDefault, long ms = 0, bool cached = false)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        static string S(JsonElement e, string name) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
        static int N(JsonElement e, string name) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.TryGetInt32(out var n) ? n : 0;
        static WorldCheckRef? R(JsonElement f, string name) =>
            f.TryGetProperty(name, out var r) && r.ValueKind == JsonValueKind.Object ? new WorldCheckRef(S(r, "id"), S(r, "name"), S(r, "label")) : null;
        var all = new List<WorldFindingInfo>();
        if (root.TryGetProperty("findings", out var list) && list.ValueKind == JsonValueKind.Array)
            foreach (var f in list.EnumerateArray())
                all.Add(new WorldFindingInfo(S(f, "code"), S(f, "weight"), S(f, "message"), S(f, "fix"), R(f, "entity"), R(f, "tower"), R(f, "path"), S(f, "step") is { Length: > 0 } step ? step : null));

        var weights = (weight ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(w => w.ToLowerInvariant()).ToHashSet();
        var wantCode = (code ?? "").Trim();
        var wantEntity = (entity ?? "").Trim();
        bool Hits(WorldCheckRef? r) => r is not null && (string.Equals(r.Id, wantEntity, StringComparison.OrdinalIgnoreCase)
            || string.Equals(r.Name, wantEntity, StringComparison.OrdinalIgnoreCase) || string.Equals(r.Name, "@" + wantEntity.TrimStart('@'), StringComparison.OrdinalIgnoreCase)
            || (wantEntity.Length >= 3 && AiAccess.Fold(r.Label).Contains(AiAccess.Fold(wantEntity), StringComparison.Ordinal)));
        var chosen = all.Where(f => (weights.Count == 0 || weights.Contains(f.Weight))
            && (wantCode.Length == 0 || string.Equals(f.Code, wantCode, StringComparison.OrdinalIgnoreCase) || (wantCode.EndsWith('.') && f.Code.StartsWith(wantCode, StringComparison.OrdinalIgnoreCase)) || f.Code.StartsWith(wantCode + ".", StringComparison.OrdinalIgnoreCase))
            && (wantEntity.Length == 0 || Hits(f.Entity) || Hits(f.Tower) || Hits(f.Path))).ToList();

        var skip = Math.Max(0, offset);
        var take = Math.Clamp(limit <= 0 ? WorldChecksDefault : limit, 1, WorldChecksMax);
        var page = chosen.Skip(skip).Take(take).ToList();
        var next = skip + page.Count < chosen.Count ? skip + page.Count : (int?)null;
        var codes = all.GroupBy(f => (f.Code, f.Weight)).Select(g => new WorldCodeCount(g.Key.Code, g.Key.Weight, g.Count())).ToList();
        root.TryGetProperty("size", out var size);
        var note = WorldChecksNote + (current == false ? " STALE SNAPSHOT: the knowledge base changed after its AI snapshot was made — the findings may miss the newest changes." : "");
        return new WorldChecksResult(collection, collectionId, current, madeAt, note,
            N(size, "towers"), N(size, "paths"), N(size, "questions"), N(size, "slides"), N(size, "feedbackOpen"),
            all.Count(f => f.Weight == "must"), all.Count(f => f.Weight == "should"), all.Count(f => f.Weight == "info"), codes,
            chosen.Count, skip, next, page, ms, cached);
    }
}
