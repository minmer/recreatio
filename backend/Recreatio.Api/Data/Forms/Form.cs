using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Forms;

[Table("Forms", Schema = "forms")]
public sealed class Form
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(800)]
    public string? Description { get; set; }

    public bool IsPublished { get; set; }

    [MaxLength(64)]
    public string FillToken { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
