using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleRecoveryPlan
{
    [Key]
    public Guid Id { get; set; }

    public Guid TargetRoleId { get; set; }

    public Guid CreatedByRoleId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? ActivatedUtc { get; set; }
}
