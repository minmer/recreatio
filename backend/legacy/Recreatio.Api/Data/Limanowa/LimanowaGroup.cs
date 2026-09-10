using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaGroups", Schema = "limanowa")]
public sealed class LimanowaGroup
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(220)]
    public string ParishName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string ResponsibleName { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    public int ExpectedParticipantCount { get; set; }

    public int ExpectedGuardianCount { get; set; }

    [MaxLength(2400)]
    public string? Notes { get; set; }

    [MaxLength(64)]
    public string Status { get; set; } = "nowe zgłoszenie";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
