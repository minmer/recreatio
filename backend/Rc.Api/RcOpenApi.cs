using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

// Microsoft.OpenApi 2.x hat die Typen aus dem Unterraum "Models" nach oben
// geholt. Swashbuckle 10 bringt diese Fassung mit — dieselbe, die auch der
// Altbestand seit der Umstellung auf net10.0 benutzt.
using Microsoft.OpenApi;

namespace Rc.Api;

/// <summary>
/// 15.6 — Die Beschreibung der Schnittstelle, aus der der Browser-Teil seine
/// Typen bekommt.
///
/// <b>Was hier NICHT passiert.</b> Nichts wird verschickt, nichts abgerufen,
/// kein Dienst befragt. Die Beschreibung entsteht aus den Endpunkten, die
/// ohnehin im Programm stehen, und landet als Datei auf der Platte. Ein
/// Erzeugerlauf liest sie und schreibt TypeScript daraus.
///
/// <b>Wozu das gut ist.</b> Heute steht jede Antwortform zweimal da: einmal als
/// Datensatz in C#, einmal als Schnittstelle in TypeScript, die ich von Hand
/// nachgebaut habe. Benennt jemand im Server ein Feld um, uebersetzt der
/// Browser-Teil weiter — und liefert an dieser Stelle <c>undefined</c>. Der
/// Fehler faellt dann nicht beim Bauen auf, sondern bei einem Menschen.
///
/// Mit erzeugten Typen wird aus demselben Fehler ein Uebersetzungsfehler. Das
/// ist die ganze Absicht; mehr verspricht dieses Verfahren nicht. Es weiss
/// nichts davon, dass ein Feld Geheimtext enthaelt oder dass zum Lesen ein
/// Epochenschluessel gehoert — <b>die Bedeutung bleibt von Hand geschrieben.</b>
/// </summary>
public static class RcOpenApi
{
    public const string DocumentName = "rc";

    public static IServiceCollection AddRcOpenApi(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc(DocumentName, new OpenApiInfo
            {
                Title = "Recreatio",
                Version = "v1",
                Description = "Die neue Plattform unter /rc. Beschreibung erzeugt aus den Endpunkten."
            });

            // Nur der Neuaufbau. Der Altbestand liegt im selben Prozess (2.1),
            // gehoert aber nicht in diese Beschreibung — sonst erzeugte der
            // Klient Typen fuer etwas, das er nie aufrufen soll.
            options.DocInclusionPredicate((_, description) =>
                description.RelativePath?.StartsWith("rc/", StringComparison.Ordinal) == true);

            // Ohne das kollidieren gleichnamige Typen aus verschiedenen
            // Klassen — etwa die mehreren "CreateRequest".
            options.CustomSchemaIds(type => type.FullName?.Replace('+', '.').Split('.').Last() switch
            {
                null => type.Name,
                var name => Prefix(type) + name
            });

            // Ohne diese beiden beschreibt das Dokument jedes Feld als
            // moeglicherweise fehlend und jede Zeichenkette als moeglicherweise
            // null. Der erzeugte Klient zwingt dann ueberall zu Pruefungen auf
            // Werte, die es gar nicht geben kann — und das ist schlimmer als
            // keine Typen: es gewoehnt einen daran, Pruefungen wegzuklicken.
            options.SupportNonNullableReferenceTypes();
            options.SchemaFilter<RcRequiredSchemaFilter>();
        });

        return services;
    }

    /// <summary>
    /// Verschachtelte Datensaetze heissen oft gleich (<c>CreateRequest</c> gibt
    /// es mehrfach). Der Name der umschliessenden Klasse macht sie
    /// unterscheidbar — und im erzeugten TypeScript lesbar.
    /// </summary>
    private static string Prefix(Type type) =>
        type.DeclaringType is null ? "" : type.DeclaringType.Name.Replace("Rc", "");

    /// <summary>
    /// Der Pfad, unter dem die Beschreibung im laufenden Dienst liegt. Sie wird
    /// NUR fuer den Erzeugerlauf gebraucht und deshalb auch nur dort
    /// eingeschaltet — im Betrieb hat eine Liste aller Endpunkte nichts
    /// verloren.
    /// </summary>
    public const string DocumentPath = "/rc/openapi.json";

    public static WebApplication UseRcOpenApi(this WebApplication app)
    {
        app.UseSwagger(options => options.RouteTemplate = "rc/{documentName}.json");
        return app;
    }
}

/// <summary>
/// Macht das Dokument ehrlich: was in C# nicht <c>null</c> sein kann, ist in
/// der Antwort immer da.
///
/// <b>Warum das noetig ist.</b> System.Text.Json schreibt jede Eigenschaft
/// eines Datensatzes — ein positionsbasierter Datensatz hat keine Felder, die
/// wegbleiben koennen. Das Dokument behauptete trotzdem, alles sei wahlweise,
/// weil Swashbuckle ohne Zutun nichts als Pflicht auszeichnet.
///
/// Die Folge im erzeugten Klienten waeren Typen wie
/// <c>string | null | undefined</c> ueberall — und damit Pruefungen auf
/// Zustaende, die nie eintreten. Das ist nicht bloss laestig: wer sich
/// angewoehnt, solche Pruefungen mit <c>!</c> wegzuraeumen, raeumt irgendwann
/// auch die weg, die es wirklich braucht.
/// </summary>
internal sealed class RcRequiredSchemaFilter : Swashbuckle.AspNetCore.SwaggerGen.ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, Swashbuckle.AspNetCore.SwaggerGen.SchemaFilterContext context)
    {
        if (schema is not OpenApiSchema concrete) return;
        if (concrete.Properties is null || concrete.Properties.Count == 0) return;

        concrete.Required ??= new HashSet<string>(StringComparer.Ordinal);

        foreach (var (name, property) in concrete.Properties)
        {
            // Was ausdruecklich als nullbar beschrieben ist, bleibt wahlweise —
            // dort IST der Unterschied echt (etwa RcMeResponse.accountId, das
            // ohne Anmeldung fehlt).
            if (!IsNullable(property)) concrete.Required.Add(name);
        }
    }

    private static bool IsNullable(IOpenApiSchema schema) =>
        schema.Type is { } type && type.HasFlag(JsonSchemaType.Null);
}
