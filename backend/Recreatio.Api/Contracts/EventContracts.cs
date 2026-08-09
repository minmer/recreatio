namespace Recreatio.Api.Contracts;

// ── Reader-facing shapes ─────────────────────────────────────────────────────

public sealed record EventPartFieldResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string Label,
    string? HelpText,
    IReadOnlyList<string> Options,
    bool IsRequired,
    bool IsHalfWidth,
    string IdentityRole);

public sealed record EventPartResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string MenuLabel,
    string? Title,
    string? Intro,
    string? ConfigJson,
    string? LayersJson,
    IReadOnlyList<EventPartFieldResponse> Fields);

public sealed record EventPageResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string Slug,
    string Title,
    string MenuLabel,
    string? Description,
    IReadOnlyList<EventPartResponse> Parts);

/// <summary>An entry in the internal page switcher.</summary>
public sealed record EventPageRef(Guid Id, string Slug, string MenuLabel, string Kind);

public sealed record EventSiteHeader(
    Guid Id,
    string Slug,
    string Title,
    string? Subtitle,
    string? DateLabel,
    IReadOnlyList<string> Places,
    string? ThemeJson);

/// <summary>
/// One row of the events overview. Dates are real dates so the client can sort
/// on them; Category, Audience and Places drive the filters.
/// </summary>
public sealed record EventCatalogueEntry(
    Guid Id,
    string Slug,
    string Title,
    string? Summary,
    string? Category,
    string? Audience,
    IReadOnlyList<string> Places,
    string? ThumbnailUrl,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? DateLabel);

/// <summary>The public page of a site.</summary>
public sealed record EventPublicSiteResponse(EventSiteHeader Site, EventPageResponse Page);

/// <summary>
/// What an individual link opens: the site header, the recipient's own details,
/// every page the link may switch to, and the page currently being read.
/// </summary>
public sealed record EventLinkViewResponse(
    EventSiteHeader Site,
    string RecipientName,
    string? PersonalNote,
    IReadOnlyList<EventAssignmentResponse> Assignments,
    IReadOnlyList<EventPageRef> AvailablePages,
    EventPageResponse Page);

public sealed record EventAssignmentResponse(string Label, string Value);

// ── Form submission ──────────────────────────────────────────────────────────

public sealed record EventSubmitValue(Guid FieldId, string? Value);

public sealed record EventSubmitRequest(IReadOnlyList<EventSubmitValue> Values, string? AccessToken);

public sealed record EventSubmitResponse(Guid RegistrationId, DateTimeOffset SubmittedUtc);

// ── Admin ────────────────────────────────────────────────────────────────────

public sealed record EventAdminStatusResponse(bool HasAdmin, bool IsCurrentUserAdmin, string? AdminDisplayName);

public sealed record EventAdminSiteSummary(
    Guid Id,
    string Slug,
    string Title,
    string? Category,
    DateOnly? StartDate,
    bool IsPublished,
    int PageCount,
    int PartCount,
    int LinkCount,
    int RegistrationCount,
    DateTimeOffset UpdatedUtc);

public sealed record EventSiteUpsertRequest(
    string Slug,
    string Title,
    string? Subtitle,
    string? Summary,
    string? Category,
    string? Audience,
    IReadOnlyList<string>? Places,
    string? ThumbnailUrl,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? DateLabel,
    string? ThemeJson,
    bool IsPublished);

/// <summary>The whole event as the editor sees it: every page, every part.</summary>
public sealed record EventAdminSiteResponse(
    EventSiteHeader Site,
    EventCatalogueEntry Catalogue,
    bool IsPublished,
    IReadOnlyList<EventAdminPageResponse> Pages);

public sealed record EventAdminPageResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string Slug,
    string Title,
    string MenuLabel,
    string? Description,
    IReadOnlyList<EventAdminPartResponse> Parts);

public sealed record EventAdminPartResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string MenuLabel,
    string? Title,
    string? Intro,
    string? ConfigJson,
    string? LayersJson,
    bool IsVisible,
    IReadOnlyList<EventPartFieldResponse> Fields);

public sealed record EventPageUpsertRequest(
    string Slug,
    string Title,
    string MenuLabel,
    string? Description);

public sealed record EventPartUpsertRequest(
    string Kind,
    string MenuLabel,
    string? Title,
    string? Intro,
    string? ConfigJson,
    string? LayersJson,
    bool IsVisible);

public sealed record EventReorderRequest(IReadOnlyList<Guid> OrderedIds);

public sealed record EventFieldUpsertRequest(
    string Kind,
    string Label,
    string? HelpText,
    IReadOnlyList<string>? Options,
    bool IsRequired,
    bool IsHalfWidth,
    string IdentityRole);

// ── Registrations and access links ───────────────────────────────────────────

public sealed record EventAdminRegistrationValue(string FieldLabel, string? Value);

public sealed record EventAdminRegistrationRow(
    Guid Id,
    Guid PartId,
    string PartLabel,
    string PageLabel,
    string? ParticipantName,
    string? ParticipantContact,
    DateTimeOffset SubmittedUtc,
    // AccessLinkId is set once this registration has been granted a link.
    Guid? AccessLinkId,
    string? AccessToken,
    IReadOnlyList<EventAdminRegistrationValue> Values);

public sealed record EventAccessLinkUpsertRequest(
    string RecipientName,
    string? RecipientContact,
    string? PersonalNote,
    string? InternalNote,
    IReadOnlyList<Guid>? PageIds,
    IReadOnlyList<EventAssignmentResponse>? Assignments,
    // Present when granting access straight from a registration row.
    Guid? RegistrationId);

public sealed record EventAdminAccessLinkRow(
    Guid Id,
    string Token,
    string RecipientName,
    string? RecipientContact,
    string Status,
    string? PersonalNote,
    string? InternalNote,
    Guid? RegistrationId,
    int ViewCount,
    DateTimeOffset? LastViewedUtc,
    DateTimeOffset CreatedUtc,
    IReadOnlyList<Guid> PageIds,
    IReadOnlyList<EventAssignmentResponse> Assignments);

public sealed record EventStatusRequest(string Status);

/// <summary>
/// Outcome of a bulk import. Warnings list what was skipped and why, so the
/// document can be corrected and re-imported.
/// </summary>
public sealed record EventImportResult(
    Guid SiteId,
    string Slug,
    int PagesCreated,
    int PartsCreated,
    int FieldsCreated,
    IReadOnlyList<string> Warnings);
