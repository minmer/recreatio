using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class SharedView
{
    [Key]
    public Guid Id { get; set; }

    public Guid OwnerRoleId { get; set; }

    public Guid ViewRoleId { get; set; }

    public byte[] EncViewRoleKey { get; set; } = Array.Empty<byte>();

    public byte[] SharedViewSecretHash { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
