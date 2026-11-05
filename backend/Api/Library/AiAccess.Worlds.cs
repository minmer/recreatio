using System.Text.Json;
using System.Text.RegularExpressions;

namespace Api;

/// <summary>
/// 2026-11-05 (Prompt 24) — VERWEISE IN ANDERE BAZY WIEDZY („Inne światy", <c>frontend/src/app/cogita/worlds.ts</c>).
/// <code>
///   Wert        "@@&lt;name der Baza&gt;:&lt;@bleibender Name oder Kennung&gt;", z. B. "@@historia:@historia/rewolucja-1688" — ein
///               ganzer Feldwert (Odwołanie mit "external": true), im Zapis [[Rewolucja 1688|@@historia:@historia/rewolucja-1688]]
///               oder als Abstecher {"type": "detour", "config": {"flow": "@@historia:@historia/f/rewolucja"}}
///   Name        jede Baza nennt sich in ihren Ustawienia ("handle": "historia"); welche anderen sie kennt, steht dort unter
///               "worlds" ([{"id", "handle", "name"}]). Aufgelöst wird zuerst über die "worlds" der Baza, in der der Verweis
///               steht, sonst über eine geteilte Baza, die sich selbst so nennt
///   Stand       ok — das Ziel liegt in einer Baza dieses Zugangs; outside — die andere Baza ist mit diesem Zugang nicht
///               geteilt (von ihr wird nichts gesagt, ausser dem Namen, den die verweisende Baza selbst für sie trägt);
///               broken — die andere Baza ist geteilt, aber das Ziel gibt es dort nicht (mehr)
///   Regeln      ein Angebot, nie eine Voraussetzung: kein Verweis „@@…" zählt für Reihenfolge, Kenntnis oder Landschaft
/// </code>
/// </summary>
public static partial class AiAccess
{
    /// <summary>Ein ganzer Wert als Verweis in eine andere Baza.</summary>
    private static readonly Regex CrossValue = new(@"^@@([a-z0-9][a-z0-9_-]{0,39}):(\S+)$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    /// <summary>Ein Verweis in eine andere Baza im Zapis: [[Wort|@@historia:@…]].</summary>
    public static readonly Regex CrossMarkup = new(@"\[\[([^\]|]*)\|@@([a-z0-9][a-z0-9_-]{0,39}):([^\]\s]+)\]\]", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    /// <summary>Ein Verweis in eine andere Baza, wie er in den Daten steht: Feld, Name der Baza, Ziel dort, der eigene Wortlaut.</summary>
    public sealed record CrossRef(string Field, string Handle, string Ref, string? Label)
    {
        /// <summary>Wie er geschrieben wird: "@@historia:@historia/…".</summary>
        public string Text => $"@@{Handle}:{Ref}";
    }

    /// <summary>Ein Text als ganzer Verweis in eine andere Baza — sonst <c>null</c>.</summary>
    public static (string Handle, string Ref)? CrossOf(string? text)
    {
        if (text is null) return null;
        var m = CrossValue.Match(text.Trim());
        return m.Success ? (m.Groups[1].Value.ToLowerInvariant(), m.Groups[2].Value) : null;
    }

    /// <summary>Alle Verweise eines Eintrags in andere Bazy — jeder (Name, Ziel) einmal, mit dem Feld, in dem er zuerst steht.</summary>
    public static List<CrossRef> CrossRefsOf(Item item)
    {
        var found = new List<CrossRef>();
        void Add(string field, string handle, string target, string? label)
        {
            handle = handle.ToLowerInvariant();
            if (found.Any(c => c.Handle == handle && c.Ref == target)) return;
            found.Add(new CrossRef(field, handle, target, string.IsNullOrWhiteSpace(label) ? null : label.Trim()));
        }
        void Walk(string field, JsonElement e, int depth)
        {
            if (depth > 14) return;
            switch (e.ValueKind)
            {
                case JsonValueKind.String:
                    var s = e.GetString() ?? "";
                    if (!s.Contains("@@", StringComparison.Ordinal)) break;
                    if (CrossOf(s) is (string h, string r)) { Add(field, h, r, null); break; }
                    foreach (Match m in CrossMarkup.Matches(s)) Add(field, m.Groups[2].Value, m.Groups[3].Value, m.Groups[1].Value);
                    break;
                case JsonValueKind.Array:
                    foreach (var one in e.EnumerateArray()) Walk(field, one, depth + 1);
                    break;
                case JsonValueKind.Object:
                    foreach (var p in e.EnumerateObject()) if (!p.Name.StartsWith('_')) Walk(field, p.Value, depth + 1);
                    break;
            }
        }
        if (item.Data.ValueKind == JsonValueKind.Object)
            foreach (var p in item.Data.EnumerateObject())
                if (!p.Name.StartsWith('_')) Walk(p.Name, p.Value, 0);
        return found;
    }

    /* -- Die Namen der Bazy ------------------------------------------------------------------------ */

    /// <summary>Eine andere Baza, wie eine Baza sie in ihren Ustawienia nennt ("worlds").</summary>
    public sealed record WorldName(Guid Id, string Handle, string Name);

    private static readonly Regex HandlePattern = new("^[a-z0-9][a-z0-9_-]{0,39}$", RegexOptions.CultureInvariant);

    private static string? HandleText(string? raw)
    {
        var h = raw?.Trim().TrimStart('@').ToLowerInvariant();
        return h is not null && HandlePattern.IsMatch(h) ? h : null;
    }

    /// <summary>Die Ustawienia einer Baza aus ihrer Abschrift (der Kurs ohne Einträge: <c>setup.course.settings</c>).</summary>
    private static IEnumerable<JsonElement> SettingsOf(Snapshot s)
    {
        if (s.Setup.ValueKind != JsonValueKind.Object) yield break;
        if (s.Setup.TryGetProperty("course", out var course) && course.ValueKind == JsonValueKind.Object
            && course.TryGetProperty("settings", out var list) && list.ValueKind == JsonValueKind.Array)
            foreach (var one in list.EnumerateArray()) if (one.ValueKind == JsonValueKind.Object) yield return one;
    }

    /// <summary>Wie eine Baza für Verweise heisst ("handle" ihrer Ustawienia) — <c>null</c>: sie nennt sich nicht.</summary>
    public static string? HandleOf(Snapshot s)
    {
        foreach (var one in SettingsOf(s)) if (HandleText(Str(one, "handle")) is string h) return h;
        return s.Setup.ValueKind == JsonValueKind.Object ? HandleText(Str(s.Setup, "handle")) : null;
    }

    /// <summary>Die anderen Bazy, auf die eine Baza verweist ("worlds" ihrer Ustawienia), jeder Name einmal.</summary>
    public static List<WorldName> WorldsOf(Snapshot s)
    {
        var out_ = new List<WorldName>();
        foreach (var one in SettingsOf(s))
        {
            if (!one.TryGetProperty("worlds", out var list) || list.ValueKind != JsonValueKind.Array) continue;
            foreach (var w in list.EnumerateArray())
            {
                if (HandleText(Str(w, "handle")) is not string h || !Guid.TryParse(Str(w, "id"), out var id) || out_.Any(x => x.Handle == h)) continue;
                out_.Add(new WorldName(id, h, Str(w, "name") ?? h));
            }
        }
        return out_;
    }

    /// <summary>Wohin ein Name aus einer Baza zeigt: die Baza (geteilt oder nicht) und ihr Name.</summary>
    public sealed record WorldAt(string Handle, Guid? LibraryId, string? Name, Snapshot? Snap);

    /// <summary>Wohin ein Verweis zeigt: Stand (ok / outside / broken), die Baza, das Ziel (ein Eintrag oder eine Erzählung).</summary>
    public sealed record CrossTarget(CrossRef Cross, string State, WorldAt World, Item? Item, string? FlowRef, string? FlowName)
    {
        public bool Ok => State == "ok";
    }

    /// <summary>Ein Ziel in einer Baza: Kennung, bleibender Name ("@name" oder ohne "@") oder Schlüssel.</summary>
    public static Item? ItemIn(Snapshot s, string token)
    {
        var wanted = token.Trim();
        var bare = wanted.TrimStart('@');
        return s.Items.FirstOrDefault(i => string.Equals(i.Id, bare, StringComparison.OrdinalIgnoreCase))
            ?? s.Items.FirstOrDefault(i => i.Ref is not null && string.Equals(i.Ref.TrimStart('@'), bare, StringComparison.Ordinal))
            ?? s.Items.FirstOrDefault(i => i.Key is not null && string.Equals(i.Key, bare, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Eine Erzählung (Ablauf) einer Baza nach ihrem Namen im Kurs ("@historia/f/…") — ihr Name, sonst <c>null</c>.</summary>
    public static (string Ref, string Name)? FlowIn(Snapshot s, string token)
    {
        if (s.Setup.ValueKind != JsonValueKind.Object || !s.Setup.TryGetProperty("course", out var course) || course.ValueKind != JsonValueKind.Object
            || !course.TryGetProperty("flows", out var flows) || flows.ValueKind != JsonValueKind.Array) return null;
        var bare = token.Trim().TrimStart('@');
        foreach (var f in flows.EnumerateArray())
        {
            var r = Str(f, "ref")?.TrimStart('@');
            if (r is not null && string.Equals(r, bare, StringComparison.Ordinal)) return ("@" + r, Str(f, "name") ?? r);
        }
        return null;
    }

    public sealed partial class Opened
    {
        private readonly Dictionary<string, List<CrossTarget>> crossOut = [];
        private Dictionary<string, List<(Item From, CrossTarget Target)>>? crossIn;

        /// <summary>
        /// Welche Baza ein Name aus der Baza <paramref name="from"/> meint: ihr eigener Name sie selbst; dann ihre "worlds"
        /// (geteilt: die Abschrift; nicht geteilt: nur der Name, den sie selbst trägt); sonst eine geteilte Baza, die sich so nennt.
        /// </summary>
        public WorldAt WorldOf(Snapshot from, string handle)
        {
            handle = handle.Trim().TrimStart('@').ToLowerInvariant();
            if (HandleOf(from) == handle) return new WorldAt(handle, from.LibraryId, from.Name, from);
            if (WorldsOf(from).FirstOrDefault(w => w.Handle == handle) is WorldName named)
            {
                var shared = Parts.FirstOrDefault(p => p.LibraryId == named.Id);
                return new WorldAt(handle, named.Id, shared?.Name ?? named.Name, shared);
            }
            var self = Parts.FirstOrDefault(p => p.Part == "knowledge" && HandleOf(p) == handle);
            return self is null ? new WorldAt(handle, null, null, null) : new WorldAt(handle, self.LibraryId, self.Name, self);
        }

        /// <summary>Wohin ein Verweis aus einem Eintrag zeigt.</summary>
        public CrossTarget Resolve(Snapshot from, CrossRef c)
        {
            var world = WorldOf(from, c.Handle);
            if (world.Snap is not Snapshot snap) return new CrossTarget(c, "outside", world, null, null, null);
            if (ItemIn(snap, c.Ref) is Item item) return new CrossTarget(c, "ok", world, item, null, null);
            if (FlowIn(snap, c.Ref) is (string fr, string fn)) return new CrossTarget(c, "ok", world, null, fr, fn);
            return new CrossTarget(c, "broken", world, null, null, null);
        }

        /// <summary>Alle Verweise eines Eintrags in andere Bazy, aufgelöst.</summary>
        public List<CrossTarget> CrossLinksOf(Item item)
        {
            if (!crossOut.TryGetValue(item.Id, out var found))
                crossOut[item.Id] = found = CrossRefsOf(item).Select(c => Resolve(item.From, c)).ToList();
            return found;
        }

        /// <summary>Wer aus einer (anderen) Baza dieses Zugangs auf einen Eintrag verweist.</summary>
        public List<(Item From, CrossTarget Target)> CrossBacklinks(Item item)
        {
            if (crossIn is null)
            {
                crossIn = [];
                foreach (var one in Items)
                    foreach (var t in CrossLinksOf(one))
                    {
                        if (t.Item is not Item to || to.Id == one.Id) continue;
                        if (!crossIn.TryGetValue(to.Id, out var list)) crossIn[to.Id] = list = [];
                        list.Add((one, t));
                    }
            }
            return crossIn.TryGetValue(item.Id, out var back) ? back : [];
        }

        /// <summary>
        /// Ein Eintrag nach einem Verweis "@@name:@ziel" (als Kennung eines Werkzeugs): der Name gilt in jeder Baza dieses
        /// Zugangs — als ihr eigener oder als einer ihrer "worlds". <c>null</c>: keine geteilte Baza heisst so, oder das Ziel fehlt.
        /// </summary>
        public Item? GetCross(string text)
        {
            if (CrossOf(text) is not (string handle, string target)) return null;
            foreach (var from in Parts.Where(p => p.Part == "knowledge"))
                if (WorldOf(from, handle).Snap is Snapshot snap && ItemIn(snap, target) is Item item) return item;
            return null;
        }
    }

    /// <summary>Der Zapis mit Verweisen in andere Bazy als lesbarer Text: „Wort [→ Historia: Rewolucja 1688]".</summary>
    internal static string CrossMarkupText(string text, Snapshot from, Opened o) =>
        CrossMarkup.Replace(text, m =>
        {
            var t = o.Resolve(from, new CrossRef("", m.Groups[2].Value.ToLowerInvariant(), m.Groups[3].Value, m.Groups[1].Value));
            return $"{m.Groups[1].Value} [→ {CrossTitle(t)}]";
        });

    /// <summary>Wie ein Verweis in eine andere Baza in einem Text heisst.</summary>
    internal static string CrossTitle(CrossTarget t) => t.State switch
    {
        "ok" => $"{t.World.Name}: {t.Item?.Title ?? t.FlowName} (inny świat, oferta)",
        "broken" => $"{t.World.Name}: (zerwany odnośnik — nie ma tam „{t.Cross.Ref}”)",
        _ => t.World.Name is string n ? $"{n}: (poza tym dostępem)" : $"„{t.Cross.Handle}”: (baza poza tym dostępem)"
    };
}
