using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaItemDependency
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public string ParentItemType { get; set; } = string.Empty;

    public Guid ParentItemId { get; set; }

    public string? ParentCheckType { get; set; }

    public string? ParentDirection { get; set; }

    public string ChildItemType { get; set; } = string.Empty;

    public Guid ChildItemId { get; set; }

    public string? ChildCheckType { get; set; }

    public string? ChildDirection { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
