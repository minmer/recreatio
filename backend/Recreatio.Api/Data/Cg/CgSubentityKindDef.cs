using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgSubentityKindDef")]
public sealed class CgSubentityKindDef
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParentNodeKindId { get; set; }

    public Guid ChildNodeKindId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
