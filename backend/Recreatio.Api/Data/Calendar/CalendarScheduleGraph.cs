using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarScheduleGraphs", Schema = "calendar")]
public sealed class CalendarScheduleGraph
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(64)]
    public string TemplateKey { get; set; } = "daily";

    public string TemplateConfigJson { get; set; } = "{}";

    [MaxLength(24)]
    public string Status { get; set; } = "draft"; // draft|active|archived

    public int Version { get; set; } = 1;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
