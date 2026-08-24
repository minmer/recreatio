using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// Grants one access link the right to open one internal page. The absence of a
/// row is the denial — nothing else gates a page.
/// </summary>
[Table("EventAccessLinkPages", Schema = "events")]
public sealed class EventAccessLinkPage
{
    [Key]
    public Guid Id { get; set; }

    public Guid AccessLinkId { get; set; }

    public Guid PageId { get; set; }
}
