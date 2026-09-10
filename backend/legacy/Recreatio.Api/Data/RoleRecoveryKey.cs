using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleRecoveryKey
{
    [Key]
    public Guid Id { get; set; }

    public Guid TargetRoleId { get; set; }

    public byte[] EncryptedServerShare { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
