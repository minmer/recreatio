namespace Recreatio.Api.Contracts;

// ── Reader-facing shapes ─────────────────────────────────────────────────────

public sealed record Event2PartFieldResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string Label,
    string? HelpText,
    IReadOnlyList<string> Options,
    bool IsRequired,
    bool IsHalfWidth,
    string IdentityRole);

public sealed record Event2PartResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string MenuLabel,
    string? Title,
    string? Intro,
    string? ConfigJson,
    string? LayersJson,
    IReadOnlyList<Event2PartFieldResponse> Fields);

public sealed record Event2PageResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string Slug,
    string Title,
    string MenuLabel,
    string? Description,
    IReadOnlyList<Event2PartResponse> Parts);

/// <summary>An entry in the internal page switcher.</summary>
public sealed record Event2PageRef(Guid Id, string Slug, string MenuLabel, string Kind);

public sealed record Event2SiteHeader(
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
public sealed record Event2CatalogueEntry(
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
public sealed record Event2PublicSiteResponse(Event2SiteHeader Site, Event2PageResponse Page);

/// <summary>
/// What an individual link opens: the site header, the recipient's own details,
/// every page the link may switch to, and the page currently being read.
/// </summary>
public sealed record Event2LinkViewResponse(
    Event2SiteHeader Site,
    string RecipientName,
    string? PersonalNote,
    IReadOnlyList<Event2AssignmentResponse> Assignments,
    IReadOnlyList<Event2PageRef> AvailablePages,
    Event2PageResponse Page);

public sealed record Event2AssignmentResponse(string Label, string Value);

// ── Form submission ──────────────────────────────────────────────────────────

public sealed record Event2SubmitValue(Guid FieldId, string? Value);

public sealed record Event2SubmitRequest(IReadOnlyList<Event2SubmitValue> Values, string? AccessToken);

public sealed record Event2SubmitResponse(Guid RegistrationId, DateTimeOffset SubmittedUtc);

// ── Admin ────────────────────────────────────────────────────────────────────

public sealed record Event2AdminStatusResponse(bool HasAdmin, bool IsCurrentUserAdmin, string? AdminDisplayName);

public sealed record Event2AdminSiteSummary(
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

public sealed record Event2SiteUpsertRequest(
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
public sealed record Event2AdminSiteResponse(
    Event2SiteHeader Site,
    Event2CatalogueEntry Catalogue,
    bool IsPublished,
    IReadOnlyList<Event2AdminPageResponse> Pages);

public sealed record Event2AdminPageResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string Slug,
    string Title,
    string MenuLabel,
    string? Description,
    IReadOnlyList<Event2AdminPartResponse> Parts);

public sealed record Event2AdminPartResponse(
    Guid Id,
    int SortOrder,
    string Kind,
    string MenuLabel,
    string? Title,
    string? Intro,
    string? ConfigJson,
    string? LayersJson,
    bool IsVisible,
    IReadOnlyList<Event2PartFieldResponse> Fields);

public sealed record Event2PageUpsertRequest(
    string Slug,
    string Title,
    string MenuLabel,
    string? Description);

public sealed record Event2PartUpsertRequest(
    string Kind,
    string MenuLabel,
    string? Title,
    string? Intro,
    string? ConfigJson,
    string? LayersJson,
    bool IsVisible);

public sealed record Event2ReorderRequest(IReadOnlyList<Guid> OrderedIds);

public sealed record Event2FieldUpsertRequest(
    string Kind,
    string Label,
    string? HelpText,
    IReadOnlyList<string>? Options,
    bool IsRequired,
    bool IsHalfWidth,
    string IdentityRole);

// ── Registrations and access links ───────────────────────────────────────────

public sealed record Event2AdminRegistrationValue(string FieldLabel, string? Value);

public sealed record Event2AdminRegistrationRow(
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
    IReadOnlyList<Event2AdminRegistrationValue> Values);

public sealed record Event2AccessLinkUpsertRequest(
    string RecipientName,
    string? RecipientContact,
    string? PersonalNote,
    string? InternalNote,
    IReadOnlyList<Guid>? PageIds,
    IReadOnlyList<Event2AssignmentResponse>? Assignments,
    // Present when granting access straight from a registration row.
    Guid? RegistrationId);

public sealed record Event2AdminAccessLinkRow(
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
    IReadOnlyList<Event2AssignmentResponse> Assignments);

public sealed record Event2StatusRequest(string Status);

/// <summary>
/// Outcome of a bulk import. Warnings list what was skipped and why, so the
/// document can be corrected and re-imported.
/// </summary>
public sealed record Event2ImportResult(
    Guid SiteId,
    string Slug,
    int PagesCreated,
    int PartsCreated,
    int FieldsCreated,
    IReadOnlyList<string> Warnings);
