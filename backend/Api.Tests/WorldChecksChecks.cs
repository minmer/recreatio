using System.Text.Json;
using Api;
using ModelContextProtocol;

/// <summary>
/// 2026-11-22 (Eigentümer, „Gute Welten", I2, I6, I12) — DIE KONTROLLE EINER WELT IM DIENST (<c>get_world_checks</c>, dasselbe
/// gebündelte TypeScript wie in der App, mit Jint auf der Abschrift der Baza), die Uwagi in der Abschrift (eine erledigte mit
/// ihrer Notiz; ein Import, der eine erledigt) und ein Dokument in Teilen für <c>check_import</c>.
/// </summary>
internal static class WorldChecksChecks
{
    private const string Kind = "0199bbbb-0000-7000-8000-000000000001";
    private const string Tower = "0199bbbb-0000-7000-8000-000000000011";
    private const string Flash = "0199bbbb-0000-7000-8000-000000000021";

    private static readonly string Snapshot = """
        { "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab69302", "part": "knowledge", "name": "Świat", "madeAt": "2026-11-22T10:00:00Z",
          "kinds": [ { "id": "KIND", "name": "Temat nauki" } ],
          "entries": [
            { "id": "TOWER", "kind": "KIND", "kinds": ["KIND"], "title": "Ruch", "ref": "swiat/ruch", "data": { "nazwa": "Ruch" } },
            { "id": "FLASH", "kind": "question", "kinds": ["question"], "title": "Co to jest ruch?", "ref": "swiat/q-flash", "data": { "form": "flash", "prompt": "Co to jest ruch?", "back": "Zmiana położenia.", "about": ["TOWER"] } }
          ],
          "setup": {
            "course": { "format": "recreatio.cogita.course", "version": 1, "name": "Świat",
              "kinds": [ { "ref": "@swiat/temat", "name": "Temat nauki", "label": "{nazwa}", "fields": [ { "key": "nazwa", "label": "Nazwa", "type": "line" } ] } ] },
            "feedback": [
              { "id": "0199bbbb-0000-7000-8000-0000000000f1", "state": "open", "category": "wrong", "means": "content is wrong", "target": { "kind": "question", "entity": "@swiat/q-flash", "shownAs": "Co to jest ruch?" }, "text": "To nie jest pytanie.", "at": "2026-11-21T10:00:00Z" },
              { "id": "0199bbbb-0000-7000-8000-0000000000f2", "state": "done", "category": "language", "means": "language", "target": { "kind": "question", "entity": "@swiat/q-flash", "shownAs": "Co to jest ruch?" }, "text": "Literówka.", "at": "2026-11-20T10:00:00Z", "note": "Poprawione w imporcie.", "doneAt": "2026-11-22T09:00:00Z" }
            ] } }
        """.Replace("KIND", Kind).Replace("TOWER", Tower).Replace("FLASH", Flash);

