using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Chat;

[Table("ChatMessages", Schema = "chat")]
public sealed class ChatMessage
{
    [Key]
    public Guid Id { get; set; }

    public Guid ConversationId { get; set; }

    public long Sequence { get; set; }

    public Guid? SenderUserId { get; set; }

    public Guid? SenderRoleId { get; set; }

    [MaxLength(120)]
    public string SenderDisplay { get; set; } = string.Empty;

    [MaxLength(24)]
    public string MessageType { get; set; } = "text"; // text|question|answer|system

    [MaxLength(24)]
    public string Visibility { get; set; } = "internal"; // internal|public

    [MaxLength(64)]
    public string? ClientMessageId { get; set; }

    public int KeyVersion { get; set; }

    public byte[] Ciphertext { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? EditedUtc { get; set; }

    public DateTimeOffset? DeletedUtc { get; set; }
}
