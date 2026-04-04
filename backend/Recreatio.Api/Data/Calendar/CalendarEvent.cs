using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarEvents", Schema = "calendar")]
public sealed class CalendarEvent
{
    [Key]
    public Guid Id { get; set; }

    public Guid CalendarId { get; set; }

    public Guid OwnerRoleId { get; set; }

    [MaxLength(200)]
    public string TitlePublic { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? SummaryPublic { get; set; }

    [MaxLength(320)]
    public string? LocationPublic { get; set; }

    [MaxLength(24)]
    public string Visibility { get; set; } = "private"; // private|role|public

    [MaxLength(24)]
    public string Status { get; set; } = "planned"; // planned|confirmed|cancelled|completed

    public DateTimeOffset StartUtc { get; set; }

    public DateTimeOffset EndUtc { get; set; }

    public bool AllDay { get; set; }

    [MaxLength(64)]
    public string? TimeZoneId { get; set; }

    [MaxLength(24)]
    public string RecurrenceType { get; set; } = "none"; // none|daily|weekly|monthly|custom

    public int RecurrenceInterval { get; set; } = 1;

    [MaxLength(32)]
    public string? RecurrenceByWeekday { get; set; }

    public DateTimeOffset? RecurrenceUntilUtc { get; set; }

    public int? RecurrenceCount { get; set; }

    [MaxLength(512)]
    public string? RecurrenceRule { get; set; }

    public Guid? ProtectedDataItemId { get; set; }

    [MaxLength(64)]
    public string? LinkedModule { get; set; }

    [MaxLength(64)]
    public string? LinkedEntityType { get; set; }

    public Guid? LinkedEntityId { get; set; }

    [MaxLength(64)]
    public string? SourceFieldStart { get; set; }

    [MaxLength(64)]
    public string? SourceFieldEnd { get; set; }

    [MaxLength(24)]
    public string ConflictScopeMode { get; set; } = "role"; // role|calendar

    public Guid CreatedByUserId { get; set; }

    public Guid UpdatedByUserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }

    public DateTimeOffset? CancelledUtc { get; set; }

    public bool IsArchived { get; set; }
}
