using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationCelebration
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(320)]
    public string ShortInfo { get; set; } = string.Empty;

    public DateTimeOffset StartsAtUtc { get; set; }

    public DateTimeOffset EndsAtUtc { get; set; }

    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    public int? Capacity { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
