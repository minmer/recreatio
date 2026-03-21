using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaAccommodationAssignments", Schema = "limanowa")]
public sealed class LimanowaAccommodationAssignment
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParticipantId { get; set; }

    [MaxLength(64)]
    public string Type { get; set; } = string.Empty;

    [MaxLength(1200)]
    public string? Note { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
