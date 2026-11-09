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
            /* 0138 — eine Verbindung, die Bereiche dazubekommt, ohne neu anzumelden. */
            var conn = Guid.Parse("01a1b000-0000-7000-8000-000000000001");
            var other = Guid.Parse("01a1b000-0000-7000-8000-000000000002");
            check(Aad.FieldName(Field.AiMcpConnection) == "ai_mcp_connection" && Aad.FieldName(Field.AiMcpLink) == "ai_mcp_link"
                && AiMcpConnections.PrivateAad(conn).Text == "ai:mcp:01a1b000-0000-7000-8000-000000000001:ai_mcp_connection:1"
                && AiMcpConnections.LinkAad(conn, id).Text == "ai:mcp-01a1b000-0000-7000-8000-000000000001:01a16af6-5a94-718f-b8b5-abdb3ab6918b:ai_mcp_link:1"
                && Crypto.InfoAiMcpConnection(conn) == "recreatio:v1:ai-mcp-connection:01a1b000-0000-7000-8000-000000000001",
                "0138: a connection's private key is bound to it, a wrapped link to the connection AND the link");

            var secret = Token.NewSecret();
            var bearer = AiMcpConnections.Prefix + secret;
            check(AiMcpConnections.SecretOf(bearer) == secret && AiMcpConnections.SecretOf(" " + bearer + " ") == secret
                && AiMcpConnections.SecretOf(secret) is null && AiMcpConnections.SecretOf(AiMcpConnections.Prefix + "kurz") is null && AiMcpConnections.SecretOf(null) is null,
                "0138: a connection token is rcm~<secret>; a bare link secret is not one");
            check(AiMcp.SecretsOf(bearer).Count == 0 && AiMcp.SecretsOf($"{token}.{token}").Count == 1,
                "0138: a connection token is never read as a list of links, and old tokens (a list of links) still are");

            var (publicKey, privateSealed) = AiMcpConnections.NewKeys(secret, conn);
            var linkSecret = Token.NewSecret();
            var wrappedLink = AiMcpConnections.WrapLink(publicKey, conn, id, linkSecret);
            using (var opened = AiMcpConnections.OpenPrivate(secret, conn, privateSealed))
            {
                check(AiMcpConnections.UnwrapLink(opened, conn, id, wrappedLink) == linkSecret,
                    "0138: a link added later (wrapped with the public key, no token needed) opens with the connection's token");
                check(AiMcpConnections.UnwrapLink(opened, conn, library, wrappedLink) is null && AiMcpConnections.UnwrapLink(opened, other, id, wrappedLink) is null,
                    "0138: a wrapped link cannot be moved to another link or another connection");
            }
            check(Fails(() => AiMcpConnections.OpenPrivate(Token.NewSecret(), conn, privateSealed)) && Fails(() => AiMcpConnections.OpenPrivate(secret, other, privateSealed)),
                "0138: without the token (the database alone) or under another connection, the private key stays shut");
            check(privateSealed.AsSpan().IndexOf(Encoding.UTF8.GetBytes(secret)) == -1 &&wrappedLink.AsSpan().IndexOf(Encoding.UTF8.GetBytes(linkSecret)) == -1,
                "0138: neither the token nor a link secret is stored in the clear");

            /* Der Baum: der Elternteil ist der nächste FREIGEGEBENE Vorfahr — ein Bereich dazwischen erscheint nie. */
            Guid A = Guid.Parse("01a1b000-0000-7000-8000-00000000000a"), B = Guid.Parse("01a1b000-0000-7000-8000-00000000000b"),
                 C = Guid.Parse("01a1b000-0000-7000-8000-00000000000c"), D = Guid.Parse("01a1b000-0000-7000-8000-00000000000d"),
                 X = Guid.Parse("01a1b000-0000-7000-8000-0000000000ff");
            var tree = AiMcpTools.TreeOf(new Dictionary<Guid, IReadOnlyList<Guid>> { [A] = [X], [B] = [A, X], [C] = [D, B, A, X], [D] = [B, A, X] });
            check(tree[A] is { Parent: null, Depth: 0 } && tree[B].Parent == A && tree[D].Parent == B && tree[C].Parent == D && tree[C].Depth == 3
                && tree[A].Children.SequenceEqual([B]) && !tree.ContainsKey(X), "0138: the hierarchy of authorized areas — an unauthorized root stays out");
            var gap = AiMcpTools.TreeOf(new Dictionary<Guid, IReadOnlyList<Guid>> { [A] = [], [C] = [B, A] });
            check(gap[C].Parent == A && gap[C].Depth == 1 && gap[A].Children.SequenceEqual([C]) && !gap.ContainsKey(B),
                "0138: an unauthorized area in between is skipped, never named");
            check(AiMcpTools.ReadOnlyPermissions.SequenceEqual(["read"]), "0138: every authorized area is read-only");
        }

        {
            /* 2026-10-28 — die Formate der JSON-Importe für Assistenten (ImportFormats.json, aus der App erzeugt). */
            var importFormats = ImportFormats.All;
            string[] formatIds = ["library", "work-with-text", "source-text", "knowledge-base", "knowledge-forms", "scriptorium", "page", "area", "calendar-scheme", "calendar-plan", "registry", "guide-book", "guide-argument", "scheme-fakty", "scheme-zbior", "example-atom",
                /* 2026-10-29 — JSON für jeden Teil */
                "calendar", "masses", "tasks", "bookings", "chat", "contacts", "roles", "lamps", "persons", "workspace-view", "addresses", "learn-progress", "form", "form-entries", "quotes", "text-plan",
                /* 0137 — Wspólnoty */
                "community", "guide-community", "example-community-dk-rejon-13"];
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
            /* 2026-11-09 — die Weltkarte: ihr Leitfaden über MCP (spec §9, §13 Teil 6). */
            var worldGuide = AiMcpTools.GetImportFormat("guide-world-map");
            check(formatList.Formats.Any(f => f.Id == "guide-world-map" && f.Group == "Przewodniki dla AI") && worldGuide.Parts == 1 && worldGuide.Text.Contains("\"style\": \"world\"") && worldGuide.Text.Contains("\"part\": \"up\"") && worldGuide.Text.Contains("levelsSetup")
                && ImportFormats.Find("guide-stories")!.Parts.Any(p => p.Contains("guide-world-map")) && ImportFormats.Find("guide-schemes")!.Parts.Any(p => p.Contains("\"part\": \"up\"")),
                "MCP get_import_format: the world map guide (places, part blocks, lines, tickets, levels), linked from the stories guide; the schemes guide documents \"part\"");

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
                    "landscapes": [ { "view": "@fakty/w-krajobraz", "name": "Krajobraz", "cells": [ [ -1, 2, "@bosko/turyn", 0 ], [ 1, 2, "@bosko/zycie", 1 ] ], "ground": 14,
                      "areas": [ { "value": "@czas/okres-1", "label": "Młodość", "from": 0, "to": 90, "count": 1 }, { "value": "@czas/okres-2", "label": "Turyn", "from": 90, "to": 180, "count": 1 } ],
                      "regions": [ { "value": "@czas/okres-1", "label": "Młodość", "parent": null, "from": 0, "to": 90, "count": 1 } ] } ],
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
            /* 2026-11-03 (H) — die feste Karte jedes Krajobraz: im Ganzen dabei, auch als eigener Abschnitt; nie Höhen. */
            check(whole.Landscapes?.Count == 1 && whole.Landscapes[0]?["cells"]?.AsArray().Count == 2 && whole.Sections.Any(x => x.Name == "landscapes" && x.Items == 1)
                && whole.Document["landscapes"] is null && whole.Note.Contains("Landscapes =") && whole.Note.Contains("45 s"),
                "MCP get_knowledge_setup: the fixed map of every landscape view (cells, areas, regions), and the snapshot rule in the note");
            var onlyMaps = AiMcpTools.SetupOf(setupSnap, "krajobrazy", 0);
            check(onlyMaps.Section == "landscapes" && onlyMaps.Landscapes?.Count == 1 && onlyMaps.Document["landscapes"] is null && onlyMaps.Document["views"] is null && onlyMaps.NextOffset is null,
                "MCP get_knowledge_setup: the landscapes as their own section (Polish name too)");
            var onlyViews = AiMcpTools.SetupOf(setupSnap, "Widoki", 0);
            check(onlyViews.Section == "views" && onlyViews.Document["views"]?.AsArray().Count == 1 && onlyViews.Document["templates"] is null && onlyViews.Cards is null && onlyViews.NextOffset is null,
                "MCP get_knowledge_setup: one section by its Polish name");
            var later = AiMcpTools.SetupOf(setupSnap, "views", 1);
            check(later.Document["views"]?.AsArray().Count == 0 && !later.Complete && Fails(() => AiMcpTools.SetupOf(setupSnap, "postępy", 0)) == "not_found",
                "MCP get_knowledge_setup: paging past the end is empty; there is no section for progress");
            check(setupSnap.Items[0].Ref == "bosko/turyn" && setupSnap.Items[0].Id == "01a16af6-5a94-718f-b8b5-abdb3ab69201",
                "a knowledge entry keeps its lasting name from an import (ref)");
            /* 2026-11-03 — ein Odpis, der älter ist als die letzte Änderung, sagt es zuerst. */
            check(whole.SnapshotCurrent && !whole.Note.StartsWith("STALE"), "MCP get_knowledge_setup: a current snapshot says nothing about its age");
            setupSnap.Current = false;
            setupSnap.ChangedAt = "2026-11-03T09:00:00.0000000+00:00";
            var staleSetup = AiMcpTools.SetupOf(setupSnap, null, 0);
            check(!staleSetup.SnapshotCurrent && staleSetup.ChangedAt == setupSnap.ChangedAt && staleSetup.Note.StartsWith("STALE SNAPSHOT") && staleSetup.Note.Contains(setupSnap.ChangedAt),
                "MCP get_knowledge_setup: a snapshot older than the last change says so first, with when the base changed");
            setupSnap.Current = true;
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
            /* 2026-11-05 (Prompt 23, D6/D7) — die bleibenden Namen neben den Kennungen in den Daten (Werte, Listen, Verweise mit Stelle). */
            {
                using var namesDoc = JsonDocument.Parse("""{ "about": ["0190aaaa-1111-7000-8000-000000000001", "0190aaaa-1111-7000-8000-000000000009"], "explain": [{ "value": "0190aaaa-1111-7000-8000-000000000002", "locator": "s. 3" }], "prompt": "Wer ist 0190aaaa?", "n": 3 }""");
                var named = AiMcpTools.NamesIn(namesDoc.RootElement, id => id.EndsWith("0001") ? "@bosko/t/dom" : id.EndsWith("0002") ? "@bosko/slajd/s1" : null);
                check(named.Count == 2 && named["0190aaaa-1111-7000-8000-000000000001"] == "@bosko/t/dom" && named["0190aaaa-1111-7000-8000-000000000002"] == "@bosko/slajd/s1",
                    "MCP: names — each id in an entry's data with its lasting name, unnamed ids and prose left out");
                check(AiMcp.Instructions.Contains("includeData") && AiMcp.Instructions.Contains("@name"), "MCP instructions: read many entries in full with includeData, lasting names");
            }
            var leaky = System.Text.Json.Nodes.JsonNode.Parse("""
                { "settings": [ { "ref": "@s", "sources": [], "storageAreaId": "x", "progress": { "a": 1 } } ],
                  "revisions": [ { "ref": "@r", "marks": [ { "correctness": 1 } ], "graph": { "nodes": [ { "config": { "knowness": 0.7, "order": "general" } } ] } } ],
                  "forms": [ { "graph": { "nodes": [ { "config": { "fields": { "answers": { "show": true }, "tresc": { "learners": 2 } } } } ] } } ],
                  "views": [ { "columns": ["#knowness", "#due"] } ] }
                """)!;
            AiMcpTools.Scrub(leaky);
            var leakText = leaky.ToJsonString();
            check(!leakText.Contains("progress") && !leakText.Contains("storageAreaId") && !leakText.Contains("marks") && !leakText.Contains("correctness") && !leakText.Contains("\"knowness\"") && !leakText.Contains("learners")
                && leakText.Contains("\"order\":\"general\"") && leakText.Contains("\"answers\":{\"show\":true}") && leakText.Contains("#knowness"),
                "MCP get_knowledge_setup: nothing of a learner even if a snapshot carried it; settings only with their structure; a form field named „answers” and the column #knowness stay");
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

        /* 2026-11-01 — ein Lehrbuch: Aussagen (labels, end, within), Wzory als LaTeX, die Zeile für die Suche (search). */
        var mathSnap = """
            { "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab6918d", "name": "Podręczniki", "entries": [],
              "texts": [ { "id": "T2", "work": "W2", "workTitle": "Algebra", "scheme": "pages",
                "parts": [ { "key": "rozdz-3", "label": "Rozdział 3", "order": 3, "pages": [57, 58],
                  "blocks": [
                    { "type": "page", "pages": [57, 57], "text": "[s. 57]" },
                    { "type": "statement", "pages": [57, 57], "text": "Definicja 3.1 (iloczyn macierzy).", "labels": ["Definicja 3.1"], "end": 2, "within": ["definition"] },
                    { "type": "paragraph", "pages": [57, 57], "text": "Iloczyn: $$(AB)_{ik} = \\sum_{j} a_{ij} b_{jk}. \\tag{3.1}$$", "labels": ["(3.1)"], "within": ["definition"], "search": "(AB)ᵢₖ = ∑ⱼ aᵢⱼ bⱼₖ. (3.1)" },
                    { "type": "statement", "pages": [57, 57], "text": "Twierdzenie 3.2 (Cauchy'ego).", "labels": ["Twierdzenie 3.2"], "end": 6, "within": ["theorem"] },
                    { "type": "paragraph", "pages": [57, 58], "text": "Zachodzi $\\det(AB) = \\det A \\det B$ [s. 58].", "within": ["theorem"], "search": "det(AB) = det A det B" },
                    { "type": "statement", "pages": [58, 58], "text": "Dowód.", "end": 6, "within": ["theorem", "proof"] },
                    { "type": "paragraph", "pages": [58, 58], "text": "Z (3.1) wynika teza.", "within": ["theorem", "proof"] },
                    { "type": "paragraph", "pages": [58, 58], "text": "Dalej: koszt 5\\$." }
                  ] } ] } ] }
            """;
        using (var mathDoc = JsonDocument.Parse(mathSnap))
        {
            var msnap = AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab6918d"), "books", mathDoc.RootElement)!;
            var book = msnap.Texts.Single().Parts.Single();
            check(book.Blocks[3].Labels.SequenceEqual(["Twierdzenie 3.2"]) && book.Blocks[3].End == 6 && book.Blocks[5].Within.SequenceEqual(["theorem", "proof"]) && book.Blocks[2].Search!.Contains('∑'),
                "texts (2026-11-01): labels, the end of a statement, where a block stands and the search line are read");
            check(AiAccess.Locate(book, "Twierdzenie 3.2", "pages") == (3, 6) && AiAccess.Locate(book, "twierdzenie  3.2", "pages") == (3, 6) && AiAccess.Locate(book, "Definicja 3.1", "pages") == (1, 2),
                "texts: a statement by its label as printed — the whole statement with its proof");
            check(AiAccess.Locate(book, "(3.1)", "pages") == (2, 2) && AiAccess.Locate(book, "3.1", "pages") == (2, 2) && AiAccess.Locate(book, "Twierdzenie 9.9", "pages") is null && AiAccess.Locate(book, "s. 58", "pages") == (4, 7),
                "texts: an equation by its number, with or without brackets; a label that is not there is not guessed; pages still work");
            var rendered = AiAccess.RenderBlocks(book.Blocks.Skip(3).Take(4));
            check(rendered.StartsWith("> **Twierdzenie 3.2 (Cauchy'ego).**") && rendered.Contains("> Zachodzi $\\det(AB) = \\det A \\det B$") && rendered.Contains("> > **Dowód.**") && rendered.Contains("> > Z (3.1) wynika teza."),
                "texts: a statement and its proof as quotes (deeper: deeper), its head in bold, formulas as LaTeX");
            check(AiAccess.SearchTexts(msnap.Texts, "∑").Single().Block.Index == 2 && AiAccess.SearchTexts(msnap.Texts, "\\det").Count == 1 && AiAccess.SearchTexts(msnap.Texts, "Cauchy").Count == 1,
                "texts: a formula is found by its symbol (search line) and by its LaTeX");
        }

        Worlds(check);

        /* Entpacken mit Obergrenze. */
        var packed = Gzip(new byte[1_000_000]);
        check(AiAccess.Gunzip(Gzip("{\"v\":1}"u8.ToArray())).Length == 7 && Fails(() => AiAccess.Gunzip(packed, 10_000)), "unpacking stops at its limit (no gzip bomb)");
    }

    /// <summary>
    /// 2026-11-05 (Prompt 24) — VERWEISE IN ANDERE BAZY WIEDZY im MCP: „Fizyka" verweist auf „Historia" (geteilt), „Chemia" (nicht
    /// geteilt) und „sztuka" (unbekannt); „Historia" nennt keine „worlds" und findet „Fizyka" über deren eigenen Namen.
    /// </summary>
    private static void Worlds(Action<bool, string> check)
    {
        const string fiz = "01a16af6-5a94-718f-b8b5-abdb3ab69300", his = "01a16af6-5a94-718f-b8b5-abdb3ab69400", che = "01a16af6-5a94-718f-b8b5-abdb3ab69500";
        const string newton = "01a16af6-5a94-718f-b8b5-abdb3ab69301", praw = "01a16af6-5a94-718f-b8b5-abdb3ab69302", rew = "01a16af6-5a94-718f-b8b5-abdb3ab69401", maria = "01a16af6-5a94-718f-b8b5-abdb3ab69402";
        using var a = JsonDocument.Parse($$"""
            { "v": 1, "library": "{{fiz}}", "name": "Fizyka",
              "entries": [
                { "id": "{{newton}}", "kind": "topic", "kindName": "Temat", "title": "Prawa Newtona", "ref": "fizyka/newton",
                  "data": { "nazwa": "Prawa Newtona", "w-innych-swiatach": ["@@historia:@historia/rewolucja", "@@historia:@historia/f/rewolucja", "@@chemia:@chemia/atom"],
                            "tekst": "Newton żył w czasach [[Chwalebnej Rewolucji|@@historia:@historia/rewolucja]]; zob. też [[spór|@@historia:@historia/nie-ma]] i [[obraz|@@sztuka:@sztuka/obraz]], a w tej bazie [[pęd|@fizyka/ped]].",
                            "dalej": "{{praw}}" } },
                { "id": "{{praw}}", "kind": "topic", "kindName": "Temat", "title": "Pęd", "ref": "fizyka/ped", "data": {} } ],
              "setup": { "course": { "format": "recreatio.cogita.course", "version": 1, "name": "Fizyka",
                "settings": [ { "ref": "@ustawienia", "handle": "fizyka", "language": "pl",
                  "worlds": [ { "id": "{{his}}", "handle": "historia", "name": "Historia (stara nazwa)" }, { "id": "{{che}}", "handle": "chemia", "name": "Chemia" } ] } ] } } }
            """);
        using var b = JsonDocument.Parse($$"""
            { "v": 1, "library": "{{his}}", "name": "Historia",
              "entries": [
                { "id": "{{rew}}", "kind": "event", "kindName": "Wydarzenie", "title": "Chwalebna Rewolucja 1688", "ref": "historia/rewolucja", "data": { "streszczenie": "Rok 1688." } },
                { "id": "{{maria}}", "kind": "person", "kindName": "Osoba", "title": "Maria II", "ref": "historia/maria", "data": { "zob": "@@fizyka:@fizyka/newton" } } ],
              "setup": { "course": { "format": "recreatio.cogita.course", "version": 1, "name": "Historia",
                "flows": [ { "ref": "@historia/f/rewolucja", "name": "Chwalebna Rewolucja", "graph": { "nodes": [], "edges": [] } } ],
                "settings": [ { "ref": "@ustawienia", "handle": "historia" } ] } } }
            """);
        var A = AiAccess.ReadSnapshot(Guid.Parse(fiz), "knowledge", a.RootElement)!;
        var B = AiAccess.ReadSnapshot(Guid.Parse(his), "knowledge", b.RootElement)!;
        using var o = new AiAccess.Opened { Id = Guid.Empty, Expires = DateTimeOffset.MaxValue, Base = "/ai/T", Area = "Szkoła" };
        o.Parts.Add(A);
        o.Parts.Add(B);

        check(AiAccess.HandleOf(A) == "fizyka" && A.Handle == "fizyka" && B.Handle == "historia" && AiAccess.WorldsOf(A).Select(w => w.Handle).SequenceEqual(["historia", "chemia"]) && AiAccess.WorldsOf(B).Count == 0,
            "worlds (Prompt 24): a base's lasting name (handle) and the bases it links to (worlds) come from its settings");
        var crossRefs = AiAccess.CrossRefsOf(A.Items[0]);
        check(crossRefs.Count == 5 && crossRefs.Any(c => c.Field == "tekst" && c.Label == "spór" && c.Ref == "@historia/nie-ma") && crossRefs.Count(c => c.Text == "@@historia:@historia/rewolucja") == 1,
            "worlds: cross references from field values and markup, each once (field values first)");
        check(!AiAccess.LinksOf(A.Items[0], t => AiAccess.ItemIn(A, t) ?? AiAccess.ItemIn(B, t)).Any(l => l.Id == rew)
            && AiAccess.LinksOf(A.Items[0], t => AiAccess.ItemIn(A, t)).Any(l => l.Id == praw),
            "worlds: [[…|@@historia:@…]] is never read as an own reference (MarkupRef); own [[…|@fizyka/ped]] still is");

        var entry = AiMcpTools.EntryOf(o, newton);
        var toRew = entry.Links.FirstOrDefault(l => l.CrossBase && l.Id == rew);
        check(toRew is { Field: "w-innych-swiatach", Title: "Chwalebna Rewolucja 1688", Collection: "Historia", State: "ok", Outside: false, Ref: "@@historia:@historia/rewolucja" } && toRew.CollectionId == his
            && toRew.Url == $"/ai/T/entry/{rew}",
            "worlds: get_entry returns a cross link with the target, its base's name and id, state ok (the shared base's own name wins)");
        check(entry.Links.Any(l => l is { CrossBase: true, Kind: "flow", Id: "@historia/f/rewolucja", Title: "Chwalebna Rewolucja", State: "ok" }),
            "worlds: a story (flow) of the other base is a target too");
        check(entry.Links.Any(l => l is { CrossBase: true, State: "broken", Outside: true, Collection: "Historia", Title: null, Label: "spór" }),
            "worlds: a target that no longer exists in a shared base is broken — nothing invented");
        check(entry.Links.Any(l => l is { CrossBase: true, State: "outside", Collection: "Chemia", Title: null, Url: null } && l.CollectionId == che)
            && entry.Links.Any(l => l is { CrossBase: true, State: "outside", Collection: null, Ref: "@@sztuka:@sztuka/obraz" }),
            "worlds: a base not shared with this access is only named (as the linking base names it); an unknown name is outside without a name");
        check(entry.Links.Any(l => !l.CrossBase && l.Id == praw && l.Collection == "Fizyka" && l.CollectionId == fiz), "worlds: own links name their collection too");
        check(entry.Text.Contains("## W innych światach (oferty, nie wymagania)") && entry.Text.Contains("Chwalebnej Rewolucji [→ Historia: Chwalebna Rewolucja 1688 (inny świat, oferta)]")
            && entry.Text.Contains("(zerwany odnośnik"), "worlds: the readable text names the other world for every cross link, in markup too");

        var back = AiMcpTools.EntryOf(o, rew);
        check(back.LinkedFrom.Any(l => l is { CrossBase: true, Id: newton, Collection: "Fizyka", Field: "w-innych-swiatach" }),
            "worlds: the target lists who links to it from another base (linkedFrom, crossBase)");
        var viaHandle = AiMcpTools.EntryOf(o, maria);
        check(viaHandle.Links.Any(l => l is { CrossBase: true, Id: newton, State: "ok", Collection: "Fizyka" }),
            "worlds: without worlds, a name resolves to the shared base that names itself so (settings.handle)");
        check(AiMcpTools.EntryOf(o, "@@historia:@historia/rewolucja").Id == rew && AiMcpTools.EntryOf(o, "@@fizyka:" + newton).Id == newton
            && FailsMcp(() => AiMcpTools.EntryOf(o, "@@chemia:@chemia/atom")) == "not_found",
            "worlds: get_entry accepts \"@@handle:@name\" (and an id after the handle); an unshared base is not_found");

        var related = AiMcpTools.RelatedOf(o, newton, 1, "out", null, false);
        check(related.Nodes.Any(n => n.Id == rew && n.Collection == "Historia" && n.CollectionId == his) && related.Edges.Any(e => e is { From: newton, To: rew, CrossBase: true })
            && related.OutsideReferences >= 3, "worlds: get_related follows cross links into a shared base (edge crossBase); the others are only counted");
        var inward = AiMcpTools.RelatedOf(o, rew, 1, "in", null, false);
        check(inward.Nodes.Any(n => n.Id == newton) && inward.Edges.Any(e => e is { From: newton, To: rew, CrossBase: true }), "worlds: get_related in finds links from other bases");

        check(AiMcpTools.SearchOf(o, null, null, ["fizyka", "historia"], null, 50, 0, false).Total == 4
            && AiMcpTools.SearchOf(o, null, "Fizyka, Historia", null, null, 50, 0, false).Total == 4
            && AiMcpTools.SearchOf(o, null, "historia", null, null, 50, 0, false).Total == 2
            && AiMcpTools.SearchOf(o, "rewolucja", null, ["@@historia", his], null, 50, 0, false).Results.Single().CollectionId == his,
            "worlds: search_entries in several collections (a list, or comma-separated), by id, name or lasting name");

        var setup = AiMcpTools.SetupOf(A, null, 0, id => o.Parts.Any(p => p.LibraryId == id));
        check(setup.Handle == "fizyka" && setup.Worlds is { Count: 2 } w && w[0] is { Handle: "historia", Shared: true } && w[1] is { Handle: "chemia", Name: "Chemia", Shared: false }
            && setup.Document["settings"]?[0]?["handle"]?.GetValue<string>() == "fizyka" && setup.Document["settings"]?[0]?["worlds"]?.AsArray().Count == 2
            && setup.Note.Contains("never prerequisites"),
            "worlds: get_knowledge_setup names the base's handle and its worlds (shared or not), and keeps them in settings");
        check(AiMcp.Instructions.Contains("@@historia:@historia/rewolucja") && AiMcp.Instructions.Contains("never prerequisites"), "worlds: the MCP instructions explain cross-base links");
    }

    private static string FailsMcp(Action run)
    {
        try { run(); return "ran"; }
        catch (ModelContextProtocol.McpException e) { return e.Message.Split(':')[0]; }
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
