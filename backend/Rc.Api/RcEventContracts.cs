namespace Rc.Api;

/* ---------------------------------------------------------------------------
   Antworten des Veranstaltungsmoduls.

   Sie liegen getrennt von den Endpunkten, damit die erzeugte Beschreibung
   (15.6) an einer Stelle nachzulesen ist und nicht in fuenfzehn Methoden
   verstreut. Was hier steht, ist Vertrag — eine Umbenennung wird im Browser
   zum Uebersetzungsfehler und nicht zu einem `undefined`.
   --------------------------------------------------------------------------- */

// -- Anlegen ------------------------------------------------------------------

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
/// <summary>
/// Was beim Gruenden entstanden ist.
///
/// Alle drei Kennungen gehen zurueck, weil der Browser sie sofort braucht:
/// die Adresse fuer den Verweis, das Amt fuer die naechste Zuteilung, den
/// Bereich fuer alles, was daran haengt. Sie hinterher zu suchen hiesse, drei
/// Abfragen fuer etwas zu stellen, das der Dienst gerade in der Hand hatte.
/// </summary>
public sealed record RcEventFoundedResponse(
    string EventId, string AreaId, string OfficeRoleId, string Slug);

/// <summary>
/// <c>Subtitle</c> und <c>Summary</c> sind ZWEI Dinge, und das ist kein
/// Versehen: das Motto steht AUF der Seite unter dem Titel, der Anriss auf der
/// KATALOGKARTE, wo wenig Platz ist und ein anderer Ton passt. Ein Feld fuer
/// beides hiesse entweder ein zu langes Motto auf der Karte oder ein zu duerrer
/// Karteitext auf der Seite.
///
/// Die Katalogfelder stehen am ENDE und haben Vorgaben: der Weg ueber den
/// persoenlichen Zugang liefert sie nicht — ein Teilnehmer braucht sie nicht,
/// und was nicht mitgeschickt wird, kann auch nicht durchsickern.
/// </summary>
public sealed record RcEventViewResponse(
    string EventId, string AreaId, string CollectionSlug, string Slug, string Title, string Lifecycle, bool IsPublic,
    DateTimeOffset? StartsUtc, DateTimeOffset? EndsUtc, bool MayRead,
    IReadOnlyList<RcEvents.PageView> Pages,
    string? IntakePublicKey,
    string? Subtitle = null, string? Summary = null, string? Category = null,
    string? Audience = null, string? PlacesJson = null, string? ThumbnailUrl = null,
    string? DateLabel = null, string? ThemeJson = null);

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

/* ---------------------------------------------------------------------------
   Die Sammlung ueber den Veranstaltungen.

   Sie traegt die Adresse, den Veranstalter, die Klausel und das Amt; die
   einzelne Veranstaltung traegt ihren eigenen Bereich und ihre eigenen
   Schluessel. Warum die Grenze dort liegt, steht in RcEventCollections.
   --------------------------------------------------------------------------- */

public sealed record RcEventCollectionsResponse(
    IReadOnlyList<RcEventCollections.CollectionSummary> Collections);

/// <summary>
/// Was beim Gruenden entstanden ist.
///
/// Alle drei Kennungen gehen zurueck, weil der Browser sie sofort braucht: die
/// Adresse fuer den Verweis, das Amt fuer die naechste Zuteilung, den Bereich
/// fuer alles, was daran haengt. Sie hinterher zu suchen hiesse, drei Abfragen
/// fuer etwas zu stellen, das der Dienst gerade in der Hand hatte.
/// </summary>
public sealed record RcEventCollectionFoundedResponse(
    string CollectionId, string AreaId, string OfficeRoleId, string Slug);

/// <summary>
/// Der Katalog.
///
/// <c>organizerName</c> und <c>organizerAddress</c> stehen im Klartext und
/// gehen auch an Fremde: die Klausel nach RODO ist zum Lesen da, bevor
/// irgendjemand ein Konto hat. Es ist dieselbe Grenze wie bei
/// <c>title_public</c> gegen <c>title_sealed</c> an der Messe.
///
/// <c>mayRead</c> heisst: der Leser gehoert dazu. Davon haengt ab, ob die
/// Entwuerfe ueberhaupt in der Liste stehen — und die Oberflaeche braucht es,
/// um „hier ist nichts weiter" von „du siehst nur den oeffentlichen Teil" zu
/// unterscheiden.
/// </summary>
public sealed record RcEventCollectionViewResponse(
    string CollectionId, string AreaId, string Slug, string Title, string Lifecycle,
    string? OrganizerName, string? OrganizerAddress, string? OrganizerEmail,
    bool MayRead,
    IReadOnlyList<RcEventCollections.CollectionEvent> Events);

public sealed record RcEventCollectionPublishedResponse(string CollectionId, string Lifecycle);

