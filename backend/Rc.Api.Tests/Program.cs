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

var connectionString = args.FirstOrDefault(a => !a.StartsWith("--"))
                    ?? Environment.GetEnvironmentVariable("RC_TEST_CONNECTION");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Keine Verbindungszeichenfolge. Argument oder RC_TEST_CONNECTION.");
    return 2;
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
await t.OkAsync("7.4   Der Bereich nennt seine Kette", async () =>
{
    await using var probe = new SqlConnection(connectionString);
    await probe.OpenAsync();
    await using var cmd = new SqlCommand("SELECT ledger_id FROM dbo.rc_area WHERE id = @id;", probe);
    cmd.Parameters.AddWithValue("@id", Guid.Parse(areaId));
    ledgerId = ((Guid)(await cmd.ExecuteScalarAsync())!).ToString();
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
