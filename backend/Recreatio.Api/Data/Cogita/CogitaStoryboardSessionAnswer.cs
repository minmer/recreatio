using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaStoryboardSessionAnswer
{
    [Key]
    public Guid Id { get; set; }

    public Guid SessionId { get; set; }

    public Guid ParticipantId { get; set; }

    [MaxLength(256)]
    public string NodeKey { get; set; } = string.Empty;

    public Guid? NotionId { get; set; }

    [MaxLength(64)]
    public string? CheckType { get; set; }

    public bool IsCorrect { get; set; }

    public int AttemptCount { get; set; }

    public DateTimeOffset FirstSubmittedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
