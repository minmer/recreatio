using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgFieldDef")]
public sealed class CgFieldDef
{
    [Key]
    public Guid Id { get; set; }

    public Guid NodeKindId { get; set; }

    public Guid LibraryId { get; set; }

    public string FieldName { get; set; } = string.Empty;

    public string FieldType { get; set; } = "Text";

    public Guid? RefNodeKindId { get; set; }

    public bool IsMultiValue { get; set; }

    public bool IsRangeCapable { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
