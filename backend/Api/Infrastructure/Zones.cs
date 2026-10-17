namespace Api;

/// <summary>
/// Zeitzonen — und warum das eine eigene Datei ist.
///
/// <para>
/// <b>Zweimal im Betrieb schiefgegangen.</b> Erst rechnete die Messreihe in
/// festen 24-Stunden-Schritten und stand ab Ende Oktober eine Stunde daneben.
/// Dann fiel die Aufloesung von „Europe/Warsaw" auf dem Wirt still auf UTC
/// zurueck, und der Plan lag zwei Stunden daneben — beides sah wie ein
/// richtiger Plan aus.
/// </para>
///
/// <para>
/// Beides ist hier abgestellt, und beides gehoert an EINE Stelle: Kalender und
/// Messen brauchen dieselbe Antwort. Zwei Fassungen davon waeren zwei
/// Gelegenheiten, dieselbe Stunde zu verlieren.
/// </para>
/// </summary>
public static class Zones
{
    /// <summary>Der vorgegebene Ort, wenn keiner genannt wurde.</summary>
    public const string Home = "Europe/Warsaw";

    /// <summary>
    /// Ein Notnagel fuer Wirte ohne ICU.
    ///
    /// <para>
    /// <b>Warum das von Hand dasteht.</b> <c>TryConvertIanaIdToWindowsId</c>
    /// stuetzt sich SELBST auf ICU. Fehlt die, scheitert nicht nur der
    /// IANA-Name, sondern auch seine Uebersetzung — auf dem Wirt fiel genau das
    /// aus, und zwar beides zugleich.
    /// </para>
    ///
    /// <para>
    /// Kurz gehalten: die Zonen, in denen diese Haeuser stehen. Was weder hier
    /// steht noch sonst aufgeht, wird abgewiesen — eine erratene Zone waere
    /// schlimmer als eine abgelehnte.
    /// </para>
    ///
    /// <para>
    /// Die dauerhafte Loesung ist ICU beim Programm selbst
    /// (<c>Microsoft.ICU.ICU4C.Runtime</c>); dann faellt diese Tabelle weg.
    /// </para>
    /// </summary>
    private static readonly (string Iana, string Windows)[] Known =
    [
        ("Europe/Warsaw", "Central European Standard Time"),
        ("Europe/Prague", "Central Europe Standard Time"),
        ("Europe/Berlin", "W. Europe Standard Time"),
        ("Europe/Rome", "W. Europe Standard Time"),
        ("Europe/Paris", "Romance Standard Time"),
        ("Europe/London", "GMT Standard Time"),
        ("Europe/Kyiv", "FLE Standard Time"),
        ("UTC", "UTC")
    ];

    /// <summary>
    /// Eine Zeitzone aufloesen — oder <c>null</c>, wenn dieser Rechner sie
    /// nicht kennt.
    ///
    /// <para>
    /// <b>Warum <c>null</c> und nicht UTC.</b> Ein stillschweigender Rueckfall
    /// auf UTC macht aus einem Problem der Einrichtung einen falschen Plan: 18
    /// Uhr Ortszeit laege als 18 Uhr UTC in der Zeile, und nichts sagte es.
    /// Wer aufraeumt, muss den Fehler sehen koennen.
    /// </para>
    /// </summary>
    public static TimeZoneInfo? Find(string? name)
    {
        var id = string.IsNullOrWhiteSpace(name) ? Home : name.Trim();

        if (Look(id) is { } direct) return direct;

        // Ohne ICU kennt Windows nur seine eigenen Namen …
        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windows)
            && Look(windows) is { } byWindows)
        {
            return byWindows;
        }

        // … und umgekehrt kennt ein Linux-Wirt nur die von IANA.
        if (TimeZoneInfo.TryConvertWindowsIdToIanaId(id, out var iana)
            && Look(iana) is { } byIana)
        {
            return byIana;
        }

        // Zuletzt ohne ICU: die beiden Umrechnungen oben brauchen sie selbst.
        foreach (var (known, native) in Known)
        {
            if (string.Equals(id, known, StringComparison.OrdinalIgnoreCase)
                && Look(native) is { } asWindows)
            {
                return asWindows;
            }

            if (string.Equals(id, native, StringComparison.OrdinalIgnoreCase)
                && Look(known) is { } asIana)
            {
                return asIana;
            }
        }

        return null;

        static TimeZoneInfo? Look(string id)
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { return null; }
            catch (InvalidTimeZoneException) { return null; }
        }
    }

    /// <summary>
    /// Dasselbe fuers LESEN, wo nicht abgebrochen werden darf: eine Seite ohne
    /// Plan waere schlimmer als einer, dessen Zone einmal nicht aufging.
    ///
    /// <para>
    /// Seit das Anlegen unbekannte Zonen zurueckweist, kann das im Betrieb nicht
    /// mehr eintreten — es sei denn, ein anderer Rechner hat die Zeile
    /// geschrieben.
    /// </para>
    /// </summary>
    public static TimeZoneInfo Of(string? name) => Find(name) ?? TimeZoneInfo.Utc;

    /// <summary>
    /// Eine Ortszeit zu einem Augenblick machen.
    ///
    /// <para>
    /// Zweimal im Jahr ist das nicht eindeutig: eine Stunde gibt es nicht, eine
    /// andere zweimal. Beides wird hier ENTSCHIEDEN — die fehlende Stunde rueckt
    /// vor, die doppelte nimmt den ersten Durchgang. Ohne diese Wahl wuerfe die
    /// Umrechnung, und eine Reihe braeche an einem Tag im Jahr ganz ab.
    /// </para>
    /// </summary>
    public static DateTimeOffset AtLocal(DateTime wall, TimeZoneInfo zone)
    {
        if (zone.IsInvalidTime(wall)) wall = wall.AddHours(1);
        return new DateTimeOffset(wall, zone.GetUtcOffset(wall));
    }

    /// <summary>
    /// Dieselben Bits wie im Altbestand und im Browser: Montag ist das erste.
    /// <c>DayOfWeek</c> faengt bei Sonntag an — genau die Art Unterschied, die
    /// sechs Tage die Woche funktioniert.
    /// </summary>
    public static int BitOf(DayOfWeek day) =>
        day == DayOfWeek.Sunday ? 64 : 1 << ((int)day - 1);
}
