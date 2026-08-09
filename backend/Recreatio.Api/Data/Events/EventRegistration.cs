using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// One filled-in form part. The participant's name and contact are copied out of
/// the identity-flagged fields at submit time, so the organizer sees people
/// rather than anonymous rows and can grant access straight from the list.
/// </summary>
[Table("EventRegistrations", Schema = "events")]
public sealed class EventRegistration
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    public Guid PartId { get; set; }

    [MaxLength(200)]
    public string? ParticipantName { get; set; }

    [MaxLength(200)]
    public string? ParticipantContact { get; set; }

    /// <summary>Set when the form was submitted from inside an access link.</summary>
    public Guid? AccessLinkId { get; set; }

    public DateTimeOffset SubmittedUtc { get; set; }
}
