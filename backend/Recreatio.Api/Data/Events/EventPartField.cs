using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// A field of a <c>form</c> part. Relational rather than buried in ConfigJson so
/// answers can be validated, listed and turned into named registrations.
/// </summary>
[Table("EventPartFields", Schema = "events")]
public sealed class EventPartField
{
    [Key]
    public Guid Id { get; set; }

    public Guid PartId { get; set; }

    public int SortOrder { get; set; }

    /// <summary>text | textarea | select | multiselect | checkbox | number | date | email | phone</summary>
    [MaxLength(16)]
    public string Kind { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Label { get; set; } = string.Empty;

    [MaxLength(400)]
    public string? HelpText { get; set; }

    /// <summary>JSON array of strings; used by select and multiselect.</summary>
    public string? OptionsJson { get; set; }

    public bool IsRequired { get; set; }

    public bool IsHalfWidth { get; set; }

    /// <summary>
    /// none | name | contact. Marking a field as <c>name</c> is what turns an
    /// anonymous submission into a person the organizer can grant access to.
    /// </summary>
    [MaxLength(12)]
    public string IdentityRole { get; set; } = "none";
}
