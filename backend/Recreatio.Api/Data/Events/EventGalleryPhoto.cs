using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// A photograph a participant added to one gallery slide.
///
/// Kept apart from <see cref="EventImage"/>, which is the organizer's own
/// library of backgrounds: this is somebody else's picture, it belongs to one
/// slide rather than to the event's furniture, and it carries who sent it. That
/// last part is the reason it is a table of its own — a picture nobody can be
/// asked about is a picture nobody can take down.
///
/// <see cref="AccessLinkId"/> is required, so every contribution is attributable
/// to the link it came through. There is no anonymous path into this table.
/// </summary>
[Table("EventGalleryPhotos", Schema = "events")]
public sealed class EventGalleryPhoto
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    /// <summary>The gallery slide it was added to.</summary>
    public Guid PartId { get; set; }

    public Guid AccessLinkId { get; set; }

    /// <summary>Copied at upload: who sent it, as the organizer knows them.</summary>
    [MaxLength(200)]
    public string UploaderName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(80)]
    public string ContentType { get; set; } = string.Empty;

    public int ByteSize { get; set; }

    public int Width { get; set; }

    public int Height { get; set; }

    public byte[] Data { get; set; } = [];

    /// <summary>What the sender wrote under it, if anything.</summary>
    [MaxLength(300)]
    public string? Caption { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
