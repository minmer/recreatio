using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Chat;

[Table("ChatConversations", Schema = "chat")]
public sealed class ChatConversation
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(32)]
    public string ChatType { get; set; } = "group"; // group|direct|public-board

    [MaxLength(32)]
    public string ScopeType { get; set; } = "global"; // global|parish|event|limanowa|cogita

    [MaxLength(128)]
    public string? ScopeId { get; set; }

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public Guid CreatedByUserId { get; set; }

    public Guid? CreatedByRoleId { get; set; }

    public bool IsArchived { get; set; }

    public bool IsPublic { get; set; }

    public bool PublicReadEnabled { get; set; }

    public bool PublicQuestionEnabled { get; set; }

    public byte[]? PublicCodeHash { get; set; }

    public int ActiveKeyVersion { get; set; }

    public long LastMessageSequence { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
