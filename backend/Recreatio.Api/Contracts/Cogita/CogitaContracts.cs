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

public sealed record CogitaInfoPayloadFieldSpecResponse(
    string Key,
    string Label,
    string InputType,
    bool Required,
    bool Searchable,
    bool KeepOnCreate
);

public sealed record CogitaInfoLinkFieldSpecResponse(
    string Key,
    string Label,
    List<string> TargetTypes,
    bool Required,
    bool Multiple,
    bool KeepOnCreate
);

public sealed record CogitaInfoTypeSpecResponse(
    string InfoType,
    string EntityKind,
    List<CogitaInfoPayloadFieldSpecResponse> PayloadFields,
    List<CogitaInfoLinkFieldSpecResponse> LinkFields
);

public sealed record CogitaInfoApproachSpecResponse(
    string ApproachKey,
    string Label,
    string Category,
    List<string> SourceInfoTypes
);

public sealed record CogitaEntitySearchResponse(
    Guid EntityId,
    string EntityKind,
    string EntityType,
    string Title,
    string Summary,
    Guid? InfoId,
    Guid? ConnectionId
);

public sealed record CogitaCardSearchResponse(
    Guid CardId,
    string CardType,
    string Label,
    string Description,
    string? InfoType,
    string? CheckType = null,
    string? Direction = null
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
    string? SignatureBase64,
    JsonElement? Links = null
);

public sealed record CogitaCreateInfoResponse(
    Guid InfoId,
    string InfoType
);

public sealed record CogitaInfoDetailResponse(
    Guid InfoId,
    string InfoType,
    JsonElement Payload,
    JsonElement? Links = null
);

public sealed record CogitaInfoApproachProjectionResponse(
    string ApproachKey,
    Guid SourceInfoId,
    string SourceInfoType,
    JsonElement Projection
);

public sealed record CogitaUpdateInfoRequest(
    JsonElement Payload,
    Guid? DataKeyId,
    string? SignatureBase64,
    JsonElement? Links = null
);

