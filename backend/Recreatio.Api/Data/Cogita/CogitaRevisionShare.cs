using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaRevisionShare
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public Guid RevisionId { get; set; }

    public Guid CollectionId { get; set; }

    public Guid OwnerRoleId { get; set; }

    public Guid SharedViewId { get; set; }

    public byte[] PublicCodeHash { get; set; } = Array.Empty<byte>();

    public byte[] EncShareCode { get; set; } = Array.Empty<byte>();

    [MaxLength(32)]
    public string Mode { get; set; } = "random";

    [MaxLength(32)]
    public string CheckMode { get; set; } = "exact";

    public int CardLimit { get; set; }

    [MaxLength(64)]
    public string? RevisionType { get; set; }

    public string? RevisionSettingsJson { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
