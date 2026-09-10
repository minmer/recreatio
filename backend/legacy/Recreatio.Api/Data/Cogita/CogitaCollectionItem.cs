using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaCollectionItem
{
    [Key]
    public Guid Id { get; set; }

    public Guid CollectionInfoId { get; set; }

    public string ItemType { get; set; } = string.Empty;

    public Guid ItemId { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
