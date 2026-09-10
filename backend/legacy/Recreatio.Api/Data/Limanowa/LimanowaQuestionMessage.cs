using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaQuestionMessages", Schema = "limanowa")]
public sealed class LimanowaQuestionMessage
{
    [Key]
    public Guid Id { get; set; }

    public Guid ThreadId { get; set; }

    [MaxLength(32)]
    public string AuthorType { get; set; } = string.Empty;

    [MaxLength(2400)]
    public string Message { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
