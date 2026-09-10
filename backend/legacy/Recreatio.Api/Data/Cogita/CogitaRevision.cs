using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaRevision
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public Guid CollectionId { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(64)]
    public string RevisionType { get; set; } = string.Empty;

    public string? RevisionSettingsJson { get; set; }

    [MaxLength(32)]
    public string Mode { get; set; } = "random";

    [MaxLength(32)]
    public string CheckMode { get; set; } = "exact";

    public int CardLimit { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

