using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarSharedViewLinks", Schema = "calendar")]
public sealed class CalendarSharedViewLink
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid SharedViewId { get; set; }

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
