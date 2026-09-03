using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Rc.Api;
using Rc.Kernel;

// ---------------------------------------------------------------------------
// Pruefreihe fuer /rc — gegen den echten Dienst, nicht gegen eine Nachbildung.
//
// Die Plattform wird hier OHNE den Altbestand gestartet: nur AddRcPlatform und
// UseRcPlatform. Das ist zugleich der Beweis fuer die Behauptung aus 2.1 — wenn
// Rc.Api sich nicht allein hosten laesst, ist sie kein eigenstaendiger
// Baustein, sondern ein Teil des Altbestands mit anderem Pfadpraefix.
//
// Aufruf:
//   dotnet run --project Rc.Api.Tests -- "<Verbindungszeichenfolge Testdatenbank>"
//
// Ohne Argument wird RC_TEST_CONNECTION genommen. Die Datenbank wird zu Beginn
// von Konten und Sitzungen geleert — niemals auf die echte zeigen lassen.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ZUERST, WAS OHNE DATENBANK GEPRUEFT WERDEN KANN.
//
// Reine Funktionen brauchen keinen Dienst und keine Datenbank. Sie hinter die
// Verbindungspruefung zu stellen hiesse: wer keine Testdatenbank hat, prueft
// gar nichts — und genau das war der Zustand, in dem die Dokumentpruefung
// ungeprueft blieb.
//
// Der Lauf endet danach mit 0, wenn keine Verbindung da ist. Das ist kein
// Erfolg des ganzen Laufs und sagt es auch.
// ---------------------------------------------------------------------------

var pure = new PureChecks();
pure.Run();
if (pure.Failed > 0) return 1;

var connectionString = args.FirstOrDefault(a => !a.StartsWith("--"))
                    ?? Environment.GetEnvironmentVariable("RC_TEST_CONNECTION");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.WriteLine();
    Console.WriteLine("Ohne RC_TEST_CONNECTION laufen nur die reinen Pruefungen.");
    return 0;
}


if (!connectionString.Contains("_Test", StringComparison.OrdinalIgnoreCase))
{
    // Diese Pruefreihe loescht Konten. Ein Tippfehler in der
    // Verbindungszeichenfolge waere sonst teuer.
    Console.Error.WriteLine("Die Datenbank muss '_Test' im Namen tragen. Abbruch.");
    return 2;
}

var fileStore = Path.Combine(Path.GetTempPath(), "rc-test-store");
var settings = new Dictionary<string, string?>
{
    ["Rc:ConnectionString"] = connectionString,
    ["Rc:ServerSecret"] = RcServerSecret.Generate(),
    ["Rc:FileStorePath"] = fileStore,
    ["Rc:KeyVaultIdleMinutes"] = "15",

    // Die Pruefreihe laeuft ohne TLS. Im Betrieb steht das auf true, weil der
    // Browser-Teil von einem anderen Ursprung kommt (RcCookiePolicy).
    ["Rc:CrossSiteCookies"] = "false"
};

await ResetAsync(connectionString);

// Der Dateispeicher gehoert mit zurueckgesetzt. Ein abgebrochener Lauf laesst
// sonst Bloecke liegen, und die naechste Pruefung „genau eine Datei" scheitert
// an einem Rest, den niemand mehr zuordnen kann.
if (Directory.Exists(fileStore)) Directory.Delete(fileStore, recursive: true);
Directory.CreateDirectory(fileStore);

// Entwicklungsumgebung, damit unerwartete Ausnahmen ihren Text mitliefern
// (RcExceptions). Eine Pruefreihe, die nur „500" zu sehen bekommt, sagt einem
// zwar, DASS etwas kaputt ist, aber nicht was — und das ist die Haelfte ihres
// Werts.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development" });
builder.Configuration.AddInMemoryCollection(settings);
builder.Logging.ClearProviders();
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.Services.AddRcPlatform(builder.Configuration);

var app = builder.Build();
app.UseRcPlatform();
await app.StartAsync();

var baseAddress = app.Urls.First();
Console.WriteLine($"Rc.Api allein gestartet auf {baseAddress}");
Console.WriteLine();

var t = new Runner();
var handler = new HttpClientHandler { CookieContainer = new CookieContainer(), UseCookies = true };
using var http = new HttpClient(handler) { BaseAddress = new Uri(baseAddress) };

// -- Bereitschaft -----------------------------------------------------------

var health = await http.GetAsync("/rc/health");
await t.OkAsync("15.3  /rc/health meldet 200 und healthy", async () =>
    health.StatusCode == HttpStatusCode.OK
    && (await ReadAsync(health)).GetProperty("healthy").GetBoolean());

// -- CSRF -------------------------------------------------------------------

// P0-4: Schutz als Standardverhalten. Ein Endpunkt, der ihn braucht, muss ihn
// nicht anfordern — er bekommt ihn, weil er nichts dagegen unternimmt.
var noToken = await http.PostAsJsonAsync("/rc/auth/salt", new { username = "irgendwer" });
await t.OkAsync("15.1  Schreibzugriff ohne Schutzwert wird abgewiesen", async () =>
    noToken.StatusCode == HttpStatusCode.Forbidden
    && (await ReadAsync(noToken)).GetProperty("code").GetString() == RcErrorCodes.AuthCsrfMissing);

var csrfResponse = await http.PostAsync("/rc/csrf", null);
var csrf = (await ReadAsync(csrfResponse)).GetProperty("token").GetString()!;
http.DefaultRequestHeaders.Add("X-Rc-Csrf", csrf);

t.Ok("15.1  Schutzwert wird ausgegeben", () => csrf.Length > 16);

// -- Salz: kein Verzeichnis der Benutzernamen -------------------------------

var decoyA1 = await SaltAsync("unbekannt-a");
var decoyA2 = await SaltAsync("unbekannt-a");
var decoyB = await SaltAsync("unbekannt-b");

t.Ok("3.15  Unbekannter Name bekommt trotzdem ein Salz", () => decoyA1.Length > 0);
t.Ok("3.15  Das Scheinsalz ist stabil", () => decoyA1 == decoyA2);
t.Ok("3.15  Verschiedene Namen, verschiedene Scheinsalze", () => decoyA1 != decoyB);
t.Ok("3.15  Gross- und Kleinschreibung ergibt dasselbe Scheinsalz",
    () => decoyA1 == SaltAsync("Unbekannt-A").GetAwaiter().GetResult());

// -- Anlegen ----------------------------------------------------------------

const string username = "erste-verwalterin";
const string password = "ein hinreichend langes Passwort";

var registerSalt = RcBase64Url.Encode(RcPassword.NewSalt());
var passwordKey = RcPassword.DerivePasswordKey(password, RcBase64Url.Decode(registerSalt));

var registered = await http.PostAsJsonAsync("/rc/auth/register", new
{
    username,
    passwordKey = RcBase64Url.Encode(passwordKey),
    passwordSalt = registerSalt
});

await t.OkAsync("21.8  Erstes Konto laesst sich anlegen", async () =>
    registered.StatusCode == HttpStatusCode.OK
    && (await ReadAsync(registered)).GetProperty("sessionId").GetString()!.Length == 36);

var realSalt = await SaltAsync(username);
t.Ok("3.15  Bekanntes Konto liefert das echte Salz", () => realSalt == registerSalt);

var nameTaken = await http.PostAsJsonAsync("/rc/auth/register", new
{
    username,
    passwordKey = RcBase64Url.Encode(passwordKey),
    passwordSalt = registerSalt
});

await t.OkAsync("21.8  Ein vergebener Benutzername wird abgewiesen", async () =>
    nameTaken.StatusCode == HttpStatusCode.Conflict
    && (await ReadAsync(nameTaken)).GetProperty("code").GetString() == RcErrorCodes.AuthUsernameTaken);

// -- 3.1 / 3.5 — Die Gruendung ----------------------------------------------

var founded = await ReadAsync(registered);
var tenantId = founded.GetProperty("tenantId").GetString()!;
var personalRoleId = founded.GetProperty("personalRoleId").GetString()!;

t.Ok("3.1   Das erste Konto bekommt eine persoenliche Rolle", () => personalRoleId.Length == 36);

// Das Oeffnungsstueck muss ab jetzt mitreisen: alles Weitere braucht Schluessel.
http.DefaultRequestHeaders.Add("X-Rc-Unlock", RcBase64Url.Encode(passwordKey));

var roles = await ReadAsync(await http.GetAsync("/rc/roles"));

t.Ok("21.6  Die persoenliche Rolle ist erreichbar und aufschliessbar", () =>
{
    var list = roles.GetProperty("roles").EnumerateArray().ToList();
    return list.Count == 1
        && list[0].GetProperty("roleId").GetString() == personalRoleId
        && list[0].GetProperty("kind").GetString() == "person"
        && list[0].GetProperty("hasKey").GetBoolean();
});

// 9.13.2 — Der Anzeigename ist verschluesselt und oeffnet sich mit dem
// Rollenschluessel. Steht er da, stimmt der ganze Schluesselweg.
t.Ok("9.13.2 Der Anzeigename laesst sich lesen", () =>
    roles.GetProperty("roles")[0].GetProperty("displayName").GetString() == username);

var mayAdmin = await ReadAsync(await http.GetAsync(
    $"/rc/permissions/check?scopeKind=tenant&scopeId={tenantId}&capability=admin"));

t.Ok("3.5   Die Gruenderin darf verwalten", () =>
    mayAdmin.GetProperty("allowed").GetBoolean()
    && mayAdmin.GetProperty("via").GetString() == personalRoleId);

var mayRead = await ReadAsync(await http.GetAsync(
    $"/rc/permissions/check?scopeKind=tenant&scopeId={tenantId}&capability=read"));

t.Ok("3.5   admin schliesst read ein — auch in der Abfrage", () =>
    mayRead.GetProperty("allowed").GetBoolean());

var mayElsewhere = await ReadAsync(await http.GetAsync(
    $"/rc/permissions/check?scopeKind=tenant&scopeId={Guid.NewGuid()}&capability=read"));

t.Ok("3.5   In einer fremden Traegerschaft gilt nichts", () =>
    !mayElsewhere.GetProperty("allowed").GetBoolean());

// -- Eine Rolle anlegen ------------------------------------------------------

var createdRole = await http.PostAsJsonAsync("/rc/roles", new
{
    holderRoleId = personalRoleId,
    kind = "group",
    displayName = "Pfarrgemeinderat"
});

var groupRoleId = "";
await t.OkAsync("21.6  Eine neue Rolle entsteht mit Schluesseln und Zuteilung", async () =>
{
    if (createdRole.StatusCode != HttpStatusCode.Created) return false;
    groupRoleId = (await ReadAsync(createdRole)).GetProperty("roleId").GetString()!;
    return groupRoleId.Length == 36;
});

var rolesAfter = await ReadAsync(await http.GetAsync("/rc/roles"));

t.Ok("21.6  Die neue Rolle ist ueber die Zuteilung erreichbar", () =>
{
    var list = rolesAfter.GetProperty("roles").EnumerateArray().ToList();
    var group = list.FirstOrDefault(r => r.GetProperty("roleId").GetString() == groupRoleId);
    return list.Count == 2
        && group.ValueKind != JsonValueKind.Undefined
        && group.GetProperty("hasKey").GetBoolean()
        && group.GetProperty("displayName").GetString() == "Pfarrgemeinderat";
});

// 3.14 — Der Kreis. Die Gruppe haelt jetzt eine Unterrolle; die Unterrolle
// darf die Gruppe nicht zurueckhalten.
var subRole = await ReadAsync(await http.PostAsJsonAsync("/rc/roles", new
{
    holderRoleId = groupRoleId,
    kind = "office",
    displayName = "Schriftfuehrung"
}));
var subRoleId = subRole.GetProperty("roleId").GetString()!;

var cycle = await http.PostAsJsonAsync("/rc/roles", new
{
    holderRoleId = subRoleId,
    kind = "group",
    displayName = "egal"
});

t.Ok("3.14  Eine Rolle unter einer Unterrolle ist noch kein Kreis", () =>
    cycle.StatusCode == HttpStatusCode.Created);

await t.OkAsync("21.6  Der Schluesselweg traegt ueber drei Stufen", async () =>
{
    var list = (await ReadAsync(await http.GetAsync("/rc/roles")))
        .GetProperty("roles").EnumerateArray().ToList();
    return list.Count == 4 && list.All(r => r.GetProperty("hasKey").GetBoolean());
});

// -- 3.14 — Der Kreis, jetzt wirklich ----------------------------------------
//
// Die Struktur ist: persoenlich -> Gruppe -> Schriftfuehrung. Die Gruppe der
// Schriftfuehrung zu geben schliesst die Runde — beide wuerden einander
// aufschliessen, und niemand haette das je entschieden.

var wouldCycle = await http.PostAsJsonAsync($"/rc/roles/{groupRoleId}/holders", new
{
    holderRoleId = subRoleId
});

await t.OkAsync("3.14  Ein Kreis wird abgewiesen", async () =>
    wouldCycle.StatusCode == HttpStatusCode.Conflict
    && (await ReadAsync(wouldCycle)).GetProperty("code").GetString() == RcErrorCodes.RoleCycle);

// Dieselbe Rolle einem zweiten Halter geben ist dagegen der Regelfall: eine
// Aufgabe, die zwei Gremien gemeinsam tragen.
var secondHolder = await http.PostAsJsonAsync($"/rc/roles/{subRoleId}/holders", new
{
    holderRoleId = personalRoleId,
    edgeKind = "holds"
});

t.Ok("3.1   Zwei Halter fuer dieselbe Rolle sind erlaubt", () =>
    secondHolder.StatusCode == HttpStatusCode.Created);

t.Ok("21.6  Nach der Weitergabe steht die Rolle beiden offen", () =>
    ReadAsync(http.GetAsync("/rc/roles").GetAwaiter().GetResult()).GetAwaiter().GetResult()
        .GetProperty("roles").EnumerateArray()
        .First(r => r.GetProperty("roleId").GetString() == subRoleId)
        .GetProperty("hasKey").GetBoolean());

// Weitergeben, was man selbst nicht hat, geht nicht — auch mit certify nicht.
var notMine = await http.PostAsJsonAsync($"/rc/roles/{Guid.NewGuid()}/holders", new
{
    holderRoleId = personalRoleId
});

t.Ok("21.6  Was es nicht gibt, laesst sich nicht weitergeben", () =>
    notMine.StatusCode == HttpStatusCode.NotFound);

// -- Zertifikate --------------------------------------------------------------

var issued = await http.PostAsJsonAsync("/rc/certificates", new
{
    subjectRoleId = groupRoleId,
    issuerRoleId = personalRoleId,
    scopeKind = "tenant",
    scopeId = tenantId,
    capability = "write",
    daysValid = 30
});

var certificateId = "";
await t.OkAsync("3.5   Wer certify hat, darf ausstellen", async () =>
{
    if (issued.StatusCode != HttpStatusCode.Created) return false;
    certificateId = (await ReadAsync(issued)).GetProperty("certificateId").GetString()!;
    return certificateId.Length == 36;
});

var foreignScope = await http.PostAsJsonAsync("/rc/certificates", new
{
    subjectRoleId = groupRoleId,
    issuerRoleId = personalRoleId,
    scopeKind = "tenant",
    scopeId = Guid.NewGuid().ToString(),
    capability = "admin"
});

await t.OkAsync("3.5   Ohne certify im Bereich geht nichts", async () =>
    foreignScope.StatusCode == HttpStatusCode.Forbidden
    && (await ReadAsync(foreignScope)).GetProperty("code").GetString() == RcErrorCodes.PermissionDenied);

// 24.5 — Der Entzug wirkt SOFORT. Im Altbestand wirkte er nach Ablauf des
// Zwischenspeichers, und niemand konnte sagen, wann das war.
await http.PostAsync($"/rc/certificates/{certificateId}/revoke", null);
var certsAfter = await ReadAsync(await http.GetAsync("/rc/certificates"));

t.Ok("24.5  Ein zurueckgenommenes Zertifikat verschwindet sofort", () =>
    certsAfter.GetProperty("certificates").EnumerateArray()
        .All(c => c.GetProperty("certificateId").GetString() != certificateId));

// -- 3.12 — Einladung in einen nicht oeffentlichen Teil -----------------------
//
// Der Reihe nach: Anna lädt in den Pfarrgemeinderat ein. Bruno meldet sich ganz
// normal an — ohne Link, ohne Einladung — und erreicht nichts von Anna. Erst
// das Einloesen des Links verbindet den Zugang mit seinem Konto.

var invited = await http.PostAsJsonAsync("/rc/invitations", new
{
    roleId = groupRoleId,
    label = "Pfarrgemeinderat",
    daysValid = 14
});

var inviteSecret = "";
await t.OkAsync("3.12  Wer certify hat, kann einladen", async () =>
{
    if (invited.StatusCode != HttpStatusCode.Created) return false;
    inviteSecret = (await ReadAsync(invited)).GetProperty("secret").GetString()!;
    return inviteSecret.Length >= 20;
});

// 10.4 — Der SMS-Weg besteht auf sieben Tagen. Zwischen dem Klick auf den
// sms:-Link und dem Absenden koennen Stunden liegen.
var tooShort = await http.PostAsJsonAsync("/rc/invitations", new
{
    roleId = groupRoleId, forSms = true, daysValid = 2
});

t.Ok("10.4  SMS-Link unter sieben Tagen wird abgewiesen", () =>
    tooShort.StatusCode == HttpStatusCode.BadRequest);

// Ein zweiter Mensch, eigener Klient, eigene Kekse.
var brunoHandler = new HttpClientHandler { CookieContainer = new CookieContainer(), UseCookies = true };
using var bruno = new HttpClient(brunoHandler) { BaseAddress = new Uri(baseAddress) };
var brunoCsrf = (await ReadAsync(await bruno.PostAsync("/rc/csrf", null))).GetProperty("token").GetString()!;
bruno.DefaultRequestHeaders.Add("X-Rc-Csrf", brunoCsrf);

const string brunoName = "bruno";
var brunoSalt = RcBase64Url.Encode(RcPassword.NewSalt());
var brunoKey = RcPassword.DerivePasswordKey("ein zweites langes Passwort", RcBase64Url.Decode(brunoSalt));

var brunoRegistered = await bruno.PostAsJsonAsync("/rc/auth/register", new
{
    username = brunoName,
    passwordKey = RcBase64Url.Encode(brunoKey),
    passwordSalt = brunoSalt,
    displayName = "Bruno Nowak"
});

t.Ok("Kap. 8  Anmelden kann sich jeder, ohne Einladung", () =>
    brunoRegistered.StatusCode == HttpStatusCode.OK);

bruno.DefaultRequestHeaders.Add("X-Rc-Unlock", RcBase64Url.Encode(brunoKey));

await t.OkAsync("3.5   Ein frisches Konto erreicht nur den eigenen Bereich", async () =>
{
    var his = (await ReadAsync(await bruno.GetAsync("/rc/roles"))).GetProperty("roles").EnumerateArray().ToList();
    return his.Count == 1
        && his[0].GetProperty("kind").GetString() == "person"
        && his[0].GetProperty("displayName").GetString() == "Bruno Nowak";
});

await t.OkAsync("3.5   In Annas Traegerschaft darf Bruno nichts", async () =>
    !(await ReadAsync(await bruno.GetAsync(
        $"/rc/permissions/check?scopeKind=tenant&scopeId={tenantId}&capability=read")))
        .GetProperty("allowed").GetBoolean());

// Ansehen, ohne einzuloesen. Kein Konto noetig — der Link ist der Nachweis.
var peeked = await ReadAsync(await bruno.PostAsJsonAsync("/rc/invitations/peek", new { secret = inviteSecret }));

t.Ok("3.12  Der Link sagt, wohin er fuehrt", () =>
    peeked.GetProperty("label").GetString() == "Pfarrgemeinderat");

var redeemed = await bruno.PostAsJsonAsync("/rc/invitations/redeem", new { secret = inviteSecret });

t.Ok("3.12  Einloesen verbindet den Zugang mit dem Konto", () =>
    redeemed.StatusCode == HttpStatusCode.Created);

