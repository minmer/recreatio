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

        {
            /* 2026-10-28 — die Formate der JSON-Importe für Assistenten (ImportFormats.json, aus der App erzeugt). */
            var importFormats = ImportFormats.All;
            string[] formatIds = ["library", "work-with-text", "source-text", "knowledge-base", "knowledge-forms", "scriptorium", "page", "area", "calendar-scheme", "calendar-plan", "registry", "guide-book", "guide-argument", "scheme-fakty", "scheme-zbior", "example-atom",
                /* 2026-10-29 — JSON für jeden Teil */
                "calendar", "masses", "tasks", "bookings", "chat", "contacts", "roles", "lamps", "persons", "workspace-view", "addresses", "learn-progress", "form", "form-entries", "quotes", "text-plan"];
            check(formatIds.All(x => ImportFormats.Find(x) is not null) && ImportFormats.Find(" PAGE ")?.Id == "page" && ImportFormats.Find("nic") is null && ImportFormats.Find(null) is null,
                "import formats: embedded in the program — the Library, Cogita, Scriptorium, pages, areas, calendar, registry, the AI guides and ready schemes");
            check(importFormats.Formats.All(f => f.Parts.Count > 0 && f.Parts.All(p => p.Length > 0) && (f.Parts.Count == 1 || f.Parts.All(p => p.Length <= 24_000)) && f.Where.Length > 0 && f.What.Length > 0),
                "import formats: each says what it is for and where it is imported, long ones in parts of at most 24 000 characters");
            var formatList = AiMcpTools.ListImportFormats();
            var formatPage = AiMcpTools.GetImportFormat("page");
            var formatLast = AiMcpTools.GetImportFormat("page", formatPage.Parts);
            check(formatList.Formats.Count == importFormats.Formats.Count && formatPage.Part == 1 && formatPage.Parts > 1 && formatPage.NextPart == 2 && formatPage.Contents.Any(c => c.Title.StartsWith("\"text\"")) && formatPage.Text.Contains("\"modules\"")
                && formatLast.NextPart is null && formatLast.Contents.Count == 0,
                "MCP get_import_format: the page format part by part — the first with the contents (each module kind and its part), the last without a next part");
            static string Fails(Action run) { try { run(); return "ran"; } catch (ModelContextProtocol.McpException e) { return e.Message.Split(':')[0]; } }
            check(Fails(() => AiMcpTools.GetImportFormat("nie-ma")) == "not_found" && Fails(() => AiMcpTools.GetImportFormat("library", 0)) == "not_found" && Fails(() => AiMcpTools.GetImportFormat("library", 2)) == "not_found",
                "MCP get_import_format: an unknown format or part says not_found");
            check(AiMcp.Instructions.Contains("list_import_formats") && AiMcp.Instructions.Contains("get_import_format"), "MCP instructions: read the format before preparing an import");

            /* 2026-10-30 — get_knowledge_setup: was das Lernen einer Baza wiedzy steuert, als Kurs ohne Einträge. */
            using var setupDoc = JsonDocument.Parse("""
                { "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab69200", "name": "Bosko",
                  "entries": [ { "id": "01a16af6-5a94-718f-b8b5-abdb3ab69201", "kind": "k1", "kindName": "Okres", "title": "Turyn", "ref": "bosko/turyn", "data": {} } ],
                  "setup": {
                    "course": { "format": "recreatio.cogita.course", "version": 1, "name": "Bosko",
                      "kinds": [ { "ref": "@czas/okres", "name": "Okres" } ],
                      "templates": [ { "ref": "@fakty/t-okres", "name": "Okres → lata", "kinds": ["@czas/okres"], "tests": [ { "of": "this", "weight": 1 } ], "graph": { "nodes": [], "edges": [] } } ],
                      "revisions": [ { "ref": "@fakty/p-ogolne", "name": "Od ogólnego do szczegółu", "graph": { "nodes": [ { "id": "p", "type": "strategy", "config": { "mode": "temporal", "order": "general", "pick": "weighted" } } ], "edges": [] } } ],
                      "views": [ { "ref": "@fakty/w-ogolne", "name": "Od ogólnego do szczegółu", "steps": [ { "type": "filter.when", "config": { "when": [ { "field": "#knowness", "rel": "before" } ] } } ] } ],
                      "settings": [ { "ref": "@ustawienia", "sources": [], "dependencies": [ { "parent": "@bosko/zycie", "child": "@bosko/turyn", "kind": "prerequisite", "impact": 0.5 } ] } ] },
                    "cards": { "total": 7, "questions": 1, "templates": [ { "ref": "@fakty/t-okres", "name": "Okres → lata", "kinds": ["Okres"], "cards": 6, "entries": 6 } ] },
                    "readers": "members" } }
                """);
            var setupSnap = AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab69200"), "knowledge", setupDoc.RootElement)!;
            setupSnap.AreaName = "Parafia";
            var whole = AiMcpTools.SetupOf(setupSnap, null, 0);
            check(whole.Complete && whole.Document["format"]?.GetValue<string>() == "recreatio.cogita.course" && whole.Document["entities"] is null
                && whole.Document["revisions"]?[0]?["graph"]?["nodes"]?[0]?["config"]?["order"]?.GetValue<string>() == "general"
                && whole.Cards?["templates"]?[0]?["cards"]?.GetValue<int>() == 6 && whole.Readers == "Czytają ją członkowie obszaru „Parafia” (i ci, którym dali link albo miejsce)."
                && whole.Sections.Any(x => x.Name == "views" && x.Items == 1) && whole.Note.Contains("No learner progress"),
                "MCP get_knowledge_setup: the course without entries (templates, revisions with all settings, views, settings), cards per template, who reads");
            var onlyViews = AiMcpTools.SetupOf(setupSnap, "Widoki", 0);
            check(onlyViews.Section == "views" && onlyViews.Document["views"]?.AsArray().Count == 1 && onlyViews.Document["templates"] is null && onlyViews.Cards is null && onlyViews.NextOffset is null,
                "MCP get_knowledge_setup: one section by its Polish name");
            var later = AiMcpTools.SetupOf(setupSnap, "views", 1);
            check(later.Document["views"]?.AsArray().Count == 0 && !later.Complete && Fails(() => AiMcpTools.SetupOf(setupSnap, "postępy", 0)) == "not_found",
                "MCP get_knowledge_setup: paging past the end is empty; there is no section for progress");
            check(setupSnap.Items[0].Ref == "bosko/turyn" && setupSnap.Items[0].Id == "01a16af6-5a94-718f-b8b5-abdb3ab69201",
                "a knowledge entry keeps its lasting name from an import (ref)");
            using var oldBase = JsonDocument.Parse("""{ "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab69200", "name": "Stara", "entries": [] }""");
            check(Fails(() => AiMcpTools.SetupOf(AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab69200"), "knowledge", oldBase.RootElement)!, null, 0)) == "not_ready"
                && AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab69200"), "books", setupDoc.RootElement)!.Setup.ValueKind == JsonValueKind.Undefined,
                "MCP get_knowledge_setup: a snapshot from before says not_ready; only a knowledge base carries a setup");
            var big = new System.Text.StringBuilder("""{ "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab69200", "name": "Duża", "entries": [], "setup": { "course": { "format": "recreatio.cogita.course", "version": 1, "name": "Duża", "settings": [ {} ], "views": [""");
            for (var i = 0; i < 40; i++) big.Append(i == 0 ? "" : ",").Append($$"""{ "ref": "@w{{i}}", "name": "{{new string('x', 3000)}}" }""");
            big.Append("] } } }");
            using var bigDoc = JsonDocument.Parse(big.ToString());
            var bigSnap = AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab69200"), "knowledge", bigDoc.RootElement)!;
            var bigOverview = AiMcpTools.SetupOf(bigSnap, null, 0);
            var bigFirst = AiMcpTools.SetupOf(bigSnap, "views", 0);
            var pages = new List<AiMcpTools.KnowledgeSetupResult> { bigFirst };
            while (pages[^1].NextOffset is int next && pages.Count < 10) pages.Add(AiMcpTools.SetupOf(bigSnap, "views", next));
            check(!bigOverview.Complete && bigOverview.Document["views"] is null && bigOverview.Document["settings"] is not null && bigOverview.Note.Contains("per section")
                && (bigFirst.NextOffset ?? 0) > 0 && (bigFirst.NextOffset ?? 99) < 40 && bigFirst.Document.ToJsonString().Length <= AiMcpTools.SetupBudget + 4000
                && pages.Count is > 1 and < 10 && pages.All(x => x.Document.ToJsonString().Length <= AiMcpTools.SetupBudget + 4000)
                && pages.Sum(x => x.Document["views"]!.AsArray().Count) == 40 && pages.SelectMany(x => x.Document["views"]!.AsArray()).Select(v => v!["ref"]!.GetValue<string>()).Distinct().Count() == 40,
                "MCP get_knowledge_setup: a large base — an overview, then a section in pieces with nextOffset");
            check(AiMcp.Instructions.Contains("get_knowledge_setup"), "MCP instructions: name get_knowledge_setup");
        }

        /* 2026-10-24 — vollständige Texte in der Abschrift: lesen, eine Stelle finden, suchen. */
        var textSnap = """
            { "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab6918c", "name": "Pismo", "entries": [],
              "texts": [ { "id": "T1", "work": "W1", "workTitle": "Biblia Tysiąclecia", "workKey": "bt", "scheme": "bible",
                "parts": [ { "key": "J", "label": "Ewangelia według św. Jana", "order": 43, "first": "J 21", "last": "J 21,17", "pages": [100, 101],
                  "blocks": [
                    { "type": "heading", "level": 1, "loc": "J 21", "at": "J 21", "text": "Rozdział 21" },
                    { "type": "heading", "level": 2, "at": "J 21", "text": "Jezus nad jeziorem" },
                    { "type": "paragraph", "loc": "J 21,15", "at": "J 21,15", "pages": [100, 100], "text": "Szymonie, synu Jana, czy miłujesz Mnie?" },
                    { "type": "paragraph", "loc": "J 21,16", "at": "J 21,16", "pages": [100, 101], "text": "I drugi raz [s. 101] powiedział do niego." },
                    { "type": "paragraph", "loc": "J 21,17", "at": "J 21,17", "pages": [101, 101], "text": "Po raz trzeci: czy kochasz Mnie?" }
                  ] } ] } ] }
            """;
        using (var textDoc = JsonDocument.Parse(textSnap))
        {
            var tsnap = AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab6918c"), "books", textDoc.RootElement)!;
            var text = tsnap.Texts.Single();
            var part = text.Parts.Single();
            check(text.Id == "t1" && text.Work == "w1" && text.WorkTitle == "Biblia Tysiąclecia" && part.Blocks.Count == 5 && part.Pages is [100, 101] && part.Blocks[3].PageTo == 101,
                "texts: a snapshot's full texts are read with work, parts, places and pages");
            check(AiAccess.Locate(part, "J 21,16", "bible") == (3, 3) && AiAccess.Locate(part, "j 21:16", "bible") == (3, 3) && AiAccess.Locate(part, "J 21", "bible") == (0, 4),
                "texts: a verse, written any way; a chapter is the whole unit (its headings too)");
            check(AiAccess.Locate(part, "J 21,15-16", "bible") == (2, 3) && AiAccess.Locate(part, "J 21,15–J 21,17", "bible") == (2, 4) && AiAccess.Locate(part, "J", "bible") == (0, 4),
                "texts: ranges (the end as a number or a place) and a whole book");
            check(AiAccess.Locate(part, "s. 101", "bible") == (3, 4) && AiAccess.Locate(part, "J 20,1", "bible") is null && AiAccess.Locate(part, "J 2", "bible") is null,
                "texts: pages; a place that is not there is not guessed (J 2 is not J 21)");
            /* 2026-10-27 — Seiten in Serien, für jedes Buch: dieselben Zahlen wie in der App (locations.ts readPage, seriesIndex; app-library-check prüft dieselben Werte). */
            check(AiAccess.PageValue("45") == 45 && AiAccess.PageValue("xii") == -9_988 && AiAccess.PageValue("12*") == 618_500_012 && AiAccess.PageValue("A12") == 1_430_200_012
                && AiAccess.SeriesIndex("#*") == 6185 && AiAccess.SeriesIndex("A#") == 14302 && AiAccess.PageValue("3’’") == AiAccess.PageValue("3''") && AiAccess.PageValue("abc") is null && AiAccess.PageValue("12a") is null,
                "texts: a printed page as a number — plain as it is, roman before 1, every other series in the band of its pattern, the same numbers as the app");
            check(AiAccess.PageWord(618_500_012) == "12*" && AiAccess.PageWord(AiAccess.PageValue("(7)")!.Value) == "(7)" && AiAccess.PageWord(AiAccess.PageValue("[7]")!.Value) == "[7]"
                && AiAccess.PageWord(AiAccess.PageValue("†3")!.Value) == "†3" && AiAccess.PageWord(AiAccess.PageValue("iv*")!.Value) == "iv*" && AiAccess.PageWord(-9_988) == "xii",
                "texts: pages of any series written back as printed (12*, (7), [7], †3, iv*, xii)");
            AiAccess.RememberSeries(["Q#"]);
            check(AiAccess.PageWord(AiAccess.SeriesIndex("Q#") * 100_000 + 5) == "Q5", "texts: a series named by the snapshot (pageSeries) is written back before any of its pages was read");
            var missal = new AiAccess.TextPart { Key = "wstep", Label = "Wstęp", Order = 0, Pages = [618_500_012, 618_500_013] };
            missal.Blocks.Add(new AiAccess.TextBlock { Index = 0, Type = "paragraph", PageFrom = 618_500_012, PageTo = 618_500_012, Text = "a" });
            missal.Blocks.Add(new AiAccess.TextBlock { Index = 1, Type = "paragraph", PageFrom = 618_500_013, PageTo = 618_500_013, Text = "b" });
            missal.Blocks.Add(new AiAccess.TextBlock { Index = 2, Type = "paragraph", PageFrom = 13, PageTo = 13, Text = "c" });
            missal.Blocks.Add(new AiAccess.TextBlock { Index = 3, Type = "paragraph", PageFrom = 1_430_200_013, PageTo = 1_430_200_013, Text = "d" });
            check(AiAccess.Locate(missal, "s. 13*", "pages") == (1, 1) && AiAccess.Locate(missal, "s. 12*–13*", "pages") == (0, 1) && AiAccess.Locate(missal, "s. 13", "pages") == (2, 2) && AiAccess.Locate(missal, "s. A13", "pages") == (3, 3),
                "texts: a page of a series is found by its marks; 13* and A13 are not 13");
            check(AiAccess.PlaceMatches("2.0121", "2.01", "decimal") && AiAccess.PlaceMatches("I, q. 2, a. 3, ad 1", "I, q. 2, a. 3", "aquinas") && AiAccess.PlaceMatches("nr 24 § 1", "nr 24", "numbered") && !AiAccess.PlaceMatches("§ 430", "§ 43", "sections"),
                "texts: units in every scheme — decimal comments, Aquinas articles, paragraphs of a number; § 430 is not § 43");
            var hitsT = AiAccess.SearchTexts(tsnap.Texts, "milujesz mnie");
            check(hitsT.Count == 1 && hitsT[0].Block.Index == 2 && AiAccess.SearchTexts(tsnap.Texts, "Mnie").Count == 2, "texts: search without Polish letters finds the block");
            check(AiAccess.RenderBlocks(part.Blocks.Take(3)).StartsWith("## [J 21] Rozdział 21") && AiAccess.RenderBlocks(part.Blocks.Skip(2).Take(1)) == "[J 21,15] Szymonie, synu Jana, czy miłujesz Mnie?",
                "texts: rendered with headings and each block's own place");
        }

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
