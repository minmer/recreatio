using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageSiteConfigs", Schema = "pilgrimage")]
public sealed class PilgrimageSiteConfig
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public string PublicConfigJson { get; set; } = string.Empty;

    public string ParticipantConfigJson { get; set; } = string.Empty;

    public string OrganizerConfigJson { get; set; } = string.Empty;

    public bool IsPublished { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
