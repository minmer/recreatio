using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Rc.Api;

/// <summary>
/// Eine Stelle, an der die Verbindung zur neuen Datenbank entsteht.
///
/// 2.1 verlangt eine eigene Datenbank neben dem Altbestand. Wenn jeder
/// Endpunkt die Zeichenkette selbst aus der Konfiguration liest, ist das
/// solange richtig, bis einer den falschen Schluessel nimmt — und dann
/// schreibt der Neuaufbau in den Altbestand. Deshalb genau ein Weg dorthin.
/// </summary>
public sealed class RcDb(IConfiguration config)
{
    public const string ConfigKey = "Rc:ConnectionString";

    private readonly string _connectionString =
        config[ConfigKey] ?? throw new InvalidOperationException(
            $"{ConfigKey} fehlt. Ohne sie kann die neue Plattform nichts speichern.");

    public async Task<SqlConnection> OpenAsync(CancellationToken ct = default)
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    /// <summary>
    /// Fuer die Bereitschaftspruefung und die Sitzungspruefung: die duerfen
    /// nicht beim Start abstuerzen, nur weil noch nichts eingerichtet ist.
    /// </summary>
    public static string? TryRead(IConfiguration config)
    {
        var value = config[ConfigKey];
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
