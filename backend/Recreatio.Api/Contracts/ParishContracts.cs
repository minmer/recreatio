namespace Recreatio.Api.Contracts;

public sealed record ParishLayoutPosition(
    int Row,
    int Col);

public sealed record ParishLayoutSize(
    int ColSpan,
    int RowSpan);

public sealed record ParishLayoutFrame(
    ParishLayoutPosition Position,
    ParishLayoutSize Size);

public sealed class ParishLayoutItem
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public Dictionary<string, ParishLayoutFrame>? Layouts { get; init; }
    public ParishLayoutPosition? Position { get; init; }
    public ParishLayoutSize? Size { get; init; }
    public Dictionary<string, string>? Props { get; init; }
}

public sealed record ParishSacramentSection(
    string Title,
    string Body);

public sealed record ParishSacramentParishPage(
    string Title,
    string Lead,
    string? Notice,
    IReadOnlyList<ParishSacramentSection> Sections);

public sealed record ParishHomepageConfig(
    IReadOnlyList<ParishLayoutItem> Modules,
    Dictionary<string, ParishSacramentParishPage>? SacramentParishPages = null);

public sealed record ParishCreateRequest(
    string Name,
    string Location,
    string Slug,
    string Theme,
    string? HeroImageUrl,
    ParishHomepageConfig Homepage);

public sealed record ParishSummaryResponse(
    Guid Id,
    string Slug,
    string Name,
    string Location,
    string Theme,
    string? HeroImageUrl);

public sealed record ParishSiteResponse(
    Guid Id,
    string Slug,
    string Name,
    string Location,
    string Theme,
    string? HeroImageUrl,
    ParishHomepageConfig Homepage);

public sealed record ParishIntentionsPublicResponse(
    Guid Id,
    DateTimeOffset MassDateTime,
    string ChurchName,
    string PublicText,
    string Status);

public sealed record ParishMassPublicResponse(
    Guid Id,
    DateTimeOffset MassDateTime,
    string ChurchName,
    string Title,
    string? Note,
    bool IsCollective,
    int? DurationMinutes,
    string? Kind,
    string? BeforeService,
    string? AfterService,
    string? IntentionsJson,
    string? DonationSummary);

public sealed record ParishMassIntentionInput(
    string Text,
    string? Donation);

public sealed record ParishIntentionCreateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string PublicText,
    string? InternalText,
    string? DonorReference,
    string Status);

public sealed record ParishIntentionUpdateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string PublicText,
    string? InternalText,
    string? DonorReference,
    string Status);

public sealed record ParishMassCreateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string Title,
    string? Note,
    bool IsCollective,
    int? DurationMinutes,
    string? Kind,
    string? BeforeService,
    string? AfterService,
    IReadOnlyList<ParishMassIntentionInput>? Intentions,
    string? DonationSummary);

public sealed record ParishMassUpdateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string Title,
    string? Note,
    bool IsCollective,
    int? DurationMinutes,
    string? Kind,
    string? BeforeService,
    string? AfterService,
    IReadOnlyList<ParishMassIntentionInput>? Intentions,
    string? DonationSummary);

public sealed record ParishMassRuleNode(
    string Id,
    string Type,
    string? NextId,
    string? ElseId,
    Dictionary<string, string>? Config);

public sealed record ParishMassRuleGraph(
    string StartNodeId,
    IReadOnlyList<ParishMassRuleNode> Nodes,
    Dictionary<string, string>? Metadata);

public sealed record ParishMassRuleResponse(
    Guid Id,
    string Name,
    string? Description,
    ParishMassRuleGraph Graph,
    DateTimeOffset UpdatedUtc);

public sealed record ParishMassRuleUpsertRequest(
    string Name,
    string? Description,
    ParishMassRuleGraph Graph);

public sealed record ParishMassRuleSimulationRequest(
    DateOnly FromDate,
    DateOnly ToDate,
    bool IncludeExisting);

public sealed record ParishMassRuleApplyRequest(
    DateOnly FromDate,
    DateOnly ToDate,
    bool ReplaceExisting);

public sealed record ParishOfferingCreateRequest(
    Guid IntentionId,
    string Amount,
    string Currency,
    DateTimeOffset Date,
    string? DonorReference);

