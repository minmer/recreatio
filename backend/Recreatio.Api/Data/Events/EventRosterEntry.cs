using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// One thing written onto the participant list itself: attendance ticked off at
/// the gate, a bus number, a note that the money arrived.
///
/// It belongs to the roster slide rather than to the person, and that is the
/// point. A registration is what somebody sent in and a card is what they
/// signed; neither may be rewritten by an organizer with a clipboard. This is
/// the organizer's own column — kept apart, deletable with the slide, and never
/// mistaken for something the participant said.
///
/// <see cref="RowKey"/> is the row as the list builds it ("r-{registrationId}"
/// or "l-{linkId}"), because a person here is a registration, a link, or both,
/// and the pairing is worked out when the table is assembled.
/// </summary>
[Table("EventRosterEntries", Schema = "events")]
public sealed class EventRosterEntry
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    /// <summary>The roster part this was written on.</summary>
    public Guid PartId { get; set; }

    [MaxLength(64)]
    public string RowKey { get; set; } = string.Empty;

    /// <summary>The column's code, as declared in the slide's config.</summary>
    [MaxLength(40)]
    public string Code { get; set; } = string.Empty;

    /// <summary>Null or empty means the mark was taken back.</summary>
    [MaxLength(400)]
    public string? Value { get; set; }

    /// <summary>
    /// Who last wrote it — the recipient name of the link, or "organizator".
    /// A list several people fill in during a day is one where somebody will
    /// ask who ticked a name off.
    /// </summary>
    [MaxLength(200)]
    public string? UpdatedBy { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
