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

// ── Behind an individual link: own submission and participant card ───────────

/// <summary>One answer as it comes back to the person who gave it.</summary>
public sealed record EventOwnValue(Guid FieldId, string? Value);

/// <summary>
/// The person's own registration, returned for correction. The form's field
/// definitions come with it so the page can render exactly the form that was
/// submitted, even if it lives on a page this link cannot otherwise open.
/// </summary>
public sealed record EventOwnRegistrationResponse(
    Guid RegistrationId,
    Guid PartId,
    string PartLabel,
    DateTimeOffset SubmittedUtc,
    DateTimeOffset? UpdatedUtc,
    IReadOnlyList<EventPartFieldResponse> Fields,
    IReadOnlyList<EventOwnValue> Values);

public sealed record EventOwnRegistrationRequest(IReadOnlyList<EventSubmitValue> Values);

public sealed record EventConsentRecord(
    string Code,
    string Label,
    string Text,
    bool Accepted,
    DateTimeOffset? AtUtc);

/// <summary>What the reader sends when signing or correcting their card.</summary>
public sealed record EventParticipantCardRequest(
    IReadOnlyDictionary<string, string?> Data,
    IReadOnlyList<EventConsentRecord> Consents,
    string? ClauseText,
    bool IsMinor,
    string SignerRole,
    string SignerName,
    string? ParticipantName);

public sealed record EventParticipantCardResponse(
    Guid? Id,
    IReadOnlyDictionary<string, string?> Data,
    IReadOnlyList<EventConsentRecord> Consents,
    bool IsMinor,
    string SignerRole,
    string SignerName,
    string? ParticipantName,
    DateTimeOffset? SubmittedUtc,
    DateTimeOffset? UpdatedUtc);

/// <summary>A signed card as the organizer sees it, for the participant list.</summary>
public sealed record EventAdminCardRow(
    Guid Id,
    Guid AccessLinkId,
    string RecipientName,
    string? ParticipantName,
    bool IsMinor,
    string SignerRole,
    string SignerName,
    DateTimeOffset SubmittedUtc,
    DateTimeOffset UpdatedUtc,
    IReadOnlyDictionary<string, string?> Data,
    IReadOnlyList<EventConsentRecord> Consents);

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
    string? SmsTemplate,
    bool IsPublished);

/// <summary>The whole event as the editor sees it: every page, every part.</summary>
public sealed record EventAdminSiteResponse(
    EventSiteHeader Site,
    EventCatalogueEntry Catalogue,
    bool IsPublished,
    string? SmsTemplate,
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
    bool IsHidden,
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
    /// <summary>Set the first time the link was opened — see the entity.</summary>
    DateTimeOffset? ContactVerifiedUtc,
    DateTimeOffset CreatedUtc,
    IReadOnlyList<Guid> PageIds,
    IReadOnlyList<EventAssignmentResponse> Assignments);

public sealed record EventStatusRequest(string Status);

public sealed record EventHiddenRequest(bool Hidden);

public sealed record EventImageResponse(
    Guid Id,
    string FileName,
    string ContentType,
    int ByteSize,
    DateTimeOffset CreatedUtc);

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

// ── Topics: questions and answers between participants ───────────────────────

public sealed record EventTopicRow(
    Guid Id,
    string Title,
    string AuthorName,
    /// <summary>open | closed | disabled — see the entity.</summary>
    string Status,
    DateTimeOffset CreatedUtc,
    DateTimeOffset LastMessageUtc,
    int MessageCount,
    /// <summary>True when the reader's own link opened this topic.</summary>
    bool IsMine);

public sealed record EventTopicMessageRow(
    Guid Id,
    string AuthorName,
    string Body,
    DateTimeOffset CreatedUtc,
    bool IsMine);

public sealed record EventTopicThread(EventTopicRow Topic, IReadOnlyList<EventTopicMessageRow> Messages);

public sealed record EventTopicCreateRequest(string Title, string Body);

public sealed record EventTopicMessageRequest(string Body);

/// <summary>Retitle, close or reopen. Status is ignored when it is not one of the three.</summary>
public sealed record EventTopicUpdateRequest(string? Title, string? Status);

// ── Roster: the participant list as a slide ──────────────────────────────────

/// <summary>
/// One column offered by the roster. <paramref name="Group"/> is what the
/// builder sorts the checkboxes under ("Formularz: Zapisy"), and
/// <paramref name="Filled"/> how many people actually have a value there — a
/// column nobody filled in is worth knowing about before it goes on the table.
/// </summary>
public sealed record EventRosterColumn(string Key, string Label, string Group, int Filled);

public sealed record EventRosterRow(string Key, IReadOnlyDictionary<string, string?> Values);

/// <summary>
/// The table behind one roster part. Columns the organizer switched off are not
/// in <paramref name="Columns"/> and their values are not in the rows — they are
/// dropped here, not in the browser.
/// </summary>
public sealed record EventRosterResponse(
    IReadOnlyList<EventRosterColumn> Columns,
    IReadOnlyList<EventRosterRow> Rows,
    /// <summary>True when the slide has no columns chosen yet, so the reader is told rather than shown an empty table.</summary>
    bool IsUnconfigured,
    /// <summary>Whether THIS reader may write the organizer's own columns — the table asks before it offers a checkbox.</summary>
    bool MayFill,
    /// <summary>Whether this reader is the organizer. Only they are offered the export.</summary>
    bool IsOrganizer);

/// <summary>What the organizer writes onto the list itself — attendance, a note.</summary>
public sealed record EventRosterMarkRequest(string Code, string? Value);

public sealed record EventRosterMarkResponse(
    string RowKey,
    string Code,
    string? Value,
    string? UpdatedBy,
    DateTimeOffset UpdatedUtc);
