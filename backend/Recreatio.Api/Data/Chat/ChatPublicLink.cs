using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Chat;

[Table("ChatPublicLinks", Schema = "chat")]
public sealed class ChatPublicLink
{
    [Key]
    public Guid Id { get; set; }

    public Guid ConversationId { get; set; }

    public byte[] CodeHash { get; set; } = Array.Empty<byte>();

    [MaxLength(120)]
    public string Label { get; set; } = "public";

    public bool IsActive { get; set; }

    public DateTimeOffset? ExpiresUtc { get; set; }

    public Guid CreatedByUserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? LastUsedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
