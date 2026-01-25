using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaConnection
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public string ConnectionType { get; set; } = string.Empty;

    public byte[] ConnectionTypeHash { get; set; } = Array.Empty<byte>();

    public Guid DataKeyId { get; set; }

    public byte[] EncryptedBlob { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
