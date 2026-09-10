using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishSiteConfig
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public string HomepageConfigJson { get; set; } = string.Empty;

    public bool IsPublished { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
