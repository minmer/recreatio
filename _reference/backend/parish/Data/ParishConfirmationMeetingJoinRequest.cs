using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationMeetingJoinRequest
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid SlotId { get; set; }

    public Guid RequestedByCandidateId { get; set; }

    public Guid HostCandidateId { get; set; }

    [MaxLength(16)]
    public string Status { get; set; } = "pending";

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }

    public DateTimeOffset? DecidedUtc { get; set; }
}
