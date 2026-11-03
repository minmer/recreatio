using Api;

/// <summary>0064 — was die Bibliothek annimmt: Arten, wo ein Eintrag liegt, wohin er ziehen darf.</summary>
internal static class LibraryChecks
{
    public static void Run(Action<bool, string> check)
    {
        check(Library.IsKind("quote") && Library.IsKind("music_piece") && Library.IsKind("seat-note"), "kinds are lowercase words");
        check(!Library.IsKind("Quote") && !Library.IsKind("q") && !Library.IsKind("a b") && !Library.IsKind(null), "anything else is no kind");
        check(!Library.IsKind(new string('a', 33)), "at most 32 letters");

        /*
         * 2026-10-22 (Schritt 8) — nichts geht mehr einzeln hinaus (der Dienst nimmt nur das Zurückziehen
         * alter offener Fassungen an); veröffentlichen heisst: in eine Bibliothek / Baza eines öffentlichen
         * Bereichs tragen. Wohin ein Eintrag ziehen darf:
         */
        check(Library.MayMove("books", "books", false) && Library.MayMove("books", "books", true), "a library entry moves to any library");
        check(Library.MayMove("knowledge", "knowledge", false), "a knowledge-base entry moves to any knowledge base (that is publishing now)");
        /* 2026-10-23 (0124) — drei Teile: ein Text zieht von Skryptorium zu Skryptorium; zwischen den Teilen zieht nichts. */
        check(Library.MayMove("writing", "writing", false) && Library.MayMove("writing", "writing", true), "a text moves to any Scriptorium (that is how it becomes public)");
        check(!Library.MayMove("knowledge", "books", true) && !Library.MayMove("writing", "books", true) && !Library.MayMove("books", "writing", true) && !Library.MayMove("knowledge", "writing", true), "never between the parts — the Library holds sources only");
        check(!Library.MayMove("books", "knowledge", true) && !Library.MayMove(null, "books", true) && !Library.MayMove("books", null, true), "never from a library into a knowledge base, never from or to nothing");
        check(Library.LibraryKind("writing") == "writing" && Library.LibraryKind("") == "books" && Library.LibraryKind("knowledge") == "knowledge" && Library.LibraryKind("comments") is null, "the three containers: books, knowledge, writing");

        /* 2026-10-22 — wo ein Eintrag liegt: Kennungen, jede einmal, höchstens 400. */
        var a = "01a0f4c1-bab6-7be5-bdfc-6f198a63ecea";
        var b = "01a0f4c1-bab6-7be5-bdfc-6f198a63eceb";
        check(Library.ParseIds($"{a}, {b},{a}") is { Count: 2 }, "where: ids, each once, spaces allowed");
        check(Library.ParseIds("kein-guid") is null && Library.ParseIds("") is null && Library.ParseIds(null) is null, "where: only ids, at least one");
        check(Library.ParseIds(string.Join(",", Enumerable.Range(0, 401).Select(_ => Guid.NewGuid()))) is null, "where: at most 400");

        /* 2026-11-03 — viele in einem Zug (ein Import): alle oder keiner. Was hereinkommt … */
        var sealedOk = Kernel.Base64Url.Encode(new byte[64]);
        Library.SaveManyEntry Row(string id, int version = 0, string kind = "entity", string? seal = null, int epoch = 1) => new(id, kind, epoch, seal ?? sealedOk, version);
        var (rows, error) = Library.ReadSaveMany(new Library.SaveManyRequest([Row(a), Row(b, 3)]));
        check(rows is { Count: 2 } && error is null && rows[0].Id == Guid.Parse(a) && rows[1].Version == 3, "batch: rows in their order, with their state");
        check(Library.ReadSaveMany(new Library.SaveManyRequest([Row(a), Row(a.ToUpperInvariant())])).Error?.Contains("dwa razy") == true, "batch: an entry at most once");
        check(Library.ReadSaveMany(new Library.SaveManyRequest([])).Rows is null && Library.ReadSaveMany(null).Rows is null
            && Library.ReadSaveMany(new Library.SaveManyRequest(Enumerable.Range(0, Library.MaxSaveBatch + 1).Select(_ => Row(Guid.NewGuid().ToString())).ToList())).Rows is null,
            "batch: 1 to MaxSaveBatch entries");
        check(Library.ReadSaveMany(new Library.SaveManyRequest([Row("kein-guid")])).Rows is null && Library.ReadSaveMany(new Library.SaveManyRequest([Row(a, kind: "Entity")])).Rows is null
            && Library.ReadSaveMany(new Library.SaveManyRequest([Row(a, seal: Kernel.Base64Url.Encode(new byte[47]))])).Rows is null
            && Library.ReadSaveMany(new Library.SaveManyRequest([Row(a, epoch: 0)])).Rows is null && Library.ReadSaveMany(new Library.SaveManyRequest([Row(a, version: -1)])).Rows is null,
            "batch: every entry an id, a kind, an epoch, a sealed envelope, a state — or nothing goes");
        /* … und was gegen die Datenbank nicht geht: ALLE werden genannt, und dann geht keiner. */
        var lib = Guid.Parse("01a0f4c1-bab6-7be5-bdfc-6f198a63ec00");
        var other = Guid.Parse("01a0f4c1-bab6-7be5-bdfc-6f198a63ec01");
        var c = "01a0f4c1-bab6-7be5-bdfc-6f198a63ecec";
        var d = "01a0f4c1-bab6-7be5-bdfc-6f198a63eced";
        var fine = Library.ReadSaveMany(new Library.SaveManyRequest([Row(a), Row(b, 3)])).Rows!;
        check(Library.SaveManyProblems(lib, fine, new Dictionary<Guid, (Guid, int)> { [Guid.Parse(b)] = (lib, 3) }).Count == 0, "batch: new ones with state 0, existing ones with their state — all go");
        var bad = Library.ReadSaveMany(new Library.SaveManyRequest([Row(a, 2), Row(b, 3), Row(c, 1), Row(d)])).Rows!;
        var found = Library.SaveManyProblems(lib, bad, new Dictionary<Guid, (Guid, int)> { [Guid.Parse(b)] = (lib, 4), [Guid.Parse(c)] = (other, 1) });
        check(found.Count == 3 && found[0].EntryId == a && found[0].Version == 0 && found[1].EntryId == b && found[1].Version == 4 && found[2].EntryId == c && found[2].Version is null,
            "batch: a vanished entry, a newer state and another library's entry are each named — the fourth is fine but waits with them");

        /* 2026-11-03 — Löschen im selben Zug: was gelöscht wird, wird geprüft wie das Gespeicherte. */
        Library.SaveManyRemove Gone(string id, int version = 2) => new(id, version);
        var onlyRemove = new Library.SaveManyRequest(null, [Gone(c)]);
        var (noRows, noRowsError) = Library.ReadSaveMany(onlyRemove);
        check(noRows is { Count: 0 } && noRowsError is null && Library.ReadSaveRemove(onlyRemove, noRows).Gone is { Count: 1 }, "batch: a save that only deletes is one save");
        var both = new Library.SaveManyRequest([Row(a)], [Gone(c), Gone(d, 1)]);
        var bothRows = Library.ReadSaveMany(both).Rows!;
        var bothGone = Library.ReadSaveRemove(both, bothRows).Gone;
        check(bothRows.Count == 1 && bothGone is { Count: 2 } && bothGone[0].Id == Guid.Parse(c) && bothGone[1].Version == 1, "batch: create and delete in one save, in their order");
        check(Library.ReadSaveRemove(new Library.SaveManyRequest([Row(a)], [Gone(a)]), [.. Library.ReadSaveMany(new Library.SaveManyRequest([Row(a)])).Rows!]).Error?.Contains("i do usunięcia") == true,
            "batch: an entry is never saved and deleted in one save");
        check(Library.ReadSaveRemove(new Library.SaveManyRequest(null, [Gone(c), Gone(c.ToUpperInvariant())]), []).Error?.Contains("dwa razy") == true
            && Library.ReadSaveRemove(new Library.SaveManyRequest(null, [Gone("kein-guid")]), []).Gone is null
            && Library.ReadSaveRemove(new Library.SaveManyRequest(null, [Gone(c, 0)]), []).Gone is null,
            "batch: a deletion names an id once, readable, with a state");
        check(Library.ReadSaveMany(new Library.SaveManyRequest([], [])).Rows is null
            && Library.ReadSaveMany(new Library.SaveManyRequest([Row(a)], Enumerable.Range(0, Library.MaxSaveBatch).Select(_ => Gone(Guid.NewGuid().ToString())).ToList())).Rows is null,
            "batch: saved and deleted together 1 to MaxSaveBatch");
        var goneHad = new Dictionary<Guid, (Guid, int, bool)> { [Guid.Parse(a)] = (lib, 2, false), [Guid.Parse(b)] = (lib, 5, false), [Guid.Parse(c)] = (other, 2, false), [Guid.Parse(d)] = (lib, 2, true) };
        var goneFound = Library.RemoveManyProblems(lib, [new(Guid.Parse(a), 2), new(Guid.Parse(b), 4), new(Guid.Parse(c), 2), new(Guid.Parse(d), 2), new(Guid.NewGuid(), 1)], goneHad);
        check(goneFound.Count == 4 && goneFound[0].EntryId == b && goneFound[0].Version == 5 && goneFound[1].EntryId == c && goneFound[1].Version is null && goneFound[2].EntryId == d && goneFound[3].Version == 0,
            "batch: deleting a newer state, another library's entry, a deleted one or one that never was is refused — the first one is fine");
    }
}
