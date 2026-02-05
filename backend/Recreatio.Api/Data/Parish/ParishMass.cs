using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishMass
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public DateTimeOffset MassDateTime { get; set; }

    [MaxLength(128)]
    public string ChurchName { get; set; } = string.Empty;

    [MaxLength(256)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(512)]
    public string? Note { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
