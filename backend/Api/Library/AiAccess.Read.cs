using System.Collections.Concurrent;
using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DOSTĘP DLA AI — DIE SEITE DES ASSISTENTEN (0126). Nur GET, ohne Sitzung:
/// das Geheimnis im Pfad (<c>/ai/{link}</c>) weist aus und öffnet zugleich.
///
/// <para>
/// <b>Was je Anfrage geschieht.</b> Hash des Geheimnisses → Zeile; gilt sie
/// (fertig, nicht abgelaufen, ihr Urheber prowadzi den Bereich noch), wird
/// aus dem Geheimnis der Schlüssel abgeleitet, C ausgepackt, jede Abschrift
/// geöffnet, entpackt und gelesen — und am Ende der Anfrage alles verworfen.
/// Nichts davon wird abgelegt oder protokolliert (das Protokoll kennt nur
/// Routenmuster, <c>ApiErrorMiddleware</c>). Ein falscher, abgelaufener oder
/// widerrufener Link bekommen dieselbe Antwort (404).
/// </para>
///
/// <para>
/// <b>Was der Assistent bekommt:</b> eine Anleitung (<c>/ai/{link}</c>), die
/// Suche (Wörter, ohne Rücksicht auf Akzente; leer: alles der Reihe nach),
/// einen Eintrag mit allem, worauf er zeigt und was auf ihn zeigt, die Arten
/// mit ihren Feldern, und eine OpenAPI-Beschreibung für ChatGPT-Aktionen.
/// Was die Felder und die Auszeichnung bedeuten, steht IN den Abschriften —
/// der Browser schreibt es aus demselben Code, der die Einträge zeigt
/// (<c>aiAccess/aiSnapshot.ts</c>), damit es nie auseinanderläuft.
/// </para>
/// </summary>
public static partial class AiAccess
{
    private const int PerMinute = 120;
    private const int MissesPerMinute = 30;
    private const long MaxOpened = 200L * 1024 * 1024;
    private const int DefaultLimit = 20;
    private const int MaxLimit = 50;
    private const int MaxUsedBy = 100;

    /// <summary>Polnisch lesbar (keine \u-Folgen) — die Antwort ist JSON mit nosniff, nie HTML.</summary>
    private static readonly JsonSerializerOptions Out = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static readonly ConcurrentDictionary<string, (DateTime Window, int Count)> Calls = new();

    private static void MapRead(WebApplication app)
    {
        /* 2026-10-24 — GET und HEAD: manche Abrufwerkzeuge fragen erst mit HEAD (vorher 405). */
        string[] read = ["GET", "HEAD"];
        app.MapMethods("/ai/{token}", read, GuideAsync);
        app.MapMethods("/ai/{token}/search", read, SearchAsync);
        app.MapMethods("/ai/{token}/search/{*q}", read, SearchPathAsync);
        app.MapMethods("/ai/{token}/entry/{entry}", read, EntryAsync);
        app.MapMethods("/ai/{token}/kinds", read, KindsAsync);
        app.MapMethods("/ai/{token}/openapi.json", read, OpenApiAsync);
    }

    /* -- Die Abschrift, wie der Dienst sie liest --------------------------------------------- */

    /// <summary>Eine geöffnete Abschrift eines Behälters (Format v1, aiSnapshot.ts) — duldsam gelesen.</summary>
    public sealed class Snapshot
    {
        public required Guid LibraryId { get; init; }
        /// <summary><c>books</c>, <c>writing</c> oder <c>knowledge</c> — vom Dienst, nicht aus der Abschrift.</summary>
        public required string Part { get; init; }
        public string Name { get; init; } = "";
        public string? MadeAt { get; init; }
        public string? Notes { get; init; }
        public JsonElement Kinds { get; init; }
        public List<Item> Items { get; } = [];
    }

    public sealed class Item
    {
        public required string Id { get; init; }
        public required Snapshot From { get; init; }
        public required string Kind { get; init; }
        public string KindName { get; init; } = "";
        public string? TypeName { get; init; }
        public string[] Kinds { get; init; } = [];
        public string Title { get; init; } = "";
        public string? Tell { get; init; }
        public string? Key { get; init; }
        public string? UpdatedAt { get; init; }
        public string[] Refs { get; init; } = [];
        public JsonElement Data { get; init; }

        private string? plain;
        private string? haystack;
        private string? foldedTitle;

        /// <summary>Was der Eintrag sagt, ohne Titel: alle Texte und Zahlen seiner Daten, Zeile für Zeile.</summary>
        public string Plain => plain ??= PlainOf(Data);

        /// <summary>Wogegen gesucht wird: Titel, Schlüssel, Art, Unterscheidung und alles darunter — gefaltet.</summary>
        public string Haystack => haystack ??= Fold($"{Title}\n{Key}\n{KindName}\n{TypeName}\n{Tell}\n{Plain}");

        public string FoldedTitle => foldedTitle ??= Fold(Title);
    }

    private static string? Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String && v.GetString() is { Length: > 0 } s ? s : null;

    private static string[] Strs(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array
            ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).Where(x => x.Length > 0).Distinct().ToArray()
            : [];

