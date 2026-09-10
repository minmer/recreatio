using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 15.7 und 15.9 — Ausnahmen werden zu Antworten, an EINER Stelle.
///
/// Ohne diese Schicht muesste jeder Endpunkt, der einen Schluesselbund oeffnet,
/// <c>RcUnlockRequiredException</c> selbst abfangen. Einer vergisst es, und der
/// Klient bekommt statt „bitte entsperren" einen Serverfehler — auf den er
/// nicht sinnvoll reagieren kann, weil <c>500</c> nichts darueber sagt, was zu
/// tun ist.
///
/// <b>Was hier NICHT passiert.</b> Kein Aufschluss ueber Interna. Eine
/// unerwartete Ausnahme wird protokolliert und nach aussen zu einem Satz ohne
/// Einzelheiten. Die Vorgangskennung verbindet beides — der Betreiber findet
/// den Eintrag, der Nutzer nennt die Kennung, und niemand muss dafuer einen
/// Stapelabzug im Browser sehen.
/// </summary>
public sealed class RcExceptionMiddleware(
    RequestDelegate next, ILogger<RcExceptionMiddleware> log, IHostEnvironment environment)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (RcUnlockRequiredException e) when (!context.Response.HasStarted)
        {
            // Kein Fehler im eigentlichen Sinn: der erwartete Zustand nach einem
            // Neustart des Browsers oder nach Ablauf des Schluesselgedaechtnisses.
            await RcResults.WriteUnlockRequiredAsync(context, e);
        }
        catch (RcDecryptException e) when (!context.Response.HasStarted)
        {
            // 15.9 — Vier unterscheidbare Ursachen. Ein einziges
            // decrypt_failed reicht nicht: der Betreiber, der die Inhalte nicht
            // lesen darf, haette sonst kein Mittel zur Eingrenzung.
            log.LogWarning("Entschluesselung fehlgeschlagen: {Error} ({TraceId})", e.Error, context.TraceIdentifier);
            await RcResults.WriteDecryptErrorAsync(context, e);
        }
        catch (RcRoleCycleException e) when (!context.Response.HasStarted)
        {
            await RcResults.WriteErrorAsync(context, StatusCodes.Status409Conflict, e.Code,
                "Diese Zuordnung wuerde einen Kreis schliessen: die beiden Rollen wuerden einander gegenseitig aufschliessen.");
        }
        catch (RcChainConflictException e) when (!context.Response.HasStarted)
        {
            // 7.6 — Zwei Anfuegungen an derselben Stelle. Kein Datenschaden:
            // die Eindeutigkeitsbedingung hat getan, wofuer sie da ist. Der
            // Klient soll es noch einmal versuchen, nicht aufgeben.
            log.LogInformation("Kettenkonflikt an Stelle {Sequence} ({TraceId})", e.Sequence, context.TraceIdentifier);
            await RcResults.WriteErrorAsync(context, StatusCodes.Status409Conflict, e.Code,
                "Hier wurde gerade gleichzeitig geschrieben. Bitte noch einmal versuchen.");
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Der Klient ist gegangen. Das ist kein Fehler und gehoert nicht ins
            // Protokoll — sonst steht dort jeder abgebrochene Seitenwechsel.
        }
        catch (Exception e) when (!context.Response.HasStarted)
        {
            log.LogError(e, "Unbehandelte Ausnahme unter /rc ({TraceId})", context.TraceIdentifier);

            await RcResults.WriteErrorAsync(context, StatusCodes.Status500InternalServerError,
                "server.unexpected",
                environment.IsDevelopment()
                    ? $"{e.GetType().Name}: {e.Message}"
                    : "Da ist etwas schiefgegangen. Bitte spaeter erneut versuchen.");
        }
    }
}

public static class RcExceptionExtensions
{
    public static IApplicationBuilder UseRcExceptions(this IApplicationBuilder app) =>
        app.UseMiddleware<RcExceptionMiddleware>();
}
