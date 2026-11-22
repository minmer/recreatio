using System.Text.Json;
using Api;

/// <summary>
/// 2026-11-22 (A1) — DIE PRÜFUNG EINES IMPORTS IM DIENST: das gebündelte TypeScript der App (ImportCheck.js) läuft in Jint
/// — für eine Baza wiedzy gegen ihre Abschrift (Änderung an der Kennung, Löschung, Verweis ins Leere), für eine Seite und
/// einen Kalender gegen einen leeren Stand, ein kaputtes Dokument und ein unbekanntes Format; dazu die Form der Antwort.
/// </summary>
internal static class ImportCheckChecks
{
    private const string Snapshot = """
        { "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab69301", "part": "knowledge", "name": "Kurs",
          "kinds": [ { "id": "0199aaaa-0000-7000-8000-000000000001", "name": "Temat nauki" } ],
          "entries": [
            { "id": "0199aaaa-0000-7000-8000-000000000011", "kind": "0199aaaa-0000-7000-8000-000000000001", "kinds": ["0199aaaa-0000-7000-8000-000000000001"], "title": "Etap 1", "ref": "kurs/etap-1", "data": { "nazwa": "Etap 1" } },
            { "id": "0199aaaa-0000-7000-8000-000000000012", "kind": "0199aaaa-0000-7000-8000-000000000001", "kinds": ["0199aaaa-0000-7000-8000-000000000001"], "title": "Etap 2", "ref": "kurs/etap-2", "data": { "nazwa": "Etap 2", "wymaga": ["0199aaaa-0000-7000-8000-000000000011"] } },
            { "id": "0199aaaa-0000-7000-8000-000000000013", "kind": "0199aaaa-0000-7000-8000-000000000001", "kinds": ["0199aaaa-0000-7000-8000-000000000001"], "title": "Etap 3", "data": { "nazwa": "Etap 3" } }
          ],
          "setup": { "course": { "format": "recreatio.cogita.course", "version": 1, "name": "Kurs",
            "kinds": [ { "ref": "@kurs/temat", "name": "Temat nauki", "label": "{nazwa}", "fields": [
              { "key": "nazwa", "label": "Nazwa", "type": "line" },
              { "key": "wymaga", "label": "Najpierw", "type": "ref", "multi": true, "to": ["@kurs/temat"], "structure": "up", "prerequisite": "up" } ] } ] } } }
        """;

    private const string Change = """
        { "format": "recreatio.cogita.course", "version": 1, "name": "Kurs",
          "entities": [
            { "ref": "@kurs/etap-1", "data": { "nazwa": "Etap pierwszy" } },
            { "ref": "@0199aaaa-0000-7000-8000-000000000013", "remove": true },
            { "ref": "@kurs/etap-4", "kinds": ["@kurs/temat"], "data": { "nazwa": "Etap 4 [x]{.rot}", "wymaga": ["@kurs/etap-2"] } },
            { "ref": "@kurs/etap-5", "kinds": ["@kurs/temat"], "data": { "nazwa": "Etap 5 [y]{.rot}" } }
          ] }
        """;

