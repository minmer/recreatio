using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

public class CgTemplateNode
{
    public long Id { get; set; }
    public long GraphId { get; set; }
    public string NodeKey { get; set; } = string.Empty;
    public string NodeType { get; set; } = string.Empty;
    public string ConfigJson { get; set; } = "{}";

    [Column(TypeName = "decimal(9,2)")]
    public decimal PositionX { get; set; }

    [Column(TypeName = "decimal(9,2)")]
    public decimal PositionY { get; set; }
}
