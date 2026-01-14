using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleField
{
    [Key]
    public Guid Id { get; set; }

    public Guid RoleId { get; set; }

    [MaxLength(64)]
    public string FieldType { get; set; } = string.Empty;

    public byte[] EncryptedValue { get; set; } = Array.Empty<byte>();

    public Guid DataKeyId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
