using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaRevisionShare
{
    [Key]
    public Guid Id { get; set; }

    public Guid LibraryId { get; set; }

    public Guid CollectionId { get; set; }

    public Guid OwnerRoleId { get; set; }

    public Guid SharedViewId { get; set; }

    [MaxLength(32)]
    public string Mode { get; set; } = "random";

    [MaxLength(32)]
    public string CheckMode { get; set; } = "exact";

    public int CardLimit { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset? RevokedUtc { get; set; }
}
