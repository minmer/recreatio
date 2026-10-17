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

    /// <summary>
    /// 2026-10-17 — DIE ZASADA AUSGESCHRIEBEN. `legacy` hiess: in den Zugängen
    /// mit Menschen (Rozmowa des Bereichs, einer mit einem) wie `members`, in den
    /// eigenen Rozmowy (Gruppe, zu zweit, Notatki) wie `writers` — genau so
    /// rechnen <see cref="Speakers"/>, <see cref="SeatCanWrite"/> und die
    /// Zustellung. Neue Rozmowy bekommen die ausgeschriebene Zasada, alte stellt
    /// die Übertragung um (<c>Transfer</c>); danach kann `legacy` gehen.
    /// </summary>
    public static string Explicit(string kind, string policy) =>
        policy != "legacy" ? policy
        : kind is "area" or "seat" ? "members"
        : "writers";

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

    /*
     * 0095 — IN EINER ROZMOWA SPRICHT EINE PERSON. Wer über eine Rolle schreibt,
     * die keine Person ist („Rada", ein Link), sagt, WELCHE seiner Personen
     * durch sie spricht — sie steht dann vor der Rolle: „Anna Nowak (Rada)".
     */

    /// <summary>Was aus der Frage „wer spricht" wird: eine Person, oder warum nicht.</summary>
    public sealed record Speaking(Guid? Person, int Status, string? Error);

    /// <summary>
    /// DIE PERSON, DIE DURCH <paramref name="author"/> SPRICHT.
    /// <list type="bullet">
    ///   <item>Ist die Rolle selbst eine Person, ist sie es — eine andere Angabe ist ein Fehler.</item>
    ///   <item>Sonst eine der <paramref name="candidates"/> (die Personen des Kontos, die die Rolle halten):
    ///         die genannte, oder — ohne Angabe — die einzige.</item>
    /// </list>
    /// </summary>
    public static Speaking PersonFor(Guid author, bool authorIsPerson, IReadOnlyCollection<Guid> candidates, Guid? asked)
    {
        if (authorIsPerson)
        {
            return asked is null || asked == author
                ? new Speaking(author, 200, null)
                : new Speaking(null, 400, "Ta osoba pisze sama za siebie — nie przez inną.");
        }

        if (candidates.Count == 0)
        {
            return new Speaking(null, 403, "Do rozmowy potrzebna jest osoba, która trzyma tę rolę.");
        }

        if (asked is Guid one)
        {
            return candidates.Contains(one)
                ? new Speaking(one, 200, null)
                : new Speaking(null, 403, "Ta osoba nie pisze przez tę rolę.");
        }

        return candidates.Count == 1
            ? new Speaking(candidates.First(), 200, null)
            : new Speaking(null, 400, "Wybierz, która osoba pisze przez tę rolę.");
    }

    /*
     * 0097 — den Namen einer Person aus einem Link (Vor- und Nachname, beide da,
     * ohne Steuerzeichen) setzt der BROWSER zusammen (`linkPerson.ts`
     * `personName`) und versiegelt ihn; der Dienst sieht ihn nicht mehr.
     */
}
