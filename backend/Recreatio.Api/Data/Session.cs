using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class Session
{
    [Key]
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    [MaxLength(128)]
    public string SessionId { get; set; } = string.Empty;

    public bool IsSecureMode { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset LastActivityUtc { get; set; }

    [MaxLength(256)]
    public string? DeviceInfo { get; set; }

    public bool IsRevoked { get; set; }
}
