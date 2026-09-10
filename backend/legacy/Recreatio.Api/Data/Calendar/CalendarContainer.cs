using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("Calendars", Schema = "calendar")]
public sealed class CalendarContainer
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(120)]
    public string? Slug { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(128)]
    public string? OrganizationScope { get; set; }

    public Guid OwnerRoleId { get; set; }

    public Guid CreatedByUserId { get; set; }

    [MaxLength(64)]
    public string? DefaultTimeZoneId { get; set; }

    public bool IsArchived { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
