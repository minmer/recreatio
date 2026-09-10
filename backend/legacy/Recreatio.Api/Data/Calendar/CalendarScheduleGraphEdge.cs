using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarScheduleGraphEdges", Schema = "calendar")]
public sealed class CalendarScheduleGraphEdge
{
    [Key]
    public Guid Id { get; set; }

    public Guid GraphId { get; set; }

    public Guid FromNodeId { get; set; }

    [MaxLength(64)]
    public string? FromPort { get; set; }

    public Guid ToNodeId { get; set; }

    [MaxLength(64)]
    public string? ToPort { get; set; }

    [MaxLength(64)]
    public string? EdgeType { get; set; }

    public string? ConditionJson { get; set; }
}
