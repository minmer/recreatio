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
        check(Library.MayMove("knowledge", "books", true) && !Library.MayMove("knowledge", "books", false), "from a knowledge base into a library: only within the same area");
        check(!Library.MayMove("books", "knowledge", true) && !Library.MayMove(null, "books", true) && !Library.MayMove("books", null, true), "never from a library into a knowledge base, never from or to nothing");

        /* 2026-10-22 — wo ein Eintrag liegt: Kennungen, jede einmal, höchstens 400. */
        var a = "01a0f4c1-bab6-7be5-bdfc-6f198a63ecea";
        var b = "01a0f4c1-bab6-7be5-bdfc-6f198a63eceb";
        check(Library.ParseIds($"{a}, {b},{a}") is { Count: 2 }, "where: ids, each once, spaces allowed");
        check(Library.ParseIds("kein-guid") is null && Library.ParseIds("") is null && Library.ParseIds(null) is null, "where: only ids, at least one");
        check(Library.ParseIds(string.Join(",", Enumerable.Range(0, 401).Select(_ => Guid.NewGuid()))) is null, "where: at most 400");
    }
}
