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

public sealed record RcConfirmationFormResponse(
    string? GroupId, string? GroupName, bool Open, string? IntakePublicKey, int? IntakeEpoch);

/// <summary>
/// Der Portallink steht NUR hier. Er wird nicht gespeichert — nur sein Abdruck.
/// Wer ihn verliert, ohne ein Konto verbunden zu haben, kommt nicht mehr an
/// seine Anmeldung, und die Oberflaeche muss das sagen, bevor jemand die Seite
/// schliesst.
/// </summary>
/// <summary>
/// KEIN Geheimnis in der Antwort. Der Browser hat den Portalzugang selbst
/// gewuerfelt und kennt ihn noch — er baut den Link daraus. Der Server hat ihn
/// nie gehabt und kann ihn deshalb auch nicht verloren haben.
/// </summary>
public sealed record RcCandidateAppliedResponse(string CandidateId);

/// <summary>
/// <c>Fields</c> ist Geheimtext. Der Server kann ihn nicht oeffnen — der
/// Schluessel steht im Link, hinter der Raute, und kommt hier nie an. Erst der
/// Browser des Lesers setzt beides zusammen.
/// </summary>
public sealed record RcCandidatePortalResponse(
    string CandidateId, string GroupName, string ParishSlug, string Status,
    bool PaperReceived, bool Bound,
    IReadOnlyList<RcConfirmationIntake.SealedField> Fields);

public sealed record RcCandidateRevokedResponse(string CandidateId, bool Revoked);

public sealed record RcCandidateBoundResponse(string CandidateId, bool Bound);

public sealed record RcApplicationsOpenResponse(string GroupId, bool Open);
