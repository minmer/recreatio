using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaRevisionShares")]
public sealed class CogitaRevisionShareCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid RevisionPatternId { get; set; }
    public byte[] ShareCodeHash { get; set; } = Array.Empty<byte>();
    [MaxLength(512)]
    public string ShareCodeCipher { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public string SettingsJson { get; set; } = "{}";
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
