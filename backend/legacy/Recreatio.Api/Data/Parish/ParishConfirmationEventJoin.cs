using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationEventJoin
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid CandidateId { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(16)]
    public string Status { get; set; } = "pending";

    public DateTimeOffset RequestedUtc { get; set; }

    public DateTimeOffset? DecisionUtc { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
