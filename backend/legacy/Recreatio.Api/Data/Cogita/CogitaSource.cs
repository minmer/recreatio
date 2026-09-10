using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaSource
{
    [Key]
    public Guid InfoId { get; set; }

    public Guid DataKeyId { get; set; }

    public byte[] EncryptedBlob { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
