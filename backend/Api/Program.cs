/*
 * Der Dienst.
 *
 *   dotnet run --project backend/Api -- migrate [--dry-run]
 *   dotnet run --project backend/Api
 *
 * Der Migrationslauf läuft ausdrücklich, nicht beim Start: ein Dienst, der beim
 * Hochfahren wandert, wandert auch dann, wenn gerade jemand anderes wandert.
 *
 * Gerechnet wird im Kernel. Eine zweite, frisch getippte Kryptografie ist die
 * Stelle, an der lautlose Fehler entstehen.
 */

using Api;

var builder = WebApplication.CreateBuilder(args);

if (args.Length > 0 && args[0].Equals("migrate", StringComparison.OrdinalIgnoreCase))
{
    var dryRun = args.Contains("--dry-run", StringComparer.OrdinalIgnoreCase);

    // Der Altbestand faellt nur auf ausdrueckliche Ansage. Siehe
    // Sql/0000_drop_legacy.sql — es gibt keinen Weg zurueck.
    var dropLegacy = args.Contains("--drop-legacy", StringComparer.OrdinalIgnoreCase);

    return await Migrate.RunAsync(Db.Resolve(builder.Configuration), dryRun, dropLegacy);
}

/*
 * Das Adressregister wird am Server gefüllt, nicht aus der Oberfläche: ein
 * Eintrag IST die Erlaubnis, eine Adresse zu übernehmen.
 *
 *   dotnet run --project backend/Api -- slug add <pfad> ["wofuer"]
 *   dotnet run --project backend/Api -- slug list
 */
if (args.Length > 0 && args[0].Equals("slug", StringComparison.OrdinalIgnoreCase))
{
    return await Slug.AdminAsync(Db.Resolve(builder.Configuration), args);
}

builder.Services.AddSingleton<Db>();

/*
 * Browser und Dienst liegen auf verschiedenen Herkünften, und die Sitzung reist
 * im Keks. Ohne `AllowCredentials` schickt der Browser ihn nicht mit — und ohne
 * die ausdrückliche Herkunftsliste lässt er `AllowCredentials` nicht zu.
 */
const string BrowserOrigins = "browser";

builder.Services.AddCors(options =>
    options.AddPolicy(BrowserOrigins, policy =>
    {
        var origins = (builder.Configuration["Api:Origins"] ?? "https://recreatio.pl")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        policy.WithOrigins(origins).AllowCredentials().AllowAnyHeader().AllowAnyMethod();
    }));

var app = builder.Build();

app.UseCors(BrowserOrigins);

/*
 * Lebt der Dienst — und rechnet er richtig? Die zweite Hälfte ist die
 * wichtigere: einer, der antwortet, aber anders versiegelt als der Browser,
 * erzeugt lautlos Daten, die niemand mehr öffnet.
 */
app.MapGet("/health", () =>
{
    var key = Kernel.Crypto.NewSymmetricKey();
    try
    {
        var aad = Kernel.Aad.Create("api", "health", Kernel.Ids.NewId(), Kernel.Field.AccountMasterKey, 1);
        var opened = Kernel.Crypto.Open(key, aad, Kernel.Crypto.Seal(key, aad, "ok"u8.ToArray()));

        return Results.Ok(new { ok = opened.Length == 2 });
    }
    finally
    {
        System.Security.Cryptography.CryptographicOperations.ZeroMemory(key);
    }
});

Auth.Map(app);
Workspace.Map(app);
Slug.Map(app);
Roles.Map(app);
Page.Map(app);

app.Run();
return 0;
