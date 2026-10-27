using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Api;

/// <summary>
/// 2026-10-24 — DIE VOLLSTÄNDIGEN TEXTE DER WERKE IN EINER ABSCHRIFT (<c>texts</c>, aiSnapshot.ts).
///
/// <para>
/// Ein Text liegt in einem Behälter (einer Bibliothek) wie jeder Eintrag; die Abschrift dieses
/// Behälters bringt ihn mit — wer den Behälter über den Link liest, liest auch den Text, und ein
/// Text in einem anderen, privaten Behälter kommt nur, wenn auch dieser im Link ist. Der Browser
/// hat jeden Block schon lesbar gemacht und ihm seine Stelle gegeben (<c>loc</c>, wie sie dasteht;
/// <c>at</c>, zu welcher Stelle er gehört, einheitlich geschrieben, auch geerbt) und seine Seiten.
/// </para>
///
/// <para>
/// <b>Eine Stelle finden</b> ohne das Modell der Stellen des Browsers (<c>locations.ts</c>): gleich
/// (<c>J 21,15</c>), als ganze Einheit (<c>J 21</c> umfasst <c>J 21,15</c>; in der Dezimalzählung
/// <c>2.01</c> auch <c>2.011</c>), als Bereich (<c>J 21,15-17</c>, <c>nr 24–26</c>,
/// <c>J 21,15–J 21,19</c>) oder als Seiten (<c>s. 45</c>, <c>s. 45–47</c>). Leerzeichen, Gross- und
/// Kleinschreibung, „:" statt „," und die Art des Strichs zählen nicht.
/// </para>
/// </summary>
public static partial class AiAccess
{
    public sealed class TextBlock
    {
        public required int Index { get; init; }
        public required string Type { get; init; }
        public int? Level { get; init; }
        public string? Loc { get; init; }
        public string? At { get; init; }
        public int? PageFrom { get; init; }
        public int? PageTo { get; init; }
        public required string Text { get; init; }

        private string? folded;
        public string Folded => folded ??= Fold(Text);
    }

    public sealed class TextPart
    {
        public required string Key { get; init; }
        public required string Label { get; init; }
        public double Order { get; init; }
        public string? First { get; init; }
        public string? Last { get; init; }
        public int[]? Pages { get; init; }
        public List<TextBlock> Blocks { get; } = [];
        public int Words => Blocks.Sum(b => b.Text.Split((char[])[' ', '\n', '\t'], StringSplitOptions.RemoveEmptyEntries).Length);
    }

    public sealed class TextDoc
    {
        public required string Id { get; init; }
        public required Snapshot From { get; init; }
        public required string Work { get; init; }
        public string? WorkTitle { get; init; }
        public string? WorkKey { get; init; }
        public required string Scheme { get; init; }
        public JsonElement Edition { get; init; }
        public List<TextPart> Parts { get; } = [];
    }

    private static int? IntAt(JsonElement e, int index) =>
        e.ValueKind == JsonValueKind.Array && e.GetArrayLength() > index && e[index].ValueKind == JsonValueKind.Number && e[index].TryGetInt32(out var n) ? n : null;

    /// <summary>Die Texte einer Abschrift lesen — duldsam: was fehlt, fällt weg.</summary>
    internal static void ReadTexts(Snapshot snap, JsonElement root)
    {
        if (root.TryGetProperty("textsOmitted", out var omitted) && omitted.ValueKind == JsonValueKind.True) snap.TextsOmitted = true;
        if (!root.TryGetProperty("texts", out var texts) || texts.ValueKind != JsonValueKind.Array) return;
        foreach (var t in texts.EnumerateArray())
        {
            if (Str(t, "id") is not string id || Str(t, "work") is not string work) continue;
            var doc = new TextDoc
            {
                Id = id.ToLowerInvariant(),
                From = snap,
                Work = work.ToLowerInvariant(),
                WorkTitle = Str(t, "workTitle"),
                WorkKey = Str(t, "workKey"),
                Scheme = Str(t, "scheme") ?? "pages",
                Edition = t.TryGetProperty("edition", out var edition) ? edition : default
            };
            /* 2026-10-27 — die Muster der Seiten-Serien dieses Textes: so werden seine Seiten wieder geschrieben, wie sie gedruckt sind. */
            if (t.TryGetProperty("pageSeries", out var series) && series.ValueKind == JsonValueKind.Array)
                RememberSeries(series.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString() ?? ""));
            if (t.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
            {
                foreach (var p in parts.EnumerateArray())
                {
                    if (Str(p, "key") is not string key) continue;
                    var part = new TextPart
                    {
                        Key = key,
                        Label = Str(p, "label") ?? key,
                        Order = p.TryGetProperty("order", out var order) && order.ValueKind == JsonValueKind.Number ? order.GetDouble() : 0,
                        First = Str(p, "first"),
                        Last = Str(p, "last"),
                        Pages = p.TryGetProperty("pages", out var pp) && IntAt(pp, 0) is int a && IntAt(pp, 1) is int b ? [a, b] : null
                    };
                    if (p.TryGetProperty("blocks", out var blocks) && blocks.ValueKind == JsonValueKind.Array)
                    {
                        var i = 0;
                        foreach (var bl in blocks.EnumerateArray())
                        {
                            var pages = bl.TryGetProperty("pages", out var bp) ? bp : default;
                            part.Blocks.Add(new TextBlock
                            {
                                Index = i++,
                                Type = Str(bl, "type") ?? "paragraph",
                                Level = bl.TryGetProperty("level", out var lv) && lv.ValueKind == JsonValueKind.Number && lv.TryGetInt32(out var level) ? level : null,
                                Loc = Str(bl, "loc"),
                                At = Str(bl, "at"),
                                PageFrom = IntAt(pages, 0),
                                PageTo = IntAt(pages, 1),
                                Text = Str(bl, "text") ?? ""
                            });
                        }
                    }
                    doc.Parts.Add(part);
                }
            }
            doc.Parts.Sort((x, y) => x.Order.CompareTo(y.Order));
            snap.Texts.Add(doc);
        }
    }

