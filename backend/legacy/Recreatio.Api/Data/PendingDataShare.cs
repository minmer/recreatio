using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class PendingDataShare
{
    [Key]
    public Guid Id { get; set; }

    public Guid DataItemId { get; set; }

    public Guid SourceRoleId { get; set; }

    public Guid TargetRoleId { get; set; }

    public string PermissionType { get; set; } = string.Empty;

    public byte[] EncryptedDataKeyBlob { get; set; } = Array.Empty<byte>();

    public byte[]? EncryptedSigningKeyBlob { get; set; }

    public string EncryptionAlg { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending";

    public Guid LedgerRefId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? AcceptedUtc { get; set; }
}
