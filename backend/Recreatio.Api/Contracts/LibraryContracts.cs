namespace Recreatio.Api.Contracts.Library;

// Contracts follow the two layers of the model. Anything named Work, Expression,
// Manifestation or Quote belongs to the citation layer; Item, Shelf and
// PlacementGroup belong to the physical layer.

// ── Registries ──────────────────────────────────────────────────────────────

public sealed record LibraryPersonSaveRequest(
    string DisplayName,
    string? SortName,
    int? BirthYear,
    int? DeathYear,
    string? Nationality,
    string? Notes
);

public sealed record LibraryPersonResponse(
    long Id,
    string DisplayName,
    string? SortName,
    int? BirthYear,
    int? DeathYear,
    string? Nationality,
    string? Notes,
    int ContributionCount
);

public sealed record LibraryPublisherSaveRequest(string Name, string? City, string? Notes);

public sealed record LibraryPublisherResponse(
    long Id,
    string Name,
    string? City,
    string? Notes,
    int ManifestationCount
);

public sealed record LibraryShelfSaveRequest(
    string Name,
    string? Location,
    string? Description,
    int SortOrder,
    int? HeightMm,
    int? DepthMm,
    int? WidthMm
);

public sealed record LibraryShelfResponse(
    long Id,
    string Name,
    string? Location,
    string? Description,
    int SortOrder,
    int? HeightMm,
    int? DepthMm,
    int? WidthMm,
    int ItemCount
);

public sealed record LibraryTagSaveRequest(string Name, string? Color);

public sealed record LibraryTagResponse(long Id, string Name, string? Color, int WorkCount, int QuoteCount);

public sealed record LibraryPlacementGroupSaveRequest(string Name, string GroupKind, string? Notes);

public sealed record LibraryPlacementGroupResponse(
    long Id,
    string Name,
    string GroupKind,
    string? Notes,
    int ItemCount
);

// ── Contributions ───────────────────────────────────────────────────────────

public sealed record LibraryContributionSaveItem(long PersonId, string Role);

public sealed record LibraryContributionsSaveRequest(IReadOnlyList<LibraryContributionSaveItem> Contributions);

public sealed record LibraryContributionResponse(
    long Id,
    long PersonId,
    string PersonName,
    string Role,
    int SortOrder
);

// ── Work ────────────────────────────────────────────────────────────────────

public sealed record LibraryWorkSaveRequest(
    string OriginalTitle,
    string? OriginalSubtitle,
    string OriginalLanguage,
    string? UniformTitle,
    string Kind,
    string CitationScheme,
    string? StructureTemplateJson,
    string? CitationSigil,
    int? FirstPublishedYear,
    string? Notes
);

public sealed record LibraryWorkListItem(
    long Id,
    string OriginalTitle,
    string? OriginalSubtitle,
    string OriginalLanguage,
    string? UniformTitle,
    string Kind,
    string CitationScheme,
    int? FirstPublishedYear,
    IReadOnlyList<string> Authors,
    IReadOnlyList<string> ExpressionLanguages,
    IReadOnlyList<LibraryTagResponse> Tags,
    int ExpressionCount,
    int ManifestationCount,
    int ItemCount,
    int QuoteCount
);

public sealed record LibraryWorkListResponse(IReadOnlyList<LibraryWorkListItem> Items, int Total);

