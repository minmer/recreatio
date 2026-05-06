using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgRangeNode")]
public sealed class CgRangeNode
{
    [Key]
    public Guid Id { get; set; }

    public string PrimitiveType { get; set; } = "Date";

    public DateTimeOffset CreatedUtc { get; set; }
}
