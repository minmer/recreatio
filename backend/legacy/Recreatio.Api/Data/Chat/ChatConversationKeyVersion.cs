using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Chat;

[Table("ChatConversationKeyVersions", Schema = "chat")]
public sealed class ChatConversationKeyVersion
{
    [Key]
    public Guid Id { get; set; }

    public Guid ConversationId { get; set; }

    public int Version { get; set; }

    public byte[] EncryptedKeyBlob { get; set; } = Array.Empty<byte>();

    [MaxLength(64)]
    public string Reason { get; set; } = "initial";

    public Guid RotatedByUserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
