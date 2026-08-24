using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// One question asked by a participant, with the answers underneath it.
///
/// Deliberately not a chat: a chat is a river you have to keep up with, and the
/// same question gets asked in it four times a day. A topic is a thing someone
/// can find already answered. That is why the list is ordered by the last reply
/// rather than by creation, and why every message carries a name.
///
/// There is no anonymity here and no separate identity to manage: writing needs
/// an individual link, and the name comes from that link. Somebody who has not
/// been given a link cannot post at all.
/// </summary>
[Table("EventTopics", Schema = "events")]
public sealed class EventTopic
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    /// <summary>The discussion part this topic belongs to.</summary>
    public Guid PartId { get; set; }

    /// <summary>Who opened it. Kept so the author can be told apart from repliers.</summary>
    public Guid AccessLinkId { get; set; }

    [MaxLength(200)]
    public string AuthorName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// open | closed | disabled.
    ///
    /// <c>closed</c> — answered, or run its course: still there to read, but
    /// nothing more can be written. Set by whoever opened it, or by the admin.
    ///
    /// <c>disabled</c> — taken out of circulation by the admin: it stops
    /// appearing and stops opening. Nothing is destroyed, because a question
    /// somebody asked and answers other people wrote are not the admin's to
    /// erase — and a thread deleted in a hurry cannot be got back.
    /// </summary>
    [MaxLength(16)]
    public string Status { get; set; } = "open";

    public DateTimeOffset CreatedUtc { get; set; }

    /// <summary>
    /// Denormalized so the list can be ordered and counted without reading every
    /// message of every topic. Updated in the same transaction as the message.
    /// </summary>
    public DateTimeOffset LastMessageUtc { get; set; }

    public int MessageCount { get; set; }
}

/// <summary>One message inside a topic — the opening question included.</summary>
[Table("EventTopicMessages", Schema = "events")]
public sealed class EventTopicMessage
{
    [Key]
    public Guid Id { get; set; }

    public Guid TopicId { get; set; }

    public Guid AccessLinkId { get; set; }

    [MaxLength(200)]
    public string AuthorName { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Body { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }
}
