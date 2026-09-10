using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Rowerowa;

[Table("RowerowaRegistrations", Schema = "rowerowa")]
public sealed class RowerowaRegistration
{
    [Key]
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    [MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(32)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(160)]
    public string JoinPoint { get; set; } = string.Empty;

    [MaxLength(160)]
    public string FridayAccommodation { get; set; } = string.Empty;

    public string MealsJson { get; set; } = "[]";

    [MaxLength(200)]
    public string PostPilgrimagePlan { get; set; } = string.Empty;

    [MaxLength(200)]
    public string BikeReturn { get; set; } = string.Empty;

    [MaxLength(120)]
    public string LuggageDropoff { get; set; } = string.Empty;

    [MaxLength(120)]
    public string LuggagePickup { get; set; } = string.Empty;

    public bool HasHelmet { get; set; }

    public bool BikeRoadworthy { get; set; }

    public bool KnowsSafetyRules { get; set; }

    [MaxLength(220)]
    public string SkillLevel { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? HelpOffer { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
