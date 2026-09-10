using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita;

[Table("CogitaReferenceCryptoFields")]
public sealed class CogitaReferenceCryptoField
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    [MaxLength(96)]
    public string OwnerEntity { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
    [MaxLength(96)]
    public string FieldKey { get; set; } = string.Empty;
    [MaxLength(64)]
    public string PolicyVersion { get; set; } = "v1";
    [MaxLength(2048)]
    public string ValueCipher { get; set; } = string.Empty;
    public byte[] DeterministicHash { get; set; } = Array.Empty<byte>();
    [MaxLength(1024)]
    public string? SignatureBase64 { get; set; }
    [MaxLength(128)]
    public string? Signer { get; set; }
    [MaxLength(64)]
    public string? SignatureVersion { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