// Der eigentliche Beweis: der Rollenschluessel ist auf Brunos persoenliche
// Rolle umgepackt worden, und der Anzeigename geht auf.
await t.OkAsync("21.6  Nach dem Einloesen hat Bruno den Rollenschluessel", async () =>
{
    var his = (await ReadAsync(await bruno.GetAsync("/rc/roles"))).GetProperty("roles").EnumerateArray().ToList();
    var group = his.FirstOrDefault(r => r.GetProperty("roleId").GetString() == groupRoleId);
    return group.ValueKind != JsonValueKind.Undefined
        && group.GetProperty("hasKey").GetBoolean()
        && group.GetProperty("displayName").GetString() == "Pfarrgemeinderat";
});

// Der Schriftfuehrung haengt unter dem Pfarrgemeinderat: sie kommt mit.
await t.OkAsync("21.6  Der Schluesselweg traegt weiter nach unten", async () =>
    (await ReadAsync(await bruno.GetAsync("/rc/roles"))).GetProperty("roles").EnumerateArray()
        .Any(r => r.GetProperty("roleId").GetString() == subRoleId && r.GetProperty("hasKey").GetBoolean()));

var twice = await bruno.PostAsJsonAsync("/rc/invitations/redeem", new { secret = inviteSecret });

await t.OkAsync("3.12  Zweimal derselbe Link ist kein Fehler", async () =>
    twice.StatusCode == HttpStatusCode.OK
    && (await ReadAsync(twice)).GetProperty("alreadyRedeemed").GetBoolean());

var wrongSecret = await bruno.PostAsJsonAsync("/rc/invitations/redeem", new { secret = "voellig-erfunden" });

await t.OkAsync("10.3  Ein falscher Link sieht aus wie ein abgelaufener", async () =>
    wrongSecret.StatusCode == HttpStatusCode.NotFound
    && (await ReadAsync(wrongSecret)).GetProperty("code").GetString() == RcErrorCodes.AuthTokenInvalid);

// -- Kapitel 9 — Bereiche, Nachrichten, Epochen -------------------------------
//
// Die Reihenfolge erzählt eine Geschichte: Anna legt einen Bereich an und
// schreibt hinein. Bruno kommt dazu — und darf das Vorherige NICHT sehen. Dann
// schreibt Anna weiter, Bruno liest mit. Dann fliegt Bruno raus, Anna schreibt
// erneut, und Bruno kommt an das Neue nicht mehr heran.

var areaCreated = await http.PostAsJsonAsync("/rc/areas", new
{
    ownerRoleId = personalRoleId,
    title = "Sitzung des Pfarrgemeinderats"
});

