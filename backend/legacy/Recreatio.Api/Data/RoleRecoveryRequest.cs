using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleRecoveryRequest
{
    [Key]
    public Guid Id { get; set; }

    public Guid TargetRoleId { get; set; }

    public Guid InitiatorRoleId { get; set; }

    [MaxLength(32)]
    public string Status { get; set; } = "Pending";

    public int RequiredApprovals { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? CanceledUtc { get; set; }

    public DateTimeOffset? CompletedUtc { get; set; }
}
