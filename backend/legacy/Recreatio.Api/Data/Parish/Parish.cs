using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class Parish
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Theme { get; set; } = "classic";

    [MaxLength(256)]
    public string? HeroImageUrl { get; set; }

    public Guid RoleId { get; set; }

    public Guid AdminRoleId { get; set; }

    public Guid PriestRoleId { get; set; }

    public Guid OfficeRoleId { get; set; }

    public Guid FinanceRoleId { get; set; }

    public Guid PublicRoleId { get; set; }

    public Guid IntentionInternalDataItemId { get; set; }

    public Guid IntentionPublicDataItemId { get; set; }

    public Guid OfferingDataItemId { get; set; }

    public Guid IntentionInternalKeyId { get; set; }

    public Guid IntentionPublicKeyId { get; set; }

    public Guid OfferingKeyId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
