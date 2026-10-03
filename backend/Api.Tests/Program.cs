using Api;

var checks = 0;
void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
    checks++;
}
foreach (var kind in new[] { "area", "group", "direct", "seat" })
{
    Check(!ChatRules.Speakers(kind, "writers").Contains("read"), $"{kind}: channel readers cannot publish");
    Check(ChatRules.Speakers(kind, "writers").Contains("write"), $"{kind}: area writer can publish in channel");
    Check(ChatRules.Speakers(kind, "writers").Contains("admin"), $"{kind}: administrator can publish");
    Check(!ChatRules.Speakers(kind, "writers").Contains("certify"), $"{kind}: membership management alone cannot publish");
    Check(ChatRules.Speakers(kind, "members").Contains("read"), $"{kind}: all-member policy permits readers");
    Check(ChatRules.Speakers(kind, "legacy").Contains("read") == (kind is "area" or "seat"), $"{kind}: legacy behavior preserved");
    Check(!ChatRules.SeatCanWrite(kind, "writers"), $"{kind}: seat cannot publish in channel");
    Check(ChatRules.SeatCanWrite(kind, "members") == (kind is "area" or "seat"), $"{kind}: seats only access area and own chats");
}
/* 0080 — the channel is a kind of its own: area writers publish, everyone else (seats included) listens, whatever the policy says. */
foreach (var policy in new[] { "legacy", "members", "writers" })
{
    Check(ChatRules.Speakers("channel", policy).SequenceEqual(["write", "admin"]), $"channel/{policy}: only area writers publish");
    Check(!ChatRules.SeatCanWrite("channel", policy), $"channel/{policy}: a seat listens");
}
Check(ChatRules.HasSeats("channel") && ChatRules.HasSeats("area") && ChatRules.HasSeats("seat"), "seats are in area, channel and seat chats");
Check(!ChatRules.HasSeats("group") && !ChatRules.HasSeats("direct") && !ChatRules.HasSeats("self"), "no seats in own chats");
Check(ChatRules.FixedPolicy("area") && ChatRules.FixedPolicy("channel") && !ChatRules.FixedPolicy("group") && !ChatRules.FixedPolicy("seat"),
    "the kind decides who writes in area chats and channels; groups keep their policy");
/* 0080 — the three accesses are general (Audience); a chat kind is one of them, or none. */
Check(ChatRules.ModeOf("channel") == AudienceMode.Channel && ChatRules.ModeOf("area") == AudienceMode.Together
    && ChatRules.ModeOf("seat") == AudienceMode.One && ChatRules.ModeOf("group") is null, "chat kinds are the three accesses");
Check(!Audience.SeatWrites(AudienceMode.Channel) && Audience.SeatWrites(AudienceMode.Together) && Audience.SeatWrites(AudienceMode.One),
    "a person with a link listens in a channel, writes together and one-to-one");
Check(!Audience.Speakers(AudienceMode.Channel).Contains("read") && Audience.Speakers(AudienceMode.Together).Contains("read"),
    "area readers write together, not in a channel");
var people = Audience.PeopleOf("chat", "c.id", "c.area_id");
Check(people.Contains("app.audience_form") && people.Contains("N'chat'") && people.Contains("is_hidden = 0") && people.Contains("withdrawn_at IS NULL")
    && people.Contains("s.area_id = c.area_id"), "a thing's people: seats of its area, and its forms' people — not withdrawn, not hidden");
Check(ChatRules.SeatOfChat.Contains(people), "the chat asks the audience who its people are");
var unknown = false;
try { Audience.PeopleOf("nothing", "x.id", "x.area_id"); } catch (ArgumentException) { unknown = true; }
Check(unknown, "only registered things have an audience");
/* 0081 — „Napisz do nas" is a thing with an audience too: its forms' people may start there. */
Check(Audience.PeopleOf("module", "m.id", "m.area_id").Contains("af.subject_kind = N'module'"), "a module's people come from its forms");
var now = DateTimeOffset.Parse("2026-09-30T12:00:00Z");
Check(ChatRules.ValidSchedule(null, now), "immediate message accepted");
Check(!ChatRules.ValidSchedule(now, now), "schedule at current instant rejected");
Check(!ChatRules.ValidSchedule(now.AddMinutes(-1), now), "past schedule rejected");
Check(ChatRules.ValidSchedule(now.AddSeconds(1), now), "future schedule accepted");
Check(!ChatRules.ValidSchedule(now.AddYears(1), now), "one-year scheduling limit enforced");
Check(ChatRules.ValidSchedule(now.AddYears(1).AddTicks(-1), now), "last permitted instant accepted");
var prefs = new Chat.Preferences("Europe/Berlin", [new(1, 540, 1020)], true);
Check(Chat.AvailableAt(prefs, DateTimeOffset.Parse("2026-09-28T07:00:00Z")), "summer opening inclusive");
Check(!Chat.AvailableAt(prefs, DateTimeOffset.Parse("2026-09-28T15:00:00Z")), "closing exclusive");
Check(Chat.AvailableAt(prefs, DateTimeOffset.Parse("2026-12-07T08:00:00Z")), "winter offset respected");
Check(!Chat.AvailableAt(prefs, DateTimeOffset.Parse("2026-09-27T10:00:00Z")), "other weekday quiet");
Check(!Chat.AvailableAt(prefs with { Windows = [] }, now), "empty schedule means unavailable");
Check(Chat.AvailableAt(prefs with { UseAvailability = false }, now), "disabled schedule always available");
var fold = prefs with { Windows = [new(0, 120, 180)] };
Check(Chat.AvailableAt(fold, DateTimeOffset.Parse("2026-10-25T00:30:00Z")), "first repeated hour");
Check(Chat.AvailableAt(fold, DateTimeOffset.Parse("2026-10-25T01:30:00Z")), "second repeated hour");
await ApiErrorChecks.RunAsync(Check);
FileLoggerChecks.Run(Check);
PageFileChecks.Run(Check);
LibraryChecks.Run(Check);
PlatformChecks.Run(Check);
Console.WriteLine($"Passed {checks} chat authorization, scheduling and availability checks.");
