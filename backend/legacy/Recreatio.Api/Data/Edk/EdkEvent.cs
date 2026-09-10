using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Edk;

[Table("EdkEvents", Schema = "edk")]
public sealed class EdkEvent
{
    [Key]
    public Guid Id { get; set; }

    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(220)]
    public string Motto { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    [MaxLength(160)]
    public string StartLocation { get; set; } = string.Empty;

    [MaxLength(160)]
    public string EndLocation { get; set; } = string.Empty;

    [MaxLength(160)]
    public string OrganizerName { get; set; } = string.Empty;

    [MaxLength(180)]
    public string OrganizerEmail { get; set; } = string.Empty;

    [MaxLength(32)]
    public string OrganizerPhone { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
