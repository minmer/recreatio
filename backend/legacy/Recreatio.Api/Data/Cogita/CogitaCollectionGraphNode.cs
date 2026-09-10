using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaCollectionGraphNode
{
    [Key]
    public Guid Id { get; set; }

    public Guid GraphId { get; set; }

    public string NodeType { get; set; } = string.Empty;

    public Guid DataKeyId { get; set; }

    public byte[] EncryptedBlob { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
