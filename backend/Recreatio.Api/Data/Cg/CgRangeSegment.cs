using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgRangeSegment")]
public sealed class CgRangeSegment
{
    [Key]
    public Guid Id { get; set; }

    public Guid RangeNodeId { get; set; }

    public string? FromValue { get; set; }

    public string? ToValue { get; set; }

    public string? FromState { get; set; }

    public string? ToState { get; set; }

    public int SortOrder { get; set; }
}
