using System.Globalization;

namespace Api;

/// <summary>
/// DER ZEITRAUM EINER WIEDERKEHRENDEN ERWEITERUNG (0077) — als Schluessel.
///
/// <code>
///   once    ''
///   day     2026-10-02
///   week    2026-W40      (ISO 8601: Montag bis Sonntag; das Jahr der Woche)
///   month   2026-10
///   year    2026
/// </code>
///
/// <para>
/// <b>Der Browser rechnet den Schluessel, der Dienst prueft ihn.</b> Welcher
/// Tag „heute" ist, haengt davon ab, wo jemand sitzt; der Dienst weiss das
/// nicht und raet es nicht. Er nimmt deshalb jeden Schluessel an, der nach
/// der Uhr IRGENDEINES Ortes schon begonnen hat (UTC+14 ist der frueheste) —
/// nie einen aus der Zukunft.
/// </para>
///
/// <para>
/// Dieselbe Rechnung steht in <c>frontend/src/app/rounds.ts</c>; beide werden
/// gegen <c>round-keys.json</c> geprueft. Laufen sie auseinander, traegt die
/// Liste einen Monat ein, den der Dienst ablehnt.
/// </para>
/// </summary>
public static class Rounds
{
    public const string Once = "once";

    private static readonly string[] Kinds = [Once, "day", "week", "month", "year"];

    public static bool IsKind(string? kind) => kind is not null && Array.IndexOf(Kinds, kind) >= 0;

    /// <summary>Der Schluessel des Zeitraums, in dem dieser Tag liegt.</summary>
    public static string Of(string kind, DateOnly day) => kind switch
    {
        "day" => day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        "week" => $"{ISOWeek.GetYear(day.ToDateTime(TimeOnly.MinValue)):D4}-W{ISOWeek.GetWeekOfYear(day.ToDateTime(TimeOnly.MinValue)):D2}",
        "month" => day.ToString("yyyy-MM", CultureInfo.InvariantCulture),
        "year" => day.ToString("yyyy", CultureInfo.InvariantCulture),
        _ => string.Empty
    };

    /// <summary>Hat der Schluessel die Gestalt seiner Art — und gibt es den Zeitraum?</summary>
    public static bool Valid(string kind, string? round)
    {
        round ??= string.Empty;

        switch (kind)
        {
            case Once:
                return round.Length == 0;

            case "day":
                return round.Length == 10
                    && DateOnly.TryParseExact(round, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                    && d.Year >= 1900;

            case "week":
                if (round.Length != 8 || round[4] != '-' || round[5] != 'W') return false;
                if (!Year(round.AsSpan(0, 4), out var weekYear)) return false;
                if (!int.TryParse(round.AsSpan(6, 2), NumberStyles.None, CultureInfo.InvariantCulture, out var week)) return false;
                return week >= 1 && week <= ISOWeek.GetWeeksInYear(weekYear);

            case "month":
                if (round.Length != 7 || round[4] != '-') return false;
                if (!Year(round.AsSpan(0, 4), out _)) return false;
                return int.TryParse(round.AsSpan(5, 2), NumberStyles.None, CultureInfo.InvariantCulture, out var month)
                    && month is >= 1 and <= 12;

            case "year":
                return round.Length == 4 && Year(round, out _);

            default:
                return false;
        }
    }

    private static bool Year(ReadOnlySpan<char> text, out int year) =>
        int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out year) && year is >= 1900 and <= 2999;

    /// <summary>Nicht aus der Zukunft: der Zeitraum hat irgendwo auf der Welt schon begonnen.</summary>
    public static bool NotAhead(string kind, string round, DateTimeOffset now) =>
        kind == Once || string.CompareOrdinal(round, Of(kind, DateOnly.FromDateTime(now.UtcDateTime.AddHours(14)))) <= 0;

    /// <summary>
    /// Der LAUFENDE Zeitraum — fuer den Menschen, der selbst ausfuellt: er
    /// schreibt nur in den, der gerade gilt (an irgendeinem Ort der Welt).
    /// </summary>
    public static bool Current(string kind, string round, DateTimeOffset now)
    {
        if (kind == Once) return round.Length == 0;

        foreach (var hours in new[] { -12, 0, 14 })
        {
            if (round == Of(kind, DateOnly.FromDateTime(now.UtcDateTime.AddHours(hours)))) return true;
        }

        return false;
    }
}
