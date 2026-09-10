using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaInfoSearchIndex
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public Guid InfoId { get; set; }

    public string InfoType { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public string LabelNormalized { get; set; } = string.Empty;

    public byte[] LabelHash { get; set; } = Array.Empty<byte>();

    public DateTimeOffset UpdatedUtc { get; set; }
}
