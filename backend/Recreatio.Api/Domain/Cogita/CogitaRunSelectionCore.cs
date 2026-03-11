namespace Recreatio.Api.Domain.Cogita;

public static class CogitaRunSelectionCore
{
    public static string NormalizeMode(string? raw)
    {
        var mode = raw?.Trim().ToLowerInvariant();
        return mode switch
        {
            "solo" => "random-once",
            "shared" => "random-once",
            "group_async" => "temporal",
            "group_sync" => "levels",
            "random" => "random",
            "random-once" => "random-once",
            "levels" => "levels",
            "temporal" => "temporal",
            "full-stack" => "full-stack",
            _ => "random"
        };
    }

    public static List<int> OrderRemainingRoundIndexes(
        IEnumerable<int> remainingRoundIndexes,
        Guid participantSeed,
        string mode,
        IReadOnlyDictionary<int, double>? knownessByRound)
    {
        var normalizedMode = NormalizeMode(mode);
        var list = remainingRoundIndexes.Distinct().ToList();

        if (normalizedMode is "levels" or "temporal")
        {
            list.Sort((left, right) =>
            {
                var leftKnowness = knownessByRound is not null && knownessByRound.TryGetValue(left, out var lk) ? lk : 0d;
                var rightKnowness = knownessByRound is not null && knownessByRound.TryGetValue(right, out var rk) ? rk : 0d;
                var compare = leftKnowness.CompareTo(rightKnowness);
                if (compare != 0)
                {
                    return compare;
                }

                return left.CompareTo(right);
            });
            return list;
        }

        if (normalizedMode == "random-once" || normalizedMode == "full-stack" || normalizedMode == "random")
        {
            var random = new Random(HashCode.Combine(participantSeed, list.Count, normalizedMode));
            for (var i = list.Count - 1; i > 0; i--)
            {
                var swapIndex = random.Next(i + 1);
                (list[i], list[swapIndex]) = (list[swapIndex], list[i]);
            }
        }

        return list;
    }
}
