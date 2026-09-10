using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleRecoveryApproval
{
    [Key]
    public Guid Id { get; set; }

    public Guid RequestId { get; set; }

    public Guid ApproverRoleId { get; set; }

    public byte[] EncryptedApprovalBlob { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }
}
