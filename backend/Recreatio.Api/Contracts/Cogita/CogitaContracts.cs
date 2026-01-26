using System.Text.Json;

namespace Recreatio.Api.Contracts.Cogita;

public sealed record CogitaLibraryCreateRequest(
    string Name,
    string? SignatureBase64
);

public sealed record CogitaLibraryResponse(
    Guid LibraryId,
    Guid RoleId,
    string Name,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaLibraryStatsResponse(
    int TotalInfos,
    int TotalConnections,
    int TotalGroups,
    int TotalLanguages,
    int TotalWords,
    int TotalSentences,
    int TotalTopics
);

public sealed record CogitaInfoSearchResponse(
    Guid InfoId,
    string InfoType,
    string Label
);

public sealed record CogitaCreateInfoRequest(
    string InfoType,
    JsonElement Payload,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CogitaCreateInfoResponse(
    Guid InfoId,
    string InfoType
);

public sealed record CogitaCreateConnectionRequest(
    string ConnectionType,
    List<Guid> InfoIds,
    JsonElement? Payload,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CogitaCreateConnectionResponse(
    Guid ConnectionId,
    string ConnectionType
);

public sealed record CogitaGroupInfoRequest(
    Guid? InfoId,
    string InfoType,
    JsonElement Payload
);

public sealed record CogitaGroupConnectionRequest(
    Guid? ConnectionId,
    string ConnectionType,
    List<Guid> InfoIds,
    JsonElement? Payload
);

public sealed record CogitaCreateGroupRequest(
    string GroupType,
    List<CogitaGroupInfoRequest> InfoItems,
    List<CogitaGroupConnectionRequest> Connections,
    JsonElement? Payload,
    string? SignatureBase64
);

public sealed record CogitaCreateGroupResponse(
    string GroupType,
    List<Guid> InfoIds,
    List<Guid> ConnectionIds
);
