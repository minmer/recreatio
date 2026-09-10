using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

namespace Workspace;

/// <summary>
/// Der Migrationslauf des Neubaus.
///
/// <para>
/// <b>Warum ein Programm und kein Skript.</b> Drei Dinge muss der Lauf
/// besitzen, die ein SQL-Skript nicht besitzen kann:
/// </para>
///
/// <list type="bullet">
///   <item><b>Wiedereintritt.</b> Ein <c>IF … RETURN</c> im Skript ist
///   wirkungslos: <c>RETURN</c> verlaesst in T-SQL nur den eigenen Stapel, und
///   <c>GO</c> teilt die Datei in Stapel. Beim ersten echten Wiederholungslauf
///   versucht das Skript alles noch einmal und meldet danach faelschlich
///   Erfolg.</item>
///
///   <item><b>Eine Transaktion ueber ALLE Stapel.</b> Ein <c>BEGIN</c> im
///   Skript findet nach einem Abbruch sein <c>COMMIT</c> nicht mehr.</item>
///
///   <item><b>Den Fassungseintrag NACH dem Erfolg,</b> in derselben
///   Transaktion. Ein Skript, das seinen eigenen Erfolg meldet, meldet ihn
///   auch nach einem Rollback.</item>
/// </list>
///
/// <para>
/// <b>Die Pruefsumme ist kein Schmuck.</b> Ein bereits angewendetes Skript
/// darf sich nicht mehr aendern — sonst sieht eine Datenbank die alte Fassung
/// und eine andere die neue, und beide melden „angewendet". Aenderungen werden
/// angehaengt, nie eingearbeitet.
/// </para>
///
/// <para>
/// Aufruf: <c>dotnet run --project backend/Workspace -- migrate</c>
/// </para>
/// </summary>
public static class Migrate
{
    public static async Task<int> RunAsync(string connectionString, bool dryRun)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        Console.WriteLine($"Datenbank: {connection.Database} auf {connection.DataSource}");
        Console.WriteLine();

        // Das Fach fuer die Fassungen muss da sein, bevor gefragt werden kann,
        // was schon angewendet wurde. Es entsteht deshalb ausserhalb der
        // Buchfuehrung — es IST die Buchfuehrung.
        await EnsureBookkeepingAsync(connection);

        var applied = await AppliedAsync(connection);
        var failures = 0;

        foreach (var (name, text) in Scripts())
        {
            var checksum = Checksum(text);

            if (applied.TryGetValue(name, out var seen))
            {
                if (seen == checksum)
                {
                    Console.WriteLine($"  --   {name} bereits angewendet");
                }
                else
                {
                    /*
                     * NICHT still hinnehmen. Ein geaendertes, bereits
                     * angewendetes Skript heisst: diese Datenbank und die
                     * naechste sehen verschiedene Schemata, und beide halten
                     * sich fuer aktuell.
                     */
                    Console.Error.WriteLine(
                        $"  !!   {name} wurde nach dem Anwenden geaendert. " +
                        "Angewendete Skripte werden ergaenzt, nicht bearbeitet.");
                    failures++;
                }
                continue;
            }

            var batches = SplitBatches(text);

            if (dryRun)
            {
                Console.WriteLine($"  ??   {name} waere anzuwenden ({batches.Count} Stapel)");
                continue;
            }

            await using var tx = (SqlTransaction)await connection.BeginTransactionAsync();
            try
            {
                foreach (var batch in batches)
                {
                    await using var cmd = new SqlCommand(batch, connection, tx) { CommandTimeout = 300 };
                    await cmd.ExecuteNonQueryAsync();
                }

                await using (var mark = new SqlCommand(
                    "INSERT INTO app.schema_version (name, checksum, applied_at) VALUES (@n, @c, @t);",
                    connection, tx))
                {
                    mark.Parameters.AddWithValue("@n", name);
                    mark.Parameters.AddWithValue("@c", checksum);
                    mark.Parameters.AddWithValue("@t", DateTimeOffset.UtcNow);
                    await mark.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();
                Console.WriteLine($"  OK   {name} angewendet ({batches.Count} Stapel)");
            }
            catch (Exception exception)
            {
                await tx.RollbackAsync();
                Console.Error.WriteLine($"  XX   {name} fehlgeschlagen: {exception.Message}");
                return 1;
            }
        }

        Console.WriteLine();
        Console.WriteLine(failures == 0 ? "Fertig." : $"Fertig mit {failures} Befund(en).");
        return failures == 0 ? 0 : 1;
    }

