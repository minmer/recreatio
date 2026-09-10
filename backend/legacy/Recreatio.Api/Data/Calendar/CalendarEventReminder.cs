using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarEventReminders", Schema = "calendar")]
public sealed class CalendarEventReminder
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public int MinutesBefore { get; set; }

    [MaxLength(24)]
    public string Channel { get; set; } = "inapp"; // inapp|email|sms|push|webhook

    public string? ChannelConfigJson { get; set; }

    public Guid? TargetRoleId { get; set; }

    public Guid? TargetUserId { get; set; }

    [MaxLength(24)]
    public string Status { get; set; } = "active"; // active|sent|dismissed

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
