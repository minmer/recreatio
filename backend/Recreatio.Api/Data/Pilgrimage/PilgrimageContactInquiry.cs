using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageContactInquiries", Schema = "pilgrimage")]
public sealed class PilgrimageContactInquiry
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(180)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(80)]
    public string? Phone { get; set; }

    [MaxLength(180)]
    public string? Email { get; set; }

    [MaxLength(120)]
    public string Topic { get; set; } = string.Empty;

    [MaxLength(2400)]
    public string Message { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Status { get; set; } = "new";

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
