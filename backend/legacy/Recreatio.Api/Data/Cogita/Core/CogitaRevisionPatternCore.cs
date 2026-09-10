using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaRevisionPatterns")]
public sealed class CogitaRevisionPatternCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid RoleId { get; set; }
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(32)]
    public string Mode { get; set; } = string.Empty;
    public string SettingsJson { get; set; } = "{}";
    public string CollectionScopeJson { get; set; } = "{}";
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
