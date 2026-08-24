using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationCelebrationParticipation
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid CandidateId { get; set; }

    public Guid CelebrationId { get; set; }

    [MaxLength(2000)]
    public string CommentText { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
