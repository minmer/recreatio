using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaParticipants", Schema = "limanowa")]
public sealed class LimanowaParticipant
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid GroupId { get; set; }

    [MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(220)]
    public string ParishName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? ParentContactName { get; set; }

    [MaxLength(32)]
    public string? ParentContactPhone { get; set; }

    [MaxLength(200)]
    public string? GuardianName { get; set; }

    [MaxLength(32)]
    public string? GuardianPhone { get; set; }

    [MaxLength(2400)]
    public string? Notes { get; set; }

    [MaxLength(2400)]
    public string? HealthNotes { get; set; }

    [MaxLength(64)]
    public string? AccommodationType { get; set; }

    [MaxLength(64)]
    public string Status { get; set; } = "nieuzupełniony";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