    /* -- Eine Stelle finden --------------------------------------------------------------------------- */

    /// <summary>Eine Stelle zum Vergleichen: klein, ohne Leerzeichen, „:" wie „,", jeder Strich ein „-".</summary>
    public static string NormPlace(string? text)
    {
        var sb = new StringBuilder();
        foreach (var c in (text ?? "").Trim().ToLowerInvariant())
        {
            if (char.IsWhiteSpace(c)) continue;
            sb.Append(c switch { '–' or '—' or '‒' or '−' => '-', ':' => ',', _ => c });
        }
        return sb.ToString();
    }

    /// <summary>
    /// Gehört die Stelle <paramref name="at"/> zu der gesuchten <paramref name="query"/>? Gleich, oder als Teil
    /// der Einheit: hinter dem Gesuchten beginnt eine tiefere Ebene („J 21" → „J 21,15", „I, q. 2" → „I, q. 2, a. 3",
    /// „nr 24" → „nr 24 § 1"; ein Buch ohne Zahl → seine Kapitel; dezimal „2.01" → „2.011").
    /// </summary>
    public static bool PlaceMatches(string? at, string query, string scheme)
    {
        var a = NormPlace(at);
        var q = NormPlace(query);
        if (a.Length == 0 || q.Length == 0) return false;
        if (a == q) return true;
        if (!a.StartsWith(q, StringComparison.Ordinal)) return false;
        var next = a[q.Length];
        if (next is ',' or '§' or ';' or '(') return true;
        if (scheme == "decimal" && (char.IsDigit(next) || next == '.')) return true;
        /* Ein Name ohne Zahl (ein Buch: „J", „1 Kor" schon mit Zahl am Anfang) — dann beginnt die Zahl dahinter. */
        return char.IsDigit(next) && !char.IsDigit(q[^1]);
    }

