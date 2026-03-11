using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita;

[Table("CogitaCreationArtifacts")]
public sealed class CogitaCreationArtifact
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid ProjectId { get; set; }
    [MaxLength(48)]
    public string ArtifactType { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;
    public string ContentJson { get; set; } = "{}";
    public Guid? SourceItemId { get; set; }
    [MaxLength(256)]
    public string? SourceCardKey { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
