namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaCollectionDependency
{
    public Guid Id { get; set; }
    public Guid ParentCollectionInfoId { get; set; }
    public Guid ChildCollectionInfoId { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
}
