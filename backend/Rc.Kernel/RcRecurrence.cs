namespace Rc.Kernel;

/// <summary>
/// Wiederholungen ausrechnen.
///
/// Das steht im Kernel und nicht bei den Endpunkten, weil es der Teil des
/// Kalenders ist, an dem sich am leichtesten irren laesst — und weil ein
/// Irrtum hier nicht auffaellt: ein Termin, der einmal im Jahr auf dem
/// falschen Tag steht, sieht aus wie ein Tippfehler des Menschen, der ihn
/// eingetragen hat.
///
/// <b>Gerechnet wird in der ZEITZONE des Kalenders, nicht in UTC.</b> „Jeden
/// Montag um neun" bleibt sonst ueber die Sommerzeit hinweg nicht um neun: die
/// Reihe verschoebe sich zweimal im Jahr um eine Stunde, und beide Male hielte
/// man es fuer einen Zufall. Der Anfang wird deshalb in die oertliche Zeit
/// gebracht, dort weitergezaehlt, und erst das Ergebnis wieder nach UTC.
/// </summary>
public static class RcRecurrence
{
    public const string None = "none";
    public const string Daily = "daily";
    public const string Weekly = "weekly";
    public const string Monthly = "monthly";
    public const string Yearly = "yearly";

    /// <summary>Mo=1, Di=2, Mi=4, Do=8, Fr=16, Sa=32, So=64.</summary>
    public static byte WeekdayBit(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => 1,
        DayOfWeek.Tuesday => 2,
        DayOfWeek.Wednesday => 4,
        DayOfWeek.Thursday => 8,
        DayOfWeek.Friday => 16,
        DayOfWeek.Saturday => 32,
        DayOfWeek.Sunday => 64,
        _ => 0
    };

    /// <summary>
    /// Eine Regel, so wie sie in der Zeile steht.
    /// </summary>
    /// <param name="Until">Ende als Datum, oder <c>null</c>.</param>
    /// <param name="Count">Ende als Anzahl, oder <c>null</c>. Genau eines von beiden.</param>
    public sealed record Rule(
        string Kind, int Every, byte? Weekdays,
        DateTimeOffset? Until, int? Count);

    /// <summary>Ein einzelnes Vorkommen.</summary>
    /// <param name="OriginalStart">
    /// Der Anfang, den die Regel ergeben haette. Er bleibt auch dann stehen,
    /// wenn das Vorkommen verschoben wurde — er ist der Name dieses Termins in
    /// der Reihe, und Ausnahmen haengen daran.
    /// </param>
    public sealed record Occurrence(
        DateTimeOffset OriginalStart, DateTimeOffset Start, DateTimeOffset End, bool Moved);

    public sealed record Exception(DateTimeOffset OccurrenceAt, string Kind,
        DateTimeOffset? NewStart, DateTimeOffset? NewEnd);

    /// <summary>
    /// Die harte Obergrenze. Sie schuetzt nicht vor Boesartigkeit — dafuer
    /// sorgt die Bedingung, dass jede Reihe ein Ende braucht — sondern vor
    /// einem Tippfehler: „jeden Tag bis 2099" sind 27.000 Zeilen, und die
    /// entstehen sonst still bei jedem Blaettern.
    /// </summary>
    public const int MaxOccurrences = 1000;

