using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// One person's individual link. The token is the whole credential, so it comes
/// from a CSPRNG. Which internal pages it opens is decided per link by the rows
/// in <see cref="EventAccessLinkPage"/> — there is no permission ladder.
/// </summary>
[Table("EventAccessLinks", Schema = "events")]
public sealed class EventAccessLink
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    [MaxLength(64)]
    public string Token { get; set; } = string.Empty;

    [MaxLength(200)]
    public string RecipientName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? RecipientContact { get; set; }

    /// <summary>The registration this link was granted from, when there was one.</summary>
    public Guid? RegistrationId { get; set; }

    /// <summary>active | revoked</summary>
    [MaxLength(16)]
    public string Status { get; set; } = "active";

    /// <summary>Shown to the recipient on their own page.</summary>
    [MaxLength(1000)]
    public string? PersonalNote { get; set; }

    /// <summary>Organizer-only; never leaves the admin endpoints.</summary>
    [MaxLength(1000)]
    public string? InternalNote { get; set; }

    public int ViewCount { get; set; }

    public DateTimeOffset? LastViewedUtc { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
