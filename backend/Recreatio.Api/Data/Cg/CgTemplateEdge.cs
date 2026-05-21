namespace Recreatio.Api.Data.Cg;

public class CgTemplateEdge
{
    public long Id { get; set; }
    public long GraphId { get; set; }
    public string EdgeKey { get; set; } = string.Empty;
    public string SourceKey { get; set; } = string.Empty;
    public string TargetKey { get; set; } = string.Empty;
    public string? SourceHandle { get; set; }
    public string? TargetHandle { get; set; }
}
