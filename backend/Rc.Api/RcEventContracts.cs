namespace Rc.Api;

/* ---------------------------------------------------------------------------
   Antworten des Veranstaltungsmoduls.

   Sie liegen getrennt von den Endpunkten, damit die erzeugte Beschreibung
   (15.6) an einer Stelle nachzulesen ist und nicht in fuenfzehn Methoden
   verstreut. Was hier steht, ist Vertrag — eine Umbenennung wird im Browser
   zum Uebersetzungsfehler und nicht zu einem `undefined`.
   --------------------------------------------------------------------------- */

// -- Anlegen ------------------------------------------------------------------

public sealed record RcEventCreatedResponse(string EventId, string Slug, string Title, string Lifecycle);

public sealed record RcEventPageCreatedResponse(string PageId, string Slug, string Title);

public sealed record RcEventPartCreatedResponse(string PartId, string Kind, bool IsPublic, int SortOrder);

public sealed record RcEventPartUpdatedResponse(string PartId, bool Updated);

public sealed record RcEventFieldCreatedResponse(string FieldId, string Kind, string Label, string DataClass);

public sealed record RcEventPublishedResponse(string EventId, string Lifecycle);

// -- Lesen --------------------------------------------------------------------

public sealed record RcEventsResponse(IReadOnlyList<RcEvents.EventSummary> Events);

/// <summary>
/// <c>mayRead</c> heisst: der Leser gehoert dazu. Davon haengt ab, ob interne
/// Teile ueberhaupt in der Antwort stehen — und die Oberflaeche braucht es, um
/// den Unterschied zwischen „es gibt hier nichts weiter" und „du siehst nur
/// den oeffentlichen Teil" auszusprechen. Ohne dieses Feld saehe beides gleich
/// aus, und der Leser hielte das Bruchstueck fuer das Ganze.
/// </summary>
public sealed record RcEventViewResponse(
    string EventId, string AreaId, string Slug, string Title, string Lifecycle, bool IsPublic,
    DateTimeOffset? StartsUtc, DateTimeOffset? EndsUtc, bool MayRead,
    IReadOnlyList<RcEvents.PageView> Pages,
    string? IntakePublicKey);

// -- Anmeldungen --------------------------------------------------------------

/// <summary>
/// <c>claim</c> ist der Beleg fuer den, der ohne Konto eingesandt hat. Er kommt
/// EINMAL zurueck; gespeichert wird nur sein SHA-256. Wer die Tabelle
/// vollstaendig besitzt, kann die Anmeldung damit nicht aufrufen.
///
/// Daraus folgt dasselbe wie beim Einladungslink: ein verlorener Beleg ist
/// endgueltig verloren, und die Oberflaeche muss das sagen, statt ihn beilaeufig
/// einmal anzuzeigen.
/// </summary>
public sealed record RcRegistrationSubmittedResponse(
    string RegistrationId, string? Claim, DateTimeOffset SubmittedUtc);

public sealed record RcRegistrationsResponse(IReadOnlyList<RcRegistrations.RegistrationView> Registrations);

public sealed record RcRegistrationWithdrawnResponse(string RegistrationId, int ValuesDestroyed);
