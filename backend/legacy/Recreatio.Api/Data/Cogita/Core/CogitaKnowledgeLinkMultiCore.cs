using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaKnowledgeLinkMultis")]
public sealed class CogitaKnowledgeLinkMultiCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid SourceItemId { get; set; }
    [MaxLength(64)]
    public string FieldKey { get; set; } = string.Empty;
    public Guid TargetItemId { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
