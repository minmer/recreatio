using Api;
using Kernel;

/// <summary>0132 — Schemata der Termine: Werte, Herkunft aus einem Plan, wie ein neuer Eintrag steht.</summary>
internal static class SchemeChecks
{
    public static void Run(Action<bool, string> check)
    {
        /* Schlüssel von Feldern und Listen — wie im Browser (`scheme.ts`). */
        check(Calendar.ValidKey("kolor") && Calendar.ValidKey("obchod.dnia_1-x") && Calendar.ValidKey(new string('a', 64)),
            "keys: lower ascii, digits, _ . -, up to 64");
        check(!Calendar.ValidKey("Kolor") && !Calendar.ValidKey("a b") && !Calendar.ValidKey("") && !Calendar.ValidKey(null)
            && !Calendar.ValidKey(new string('a', 65)) && !Calendar.ValidKey("kolór"), "keys: no capitals, spaces, accents, nothing empty or long");

        var area = Guid.NewGuid();
        var envelope = Base64Url.Encode(new byte[40]);
        Calendar.ValueIn Sealed(string field) => new(field, Ids.ToText(area), 1, envelope, null, null);
        Calendar.ValueIn Open(string field, string? value, string? label = null) => new(field, null, null, null, label, value);

        check(Calendar.ParseValues(null, 10, true, true, false, out var none, out _) && none.Count == 0, "values: none given, none kept");
        check(Calendar.ParseValues([Open("kolor", " biały ", "Kolor szat"), Sealed("notatka")], 10, true, true, false, out var rows, out _)
            && rows[0].Value == "biały" && rows[0].Label == "Kolor szat" && rows[0].Blob is null
            && rows[1].Blob is { Length: 40 } && rows[1].AreaId == area && rows[1].Epoch == 1,
            "values: an open one trimmed with its label, a sealed one with area and epoch");
        check(Calendar.ParseValues([Open("kolor", "biały", "Kolor")], 10, labels: false, true, false, out rows, out _) && rows[0].Label is null,
            "values: a record carries no labels");
        check(!Calendar.ParseValues([Open("a", "1"), Open("b", "2"), Open("c", "3")], 2, true, true, false, out _, out var tooMany)
            && tooMany.Contains("najwyżej 2"), "values: at most the limit");
        check(!Calendar.ParseValues([Open("Kolor", "x")], 10, true, true, false, out _, out _), "values: a bad key is refused");
        check(!Calendar.ParseValues([Open("a", "1"), Open("a", "2")], 10, true, true, false, out _, out var twice)
            && twice == "To samo pole dwa razy.", "values: the same field twice is refused");
        check(!Calendar.ParseValues([Sealed("a")], 10, true, sealedAllowed: false, false, out _, out var outside)
            && outside == "Z zewnątrz można podać tylko jawne pola.", "values: from outside only open fields");
        check(!Calendar.ParseValues([new Calendar.ValueIn("a", Ids.ToText(area), 1, "%%%", null, null)], 10, true, true, false, out _, out _),
            "values: an unreadable envelope is refused");
        check(!Calendar.ParseValues([new Calendar.ValueIn("a", "nonsense", 1, envelope, null, null)], 10, true, true, false, out _, out _)
            && !Calendar.ParseValues([new Calendar.ValueIn("a", Ids.ToText(area), 0, envelope, null, null)], 10, true, true, false, out _, out _),
            "values: a sealed one needs its area and an epoch");
        check(!Calendar.ParseValues([Open("a", new string('x', 401))], 10, true, true, false, out _, out _)
            && Calendar.ParseValues([Open("a", new string('x', 400))], 10, true, true, false, out _, out _), "values: text up to 400");
        check(!Calendar.ParseValues([Open("a", "1", new string('x', 121))], 10, true, true, false, out _, out _), "values: label up to 120");
        check(!Calendar.ParseValues([Open("a", "  ")], 10, true, true, allowEmpty: false, out _, out var empty)
            && empty.Contains("nie ma wartości"), "values: an empty one is refused where nothing may be deleted");
        check(Calendar.ParseValues([Open("a", null)], 10, true, true, allowEmpty: true, out rows, out _) && rows[0].Empty,
            "values: an empty one means delete where that is allowed");
        check(!Calendar.ParseValues([new Calendar.ValueIn("a", Ids.ToText(area), 1, Base64Url.Encode(new byte[Calendar.MaxSealedValue + 1]), null, null)],
            10, true, true, false, out _, out _), "values: a sealed one up to 64 KiB");

        /* Woher aus einem Plan — nur für die Vorschau „schon geplant". */
        var plan = Ids.ToText(Guid.NewGuid());
        check(Calendar.ValidOrigin(null) && Calendar.ValidOrigin("") && Calendar.ValidOrigin($"{plan}|n1213|2026-12-25"),
            "origin: none, or plan|slot|day");
        check(!Calendar.ValidOrigin($"{plan}|n1213|2026-13-01") && !Calendar.ValidOrigin($"{plan}|n1213") && !Calendar.ValidOrigin("x|n1213|2026-12-25")
            && !Calendar.ValidOrigin($"{plan}|n 12|2026-12-25") && !Calendar.ValidOrigin($"{plan}||2026-12-25")
            && !Calendar.ValidOrigin($"{plan}|{new string('a', 200)}|2026-12-25"), "origin: a day, a plan id, a slot key, not too long");

        /* Wie ein neuer Eintrag steht. */
        check(Calendar.RecordStanding(true, null, null, out _) is ("accepted", "office"), "record: the office accepts by default");
        check(Calendar.RecordStanding(true, "waiting", "rule", out _) is ("waiting", "rule"), "record: the office may let it wait, a rule may add");
        check(Calendar.RecordStanding(true, "celebrated", null, out var bad) is null && bad.Length > 0, "record: a new one is not celebrated");
        check(Calendar.RecordStanding(true, null, "outside", out _) is null, "record: the office does not pretend to be outside");
        check(Calendar.RecordStanding(false, "accepted", "office", out _) is ("waiting", "outside"), "record: from outside it always waits");
        check(Calendar.RecordStatuses.SequenceEqual(["waiting", "accepted", "declined", "cancelled", "celebrated"]),
            "record: the statuses the table allows");

        /* Die Meldung, wenn Einträge ihren Termin verlören. */
        var zone = TimeZoneInfo.Utc;
        var lost = new List<DateTimeOffset> { DateTimeOffset.Parse("2026-11-04T17:00:00Z") };
        check(Mass.LostMessage(lost, zone).Contains("intencje") && Mass.LostMessage(lost, zone, intentions: false).Contains("wpisy"),
            "lost: intentions are named as such, other records as records");
    }
}
