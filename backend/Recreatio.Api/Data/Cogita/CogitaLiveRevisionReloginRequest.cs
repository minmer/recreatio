using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaLiveRevisionReloginRequest
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    [MaxLength(120)]
    public string DisplayName { get; set; } = string.Empty;
    [MaxLength(24)]
    public string Status { get; set; } = "pending"; // pending|approved|used|rejected
    public DateTimeOffset RequestedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
    public DateTimeOffset? ApprovedUtc { get; set; }
}
