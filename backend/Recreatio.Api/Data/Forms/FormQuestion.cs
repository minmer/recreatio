using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Forms;

[Table("FormQuestions", Schema = "forms")]
public sealed class FormQuestion
{
    [Key]
    public Guid Id { get; set; }

    public Guid FormId { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(600)]
    public string Text { get; set; } = string.Empty;

    [MaxLength(16)]
    public string Type { get; set; } = string.Empty;

    public string? OptionsJson { get; set; }

    public bool IsRequired { get; set; }

    public Guid? ConditionQuestionId { get; set; }

    [MaxLength(600)]
    public string? ConditionValue { get; set; }
}
