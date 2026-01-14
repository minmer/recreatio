using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class Role
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(128)]
    public string RoleType { get; set; } = string.Empty;

    public byte[] EncryptedRoleBlob { get; set; } = Array.Empty<byte>();

    public byte[]? PublicSigningKey { get; set; }

    [MaxLength(64)]
    public string? PublicSigningKeyAlg { get; set; }

    public byte[]? PublicEncryptionKey { get; set; }

    [MaxLength(64)]
    public string? PublicEncryptionKeyAlg { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
