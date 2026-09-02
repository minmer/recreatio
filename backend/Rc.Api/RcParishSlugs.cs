namespace Rc.Api;

/// <summary>
/// Welche Namen eine Pfarrei in ihrer Adresse tragen darf.
///
/// <para>
/// <b>Warum das der Server entscheidet und nicht das Formular.</b> Der Klient
/// hat dieselbe Liste und warnt damit, sobald jemand tippt — das ist
/// freundlich, aber es ist keine Schranke. Ein Formular laesst sich umgehen;
/// wer die Anfrage von Hand stellt, kaeme an jeder noch so hoeflichen
/// Bildschirmmeldung vorbei. Was wirklich gelten soll, muss dort gelten, wo die
/// Zeile geschrieben wird.
/// </para>
///
/// <para>
/// <b>Warum es die Liste ueberhaupt gibt.</b> Eine Pfarrei anzulegen heisst,
/// eine oeffentliche Adresse zu vergeben. Sie wird weitergegeben, gedruckt, in
/// den Schaukasten gehaengt und verlinkt. Sie danach zu aendern zerbraeche
/// jeden dieser Verweise, und sie NICHT zu aendern heisst, mit einem Tippfehler
/// zu leben, den Jahre lang jeder sieht. Also wird der Name vorher entschieden
/// und hier eingetragen — nicht in einem Eingabefeld erfunden.
/// </para>
///
/// <para>
/// <b>Dieselbe Liste steht in <c>frontend/src/rc/lib/rcSlugs.ts</c></b> und
/// beide gehoeren zusammen geaendert. Laufen sie auseinander, ist das kein
/// stiller Fehler: der Klient laesst dann etwas zu, das der Server ablehnt, und
/// die Ablehnung nennt die wirklich vorgesehenen Namen. Der schlechtere Fall —
/// der Server nimmt etwas an, wovon der Klient nichts weiss — kostet nichts.
/// </para>
/// </summary>
public static class RcParishSlugs
{
    /// <summary>Die vorgesehenen Namen. Klein geschrieben, wie in der Adresse.</summary>
    public static readonly IReadOnlySet<string> Allowed =
        new HashSet<string>(StringComparer.Ordinal) { "grzegorzki" };

    /// <summary>Ist dieser Name vorgesehen?</summary>
    public static bool IsAllowed(string slug) => Allowed.Contains(slug);

    /// <summary>
    /// Die vorgesehenen Namen als eine Zeile, fuer die Einzelheiten der
    /// Fehlerantwort. Sortiert, damit dieselbe Liste immer gleich aussieht.
    /// </summary>
    public static string AllowedList() => string.Join(", ", Allowed.OrderBy(s => s, StringComparer.Ordinal));
}
