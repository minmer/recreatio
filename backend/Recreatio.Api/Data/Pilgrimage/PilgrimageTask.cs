using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Pilgrimage;

[Table("PilgrimageTasks", Schema = "pilgrimage")]
public sealed class PilgrimageTask
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(180)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2400)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(24)]
    public string Status { get; set; } = "todo";

    [MaxLength(24)]
    public string Priority { get; set; } = "normal";

    [MaxLength(160)]
    public string Assignee { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string? Comments { get; set; }

    [MaxLength(2000)]
    public string? Attachments { get; set; }

    public DateTimeOffset? DueUtc { get; set; }

    public Guid CreatedByRoleId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