    public static async Task RunAsync(Action<bool, string> check)
    {
        using var snapDoc = JsonDocument.Parse(Snapshot);
        var snap = AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab69302"), "knowledge", snapDoc.RootElement)!;
        var baseJson = ImportCheck.BaseJsonOf(snap);
        check(baseJson.Contains("\"feedback\"") && baseJson.Contains("0199bbbb-0000-7000-8000-0000000000f1"), "the base for the checks carries its feedback (ids, state, target)");

        /* 1. Die Kontrolle der Welt — mit Jint, aus der Abschrift. */
        var outcome = await ImportCheck.RunWorldChecksAsync(baseJson, "en", CancellationToken.None);
        var all = AiMcpTools.WorldChecksOf(outcome.Json, snap.Name, "x", true, snap.MadeAt);
        check(all.Findings.Any(f => f.Code == "question.flash" && f.Weight == "must" && f.Entity?.Name == "@swiat/q-flash" && f.Tower?.Label == "Ruch"),
            $"a flash question is a must, with its lasting name and tower: {string.Join(" | ", all.Findings.Select(f => $"{f.Weight} {f.Code} {f.Entity?.Name}"))}");
        check(all.Findings.Count(f => f.Code == "feedback.open") == 1 && all.FeedbackOpen == 1, "one open feedback item (the done one does not count)");
        check(all.Findings.Any(f => f.Code == "levels.standard" && f.Weight == "info"), "levels different from the standard are only info");
        check(all.Must >= 1 && all.Must + all.Should + all.Info == all.Total && all.Towers == 1 && all.Questions == 1, $"counts and size: must {all.Must}, total {all.Total}, towers {all.Towers}");
        check(all.Codes.Sum(c => c.Count) == all.Total, "the counts per code add up");
        check(outcome.Milliseconds < 60_000, $"it runs in time ({outcome.Milliseconds} ms)");

        /* 2. Filter und Seiten. */
        var must = AiMcpTools.WorldChecksOf(outcome.Json, snap.Name, "x", true, null, weight: "must");
        check(must.Findings.All(f => f.Weight == "must") && must.Total == all.Must, "filter by weight");
        var questions = AiMcpTools.WorldChecksOf(outcome.Json, snap.Name, "x", true, null, code: "question.");
        check(questions.Findings.Count > 0 && questions.Findings.All(f => f.Code.StartsWith("question.", StringComparison.Ordinal)), "filter by a code prefix");
        var exact = AiMcpTools.WorldChecksOf(outcome.Json, snap.Name, "x", true, null, code: "question.flash");
        check(exact.Total == 1, "filter by an exact code");
        var byEntity = AiMcpTools.WorldChecksOf(outcome.Json, snap.Name, "x", false, null, entity: "@swiat/q-flash");
        check(byEntity.Total >= 2 && byEntity.Findings.All(f => f.Entity?.Name == "@swiat/q-flash" || f.Tower?.Name == "@swiat/q-flash" || f.Path?.Name == "@swiat/q-flash"), "filter by entity (lasting name)");
        check(byEntity.Note.Contains("STALE SNAPSHOT"), "a stale snapshot is said");
        var page = AiMcpTools.WorldChecksOf(outcome.Json, snap.Name, "x", true, null, offset: 1, limit: 1);
        check(page.Findings.Count == 1 && page.Offset == 1 && (page.Next == 2 || all.Total <= 2), "paging: offset, limit, next");

        /* 3. Die Uwagi: get_feedback zeigt die Notiz einer erledigten. */
        var fb = AiMcpTools.FeedbackOf([snap], "all");
        var done = fb.Collections[0].Items.Select(x => x!.AsObject()).First(x => x["state"]!.GetValue<string>() == "done");
        check(done["note"]?.GetValue<string>() == "Poprawione w imporcie.", "get_feedback shows the note of a resolved item");

        /* 4. Ein Import erledigt eine Uwaga (die Prüfung kennt ihre Kennung aus der Abschrift); eine unbekannte ist eine Warnung. */
        var resolve = """{ "format": "recreatio.cogita.course", "version": 1, "name": "Świat", "feedback": [ { "id": "0199bbbb-0000-7000-8000-0000000000f1", "state": "done", "note": "Pytanie zamienione." }, { "id": "nie-ma", "state": "done" } ] }""";
        var r = AiMcpTools.CheckResultOf((await ImportCheck.RunAsync("knowledge-base", resolve, baseJson, "en", CancellationToken.None)).Json, snap.Name, "x", true, 0);
        check(r.Ok && r.Changes.Any(c => c.Contains("Pytanie zamienione.")), $"the import check lists the resolution with its note: {string.Join(" | ", r.Changes)}");
        check(r.Warnings.Any(w => w.Text.Contains("nie-ma")), $"an unknown feedback id is a warning: {string.Join(" | ", r.Warnings.Select(w => w.Text))}");

        /* 5. Ein Dokument in Teilen: abgelegt, bis alle da sind; dann EIN Dokument — dasselbe Ergebnis wie am Stück. */
        var whole = """{ "format": "recreatio/page", "version": 1, "title": "Test w częściach", "modules": [ { "kind": "text", "config": { "title": "A", "body": ["Tekst"] } } ] }""";
        var pieces = new[] { whole[..30], whole[30..70], whole[70..] };
        var (w1, m1) = AiMcpTools.TakePart("caller-a", "strona-1", 3, 3, pieces[2]);
        var (w2, m2) = AiMcpTools.TakePart("caller-a", "strona-1", 1, 3, pieces[0]);
        check(w1 is null && m1.SequenceEqual([1, 2]) && w2 is null && m2.SequenceEqual([2]), "parts in any order: the missing ones are named");
        var (other, _) = AiMcpTools.TakePart("caller-b", "strona-1", 2, 3, pieces[1]);
        check(other is null, "another connection's parts never join");
        var (w3, m3) = AiMcpTools.TakePart("caller-a", "strona-1", 2, 3, pieces[1]);
        check(w3 == whole && m3.Count == 0, "the last part completes the document");
        var asOne = (await ImportCheck.RunAsync("page", whole, null, "pl", CancellationToken.None)).Json;
        var asParts = (await ImportCheck.RunAsync("page", JsonSerializer.Serialize(w3), null, "pl", CancellationToken.None)).Json;
        check(asOne == asParts, "checked in parts = checked as one");
        var refused = false;
        try { AiMcpTools.TakePart("caller-a", "x", 4, 3, "{"); } catch (McpException) { refused = true; }
        check(refused, "a part beyond `of` is refused");
        check(ImportFormats.Find("calendar")?.Where is { Length: > 0 }, "every format says where in the app it is imported (ImportIn)");
    }
}
