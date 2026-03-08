using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Chat;

[Table("ChatConversationReadStates", Schema = "chat")]
public sealed class ChatConversationReadState
{
    [Key]
    public Guid Id { get; set; }

    public Guid ConversationId { get; set; }

    public Guid UserId { get; set; }

    public long LastReadSequence { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
