namespace Recreatio.Api.Data.Cg;

public class CgFieldValue
{
    public long Id { get; set; }
    public long EntityId { get; set; }
    public long FieldDefId { get; set; }
    public int SortOrder { get; set; }
    // Encrypted value for text/number/date fields (placeholder: base64 of plaintext)
    public string? EncryptedValue { get; set; }
    // Order-preserving shifted float for range search (placeholder: lexicographic encoding)
    public double? SearchFloat { get; set; }
    // Keyed hash for reference exact-match search
    public byte[]? SearchHash { get; set; }
    // Plaintext reference FK (graph structure, not content)
    public long? RefEntityId { get; set; }
}
