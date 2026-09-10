using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Hortus;

/// <summary>
/// One coordinated stay. A reservation carries the group and the contact details;
/// what it actually occupies lives in its <see cref="HortusReservationItem"/> rows,
/// so a single group can hold a house for three nights and the chapel for two hours.
/// </summary>
[Table("HortusReservations", Schema = "hortus")]
public sealed class HortusReservation
{
    [Key]
    public Guid Id { get; set; }

    public Guid PlaceId { get; set; }

    /// <summary>Human-readable reference the group quotes on the phone, e.g. HD-7QK2M4.</summary>
    [MaxLength(16)]
    public string Code { get; set; } = string.Empty;

    /// <summary>One of <see cref="HortusReservationKinds"/>.</summary>
    [MaxLength(16)]
    public string Kind { get; set; } = HortusReservationKinds.Reservation;

    /// <summary>One of <see cref="HortusReservationStatuses"/>.</summary>
    [MaxLength(16)]
    public string Status { get; set; } = HortusReservationStatuses.Pending;

    [MaxLength(200)]
    public string GroupName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Organization { get; set; } = string.Empty;

    [MaxLength(200)]
    public string ContactName { get; set; } = string.Empty;

    [MaxLength(180)]
    public string ContactEmail { get; set; } = string.Empty;

    [MaxLength(32)]
    public string ContactPhone { get; set; } = string.Empty;

    public int? GuestCount { get; set; }

    /// <summary>What the group wrote when requesting.</summary>
    [MaxLength(2000)]
    public string? PurposeNote { get; set; }

    /// <summary>Coordination notes; never returned to the public endpoints.</summary>
    [MaxLength(2000)]
    public string? AdminNote { get; set; }

    /// <summary>SHA-256 of the token in the status link mailed to the requester.</summary>
    [MaxLength(64)]
    public string? RequesterTokenHash { get; set; }

    public Guid? RequestedByUserId { get; set; }

    public Guid? DecidedByUserId { get; set; }

    public DateTimeOffset? DecidedUtc { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

public static class HortusReservationKinds
{
    /// <summary>A group staying or using a part of the place.</summary>
    public const string Reservation = "reservation";

    /// <summary>Admin-made block: cleaning, repairs, a closed season. Ignores capacity.</summary>
    public const string Block = "block";

    public static bool IsKnown(string value) => value is Reservation or Block;
}

public static class HortusReservationStatuses
{
    /// <summary>Submitted from the public page, waiting for the coordinator.</summary>
    public const string Pending = "pending";

    /// <summary>Confirmed by the coordinator; occupies the calendar.</summary>
    public const string Confirmed = "confirmed";

    public const string Rejected = "rejected";

    public const string Cancelled = "cancelled";

    public static bool IsKnown(string value) => value is Pending or Confirmed or Rejected or Cancelled;

    /// <summary>Statuses that take space away from other groups.</summary>
    public static bool Occupies(string value) => value == Confirmed;

    /// <summary>Statuses that are still alive and shown as tentative.</summary>
    public static bool IsOpen(string value) => value is Pending or Confirmed;
}
