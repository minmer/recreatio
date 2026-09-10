using System.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Rc.Api;

/// <summary>
/// 15.3 — Produktionsbereitschaftspruefung beim Start.
///
/// Der Altbestand startet unter allen Umstaenden. Das Master-Salz enthaelt dort
/// einen Platzhalter, der kein gueltiges Base64 ist; der Data-Protection-Ring
/// darf ungeschuetzt auf der Platte liegen und meldet nur eine Warnung. Beides
/// faellt erst auf, wenn ein Nutzer es merkt.
///
/// <b>Hier bricht der Start ab.</b> Ein Dienst, der ohne seine Geheimnisse
/// laeuft, ist schlimmer als einer, der nicht laeuft: er nimmt Daten an, die er
/// spaeter nicht mehr oeffnen kann.
///
/// Der Health-Endpunkt prueft dieselben Dinge noch einmal zur Laufzeit — 15.3
/// verlangt, dass er Datenbank, Dateispeicher und Schluesselring wirklich
/// anfasst und nicht bloss "ok" zurueckgibt.
/// </summary>
public static class RcReadiness
{
    public sealed record Check(string Name, bool Passed, string Detail);

    public sealed record Report(IReadOnlyList<Check> Checks)
    {
        public bool Healthy => Checks.All(c => c.Passed);
    }

    /// <summary>
    /// Beim Start. Wirft, wenn etwas fehlt — ausser in der Entwicklung, wo eine
    /// laute Warnung genuegt, damit ein neuer Rechner nicht am ersten Tag
    /// blockiert.
    /// </summary>
    public static async Task AssertReadyAsync(IConfiguration config, bool isDevelopment)
    {
        var report = await RunAsync(config);
        if (report.Healthy) return;

        var failed = report.Checks.Where(c => !c.Passed).ToList();
        var text = string.Join("\n", failed.Select(c => $"  - {c.Name}: {c.Detail}"));

        if (isDevelopment)
        {
            Console.Error.WriteLine("Bereitschaftspruefung nicht bestanden (Entwicklung, Start faehrt fort):");
            Console.Error.WriteLine(text);
            return;
        }

        throw new InvalidOperationException(
            "Bereitschaftspruefung nicht bestanden. Der Dienst startet nicht:\n" + text);
    }

    public static async Task<Report> RunAsync(IConfiguration config)
    {
        var checks = new List<Check>
        {
            CheckConnectionString(config),
            CheckServerSecret(config),
            CheckFileStore(config)
        };

        checks.Add(await CheckDatabaseAsync(config));
        checks.Add(await CheckSchemaVersionAsync(config));
        return new Report(checks);
    }

    private static Check CheckConnectionString(IConfiguration config)
    {
        // Dieselbe Aufloesung wie im Betrieb (RcDb.Resolve): der eigene
        // Schluessel, sonst der des Altbestands — dieselbe Datenbank, getrennt
        // ueber das Praefix rc_. Laese die Pruefung nur den einen Schluessel,
        // meldete sie einen Mangel, den es nicht gibt.
        var cs = RcDb.Resolve(config);
        if (string.IsNullOrWhiteSpace(cs))
            return new Check("Verbindungszeichenfolge", false,
                $"Weder {RcDb.ConfigKey} noch {RcDb.FallbackKey} ist gesetzt.");

        // Der Altbestand hat einen Platzhalter ausgeliefert, der erst beim
        // ersten Entschluesseln auffiel. Platzhalter werden hier erkannt.
        if (cs.Contains("REPLACE", StringComparison.OrdinalIgnoreCase)
            || cs.Contains("CHANGEME", StringComparison.OrdinalIgnoreCase))
            return new Check("Verbindungszeichenfolge", false, "Enthaelt noch einen Platzhalter.");

        return new Check("Verbindungszeichenfolge", true, "gesetzt");
    }

    /// <summary>
    /// Ohne dieses Geheimnis gibt es keine Scheinsalze, und der Anmeldedialog
    /// wird zum Verzeichnis aller Benutzernamen (<see cref="RcServerSecret"/>).
    /// Das ist kein Schoenheitsfehler: die einheitliche Fehlermeldung
    /// <c>auth.credentials_invalid</c> haengt daran.
    /// </summary>
    private static Check CheckServerSecret(IConfiguration config)
    {
        try
        {
            _ = new RcServerSecret(config);
            return new Check("Servergeheimnis", true, "gesetzt");
        }
        catch (InvalidOperationException e)
        {
            return new Check("Servergeheimnis", false,
                $"{e.Message} Erzeugen mit: dotnet run --project Rc.Schema -- secret");
        }
    }

