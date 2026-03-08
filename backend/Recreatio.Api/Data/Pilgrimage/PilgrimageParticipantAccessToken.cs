using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageParticipantAccessTokens", Schema = "pilgrimage")]
public sealed class PilgrimageParticipantAccessToken
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid ParticipantId { get; set; }

    [MaxLength(32)]
    public byte[] TokenHash { get; set; } = Array.Empty<byte>();

    public DateTimeOffset ExpiresUtc { get; set; }

    public DateTimeOffset? LastUsedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