    /// <summary>Wie ein Teil heisst, wenn die Abschrift keinen Namen trägt.</summary>
    public static string PartLabel(string part) => part switch
    {
        "books" => "Biblioteka",
        "writing" => "Skryptorium",
        _ => "Baza wiedzy"
    };

    private static int PartOrder(string part) => part switch { "books" => 0, "writing" => 1, _ => 2 };

    /// <summary>
    /// Eine Abschrift lesen — <c>null</c>, wenn sie nicht Format 1 ist oder
    /// einen anderen Behälter nennt. Einträge ohne Kennung oder Art fallen weg.
    /// </summary>
    public static Snapshot? ReadSnapshot(Guid libraryId, string part, JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object) return null;
        if (!root.TryGetProperty("v", out var v) || v.ValueKind != JsonValueKind.Number || !v.TryGetInt32(out var version) || version != 1) return null;
        if (Str(root, "library") is string named && !string.Equals(named, Ids.ToText(libraryId), StringComparison.OrdinalIgnoreCase)) return null;

        var snap = new Snapshot
        {
            LibraryId = libraryId,
            Part = part,
            Name = Str(root, "name") ?? PartLabel(part),
            MadeAt = Str(root, "madeAt"),
            Notes = Str(root, "notes"),
            Kinds = root.TryGetProperty("kinds", out var kinds) && kinds.ValueKind == JsonValueKind.Array ? kinds : default
        };

