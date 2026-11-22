using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Jint;
using Kernel;

namespace Api;

/// <summary>
/// 2026-11-22 (A1) — DIE PRÜFUNG EINES IMPORTS IM DIENST, OHNE ZU SCHREIBEN (MCP <c>check_import</c>, AiMcp.ImportCheck.cs).
///
/// <para>
/// <b>Derselbe Code wie die Vorschau der App.</b> <c>frontend/scripts/import-check-bundle.mjs</c> bündelt
/// <c>frontend/src/app/importCheck/</c> (das Register aller Importe und ihre Planer) zu <c>ImportCheck.js</c>; die Texte
/// in drei Sprachen stehen in <c>ImportCheck.locales.json</c>. Beide reisen eingebettet im Programm mit. Hier führt Jint
/// das Skript aus — eine zweite, in C# getippte Prüfung gibt es nicht. Der Bau des Dienstes erzeugt das Bündel neu,
/// wenn Node da ist (Api.csproj, Ziel <c>ImportCheckBundle</c>).
/// </para>
///
/// <para>
/// <b>Abgeschlossen.</b> Jede Prüfung bekommt ihre eigene Maschine (kein Zugriff auf .NET, eine Zeitgrenze, eine Grenze
/// der Rekursion), höchstens <see cref="MaxParallel"/> laufen zugleich; das vorbereitete Skript wird einmal gelesen.
/// Das Dokument kommt als JSON-Text herein; geschrieben wird nichts — die Baza ist im Skript ein Speicher ohne Dienst.
/// </para>
/// </summary>
public static class ImportCheck
{
    public const string ScriptResource = "Api.ImportCheck.js";
    public const string LocalesResource = "Api.ImportCheck.locales.json";

    /// <summary>Höchstens so viele Zeichen Dokument (die Anfrage selbst ist ohnehin kleiner als 30 MB).</summary>
    public const int MaxDocument = 32 * 1024 * 1024;
    /// <summary>So lange darf eine Prüfung rechnen (eine Baza von ~4500 Einträgen: ~12 s).</summary>
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(90);
    /// <summary>So viele Prüfungen zugleich — jede braucht ein paar hundert MB, solange sie läuft.</summary>
    public const int MaxParallel = 2;

    /// <summary>
    /// 2026-11-22 — so viele dürfen auf eine Maschine WARTEN; wer danach kommt, hört sofort „busy" (statt dass sich Anfragen
    /// mit ihren grossen Abschriften im Speicher stauen, bis der Dienst ohne Speicher dasteht).
    /// </summary>
    public const int MaxWaiting = 4;
    /// <summary>Über diesem Anteil der Speichergrenze des Prozesses (GC, auch die des App-Pools) startet keine Maschine.</summary>
    public const double MemoryCeiling = 0.8;

    private static readonly SemaphoreSlim Gate = new(MaxParallel, MaxParallel);
    private static int waiting;

    private static readonly Lazy<Prepared<Acornima.Ast.Script>> Script = new(() => Engine.PrepareScript(ReadResource(ScriptResource), ScriptResource));