var areaId = "";
await t.OkAsync("9.x   Ein Bereich entsteht mit Epoche 1 und Schluessel", async () =>
{
    if (areaCreated.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(areaCreated);
    areaId = json.GetProperty("areaId").GetString()!;
    return json.GetProperty("epoch").GetInt32() == 1;
});

await t.OkAsync("9.13  Der Bereichstitel liegt verschluesselt und geht auf", async () =>
    (await ReadAsync(await http.GetAsync("/rc/areas"))).GetProperty("areas").EnumerateArray()
        .Any(a => a.GetProperty("areaId").GetString() == areaId
               && a.GetProperty("title").GetString() == "Sitzung des Pfarrgemeinderats"
               && a.GetProperty("canWrite").GetBoolean()));

var firstPost = await http.PostAsJsonAsync($"/rc/areas/{areaId}/messages", new
{
    authorRoleId = personalRoleId,
    body = "Vor Brunos Beitritt gesagt."
});

t.Ok("9.6   Ein Beitrag laesst sich schreiben", () => firstPost.StatusCode == HttpStatusCode.Created);

await t.OkAsync("9.6   Und wieder lesen", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/messages"))).GetProperty("messages")
        .EnumerateArray().Any(m => Text(m, "body") == "Vor Brunos Beitritt gesagt."));

// 3.4 — Bruno ist noch nicht drin. Der Bereich soll fuer ihn nicht einmal
// existieren; „darfst du nicht" waere ein Verzeichnis aller Bereiche.
var beforeJoin = await bruno.GetAsync($"/rc/areas/{areaId}/messages");

t.Ok("3.4   Ein fremder Bereich sieht aus, als gaebe es ihn nicht", () =>
    beforeJoin.StatusCode == HttpStatusCode.NotFound);

// Brunos persoenliche Rolle holen — Anna kennt sie aus der Mitgliederliste nicht,
// also fragt die Pruefreihe sie bei ihm selbst ab.
var brunoRoleId = (await ReadAsync(await bruno.GetAsync("/rc/roles")))
    .GetProperty("roles").EnumerateArray()
    .First(r => r.GetProperty("kind").GetString() == "person")
    .GetProperty("roleId").GetString()!;

var joined = await http.PostAsJsonAsync($"/rc/areas/{areaId}/members", new
{
    roleId = brunoRoleId,
    capability = "write"
});

var epochAfterJoin = 0;
await t.OkAsync("9.x   Aufnehmen schneidet eine neue Epoche", async () =>
{
    if (joined.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(joined);
    epochAfterJoin = json.GetProperty("epoch").GetInt32();
    return epochAfterJoin == 2 && !json.GetProperty("readsHistory").GetBoolean();
});

// DER Kern des Epochenmodells: Bruno sieht, DASS etwas da ist, aber nicht WAS.
var brunoFeed = await ReadAsync(await bruno.GetAsync($"/rc/areas/{areaId}/messages"));

t.Ok("9.x   Der Neue sieht die alte Nachricht, kann sie aber nicht lesen", () =>
{
    var older = brunoFeed.GetProperty("messages").EnumerateArray()
        .First(m => m.GetProperty("epoch").GetInt32() == 1);
    return Text(older, "body") is null
        && Text(older, "unreadable") == RcErrorCodes.CryptoMissingEpoch;
});

// 15.9 — Und sie faellt NICHT aus der Liste. Ein Loch waere schlimmer als ein
// unlesbarer Eintrag: der Leser verstuende das Gespraech falsch.
t.Ok("15.9  Unlesbares faellt nicht aus der Liste", () =>
    brunoFeed.GetProperty("messages").GetArrayLength() == 1
    && brunoFeed.GetProperty("readableEpochs").EnumerateArray().Select(e => e.GetInt32()).SequenceEqual([2]));

// 15.9 — Dieselbe Wahrheit eine Ebene hoeher: schon in der BEREICHSLISTE, vor
// dem Oeffnen, muss ablesbar sein, dass einem ein Teil der Geschichte
// verschlossen ist. Die Oberflaeche haengt einen Vermerk daran, und der
// Vermerk haengt an genau dieser Ungleichung — steht sie nicht, behauptet er
// etwas Falsches oder verschwindet.
await t.OkAsync("15.9  Die Bereichsliste verraet, dass Geschichte fehlt", async () =>
{
    var seen = (await ReadAsync(await bruno.GetAsync("/rc/areas"))).GetProperty("areas")
        .EnumerateArray().First(a => a.GetProperty("areaId").GetString() == areaId);
    var mine = (await ReadAsync(await http.GetAsync("/rc/areas"))).GetProperty("areas")
        .EnumerateArray().First(a => a.GetProperty("areaId").GetString() == areaId);

    // Bruno: eine von zwei Epochen — der Vermerk gehoert hin.
    // Anna: alle — er gehoert weg, sonst warnt er vor nichts.
    return seen.GetProperty("readableEpochs").GetInt32() == 1
        && seen.GetProperty("currentEpoch").GetInt32() == 2
        && mine.GetProperty("readableEpochs").GetInt32() == mine.GetProperty("currentEpoch").GetInt32();
});

var secondPost = await http.PostAsJsonAsync($"/rc/areas/{areaId}/messages", new
{
    authorRoleId = personalRoleId,
    body = "Nach Brunos Beitritt gesagt."
});

t.Ok("9.6   Anna schreibt in der neuen Epoche", () => secondPost.StatusCode == HttpStatusCode.Created);

await t.OkAsync("9.x   Das Neue liest Bruno mit", async () =>
    (await ReadAsync(await bruno.GetAsync($"/rc/areas/{areaId}/messages"))).GetProperty("messages")
        .EnumerateArray().Any(m => Text(m, "body") == "Nach Brunos Beitritt gesagt."));

// Bruno darf schreiben — er hat write.
var brunoPost = await bruno.PostAsJsonAsync($"/rc/areas/{areaId}/messages", new
{
    authorRoleId = brunoRoleId,
    body = "Bruno meldet sich zu Wort."
});

t.Ok("3.3   Wer write hat, schreibt unter seinem eigenen Namen", () =>
    brunoPost.StatusCode == HttpStatusCode.Created);

var brunoMessageId = (await ReadAsync(brunoPost)).GetProperty("messageId").GetString()!;

// 9.6.6 — Bearbeiten innerhalb der Frist, als neue Fassung.
var edited = await bruno.PostAsJsonAsync($"/rc/messages/{brunoMessageId}/edit", new
{
    body = "Bruno meldet sich zu Wort. (berichtigt)"
});

await t.OkAsync("9.6.6 Bearbeiten erzeugt eine neue Fassung", async () =>
    edited.StatusCode == HttpStatusCode.OK
    && (await ReadAsync(edited)).GetProperty("version").GetInt32() == 2);

await t.OkAsync("9.6   Die neue Fassung ist die, die man liest", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/messages"))).GetProperty("messages")
        .EnumerateArray().Any(m => Text(m, "body") == "Bruno meldet sich zu Wort. (berichtigt)"));

// Anna ist nicht der Urheber — sie kann Brunos Beitrag nicht bearbeiten.
var foreignEdit = await http.PostAsJsonAsync($"/rc/messages/{brunoMessageId}/edit", new { body = "untergeschoben" });

t.Ok("9.6   Fremde Beitraege lassen sich nicht bearbeiten", () =>
    foreignEdit.StatusCode == HttpStatusCode.Forbidden);

// 9.17 / BEFUND 28 — Ausblenden durch den Urheber nimmt Text UND Urheber.
var withdrawn = await bruno.PostAsJsonAsync($"/rc/messages/{brunoMessageId}/hide", new { byAuthor = true });

t.Ok("9.17  Der Urheber nimmt seinen Beitrag zurueck", () => withdrawn.StatusCode == HttpStatusCode.OK);

await t.OkAsync("9.17  Zurueckgenommen heisst: Text weg UND Urheber weg", async () =>
{
    var stone = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/messages"))).GetProperty("messages")
        .EnumerateArray().First(m => m.GetProperty("messageId").GetString() == brunoMessageId);

    // Ein anonymer Grabstein: kein Text, kein Urheber — und ausdruecklich KEIN
    // Fehlergrund, denn hier ist nichts kaputt.
    return Text(stone, "body") is null
        && Text(stone, "authorRoleId") is null
        && Text(stone, "hiddenKind") == "author"
        && Text(stone, "unreadable") is null;
});

// -- 9.3 — Themen: Ordnung, die nachtraeglich entsteht -------------------------

var firstMessageId = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/messages")))
    .GetProperty("messages").EnumerateArray()
    .First(m => Text(m, "body") == "Nach Brunos Beitritt gesagt.")
    .GetProperty("messageId").GetString()!;

var topicCreated = await http.PostAsJsonAsync($"/rc/areas/{areaId}/topics", new
{
    title = "Erntedank 2026",
    messageIds = new[] { firstMessageId }
});

var topicId = "";
await t.OkAsync("9.3   Ein Thema sammelt bestehende Nachrichten ein", async () =>
{
    if (topicCreated.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(topicCreated);
    topicId = json.GetProperty("topicId").GetString()!;
    return json.GetProperty("assigned").GetInt32() == 1;
});

await t.OkAsync("9.3.9 Der Themenname ist verschluesselt und geht auf", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/topics"))).GetProperty("topics")
        .EnumerateArray().Any(x => Text(x, "title") == "Erntedank 2026"
                                && x.GetProperty("messageCount").GetInt32() == 1));

await http.PostAsJsonAsync($"/rc/topics/{topicId}/labels", new { labels = new[] { 3, 7, 3 } });

await t.OkAsync("9.3.2 Nuancen laufen ueber Etiketten, nicht ueber Zustaende", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/topics"))).GetProperty("topics")
        .EnumerateArray().First().GetProperty("labels").EnumerateArray()
        .Select(l => l.GetInt32()).OrderBy(l => l).SequenceEqual([3, 7]));

var closed = await http.PostAsJsonAsync($"/rc/topics/{topicId}/close", new { });

await t.OkAsync("9.3.2 Ein Thema hat genau zwei Zustaende", async () =>
    closed.StatusCode == HttpStatusCode.OK && (await ReadAsync(closed)).GetProperty("closed").GetBoolean());

// Eine Nachricht aus einem FREMDEN Bereich laesst sich nicht einhaengen — sonst
// waere sie ueber das Thema sichtbar.
var foreignAssign = await ReadAsync(await http.PostAsJsonAsync($"/rc/topics/{topicId}/messages", new
{
    messageIds = new[] { Guid.NewGuid().ToString() }
}));

t.Ok("9.3   Fremde Nachrichten lassen sich nicht einhaengen", () =>
    foreignAssign.GetProperty("assigned").GetInt32() == 0);

// -- 9.8 — Eine Reaktion je Person und Beitrag ---------------------------------

var reacted = await http.PostAsJsonAsync($"/rc/messages/{firstMessageId}/reaction", new
{
    roleId = personalRoleId, kind = 1
});

t.Ok("9.8   Eine Reaktion laesst sich setzen", () => reacted.StatusCode == HttpStatusCode.OK);

var changed = await ReadAsync(await http.PostAsJsonAsync($"/rc/messages/{firstMessageId}/reaction", new
{
    roleId = personalRoleId, kind = 3
}));

t.Ok("9.8   Umentscheiden ueberschreibt, es haeuft nicht an", () =>
    changed.GetProperty("kind").GetInt32() == 3);

// Der Verlauf traegt die Stellungnahme mit. Ohne das haette die Oberflaeche
// zwei Moeglichkeiten, und beide waeren schlecht: je Nachricht eine weitere
// Anfrage (bei fuenfzig Beitraegen fuenfzig), oder die eigene Haltung nach
// jedem Neuladen vergessen — also genau den Knopf entwerten, um den es geht.
await t.OkAsync("9.8   Der Verlauf nennt die eigene Haltung", async () =>
{
    var mine = (await ReadAsync(await http.GetAsync(
            $"/rc/areas/{areaId}/messages?roleId={personalRoleId}")))
        .GetProperty("messages").EnumerateArray()
        .First(m => m.GetProperty("messageId").GetString() == firstMessageId);

    return mine.GetProperty("yourReaction").GetInt32() == 3
        && mine.GetProperty("reactions").GetProperty("3").GetInt32() == 1;
});

// Ohne Namen keine eigene Haltung — aber die Auszaehlung steht trotzdem da.
// Sie ist oeffentlich: in einem Gremium ist ein Widerspruch keine Privatsache.
await t.OkAsync("9.8   Ohne Namen bleibt die Auszaehlung sichtbar", async () =>
{
    var anon = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/messages")))
        .GetProperty("messages").EnumerateArray()
        .First(m => m.GetProperty("messageId").GetString() == firstMessageId);

    return Text(anon, "yourReaction") is null
        && anon.GetProperty("reactions").GetProperty("3").GetInt32() == 1;
});

// Unter fremdem Namen wird nicht geantwortet. Waere @role frei waehlbar,
// koennte jeder die Haltung jedes anderen abfragen — eine geheime Abstimmung
// waere damit ueber den Verlauf auslesbar.
await t.OkAsync("9.8   Unter fremdem Namen fragt niemand die Haltung ab", async () =>
    (await http.GetAsync($"/rc/areas/{areaId}/messages?roleId={brunoRoleId}"))
        .StatusCode == HttpStatusCode.Forbidden);

// Was nicht vorkommt, steht nicht drin. Drei Nullen zu schicken hiesse, dass
// die Oberflaeche neben "ich widerspreche" eine Null zeigt — eine Aussage
// ueber die Sitzung, die niemand getroffen hat.
await t.OkAsync("15.9  Die Auszaehlung nennt nur, was vorkommt", async () =>
{
    var mine = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/messages")))
        .GetProperty("messages").EnumerateArray()
        .First(m => m.GetProperty("messageId").GetString() == firstMessageId)
        .GetProperty("reactions");

    return mine.EnumerateObject().Count() == 1;
});

var badKind = await http.PostAsJsonAsync($"/rc/messages/{firstMessageId}/reaction", new
{
    roleId = personalRoleId, kind = 9
});

t.Ok("9.8   Eine unbekannte Reaktion wird abgewiesen", () =>
    badKind.StatusCode == HttpStatusCode.BadRequest);

// Unter fremdem Namen reagieren geht nicht.
var foreignReaction = await bruno.PostAsJsonAsync($"/rc/messages/{firstMessageId}/reaction", new
{
    roleId = personalRoleId, kind = 1
});

t.Ok("3.3   Unter fremdem Namen reagiert niemand", () =>
    foreignReaction.StatusCode == HttpStatusCode.Forbidden);

// -- 9.9.1 — Lesebestaetigungen mit Symmetrie ----------------------------------

await http.PostAsJsonAsync($"/rc/areas/{areaId}/read-state", new { roleId = personalRoleId });

await t.OkAsync("9.9.1 Wer sichtbar liest, sieht die anderen", async () =>
{
    var state = await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/read-state"));
    return state.GetProperty("enabledHere").GetBoolean()
        && !state.GetProperty("youAreHidden").GetBoolean()
        && state.GetProperty("readers").GetArrayLength() >= 1;
});

// Der Kern: wer sich verbirgt, sieht auch nichts mehr. Ohne diese Kopplung
// waere Abschalten ein einseitiger Vorteil.
await http.PostAsJsonAsync($"/rc/areas/{areaId}/read-state", new
{
    roleId = personalRoleId, receiptsEnabled = false
});

await t.OkAsync("9.9.1 Wer sich verbirgt, sieht auch nicht", async () =>
{
    var state = await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/read-state"));
    return state.GetProperty("youAreHidden").GetBoolean()
        && state.GetProperty("readers").GetArrayLength() == 0;
});

await http.PostAsJsonAsync($"/rc/areas/{areaId}/read-state", new
{
    roleId = personalRoleId, receiptsEnabled = true
});

// -- Entwuerfe -----------------------------------------------------------------

await http.PostAsJsonAsync($"/rc/areas/{areaId}/draft", new
{
    roleId = personalRoleId, body = "Halbfertiger Gedanke, noch nicht abgeschickt."
});

await t.OkAsync("9.x   Ein Entwurf ueberlebt verschluesselt und geht wieder auf", async () =>
    Text(await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/draft?roleId={personalRoleId}")), "body")
        == "Halbfertiger Gedanke, noch nicht abgeschickt.");

await http.PostAsJsonAsync($"/rc/areas/{areaId}/draft", new { roleId = personalRoleId, body = "" });

await t.OkAsync("9.x   Ein geleerter Entwurf verschwindet", async () =>
    Text(await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/draft?roleId={personalRoleId}")), "body") is null);

// -- 9.5 — Umfragen -------------------------------------------------------------

var pollCreated = await http.PostAsJsonAsync($"/rc/areas/{areaId}/polls", new
{
    question = "Wann tagt der Rat?",
    mode = "single",
    reveal = "on_close"
});

var pollId = "";
await t.OkAsync("9.5   Eine Umfrage laesst sich anlegen", async () =>
{
    if (pollCreated.StatusCode != HttpStatusCode.Created) return false;
    pollId = (await ReadAsync(pollCreated)).GetProperty("pollId").GetString()!;
    return pollId.Length == 36;
});

await http.PostAsJsonAsync($"/rc/polls/{pollId}/vote", new { roleId = personalRoleId, choice = "Dienstag" });
await bruno.PostAsJsonAsync($"/rc/polls/{pollId}/vote", new { roleId = brunoRoleId, choice = "Mittwoch" });

// DER Punkt bei on_close: vor dem Schliessen gibt es keine Auszaehlung — auch
// nicht fuer die, die die Umfrage angelegt hat.
await t.OkAsync("9.5   Bei on_close bleibt der Stand bis zum Schluss verborgen", async () =>
{
    var poll = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/polls")))
        .GetProperty("polls").EnumerateArray().First();
    return poll.GetProperty("voteCount").GetInt32() == 2
        && !poll.TryGetProperty("tally", out _)
        && Text(poll, "yourChoice") == "Dienstag";
});

// Umentscheiden: anfuegen, nicht ueberschreiben — die letzte Stimme zaehlt.
await bruno.PostAsJsonAsync($"/rc/polls/{pollId}/vote", new { roleId = brunoRoleId, choice = "Dienstag" });

await http.PostAsync($"/rc/polls/{pollId}/close", null);

await t.OkAsync("9.5   Nach dem Schliessen zaehlt je Rolle die LETZTE Stimme", async () =>
{
    var poll = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/polls")))
        .GetProperty("polls").EnumerateArray().First();
    return poll.GetProperty("closed").GetBoolean()
        && poll.GetProperty("tally").GetProperty("Dienstag").GetInt32() == 2
        && !poll.GetProperty("tally").TryGetProperty("Mittwoch", out _);
});

var lateVote = await http.PostAsJsonAsync($"/rc/polls/{pollId}/vote", new
{
    roleId = personalRoleId, choice = "Donnerstag"
});

t.Ok("9.5   In eine geschlossene Umfrage kommt nichts mehr", () =>
    lateVote.StatusCode == HttpStatusCode.Conflict);

// -- 9.10 — Anhaenge: Geheimtext auf der Platte --------------------------------

var payload = Encoding.UTF8.GetBytes("Protokoll der Sitzung, Seite 1.");
var upload = new MultipartFormDataContent();
var fileContent = new ByteArrayContent(payload);
fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
upload.Add(fileContent, "file", "Sitzungsprotokoll.pdf");

var uploaded = await http.PostAsync($"/rc/messages/{firstMessageId}/attachments", upload);

var attachmentId = "";
await t.OkAsync("9.10  Ein Anhang laesst sich hochladen", async () =>
{
    if (uploaded.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(uploaded);
    attachmentId = json.GetProperty("attachmentId").GetString()!;
    return Text(json, "fileName") == "Sitzungsprotokoll.pdf"
        && json.GetProperty("sizeBytes").GetInt64() == payload.Length;
});

// 15.1 — Auch der Hochladeweg verlangt den Schutzwert. DisableAntiforgery
// schaltet nur den eingebauten Formularschutz ab, nicht diesen.
var noCsrfUpload = new MultipartFormDataContent();
noCsrfUpload.Add(new ByteArrayContent(payload), "file", "x.bin");
using var bareClient = new HttpClient(handler) { BaseAddress = new Uri(baseAddress) };
var unprotected = await bareClient.PostAsync($"/rc/messages/{firstMessageId}/attachments", noCsrfUpload);

await t.OkAsync("15.1  Auch Hochladen braucht den Schutzwert", async () =>
    unprotected.StatusCode == HttpStatusCode.Forbidden
    && (await ReadAsync(unprotected)).GetProperty("code").GetString() == RcErrorCodes.AuthCsrfMissing);

// DER Punkt: auf der Platte liegt Geheimtext, nicht die Datei.
await t.OkAsync("9.10.1 Auf der Platte liegt Geheimtext, kein Klartext", async () =>
{
    var files = Directory.GetFiles(fileStore, "*.rcbin", SearchOption.AllDirectories);
    if (files.Length != 1) return false;

    var onDisk = await File.ReadAllBytesAsync(files[0]);
    var asText = Encoding.UTF8.GetString(onDisk);

    // Weder der Inhalt noch der Dateiname stehen darin — und der Pfad sagt
    // ebenfalls nichts.
    return !asText.Contains("Protokoll")
        && !files[0].Contains("Sitzungsprotokoll")
        && onDisk.Length > payload.Length;
});

var downloaded = await http.GetAsync($"/rc/attachments/{attachmentId}/content");

await t.OkAsync("9.10  Und er kommt unversehrt wieder heraus", async () =>
    downloaded.StatusCode == HttpStatusCode.OK
    && (await downloaded.Content.ReadAsByteArrayAsync()).SequenceEqual(payload));

t.Ok("9.10  Der Dateiname reist im Kopf, nicht im Pfad", () =>
    downloaded.Content.Headers.ContentDisposition?.FileNameStar == "Sitzungsprotokoll.pdf");

await t.OkAsync("9.10  Der Anhang steht an seiner Nachricht", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/messages/{firstMessageId}/attachments")))
        .GetProperty("attachments").EnumerateArray()
        .Any(a => Text(a, "fileName") == "Sitzungsprotokoll.pdf"));

// Bruno ist Mitglied und darf lesen — auch die Anhaenge.
var brunoDownload = await bruno.GetAsync($"/rc/attachments/{attachmentId}/content");

t.Ok("9.10  Wer den Bereich lesen darf, bekommt auch den Anhang", () =>
    brunoDownload.StatusCode == HttpStatusCode.OK);

// E-94 — 10 MB. Die Grenze steht im Schema UND im Code.
var tooBig = new MultipartFormDataContent();
tooBig.Add(new ByteArrayContent(new byte[11 * 1024 * 1024]), "file", "zu-gross.bin");
var rejected = await http.PostAsync($"/rc/messages/{firstMessageId}/attachments", tooBig);

await t.OkAsync("E-94  Ueber 10 MB wird abgewiesen", async () =>
    rejected.StatusCode == HttpStatusCode.RequestEntityTooLarge
    && (await ReadAsync(rejected)).GetProperty("code").GetString() == RcErrorCodes.StorageFileTooLarge);

// Loeschen nimmt Zeile UND Datei — ein liegengebliebener Block zaehlte weiter
// gegen das Kontingent.
await http.PostAsync($"/rc/attachments/{attachmentId}/delete", null);

t.Ok("9.10  Loeschen nimmt auch die Datei von der Platte", () =>
    Directory.GetFiles(fileStore, "*.rcbin", SearchOption.AllDirectories).Length == 0);

// -- Kapitel 7 — Die Kette ------------------------------------------------------
//
// Entscheidungen sind IMMER kettenpflichtig (7.8, ledger_entry_id NOT NULL).
// Sie sind deshalb der Weg, die Kette wirklich zu fuellen.

var decisionCreated = await http.PostAsJsonAsync($"/rc/areas/{areaId}/decisions", new
{
    roleId = personalRoleId,
    body = "Der Rat beschliesst, das Erntedankfest am zweiten Sonntag zu feiern."
});

var decisionId = "";
await t.OkAsync("9.4   Eine Entscheidung entsteht mit Ketteneintrag", async () =>
{
    if (decisionCreated.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(decisionCreated);
    decisionId = json.GetProperty("decisionId").GetString()!;
    return Text(json, "state") == "proposed";
});

// 9.4 — Der Weg ist vorgezeichnet. „Vorgeschlagen" fuehrt nicht direkt zu
// „angenommen": sonst stuende irgendwann ein Beschluss da, ueber den nie
// jemand gesprochen hat.
var skipped = await http.PostAsJsonAsync($"/rc/decisions/{decisionId}/transition", new
{
    roleId = personalRoleId, toState = "accepted", reason = "abgekuerzt"
});

t.Ok("9.4   Ein uebersprungener Zustand wird abgewiesen", () =>
    skipped.StatusCode == HttpStatusCode.Conflict);

// Und die Sicht sagt vorher, was ueberhaupt offen steht. Die Tafel gehoert in
// den Server; schriebe die Oberflaeche sie ab, boete sie irgendwann Wege an,
// die abgewiesen werden — oder verschwiege welche, die offen stehen.
//
// Diese Pruefung ist die Klammer: was in allowedNext steht, MUSS durchgehen,
// und was nicht drinsteht, MUSS abgewiesen werden. Ohne sie waere das Feld
// eine zweite Behauptung statt derselben Regel.
await t.OkAsync("9.4   Die Sicht nennt genau die Wege, die der Dienst zulaesst", async () =>
{
    var view = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/decisions")))
        .GetProperty("decisions").EnumerateArray()
        .First(d => d.GetProperty("decisionId").GetString() == decisionId);

    var next = view.GetProperty("allowedNext").EnumerateArray()
        .Select(x => x.GetString()).OrderBy(x => x).ToList();

    // "proposed" fuehrt zu "open" oder "rejected" — nicht zu "accepted".
    return view.GetProperty("state").GetString() == "proposed"
        && next.SequenceEqual(["open", "rejected"]);
});

// Eine Endstation nennt keine Wege — und das ist etwas anderes als "noch nicht
// geladen". Ein leeres Feld muss deshalb wirklich leer sein und nicht fehlen.
await t.OkAsync("9.4   Nach jedem Uebergang stimmt die Liste weiter", async () =>
{
    // In einem EIGENEN Bereich. Jeder Uebergang schreibt einen Ketteneintrag,
    // und die Kettenpruefungen weiter unten zaehlen die Eintraege von
    // {areaId} genau ab. Eine Pruefung, die den Zaehler einer anderen
    // verschiebt, ist ein schlechter Nachbar — sie laesst etwas fehlschlagen,
    // das voellig in Ordnung ist.
    var ownArea = (await ReadAsync(await http.PostAsJsonAsync("/rc/areas", new
    {
        ownerRoleId = personalRoleId,
        title = "Nur fuer die Zustandstafel"
    }))).GetProperty("areaId").GetString()!;

    var probe = await http.PostAsJsonAsync($"/rc/areas/{ownArea}/decisions", new
    {
        roleId = personalRoleId,
        body = "Ein zweiter Beschluss, um die Tafel abzugehen."
    });

    var probeId = (await ReadAsync(probe)).GetProperty("decisionId").GetString()!;

    // proposed -> open -> accepted -> reopened, und an jeder Station wird
    // geprueft, dass genau die genannten Wege gehen.
    foreach (var (from, to) in new[] { ("proposed", "open"), ("open", "accepted"), ("accepted", "reopened") })
    {
        var view = (await ReadAsync(await http.GetAsync($"/rc/areas/{ownArea}/decisions")))
            .GetProperty("decisions").EnumerateArray()
            .First(d => d.GetProperty("decisionId").GetString() == probeId);

        if (view.GetProperty("state").GetString() != from) return false;

        var next = view.GetProperty("allowedNext").EnumerateArray().Select(x => x.GetString()).ToList();
        if (!next.Contains(to)) return false;

        var step = await http.PostAsJsonAsync($"/rc/decisions/{probeId}/transition", new
        {
            roleId = personalRoleId, toState = to, reason = $"Von {from} nach {to}."
        });

        if (step.StatusCode != HttpStatusCode.Created) return false;
    }

    return true;
});

var noReason = await http.PostAsJsonAsync($"/rc/decisions/{decisionId}/transition", new
{
    roleId = personalRoleId, toState = "open", reason = ""
});

t.Ok("9.4   Ein Zustandswechsel ohne Begruendung wird abgewiesen", () =>
    noReason.StatusCode == HttpStatusCode.BadRequest);

await http.PostAsJsonAsync($"/rc/decisions/{decisionId}/transition", new
{
    roleId = personalRoleId, toState = "open", reason = "Zur Beratung freigegeben."
});

var accepted = await http.PostAsJsonAsync($"/rc/decisions/{decisionId}/transition", new
{
    roleId = personalRoleId, toState = "accepted", reason = "Einstimmig angenommen."
});

t.Ok("9.4   Der vorgesehene Weg wird gegangen", () => accepted.StatusCode == HttpStatusCode.Created);

await t.OkAsync("9.4   Text und Begruendungen sind verschluesselt und gehen auf", async () =>
{
    var decision = (await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/decisions")))
        .GetProperty("decisions").EnumerateArray().First();

    var history = decision.GetProperty("history").EnumerateArray().ToList();
    return Text(decision, "state") == "accepted"
        && Text(decision, "body")!.StartsWith("Der Rat beschliesst")
        && history.Count == 2
        && Text(history[1], "reason") == "Einstimmig angenommen.";
});

// -- Der eigentliche Punkt: die Kette laesst sich nachrechnen -------------------

var ledgerId = "";
await t.OkAsync("7.4   Der Bereich nennt seine Kette — ueber die Schnittstelle", async () =>
{
    // Frueher holte diese Pruefung die Kennung mit eigenem SQL aus der
    // Datenbank. Genau das war der Beweis, dass die Oberflaeche nicht an das
    // Protokoll herankam: was sich eine Pruefreihe aus der Datenbank nehmen
    // muss, kann ein Browser nicht.
    ledgerId = (await ReadAsync(await http.GetAsync("/rc/areas"))).GetProperty("areas")
        .EnumerateArray().First(a => a.GetProperty("areaId").GetString() == areaId)
        .GetProperty("ledgerId").GetString()!;

    // Und sie zeigt auf dieselbe Kette, die auch in der Zeile steht.
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();
    await using var cmd = new SqlCommand("SELECT ledger_id FROM dbo.rc_area WHERE id = @id;", probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(areaId));
    var fromRow = ((Guid)(await cmd.ExecuteScalarAsync())!).ToString();
    if (!string.Equals(fromRow, ledgerId, StringComparison.OrdinalIgnoreCase)) return false;
    return ledgerId.Length == 36;
});

var verified = await ReadAsync(await http.GetAsync($"/rc/ledgers/{ledgerId}/verify"));

t.Ok("7.5   Die Kette rechnet sich Glied fuer Glied nach", () =>
    verified.GetProperty("intact").GetBoolean()
    && verified.GetProperty("entries").GetInt64() == 3
    && verified.GetProperty("headSequence").GetInt64() == 3);

// 7.4.1 — Der Kopf ist OHNE Konto abrufbar. Ein Zeuge, den der Betreiber erst
// zulassen muss, ist kein Zeuge.
var anonymous = new HttpClient { BaseAddress = new Uri(baseAddress) };
var head = await anonymous.GetAsync($"/rc/ledgers/{ledgerId}/head");

await t.OkAsync("7.4.1 Der Kettenkopf ist ohne Konto abrufbar", async () =>
    head.StatusCode == HttpStatusCode.OK
    && (await ReadAsync(head)).GetProperty("sequence").GetInt64() == 3);

// Und er verraet nichts ueber den Inhalt.
await t.OkAsync("7.4   Der Kopf verraet nur Nummer und Hash", async () =>
{
    var body = await head.Content.ReadAsStringAsync();
    return !body.Contains("Erntedank") && !body.Contains(personalRoleId);
});

var entries = await ReadAsync(await http.GetAsync($"/rc/ledgers/{ledgerId}/entries"));

t.Ok("22.6  Der erste Eintrag zeigt auf 32 Nullen", () =>
    Text(entries.GetProperty("entries")[0], "previousHash") == new string('0', 64));

t.Ok("24.3  Ausgeliefert werden die gespeicherten kanonischen Bytes", () =>
    Text(entries.GetProperty("entries")[0], "payloadCanonical")!.Contains("\"kind\":\"decision.created\""));

// 3.4 — In der Kette steht eine gesaltete Verpflichtung, NIE die Kontokennung.
t.Ok("3.4   In der Kette steht kein Konto, sondern eine Verpflichtung", () =>
{
    var first = entries.GetProperty("entries")[0];
    return Text(first, "accountCommitment")!.Length == 64
        && !JsonSerializer.Serialize(entries).Contains(founded.GetProperty("accountId").GetString()!);
});

// P0-5 — Eine Gabelung ist strukturell unmoeglich: uq_rc_ledger_entry_prev.
await t.OkAsync("P0-5  Zwei Eintraege auf denselben Vorgaenger sind unmoeglich", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();
    await using var cmd = new SqlCommand("""
        INSERT INTO dbo.rc_ledger_entry
            (id, ledger_id, sequence_no, previous_hash, entry_hash, payload_canonical,
             subject_id, tenant_id, module_id, signer_key_fp, key_version, transaction_id,
             account_commitment, signature, server_timestamp)
        SELECT NEWID(), ledger_id, 99, previous_hash, entry_hash, payload_canonical,
               subject_id, tenant_id, module_id, signer_key_fp, key_version, transaction_id,
               account_commitment, signature, server_timestamp
        FROM dbo.rc_ledger_entry WHERE ledger_id = @ledger AND sequence_no = 1;
        """, probe);
    cmd.Parameters.AddWithValue("@ledger", Guid.Parse(ledgerId));

    try { await cmd.ExecuteNonQueryAsync(); return false; }
    catch (SqlException e) { return e.Number is 2601 or 2627; }
});

// 7.6 — Und die Kette ist append-only, auch fuer den Betreiber.
await t.OkAsync("7.6   Ein Ketteneintrag laesst sich nicht aendern", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();
    await using var cmd = new SqlCommand(
        "UPDATE dbo.rc_ledger_entry SET module_id = 'gefaelscht' WHERE ledger_id = @ledger;", probe);
    cmd.Parameters.AddWithValue("@ledger", Guid.Parse(ledgerId));

    try { await cmd.ExecuteNonQueryAsync(); return false; }
    catch (SqlException) { return true; }
});

// 7.8 / E-263 — Kettenpflicht je BEITRAG. Ohne Angabe entsteht kein Eintrag;
// eine Kette, in der jedes „bis gleich" steht, beweist am Ende nichts.
var plainPost = await ReadAsync(await http.PostAsJsonAsync($"/rc/areas/{areaId}/messages", new
{
    authorRoleId = personalRoleId, body = "Beilaeufig."
}));

t.Ok("7.8   Ohne Angabe kommt ein Beitrag NICHT in die Kette", () =>
    !plainPost.GetProperty("chainBound").GetBoolean());

var boundPost = await ReadAsync(await http.PostAsJsonAsync($"/rc/areas/{areaId}/messages", new
{
    authorRoleId = personalRoleId, body = "Zu Protokoll gegeben.", chainBound = true
}));

t.Ok("7.8   Mit Angabe schon", () => boundPost.GetProperty("chainBound").GetBoolean());

await t.OkAsync("7.5   Die Kette bleibt auch danach nachrechenbar", async () =>
{
    var report = await ReadAsync(await http.GetAsync($"/rc/ledgers/{ledgerId}/verify"));
    return report.GetProperty("intact").GetBoolean() && report.GetProperty("entries").GetInt64() == 4;
});

// Der wichtigste Fall der ganzen Pruefreihe: eine Pruefung, die IMMER „heil"
// sagt, ist wertlos. Also wird die Kette absichtlich beschaedigt — mit
// abgeschaltetem Ausloeser, also mit genau den Rechten, die ein Betreiber hat —
// und danach muss die Pruefung es finden.
byte[] originalCanonical = [];

await t.OkAsync("7.5   Eine gefaelschte Nutzlast wird gefunden", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using (var read = new SqlCommand(
        "SELECT payload_canonical FROM dbo.rc_ledger_entry WHERE ledger_id = @l AND sequence_no = 2;", probe))
    {
        read.Parameters.AddWithValue("@l", Guid.Parse(ledgerId));
        originalCanonical = (byte[])(await read.ExecuteScalarAsync())!;
    }

    await using (var tamper = new SqlCommand("""
        DISABLE TRIGGER dbo.tr_rc_ledger_entry_append_only ON dbo.rc_ledger_entry;
        UPDATE dbo.rc_ledger_entry SET payload_canonical = @fake
        WHERE ledger_id = @l AND sequence_no = 2;
        ENABLE TRIGGER dbo.tr_rc_ledger_entry_append_only ON dbo.rc_ledger_entry;
        """, probe))
    {
        tamper.Parameters.AddWithValue("@l", Guid.Parse(ledgerId));
        tamper.Parameters.AddWithValue("@fake", System.Text.Encoding.UTF8.GetBytes("{\"kind\":\"erfunden\"}"));
        await tamper.ExecuteNonQueryAsync();
    }

    var broken = await http.GetAsync($"/rc/ledgers/{ledgerId}/verify");
    var report = await ReadAsync(broken);

    return broken.StatusCode == HttpStatusCode.Conflict
        && !report.GetProperty("intact").GetBoolean()
        && report.GetProperty("firstBrokenSequence").GetInt64() == 2
        && Text(report, "reason")!.Contains("Eintragshash");
});

// Wiederherstellen, damit der Rest der Pruefreihe auf einer heilen Kette laeuft.
await using (var repair = new SqlConnection(connectionString))
{
    await repair.OpenAsync();
    await using var cmd = new SqlCommand("""
        DISABLE TRIGGER dbo.tr_rc_ledger_entry_append_only ON dbo.rc_ledger_entry;
        UPDATE dbo.rc_ledger_entry SET payload_canonical = @original
        WHERE ledger_id = @l AND sequence_no = 2;
        ENABLE TRIGGER dbo.tr_rc_ledger_entry_append_only ON dbo.rc_ledger_entry;
        """, repair);
    cmd.Parameters.AddWithValue("@l", Guid.Parse(ledgerId));
    cmd.Parameters.AddWithValue("@original", originalCanonical);
    await cmd.ExecuteNonQueryAsync();
}

await t.OkAsync("7.5   Nach der Wiederherstellung ist die Kette wieder heil", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/ledgers/{ledgerId}/verify")))
        .GetProperty("intact").GetBoolean());

// -- Kapitel 12 — Klassen, Protokoll, Loeschung --------------------------------

var personalItem = await http.PostAsJsonAsync("/rc/data", new
{
    ownerRoleId = personalRoleId,
    dataClass = "personal",
    field = "ContactPhone",
    value = "+48 600 000 000"
});

var personalItemId = "";
await t.OkAsync("12.9  Eine personenbezogene Angabe entsteht verschluesselt", async () =>
{
    if (personalItem.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(personalItem);
    personalItemId = json.GetProperty("dataItemId").GetString()!;
    return json.GetProperty("logged").GetBoolean() && json.GetProperty("shareable").GetBoolean();
});

// 3.13 — Der Feldname stammt aus der festen Aufzaehlung.
var madeUpField = await http.PostAsJsonAsync("/rc/data", new
{
    ownerRoleId = personalRoleId, dataClass = "personal", field = "LieblingsFarbe", value = "gruen"
});

t.Ok("3.13  Ein erfundener Feldname wird abgewiesen", () =>
    madeUpField.StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("12.9  Und sie geht beim Eigentuemer wieder auf", async () =>
    Text(await ReadAsync(await http.GetAsync($"/rc/data/{personalItemId}")), "value") == "+48 600 000 000");

// 12.9 — Die Protokollpflicht FOLGT aus der Klasse. Kein Schalter.
await t.OkAsync("12.9  Das Lesen steht im Protokoll", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/data/{personalItemId}/access-log")))
        .GetProperty("accesses").GetArrayLength() >= 1);

// Bruno hat keinen Schluessel — und bekommt dieselbe Antwort wie fuer etwas,
// das es nicht gibt.
var brunoPeek = await bruno.GetAsync($"/rc/data/{personalItemId}");

t.Ok("3.4   Ohne Schluessel sieht die Angabe aus, als gaebe es sie nicht", () =>
    brunoPeek.StatusCode == HttpStatusCode.NotFound);

await http.PostAsJsonAsync($"/rc/data/{personalItemId}/share", new { toRoleId = brunoRoleId });

await t.OkAsync("12.9  Nach der Freigabe liest Bruno mit", async () =>
    Text(await ReadAsync(await bruno.GetAsync($"/rc/data/{personalItemId}")), "value") == "+48 600 000 000");

await t.OkAsync("12.9  Und sein Lesen steht mit SEINER Rolle im Protokoll", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/data/{personalItemId}/access-log")))
        .GetProperty("accesses").EnumerateArray()
        .Any(a => Text(a, "readerRoleId") == brunoRoleId));

// Weitergeben, was einem nicht gehoert, geht nicht — sonst waere jede Freigabe
// zugleich eine Erlaubnis zur Weitergabe.
var brunoShares = await bruno.PostAsJsonAsync($"/rc/data/{personalItemId}/share", new
{
    toRoleId = groupRoleId
});

t.Ok("12.9  Wer nur lesen darf, darf nicht weitergeben", () =>
    brunoShares.StatusCode == HttpStatusCode.Forbidden);

// -- Besondere Kategorien: Zweck ist Pflicht ------------------------------------

var specialItem = await ReadAsync(await http.PostAsJsonAsync("/rc/data", new
{
    ownerRoleId = personalRoleId, dataClass = "special",
    field = "ParticipantCardData", value = "Diabetes, Insulin"
}));
var specialItemId = specialItem.GetProperty("dataItemId").GetString()!;

var withoutPurpose = await http.GetAsync($"/rc/data/{specialItemId}");

t.Ok("Art. 9 Ohne Zweck kein Zugriff auf besondere Kategorien", () =>
    withoutPurpose.StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("Art. 9 Mit Zweck schon — und der Zweck steht im Protokoll", async () =>
{
    var read = await http.GetAsync($"/rc/data/{specialItemId}?purpose=Notfallvorsorge");
    if (read.StatusCode != HttpStatusCode.OK) return false;

    return (await ReadAsync(await http.GetAsync($"/rc/data/{specialItemId}/access-log")))
        .GetProperty("accesses").EnumerateArray()
        .Any(a => Text(a, "purpose") == "Notfallvorsorge");
});

// -- secret kennt keine Freigabe -------------------------------------------------

var secretItem = await ReadAsync(await http.PostAsJsonAsync("/rc/data", new
{
    ownerRoleId = personalRoleId, dataClass = "secret",
    field = "ParticipantCardClause", value = "Nur fuer mich."
}));
var secretItemId = secretItem.GetProperty("dataItemId").GetString()!;

t.Ok("12.9  secret ist als nicht freigebbar gekennzeichnet", () =>
    !secretItem.GetProperty("shareable").GetBoolean());

var secretShare = await http.PostAsJsonAsync($"/rc/data/{secretItemId}/share", new { toRoleId = brunoRoleId });

t.Ok("12.9  Und der Endpunkt weist die Freigabe wirklich ab", () =>
    secretShare.StatusCode == HttpStatusCode.Forbidden);

// -- 12.3.2 Weg (b) — Loeschung durch Schluesselvernichtung ----------------------

var destroyed = await ReadAsync(await http.PostAsJsonAsync($"/rc/data/{personalItemId}/destroy", new
{
    reason = "Loeschverlangen"
}));

t.Ok("12.3.2 Loeschen vernichtet die Schluessel, nicht die Zeile", () =>
    destroyed.GetProperty("keysDestroyed").GetInt32() == 2
    && destroyed.GetProperty("ciphertextRemains").GetBoolean());

var afterDestroy = await http.GetAsync($"/rc/data/{personalItemId}");

await t.OkAsync("12.3.2 Danach geht sie fuer NIEMANDEN mehr auf", async () =>
    afterDestroy.StatusCode == HttpStatusCode.Gone
    && (await bruno.GetAsync($"/rc/data/{personalItemId}")).StatusCode == HttpStatusCode.Gone);

// Der eigentliche Punkt: der Vollzug ist NACHWEISBAR. Eine geloeschte Zeile
// koennte man nur behaupten; hier steht, welcher Schluessel wann und warum
// vernichtet wurde.
await t.OkAsync("12.3.2 Der Vollzug steht in der Datenbank", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();
    await using var cmd = new SqlCommand("""
        SELECT COUNT(*) FROM dbo.rc_role_key_grant
        WHERE key_kind = 'data_key' AND key_ref = @item
          AND destroyed_at IS NOT NULL AND destroyed_reason = 'Loeschverlangen';
        """, probe);
    cmd.Parameters.AddWithValue("@item", Guid.Parse(personalItemId));
    return (int)(await cmd.ExecuteScalarAsync())! == 2;
});

// BEFUND 43 — Rollenschluessel und Datenschluessel sind verschiedene Arten.
// Waeren sie dieselbe, haette die Loeschung oben die Rolle mit ausgesperrt.
await t.OkAsync("BEFUND 43 Die Rolle ueberlebt die Loeschung ihrer Daten", async () =>
    (await ReadAsync(await http.GetAsync("/rc/roles"))).GetProperty("roles").EnumerateArray()
        .Any(r => r.GetProperty("roleId").GetString() == personalRoleId
               && r.GetProperty("hasKey").GetBoolean()));

// -- 12.10 — Einwilligungstexte --------------------------------------------------

var consentPl = await http.PostAsJsonAsync("/rc/consent", new
{
    consentKey = "teilnahme",
    language = "pl",
    body = "Zgadzam sie na udzial w spotkaniach.",
    tenantRoleId = personalRoleId
});

await t.OkAsync("12.10 Ein Einwilligungstext laesst sich veroeffentlichen", async () =>
    consentPl.StatusCode == HttpStatusCode.Created
    && (await ReadAsync(consentPl)).GetProperty("version").GetInt32() == 1);

await http.PostAsJsonAsync("/rc/consent", new
{
    consentKey = "teilnahme", language = "de",
    body = "Ich willige in die Teilnahme ein.", tenantRoleId = personalRoleId
});

await http.PostAsJsonAsync("/rc/consent", new
{
    consentKey = "teilnahme", language = "pl",
    body = "Zgadzam sie na udzial w spotkaniach i wyjazdach.", tenantRoleId = personalRoleId
});

// 12.10 — Je Sprache eine EIGENE Zaehlung. Die deutsche Fassung 1 und die
// polnische Fassung 2 stehen nebeneinander; die polnische Fassung 1 bleibt.
await t.OkAsync("12.10 Jede Sprache zaehlt fuer sich", async () =>
{
    var versions = (await ReadAsync(await http.GetAsync("/rc/consent/teilnahme/versions")))
        .GetProperty("versions").EnumerateArray().ToList();

    return versions.Count == 3
        && versions.Count(v => Text(v, "language") == "pl") == 2
        && versions.Count(v => Text(v, "language") == "de") == 1;
});

// Ohne Konto lesbar — ein Text, den man erst nach der Anmeldung lesen kann,
// kommt zu spaet.
var publicConsent = await anonymous.GetAsync("/rc/consent/teilnahme?language=pl");

await t.OkAsync("12.10 Einwilligungstexte sind ohne Konto lesbar", async () =>
    publicConsent.StatusCode == HttpStatusCode.OK
    && (await ReadAsync(publicConsent)).GetProperty("version").GetInt32() == 2);

// KEIN Rueckfall auf eine andere Sprache: wer einen Text unterschreibt, den er
// nicht lesen kann, willigt in nichts ein.
var missingLanguage = await anonymous.GetAsync("/rc/consent/teilnahme?language=fr");

t.Ok("12.10 Ohne Text in der Sprache kommt KEIN fremdsprachiger", () =>
    missingLanguage.StatusCode == HttpStatusCode.NotFound);

// Der Hash geht ueber die kanonische Form und bindet Schluessel, Sprache und
// Fassung mit ein — derselbe Wortlaut unter anderer Nummer ist eine andere
// Zusage. Nachgerechnet wird er hier mit demselben Kernel wie auf dem Server.
await t.OkAsync("12.10 Der Hash laesst sich unabhaengig nachrechnen", async () =>
{
    var current = await ReadAsync(await anonymous.GetAsync("/rc/consent/teilnahme?language=pl"));
    var recomputed = RcConsent.BodyHash("teilnahme", "pl",
        current.GetProperty("version").GetInt32(), Text(current, "body")!);

    return RcCrypto.ToHex(recomputed) == Text(current, "bodyHash");
});

// -- Kapitel 8 — Wiederherstellung ---------------------------------------------
//
// Clara ist die Vergessliche; Anna und Bruno sind ihre Buergen. Ein Schwellwert
// von zwei verlangt ZWEI MENSCHEN, die sich jeder fuer sich anmelden und jeder
// fuer sich beitragen — und genau das wird hier durchgespielt.

var claraHandler = new HttpClientHandler { CookieContainer = new CookieContainer(), UseCookies = true };
using var clara = new HttpClient(claraHandler) { BaseAddress = new Uri(baseAddress) };
var claraCsrf = (await ReadAsync(await clara.PostAsync("/rc/csrf", null))).GetProperty("token").GetString()!;
clara.DefaultRequestHeaders.Add("X-Rc-Csrf", claraCsrf);

const string claraName = "clara";
var claraSalt = RcBase64Url.Encode(RcPassword.NewSalt());
var claraKey = RcPassword.DerivePasswordKey("das dritte lange Passwort", RcBase64Url.Decode(claraSalt));

var claraRegistered = await ReadAsync(await clara.PostAsJsonAsync("/rc/auth/register", new
{
    username = claraName,
    passwordKey = RcBase64Url.Encode(claraKey),
    passwordSalt = claraSalt
}));
clara.DefaultRequestHeaders.Add("X-Rc-Unlock", RcBase64Url.Encode(claraKey));
var claraRoleId = claraRegistered.GetProperty("personalRoleId").GetString()!;

var deposited = await clara.PostAsJsonAsync("/rc/recovery/shares", new
{
    guarantorRoleIds = new[] { personalRoleId, brunoRoleId },
    threshold = 2
});

await t.OkAsync("8.2   Der Wurzelschluessel laesst sich hinterlegen", async () =>
{
    if (deposited.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(deposited);
    return json.GetProperty("guarantors").GetInt32() == 2 && json.GetProperty("threshold").GetInt32() == 2;
});

// 8.3 — Der Hinweis muss BEIDE Enden nennen. Ein Text, der nur den Schutz
// erwaehnt, verkauft eine Falle als Vorzug.
await t.OkAsync("8.3   Der Hinweis nennt beide Enden der Karenzzeit", async () =>
{
    var notice = Text(await ReadAsync(deposited), "notice")!;
    return notice.Contains("widersprechen") && notice.Contains("warten");
});

var thresholdOne = await clara.PostAsJsonAsync("/rc/recovery/shares", new
{
    guarantorRoleIds = new[] { personalRoleId, brunoRoleId }, threshold = 1
});

t.Ok("8.2   Schwellwert 1 wird abgewiesen — das waere eine Kopie", () =>
    thresholdOne.StatusCode == HttpStatusCode.BadRequest);

// -- Riegel 1: nur ein Buerge darf beantragen ----------------------------------

var firstRequest = await bruno.PostAsJsonAsync("/rc/recovery/requests", new
{
    targetRoleId = claraRoleId, byRoleId = brunoRoleId
});

t.Ok("Kap. 8 Ein Buerge darf beantragen", () => firstRequest.StatusCode == HttpStatusCode.Created);
var firstId = (await ReadAsync(firstRequest)).GetProperty("requestId").GetString()!;

// -- Riegel 2: die Karenzzeit --------------------------------------------------

var tooEarly = await bruno.PostAsJsonAsync($"/rc/recovery/requests/{firstId}/complete", new
{
    requesterRoleId = brunoRoleId
});

t.Ok("8.3   Vor Ablauf der Karenzzeit geht nichts", () =>
    tooEarly.StatusCode == HttpStatusCode.Conflict);

// -- Riegel 3: der Widerspruch -------------------------------------------------
//
// Clara kann sich noch anmelden, sieht den Antrag und stoppt ihn. Genau dieser
// Fall ist der gefaehrliche: ein Fremder hat die Buergen ueberredet, waehrend
// die Besitzerin arglos weiterarbeitet.

await t.OkAsync("8.3   Die Besitzerin sieht den Antrag", async () =>
    (await ReadAsync(await clara.GetAsync("/rc/recovery/requests"))).GetProperty("requests")
        .EnumerateArray().Any(r => Text(r, "requestId") == firstId));

var strangerObjects = await http.PostAsync($"/rc/recovery/requests/{firstId}/object", null);

t.Ok("8.3   Widersprechen kann nur, wem die Rolle gehoert", () =>
    strangerObjects.StatusCode == HttpStatusCode.Forbidden);

var objected = await clara.PostAsync($"/rc/recovery/requests/{firstId}/object", null);

t.Ok("8.3   Die Besitzerin widerspricht", () => objected.StatusCode == HttpStatusCode.OK);

await AgeRequestAsync(connectionString, firstId);

var afterObjection = await bruno.PostAsJsonAsync($"/rc/recovery/requests/{firstId}/contribute", new
{
    guarantorRoleId = brunoRoleId
});

t.Ok("8.3   Nach einem Widerspruch hilft auch Warten nicht", () =>
    afterObjection.StatusCode == HttpStatusCode.Conflict);

// -- Der Vollzug, wenn alles stimmt --------------------------------------------

var secondId = (await ReadAsync(await bruno.PostAsJsonAsync("/rc/recovery/requests", new
{
    targetRoleId = claraRoleId, byRoleId = brunoRoleId
}))).GetProperty("requestId").GetString()!;

await AgeRequestAsync(connectionString, secondId);

var brunoContributes = await ReadAsync(await bruno.PostAsJsonAsync(
    $"/rc/recovery/requests/{secondId}/contribute", new { guarantorRoleId = brunoRoleId }));

t.Ok("8.2   Ein Buerge traegt seinen Anteil bei", () =>
    brunoContributes.GetProperty("contributions").GetInt32() == 1
    && !brunoContributes.GetProperty("enough").GetBoolean());

// EIN Beitrag genuegt nicht — das ist der ganze Sinn des Schwellwerts.
var tooFew = await bruno.PostAsJsonAsync($"/rc/recovery/requests/{secondId}/complete", new
{
    requesterRoleId = brunoRoleId
});

await t.OkAsync("8.2   Ein einzelner Buerge kommt nicht hinein", async () =>
    tooFew.StatusCode == HttpStatusCode.Conflict
    && Text(await ReadAsync(tooFew), "message")!.Contains("1 von 2"));

// Derselbe Buerge zweimal hilft nicht: sonst erreichte einer allein den
// Schwellwert, indem er denselben Anteil noch einmal einreicht.
var twiceContributed = await ReadAsync(await bruno.PostAsJsonAsync(
    $"/rc/recovery/requests/{secondId}/contribute", new { guarantorRoleId = brunoRoleId }));

t.Ok("8.2   Derselbe Buerge zaehlt nur einmal", () =>
    twiceContributed.GetProperty("alreadyContributed").GetBoolean());

var strangerContributes = await clara.PostAsJsonAsync(
    $"/rc/recovery/requests/{secondId}/contribute", new { guarantorRoleId = brunoRoleId });

t.Ok("8.2   Unter fremdem Namen traegt niemand bei", () =>
    strangerContributes.StatusCode == HttpStatusCode.Forbidden);

// Jetzt Anna — der zweite Mensch, der sich selbst anmelden und selbst
// beitragen muss. GENAU DAS soll der Schwellwert verlangen.
var annaContributes = await ReadAsync(await http.PostAsJsonAsync(
    $"/rc/recovery/requests/{secondId}/contribute", new { guarantorRoleId = personalRoleId }));

t.Ok("8.2   Der zweite Buerge macht den Schwellwert voll", () =>
    annaContributes.GetProperty("contributions").GetInt32() == 2
    && annaContributes.GetProperty("enough").GetBoolean());

// Vollziehen kann nur der Antragsteller — fuer ihn sind die Beitraege verpackt.
var annaCompletes = await http.PostAsJsonAsync($"/rc/recovery/requests/{secondId}/complete", new
{
    requesterRoleId = personalRoleId
});

t.Ok("8.x   Vollziehen kann nur, wer beantragt hat", () =>
    annaCompletes.StatusCode == HttpStatusCode.Forbidden);

var completed = await bruno.PostAsJsonAsync($"/rc/recovery/requests/{secondId}/complete", new
{
    requesterRoleId = brunoRoleId
});

var oneTimeSecret = "";
await t.OkAsync("8.x   Zwei Buergen zusammen vollziehen die Wiederherstellung", async () =>
{
    if (completed.StatusCode != HttpStatusCode.OK) return false;
    oneTimeSecret = Text(await ReadAsync(completed), "oneTimeSecret") ?? "";
    return oneTimeSecret.Length > 16;
});

// DER Beweis: das neue Geheimnis oeffnet Claras Konto wirklich — der
// Wurzelschluessel wurde also richtig zusammengesetzt. Shamir liefert auch bei
// falschen Anteilen ein Ergebnis; nur dieser Durchgang zeigt, dass es stimmt.
await t.OkAsync("8.2   Der zusammengesetzte Schluessel ist der richtige", async () =>
{
    var saltJson = await ReadAsync(await bruno.PostAsJsonAsync("/rc/auth/salt", new { username = claraName }));
    var newKey = RcPassword.DerivePasswordKey(oneTimeSecret,
        RcBase64Url.Decode(Text(saltJson, "passwordSalt")!));

    using var recovered = new HttpClient(
        new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = new Uri(baseAddress) };
    var token = (await ReadAsync(await recovered.PostAsync("/rc/csrf", null))).GetProperty("token").GetString()!;
    recovered.DefaultRequestHeaders.Add("X-Rc-Csrf", token);

    var unlock = await recovered.PostAsJsonAsync("/rc/auth/unlock", new
    {
        username = claraName, passwordKey = RcBase64Url.Encode(newKey)
    });
    if (unlock.StatusCode != HttpStatusCode.OK) return false;

    // Und mit ihm geht auch die persoenliche Rolle wieder auf — der
    // Schluesselweg ist vollstaendig wiederhergestellt.
    recovered.DefaultRequestHeaders.Add("X-Rc-Unlock", RcBase64Url.Encode(newKey));
    return (await ReadAsync(await recovered.GetAsync("/rc/roles"))).GetProperty("roles")
        .EnumerateArray().Any(r => Text(r, "roleId") == claraRoleId && r.GetProperty("hasKey").GetBoolean());
});

// Nach einer Wiederherstellung enden alle bestehenden Sitzungen — auch die der
// Besitzerin. Danach weiss niemand mehr sicher, wer noch angemeldet ist.
var claraAfterRecovery = await clara.GetAsync("/rc/auth/me");

await t.OkAsync("8.x   Die Wiederherstellung beendet alle Sitzungen des Kontos", async () =>
    claraAfterRecovery.StatusCode == HttpStatusCode.Unauthorized
    && Text(await ReadAsync(claraAfterRecovery), "code") == RcErrorCodes.SessionRevoked);

// -- Der Schnitt beim Verlassen ------------------------------------------------

var removed = await http.PostAsync($"/rc/areas/{areaId}/members/{brunoRoleId}/remove", null);

var epochAfterLeave = 0;
await t.OkAsync("9.x   Entfernen schneidet eine neue Epoche", async () =>
{
    if (removed.StatusCode != HttpStatusCode.OK) return false;
    epochAfterLeave = (await ReadAsync(removed)).GetProperty("newEpoch").GetInt32();
    return epochAfterLeave == 3;
});

var afterLeave = await bruno.GetAsync($"/rc/areas/{areaId}/messages");

t.Ok("9.x   Wer gegangen ist, sieht den Bereich nicht mehr", () =>
    afterLeave.StatusCode == HttpStatusCode.NotFound);

var afterRemoval = await http.PostAsJsonAsync($"/rc/areas/{areaId}/messages", new
{
    authorRoleId = personalRoleId,
    body = "Nach Brunos Ausscheiden gesagt."
});

t.Ok("9.x   Anna schreibt in der Epoche nach dem Schnitt", () =>
    afterRemoval.StatusCode == HttpStatusCode.Created);

// Und Anna selbst liest weiterhin ALLES — sie war in jeder Epoche dabei.
await t.OkAsync("9.x   Wer durchgehend dabei war, liest alle Epochen", async () =>
{
    var feed = await ReadAsync(await http.GetAsync($"/rc/areas/{areaId}/messages"));
    var epochs = feed.GetProperty("readableEpochs").EnumerateArray().Select(e => e.GetInt32()).ToList();
    // Die Behauptung ist nicht „genau so viele", sondern „KEINE ist ihr
    // verschlossen". Eine Zahl hier muesste bei jedem neuen Beitrag
    // nachgezogen werden — und ein Test, den man routinemaessig nachzieht,
    // prueft bald nichts mehr.
    var unreadable = feed.GetProperty("messages").EnumerateArray()
        .Count(m => Text(m, "unreadable") is not null);

    return epochs.SequenceEqual([1, 2, 3]) && unreadable == 0;
});

// -- 14.x — Veranstaltungen: was ein Klient NIE versucht -----------------------
//
// Der Durchgang gegen den laufenden Dienst (npm run rc:walk) geht den Weg
// nach, den die Oberflaeche nimmt. Hier steht das andere: fremde Kennungen,
// ueberlange Eingaben, Reihenfolgen, die kein Klient anbietet. Beides wird
// gebraucht, und keines ersetzt das andere.
//
// In einem EIGENEN Bereich, damit die Kettenpruefungen weiter oben ihre
// Eintraege genau abzaehlen koennen.

var eventArea = (await ReadAsync(await http.PostAsJsonAsync("/rc/areas", new
{
    ownerRoleId = personalRoleId,
    title = "Vorbereitung Pfarrfest"
}))).GetProperty("areaId").GetString()!;

var eventCreated = await http.PostAsJsonAsync("/rc/events", new
{
    areaId = eventArea,
    slug = "Pfarrfest 2026!",
    title = "Pfarrfest"
});

var eventId = "";
await t.OkAsync("14.x  Eine Veranstaltung entsteht an einem Bereich", async () =>
{
    if (eventCreated.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(eventCreated);
    eventId = json.GetProperty("eventId").GetString()!;

    // Die Adresse wird gezogen, nicht uebernommen: Grossbuchstaben,
    // Leerzeichen und Satzzeichen haben in einer Adresse nichts verloren.
    return Text(json, "slug") == "pfarrfest-2026"
        && Text(json, "lifecycle") == "draft";
});

// Ein Bereich traegt hoechstens eine. Zwei waeren zwei Oeffentlichkeiten
// hinter demselben Schluessel — und beim Entfernen eines Mitglieds wuesste
// niemand mehr, welche gemeint war.
await t.OkAsync("14.x  Ein zweiter Anlauf am selben Bereich wird abgewiesen", async () =>
    (await http.PostAsJsonAsync("/rc/events", new
    {
        areaId = eventArea, slug = "noch-eins", title = "Noch eins"
    })).StatusCode == HttpStatusCode.Conflict);

// 3.6 — Die Berechtigung kommt aus dem Kernel. Bruno hat auf DIESEM Bereich
// nichts, also gibt es die Veranstaltung fuer ihn nicht.
await t.OkAsync("3.6   Wer den Bereich nicht verwaltet, legt dort nichts an", async () =>
    (await bruno.PostAsJsonAsync("/rc/events", new
    {
        areaId = eventArea, slug = "fremd", title = "Fremd"
    })).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

// Eine leere Adresse ist keine. Sie faellt sonst erst auf, wenn niemand die
// Seite mehr aufrufen kann.
await t.OkAsync("14.x  Eine Adresse aus lauter Satzzeichen wird abgewiesen", async () =>
    (await http.PostAsJsonAsync("/rc/events", new
    {
        areaId = eventArea, slug = "!!! ???", title = "Leer"
    })).StatusCode == HttpStatusCode.BadRequest);

var pageCreated = await http.PostAsJsonAsync($"/rc/events/{eventId}/pages", new
{
    slug = "programm", title = "Programm"
});

var pageId = "";
await t.OkAsync("14.x  Eine Seite entsteht", async () =>
{
    if (pageCreated.StatusCode != HttpStatusCode.Created) return false;
    pageId = (await ReadAsync(pageCreated)).GetProperty("pageId").GetString()!;
    return true;
});

await t.OkAsync("14.x  Zwei Seiten mit derselben Adresse gehen nicht", async () =>
    (await http.PostAsJsonAsync($"/rc/events/{eventId}/pages", new
    {
        slug = "programm", title = "Nochmal"
    })).StatusCode == HttpStatusCode.Conflict);

// Eine unbekannte Art faellt HIER auf und nicht erst, wenn eine Seite sich
// nicht mehr darstellen laesst.
await t.OkAsync("14.x  Eine unbekannte Art von Teil wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/event-pages/{pageId}/parts", new
    {
        kind = "karussell", isPublic = true, title = "Was auch immer"
    })).StatusCode == HttpStatusCode.BadRequest);

// 3.4 — Eine fremde Seite sieht aus, als gaebe es sie nicht. "Darfst du nicht"
// waere ein Verzeichnis dessen, was gerade vorbereitet wird.
await t.OkAsync("3.4   An einer fremden Seite haengt niemand etwas an", async () =>
    (await bruno.PostAsJsonAsync($"/rc/event-pages/{pageId}/parts", new
    {
        kind = "text", isPublic = true, title = "Fremd"
    })).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

await t.OkAsync("3.4   Und eine erfundene Seitenkennung ebenso", async () =>
    (await http.PostAsJsonAsync($"/rc/event-pages/{Guid.NewGuid()}/parts", new
    {
        kind = "text", isPublic = true, title = "Nirgends"
    })).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

var formCreated = await http.PostAsJsonAsync($"/rc/event-pages/{pageId}/parts", new
{
    kind = "form", isPublic = true, title = "Anmeldung"
});

var formPartId = (await ReadAsync(formCreated)).GetProperty("partId").GetString()!;

var textCreated = await http.PostAsJsonAsync($"/rc/event-pages/{pageId}/parts", new
{
    kind = "text", isPublic = true, title = "Hinweis"
});

var textPartId = (await ReadAsync(textCreated)).GetProperty("partId").GetString()!;

// Felder gehoeren an ein Formular. An einen Textabschnitt gehaengt waeren sie
// unerreichbar — und niemand merkte es, bis jemand sie ausfuellen soll.
await t.OkAsync("14.x  Felder gehoeren nur an einen Formularteil", async () =>
    (await http.PostAsJsonAsync($"/rc/event-parts/{textPartId}/fields", new
    {
        kind = "text", label = "Name"
    })).StatusCode == HttpStatusCode.Conflict);

// 12.9 — Die Vorgabe ist die STRENGERE, und eine erfundene Klasse wird
// abgewiesen statt stillschweigend zur mildesten zu werden.
var fieldCreated = await http.PostAsJsonAsync($"/rc/event-parts/{formPartId}/fields", new
{
    kind = "text", label = "Wie heisst du?", isRequired = true, identityRole = "name"
});

var nameFieldId = "";
await t.OkAsync("12.9  Ohne Angabe gilt die strengere Datenklasse", async () =>
{
    if (fieldCreated.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(fieldCreated);
    nameFieldId = json.GetProperty("fieldId").GetString()!;
    return Text(json, "dataClass") == "special";
});

await t.OkAsync("12.9  Eine erfundene Datenklasse wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/event-parts/{formPartId}/fields", new
    {
        kind = "text", label = "Irgendwas", dataClass = "harmlos"
    })).StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("14.x  Eine erfundene Rolle im Formular wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/event-parts/{formPartId}/fields", new
    {
        kind = "text", label = "Irgendwas", identityRole = "chef"
    })).StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("14.x  Eine Auswahl ohne Moeglichkeiten wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/event-parts/{formPartId}/fields", new
    {
        kind = "select", label = "Wohin?"
    })).StatusCode == HttpStatusCode.BadRequest);

// -- Ein Entwurf ist fuer Fremde nicht da -------------------------------------

await t.OkAsync("14.x  Ein Entwurf sieht fuer Fremde aus, als gaebe es ihn nicht", async () =>
    (await bruno.GetAsync("/rc/events/pfarrfest-2026")).StatusCode == HttpStatusCode.NotFound);

await t.OkAsync("14.x  Ein Entwurf nimmt keine Anmeldungen entgegen", async () =>
    (await http.PostAsJsonAsync($"/rc/event-parts/{formPartId}/registrations", new
    {
        roleId = personalRoleId,
        answers = new[] { new { fieldId = nameFieldId, value = "Anna" } }
    })).StatusCode == HttpStatusCode.Conflict);

await http.PostAsJsonAsync($"/rc/events/{eventId}/publish", new { });

await t.OkAsync("14.x  Nach dem Veroeffentlichen erreicht sie auch ein Fremder", async () =>
    (await bruno.GetAsync("/rc/events/pfarrfest-2026")).StatusCode == HttpStatusCode.OK);

// -- Anmeldungen: die Regeln gelten im DIENST ---------------------------------

await t.OkAsync("14.x  Fehlende Pflichtangaben weist der Dienst ab", async () =>
{
    var response = await http.PostAsJsonAsync($"/rc/event-parts/{formPartId}/registrations", new
    {
        roleId = personalRoleId,
        answers = Array.Empty<object>()
    });

    // Und er nennt, WELCHE fehlt — sonst raet der Absender.
    return response.StatusCode == HttpStatusCode.BadRequest
        && (await ReadAsync(response)).GetProperty("message").GetString()!.Contains("Wie heisst du?");
});

// Wer selbst versiegelt, MUSS die Kennung mitschicken: unter ihr wurde
// verschlossen. Sie stillschweigend zu wuerfeln hiesse, Huellen anzunehmen,
// die niemand je oeffnen kann.
await t.OkAsync("14.x  Ohne Kennung nimmt der Dienst nichts Versiegeltes an", async () =>
    (await bruno.PostAsJsonAsync($"/rc/event-parts/{formPartId}/registrations", new
    {
        sealedAnswers = new[] { new { fieldId = nameFieldId, sealed_ = "AAAA" } },
        sessionKeyWrapped = "AAAA"
    })).StatusCode == HttpStatusCode.BadRequest);

// Und ohne verpackten Schluessel ebenso. Ein Formular, das bei fehlendem
// Schluessel auf Klartext ausweicht, waere schlimmer als eines, das absagt.
await t.OkAsync("14.x  Ohne verpackten Schluessel nimmt er auch nichts an", async () =>
    (await bruno.PostAsJsonAsync($"/rc/event-parts/{formPartId}/registrations", new
    {
        registrationId = Guid.NewGuid().ToString(),
        sealedAnswers = new[] { new { fieldId = nameFieldId, sealed_ = "AAAA" } }
    })).StatusCode == HttpStatusCode.BadRequest);

var signedUp = await http.PostAsJsonAsync($"/rc/event-parts/{formPartId}/registrations", new
{
    roleId = personalRoleId,
    answers = new[] { new { fieldId = nameFieldId, value = "Anna Vorsitzende" } }
});

var registrationId = "";
await t.OkAsync("14.x  Ein Mitglied meldet sich an", async () =>
{
    if (signedUp.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(signedUp);
    registrationId = json.GetProperty("registrationId").GetString()!;

    // Ein Mitglied bekommt KEINEN Beleg: es hat ein Konto.
    return Text(json, "claim") is null;
});

await t.OkAsync("14.x  Die Anmeldung geht beim Ansehen wieder auf", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/event-parts/{formPartId}/registrations")))
        .GetProperty("registrations").EnumerateArray()
        .First(r => r.GetProperty("registrationId").GetString() == registrationId)
        .GetProperty("answers").EnumerateArray()
        .Any(a => Text(a, "value") == "Anna Vorsitzende" && Text(a, "dataClass") == "special"));

// 3.4 — Die Anmeldeliste geht nur die Vorbereitenden etwas an.
await t.OkAsync("3.4   Ein Fremder sieht die Anmeldeliste nicht", async () =>
    (await bruno.GetAsync($"/rc/event-parts/{formPartId}/registrations"))
        .StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

// -- Ruecknahme ----------------------------------------------------------------

// Ein falscher Beleg wird abgewiesen — und zwar wie ein unbekannter, nicht
// anders. Sonst verriete der Unterschied, dass es die Anmeldung gibt.
await t.OkAsync("12.3.2 Mit falschem Beleg nimmt niemand etwas zurueck", async () =>
    (await bruno.PostAsJsonAsync($"/rc/registrations/{registrationId}/withdraw", new
    {
        claim = "voellig-erfunden"
    })).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

await t.OkAsync("12.3.2 Die Leitung darf zuruecknehmen", async () =>
{
    var response = await http.PostAsJsonAsync($"/rc/registrations/{registrationId}/withdraw", new { });
    return response.StatusCode == HttpStatusCode.OK
        && (await ReadAsync(response)).GetProperty("valuesDestroyed").GetInt32() == 1;
});

await t.OkAsync("12.3.2 Zweimal zuruecknehmen ist kein Fehler", async () =>
    (await http.PostAsJsonAsync($"/rc/registrations/{registrationId}/withdraw", new { }))
        .StatusCode == HttpStatusCode.OK);

await t.OkAsync("12.3.2 Die Zeile bleibt, die Werte sind weg", async () =>
{
    var view = (await ReadAsync(await http.GetAsync($"/rc/event-parts/{formPartId}/registrations")))
        .GetProperty("registrations").EnumerateArray()
        .First(r => r.GetProperty("registrationId").GetString() == registrationId);

    return view.GetProperty("withdrawn").GetBoolean()
        && view.GetProperty("answers").EnumerateArray().All(a => Text(a, "value") is null);
});

// -- Die Datenbank haelt die Form, nicht nur der Code -------------------------

await t.OkAsync("14.x  Ein Teil ist entweder oeffentlich ODER versiegelt", async () =>
{
    // ck_rc_event_part_form: ein Versuch, beide Formen zugleich zu setzen,
    // wird von der Datenbank abgewiesen — nicht von der Sorgfalt des Codes.
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand("""
        INSERT INTO dbo.rc_event_part
            (id, page_id, sort_order, kind, is_public, epoch, title, title_sealed, created_at, updated_at)
        VALUES (@id, @page, 99, 'text', 1, 1, N'Klartext', 0x00, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
        """, probe);

    cmd.Parameters.AddWithValue("@id", Guid.NewGuid());
    cmd.Parameters.AddWithValue("@page", Guid.Parse(pageId));

    try { await cmd.ExecuteNonQueryAsync(); return false; }
    catch (SqlException e) { return e.Message.Contains("ck_rc_event_part_form"); }
});

await t.OkAsync("14.x  Eine Anmeldung laesst sich nicht loeschen, nur zuruecknehmen", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand(
        "DELETE FROM dbo.rc_event_registration WHERE id = @id;", probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(registrationId));

    try { await cmd.ExecuteNonQueryAsync(); return false; }
    catch (SqlException e) { return e.Number == 50006; }
});

// -- Pfarrei: EINE Zeile, zwei Sichtbarkeiten ---------------------------------
//
// Bei den Veranstaltungen trennt die Sichtbarkeit ganze Abschnitte. Hier
// trennt sie FELDER derselben Zeile — und das ist der Alltag: eine Intention
// wird oeffentlich angekuendigt, aber wofuer und von wem sie gestiftet wurde,
// geht die Gemeinde nichts an.

var parishArea = (await ReadAsync(await http.PostAsJsonAsync("/rc/areas", new
{
    ownerRoleId = personalRoleId,
    title = "Pfarrbuero"
}))).GetProperty("areaId").GetString()!;

var parishCreated = await http.PostAsJsonAsync("/rc/parishes", new
{
    areaId = parishArea,
    // Grossbuchstaben, damit die Umformung mitgeprueft wird — und ein Name, der
    // auf der Liste steht (RcParishSlugs). Ein beliebiger Name kaeme hier nicht
    // mehr durch, und genau das ist der Zweck der Liste.
    slug = "Grzegorzki",
    name = "Parafia Grzegorzki",
    location = "Limanowa"
});

var parishId = "";
await t.OkAsync("14.x  Eine Pfarrei entsteht an einem Bereich", async () =>
{
    if (parishCreated.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(parishCreated);
    parishId = json.GetProperty("parishId").GetString()!;
    return Text(json, "slug") == "grzegorzki";
});

await t.OkAsync("14.x  Ein zweiter Anlauf am selben Bereich wird abgewiesen", async () =>
    (await http.PostAsJsonAsync("/rc/parishes", new
    {
        areaId = parishArea, slug = "grzegorzki", name = "Noch eine"
    })).StatusCode == HttpStatusCode.Conflict);

// Die Liste ist die Schranke, nicht das Formular. Wer die Anfrage von Hand
// stellt, kommt an der Warnung im Browser vorbei — hier nicht.
var strangeSlug = await http.PostAsJsonAsync("/rc/parishes", new
{
    areaId = parishArea, slug = "sankt-nimmerlein", name = "Nicht vorgesehen"
});

await t.OkAsync("14.x  Ein Name ausserhalb der Liste wird abgewiesen", async () =>
{
    if (strangeSlug.StatusCode != HttpStatusCode.BadRequest) return false;

    var json = await ReadAsync(strangeSlug);
    if (json.GetProperty("code").GetString() != RcErrorCodes.ParishSlugNotAllowed) return false;

    // Die Antwort sagt AUCH, was vorgesehen ist. Eine Abfuhr ohne diese
    // Auskunft liesse den Menschen davor raten.
    return json.GetProperty("details").GetProperty("allowed").GetString()!.Contains("grzegorzki");
});

await t.OkAsync("3.6   Wer den Bereich nicht verwaltet, legt dort keine Pfarrei an", async () =>
    (await bruno.PostAsJsonAsync("/rc/parishes", new
    {
        areaId = parishArea, slug = "fremd", name = "Fremd"
    })).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

var massCreated = await http.PostAsJsonAsync($"/rc/parishes/{parishId}/masses", new
{
    startsUtc = DateTimeOffset.UtcNow.AddDays(3),
    church = "Pfarrkirche",
    title = "Sonntagsmesse",
    durationMinutes = 60
});

var massId = "";
await t.OkAsync("14.x  Eine Messe kommt in den Plan", async () =>
{
    if (massCreated.StatusCode != HttpStatusCode.Created) return false;
    massId = (await ReadAsync(massCreated)).GetProperty("massId").GetString()!;
    return true;
});

await t.OkAsync("14.x  Eine unmoegliche Dauer wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/parishes/{parishId}/masses", new
    {
        startsUtc = DateTimeOffset.UtcNow, church = "Kapelle", durationMinutes = 9999
    })).StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.InternalServerError);

// -- Die Intention: drei Felder, zwei Sichtbarkeiten --------------------------

var intentionCreated = await http.PostAsJsonAsync($"/rc/parishes/{parishId}/intentions", new
{
    massId,
    publicText = "in einer bestimmten Absicht",
    internalText = "fuer die Genesung von Frau Kowalska",
    donorRef = "Familie Kowalski"
});

var intentionId = "";
await t.OkAsync("14.x  Eine Intention entsteht", async () =>
{
    if (intentionCreated.StatusCode != HttpStatusCode.Created) return false;
    intentionId = (await ReadAsync(intentionCreated)).GetProperty("intentionId").GetString()!;
    return true;
});

await t.OkAsync("14.x  Ein leerer oeffentlicher Text wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/parishes/{parishId}/intentions", new
    {
        publicText = "   ", internalText = "etwas"
    })).StatusCode == HttpStatusCode.BadRequest);

// DER Punkt: der Plan ist oeffentlich, der interne Teil nicht — und beide
// stehen in derselben Zeile.
await t.OkAsync("14.x  Der Plan nennt den oeffentlichen Text", async () =>
{
    var anonymous = new HttpClient { BaseAddress = new Uri(baseAddress) };
    var plan = await ReadAsync(await anonymous.GetAsync("/rc/parishes/st-martin/masses"));

    return plan.GetProperty("masses").EnumerateArray()
        .First(m => m.GetProperty("massId").GetString() == massId)
        .GetProperty("intentions").EnumerateArray()
        .Any(i => i.GetString() == "in einer bestimmten Absicht");
});

await t.OkAsync("12.9  Und er verraet WEDER den internen Text NOCH den Stifter", async () =>
{
    var anonymous = new HttpClient { BaseAddress = new Uri(baseAddress) };
    var body = await (await anonymous.GetAsync("/rc/parishes/st-martin/masses")).Content.ReadAsStringAsync();

    return !body.Contains("Kowalska") && !body.Contains("Kowalski");
});

await t.OkAsync("14.x  Wer den Schluessel hat, sieht beides", async () =>
{
    var view = (await ReadAsync(await http.GetAsync($"/rc/parishes/{parishId}/intentions")))
        .GetProperty("intentions").EnumerateArray()
        .First(i => i.GetProperty("intentionId").GetString() == intentionId);

    return Text(view, "publicText") == "in einer bestimmten Absicht"
        && Text(view, "internalText") == "fuer die Genesung von Frau Kowalska"
        && Text(view, "donorRef") == "Familie Kowalski"
        && Text(view, "unreadable") is null;
});

await t.OkAsync("3.4   Ein Fremder sieht die Intentionen nicht", async () =>
    (await bruno.GetAsync($"/rc/parishes/{parishId}/intentions"))
        .StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

// 3.13 — Drei Felder, drei Etiketten. Waeren sie gleich, liesse sich der
// Stiftername in das interne Feld schieben — lautlos.
await t.OkAsync("3.13  Der Stifter laesst sich nicht ins interne Feld schieben", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    // Den Geheimtext des Stifterfeldes in das interne Feld kopieren. Er ist
    // gueltig verschluesselt — aber unter einem anderen Etikett.
    await using var swap = new SqlCommand("""
        UPDATE dbo.rc_intention SET internal_sealed = donor_ref_sealed WHERE id = @id;
        """, probe);
    swap.Parameters.AddWithValue("@id", Guid.Parse(intentionId));
    await swap.ExecuteNonQueryAsync();

    var view = (await ReadAsync(await http.GetAsync($"/rc/parishes/{parishId}/intentions")))
        .GetProperty("intentions").EnumerateArray()
        .First(i => i.GetProperty("intentionId").GetString() == intentionId);

    // Der Tausch faellt auf: das Etikett passt nicht, und der interne Text
    // bleibt leer statt den Stifternamen anzuzeigen.
    return Text(view, "unreadable") == RcErrorCodes.CryptoAadMismatch
        && Text(view, "internalText") is null;
});

// -- Gaben: Geld liegt immer versiegelt ---------------------------------------

var offeringCreated = await http.PostAsJsonAsync($"/rc/intentions/{intentionId}/offerings", new
{
    amount = "50,00", currency = "pln", donorRef = "Familie Kowalski"
});

await t.OkAsync("12.9  Eine Gabe entsteht, die Waehrung wird gross geschrieben", async () =>
    offeringCreated.StatusCode == HttpStatusCode.Created
    && Text(await ReadAsync(offeringCreated), "currency") == "PLN");

await t.OkAsync("14.x  Eine Waehrung mit vier Buchstaben wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/intentions/{intentionId}/offerings", new
    {
        amount = "10", currency = "EURO"
    })).StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("12.9  Der Betrag liegt versiegelt in der Zeile", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand(
        "SELECT amount_sealed FROM dbo.rc_offering WHERE intention_id = @id;", probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(intentionId));

    var blob = (byte[])(await cmd.ExecuteScalarAsync())!;
    var asText = System.Text.Encoding.UTF8.GetString(blob);

    // Der Betrag steht nirgends im Klartext — auch nicht in Teilen.
    return !asText.Contains("50") && blob.Length > 20;
});

await t.OkAsync("14.x  Eine Gabe laesst sich nicht aendern, nur gegenbuchen", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand(
        "UPDATE dbo.rc_offering SET currency = 'EUR' WHERE intention_id = @id;", probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(intentionId));

    try { await cmd.ExecuteNonQueryAsync(); return false; }
    catch (SqlException e) { return e.Number == 50006; }
});

// -- Cogita: der Wissensgraph --------------------------------------------------
//
// Der interessante Punkt steht am Ende: eine oeffentliche Bibliothek laesst
// sich vom Server durchsuchen, eine private nicht — und der Dienst sagt das,
// statt eine leere Trefferliste zu liefern, die wie "nichts gefunden" aussieht.

var graphArea = (await ReadAsync(await http.PostAsJsonAsync("/rc/areas", new
{
    ownerRoleId = personalRoleId,
    title = "Wissensarbeit"
}))).GetProperty("areaId").GetString()!;

// -- Eine OEFFENTLICHE Bibliothek: Klartext, durchsuchbar ---------------------

var openLib = await http.PostAsJsonAsync("/rc/libraries", new
{
    areaId = graphArea, slug = "Periodensystem", title = "Periodensystem", isPublic = true
});

var openLibId = "";
await t.OkAsync("cg1.1 Eine oeffentliche Bibliothek entsteht", async () =>
{
    if (openLib.StatusCode != HttpStatusCode.Created) return false;
    var json = await ReadAsync(openLib);
    openLibId = json.GetProperty("libraryId").GetString()!;
    return json.GetProperty("isPublic").GetBoolean() && Text(json, "slug") == "periodensystem";
});

// §1.2 — EntityKind ist selbst ein Knoten. Das ist der ganze Trick: neue Arten
// entstehen, ohne dass jemand eine Migration schreibt.
var kindNode = await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/nodes", new
{
    kind = "entity_kind", value = "Element"
});

var kindNodeId = (await ReadAsync(kindNode)).GetProperty("nodeId").GetString()!;

await t.OkAsync("cg1.2 EntityKind ist selbst ein Knoten", async () =>
    kindNode.StatusCode == HttpStatusCode.Created);

var entity = await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/nodes", new
{
    kind = "entity", value = "Wasserstoff", kindNodeId
});

var entityId = "";
await t.OkAsync("cg1.3 Eine Entitaet verweist auf ihre Art", async () =>
{
    if (entity.StatusCode != HttpStatusCode.Created) return false;
    entityId = (await ReadAsync(entity)).GetProperty("nodeId").GetString()!;
    return true;
});

await t.OkAsync("cg1.3 Eine Entitaet OHNE Art wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/nodes", new
    {
        kind = "entity", value = "Ohne Art"
    })).StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("cg1.3 Und eine Art an einem Textknoten ebenso", async () =>
    (await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/nodes", new
    {
        kind = "text", value = "Text mit Art", kindNodeId
    })).StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("cg1.1 Eine erfundene Knotenart wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/nodes", new
    {
        kind = "hyperwuerfel", value = "?"
    })).StatusCode == HttpStatusCode.BadRequest);

