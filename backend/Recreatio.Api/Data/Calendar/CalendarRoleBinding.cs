using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarRoleBindings", Schema = "calendar")]
public sealed class CalendarRoleBinding
{
    [Key]
    public Guid Id { get; set; }

    public Guid CalendarId { get; set; }

    public Guid RoleId { get; set; }

    [MaxLength(24)]
    public string AccessType { get; set; } = "viewer"; // viewer|editor|manager

    public Guid AddedByUserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
