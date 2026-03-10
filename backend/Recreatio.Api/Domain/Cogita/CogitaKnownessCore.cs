namespace Recreatio.Api.Domain.Cogita;

public readonly record struct KnownessEntry(double Correctness, DateTimeOffset CreatedUtc);

public readonly record struct KnownessSummary(double Score, DateTimeOffset? LastReviewedUtc);

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
}
