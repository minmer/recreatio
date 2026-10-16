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
/* 0095 — in a conversation a PERSON speaks: herself, or through a role she holds. */
{
    var anna = Guid.NewGuid(); var jan = Guid.NewGuid(); var rada = Guid.NewGuid();
    Check(ChatRules.PersonFor(anna, true, [], null) is { Person: var p1, Status: 200 } && p1 == anna, "a person speaks for herself");
    Check(ChatRules.PersonFor(anna, true, [], jan).Status == 400, "a person role cannot carry another person");
    Check(ChatRules.PersonFor(rada, false, [anna], null).Person == anna, "the only person holding the role is assumed");
    Check(ChatRules.PersonFor(rada, false, [anna, jan], null) is { Person: null, Status: 400 }, "two persons: one must be chosen");
    Check(ChatRules.PersonFor(rada, false, [anna, jan], jan).Person == jan, "the chosen person speaks");
    Check(ChatRules.PersonFor(rada, false, [anna], jan).Status == 403, "a person who does not hold the role cannot speak through it");
    Check(ChatRules.PersonFor(rada, false, [], null).Status == 403, "a role nobody of the account holds as a person cannot speak");
}
/* 0097 — names never lie in the open: the service only checks that a sealed name is an envelope, with its epoch. */
{
    var envelope = Kernel.Base64Url.Encode(new byte[60]);
    Check(Names.Blob(envelope) is { Length: 60 }, "a sealed name: an envelope of a sane size");
    Check(Names.Blob(Kernel.Base64Url.Encode(new byte[48])) is null, "shorter than header, nonce and tag: no envelope");
    Check(Names.Blob(Kernel.Base64Url.Encode(new byte[1025])) is null, "longer than any name: refused");
    Check(Names.Blob("Jan Kowalski") is null && Names.Blob(null) is null, "plaintext is not an envelope");
    Check(Names.Read(null, null) is { Sealed: null, Error: null }, "nothing given: nothing, and no error");
    Check(Names.Read(envelope, 3) is { Sealed.Length: 60, Epoch: 3, Error: null }, "an envelope with its epoch");
    Check(Names.Read(envelope, null).Error is not null && Names.Read(envelope, 0).Error is not null, "an envelope without its epoch: an error");
    Check(Names.Read("Jan Kowalski", 1).Error is not null, "a plaintext name instead of an envelope: an error");
}
/* 0098 — a task for a period: which days count, and what a plan must say. */
{
    var october = Form.ReadTaskPlan("2026-10-01", "2026-10-31", "daily", null, 18 * 60, 30, 5, null, null);
    Check(october.Plan is { Schedule: "daily", AtMinute: 1080, Needed: 5 } && october.Plan.ReportsUntil == new DateOnly(2026, 11, 7), "a daily rosary in October, at 18:00, five times; marks until a week after");
    Check(Form.TaskDay(october.Plan!, new DateOnly(2026, 10, 15)) && !Form.TaskDay(october.Plan!, new DateOnly(2026, 11, 1)), "a day in October counts, November does not");
    Check(Form.WeekdayBit(new DateOnly(2026, 10, 12)) == 1 && Form.WeekdayBit(new DateOnly(2026, 10, 16)) == 16 && Form.WeekdayBit(new DateOnly(2026, 10, 18)) == 64, "Monday 1, Friday 16, Sunday 64");
    var fridays = Form.ReadTaskPlan("2026-10-01", "2026-10-31", "weekly", 16, null, null, null, null, null).Plan!;
    Check(Form.TaskDay(fridays, new DateOnly(2026, 10, 16)) && !Form.TaskDay(fridays, new DateOnly(2026, 10, 15)), "on Fridays: Friday yes, Thursday no");
    Check(Form.ReadTaskPlan("2026-10-01", "2026-10-31", "weekly", 16, null, null, 6, null, null).Error is not null, "five Fridays cannot be needed six times");
    Check(Form.ReadTaskPlan("2026-10-31", "2026-10-01", "daily", null, null, null, null, null, null).Error is not null, "an end before the start is refused");
    Check(Form.ReadTaskPlan("2026-10-01", "2026-10-31", "weekly", null, null, null, null, null, null).Error is not null, "weekly without weekdays is refused");
    Check(Form.ReadTaskPlan("2026-10-05", "2026-10-06", "weekly", 16, null, null, null, null, null).Error is not null, "a period without any of its weekdays is refused");
    Check(Form.ReadTaskPlan("2026-10-01", "2026-10-31", "any", null, null, null, null, "2026-10-05", null).Error is not null, "visible from after the start is refused");
    Check(Form.ReadTaskPlan("2026-10-01", "2026-10-31", "any", null, null, null, null, "2026-09-25", "2026-11-15").Plan is { ReportsUntil.Month: 11, ReportsUntil.Day: 15 }, "a film any day in October, shown from 25 September, marks until 15 November");

    /* 0099 — an Terminen eines Kalenders: welcher, vorher fragen, wer die Liste führt; die Tage sind die Termine. */
    var item = Guid.NewGuid();
    var meetings = Form.ReadTaskPlan("2026-10-01", "2026-12-31", "item", null, 19 * 60, 90, 2, null, null, item.ToString(), true, "office");
    Check(meetings.Plan is { Schedule: "item", Presence: true, DoneBy: "office", AtMinute: null, Minutes: null } && meetings.Plan.ItemId == item,
        "a task on calendar dates: the item, asked before, the office keeps the list (time comes from the calendar)");
    Check(Form.ReadTaskPlan("2026-10-01", "2026-12-31", "item", null, null, null, null, null, null).Error is not null, "calendar dates without an item are refused");
    Check(Form.ReadTaskPlan("2026-10-01", "2026-10-31", "daily", null, null, null, null, null, null, null, true).Error is not null, "asking before is only for calendar dates");
    Check(Form.ReadTaskPlan("2026-10-01", "2026-10-31", "daily", null, null, null, null, null, null, null, false, "nobody").Error is not null, "who keeps the list: person or office");
    var dated = meetings.Plan! with
    {
        Dates = [new Form.TaskDate(new DateOnly(2026, 10, 4), DateTimeOffset.Parse("2026-10-04T17:00:00Z"), DateTimeOffset.Parse("2026-10-04T18:30:00Z"))]
    };
    Check(Form.TaskDay(dated, new DateOnly(2026, 10, 4)) && !Form.TaskDay(dated, new DateOnly(2026, 10, 5)), "on calendar dates: the date yes, the next day no");
    Check(Form.DatesProblem(dated) is not null, "one date cannot be needed twice");
    Check(Form.DatesProblem(dated with { Dates = [] }) is not null, "no dates in the period is said");
    Check(Form.DatesProblem(dated with { Needed = 1 }) is null, "one date, needed once: fine");
}
await ApiErrorChecks.RunAsync(Check);
FileLoggerChecks.Run(Check);
PageFileChecks.Run(Check);
LibraryChecks.Run(Check);
PlatformChecks.Run(Check);
CogitaChecks.Run(Check);
Console.WriteLine($"Passed {checks} chat authorization, scheduling and availability checks.");