public sealed record ParishSiteConfigUpdateRequest(
    ParishHomepageConfig Homepage,
    bool IsPublished);

public sealed record ParishConfirmationCandidateCreateRequest(
    string Name,
    string Surname,
    IReadOnlyList<string> PhoneNumbers,
    string Address,
    string SchoolShort,
    bool AcceptedRodo);

public sealed record ParishConfirmationPhoneVerifyRequest(
    string Token);

public sealed record ParishConfirmationPhoneResponse(
    int Index,
    string Number,
    bool IsVerified,
    DateTimeOffset? VerifiedUtc,
    string VerificationToken);

public sealed record ParishConfirmationCandidateResponse(
    Guid Id,
    string Name,
    string Surname,
    IReadOnlyList<ParishConfirmationPhoneResponse> PhoneNumbers,
    string Address,
    string SchoolShort,
    bool AcceptedRodo,
    bool PaperConsentReceived,
    DateTimeOffset CreatedUtc,
    string MeetingToken,
    Guid? MeetingSlotId);

public sealed record ParishConfirmationExportPhoneResponse(
    int Index,
    string Number,
    bool IsVerified,
    DateTimeOffset? VerifiedUtc,
    string VerificationToken,
    DateTimeOffset? CreatedUtc);

public sealed record ParishConfirmationExportCandidateResponse(
    string Name,
    string Surname,
    IReadOnlyList<ParishConfirmationExportPhoneResponse> PhoneNumbers,
    string Address,
    string SchoolShort,
    bool AcceptedRodo,
    bool PaperConsentReceived,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    string? MeetingToken,
    Guid? MeetingSlotId);

public sealed record ParishConfirmationExportPhoneVerificationResponse(
    Guid Id,
    Guid CandidateId,
    int PhoneIndex,
    string VerificationToken,
    DateTimeOffset? VerifiedUtc,
    DateTimeOffset CreatedUtc);

