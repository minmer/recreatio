using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgNodeRelation")]
public sealed class CgNodeRelation
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParentNodeId { get; set; }

    public Guid ChildNodeId { get; set; }

    public string RelationType { get; set; } = "answer";

    public int SortOrder { get; set; }
}
