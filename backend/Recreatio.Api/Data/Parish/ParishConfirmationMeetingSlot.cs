using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationMeetingSlot
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public DateTimeOffset StartsAtUtc { get; set; }

    public int DurationMinutes { get; set; }

    public int Capacity { get; set; }

    [MaxLength(160)]
    public string? Label { get; set; }

    [MaxLength(32)]
    public string Stage { get; set; } = "year1-start";

    public bool IsActive { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
