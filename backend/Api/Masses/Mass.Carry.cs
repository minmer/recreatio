using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE EINTRÄGE WANDERN MIT — wenn sich der Termin ändert (0079; seit 0132 jede
/// Liste, nicht nur die Intentionen, und die Werte einzelner Vorkommen).
///
/// <para>
/// <b>Vorher liess sich eine Messe gar nicht ändern.</b> Ihre Intentionen
/// hängen am ursprünglichen Beginn eines Vorkommens; eine neue Uhrzeit hätte
/// sie an Adressen zurückgelassen, nach denen der Plan nie wieder fragt — still,
/// und erst am Sonntag in der Kirche bemerkt.
/// </para>
///
/// <para>
/// <b>Zugeordnet wird nach dem TAG, nicht nach der Reihenfolge.</b> Der Eintrag
/// für den 5. Oktober gilt dem Termin am 5. Oktober — wird er von 18:00 auf
/// 18:30 verlegt, geht er mit. Gibt es an dem Tag keinen Termin mehr, wird
/// NICHTS geändert und gesagt, welche Tage es sind: ein angenommener (oder
/// wartender) Eintrag verschwindet nicht, weil jemand einen Haken bei „środa"
/// entfernt hat. Zurückgezogene und abgelehnte fallen dann mit fort, ebenso die
/// Werte dieses Tages — sie standen nur noch zur Auskunft da.
/// </para>
///
/// <para>
/// Die Reservierungen (`Agenda.CarryAlongAsync`) rücken nach der Reihenfolge;
/// für sie ist „das dritte Treffen" der Name. Für einen Eintrag ist es das
/// Datum, das auf dem Zettel steht.
/// </para>
/// </summary>
public static partial class Mass
{
    /// <summary>Intentionen, die zählen: angenommen oder gefeiert — nicht die zurückgezogenen.</summary>
    internal const string LiveStatuses = Calendar.LiveStatuses;

    /// <summary>Eine Reihe, wie sie werden soll — die Angaben, aus denen ihre Vorkommen folgen.</summary>
    public sealed record Series(
        DateTimeOffset Starts, string Repeat, int Every, int? Weekdays,
        DateTimeOffset? Until, int? Count, TimeZoneInfo Zone);

    /// <summary>
    /// Für jede Adresse (den ursprünglichen Beginn eines Vorkommens) das
    /// Vorkommen der Reihe AM SELBEN TAG der Ortszeit — oder <c>null</c>.
    /// Rein und ohne Datenbank, deshalb geprüft (`Api.Tests`).
    /// </summary>
    public static Dictionary<DateTimeOffset, DateTimeOffset?> ByDay(IEnumerable<DateTimeOffset> keys, Series series)
    {
        var map = new Dictionary<DateTimeOffset, DateTimeOffset?>();

        foreach (var key in keys)
        {
            if (map.ContainsKey(key)) continue;

            var day = TimeZoneInfo.ConvertTime(key, series.Zone).Date;
            var from = Zones.AtLocal(day, series.Zone);
            var to = Zones.AtLocal(day.AddDays(1), series.Zone).AddTicks(-1);
            var found = Calendar.Occurrences(series.Starts, series.Repeat, series.Every, series.Weekdays,
                series.Until, series.Count, from, to, series.Zone);

            map[key] = found.Count > 0 ? found[0] : null;
        }

        return map;
    }

    /// <summary>
    /// Was mit den Einträgen geschieht. <c>Moves</c>: alte Adresse → neue;
    /// <c>Lost</c>: festhaltende ohne Termin (dann wird nichts geändert);
    /// <c>Dropped</c>: nur noch Auskunft ohne Termin (die fallen fort).
    /// <c>LostIntentions</c>: unter den verlorenen sind Intentionen (die Meldung sagt es so).
    /// </summary>
    public sealed record Carried(
        Dictionary<DateTimeOffset, DateTimeOffset> Moves,
        List<DateTimeOffset> Lost,
        List<DateTimeOffset> Dropped,
        bool LostIntentions = true)
    {
        public int Count => Moves.Count;
    }

    /// <summary>
    /// Was MIT den Einträgen geschähe, wenn die Reihe <paramref name="target"/>
    /// wäre — ohne etwas zu ändern. <paramref name="since"/>: nur Vorkommen ab
    /// diesem Beginn (die Übergabe einer Reihe ab einem Tag).
    /// </summary>
    internal static async Task<Carried> PlanCarryAsync(
        SqlConnection connection, SqlTransaction? tx, Guid itemId, DateTimeOffset? since,
        Series target, bool sameItem, CancellationToken ct)
    {
        var ready = await Schema.RecordsAsync(connection, ct, tx);
        var live = new Dictionary<DateTimeOffset, bool>();
        var intentions = new HashSet<DateTimeOffset>();
        var after = since is null ? "" : "AND occurrence_at >= @since";

        await using (var cmd = new SqlCommand(ready ? $"""
            SELECT occurrence_at,
                   MAX(CASE WHEN status IN {Calendar.HoldingStatuses} THEN 1 ELSE 0 END),
                   MAX(CASE WHEN status IN {Calendar.HoldingStatuses} AND list_key = N'{Calendar.IntentionList}' THEN 1 ELSE 0 END)
            FROM app.occurrence_record
            WHERE item_id = @item {after}
            GROUP BY occurrence_at
            UNION ALL
            SELECT DISTINCT occurrence_at, 0, 0 FROM app.calendar_value
            WHERE item_id = @item AND occurrence_at IS NOT NULL {after};
            """ : $"""
            SELECT occurrence_at, MAX(CASE WHEN status IN {LiveStatuses} THEN 1 ELSE 0 END), 1
            FROM app.mass_intention
            WHERE item_id = @item {after}
            GROUP BY occurrence_at;
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@item", itemId);
            if (since is not null) cmd.Parameters.AddWithValue("@since", since.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var at = reader.GetDateTimeOffset(0);
                var holds = reader.GetInt32(1) == 1;
                live[at] = live.TryGetValue(at, out var was) ? was || holds : holds;
                if (holds && reader.GetInt32(2) == 1) intentions.Add(at);
            }
        }

        var moves = new Dictionary<DateTimeOffset, DateTimeOffset>();
        var lost = new List<DateTimeOffset>();
        var dropped = new List<DateTimeOffset>();

        foreach (var (key, to) in ByDay(live.Keys, target))
        {
            if (to is null) { (live[key] ? lost : dropped).Add(key); continue; }
            if (!sameItem || to.Value != key) moves[key] = to.Value;
        }

        lost.Sort();
        return new Carried(moves, lost, dropped, LostIntentions: !ready || lost.Any(intentions.Contains));
    }

    /// <summary>Den Plan ausführen — in der Transaktion dessen, der die Reihe ändert.</summary>
    internal static async Task ApplyCarryAsync(
        SqlConnection connection, SqlTransaction tx, Guid fromItem, Guid toItem, Carried carried, CancellationToken ct)
    {
        var ready = await Schema.RecordsAsync(connection, ct, tx);
        var now = DateTimeOffset.UtcNow;

        foreach (var at in carried.Dropped)
        {
            await using var drop = new SqlCommand(ready
                ? Calendar.DropRecordsSql("item_id = @item AND occurrence_at = @at")
                  + "\nDELETE FROM app.calendar_value WHERE item_id = @item AND occurrence_at = @at;"
                : """
                DELETE FROM app.mass_intention_field
                 WHERE intention_id IN (SELECT id FROM app.mass_intention WHERE item_id = @item AND occurrence_at = @at);
                DELETE FROM app.mass_intention WHERE item_id = @item AND occurrence_at = @at;
                """, connection, tx);
            drop.Parameters.AddWithValue("@item", fromItem);
            drop.Parameters.AddWithValue("@at", at);
            await drop.ExecuteNonQueryAsync(ct);
        }

        foreach (var (at, to) in carried.Moves)
        {
            /*
             * Hinten angestellt, wenn am Ziel schon Einträge derselben Liste stehen —
             * die Reihenfolge des Vorlesens bleibt in sich, wie sie war.
             */
            await using var move = new SqlCommand(ready ? """
                UPDATE r
                   SET r.item_id = @to, r.occurrence_at = @target, r.updated_at = @now,
                       r.ordinal = r.ordinal + ISNULL((SELECT MAX(x.ordinal) + 1 FROM app.occurrence_record x
                                                        WHERE x.item_id = @to AND x.occurrence_at = @target
                                                          AND x.list_key = r.list_key), 0)
                  FROM app.occurrence_record r
                 WHERE r.item_id = @from AND r.occurrence_at = @at;
                UPDATE app.calendar_value SET item_id = @to, occurrence_at = @target, updated_at = @now
                 WHERE item_id = @from AND occurrence_at = @at;
                """ : """
                DECLARE @base int = (SELECT ISNULL(MAX(ordinal) + 1, 0) FROM app.mass_intention
                                      WHERE item_id = @to AND occurrence_at = @target);
                UPDATE app.mass_intention
                   SET item_id = @to, occurrence_at = @target, ordinal = ordinal + @base, updated_at = @now
                 WHERE item_id = @from AND occurrence_at = @at;
                """, connection, tx);
            move.Parameters.AddWithValue("@from", fromItem);
            move.Parameters.AddWithValue("@at", at);
            move.Parameters.AddWithValue("@to", toItem);
            move.Parameters.AddWithValue("@target", to);
            move.Parameters.AddWithValue("@now", now);
            await move.ExecuteNonQueryAsync(ct);
        }
    }

    /// <summary>
    /// Wie viele Einträge ein Vorkommen (oder die ganze Reihe) festhalten —
    /// angenommen, gefeiert oder wartend; mit <paramref name="list"/> nur diese Liste.
    /// </summary>
    internal static async Task<int> LiveCountAsync(
        SqlConnection connection, SqlTransaction? tx, Guid itemId, DateTimeOffset? at, CancellationToken ct, string? list = null)
    {
        var ready = await Schema.RecordsAsync(connection, ct, tx);
        if (!ready && list is not null && list != Calendar.IntentionList) return 0;

        await using var cmd = new SqlCommand(ready ? $"""
            SELECT COUNT(*) FROM app.occurrence_record
            WHERE item_id = @item AND status IN {Calendar.HoldingStatuses}
              {(list is null ? "" : "AND list_key = @list")} {(at is null ? "" : "AND occurrence_at = @at")};
            """ : $"""
            SELECT COUNT(*) FROM app.mass_intention
            WHERE item_id = @item AND status IN {LiveStatuses} {(at is null ? "" : "AND occurrence_at = @at")};
            """, connection, tx);
        cmd.Parameters.AddWithValue("@item", itemId);
        if (ready && list is not null) cmd.Parameters.AddWithValue("@list", list);
        if (at is not null) cmd.Parameters.AddWithValue("@at", at.Value);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0);
    }

    /// <summary>
    /// Wie viele Intentionen (angenommen oder gefeiert) an jedem Vorkommen
    /// hängen — für den Kalender, der an der Messe „3 intencje" zeigt. EINE
    /// Abfrage für das ganze Fenster.
    /// </summary>
    internal static async Task<Dictionary<(Guid, DateTimeOffset), int>> CountsAsync(
        SqlConnection connection, IReadOnlyList<Guid> itemIds, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var map = new Dictionary<(Guid, DateTimeOffset), int>();
        if (itemIds.Count == 0) return map;

        var ready = await Schema.RecordsAsync(connection, ct);
        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));
        await using var cmd = new SqlCommand(ready ? $"""
            SELECT item_id, occurrence_at, COUNT(*) FROM app.occurrence_record
            WHERE item_id IN ({names}) AND list_key = N'{Calendar.IntentionList}' AND status IN {LiveStatuses}
              AND occurrence_at BETWEEN @from AND @to
            GROUP BY item_id, occurrence_at;
            """ : $"""
            SELECT item_id, occurrence_at, COUNT(*) FROM app.mass_intention
            WHERE item_id IN ({names}) AND status IN {LiveStatuses} AND occurrence_at BETWEEN @from AND @to
            GROUP BY item_id, occurrence_at;
            """, connection);
        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);
        cmd.Parameters.AddWithValue("@from", from);
        cmd.Parameters.AddWithValue("@to", to);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) map[(reader.GetGuid(0), reader.GetDateTimeOffset(1))] = reader.GetInt32(2);
        return map;
    }

    /// <summary>
    /// Was gesagt wird, wenn Einträge ihren Termin verlören — mit den Tagen,
    /// damit man weiss, welche Zettel gemeint sind.
    /// </summary>
    public static string LostMessage(IReadOnlyList<DateTimeOffset> lost, TimeZoneInfo zone, bool intentions = true)
    {
        var shown = lost.Take(4)
            .Select(at => TimeZoneInfo.ConvertTime(at, zone).ToString("d.MM.yyyy HH:mm", System.Globalization.CultureInfo.InvariantCulture))
            .ToList();
        var more = lost.Count > shown.Count ? $" i jeszcze {lost.Count - shown.Count}" : "";

        return intentions
            ? $"Na te msze są przyjęte intencje, a po zmianie nie byłoby ich w planie: {string.Join(", ", shown)}{more}. "
              + "Przenieś te intencje na inne msze (Msze i intencje) albo zmień plan tylko od wybranego dnia."
            : $"Na te terminy są wpisy, a po zmianie nie byłoby ich w planie: {string.Join(", ", shown)}{more}. "
              + "Przenieś te wpisy na inne terminy albo zmień plan tylko od wybranego dnia.";
    }
}
