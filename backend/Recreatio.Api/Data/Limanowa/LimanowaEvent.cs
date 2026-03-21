using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Limanowa;

[Table("LimanowaEvents", Schema = "limanowa")]
public sealed class LimanowaEvent
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(220)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(520)]
    public string Subtitle { get; set; } = string.Empty;

    [MaxLength(260)]
    public string Tagline { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public int CapacityTotal { get; set; }

    public bool RegistrationOpen { get; set; }

    public DateOnly RegistrationGroupsDeadline { get; set; }

    public DateOnly RegistrationParticipantsDeadline { get; set; }

    public bool Published { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
