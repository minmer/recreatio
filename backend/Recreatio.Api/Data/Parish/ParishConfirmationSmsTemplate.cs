using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationSmsTemplate
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public string VerificationInviteTemplate { get; set; } = string.Empty;

    public string VerificationWarningTemplate { get; set; } = string.Empty;

    public string PortalInviteTemplate { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
