using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaEntitySearchDocument
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public string SourceKind { get; set; } = string.Empty; // info | connection

    public Guid SourceId { get; set; }

    public string EntityKind { get; set; } = string.Empty; // single | connection | complex

    public string EntityType { get; set; } = string.Empty;

    public Guid? InfoId { get; set; }

    public Guid? ConnectionId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string TitleNormalized { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string SearchTextNormalized { get; set; } = string.Empty;

    public string FilterTextNormalized { get; set; } = string.Empty;

    public DateTimeOffset SourceUpdatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}

