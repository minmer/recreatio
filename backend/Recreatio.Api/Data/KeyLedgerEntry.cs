using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class KeyLedgerEntry
{
    [Key]
    public Guid Id { get; set; }

    public DateTimeOffset TimestampUtc { get; set; }

    [MaxLength(64)]
    public string EventType { get; set; } = string.Empty;

    [MaxLength(128)]
    public string Actor { get; set; } = string.Empty;

    public string PayloadJson { get; set; } = "{}";

    public byte[] PreviousHash { get; set; } = Array.Empty<byte>();

    public byte[] Hash { get; set; } = Array.Empty<byte>();

    public Guid? SignerRoleId { get; set; }

    public byte[]? Signature { get; set; }

    [MaxLength(64)]
    public string? SignatureAlg { get; set; }
}
