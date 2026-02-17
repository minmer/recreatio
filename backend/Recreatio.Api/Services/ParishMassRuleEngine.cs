using System.Globalization;
using System.Text.Json;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data.Parish;

namespace Recreatio.Api.Services;

public static class ParishMassRuleEngine
{
    private sealed record MassDraft(
        DateOnly Date,
        TimeOnly? Time,
        string ChurchName,
        string Title,
        string? Note,
        bool IsCollective,
        int? DurationMinutes,
        string? Kind,
        string? BeforeService,
        string? AfterService,
        List<ParishMassIntentionInput> Intentions,
        string? DonationSummary);

    public static IReadOnlyList<ParishMass> Simulate(
        Guid parishId,
        Guid? sourceRuleId,
        ParishMassRuleGraph graph,
        DateOnly fromDate,
        DateOnly toDate)
    {
        if (fromDate > toDate || graph.Nodes.Count == 0)
        {
            return Array.Empty<ParishMass>();
        }

        var nodeById = graph.Nodes
            .Where(x => !string.IsNullOrWhiteSpace(x.Id))
            .GroupBy(x => x.Id.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(x => x.First())
            .ToDictionary(x => x.Id.Trim(), x => x, StringComparer.OrdinalIgnoreCase);
        if (!nodeById.ContainsKey(graph.StartNodeId))
        {
            return Array.Empty<ParishMass>();
        }

        var output = new List<ParishMass>();
        for (var current = fromDate; current <= toDate; current = current.AddDays(1))
        {
            var draft = new MassDraft(
                current,
                null,
                string.Empty,
                string.Empty,
                null,
                false,
                null,
                null,
                null,
                null,
                new List<ParishMassIntentionInput>(),
                null);

            var pointer = graph.StartNodeId;
            var guard = 0;
            while (!string.IsNullOrWhiteSpace(pointer) && guard < 128)
            {
                guard += 1;
                if (!nodeById.TryGetValue(pointer, out var node))
                {
                    break;
                }

                var next = node.NextId;
                var matched = EvaluateNode(node, current, ref draft);
                if (!matched && !string.IsNullOrWhiteSpace(node.ElseId))
                {
                    next = node.ElseId;
                }

                if (string.Equals(node.Type, "Emit", StringComparison.OrdinalIgnoreCase))
                {
                    var mass = BuildMass(parishId, sourceRuleId, draft);
                    if (mass is not null)
                    {
                        output.Add(mass);
                    }
                }

                if (string.Equals(node.Type, "Stop", StringComparison.OrdinalIgnoreCase))
                {
                    break;
                }

                pointer = next;
            }
        }

        return output;
    }

    private static ParishMass? BuildMass(Guid parishId, Guid? sourceRuleId, MassDraft draft)
    {
        if (draft.Time is null || string.IsNullOrWhiteSpace(draft.ChurchName) || string.IsNullOrWhiteSpace(draft.Title))
        {
            return null;
        }

        var dateTime = draft.Date.ToDateTime(draft.Time.Value, DateTimeKind.Local);
        var now = DateTimeOffset.UtcNow;
        return new ParishMass
        {
            Id = Guid.NewGuid(),
            ParishId = parishId,
            MassDateTime = new DateTimeOffset(dateTime),
            ChurchName = draft.ChurchName,
            Title = draft.Title,
            Note = draft.Note,
            IsCollective = draft.IsCollective,
            DurationMinutes = draft.DurationMinutes,
            Kind = draft.Kind,
            BeforeService = draft.BeforeService,
            AfterService = draft.AfterService,
            IntentionsJson = draft.Intentions.Count == 0 ? null : JsonSerializer.Serialize(draft.Intentions),
            DonationSummary = draft.DonationSummary,
            SourceRuleId = sourceRuleId,
            CreatedUtc = now,
            UpdatedUtc = now
        };
    }

    private static bool EvaluateNode(ParishMassRuleNode node, DateOnly day, ref MassDraft draft)
    {
        var cfg = node.Config ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.Equals(node.Type, "Weekday", StringComparison.OrdinalIgnoreCase))
        {
            if (!cfg.TryGetValue("days", out var raw) || string.IsNullOrWhiteSpace(raw))
            {
                return false;
            }

            var days = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var dayName = day.DayOfWeek.ToString().ToLowerInvariant();
            return days.Any(x => string.Equals(x, dayName, StringComparison.OrdinalIgnoreCase));
        }

        if (string.Equals(node.Type, "NthWeekdayOfMonth", StringComparison.OrdinalIgnoreCase))
        {
            if (!cfg.TryGetValue("weekday", out var weekday) || !cfg.TryGetValue("occurrences", out var occurrenceRaw))
            {
                return false;
            }

            if (!Enum.TryParse<DayOfWeek>(weekday, true, out var dayOfWeek))
            {
                return false;
            }

            if (day.DayOfWeek != dayOfWeek)
            {
                return false;
            }

            var occ = ((day.Day - 1) / 7) + 1;
            return occurrenceRaw
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => int.TryParse(x, out var n) ? n : -1)
                .Any(x => x == occ);
        }

