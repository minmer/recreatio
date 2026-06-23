using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Forms;

[Table("FormAnswers", Schema = "forms")]
public sealed class FormAnswer
{
    [Key]
    public Guid Id { get; set; }

    public Guid ResponseId { get; set; }

    public Guid QuestionId { get; set; }

    [MaxLength(2000)]
    public string? TextValue { get; set; }

    public string? SelectedOptionsJson { get; set; }
}
