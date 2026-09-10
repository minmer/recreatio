using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Library;

// The library keeps two concerns strictly apart.
//
//   Citation layer   Work → Expression → Manifestation
//                    "Summa Theologiae" → the Marietti Latin text →
//                    the 1948 printing. This is what a footnote points at.
//
//   Physical layer   Manifestation → Item → Shelf
//                    the copy on my shelf, its condition, where it stands.
//
// A Quote hangs off a Work and never off an Item: a citation has to survive
// selling the book, and has to work for a book that was never owned.
//
// Every table carries OwnerAccountId so each query filters ownership directly
// rather than joining back through parents.

// ── Registries ──────────────────────────────────────────────────────────────

/// <summary>Author, translator, editor, illustrator — anyone who contributed.</summary>
[Table("LibraryPeople", Schema = "library")]
public sealed class LibraryPerson
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    /// <summary>Name as printed, e.g. "Bolesław Prus".</summary>
    [MaxLength(240)]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>Filing form, e.g. "Prus, Bolesław". Falls back to DisplayName.</summary>
    [MaxLength(240)]
    public string? SortName { get; set; }

    public int? BirthYear { get; set; }

    public int? DeathYear { get; set; }

    [MaxLength(80)]
    public string? Nationality { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

[Table("LibraryPublishers", Schema = "library")]
public sealed class LibraryPublisher
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    [MaxLength(240)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(160)]
    public string? City { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>
/// A physical shelf. The millimetre constraints are what let the arrangement
/// service reject a book that will not fit.
/// </summary>
[Table("LibraryShelves", Schema = "library")]
public sealed class LibraryShelf
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(240)]
    public string? Location { get; set; }

    public string? Description { get; set; }

    /// <summary>Position among shelves, top to bottom.</summary>
    public int SortOrder { get; set; }

    public int? HeightMm { get; set; }

    public int? DepthMm { get; set; }

    /// <summary>Running width available for spines.</summary>
    public int? WidthMm { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>One tag vocabulary, shared by works and quotes.</summary>
[Table("LibraryTags", Schema = "library")]
public sealed class LibraryTag
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(16)]
    public string? Color { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

// ── Citation layer ──────────────────────────────────────────────────────────

/// <summary>
/// The abstract creation, independent of language or edition: the Summa, the
/// Bible, a particular encyclical.
/// </summary>
[Table("LibraryWorks", Schema = "library")]
public sealed class LibraryWork
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    /// <summary>Title in the language the work was written in.</summary>
    [MaxLength(400)]
    public string OriginalTitle { get; set; } = string.Empty;

    [MaxLength(400)]
    public string? OriginalSubtitle { get; set; }

    [MaxLength(16)]
    public string OriginalLanguage { get; set; } = string.Empty;

    /// <summary>Title the work is filed under when it differs from the original.</summary>
    [MaxLength(400)]
    public string? UniformTitle { get; set; }

    /// <summary>
    /// Browsing category: book | article | essay | poetry | drama | treatise |
    /// collection | reference | scripture | document | other.
    /// </summary>
    [MaxLength(32)]
    public string Kind { get; set; } = "book";

    /// <summary>
    /// Decides which locator fields apply and which formatter renders them:
    /// Page | BibleReference | StructuredWork | DocumentParagraph. Stored as a
    /// string so a new scheme costs a formatter class and no migration.
    /// </summary>
    [MaxLength(32)]
    public string CitationScheme { get; set; } = "Page";

    /// <summary>
    /// Ordered part definitions for StructuredWork, e.g.
    /// [{"key":"part","abbr":""},{"key":"question","abbr":"q."}].
    /// This is what lets the Summa and the Tractatus share one scheme.
    /// </summary>
    public string? StructureTemplateJson { get; set; }

    /// <summary>Sigil printed before a structured locator, e.g. "STh".</summary>
    [MaxLength(40)]
    public string? CitationSigil { get; set; }

    public int? FirstPublishedYear { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>
/// A language version of a Work — a translation, or the original text where it
/// needs naming. Optional: a work with nothing to distinguish has none.
/// </summary>
[Table("LibraryExpressions", Schema = "library")]
public sealed class LibraryExpression
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long WorkId { get; set; }

    [MaxLength(16)]
    public string Language { get; set; } = string.Empty;

    /// <summary>e.g. "Einheitsübersetzung 2016", "Marietti edition".</summary>
    [MaxLength(240)]
    public string? Name { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>
/// A concrete published form: a printing, a web page, or an ebook. Attaches to
/// an Expression when one exists, otherwise straight to the Work.
/// </summary>
[Table("LibraryManifestations", Schema = "library")]
public sealed class LibraryManifestation
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long? WorkId { get; set; }

    public long? ExpressionId { get; set; }

    /// <summary>Print | Web | Ebook</summary>
    [MaxLength(16)]
    public string Format { get; set; } = "Print";

    /// <summary>Title as printed, or the page title for a web source.</summary>
    [MaxLength(400)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(400)]
    public string? Subtitle { get; set; }

    public long? PublisherId { get; set; }

    [MaxLength(160)]
    public string? PublishedPlace { get; set; }

    public int? PublishedYear { get; set; }

    [MaxLength(160)]
    public string? EditionStatement { get; set; }

    [MaxLength(200)]
    public string? Series { get; set; }

    [MaxLength(60)]
    public string? SeriesNumber { get; set; }

    [MaxLength(32)]
    public string? Isbn { get; set; }

    [MaxLength(32)]
    public string? Issn { get; set; }

    public int? PageCount { get; set; }

    [MaxLength(60)]
    public string? Volume { get; set; }

    [MaxLength(40)]
    public string? Binding { get; set; }

    /// <summary>The page itself, for a Web manifestation.</summary>
    [MaxLength(1000)]
    public string? Url { get; set; }

    /// <summary>
    /// Where the original text can be read. A findability pointer only — it does
    /// not belong in the footnote.
    /// </summary>
    [MaxLength(1000)]
    public string? OriginalTextUrl { get; set; }

    [MaxLength(1000)]
    public string? CoverImageUrl { get; set; }

    public int? HeightMm { get; set; }

    public int? WidthMm { get; set; }

    public int? DepthMm { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>
/// Person ↔ work | expression | manifestation, in a named role. Authorship sits
/// on the work, translation on the expression, illustration on the manifestation.
/// </summary>
[Table("LibraryContributions", Schema = "library")]
public sealed class LibraryContribution
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long PersonId { get; set; }

    /// <summary>work | expression | manifestation</summary>
    [MaxLength(16)]
    public string TargetType { get; set; } = "work";

    public long TargetId { get; set; }

    /// <summary>
    /// author | coauthor | editor | translator | illustrator | foreword |
    /// afterword | commentary | compiler | other
    /// </summary>
    [MaxLength(32)]
    public string Role { get; set; } = "author";

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}

[Table("LibraryWorkTags", Schema = "library")]
public sealed class LibraryWorkTag
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long WorkId { get; set; }

    public long TagId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}

// ── Quotes ──────────────────────────────────────────────────────────────────

/// <summary>
/// A verbatim passage and the exact place it came from. Description and Context
/// are optional throughout: a bare quote is text plus a work.
/// </summary>
[Table("LibraryQuotes", Schema = "library")]
public sealed class LibraryQuote
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    /// <summary>Every quote belongs to a work.</summary>
    public long WorkId { get; set; }

    /// <summary>Which translation, when that matters.</summary>
    public long? ExpressionId { get; set; }

    /// <summary>Where I found it, when that matters.</summary>
    public long? ManifestationId { get; set; }

    public string QuoteText { get; set; } = string.Empty;

    /// <summary>Structured position, shaped by the work's citation scheme.</summary>
    public string? LocatorJson { get; set; }

    /// <summary>Rendered locator, denormalised so search never parses JSON.</summary>
    [MaxLength(200)]
    public string? LocatorDisplay { get; set; }

    /// <summary>My own reading of the passage.</summary>
    public string? Description { get; set; }

    /// <summary>What the surrounding passage is about.</summary>
    public string? Context { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

[Table("LibraryQuoteTags", Schema = "library")]
public sealed class LibraryQuoteTag
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long QuoteId { get; set; }

    public long TagId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}

// ── Physical layer ──────────────────────────────────────────────────────────

/// <summary>
/// A grouping constraint the arrangement service honours: a numbered series
/// that must stay in order, or a collection that must stay together.
/// </summary>
[Table("LibraryPlacementGroups", Schema = "library")]
public sealed class LibraryPlacementGroup
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>series | collection | free</summary>
    [MaxLength(16)]
    public string GroupKind { get; set; } = "collection";

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>
/// My physical copy. Entirely optional — a work or manifestation can exist with
/// no item, which is what makes citing a book I do not own possible.
/// </summary>
[Table("LibraryItems", Schema = "library")]
public sealed class LibraryItem
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long ManifestationId { get; set; }

    public long? ShelfId { get; set; }

    public long? PlacementGroupId { get; set; }

    /// <summary>Left-to-right order on the shelf.</summary>
    public int? PositionInShelf { get; set; }

    /// <summary>Position within an ordered series, independent of shelving.</summary>
    public int? SeriesPosition { get; set; }

    [MaxLength(80)]
    public string? Signature { get; set; }

    /// <summary>shelf | lent | borrowed | wanted | ordered | lost | sold</summary>
    [MaxLength(24)]
    public string Status { get; set; } = "shelf";

    /// <summary>new | good | fair | worn | damaged</summary>
    [MaxLength(24)]
    public string? Condition { get; set; }

    public DateOnly? AcquiredDate { get; set; }

    [MaxLength(200)]
    public string? AcquiredFrom { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? Price { get; set; }

    [MaxLength(8)]
    public string? Currency { get; set; }

    [MaxLength(64)]
    public string? Barcode { get; set; }

    /// <summary>unread | reading | read | abandoned | reference</summary>
    [MaxLength(24)]
    public string ReadingStatus { get; set; } = "unread";

    public int? Rating { get; set; }

    public bool IsFavourite { get; set; }

    /// <summary>My own scan, used when no cover could be fetched.</summary>
    [MaxLength(1000)]
    public string? ScanImageUrl { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

[Table("LibraryLoans", Schema = "library")]
public sealed class LibraryLoan
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long ItemId { get; set; }

    /// <summary>out = I lent it away; in = I borrowed it.</summary>
    [MaxLength(16)]
    public string Direction { get; set; } = "out";

    [MaxLength(200)]
    public string CounterpartName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? CounterpartContact { get; set; }

    public DateOnly LentOn { get; set; }

    public DateOnly? DueOn { get; set; }

    public DateOnly? ReturnedOn { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

[Table("LibraryReadings", Schema = "library")]
public sealed class LibraryReading
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long ItemId { get; set; }

    public DateOnly? StartedOn { get; set; }

    public DateOnly? FinishedOn { get; set; }

    public int? Rating { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
