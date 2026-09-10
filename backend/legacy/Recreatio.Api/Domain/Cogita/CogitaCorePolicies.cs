namespace Recreatio.Api.Domain.Cogita;

public static class CogitaCorePolicies
{
    private static readonly HashSet<string> AllowedRunScopes =
    [
        "solo",
        "shared",
        "group_async",
        "group_sync"
    ];

    private static readonly HashSet<string> AllowedRunStatuses =
    [
        "draft",
        "lobby",
        "active",
        "paused",
        "finished",
        "archived"
    ];

    public static string NormalizeRunScope(string? raw)
    {
        var normalized = (raw ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedRunScopes.Contains(normalized) ? normalized : "solo";
    }

    public static string NormalizeRunStatus(string? raw)
    {
        var normalized = (raw ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedRunStatuses.Contains(normalized) ? normalized : "draft";
    }

    public static bool IsKnownessOutcome(string? raw)
    {
        var normalized = CogitaKnownessCore.NormalizeOutcomeClass(raw);
        return normalized is "correct" or "wrong" or "blank_timeout";
    }
}