public sealed record CogitaUpdateInfoResponse(
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

public sealed record CogitaCollectionItemRequest(
    string ItemType,
    Guid ItemId
);

public sealed record CogitaCreateCollectionRequest(
    string Name,
    string? Notes,
    List<CogitaCollectionItemRequest> Items,
    Guid? DataKeyId,
    string? SignatureBase64,
    CogitaCollectionGraphRequest? Graph = null
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

public sealed record CogitaRevisionCreateRequest(
    string Name,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit
);

public sealed record CogitaRevisionUpdateRequest(
    string Name,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit
);

public sealed record CogitaRevisionResponse(
    Guid RevisionId,
    Guid CollectionId,
    string Name,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CogitaCollectionDependencyRequest(
    Guid ParentCollectionId,
    Guid ChildCollectionId
);

public sealed record CogitaCollectionDependencyResponse(
    Guid ParentCollectionId,
    Guid ChildCollectionId
);

public sealed record CogitaCollectionDependencyBundleResponse(
    List<CogitaCollectionDependencyResponse> Parents,
    List<CogitaCollectionDependencyResponse> Children
);

public sealed record CogitaItemDependencyRequest(
    string ParentItemType,
    Guid ParentItemId,
    string? ParentCheckType,
    string? ParentDirection,
    string ChildItemType,
    Guid ChildItemId,
    string? ChildCheckType,
    string? ChildDirection
);

public sealed record CogitaItemDependencyResponse(
    string ParentItemType,
    Guid ParentItemId,
    string? ParentCheckType,
    string? ParentDirection,
    string ChildItemType,
    Guid ChildItemId,
    string? ChildCheckType,
    string? ChildDirection
);

public sealed record CogitaItemDependencyBundleResponse(
    List<CogitaItemDependencyResponse> Items
);

public sealed record CogitaReviewEventRequest(
    string ItemType,
    Guid ItemId,
    string? Direction,
    string PayloadBase64,
    Guid? PersonRoleId
);

public sealed record CogitaReviewEventResponse(
    Guid ReviewId,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaReviewOutcomeRequest(
    string ItemType,
    Guid ItemId,
    string? CheckType,
    string? Direction,
    string RevisionType,
    string EvalType,
    bool Correct,
    string ClientId,
    long ClientSequence,
    string? MaskBase64,
    string? PayloadHashBase64,
    string? PayloadBase64,
    Guid? PersonRoleId
);

public sealed record CogitaReviewOutcomeBulkRequest(
    List<CogitaReviewOutcomeRequest> Outcomes
);

public sealed record CogitaReviewOutcomeResponse(
    Guid OutcomeId,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaReviewSummaryResponse(
    string ItemType,
    Guid ItemId,
    int TotalReviews,
    int CorrectReviews,
    DateTimeOffset? LastReviewedUtc,
    double Score
);

public sealed record CogitaReviewerResponse(
    Guid RoleId,
    string Label,
    string? RoleKind
);

public sealed record CogitaRevisionShareCreateRequest(
    Guid CollectionId,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit,
    string? SignatureBase64
);

public sealed record CogitaRevisionShareCreateResponse(
    Guid ShareId,
    Guid CollectionId,
    string ShareCode,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaRevisionShareResponse(
    Guid ShareId,
    Guid CollectionId,
    string CollectionName,
    string ShareCode,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? RevokedUtc
);

public sealed record CogitaPublicRevisionShareResponse(
    Guid ShareId,
    Guid LibraryId,
    Guid CollectionId,
    string CollectionName,
    string LibraryName,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit
);

public sealed record CogitaComputedSampleResponse(
    string Prompt,
    string ExpectedAnswer,
    Dictionary<string, string> ExpectedAnswers,
    Dictionary<string, double> Values
);

public sealed record CogitaCollectionGraphNodeRequest(
    Guid? NodeId,
    string NodeType,
    JsonElement Payload
);

public sealed record CogitaCollectionGraphEdgeRequest(
    Guid? EdgeId,
    Guid FromNodeId,
    string? FromPort,
    Guid ToNodeId,
    string? ToPort
);

public sealed record CogitaCollectionGraphRequest(
    List<CogitaCollectionGraphNodeRequest> Nodes,
    List<CogitaCollectionGraphEdgeRequest> Edges,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CogitaCollectionGraphNodeResponse(
    Guid NodeId,
    string NodeType,
    JsonElement Payload
);

public sealed record CogitaCollectionGraphEdgeResponse(
    Guid EdgeId,
    Guid FromNodeId,
    string? FromPort,
    Guid ToNodeId,
    string? ToPort
);

public sealed record CogitaCollectionGraphResponse(
    Guid GraphId,
    List<CogitaCollectionGraphNodeResponse> Nodes,
    List<CogitaCollectionGraphEdgeResponse> Edges
);

public sealed record CogitaCollectionGraphPreviewResponse(
    int Total,
    int Connections,
    int Infos
);

public sealed record CogitaDependencyGraphNodeRequest(
    Guid? NodeId,
    string NodeType,
    JsonElement Payload
);

public sealed record CogitaDependencyGraphEdgeRequest(
    Guid? EdgeId,
    Guid FromNodeId,
    Guid ToNodeId
);

public sealed record CogitaDependencyGraphRequest(
    List<CogitaDependencyGraphNodeRequest> Nodes,
    List<CogitaDependencyGraphEdgeRequest> Edges,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CogitaDependencyGraphNodeResponse(
    Guid NodeId,
    string NodeType,
    JsonElement Payload
);

public sealed record CogitaDependencyGraphEdgeResponse(
    Guid EdgeId,
    Guid FromNodeId,
    Guid ToNodeId
);

public sealed record CogitaDependencyGraphResponse(
    Guid GraphId,
    List<CogitaDependencyGraphNodeResponse> Nodes,
    List<CogitaDependencyGraphEdgeResponse> Edges
);

public sealed record CogitaDependencyGraphPreviewResponse(
    int TotalCollections,
    List<Guid> CollectionIds
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
