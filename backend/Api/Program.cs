/*
 * Der Dienst.
 *
 *   dotnet run --project backend/Api -- migrate [--dry-run] [--through 0112]
 *   dotnet run --project backend/Api -- migrate --record-through 0111 [--dry-run]
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
var fileLogging = builder.Configuration.GetSection("Logging:File");
if (fileLogging.GetValue<bool>("Enabled"))
    builder.Logging.AddProvider(new FileLoggerProvider(builder.Environment.ContentRootPath, fileLogging));

if (args.Length > 0 && args[0].Equals("migrate", StringComparison.OrdinalIgnoreCase))
{
    var dryRun = args.Contains("--dry-run", StringComparer.OrdinalIgnoreCase);

    // Von Hand angewendete Skripte eintragen, ohne sie auszufuehren
    // (documentation/TRANSFER.md): migrate --record-through 0111 [--dry-run]
    var recordAt = Array.FindIndex(args, a => a.Equals("--record-through", StringComparison.OrdinalIgnoreCase));
    if (recordAt >= 0)
    {
        if (recordAt + 1 >= args.Length) { Console.Error.WriteLine("--record-through braucht eine Nummer, etwa 0111."); return 2; }
        return await Migrate.RecordAsync(Db.Resolve(builder.Configuration), args[recordAt + 1], dryRun);
    }

    // Nur bis zu einer Nummer — was der laufende Dienst noch liest, wartet auf den neuen.
    var throughAt = Array.FindIndex(args, a => a.Equals("--through", StringComparison.OrdinalIgnoreCase));
    if (throughAt >= 0 && throughAt + 1 >= args.Length) { Console.Error.WriteLine("--through braucht eine Nummer, etwa 0112."); return 2; }

    return await Migrate.RunAsync(Db.Resolve(builder.Configuration), dryRun, throughAt >= 0 ? args[throughAt + 1] : null);
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
builder.Services.AddSingleton<Push>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<Push>());
/* 0111 — dieselbe Zustellung auch auf Zuruf („Wyślij teraz"), nicht nur im Takt. */
builder.Services.AddSingleton<ChatDelivery>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<ChatDelivery>());

/* 0109 — Cogita: der Hub der Sitzungen (WebSocket, sonst fragt der Browser selbst) und der Takt der Spiele. */
builder.Services.AddSignalR(options => { options.MaximumReceiveMessageSize = 64 * 1024; });
builder.Services.AddHostedService<CogitaClock>();

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

        /*
         * 2026-10-17 — `X-Epoch` sagt, unter welchem Schlüssel eine versiegelte
         * Datei liegt (Library.Cogita, Phone.Files). Über Herkünfte hinweg sieht
         * der Browser eine Kopfzeile nur, wenn sie hier freigegeben ist — sonst
         * liest er `null`, und die Datei bleibt zu.
         */
        policy.WithOrigins(origins).AllowCredentials().AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("X-Epoch");
    }));

var app = builder.Build();
if (fileLogging.GetValue<bool>("Enabled"))
    app.Logger.LogWarning("API file logging enabled. Directory: {Directory}; retention: {Days} days.",
        Path.GetFullPath(fileLogging["Directory"] ?? "logs", builder.Environment.ContentRootPath),
        fileLogging.GetValue<int?>("RetainedDays") ?? 7);

app.UseCors(BrowserOrigins);
app.UseMiddleware<ApiErrorMiddleware>();

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
/* Das Konto löschen — selbst, in der App wie im Browser (Google Play verlangt beides). */
AccountDeletion.Map(app);
Keeping.Map(app);
Workspace.Map(app);
Slug.Map(app);
Roles.Map(app);
Page.Map(app);
/* 0062 — Bilder einer Seite, vor allem die Hintergründe der Slajdy. */
PageImage.Map(app);
Access.Map(app);
Mass.Map(app);
Area.Map(app);
Calendar.Map(app);
Seat.Map(app);
Person.Map(app);
Intake.Map(app);
Form.Map(app);

/*
 * Termine, die man sich nehmen kann (0029). Sie stehen im KALENDER — hier
 * kommt nur die Frage dazu, wer sich daraufsetzen darf.
 */
/* `Slot` ist in `Bookings` aufgegangen (0039): ein Termin beim Priester und
   ein Haus in Hortus Dei sind dieselbe Sache mit anderen Regeln. */
Bookings.Map(app);

/* 0052 — Rozmowy: Chats auf dem Kern der Bereiche. */
Chat.Map(app);

/* 0080 — die drei Zugänge (Kanał, gemeinsam, einer mit einem) und die Formulare an einem Ding. */
Audience.Map(app);

/* 0054 — persönlich: der eigene Kalender, Aufgaben, der gemerkte Stand, das Menü einer Seite. */
Agenda.Map(app);
Tasks.Map(app);
State.Map(app);
Menu.Map(app);

/* Bausteine als eigene Dinge — die Seite zeigt sie nur (0036). */
Module.Map(app);

/* 0064 — die Bibliothek: Werke, Zitate, Personen, Themen und die eigenen Texte. */
Library.Map(app);
LibraryCatalog.Map(app);

/* 0109 — Cogita: Antworten und Kenntnis (versiegelt, an die Annahme), direkt veröffentlichte Bausteine, Sitzungen, Spiele. */
Cogita.Map(app);
app.MapHub<CogitaHub>("/cogita/hub");

/* 0067 — Powiadomienia: was neu ist, als Zahlen; Geräte für die App im Hintergrund. */
Notify.Map(app);

/* 0114 — das Telefon: Kontakte und das Archiv der SMS (die Ausgabe „sms" der App), versiegelt. */
Phone.Map(app);

/* 0071 — Adressen aus Teilen, das Verzeichnis eines Gebiets, die Haushalte (Kolęda). */
Postal.Map(app);

/* Was nach Schritt 3 noch übrig ist — RSA-Umschläge und die Aufräumarbeit des Servers (documentation/TRANSFER.md). */
Transfer.Map(app);

app.Run();
return 0;
