namespace Recreatio.Api.Domain.Cogita;

public readonly record struct KnownessEntry(double Correctness, DateTimeOffset CreatedUtc);

public readonly record struct KnownessSummary(double Score, DateTimeOffset? LastReviewedUtc);
public readonly record struct KnownessOutcomeEntry(string OutcomeClass, DateTimeOffset CreatedUtc);

public static class CogitaKnownessCore
{
    public static KnownessSummary ComputeSummary(IEnumerable<KnownessEntry> rawEntries, DateTimeOffset nowUtc)
    {
        var entries = rawEntries
            .OrderBy(x => x.CreatedUtc)
            .TakeLast(5)
            .ToList();
        if (entries.Count == 0)
        {
            return new KnownessSummary(0d, null);
        }

        var avgCorrectness = entries.Average(x => Math.Clamp(x.Correctness, 0d, 1d));
        const double tauMinutes = 5d;
        const double scale = 2d;
        const double correctBonus = 0.15d;

        var timeScore = 0d;
        var bonus = 0d;
        for (var i = 0; i < entries.Count; i++)
        {
            var start = entries[i].CreatedUtc;
            var end = i == entries.Count - 1 ? nowUtc : entries[i + 1].CreatedUtc;
            var deltaMinutes = Math.Max(0d, (end - start).TotalMinutes);
            var timeFactor = 1d - Math.Exp(-deltaMinutes / tauMinutes);
            timeScore += timeFactor;
            if (entries[i].Correctness > 0.5d)
            {
                bonus += correctBonus;
            }
        }

        var knowness = avgCorrectness * timeScore * scale + bonus;
        var lastReviewed = entries[^1].CreatedUtc;
        var minutesSinceLast = Math.Max(0d, (nowUtc - lastReviewed).TotalMinutes);
        const double decayTauMinutes = 60d;
        var decay = 1d / (1d + Math.Log(1d + (minutesSinceLast / decayTauMinutes)));
        knowness *= decay;

        const double shortBoostTauMinutes = 2d;
        const double shortBoostAmount = 5.44d;
        if (entries.Count == 1 && entries[0].Correctness > 0.5d)
        {
            knowness += shortBoostAmount * Math.Exp(-minutesSinceLast / shortBoostTauMinutes);
        }

        var score = Math.Round(Math.Clamp(knowness * 100d, 0d, 100d), 2);
        return new KnownessSummary(score, lastReviewed);
    }

    public static string NormalizeOutcomeClass(string? raw)
    {
        var value = raw?.Trim().ToLowerInvariant();
        return value switch
        {
            "correct" => "correct",
            "blank_timeout" => "blank_timeout",
            _ => "wrong"
        };
    }

    public static double OutcomeSignal(string outcomeClass)
    {
        return NormalizeOutcomeClass(outcomeClass) switch
        {
            "correct" => 1d,
            "blank_timeout" => 0.15d,
            _ => 0d
        };
    }

    public static KnownessSummary ComputeOutcomePolicySummary(
        IEnumerable<KnownessOutcomeEntry> rawEntries,
        DateTimeOffset nowUtc)
    {
        var entries = rawEntries
            .OrderBy(x => x.CreatedUtc)
            .TakeLast(96)
            .ToList();
        if (entries.Count == 0)
        {
            return new KnownessSummary(0d, null);
        }

        var weights = new double[entries.Count];
        var signals = new double[entries.Count];
        var lastReviewedUtc = entries[^1].CreatedUtc;
        const double tauHours = 24d * 14d;
        for (var i = 0; i < entries.Count; i++)
        {
            var ageHours = Math.Max(0d, (nowUtc - entries[i].CreatedUtc).TotalHours);
            var w = Math.Exp(-(ageHours / tauHours));
            weights[i] = Math.Clamp(w, 0.0001d, 1d);
            signals[i] = OutcomeSignal(entries[i].OutcomeClass);
        }

        var weightedSignal = 0d;
        var weightTotal = 0d;
        var correctCount = 0;
        var wrongCount = 0;
        var blankCount = 0;
        for (var i = 0; i < entries.Count; i++)
        {
            weightedSignal += signals[i] * weights[i];
            weightTotal += weights[i];
            switch (NormalizeOutcomeClass(entries[i].OutcomeClass))
            {
                case "correct":
                    correctCount++;
                    break;
                case "blank_timeout":
                    blankCount++;
                    break;
                default:
                    wrongCount++;
                    break;
            }
        }

        var totalCount = Math.Max(1, correctCount + wrongCount + blankCount);
        var baseAccuracy = weightTotal > 0 ? (weightedSignal / weightTotal) : 0d;
        var wrongRatio = wrongCount / (double)totalCount;
        var blankRatio = blankCount / (double)totalCount;
        var confidence = 1d - Math.Exp(-(totalCount / 4d));
        var stabilized = (baseAccuracy - (wrongRatio * 0.35d) - (blankRatio * 0.25d)) * confidence;

        var hoursSinceLast = Math.Max(0d, (nowUtc - lastReviewedUtc).TotalHours);
        var slowDecay = 1d / (1d + Math.Log(1d + (hoursSinceLast / (24d * 5d))));
        var score = Math.Round(Math.Clamp(stabilized * slowDecay * 100d, 0d, 100d), 2);
        return new KnownessSummary(score, lastReviewedUtc);
    }
}
