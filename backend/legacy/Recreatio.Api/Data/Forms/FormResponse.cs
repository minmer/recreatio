using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Forms;

[Table("FormResponses", Schema = "forms")]
public sealed class FormResponse
{
    [Key]
    public Guid Id { get; set; }

    public Guid FormId { get; set; }

    [MaxLength(200)]
    public string? RespondentName { get; set; }

    public DateTimeOffset SubmittedUtc { get; set; }
}
