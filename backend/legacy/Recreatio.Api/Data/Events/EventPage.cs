using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// One page of an event. Every site has exactly one <c>public</c> page — the
/// address anyone can open — plus any number of <c>internal</c> pages that are
/// reachable only through an access link granted that page. Internal pages are
/// full pages with their own parts, never slides hidden on the public one.
/// </summary>
[Table("EventPages", Schema = "events")]
public sealed class EventPage
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    public int SortOrder { get; set; }

    /// <summary>public | internal</summary>
    [MaxLength(16)]
    public string Kind { get; set; } = "internal";

    /// <summary>Unique within the site; used in the switcher and in URLs.</summary>
    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>Label in the internal page switcher.</summary>
    [MaxLength(60)]
    public string MenuLabel { get; set; } = string.Empty;

    [MaxLength(600)]
    public string? Description { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