public sealed record ParishConfirmationExportMeetingSlotResponse(
    Guid Id,
    DateTimeOffset StartsAtUtc,
    int DurationMinutes,
    int Capacity,
    string? Label,
    string Stage,
    Guid? HostCandidateId,
    string? HostInviteCode,
    DateTimeOffset? HostInviteExpiresUtc,
    bool IsActive,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record ParishConfirmationExportMeetingLinkResponse(
    Guid Id,
    Guid CandidateId,
    string BookingToken,
    Guid? SlotId,
    DateTimeOffset? BookedUtc,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record ParishConfirmationExportMessageResponse(
    Guid Id,
    Guid CandidateId,
    string SenderType,
    string MessageText,
    DateTimeOffset CreatedUtc);

public sealed record ParishConfirmationExportNoteResponse(
    Guid Id,
    Guid CandidateId,
    string NoteText,
    bool IsPublic,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record ParishConfirmationExportCelebrationResponse(
    Guid Id,
    string Name,
    string ShortInfo,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset EndsAtUtc,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record ParishConfirmationExportCelebrationParticipationResponse(
    Guid Id,
    Guid CandidateId,
    string? CandidateMeetingToken,
    Guid CelebrationId,
    string CommentText,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record ParishConfirmationExportResponse(
    int Version,
    Guid ParishId,
    DateTimeOffset ExportedUtc,
    IReadOnlyList<ParishConfirmationExportCandidateResponse> Candidates,
    IReadOnlyList<ParishConfirmationExportPhoneVerificationResponse> PhoneVerifications,
    IReadOnlyList<ParishConfirmationExportMeetingSlotResponse> MeetingSlots,
    IReadOnlyList<ParishConfirmationExportMeetingLinkResponse> MeetingLinks,
    IReadOnlyList<ParishConfirmationExportMessageResponse> Messages,
    IReadOnlyList<ParishConfirmationExportNoteResponse> Notes,
    IReadOnlyList<ParishConfirmationExportCelebrationResponse> Celebrations,
    IReadOnlyList<ParishConfirmationExportCelebrationParticipationResponse> CelebrationParticipations);

public sealed record ParishConfirmationImportPhoneRequest(
    string Number,
    string? VerificationToken,
    DateTimeOffset? VerifiedUtc,
    DateTimeOffset? CreatedUtc);

public sealed record ParishConfirmationImportCandidateRequest(
    string Name,
    string Surname,
    IReadOnlyList<ParishConfirmationImportPhoneRequest> PhoneNumbers,
    string Address,
    string SchoolShort,
    bool AcceptedRodo,
    bool PaperConsentReceived,
    DateTimeOffset? CreatedUtc,
    DateTimeOffset? UpdatedUtc,
    string? MeetingToken);

public sealed record ParishConfirmationImportCelebrationRequest(
    Guid? ExternalId,
    string Name,
    string ShortInfo,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset EndsAtUtc,
    string Description,
    bool IsActive,
    DateTimeOffset? CreatedUtc,
    DateTimeOffset? UpdatedUtc);

public sealed record ParishConfirmationImportCelebrationParticipationRequest(
    string? CandidateMeetingToken,
    Guid? CelebrationExternalId,
    string CommentText,
    DateTimeOffset? CreatedUtc,
    DateTimeOffset? UpdatedUtc);

public sealed record ParishConfirmationImportRequest(
    IReadOnlyList<ParishConfirmationImportCandidateRequest> Candidates,
    bool ReplaceExisting,
    IReadOnlyList<ParishConfirmationImportCelebrationRequest>? Celebrations = null,
    IReadOnlyList<ParishConfirmationImportCelebrationParticipationRequest>? CelebrationParticipations = null);

public sealed record ParishConfirmationImportResponse(
    int ImportedCandidates,
    int ImportedPhoneNumbers,
    int SkippedCandidates,
    bool ReplaceExisting);

public sealed record ParishConfirmationMeetingSlotCreateRequest(
    DateTimeOffset StartsAtUtc,
    int DurationMinutes,
    int Capacity,
    string? Label,
    string? Stage);

public sealed record ParishConfirmationMeetingSlotCandidateResponse(
    Guid CandidateId,
    string Name,
    string Surname);

public sealed record ParishConfirmationMeetingSlotResponse(
    Guid Id,
    DateTimeOffset StartsAtUtc,
    int DurationMinutes,
    int Capacity,
    string? Label,
    string Stage,
    bool IsActive,
    int ReservedCount,
    IReadOnlyList<ParishConfirmationMeetingSlotCandidateResponse> Candidates);

public sealed record ParishConfirmationMeetingSummaryResponse(
    IReadOnlyList<ParishConfirmationMeetingSlotResponse> Slots,
    int UnassignedCount);

public sealed record ParishConfirmationMeetingAvailabilityRequest(
    string Token,
    string? InviteCode);

public sealed record ParishConfirmationMeetingPublicSlotResponse(
    Guid Id,
    DateTimeOffset StartsAtUtc,
    int DurationMinutes,
    int Capacity,
    string? Label,
    string Stage,
    int ReservedCount,
    bool IsAvailable,
    bool RequiresInviteCode,
    bool IsSelected,
    string VisualStatus);

public sealed record ParishConfirmationMeetingJoinRequestResponse(
    Guid Id,
    Guid SlotId,
    Guid CandidateId,
    string CandidateName,
    string CandidateSurname,
    DateTimeOffset CreatedUtc,
    string Status);

public sealed record ParishConfirmationMeetingAvailabilityResponse(
    Guid CandidateId,
    string CandidateName,
    bool PaperConsentReceived,
    Guid? SelectedSlotId,
    DateTimeOffset? BookedUtc,
    bool CanInviteToSelectedSlot,
    string? SelectedSlotInviteCode,
    DateTimeOffset? SelectedSlotInviteExpiresUtc,
    IReadOnlyList<ParishConfirmationMeetingJoinRequestResponse> PendingJoinRequests,
    IReadOnlyList<ParishConfirmationMeetingPublicSlotResponse> Slots);

public sealed record ParishConfirmationMeetingBookRequest(
    string Token,
    Guid SlotId,
    string? InviteCode);

public sealed record ParishConfirmationMeetingBookResponse(
    string Status,
    Guid? SlotId,
    DateTimeOffset? BookedUtc);

public sealed record ParishConfirmationCandidateUpdateRequest(
    string Name,
    string Surname,
    IReadOnlyList<string> PhoneNumbers,
    string Address,
    string SchoolShort);

public sealed record ParishConfirmationCandidatePaperConsentUpdateRequest(
    bool PaperConsentReceived);

public sealed record ParishConfirmationCandidateMergeRequest(
    Guid TargetCandidateId,
    Guid SourceCandidateId,
    string Name,
    string Surname,
    IReadOnlyList<string> PhoneNumbers,
    string Address,
    string SchoolShort,
    Guid? SelectedMeetingSlotId,
    Guid? PortalTokenFromCandidateId);

public sealed record ParishConfirmationCandidateMergeResponse(
    Guid CandidateId,
    Guid RemovedCandidateId);

public sealed record ParishConfirmationMessageCreateRequest(
    string MessageText);

public sealed record ParishConfirmationNoteCreateRequest(
    string NoteText,
    bool IsPublic);

public sealed record ParishConfirmationMessageResponse(
    Guid Id,
    string SenderType,
    string MessageText,
    DateTimeOffset CreatedUtc);

public sealed record ParishConfirmationNoteResponse(
    Guid Id,
    string NoteText,
    bool IsPublic,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record ParishConfirmationAggregatedNoteResponse(
    Guid Id,
    Guid CandidateId,
    string CandidateName,
    string CandidateSurname,
    string NoteText,
    bool IsPublic,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record ParishConfirmationAggregatedMessageResponse(
    Guid Id,
    Guid CandidateId,
    string CandidateName,
    string CandidateSurname,
    string SenderType,
    string MessageText,
    DateTimeOffset CreatedUtc);

public sealed record ParishConfirmationPortalCandidateDataResponse(
    Guid CandidateId,
    string Name,
    string Surname,
    IReadOnlyList<ParishConfirmationPhoneResponse> PhoneNumbers,
    string Address,
    string SchoolShort,
    bool PaperConsentReceived,
    string PortalToken,
    Guid? SelectedSlotId,
    DateTimeOffset? BookedUtc,
    bool CanInviteToSelectedSlot,
    string? SelectedSlotInviteCode,
    DateTimeOffset? SelectedSlotInviteExpiresUtc);

public sealed record ParishConfirmationCelebrationResponse(
    Guid Id,
    string Name,
    string ShortInfo,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset EndsAtUtc,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    string? CandidateComment,
    DateTimeOffset? CandidateCommentUpdatedUtc);

public sealed record ParishConfirmationPortalResponse(
    ParishConfirmationPortalCandidateDataResponse Candidate,
    IReadOnlyList<ParishConfirmationMeetingPublicSlotResponse> FirstYearStartSlots,
    IReadOnlyList<ParishConfirmationMeetingJoinRequestResponse> PendingJoinRequests,
    string SecondMeetingAnnouncement,
    IReadOnlyList<ParishConfirmationCelebrationResponse> UpcomingCelebrations,
    IReadOnlyList<ParishConfirmationMessageResponse> Messages,
    IReadOnlyList<ParishConfirmationNoteResponse> PublicNotes,
    IReadOnlyList<ParishConfirmationNoteResponse>? PrivateNotes);

public sealed record ParishConfirmationPortalRequest(
    string Token,
    string? InviteCode);

public sealed record ParishConfirmationMeetingReleaseHostRequest(
    string Token);

public sealed record ParishConfirmationMeetingReleaseHostResponse(
    string Status,
    Guid? SlotId);

public sealed record ParishConfirmationMeetingResignRequest(
    string Token);

public sealed record ParishConfirmationMeetingResignResponse(
    string Status,
    Guid? SlotId);

public sealed record ParishConfirmationMeetingJoinRequestCreateRequest(
    string Token,
    Guid SlotId);

public sealed record ParishConfirmationMeetingJoinRequestCreateResponse(
    string Status,
    Guid? RequestId);

public sealed record ParishConfirmationMeetingJoinRequestDecisionRequest(
    string Token,
    Guid RequestId,
    string Decision);

public sealed record ParishConfirmationMeetingJoinRequestDecisionResponse(
    string Status,
    Guid? RequestId,
    Guid? CandidateId);

public sealed record ParishConfirmationPortalMessageCreateRequest(
    string Token,
    string MessageText);

public sealed record ParishConfirmationCelebrationCreateRequest(
    string Name,
    string ShortInfo,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset EndsAtUtc,
    string Description,
    bool IsActive);

public sealed record ParishConfirmationCelebrationCommentCreateRequest(
    string Token,
    Guid CelebrationId,
    string CommentText);