    /// <summary>Die Texte je Sprache als JSON (<c>{"pl": {datei: …}}</c>), einmal gelesen.</summary>
    private static readonly Lazy<IReadOnlyDictionary<string, string>> Locales = new(() =>
    {
        using var doc = JsonDocument.Parse(ReadResource(LocalesResource));
        return doc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetRawText());
    });

    private static string ReadResource(string name)
    {
        using var stream = typeof(ImportCheck).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"{name} fehlt im Programm (EmbeddedResource in Api.csproj; erzeugt von frontend/scripts/import-check-bundle.mjs).");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    public static readonly IReadOnlyList<string> Languages = ["pl", "en", "de"];

    /// <summary>Die Sprache der Meldungen: pl, en oder de (sonst pl).</summary>
    public static string LanguageOf(string? lang)
    {
        var l = (lang ?? "").Trim().ToLowerInvariant();
        if (l.Length > 2) l = l[..2];
        return Languages.Contains(l) ? l : "pl";
    }

    /// <summary>Was das Skript bekommt: <c>{format, lang, document, base?}</c> — das Dokument als Text oder als Wert.</summary>
    public static string InputOf(string format, string documentJson, string? baseJson, string lang)
    {
        var sb = new StringBuilder(documentJson.Length + (baseJson?.Length ?? 0) + 128);
        sb.Append("{\"format\":").Append(JsonSerializer.Serialize(format))
          .Append(",\"lang\":").Append(JsonSerializer.Serialize(lang))
          .Append(",\"document\":").Append(documentJson);
        if (baseJson is not null) sb.Append(",\"base\":").Append(baseJson);
        return sb.Append('}').ToString();
    }

    /// <summary>Ein Ergebnis und wie lange es dauerte.</summary>
    public sealed record Outcome(string Json, long Milliseconds);

    /// <summary>
    /// DIE PRÜFUNG: <paramref name="documentJson"/> ist ein JSON-Wert (ein Objekt oder ein String mit dem Dokument),
    /// <paramref name="baseJson"/> die Abschrift einer Baza wiedzy (nur für <c>knowledge-base</c>, <c>knowledge-forms</c>).
    /// Zurück kommt das JSON von <c>ImportCheck</c> (frontend/src/app/importCheck/check.ts). Ohne Datenbank, ohne Netz.
    /// </summary>
    public static async Task<Outcome> RunAsync(string format, string documentJson, string? baseJson, string lang, CancellationToken ct)
    {
        lang = LanguageOf(lang);
        var locales = Locales.Value;
        var dicts = $"{{\"{lang}\":{locales[lang]}{(lang == "en" ? "" : $",\"en\":{locales["en"]}")}}}";
        return await InvokeAsync("recreatioImportCheck", () => InputOf(format, documentJson, baseJson, lang), dicts, ct);
    }

    /// <summary>
    /// 2026-11-22 (I2) — DIE KONTROLLE EINER WELT (MCP <c>get_world_checks</c>): die Baza aus ihrer Abschrift (mit ihren Uwagi),
    /// ihre Karten, dann <c>worldChecks</c> (frontend/src/app/cogita/worldChecks.ts) — dieselbe Rechnung wie in der App. Mit
    /// allen drei Sprachen: die Worte mancher Prüfungen (Folien) kommen in der Sprache der Baza.
    /// </summary>
    public static Task<Outcome> RunWorldChecksAsync(string baseJson, string lang, CancellationToken ct)
    {
        lang = LanguageOf(lang);
        var dicts = $"{{{string.Join(",", Languages.Select(l => $"\"{l}\":{Locales.Value[l]}"))}}}";
        return InvokeAsync("recreatioWorldChecks", () => $"{{\"lang\":{JsonSerializer.Serialize(lang)},\"base\":{baseJson}}}", dicts, ct);
    }

    /// <summary>Zu viele Prüfungen zugleich oder zu wenig Speicher: später noch einmal (nichts ist kaputt).</summary>
    public sealed class BusyException(string message) : Exception(message);

    /// <summary>Ist der Speicher des Prozesses schon fast voll (Grenze des GC — auf dem Server die des App-Pools bzw. der Maschine)?</summary>
    private static bool MemoryTight()
    {
        var info = GC.GetGCMemoryInfo();
        return info.HighMemoryLoadThresholdBytes > 0 && info.MemoryLoadBytes > info.HighMemoryLoadThresholdBytes
            || info.TotalAvailableMemoryBytes > 0 && GC.GetTotalMemory(false) > info.TotalAvailableMemoryBytes * MemoryCeiling;
    }

    /// <summary>Nach einer Maschine den grossen Speicher (Abschrift, Dokument, Jint-Objekte) wirklich zurückgeben.</summary>
    private static void GiveBack()
    {
        System.Runtime.GCSettings.LargeObjectHeapCompactionMode = System.Runtime.GCLargeObjectHeapCompactionMode.CompactOnce;
        GC.Collect(GC.MaxGeneration, GCCollectionMode.Forced, blocking: true, compacting: true);
    }

    /// <summary>
    /// Eine Funktion des Bündels in einer eigenen, abgeschlossenen Maschine (Zeit, Rekursion, kein .NET). 2026-11-22: höchstens
    /// <see cref="MaxWaiting"/> warten, die Eingabe entsteht erst, wenn die Maschine an der Reihe ist, keine Maschine startet bei
    /// fast vollem Speicher, ein <see cref="OutOfMemoryException"/> wird zu „busy", danach wird der Speicher zurückgegeben.
    /// </summary>
    private static async Task<Outcome> InvokeAsync(string function, Func<string> input, string dicts, CancellationToken ct)
    {
        if (Interlocked.Increment(ref waiting) > MaxWaiting + MaxParallel)
        {
            Interlocked.Decrement(ref waiting);
            throw new BusyException($"busy: {MaxParallel} checks are running and {MaxWaiting} are waiting — try again in a minute.");
        }
        try
        {
            await Gate.WaitAsync(ct);
        }
        catch
        {
            Interlocked.Decrement(ref waiting);
            throw;
        }
        try
        {
            if (MemoryTight())
            {
                GiveBack();
                if (MemoryTight()) throw new BusyException("busy: the server is short of memory right now — try again in a minute.");
            }
            return await Task.Run(() =>
            {
                var watch = Stopwatch.StartNew();
                try
                {
                    using var engine = new Engine(options =>
                    {
                        options.TimeoutInterval(Timeout);
                        options.LimitRecursion(4000);
                        options.CancellationToken(ct);
                    });
                    engine.Execute(Script.Value);
                    var run = engine.GetValue(function);
                    var result = engine.Invoke(run, input(), dicts).UnwrapIfPromise(Timeout);
                    return new Outcome(result.AsString(), watch.ElapsedMilliseconds);
                }
                catch (OutOfMemoryException)
                {
                    throw new BusyException("busy: the check ran out of memory (too many at once, or a very large document) — try again in a minute.");
                }
            }, ct);
        }
        finally
        {
            Gate.Release();
            Interlocked.Decrement(ref waiting);
            GiveBack();
        }
    }

    /// <summary>
    /// Die Abschrift einer Baza wiedzy so, wie das Skript sie liest (<c>KnowledgeSnapshot</c>, importCheck/knowledge.ts):
    /// Rodzaje, Einträge mit Kennung, Rodzajen, bleibendem Namen und Daten, und <c>setup.course</c>.
    /// </summary>
    public static string BaseJsonOf(AiAccess.Snapshot p)
    {
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer))
        {
            w.WriteStartObject();
            w.WriteString("library", Ids.ToText(p.LibraryId));
            w.WriteString("name", p.Name);
            if (p.MadeAt is not null) w.WriteString("madeAt", p.MadeAt);
            w.WritePropertyName("kinds");
            if (p.Kinds.ValueKind == JsonValueKind.Array) p.Kinds.WriteTo(w); else { w.WriteStartArray(); w.WriteEndArray(); }
            w.WritePropertyName("entries");
            w.WriteStartArray();
            foreach (var item in p.Items)
            {
                w.WriteStartObject();
                w.WriteString("id", item.Id);
                w.WriteString("kind", item.Kind);
                w.WritePropertyName("kinds");
                w.WriteStartArray();
                foreach (var k in item.Kinds.Length > 0 ? item.Kinds : [item.Kind]) w.WriteStringValue(k);
                w.WriteEndArray();
                if (item.Ref is not null) w.WriteString("ref", item.Ref);
                w.WritePropertyName("data");
                if (item.Data.ValueKind == JsonValueKind.Object) item.Data.WriteTo(w); else { w.WriteStartObject(); w.WriteEndObject(); }
                w.WriteEndObject();
            }
            w.WriteEndArray();
            if (p.Setup.ValueKind == JsonValueKind.Object && p.Setup.TryGetProperty("course", out var course) && course.ValueKind == JsonValueKind.Object)
            {
                w.WritePropertyName("setup");
                w.WriteStartObject();
                w.WritePropertyName("course");
                course.WriteTo(w);
                /* 2026-11-22 (I6, I2) — die Uwagi: ein Import erledigt sie an ihrer Kennung; die Kontrolle zählt die offenen. */
                if (p.Setup.TryGetProperty("feedback", out var feedback) && feedback.ValueKind == JsonValueKind.Array)
                {
                    w.WritePropertyName("feedback");
                    feedback.WriteTo(w);
                }
                w.WriteEndObject();
            }
            w.WriteEndObject();
        }
        return Encoding.UTF8.GetString(buffer.ToArray());
    }
}
