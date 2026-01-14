using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class PersonField
{
    [Key]
    public Guid Id { get; set; }

    public Guid PersonRoleId { get; set; }

    [MaxLength(64)]
    public string FieldType { get; set; } = string.Empty;

    public Guid DataKeyId { get; set; }

    public byte[] EncryptedValue { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