// §1.6 — Die Kante traegt einen Zustand. "unbekannt" ist eine ANGABE.
var numberNode = await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/nodes", new
{
    kind = "number", value = "1.008"
});
var numberNodeId = (await ReadAsync(numberNode)).GetProperty("nodeId").GetString()!;

var edge = await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/edges", new
{
    fromNodeId = entityId, toNodeId = numberNodeId, kind = "atomicWeight", state = "approximate"
});

await t.OkAsync("cg1.6 Eine Kante traegt ihren Zustand", async () =>
    edge.StatusCode == HttpStatusCode.Created
    && Text(await ReadAsync(edge), "state") == "approximate");

await t.OkAsync("cg1.6 Ein erfundener Zustand wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/edges", new
    {
        fromNodeId = entityId, toNodeId = numberNodeId, kind = "x", state = "vielleicht"
    })).StatusCode == HttpStatusCode.BadRequest);

// Eine Schlinge ist in einem Wissensgraphen fast immer ein Fehler beim
// Verknuepfen — und wenn nicht, laesst sie sich ueber einen Zwischenknoten
// ausdruecken.
await t.OkAsync("cg1.10 Eine Kante auf sich selbst wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/edges", new
    {
        fromNodeId = entityId, toNodeId = entityId, kind = "selbst"
    })).StatusCode == HttpStatusCode.BadRequest);

