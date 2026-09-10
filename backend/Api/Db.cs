using Microsoft.Data.SqlClient;

namespace Api;

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
