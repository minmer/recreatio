using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationPhoneVerification
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public Guid CandidateId { get; set; }

    public int PhoneIndex { get; set; }

    [MaxLength(128)]
    public string VerificationToken { get; set; } = string.Empty;

    public DateTimeOffset? VerifiedUtc { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
