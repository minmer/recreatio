using System.Data;

using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Parameter, deren Typ nicht geraten werden darf.
/// </summary>
public static class Parameters
{
    /// <summary>
    /// Eine versiegelte Huelle als Parameter — auch dann, wenn sie fehlt.
    ///
    /// <para>
    /// <b><c>AddWithValue(…, DBNull.Value)</c> raet auf <c>nvarchar</c>.</b> Steht
    /// dahinter eine <c>varbinary</c>-Spalte, lehnt SQL Server ab: „Implicit
    /// conversion from data type nvarchar to varbinary(max) is not allowed" —
    /// und zwar NUR auf dem Weg, auf dem der Wert wirklich einmal fehlt. Ein
    /// Platz ohne Notiz, ein Feld ohne Platzschluessel: seltene Wege, die dann
    /// mit einem 500 enden statt mit einer Zeile.
    /// </para>
    ///
    /// <para>
    /// Der Typ steht hier deshalb ausgeschrieben statt geraten. <c>-1</c> ist
    /// <c>max</c>; fuer eine engere Spalte (<c>varbinary(32)</c>) ist das
    /// gleichgueltig — die Groesse beschreibt den Parameter, nicht die Spalte.
    /// </para>
    /// </summary>
    public static SqlParameter AddBlob(this SqlParameterCollection into, string name, byte[]? value) =>
        into.Add(new SqlParameter(name, SqlDbType.VarBinary, -1)
        {
            Value = (object?)value ?? DBNull.Value
        });
}

/// <summary>
/// Die Verbindung zur Datenbank, an einer Stelle aufgelöst.
///
/// <para>
/// Gesucht wird: <c>API_CONNECTION</c> aus der Umgebung, dann
/// <c>Api:ConnectionString</c>, dann <c>ConnectionStrings:DefaultConnection</c>.
/// </para>
///
/// <para>
/// Sobald zwei Stellen die Verbindung selbst zusammensuchen, gibt es zwei
/// Meinungen darüber, welche Einstellung gewinnt — und ein Migrationslauf, der
/// eine andere Datenbank wandert als die, die der Dienst liest, fällt erst
/// Wochen später auf.
/// </para>
/// </summary>
public sealed class Db(IConfiguration configuration)
{
    private readonly string connectionString = Resolve(configuration);

    public static string Resolve(IConfiguration configuration) =>
        Environment.GetEnvironmentVariable("API_CONNECTION")
        ?? configuration["Api:ConnectionString"]
        ?? configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException(
            "Keine Verbindungszeichenfolge: API_CONNECTION, Api:ConnectionString "
            + "oder ConnectionStrings:DefaultConnection setzen.");

    public async Task<SqlConnection> OpenAsync(CancellationToken ct = default)
    {
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }
}
