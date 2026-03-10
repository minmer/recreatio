using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaRevisionRuns")]
public sealed class CogitaRevisionRunCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid RevisionPatternId { get; set; }
    [MaxLength(32)]
    public string RunScope { get; set; } = string.Empty;
    [MaxLength(256)]
    public string? Title { get; set; }
    [MaxLength(32)]
    public string Status { get; set; } = string.Empty;
    public byte[]? SessionCodeHash { get; set; }
    [MaxLength(512)]
    public string? SessionCodeCipher { get; set; }
    public string SettingsJson { get; set; } = "{}";
    public string? PromptBundleJson { get; set; }
    public DateTimeOffset? StartedUtc { get; set; }
    public DateTimeOffset? FinishedUtc { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
