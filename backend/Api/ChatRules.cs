namespace Api;

/// <summary>Shared posting rules used by every interactive chat write path.</summary>
public static class ChatRules
{
    /// <summary>
    /// 0080 — die Rozmowy eines Bereichs sind die drei Zugänge (<see cref="Audience"/>):
    /// der Kanał (`channel`), die Rozmowa aller (`area`), die mit einem Menschen
    /// (`seat`). Gruppen, zu zweit und Notatki haben keine Menschen mit Link.
    /// </summary>
    public static AudienceMode? ModeOf(string kind) => kind switch
    {
        "channel" => AudienceMode.Channel,
        "area" => AudienceMode.Together,
        "seat" => AudienceMode.One,
        _ => null
    };

    /*
     * Wer schreibt: in den drei Zugängen sagt es der Zugang; die Zasada `writers`
     * macht auch daraus einen Kanał (so war er vor 0080 gebaut). In den eigenen
     * Rozmowy (Gruppe, zu zweit) sagen es ihre Einstellungen.
     */
    public static string[] Speakers(string kind, string policy) =>
        policy == "writers" ? Audience.Writers
        : ModeOf(kind) is { } mode ? Audience.Speakers(mode)
        : policy == "members" ? Audience.Readers : Audience.Writers;

    /// <summary>Ein Platz schreibt in der Rozmowa seines Bereichs — und in seiner eigenen (0069). Im Kanał liest er (0080).</summary>
    public static bool SeatCanWrite(string kind, string policy) =>
        ModeOf(kind) is { } mode && Audience.SeatWrites(mode) && policy != "writers";

    /// <summary>Wo Menschen mit Link dabei sind: in den drei Zugängen.</summary>
    public static bool HasSeats(string kind) => ModeOf(kind) is not null;

    /// <summary>Die Zasada folgt in diesen Arten aus der Art selbst — sie lässt sich nicht umstellen (0080).</summary>
    public static bool FixedPolicy(string kind) => kind is "area" or "channel" or "self";

    /// <summary>
    /// WELCHE PLÄTZE ZU EINER ROZMOWA GEHÖREN — als SQL über `s` (app.access)
    /// und `c` (app.chat), für jede Abfrage, die danach fragt: die Liste, die
    /// Schlüssel, der Zugang vom Link, die geplante Zustellung. In der mit
    /// einem Menschen nur er; im Kanał und in der Rozmowa aller die Menschen
    /// des Bereichs (<see cref="Audience.PeopleOf"/>).
    /// </summary>
    public static readonly string SeatOfChat =
        $"((c.kind = N'seat' AND s.id = c.seat_id) OR (c.kind IN (N'area', N'channel') AND {Audience.PeopleOf("chat", "c.id", "c.area_id")}))";

    public static bool ValidSchedule(DateTimeOffset? at, DateTimeOffset now) =>
        at is null || (at > now && at < now.AddYears(1));
}
