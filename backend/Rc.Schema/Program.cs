using System.Data;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

// ---------------------------------------------------------------------------
// Migrationslauf (15.4)
//
// Ein massgeblicher Weg der Schema-Entwicklung: versionierter SQL-Lauf, keine
// EF-Migrationen. Der Altbestand ist an drei nebeneinander laufenden Wegen
// gescheitert, und die Append-only-Auflage aus 7.6 ist ohnehin SQL-nah.
//
// Der Lauf besitzt drei Dinge, die das Skript NICHT besitzen darf:
//
//   Wiedereintritt — ein IF ... RETURN im Skript ist wirkungslos, weil RETURN
//     in T-SQL nur den eigenen Stapel verlaesst und GO in Stapel teilt. Beim
//     ersten echten Wiederholungslauf hat genau das die Skripte alles noch
//     einmal versuchen und danach faelschlich Erfolg melden lassen.
//
//   Transaktion — ueber alle Stapel hinweg. Ein BEGIN/COMMIT im Skript findet
//     nach einem Abbruch sein BEGIN nicht mehr.
//
//   Fassungseintrag — nach Erfolg, in derselben Transaktion. Ein Skript, das
//     seinen eigenen Erfolg meldet, meldet ihn auch nach einem Rollback.
//
// Aufruf:
//   dotnet run --project Rc.Schema -- "<Verbindungszeichenfolge>"
//   dotnet run --project Rc.Schema -- "<...>" --dry-run
//
// Ohne Argument wird RC_CONNECTION aus der Umgebung genommen.
// ---------------------------------------------------------------------------

// Ein Geheimnis erzeugen, ohne dass jemand "irgendein langer Text" eintippt.
// Wenn es keinen bequemen Weg zu einem guten Wert gibt, entsteht ein schlechter.
if (args.FirstOrDefault() == "secret")
{
    Console.WriteLine(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
    return 0;
}

var connectionString = args.FirstOrDefault(a => !a.StartsWith("--"))
                    ?? Environment.GetEnvironmentVariable("RC_CONNECTION");

var dryRun = args.Contains("--dry-run");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Keine Verbindungszeichenfolge. Als Argument uebergeben oder RC_CONNECTION setzen.");
    Console.Error.WriteLine(@"Beispiel: dotnet run --project Rc.Schema -- ""Server=(localdb)\MSSQLLocalDB;Database=Recreatio_Rc;Trusted_Connection=True;TrustServerCertificate=True""");
    return 2;
}

var scripts = LoadScripts();
if (scripts.Count == 0)
{
    Console.Error.WriteLine("Keine Skripte gefunden. Sind die .sql-Dateien als EmbeddedResource eingebunden?");
    return 2;
}

await using var connection = new SqlConnection(connectionString);
try
{
    await connection.OpenAsync();
}
catch (SqlException e)
{
    Console.Error.WriteLine($"Verbindung fehlgeschlagen: {e.Message}");
    return 2;
}

Console.WriteLine($"Datenbank: {connection.Database} auf {connection.DataSource}");
Console.WriteLine();

await EnsureVersionTableAsync(connection);
var applied = await LoadAppliedAsync(connection);

var didWork = false;
foreach (var (name, sql) in scripts)
{
    var checksum = SHA256.HashData(Encoding.UTF8.GetBytes(sql));

    if (applied.TryGetValue(name, out var previous))
    {
        // Ein bereits angewendetes Skript, das sich seither geaendert hat, ist
        // ein Befund und keine Kleinigkeit: die Datenbank steht dann anders da,
        // als die Datei behauptet.
        if (previous is not null && !previous.SequenceEqual(checksum))
        {
            Console.Error.WriteLine($"  !!   {name} wurde angewendet, hat sich seither aber GEAENDERT.");
            Console.Error.WriteLine("       Eine angewendete Migration wird nicht bearbeitet, sondern ergaenzt.");
            return 1;
        }
        Console.WriteLine($"  --   {name} bereits angewendet");
        continue;
    }

    if (dryRun)
    {
        Console.WriteLine($"  ??   {name} waere anzuwenden ({CountBatches(sql)} Stapel)");
        didWork = true;
        continue;
    }

    try
    {
        await ApplyAsync(connection, name, sql, checksum);
        Console.WriteLine($"  OK   {name} angewendet ({CountBatches(sql)} Stapel)");
        didWork = true;
    }
    catch (SqlException e)
    {
        Console.Error.WriteLine($"  FAIL {name}");
        Console.Error.WriteLine($"       {e.Message}");
        Console.Error.WriteLine("       Zurueckgerollt. Die Datenbank steht wie vorher.");
        return 1;
    }
}

