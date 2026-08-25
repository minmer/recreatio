namespace Rc.Api;

/// <summary>
/// 15.6 — Die Antwortformen von Kapitel 9, mit Namen.
///
/// Siehe <see cref="RcAuthContracts"/> fuer den Grund. Was hier auffaellt: fast
/// jede Antwort dieser Schicht hat ein Feld, das eine <b>Grenze der eigenen
/// Sicht</b> beschreibt — <c>readableEpochs</c>, <c>hasKey</c>,
/// <c>unreadable</c>, <c>youAreHidden</c>. Das ist kein Zufall: eine Plattform,
/// in der jeder nur einen Ausschnitt sieht, muss den Rand des Ausschnitts
/// mitliefern, sonst haelt ihn jemand fuer das Ganze.
/// </summary>
public sealed record RcAreaCreatedResponse(string AreaId, string TenantId, int Epoch, string Title);

public sealed record RcAreasResponse(IReadOnlyList<RcAreas.AreaView> Areas);

public sealed record RcMembersResponse(IReadOnlyList<RcAreas.MemberView> Members);

/// <summary>
/// <c>readsHistory</c> ist die Entscheidung, die beim Aufnehmen faellt: mit
/// <c>false</c> wurde eine neue Epoche geschnitten und der Neue liest die
/// Vergangenheit nicht.
/// </summary>
public sealed record RcMemberAddedResponse(
    string RoleId, string? Capability = null, int Epoch = 0,
    bool ReadsHistory = false, bool AlreadyMember = false);

/// <summary>
/// <c>keptWhatTheyRead</c> steht ausdruecklich in der Antwort: was jemand
/// gelesen HAT, behaelt er, und das laesst sich nicht zurueckholen. So zu tun
/// als ginge es waere die eigentliche Unehrlichkeit.
/// </summary>
public sealed record RcMemberRemovedResponse(string RoleId, int NewEpoch, bool KeptWhatTheyRead);

// -- Nachrichten --------------------------------------------------------------

public sealed record RcMessagePostedResponse(
    string MessageId, int Epoch, int Version, DateTimeOffset PostedUtc,
    DateTimeOffset AppendWindowUntil, bool ChainBound);

/// <summary>
/// 15.9 — <c>readableEpochs</c> sagt dem Leser, wo sein Ausschnitt anfaengt.
/// Ohne diese Angabe waere ein <c>unreadable</c> an einer Nachricht nicht von
/// einem Fehler zu unterscheiden.
/// </summary>
public sealed record RcFeedResponse(
    IReadOnlyList<RcMessages.MessageView> Messages, IReadOnlyList<int> ReadableEpochs);

public sealed record RcMessageEditedResponse(string MessageId, int Version, DateTimeOffset EditedUtc);

/// <summary>
/// 9.17 — <c>reversible</c> unterscheidet die beiden Faelle: durch den Urheber
/// ist endgueltig (Text und Urheber sind fort), durch die Leitung nicht.
/// </summary>
public sealed record RcMessageHiddenResponse(string MessageId, bool Hidden, string Kind, bool Reversible);

// -- Themen -------------------------------------------------------------------

public sealed record RcTopicCreatedResponse(string TopicId, string Title, int Assigned);

public sealed record RcTopicsResponse(IReadOnlyList<RcTopics.TopicView> Topics);

public sealed record RcTopicAssignedResponse(string TopicId, int Assigned);

public sealed record RcTopicClosedResponse(string TopicId, bool Closed);

public sealed record RcTopicLabelsResponse(string TopicId, IReadOnlyList<int> Labels);

// -- Reaktionen, Lesestand, Entwuerfe -----------------------------------------

public sealed record RcReactionResponse(string MessageId, int? Kind);

public sealed record RcReadMarkedResponse(string AreaId, long LastReadSeq);

/// <summary>
/// 9.9.1 — <c>youAreHidden</c> ist die Symmetrie, sichtbar gemacht: wer sich
/// verbirgt, bekommt eine leere Liste UND den Grund dafuer. Ohne den Grund
/// haelt er die leere Liste fuer einen Fehler.
/// </summary>
public sealed record RcReadStateResponse(
    bool EnabledHere, bool YouAreHidden, IReadOnlyList<RcEngagement.ReadStateView> Readers);

public sealed record RcDraftSavedResponse(string AreaId, bool Saved);

public sealed record RcDraftResponse(string AreaId, string? Body, DateTimeOffset? UpdatedAt = null);

// -- Umfragen -----------------------------------------------------------------

public sealed record RcPollCreatedResponse(string PollId, string Question, string Mode, string Reveal);

public sealed record RcPollVotedResponse(string PollId, string VoteId);

public sealed record RcPollsResponse(IReadOnlyList<RcPolls.PollView> Polls);

public sealed record RcPollClosedResponse(string PollId, bool Closed);

// -- Entscheidungen -----------------------------------------------------------

public sealed record RcDecisionCreatedResponse(string DecisionId, string State);

public sealed record RcDecisionTransitionedResponse(string DecisionId, string FromState, string ToState);

public sealed record RcDecisionsResponse(IReadOnlyList<RcDecisions.DecisionView> Decisions);

// -- Anhaenge -----------------------------------------------------------------

public sealed record RcAttachmentUploadedResponse(
    string AttachmentId, string FileName, long SizeBytes, long QuotaUsedBytes, long QuotaBytes);

public sealed record RcAttachmentsResponse(IReadOnlyList<RcAttachments.AttachmentView> Attachments);

public sealed record RcAttachmentDeletedResponse(string AttachmentId, bool Deleted);

// -- Kette --------------------------------------------------------------------

/// <summary>
/// 7.1 — <c>note</c> steht mit in der Antwort, weil der Kopf sonst frueher oder
/// spaeter als Zeitnachweis gelesen wird, der er nicht ist.
/// </summary>
public sealed record RcLedgerHeadResponse(string LedgerId, long Sequence, string Hash, string Note);

public sealed record RcLedgerEntriesResponse(IReadOnlyList<RcLedgerEndpoints.EntryView> Entries);
