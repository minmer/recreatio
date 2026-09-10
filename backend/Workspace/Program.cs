/*
 * Der Dienst des Arbeitsplatzes — der erste Stein des Neubaus.
 *
 * =========================================================================
 * WAS HIER STEHT UND WAS NICHT
 * =========================================================================
 *
 * Es steht: die Adresse, unter der der Browser fragt, wer hier ist, und die
 * Bereitschaftsauskunft. Es steht NICHT: eine Datenbank, ein Schema, eine
 * Anmeldung. Das ist Absicht und keine Baustelle, die man vergessen hat.
 *
 * Die Datenbank des Neubaus wird neu geschnitten — neue Benennung, neue
 * Struktur, entlang der Aufteilung, die feststeht: die SEITE zeigt, der
 * ARBEITSPLATZ haelt, und der Arbeitsplatz hat drei Schichten (oeffentlich,
 * persoenlich, Gruppe). Ein Schema, das VOR dieser Entscheidung entsteht,
 * ist ein Schema, das man gegen sie wieder aufbricht.
 *
 * =========================================================================
 * WARUM DIE SITZUNGSABFRAGE TROTZDEM SCHON DASTEHT
 * =========================================================================
 *
 * Weil an ihr haengt, was der Browser VOR dem ersten Bild tut. `#/workspace`
 * ist mit `needsIdentity` markiert: die Oberflaeche fragt, bevor sie malt.
 * Faellt diese Adresse weg, malt sie erst eine leere Halle und schiebt danach
 * die Anmeldung davor — ein Aufblitzen, das aussieht wie ein Fehler.
 *
 * Sie antwortet heute ehrlich mit 401. Nicht mit einer erfundenen Sitzung:
 * eine Oberflaeche, die ohne Konten so tut, als waere jemand angemeldet,
 * zeigt leere Listen, und leere Listen sehen aus wie Datenverlust.
 */

using Rc.Kernel;

var builder = WebApplication.CreateBuilder(args);

/*
 * Der Browser liegt auf einer anderen Herkunft als der Dienst
 * (recreatio.pl gegen den API-Rechner), und die Sitzung reist im Keks. Ohne
 * `AllowCredentials` schickt der Browser ihn nicht mit — und ohne die
 * ausdrueckliche Herkunftsliste laesst er `AllowCredentials` nicht zu. Beides
 * gehoert zusammen; eines allein ist eine Einstellung, die nichts bewirkt.
 */
const string BrowserOrigins = "workspace-browser";

builder.Services.AddCors(options =>
    options.AddPolicy(BrowserOrigins, policy =>
    {
        var origins = builder.Configuration["Workspace:Origins"]?
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            ?? [];

        if (origins.Length == 0) return;

        policy.WithOrigins(origins)
              .AllowCredentials()
              .AllowAnyHeader()
              .AllowAnyMethod();
    }));

var app = builder.Build();

app.UseCors(BrowserOrigins);

/*
 * Lebt der Dienst — und rechnet er richtig?
 *
 * Die zweite Haelfte ist die wichtigere. Ein Dienst, der antwortet, aber
 * anders versiegelt als der Browser, erzeugt Daten, die niemand mehr oeffnet,
 * und zwar lautlos. Deshalb wird hier eine Huelle gebildet und gleich wieder
 * geoeffnet: geht das schief, ist der Dienst nicht bereit, auch wenn er steht.
 */
app.MapGet("/health", () =>
{
    var key = RcCrypto.NewSymmetricKey();
    try
    {
        var aad = RcAad.Create("workspace", "health", RcId.NewId(), RcField.AccountMasterKey, 1);
        var sealed_ = RcCrypto.Seal(key, aad, "rc"u8.ToArray());
        var opened = RcCrypto.Open(key, aad, sealed_);

        return Results.Ok(new
        {
            ok = opened.Length == 2,
            kernel = "rc",
            build = "workspace"
        });
    }
    finally
    {
        System.Security.Cryptography.CryptographicOperations.ZeroMemory(key);
    }
});

/*
 * Wer hier ist.
 *
 * 401, solange es keine Konten gibt — und das ist die richtige Antwort, nicht
 * ein Platzhalter. Der Browser liest daraus „niemand" und zeigt die
 * Anmeldeseite; er muss dafuer nichts ueber den Bauzustand wissen.
 */
app.MapGet("/session", () => Results.Unauthorized());

app.Run();