        if (string.Equals(node.Type, "LiturgicalSeason", StringComparison.OrdinalIgnoreCase))
        {
            if (!cfg.TryGetValue("season", out var season))
            {
                return false;
            }

            var actual = ResolveLiturgicalSeason(day);
            return string.Equals(actual, season, StringComparison.OrdinalIgnoreCase);
        }

        if (string.Equals(node.Type, "Holiday", StringComparison.OrdinalIgnoreCase))
        {
            if (!cfg.TryGetValue("key", out var key))
            {
                return false;
            }

            var holiday = ResolveHolidayDate(key, day.Year);
            return holiday == day;
        }

        if (string.Equals(node.Type, "DaysAfterHoliday", StringComparison.OrdinalIgnoreCase))
        {
            if (!cfg.TryGetValue("key", out var key))
            {
                return false;
            }

            var holiday = ResolveHolidayDate(key, day.Year);
            var diff = day.DayNumber - holiday.DayNumber;
            var min = cfg.TryGetValue("min", out var minRaw) && int.TryParse(minRaw, out var minValue) ? minValue : 0;
            var max = cfg.TryGetValue("max", out var maxRaw) && int.TryParse(maxRaw, out var maxValue) ? maxValue : min;
            return diff >= min && diff <= max;
        }

        if (string.Equals(node.Type, "If", StringComparison.OrdinalIgnoreCase))
        {
            if (!cfg.TryGetValue("left", out var leftRaw) ||
                !cfg.TryGetValue("operator", out var op) ||
                !cfg.TryGetValue("right", out var rightRaw))
            {
                return false;
            }

            var left = ResolveOperand(leftRaw, day);
            var right = ResolveOperand(rightRaw, day);
            return op.Trim().ToLowerInvariant() switch
            {
                "eq" => string.Equals(left, right, StringComparison.OrdinalIgnoreCase),
                "neq" => !string.Equals(left, right, StringComparison.OrdinalIgnoreCase),
                "contains" => left.Contains(right, StringComparison.OrdinalIgnoreCase),
                _ => false
            };
        }