        if (root.TryGetProperty("entries", out var entries) && entries.ValueKind == JsonValueKind.Array)
        {
            foreach (var e in entries.EnumerateArray())
            {
                var id = Str(e, "id");
                var kind = Str(e, "kind");
                if (id is null || kind is null) continue;
                snap.Items.Add(new Item
                {
                    Id = id.ToLowerInvariant(),
                    From = snap,
                    Kind = kind,
                    KindName = Str(e, "kindName") ?? kind,
                    TypeName = Str(e, "typeName"),
                    Kinds = Strs(e, "kinds"),
                    Title = Str(e, "title") ?? kind,
                    Tell = Str(e, "tell"),
                    Key = Str(e, "key"),
                    UpdatedAt = Str(e, "updatedAt"),
                    Refs = Strs(e, "refs").Select(r => r.ToLowerInvariant()).ToArray(),
                    Data = e.TryGetProperty("data", out var data) ? data : default
                });
            }
        }
        return snap;
    }

    private static readonly Regex Uuid = new("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", RegexOptions.CultureInvariant);

    /// <summary>Alle Texte und Zahlen der Daten — ohne Felder, die mit <c>_</c> beginnen, und ohne nackte Kennungen.</summary>
    public static string PlainOf(JsonElement data)
    {
        var lines = new List<string>();
        void Walk(JsonElement e, int depth)
        {
            if (depth > 12) return;
            switch (e.ValueKind)
            {
                case JsonValueKind.String:
                    var s = e.GetString();
                    if (!string.IsNullOrWhiteSpace(s) && !Uuid.IsMatch(s.Trim())) lines.Add(s.Trim());
                    break;
                case JsonValueKind.Number:
                    lines.Add(e.GetRawText());
                    break;
                case JsonValueKind.Array:
                    foreach (var one in e.EnumerateArray()) Walk(one, depth + 1);
                    break;
                case JsonValueKind.Object:
                    foreach (var p in e.EnumerateObject()) if (!p.Name.StartsWith('_') && p.Name is not "type" and not "id") Walk(p.Value, depth + 1);
                    break;
            }
        }
        Walk(data, 0);
        return string.Join('\n', lines);
    }

    /* -- Falten und Suchen ------------------------------------------------------------------- */

    private static readonly string?[] FoldTable = new string?[char.MaxValue + 1];

    /// <summary>Klein, ohne Akzente (ł → l), jeder Leerraum ein Leerzeichen — wie die Suche im Browser.</summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        var sb = new StringBuilder(text.Length);
        var space = false;
        foreach (var c in text)
        {
            if (char.IsWhiteSpace(c)) { space = sb.Length > 0; continue; }
            if (space) { sb.Append(' '); space = false; }
            if (c < 128) sb.Append(char.ToLowerInvariant(c));
            else sb.Append(FoldChar(c));
        }
        return sb.ToString();
    }

    private static string FoldChar(char c)
    {
        var known = FoldTable[c];
        if (known is not null) return known;
        string folded;
        if (c is 'ł' or 'Ł') folded = "l";
        else if (char.IsSurrogate(c)) folded = c.ToString();
        else
        {
            var parts = new StringBuilder(2);
            foreach (var x in c.ToString().Normalize(NormalizationForm.FormD))
                if (CharUnicodeInfo.GetUnicodeCategory(x) != UnicodeCategory.NonSpacingMark) parts.Append(char.ToLowerInvariant(x));
            folded = parts.ToString();
        }
        FoldTable[c] = folded;
        return folded;
    }

    /// <summary>Die Wörter einer Frage — gefaltet, jedes einmal, höchstens 12, je höchstens 64 Zeichen.</summary>
    public static List<string> Terms(string? query) =>
        Fold(query).Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.Length > 64 ? t[..64] : t).Distinct().Take(12).ToList();

    /// <summary>
    /// SUCHEN. Alle Wörter müssen vorkommen (in Titel, Schlüssel, Art oder
    /// Inhalt); vorne steht, was sie im Titel trägt, ein genau passender
    /// Schlüssel ganz vorne. Findet das nichts, zählt jedes Wort für sich
    /// (<c>all = false</c>). Ohne Wörter: alles, nach Teil, Art und Titel.
    /// </summary>
    public static (List<Item> Found, bool All) Find(IEnumerable<Item> items, string? query, string? part, string? kind)
    {
        var pool = items.Where(i => PartMatches(i, part) && KindMatches(i, kind)).ToList();
        var terms = Terms(query);
        if (terms.Count == 0) return (pool.OrderBy(i => PartOrder(i.From.Part)).ThenBy(i => Fold(i.KindName), StringComparer.Ordinal).ThenBy(i => i.FoldedTitle, StringComparer.Ordinal).ThenBy(i => i.Id, StringComparer.Ordinal).ToList(), true);

        var phrase = string.Join(' ', terms);
        int Score(Item i, bool all)
        {
            var hay = i.Haystack;
            var hits = terms.Count(t => hay.Contains(t, StringComparison.Ordinal));
            if (hits == 0 || (all && hits < terms.Count)) return 0;
            var score = hits;
            foreach (var t in terms) if (i.FoldedTitle.Contains(t, StringComparison.Ordinal)) score += 10;
            if (i.Key is not null && Fold(i.Key) == phrase) score += 50;
            if (i.FoldedTitle == phrase) score += 30;
            else if (terms.Count > 1 && i.FoldedTitle.Contains(phrase, StringComparison.Ordinal)) score += 15;
            else if (terms.Count > 1 && hay.Contains(phrase, StringComparison.Ordinal)) score += 5;
            return score;
        }

        List<Item> Rank(bool all) => pool.Select(i => (Item: i, Score: Score(i, all))).Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score).ThenBy(x => PartOrder(x.Item.From.Part)).ThenBy(x => x.Item.FoldedTitle, StringComparer.Ordinal).ThenBy(x => x.Item.Id, StringComparer.Ordinal)
            .Select(x => x.Item).ToList();

        var found = Rank(true);
        return found.Count > 0 || terms.Count == 1 ? (found, true) : (Rank(false), false);
    }

    private static bool PartMatches(Item i, string? part)
    {
        if (string.IsNullOrWhiteSpace(part)) return true;
        var p = part.Trim().ToLowerInvariant();
        return p == i.From.Part || p == Ids.ToText(i.From.LibraryId) || Fold(part) == Fold(i.From.Name);
    }

    private static bool KindMatches(Item i, string? kind)
    {
        if (string.IsNullOrWhiteSpace(kind)) return true;
        var k = Fold(kind);
        return Fold(i.Kind) == k || Fold(i.KindName) == k || Fold(i.TypeName) == k || i.Kinds.Any(x => Fold(x) == k);
    }

    private static readonly Regex LinkWords = new(@"\[\[([^\]|]+)\|@[^\]]+\]\]", RegexOptions.CultureInvariant);

    /// <summary>
    /// Ein Ausschnitt um die erste Fundstelle (oder der Anfang), etwa 240 Zeichen,
    /// an Wortgrenzen; Links aus dem Zapis zeigen nur ihre Worte.
    /// </summary>
    public static string Snippet(string plain, IReadOnlyList<string> terms, int width = 240)
    {
        var text = LinkWords.Replace(plain, "$1");
        if (text.Length == 0) return "";

        /* Gefaltet suchen, im Original schneiden: jedes gefaltete Zeichen weiss, woher es kommt. */
        var folded = new StringBuilder(text.Length);
        var from = new List<int>(text.Length);
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            var f = char.IsWhiteSpace(c) ? " " : c < 128 ? char.ToLowerInvariant(c).ToString() : FoldChar(c);
            foreach (var x in f) { folded.Append(x); from.Add(i); }
        }
        var hay = folded.ToString();
        var at = -1;
        foreach (var t in terms)
        {
            var i = hay.IndexOf(t, StringComparison.Ordinal);
            if (i >= 0 && (at < 0 || i < at)) at = i;
        }

        var start = at < 0 ? 0 : Math.Max(0, from[at] - width / 3);
        if (start > 0)
        {
            var space = text.LastIndexOfAny([' ', '\n'], start);
            start = space < 0 || start - space > 30 ? start : space + 1;
        }
        var end = Math.Min(text.Length, start + width);
        if (end < text.Length)
        {
            var space = text.IndexOfAny([' ', '\n'], end);
            end = space < 0 || space - end > 30 ? end : space;
        }
        var cut = Regex.Replace(text[start..end], @"\s+", " ").Trim();
        return $"{(start > 0 ? "…" : "")}{cut}{(end < text.Length ? "…" : "")}";
    }

    /* -- Öffnen ------------------------------------------------------------------------------ */

    private sealed class Opened : IDisposable
    {
        public required Guid Id { get; init; }
        public required DateTimeOffset Expires { get; init; }
        public required string Base { get; init; }
        /// <summary>Der Name des Bereichs — er steht offen da (wie in der Liste der Bereiche).</summary>
        public required string Area { get; init; }
        public List<Snapshot> Parts { get; } = [];
        /// <summary>Behälter dieses Links ohne (lesbare) Abschrift — noch nicht gebaut.</summary>
        public List<(Guid Library, string Part)> Missing { get; } = [];
        public List<JsonDocument> Docs { get; } = [];

        private Dictionary<string, Item>? byId;
        public IEnumerable<Item> Items => Parts.SelectMany(p => p.Items);

        public Item? Get(string idOrKey)
        {
            byId ??= Items.GroupBy(i => i.Id).ToDictionary(g => g.Key, g => g.First());
            var wanted = idOrKey.Trim();
            if (byId.TryGetValue(wanted.ToLowerInvariant(), out var found)) return found;
            var key = wanted.TrimStart('@');
            return Items.FirstOrDefault(i => i.Key is not null && string.Equals(i.Key, key, StringComparison.OrdinalIgnoreCase));
        }

        public string Url(Item item) => $"{Base}/entry/{item.Id}";

        public void Dispose()
        {
            foreach (var doc in Docs) doc.Dispose();
        }
    }

    private static int Count(string key)
    {
        var now = DateTime.UtcNow;
        var count = Calls.AddOrUpdate(key, (now, 1), (_, was) => now - was.Window > TimeSpan.FromMinutes(1) ? (now, 1) : (was.Window, was.Count + 1)).Count;
        if (Calls.Count > 20_000)
            foreach (var old in Calls.Where(p => now - p.Value.Window > TimeSpan.FromMinutes(2)).ToList()) Calls.TryRemove(old.Key, out _);
        return count;
    }

    private static Task Say(HttpContext ctx, int status, object body)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.Headers.CacheControl = "no-store";
        /* noindex: ein Link, der irgendwo auftaucht, kommt in keine Suche. Kein nofollow: der Assistent soll den Links folgen. */
        ctx.Response.Headers["X-Robots-Tag"] = "noindex";
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        if (WantsHtml(ctx.Request))
        {
            var html = Html(JsonSerializer.SerializeToElement(body, Out), ctx.Request.Path.Value ?? "");
            ctx.Response.ContentType = "text/html; charset=utf-8";
            ctx.Response.Headers.ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'";
            return HttpMethods.IsHead(ctx.Request.Method) ? Task.CompletedTask : ctx.Response.WriteAsync(html, ctx.RequestAborted);
        }
        if (HttpMethods.IsHead(ctx.Request.Method)) { ctx.Response.ContentType = "application/json; charset=utf-8"; return Task.CompletedTask; }
        return ctx.Response.WriteAsJsonAsync(body, Out, "application/json; charset=utf-8", ctx.RequestAborted);
    }

    /*
     * 2026-10-24 — DIESELBEN ANTWORTEN ALS SEITE. Abrufwerkzeuge eines Assistenten (ChatGPT im Netz)
     * öffnen nur Adressen, die wörtlich in einer schon gelesenen Seite als Link standen; eine Adresse
     * aus einer Vorlage („/search?q=<słowa>") bauen sie nicht. Wer HTML verlangt (Browser, solche
     * Werkzeuge), bekommt deshalb dieselben Daten als Seite, jede Adresse als echter Link — Teile,
     * Seiten der Liste, jeder Eintrag, seine Verweise und Rückverweise. JSON bleibt die Vorgabe
     * (Accept: application/json, ?format=json; ChatGPT-Aktionen); ?format=html erzwingt die Seite.
     */
    public static bool WantsHtml(HttpRequest request)
    {
        var format = request.Query["format"].ToString();
        if (format == "json") return false;
        if (format == "html") return true;
        if (request.Path.Value?.EndsWith("/openapi.json", StringComparison.Ordinal) == true) return false;
        var accept = request.Headers.Accept.ToString();
        return accept.Contains("text/html", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Ein JSON-Wert als einfache Seite: Felder als Liste, Adressen als Links (HTML-sicher).</summary>
    public static string Html(JsonElement root, string path)
    {
        var sb = new StringBuilder();
        sb.Append("<!doctype html><html lang=\"pl\"><head><meta charset=\"utf-8\"><title>REcreatio — dostęp dla AI</title>")
          .Append("<style>body{font:15px/1.45 system-ui,sans-serif;max-width:60rem;margin:1rem auto;padding:0 1rem}dl{margin:.2rem 0 .2rem 1rem}dt{font-weight:600}dd{margin:0 0 .3rem 1rem}li{margin:.15rem 0}</style></head><body>")
          .Append("<p>Ta sama odpowiedź jako JSON: <a href=\"").Append(Enc(path)).Append("?format=json\">").Append(Enc(path)).Append("?format=json</a></p>");
        void Value(JsonElement e, int depth)
        {
            if (depth > 14) { sb.Append('…'); return; }
            switch (e.ValueKind)
            {
                case JsonValueKind.Object:
                    sb.Append("<dl>");
                    foreach (var p in e.EnumerateObject())
                    {
                        if (p.Value.ValueKind == JsonValueKind.Null) continue;
                        sb.Append("<dt>").Append(Enc(p.Name)).Append("</dt><dd>");
                        Value(p.Value, depth + 1);
                        sb.Append("</dd>");
                    }
                    sb.Append("</dl>");
                    break;
                case JsonValueKind.Array:
                    sb.Append("<ol>");
                    foreach (var one in e.EnumerateArray()) { sb.Append("<li>"); Value(one, depth + 1); sb.Append("</li>"); }
                    sb.Append("</ol>");
                    break;
                case JsonValueKind.String:
                    Text(e.GetString() ?? "");
                    break;
                default:
                    sb.Append(Enc(e.GetRawText()));
                    break;
            }
        }
        /* Jede http(s)-Adresse im Text wird ein Link (ohne Platzhalter wie <słowa>). */
        void Text(string text)
        {
            var at = 0;
            foreach (Match m in UrlPattern.Matches(text))
            {
                sb.Append(Enc(text[at..m.Index]).Replace("\n", "<br>"));
                var url = m.Value.TrimEnd('.', ',', ';', ')');
                /* Eine Vorlage („…/entry/<id>") ist kein Link — sie stünde als toter Link da. */
                if (m.Index + url.Length < text.Length && text[m.Index + url.Length] == '<') continue;
                sb.Append("<a href=\"").Append(Enc(url)).Append("\">").Append(Enc(url)).Append("</a>");
                at = m.Index + url.Length;
            }
            sb.Append(Enc(text[at..]).Replace("\n", "<br>"));
        }
        Value(root, 0);
        return sb.Append("</body></html>").ToString();
    }

    private static readonly Regex UrlPattern = new(@"https?://[^\s<>""']+", RegexOptions.CultureInvariant);
    private static string Enc(string text) => System.Net.WebUtility.HtmlEncode(text);

    private static Task Gone(HttpContext ctx) =>
        Say(ctx, StatusCodes.Status404NotFound, new { error = "Ten link dostępu dla AI nie działa — nie ma go, wygasł albo został wyłączony." });

    /// <summary>Entpacken — mit einer Obergrenze, damit eine Abschrift den Dienst nicht füllt.</summary>
    public static byte[] Gunzip(byte[] data, long max = MaxOpened)
    {
        using var input = new MemoryStream(data);
        using var gz = new GZipStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();
        var buffer = new byte[81920];
        int n;
        while ((n = gz.Read(buffer, 0, buffer.Length)) > 0)
        {
            if (output.Length + n > max) throw new InvalidDataException("Odpis jest za duży.");
            output.Write(buffer, 0, n);
        }
        return output.ToArray();
    }

    /// <summary>
    /// DEN LINK EINLÖSEN — <c>null</c>: die Antwort ist schon gegeben (404, 429).
    /// Der Schlüssel aus dem Link und C leben nur in dieser Methode.
    /// </summary>
    private static async Task<Opened?> OpenAsync(HttpContext ctx, Db db, string token)
    {
        /*
         * Fehlversuche zählen je Adresse — aber erst NACH dem Nachschlagen: ein
         * gültiger Link wird nie abgewiesen, weil von derselben Adresse (bei einem
         * Anbieter von KI teilen sich viele eine) jemand Falsches probierte.
         */
        var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "?";
        async Task Miss()
        {
            if (Count($"miss:{ip}") > MissesPerMinute)
            {
                ctx.Response.Headers.RetryAfter = "60";
                await Say(ctx, StatusCodes.Status429TooManyRequests, new { error = "Za dużo nieudanych prób — spróbuj za minutę." });
            }
            else await Gone(ctx);
        }

        var secret = TokenOf(token);
        if (secret is null) { await Miss(); return null; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        Guid id = Guid.Empty, areaId = Guid.Empty, creator = Guid.Empty;
        byte[]? wrapped = null;
        var expires = DateTimeOffset.MinValue;
        var areaName = "";
        await using (var cmd = new SqlCommand("""
            SELECT a.id, a.area_id, a.account_id, a.key_wrapped, a.expires_at, ar.name
            FROM app.ai_access a JOIN app.area ar ON ar.id = a.area_id
            WHERE a.token_sha256 = @hash;
            """, connection))
        {
            cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                id = reader.GetGuid(0);
                areaId = reader.GetGuid(1);
                creator = reader.GetGuid(2);
                wrapped = reader.IsDBNull(3) ? null : (byte[])reader[3];
                expires = reader.GetDateTimeOffset(4);
                areaName = reader.IsDBNull(5) ? "" : reader.GetString(5);
            }
        }

        if (wrapped is null || expires <= DateTimeOffset.UtcNow)
        {
            await Miss();
            return null;
        }

        /* Der Link gilt nur, solange sein Urheber den Bereich prowadzi. */
        if (!await Area.MayAsync(connection, creator, areaId, Capability.Admin, ctx.RequestAborted))
        {
            await Gone(ctx);
            return null;
        }

        if (Count($"ai:{Ids.ToText(id)}") > PerMinute)
        {
            ctx.Response.Headers.RetryAfter = "60";
            await Say(ctx, StatusCodes.Status429TooManyRequests, new { error = $"Za dużo zapytań — najwyżej {PerMinute} na minutę. Spróbuj za chwilę." });
            return null;
        }

        var opened = new Opened
        {
            Id = id,
            Expires = expires,
            Area = areaName,
            Base = $"{ctx.Request.Scheme}://{ctx.Request.Host}{ctx.Request.PathBase}/ai/{secret}"
        };

        var linkKey = LinkKey(secret, id);
        byte[]? key = null;
        try
        {
            try
            {
                key = Crypto.Open(linkKey, WrapAad(id), wrapped);
            }
            catch (DecryptException)
            {
                await Gone(ctx);
                return null;
            }

            await using var parts = new SqlCommand("""
                SELECT p.library_id, l.kind, p.snapshot
                FROM app.ai_access_part p
                JOIN app.library l ON l.id = p.library_id AND l.area_id = @area
                WHERE p.access_id = @id
                ORDER BY CASE l.kind WHEN N'books' THEN 0 WHEN N'writing' THEN 1 ELSE 2 END, l.created_at;
                """, connection);
            parts.Parameters.AddWithValue("@id", id);
            parts.Parameters.AddWithValue("@area", areaId);
            await using var reader = await parts.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var library = reader.GetGuid(0);
                var part = reader.GetString(1);
                if (reader.IsDBNull(2)) { opened.Missing.Add((library, part)); continue; }
                try
                {
                    var json = Gunzip(Crypto.Open(key, SnapshotAad(library), (byte[])reader[2]));
                    var doc = JsonDocument.Parse(json);
                    var snap = ReadSnapshot(library, part, doc.RootElement);
                    if (snap is null) { doc.Dispose(); opened.Missing.Add((library, part)); continue; }
                    opened.Docs.Add(doc);
                    opened.Parts.Add(snap);
                }
                catch (Exception e) when (e is DecryptException or InvalidDataException or JsonException)
                {
                    opened.Missing.Add((library, part));
                }
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(linkKey);
            if (key is not null) CryptographicOperations.ZeroMemory(key);
        }

        await using (var used = new SqlCommand("UPDATE app.ai_access SET uses = uses + 1, last_used_at = SYSDATETIMEOFFSET() WHERE id = @id;", connection))
        {
            used.Parameters.AddWithValue("@id", id);
            await used.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        return opened;
    }

    /* -- Was der Assistent fragt ------------------------------------------------------------- */

    private static object Brief(Opened o, Item i, IReadOnlyList<string>? terms = null) => new
    {
        id = i.Id,
        title = i.Title,
        kind = i.KindName,
        type = i.TypeName,
        key = i.Key,
        part = i.From.Name,
        snippet = terms is null ? null : Snippet(i.Plain, terms),
        url = o.Url(i)
    };

    private static string PartWords(string part) => part switch
    {
        "books" => "Biblioteka — źródła: dzieła, cytaty, osoby",
        "writing" => "Skryptorium — własne teksty, ich wygłoszenia, projekty i rodzaje tekstów",
        _ => "Baza wiedzy (Cogita) — wpisy własnych rodzajów, pytania"
    };

    /// <summary>DIE ANLEITUNG — was es hier gibt, wie frisch es ist, und wie man fragt.</summary>
    private static async Task GuideAsync(HttpContext ctx, Db db, string token)
    {
        using var o = await OpenAsync(ctx, db, token);
        if (o is null) return;

        var notes = o.Parts.Select(p => p.Notes).Where(n => n is not null).Distinct().ToList();
        await Say(ctx, StatusCodes.Status200OK, new
        {
            about = "Dostęp tylko do odczytu, który właściciel obszaru w REcreatio utworzył dla asystenta AI. Obejmuje wyłącznie poniższe zbiory jednego obszaru — niczego nie da się tędy zmienić.",
            area = o.Area,
            expiresAt = o.Expires,
            parts = o.Parts.Select(p => new
            {
                id = Ids.ToText(p.LibraryId),
                part = p.Part,
                name = p.Name,
                what = PartWords(p.Part),
                entries = p.Items.Count,
                madeAt = p.MadeAt,
                browse = $"{o.Base}/search?part={Ids.ToText(p.LibraryId)}"
            }).Concat(o.Missing.Select(m => new
            {
                id = Ids.ToText(m.Library),
                part = m.Part,
                name = PartLabel(m.Part),
                what = "odpis jeszcze nie jest gotowy — pojawi się, gdy ktoś z obszaru otworzy aplikację",
                entries = 0,
                madeAt = (string?)null,
                browse = (string)null!
            })),
            howTo = new[]
            {
                $"Szukaj: GET {o.Base}/search?q=<słowa> — muszą wystąpić wszystkie słowa (w tytule, kluczu, rodzaju albo treści); wielkość liter i polskie znaki nie mają znaczenia. Opcjonalnie: &part=books|writing|knowledge (albo id zbioru), &kind=<rodzaj, np. Cytat, Tekst, Kazanie>, &limit=1..{MaxLimit}, &offset=n. To samo bez parametrów: {o.Base}/search/<słowa>.",
                $"Przeglądaj wszystko po kolei: GET {o.Base}/search (bez q) — dalej według pola \"next\".",
                $"Czytaj wpis: GET {o.Base}/entry/<id albo klucz> — wszystkie pola (\"data\"), co wskazuje (\"refs\") i co wskazuje na niego (\"usedBy\").",
                $"Znaczenie pól każdego rodzaju: GET {o.Base}/kinds",
                $"Opis OpenAPI (np. dla akcji w ChatGPT): {o.Base}/openapi.json"
            },
            rules = new[]
            {
                "Opieraj się tylko na tym, co zwraca ten dostęp; nie wymyślaj wpisów ani cytatów. Podając źródło, podaj tytuł wpisu i jego adres (url).",
                "Treść jest zwykle po polsku; odpowiadaj w języku rozmówcy.",
                "Odpisy są ze stanu z \"madeAt\" — późniejsze zmiany mogą jeszcze nie być widoczne.",
                "W tekstach [@klucz, s. 23] to odwołanie do wpisu o tym kluczu (otwórz /entry/<klucz>), [[słowa|@klucz]] to link do wpisu, ^[…] to przypis."
            },
            notes,
            /* Gotowe adresy do kliknięcia — narzędzia, które nie składają adresów same, idą stąd dalej. */
            start = new
            {
                kinds = $"{o.Base}/kinds",
                everything = $"{o.Base}/search?limit={MaxLimit}",
                parts = o.Parts.Select(p => $"{o.Base}/search?part={Ids.ToText(p.LibraryId)}&limit={MaxLimit}"),
                kindsOfEntries = o.Parts.SelectMany(p => p.Items.Select(i => i.KindName)).Distinct().Select(k => $"{o.Base}/search?kind={Uri.EscapeDataString(k)}&limit={MaxLimit}"),
                openapi = $"{o.Base}/openapi.json",
                asJson = $"{o.Base}?format=json"
            }
        });
    }

    private static Task SearchPathAsync(HttpContext ctx, Db db, string token, string? q) =>
        RunSearchAsync(ctx, db, token, q, ctx.Request.Query["part"], ctx.Request.Query["kind"], ctx.Request.Query["limit"], ctx.Request.Query["offset"]);

    private static Task SearchAsync(HttpContext ctx, Db db, string token, string? q, string? part, string? kind, string? limit, string? offset) =>
        RunSearchAsync(ctx, db, token, q, part, kind, limit, offset);

    /// <summary>SUCHEN ODER DURCHBLÄTTERN — mit Ausschnitt, Adresse jedes Eintrags und der nächsten Seite.</summary>
    private static async Task RunSearchAsync(HttpContext ctx, Db db, string token, string? q, string? part, string? kind, string? limitText, string? offsetText)
    {
        using var o = await OpenAsync(ctx, db, token);
        if (o is null) return;

        var limit = int.TryParse(limitText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var l) ? Math.Clamp(l, 1, MaxLimit) : DefaultLimit;
        var offset = int.TryParse(offsetText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var f) ? Math.Max(0, f) : 0;
        var terms = Terms(q);
        var (found, all) = Find(o.Items, q, part, kind);

        string? Next()
        {
            if (offset + limit >= found.Count) return null;
            var query = new List<string>();
            if (terms.Count > 0) query.Add($"q={Uri.EscapeDataString(q!.Trim())}");
            if (!string.IsNullOrWhiteSpace(part)) query.Add($"part={Uri.EscapeDataString(part.Trim())}");
            if (!string.IsNullOrWhiteSpace(kind)) query.Add($"kind={Uri.EscapeDataString(kind.Trim())}");
            query.Add($"limit={limit}");
            query.Add($"offset={offset + limit}");
            return $"{o.Base}/search?{string.Join('&', query)}";
        }

        await Say(ctx, StatusCodes.Status200OK, new
        {
            query = terms.Count == 0 ? null : q!.Trim(),
            match = terms.Count == 0 ? null : all ? "all words" : "some words (nothing had all of them)",
            total = found.Count,
            offset,
            limit,
            results = found.Skip(offset).Take(limit).Select(i => Brief(o, i, terms)),
            next = Next(),
            missing = o.Missing.Count == 0 ? null : $"{o.Missing.Count} zbiór/zbiory bez gotowego odpisu — ich wpisów tu jeszcze nie ma."
        });
    }

    /// <summary>EIN EINTRAG — ganz, mit dem, worauf er zeigt, und dem, was auf ihn zeigt (in diesem Zugang).</summary>
    private static async Task EntryAsync(HttpContext ctx, Db db, string token, string entry)
    {
        using var o = await OpenAsync(ctx, db, token);
        if (o is null) return;

        var item = o.Get(Uri.UnescapeDataString(entry));
        if (item is null)
        {
            await Say(ctx, StatusCodes.Status404NotFound, new { error = "Nie ma tu wpisu o takim id ani kluczu. Szukaj: " + $"{o.Base}/search?q=…" });
            return;
        }

        var kinds = item.Kinds.Length > 0 ? item.Kinds : [item.Kind];
        var schema = item.From.Kinds.ValueKind == JsonValueKind.Array
            ? item.From.Kinds.EnumerateArray().Where(k => Str(k, "id") is string kid && kinds.Contains(kid)).ToList()
            : [];
        var usedBy = o.Items.Where(other => other.Refs.Contains(item.Id)).Take(MaxUsedBy).Select(other => Brief(o, other)).ToList();

        await Say(ctx, StatusCodes.Status200OK, new
        {
            id = item.Id,
            url = o.Url(item),
            title = item.Title,
            kind = item.KindName,
            kindId = item.Kind,
            type = item.TypeName,
            tell = item.Tell,
            key = item.Key,
            part = item.From.Name,
            partKind = item.From.Part,
            updatedAt = item.UpdatedAt,
            data = item.Data.ValueKind == JsonValueKind.Undefined ? (JsonElement?)null : item.Data,
            schema,
            refs = item.Refs.Select(r => o.Get(r) is Item to ? Brief(o, to) : new { id = r, title = "(poza tym dostępem)", kind = (string?)null, type = (string?)null, key = (string?)null, part = (string?)null, snippet = (string?)null, url = (string?)null } as object),
            usedBy
        });
    }

    /// <summary>DIE ARTEN je Behälter: Name, wozu, Felder mit Bedeutung — aus dem Code des Browsers.</summary>
    private static async Task KindsAsync(HttpContext ctx, Db db, string token)
    {
        using var o = await OpenAsync(ctx, db, token);
        if (o is null) return;

        await Say(ctx, StatusCodes.Status200OK, new
        {
            parts = o.Parts.Select(p => new
            {
                id = Ids.ToText(p.LibraryId),
                part = p.Part,
                name = p.Name,
                kinds = p.Kinds.ValueKind == JsonValueKind.Array ? p.Kinds : (JsonElement?)null
            })
        });
    }

    /// <summary>OPENAPI 3.1 — für ChatGPT-Aktionen („Importuj z adresu URL"); der Server ist dieser Link.</summary>
    private static async Task OpenApiAsync(HttpContext ctx, Db db, string token)
    {
        using var o = await OpenAsync(ctx, db, token);
        if (o is null) return;

        object Text(string description) => new { type = "string", description };
        object Ok(string description) => new Dictionary<string, object>
        {
            ["200"] = new { description, content = new Dictionary<string, object> { ["application/json"] = new { schema = new { type = "object" } } } },
            ["404"] = new { description = "Link nie działa (nie ma go, wygasł, wyłączony) albo nie ma takiego wpisu." }
        };

        await Say(ctx, StatusCodes.Status200OK, new Dictionary<string, object>
        {
            ["openapi"] = "3.1.0",
            ["info"] = new
            {
                title = o.Area == "" ? "REcreatio — dostęp dla AI" : $"REcreatio — {o.Area}",
                version = "1",
                description = "Tylko odczyt: biblioteka, skryptorium i bazy wiedzy jednego obszaru. Zacznij od getGuide, szukaj searchEntries, czytaj getEntry."
            },
            ["servers"] = new[] { new { url = o.Base } },
            ["paths"] = new Dictionary<string, object>
            {
                ["/"] = new { get = new { operationId = "getGuide", summary = "Co tu jest, jak świeże, jak pytać", responses = Ok("Opis dostępu") } },
                ["/search"] = new
                {
                    get = new
                    {
                        operationId = "searchEntries",
                        summary = "Szukaj (wszystkie słowa) albo przeglądaj (bez q)",
                        parameters = new object[]
                        {
                            new { name = "q", @in = "query", required = false, schema = Text("Słowa; bez polskich znaków też znajdzie") },
                            new { name = "part", @in = "query", required = false, schema = Text("books, writing, knowledge albo id zbioru") },
                            new { name = "kind", @in = "query", required = false, schema = Text("Rodzaj, np. Cytat, Dzieło, Tekst, Kazanie") },
                            new { name = "limit", @in = "query", required = false, schema = new { type = "integer", minimum = 1, maximum = MaxLimit } },
                            new { name = "offset", @in = "query", required = false, schema = new { type = "integer", minimum = 0 } }
                        },
                        responses = Ok("Wyniki z fragmentem i adresem")
                    }
                },
                ["/entry/{id}"] = new
                {
                    get = new
                    {
                        operationId = "getEntry",
                        summary = "Cały wpis, jego odwołania i to, co na niego wskazuje",
                        parameters = new object[] { new { name = "id", @in = "path", required = true, schema = Text("id wpisu albo jego klucz (np. ratzinger2007)") } },
                        responses = Ok("Wpis")
                    }
                },
                ["/kinds"] = new { get = new { operationId = "getKinds", summary = "Rodzaje wpisów i znaczenie ich pól", responses = Ok("Rodzaje") } }
            }
        });
    }
}
