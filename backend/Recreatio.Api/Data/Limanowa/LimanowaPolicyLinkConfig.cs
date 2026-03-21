using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaPolicyLinkConfigs", Schema = "limanowa")]
public sealed class LimanowaPolicyLinkConfig
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(520)]
    public string PrivacyPolicyUrl { get; set; } = string.Empty;

    [MaxLength(520)]
    public string EventRulesUrl { get; set; } = string.Empty;

    [MaxLength(520)]
    public string ThingsToBringUrl { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
