namespace Recreatio.Api.Contracts.Library;

// ── Registries: people, publishers, shelves, tags ───────────────────────────

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
    int WorkCount,
    int EditionCount
);

public sealed record LibraryPublisherSaveRequest(
    string Name,
    string? City,
    string? Notes
);

public sealed record LibraryPublisherResponse(
    long Id,
    string Name,
    string? City,
    string? Notes,
    int EditionCount
);

public sealed record LibraryShelfSaveRequest(
    string Name,
    string? Location,
    string? Description,
    int SortOrder
);

public sealed record LibraryShelfResponse(
    long Id,
    string Name,
    string? Location,
    string? Description,
    int SortOrder,
    int CopyCount
);

public sealed record LibraryTagSaveRequest(
    string Name,
    string? Color
);

public sealed record LibraryTagResponse(
    long Id,
    string Name,
    string? Color,
    int WorkCount
);

// ── Contributions ───────────────────────────────────────────────────────────

public sealed record LibraryContributionSaveItem(
    long PersonId,
    string Role
);

public sealed record LibraryContributionsSaveRequest(
    IReadOnlyList<LibraryContributionSaveItem> Contributions
);

public sealed record LibraryContributionResponse(
    long Id,
    long PersonId,
    string PersonName,
    string Role,
    int SortOrder
);

// ── Works ───────────────────────────────────────────────────────────────────

public sealed record LibraryWorkSaveRequest(
    string OriginalTitle,
    string? OriginalSubtitle,
    string OriginalLanguage,
    string? UniformTitle,
    string Kind,
    int? FirstPublishedYear,
    string? Notes
);

/// <summary>Row shown in the work browser: one line per work with rolled-up holdings.</summary>
public sealed record LibraryWorkListItem(
    long Id,
    string OriginalTitle,
    string? OriginalSubtitle,
    string OriginalLanguage,
    string? UniformTitle,
    string Kind,
    int? FirstPublishedYear,
    IReadOnlyList<string> Authors,
    IReadOnlyList<string> EditionLanguages,
    IReadOnlyList<LibraryTagResponse> Tags,
    int EditionCount,
    int CopyCount
);

public sealed record LibraryWorkListResponse(
    IReadOnlyList<LibraryWorkListItem> Items,
    int Total
);