// -- Eine PRIVATE Bibliothek: versiegelt ---------------------------------------

var closedLib = await http.PostAsJsonAsync("/rc/libraries", new
{
    areaId = graphArea, slug = "notizen", title = "Persoenliche Notizen", isPublic = false
});

var closedLibId = (await ReadAsync(closedLib)).GetProperty("libraryId").GetString()!;

var secret = await http.PostAsJsonAsync($"/rc/libraries/{closedLibId}/nodes", new
{
    kind = "text", value = "Sehr vertraulicher Gedanke"
});

await t.OkAsync("cg1.1 Eine private Bibliothek nimmt Knoten an", async () =>
    secret.StatusCode == HttpStatusCode.Created);

await t.OkAsync("cg1.1 Ihr Wert liegt versiegelt in der Zeile", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand("""
        SELECT value, value_sealed FROM dbo.rc_node
        WHERE library_id = @lib AND kind = 'text';
        """, probe);
    cmd.Parameters.AddWithValue("@lib", Guid.Parse(closedLibId));

    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return false;

    // Klartext leer, Geheimtext da — und der Gedanke steht nirgends lesbar.
    var blob = reader.IsDBNull(1) ? null : (byte[])reader[1];
    return reader.IsDBNull(0) && blob is not null
        && !System.Text.Encoding.UTF8.GetString(blob).Contains("vertraulich");
});

