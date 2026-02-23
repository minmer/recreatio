using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaLiveRevisionSession
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid RevisionId { get; set; }
    public Guid CollectionId { get; set; }
    public Guid HostRoleId { get; set; }
    public byte[] PublicCodeHash { get; set; } = Array.Empty<byte>();
    public byte[] HostSecretHash { get; set; } = Array.Empty<byte>();
    [MaxLength(24)]
    public string Status { get; set; } = "lobby"; // lobby|running|revealed|finished
    public int CurrentRoundIndex { get; set; }
    public int RevealVersion { get; set; }
    public string? CurrentPromptJson { get; set; }
    public string? CurrentRevealJson { get; set; }
    public string? SessionMetaJson { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
    public DateTimeOffset? StartedUtc { get; set; }
    public DateTimeOffset? FinishedUtc { get; set; }
}
