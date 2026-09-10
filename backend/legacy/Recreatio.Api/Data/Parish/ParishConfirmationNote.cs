using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationNote
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid CandidateId { get; set; }

    [MaxLength(2000)]
    public string NoteText { get; set; } = string.Empty;

    public bool IsPublic { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
