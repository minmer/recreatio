using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaStatisticEvent
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    [MaxLength(32)]
    public string ScopeType { get; set; } = "library";
    public Guid? ScopeId { get; set; }
    [MaxLength(32)]
    public string SourceType { get; set; } = "review";
    public Guid? SessionId { get; set; }
    public Guid? PersonRoleId { get; set; }
    public Guid? ParticipantId { get; set; }
    [MaxLength(120)]
    public string? ParticipantLabel { get; set; }
    [MaxLength(32)]
    public string? ItemType { get; set; }
    public Guid? ItemId { get; set; }
    [MaxLength(64)]
    public string? CheckType { get; set; }
    [MaxLength(64)]
    public string? Direction { get; set; }
    [MaxLength(64)]
    public string EventType { get; set; } = string.Empty;
    public int? RoundIndex { get; set; }
    [MaxLength(256)]
    public string? CardKey { get; set; }
    public bool? IsCorrect { get; set; }
    public double? Correctness { get; set; }
    public int? PointsAwarded { get; set; }
    public int? DurationMs { get; set; }
    public bool IsPersistent { get; set; }
    public string? PayloadJson { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
}
