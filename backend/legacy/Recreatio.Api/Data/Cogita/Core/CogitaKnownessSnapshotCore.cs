using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaKnownessSnapshots")]
public sealed class CogitaKnownessSnapshotCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid PersonRoleId { get; set; }
    [MaxLength(256)]
    public string CardKey { get; set; } = string.Empty;
    public DateTimeOffset SnapshotUtc { get; set; }
    [Column(TypeName = "decimal(9,4)")]
    public decimal KnownessPct { get; set; }
    public int CorrectCount { get; set; }
    public int WrongCount { get; set; }
    public int UnansweredCount { get; set; }
    public DateTimeOffset? LastSeenUtc { get; set; }
    public Guid? SourceRunId { get; set; }
    public Guid? SourceParticipantId { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
}