    private static async Task EnsureBookkeepingAsync(SqlConnection connection)
    {
        await using var cmd = new SqlCommand("""
            IF SCHEMA_ID('app') IS NULL EXEC('CREATE SCHEMA app');
            """, connection);
        await cmd.ExecuteNonQueryAsync();

        await using var table = new SqlCommand("""
            IF OBJECT_ID('app.schema_version', 'U') IS NULL
            CREATE TABLE app.schema_version
            (
                name       nvarchar(200)  NOT NULL,
                checksum   char(64)       NOT NULL,
                applied_at datetimeoffset NOT NULL,
                CONSTRAINT pk_app_schema_version PRIMARY KEY (name)
            );
            """, connection);
        await table.ExecuteNonQueryAsync();
    }

    private static async Task<Dictionary<string, string>> AppliedAsync(SqlConnection connection)
    {
        var applied = new Dictionary<string, string>(StringComparer.Ordinal);

        await using var cmd = new SqlCommand("SELECT name, checksum FROM app.schema_version;", connection);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync()) applied[reader.GetString(0)] = reader.GetString(1);

        return applied;
    }

    /// <summary>
    /// Die Skripte reisen IM Programm mit (eingebettet), nicht im Dateisystem.
    /// Ein Lauf, der seine Dateien erst suchen muss, wendet auf dem Zielrechner
    /// etwas anderes an als auf dem Entwicklungsrechner.
    /// </summary>
    private static IEnumerable<(string Name, string Text)> Scripts()
    {
        var assembly = Assembly.GetExecutingAssembly();

        var names = assembly.GetManifestResourceNames()
            .Where(n => n.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            .OrderBy(n => n, StringComparer.Ordinal);

        foreach (var resource in names)
        {
            using var stream = assembly.GetManifestResourceStream(resource)!;
            using var text = new StreamReader(stream, Encoding.UTF8);

            // Nur der Dateiname, ohne Namensraum: er steht in der Datenbank und
            // soll dort lesbar sein.
            var name = resource.Split('.') is var parts && parts.Length >= 2
                ? string.Join('.', parts[^2..])
                : resource;

            yield return (name, text.ReadToEnd());
        }
    }

    private static string Checksum(string text)
    {
        // Zeilenenden normalisiert: sonst haengt die Pruefsumme daran, wie das
        // Betriebssystem die Datei ausgecheckt hat.
        var normalised = text.Replace("\r\n", "\n", StringComparison.Ordinal);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalised))).ToLowerInvariant();
    }

    /// <summary>
    /// <c>GO</c> ist kein T-SQL, sondern eine Anweisung an das Werkzeug: teile
    /// hier. Ohne das Teilen scheitert alles, was einen eigenen Stapel braucht
    /// — <c>CREATE SCHEMA</c> zum Beispiel.
    /// </summary>
    private static List<string> SplitBatches(string text)
    {
        var batches = new List<string>();
        var current = new StringBuilder();

        foreach (var line in text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n'))
        {
            if (line.Trim().Equals("GO", StringComparison.OrdinalIgnoreCase))
            {
                if (current.ToString().Trim().Length > 0) batches.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.AppendLine(line);
        }

        if (current.ToString().Trim().Length > 0) batches.Add(current.ToString());
        return batches;
    }
}
