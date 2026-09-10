using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita;

[Table("CogitaRunExposures")]
public sealed class CogitaRunExposure
{
    [Key]
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid ParticipantId { get; set; }
    public int RoundIndex { get; set; }
    [MaxLength(256)]
    public string CardKey { get; set; } = string.Empty;
    public DateTimeOffset PromptShownUtc { get; set; }
    public DateTimeOffset? RevealShownUtc { get; set; }
    public bool WasSkipped { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
}
