using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaLiveRevisionAnswer
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid ParticipantId { get; set; }
    public int RoundIndex { get; set; }
    public string? CardKey { get; set; }
    public string? AnswerJson { get; set; }
    public bool? IsCorrect { get; set; }
    public int PointsAwarded { get; set; }
    public DateTimeOffset SubmittedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
