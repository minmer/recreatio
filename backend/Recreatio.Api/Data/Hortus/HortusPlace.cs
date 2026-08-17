using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Hortus;

[Table("HortusPlaces", Schema = "hortus")]
public sealed class HortusPlace
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Motto { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(300)]
    public string AddressLine { get; set; } = string.Empty;

    [MaxLength(160)]
    public string ContactName { get; set; } = string.Empty;

    [MaxLength(180)]
    public string ContactEmail { get; set; } = string.Empty;

    [MaxLength(32)]
    public string ContactPhone { get; set; } = string.Empty;

    /// <summary>Windows time zone id used to turn booked nights and slots into absolute instants.</summary>
    [MaxLength(80)]
    public string TimeZoneId { get; set; } = "Central European Standard Time";

    public TimeOnly CheckInTime { get; set; } = new(16, 0);

    public TimeOnly CheckOutTime { get; set; } = new(10, 0);

    /// <summary>Technical (cleaning, airing, restocking) minutes proposed for newly created resources.</summary>
    public int DefaultTechnicalMinutes { get; set; } = 120;

    /// <summary>Requests submitted from the public page must start at least this many days ahead.</summary>
    public int MinLeadDays { get; set; }

    public bool PublicRequestsEnabled { get; set; } = true;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
