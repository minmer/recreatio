using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaConnectionItem
{
    [Key]
    public Guid Id { get; set; }

    public Guid ConnectionId { get; set; }

    public Guid InfoId { get; set; }

    public int SortOrder { get; set; }
}
