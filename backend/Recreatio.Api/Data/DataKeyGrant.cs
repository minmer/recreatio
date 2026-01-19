using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class DataKeyGrant
{
    [Key]
    public Guid Id { get; set; }

    public Guid DataItemId { get; set; }

    public Guid RoleId { get; set; }

    public string PermissionType { get; set; } = string.Empty;

    public byte[] EncryptedDataKeyBlob { get; set; } = Array.Empty<byte>();

    public byte[]? EncryptedSigningKeyBlob { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
