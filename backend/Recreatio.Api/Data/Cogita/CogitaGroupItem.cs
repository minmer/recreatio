using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaGroupItem
{
    [Key]
    public Guid Id { get; set; }

    public Guid GroupId { get; set; }

    public Guid InfoId { get; set; }

    public int SortOrder { get; set; }
}
