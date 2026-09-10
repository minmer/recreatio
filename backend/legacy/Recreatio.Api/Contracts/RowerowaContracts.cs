namespace Recreatio.Api.Contracts;

public sealed record RowerowaSiteResponse(
    Guid? Id,
    string Slug,
    string Name,
    string Motto,
    DateOnly StartDate,
    DateOnly EndDate,
    string StartLocation,
    string EndLocation,
    string OrganizerName,
    string OrganizerEmail,
    string OrganizerPhone,
    bool IsProvisioned);

public sealed record RowerowaRegistrationRequest(
    string FullName,
    string Phone,
    string Email,
    string JoinPoint,
    string FridayAccommodation,
    IReadOnlyList<string> Meals,
    string PostPilgrimagePlan,
    string BikeReturn,
    string LuggageDropoff,
    string LuggagePickup,
    bool HasHelmet,
    bool BikeRoadworthy,
    bool KnowsSafetyRules,
    string SkillLevel,
    string? HelpOffer);

public sealed record RowerowaRegistrationResponse(
    Guid RegistrationId,
    DateTimeOffset SubmittedUtc);

public sealed record RowerowaOrganizerRegistrationRow(
    Guid Id,
    string FullName,
    string Phone,
    string Email,
    string JoinPoint,
    string FridayAccommodation,
    IReadOnlyList<string> Meals,
    string PostPilgrimagePlan,
    string BikeReturn,
    string LuggageDropoff,
    string LuggagePickup,
    bool HasHelmet,
    bool BikeRoadworthy,
    bool KnowsSafetyRules,
    string SkillLevel,
    string? HelpOffer,
    DateTimeOffset CreatedUtc);

public sealed record RowerowaOrganizerStatsResponse(
    int Registrations,
    int JoiningFromKrakow,
    int StayingHostelFriday);

public sealed record RowerowaOrganizerDashboardResponse(
    RowerowaOrganizerStatsResponse Stats,
    IReadOnlyList<RowerowaOrganizerRegistrationRow> Registrations);

public sealed record RowerowaRegistrationExportResponse(
    Guid EventId,
    string Slug,
    DateTimeOffset ExportedUtc,
    IReadOnlyList<RowerowaOrganizerRegistrationRow> Rows);
