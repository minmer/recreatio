using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Rc.Api;

/// <summary>
/// Wer den Dienst von einem anderen Ursprung aus ansprechen darf.
///
/// <b>Ohne das kommt keine Anmeldung zustande.</b> Der Browser-Teil liegt auf
/// <c>recreatio.pl</c>, der Dienst auf <c>api.recreatio.pl</c> — das sind zwei
/// Ursprünge. Ein Aufruf mit <c>credentials: "include"</c> darf sein
/// <c>Set-Cookie</c> nur behalten, wenn die Antwort
/// <c>Access-Control-Allow-Credentials: true</c> traegt UND einen konkreten
/// <c>Access-Control-Allow-Origin</c>.
///
/// Fehlt beides, sieht man ein Bild, das in die Irre fuehrt: die Anmeldung
/// scheint zu gelingen, der Dienst schickt ein Cookie, der Browser wirft es
/// weg — und jeder folgende Aufruf ist 401. Nirgends steht ein Fehler, der auf
/// die Ursache zeigt.
///
/// <b>KEIN Platzhalter.</b> <c>AllowAnyOrigin</c> und <c>AllowCredentials</c>
/// schliessen einander aus; der Browser weist die Kombination ab. Das ist keine
/// Schikane: ein Dienst, der jedem Ursprung Zugriff MIT Anmeldedaten gaebe,
/// liesse jede fremde Seite im Namen des Angemeldeten handeln.
///
/// <b>DOMAENENWECHSEL.</b> Die Liste steht in der Einstellung
/// <c>Rc:AllowedOrigins</c>, kommagetrennt. Kommt eine Domaene dazu, gehoert
/// sie hierher — und in <c>rcOrigins.ts</c> auf der anderen Seite.
/// </summary>
public static class RcCors
{
    public const string PolicyName = "rc";
    public const string ConfigKey = "Rc:AllowedOrigins";

    /// <summary>
    /// Woher der Browser-Teil kommt, wenn nichts eingestellt ist.
    ///
    /// Beide Schreibweisen: <c>www</c> und ohne. Wer die Seite mit dem einen
    /// aufruft und den anderen eingetragen hat, bekommt genau denselben
    /// stummen 401 — und sucht ihn woanders.
    /// </summary>
    private static readonly string[] Fallback =
    [
        "https://recreatio.pl",
        "https://www.recreatio.pl"
    ];

    public static IServiceCollection AddRcCors(this IServiceCollection services, IConfiguration config)
    {
        var configured = config[ConfigKey];

        var origins = string.IsNullOrWhiteSpace(configured)
            ? Fallback
            : configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return services.AddCors(options => options.AddPolicy(PolicyName, policy => policy
            .WithOrigins(origins)
            .AllowCredentials()

            // Die beiden eigenen Koepfe muessen ausdruecklich dastehen: was
            // nicht aufgezaehlt ist, laesst der Browser bei einer Vorabfrage
            // nicht durch. `X-Rc-Csrf` traegt den Schutzwert, `X-Rc-Unlock`
            // das Oeffnungsstueck.
            .WithHeaders("Content-Type", "X-Rc-Csrf", "X-Rc-Unlock")
            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")

            // Eine Stunde. Ohne das schickt der Browser vor jedem geschuetzten
            // Aufruf eine zweite Anfrage.
            .SetPreflightMaxAge(TimeSpan.FromHours(1))));
    }
}
