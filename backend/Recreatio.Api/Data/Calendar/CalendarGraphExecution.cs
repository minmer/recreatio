using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarGraphExecutions", Schema = "calendar")]
public sealed class CalendarGraphExecution
{
    [Key]
    public Guid Id { get; set; }

    public Guid GraphId { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(128)]
    public string IdempotencyKey { get; set; } = string.Empty;

    [MaxLength(32)]
    public string TriggerType { get; set; } = "manual"; // manual|completion|schedule

    [MaxLength(24)]
    public string Status { get; set; } = "pending"; // pending|running|completed|failed|skipped

    public string? TriggerPayloadJson { get; set; }

    public string? ResultPayloadJson { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset StartedUtc { get; set; }

    public DateTimeOffset? FinishedUtc { get; set; }
}
