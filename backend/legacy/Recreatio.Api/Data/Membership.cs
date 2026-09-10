using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class Membership
{
    [Key]
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid RoleId { get; set; }

    [MaxLength(64)]
    public string RelationshipType { get; set; } = string.Empty;

    public byte[] EncryptedReadKeyCopy { get; set; } = Array.Empty<byte>();

    public byte[]? EncryptedWriteKeyCopy { get; set; }

    public byte[]? EncryptedOwnerKeyCopy { get; set; }

    public Guid LedgerRefId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
