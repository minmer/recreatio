using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarEventGroups", Schema = "calendar")]
public sealed class CalendarEventGroup
{
    [Key]
    public Guid Id { get; set; }

    public Guid CalendarId { get; set; }

    public Guid OwnerRoleId { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(64)]
    public string? Category { get; set; }

    public Guid CreatedByUserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }

    public bool IsArchived { get; set; }
}
