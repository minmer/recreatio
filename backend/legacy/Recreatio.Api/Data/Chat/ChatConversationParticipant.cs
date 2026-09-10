using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Chat;

[Table("ChatConversationParticipants", Schema = "chat")]
public sealed class ChatConversationParticipant
{
    [Key]
    public Guid Id { get; set; }

    public Guid ConversationId { get; set; }

    [MaxLength(16)]
    public string SubjectType { get; set; } = "role"; // role|user

    public Guid SubjectId { get; set; }

    [MaxLength(120)]
    public string? DisplayLabel { get; set; }

    public bool CanRead { get; set; }

    public bool CanWrite { get; set; }

    public bool CanManage { get; set; }

    public bool CanRespondPublic { get; set; }

    public long MinReadableSequence { get; set; }

    public DateTimeOffset JoinedUtc { get; set; }

    public DateTimeOffset? RemovedUtc { get; set; }

    public Guid AddedByUserId { get; set; }
}