public sealed record LibraryWorkDetailResponse(
    long Id,
    string OriginalTitle,
    string? OriginalSubtitle,
    string OriginalLanguage,
    string? UniformTitle,
    string Kind,
    string CitationScheme,
    string? StructureTemplateJson,
    string? CitationSigil,
    int? FirstPublishedYear,
    string? Notes,
    IReadOnlyList<LibraryContributionResponse> Contributions,
    IReadOnlyList<long> TagIds,
    IReadOnlyList<LibraryExpressionListItem> Expressions,
    IReadOnlyList<LibraryManifestationListItem> Manifestations,
    int QuoteCount,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record LibraryWorkTagsSaveRequest(IReadOnlyList<long> TagIds);

// ── Expression ──────────────────────────────────────────────────────────────

public sealed record LibraryExpressionSaveRequest(
    string Language,
    string? Name,
    string? Notes
);

public sealed record LibraryExpressionListItem(
    long Id,
    long WorkId,
    string Language,
    string? Name,
    // True when this language version differs from the work's original language.
    bool IsTranslation,
    IReadOnlyList<string> Translators,
    int ManifestationCount
);

public sealed record LibraryExpressionDetailResponse(
    long Id,
    long WorkId,
    string WorkTitle,
    string WorkOriginalLanguage,
    string Language,
    string? Name,
    bool IsTranslation,
    string? Notes,
    IReadOnlyList<LibraryContributionResponse> Contributions,
    IReadOnlyList<LibraryManifestationListItem> Manifestations,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

// ── Manifestation ───────────────────────────────────────────────────────────

public sealed record LibraryManifestationSaveRequest(
    long? ExpressionId,
    string Format,
    string Title,
    string? Subtitle,
    long? PublisherId,
    string? PublishedPlace,
    int? PublishedYear,
    string? EditionStatement,
    string? Series,
    string? SeriesNumber,
    string? Isbn,
    string? Issn,
    int? PageCount,
    string? Volume,
    string? Binding,
    string? Url,
    string? OriginalTextUrl,
    string? CoverImageUrl,
    int? HeightMm,
    int? WidthMm,
    int? DepthMm,
    string? Notes
);

public sealed record LibraryManifestationListItem(
    long Id,
    long? WorkId,
    long? ExpressionId,
    string? ExpressionName,
    string? ExpressionLanguage,
    string Format,
    string Title,
    string? Subtitle,
    long? PublisherId,
    string? PublisherName,
    string? PublishedPlace,
    int? PublishedYear,
    string? EditionStatement,
    string? Isbn,
    int? PageCount,
    string? Binding,
    string? Url,
    string? CoverImageUrl,
    int? HeightMm,
    int? WidthMm,
    int? DepthMm,
    int ItemCount
);

public sealed record LibraryManifestationDetailResponse(
    long Id,
    long WorkId,
    string WorkTitle,
    string WorkOriginalLanguage,
    string WorkCitationScheme,
    long? ExpressionId,
    string? ExpressionName,
    string? ExpressionLanguage,
    string Format,
    string Title,
    string? Subtitle,
    long? PublisherId,
    string? PublisherName,
    string? PublishedPlace,
    int? PublishedYear,
    string? EditionStatement,
    string? Series,
    string? SeriesNumber,
    string? Isbn,
    string? Issn,
    int? PageCount,
    string? Volume,
    string? Binding,
    string? Url,
    string? OriginalTextUrl,
    string? CoverImageUrl,
    int? HeightMm,
    int? WidthMm,
    int? DepthMm,
    string? Notes,
    IReadOnlyList<LibraryContributionResponse> Contributions,
    IReadOnlyList<LibraryItemResponse> Items,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

// ── Item (physical) ─────────────────────────────────────────────────────────

public sealed record LibraryItemSaveRequest(
    long? ShelfId,
    long? PlacementGroupId,
    int? PositionInShelf,
    int? SeriesPosition,
    string? Signature,
    string Status,
    string? Condition,
    DateOnly? AcquiredDate,
    string? AcquiredFrom,
    decimal? Price,
    string? Currency,
    string? Barcode,
    string ReadingStatus,
    int? Rating,
    bool IsFavourite,
    string? ScanImageUrl,
    string? Notes
);

public sealed record LibraryItemResponse(
    long Id,
    long ManifestationId,
    long? ShelfId,
    string? ShelfName,
    long? PlacementGroupId,
    string? PlacementGroupName,
    int? PositionInShelf,
    int? SeriesPosition,
    string? Signature,
    string Status,
    string? Condition,
    DateOnly? AcquiredDate,
    string? AcquiredFrom,
    decimal? Price,
    string? Currency,
    string? Barcode,
    string ReadingStatus,
    int? Rating,
    bool IsFavourite,
    string? ScanImageUrl,
    string? Notes,
    LibraryLoanResponse? OpenLoan
);

public sealed record LibraryItemListItem(
    long Id,
    long ManifestationId,
    long WorkId,
    string ManifestationTitle,
    string WorkTitle,
    string? Language,
    bool IsTranslation,
    IReadOnlyList<string> Authors,
    string? PublisherName,
    int? PublishedYear,
    long? ShelfId,
    string? ShelfName,
    int? PositionInShelf,
    string? Signature,
    string Status,
    string? Condition,
    string ReadingStatus,
    int? Rating,
    bool IsFavourite,
    // Cover from metadata, falling back to the user's own scan.
    string? ImageUrl,
    LibraryLoanResponse? OpenLoan
);

public sealed record LibraryItemListResponse(IReadOnlyList<LibraryItemListItem> Items, int Total);

// ── Quote ───────────────────────────────────────────────────────────────────

public sealed record LibraryQuoteSaveRequest(
    long WorkId,
    long? ExpressionId,
    long? ManifestationId,
    string QuoteText,
    // Structured position; shape follows the work's citation scheme.
    string? LocatorJson,
    string? Description,
    string? Context,
    IReadOnlyList<long>? TagIds
);

public sealed record LibraryQuoteResponse(
    long Id,
    long WorkId,
    string WorkTitle,
    string WorkCitationScheme,
    long? ExpressionId,
    string? ExpressionName,
    string? ExpressionLanguage,
    long? ManifestationId,
    string? ManifestationTitle,
    string? PublisherName,
    int? PublishedYear,
    IReadOnlyList<string> Authors,
    string QuoteText,
    string? LocatorJson,
    string? LocatorDisplay,
    // Footnote-ready, written in the requested citation style.
    string Reference,
    // The same source as it would appear in a list of works.
    string Bibliography,
    string CitationStyle,
    string? Description,
    string? Context,
    IReadOnlyList<LibraryTagResponse> Tags,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record LibraryQuoteListResponse(IReadOnlyList<LibraryQuoteResponse> Items, int Total);

/// <summary>Describes one citation scheme so the form can build its own fields.</summary>
public sealed record LibraryLocatorFieldSpec(
    string Key,
    string Kind,          // text | number
    string LabelKey,      // resolved to a label by the frontend copy
    bool Required
);

public sealed record LibraryCitationStyleSpec(
    string Key,
    string DisplayName,
    // Worked example so the picker shows what each style actually produces.
    string SampleNote,
    string SampleBibliography
);

public sealed record LibraryCitationSchemeSpec(
    string Scheme,
    string AuthoritativeLevel,   // manifestation | expression | work
    IReadOnlyList<LibraryLocatorFieldSpec> Fields,
    bool UsesStructureTemplate,
    string Example
);

// ── Quote import ────────────────────────────────────────────────────────────

/// <summary>
/// A quote as it arrives in an import file. The work may be given by id or by
/// enough metadata to match an existing one or create it.
/// </summary>
public sealed record LibraryQuoteImportItem(
    long? WorkId,
    string? WorkTitle,
    string? WorkOriginalLanguage,
    string? WorkCitationScheme,
    string? WorkKind,
    string? AuthorName,
    long? ExpressionId,
    string? ExpressionLanguage,
    string? ExpressionName,
    long? ManifestationId,
    string? ManifestationTitle,
    string? Isbn,
    string QuoteText,
    // Either a structured object or a plain string already rendered.
    System.Text.Json.JsonElement? Locator,
    string? LocatorDisplay,
    string? Description,
    string? Context,
    IReadOnlyList<string>? Tags
);

public sealed record LibraryQuoteImportRequest(IReadOnlyList<LibraryQuoteImportItem> Quotes);

public sealed record LibraryQuoteImportError(int Index, string Message);

public sealed record LibraryQuoteImportResponse(
    int Imported,
    int Failed,
    int WorksCreated,
    int ExpressionsCreated,
    int ManifestationsCreated,
    int TagsCreated,
    IReadOnlyList<LibraryQuoteImportError> Errors
);

// ── Loans and readings ──────────────────────────────────────────────────────

public sealed record LibraryLoanSaveRequest(
    string Direction,
    string CounterpartName,
    string? CounterpartContact,
    DateOnly LentOn,
    DateOnly? DueOn,
    DateOnly? ReturnedOn,
    string? Notes
);

public sealed record LibraryLoanResponse(
    long Id,
    long ItemId,
    string Direction,
    string CounterpartName,
    string? CounterpartContact,
    DateOnly LentOn,
    DateOnly? DueOn,
    DateOnly? ReturnedOn,
    string? Notes
);

public sealed record LibraryLoanListItem(
    long Id,
    long ItemId,
    long ManifestationId,
    string Title,
    IReadOnlyList<string> Authors,
    string Direction,
    string CounterpartName,
    string? CounterpartContact,
    DateOnly LentOn,
    DateOnly? DueOn,
    DateOnly? ReturnedOn,
    bool IsOverdue,
    string? Notes
);

public sealed record LibraryReadingSaveRequest(
    DateOnly? StartedOn,
    DateOnly? FinishedOn,
    int? Rating,
    string? Notes
);

public sealed record LibraryReadingListItem(
    long Id,
    long ItemId,
    long ManifestationId,
    string Title,
    IReadOnlyList<string> Authors,
    DateOnly? StartedOn,
    DateOnly? FinishedOn,
    int? Rating,
    string? Notes
);

// ── Shelf arrangement ───────────────────────────────────────────────────────

public sealed record LibraryArrangementPlacement(
    long ItemId,
    string Title,
    long ShelfId,
    string ShelfName,
    int Position,
    long? PreviousItemId,
    string? PreviousTitle,
    long? NextItemId,
    string? NextTitle,
    string? GroupName,
    string? ImageUrl,
    // True when the item already stands where the proposal puts it.
    bool MatchesCurrent
);

public sealed record LibraryArrangementUnplaced(long ItemId, string Title, string Reason);

public sealed record LibraryArrangementResponse(
    IReadOnlyList<LibraryArrangementPlacement> Placements,
    IReadOnlyList<LibraryArrangementUnplaced> Unplaced,
    IReadOnlyList<string> Notes
);

/// <summary>Applying a proposal is an explicit, separate act.</summary>
public sealed record LibraryArrangementApplyItem(long ItemId, long ShelfId, int Position);

public sealed record LibraryArrangementApplyRequest(IReadOnlyList<LibraryArrangementApplyItem> Placements);

// ── Overview ────────────────────────────────────────────────────────────────

public sealed record LibraryCountByKey(string Key, string Label, int Count);

public sealed record LibraryOverviewResponse(
    int Works,
    int Expressions,
    int Manifestations,
    int Items,
    int Quotes,
    int People,
    int Publishers,
    int Shelves,
    int Tags,
    int Translations,
    int OpenLoansOut,
    int OpenLoansIn,
    int OverdueLoans,
    int Read,
    int Reading,
    int Unread,
    IReadOnlyList<LibraryCountByKey> ByLanguage,
    IReadOnlyList<LibraryCountByKey> ByCitationScheme,
    IReadOnlyList<LibraryCountByKey> ByKind,
    IReadOnlyList<LibraryCountByKey> ByShelf,
    IReadOnlyList<LibraryCountByKey> TopAuthors,
    IReadOnlyList<LibraryCountByKey> TopTags,
    IReadOnlyList<LibraryQuoteResponse> RecentQuotes,
    IReadOnlyList<LibraryItemListItem> RecentlyAdded
);

// ── Barcode scanning ────────────────────────────────────────────────────────

public sealed record LibraryLookupContributor(string Name, string Role);

public sealed record LibraryLookupResponse(
    string Isbn,
    string? Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    IReadOnlyList<string> Translators,
    IReadOnlyList<LibraryLookupContributor> Contributors,
    string? Publisher,
    string? PublishedPlace,
    int? PublishedYear,
    int? PageCount,
    string? Language,
    string? OriginalLanguage,
    string? Series,
    string? Binding,
    string? CoverUrl,
    IReadOnlyList<string> Sources
);

public sealed record LibraryScanResponse(
    string Isbn,
    IReadOnlyList<LibraryManifestationListItem> MatchingManifestations,
    IReadOnlyList<LibraryItemListItem> OwnedItems,
    LibraryLookupResponse? Lookup,
    bool LookupAttempted
);

/// <summary>Creates work, expression, manifestation and item from one scan.</summary>
public sealed record LibraryScanImportRequest(
    string Isbn,
    string OriginalTitle,
    string OriginalLanguage,
    string Kind,
    string CitationScheme,
    int? FirstPublishedYear,
    string ManifestationTitle,
    string? ManifestationSubtitle,
    string ExpressionLanguage,
    string? ExpressionName,
    string? PublisherName,
    string? PublishedPlace,
    int? PublishedYear,
    int? PageCount,
    string? Series,
    string? Binding,
    string? CoverImageUrl,
    int? HeightMm,
    int? WidthMm,
    int? DepthMm,
    IReadOnlyList<string> AuthorNames,
    IReadOnlyList<string> TranslatorNames,
    long? ShelfId,
    bool CreateItem
);

public sealed record LibraryScanImportResponse(
    long WorkId,
    long? ExpressionId,
    long ManifestationId,
    long? ItemId
);

// ── Catalogue export / import ───────────────────────────────────────────────

public sealed record LibraryExportBundle(
    string Format,
    int Version,
    DateTimeOffset ExportedUtc,
    System.Text.Json.JsonElement Payload
);
