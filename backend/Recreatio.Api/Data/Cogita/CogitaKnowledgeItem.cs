using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita;

[Table("CogitaKnowledgeItems")]
public sealed class CogitaKnowledgeItem
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid RoleId { get; set; }
    public Guid TypeSpecId { get; set; }
    [MaxLength(96)]
    public string TypeKey { get; set; } = string.Empty;
    [MaxLength(512)]
    public string Title { get; set; } = string.Empty;
    public string SearchText { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public bool IsExcludedFromKnowness { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
