using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class KeyEntry
{
    [Key]
    public Guid Id { get; set; }

    public KeyType KeyType { get; set; }

    public Guid OwnerRoleId { get; set; }

    public int Version { get; set; }

    public byte[] EncryptedKeyBlob { get; set; } = Array.Empty<byte>();

    [MaxLength(256)]
    public string MetadataJson { get; set; } = "{}";

    public Guid LedgerRefId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