await t.OkAsync("cg1.1 Und geht beim Lesen wieder auf", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/libraries/{closedLibId}/nodes")))
        .GetProperty("nodes").EnumerateArray()
        .Any(n => Text(n, "value") == "Sehr vertraulicher Gedanke" && Text(n, "unreadable") is null));

// -- §5: Suche, und die ehrliche Grenze ---------------------------------------

await t.OkAsync("cg5.1 In einer oeffentlichen Bibliothek sucht der Server", async () =>
{
    var found = await ReadAsync(await http.GetAsync(
        $"/rc/libraries/{openLibId}/search?q=Wasser"));

    return found.GetProperty("serverSide").GetBoolean()
        && found.GetProperty("hits").EnumerateArray()
            .Any(h => Text(h, "value") == "Wasserstoff");
});

// DER Punkt: der Dienst sagt, dass er NICHT suchen kann, statt eine leere
// Liste zu liefern, die wie "nichts gefunden" aussieht.
await t.OkAsync("cg5.1 In einer privaten sagt er, dass er es nicht kann", async () =>
{
    var found = await ReadAsync(await http.GetAsync(
        $"/rc/libraries/{closedLibId}/search?q=Gedanke"));

    return !found.GetProperty("serverSide").GetBoolean()
        && found.GetProperty("hits").GetArrayLength() == 0;
});

// Ein Prozentzeichen ist ein Suchbegriff, kein Platzhalter. Ohne Maskierung
// lieferte es alles — und das saehe wie ein Treffer aus.
await t.OkAsync("cg5.1 Ein Prozentzeichen sucht nach einem Prozentzeichen", async () =>
    (await ReadAsync(await http.GetAsync($"/rc/libraries/{openLibId}/search?q=%25")))
        .GetProperty("hits").GetArrayLength() == 0);

// -- Grenzen -------------------------------------------------------------------

await t.OkAsync("3.4   Ein Fremder sieht die Bibliothek nicht", async () =>
    (await bruno.GetAsync($"/rc/libraries/{openLibId}/nodes"))
        .StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

await t.OkAsync("3.4   Und sie steht nicht in seiner Liste", async () =>
    (await ReadAsync(await bruno.GetAsync("/rc/libraries"))).GetProperty("libraries")
        .EnumerateArray().All(l => l.GetProperty("libraryId").GetString() != openLibId));

// Eine Kante ueber Bibliotheksgrenzen waere ein Weg, Inhalte der einen in der
// anderen sichtbar zu machen — und die Berechtigung haengt an der Bibliothek.
await t.OkAsync("cg1.1 Eine Kante ueber Bibliotheksgrenzen wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/libraries/{openLibId}/edges", new
    {
        fromNodeId = entityId,
        toNodeId = (await ReadAsync(await http.GetAsync($"/rc/libraries/{closedLibId}/nodes")))
            .GetProperty("nodes").EnumerateArray().First().GetProperty("nodeId").GetString(),
        kind = "quer"
    })).StatusCode == HttpStatusCode.Conflict);

// -- cg1.6a: Bereiche mit mehreren Abschnitten ---------------------------------
//
// Ein Koenig, der 992–1000 und wieder 1002–1025 regierte, hat EINE Regierung
// mit zwei Abschnitten. Sie in zwei Kanten zu zerlegen hiesse, zwei
// Regierungen zu behaupten.

var rangeNode = (await ReadAsync(await http.PostAsJsonAsync(
    $"/rc/libraries/{openLibId}/nodes", new { kind = "range" })))
    .GetProperty("nodeId").GetString()!;

await t.OkAsync("cg1.6a Ein Bereich nimmt zwei Abschnitte", async () =>
{
    var set = await http.PostAsJsonAsync($"/rc/nodes/{rangeNode}/segments", new
    {
        segments = new[]
        {
            new { valueType = "date", from = "0992", to = "1000", fromState = "inclusive", toState = "inclusive" },
            new { valueType = "date", from = "1002", to = "1025", fromState = "inclusive", toState = "inclusive" }
        }
    });

    return set.StatusCode == HttpStatusCode.OK
        && (await ReadAsync(set)).GetProperty("segments").GetInt32() == 2;
});

await t.OkAsync("cg1.6a Sie kommen in ihrer Reihenfolge zurueck", async () =>
{
    var list = (await ReadAsync(await http.GetAsync($"/rc/nodes/{rangeNode}/segments")))
        .GetProperty("segments").EnumerateArray().ToList();

    return list.Count == 2
        && Text(list[0], "from") == "0992"
        && Text(list[1], "from") == "1002"
        && list[0].GetProperty("sortOrder").GetInt32() == 0;
});

// Ein Bereich ist EIN Wert, kein Behaelter. Setzen ersetzt die Liste
// vollstaendig — sonst gaebe es zwischendurch eine halbe Regierung.
await t.OkAsync("cg1.6a Setzen ersetzt die Liste, es haengt nicht an", async () =>
{
    await http.PostAsJsonAsync($"/rc/nodes/{rangeNode}/segments", new
    {
        segments = new[] { new { valueType = "date", from = "0992", to = "1025" } }
    });

    return (await ReadAsync(await http.GetAsync($"/rc/nodes/{rangeNode}/segments")))
        .GetProperty("segments").GetArrayLength() == 1;
});

// Alle Abschnitte tragen denselben Grundtyp — ein Datum gegen eine Seitenzahl
// ergibt keine Ordnung.
await t.OkAsync("cg1.6a Gemischte Grundtypen werden abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/nodes/{rangeNode}/segments", new
    {
        segments = new[]
        {
            new { valueType = "date", from = "0992" },
            new { valueType = "number", from = "3" }
        }
    })).StatusCode == HttpStatusCode.BadRequest);

// Ein Ende ist freiwillig: ein Abschnitt ohne Ende ist ein einzelner Punkt.
await t.OkAsync("cg1.6a Ein Abschnitt ohne Ende ist ein Punkt", async () =>
{
    await http.PostAsJsonAsync($"/rc/nodes/{rangeNode}/segments", new
    {
        segments = new[] { new { valueType = "number", from = "42", toState = "open" } }
    });

    var one = (await ReadAsync(await http.GetAsync($"/rc/nodes/{rangeNode}/segments")))
        .GetProperty("segments").EnumerateArray().First();

    return Text(one, "to") is null && Text(one, "toState") == "open";
});

// Ein leerer Bereich ist erlaubt: die Aussage „hier gehoert ein Zeitraum hin,
// wir kennen ihn noch nicht".
await t.OkAsync("cg1.6a Ein Bereich ohne Abschnitte ist erlaubt", async () =>
{
    await http.PostAsJsonAsync($"/rc/nodes/{rangeNode}/segments", new { segments = new object[0] });

    return (await ReadAsync(await http.GetAsync($"/rc/nodes/{rangeNode}/segments")))
        .GetProperty("segments").GetArrayLength() == 0;
});

// Abschnitte gehoeren an einen Bereichsknoten und sonst nirgendwohin.
await t.OkAsync("cg1.6a An einem Textknoten haengen keine Abschnitte", async () =>
    (await http.PostAsJsonAsync($"/rc/nodes/{numberNodeId}/segments", new
    {
        segments = new[] { new { valueType = "date", from = "0992" } }
    })).StatusCode == HttpStatusCode.Conflict);

