using System.Text.Json;
using Rc.Api;

// ---------------------------------------------------------------------------
// 15.6 — Schreibt die Beschreibung der Schnittstelle in eine Datei.
//
// Der Dienst wird dafuer GEBAUT, aber nicht gestartet: es wird kein Anschluss
// geoeffnet, keine Anfrage bedient, nichts verschickt. Was gebraucht wird, ist
// nur die Liste der Endpunkte, und die steht schon fest, sobald die Anwendung
// zusammengesetzt ist.
//
// Aufruf:
//   dotnet run --project Rc.OpenApi -- ../rc-openapi.json
//
// Danach im Browser-Teil:
//   npm run api:types
// ---------------------------------------------------------------------------

var target = args.FirstOrDefault() ?? "rc-openapi.json";

// Platzhalterwerte: die Beschreibung entsteht aus den Endpunkten, nicht aus
// Daten. Der Dienst darf hier gar keine Datenbank erreichen — er soll es auch
// nicht versuchen.
var settings = new Dictionary<string, string?>
{
    ["Rc:ConnectionString"] = "Server=(unused);Database=none;",
    ["Rc:ServerSecret"] = RcServerSecret.Generate(),
    ["Rc:FileStorePath"] = Path.Combine(Path.GetTempPath(), "rc-openapi-unused"),
    ["Rc:CrossSiteCookies"] = "false"
};

var builder = WebApplication.CreateBuilder();
builder.Configuration.AddInMemoryCollection(settings);
builder.Logging.ClearProviders();
builder.Services.AddRcPlatform(builder.Configuration);
builder.Services.AddRcOpenApi();

builder.WebHost.UseUrls("http://127.0.0.1:0");

var app = builder.Build();
app.UseRcPlatform();
app.UseRcOpenApi();

// Die Endpunkte werden erst beim Bauen der Pipeline eingetragen. Der Dienst
// laeuft deshalb kurz auf 127.0.0.1 — die Beschreibung wird ueber denselben
// Weg geholt, den auch ein Werkzeug nehmen wuerde, und nicht ueber eine
// Programmschnittstelle, die sich mit jeder Fassung der Bibliothek aendert.
await app.StartAsync();

string json;
using (var http = new HttpClient { BaseAddress = new Uri(app.Urls.First()) })
{
    json = await http.GetStringAsync($"/rc/{RcOpenApi.DocumentName}.json");
}

await app.StopAsync();

var full = Path.GetFullPath(target);
Directory.CreateDirectory(Path.GetDirectoryName(full)!);

// Eingerueckt geschrieben: die Datei landet in der Versionsverwaltung, und ein
// Unterschied ueber eine einzige sehr lange Zeile ist kein Unterschied, den
// jemand liest.
using var parsed = JsonDocument.Parse(json);
await File.WriteAllTextAsync(full,
    JsonSerializer.Serialize(parsed, new JsonSerializerOptions { WriteIndented = true }));

var paths = parsed.RootElement.GetProperty("paths").EnumerateObject().Count();
var schemas = parsed.RootElement.TryGetProperty("components", out var components)
    && components.TryGetProperty("schemas", out var s) ? s.EnumerateObject().Count() : 0;

Console.WriteLine($"  OK   {paths} Pfade, {schemas} Typen -> {full}");

// 15.6 — Eine Beschreibung ohne Typen ist keine. Sie entstuende, wenn niemand
// Produces<T>() angegeben haette, und der erzeugte Klient waere dann eine
// Sammlung von "unknown" — schlimmer als keiner, weil er Sicherheit vortaeuscht.
if (schemas == 0)
{
    Console.Error.WriteLine("  FEHLER: keine Typen beschrieben. Fehlt Produces<T>() an den Endpunkten?");
    return 1;
}

return 0;
