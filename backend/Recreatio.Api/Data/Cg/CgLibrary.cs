using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cg;

[Table("CgLibrary")]
public sealed class CgLibrary
{
    [Key]
    public Guid Id { get; set; }

    public Guid OwnerAccountId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Template { get; set; } = "custom";

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
