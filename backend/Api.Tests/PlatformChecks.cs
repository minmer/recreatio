using System.Text.Json;
using Api;

/// <summary>
/// 0065–0071 — was ohne Datenbank nachzumessen ist: Links mit Zugang,
/// Aufgaben mit Zeitraum und Erinnerungen, normalisierte Adressen (dieselbe
/// Tabelle wie `app-platform-check.mjs`).
/// </summary>
internal static class PlatformChecks
{
    public static void Run(Action<bool, string> check)
    {
        Invites(check);
        TaskPeriods(check);
        Postal(check);
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

        check(Api.Postal.Check(new(null, "", "", "", "", "", "", "")) is not null, "postal: an empty address is refused");
        check(Api.Postal.Check(new(null, "3114", "Kraków", "", "", "Długa", "5", "")) is not null, "postal: a malformed postcode is refused");
        check(Api.Postal.Check(new(null, "", "", "", "", "", "12", "")) is not null, "postal: a house number alone is no address");
        check(Api.Postal.Check(new(null, "", "", "Zawoja", "", "", "1234", "")) is null, "postal: a village with a number is an address");
        check(Api.Postal.Prefix("postcode", "311") == "31-1", "postal: postcode prefixes keep their hyphen");
    }
}
