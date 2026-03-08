using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageParticipantIssues", Schema = "pilgrimage")]
public sealed class PilgrimageParticipantIssue
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid ParticipantId { get; set; }

    [MaxLength(32)]
    public string Kind { get; set; } = "problem";

    [MaxLength(2400)]
    public string Message { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Status { get; set; } = "open";

    [MaxLength(1200)]
    public string? ResolutionNote { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
