using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Api;
using Kernel;

/// <summary>
/// 2026-11-22 (0145) — DIE TEXTE JE TEXT (Abschrift Format 2): das Verzeichnis ohne Blöcke, die Blöcke in Stücken, die erst
/// beim Lesen geholt werden. Geprüft ohne Datenbank — die Stücke kommen aus einem Speicher im Test, versiegelt wie im Browser:
/// <list type="number">
///   <item>Format 1 und Format 2 derselben Blöcke geben dieselben Blöcke und dieselbe gerenderte Ausgabe (byte-gleich);</item>
///   <item>ein Stück mit falschem Hash, falschem Behälter oder fehlend: nur dieser Text, mit einem klaren Grund;</item>
///   <item>viele kleine Texte und ein zu grosser: alle kleinen lesbar, der grosse mit Grund, Wörtern, Bytes, Grenze;</item>
///   <item>ein weiterer grosser Text ändert an den anderen nichts; die Suche überspringt, was nicht lesbar ist, und sagt es;</item>
///   <item>das Budget eines Aufrufs: die Suche hört auf und sagt, wo sie weitermacht.</item>
/// </list>
/// </summary>
internal static class TextObjectChecks
{
    private static readonly Guid Library = Guid.Parse("01a16af6-5b29-76c6-8d33-426fc1048c6b");