    private static Check CheckFileStore(IConfiguration config)
    {
        // 9.10.1: Anhaenge liegen verschluesselt im Dateisystem, nicht in der
        // Datenbank. Ohne beschreibbaren Pfad nimmt der Dienst Uploads an, die
        // er nicht ablegen kann.
        // Dieselbe Aufloesung wie im Betrieb: sonst prueft die Pruefung einen
        // anderen Ordner als den, in den spaeter geschrieben wird — und meldet
        // gruen fuer eine Stelle, die niemand benutzt.
        var path = RcFileStore.TryRoot(config);
        if (string.IsNullOrWhiteSpace(path))
            return new Check("Dateispeicher", false, "Rc:FileStorePath fehlt.");

        try
        {
            Directory.CreateDirectory(path);
            var probe = Path.Combine(path, $".rc-probe-{Guid.NewGuid():N}");
            File.WriteAllText(probe, "probe");
            File.Delete(probe);
            return new Check("Dateispeicher", true, path);
        }
        catch (Exception e)
        {
            return new Check("Dateispeicher", false, $"nicht beschreibbar: {e.Message}");
        }
    }

    private static async Task<Check> CheckDatabaseAsync(IConfiguration config)
    {
        var cs = RcDb.Resolve(config);
        if (string.IsNullOrWhiteSpace(cs))
            return new Check("Datenbank", false, "keine Verbindungszeichenfolge");

        try
        {
            await using var c = new SqlConnection(cs);
            await c.OpenAsync();
            await using var cmd = new SqlCommand("SELECT 1;", c);
            await cmd.ExecuteScalarAsync();

            // 11.11: Vier Vereinfachungen ruhen darauf, dass genau ein
            // Anwendungsprozess je Instanz laeuft. Das laesst sich von hier aus
            // nicht beweisen — aber es gehoert vermerkt, damit der Wegfall als
            // Entscheidung erkannt wird und nicht als Betriebsdetail
            // durchrutscht (Kapitel 16).
            return new Check("Datenbank", true, $"{c.Database} erreichbar");
        }
        catch (SqlException e)
        {
            return new Check("Datenbank", false, e.Message.Split('\n')[0]);
        }
    }

    private static async Task<Check> CheckSchemaVersionAsync(IConfiguration config)
    {
        var cs = RcDb.Resolve(config);
        if (string.IsNullOrWhiteSpace(cs))
            return new Check("Schemafassung", false, "keine Verbindungszeichenfolge");

        try
        {
            await using var c = new SqlConnection(cs);
            await c.OpenAsync();
            await using var cmd = new SqlCommand(
                "IF OBJECT_ID('dbo.rc_schema_version','U') IS NULL SELECT -1 " +
                "ELSE SELECT COUNT(*) FROM dbo.rc_schema_version;", c);
            var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(), System.Globalization.CultureInfo.InvariantCulture);

            return count switch
            {
                -1 => new Check("Schemafassung", false, "rc_schema_version fehlt — Migrationslauf noch nicht ausgefuehrt."),
                0 => new Check("Schemafassung", false, "Keine Migration angewendet."),
                _ => new Check("Schemafassung", true, $"{count} Skripte angewendet")
            };
        }
        catch (SqlException e)
        {
            return new Check("Schemafassung", false, e.Message.Split('\n')[0]);
        }
    }

    /// <summary>
    /// 15.3 — Der Health-Endpunkt prueft AbhaengigkeitEN, nicht bloss den
    /// eigenen Puls. Er meldet 503, solange etwas fehlt, damit ein Lastverteiler
    /// den Dienst nicht in den Verkehr nimmt.
    /// </summary>
    public static void MapRcHealth(this IEndpointRouteBuilder app) =>
        app.MapGet("/rc/health", async (HttpContext ctx, IConfiguration config) =>
        {
            var report = await RunAsync(config);
            ctx.Response.StatusCode = report.Healthy
                ? StatusCodes.Status200OK
                : StatusCodes.Status503ServiceUnavailable;
            return Results.Json(new RcHealthResponse(
                report.Healthy,
                report.Checks.Select(c => new RcHealthCheck(c.Name, c.Passed, c.Detail)).ToList()));
        }).AllowAnonymousWrite("Zustandsabfrage, nur GET").Produces<RcHealthResponse>();
}
