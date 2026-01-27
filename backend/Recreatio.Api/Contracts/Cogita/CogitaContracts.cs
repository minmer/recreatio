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
    int TotalCollections,
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

public sealed record CogitaCardSearchResponse(
    Guid CardId,
    string CardType,
    string Label,
    string Description,
    string? InfoType
);

public sealed record CogitaCardSearchBundleResponse(
    int Total,
    int PageSize,
    string? NextCursor,
    List<CogitaCardSearchResponse> Items
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

public sealed record CogitaCollectionItemRequest(
    string ItemType,
    Guid ItemId
);

public sealed record CogitaCreateCollectionRequest(
    string Name,
    string? Notes,
    List<CogitaCollectionItemRequest> Items,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CogitaCreateCollectionResponse(
    Guid CollectionId
);

public sealed record CogitaCollectionSummaryResponse(
    Guid CollectionId,
    string Name,
    string? Notes,
    int ItemCount,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaCollectionBundleResponse(
    int Total,
    int PageSize,
    string? NextCursor,
    List<CogitaCollectionSummaryResponse> Items
);

public sealed record CogitaCollectionDetailResponse(
    Guid CollectionId,
    string Name,
    string? Notes,
    int ItemCount,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaMockDataResponse(
    int Languages,
    int Words,
    int WordLanguageLinks,
    int Translations
);

public sealed record CogitaExportInfo(
    Guid InfoId,
    string InfoType,
    JsonElement Payload
);

public sealed record CogitaExportConnection(
    Guid ConnectionId,
    string ConnectionType,
    List<Guid> InfoIds,
    JsonElement? Payload
);

public sealed record CogitaExportCollectionItem(
    string ItemType,
    Guid ItemId,
    int SortOrder
);

public sealed record CogitaExportCollection(
    Guid CollectionInfoId,
    List<CogitaExportCollectionItem> Items
);

public sealed record CogitaLibraryExportResponse(
    int Version,
    List<CogitaExportInfo> Infos,
    List<CogitaExportConnection> Connections,
    List<CogitaExportCollection> Collections
);

public sealed record CogitaLibraryImportRequest(
    int Version,
    List<CogitaExportInfo> Infos,
    List<CogitaExportConnection> Connections,
    List<CogitaExportCollection> Collections
);

public sealed record CogitaLibraryImportResponse(
    int InfosImported,
    int ConnectionsImported,
    int CollectionsImported
);
