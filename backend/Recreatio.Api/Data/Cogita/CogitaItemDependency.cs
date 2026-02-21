using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaItemDependency
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    [MaxLength(32)]
    public string ParentItemType { get; set; } = string.Empty;

    public Guid ParentItemId { get; set; }

    [MaxLength(64)]
    public string? ParentCheckType { get; set; }

    [MaxLength(64)]
    public string? ParentDirection { get; set; }

    [MaxLength(32)]
    public string ChildItemType { get; set; } = string.Empty;

    public Guid ChildItemId { get; set; }

    [MaxLength(64)]
    public string? ChildCheckType { get; set; }

    [MaxLength(64)]
    public string? ChildDirection { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
