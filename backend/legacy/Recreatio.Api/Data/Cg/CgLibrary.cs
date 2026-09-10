namespace Recreatio.Api.Data.Cg;

public class CgLibrary
{
    public long Id { get; set; }
    public Guid OwnerAccountId { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
