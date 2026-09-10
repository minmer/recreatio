using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageEvents", Schema = "pilgrimage")]
public sealed class PilgrimageEvent
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(180)]
    public string Motto { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    [MaxLength(160)]
    public string StartLocation { get; set; } = string.Empty;

    [MaxLength(160)]
    public string EndLocation { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Theme { get; set; } = "pilgrimage";

    public decimal? DistanceKm { get; set; }

    public Guid RoleId { get; set; }

    public Guid OrganizerRoleId { get; set; }

    public Guid LogisticsRoleId { get; set; }

    public Guid MedicalRoleId { get; set; }

    public Guid PublicRoleId { get; set; }

    public Guid ParticipantDataItemId { get; set; }

    public Guid ParticipantDataKeyId { get; set; }

    public Guid EmergencyDataItemId { get; set; }

    public Guid EmergencyDataKeyId { get; set; }

    public byte[] ParticipantDataKeyServerEnc { get; set; } = Array.Empty<byte>();

    public byte[] EmergencyDataKeyServerEnc { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
