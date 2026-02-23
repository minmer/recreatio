using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaLiveRevisionParticipant
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    [MaxLength(120)]
    public string DisplayName { get; set; } = string.Empty;
    public Guid? UserId { get; set; }
    public byte[] JoinTokenHash { get; set; } = Array.Empty<byte>();
    public int Score { get; set; }
    public bool IsConnected { get; set; } = true;
    public DateTimeOffset JoinedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
