using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgOpenTopic")]
public sealed class CgOpenTopic
{
    [Key]
    public Guid Id { get; set; }

    public Guid TopicNodeId { get; set; }

    public Guid LibraryId { get; set; }

    public Guid MarkedByAccountId { get; set; }

    public string? Note { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
