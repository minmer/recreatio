namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaDependencyGraphEdge
{
    public Guid Id { get; set; }
    public Guid GraphId { get; set; }
    public Guid FromNodeId { get; set; }
    public Guid ToNodeId { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
}