        if (string.Equals(node.Type, "MassTemplate", StringComparison.OrdinalIgnoreCase))
        {
            if (cfg.TryGetValue("time", out var timeRaw) && TimeOnly.TryParse(timeRaw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            {
                draft = draft with { Time = time };
            }

            if (cfg.TryGetValue("churchName", out var churchName) && !string.IsNullOrWhiteSpace(churchName))
            {
                draft = draft with { ChurchName = churchName.Trim() };
            }

            if (cfg.TryGetValue("title", out var title) && !string.IsNullOrWhiteSpace(title))
            {
                draft = draft with { Title = title.Trim() };
            }

            if (cfg.TryGetValue("note", out var note))
            {
                draft = draft with { Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim() };
            }

            if (cfg.TryGetValue("isCollective", out var collective) && bool.TryParse(collective, out var isCollective))
            {
                draft = draft with { IsCollective = isCollective };
            }

            if (cfg.TryGetValue("durationMinutes", out var durationRaw) && int.TryParse(durationRaw, out var duration))
            {
                draft = draft with { DurationMinutes = duration };
            }

            if (cfg.TryGetValue("kind", out var kind))
            {
                draft = draft with { Kind = string.IsNullOrWhiteSpace(kind) ? null : kind.Trim() };
            }

            if (cfg.TryGetValue("beforeService", out var before))
            {
                draft = draft with { BeforeService = string.IsNullOrWhiteSpace(before) ? null : before.Trim() };
            }

            if (cfg.TryGetValue("afterService", out var after))
            {
                draft = draft with { AfterService = string.IsNullOrWhiteSpace(after) ? null : after.Trim() };
            }

            if (cfg.TryGetValue("donationSummary", out var donation))
            {
                draft = draft with { DonationSummary = string.IsNullOrWhiteSpace(donation) ? null : donation.Trim() };
            }
            return true;
        }

        if (string.Equals(node.Type, "AddIntention", StringComparison.OrdinalIgnoreCase))
        {
            if (!cfg.TryGetValue("text", out var text) || string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            cfg.TryGetValue("donation", out var donation);
            draft.Intentions.Add(new ParishMassIntentionInput(text.Trim(), string.IsNullOrWhiteSpace(donation) ? null : donation.Trim()));
            return true;
        }

        return true;
    }

    private static string ResolveOperand(string raw, DateOnly day)
    {
        var value = raw.Trim();
        if (string.Equals(value, "$weekday", StringComparison.OrdinalIgnoreCase))
        {
            return day.DayOfWeek.ToString().ToLowerInvariant();
        }
        if (string.Equals(value, "$season", StringComparison.OrdinalIgnoreCase))
        {
            return ResolveLiturgicalSeason(day);
        }
        if (value.StartsWith("$holiday:", StringComparison.OrdinalIgnoreCase))
        {
            var key = value.Substring("$holiday:".Length);
            return ResolveHolidayDate(key, day.Year) == day ? "true" : "false";
        }
        return value;
    }

    private static string ResolveLiturgicalSeason(DateOnly day)
    {
        var easter = ResolveEasterSunday(day.Year);
        var ashWednesday = easter.AddDays(-46);
        var easterEnd = easter.AddDays(49);
        var adventStart = ResolveFirstAdventSunday(day.Year);
        var christmasStart = new DateOnly(day.Year, 12, 25);
        var christmasEnd = new DateOnly(day.Year + 1, 1, 13);

        if (day >= ashWednesday && day < easter)
        {
            return "lent";
        }
        if (day >= easter && day <= easterEnd)
        {
            return "easter";
        }
        if (day >= adventStart && day < christmasStart)
        {
            return "advent";
        }
        if (day >= christmasStart || day <= new DateOnly(day.Year, 1, 13))
        {
            return "christmas";
        }
        return "ordinary";
    }

    private static DateOnly ResolveHolidayDate(string key, int year)
    {
        return key.Trim().ToLowerInvariant() switch
        {
            "marymotherofgod" => new DateOnly(year, 1, 1),
            "christmas" => new DateOnly(year, 12, 25),
            "ststephen" => new DateOnly(year, 12, 26),
            "newyear" => new DateOnly(year, 1, 1),
            "epiphany" => new DateOnly(year, 1, 6),
            "presentation" => new DateOnly(year, 2, 2),
            "joseph" => new DateOnly(year, 3, 19),
            "annunciation" => new DateOnly(year, 3, 25),
            "peterandpaul" => new DateOnly(year, 6, 29),
            "assumption" => new DateOnly(year, 8, 15),
            "allsouls" => new DateOnly(year, 11, 2),
            "immaculateconception" => new DateOnly(year, 12, 8),
            "allsaints" => new DateOnly(year, 11, 1),
            "ashwednesday" => ResolveEasterSunday(year).AddDays(-46),
            "palmsunday" => ResolveEasterSunday(year).AddDays(-7),
            "holythursday" => ResolveEasterSunday(year).AddDays(-3),
            "goodfriday" => ResolveEasterSunday(year).AddDays(-2),
            "holysaturday" => ResolveEasterSunday(year).AddDays(-1),
            "easter" => ResolveEasterSunday(year),
            "eastermonday" => ResolveEasterSunday(year).AddDays(1),
            "corpuschristi" => ResolveEasterSunday(year).AddDays(60),
            "firstadventsunday" => ResolveFirstAdventSunday(year),
            _ => new DateOnly(year, 1, 1)
        };
    }

    private static DateOnly ResolveEasterSunday(int year)
    {
        var a = year % 19;
        var b = year / 100;
        var c = year % 100;
        var d = b / 4;
        var e = b % 4;
        var f = (b + 8) / 25;
        var g = (b - f + 1) / 3;
        var h = (19 * a + b - d - g + 15) % 30;
        var i = c / 4;
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = (a + 11 * h + 22 * l) / 451;
        var month = (h + l - 7 * m + 114) / 31;
        var day = ((h + l - 7 * m + 114) % 31) + 1;
        return new DateOnly(year, month, day);
    }

    private static DateOnly ResolveFirstAdventSunday(int year)
    {
        var christmas = new DateOnly(year, 12, 25);
        var cursor = christmas;
        while (cursor.DayOfWeek != DayOfWeek.Sunday)
        {
            cursor = cursor.AddDays(-1);
        }
        return cursor.AddDays(-21);
    }
}