await t.OkAsync("cg1.6a Ein erfundener Zustand wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/nodes/{rangeNode}/segments", new
    {
        segments = new[] { new { valueType = "date", from = "0992", fromState = "vielleicht" } }
    })).StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("3.4   Ein Fremder sieht die Abschnitte nicht", async () =>
    (await bruno.GetAsync($"/rc/nodes/{rangeNode}/segments"))
        .StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

// -- Kalender: Zeit ist nicht Inhalt -------------------------------------------
//
// Der Punkt dieses Moduls: WANN jemand belegt ist, liegt im Klartext; WOMIT er
// belegt ist, liegt versiegelt. Das ist kein Verlust an Schutz, sondern eine
// ehrliche Grenze — und sie wird hier nachgewiesen.

var calArea = (await ReadAsync(await http.PostAsJsonAsync("/rc/areas", new
{
    ownerRoleId = personalRoleId,
    title = "Terminplanung"
}))).GetProperty("areaId").GetString()!;

var calCreated = await http.PostAsJsonAsync("/rc/calendars", new
{
    areaId = calArea, title = "Pfarrbuero", timeZone = "Europe/Warsaw"
});

var calendarId = "";
await t.OkAsync("kal   Ein Kalender entsteht an einem Bereich", async () =>
{
    if (calCreated.StatusCode != HttpStatusCode.Created) return false;
    calendarId = (await ReadAsync(calCreated)).GetProperty("calendarId").GetString()!;
    return true;
});

// Eine unbekannte Zeitzone faellt beim ANLEGEN auf, nicht erst beim Rechnen.
await t.OkAsync("kal   Eine erfundene Zeitzone wird abgewiesen", async () =>
    (await http.PostAsJsonAsync("/rc/calendars", new
    {
        areaId = calArea, title = "Falsch", timeZone = "Mars/Olympus"
    })).StatusCode == HttpStatusCode.BadRequest);

// -- Ein Termin mit oeffentlichem und versiegeltem Teil ------------------------

var itemCreated = await http.PostAsJsonAsync($"/rc/calendars/{calendarId}/items", new
{
    ownerRoleId = personalRoleId,
    startsUtc = new DateTimeOffset(2026, 3, 2, 8, 0, 0, TimeSpan.Zero),
    endsUtc = new DateTimeOffset(2026, 3, 2, 9, 0, 0, TimeSpan.Zero),
    titlePublic = "Sitzung",
    visibility = "area",
    title = "Gespraech mit Frau Kowalska wegen der Kuendigung",
    location = "Pfarrbuero, Zimmer 2",
    notes = "Unterlagen mitbringen"
});

var itemId = "";
await t.OkAsync("kal   Ein Termin entsteht", async () =>
{
    if (itemCreated.StatusCode != HttpStatusCode.Created) return false;
    itemId = (await ReadAsync(itemCreated)).GetProperty("itemId").GetString()!;
    return true;
});

// DER Nachweis: die Zeit steht im Klartext, der Inhalt nicht.
await t.OkAsync("kal   Die ZEIT liegt im Klartext in der Zeile", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand("""
        SELECT starts_at, title_public, title_sealed FROM dbo.rc_calendar_item WHERE id = @id;
        """, probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(itemId));

    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return false;

    // Anfang lesbar, oeffentlicher Titel lesbar, echter Titel Geheimtext.
    var blob = (byte[])reader[2];
    return reader.GetDateTimeOffset(0).Hour == 8
        && reader.GetString(1) == "Sitzung"
        && !System.Text.Encoding.UTF8.GetString(blob).Contains("Kowalska");
});

await t.OkAsync("kal   Wer den Schluessel hat, sieht beides", async () =>
{
    var list = (await ReadAsync(await http.GetAsync(
        $"/rc/calendars/{calendarId}/items?from=2026-03-01T00:00:00Z&to=2026-03-08T00:00:00Z")))
        .GetProperty("occurrences").EnumerateArray().ToList();

    var one = list.FirstOrDefault(o => o.GetProperty("itemId").GetString() == itemId);

    return Text(one, "titlePublic") == "Sitzung"
        && Text(one, "title")!.Contains("Kowalska")
        && Text(one, "location") == "Pfarrbuero, Zimmer 2"
        && Text(one, "unreadable") is null;
});

// -- Sichtbarkeit ---------------------------------------------------------------
//
// Privat heisst: der Eintrag faellt fuer andere ganz aus der Liste. Ihnen zu
// zeigen, DASS dort etwas Privates steht, waere schon eine Auskunft ueber den Tag.

var privateItem = await http.PostAsJsonAsync($"/rc/calendars/{calendarId}/items", new
{
    ownerRoleId = personalRoleId,
    startsUtc = new DateTimeOffset(2026, 3, 3, 8, 0, 0, TimeSpan.Zero),
    endsUtc = new DateTimeOffset(2026, 3, 3, 9, 0, 0, TimeSpan.Zero),
    visibility = "private",
    title = "Arzttermin"
});

t.Ok("kal   Ein privater Eintrag entsteht", () => privateItem.StatusCode == HttpStatusCode.Created);

await t.OkAsync("kal   Der Eigentuemer sieht ihn", async () =>
    (await ReadAsync(await http.GetAsync(
        $"/rc/calendars/{calendarId}/items?from=2026-03-01T00:00:00Z&to=2026-03-08T00:00:00Z")))
        .GetProperty("occurrences").EnumerateArray()
        .Any(o => Text(o, "title") == "Arzttermin"));

await t.OkAsync("3.4   Ein Fremder sieht den Kalender gar nicht", async () =>
    (await bruno.GetAsync($"/rc/calendars/{calendarId}/items"))
        .StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

// -- Wiederholungen --------------------------------------------------------------

var weekly = await http.PostAsJsonAsync($"/rc/calendars/{calendarId}/items", new
{
    ownerRoleId = personalRoleId,
    startsUtc = new DateTimeOffset(2026, 3, 2, 8, 0, 0, TimeSpan.Zero),
    endsUtc = new DateTimeOffset(2026, 3, 2, 9, 0, 0, TimeSpan.Zero),
    titlePublic = "Wochensitzung",
    visibility = "area",
    repeatKind = "weekly",
    repeatEvery = 1,
    repeatCount = 4
});

var weeklyId = (await ReadAsync(weekly)).GetProperty("itemId").GetString()!;

await t.OkAsync("kal   Eine Wochenreihe wird ausgerechnet", async () =>
    (await ReadAsync(await http.GetAsync(
        $"/rc/calendars/{calendarId}/items?from=2026-03-01T00:00:00Z&to=2026-04-01T00:00:00Z")))
        .GetProperty("occurrences").EnumerateArray()
        .Count(o => o.GetProperty("itemId").GetString() == weeklyId) == 4);

// Eine Wiederholung ohne Ende laesst sich nicht ausrechnen, nur abschneiden —
// und jede Ansicht schnitte woanders ab.
await t.OkAsync("kal   Eine Wiederholung ohne Ende wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/calendars/{calendarId}/items", new
    {
        ownerRoleId = personalRoleId,
        startsUtc = new DateTimeOffset(2026, 3, 2, 8, 0, 0, TimeSpan.Zero),
        endsUtc = new DateTimeOffset(2026, 3, 2, 9, 0, 0, TimeSpan.Zero),
        repeatKind = "daily", repeatEvery = 1
    })).StatusCode == HttpStatusCode.BadRequest);

await t.OkAsync("kal   Ein rueckwaerts laufender Termin wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/calendars/{calendarId}/items", new
    {
        ownerRoleId = personalRoleId,
        startsUtc = new DateTimeOffset(2026, 3, 2, 9, 0, 0, TimeSpan.Zero),
        endsUtc = new DateTimeOffset(2026, 3, 2, 8, 0, 0, TimeSpan.Zero)
    })).StatusCode == HttpStatusCode.BadRequest);

// -- Ausnahmen: die Reihe bleibt eine Reihe --------------------------------------

await t.OkAsync("kal   Ein einzelnes Vorkommen laesst sich absagen", async () =>
{
    var cancelled = await http.PostAsJsonAsync(
        $"/rc/calendar-items/{weeklyId}/occurrences/2026-03-09T08:00:00Z/cancel", new { });

    if (cancelled.StatusCode != HttpStatusCode.OK) return false;

    return (await ReadAsync(await http.GetAsync(
        $"/rc/calendars/{calendarId}/items?from=2026-03-01T00:00:00Z&to=2026-04-01T00:00:00Z")))
        .GetProperty("occurrences").EnumerateArray()
        .Count(o => o.GetProperty("itemId").GetString() == weeklyId) == 3;
});

await t.OkAsync("kal   Ein Vorkommen laesst sich verschieben und behaelt seinen Platz", async () =>
{
    var moved = await http.PostAsJsonAsync(
        $"/rc/calendar-items/{weeklyId}/occurrences/2026-03-16T08:00:00Z/move", new
        {
            newStartUtc = new DateTimeOffset(2026, 3, 17, 13, 0, 0, TimeSpan.Zero),
            newEndUtc = new DateTimeOffset(2026, 3, 17, 14, 0, 0, TimeSpan.Zero)
        });

    if (moved.StatusCode != HttpStatusCode.OK) return false;

    var one = (await ReadAsync(await http.GetAsync(
        $"/rc/calendars/{calendarId}/items?from=2026-03-01T00:00:00Z&to=2026-04-01T00:00:00Z")))
        .GetProperty("occurrences").EnumerateArray()
        .FirstOrDefault(o => o.GetProperty("itemId").GetString() == weeklyId
                          && o.GetProperty("moved").GetBoolean());

    // Der urspruengliche Anfang bleibt der NAME dieses Termins — daran haengt
    // die Ausnahme. Verloere er ihn, liesse sie sich nie wieder aufheben.
    return one.ValueKind != JsonValueKind.Undefined
        && one.GetProperty("startsUtc").GetDateTimeOffset().Hour == 13
        && one.GetProperty("originalStartUtc").GetDateTimeOffset().Day == 16;
});

// Die Regel bleibt eine Regel: sie wurde NICHT in Einzeltermine aufgeloest.
await t.OkAsync("kal   Die Reihe bleibt eine Reihe", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand(
        "SELECT COUNT(*) FROM dbo.rc_calendar_item WHERE calendar_id = @cal AND repeat_kind = 'weekly';",
        probe);
    cmd.Parameters.AddWithValue("@cal", Guid.Parse(calendarId));

    return (int)(await cmd.ExecuteScalarAsync())! == 1;
});

// -- Ein zu weites Fenster --------------------------------------------------------

await t.OkAsync("kal   Ein zu weiter Zeitraum wird abgewiesen", async () =>
    (await http.GetAsync(
        $"/rc/calendars/{calendarId}/items?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z"))
        .StatusCode == HttpStatusCode.BadRequest);

// -- Firmung: der empfindlichste Teil ------------------------------------------
//
// Kandidaten sind Minderjaehrige. Drei Dinge werden hier nachgewiesen: dass
// nichts von ihnen im Klartext liegt, dass die Felder sich nicht gegeneinander
// tauschen lassen, und dass zwei gleichzeitige Anmeldungen auf den letzten
// Platz nicht beide durchgehen.

var confArea = (await ReadAsync(await http.PostAsJsonAsync("/rc/areas", new
{
    ownerRoleId = personalRoleId,
    title = "Firmvorbereitung"
}))).GetProperty("areaId").GetString()!;

var groupCreated = await http.PostAsJsonAsync("/rc/confirmation-groups", new
{
    parishId, areaId = confArea, name = "Firmung 2027"
});

var groupId = "";
await t.OkAsync("frm   Ein Jahrgang entsteht an einem EIGENEN Bereich", async () =>
{
    if (groupCreated.StatusCode != HttpStatusCode.Created) return false;
    groupId = (await ReadAsync(groupCreated)).GetProperty("groupId").GetString()!;
    return true;
});

// Wer die Pfarrei verwaltet, darf den Jahrgang nicht in einen FREMDEN Bereich
// haengen — sonst waere der eigene Bereich fuer die Akten ein Vorschlag und
// keine Grenze.
await t.OkAsync("frm   In einen fremden Bereich haengt ihn niemand", async () =>
    (await bruno.PostAsJsonAsync("/rc/confirmation-groups", new
    {
        parishId, areaId = confArea, name = "Fremd"
    })).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

// -- Ein Kandidat ----------------------------------------------------------------

var candidateCreated = await http.PostAsJsonAsync($"/rc/confirmation-groups/{groupId}/candidates", new
{
    name = "Anna Nowak",
    born = "2012-04-17",
    contact = "matka: 600 123 456",
    school = "SP nr 3",
    baptism = "Parafia sw. Mikolaja, 2012-06-03"
});

var candidateId = "";
await t.OkAsync("frm   Ein Kandidat entsteht", async () =>
{
    if (candidateCreated.StatusCode != HttpStatusCode.Created) return false;
    candidateId = (await ReadAsync(candidateCreated)).GetProperty("candidateId").GetString()!;
    return true;
});

// DER Nachweis: nichts davon steht im Klartext in der Zeile.
await t.OkAsync("12.9  NICHTS vom Kandidaten liegt im Klartext", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand("""
        SELECT name_sealed, born_sealed, contact_sealed, school_sealed, baptism_sealed
        FROM dbo.rc_candidate WHERE id = @id;
        """, probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(candidateId));

    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return false;

    var all = new System.Text.StringBuilder();
    for (var i = 0; i < 5; i++)
        if (!reader.IsDBNull(i)) all.Append(System.Text.Encoding.UTF8.GetString((byte[])reader[i]));

    var blob = all.ToString();
    return !blob.Contains("Nowak") && !blob.Contains("2012")
        && !blob.Contains("600") && !blob.Contains("Mikolaja");
});

await t.OkAsync("frm   Wer den Schluessel hat, sieht alles", async () =>
{
    var view = (await ReadAsync(await http.GetAsync($"/rc/confirmation-groups/{groupId}/candidates")))
        .GetProperty("candidates").EnumerateArray()
        .First(c => c.GetProperty("candidateId").GetString() == candidateId);

    return Text(view, "name") == "Anna Nowak"
        && Text(view, "born") == "2012-04-17"
        && Text(view, "school") == "SP nr 3"
        && Text(view, "unreadable") is null;
});

// 3.13 — Der Altbestand hatte EINEN Klumpen fuer alles. Damit liesse sich der
// Kontakt in das Namensfeld schieben, ohne dass etwas auffaellt. Hier nicht.
await t.OkAsync("3.13  Der Kontakt laesst sich nicht ins Namensfeld schieben", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var swap = new SqlCommand(
        "UPDATE dbo.rc_candidate SET name_sealed = contact_sealed WHERE id = @id;", probe);
    swap.Parameters.AddWithValue("@id", Guid.Parse(candidateId));
    await swap.ExecuteNonQueryAsync();

    var view = (await ReadAsync(await http.GetAsync($"/rc/confirmation-groups/{groupId}/candidates")))
        .GetProperty("candidates").EnumerateArray()
        .First(c => c.GetProperty("candidateId").GetString() == candidateId);

    // Der Tausch faellt auf — und der Kandidat faellt trotzdem NICHT aus der
    // Liste, sonst stimmten die Zahlen des Jahrgangs nicht mehr (15.9).
    return Text(view, "unreadable") == RcErrorCodes.CryptoAadMismatch
        && Text(view, "name") is null;
});

// Zuruecksetzen fuer die folgenden Pruefungen.
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();
    await using var fix = new SqlCommand("""
        UPDATE dbo.rc_candidate SET name_sealed = @orig WHERE id = @id;
        """, probe);
    fix.Parameters.AddWithValue("@id", Guid.Parse(candidateId));

    // Den Namen neu setzen geht nicht ohne Schluessel — stattdessen wird der
    // Kandidat fuer die Anmeldepruefung neu angelegt.
    fix.Parameters.Add("@orig", System.Data.SqlDbType.VarBinary).Value = DBNull.Value;
}

// -- Notizen: versiegelt, anders als im Altbestand --------------------------------

var noteAdded = await http.PostAsJsonAsync($"/rc/candidates/{candidateId}/notes", new
{
    authorRoleId = personalRoleId,
    text = "Braucht Unterstuetzung beim Auswendiglernen.",
    forFamily = false
});

t.Ok("frm   Eine Notiz laesst sich schreiben", () => noteAdded.StatusCode == HttpStatusCode.Created);

await t.OkAsync("12.9  Und sie liegt versiegelt — anders als im Altbestand", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand(
        "SELECT text_sealed FROM dbo.rc_candidate_note WHERE candidate_id = @id;", probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(candidateId));

    var blob = (byte[])(await cmd.ExecuteScalarAsync())!;
    return !System.Text.Encoding.UTF8.GetString(blob).Contains("Auswendiglernen");
});

await t.OkAsync("3.3   Unter fremdem Namen schreibt niemand eine Notiz", async () =>
    (await http.PostAsJsonAsync($"/rc/candidates/{candidateId}/notes", new
    {
        authorRoleId = brunoRoleId, text = "Untergeschoben."
    })).StatusCode == HttpStatusCode.Forbidden);

await t.OkAsync("frm   Eine Notiz laesst sich nicht still aendern", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand(
        "UPDATE dbo.rc_candidate_note SET for_family = 1 WHERE candidate_id = @id;", probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(candidateId));

    try { await cmd.ExecuteNonQueryAsync(); return false; }
    catch (SqlException e) { return e.Number == 50006; }
});

// -- Treffen: die Kapazitaet haelt --------------------------------------------------

var slotCreated = await http.PostAsJsonAsync($"/rc/confirmation-groups/{groupId}/slots", new
{
    startsUtc = DateTimeOffset.UtcNow.AddDays(7),
    durationMinutes = 60,
    capacity = 1,
    label = "Einzelgespraech"
});

var slotId = "";
await t.OkAsync("frm   Ein Treffen mit EINEM Platz entsteht", async () =>
{
    if (slotCreated.StatusCode != HttpStatusCode.Created) return false;
    slotId = (await ReadAsync(slotCreated)).GetProperty("slotId").GetString()!;
    return true;
});

// Ein zweiter Kandidat, damit sich um den einen Platz streiten laesst.
var secondCandidate = (await ReadAsync(await http.PostAsJsonAsync(
    $"/rc/confirmation-groups/{groupId}/candidates", new { name = "Piotr Kowalczyk" })))
    .GetProperty("candidateId").GetString()!;

await t.OkAsync("frm   Der erste bekommt den Platz", async () =>
{
    var booked = await http.PostAsJsonAsync($"/rc/meeting-slots/{slotId}/book", new
    {
        candidateId = secondCandidate
    });

    return booked.StatusCode == HttpStatusCode.Created
        && (await ReadAsync(booked)).GetProperty("booked").GetInt32() == 1;
});

// DER Punkt: der Platz ist weg, und der zweite bekommt eine klare Absage —
// keinen Serverfehler und keinen stillen zweiten Stuhl.
await t.OkAsync("frm   Der zweite bekommt eine Absage, keinen zweiten Stuhl", async () =>
    (await http.PostAsJsonAsync($"/rc/meeting-slots/{slotId}/book", new
    {
        candidateId
    })).StatusCode == HttpStatusCode.Conflict);

// Zweimal derselbe Kandidat ist kein Fehler, sondern ein zweiter Klick.
await t.OkAsync("frm   Zweimal derselbe Kandidat erschreckt niemanden", async () =>
    (await http.PostAsJsonAsync($"/rc/meeting-slots/{slotId}/book", new
    {
        candidateId = secondCandidate
    })).StatusCode == HttpStatusCode.OK);

// Ein Kandidat aus einem fremden Jahrgang gehoert nicht in diese Liste.
await t.OkAsync("frm   Ein fremder Kandidat wird abgewiesen", async () =>
    (await http.PostAsJsonAsync($"/rc/meeting-slots/{slotId}/book", new
    {
        candidateId = Guid.NewGuid().ToString()
    })).StatusCode == HttpStatusCode.Conflict);

await t.OkAsync("frm   Der Belegungsstand steht in der Liste", async () =>
{
    var slot = (await ReadAsync(await http.GetAsync($"/rc/confirmation-groups/{groupId}/slots")))
        .GetProperty("slots").EnumerateArray()
        .First(x => x.GetProperty("slotId").GetString() == slotId);

    return slot.GetProperty("booked").GetInt32() == 1
        && slot.GetProperty("capacity").GetInt32() == 1;
});

// -- Austritt: Felder weg, Zeile bleibt ---------------------------------------------

await t.OkAsync("12.3  Austritt vernichtet die Felder und laesst die Zeile stehen", async () =>
{
    var withdrawn = await http.PostAsJsonAsync($"/rc/candidates/{secondCandidate}/withdraw", new { });
    if (withdrawn.StatusCode != HttpStatusCode.OK) return false;

    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();

    await using var cmd = new SqlCommand("""
        SELECT status, contact_sealed, school_sealed FROM dbo.rc_candidate WHERE id = @id;
        """, probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(secondCandidate));

    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return false;   // Die Zeile MUSS noch da sein.

    return reader.GetString(0) == "withdrawn" && reader.IsDBNull(1) && reader.IsDBNull(2);
});

