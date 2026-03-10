using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaCreationProject
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    [MaxLength(32)]
    public string ProjectType { get; set; } = string.Empty;

    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    public string? ContentJson { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
