using Rc.Api;
using Recreatio.Api.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRecreatioApi(builder.Configuration, builder.Environment);

// Die neue Plattform laeuft NEBEN dem Altbestand (Spezifikation 2.1): eigener
// Pfad /rc, eigenes Anmeldeverfahren, eigene Tabellen. Dieselbe Datenbank:
// getrennt wird ueber das Praefix rc_, das JEDE Tabelle des Neuaufbaus traegt
// und KEINE des Altbestands. Keine geteilten Tabellen, keine Zwischenschicht,
// die beide bedient.
//
// Derselbe Prozess ist ausdruecklich erlaubt — 2.1 verbietet geteilte Daten,
// nicht geteilten Arbeitsspeicher. Der Wirt kennt beide Seiten; das ist
// Zusammensetzung, nicht Vermischung.
//
// Bewusst NICHT aufgerufen: AssertRcReadyAsync. Die Bereitschaftspruefung des
// Neuaufbaus darf den Altbestand nicht am Starten hindern, solange die neue
// Datenbank noch nicht ueberall eingerichtet ist. Sie laeuft ueber /rc/health
// und wird scharf geschaltet, sobald der Neuaufbau allein steht.
builder.Services.AddRcPlatform(builder.Configuration);

var app = builder.Build();
app.UseRecreatioPipeline();
app.UseRcPlatform();
app.Run();
