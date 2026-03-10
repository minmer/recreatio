using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaCheckcardDefinitions")]
public sealed class CogitaCheckcardDefinitionCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid SourceItemId { get; set; }
    [MaxLength(256)]
    public string CardKey { get; set; } = string.Empty;
    [MaxLength(64)]
    public string CardType { get; set; } = string.Empty;
    public int Direction { get; set; }
    public string PromptJson { get; set; } = "{}";
    public string RevealJson { get; set; } = "{}";
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
