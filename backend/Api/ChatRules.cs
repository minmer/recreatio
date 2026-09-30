namespace Api;

/// <summary>Shared posting rules used by every interactive chat write path.</summary>
public static class ChatRules
{
    public static string[] Speakers(string kind, string policy) =>
        policy == "members" || (policy == "legacy" && kind == "area")
            ? ["read", "write", "admin"] : ["write", "admin"];

    public static bool SeatCanWrite(string kind, string policy) => kind == "area" && policy != "writers";

    public static bool ValidSchedule(DateTimeOffset? at, DateTimeOffset now) =>
        at is null || (at > now && at < now.AddYears(1));
}
