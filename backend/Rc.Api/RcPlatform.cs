using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Der Anschlusspunkt der neuen Plattform.
///
/// Sie laeuft NEBEN dem Altbestand (2.1): eigener Pfad <c>/rc</c>, eigene
/// Datenbank, eigenes Schema. Kein gemeinsames Schema, keine geteilten
/// Tabellen, <b>keine Zwischenschicht, die beide bedient</b>.
///
/// Derselbe Prozess ist ausdruecklich erlaubt — 2.1 verbietet geteilte Daten,
/// nicht geteilten Arbeitsspeicher. Der Wirt referenziert beide Seiten; das ist
/// Zusammensetzung, nicht Vermischung.
///
/// Im Wirt genuegen zwei Zeilen:
/// <code>
///   builder.Services.AddRcPlatform(builder.Configuration);
///   app.UseRcPlatform();
/// </code>
/// </summary>
public static class RcPlatform
{
    public static IServiceCollection AddRcPlatform(this IServiceCollection services, IConfiguration config)
    {
        // 2.4 — Jeder Schluessel-Cache hat Ablauf UND Groessenbegrenzung.
        // Der Altbestand hatte ein unbegrenztes Woerterbuch ohne beides.
        var idle = TimeSpan.FromMinutes(config.GetValue("Rc:KeyVaultIdleMinutes", 15));
        var maxEntries = config.GetValue("Rc:KeyVaultMaxEntries", 5_000);

        services.AddSingleton(_ => new RcKeyVault(idle, maxEntries));
        services.AddSingleton<RcDb>();
        services.AddSingleton<RcServerSecret>();
        services.AddSingleton<RcPermissions>();
        services.AddSingleton<RcRoleAccess>();
        services.AddSingleton<RcMasterKey>();
        services.AddSingleton<RcLedger>();

        // Der Speicherriegel vor Argon2id. Vorgabe vier gleichzeitige Laeufe:
        // 4 x 64 MiB = 256 MiB Spitzenlast fuer Anmeldungen. Wer mehr Kerne hat,
        // stellt hoeher — aber bewusst, nicht durch Zufall (RcLoginGuard).
        var maxConcurrent = config.GetValue("Rc:LoginMaxConcurrent", 4);
        var maxFailures = config.GetValue("Rc:LoginMaxFailures", 10);
        services.AddSingleton(_ => new RcLoginGuard(maxConcurrent, maxFailures));

        // Eine Entscheidung fuer beide Cookies (RcCookiePolicy).
        var cookies = new RcCookiePolicy(config);
        services.AddSingleton(cookies);

        // Eigenes Anmeldeverfahren neben dem des Altbestands (2.1). Der Aufruf
        // ohne Vorgabeschema aendert nichts an dem, was schon eingerichtet ist —
        // er stellt nur ein weiteres, benanntes Verfahren daneben.
        services.AddAuthentication().AddCookie(RcAuth.Scheme, o => RcAuth.ConfigureRcCookie(o, cookies));
        return services;
    }

    /// <summary>
    /// Reihenfolge ist hier keine Geschmacksfrage:
    ///
    ///   0. Ausnahmen — aussen, sonst faengt sie niemand (15.7).
    ///   1. Sitzung — der Widerruf muss vor allem anderen greifen (P0-2).
    ///   2. CSRF    — vor jedem Endpunkt, als Standardverhalten (P0-4).
    ///   3. Endpunkte.
    ///
    /// Stuende CSRF vor der Sitzungspruefung, koennte eine widerrufene Sitzung
    /// noch eine Fehlermeldung ueber den Schutzwert bekommen — und damit
    /// erfahren, dass sie ueberhaupt noch bekannt ist.
    /// </summary>
    public static WebApplication UseRcPlatform(this WebApplication app)
    {
        app.UseWhen(
            ctx => ctx.Request.Path.StartsWithSegments("/rc"),
            branch =>
            {
                branch.UseRcExceptions();
                branch.UseRcSession();
                branch.UseRcCsrf();
            });

        app.MapRcHealth();
        app.MapRcCsrfToken();
        app.MapRcAuth();
        app.MapRcRoles();
        app.MapRcInvitations();
        app.MapRcAreas();
        app.MapRcMessages();
        app.MapRcTopics();
        app.MapRcEngagement();
        app.MapRcPolls();
        app.MapRcDecisions();
        app.MapRcLedger();
        app.MapRcAttachments();
        app.MapRcDataItems();
        app.MapRcConsent();
        app.MapRcEvents();
        app.MapRcRegistrations();
        app.MapRcParish();
        app.MapRcGraph();
        app.MapRcCalendar();
        app.MapRcConfirmation();
        app.MapRcResource();
        app.MapRcRecovery();
        return app;
    }

    /// <summary>
    /// Holt einen Schutzwert. Der Klient legt ihn in den Kopf, das Cookie
    /// traegt ihn zurueck — ein Doppel-Absende-Verfahren (15.1).
    ///
    /// Der Aufruf ist selbst vom CSRF-Schutz ausgenommen, sonst braeuchte man
    /// einen Schutzwert, um einen Schutzwert zu holen.
    /// </summary>
    public static void MapRcCsrfToken(this IEndpointRouteBuilder app) =>
        app.MapPost("/rc/csrf", (HttpContext ctx, RcCookiePolicy policy) =>
        {
            var token = RcCsrfMiddleware.NewToken();
            RcCsrfMiddleware.Issue(ctx, token, policy);
            return Results.Json(new RcCsrfResponse(token));
        }).AllowAnonymousWrite("Holt den Schutzwert selbst — kann ihn nicht voraussetzen.")
          .Produces<RcCsrfResponse>();

    /// <summary>
    /// Beim Start aufrufen. Bricht ausserhalb der Entwicklung ab, wenn ein
    /// Geheimnis fehlt (15.3) — ein Dienst ohne seine Geheimnisse nimmt Daten
    /// an, die er spaeter nicht mehr oeffnen kann.
    /// </summary>
    public static Task AssertRcReadyAsync(this WebApplication app) =>
        RcReadiness.AssertReadyAsync(app.Configuration, app.Environment.IsDevelopment());
}
