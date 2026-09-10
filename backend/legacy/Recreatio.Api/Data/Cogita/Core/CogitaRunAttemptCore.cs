using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaRunAttempts")]
public sealed class CogitaRunAttemptCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid ParticipantId { get; set; }
    public int RoundIndex { get; set; }
    [MaxLength(256)]
    public string CardKey { get; set; } = string.Empty;
    public string? AnswerCipher { get; set; }
    [MaxLength(32)]
    public string OutcomeClass { get; set; } = "wrong";
    public bool IsAnswered { get; set; }
    public bool? IsCorrect { get; set; }
    [Column(TypeName = "decimal(9,4)")]
    public decimal? CorrectnessPct { get; set; }
    public DateTimeOffset SubmittedUtc { get; set; }
    public DateTimeOffset? RevealedUtc { get; set; }
    public int? ResponseDurationMs { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
