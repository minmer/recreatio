using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Der Migrationslauf.
///
/// <para>
/// Ein Programm und kein Skript, weil drei Dinge nötig sind, die ein
/// SQL-Skript nicht kann: Wiedereintritt (ein <c>IF … RETURN</c> verlässt in
/// T-SQL nur den eigenen Stapel, und <c>GO</c> teilt in Stapel), eine
/// Transaktion über alle Stapel, und den Fassungseintrag NACH dem Erfolg in
/// derselben Transaktion.
/// </para>
///
/// <para>
/// Die Prüfsumme verhindert, dass ein bereits angewendetes Skript noch
/// geändert wird — sonst sieht eine Datenbank die alte Fassung und eine andere
/// die neue, und beide melden „angewendet". Änderungen werden angehängt.
/// </para>
/// </summary>
public static class Migrate
{
    /// <summary>
    /// Skripte mit der Nummer 0000 sind zerstoerend und laufen NUR auf
    /// ausdrueckliche Ansage.
    ///
    /// <para>
    /// Sie stehen der Nummer nach vor allen anderen, waeren also bei jedem
    /// Lauf die ersten. Ein zerstoerender Schritt, der aus Gewohnheit
    /// mitlaeuft, laeuft irgendwann zur falschen Zeit mit.
    /// </para>
    /// </summary>
    private const string DestructivePrefix = "0000";

    public static async Task<int> RunAsync(
        string connectionString, bool dryRun, bool allowDestructive = false)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        Console.WriteLine($"Datenbank: {connection.Database} auf {connection.DataSource}");
        Console.WriteLine();

        await EnsureBookkeepingAsync(connection);

        var applied = await AppliedAsync(connection);
        var failures = 0;

        foreach (var (name, text) in Scripts())
        {
            if (name.StartsWith(DestructivePrefix, StringComparison.Ordinal) && !allowDestructive)
            {
                Console.WriteLine(
                    $"  ##   {name} uebersprungen - zerstoerend. Mit --drop-legacy anfordern.");
                continue;
            }

            var checksum = Checksum(text);

            if (applied.TryGetValue(name, out var seen))
            {
                if (seen == checksum)
                {
                    Console.WriteLine($"  --   {name} bereits angewendet");
                }
                else
                {
                    Console.Error.WriteLine(
                        $"  !!   {name} wurde nach dem Anwenden geaendert. "
                        + "Angewendete Skripte werden ergaenzt, nicht bearbeitet.");
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

    /// <summary>Das Fach für die Fassungen entsteht ausserhalb der Buchführung — es IST sie.</summary>
    private static async Task EnsureBookkeepingAsync(SqlConnection connection)
    {
        await using (var schema = new SqlCommand(
            "IF SCHEMA_ID('app') IS NULL EXEC('CREATE SCHEMA app');", connection))
        {
            await schema.ExecuteNonQueryAsync();
        }

        await using var table = new SqlCommand("""
            IF OBJECT_ID('app.schema_version', 'U') IS NULL
            CREATE TABLE app.schema_version
            (
                name       nvarchar(200)  NOT NULL,
                checksum   char(64)       NOT NULL,
                applied_at datetimeoffset NOT NULL,
                CONSTRAINT pk_schema_version PRIMARY KEY (name)
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
    /// Die Skripte reisen eingebettet mit. Ein Lauf, der seine Dateien im
    /// Dateisystem sucht, wendet auf dem Zielrechner etwas anderes an.
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

            var parts = resource.Split('.');
            var name = parts.Length >= 2 ? string.Join('.', parts[^2..]) : resource;

            yield return (name, text.ReadToEnd());
        }
    }

    /// <summary>Zeilenenden normalisiert — sonst hängt die Prüfsumme daran, wie ausgecheckt wurde.</summary>
    private static string Checksum(string text) =>
        Convert.ToHexString(SHA256.HashData(
            Encoding.UTF8.GetBytes(text.Replace("\r\n", "\n", StringComparison.Ordinal))))
            .ToLowerInvariant();

    /// <summary>
    /// <c>GO</c> ist kein T-SQL, sondern eine Anweisung an das Werkzeug: teile
    /// hier. Ohne das Teilen scheitert alles, was einen eigenen Stapel braucht.
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
