using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Event2;

/// <summary>
/// A label/value pair attached to one access link — the per-person detail
/// ("Twoja grupa: 3", "Zbiórka: 7:40, brama B").
/// </summary>
[Table("Event2AccessLinkAssignments", Schema = "event2")]
public sealed class Event2AccessLinkAssignment
{
    [Key]
    public Guid Id { get; set; }

    public Guid AccessLinkId { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(160)]
    public string Label { get; set; } = string.Empty;

    [MaxLength(600)]
    public string Value { get; set; } = string.Empty;
}
