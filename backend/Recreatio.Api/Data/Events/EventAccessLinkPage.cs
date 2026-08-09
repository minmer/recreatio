using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Event2;

/// <summary>
/// Grants one access link the right to open one internal page. The absence of a
/// row is the denial — nothing else gates a page.
/// </summary>
[Table("Event2AccessLinkPages", Schema = "event2")]
public sealed class Event2AccessLinkPage
{
    [Key]
    public Guid Id { get; set; }

    public Guid AccessLinkId { get; set; }

    public Guid PageId { get; set; }
}
