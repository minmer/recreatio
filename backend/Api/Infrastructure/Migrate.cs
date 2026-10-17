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
    /// Die Skripte anwenden, die noch keinen Eintrag haben — der Reihe nach.
    ///
    /// <para>
    /// <b><paramref name="through"/></b> (`--through 0112`): nur bis zu dieser
    /// Nummer. Ein Skript, das etwas wegnimmt, was der laufende Dienst noch
    /// liest, wartet so, bis der neue Dienst steht (documentation/TRANSFER.md).
    /// </para>
    /// </summary>
    public static async Task<int> RunAsync(string connectionString, bool dryRun, string? through = null)
    {
        var last = through is null ? null : Number(through);
        if (through is not null && last is null)
        {
            Console.Error.WriteLine("  !!   --through braucht eine vierstellige Nummer, etwa 0112.");
            return 2;
        }

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        Console.WriteLine($"Datenbank: {connection.Database} auf {connection.DataSource}");
        Console.WriteLine();

        await EnsureBookkeepingAsync(connection);

        var applied = await AppliedAsync(connection);
        var failures = 0;

        foreach (var (name, text) in Scripts())
        {
            if (last is not null && string.CompareOrdinal(name[..4], last) > 0)
            {
                Console.WriteLine($"  ##   {name} wartet (--through {last})");
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

    /// <summary>
    /// Skripte, die schon VON HAND angewendet wurden, als angewendet eintragen —
    /// ohne sie auszuführen (<c>migrate --record-through 0111</c>).
    ///
    /// <para>
    /// <b>Wofür.</b> 0078 bis 0111 liefen auf der einen Datenbank einzeln, ohne
    /// Eintrag. Liefen sie jetzt der Reihe nach noch einmal, setzte 0099 die
    /// Regel der Schritte auf ihren damaligen Stand zurück — und scheiterte an
    /// einem Schritt der Art <c>booking</c> (0100), den es inzwischen gibt.
    /// Eingetragen wird deshalb, was nachweislich schon steht
    /// (<c>Sql/diagnostics/applied_0078_0111.sql</c> sagt es vorher).
    /// </para>
    ///
    /// <para>
    /// Nur Skripte bis einschliesslich <paramref name="through"/> (Nummer oder
    /// Name), und mit derselben Prüfsumme, die ein gewöhnlicher Lauf eintrüge.
    /// </para>
    /// </summary>
    public static async Task<int> RecordAsync(string connectionString, string through, bool dryRun)
    {
        var last = Number(through);
        if (last is null)
        {
            Console.Error.WriteLine("  !!   --record-through braucht eine vierstellige Nummer, etwa 0111.");
            return 2;
        }

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        Console.WriteLine($"Datenbank: {connection.Database} auf {connection.DataSource}");
        Console.WriteLine();

        await EnsureBookkeepingAsync(connection);
        var applied = await AppliedAsync(connection);
        var recorded = 0;

        foreach (var (name, text) in Scripts())
        {
            if (string.CompareOrdinal(name[..4], last) > 0) break;
            if (applied.ContainsKey(name)) continue;

            if (dryRun)
            {
                Console.WriteLine($"  ??   {name} wuerde als angewendet eingetragen");
                recorded++;
                continue;
            }

            await using var mark = new SqlCommand(
                "INSERT INTO app.schema_version (name, checksum, applied_at) VALUES (@n, @c, @t);", connection);
            mark.Parameters.AddWithValue("@n", name);
            mark.Parameters.AddWithValue("@c", Checksum(text));
            mark.Parameters.AddWithValue("@t", DateTimeOffset.UtcNow);
            await mark.ExecuteNonQueryAsync();

            Console.WriteLine($"  OK   {name} eingetragen (nicht ausgefuehrt)");
            recorded++;
        }

        Console.WriteLine();
        Console.WriteLine(recorded == 0 ? "Nichts einzutragen." : $"Fertig: {recorded} Skript(e).");
        return 0;
    }

    /// <summary>Die eingebetteten Skripte, die noch keinen Eintrag haben — für die Übersicht der Übertragung.</summary>
    internal static async Task<List<string>> UnrecordedAsync(SqlConnection connection, CancellationToken ct)
    {
        var applied = new HashSet<string>(StringComparer.Ordinal);
        await using (var cmd = new SqlCommand(
            "IF OBJECT_ID('app.schema_version', 'U') IS NOT NULL SELECT name FROM app.schema_version;", connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) applied.Add(reader.GetString(0));
        }

        return Scripts().Select(s => s.Name).Where(n => !applied.Contains(n)).ToList();
    }

    /// <summary>Die vierstellige Nummer vorn an einem Skriptnamen (`0112`, `0112_explicit_data`) — oder <c>null</c>.</summary>
    private static string? Number(string text)
    {
        var head = text.Length >= 4 ? text[..4] : text;
        return head.Length == 4 && head.All(char.IsDigit) ? head : null;
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
