using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// A composable event. Carries no layout of its own — it is assembled from its
/// <see cref="EventPage"/> rows. The catalogue block below is what the events
/// overview filters and sorts on, so those fields are structured rather than
/// free text wherever a filter needs them.
/// </summary>
[Table("EventSites", Schema = "events")]
public sealed class EventSite
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>Tagline shown on the event page itself.</summary>
    [MaxLength(300)]
    public string? Subtitle { get; set; }

    // ── Catalogue ────────────────────────────────────────────────────────────

    /// <summary>Blurb for the overview card. Distinct from the on-page subtitle.</summary>
    [MaxLength(400)]
    public string? Summary { get; set; }

    /// <summary>
    /// The family this event belongs to — "Pielgrzymka rowerowa", "Warsztaty
    /// muzyczne". Free text so a new family needs no migration; the overview
    /// builds its filter from the distinct values in use.
    /// </summary>
    [MaxLength(80)]
    public string? Category { get; set; }

    /// <summary>Who it is for — "Młodzież 16–30", "Rodziny z dziećmi".</summary>
    [MaxLength(160)]
    public string? Audience { get; set; }

    /// <summary>JSON array of the main places, in order. Drives the place filter.</summary>
    public string? PlacesJson { get; set; }

    [MaxLength(600)]
    public string? ThumbnailUrl { get; set; }

    /// <summary>Sortable truth. <see cref="DateLabel"/> is only for display.</summary>
    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    /// <summary>Optional override; when empty the client formats from the dates.</summary>
    [MaxLength(120)]
    public string? DateLabel { get; set; }

    // ── Presentation ─────────────────────────────────────────────────────────

    public string? ThemeJson { get; set; }

    public bool IsPublished { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
