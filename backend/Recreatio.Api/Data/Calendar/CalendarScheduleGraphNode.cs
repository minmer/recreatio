using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarScheduleGraphNodes", Schema = "calendar")]
public sealed class CalendarScheduleGraphNode
{
    [Key]
    public Guid Id { get; set; }

    public Guid GraphId { get; set; }

    [MaxLength(64)]
    public string NodeType { get; set; } = string.Empty;

    [MaxLength(128)]
    public string NodeKey { get; set; } = string.Empty;

    public string ConfigJson { get; set; } = "{}";

    [Column(TypeName = "decimal(9,2)")]
    public decimal PositionX { get; set; }

    [Column(TypeName = "decimal(9,2)")]
    public decimal PositionY { get; set; }
}
