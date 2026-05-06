using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgEdgeKind")]
public sealed class CgEdgeKind
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public string Name { get; set; } = string.Empty;

    public Guid? SourceKindId { get; set; }

    public string? TargetKindIdsJson { get; set; }

    public bool IsBuiltIn { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
