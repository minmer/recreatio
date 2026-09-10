using Microsoft.Data.SqlClient;

namespace Workspace;

/// <summary>
/// Die Verbindung zur Datenbank — an EINER Stelle aufgeloest.
///
/// <para>
/// <b>Warum das eine Klasse ist und keine Zeichenkette im Aufruf.</b> Sobald
/// zwei Stellen die Verbindung selbst zusammensuchen, gibt es zwei Meinungen
/// darueber, welche Einstellung gewinnt — und ein Migrationslauf, der eine
/// andere Datenbank wandert als die, die der Dienst danach liest, faellt erst
/// Wochen spaeter auf.
/// </para>
///
/// <para>
/// Gesucht wird in dieser Reihenfolge:
/// </para>
/// <list type="number">
///   <item><c>WORKSPACE_CONNECTION</c> aus der Umgebung</item>
///   <item><c>Workspace:ConnectionString</c> aus den Einstellungen</item>
///   <item><c>ConnectionStrings:DefaultConnection</c> — dieselben
///   Benutzergeheimnisse, die der Altbestand schon benutzt</item>
/// </list>
///
/// <para>
/// Der dritte Punkt ist Absicht und vorlaeufig: der Neubau legt seine Tabellen
/// im Schema <c>app</c> derselben Datenbank an, weil dieses Hosting genau eine
/// hergibt. Getrennt sind sie trotzdem — <c>DROP SCHEMA app</c> raeumt den
/// Neubau weg, ohne den Altbestand anzufassen.
/// </para>
/// </summary>
public sealed class Db(IConfiguration configuration)
{
    private readonly string connectionString = Resolve(configuration);

    public static string Resolve(IConfiguration configuration) =>
        Environment.GetEnvironmentVariable("WORKSPACE_CONNECTION")
        ?? configuration["Workspace:ConnectionString"]
        ?? configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException(
            "Keine Verbindungszeichenfolge: WORKSPACE_CONNECTION, Workspace:ConnectionString " +
            "oder ConnectionStrings:DefaultConnection setzen.");

    public async Task<SqlConnection> OpenAsync(CancellationToken ct = default)
    {
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }
}
