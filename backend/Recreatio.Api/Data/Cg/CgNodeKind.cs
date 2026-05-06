using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgNodeKind")]
public sealed class CgNodeKind
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool IsSubentity { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
