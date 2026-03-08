namespace Recreatio.Api.Contracts;

public sealed record PilgrimageCard(
    string Id,
    string Title,
    string Body,
    string? Meta,
    string? Accent);

public sealed record PilgrimageSection(
    string Id,
    string Title,
    string? Lead,
    IReadOnlyList<PilgrimageCard> Cards);

public sealed record PilgrimagePublicConfig(
    string HeroTitle,
    string HeroSubtitle,
    string DateLabel,
    string RouteLabel,
    IReadOnlyList<PilgrimageCard> HeroFacts,
    IReadOnlyList<PilgrimageSection> Sections);

public sealed record PilgrimageZoneConfig(
    IReadOnlyList<PilgrimageSection> Sections);

public sealed record PilgrimageSiteDocument(
    PilgrimagePublicConfig Public,
    PilgrimageZoneConfig Participant,
    PilgrimageZoneConfig Organizer);

public sealed record PilgrimageCreateRequest(
    string Name,
    string Slug,
    string Motto,
    DateOnly StartDate,
    DateOnly EndDate,
    string StartLocation,
    string EndLocation,
    decimal? DistanceKm,
    string Theme,
    PilgrimageSiteDocument Site);

public sealed record PilgrimageSummaryResponse(
    Guid Id,
    string Slug,
    string Name,
    string Motto,
    DateOnly StartDate,
    DateOnly EndDate,
    string StartLocation,
    string EndLocation,
    decimal? DistanceKm,
    string Theme);

public sealed record PilgrimageSiteResponse(
    Guid? Id,
    string Slug,
    string Name,
    string Motto,
    DateOnly StartDate,
    DateOnly EndDate,
    string StartLocation,
    string EndLocation,
    decimal? DistanceKm,
    string Theme,
    PilgrimageSiteDocument Site,
    bool IsProvisioned);

public sealed record PilgrimageRegistrationRequest(
    string FullName,
    string Phone,
    string? Email,
    string? Parish,
    DateOnly? BirthDate,
    bool IsMinor,
    string ParticipationVariant,
    bool NeedsLodging,
    bool NeedsBaggageTransport,
    string EmergencyContactName,
    string EmergencyContactPhone,
    string? HealthNotes,
    string? DietNotes,
    bool AcceptedTerms,
    bool AcceptedRodo,
    bool AcceptedImageConsent);

public sealed record PilgrimageRegistrationResponse(
    Guid ParticipantId,
    string AccessToken,
    string AccessLink,
    DateTimeOffset ExpiresUtc);

public sealed record PilgrimageParticipantProfile(
    Guid ParticipantId,
    string FullName,
    string Phone,
    string? Email,
    string? Parish,
    DateOnly? BirthDate,
    bool IsMinor,
    string ParticipationVariant,
    string? GroupName,
    bool NeedsLodging,
    bool NeedsBaggageTransport,
    string EmergencyContactName,
    string EmergencyContactPhone,
    string? HealthNotes,
    string? DietNotes,
    string RegistrationStatus,
    string PaymentStatus,
    string AttendanceStatus,
    DateTimeOffset CreatedUtc);

public sealed record PilgrimageAnnouncementResponse(
    Guid Id,
    string Audience,
    string Title,
    string Body,
    bool IsCritical,
    DateTimeOffset CreatedUtc);

public sealed record PilgrimageParticipantZoneResponse(
    PilgrimageParticipantProfile Participant,
    PilgrimageZoneConfig Zone,
    IReadOnlyList<PilgrimageAnnouncementResponse> Announcements);

public sealed record PilgrimageOrganizerStatsResponse(
    int Registrations,
    int Confirmed,
    int Paid,
    int WithLodging,
    int OneDay,
    int Minors,
    int OpenTasks,
    int CriticalAnnouncements);

public sealed record PilgrimageOrganizerParticipantRow(
    Guid Id,
    string FullName,
    string Phone,
    string? Email,
    string ParticipationVariant,
    string? GroupName,
    bool NeedsLodging,
    bool NeedsBaggageTransport,
    bool IsMinor,
    string RegistrationStatus,
    string PaymentStatus,
    string AttendanceStatus,
    string EmergencyContactName,
    string EmergencyContactPhone,
    string? HealthNotes,
    string? DietNotes,
    DateTimeOffset CreatedUtc);

public sealed record PilgrimageTaskResponse(
    Guid Id,
    string Title,
    string Description,
    string Status,
    string Priority,
    string Assignee,
    string? Comments,
    string? Attachments,
    DateTimeOffset? DueUtc,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record PilgrimageParticipantIssueResponse(
    Guid Id,
    Guid ParticipantId,
    string ParticipantName,
    string Kind,
    string Message,
    string Status,
    string? ResolutionNote,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record PilgrimageContactInquiryResponse(
    Guid Id,
    string Name,
    string? Phone,
    string? Email,
    string Topic,
    string Message,
    string Status,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record PilgrimageOrganizerDashboardResponse(
    PilgrimageOrganizerStatsResponse Stats,
    IReadOnlyList<PilgrimageOrganizerParticipantRow> Participants,
    IReadOnlyList<PilgrimageAnnouncementResponse> Announcements,
    IReadOnlyList<PilgrimageTaskResponse> Tasks,
    IReadOnlyList<PilgrimageParticipantIssueResponse> Issues,
    IReadOnlyList<PilgrimageContactInquiryResponse> Inquiries,
    PilgrimageZoneConfig Zone);

public sealed record PilgrimageAnnouncementCreateRequest(
    string Audience,
    string Title,
    string Body,
    bool IsCritical);

public sealed record PilgrimageTaskCreateRequest(
    string Title,
    string Description,
    string Status,
    string Priority,
    string Assignee,
    string? Comments,
    string? Attachments,
    DateTimeOffset? DueUtc);

public sealed record PilgrimageTaskUpdateRequest(
    string Title,
    string Description,
    string Status,
    string Priority,
    string Assignee,
    string? Comments,
    string? Attachments,
    DateTimeOffset? DueUtc);

public sealed record PilgrimageParticipantUpdateRequest(
    string RegistrationStatus,
    string PaymentStatus,
    string AttendanceStatus,
    string? GroupName,
    bool? NeedsLodging,
    bool? NeedsBaggageTransport);

public sealed record PilgrimageParticipantIssueCreateRequest(
    string Kind,
    string Message);

public sealed record PilgrimageParticipantIssueUpdateRequest(
    string Status,
    string? ResolutionNote);

public sealed record PilgrimageContactInquiryCreateRequest(
    string Name,
    string? Phone,
    string? Email,
    string Topic,
    string Message);

public sealed record PilgrimageContactInquiryUpdateRequest(
    string Status);
