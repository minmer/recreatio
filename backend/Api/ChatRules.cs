namespace Api;

/// <summary>Shared posting rules used by every interactive chat write path.</summary>
public static class ChatRules
{
    /* 0069 — in der Rozmowa mit einem Platz (`seat`) schreibt, wer den Bereich liest — wie in der des Bereichs. */
    public static string[] Speakers(string kind, string policy) =>
        policy == "members" || (policy == "legacy" && kind is "area" or "seat")
            ? ["read", "write", "admin"] : ["write", "admin"];

    /// <summary>Ein Platz schreibt in der Rozmowa seines Bereichs — und in seiner eigenen (0069).</summary>
    public static bool SeatCanWrite(string kind, string policy) => kind is "area" or "seat" && policy != "writers";

    public static bool ValidSchedule(DateTimeOffset? at, DateTimeOffset now) =>
        at is null || (at > now && at < now.AddYears(1));
}
