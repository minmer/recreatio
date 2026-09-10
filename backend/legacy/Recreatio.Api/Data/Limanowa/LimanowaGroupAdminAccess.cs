using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaGroupAdminAccesses", Schema = "limanowa")]
public sealed class LimanowaGroupAdminAccess
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid GroupId { get; set; }

    [MaxLength(32)]
    public byte[] TokenHash { get; set; } = Array.Empty<byte>();

    [MaxLength(32)]
    public string Phone { get; set; } = string.Empty;

    public DateTimeOffset? SentAt { get; set; }

    public DateTimeOffset? LastOpenedAt { get; set; }

    public bool Active { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
