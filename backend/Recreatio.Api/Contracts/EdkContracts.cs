using System.Text.Json.Serialization;

namespace Recreatio.Api.Contracts;

public sealed record EdkRoutePoint(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("title_pl")] string TitlePl,
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("distance_km")] string DistanceKm);

public sealed record EdkSiteDocument(
    IReadOnlyList<EdkRoutePoint> RoutePoints);

public sealed record EdkSiteResponse(
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
    EdkSiteDocument Site,
    bool IsProvisioned);

public sealed record EdkRegistrationRequest(
    string FullName,
    string Phone,
    string ParticipantStatus,
    string? AdditionalInfo);

public sealed record EdkRegistrationResponse(
    Guid RegistrationId,
    DateTimeOffset SubmittedUtc);

public sealed record EdkOrganizerRegistrationRow(
    Guid Id,
    string FullName,
    string Phone,
    string ParticipantStatus,
    string? AdditionalInfo,
    DateTimeOffset CreatedUtc);

public sealed record EdkOrganizerStatsResponse(
    int Registrations,
    int Adults,
    int MinorsWithGuardian,
    int AdultGuardiansForMinor);

public sealed record EdkOrganizerDashboardResponse(
    EdkOrganizerStatsResponse Stats,
    IReadOnlyList<EdkOrganizerRegistrationRow> Registrations);

public sealed record EdkRegistrationExportResponse(
    Guid EventId,
    string Slug,
    DateTimeOffset ExportedUtc,
    IReadOnlyList<EdkOrganizerRegistrationRow> Rows);
