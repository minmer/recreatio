using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaGroupConnection
{
    [Key]
    public Guid Id { get; set; }

    public Guid GroupId { get; set; }

    public Guid ConnectionId { get; set; }
}
