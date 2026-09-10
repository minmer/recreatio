using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Calendar;

[Table("CalendarEventRoleScopes", Schema = "calendar")]
public sealed class CalendarEventRoleScope
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid RoleId { get; set; }

    [MaxLength(24)]
    public string ScopeType { get; set; } = "owner"; // owner|participant|viewer

    public bool ViewerCanSeeTitle { get; set; } = true;

    public bool ViewerCanSeeGraph { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
