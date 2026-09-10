using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Hortus;

/// <summary>
/// One resource held by one reservation over one interval. <see cref="StartUtc"/> and
/// <see cref="EndUtc"/> are the resolved instants the group is actually in the room;
/// the technical minutes around them are what keeps the next group out while the
/// place is being cleaned.
/// </summary>
[Table("HortusReservationItems", Schema = "hortus")]
public sealed class HortusReservationItem
{
    [Key]
    public Guid Id { get; set; }

    public Guid ReservationId { get; set; }

    public Guid ResourceId { get; set; }

    /// <summary><see cref="HortusBookingUnits.Night"/> or <see cref="HortusBookingUnits.Slot"/>.</summary>
    [MaxLength(16)]
    public string Unit { get; set; } = HortusBookingUnits.Slot;

    /// <summary>Arrival date for nights, the single day for slots.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Departure date for nights, the same day for slots.</summary>
    public DateOnly EndDate { get; set; }

    public DateTimeOffset StartUtc { get; set; }

    public DateTimeOffset EndUtc { get; set; }

    public int TechnicalMinutesBefore { get; set; }

    public int TechnicalMinutesAfter { get; set; }

    /// <summary>Takes the resource whole, whatever its capacity. Set for admin blocks.</summary>
    public bool IsExclusive { get; set; }

    [MaxLength(400)]
    public string? Note { get; set; }
}
