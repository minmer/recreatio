using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarReminderDispatches", Schema = "calendar")]
public sealed class CalendarReminderDispatch
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid ReminderId { get; set; }

    public DateTimeOffset OccurrenceStartUtc { get; set; }

    [MaxLength(128)]
    public string IdempotencyKey { get; set; } = string.Empty;

    [MaxLength(24)]
    public string Channel { get; set; } = "inapp";

    [MaxLength(32)]
    public string Status { get; set; } = "pending"; // pending|dispatched|failed|pending_channel_not_enabled

    public int AttemptCount { get; set; }

    public DateTimeOffset? NextRetryUtc { get; set; }

    public DateTimeOffset? LastAttemptUtc { get; set; }

    public DateTimeOffset? DeliveredUtc { get; set; }

    [MaxLength(2048)]
    public string? LastError { get; set; }

    public string? DeliveryPayloadJson { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
