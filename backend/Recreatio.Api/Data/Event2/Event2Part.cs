using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Event2;

/// <summary>
/// One slide of a page. <see cref="Kind"/> selects the part module that renders
/// the content layer; <see cref="LayersJson"/> describes the gradient, image and
/// big-text layers behind it.
/// </summary>
[Table("Event2Parts", Schema = "event2")]
public sealed class Event2Part
{
    [Key]
    public Guid Id { get; set; }

    public Guid PageId { get; set; }

    public int SortOrder { get; set; }

    /// <summary>title | shortinfos | text | plan | map | faq | form | contact | gallery | files | people</summary>
    [MaxLength(20)]
    public string Kind { get; set; } = string.Empty;

    [MaxLength(60)]
    public string MenuLabel { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(600)]
    public string? Intro { get; set; }

    /// <summary>Kind-specific payload, owned by the part module.</summary>
    public string? ConfigJson { get; set; }

    public string? LayersJson { get; set; }

    /// <summary>Hidden parts stay in the editor but are not served to readers.</summary>
    public bool IsVisible { get; set; } = true;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
