namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaReviewEvent
{
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid PersonRoleId { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public Guid ItemId { get; set; }
    public string? Direction { get; set; }
    public Guid DataKeyId { get; set; }
    public byte[] EncryptedBlob { get; set; } = Array.Empty<byte>();
    public DateTimeOffset CreatedUtc { get; set; }
}
