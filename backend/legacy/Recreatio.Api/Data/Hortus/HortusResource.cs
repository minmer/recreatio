using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Hortus;

/// <summary>
/// A bookable part of the place. Resources form a tree: the root is the whole place,
/// its children are the houses and garden areas, and their children are the rooms,
/// the chapel, the dining room and the grill.
/// </summary>
[Table("HortusResources", Schema = "hortus")]
public sealed class HortusResource
{
    [Key]
    public Guid Id { get; set; }

    public Guid PlaceId { get; set; }

    public Guid? ParentId { get; set; }

    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    /// <summary>One of <see cref="HortusResourceKinds"/>; drives icons and default wording only.</summary>
    [MaxLength(32)]
    public string Kind { get; set; } = HortusResourceKinds.Other;

    /// <summary>One of <see cref="HortusBookingUnits"/>: nights, hour slots, or both.</summary>
    [MaxLength(16)]
    public string BookingUnit { get; set; } = HortusBookingUnits.Slot;

    /// <summary>How many different groups may hold this resource at the same moment.</summary>
    public int Capacity { get; set; } = 1;

    /// <summary>How many people fit in, for information and for sanity-checking a request.</summary>
    public int? GuestCapacity { get; set; }

    public int TechnicalMinutesBefore { get; set; }

    public int TechnicalMinutesAfter { get; set; }

    public bool IsPubliclyBookable { get; set; } = true;

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    /// <summary>Accent used by the admin timeline so each part stays recognisable.</summary>
    [MaxLength(16)]
    public string ColorToken { get; set; } = "sage";

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

public static class HortusResourceKinds
{
    public const string Whole = "whole";
    public const string House = "house";
    public const string Room = "room";
    public const string Chapel = "chapel";
    public const string Dining = "dining";
    public const string Grill = "grill";
    public const string Garden = "garden";
    public const string Other = "other";

    public static bool IsKnown(string value) => value is Whole or House or Room or Chapel or Dining or Grill or Garden or Other;
}

public static class HortusBookingUnits
{
    /// <summary>Booked as whole nights, from check-in time to check-out time.</summary>
    public const string Night = "night";

    /// <summary>Booked as a time range inside a day.</summary>
    public const string Slot = "slot";

    /// <summary>Either of the two, chosen per reservation item.</summary>
    public const string Both = "both";

    public static bool IsKnown(string value) => value is Night or Slot or Both;

    public static bool Allows(string bookingUnit, string requestedUnit) =>
        bookingUnit == Both || bookingUnit == requestedUnit;
}
