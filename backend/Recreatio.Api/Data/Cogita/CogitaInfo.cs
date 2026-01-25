using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaInfo
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public string InfoType { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
