using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// P0-4 / 15.1 — CSRF zentral, als Standardverhalten.
///
/// Der Altbestand macht es umgekehrt: jeder Endpunkt muss den Schutz einzeln
/// anfordern. Chat und Calendar tun es an je acht Stellen, Parish, Hortus und
/// Events an keiner einzigen. Genau das garantiert opt-in auf Dauer — irgendwann
/// vergisst es jemand, und es faellt niemandem auf.
///
/// Hier ist es umgekehrt: <b>Jede authentifizierte unsichere Methode ist
/// geschuetzt, es sei denn, sie ist ausdruecklich ausgenommen.</b> Eine Ausnahme
/// verlangt einen Aufruf von <see cref="RcCsrfExtensions.AllowAnonymousWrite"/>
/// und damit eine bewusste Entscheidung, die im Quelltext sichtbar ist.
///
/// Das Cookie ist im Betrieb <c>SameSite=None</c> (<see cref="RcCookiePolicy"/>);
/// ohne CSRF-Schutz waere das ein offenes Tor.
///
/// <b>Was hier NICHT als Ausnahme gilt.</b> "Der Aufrufer ist noch nicht
/// angemeldet" ist kein Grund. Der Schutzwert kommt aus <c>/rc/csrf</c> und
/// setzt kein Konto voraus — Anmeldung und Schutzwert sind zwei verschiedene
/// Dinge. Waere die Anmeldung ausgenommen, koennte eine fremde Seite jemanden
/// in ein untergeschobenes Konto anmelden und dessen weitere Eingaben dort
/// landen lassen.
/// </summary>
public sealed class RcCsrfMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Rc-Csrf";
    public const string CookieName = "rc.csrf";

    private static readonly HashSet<string> SafeMethods =
        new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS", "TRACE" };

    public async Task InvokeAsync(HttpContext context)
    {
        if (SafeMethods.Contains(context.Request.Method))
        {
            await next(context);
            return;
        }

        // Ausdrueckliche Ausnahme — sichtbar am Endpunkt, nicht hier.
        if (context.GetEndpoint()?.Metadata.GetMetadata<RcAllowAnonymousWriteAttribute>() is not null)
        {
            await next(context);
            return;
        }

        var cookie = context.Request.Cookies[CookieName];
        var header = context.Request.Headers[HeaderName].ToString();

        if (string.IsNullOrEmpty(cookie) || string.IsNullOrEmpty(header) || !FixedTimeEquals(cookie, header))
        {
            await RcResults.WriteErrorAsync(context, StatusCodes.Status403Forbidden,
                RcErrorCodes.AuthCsrfMissing,
                "Diese Anfrage traegt keinen gueltigen Schutzwert. Seite neu laden und erneut versuchen.");
            return;
        }

        await next(context);
    }

    /// <summary>
    /// Vergleich in fester Zeit. Bei einem Doppel-Absende-Verfahren ist der Wert
    /// zwar nicht geheim gegenueber dem Nutzer, wohl aber gegenueber einer
    /// fremden Seite — und ein Vergleich, der beim ersten abweichenden Zeichen
    /// abbricht, verraet ueber die Laufzeit, wie weit man gekommen ist.
    /// </summary>
    private static bool FixedTimeEquals(string a, string b)
    {
        var ba = System.Text.Encoding.UTF8.GetBytes(a);
        var bb = System.Text.Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    /// <summary>32 Byte aus dem CSPRNG, Base64URL.</summary>
    public static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    /// <summary>
    /// Das Cookie ist bewusst LESBAR fuer JavaScript — der Klient muss den Wert
    /// in den Kopf schreiben koennen. Geschuetzt ist es dadurch, dass eine
    /// fremde Seite es weder lesen noch setzen kann.
    /// </summary>
    public static void Issue(HttpContext context, string token, RcCookiePolicy policy) =>
        context.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = false,
            Secure = policy.SecureFor(context.Request),
            SameSite = policy.SameSite,
            Path = "/",
            MaxAge = TimeSpan.FromHours(12)
        });
}

/// <summary>
/// Nimmt einen Endpunkt vom CSRF-Schutz aus. Nur fuer Pfade, die ohne Konto
/// erreichbar sein MUESSEN — etwa eine anonyme Frage auf einem oeffentlichen
/// Board (3.11). Jede Verwendung ist eine Entscheidung und gehoert begruendet.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RcAllowAnonymousWriteAttribute(string reason) : Attribute
{
    public string Reason { get; } = reason;
}

public static class RcCsrfExtensions
{
    public static IApplicationBuilder UseRcCsrf(this IApplicationBuilder app) =>
        app.UseMiddleware<RcCsrfMiddleware>();

    public static TBuilder AllowAnonymousWrite<TBuilder>(this TBuilder builder, string reason)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.WithMetadata(new RcAllowAnonymousWriteAttribute(reason));
        return builder;
    }
}
