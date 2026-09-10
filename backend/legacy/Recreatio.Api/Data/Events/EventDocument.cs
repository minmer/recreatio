using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Events;

/// <summary>
/// A document uploaded for one event — the regulamin, a consent to print, a GPX
/// track — so an organizer does not have to park files on a drive somewhere and
/// paste a link that expires.
///
/// Deliberately not the image table. Pictures are checked as pictures, painted
/// into pages and served inline; these are handed over as downloads, are read by
/// nothing in the browser, and are the kind of file where "it opened in the page"
/// would be the wrong answer. Sharing one table would mean one rule for two
/// different things.
///
/// The bytes live in the row for the same reason images do: a handful per event,
/// they must survive a redeploy, and they stay inside the same backup as
/// everything else. The size cap is what keeps that honest. Nothing here is
/// encrypted — these are the files an organizer publishes to participants.
/// </summary>
[Table("EventDocuments", Schema = "events")]
public sealed class EventDocument
{
    [Key]
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    /// <summary>The name it was uploaded under, and the name it is served as.</summary>
    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>Derived from the extension, never taken from the browser's claim.</summary>
    [MaxLength(120)]
    public string ContentType { get; set; } = string.Empty;

    public int ByteSize { get; set; }

    public byte[] Data { get; set; } = [];

    public DateTimeOffset CreatedUtc { get; set; }
}
