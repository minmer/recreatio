using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Edk;

[Table("EdkSiteConfigs", Schema = "edk")]
public sealed class EdkSiteConfig
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public string SiteConfigJson { get; set; } = string.Empty;

    public bool IsPublished { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
