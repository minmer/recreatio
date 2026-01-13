using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class UserAccount
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(256)]
    public string LoginId { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? DisplayName { get; set; }

    public byte[] UserSalt { get; set; } = Array.Empty<byte>();

    public byte[] StoredH4 { get; set; } = Array.Empty<byte>();

    public AccountState State { get; set; } = AccountState.Active;

    public int FailedLoginCount { get; set; }

    public DateTimeOffset? LockedUntilUtc { get; set; }

    public Guid MasterRoleId { get; set; }

    public Role? MasterRole { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
