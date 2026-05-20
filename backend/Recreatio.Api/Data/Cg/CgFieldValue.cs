namespace Recreatio.Api.Data.Cg;

public class CgFieldValue
{
    public long Id { get; set; }
    public long EntityId { get; set; }
    public long FieldDefId { get; set; }
    public int SortOrder { get; set; }
    public string? EncryptedValue { get; set; }
    public long? RefEntityId { get; set; }
}
