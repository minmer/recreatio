using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgNode")]
public sealed class CgNode
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public string NodeType { get; set; } = "Entity";

    public Guid? NodeKindId { get; set; }

    public Guid? ParentNodeId { get; set; }

    public string? Label { get; set; }

    public string? BodyJson { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
