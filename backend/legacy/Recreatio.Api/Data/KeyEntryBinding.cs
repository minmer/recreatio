using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class KeyEntryBinding
{
    [Key]
    public Guid Id { get; set; }

    public Guid KeyEntryId { get; set; }

    public Guid EntryId { get; set; }

    [MaxLength(64)]
    public string EntryType { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? EntrySubtype { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
