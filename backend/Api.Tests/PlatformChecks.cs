using System.Text.Json;
using Api;

/// <summary>
/// 0065–0071 — was ohne Datenbank nachzumessen ist: Links mit Zugang,
/// Aufgaben mit Zeitraum und Erinnerungen, normalisierte Adressen (dieselbe
/// Tabelle wie `app-platform-check.mjs`), die ISBN des Katalogboten.
/// </summary>
internal static class PlatformChecks
{
    public static void Run(Action<bool, string> check)
    {
        Invites(check);
        TaskPeriods(check);
        TasksLeftOpen(check);
        Postal(check);
        Catalog(check);
        LinkAims(check);
        PushAssertion(check);
        RoundKeys(check);
        MassCarry(check);
        PageModes(check);
        FormNeeds(check);
    }

    /// <summary>0085 — die drei Arten einer Seite; was keine ist, wird eine Seite mit Bausteinen.</summary>
    private static void PageModes(Action<bool, string> check)
    {
        check(Page.ModeOf("presentation") == "presentation", "page mode: a presentation is kept");
        check(Page.ModeOf("slides") == "slides" && Page.ModeOf("page") == "page", "page mode: slides and page stay");
        check(Page.ModeOf(null) == "page" && Page.ModeOf("Presentation") == "page" && Page.ModeOf("show") == "page", "page mode: anything else is a page");
        check(Page.ModeOf("presentation").Length <= 16, "page mode: fits the column (0085: nvarchar(16))");
        check(Page.MaxTheme >= 64000, "page look: room for the scenes of a presentation");
    }

    /// <summary>0086 — die Fragen eingeschalteter Wymagania sind gesperrt; eine kaputte Einstellung sperrt nichts.</summary>
    private static void FormNeeds(Action<bool, string> check)
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var needs = System.Text.Json.JsonSerializer.Serialize(new object[]
        {
            new { id = "minor", label = "Niepełnoletni", fields = new[] { a.ToString() } },
            new { id = "health", label = "Zdrowie", fields = new[] { b.ToString(), "nie-guid" } }
        });
        var config = System.Text.Json.JsonSerializer.Serialize(new Dictionary<string, string> { ["needs"] = needs, ["paper"] = "minor" });

        var locked = Form.LockedFields(config);
        check(locked.Count == 2 && locked[a] == "Niepełnoletni" && locked[b] == "Zdrowie", "needs: the questions of each requirement are locked, under its name");
        check(Form.LockedFields(null).Count == 0 && Form.LockedFields("{}").Count == 0, "needs: none set, nothing locked");
        check(Form.LockedFields("{\"needs\":\"[1,2\"}").Count == 0, "needs: an unreadable setting locks nothing");
        check(Form.LockedFields("{\"needs\":\"{}\"}").Count == 0, "needs: not a list, nothing locked");
        check(Form.LockedFields("nie json").Count == 0, "needs: an unreadable config locks nothing");

