using Api;

/// <summary>0064 — was die Bibliothek annimmt: Arten und offene Fassungen.</summary>
internal static class LibraryChecks
{
    public static void Run(Action<bool, string> check)
    {
        check(Library.IsKind("quote") && Library.IsKind("music_piece") && Library.IsKind("seat-note"), "kinds are lowercase words");
        check(!Library.IsKind("Quote") && !Library.IsKind("q") && !Library.IsKind("a b") && !Library.IsKind(null), "anything else is no kind");
        check(!Library.IsKind(new string('a', 33)), "at most 32 letters");

        var id = "01a0f4c1-bab6-7be5-bdfc-6f198a63ecea";
        Library.PublicEntry Good(string? json = "{}", string? @as = "explicit", List<string>? refs = null) =>
            new(id, @as, "ratzinger2007", "ratzinger jezus", "{\"title\":\"Jezus\"}", json, refs ?? []);

        check(Library.Check(Good()) is null, "a plain public entry passes");
        check(Library.Check(Good(@as: "implicit")) is null, "implicit passes");
        check(Library.Check(Good(@as: "public")) is not null, "published_as is explicit or implicit");
        check(Library.Check(Good(json: null)) is not null, "a public entry needs its JSON");
        check(Library.Check(Good(json: new string('x', 2 * 1024 * 1024 + 1))) is not null, "public JSON at most 2 MB");
        check(Library.Check(Good(refs: ["not-a-guid"])) is not null, "refs are ids");
        check(Library.Check(Good(refs: Enumerable.Range(0, 501).Select(_ => id).ToList())) is not null, "at most 500 refs");
        check(Library.Check(Good() with { EntryId = "x" }) is not null, "the entry is an id");
        check(Library.Check(Good() with { Key = new string('k', 121) }) is not null, "keys at most 120");

        /* 2026-10-21 — das Archiv: Filter je Aspekt (ODER innerhalb, UND zwischen), Reihenfolge. */
        var a = "01a0f4c1-bab6-7be5-bdfc-6f198a63ecea";
        var b = "01a0f4c1-bab6-7be5-bdfc-6f198a63eceb";
        var two = Library.ParseGroups([$"{a},{b}", b, "", null], out var none);
        check(two is not null && none is null && two.Count == 2 && two[0].Count == 2 && two[1].Count == 1, "groups: a comma is OR, another ref is AND, empty refs do not count");
        check(Library.ParseGroups([$"{a},{a}"], out _)?[0].Count == 1, "groups: the same id once");
        check(Library.ParseGroups(["kein-guid"], out var bad) is null && bad is not null, "groups: only ids");
        check(Library.ParseGroups(Enumerable.Repeat(a, 9), out _) is null, "groups: at most 8 filters");
        check(Library.ParseGroups([string.Join(",", Enumerable.Range(0, 201).Select(i => Guid.NewGuid()))], out _) is null, "groups: at most 200 values in one filter");
        check(Library.ParseGroups(null, out _) is { Count: 0 }, "groups: none is no filter");
        check(Library.BrowseOrder(null) == "e.public_sort" && Library.BrowseOrder("-sort") == "e.public_sort DESC" && Library.BrowseOrder("-key") == "e.public_key DESC", "order: sort and key, both ways");
        check(Library.BrowseOrder("e.id; DROP TABLE x") is null, "order: nothing else reaches the SQL");
    }
}
