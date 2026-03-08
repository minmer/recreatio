using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageParticipants", Schema = "pilgrimage")]
public sealed class PilgrimageParticipant
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(32)]
    public string ParticipationVariant { get; set; } = "full";

    [MaxLength(120)]
    public string? GroupName { get; set; }

    [MaxLength(32)]
    public string RegistrationStatus { get; set; } = "pending";

    [MaxLength(32)]
    public string PaymentStatus { get; set; } = "pending";

    [MaxLength(32)]
    public string AttendanceStatus { get; set; } = "not-checked-in";

    public bool NeedsLodging { get; set; }

    public bool NeedsBaggageTransport { get; set; }

    public bool IsMinor { get; set; }

    public bool AcceptedTerms { get; set; }

    public bool AcceptedRodo { get; set; }

    [MaxLength(32)]
    public byte[] IdentityDigest { get; set; } = Array.Empty<byte>();

    public byte[] PayloadEnc { get; set; } = Array.Empty<byte>();

    public Guid PayloadDataKeyId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
