using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaStoryboardSessionParticipant
{
    [Key]
    public Guid Id { get; set; }

    public Guid SessionId { get; set; }

    public byte[] JoinTokenHash { get; set; } = Array.Empty<byte>();

    public Guid? UserId { get; set; }

    public DateTimeOffset JoinedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
