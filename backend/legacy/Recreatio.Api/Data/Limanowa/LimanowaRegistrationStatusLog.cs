using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaRegistrationStatusLogs", Schema = "limanowa")]
public sealed class LimanowaRegistrationStatusLog
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(32)]
    public string RelatedType { get; set; } = string.Empty;

    public Guid RelatedId { get; set; }

    [MaxLength(64)]
    public string? PreviousStatus { get; set; }

    [MaxLength(64)]
    public string NewStatus { get; set; } = string.Empty;

    [MaxLength(32)]
    public string ChangedByType { get; set; } = string.Empty;

    public Guid? ChangedById { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
