namespace Rc.Api;

/* ---------------------------------------------------------------------------
   Antworten der Firmung.
   --------------------------------------------------------------------------- */

public sealed record RcConfirmationGroupCreatedResponse(string GroupId, string Name);

public sealed record RcConfirmationGroupsResponse(
    IReadOnlyList<RcConfirmation.GroupSummary> Groups);

public sealed record RcCandidateCreatedResponse(string CandidateId, string Name);

/// <summary>
/// Die Kandidaten eines Jahrgangs.
///
/// Ein Kandidat, den der Leser nicht oeffnen kann, faellt NICHT aus der Liste
/// (15.9). Dass jemand da ist, den man nicht lesen kann, ist eine Auskunft;
/// ein Loch ist keine — und die Zahlen des Jahrgangs stimmten dann nicht mehr.
/// </summary>
public sealed record RcCandidatesResponse(IReadOnlyList<RcConfirmation.CandidateView> Candidates);

public sealed record RcCandidateNoteAddedResponse(string NoteId, bool ForFamily);

public sealed record RcCandidateWithdrawnResponse(string CandidateId, bool Withdrawn);

public sealed record RcMeetingSlotCreatedResponse(
    string SlotId, DateTimeOffset StartsUtc, int Capacity);

public sealed record RcMeetingSlotsResponse(IReadOnlyList<RcConfirmation.SlotView> Slots);

/// <summary>
/// <c>booked</c> und <c>capacity</c> kommen zurueck, damit die Oberflaeche den
/// Stand zeigen kann, ohne noch einmal zu fragen — und damit sichtbar wird,
/// dass der Platz WIRKLICH belegt wurde und nicht nur angefragt.
/// </summary>
public sealed record RcMeetingBookedResponse(
    string SlotId, string CandidateId, int Booked, int Capacity);
