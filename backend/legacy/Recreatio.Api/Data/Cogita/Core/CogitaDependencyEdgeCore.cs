using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaDependencyEdges")]
public sealed class CogitaDependencyEdgeCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid ParentCardId { get; set; }
    public Guid ChildCardId { get; set; }
    [Column(TypeName = "decimal(9,4)")]
    public decimal ParentKnownessWeightPct { get; set; }
    [Column(TypeName = "decimal(9,4)")]
    public decimal ThresholdPct { get; set; }
    public bool IsHardBlock { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
