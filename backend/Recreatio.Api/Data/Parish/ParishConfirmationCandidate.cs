using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data.Parish;

public sealed class ParishConfirmationCandidate
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParishId { get; set; }

    public byte[] PayloadEnc { get; set; } = Array.Empty<byte>();

    public bool AcceptedRodo { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
