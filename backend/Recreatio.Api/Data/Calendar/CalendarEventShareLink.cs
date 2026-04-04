using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarEventShareLinks", Schema = "calendar")]
public sealed class CalendarEventShareLink
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public byte[] CodeHash { get; set; } = Array.Empty<byte>();

    [MaxLength(120)]
    public string Label { get; set; } = "shared-view";

    [MaxLength(24)]
    public string Mode { get; set; } = "readonly";

    public bool IsActive { get; set; }

    public DateTimeOffset? ExpiresUtc { get; set; }

    public Guid CreatedByUserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? LastUsedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
