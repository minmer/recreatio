using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishIntention
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public DateTimeOffset MassDateTime { get; set; }

    [MaxLength(128)]
    public string ChurchName { get; set; } = string.Empty;

    [MaxLength(512)]
    public string PublicText { get; set; } = string.Empty;

    public byte[] InternalTextEnc { get; set; } = Array.Empty<byte>();

    public byte[] DonorRefEnc { get; set; } = Array.Empty<byte>();

    public Guid InternalDataKeyId { get; set; }

    [MaxLength(32)]
    public string Status { get; set; } = "Active";

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