    /* 2026-10-27 — auch Seiten einer Serie („s. 12*", „s. 45'–47'", „s. (7)", „s. A12") und römische („s. xii"). */
    private static readonly Regex PagesQuery = new(@"^(?:s|str|strona|strony|p|pp|page|pages)\.?\s*(\S+?)\s*(?:[-–—]\s*(\S+))?$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    /* -- Seiten in Serien (2026-10-27) ------------------------------------------------------------- */

    /*
     * SEITEN IN SERIEN, für jedes Buch — dieselbe Rechnung wie in der App (library/locations.ts: readPage,
     * seriesIndex). Eine gedruckte Seite ist eine Zahl mit den Zeichen ihrer Serie („12*", „3''", „(7)", „A12",
     * „xii", „iv*"); die SERIE ist das Muster dieser Zeichen („#*", „(#)", „A#", „i*"; „#" die gewöhnlichen, „i" die
     * römische Titelei), ihr Zahlenband kommt aus dem Muster (FNV-1a → 1 … 20 000, mal 100 000). Eine Liste der
     * Serien gibt es nicht. Die Abschrift trägt die Seiten als diese Zahlen und nennt die Muster der Serien ihrer
     * Texte (pageSeries) — so schreibt der Dienst eine Seite wieder, wie sie gedruckt ist.
     */
    private const int RomanPage = -10000;
    private const int PageBand = 100_000;
    private const int PageBandCount = 20_000;
    private const string NotMark = @"\s0-9.,;:\-–—()\[\]{}„”“«»";
    private static readonly Regex ArabicPage = new($@"^([^{NotMark}]{{0,3}}?)([0-9]{{1,5}})([^{NotMark}\p{{L}}]{{0,3}})$", RegexOptions.CultureInvariant);
    private static readonly Regex RomanLabel = new($@"^([^{NotMark}\p{{L}}]{{0,3}}?)([ivxlcdm]+)([^{NotMark}\p{{L}}]{{0,3}})$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private static readonly Regex WrappedPage = new(@"^([(\[])\s*(.*?)\s*([)\]])$", RegexOptions.CultureInvariant);
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, string> SeenSeries = new();

    private static string Primes(string text) =>
        text.Replace('’', '\'').Replace('′', '\'').Replace('`', '\'').Replace('´', '\'').Replace("″", "''").Replace("\"", "''");

    private static string UpperAscii(string text) => string.Concat(text.Select(c => c is >= 'a' and <= 'z' ? (char)(c - 32) : c));

    /// <summary>Die Nummer des Bandes einer Serie: die gewöhnlichen 0, die römische Titelei −1, jede andere aus ihrem Muster (FNV-1a).</summary>
    public static int SeriesIndex(string key)
    {
        if (key == "#") return 0;
        if (key == "i") return -1;
        var h = 2166136261u;
        foreach (var c in key) { h ^= c; h *= 16777619u; }
        return 1 + (int)(h % PageBandCount);
    }

    private static (string Key, int K) RememberPage((string Key, int K) page)
    {
        var index = SeriesIndex(page.Key);
        if (index > 0) SeenSeries.TryAdd(index, page.Key);
        return page;
    }

    /// <summary>Die Muster der Serien eines Textes bekanntmachen (aus der Abschrift: <c>pageSeries</c>).</summary>
    public static void RememberSeries(IEnumerable<string> keys)
    {
        foreach (var key in keys)
            if (key.Length is > 0 and <= 24 && (key.Contains('#') || key.Contains('i'))) RememberPage((key, 0));
    }

    /// <summary>Eine gedruckte Seite: ihre Serie und ihre Zahl darin — „12*" → („#*", 12), „A12" → („A#", 12), „xii" → („i", 12); keine Seite → null.</summary>
    public static (string Key, int K)? ReadPage(string text)
    {
        var t = Primes(text.Trim());
        string open = "", close = "";
        if (WrappedPage.Match(t) is { Success: true } w)
        {
            if ((w.Groups[1].Value == "(") != (w.Groups[3].Value == ")")) return null;
            open = w.Groups[1].Value;
            close = w.Groups[3].Value;
            t = w.Groups[2].Value;
        }
        if (ArabicPage.Match(t) is { Success: true } a)
            return RememberPage(($"{open}{UpperAscii(a.Groups[1].Value)}#{a.Groups[3].Value}{close}", int.Parse(a.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture)));
        if (RomanLabel.Match(t) is not { Success: true } r) return null;
        var k = RomanValue(r.Groups[2].Value);
        if (k <= 0) return null;
        return RememberPage(($"{open}{r.Groups[1].Value}i{r.Groups[3].Value}{close}", k));
    }

    private static int RomanValue(string text)
    {
        var s = text.ToLowerInvariant();
        if (s.Length == 0 || s.Any(c => "ivxlcdm".IndexOf(c) < 0)) return 0;
        static int V(char c) => c switch { 'i' => 1, 'v' => 5, 'x' => 10, 'l' => 50, 'c' => 100, 'd' => 500, _ => 1000 };
        var total = 0;
        for (var i = 0; i < s.Length; i++) total += i + 1 < s.Length && V(s[i]) < V(s[i + 1]) ? -V(s[i]) : V(s[i]);
        return total;
    }

    private static string RomanWord(int n)
    {
        (int, string)[] table = [(1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"), (50, "l"), (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")];
        var sb = new StringBuilder();
        foreach (var (v, w) in table) while (n >= v) { sb.Append(w); n -= v; }
        return sb.ToString();
    }

    /// <summary>Eine Seite als Zahl, wie die App sie zählt: „45" → 45, „xii" → −9 988, „12*" → Band von „#*" + 12.</summary>
    public static int? PageValue(string text)
    {
        if (ReadPage(text) is not { } page) return null;
        if (page.Key == "i") return page.K <= 9_999 ? RomanPage + page.K : null;
        return page.K < PageBand ? SeriesIndex(page.Key) * PageBand + page.K : null;
    }

    /// <summary>Eine Seite wieder geschrieben, wie sie gedruckt ist: „12*", „(7)", „A12", „xii" (ein Muster, das hier niemand gelesen hat: „12?").</summary>
    public static string PageWord(int n)
    {
        if (n < 0) return RomanWord(n - RomanPage);
        var index = n / PageBand;
        var k = n - index * PageBand;
        var number = k.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (index == 0) return number;
        if (!SeenSeries.TryGetValue(index, out var key)) return $"{number}?";
        var hash = key.IndexOf('#');
        if (hash >= 0) return key[..hash] + number + key[(hash + 1)..];
        var at = key.IndexOf('i');
        return key[..at] + RomanWord(k) + key[(at + 1)..];
    }
    private static readonly Regex TrailingNumber = new(@"\d+[a-z]?$", RegexOptions.CultureInvariant);

    /// <summary>
    /// WO STEHT DIE STELLE in diesem Teil — der erste und der letzte Block (eingeschlossen), oder <c>null</c>.
    /// Ein Bereich „a-b": von der Einheit a bis zur Einheit b; ist b nur eine Zahl, ersetzt sie die letzte
    /// Zahl von a („J 21,15-17" → bis „J 21,17").
    /// </summary>
    public static (int First, int Last)? Locate(TextPart part, string query, string scheme)
    {
        var q = query.Trim();
        if (q.Length == 0 || part.Blocks.Count == 0) return null;

        var pages = PagesQuery.Match(q);
        if (pages.Success && PageValue(pages.Groups[1].Value) is int from)
        {
            var to = pages.Groups[2].Success && PageValue(pages.Groups[2].Value) is int t ? t : from;
            var hits = part.Blocks.Where(b => b.PageFrom is int bf && b.PageTo is int bt && bf <= to && from <= bt && b.Type != "page").Select(b => b.Index).ToList();
            return hits.Count == 0 ? null : (hits.Min(), hits.Max());
        }

        (int First, int Last)? Unit(string one)
        {
            var hits = part.Blocks.Where(b => PlaceMatches(b.At, one, scheme) || PlaceMatches(b.Loc, one, scheme)).Select(b => b.Index).ToList();
            return hits.Count == 0 ? null : (hits.Min(), hits.Max());
        }

        var whole = Unit(q);
        if (whole is not null) return whole;

        /* Ein Bereich: am letzten Strich, der zwischen zwei Stellen steht. */
        var norm = q.Replace('–', '-').Replace('—', '-');
        var dash = norm.LastIndexOf('-');
        if (dash <= 0 || dash >= norm.Length - 1) return null;
        var left = norm[..dash].Trim();
        var right = norm[(dash + 1)..].Trim();
        var start = Unit(left);
        if (start is null) return null;
        var end = Unit(right);
        if (end is null && TrailingNumber.IsMatch(left) && Regex.IsMatch(right, @"^\d+[a-z]?$", RegexOptions.CultureInvariant))
            end = Unit(TrailingNumber.Replace(left, right));
        return end is null || end.Value.Last < start.Value.First ? start : (start.Value.First, end.Value.Last);
    }

    /// <summary>Blöcke lesbar: Überschriften als Überschriften, jede Stelle davor in Klammern.</summary>
    public static string RenderBlocks(IEnumerable<TextBlock> blocks)
    {
        var sb = new StringBuilder();
        foreach (var b in blocks)
        {
            var place = b.Loc is null ? "" : $"[{b.Loc}] ";
            switch (b.Type)
            {
                case "heading": sb.Append('#', Math.Clamp((b.Level ?? 1) + 1, 2, 6)).Append(' ').Append(place).AppendLine(b.Text); break;
                case "quote": sb.Append("> ").Append(place).AppendLine(b.Text.Replace("\n", "\n> ")); break;
                case "page": sb.AppendLine(b.Text); break;
                default: sb.Append(place).AppendLine(b.Text); break;
            }
            sb.AppendLine();
        }
        return sb.ToString().TrimEnd();
    }

    /* -- Suchen im Text ------------------------------------------------------------------------------- */

    public sealed record TextFound(TextDoc Text, TextPart Part, TextBlock Block, int Score);

    /// <summary>Alle Wörter in einem Block (wie bei Einträgen: kurze nur als ganze Wörter); stehen sie beisammen, zuerst.</summary>
    public static List<TextFound> SearchTexts(IEnumerable<TextDoc> texts, string? query)
    {
        var terms = Terms(query);
        var phrase = Fold(query ?? "").Trim();
        var out_ = new List<TextFound>();
        if (terms.Count == 0) return out_;
        foreach (var text in texts)
            foreach (var part in text.Parts)
                foreach (var block in part.Blocks)
                {
                    if (block.Type == "page") continue;
                    var hay = block.Folded;
                    if (!terms.All(t => Has(hay, t))) continue;
                    var score = terms.Count > 1 && HasWords(hay, phrase) ? 100 : 0;
                    if (block.Type == "heading") score += 10;
                    out_.Add(new TextFound(text, part, block, score));
                }
        return out_.OrderByDescending(f => f.Score).ToList();
    }
}
