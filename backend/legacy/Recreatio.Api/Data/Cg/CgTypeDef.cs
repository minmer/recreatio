namespace Recreatio.Api.Data.Cg;

public class CgTypeDef
{
    public long Id { get; set; }
    public long LibraryId { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
