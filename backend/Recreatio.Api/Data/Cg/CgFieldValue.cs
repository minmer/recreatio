using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgFieldValue")]
public sealed class CgFieldValue
{
    [Key]
    public Guid Id { get; set; }

    public Guid NodeId { get; set; }

    public Guid FieldDefId { get; set; }

    public string? TextValue { get; set; }

    public double? NumberValue { get; set; }

    public string? DateValue { get; set; }

    public bool? BoolValue { get; set; }

    public Guid? RefNodeId { get; set; }

    public string? PvState { get; set; }

    public string? PvNote { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
