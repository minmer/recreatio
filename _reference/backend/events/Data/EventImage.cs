using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// A background image uploaded for one event, so an organizer does not need to
/// host pictures elsewhere to use them.
///
/// The bytes live in the row rather than on disk: an event carries a handful of
/// images, they must survive a redeploy, and this keeps them inside the same
/// backup as everything else. The upload cap is what stops that being a bad
/// trade. Nothing here is encrypted — these are public page backgrounds, served
/// to anyone who opens the event.
/// </summary>
[Table("EventImages", Schema = "events")]
public sealed class EventImage
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(80)]
    public string ContentType { get; set; } = string.Empty;

    public int ByteSize { get; set; }

    public byte[] Data { get; set; } = [];

    public DateTimeOffset CreatedUtc { get; set; }
}
