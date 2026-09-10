using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita.Core;

[Table("CogitaRunParticipants")]
public sealed class CogitaRunParticipantCore
{
    [Key]
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid? PersonRoleId { get; set; }
    [MaxLength(512)]
    public string DisplayNameCipher { get; set; } = string.Empty;
    public byte[]? AccessTokenHash { get; set; }
    [MaxLength(512)]
    public string? AccessTokenCipher { get; set; }
    public bool IsHost { get; set; }
    public bool IsConnected { get; set; }
    public DateTimeOffset JoinedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
