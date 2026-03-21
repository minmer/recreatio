using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaAnnouncements", Schema = "limanowa")]
public sealed class LimanowaAnnouncement
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(220)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(3200)]
    public string Body { get; set; } = string.Empty;

    [MaxLength(32)]
    public string AudienceType { get; set; } = "all";

    public DateTimeOffset PublishedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
