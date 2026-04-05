using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarEventGraphLinks", Schema = "calendar")]
public sealed class CalendarEventGraphLink
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid GraphId { get; set; }

    public bool IsPrimary { get; set; } = true;

    public Guid CreatedByUserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
