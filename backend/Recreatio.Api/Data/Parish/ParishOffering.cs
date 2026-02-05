using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishOffering
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid IntentionId { get; set; }

    public byte[] AmountEnc { get; set; } = Array.Empty<byte>();

    [MaxLength(16)]
    public string Currency { get; set; } = "PLN";

    public DateTimeOffset Date { get; set; }

    public byte[] DonorRefEnc { get; set; } = Array.Empty<byte>();

    public Guid DataKeyId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
