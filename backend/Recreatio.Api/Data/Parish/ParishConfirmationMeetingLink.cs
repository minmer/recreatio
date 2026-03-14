using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationMeetingLink
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid CandidateId { get; set; }

    [MaxLength(128)]
    public string BookingToken { get; set; } = string.Empty;

    public Guid? SlotId { get; set; }

    public DateTimeOffset? BookedUtc { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
