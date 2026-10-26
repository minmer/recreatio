using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// OB EINE MIGRATION SCHON GELAUFEN IST — für Stellen, die ohne sie weiter
/// gehen müssen.
///
/// <para>
/// Der Dienst wird manchmal ausgeliefert, bevor jemand `migrate` laufen lässt.
/// Eine Abfrage auf eine Tabelle, die es noch nicht gibt, scheitert dann als
/// Ganzes — und steht sie in <see cref="Area.MayAsync(SqlConnection, Guid, Guid, Kernel.Capability, CancellationToken)"/>,
/// scheitert alles. Deshalb fragen solche Stellen hier nach und nehmen bis
/// dahin den alten Weg.
/// </para>
///
/// <para>
/// Ein „ja" gilt für immer (Tabellen verschwinden nicht), ein „nein" eine
/// halbe Minute: danach wird wieder nachgesehen, damit eine Migration, die
/// während des Betriebs läuft, ohne Neustart wirkt.
/// </para>
/// </summary>
internal static class Schema
{
    private static volatile bool virtualAreas;

    /// <summary>Wann zuletzt „nein" kam (<see cref="Environment.TickCount64"/>); 0: noch nie gefragt.</summary>
    private static long virtualAreasCheckedAt;

    /// <summary>
    /// 0120 — mehrere Rollen je Formular (<c>app.module_role</c>), virtuelle
    /// Bereiche und Kleinbereiche (<c>app.area_instance</c>, die letzte Tabelle
    /// der Migration). Mit <paramref name="tx"/>, wenn die Verbindung gerade in
    /// einer Transaktion steht.
    /// </summary>
    internal static async Task<bool> VirtualAreasAsync(SqlConnection connection, CancellationToken ct, SqlTransaction? tx = null)
    {
        if (virtualAreas) return true;

        var now = Environment.TickCount64;
        var last = Interlocked.Read(ref virtualAreasCheckedAt);
        if (last != 0 && now - last < 30_000) return false;

        await using var cmd = new SqlCommand(
            "SELECT CASE WHEN OBJECT_ID(N'app.area_instance', N'U') IS NULL THEN 0 ELSE 1 END;", connection, tx);
        var there = (int)(await cmd.ExecuteScalarAsync(ct))! == 1;

        Interlocked.Exchange(ref virtualAreasCheckedAt, now);
        if (there) virtualAreas = true;
        return there;
    }

    private static volatile bool records;
    private static long recordsCheckedAt;

    /// <summary>
    /// 0132 — Schemata der Termine: <c>app.calendar_doc</c>, <c>app.calendar_value</c>,
    /// die Spalten <c>scheme_id</c>/<c>plan_origin</c> und die Einträge an Vorkommen
    /// (<c>app.occurrence_record</c>, wohin die Intentionen gezogen sind). Bis dahin
    /// lesen die Intentionen aus <c>app.mass_intention</c>, und Neues wird abgewiesen.
    /// </summary>
    internal static async Task<bool> RecordsAsync(SqlConnection connection, CancellationToken ct, SqlTransaction? tx = null)
    {
        if (records) return true;

        var now = Environment.TickCount64;
        var last = Interlocked.Read(ref recordsCheckedAt);
        if (last != 0 && now - last < 30_000) return false;

        await using var cmd = new SqlCommand("""
            SELECT CASE WHEN OBJECT_ID(N'app.occurrence_record_value', N'U') IS NOT NULL
                         AND OBJECT_ID(N'app.calendar_value', N'U') IS NOT NULL
                         AND OBJECT_ID(N'app.calendar_doc', N'U') IS NOT NULL
                         AND COL_LENGTH(N'app.calendar_item', N'plan_origin') IS NOT NULL
                        THEN 1 ELSE 0 END;
            """, connection, tx);
        var there = (int)(await cmd.ExecuteScalarAsync(ct))! == 1;

        Interlocked.Exchange(ref recordsCheckedAt, now);
        if (there) records = true;
        return there;
    }
}
