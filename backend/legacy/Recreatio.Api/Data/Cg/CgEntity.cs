namespace Recreatio.Api.Data.Cg;

public class CgEntity
{
    public long Id { get; set; }
    public long LibraryId { get; set; }
    public long TypeDefId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
