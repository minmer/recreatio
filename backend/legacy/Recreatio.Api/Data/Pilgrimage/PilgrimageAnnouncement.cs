using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageAnnouncements", Schema = "pilgrimage")]
public sealed class PilgrimageAnnouncement
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(24)]
    public string Audience { get; set; } = "participant";

    [MaxLength(180)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2400)]
    public string Body { get; set; } = string.Empty;

    public bool IsCritical { get; set; }

    public Guid CreatedByRoleId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
