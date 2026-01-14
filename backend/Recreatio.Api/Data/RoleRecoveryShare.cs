using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleRecoveryShare
{
    [Key]
    public Guid Id { get; set; }

    public Guid TargetRoleId { get; set; }

    public Guid SharedWithRoleId { get; set; }

    public byte[] EncryptedShareBlob { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
