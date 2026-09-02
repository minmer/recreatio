using Rc.Api;

// ---------------------------------------------------------------------------
// Der Dienst, tatsaechlich laufend.
//
// Bis hierher gab es `Rc.Api` nur als Bibliothek: die Pruefreihe stellte sie
// sich in den eigenen Prozess, der Beschreibungs-Erzeuger startete sie fuer
// zwei Sekunden. Beides beweist, dass sie funktioniert — aber keines von
// beiden macht sie fuer einen Browser erreichbar. Eine Plattform, die man nur
// mit einem Pruefprogramm bedienen kann, hat noch nie jemand benutzt.
//
//   dotnet run --project Rc.Host
//
// Daneben `npm run dev` im Browser-Teil: der Entwicklungsserver leitet /rc
// hierher weiter, damit beides unter DEMSELBEN Ursprung liegt. Ohne diesen
// Umweg kaeme das SameSite=Lax-Cookie nie zurueck (siehe vite.config.ts).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DOMAENENWECHSEL — was hier NOCH FEHLT.
//
// Der Browser-Teil liegt auf recreatio.pl, dieser Dienst auf api.recreatio.pl.
// Das ist ursprungsuebergreifend, und dafuer braucht es zweierlei:
//
//   1. Das Plaetzchen als SameSite=None; Secure. Das ist da — RcCookiePolicy
//      setzt es so, sobald Rc:CrossSiteCookies gilt (Standard: wahr).
//   2. CORS mit Access-Control-Allow-Credentials und einer AUSDRUECKLICHEN
//      Ursprungsliste. Das ist NICHT da: dieser Dienst richtet kein CORS ein.
//
// Ohne (2) blockt der Browser die Anfrage, bevor der Dienst sie sieht. Der
// Altbestand hat es (Recreatio.Api: AddRecreatioCors, "RecreatioWeb"); der
// neue Teil noch nicht, weil er bisher nur hinter dem Entwicklungs-Umweg lief,
// wo alles auf EINEM Ursprung liegt und CORS gar nicht entsteht.
//
// Wenn es kommt: die Ursprungsliste gehoert in die Konfiguration und nicht in
// den Quelltext — mit mehreren Domaenen ist sie je Betrieb verschieden.
// Zusammen mit rcOrigins.ts im Browser-Teil zu aendern.
// ---------------------------------------------------------------------------

var builder = WebApplication.CreateBuilder(args);

// -- Verbindung --------------------------------------------------------------
// Reihenfolge: Umgebungsvariable, dann Einstellungsdatei, dann die oertliche
// Entwicklungsdatenbank. Der letzte Fall ist bequem und deshalb gefaehrlich —
// er greift NUR in der Entwicklung, sonst faellt der Start hier aus. Ein
// Dienst, der in der Produktion still auf eine leere Datenbank ausweicht, ist
// schlimmer als einer, der gar nicht startet.

const string LocalDb =
    "Server=(localdb)\\MSSQLLocalDB;Database=Recreatio_Rc;" +
    "Trusted_Connection=True;TrustServerCertificate=True;";

var connection =
    Environment.GetEnvironmentVariable("RC_CONNECTION")
    ?? builder.Configuration["Rc:ConnectionString"];

if (string.IsNullOrWhiteSpace(connection))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException(
            "Rc:ConnectionString fehlt. Ausserhalb der Entwicklung gibt es keinen Ersatzwert.");

    connection = LocalDb;
}

// -- Servergeheimnis ---------------------------------------------------------
// Es unterschreibt Sitzungen und Schutzwerte. Bei jedem Start ein neues zu
// wuerfeln hiesse: jeder Neustart meldet alle ab. Waehrend der Entwicklung
// startet der Dienst aber staendig neu — also wird es einmal erzeugt und
// daneben abgelegt. Diese Datei gehoert NICHT in die Versionsverwaltung und
// NICHT auf einen Server; ausserhalb der Entwicklung wird sie deshalb auch
// nicht angelegt, sondern das Geheimnis eingefordert.

var secret =
    Environment.GetEnvironmentVariable("RC_SERVER_SECRET")
    ?? builder.Configuration[RcServerSecret.ConfigKey];

if (string.IsNullOrWhiteSpace(secret))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException(
            $"{RcServerSecret.ConfigKey} fehlt. Ausserhalb der Entwicklung wird keines erzeugt.");

    var keep = Path.Combine(AppContext.BaseDirectory, "rc-dev-secret.txt");
    if (File.Exists(keep))
    {
        secret = File.ReadAllText(keep).Trim();
    }
    else
    {
        secret = RcServerSecret.Generate();
        File.WriteAllText(keep, secret);
    }
}

var store =
    Environment.GetEnvironmentVariable("RC_FILE_STORE")
    ?? builder.Configuration["Rc:FileStorePath"]
    ?? Path.Combine(AppContext.BaseDirectory, "rc-files");

Directory.CreateDirectory(store);

builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Rc:ConnectionString"] = connection,
    [RcServerSecret.ConfigKey] = secret,
    ["Rc:FileStorePath"] = store,

    // Der Entwicklungsserver leitet /rc weiter, also liegt alles unter einem
    // Ursprung und das Cookie darf streng bleiben. Wer den Browser-Teil
    // getrennt betreibt, setzt Rc__CrossSiteCookies=true — und braucht dann
    // HTTPS, weil SameSite=None ohne Secure nirgends mehr ankommt.
    ["Rc:CrossSiteCookies"] =
        Environment.GetEnvironmentVariable("RC_CROSS_SITE") ?? "false"
});

builder.Services.AddRcPlatform(builder.Configuration);

var app = builder.Build();
app.UseRcPlatform();

app.Logger.LogInformation("rc: Datenbank {Db}", MaskedDatabase(connection));
app.Logger.LogInformation("rc: Dateiablage {Store}", store);

await app.RunAsync();

// Nur der Name der Datenbank ins Protokoll, nicht die ganze Zeichenkette: dort
// koennen Zugangsdaten stehen, und Protokolle werden weitergereicht.
static string MaskedDatabase(string connectionString)
{
    foreach (var part in connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries))
    {
        var pair = part.Split('=', 2);
        if (pair.Length == 2 && pair[0].Trim().Equals("Database", StringComparison.OrdinalIgnoreCase))
            return pair[1].Trim();
    }
    return "(unbekannt)";
}
