using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaDashboardPreference
{
    [Key]
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    [MaxLength(64)]
    public string LayoutVersion { get; set; } = "v1";

    public string PreferencesJson { get; set; } = "{}";

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
