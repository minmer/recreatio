using System.Text.Json;

namespace Recreatio.Api.Contracts.Cogita;

public sealed record CogitaGameCreateRequest(
    string Name,
    Guid? StoryboardProjectId,
    string? Mode,
    JsonElement? Settings
);

public sealed record CogitaGameUpdateRequest(
    string? Name,
    Guid? StoryboardProjectId,
    string? Mode,
    JsonElement? Settings,
    bool? IsArchived
);

public sealed record CogitaGameSummaryResponse(
    Guid GameId,
    Guid LibraryId,
    string Name,
    string Mode,
    Guid? StoryboardProjectId,
    bool IsArchived,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CogitaGameValueUpsertRequest(
    Guid? ValueId,
    string ValueKey,
    string Name,
    string ScopeType,
    string Visibility,
    string DataType,
    JsonElement? DefaultValue,
    JsonElement? Constraints,
    bool IsScore
);

public sealed record CogitaGameValueResponse(
    Guid ValueId,
    string ValueKey,
    string Name,
    string ScopeType,
    string Visibility,
    string DataType,
    JsonElement? DefaultValue,
    JsonElement? Constraints,
    bool IsScore,
    DateTimeOffset UpdatedUtc
);

public sealed record CogitaGameActionNodeRequest(
    Guid? NodeId,
    string NodeType,
    JsonElement Config,
    decimal PositionX,
    decimal PositionY
);

public sealed record CogitaGameActionEdgeRequest(
    Guid? EdgeId,
    Guid FromNodeId,
    string? FromPort,
    Guid ToNodeId,
    string? ToPort
);

public sealed record CogitaGameActionGraphUpsertRequest(
    List<CogitaGameActionNodeRequest> Nodes,
    List<CogitaGameActionEdgeRequest> Edges,
    bool Publish
);

public sealed record CogitaGameActionNodeResponse(
    Guid NodeId,
    string NodeType,
    JsonElement Config,
    decimal PositionX,
    decimal PositionY
);

public sealed record CogitaGameActionEdgeResponse(
    Guid EdgeId,
    Guid FromNodeId,
    string? FromPort,
    Guid ToNodeId,
    string? ToPort
);

public sealed record CogitaGameActionGraphResponse(
    Guid GraphId,
    int Version,
    string Status,
    List<CogitaGameActionNodeResponse> Nodes,
    List<CogitaGameActionEdgeResponse> Edges
);

public sealed record CogitaGameLayoutUpsertRequest(
    string RoleType,
    JsonElement Layout
);

public sealed record CogitaGameLayoutResponse(
    Guid LayoutId,
    string RoleType,
    JsonElement Layout,
    DateTimeOffset UpdatedUtc
);

public sealed record CogitaGameSessionCreateRequest(
    Guid GameId,
    string? Title,
    JsonElement? SessionSettings,
    List<CogitaGameSessionZoneRequest>? Zones,
    List<CogitaGameSessionGroupRequest>? Groups
);

public sealed record CogitaGameSessionZoneRequest(
    string ZoneKey,
    decimal Latitude,
    decimal Longitude,
    decimal TriggerRadiusM,
    string? SourceType
);

public sealed record CogitaGameSessionGroupRequest(
    string GroupKey,
    string DisplayName,
    int? Capacity
);

public sealed record CogitaGameSessionParticipantResponse(
    Guid ParticipantId,
    Guid? GroupId,
    string RoleType,
    string DisplayName,
    bool IsConnected,
    decimal SpoofRiskScore,
    DateTimeOffset LastSeenUtc
);

public sealed record CogitaGameSessionGroupResponse(
    Guid GroupId,
    string GroupKey,
    string DisplayName,
    int Capacity,
    bool IsActive
);

public sealed record CogitaGameZoneResponse(
    Guid ZoneId,
    string ZoneKey,
    decimal TriggerRadiusM,
    JsonElement Geometry,
    bool IsEnabled,
    DateTimeOffset? ActiveFromUtc,
    DateTimeOffset? ActiveToUtc
);

public sealed record CogitaGameScoreRowResponse(
    Guid? GroupId,
    Guid? ParticipantId,
    decimal Score,
    int Rank
);

public sealed record CogitaGameEventResponse(
    Guid EventId,
    long SeqNo,
    string EventType,
    Guid CorrelationId,
    Guid? ActorParticipantId,
    JsonElement Payload,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaGameSessionStateResponse(
    Guid SessionId,
    Guid LibraryId,
    Guid GameId,
    string Status,
    string Phase,
    int RoundIndex,
    int Version,
    List<CogitaGameSessionGroupResponse> Groups,
    List<CogitaGameZoneResponse> Zones,
    List<CogitaGameSessionParticipantResponse> Participants,
    List<CogitaGameScoreRowResponse> Scoreboard,
    List<CogitaGameEventResponse> Events,
    string? HostRealtimeToken,
    string? ParticipantRealtimeToken,
    long LastSeqNo
);

public sealed record CogitaGameSessionHostCreateResponse(
    Guid SessionId,
    string Code,
    string HostSecret,
    CogitaGameSessionStateResponse State
);

public sealed record CogitaGameSessionSummaryResponse(
    Guid SessionId,
    Guid GameId,
    string Status,
    string Phase,
    int RoundIndex,
    int Version,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CogitaGameSessionJoinRequest(
    string Name,
    string? GroupKey,
    string? DeviceId
);

public sealed record CogitaGameSessionJoinResponse(
    Guid SessionId,
    Guid ParticipantId,
    string ParticipantToken,
    CogitaGameSessionStateResponse State
);

public sealed record CogitaGameHostPhaseUpdateRequest(
    string Phase,
    int RoundIndex,
    string? Status,
    JsonElement? Meta
);

public sealed record CogitaGameHostCommandRequest(
    string Command,
    JsonElement? Payload
);

public sealed record CogitaGameAnswerSubmitRequest(
    string ParticipantToken,
    string InteractionKey,
    JsonElement? Answer
);

public sealed record CogitaGameInteractionCompleteRequest(
    string ParticipantToken,
    string InteractionKey,
    JsonElement? Payload
);

public sealed record CogitaGameLeaveRequest(
    string ParticipantToken
);

public sealed record CogitaGameLocationPingSample(
    decimal Latitude,
    decimal Longitude,
    decimal AccuracyM,
    decimal? SpeedMps,
    decimal? HeadingDeg,
    DateTimeOffset DeviceTimeUtc
);

public sealed record CogitaGameLocationPingRequest(
    string ParticipantToken,
    List<CogitaGameLocationPingSample> Samples,
    string? BatchId
);

public sealed record CogitaGameStateQueryResponse(
    CogitaGameSessionStateResponse State,
    string ETag
);

public sealed record CogitaGameRealtimeTokenClaims(
    Guid SessionId,
    Guid? ParticipantId,
    bool IsHost,
    DateTimeOffset ExpiresUtc
);
