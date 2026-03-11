using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PortalAdminAssignments", Schema = "pilgrimage")]
public sealed class PortalAdminAssignment
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(64)]
    public string ScopeKey { get; set; } = string.Empty;

    public Guid UserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
