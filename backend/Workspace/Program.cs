/*
 * Der Dienst des Arbeitsplatzes — der erste Stein des Neubaus.
 *
 * =========================================================================
 * WAS HIER STEHT
 * =========================================================================
 *
 * Anmelden, abmelden, „wer ist hier". Mehr nicht, und das ist die richtige
 * Reihenfolge: an der Anmeldung haengt, was der Browser VOR dem ersten Bild
 * tut, und sie nachtraeglich einzuziehen macht aus einer Grenze eine Pruefung
 * an der Oberflaeche.
 *
 * Gerechnet wird im Kernel (`Rc.Kernel`) und nicht hier. Genau deshalb ist er
 * beim Umbau geblieben: Argon2id, Versiegelung, Tokens und kanonische Form
 * sind durch 81 Faelle geprueft, und eine zweite, frisch getippte Kryptografie
 * ist die Stelle, an der lautlose Fehler entstehen.
 *
 * =========================================================================
 * ZWEI BETRIEBSARTEN
 * =========================================================================
 *
 *   dotnet run --project backend/Workspace -- migrate [--dry-run]
 *   dotnet run --project backend/Workspace
 *
 * Der Migrationslauf ist ein PROGRAMM und kein Skript — die Begruendung steht
 * in `Migrate.cs`. Er laeuft ausdruecklich, nicht beim Start: ein Dienst, der
 * beim Hochfahren wandert, wandert auch dann, wenn gerade jemand anderes
 * wandert.
 */

using Workspace;

var builder = WebApplication.CreateBuilder(args);

// -- Der Migrationslauf -----------------------------------------------------

if (args.Length > 0 && args[0].Equals("migrate", StringComparison.OrdinalIgnoreCase))
{
    var dryRun = args.Contains("--dry-run", StringComparer.OrdinalIgnoreCase);
    return await Migrate.RunAsync(Db.Resolve(builder.Configuration), dryRun);
}

// -- Der Dienst -------------------------------------------------------------

builder.Services.AddSingleton<Db>();

/*
 * Der Browser liegt auf einer anderen Herkunft als der Dienst, und die Sitzung
 * reist im Keks. Ohne `AllowCredentials` schickt der Browser ihn nicht mit —
 * und ohne die ausdrueckliche Herkunftsliste laesst er `AllowCredentials`
 * nicht zu. Beides gehoert zusammen; eines allein ist eine Einstellung, die
 * nichts bewirkt.
 */
const string BrowserOrigins = "workspace-browser";

builder.Services.AddCors(options =>
    options.AddPolicy(BrowserOrigins, policy =>
    {
        var origins = (builder.Configuration["Workspace:Origins"] ?? "https://recreatio.pl")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

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
 * geoeffnet.
 */
app.MapGet("/health", () =>
{
    var key = Rc.Kernel.RcCrypto.NewSymmetricKey();
    try
    {
        var aad = Rc.Kernel.RcAad.Create(
            "workspace", "health", Rc.Kernel.RcId.NewId(), Rc.Kernel.RcField.AccountMasterKey, 1);

        var wrapped = Rc.Kernel.RcCrypto.Seal(key, aad, "rc"u8.ToArray());
        var opened = Rc.Kernel.RcCrypto.Open(key, aad, wrapped);

        return Results.Ok(new { ok = opened.Length == 2, kernel = "rc", build = "workspace" });
    }
    finally
    {
        System.Security.Cryptography.CryptographicOperations.ZeroMemory(key);
    }
});

Auth.Map(app);

app.Run();
return 0;