public sealed record LibraryWorkDetailResponse(
    long Id,
    string OriginalTitle,
    string? OriginalSubtitle,
    string OriginalLanguage,
    string? UniformTitle,
    string Kind,
    int? FirstPublishedYear,
    string? Notes,
    IReadOnlyList<LibraryContributionResponse> Contributions,
    IReadOnlyList<long> TagIds,
    IReadOnlyList<LibraryEditionListItem> Editions,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record LibraryWorkTagsSaveRequest(
    IReadOnlyList<long> TagIds
);

// ── Editions ────────────────────────────────────────────────────────────────

public sealed record LibraryEditionSaveRequest(
    string Title,
    string? Subtitle,
    string Language,
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
    string? CoverUrl,
    string? Notes
);

public sealed record LibraryEditionListItem(
    long Id,
    long WorkId,
    string Title,
    string? Subtitle,
    string Language,
    // IsTranslation: this edition's language differs from the work's original language.
    bool IsTranslation,
    long? PublisherId,
    string? PublisherName,
    string? PublishedPlace,
    int? PublishedYear,
    string? EditionStatement,
    string? Isbn,
    int? PageCount,
    string? Binding,
    IReadOnlyList<string> Translators,
    int CopyCount
);

public sealed record LibraryEditionDetailResponse(
    long Id,
    long WorkId,
    string WorkOriginalTitle,
    string WorkOriginalLanguage,
    string Title,
    string? Subtitle,
    string Language,
    bool IsTranslation,
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
    string? CoverUrl,
    string? Notes,
    IReadOnlyList<LibraryContributionResponse> Contributions,
    IReadOnlyList<LibraryCopyResponse> Copies,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

// ── Copies ──────────────────────────────────────────────────────────────────

public sealed record LibraryCopySaveRequest(
    long? ShelfId,
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
    string? Notes
);

public sealed record LibraryCopyResponse(
    long Id,
    long EditionId,
    long? ShelfId,
    string? ShelfName,
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
    string? Notes,
    LibraryLoanResponse? OpenLoan
);

/// <summary>Row shown in the shelf browser: a copy carrying enough context to identify it.</summary>
public sealed record LibraryCopyListItem(
    long Id,
    long EditionId,
    long WorkId,
    string EditionTitle,
    string WorkOriginalTitle,
    string Language,
    bool IsTranslation,
    IReadOnlyList<string> Authors,
    string? PublisherName,
    int? PublishedYear,
    long? ShelfId,
    string? ShelfName,
    string? Signature,
    string Status,
    string? Condition,
    string ReadingStatus,
    int? Rating,
    bool IsFavourite,
    LibraryLoanResponse? OpenLoan
);

public sealed record LibraryCopyListResponse(
    IReadOnlyList<LibraryCopyListItem> Items,
    int Total
);

// ── Loans ───────────────────────────────────────────────────────────────────

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
    long CopyId,
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
    long CopyId,
    long EditionId,
    string EditionTitle,
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

// ── Readings ────────────────────────────────────────────────────────────────

public sealed record LibraryReadingSaveRequest(
    DateOnly? StartedOn,
    DateOnly? FinishedOn,
    int? Rating,
    string? Notes
);

public sealed record LibraryReadingListItem(
    long Id,
    long CopyId,
    long EditionId,
    string EditionTitle,
    IReadOnlyList<string> Authors,
    DateOnly? StartedOn,
    DateOnly? FinishedOn,
    int? Rating,
    string? Notes
);

// ── Overview ────────────────────────────────────────────────────────────────

public sealed record LibraryCountByKey(string Key, string Label, int Count);

public sealed record LibraryOverviewResponse(
    int Works,
    int Editions,
    int Copies,
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
    IReadOnlyList<LibraryCountByKey> ByOriginalLanguage,
    IReadOnlyList<LibraryCountByKey> ByKind,
    IReadOnlyList<LibraryCountByKey> ByShelf,
    IReadOnlyList<LibraryCountByKey> TopAuthors,
    IReadOnlyList<LibraryCopyListItem> RecentlyAdded
);

// ── Barcode scanning ────────────────────────────────────────────────────────

public sealed record LibraryLookupResponse(
    string Isbn,
    string? Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    string? Publisher,
    string? PublishedPlace,
    int? PublishedYear,
    int? PageCount,
    string? Language,
    string? Series,
    string? CoverUrl,
    IReadOnlyList<string> Sources
);

/// <summary>
/// One scan answers both questions at once: do I already own this, and — if not —
/// what does the public catalogue know about it.
/// </summary>
public sealed record LibraryScanResponse(
    string Isbn,
    IReadOnlyList<LibraryEditionListItem> MatchingEditions,
    IReadOnlyList<LibraryCopyListItem> OwnedCopies,
    LibraryLookupResponse? Lookup,
    bool LookupAttempted
);

/// <summary>Creates work + edition + copy in one call from a confirmed scan.</summary>
public sealed record LibraryScanImportRequest(
    string Isbn,
    string OriginalTitle,
    string OriginalLanguage,
    string Kind,
    int? FirstPublishedYear,
    string EditionTitle,
    string? EditionSubtitle,
    string EditionLanguage,
    string? PublisherName,
    string? PublishedPlace,
    int? PublishedYear,
    int? PageCount,
    string? Series,
    string? CoverUrl,
    IReadOnlyList<string> AuthorNames,
    IReadOnlyList<string> TranslatorNames,
    long? ShelfId,
    bool CreateCopy
);

public sealed record LibraryScanImportResponse(
    long WorkId,
    long EditionId,
    long? CopyId
);

// ── Import / export ─────────────────────────────────────────────────────────

public sealed record LibraryExportPerson(
    long Id,
    string DisplayName,
    string? SortName,
    int? BirthYear,
    int? DeathYear,
    string? Nationality,
    string? Notes
);

public sealed record LibraryExportPublisher(long Id, string Name, string? City, string? Notes);

public sealed record LibraryExportShelf(long Id, string Name, string? Location, string? Description, int SortOrder);

public sealed record LibraryExportTag(long Id, string Name, string? Color);

public sealed record LibraryExportContribution(long PersonId, string Role, int SortOrder);

public sealed record LibraryExportCopy(
    long Id,
    long? ShelfId,
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
    string? Notes,
    IReadOnlyList<LibraryLoanSaveRequest> Loans,
    IReadOnlyList<LibraryReadingSaveRequest> Readings
);

public sealed record LibraryExportEdition(
    long Id,
    string Title,
    string? Subtitle,
    string Language,
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
    string? CoverUrl,
    string? Notes,
    IReadOnlyList<LibraryExportContribution> Contributions,
    IReadOnlyList<LibraryExportCopy> Copies
);

public sealed record LibraryExportWork(
    long Id,
    string OriginalTitle,
    string? OriginalSubtitle,
    string OriginalLanguage,
    string? UniformTitle,
    string Kind,
    int? FirstPublishedYear,
    string? Notes,
    IReadOnlyList<LibraryExportContribution> Contributions,
    IReadOnlyList<long> TagIds,
    IReadOnlyList<LibraryExportEdition> Editions
);

public sealed record LibraryExportBundle(
    string Format,
    int Version,
    DateTimeOffset ExportedUtc,
    IReadOnlyList<LibraryExportPerson> People,
    IReadOnlyList<LibraryExportPublisher> Publishers,
    IReadOnlyList<LibraryExportShelf> Shelves,
    IReadOnlyList<LibraryExportTag> Tags,
    IReadOnlyList<LibraryExportWork> Works
);

public sealed record LibraryImportResponse(
    int People,
    int Publishers,
    int Shelves,
    int Tags,
    int Works,
    int Editions,
    int Copies,
    int Loans,
    int Readings
);