        check(Form.PortalAt("?s=3") == "?s=3" && Form.PortalAt(" #zapisy ") == "#zapisy" && Form.PortalAt("?s=2&x=1#twoje") == "?s=2&x=1#twoje",
            "portal suffix: a slide, an anchor, both");
        check(Form.PortalAt("s=3") is null && Form.PortalAt("?") is null && Form.PortalAt("#") is null && Form.PortalAt("") is null,
            "portal suffix: starts with ? or # and says something");
        check(Form.PortalAt("?miejsce=a.b") is null && Form.PortalAt("?s=1&MIEJSCE=x") is null && Form.PortalAt("?miejsce") is null,
            "portal suffix: cannot imitate the seat");
        check(Form.PortalAt("#a b") is null && Form.PortalAt("#a\"b") is null && Form.PortalAt("#a#b") is null && Form.PortalAt("?" + new string('x', 400)) is null,
            "portal suffix: no spaces, no quotes, one anchor, short");
    }

    /// <summary>0077 — der Zeitraum einer wiederkehrenden Erweiterung: dieselbe Tabelle wie rounds.ts.</summary>
    private static void RoundKeys(Action<bool, string> check)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "round-keys.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));

        foreach (var row in doc.RootElement.GetProperty("keys").EnumerateArray())
        {
            var day = DateOnly.ParseExact(row.GetProperty("date").GetString()!, "yyyy-MM-dd");
            foreach (var kind in new[] { "day", "week", "month", "year" })
            {
                var expected = row.GetProperty(kind).GetString();
                var got = Rounds.Of(kind, day);
                check(got == expected, $"round {kind} of {day:yyyy-MM-dd} → {expected} (got {got})");
                check(Rounds.Valid(kind, got), $"round {kind} {got} is valid");
            }
            check(Rounds.Of("once", day) == "", "round once has no key");
        }

        foreach (var row in doc.RootElement.GetProperty("valid").EnumerateArray())
        {
            var kind = row[0].GetString()!;
            var round = row[1].GetString();
            var expected = row[2].GetBoolean();
            check(Rounds.IsKind(kind) && Rounds.Valid(kind, round) == expected || !Rounds.IsKind(kind) && !expected,
                $"round {kind} \"{round}\" valid = {expected}");
        }

        var now = DateTimeOffset.Parse("2026-10-31T11:00:00Z");
        check(Rounds.NotAhead("month", "2026-10", now), "round: the running month is not ahead");
        check(Rounds.NotAhead("month", "2026-11", now), "round: at UTC+14 November has already begun");
        check(!Rounds.NotAhead("month", "2026-12", now), "round: a month that has begun nowhere is refused");
        check(Rounds.NotAhead("month", "2025-03", now), "round: the past is always allowed (for the office)");
        check(Rounds.Current("month", "2026-10", now) && Rounds.Current("month", "2026-11", now), "round: a person writes into the month that runs somewhere");
        check(!Rounds.Current("month", "2026-09", now), "round: a person does not write into last month");
        check(Rounds.Current("once", "", now) && !Rounds.Current("once", "2026-10", now), "round: once has only the empty key");
    }

    private static void Invites(Action<bool, string> check)
    {
        var id = "01a0f4c1-bab6-7be5-bdfc-6f198a63ecea";
        var token = Kernel.Base64Url.Encode(new byte[32]);
        var sealedKey = Kernel.Base64Url.Encode(new byte[96]);
        Roles.InviteRequest Good() => new(id, id, token, sealedKey, "Rada", 1, 30, "read");

        check(Roles.CheckInvite(Good()) is null, "invite: a plain single-use read link passes");
        check(Roles.CheckInvite(Good() with { Capability = "admin" }) is null, "invite: admin links pass");
        check(Roles.CheckInvite(Good() with { Capability = "certify" }) is not null, "invite: capability is read, write or admin");
        check(Roles.CheckInvite(Good() with { TokenSha256 = Kernel.Base64Url.Encode(new byte[31]) }) is not null, "invite: the lookup is 32 bytes");
        check(Roles.CheckInvite(Good() with { MaxUses = 0 }) is not null, "invite: at least one use");
        check(Roles.CheckInvite(Good() with { ExpiresDays = 0 }) is not null, "invite: at least a day");
        check(Roles.CheckInvite(Good() with { ExpiresDays = 3651 }) is not null, "invite: at most ten years");
        check(Roles.CheckInvite(Good() with { Label = new string('x', 201) }) is not null, "invite: label at most 200");
        check(Roles.CheckInvite(Good() with { TokenSealed = Kernel.Base64Url.Encode(new byte[64]) }) is null, "invite: a sealed token may come along");
        check(Roles.CheckInvite(Good() with { TokenSealed = Kernel.Base64Url.Encode(new byte[600]) }) is not null, "invite: sealed token at most 512 bytes");
    }

    /// <summary>0088 — was liegen blieb (vorbei, nicht entschieden), bleibt offen — gleich wie lange her.</summary>
    private static void TasksLeftOpen(Action<bool, string> check)
    {
        var zone = Zones.Of("Europe/Warsaw");
        var first = Zones.AtLocal(new DateTime(2025, 1, 6, 21, 0, 0), zone);
        var now = Zones.AtLocal(new DateTime(2026, 10, 9, 12, 0, 0), zone);
        var shownFrom = Zones.AtLocal(new DateTime(2026, 10, 5, 0, 0, 0), zone);

        /* Einmalig, vor anderthalb Jahren, nie erledigt: bleibt. */
        var once = Calendar.Occurrences(first, "none", 1, null, null, null, first, shownFrom, zone);
        check(Tasks.LeftOpen(once, 15, new HashSet<DateTimeOffset>(), shownFrom, now).SequenceEqual(once), "left open: a one-off task from long ago stays open");
        check(Tasks.LeftOpen(once, 15, new HashSet<DateTimeOffset>(once), shownFrom, now).Count == 0, "left open: done or skipped, it is gone");

        /* Täglich: jedes entschiedene Vorkommen fällt weg, die übrigen bleiben. */
        var daily = Calendar.Occurrences(first, "daily", 1, null, null, null, first, shownFrom, zone);
        var decided = daily.Take(daily.Count - 2).ToHashSet();
        var left = Tasks.LeftOpen(daily, 15, decided, shownFrom, now);
        check(left.Count == 2 && left.All(at => at < shownFrom), "left open: daily — only the undecided ones, all before the shown range");

        /* Was im gezeigten Zeitraum liegt oder noch läuft, gehört nicht dazu. */
        var running = new[] { now.AddMinutes(-5) };
        check(Tasks.LeftOpen(running, 60, new HashSet<DateTimeOffset>(), now.AddDays(-1), now).Count == 0, "left open: an occurrence still running is not left open");
        check(Tasks.LeftOpen(new[] { shownFrom.AddHours(1) }, 15, new HashSet<DateTimeOffset>(), shownFrom, now).Count == 0, "left open: the shown range has its own");
    }

    private static void TaskPeriods(Action<bool, string> check)
    {
        var zone = Zones.Of("Europe/Warsaw");
        var first = Zones.AtLocal(new DateTime(2026, 3, 20, 9, 0, 0), zone);

        /* Über die Zeitumstellung (29. März): ganze Tage zählen in Ortstagen — 9:00 bleibt 9:00. */
        var periods = Tasks.Periods(first, 14 * 1440, first, first.AddDays(60), zone);
        check(periods.Count == 5, "period: every 14 days within 60 days gives 5 starts");
        check(periods.All(p => TimeZoneInfo.ConvertTime(p, zone).Hour == 9), "period: 9:00 local stays 9:00 across DST");

        /* Ab einem späteren Fenster: der erste Beginn, der schon läuft, ist nicht dabei (er liegt vor `from`) — die Rechnung springt. */
        var later = Tasks.Periods(first, 14 * 1440, first.AddDays(365), first.AddDays(395), zone);
        check(later.Count >= 2 && later[0] >= first.AddDays(365), "period: far windows are reached without counting from the start");

        var hourly = Tasks.Periods(first, 36 * 60, first, first.AddDays(3), zone);
        check(hourly.Count == 3 && hourly[1] - hourly[0] == TimeSpan.FromHours(36), "period: non-day steps run on world time");

        var reminders = Tasks.RemindersOf(first, 3 * 1440, 7);
        check(reminders.Count == 3, "reminders: start, middle and end");
        check(reminders[1].At == first.AddDays(1.5), "reminders: middle is half the duration");
        check(reminders[2].At == first.AddDays(3).AddMinutes(-15), "reminders: end is a quarter of an hour before the end");
        check(Tasks.RemindersOf(first, 30, 4)[0].At == first.AddMinutes(30), "reminders: a short window reminds at its end");
        check(Tasks.RemindersOf(first, 0, 7).Count == 1, "reminders: without duration only the start");

        Tasks.TaskRequest Task(string kind, int window, int? every) =>
            new(null, Guid.NewGuid().ToString(), Guid.NewGuid().ToString(), kind, "2026-10-01", "09:00", window, every,
                "none", 1, null, null, null, 1, Kernel.Base64Url.Encode(new byte[40]), null, "Europe/Warsaw", 7);

        check(Tasks.Check(Task("period", 3 * 1440, 14 * 1440)) is null, "period task: 3 days every 2 weeks passes");
        check(Tasks.Check(Task("period", 3 * 1440, 1440)) is not null, "period task: cannot repeat more often than it lasts");
        check(Tasks.Check(Task("period", 0, 1440)) is not null, "period task: needs a duration");
        check(Tasks.Check(Task("window", 60, null) with { Remind = 9 }) is not null, "task: reminder mask is 0..7");
        check(Tasks.Check(Task("window", 60, null) with { ChatId = "x" }) is not null, "task: a chat link is an id");
    }

    private static void Postal(Action<bool, string> check)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "postal-norms.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));

        var n = 0;
        foreach (var row in doc.RootElement.GetProperty("norm").EnumerateArray())
        {
            var kind = row[0].GetString()!;
            var input = row[1].GetString();
            var expected = row[2].GetString();
            var got = Api.Postal.Norm(kind, input);
            check(got == expected, $"postal norm {kind} \"{input}\" → \"{expected}\" (got \"{got}\")");
            n++;
        }
        check(n >= 20, "postal: the shared table has its rows");

        foreach (var row in doc.RootElement.GetProperty("keys").EnumerateArray())
        {
            Api.Postal.PlaceIn Place(JsonElement parts) => new(null, parts[0].GetString(), parts[1].GetString(), parts[2].GetString(),
                parts[3].GetString(), parts[4].GetString(), parts[5].GetString(), parts[6].GetString());
            string KeyOf(Api.Postal.PlaceIn p)
            {
                var c = Api.Postal.Complete(p);
                return Api.Postal.Key(c.Postcode, c.Post, c.Locality, c.District, c.Street, c.House, c.Unit);
            }
            var same = KeyOf(Place(row[0])) == KeyOf(Place(row[1]));
            check(same == row[2].GetBoolean(), $"postal key: {row[0]} vs {row[1]} → {row[2]}");
        }

        /* 0082 — die eine Schreibweise, dieselbe wie postal.ts display. */
        foreach (var row in doc.RootElement.GetProperty("display").EnumerateArray())
        {
            var got = Api.Postal.Display(row[0].GetString()!, row[1].GetString());
            check(got == row[2].GetString(), $"postal display {row[0]} \"{row[1]}\" → \"{row[2]}\" (got \"{got}\")");
        }

        check(Api.Postal.Check(new(null, "", "", "", "", "", "", "")) is not null, "postal: an empty address is refused");
        check(Api.Postal.Check(new(null, "3114", "Kraków", "", "", "Długa", "5", "")) is not null, "postal: a malformed postcode is refused");
        check(Api.Postal.Check(new(null, "", "", "", "", "", "12", "")) is not null, "postal: a house number alone is no address");
        check(Api.Postal.Check(new(null, "", "", "Zawoja", "", "", "1234", "")) is null, "postal: a village with a number is an address");
        check(Api.Postal.Prefix("postcode", "311") == "31-1", "postal: postcode prefixes keep their hyphen");
    }

    private static void Catalog(Action<bool, string> check)
    {
        check(LibraryCatalog.Isbn13("978-83-63110-45-1") == "9788363110451", "isbn: hyphens go, the check digit holds");
        check(LibraryCatalog.Isbn13("9788363110452") is null, "isbn: a misread digit finds nothing");
        check(LibraryCatalog.Isbn13("0-8044-2957-X") == "9780804429573", "isbn: ten digits ending in X are read");
        check(LibraryCatalog.Isbn13("0-306-40615-2") == "9780306406157", "isbn: ten digits become thirteen");
        check(LibraryCatalog.Isbn10("9780306406157") == "0306406152", "isbn: and back, for old records");
        check(LibraryCatalog.Isbn13("5901234123457") is null, "isbn: an EAN of a product is not a book");
        check(LibraryCatalog.Isbn13("") is null && LibraryCatalog.Isbn13("abc") is null, "isbn: nothing is nothing");
    }

    private static void LinkAims(Action<bool, string> check)
    {
        check(HeldLinks.NormaliseAim("parish/grzegorzki/oaza") == ("parish/grzegorzki/oaza", null), "aim: a path stays");
        check(HeldLinks.NormaliseAim("#/parish/x?s=2").Aim == "parish/x?s=2", "aim: the hash goes, the slide stays");
        check(HeldLinks.NormaliseAim("https://recreatio.pl/#/parish/x").Aim == "parish/x", "aim: a whole address of ours");
        check(HeldLinks.NormaliseAim("https://evil.example/#/parish/x").Error is not null, "aim: not someone else's site");
        check(HeldLinks.NormaliseAim("") == (null, null) && HeldLinks.NormaliseAim("#/dolacz/abc") == (null, null), "aim: empty or the join page is no aim");
        check(HeldLinks.NormaliseAim("parish/x y").Error is not null, "aim: no spaces");
        check(HeldLinks.NormaliseAim(new string('a', 401)).Error is not null, "aim: at most 400");
        var proof = Kernel.Base64Url.Encode(new byte[32]);
        check(HeldLinks.Proofs($"{proof},{proof},xx,{Kernel.Base64Url.Encode(new byte[31])}").Count == 1, "links: proofs are 32 bytes, each once");
        check(HeldLinks.Proofs(string.Join(",", Enumerable.Range(0, 30).Select(i => Kernel.Base64Url.Encode(Enumerable.Repeat((byte)i, 32).ToArray())))).Count == HeldLinks.Max, "links: at most twenty");
    }

    /// <summary>
    /// 0079 — die Intentionen wandern mit der Messe, nach dem TAG: eine neue
    /// Uhrzeit nimmt sie mit (auch über die Zeitumstellung), ein weggefallener
    /// Tag oder ein früheres Ende lässt sie ohne Messe — dann ändert der Dienst nichts.
    /// </summary>
    private static void MassCarry(Action<bool, string> check)
    {
        var zone = Zones.Of("Europe/Warsaw");
        DateTimeOffset At(int month, int day, int hour, int minute = 0) =>
            Zones.AtLocal(new DateTime(2026, month, day, hour, minute, 0), zone);

        /* Pn i śr 18:00, od 5 października do końca roku. */
        const int monWed = 1 | 4;
        var until = At(12, 31, 23, 59);
        var keys = new[] { At(10, 7, 18), At(10, 26, 18), At(11, 2, 18), At(12, 30, 18) };

        var later = Mass.ByDay(keys, new Mass.Series(At(10, 5, 18, 30), "weekly", 1, monWed, until, null, zone));
        check(later[At(10, 7, 18)] == At(10, 7, 18, 30), "carry: 18:00 → 18:30 on the same Wednesday");
        check(later[At(10, 26, 18)] == At(10, 26, 18, 30), "carry: across the change of time the wall clock stays (26.10 18:30 CET)");
        check(later.Values.All(v => v is not null), "carry: every intention keeps its mass");

        var noWednesday = Mass.ByDay(keys, new Mass.Series(At(10, 5, 18), "weekly", 1, 1, until, null, zone));
        check(noWednesday[At(10, 7, 18)] is null && noWednesday[At(12, 30, 18)] is null, "carry: Wednesday taken away — its intentions have no mass");
        check(noWednesday[At(10, 26, 18)] == At(10, 26, 18) && noWednesday[At(11, 2, 18)] == At(11, 2, 18), "carry: Mondays stay where they were");

        var shorter = Mass.ByDay(keys, new Mass.Series(At(10, 5, 18), "weekly", 1, monWed, At(11, 30, 23, 59), null, zone));
        check(shorter[At(11, 2, 18)] == At(11, 2, 18) && shorter[At(12, 30, 18)] is null, "carry: the series ends earlier — December has no mass");

        var counted = Mass.ByDay(keys, new Mass.Series(At(10, 5, 18), "weekly", 1, monWed, null, 4, zone));
        check(counted[At(10, 7, 18)] is not null && counted[At(10, 26, 18)] is null, "carry: a count ends the series too");

        /* „Ta i następne": ab 2. November eine neue Reihe um 17:00 — nur die Tage ab dann. */
        var handed = Mass.ByDay(new[] { At(11, 2, 18), At(12, 30, 18) }, new Mass.Series(At(11, 2, 17), "weekly", 1, monWed, until, null, zone));
        check(handed[At(11, 2, 18)] == At(11, 2, 17) && handed[At(12, 30, 18)] == At(12, 30, 17), "carry: handed over to a new series at 17:00");

        var said = Mass.LostMessage(new[] { At(10, 7, 18), At(12, 30, 18) }, zone);
        check(said.Contains("7.10.2026 18:00") && said.Contains("30.12.2026 18:00"), "carry: the refusal names the days in local time");
    }

    private static void PushAssertion(Action<bool, string> check)
    {
        using var rsa = System.Security.Cryptography.RSA.Create(2048);
        var fcm = new Fcm("recreatio-test", "push@recreatio-test.iam.gserviceaccount.com", rsa, "https://fcm.example", "https://oauth2.googleapis.com/token");
        var now = DateTimeOffset.FromUnixTimeSeconds(1_790_000_000);
        var jwt = fcm.Assertion(now).Split('.');
        check(jwt.Length == 3, "push: the assertion is a JWT");
        var header = JsonDocument.Parse(Kernel.Base64Url.Decode(jwt[0])).RootElement;
        var claims = JsonDocument.Parse(Kernel.Base64Url.Decode(jwt[1])).RootElement;
        check(header.GetProperty("alg").GetString() == "RS256", "push: signed RS256");
        check(claims.GetProperty("iss").GetString() == "push@recreatio-test.iam.gserviceaccount.com"
            && claims.GetProperty("scope").GetString() == "https://www.googleapis.com/auth/firebase.messaging"
            && claims.GetProperty("aud").GetString() == "https://oauth2.googleapis.com/token", "push: issuer, scope and audience");
        check(claims.GetProperty("exp").GetInt64() - claims.GetProperty("iat").GetInt64() == 3600, "push: valid for one hour");
        var signed = System.Text.Encoding.ASCII.GetBytes($"{jwt[0]}.{jwt[1]}");
        check(rsa.VerifyData(signed, Kernel.Base64Url.Decode(jwt[2]), System.Security.Cryptography.HashAlgorithmName.SHA256, System.Security.Cryptography.RSASignaturePadding.Pkcs1), "push: the signature verifies with the service account key");
    }
}
