using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaQuestionThreads", Schema = "limanowa")]
public sealed class LimanowaQuestionThread
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(32)]
    public string RelatedType { get; set; } = string.Empty;

    public Guid RelatedId { get; set; }

    [MaxLength(32)]
    public string Status { get; set; } = "open";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
