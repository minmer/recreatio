using System.Data;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

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
//   dotnet run --project Rc.Schema
//   dotnet run --project Rc.Schema -- --dry-run
//   dotnet run --project Rc.Schema -- "<Verbindungszeichenfolge>"
//
// Ohne Argument wird gesucht, in dieser Reihenfolge:
//   1. RC_CONNECTION aus der Umgebung
//   2. Rc:ConnectionString                — dieselben Benutzergeheimnisse,
//   3. ConnectionStrings:DefaultConnection  die auch der Dienst liest
//
// Punkt 2 und 3 sind DIESELBE Reihenfolge wie in RcDb.Resolve. Zwei Wege zu
// derselben Datenbank, die verschieden entscheiden, waeren ein Lauf, der etwas
// anderes wandert als das, was der Dienst danach liest.
// ---------------------------------------------------------------------------

// Ein Geheimnis erzeugen, ohne dass jemand "irgendein langer Text" eintippt.
// Wenn es keinen bequemen Weg zu einem guten Wert gibt, entsteht ein schlechter.
if (args.FirstOrDefault() == "secret")
{
    Console.WriteLine(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
    return 0;
}

/*
 * WELCHES NACHBESSERUNGSSKRIPT — zuerst, weil sein NAME sonst fuer die
 * Verbindungszeichenfolge gehalten wird.
 *
 * Die Zeichenfolge ist schlicht das erste Argument ohne zwei Striche. Der
 * Skriptname ist auch eines. Beim ersten Lauf ging deshalb der Name an
 * SqlClient, und der meldete ein kaputtes Format — richtig, aber an einer
 * Stelle, die mit der Ursache nichts zu tun hat.
 */
var repairName = args.SkipWhile(a => a != "--repair").Skip(1).FirstOrDefault();

var connectionString = args.FirstOrDefault(a => !a.StartsWith("--") && a != repairName)
                    ?? Environment.GetEnvironmentVariable("RC_CONNECTION")
                    ?? FromUserSecrets();

var dryRun = args.Contains("--dry-run");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Keine Verbindungszeichenfolge. Als Argument uebergeben, RC_CONNECTION setzen");
    Console.Error.WriteLine("oder in den Benutzergeheimnissen hinterlegen:");
    Console.Error.WriteLine(@"  dotnet user-secrets set ""ConnectionStrings:DefaultConnection"" ""<...>"" --project backend/Recreatio.Api");
    Console.Error.WriteLine(@"Beispiel: dotnet run --project Rc.Schema -- ""Server=(localdb)\MSSQLLocalDB;Database=Recreatio_Rc;Trusted_Connection=True;TrustServerCertificate=True""");
    return 2;
}

/*
 * NACHSEHEN, WAS WIRKLICH DASTEHT.
 *
 * Das Fassungsverzeichnis sagt, welche Skripte gelaufen sind. Es sagt nicht,
 * ob die Spalten, Tabellen und Bedingungen daraufhin auch da sind — und genau
 * das ist die Frage, wenn jemand ein Skript von Hand nachgeschoben hat und
 * eine Reihe Fehlermeldungen sieht.
 *
 * Ohne diesen Weg bleibt nur Raten oder ein zweites Werkzeug.
 */
/*
 * EINEN NACHBESSERUNGSLAUF FAHREN.
 *
 * Nachbesserungsskripte heissen nicht `rc_0…` und wandern deshalb NICHT durch
 * das Fassungsverzeichnis: sie sind wiederholbar und keine Fassung. Trotzdem
 * sollen sie ohne zweites Werkzeug laufen koennen — wer eine Datenbank
 * hinterherzieht, hat selten ein SQL-Fenster daneben offen.
 *
 * Aufruf:
 *   dotnet run --project Rc.Schema -- --repair rc_repair_parish_confirmation
 */