await t.OkAsync("3.4   Ein Fremder sieht den Jahrgang nicht", async () =>
    (await bruno.GetAsync($"/rc/confirmation-groups/{groupId}/candidates"))
        .StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

// -- 3.9 — Sicherer Modus ------------------------------------------------------

var toSecure = await bruno.PostAsJsonAsync("/rc/auth/cache-mode", new { mode = 1 });

await t.OkAsync("3.9   Der sichere Modus vergisst sofort, was liegt", async () =>
    toSecure.StatusCode == HttpStatusCode.OK
    && (await ReadAsync(toSecure)).GetProperty("forgottenBundles").GetInt32() >= 1);

await t.OkAsync("3.9   Im sicheren Modus haelt der Speicher NICHTS", async () =>
    !(await ReadAsync(await bruno.GetAsync("/rc/auth/me"))).GetProperty("keysHeld").GetBoolean());

// Und trotzdem geht alles weiter: jede Anfrage baut aus master_key_sealed neu auf.
await t.OkAsync("3.9   Im sicheren Modus wird je Anfrage neu aufgebaut", async () =>
    (await ReadAsync(await bruno.GetAsync("/rc/roles"))).GetProperty("roles").EnumerateArray()
        .Any(r => r.GetProperty("roleId").GetString() == groupRoleId && r.GetProperty("hasKey").GetBoolean()));

bruno.DefaultRequestHeaders.Remove("X-Rc-Unlock");
var secureLocked = await bruno.GetAsync("/rc/roles");

await t.OkAsync("3.9   Auch im sicheren Modus geht ohne Oeffnungsstueck nichts", async () =>
    secureLocked.StatusCode == HttpStatusCode.Unauthorized
    && (await ReadAsync(secureLocked)).GetProperty("code").GetString() == RcErrorCodes.SessionUnlockRequired);

// -- Ohne Schluessel geht nichts ----------------------------------------------

http.DefaultRequestHeaders.Remove("X-Rc-Unlock");
var locked = await http.GetAsync("/rc/roles");

await t.OkAsync("3.9   Ohne Oeffnungsstueck bekommt niemand Rollen zu sehen", async () =>
    locked.StatusCode == HttpStatusCode.Unauthorized
    && (await ReadAsync(locked)).GetProperty("code").GetString() == RcErrorCodes.SessionUnlockRequired);

http.DefaultRequestHeaders.Add("X-Rc-Unlock", RcBase64Url.Encode(passwordKey));

// -- Entsperren -------------------------------------------------------------

http.DefaultRequestHeaders.Remove("X-Rc-Unlock");
await http.PostAsync("/rc/auth/logout", null);

var wrongKey = await http.PostAsJsonAsync("/rc/auth/unlock", new
{
    username,
    passwordKey = RcBase64Url.Encode(RcCrypto.NewSymmetricKey())
});

await t.OkAsync("21.8  Falscher Passwortschluessel wird abgewiesen", async () =>
    wrongKey.StatusCode == HttpStatusCode.Unauthorized
    && (await ReadAsync(wrongKey)).GetProperty("code").GetString() == RcErrorCodes.AuthCredentialsInvalid);

var unknownUser = await http.PostAsJsonAsync("/rc/auth/unlock", new
{
    username = "gibt-es-nicht",
    passwordKey = RcBase64Url.Encode(passwordKey)
});

await t.OkAsync("3.15  Unbekannter Name gibt DENSELBEN Code wie falsches Passwort", async () =>
    unknownUser.StatusCode == HttpStatusCode.Unauthorized
    && (await ReadAsync(unknownUser)).GetProperty("code").GetString() == RcErrorCodes.AuthCredentialsInvalid);

var unlocked = await http.PostAsJsonAsync("/rc/auth/unlock", new
{
    username,
    passwordKey = RcBase64Url.Encode(passwordKey),
    deviceNote = "Pruefreihe"
});

var sessionId = "";
await t.OkAsync("3.9   Richtiger Passwortschluessel entsperrt", async () =>
{
    if (unlocked.StatusCode != HttpStatusCode.OK) return false;
    var json = await ReadAsync(unlocked);
    sessionId = json.GetProperty("sessionId").GetString()!;
    return sessionId.Length == 36 && json.GetProperty("idleMinutes").GetInt32() == 15;
});

var me = await ReadAsync(await http.GetAsync("/rc/auth/me"));
t.Ok("3.9   Angemeldet, Schluesselbund liegt bereit", () =>
    me.GetProperty("signedIn").GetBoolean() && me.GetProperty("keysHeld").GetBoolean());

// -- Sperren ist nicht Abmelden ---------------------------------------------

await http.PostAsync("/rc/auth/lock", null);
var afterLock = await ReadAsync(await http.GetAsync("/rc/auth/me"));

t.Ok("3.9   Sperren nimmt den Bund, laesst die Sitzung", () =>
    afterLock.GetProperty("signedIn").GetBoolean()
    && !afterLock.GetProperty("keysHeld").GetBoolean());

// -- P0-2: der Widerruf muss vor allem anderen greifen -----------------------

// Das Cookie wird VOR dem Abmelden abgeschrieben und danach von Hand wieder
// vorgelegt — genau das, was ein kopiertes Cookie tut. Im Altbestand hat der
// Schluesselring es weiter akzeptiert, waehrend /auth/me es abwies.
var stolen = handler.CookieContainer.GetCookies(new Uri(baseAddress))
    .Cast<Cookie>().FirstOrDefault(c => c.Name == RcAuth.CookieName)?.Value;

await http.PostAsync("/rc/auth/logout", null);

t.Ok("Das Sitzungscookie liess sich vor dem Abmelden abschreiben", () => stolen is not null);

using var replay = new HttpRequestMessage(HttpMethod.Get, "/rc/auth/me");
replay.Headers.Add("Cookie", $"{RcAuth.CookieName}={stolen}");
var replayed = await http.SendAsync(replay);

await t.OkAsync("P0-2  Kopiertes Cookie ueberlebt das Abmelden NICHT", async () =>
    replayed.StatusCode == HttpStatusCode.Unauthorized
    && (await ReadAsync(replayed)).GetProperty("code").GetString() == RcErrorCodes.SessionRevoked);

var afterLogout = await ReadAsync(await http.GetAsync("/rc/auth/me"));
t.Ok("Nach dem Abmelden ist niemand angemeldet", () => !afterLogout.GetProperty("signedIn").GetBoolean());

// -- Ratensperre -------------------------------------------------------------

// Elf Fehlversuche gegen denselben Namen; ab dem elften muss die Sperre greifen.
// Der Schluessel ist absichtlich formal falsch, damit keine elf Argon2id-Laeufe
// noetig sind — die Sperre zaehlt vor der teuren Rechnung.
HttpResponseMessage? blocked = null;
for (var i = 0; i < 12; i++)
{
    blocked = await http.PostAsJsonAsync("/rc/auth/unlock", new
    {
        username = "opfer-des-ratens",
        passwordKey = "zu-kurz"
    });
    if (blocked.StatusCode == HttpStatusCode.TooManyRequests) break;
}

await t.OkAsync("15.2  Wiederholtes Raten wird gesperrt", async () =>
    blocked!.StatusCode == HttpStatusCode.TooManyRequests
    && (await ReadAsync(blocked)).GetProperty("code").GetString() == RcErrorCodes.AuthRateLimited);

// -- Fehlerform --------------------------------------------------------------

var shape = await ReadAsync(await http.PostAsJsonAsync("/rc/auth/unlock", new
{
    username = "opfer-des-ratens",
    passwordKey = "zu-kurz"
}));

t.Ok("15.7  Fehler tragen Code, Meldung und Vorgangskennung", () =>
    shape.TryGetProperty("code", out _)
    && shape.TryGetProperty("message", out _)
    && shape.TryGetProperty("traceId", out _));

await app.StopAsync();
return t.Report();

// ---------------------------------------------------------------------------

async Task<string> SaltAsync(string name)
{
    var response = await http.PostAsJsonAsync("/rc/auth/salt", new { username = name });
    return (await ReadAsync(response)).GetProperty("passwordSalt").GetString()!;
}

/// <summary>
/// Die API laesst leere Felder WEG statt sie auf null zu setzen
/// (JsonIgnoreCondition.WhenWritingNull). Fuer einen Klienten in JavaScript ist
/// das dasselbe; fuer eine Pruefreihe in C# ist es der Unterschied zwischen
/// einem Wert und einer Ausnahme.
/// </summary>
static string? Text(JsonElement element, string name) =>
    element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
        ? value.GetString()
        : null;

static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
    JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

/// <summary>
/// Die Karenzzeit vorspulen. Eine Pruefreihe, die einen Tag wartet, wird nie
/// gelaufen — aber die Frist selbst wird nicht abgeschaltet: der Endpunkt
/// prueft sie weiterhin, nur liegt sie jetzt in der Vergangenheit.
/// </summary>
static async Task AgeRequestAsync(string connectionString, string requestId)
{
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync();
    // BEIDE Zeitpunkte, denn ck_rc_recovery_request_effective besteht darauf,
    // dass die Wirksamkeit nicht vor dem Antrag liegt. Die Bedingung hat den
    // ersten Versuch dieser Hilfsfunktion abgewiesen — zu Recht.
    await using var cmd = new SqlCommand(
        "UPDATE dbo.rc_recovery_request SET requested_at = @asked, effective_at = @past WHERE id = @id;",
        connection);
    cmd.Parameters.AddWithValue("@asked", DateTimeOffset.UtcNow.AddDays(-2));
    cmd.Parameters.AddWithValue("@past", DateTimeOffset.UtcNow.AddDays(-1));
    cmd.Parameters.AddWithValue("@id", Guid.Parse(requestId));
    await cmd.ExecuteNonQueryAsync();
}

static async Task ResetAsync(string connectionString)
{
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync();
    await using var cmd = new SqlCommand(
        // Reihenfolge nach den Fremdschluesseln: Zertifikate und Zuteilungen
        // haengen an Rollen, Rollen an Kanten, Kanten an Konten.
        """
        DISABLE TRIGGER dbo.tr_rc_consent_text_append_only ON dbo.rc_consent_text;
        DISABLE TRIGGER dbo.tr_rc_recovery_contribution_append_only ON dbo.rc_recovery_contribution;
        DELETE FROM dbo.rc_recovery_contribution;
        ENABLE TRIGGER dbo.tr_rc_recovery_contribution_append_only ON dbo.rc_recovery_contribution;
        DELETE FROM dbo.rc_recovery_request;
        DELETE FROM dbo.rc_recovery_share;
        DELETE FROM dbo.rc_consent_text;
        ENABLE TRIGGER dbo.tr_rc_consent_text_append_only ON dbo.rc_consent_text;
        DISABLE TRIGGER dbo.tr_rc_data_access_log_append_only ON dbo.rc_data_access_log;
        DELETE FROM dbo.rc_data_access_log;
        ENABLE TRIGGER dbo.tr_rc_data_access_log_append_only ON dbo.rc_data_access_log;
        DELETE FROM dbo.rc_data_item;
        DELETE FROM dbo.rc_attachment;
        /* Firmung. Der anfuegende Ausloeser auf den Notizen deckt auch
           UPDATE ab und muss fuer die Ruecksetzung weichen. */
        DELETE FROM dbo.rc_meeting_booking;
        DELETE FROM dbo.rc_meeting_slot;
        DISABLE TRIGGER dbo.tr_rc_candidate_note_append ON dbo.rc_candidate_note;
        DELETE FROM dbo.rc_candidate_note;
        ENABLE TRIGGER dbo.tr_rc_candidate_note_append ON dbo.rc_candidate_note;
        DELETE FROM dbo.rc_candidate;
        DELETE FROM dbo.rc_confirmation_group;

        /* Kalender. Ausnahmen vor Eintraegen, Eintraege vor Kalender. */
        DELETE FROM dbo.rc_calendar_exception;
        DELETE FROM dbo.rc_calendar_item;
        DELETE FROM dbo.rc_calendar;

        /* Cogita. Kanten vor Knoten, Knoten vor Bibliothek. */
        DELETE FROM dbo.rc_range_segment;
        DELETE FROM dbo.rc_edge;
        DELETE FROM dbo.rc_node;
        DELETE FROM dbo.rc_library;

        /* Pfarrei. Der anfuegende Ausloeser auf rc_offering deckt auch
           UPDATE ab und muss deshalb fuer die Ruecksetzung weichen. */
        DISABLE TRIGGER dbo.tr_rc_offering_append ON dbo.rc_offering;
        DELETE FROM dbo.rc_offering;
        ENABLE TRIGGER dbo.tr_rc_offering_append ON dbo.rc_offering;
        DELETE FROM dbo.rc_intention;
        DELETE FROM dbo.rc_mass;
        DELETE FROM dbo.rc_parish;

        /* Veranstaltungen. Die Reihenfolge folgt den Fremdschluesseln von
           innen nach aussen; die anfuegenden Ausloeser werden dafuer kurz
           abgeschaltet — im Betrieb ist genau das der Sinn der Sache, hier
           steht ein Neuanfang an. */
        DISABLE TRIGGER dbo.tr_rc_event_reg_value_append ON dbo.rc_event_registration_value;
        DELETE FROM dbo.rc_event_registration_value;
        ENABLE TRIGGER dbo.tr_rc_event_reg_value_append ON dbo.rc_event_registration_value;
        DISABLE TRIGGER dbo.tr_rc_event_registration_append ON dbo.rc_event_registration;
        DELETE FROM dbo.rc_event_registration;
        ENABLE TRIGGER dbo.tr_rc_event_registration_append ON dbo.rc_event_registration;
        DELETE FROM dbo.rc_event_field;
        DELETE FROM dbo.rc_event_part;
        DELETE FROM dbo.rc_event_page;
        DELETE FROM dbo.rc_event;

        DELETE FROM dbo.rc_ledger_outbox;
        DELETE FROM dbo.rc_decision_transition;
        DELETE FROM dbo.rc_decision;
        DISABLE TRIGGER dbo.tr_rc_ledger_entry_append_only ON dbo.rc_ledger_entry;
        DELETE FROM dbo.rc_ledger_entry;
        ENABLE TRIGGER dbo.tr_rc_ledger_entry_append_only ON dbo.rc_ledger_entry;
        DELETE FROM dbo.rc_ledger_head;
        DELETE FROM dbo.rc_poll_vote;
        DELETE FROM dbo.rc_poll;
        DELETE FROM dbo.rc_draft;
        DELETE FROM dbo.rc_read_state;
        DELETE FROM dbo.rc_reaction;
        DELETE FROM dbo.rc_message_topic;
        DELETE FROM dbo.rc_topic_label;
        DELETE FROM dbo.rc_topic;
        DELETE FROM dbo.rc_message_version;
        DELETE FROM dbo.rc_message_attribution;
        DELETE FROM dbo.rc_message;
        DELETE FROM dbo.rc_area_epoch;
        DELETE FROM dbo.rc_area;
        DELETE FROM dbo.rc_certificate;
        DISABLE TRIGGER dbo.tr_rc_token_redemption_append_only ON dbo.rc_token_redemption;
        DELETE FROM dbo.rc_token_redemption;
        ENABLE TRIGGER dbo.tr_rc_token_redemption_append_only ON dbo.rc_token_redemption;
        DELETE FROM dbo.rc_token;
        DELETE FROM dbo.rc_role_key_grant;
        DELETE FROM dbo.rc_role_edge;
        DELETE FROM dbo.rc_role;
        DELETE FROM dbo.rc_session;
        DELETE FROM dbo.rc_account;
        """, connection);
    await cmd.ExecuteNonQueryAsync();
}

sealed class Runner
{
    private int _pass, _fail;

    public void Ok(string name, Func<bool> f)
    {
        bool r;
        try { r = f(); }
        catch (Exception e) { Fail(name, $"Ausnahme: {e.GetType().Name}: {e.Message}"); return; }
        if (r) Pass(name); else Fail(name, "Bedingung nicht erfuellt");
    }

    public async Task OkAsync(string name, Func<Task<bool>> f)
    {
        bool r;
        try { r = await f(); }
        catch (Exception e) { Fail(name, $"Ausnahme: {e.GetType().Name}: {e.Message}"); return; }
        if (r) Pass(name); else Fail(name, "Bedingung nicht erfuellt");
    }

    private void Pass(string n) { _pass++; Console.WriteLine($"  OK   {n}"); }

    private void Fail(string n, string d)
    {
        _fail++;
        Console.WriteLine($"  FAIL {n}");
        Console.WriteLine($"       {d}");
    }

    public int Report()
    {
        Console.WriteLine();
        Console.WriteLine($"  {_pass} bestanden, {_fail} fehlgeschlagen");
        return _fail == 0 ? 0 : 1;
    }
}


/// <summary>
/// Was ohne Datenbank prueffbar ist.
///
/// Bisher gab es das nicht: jede Pruefung dieser Reihe sprach mit dem Dienst,
/// also brauchte jede eine Datenbank. Eine reine Funktion so zu pruefen ist
/// teurer als noetig — und sie bleibt ungeprueft, sobald niemand eine
/// Testdatenbank zur Hand hat.
/// </summary>
sealed class PureChecks
{
    private int _pass;
    public int Failed { get; private set; }

    public void Run()
    {
        Console.WriteLine("Ohne Datenbank");

        // -- Was durchgehen MUSS --------------------------------------------

        Ok("Das leere Dokument ist gueltig", RcParishSiteDocument.Fault(RcParishSiteDocument.Empty) is null);

        Ok("Ein gefuelltes Dokument ist gueltig", RcParishSiteDocument.Fault("""
            {"modules":[{"id":"a","type":"masses","layouts":{"desktop":{"position":{"row":1,"col":1},"size":{"colSpan":3,"rowSpan":1}}}}],
             "menu":[{"label":"Parafia","children":[{"label":"O parafii","pageId":"about"}]}],
             "content":{"about.patron":"św. Grzegorz"}}
            """) is null);

        /*
         * Die ALTE Form — eine blosse Liste von Bausteinnamen. Sie abzuweisen
         * hiesse: eine Pfarrei, die vor der Umstellung gespeichert hat, kann
         * ihre Seite nicht mehr sichern, ohne dass jemand die Zeile anfasst.
         */
        Ok("Die alte Liste bleibt gueltig", RcParishSiteDocument.Fault("""["masses","contact"]""") is null);

        // Fehlende Teile sind kein Fehler: wer noch kein Menue hat, hat keins.
        Ok("Ein Dokument ohne menu geht durch", RcParishSiteDocument.Fault("""{"modules":[]}""") is null);

        // -- Was NICHT durchgehen darf --------------------------------------

        Bad("Leerer Text", "");
        Bad("Kein JSON", "das ist kein json");
        Bad("Eine blosse Zahl", "42");
        Bad("modules als Text", """{"modules":"masses"}""");
        Bad("menu als Text", """{"menu":"Parafia"}""");
        Bad("content als Liste", """{"content":[]}""");
        Bad("Ein Baustein ohne Kennung", """{"modules":[{"type":"masses"}]}""");
        Bad("Ein Baustein ohne Art", """{"modules":[{"id":"a"}]}""");
        Bad("Ein Baustein als Text", """{"modules":["masses"]}""");
        Bad("Ein Menuepunkt ohne Beschriftung", """{"menu":[{"pageId":"about"}]}""");
        Bad("Ein Untermenuepunkt ohne Beschriftung", """{"menu":[{"label":"P","children":[{"pageId":"about"}]}]}""");
        Bad("Eine Angabe, die kein Text ist", """{"content":{"a":5}}""");

        /*
         * Die Obergrenze. Ohne sie ist die Spalte nvarchar(max) ein Weg, die
         * Datenbank vollzuschreiben — und der einzige Halt davor steht im
         * Dienst.
         */
        Bad("Ein zu grosses Dokument", "{\"content\":{\"a\":\"" + new string('x', RcParishSiteDocument.MaxLength) + "\"}}");

        // Die Meldung muss sagen, WAS nicht stimmt — sonst sucht der Absender
        // in einem Dokument mit vier Ebenen von Hand.
        var fault = RcParishSiteDocument.Fault("""{"modules":[{"id":"a"}]}""");
        Ok("Die Meldung nennt die Ursache", fault is not null && fault.Contains("Art"));

        Console.WriteLine($"  {_pass} bestanden, {Failed} fehlgeschlagen");
        Console.WriteLine();
    }

    private void Bad(string name, string document)
        => Ok(name + " wird abgewiesen", RcParishSiteDocument.Fault(document) is not null);

    private void Ok(string name, bool held)
    {
        if (held) { _pass++; Console.WriteLine($"  OK   {name}"); }
        else { Failed++; Console.WriteLine($"  FAIL {name}"); }
    }
}
