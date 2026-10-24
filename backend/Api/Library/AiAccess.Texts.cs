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

    private static readonly Regex PagesQuery = new(@"^(?:s|str|strona|strony|p|pp|page|pages)\.?\s*(\d+)\s*(?:[-–—]\s*(\d+))?$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
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
        if (pages.Success && int.TryParse(pages.Groups[1].Value, out var from))
        {
            var to = pages.Groups[2].Success && int.TryParse(pages.Groups[2].Value, out var t) ? t : from;
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