/* ---------------------------------------------------------------------------
   Bearbeiten des Bauplans — umbenennen, umsortieren, entfernen.
   --------------------------------------------------------------------------- */

/// <summary>
/// Die neue Reihenfolge, VOLLSTAENDIG.
///
/// Nicht „schiebe dieses eine hoch": zwei Leute, die gleichzeitig schieben,
/// erzeugten damit eine Reihenfolge, die keiner von beiden wollte. Die Liste
/// sagt, wie es nachher aussieht, und wer sie schickt, hat den Stand gesehen.
/// </summary>
public sealed record RcReorderRequest(IReadOnlyList<string>? Ids);

public sealed record RcEventReorderedResponse(int Ordered);

public sealed record RcEventDeletedResponse(string Id, bool Deleted);

public sealed record RcEventUpdatedResponse(string EventId, bool Updated);

public sealed record RcEventPageUpdatedResponse(string PageId, bool Updated);

public sealed record RcEventFieldUpdatedResponse(string FieldId, bool Updated);

/* ---------------------------------------------------------------------------
   Bilder und Dateien. Die Bytes liegen im Anhang; hier steht, was sie in einer
   Galerie oder Dateiliste ausmacht.
   --------------------------------------------------------------------------- */

public sealed record RcEventPhotoUploadedResponse(string PhotoId, string MediaId);

public sealed record RcEventPhotosResponse(IReadOnlyList<RcEventMedia.PhotoView> Photos);

public sealed record RcEventDocumentUploadedResponse(string DocumentId, string MediaId, long ByteSize);

public sealed record RcEventDocumentsResponse(IReadOnlyList<RcEventMedia.DocumentView> Documents);

/* ---------------------------------------------------------------------------
   Was Teilnehmer beitragen. Wer sie sind, sagt der Beleg ihrer Anmeldung —
   Begruendung in RcEventParticipation.
   --------------------------------------------------------------------------- */

public sealed record RcEventRosterResponse(IReadOnlyList<RcEventParticipation.RosterCell> Cells);

public sealed record RcEventRosterMarkedResponse(string RowKey, string Code, string? Value);

public sealed record RcEventProgressResponse(IReadOnlyList<string> Done);

public sealed record RcEventCardSubmittedResponse(string CardId, DateTimeOffset SubmittedUtc);

/// <summary>
/// Die Karten liegen VERSIEGELT hier. Geoeffnet wird im Browser dessen, der den
/// Epochenschluessel hat — der Dienst kann es nicht, und das ist die Zusage.
/// </summary>
public sealed record RcEventCardsResponse(IReadOnlyList<RcEventParticipation.CardView> Cards);

public sealed record RcEventTopicsResponse(IReadOnlyList<RcEventParticipation.TopicView> Topics);

public sealed record RcEventTopicCreatedResponse(string TopicId);

public sealed record RcEventTopicResponse(
    string TopicId, string Title, string Status,
    IReadOnlyList<RcEventParticipation.TopicMessageView> Messages);

public sealed record RcEventTopicRepliedResponse(string TopicId, bool Posted);

public sealed record RcEventTopicModeratedResponse(string TopicId, string Status);

/* ---------------------------------------------------------------------------
   Der persoenliche Zugang. Begruendung in RcEventAccess.
   --------------------------------------------------------------------------- */

/// <summary>
/// Die persoenliche Angabe: „Twoja grupa: 3", „Zbiórka: 7:40, brama B".
///
/// Damit sagt EINE Seite jedem Leser etwas anderes, ohne dass es je Leser eine
/// Fassung braucht.
/// </summary>
public sealed record RcEventAccessNote(string Label, string Value);

/// <summary>
/// <c>Token</c> kommt EINMAL zurueck und wird nirgends gespeichert — nur sein
/// Abdruck. Wer es verliert, bekommt ein neues; wer die Tabelle hat, bekommt
/// keins. Dieselbe Regel wie beim Anmeldebeleg.
/// </summary>
public sealed record RcEventAccessGrantedResponse(string AccessId, string Token);

public sealed record RcEventAccessListResponse(
    IReadOnlyList<RcEventAccess.AccessView> Access);

public sealed record RcEventAccessUpdatedResponse(string AccessId, bool Updated);

/// <summary>
/// Was ein Leser mit Link sieht.
///
/// <c>FirstOpen</c> heisst: dies ist das erste Mal. Der Veranstalter erfaehrt
/// damit, dass die Nummer, an die er geschickt hat, den Menschen erreicht — der
/// Leser sieht es nicht als Meldung, aber die Oberflaeche kann ihn begruessen
/// statt ihn wie einen Wiederkehrer zu behandeln.
/// </summary>
public sealed record RcEventAccessViewResponse(
    string RecipientName, string? PersonalNote, bool FirstOpen,
    IReadOnlyList<RcEventAccessNote> Notes,
    RcEventViewResponse Event);
