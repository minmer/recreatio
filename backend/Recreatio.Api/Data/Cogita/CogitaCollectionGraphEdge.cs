using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaCollectionGraphEdge
{
    [Key]
    public Guid Id { get; set; }

    public Guid GraphId { get; set; }

    public Guid FromNodeId { get; set; }

    public string? FromPort { get; set; }

    public Guid ToNodeId { get; set; }

    public string? ToPort { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