if (args.Contains("--repair"))
{
    var wanted = repairName;
    if (string.IsNullOrWhiteSpace(wanted))
    {
        Console.Error.WriteLine("Welches Skript? Beispiel: --repair rc_repair_parish_confirmation");
        return 2;
    }

    var found = typeof(Program).Assembly.GetManifestResourceNames()
        .FirstOrDefault(n => n.EndsWith($".{wanted}.sql", StringComparison.OrdinalIgnoreCase));

    if (found is null)
    {
        Console.Error.WriteLine($"Kein Skript namens {wanted}.sql.");
        return 2;
    }

    await using var stream = typeof(Program).Assembly.GetManifestResourceStream(found)!;
    var sqlText = await new StreamReader(stream, Encoding.UTF8).ReadToEndAsync();

    await using var repairConnection = new SqlConnection(connectionString);
    try { await repairConnection.OpenAsync(); }
    catch (SqlException e)
    {
        Console.Error.WriteLine($"Verbindung fehlgeschlagen: {e.Message}");
        return 2;
    }

    Console.WriteLine($"Datenbank: {repairConnection.Database} auf {repairConnection.DataSource}");
    Console.WriteLine();

    /*
     * Die PRINT-Zeilen des Skripts sind sein Bericht. Ohne diesen Anschluss
     * liefe es stumm — und ein Nachbesserungslauf, der nichts sagt, laesst
     * genau die Frage offen, wegen der man ihn gestartet hat.
     */
    repairConnection.InfoMessage += (_, e) => Console.WriteLine(e.Message);

    /*
     * KEINE gemeinsame Transaktion.
     *
     * Jeder Stapel steht fuer sich, und das ist hier richtig: das Skript ist
     * wiederholbar. Bricht es in der Mitte ab, laesst man es noch einmal
     * laufen — was schon getan ist, wird uebersprungen.
     */
    var batches = SplitBatches(sqlText);
    foreach (var batch in batches)
    {
        await using var cmd = new SqlCommand(batch, repairConnection) { CommandTimeout = 120 };
        await cmd.ExecuteNonQueryAsync();
    }

    Console.WriteLine();
    Console.WriteLine($"Fertig ({batches.Count} Stapel).");
    return 0;
}

if (args.Contains("--verify"))
{
    await using var check = new SqlConnection(connectionString);
    try { await check.OpenAsync(); }
    catch (SqlException e)
    {
        Console.Error.WriteLine($"Verbindung fehlgeschlagen: {e.Message}");
        return 2;
    }

    Console.WriteLine($"Datenbank: {check.Database} auf {check.DataSource}");
    Console.WriteLine();

    var wanted = new (string What, string Sql)[]
    {
        ("rc_confirmation_group.intake_public_key",
         "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rc_confirmation_group') AND name = 'intake_public_key'"),
        ("rc_confirmation_group.applications_open",
         "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rc_confirmation_group') AND name = 'applications_open'"),
        ("rc_candidate.portal_token_hash",
         "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rc_candidate') AND name = 'portal_token_hash'"),
        ("rc_candidate.portal_token_wrapped",
         "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rc_candidate') AND name = 'portal_token_wrapped'"),
        ("rc_candidate.portal_revoked_at",
         "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rc_candidate') AND name = 'portal_revoked_at'"),
        ("rc_candidate.account_id",
         "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rc_candidate') AND name = 'account_id'"),
        ("rc_candidate_intake",
         "SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('dbo.rc_candidate_intake')"),
        ("uq_rc_candidate_portal",
         "SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_candidate_portal'"),
        ("ix_rc_candidate_account",
         "SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_candidate_account'"),
        ("ck_rc_candidate_portal_revoke",
         "SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_candidate_portal_revoke'"),
        ("ck_rc_parish_site_document",
         "SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_parish_site_document'"),
        ("rc_parish_site",
         "SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('dbo.rc_parish_site')")
    };

    var missing = 0;
    foreach (var (what, sql) in wanted)
    {
        await using var probe = new SqlCommand(sql, check);
        var there = await probe.ExecuteScalarAsync() is not null;
        if (there) Console.WriteLine($"  OK   {what}");
        else { missing++; Console.WriteLine($"  FEHLT {what}"); }
    }

    Console.WriteLine();
    Console.WriteLine(missing == 0
        ? "Alles da."
        : $"{missing} Stueck fehlen — die Fassung sagt etwas anderes als die Datenbank.");

    return missing == 0 ? 0 : 1;
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

/// <summary>
/// Die Verbindungszeichenfolge aus den Benutzergeheimnissen — denselben, die
/// der Dienst liest (gleiche <c>UserSecretsId</c>).
///
/// NUR fuer die Entwicklung. Auf einem Server gibt es keine
/// Benutzergeheimnisse; dort kommt die Zeichenfolge aus der Umgebung oder als
/// Argument. Der Aufruf hier faellt dann still auf <c>null</c> zurueck, und die
/// Meldung weiter oben sagt, was zu tun ist.
/// </summary>
static string? FromUserSecrets()
{
    var config = new ConfigurationBuilder()
        .AddUserSecrets(typeof(Program).Assembly, optional: true)
        .AddEnvironmentVariables()
        .Build();

    // Dieselbe Reihenfolge wie RcDb.Resolve: der eigene Schluessel schlaegt den
    // gemeinsamen. Andersherum wanderte der Lauf woanders hin als der Dienst
    // liest, sobald jemand den eigenen Schluessel setzt.
    var explicitly = config["Rc:ConnectionString"];
    if (!string.IsNullOrWhiteSpace(explicitly)) return explicitly;

    var shared = config["ConnectionStrings:DefaultConnection"];
    return string.IsNullOrWhiteSpace(shared) ? null : shared;
}

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
