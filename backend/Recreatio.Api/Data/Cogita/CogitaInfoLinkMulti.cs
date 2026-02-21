using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaInfoLinkMulti
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public Guid InfoId { get; set; }

    [MaxLength(64)]
    public string FieldKey { get; set; } = string.Empty;

    public Guid TargetInfoId { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
