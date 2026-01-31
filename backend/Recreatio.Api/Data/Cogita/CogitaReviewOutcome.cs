namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaReviewOutcome
{
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid PersonRoleId { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public Guid ItemId { get; set; }
    public string RevisionType { get; set; } = string.Empty;
    public string EvalType { get; set; } = string.Empty;
    public bool Correct { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public long ClientSequence { get; set; }
    public byte[]? PayloadHash { get; set; }
    public Guid DataKeyId { get; set; }
    public byte[] EncryptedBlob { get; set; } = Array.Empty<byte>();
    public DateTimeOffset CreatedUtc { get; set; }
}