    /// <summary>
    /// Die Vorkommen einer Regel im Fenster [<paramref name="from"/>,
    /// <paramref name="to"/>).
    ///
    /// Das Fenster ist nicht der Anfang der Rechnung: gezaehlt wird IMMER vom
    /// urspruenglichen Anfang an, sonst laege bei „jeden dritten Tag" der
    /// Rhythmus je nach angesehenem Monat woanders. Nur ausgegeben wird, was
    /// ins Fenster faellt.
    /// </summary>
    public static IReadOnlyList<Occurrence> Expand(
        DateTimeOffset start, DateTimeOffset end, Rule rule, TimeZoneInfo zone,
        DateTimeOffset from, DateTimeOffset to,
        IReadOnlyCollection<Exception>? exceptions = null)
    {
        var length = end - start;
        var result = new List<Occurrence>();

        var cancelled = new HashSet<DateTimeOffset>();
        var moved = new Dictionary<DateTimeOffset, Exception>();

        foreach (var e in exceptions ?? [])
        {
            if (e.Kind == "cancelled") cancelled.Add(e.OccurrenceAt);
            else if (e.Kind == "moved") moved[e.OccurrenceAt] = e;
        }

        // Ein einzelner Termin ist eine Reihe mit einem Glied. Ihn getrennt zu
        // behandeln hiesse, dieselbe Ausnahmenlogik zweimal zu schreiben.
        if (rule.Kind == None)
        {
            Add(result, start, length, from, to, cancelled, moved);
            return result;
        }

        var every = Math.Max(1, rule.Every);
        var local = TimeZoneInfo.ConvertTime(start, zone);
        var emitted = 0;

        for (var step = 0; step < MaxOccurrences * 8; step++)
        {
            // Weiter als das Fenster reicht, wird nicht gerechnet — mit einer
            // Ausnahme: bei `Count` muss bis dorthin gezaehlt werden, sonst
            // stimmte die Anzahl nicht.
            var candidate = NextLocal(local, rule.Kind, every, step);
            if (candidate is null) break;

            var utc = ToUtc(candidate.Value, zone);

            if (rule.Until is not null && utc > rule.Until.Value) break;

            // Bei `weekly` zaehlt der Schritt TAGE — nur so lassen sich
            // mehrere Wochentage derselben Woche ausgeben. Der Abstand gilt
            // dann fuer die WOCHE: „alle zwei Wochen montags und mittwochs"
            // heisst zwei Termine, dann zwoelf Tage Pause — nicht zwei
            // Termine alle vier Wochen.
            if (rule.Kind == Weekly)
            {
                var weeksApart = WeeksBetween(local.Date, candidate.Value.Date);
                if (weeksApart % every != 0) continue;

                var mask = rule.Weekdays ?? WeekdayBit(local.DayOfWeek);
                if ((mask & WeekdayBit(candidate.Value.DayOfWeek)) == 0) continue;

                // Vor dem Anfang liegt nichts: bei mehreren Wochentagen faellt
                // sonst der Montag einer Reihe mit an, die mittwochs beginnt.
                if (candidate.Value < local) continue;
            }

            emitted++;
            if (rule.Count is not null && emitted > rule.Count.Value) break;

            Add(result, utc, length, from, to, cancelled, moved);

            if (result.Count >= MaxOccurrences) break;
            if (rule.Count is null && utc > to) break;
        }

        return result;
    }

    /// <summary>
    /// Der naechste oertliche Anfang nach <paramref name="step"/> Schritten.
    ///
    /// Bei `weekly` ist ein Schritt ein TAG; der Wochenabstand wird beim
    /// Aufrufer geprueft, zusammen mit der Wochentagsmaske. Bei allem anderen
    /// ist ein Schritt eine ganze Periode.
    /// </summary>
    private static DateTimeOffset? NextLocal(DateTimeOffset start, string kind, int every, int step) =>
        kind switch
        {
            Daily => start.AddDays((long)step * every),
            Weekly => start.AddDays(step),

            // AddMonths schneidet auf den letzten Tag des Monats zu: der 31.
            // wird im Februar zum 28. Das ist die gaengige Erwartung — „jeden
            // 31." im Februar gibt es nicht, und den Termin ganz ausfallen zu
            // lassen ueberrascht mehr, als ihn zu verschieben.
            Monthly => start.AddMonths(step * every),
            Yearly => start.AddYears(step * every),

            _ => null
        };

    /// <summary>
    /// Ganze Wochen zwischen zwei Tagen, gezaehlt ueber die MONTAGE ihrer
    /// Wochen. Der blosse Tagesabstand durch sieben waere falsch: von Freitag
    /// zu Montag sind es drei Tage und trotzdem eine Woche weiter.
    /// </summary>
    private static int WeeksBetween(DateTime a, DateTime b) =>
        (int)((StartOfWeek(b) - StartOfWeek(a)).TotalDays / 7);

