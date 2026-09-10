using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaGame
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid RoleId { get; set; }
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;
    public Guid? StoryboardProjectId { get; set; }
    [MaxLength(24)]
    public string Mode { get; set; } = "mixed"; // solo|group|mixed
    public string SettingsJson { get; set; } = "{}";
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameValue
{
    [Key]
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    [MaxLength(96)]
    public string ValueKey { get; set; } = string.Empty;
    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(24)]
    public string ScopeType { get; set; } = "participant"; // session|group|participant
    [MaxLength(24)]
    public string Visibility { get; set; } = "public"; // public|group|private
    [MaxLength(24)]
    public string DataType { get; set; } = "number"; // number|bool|string
    public string DefaultValueJson { get; set; } = "0";
    public string? ConstraintsJson { get; set; }
    public bool IsScore { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameActionGraph
{
    [Key]
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public int Version { get; set; }
    [MaxLength(24)]
    public string Status { get; set; } = "draft"; // draft|published
    public DateTimeOffset? PublishedUtc { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameActionNode
{
    [Key]
    public Guid Id { get; set; }
    public Guid GraphId { get; set; }
    [MaxLength(64)]
    public string NodeType { get; set; } = string.Empty;
    public string ConfigJson { get; set; } = "{}";
    [Column(TypeName = "decimal(9,2)")]
    public decimal PositionX { get; set; }
    [Column(TypeName = "decimal(9,2)")]
    public decimal PositionY { get; set; }
}

public sealed class CogitaGameActionEdge
{
    [Key]
    public Guid Id { get; set; }
    public Guid GraphId { get; set; }
    public Guid FromNodeId { get; set; }
    [MaxLength(64)]
    public string? FromPort { get; set; }
    public Guid ToNodeId { get; set; }
    [MaxLength(64)]
    public string? ToPort { get; set; }
}

public sealed class CogitaGameLayout
{
    [Key]
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    [MaxLength(32)]
    public string RoleType { get; set; } = "participant"; // host|groupLeader|participant
    public string LayoutJson { get; set; } = "{}";
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameSession
{
    [Key]
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public Guid GameId { get; set; }
    public Guid HostRoleId { get; set; }
    public byte[] PublicCodeHash { get; set; } = Array.Empty<byte>();
    public byte[] HostSecretHash { get; set; } = Array.Empty<byte>();
    [MaxLength(24)]
    public string Status { get; set; } = "lobby";
    [MaxLength(24)]
    public string Phase { get; set; } = "lobby";
    public int RoundIndex { get; set; }
    public int Version { get; set; }
    public string? SessionMetaJson { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
    public DateTimeOffset? StartedUtc { get; set; }
    public DateTimeOffset? FinishedUtc { get; set; }
}

public sealed class CogitaGameSessionGroup
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    [MaxLength(96)]
    public string GroupKey { get; set; } = string.Empty;
    [MaxLength(160)]
    public string DisplayName { get; set; } = string.Empty;
    public string? DisplayNameCipher { get; set; }
    public int Capacity { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameParticipant
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid? GroupId { get; set; }
    [MaxLength(24)]
    public string RoleType { get; set; } = "participant"; // host|groupLeader|participant
    public Guid? PersonRoleId { get; set; }
    [MaxLength(120)]
    public string DisplayName { get; set; } = string.Empty;
    public byte[]? DisplayNameHash { get; set; }
    public string? DisplayNameCipher { get; set; }
    public byte[] ParticipantTokenHash { get; set; } = Array.Empty<byte>();
    public byte[]? DeviceHash { get; set; }
    [Column(TypeName = "decimal(7,2)")]
    public decimal SpoofRiskScore { get; set; }
    public string? LastLocationMetaJson { get; set; }
    public bool IsConnected { get; set; } = true;
    public DateTimeOffset JoinedUtc { get; set; }
    public DateTimeOffset LastSeenUtc { get; set; }
}

public sealed class CogitaGameZone
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    [MaxLength(96)]
    public string ZoneKey { get; set; } = string.Empty;
    [MaxLength(24)]
    public string SourceType { get; set; } = "manual"; // storyboard|manual
    public string GeometryJson { get; set; } = "{}"; // {lat,lon}
    [Column(TypeName = "decimal(9,2)")]
    public decimal TriggerRadiusM { get; set; }
    public DateTimeOffset? ActiveFromUtc { get; set; }
    public DateTimeOffset? ActiveToUtc { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameTriggerState
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    [MaxLength(128)]
    public string TriggerKey { get; set; } = string.Empty;
    [MaxLength(24)]
    public string ScopeType { get; set; } = "session";
    public Guid? ScopeId { get; set; }
    [MaxLength(24)]
    public string Status { get; set; } = "idle";
    public int FiredCount { get; set; }
    public DateTimeOffset? CooldownUntilUtc { get; set; }
    public long LastEvaluatedSeq { get; set; }
    public DateTimeOffset? LastFiredUtc { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameValueLedger
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid ValueId { get; set; }
    [MaxLength(24)]
    public string ScopeType { get; set; } = "participant";
    public Guid? ScopeId { get; set; }
    [Column(TypeName = "decimal(18,4)")]
    public decimal Delta { get; set; }
    [Column(TypeName = "decimal(18,4)")]
    public decimal AbsoluteAfter { get; set; }
    public Guid ReasonEventId { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
}

public sealed class CogitaGameScoreboard
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? ParticipantId { get; set; }
    [Column(TypeName = "decimal(18,4)")]
    public decimal Score { get; set; }
    public int Rank { get; set; }
    public int Version { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameEventLog
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public long SeqNo { get; set; }
    [MaxLength(64)]
    public string EventType { get; set; } = string.Empty;
    public Guid CorrelationId { get; set; }
    public Guid? CausationId { get; set; }
    public Guid? ActorParticipantId { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset CreatedUtc { get; set; }
}

public sealed class CogitaGamePresenceState
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid ParticipantId { get; set; }
    public Guid ZoneId { get; set; }
    [MaxLength(24)]
    public string PresenceState { get; set; } = "outside"; // candidate|inside|outside
    public DateTimeOffset? EnteredUtc { get; set; }
    public DateTimeOffset? ExitedUtc { get; set; }
    public DateTimeOffset LastPingUtc { get; set; }
    [Column(TypeName = "decimal(7,4)")]
    public decimal Confidence { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CogitaGameLocationAudit
{
    [Key]
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid ParticipantId { get; set; }
    [MaxLength(12)]
    public string GeoHash6 { get; set; } = string.Empty;
    [MaxLength(24)]
    public string AccuracyBucket { get; set; } = string.Empty;
    [MaxLength(24)]
    public string SpeedBucket { get; set; } = string.Empty;
    public DateTimeOffset CreatedUtc { get; set; }
}
