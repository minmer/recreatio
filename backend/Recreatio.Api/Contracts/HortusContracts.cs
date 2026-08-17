namespace Recreatio.Api.Contracts;

public sealed record HortusPlaceView(
    Guid? Id,
    string Slug,
    string Name,
    string Motto,
    string Description,
    string AddressLine,
    string ContactName,
    string ContactEmail,
    string ContactPhone,
    string TimeZoneId,
    /// <summary>The same zone as an IANA id, so the browser can format times in the place's own clock.</summary>
    string TimeZoneIana,
    TimeOnly CheckInTime,
    TimeOnly CheckOutTime,
    int DefaultTechnicalMinutes,
    int MinLeadDays,
    bool PublicRequestsEnabled);

public sealed record HortusResourceView(
    Guid Id,
    Guid? ParentId,
    string Slug,
    string Name,
    string Description,
    string Kind,
    string BookingUnit,
    int Capacity,
    int? GuestCapacity,
    int TechnicalMinutesBefore,
    int TechnicalMinutesAfter,
    bool IsPubliclyBookable,
    bool IsActive,
    int SortOrder,
    string ColorToken);

public sealed record HortusSiteResponse(
    HortusPlaceView Place,
    IReadOnlyList<HortusResourceView> Resources,
    bool IsProvisioned);

/// <summary>
/// One busy interval on the calendar. <c>StartUtc</c>/<c>EndUtc</c> is when the group is present,
/// <c>BlockedFromUtc</c>/<c>BlockedUntilUtc</c> widens it by the technical minutes. Public callers
/// get no group name — only that the part is taken.
/// </summary>
public sealed record HortusOccupancyView(
    Guid ResourceId,
    string ResourceSlug,
    Guid? ReservationId,
    string? Code,
    string Status,
    string Kind,
    string? Label,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    DateTimeOffset BlockedFromUtc,
    DateTimeOffset BlockedUntilUtc,
    bool IsExclusive);

public sealed record HortusAvailabilityResponse(
    DateTimeOffset FromUtc,
    DateTimeOffset ToUtc,
    IReadOnlyList<HortusOccupancyView> Occupancies);

/// <summary>
/// A part somebody wants, either as nights (<c>StartDate</c>..<c>EndDate</c>) or as an hour range
/// on <c>StartDate</c>. Times are local to the place.
/// </summary>
public sealed record HortusReservationItemRequest(
    Guid ResourceId,
    string Unit,
    DateOnly StartDate,
    DateOnly? EndDate,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    int? TechnicalMinutesBefore,
    int? TechnicalMinutesAfter,
    string? Note);

public sealed record HortusReservationItemView(
    Guid Id,
    Guid ResourceId,
    string ResourceSlug,
    string ResourceName,
    string Unit,
    DateOnly StartDate,
    DateOnly EndDate,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    int TechnicalMinutesBefore,
    int TechnicalMinutesAfter,
    bool IsExclusive,
    string? Note);

public sealed record HortusConflictView(
    Guid ResourceId,
    string ResourceName,
    string Reason,
    string Message,
    string? BlockingCode,
    string? BlockingStatus,
    DateTimeOffset FromUtc,
    DateTimeOffset UntilUtc);

public sealed record HortusCheckRequest(
    IReadOnlyList<HortusReservationItemRequest> Items,
    Guid? IgnoreReservationId);

public sealed record HortusCheckResponse(
    bool IsAvailable,
    IReadOnlyList<HortusReservationItemView> Items,
    IReadOnlyList<HortusConflictView> Conflicts,
    IReadOnlyList<HortusConflictView> Warnings);

public sealed record HortusRequestSubmission(
    string GroupName,
    string? Organization,
    string ContactName,
    string ContactEmail,
    string ContactPhone,
    int? GuestCount,
    string? PurposeNote,
    IReadOnlyList<HortusReservationItemRequest> Items);

public sealed record HortusRequestSubmissionResponse(
    string Code,
    string Token,
    HortusReservationPublicView Reservation);

public sealed record HortusReservationPublicView(
    string Code,
    string Status,
    string GroupName,
    string ContactName,
    int? GuestCount,
    string? PurposeNote,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? DecidedUtc,
    IReadOnlyList<HortusReservationItemView> Items);

public sealed record HortusReservationView(
    Guid Id,
    string Code,
    string Kind,
    string Status,
    string GroupName,
    string Organization,
    string ContactName,
    string ContactEmail,
    string ContactPhone,
    int? GuestCount,
    string? PurposeNote,
    string? AdminNote,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    DateTimeOffset? DecidedUtc,
    IReadOnlyList<HortusReservationItemView> Items);

public sealed record HortusReservationListResponse(
    IReadOnlyList<HortusReservationView> Reservations,
    int PendingCount);

public sealed record HortusAdminStatusResponse(
    bool HasAdmin,
    bool IsCurrentUserAdmin,
    string? AdminDisplayName,
    bool IsProvisioned);

/// <summary>Admin-side create/edit. <c>Force</c> lets the coordinator overrule a reported conflict.</summary>
public sealed record HortusReservationUpsertRequest(
    string Kind,
    string? Status,
    string GroupName,
    string? Organization,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    int? GuestCount,
    string? PurposeNote,
    string? AdminNote,
    IReadOnlyList<HortusReservationItemRequest> Items,
    bool Force);

public sealed record HortusDecisionRequest(
    string Status,
    string? Note,
    bool Force);

public sealed record HortusResourceUpsertRequest(
    Guid? ParentId,
    string Slug,
    string Name,
    string? Description,
    string Kind,
    string BookingUnit,
    int Capacity,
    int? GuestCapacity,
    int TechnicalMinutesBefore,
    int TechnicalMinutesAfter,
    bool IsPubliclyBookable,
    bool IsActive,
    int SortOrder,
    string? ColorToken);

public sealed record HortusPlaceUpdateRequest(
    string Name,
    string? Motto,
    string? Description,
    string? AddressLine,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? TimeZoneId,
    TimeOnly CheckInTime,
    TimeOnly CheckOutTime,
    int DefaultTechnicalMinutes,
    int MinLeadDays,
    bool PublicRequestsEnabled);
