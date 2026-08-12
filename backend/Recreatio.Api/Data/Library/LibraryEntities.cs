using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Library;

// The private library is modelled along the classic bibliographic split:
//
//   Work     — the abstract creation ("Die Verwandlung", German, 1915)
//   Edition  — one published realisation of it, original or translated
//              ("Przemiana", Polish, tłum. J. Ekier, PIW 1975)
//   Copy     — the physical item standing on my shelf
//
// Cogita collapses Work and Edition into a single `work` info type with an
// `originalLanguageId` field; splitting them is what lets a translation be a
// first-class record with its own translator, publisher and ISBN.
//
// Every table carries OwnerAccountId so each query filters ownership directly
// instead of relying on joins through parents.

/// <summary>
/// A person who contributed to a work or an edition: author, translator, editor,
/// illustrator. Shared across the whole private library of one account.
/// </summary>
[Table("LibraryPeople", Schema = "library")]
public sealed class LibraryPerson
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    /// <summary>Name as printed, e.g. "Franz Kafka".</summary>
    [MaxLength(240)]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>Filing form, e.g. "Kafka, Franz". Falls back to DisplayName when empty.</summary>
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

/// <summary>Publishing house referenced by editions.</summary>
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

/// <summary>A physical location: room, bookcase, shelf.</summary>
[Table("LibraryShelves", Schema = "library")]
public sealed class LibraryShelf
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Room or building the shelf stands in.</summary>
    [MaxLength(240)]
    public string? Location { get; set; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>Free-form subject label attached to works.</summary>
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

/// <summary>
/// The abstract creation, independent of any printing. Holds the original title
/// and the language it was written in.
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

    /// <summary>Language code the work was written in, e.g. "de", "grc", "la".</summary>
    [MaxLength(16)]
    public string OriginalLanguage { get; set; } = string.Empty;

    /// <summary>Title the work is filed under when it differs from the original.</summary>
    [MaxLength(400)]
    public string? UniformTitle { get; set; }

    /// <summary>book | article | essay | poetry | drama | treatise | collection | reference | other</summary>
    [MaxLength(32)]
    public string Kind { get; set; } = "book";

    public int? FirstPublishedYear { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>
/// One published realisation of a work. An edition whose Language differs from
/// the work's OriginalLanguage is a translation, and carries its own translator
/// contributions.
/// </summary>
[Table("LibraryEditions", Schema = "library")]
public sealed class LibraryEdition
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long WorkId { get; set; }

    /// <summary>Title as printed on this edition — the translated title when translated.</summary>
    [MaxLength(400)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(400)]
    public string? Subtitle { get; set; }

    /// <summary>Language of this edition's text.</summary>
    [MaxLength(16)]
    public string Language { get; set; } = string.Empty;

    public long? PublisherId { get; set; }

    [MaxLength(160)]
    public string? PublishedPlace { get; set; }

    public int? PublishedYear { get; set; }

    /// <summary>Edition statement as printed, e.g. "wyd. 2 popr.".</summary>
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

    /// <summary>hardcover | paperback | leather | ebook | audiobook | other</summary>
    [MaxLength(40)]
    public string? Binding { get; set; }

    [MaxLength(500)]
    public string? CoverUrl { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>
/// Links a person to a work or an edition in a named role. Authorship attaches to
/// the work; translation, editing and illustration attach to the edition.
/// </summary>
[Table("LibraryContributions", Schema = "library")]
public sealed class LibraryContribution
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long PersonId { get; set; }

    /// <summary>work | edition</summary>
    [MaxLength(16)]
    public string TargetType { get; set; } = "work";

    public long TargetId { get; set; }

    /// <summary>author | coauthor | editor | translator | illustrator | foreword | afterword | commentary | compiler | other</summary>
    [MaxLength(32)]
    public string Role { get; set; } = "author";

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}

/// <summary>The physical item on my shelf — the only entity that is really "mine".</summary>
[Table("LibraryCopies", Schema = "library")]
public sealed class LibraryCopy
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long EditionId { get; set; }

    public long? ShelfId { get; set; }

    /// <summary>Call number / my own signature.</summary>
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

    /// <summary>1–10, null when unrated.</summary>
    public int? Rating { get; set; }

    public bool IsFavourite { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>A copy leaving my shelf ("out") or arriving from someone else ("in").</summary>
[Table("LibraryLoans", Schema = "library")]
public sealed class LibraryLoan
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long CopyId { get; set; }

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

/// <summary>One pass through a copy: when I started, when I finished, what I thought.</summary>
[Table("LibraryReadings", Schema = "library")]
public sealed class LibraryReading
{
    [Key]
    public long Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public long CopyId { get; set; }

    public DateOnly? StartedOn { get; set; }

    public DateOnly? FinishedOn { get; set; }

    /// <summary>1–10, null when unrated.</summary>
    public int? Rating { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

/// <summary>Tag assignment. Tags sit on the work, so they survive re-editions.</summary>
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
