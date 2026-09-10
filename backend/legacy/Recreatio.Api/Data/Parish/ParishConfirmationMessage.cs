using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationMessage
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid CandidateId { get; set; }

    [MaxLength(16)]
    public string SenderType { get; set; } = "candidate";

    [MaxLength(2000)]
    public string MessageText { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }
}
