using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaStoryboardSession
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public Guid ProjectId { get; set; }

    public Guid OwnerRoleId { get; set; }

    public byte[] PublicCodeHash { get; set; } = Array.Empty<byte>();

    public byte[] EncSessionCode { get; set; } = Array.Empty<byte>();

    public byte[] EncLibraryReadKey { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
