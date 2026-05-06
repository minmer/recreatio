using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgEdge")]
public sealed class CgEdge
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public Guid? EdgeKindId { get; set; }

    public Guid SourceNodeId { get; set; }

    public Guid TargetNodeId { get; set; }

    public string? PvState { get; set; }

    public string? PvNote { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
