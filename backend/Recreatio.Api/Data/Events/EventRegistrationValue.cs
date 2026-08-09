using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>One field's answer within an <see cref="EventRegistration"/>.</summary>
[Table("EventRegistrationValues", Schema = "events")]
public sealed class EventRegistrationValue
{
    [Key]
    public Guid Id { get; set; }

    public Guid RegistrationId { get; set; }

    public Guid FieldId { get; set; }

    /// <summary>Captured at submit time so later field edits don't rewrite history.</summary>
    [MaxLength(300)]
    public string FieldLabel { get; set; } = string.Empty;

    /// <summary>Scalar answer, or a JSON array for multiselect.</summary>
    [MaxLength(4000)]
    public string? Value { get; set; }
}