    public static async Task RunAsync(Action<bool, string> check)
    {
        using var snapDoc = JsonDocument.Parse(Snapshot);
        var snap = AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab69301"), "knowledge", snapDoc.RootElement)!;
        var baseJson = ImportCheck.BaseJsonOf(snap);
        check(baseJson.Contains("\"ref\":\"kurs/etap-1\"") && baseJson.Contains("\"course\""), "the base for the check carries entries with lasting names and the course");

        /* 1. Gegen die Baza: eine Änderung an Bestehendem, eine Löschung beim Namen, zwei Neue — und die Warnungen gruppiert. */
        var outcome = await ImportCheck.RunAsync("knowledge-base", Change, baseJson, "en", CancellationToken.None);
        var r = AiMcpTools.CheckResultOf(outcome.Json, snap.Name, "x", true, outcome.Milliseconds);
        check(r.Ok, $"a valid change of the base goes through: {string.Join(" | ", r.Errors.Select(e => e.Text))}");
        check(r.Changes.Any(c => c.Contains("Etap 1") && c.Contains("Etap pierwszy")), $"the changed field is named with before and after: {string.Join(" | ", r.Changes)}");
        check(r.RemovalsTotal == 1 && r.Removals[0].Contains("Etap 3"), $"the removal is named: {string.Join(" | ", r.Removals)}");
        check(r.Warnings.Any(w => w.Count == 2 && w.Examples.Count == 2), $"two warnings that differ only by name are one group: {string.Join(" | ", r.Warnings.Select(w => $"{w.Count}× {w.Text}"))}");
        check(r.Note is not null && r.Note.Contains("Kurs"), "the note says what was checked against");
        check(r.Summary.StartsWith("OK", StringComparison.Ordinal) && r.Summary.Contains("Nothing was written"), "the summary says it would go through and nothing was written");

        /* 2. Ein Verweis ins Leere blockiert — alle Fehler auf einmal. */
        var broken = """{ "format": "recreatio.cogita.course", "version": 1, "entities": [ { "ref": "@kurs/nowy", "kinds": ["@kurs/nie-ma"], "data": { "nazwa": "X" } }, { "ref": "@kurs/etap-2", "data": { "wymaga": ["0199aaaa-0000-7000-8000-0000000000ff"] } } ] }""";
        var blocked = AiMcpTools.CheckResultOf((await ImportCheck.RunAsync("knowledge-base", broken, baseJson, "pl", CancellationToken.None)).Json, null, null, false, 0);
        check(!blocked.Ok && blocked.Errors.Any(e => e.Text.Contains("0000000000ff")), $"a reference into nothing blocks, named: {string.Join(" | ", blocked.Errors.Select(e => e.Text))}");
        check(blocked.Warnings.Any(w => w.Text.Contains("kurs/nowy")), "an entry with a kind that does not exist is a warning in the same answer (all at once)");
        check(blocked.Note is not null && blocked.Note.StartsWith("STALE SNAPSHOT", StringComparison.Ordinal), "a stale snapshot is said first");

        /* 3. Kein JSON, kein bekanntes Format, kein Format der Baza. */
        var notJson = AiMcpTools.CheckResultOf((await ImportCheck.RunAsync("knowledge-base", "\"{ kaputt\"", null, "pl", CancellationToken.None)).Json, null, null, null, 0);
        check(!notJson.Ok && notJson.ErrorCount == 1 && notJson.Errors[0].Text.Contains("JSON"), "text that is not JSON is one error");
        var unknown = AiMcpTools.CheckResultOf((await ImportCheck.RunAsync("nic-takiego", "{}", null, "de", CancellationToken.None)).Json, null, null, null, 0);
        check(!unknown.Ok && unknown.Errors[0].Text.Contains("knowledge-base") && unknown.Errors[0].Text.Contains("Importformat"), "an unknown format names the known ones (in German)");

        /* 4. Eine Seite und ein Kalender gegen einen leeren Stand. */
        var page = AiMcpTools.CheckResultOf((await ImportCheck.RunAsync("page", """{ "format": "recreatio/page", "version": 1, "title": "Test", "modules": [ { "kind": "text", "config": { "title": "A", "body": ["Tekst"] } } ] }""", null, "pl", CancellationToken.None)).Json, null, null, null, 0);
        check(page.Ok && page.ChangesTotal > 0, $"a page is planned: {string.Join(" | ", page.Changes)}");
        var calendar = AiMcpTools.CheckResultOf((await ImportCheck.RunAsync("calendar", """{ "format": "recreatio/calendar", "version": 1, "appointments": [ { "title": "A", "start": "2026-12-01T10:00" }, { "start": "2026-12-02T10:00" } ] }""", null, "pl", CancellationToken.None)).Json, null, null, null, 0);
        check(calendar.Ok && calendar.WarningCount == 1, $"a calendar is planned, the appointment without title is a warning: {string.Join(" | ", calendar.Warnings.Select(w => w.Text))}");

        /* 5. Die Form der Antwort: Zahlen ganz, Zeilen und Beispiele gekürzt. */
        var many = JsonSerializer.Serialize(new
        {
            format = "page", ok = false, changes = Enumerable.Range(0, 450).Select(i => $"z{i}"), removals = Array.Empty<string>(),
            groups = new[] { new { level = "error", text = "E „…”", count = 30, examples = Enumerable.Range(0, 30).Select(i => $"E „{i}”") } }
        });
        var shaped = AiMcpTools.CheckResultOf(many, null, null, null, 0);
        check(shaped.ChangesTotal == 450 && shaped.Changes.Count == 200 && shaped.ErrorCount == 30 && shaped.Errors[0].Examples.Count == 12 && !shaped.Ok,
            "long answers keep their counts and cut lines and examples");
    }
}
