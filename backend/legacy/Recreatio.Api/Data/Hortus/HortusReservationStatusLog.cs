using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Hortus;

[Table("HortusReservationStatusLogs", Schema = "hortus")]
public sealed class HortusReservationStatusLog
{
    [Key]
    public Guid Id { get; set; }

    public Guid ReservationId { get; set; }

    [MaxLength(16)]
    public string FromStatus { get; set; } = string.Empty;

    [MaxLength(16)]
    public string ToStatus { get; set; } = string.Empty;

    public Guid? ChangedByUserId { get; set; }

    [MaxLength(400)]
    public string? Note { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
