using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Api;
using Kernel;

/// <summary>
/// 0126 — DOSTĘP DLA AI: was der Dienst annimmt (Geheimnis, Hüllen, Stand, Behälter), die Bytes, die
/// mit dem Browser übereinstimmen müssen (Etiketten, der Schlüssel aus dem Link), und wie er eine
/// Abschrift liest, faltet, sucht und ausschneidet.
/// </summary>
internal static class AiAccessChecks
{
    public static void Run(Action<bool, string> check)
    {
        /* Die Etiketten sind die des Browsers (aiAccess/aiAccess.ts, core/crypto.ts). */
        check(Aad.FieldName(Field.AiAccessKey) == "ai_access_key" && Aad.FieldName(Field.AiAccessWrap) == "ai_access_wrap"
            && Aad.FieldName(Field.AiAccessLink) == "ai_access_link" && Aad.FieldName(Field.AiSnapshot) == "ai_snapshot", "0126: the AI access labels are the browser's");
        var id = Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab6918b");
        var library = Guid.Parse("01a16af6-5b29-76c6-8d33-426fc1048c6b");
        check(AiAccess.WrapAad(id).Text == "ai:access:01a16af6-5a94-718f-b8b5-abdb3ab6918b:ai_access_wrap:1"
            && AiAccess.SnapshotAad(library).Text == "ai:snapshot:01a16af6-5b29-76c6-8d33-426fc1048c6b:ai_snapshot:1", "0126: the wrap is bound to the access, a snapshot to its collection");

        /* Der Schlüssel aus dem Link — Vektor aus der Ableitung des Browsers (HKDF-SHA256, 32 Null-Bytes Salz). */
        const string token = "q3XyZ0abCDefGh1JKlmNoP2r";
        check(Convert.ToHexString(AiAccess.LinkKey(token, id)).ToLowerInvariant() == "2850b60870645281d2255a590dabcf3299774d567994b848e99a923b824a0357",
            "0126: the key from the link is HKDF over the UTF-8 of the secret, bound to the access id (same bytes as the browser)");
        check(Crypto.InfoAiAccess(id) == "recreatio:v1:ai-access:01a16af6-5a94-718f-b8b5-abdb3ab6918b", "0126: its info string is in the closed list");

        var key = Crypto.NewSymmetricKey();
        var wrapped = Crypto.Seal(AiAccess.LinkKey(token, id), AiAccess.WrapAad(id), key);
        check(Crypto.Open(AiAccess.LinkKey(token, id), AiAccess.WrapAad(id), wrapped).AsSpan().SequenceEqual(key), "0126: the link opens the key of its snapshots");
        check(Fails(() => Crypto.Open(AiAccess.LinkKey(token + "x", id), AiAccess.WrapAad(id), wrapped))
            && Fails(() => Crypto.Open(AiAccess.LinkKey(token, library), AiAccess.WrapAad(id), wrapped)), "0126: another secret or another access opens nothing");
        check(AiAccess.IsSealed(wrapped) && !AiAccess.IsSealed(new byte[60]) && !AiAccess.IsSealed(Encoding.UTF8.GetBytes("RC not really sealed bytes here.....")),
            "0126: only a symmetric envelope counts as one (the service does not open the area-key ones)");

        /* Was hereinkommt. */
        check(AiAccess.TokenOf(Token.NewSecret()) is not null && AiAccess.TokenOf(" " + token + " ") == token, "a secret from Kernel.Token is a link secret (trimmed)");
        check(AiAccess.TokenOf("kurz") is null && AiAccess.TokenOf("abc/def+ghi=jklmnopq") is null && AiAccess.TokenOf(new string('a', 129)) is null && AiAccess.TokenOf(null) is null,
            "anything else is no link: too short, not base64url, too long, nothing");
        check(AiAccess.EnvelopeOf(Base64Url.Encode(new byte[48]), out _) && !AiAccess.EnvelopeOf(Base64Url.Encode(new byte[47]), out _) && !AiAccess.EnvelopeOf(Base64Url.Encode(new byte[401]), out _),
            "a sealed key or secret: 48 to 400 bytes");
        check(AiAccess.IsMark("12.-345678.2026-10-24T10:00:00.1234567+00:00.2026-10-24T09:00:00+00:00") && !AiAccess.IsMark("1 2") && !AiAccess.IsMark(null) && !AiAccess.IsMark(new string('1', 121)),
            "the state of a collection as the service writes it — nothing else");
        var a = "01a0f4c1-bab6-7be5-bdfc-6f198a63ecea";
        check(AiAccess.LibrariesOf([a, a.ToUpperInvariant(), "01a0f4c1-bab6-7be5-bdfc-6f198a63eceb"]) is { Count: 2 } && AiAccess.LibrariesOf([]) is null && AiAccess.LibrariesOf(null) is null
            && AiAccess.LibrariesOf(["x"]) is null && AiAccess.LibrariesOf(Enumerable.Range(0, 21).Select(_ => Guid.NewGuid().ToString()).ToArray()) is null,
            "the collections of a link: ids, each once, 1 to 20");
        check(AiAccess.DayChoices.SequenceEqual([7, 30, 90, 365]), "a link lasts a week, a month, three months or a year");

        /* Falten wie der Browser. */
        check(AiAccess.Fold("  Łaska  ŻYCIA\nśw. Józef ") == "laska zycia sw. jozef", "folding: lower case, no accents, ł → l, one space");
        check(AiAccess.Terms("  Chleb chleb ŻYCIA ").SequenceEqual(["chleb", "zycia"]) && AiAccess.Terms(null).Count == 0, "the words of a question: folded, each once");

        /* Eine Abschrift lesen. */
        var json = $$$"""
            {"v":1,"library":"{{{library}}}","name":"Kazania","madeAt":"2026-10-24T12:00:00Z","notes":"## Zapis","kinds":[{"id":"text","name":"Tekst","fields":[{"key":"body","label":"Treść","type":"markup","says":"Treść"}]}],
             "entries":[
              {"id":"01A00000-0000-7000-8000-000000000021","kind":"text","kinds":["text","t"],"kindName":"Tekst","typeName":"Kazanie","title":"O chlebie życia","key":"chleb-zycia","refs":["01A00000-0000-7000-8000-000000000003"],
               "data":{"title":"O chlebie życia","body":"Na początku. {{{new string('x', 400)}}} Głód, którego [[chleb|@01a00000-0000-7000-8000-000000000003]] nie syci. Koniec.","_aliases":["sekret"],"textType":"01a00000-0000-7000-8000-000000000020","year":2026}},
              {"id":"01a00000-0000-7000-8000-000000000022","kind":"delivery","kindName":"Wygłoszenie","title":"Wygłoszenie 2026-08-02","refs":["01a00000-0000-7000-8000-000000000021"],"data":{"occasion":"Msza o 18:00"}},
              {"id":"01a00000-0000-7000-8000-000000000023","kind":"text","kindName":"Tekst","title":"Inny tekst","data":{"body":"O życiu."}},
              {"kind":"text","title":"bez kennung"}
             ]}
            """;
        using var doc = JsonDocument.Parse(json);
        var snap = AiAccess.ReadSnapshot(library, "writing", doc.RootElement);
        check(snap is { Name: "Kazania", MadeAt: "2026-10-24T12:00:00Z", Notes: "## Zapis" } && snap.Items.Count == 3 && snap.Items[0].Id == "01a00000-0000-7000-8000-000000000021" && snap.Items[0].Refs[0] == "01a00000-0000-7000-8000-000000000003",
            "a snapshot: its name, when, notes; entries without an id are dropped, ids in lower case");
        using (var other = JsonDocument.Parse(json.Replace(library.ToString(), Guid.NewGuid().ToString())))
            check(AiAccess.ReadSnapshot(library, "writing", other.RootElement) is null, "a snapshot naming another collection is refused");
        using (var newer = JsonDocument.Parse("""{"v":2,"entries":[]}"""))
            check(AiAccess.ReadSnapshot(library, "writing", newer.RootElement) is null, "an unknown format is refused");

        var plain = snap!.Items[0].Plain;
        check(plain.Contains("O chlebie życia") && plain.Contains("2026") && !plain.Contains("sekret") && !plain.Contains("01a00000-0000-7000-8000-000000000020"),
            "what an entry says: texts and numbers — not internal fields, not bare ids");

        /* Suchen. */
        var (found, all) = AiAccess.Find(snap.Items, "chleb ZYCIA", null, null);
        check(all && found.Count == 1 && found[0].Title == "O chlebie życia", "search: all words, any case and accents");
        (found, all) = AiAccess.Find(snap.Items, "zyc nigdzie", null, null);
        check(!all && found.Count == 2 && found[0].Title == "O chlebie życia", "nothing has all words: each word counts, the title first");
        check(AiAccess.Find(snap.Items, "chleb-zycia", null, null).Found[0].Key == "chleb-zycia", "a key is found exactly");
        check(AiAccess.Find(snap.Items, null, null, "Kazanie").Found.Count == 1 && AiAccess.Find(snap.Items, null, null, "wygloszenie").Found.Count == 1
            && AiAccess.Find(snap.Items, null, "books", null).Found.Count == 0 && AiAccess.Find(snap.Items, null, "writing", null).Found.Count == 3,
            "filters: the text type or kind by name (folded), the part");
        var listed = AiAccess.Find(snap.Items, " ", null, null).Found.Select(i => i.Title).ToList();
        check(listed.SequenceEqual(["Inny tekst", "O chlebie życia", "Wygłoszenie 2026-08-02"]), "without words: everything, by kind name, then title");

        /* Ausschneiden. */
        var cut = AiAccess.Snippet(plain, AiAccess.Terms("głód"));
        check(cut.StartsWith('…') && cut.Contains("Głód, którego chleb nie syci") && cut.Length <= 280, "a snippet around the first find, on word boundaries, links show only their words");
        check(AiAccess.Snippet("Krótko.", AiAccess.Terms("nic")) == "Krótko." && AiAccess.Snippet("", []) == "", "a short text is its own snippet");

        /* Dieselben Antworten als Seite: Adressen werden Links, Text bleibt Text. */
        using (var page = JsonDocument.Parse("""{"title":"<b>x</b>","url":"https://api.recreatio.pl/ai/T/entry/1","howTo":["GET https://api.recreatio.pl/ai/T/search?q=<słowa> — opis."]}"""))
        {
            var html = AiAccess.Html(page.RootElement, "/ai/T");
            check(html.Contains("<a href=\"https://api.recreatio.pl/ai/T/entry/1\">") && html.Contains("&lt;b&gt;x&lt;/b&gt;") && !html.Contains("<b>x")
                && !html.Contains("search?q=\">"), "as a page: every address is a real link, text is escaped, a template is no link");
        }
        /* 0127 — „J 21": kurze Wörter nur als ganzes Wort, die Folge an Wortgrenzen. */
        check(AiAccess.Has("j 21,15-17", "j") && !AiAccess.Has("jest", "j") && AiAccess.Has("j 21,15", "21") && !AiAccess.Has("rok 2021", "21") && AiAccess.Has("przyjaciel", "przy"),
            "search: 1–2 character words count only as whole words, longer ones also inside words");
        check(AiAccess.HasWords("komentarz do j 21,15-17", "j 21") && !AiAccess.HasWords("j 210", "j 21") && !AiAccess.HasWords("1 j 21x", "j 21"), "search: a phrase only at word boundaries");

        /* 0127 — Verweise mit ihrem Feld: Felder, Hüllen {value, locator}, Zellen {ref}, Zapis mit Schlüssel; Fremdes nur als Kennung. */
        const string g1 = "01a00000-0000-7000-8000-000000000101", o1 = "01a00000-0000-7000-8000-000000000102", bible = "01a00000-0000-7000-8000-000000000103", far = "01a00000-0000-7000-8000-000000000999";
        using (var linked = JsonDocument.Parse($$$"""
            {"v":1,"entries":[
              {"id":"01a00000-0000-7000-8000-000000000100","kind":"k","title":"Główny","data":{"grounds":["{{{g1}}}"],"objections":["{{{o1}}}","{{{far}}}"],
                "content":[{"type":"table","rows":[[[{"ref":"{{{bible}}}","locator":"J 21,15"}]]]}],"passage":{"value":"{{{bible}}}","locator":"J 21,15-17"},"note":"Zob. [@bt, J 18,17] i jan@example.com"}},
              {"id":"{{{g1}}}","kind":"k","title":"Uzasadnienie","data":{}},
              {"id":"{{{o1}}}","kind":"k","title":"Zarzut","data":{}},
              {"id":"{{{bible}}}","kind":"work","key":"bt","title":"Biblia Tysiąclecia","data":{}}]}
            """))
        {
            var snap2 = AiAccess.ReadSnapshot(library, "knowledge", linked.RootElement)!;
            AiAccess.Item? Resolve(string token) => snap2.Items.FirstOrDefault(i => i.Id == token.ToLowerInvariant() || i.Key == token);
            var links = AiAccess.LinksOf(snap2.Items[0], Resolve);
            check(links.Contains(new AiAccess.Link("grounds", g1, null, false)) && links.Contains(new AiAccess.Link("objections", o1, null, false)) && links.Contains(new AiAccess.Link("objections", far, null, true)),
                "links: each reference with its field (grounds, objections); an id outside the access is only marked outside");
            check(links.Contains(new AiAccess.Link("content", bible, "J 21,15", false)) && links.Contains(new AiAccess.Link("passage", bible, "J 21,15-17", false)) && links.Contains(new AiAccess.Link("note", bible, "J 18,17", false)),
                "links: cells, envelopes with their locator and markup by key; an e-mail address is no reference");
            check(links.Count == 6, $"links: nothing else ({links.Count})");
        }

        /* 0127 — OAuth: PKCE S256, Rücksprünge, iss, Token aus Links, bekannte CIMD-Anbieter. */
        const string verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        check(AiOAuth.PkceMatches(verifier, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM") && !AiOAuth.PkceMatches(verifier + "x", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM") && !AiOAuth.PkceMatches("short", "x"),
            "OAuth: PKCE S256 against the RFC 7636 example");
        check(AiOAuth.IsRedirect("https://chatgpt.com/connector_platform_oauth_redirect") && AiOAuth.IsRedirect("http://localhost:6274/oauth/callback") && !AiOAuth.IsRedirect("http://evil.example/cb") && !AiOAuth.IsRedirect("https://x.example/cb#frag") && !AiOAuth.IsRedirect("javascript:alert(1)"),
            "OAuth: redirects are https, or http only on this machine, never with a fragment");
        check(AiOAuth.Back("https://c.example/cb?x=1", "https://api.recreatio.pl", [("code", "abc"), ("state", "s ą"), ("error", null)]) == "https://c.example/cb?x=1&code=abc&state=s%20%C4%85&iss=https%3A%2F%2Fapi.recreatio.pl",
            "OAuth: every answer to the client carries iss (RFC 9207), values escaped, empty ones left out");
        check(AiMcp.SecretsOf($"{token}.{token}.bad!.{Token.NewSecret()}").Count == 2 && AiMcp.SecretsOf(null).Count == 0, "OAuth: an access token is the authorized links, dot-separated, each once");
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        check(AiOAuth.TrustedHost(config, "chatgpt.com") && AiOAuth.TrustedHost(config, "api.openai.com") && !AiOAuth.TrustedHost(config, "chatgpt.com.evil.example") && !AiOAuth.TrustedHost(config, "localhost"),
            "OAuth: client metadata documents only from known assistants (chatgpt.com, openai.com, claude.ai, anthropic.com)");
        check(Aad.FieldName(Field.AiOAuthCode) == "ai_oauth_code" && AiOAuth.CodeAad(id).Text == "ai:oauth:01a16af6-5a94-718f-b8b5-abdb3ab6918b:ai_oauth_code:1"
            && Crypto.InfoAiOAuthCode(id) == "recreatio:v1:ai-oauth-code:01a16af6-5a94-718f-b8b5-abdb3ab6918b", "OAuth: the code's seal is bound to its grant");

        /* Entpacken mit Obergrenze. */
        var packed = Gzip(new byte[1_000_000]);
        check(AiAccess.Gunzip(Gzip("{\"v\":1}"u8.ToArray())).Length == 7 && Fails(() => AiAccess.Gunzip(packed, 10_000)), "unpacking stops at its limit (no gzip bomb)");
    }

    private static bool Fails(Action act)
    {
        try { act(); return false; }
        catch (DecryptException) { return true; }
        catch (InvalidDataException) { return true; }
    }

    private static byte[] Gzip(byte[] data)
    {
        using var output = new MemoryStream();
        using (var gz = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true)) gz.Write(data);
        return output.ToArray();
    }
}
