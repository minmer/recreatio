namespace Recreatio.Api.Contracts;

public sealed record LimanowaPolicyLinksResponse(
    string PrivacyPolicyUrl,
    string EventRulesUrl,
    string ThingsToBringUrl);

public sealed record LimanowaEventSiteResponse(
    Guid? Id,
    string Slug,
    string Title,
    string Subtitle,
    string Tagline,
    DateOnly StartDate,
    DateOnly EndDate,
    int CapacityTotal,
    bool RegistrationOpen,
    DateOnly RegistrationGroupsDeadline,
    DateOnly RegistrationParticipantsDeadline,
    bool Published,
    LimanowaPolicyLinksResponse PolicyLinks,
    bool IsProvisioned);

public sealed record LimanowaGroupRegistrationRequest(
    string ParishName,
    string ResponsibleName,
    string Phone,
    string Email,
    int ExpectedParticipantCount,
    int ExpectedGuardianCount,
    string? Notes);

public sealed record LimanowaGroupRegistrationResponse(
    Guid GroupId,
    string Status,
    DateTimeOffset CreatedAt);

public sealed record LimanowaGroupResponse(
    Guid Id,
    string ParishName,
    string ResponsibleName,
    string Phone,
    string Email,
    int ExpectedParticipantCount,
    int ExpectedGuardianCount,
    string? Notes,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record LimanowaParticipantResponse(
    Guid Id,
    Guid GroupId,
    string FullName,
    string Phone,
    string ParishName,
    string? ParentContactName,
    string? ParentContactPhone,
    string? GuardianName,
    string? GuardianPhone,
    string? Notes,
    string? HealthNotes,
    string? AccommodationType,
    string Status,
    bool RulesAccepted,
    bool PrivacyAccepted,
    DateTimeOffset? ConsentSubmittedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record LimanowaQuestionMessageResponse(
    Guid Id,
    string AuthorType,
    string Message,
    DateTimeOffset CreatedAt);

public sealed record LimanowaQuestionThreadResponse(
    Guid Id,
    string RelatedType,
    Guid RelatedId,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<LimanowaQuestionMessageResponse> Messages);

public sealed record LimanowaAnnouncementResponse(
    Guid Id,
    string Title,
    string Body,
    string AudienceType,
    DateTimeOffset PublishedAt);

public sealed record LimanowaGroupAdminZoneResponse(
    LimanowaEventSiteResponse Event,
    LimanowaGroupResponse Group,
    IReadOnlyList<LimanowaParticipantResponse> Participants,
    IReadOnlyList<LimanowaAnnouncementResponse> Announcements,
    LimanowaQuestionThreadResponse? QuestionThread,
    LimanowaPolicyLinksResponse PolicyLinks);

public sealed record LimanowaParticipantZoneResponse(
    LimanowaEventSiteResponse Event,
    LimanowaGroupResponse Group,
    LimanowaParticipantResponse Participant,
    IReadOnlyList<LimanowaAnnouncementResponse> Announcements,
    LimanowaQuestionThreadResponse? QuestionThread,
    LimanowaPolicyLinksResponse PolicyLinks);

public sealed record LimanowaGroupAdminUpdateRequest(
    string ParishName,
    string ResponsibleName,
    string Phone,
    string Email,
    int ExpectedParticipantCount,
    int ExpectedGuardianCount,
    string? Notes);

public sealed record LimanowaParticipantUpsertRequest(
    string FullName,
    string Phone,
    string ParishName,
    string? ParentContactName,
    string? ParentContactPhone,
    string? GuardianName,
    string? GuardianPhone,
    string? Notes,
    string? HealthNotes,
    string? AccommodationType,
    string? Status);

public sealed record LimanowaParticipantSelfUpdateRequest(
    string FullName,
    string Phone,
    string ParishName,
    string? ParentContactName,
    string? ParentContactPhone,
    string? GuardianName,
    string? GuardianPhone,
    string? Notes,
    string? HealthNotes,
    bool RulesAccepted,
    bool PrivacyAccepted);

public sealed record LimanowaQuestionCreateRequest(
    string Message);

public sealed record LimanowaAdminStatusResponse(
    bool HasAdmin,
    bool IsCurrentUserAdmin,
    string? AdminDisplayName,
    bool LimanowaProvisioned);

public sealed record LimanowaClaimAdminResponse(
    bool Claimed,
    bool AlreadyOwner);

public sealed record LimanowaAdminStatsResponse(
    int Groups,
    int Participants,
    int ParticipantsReady,
    int ParticipantsNeedsFix,
    int AccommodationAssigned,
    int OpenThreads,
    int Announcements);

public sealed record LimanowaAdminDashboardResponse(
    LimanowaEventSiteResponse Event,
    LimanowaAdminStatsResponse Stats,
    IReadOnlyList<LimanowaGroupResponse> Groups,
    IReadOnlyList<LimanowaParticipantResponse> Participants,
    IReadOnlyList<LimanowaAnnouncementResponse> Announcements,
    IReadOnlyList<LimanowaQuestionThreadResponse> QuestionThreads,
    LimanowaPolicyLinksResponse PolicyLinks);

public sealed record LimanowaAdminEventSettingsUpdateRequest(
    string Title,
    string Subtitle,
    string Tagline,
    int CapacityTotal,
    bool RegistrationOpen,
    DateOnly RegistrationGroupsDeadline,
    DateOnly RegistrationParticipantsDeadline,
    bool Published,
    string PrivacyPolicyUrl,
    string EventRulesUrl,
    string ThingsToBringUrl);

public sealed record LimanowaGroupStatusUpdateRequest(
    string Status);

public sealed record LimanowaParticipantStatusUpdateRequest(
    string Status);

public sealed record LimanowaAccommodationUpdateRequest(
    string Type,
    string? Note);

public sealed record LimanowaAnnouncementCreateRequest(
    string Title,
    string Body,
    string AudienceType);

public sealed record LimanowaAdminQuestionReplyRequest(
    string Message,
    string? Status);

public sealed record LimanowaAccessLinkResponse(
    Guid AccessId,
    string Token,
    string Link,
    string SmsHref,
    DateTimeOffset SentAt);
