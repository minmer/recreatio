using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class DataItem
{
    [Key]
    public Guid Id { get; set; }

    public Guid OwnerRoleId { get; set; }

    public string ItemType { get; set; } = "data";

    public string ItemName { get; set; } = string.Empty;

    public byte[] EncryptedItemType { get; set; } = Array.Empty<byte>();

    public byte[] EncryptedItemName { get; set; } = Array.Empty<byte>();

    public byte[]? EncryptedValue { get; set; }

    public byte[] PublicSigningKey { get; set; } = Array.Empty<byte>();

    public string PublicSigningKeyAlg { get; set; } = string.Empty;

    public byte[]? DataSignature { get; set; }

    public string? DataSignatureAlg { get; set; }

    public Guid? DataSignatureRoleId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