    private static byte[] Gzip(string text)
    {
        using var output = new MemoryStream();
        using (var gz = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true)) gz.Write(Encoding.UTF8.GetBytes(text));
        return output.ToArray();
    }

    private static string Hash(string json) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();

    /* Blöcke, wie der Browser sie schreibt (aiSnapshot.ts) — mit allem, was ein Block tragen kann. */
    private static readonly string[] SampleBlocks =
    [
        """{"type":"heading","level":1,"loc":"J 21","at":"J 21","text":"Rozdział 21"}""",
        """{"type":"paragraph","loc":"J 21,15","at":"J 21,15","pages":[45,46],"text":"Szymonie, synu Jana, czy miłujesz Mnie [s. 46] więcej aniżeli ci?[^1]","search":"milujesz"}""",
        """{"type":"statement","at":"J 21,16","text":"Twierdzenie 2.3.","labels":["Twierdzenie 2.3"],"end":3,"within":["theorem"]}""",
        """{"type":"paragraph","at":"J 21,16","text":"Wzór $\\frac{a}{b}$ i słowo[?] […]","within":["theorem"],"search":"a/b"}""",
        """{"type":"page","text":"[s. 47]","pages":[47,47]}""",
        """{"type":"note","text":"[^1] Por. J 18,15-27."}"""
    ];

    public static async Task RunAsync(Action<bool, string> check)
    {
        check(Aad.FieldName(Field.AiText) == "ai_text" && AiAccess.TextAad(Library).Text == $"ai:text:{Ids.ToText(Library)}:ai_text:1",
            "0145: a text piece is sealed under C with the label of its collection (the browser's core/crypto.ts AiText)");

        var key = RandomNumberGenerator.GetBytes(32);
        var store = new Dictionary<string, byte[]>();
        string Put(IEnumerable<string> blocks)
        {
            var json = "{\"blocks\":[" + string.Join(",", blocks) + "]}";
            var h = Hash(json);
            store[h] = Crypto.Seal(key, AiAccess.TextAad(Library), Gzip(json));
            return h;
        }

        /* 1. Format 1 und Format 2 — dieselben Blöcke, dieselbe Ausgabe. */
        var allBlocks = string.Join(",", SampleBlocks);
        var v1 = $$"""{"v":1,"library":"{{Ids.ToText(Library)}}","name":"Teksty","texts":[{"id":"t1","work":"w1","scheme":"bible","parts":[{"key":"J","label":"Ewangelia","order":1,"blocks":[{{allBlocks}}]}]}]}""";
        var h1 = Put(SampleBlocks.Take(3));
        var h2 = Put(SampleBlocks.Skip(3));
        var v2 = $$"""
            {"v":2,"library":"{{Ids.ToText(Library)}}","name":"Teksty","texts":[
              {"id":"t1","work":"w1","scheme":"bible","state":"readable","words":30,"bytes":900,"limit":8388608,
               "parts":[{"key":"J","label":"Ewangelia","order":1,"blocks":6,"words":30,"chunks":[{"hash":"{{h1}}","from":0,"count":3,"bytes":400},{"hash":"{{h2}}","from":3,"count":3,"bytes":500}]}]}]}
            """;
        using var d1 = JsonDocument.Parse(v1);
        using var d2 = JsonDocument.Parse(v2);
        var s1 = AiAccess.ReadSnapshot(Library, "books", d1.RootElement)!;
        var s2 = AiAccess.ReadSnapshot(Library, "books", d2.RootElement)!;
        s2.LoadText = (hash, from, _) => Task.FromResult(store.TryGetValue(hash, out var blob) ? AiAccess.OpenTextObject(key, Library, hash, blob, from) : null);
        var t1 = s1.Texts[0];
        var t2 = s2.Texts[0];
        check(s2.Version == 2 && t2.Readable && !t2.Parts[0].Loaded && t2.Parts[0].Blocks.Count == 0 && t2.Parts[0].BlockCount == 6 && t2.Words == 30,
            "format 2: the index lists the text and its part (6 blocks, 30 words) without loading any block");
        await AiAccess.EnsureAsync(t2, t2.Parts[0], CancellationToken.None);
        var r1 = AiAccess.RenderBlocks(t1.Parts[0].Blocks);
        var r2 = AiAccess.RenderBlocks(t2.Parts[0].Blocks);
        string Fields(AiAccess.TextBlock b) => JsonSerializer.Serialize(new { b.Index, b.Type, b.Level, b.Loc, b.At, b.PageFrom, b.PageTo, b.Text, b.Labels, b.End, b.Within, b.Search });
        check(r1 == r2 && t1.Parts[0].Blocks.Select(Fields).SequenceEqual(t2.Parts[0].Blocks.Select(Fields)),
            "format 1 and format 2 of the same blocks: the same blocks and byte-identical rendering (two pieces joined in order)");
        check(AiAccess.Locate(t2.Parts[0], "Twierdzenie 2.3", "bible") == (2, 3) && AiAccess.Locate(t2.Parts[0], "s. 46", "bible") == AiAccess.Locate(t1.Parts[0], "s. 46", "bible")
            && AiAccess.Locate(t2.Parts[0], "J 21,15-16", "bible") == AiAccess.Locate(t1.Parts[0], "J 21,15-16", "bible"),
            "places, labels and pages find the same blocks in both formats");

        /* 2. Ein Stück, das nicht stimmt. */
        var wrongHash = false;
        try { AiAccess.OpenTextObject(key, Library, h2, store[h1], 0); } catch (InvalidDataException) { wrongHash = true; }
        var wrongLibrary = false;
        try { AiAccess.OpenTextObject(key, Guid.NewGuid(), h1, store[h1], 0); } catch (DecryptException) { wrongLibrary = true; }
        check(wrongHash && wrongLibrary, "a piece served under another address, or of another collection, is refused");

        /* 3./4. Viele kleine Texte, ein zu grosser, einer, der nicht ankam. */
        var small = Enumerable.Range(0, 30).Select(i => Put([$$"""{"type":"paragraph","loc":"nr {{i + 1}}","at":"nr {{i + 1}}","text":"Krótki tekst numer {{i + 1}} o łasce."}"""])).ToList();
        string TextJson(string id, string state, string? hash, int words = 6, long bytes = 120) =>
            $$"""{"id":"{{id}}","work":"w-{{id}}","workTitle":"Dzieło {{id}}","scheme":"numbered","state":"{{state}}","words":{{words}},"bytes":{{bytes}},"limit":8388608,"parts":[{"key":"p","label":"Całość","order":1,"blocks":1,"words":{{words}},"chunks":[{{(hash is null ? "" : $$"""{"hash":"{{hash}}","from":0,"count":1,"bytes":120}""")}}]}]}""";
        var many = string.Join(",", small.Select((h, i) => TextJson($"k{i}", "readable", h)));
        var big = TextJson("summa", "too_large", null, 4_200_000, 61_000_000);
        var lost = TextJson("lost", "readable", new string('a', 64));
        using var d3 = JsonDocument.Parse($$"""{"v":2,"library":"{{Ids.ToText(Library)}}","name":"Prywatna","texts":[{{many}},{{big}},{{lost}}]}""");
        var s3 = AiAccess.ReadSnapshot(Library, "books", d3.RootElement)!;
        s3.LoadText = s2.LoadText;
        s3.Budget = new AiAccess.LoadBudget();
        var readable = 0;
        foreach (var t in s3.Texts.Where(t => t.Id.StartsWith('k')))
        {
            await AiAccess.EnsureAsync(t, t.Parts[0], CancellationToken.None);
            if (t.Parts[0].Blocks.Count == 1) readable += 1;
        }
        var summa = s3.Texts.First(t => t.Id == "summa");
        string? why = null;
        try { await AiAccess.EnsureAsync(summa, summa.Parts[0], CancellationToken.None); } catch (AiAccess.TextUnavailable e) { why = e.Message; }
        check(readable == 30 && s3.Texts.Count == 32,
            "30 small texts stay readable next to a text that is too large and one whose piece never arrived — every text is listed");
        check(why is not null && why.Contains("too large") && why.Contains("4200000 words") && why.Contains("61000000 bytes") && why.Contains("limit 8388608"),
            $"the large text: a specific reason with words, bytes and the limit, never not_found ({why})");
        string? lostWhy = null;
        var lostText = s3.Texts.First(t => t.Id == "lost");
        try { await AiAccess.EnsureAsync(lostText, lostText.Parts[0], CancellationToken.None); } catch (AiAccess.TextUnavailable e) { lostWhy = e.Message; }
        check(lostWhy is not null && lostWhy.Contains("not_uploaded"), "a piece that is missing: only that text, said as not_uploaded");

        /* Noch ein grosser Text dazu: die anderen bleiben, wie sie waren. */
        using var d4 = JsonDocument.Parse($$"""{"v":2,"library":"{{Ids.ToText(Library)}}","name":"Prywatna","texts":[{{many}},{{big}},{{TextJson("fizyka", "too_large", null, 900_000, 20_000_000)}}]}""");
        var s4 = AiAccess.ReadSnapshot(Library, "books", d4.RootElement)!;
        s4.LoadText = s2.LoadText;
        check(s4.Texts.Count(t => t.Readable) == 30 && s3.Texts.Where(t => t.Readable && t.Id != "lost").Select(t => t.Id).SequenceEqual(s4.Texts.Where(t => t.Readable).Select(t => t.Id)),
            "adding another large book changes nothing about the readability of the others");

        /* Die Suche: über alle lesbaren, die anderen mit Grund. */
        var (searched, notReadable, stopped) = await AiMcpTools.LoadForSearchAsync(s4.Texts.ToList(), 0, CancellationToken.None);
        var hits = AiAccess.SearchTexts(searched, "łasce");
        check(searched.Count == 30 && hits.Count == 30 && notReadable.Count == 2 && notReadable.All(n => n.Contains("too large")) && stopped is null,
            "search_text over a collection with unreadable texts: all 30 readable ones searched, the two others named with their reason");

        /* 5. Das Budget: ist es fast aufgebraucht, hört die Suche auf und sagt, wo es weitergeht. */
        using var d5 = JsonDocument.Parse($$"""{"v":2,"library":"{{Ids.ToText(Library)}}","name":"Prywatna","texts":[{{many}}]}""");
        var s5 = AiAccess.ReadSnapshot(Library, "books", d5.RootElement)!;
        s5.LoadText = s2.LoadText;
        s5.Budget = new AiAccess.LoadBudget { Bytes = AiAccess.MaxTextLoadPerCall - 5 * 120 };
        var (part1, _, stop1) = await AiMcpTools.LoadForSearchAsync(s5.Texts.ToList(), 0, CancellationToken.None);
        s5.Budget.Bytes = 0;
        var (part2, _, stop2) = await AiMcpTools.LoadForSearchAsync(s5.Texts.ToList(), stop1 ?? 0, CancellationToken.None);
        check(part1.Count == 5 && stop1 == 5 && part2.Count == 25 && stop2 is null,
            "the reading budget of a call: the search stops after 5 texts and says fromText=5; the next call reads the remaining 25");
    }
}
