using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class PendingRoleShare
{
    [Key]
    public Guid Id { get; set; }

    public Guid SourceRoleId { get; set; }

    public Guid TargetRoleId { get; set; }

    [MaxLength(64)]
    public string RelationshipType { get; set; } = string.Empty;

    public byte[] EncryptedReadKeyBlob { get; set; } = Array.Empty<byte>();

    public byte[]? EncryptedWriteKeyBlob { get; set; }

    public byte[]? EncryptedOwnerKeyBlob { get; set; }

    [MaxLength(64)]
    public string EncryptionAlg { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Status { get; set; } = "Pending";

    public Guid LedgerRefId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? AcceptedUtc { get; set; }
}
