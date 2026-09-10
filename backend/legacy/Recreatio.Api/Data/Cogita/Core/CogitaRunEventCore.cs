using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaRunEvents")]
public sealed class CogitaRunEventCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid RunId { get; set; }
    public Guid? ParticipantId { get; set; }
    [MaxLength(64)]
    public string EventType { get; set; } = string.Empty;
    public int? RoundIndex { get; set; }
    public string? PayloadJson { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
}
