using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleRecoveryPlanShare
{
    [Key]
    public Guid Id { get; set; }

    public Guid PlanId { get; set; }

    public Guid SharedWithRoleId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
