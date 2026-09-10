using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishMassRule
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(600)]
    public string? Description { get; set; }

    public string GraphJson { get; set; } = "{}";

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
