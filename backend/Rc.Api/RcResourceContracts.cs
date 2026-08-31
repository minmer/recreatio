namespace Rc.Api;

/// <summary>
/// Die Antwortformen der Belegung.
///
/// <b>Was hier NICHT steht, ist der Punkt.</b> <see cref="RcBusyPeriodView"/>
/// hat kein Feld fuer Gruppe, Zweck oder Kontakt — nicht leer gelassen,
/// sondern nicht vorhanden. Ein Feld, das es gibt, wird irgendwann gefuellt,
/// und dann steht der Name der Firmgruppe im oeffentlichen Belegungsplan.
/// </summary>
public sealed record RcResourceCreatedResponse(string ResourceId, string Slug);

/// <summary>
/// Was ueber ein Haus oeffentlich bekannt ist.
///
/// <paramref name="IntakePublicKey"/> reist mit, weil das Anfrageformular es
/// braucht: die Gruppe versiegelt damit im Browser, bevor irgendetwas den
/// Dienst erreicht.
/// </summary>
public sealed record RcResourceView(
    string ResourceId,
    string Slug,
    string Title,
    string TimeZone,
    int? Capacity,
    string? IntakePublicKey);

public sealed record RcResourcesResponse(IReadOnlyList<RcResourceView> Resources);

/// <summary>Ein belegter Zeitraum — Anfang, Ende, Zustand. Mehr gibt es nicht.</summary>
public sealed record RcBusyPeriodView(string From, string To, string State);

public sealed record RcFreeBusyResponse(
    string ResourceId,
    string TimeZone,
    IReadOnlyList<RcBusyPeriodView> Periods);

public sealed record RcHoldCreatedResponse(string HoldId, string State, DateTimeOffset? ExpiresUtc);

public sealed record RcHoldConfirmedResponse(string HoldId, string State);

public sealed record RcEnquirySentResponse(string EnquiryId, bool Received);

/// <summary>
/// Eine Anfrage, wie sie der Hausherr sieht.
///
/// <paramref name="Unreadable"/> statt Weglassen (15.9): eine Anfrage, die
/// sich nicht oeffnen laesst, verschwindet nicht aus der Liste. Sonst wartet
/// jemand auf eine Antwort, von der niemand weiss, dass sie aussteht.
/// </summary>
public sealed record RcEnquiryView(
    string EnquiryId,
    string From,
    string To,
    int? People,
    string State,
    DateTimeOffset ReceivedUtc,
    string? GroupName,
    string? ContactPerson,
    string? Contact,
    string? GroupKind,
    string? Note,
    string? Unreadable);

public sealed record RcEnquiriesResponse(IReadOnlyList<RcEnquiryView> Enquiries);