    private static DateTime StartOfWeek(DateTime date)
    {
        var shift = ((int)date.DayOfWeek + 6) % 7;   // Montag = 0
        return date.AddDays(-shift);
    }

    /// <summary>
    /// Oertliche Zeit zurueck nach UTC — und der Fall, an dem sich Kalender
    /// blamieren.
    ///
    /// Bei der Umstellung auf Sommerzeit gibt es eine Stunde NICHT. Ein Termin,
    /// der darin liegt, muss irgendwohin; er verschwinden zu lassen waere die
    /// schlechteste Wahl. Er rueckt deshalb hinter die Luecke.
    ///
    /// Bei der Rueckstellung gibt es eine Stunde ZWEIMAL. Genommen wird die
    /// ERSTE — wer „halb drei" sagt, meint das erste halb drei, nicht das
    /// eine Stunde spaetere.
    ///
    /// Dafuer wird der GROESSTE Versatz gewaehlt und nicht der erste aus der
    /// Liste. <c>GetAmbiguousTimeOffsets()</c> sagt nichts ueber seine
    /// Reihenfolge zu, und tatsaechlich steht dort die Winterzeit vorn — also
    /// der SPAETERE Zeitpunkt. Der erste Anlauf hier nahm <c>[0]</c> und
    /// bekam damit das Gegenteil dessen, was daneben stand.
    /// </summary>
    private static DateTimeOffset ToUtc(DateTimeOffset local, TimeZoneInfo zone)
    {
        var naive = DateTime.SpecifyKind(local.DateTime, DateTimeKind.Unspecified);

        if (zone.IsInvalidTime(naive))
        {
            // Die Luecke ist bei jeder bekannten Zeitzone hoechstens zwei
            // Stunden lang; in Minutenschritten hinauszugehen findet die
            // naechste gueltige Zeit, ohne etwas anzunehmen.
            for (var minutes = 1; minutes <= 180; minutes++)
            {
                var shifted = naive.AddMinutes(minutes);
                if (!zone.IsInvalidTime(shifted)) { naive = shifted; break; }
            }
        }

        // Groesster Versatz = frueheste UTC-Zeit = das erste Vorkommen der
        // doppelten Stunde. Nicht [0]: die Reihenfolge ist nicht zugesagt.
        var offset = zone.IsAmbiguousTime(naive)
            ? zone.GetAmbiguousTimeOffsets(naive).Max()
            : zone.GetUtcOffset(naive);

        return new DateTimeOffset(naive, offset).ToUniversalTime();
    }

    private static void Add(
        List<Occurrence> into, DateTimeOffset start, TimeSpan length,
        DateTimeOffset from, DateTimeOffset to,
        HashSet<DateTimeOffset> cancelled, Dictionary<DateTimeOffset, Exception> moved)
    {
        // Abgesagt heisst: kommt nicht vor. Es bleibt trotzdem in der Tabelle
        // stehen, damit die Reihe die Regel behaelt — aber es wird nicht
        // ausgegeben.
        if (cancelled.Contains(start)) return;

        var actualStart = start;
        var actualEnd = start + length;
        var wasMoved = false;

        if (moved.TryGetValue(start, out var exception))
        {
            actualStart = exception.NewStart!.Value;
            actualEnd = exception.NewEnd!.Value;
            wasMoved = true;
        }

        // Das Fenster wird gegen die TATSAECHLICHE Zeit geprueft, nicht gegen
        // die urspruengliche: ein Termin, der in das Fenster hinein verschoben
        // wurde, gehoert hinein — und einer, der hinaus verschoben wurde,
        // nicht mehr.
        if (actualEnd <= from || actualStart >= to) return;

        into.Add(new Occurrence(start, actualStart, actualEnd, wasMoved));
    }
}
