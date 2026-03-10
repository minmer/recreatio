namespace Recreatio.Api.Domain.Cogita;

public static class CogitaRunScoringCore
{
    public static int ComputeStreakContribution(string growthMode, int streakBaseValue, int streakCount, int streakLimit)
    {
        var maxValue = Math.Max(0, streakBaseValue);
        var extraCount = Math.Max(0, streakCount - 1);
        if (maxValue == 0 || extraCount == 0)
        {
            return 0;
        }

        var fullAfter = Math.Max(1, streakLimit);
        var progress = Math.Max(0d, Math.Min(1d, extraCount / (double)fullAfter));
        var scaled = NormalizeGrowth(growthMode, progress);
        return Math.Max(0, Math.Min(500000, (int)Math.Round(maxValue * scaled)));
    }

    public static double NormalizeGrowth(string growthMode, double ratio)
    {
        var clamped = Math.Max(0d, Math.Min(1d, ratio));
        return growthMode?.Trim().ToLowerInvariant() switch
        {
            "exponential" => clamped * clamped,
            "limited" => Math.Min(1d, clamped * 1.6d),
            _ => clamped
        };
    }
}
