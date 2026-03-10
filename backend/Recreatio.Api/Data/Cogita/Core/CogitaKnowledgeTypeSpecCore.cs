using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaKnowledgeTypeSpecs")]
public sealed class CogitaKnowledgeTypeSpecCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    [MaxLength(96)]
    public string TypeKey { get; set; } = string.Empty;
    public int Version { get; set; }
    [MaxLength(256)]
    public string DisplayName { get; set; } = string.Empty;
    public string SpecJson { get; set; } = "{}";
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
