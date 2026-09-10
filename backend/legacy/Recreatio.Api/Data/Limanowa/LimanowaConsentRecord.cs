using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaConsentRecords", Schema = "limanowa")]
public sealed class LimanowaConsentRecord
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParticipantId { get; set; }

    public bool RulesAccepted { get; set; }

    public bool PrivacyAccepted { get; set; }

    public DateTimeOffset SubmittedAt { get; set; }
}
