using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 15.7 — Jede Fehlerantwort der API hat dieselbe Gestalt. Bei einem erzeugten
/// Klienten (15.6) muss das Format vor der Erzeugung feststehen; nachtraeglich
/// ist es nicht mehr zu vereinheitlichen.
/// </summary>
public static class RcResults
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    /// <summary>
    /// Erfolgsantworten gehen denselben Weg wie Fehler — dieselbe
    /// Benennungsregel, dieselbe Kodierung. Wenn Erfolg und Fehler
    /// unterschiedlich geschrieben werden, faellt das erst beim erzeugten
    /// Klienten (15.6) auf, und dann an vielen Stellen gleichzeitig.
    /// </summary>
    public static async Task WriteJsonAsync<T>(HttpContext context, T value, int statusCode = StatusCodes.Status200OK)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsync(JsonSerializer.Serialize(value, Json));
    }

    /// <summary>
    /// <paramref name="message"/> ist ein Satz fuer den Menschen und darf sich
    /// jederzeit aendern — der Klient entscheidet ausschliesslich anhand von
    /// <paramref name="code"/> (15.7).
    ///
    /// Die Antwort enthaelt niemals Geheimtext, Schluesselmaterial,
    /// AAD-Bestandteile oder entschluesselte Inhalte. Auch nicht in der
    /// Entwicklungsumgebung — deshalb gibt es hier keinen Schalter dafuer.
    /// </summary>
    public static async Task WriteErrorAsync(
        HttpContext context, int statusCode, string code, string message,
        IReadOnlyDictionary<string, string>? details = null)
    {
        var error = RcError.Create(code, message, context.TraceIdentifier, details);

        // Der Selbstschutz aus RcError greift hier zur Laufzeit: lieber eine
        // nichtssagende Meldung als eine, die etwas ausplaudert.
        if (!error.LooksSafe())
        {
            error = RcError.Create(code,
                "Die Anfrage konnte nicht bearbeitet werden.", context.TraceIdentifier);
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsync(JsonSerializer.Serialize(error, Json));
    }

    /// <summary>
    /// 15.9 — Vier unterscheidbare Ursachen. Ein einziges <c>decrypt_failed</c>
    /// reicht nicht: der Betreiber, der die Inhalte nicht lesen darf, haette
    /// sonst kein Mittel zur Eingrenzung.
    /// </summary>
    public static Task WriteDecryptErrorAsync(HttpContext context, RcDecryptException e) =>
        WriteErrorAsync(context, StatusCodes.Status422UnprocessableEntity, e.Code, e.Error switch
        {
            RcDecryptError.MissingEpoch =>
                "Diese Nachricht stammt aus der Zeit vor deinem Beitritt.",
            RcDecryptError.MissingKey =>
                "Fuer diesen Bereich fehlt dir der Schluessel.",
            RcDecryptError.AadMismatch =>
                "Dieser Eintrag laesst sich nicht ueberpruefen.",
            _ => "Dieser Eintrag laesst sich nicht lesen."
        });

    public static Task WriteUnlockRequiredAsync(HttpContext context, RcUnlockRequiredException e) =>
        WriteErrorAsync(context, StatusCodes.Status401Unauthorized, e.Code,
            "Dein Schluessel liegt nicht im Speicher. Bitte entsperren.");
}
