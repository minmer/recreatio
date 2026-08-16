using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// The supplementary participant record filled in behind an individual link:
/// the data a registration form has no business collecting from the open web —
/// address, PESEL, guardians, health — together with the statements the signer
/// accepted.
///
/// Kept apart from <see cref="EventRegistration"/> on purpose. A registration is
/// a public submission; this is a signed document about a named person, often a
/// minor, and it carries health data (RODO art. 9). Separating them keeps the
/// sensitive part behind the link, lets it be corrected without rewriting the
/// original submission, and makes it deletable on its own.
///
/// The answers live in JSON rather than in columns because the shape is fixed by
/// law, not by this application: it follows the karta kwalifikacyjna, and when
/// the regulation changes the payload changes with it. What must stay
/// queryable — who signed, when, under which clause — is columns.
/// </summary>
[Table("EventParticipantCards", Schema = "events")]
public sealed class EventParticipantCard
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    /// <summary>The card part this was filled in on.</summary>
    public Guid PartId { get; set; }

    /// <summary>Whose card it is. The link is the only way in, so it is required.</summary>
    public Guid AccessLinkId { get; set; }

    /// <summary>The registration this person came from, when there was one.</summary>
    public Guid? RegistrationId { get; set; }

    /// <summary>Answers by field code, as a JSON object.</summary>
    public string DataJson { get; set; } = "{}";

    /// <summary>
    /// What was accepted, as a JSON array of {code, label, text, accepted, atUtc}.
    /// The text is stored, not just the flag: RODO art. 7(1) requires being able
    /// to show what a person actually agreed to, and consent wording gets edited.
    /// </summary>
    public string ConsentsJson { get; set; } = "[]";

    /// <summary>
    /// The information clause shown when this card was signed, stored whole for
    /// the same reason — art. 13 is an obligation to inform, and proving it means
    /// keeping the text the person was actually shown.
    /// </summary>
    public string? ClauseText { get; set; }

    /// <summary>True when the participant was under age at signing.</summary>
    public bool IsMinor { get; set; }

    /// <summary>Who signed: participant | guardian.</summary>
    [MaxLength(16)]
    public string SignerRole { get; set; } = "participant";

    [MaxLength(200)]
    public string SignerName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? ParticipantName { get; set; }

    public DateTimeOffset SubmittedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
