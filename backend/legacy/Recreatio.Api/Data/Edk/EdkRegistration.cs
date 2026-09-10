using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Edk;

[Table("EdkRegistrations", Schema = "edk")]
public sealed class EdkRegistration
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(64)]
    public string ParticipantStatus { get; set; } = "adult";

    [MaxLength(2400)]
    public string? AdditionalInfo { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