Console.WriteLine();
Console.WriteLine(didWork ? "Fertig." : "Nichts zu tun — alles auf Stand.");
return 0;

// ---------------------------------------------------------------------------

static List<(string Name, string Sql)> LoadScripts()
{
    var asm = Assembly.GetExecutingAssembly();
    return asm.GetManifestResourceNames()
        .Where(n => n.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
        // Nur die nummerierten Migrationen. rc_verify_constraints.sql ist eine
        // Pruefreihe und laeuft von Hand, nicht beim Anwenden.
        .Where(n => n.Contains(".rc_0", StringComparison.Ordinal))
        .OrderBy(n => n, StringComparer.Ordinal)
        .Select(n =>
        {
            using var stream = asm.GetManifestResourceStream(n)!;
            using var reader = new StreamReader(stream, Encoding.UTF8);
            var file = n[(n.LastIndexOf('.', n.Length - 5) + 1)..];
            return (Name: Path.GetFileNameWithoutExtension(file), Sql: reader.ReadToEnd());
        })
        .ToList();
}

/// <summary>
/// Trennt an Zeilen, die nur GO enthalten. Das ist keine T-SQL-Anweisung,
/// sondern ein Trennzeichen von sqlcmd — der Treiber kennt es nicht.
/// </summary>
static List<string> SplitBatches(string sql) =>
    sql.Split('\n')
       .Aggregate(new List<List<string>> { new() }, (acc, line) =>
       {
           if (line.Trim().Equals("GO", StringComparison.OrdinalIgnoreCase)) acc.Add([]);
           else acc[^1].Add(line);
           return acc;
       })
       .Select(lines => string.Join('\n', lines).Trim())
       .Where(b => b.Length > 0)
       .ToList();

static int CountBatches(string sql) => SplitBatches(sql).Count;

static async Task EnsureVersionTableAsync(SqlConnection c)
{
    const string sql = """
        SET QUOTED_IDENTIFIER ON;
        SET ANSI_NULLS ON;
        IF OBJECT_ID('dbo.rc_schema_version', 'U') IS NULL
        CREATE TABLE dbo.rc_schema_version (
            script_name nvarchar(128)     NOT NULL PRIMARY KEY,
            applied_at  datetimeoffset(7) NOT NULL CONSTRAINT df_rc_schema_version_at DEFAULT SYSDATETIMEOFFSET(),
            checksum    varbinary(32)     NULL);
        """;
    await using var cmd = new SqlCommand(sql, c);
    await cmd.ExecuteNonQueryAsync();
}

static async Task<Dictionary<string, byte[]?>> LoadAppliedAsync(SqlConnection c)
{
    var result = new Dictionary<string, byte[]?>(StringComparer.Ordinal);
    await using var cmd = new SqlCommand("SELECT script_name, checksum FROM dbo.rc_schema_version;", c);
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
        result[reader.GetString(0)] = reader.IsDBNull(1) ? null : (byte[])reader[1];
    return result;
}

/// <summary>
/// Alle Stapel eines Skripts plus der Fassungseintrag in EINER Transaktion.
/// Entweder ist das Skript vollstaendig angewendet, oder gar nicht.
/// </summary>
static async Task ApplyAsync(SqlConnection c, string name, string sql, byte[] checksum)
{
    await using var tx = (SqlTransaction)await c.BeginTransactionAsync(IsolationLevel.Serializable);

    foreach (var batch in SplitBatches(sql))
    {
        await using var cmd = new SqlCommand(batch, c, tx) { CommandTimeout = 120 };
        await cmd.ExecuteNonQueryAsync();
    }

    await using (var mark = new SqlCommand(
        "INSERT INTO dbo.rc_schema_version (script_name, checksum) VALUES (@n, @c);", c, tx))
    {
        mark.Parameters.AddWithValue("@n", name);
        mark.Parameters.AddWithValue("@c", checksum);
        await mark.ExecuteNonQueryAsync();
    }

    await tx.CommitAsync();
}
