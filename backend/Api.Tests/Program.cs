using Api;

var checks = 0;
void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
    checks++;
}
foreach (var kind in new[] { "area", "group", "direct" })
{
    Check(!ChatRules.Speakers(kind, "writers").Contains("read"), $"{kind}: channel readers cannot publish");
    Check(ChatRules.Speakers(kind, "writers").Contains("write"), $"{kind}: area writer can publish in channel");
    Check(ChatRules.Speakers(kind, "writers").Contains("admin"), $"{kind}: administrator can publish");
    Check(!ChatRules.Speakers(kind, "writers").Contains("certify"), $"{kind}: membership management alone cannot publish");
    Check(ChatRules.Speakers(kind, "members").Contains("read"), $"{kind}: all-member policy permits readers");
    Check(ChatRules.Speakers(kind, "legacy").Contains("read") == (kind == "area"), $"{kind}: legacy behavior preserved");
    Check(!ChatRules.SeatCanWrite(kind, "writers"), $"{kind}: seat cannot publish in channel");
    Check(ChatRules.SeatCanWrite(kind, "members") == (kind == "area"), $"{kind}: seats only access area chats");
}
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
Console.WriteLine($"Passed {checks} chat authorization, scheduling and availability checks.");
