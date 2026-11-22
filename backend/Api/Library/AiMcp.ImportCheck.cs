using System.Collections.Concurrent;
using System.ComponentModel;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Kernel;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// 2026-11-22 (A1) — EIN IMPORT GEPRÜFT, BEVOR DER MENSCH IHN MACHT: <c>check_import</c> führt die Vorschau der App im Dienst
/// aus (<see cref="ImportCheck"/>, dasselbe gebündelte TypeScript) und sagt, was das Dokument täte — angelegt, geändert,
/// gelöscht —, mit ALLEN Fehlern und Warnungen auf einmal, gleiche zusammengefasst. Nichts wird geschrieben. Für eine
/// Baza wiedzy gegen ihre Abschrift (die des Zugangs), sonst gegen einen leeren Stand.
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record CheckGroupInfo(string Text, int Count, IReadOnlyList<string> Examples, int ExamplesShown);
    public sealed record CheckImportResult(
        string Format, bool Ok, string Summary, string? Collection, string? CollectionId, bool? SnapshotCurrent, string? Note,
        IReadOnlyList<string> Changes, int ChangesTotal, IReadOnlyList<string> Removals, int RemovalsTotal,
        int ErrorCount, IReadOnlyList<CheckGroupInfo> Errors, int WarningCount, IReadOnlyList<CheckGroupInfo> Warnings, long Milliseconds,
        string? ImportIn = null, string? Upload = null, IReadOnlyList<int>? PartsMissing = null);

    /*
      2026-11-22 (I12) — EIN GROSSES DOKUMENT IN TEILEN: was ein Aufruf eines Werkzeugs nicht tragen kann (ein Assistent schreibt
      Argumente in begrenzter Länge), kommt als Text in Teilen (part 1…of, dieselbe upload-Kennung) und wird geprüft, sobald alle da
      sind — als EIN Dokument. Nur im Speicher, je Verbindung, eine halbe Stunde.
    */
    private sealed class UploadParts(int of)
    {
        public readonly string?[] Parts = new string?[of];
        public DateTime At = DateTime.UtcNow;
    }
    private static readonly ConcurrentDictionary<string, UploadParts> Uploads = new();
    private static readonly TimeSpan UploadKeep = TimeSpan.FromMinutes(30);
    private const int UploadMaxParts = 500;
    private const int UploadsPerCaller = 4;

    /// <summary>Wer ruft (die Geheimnisse seiner Verbindung, gehasht) — Teile verschiedener Verbindungen treffen sich nie.</summary>
    private static string CallerKey(IHttpContextAccessor http)
    {
        var secrets = http.HttpContext?.Items[AiMcp.SecretsKey] as List<string> ?? [];
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("|", secrets.Order(StringComparer.Ordinal)))))[..32];
    }

    /// <summary>
    /// Einen Teil ablegen; sind alle da, das ganze Dokument (als JSON-Text) — sonst <c>null</c> und welche fehlen. Ohne Netz prüfbar.
    /// </summary>
    public static (string? Whole, IReadOnlyList<int> Missing) TakePart(string caller, string upload, int part, int of, string text)
    {
        if (of < 2 || of > UploadMaxParts) throw new McpException($"invalid: of must be 2…{UploadMaxParts}.");
        if (part < 1 || part > of) throw new McpException($"invalid: part must be 1…{of}.");
        var id = upload.Trim();
        if (id.Length is < 1 or > 80) throw new McpException("invalid: upload (an id you choose for this document, 1–80 characters) is needed with part/of.");
        foreach (var old in Uploads.Where(kv => DateTime.UtcNow - kv.Value.At > UploadKeep).Select(kv => kv.Key).ToList()) Uploads.TryRemove(old, out _);
        var key = $"{caller}|{id}";
        if (!Uploads.ContainsKey(key) && Uploads.Keys.Count(k => k.StartsWith(caller + "|", StringComparison.Ordinal)) >= UploadsPerCaller)
            throw new McpException($"invalid: at most {UploadsPerCaller} unfinished uploads at once — finish or abandon one (they expire after 30 minutes).");
        var up = Uploads.GetOrAdd(key, _ => new UploadParts(of));
        lock (up)
        {
            if (up.Parts.Length != of) throw new McpException($"invalid: this upload was started with of = {up.Parts.Length}.");
            up.Parts[part - 1] = text;
            up.At = DateTime.UtcNow;
            var size = up.Parts.Sum(x => (long)(x?.Length ?? 0));
            if (size > ImportCheck.MaxDocument) { Uploads.TryRemove(key, out _); throw new McpException($"invalid: the parts together have more than {ImportCheck.MaxDocument} characters."); }
            var missing = Enumerable.Range(1, of).Where(i => up.Parts[i - 1] is null).ToList();
            if (missing.Count > 0) return (null, missing);
            Uploads.TryRemove(key, out _);
            return (string.Concat(up.Parts), []);
        }
    }

    /// <summary>So viele Zeilen der Änderungen und Löschungen, so viele Beispiele je Gruppe kommen mit (die Zahlen immer ganz).</summary>
    private const int CheckLines = 200;
    private const int CheckExamples = 12;

    /// <summary>Die Formate, die als Baza wiedzy geprüft werden (mit ihrer Abschrift, wenn eine genannt oder die einzige ist).</summary>
    private static bool IsKnowledgeFormat(string format)
    {
        var f = format.Trim().ToLowerInvariant();
        return f is "knowledge-base" or "knowledge-forms" || f.StartsWith("scheme-", StringComparison.Ordinal)
            || (f.StartsWith("example-", StringComparison.Ordinal) && !f.StartsWith("example-community-", StringComparison.Ordinal) && f is not ("example-world-page" or "example-story-page" or "example-liturgy"));
    }

    [McpServerTool(Name = "check_import", Title = "Sprawdź import JSON", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Check a JSON document BEFORE the user imports it — for every import format (ids from list_import_formats: knowledge-base, knowledge-forms, page, form, area, community, library, work-with-text, source-text, quotes, liturgy, scriptorium, calendar, calendar-scheme, calendar-plan, tasks, masses, bookings, registry, form-entries, contacts, roles, chat, lamps, persons, addresses, workspace-view, learn-progress; schemes and examples are checked as their format). It runs the app's own import preview on the server and returns what the import would do (changes: the preview's lines, also every changed field of an existing item; removals: every item it would delete, by name), ALL errors at once (an error blocks the import) and all warnings, identical messages grouped with a count and examples. Nothing is written. A knowledge-base document is checked against that knowledge base as its AI snapshot shows it (collection: id, name or handle; may be empty when only one knowledge base is authorized) — if SnapshotCurrent is false the base changed after the snapshot and the check may miss the newest changes; without an authorized base, or for other formats, it is checked against an empty state (the note says what was checked against). Check, fix every error, check again, then hand the document to the user. ImportIn says where in the app the user imports it — and so what they choose there (the calendar, the library, the page, the form …); the check itself assumes what the note says. A document too long for one call goes as its JSON text in parts: document = a string with one piece, part = 1…of, the same upload id; the check runs when the last part arrives (PartsMissing until then). A LARGE file (more than ~100 kB) is better sent from a shell: start_upload gives an address, POST the file there, then check_import with upload and without document.")]
    public static async Task<CheckImportResult> CheckImport(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Format id from list_import_formats, e.g. knowledge-base, page, calendar, scriptorium.")] string format,
        [Description("The JSON document to check — as a JSON object, or as a string holding the JSON text. Leave it out when the document was sent to the address of start_upload (then give upload).")] JsonElement? document = null,
        [Description("For knowledge-base / knowledge-forms: the knowledge base to check against (id, name or handle). Empty: the only authorized knowledge base, if there is exactly one; otherwise an empty base.")] string? collection = null,
        [Description("Language of the messages: pl (default), en or de.")] string? language = null,
        [Description("A long document in parts: this part's number (1…of). Send the JSON TEXT split into pieces as strings in document, every part with the same upload id; the check runs when the last missing part arrives.")] int? part = null,
        [Description("A long document in parts: how many parts there are (2…500).")] int? of = null,
        [Description("A long document in parts: an id you choose for this document (the same in every part, 1–80 characters). Or, without document and part/of: the id from start_upload whose address received the file.")] string? upload = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(format)) throw new McpException("invalid: podaj format (id z list_import_formats).");
        var importIn = ImportFormats.Find(format.Trim())?.Where;
        string documentJson;
        if (of is > 1)
        {
            if (document is not { ValueKind: JsonValueKind.String } piece) throw new McpException("invalid: in parts, document is a string with a piece of the JSON text.");
            var (whole, missing) = TakePart(CallerKey(http), upload ?? "", part ?? 0, of.Value, piece.GetString() ?? "");
            if (whole is null)
                return new CheckImportResult(format.Trim(), false, $"PART {part} of {of} stored for upload „{upload}” — waiting for {missing.Count} more part(s); nothing was checked yet.",
                    null, null, null, null, [], 0, [], 0, 0, [], 0, [], 0, importIn, upload, missing);
            documentJson = JsonSerializer.Serialize(whole);
        }
        else if (document is null or { ValueKind: JsonValueKind.Undefined or JsonValueKind.Null })
        {
            /* 2026-11-22 — die Datei kam an die Adresse von start_upload: als JSON-Text (ein String), wie ein Dokument in Teilen. */
            if (string.IsNullOrWhiteSpace(upload)) throw new McpException("invalid: give document — or, for a large file, call start_upload, send the file to its address and give upload here.");
            var text = TakeUpload(CallerKey(http), upload, out var started);
            if (text.Length == 0)
                throw new McpException(started
                    ? $"invalid: nothing has arrived yet at the address of upload „{upload}” — send the file first (POST the JSON as the body)."
                    : $"invalid: no upload „{upload}” for this connection (unknown, already checked, or expired after 30 minutes) — call start_upload again.");
            documentJson = JsonSerializer.Serialize(text);
        }
        else
        {
            documentJson = document.Value.ValueKind switch
            {
                JsonValueKind.Object or JsonValueKind.Array or JsonValueKind.String => document.Value.GetRawText(),
                _ => throw new McpException("invalid: document musi być obiektem JSON albo napisem z tekstem JSON.")
            };
        }
        if (documentJson.Length > ImportCheck.MaxDocument) throw new McpException($"invalid: dokument ma {documentJson.Length} znaków — więcej niż {ImportCheck.MaxDocument}.");

        string? baseJson = null;
        string? name = null, id = null;
        bool? current = null;
        if (IsKnowledgeFormat(format))
        {
            using var o = await OpenAsync(http, db, config, cancellationToken);
            var p = KnowledgeBaseFor(o, collection);
            if (p is not null)
            {
                baseJson = ImportCheck.BaseJsonOf(p);
                name = p.Name;
                id = Ids.ToText(p.LibraryId);
                current = p.Current;
            }
        }

        ImportCheck.Outcome outcome;
        try
        {
            outcome = await ImportCheck.RunAsync(format.Trim(), documentJson, baseJson, language ?? "pl", cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (ImportCheck.BusyException busy) { throw new McpException(busy.Message); }
        catch (Exception e) when (e is not McpException)
        {
            throw new McpException($"check_failed: sprawdzenie nie powiodło się ({e.GetType().Name}: {e.Message}). Dokument nie został zapisany.");
        }
        return CheckResultOf(outcome.Json, name, id, current, outcome.Milliseconds) with { ImportIn = importIn, Upload = of is > 1 ? upload : null };
    }

    /// <summary>Welche Baza: die genannte (Kennung, Name, Handle), sonst die einzige — oder keine (dann gegen eine leere).</summary>
    private static AiAccess.Snapshot? KnowledgeBaseFor(AiAccess.Opened o, string? collection)
    {
        var bases = o.Parts.Where(x => x.Part == "knowledge").ToList();
        if (string.IsNullOrWhiteSpace(collection)) return bases.Count == 1 ? bases[0] : null;
        var wanted = collection.Trim();
        return bases.FirstOrDefault(x => string.Equals(Ids.ToText(x.LibraryId), wanted, StringComparison.OrdinalIgnoreCase) || AiAccess.Fold(x.Name) == AiAccess.Fold(wanted)
                || (x.Handle is string h && wanted.TrimStart('@').ToLowerInvariant() == h))
            ?? throw new McpException($"not_found: wśród udostępnionych baz wiedzy nie ma „{collection}”. Zobacz list_collections.");
    }

    /// <summary>
    /// Das Ergebnis des Skripts als Antwort — ohne Link und Netz prüfbar (<c>Api.Tests</c>): die Zahlen ganz, Zeilen und
    /// Beispiele gekürzt, Fehler vor Warnungen, ein Satz vorweg.
    /// </summary>
    public static CheckImportResult CheckResultOf(string json, string? collection, string? collectionId, bool? current, long ms)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        static List<string> Strings(JsonElement e, string name) =>
            e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToList() : [];
        var changes = Strings(root, "changes");
        var removals = Strings(root, "removals");
        var errors = new List<CheckGroupInfo>();
        var warnings = new List<CheckGroupInfo>();
        int errorCount = 0, warningCount = 0;
        if (root.TryGetProperty("groups", out var groups) && groups.ValueKind == JsonValueKind.Array)
        {
            foreach (var g in groups.EnumerateArray())
            {
                var examples = Strings(g, "examples");
                var count = g.TryGetProperty("count", out var c) && c.TryGetInt32(out var n) ? n : 1;
                var info = new CheckGroupInfo(g.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "", count, examples.Take(CheckExamples).ToList(), Math.Min(examples.Count, CheckExamples));
                if (g.TryGetProperty("level", out var l) && l.GetString() == "error") { errors.Add(info); errorCount += count; }
                else { warnings.Add(info); warningCount += count; }
            }
        }
        var ok = root.TryGetProperty("ok", out var okEl) && okEl.ValueKind == JsonValueKind.True;
        var format = root.TryGetProperty("format", out var f) ? f.GetString() ?? "" : "";
        var note = root.TryGetProperty("note", out var noteEl) && noteEl.ValueKind == JsonValueKind.String ? noteEl.GetString() : null;
        if (current == false) note = $"STALE SNAPSHOT: the knowledge base changed after its AI snapshot was made — the check may miss the newest changes. {note}";
        var summary = (ok ? "OK — the import would go through" : $"BLOCKED — {errorCount} error(s) stop the import") +
            $"; {changes.Count} change line(s), {removals.Count} removal(s), {warningCount} warning(s). Nothing was written.";
        return new CheckImportResult(format, ok, summary, collection, collectionId, current, note,
            changes.Take(CheckLines).ToList(), changes.Count, removals.Take(CheckLines).ToList(), removals.Count,
            errorCount, errors, warningCount, warnings, ms);
    }
}
