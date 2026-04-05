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

public sealed record CogitaDashboardPreferencesRequest(
    string? LayoutVersion,
    string PreferencesJson
);

public sealed record CogitaDashboardPreferencesResponse(
    string LayoutVersion,
    string PreferencesJson,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CogitaCreationProjectCreateRequest(
    string ProjectType,
    string Name,
    JsonElement? Content = null
);

public sealed record CogitaCreationProjectUpdateRequest(
    string Name,
    JsonElement? Content = null
);

public sealed record CogitaCreationProjectResponse(
    Guid ProjectId,
    string ProjectType,
    string Name,
    JsonElement? Content,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CogitaStoryboardImportRequest(
    Guid? ProjectId,
    string? Name,
    JsonElement Json,
    Guid? TopicNotionId = null,
    bool DeleteOldStoryboardNotions = false
);

public sealed record CogitaStoryboardImportNotionResultResponse(
    string Reference,
    Guid NotionId,
    bool Created,
    string InfoType
);

public sealed record CogitaStoryboardImportResponse(
    CogitaCreationProjectResponse Project,
    int CreatedNotions,
    int ReusedNotions,
    List<CogitaStoryboardImportNotionResultResponse> Notions,
    List<string> Warnings
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
    string? Direction = null,
    JsonElement? Payload = null
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

public sealed record CogitaCollectionUpdateRequest(
    string Name,
    string? Notes
);

public sealed record CogitaRevisionCreateRequest(
    Guid? CollectionId,
    string Name,
    string? RevisionType,
    JsonElement? RevisionSettings,
    string Mode,
    string Check,
    int Limit
);

public sealed record CogitaRevisionUpdateRequest(
    Guid? CollectionId,
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
    int? DurationMs,
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

public sealed record CogitaStatisticsParticipantSummaryResponse(
    string ParticipantKey,
    string ParticipantKind,
    Guid? PersonRoleId,
    Guid? ParticipantId,
    string Label,
    int EventCount,
    int AnswerCount,
    int CorrectCount,
    double AverageCorrectness,
    int TotalPoints,
    DateTimeOffset? LastActivityUtc,
    double KnownessScore,
    double? AverageDurationMs,
    double AveragePointsPerCorrectAnswer,
    double AverageBasePointsPerCorrectAnswer,
    double AverageFirstBonusPointsPerCorrectAnswer,
    double AverageSpeedBonusPointsPerCorrectAnswer,
    double AverageStreakBonusPointsPerCorrectAnswer
);

public sealed record CogitaStatisticsTimelinePointResponse(
    int Index,
    DateTimeOffset RecordedUtc,
    string ParticipantKey,
    string ParticipantKind,
    Guid? PersonRoleId,
    Guid? ParticipantId,
    string Label,
    string EventType,
    int? RoundIndex,
    bool? IsCorrect,
    double? Correctness,
    int? PointsAwarded,
    int? DurationMs,
    int RunningPoints,
    double KnownessScore
);

public sealed record CogitaStatisticsKnownessItemResponse(
    Guid InfoId,
    string InfoType,
    string Label,
    int AnswerCount,
    int CorrectCount,
    double AverageCorrectness,
    double KnownessScore
);

public sealed record CogitaStatisticsResponse(
    string ScopeType,
    Guid? ScopeId,
    int TotalEvents,
    int TotalAnswers,
    int TotalCorrectAnswers,
    double AverageCorrectness,
    int TotalPoints,
    List<CogitaStatisticsParticipantSummaryResponse> Participants,
    List<CogitaStatisticsTimelinePointResponse> Timeline,
    List<CogitaStatisticsKnownessItemResponse> BestKnownWords,
    List<CogitaStatisticsKnownessItemResponse> WorstKnownWords
);

public sealed record CogitaReviewerResponse(
    Guid RoleId,
    string Label,
    string? RoleKind
);

public sealed record CogitaRevisionShareCreateRequest(
    Guid RevisionId,
    string? SignatureBase64
);

public sealed record CogitaStoryboardShareCreateRequest(
    Guid ProjectId,
    string? SignatureBase64
);

public sealed record CogitaStoryboardShareCreateResponse(
    Guid ShareId,
    Guid ProjectId,
    string ProjectName,
    string ShareCode,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaStoryboardShareResponse(
    Guid ShareId,
    Guid ProjectId,
    string ProjectName,
    string ShareCode,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? RevokedUtc
);

public sealed record CogitaPublicStoryboardShareResponse(
    Guid ShareId,
    Guid ProjectId,
    string ProjectName,
    Guid LibraryId,
    string LibraryName,
    JsonElement? Content,
    DateTimeOffset CreatedUtc
);

public sealed record CogitaRevisionShareCreateResponse(
    Guid ShareId,
    Guid RevisionId,
    string RevisionName,
    Guid CollectionId,
    string CollectionName,
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
    Guid RevisionId,
    string RevisionName,
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
    Guid RevisionId,
    string RevisionName,
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

public sealed record CogitaLiveRevisionSessionCreateRequest(
    Guid? RevisionId,
    Guid? CollectionId,
    string? Title,
    string? SessionMode,
    string? HostViewMode,
    string? ParticipantViewMode,
    JsonElement? SessionSettings
);

public sealed record CogitaLiveRevisionSessionUpdateRequest(
    string? Title,
    string? SessionMode,
    string? HostViewMode,
    string? ParticipantViewMode,
    JsonElement? SessionSettings
);

public sealed record CogitaLiveRevisionParticipantScoreResponse(
    Guid ParticipantId,
    string DisplayName,
    string? GroupName,
    int Score
);

public sealed record CogitaLiveRevisionParticipantResponse(
    Guid ParticipantId,
    string DisplayName,
    string? GroupName,
    int Score,
    bool IsConnected,
    DateTimeOffset JoinedUtc
);

public sealed record CogitaLiveRevisionAnswerResponse(
    Guid ParticipantId,
    int RoundIndex,
    string? CardKey,
    JsonElement? Answer,
    bool? IsCorrect,
    int PointsAwarded,
    DateTimeOffset SubmittedUtc
);

public sealed record CogitaLiveRevisionReloginRequestResponse(
    Guid RequestId,
    string DisplayName,
    string? GroupName,
    string Status,
    DateTimeOffset RequestedUtc,
    DateTimeOffset? ApprovedUtc
);

public sealed record CogitaLiveRevisionSessionListItemResponse(
    Guid SessionId,
    Guid LibraryId,
    Guid RevisionId,
    Guid CollectionId,
    string SessionMode,
    string? HostViewMode,
    string? ParticipantViewMode,
    string Status,
    int CurrentRoundIndex,
    DateTimeOffset UpdatedUtc,
    string? Title,
    int ParticipantCount
);

public sealed record CogitaLiveRevisionSessionResponse(
    Guid SessionId,
    string Code,
    string HostSecret,
    Guid LibraryId,
    Guid? RevisionId,
    Guid? CollectionId,
    string SessionMode,
    string? HostViewMode,
    string? ParticipantViewMode,
    JsonElement? SessionSettings,
    string Status,
    int CurrentRoundIndex,
    int RevealVersion,
    JsonElement? CurrentPrompt,
    JsonElement? CurrentReveal,
    List<CogitaLiveRevisionParticipantResponse> Participants,
    List<CogitaLiveRevisionParticipantScoreResponse> Scoreboard,
    List<CogitaLiveRevisionAnswerResponse> CurrentRoundAnswers,
    List<CogitaLiveRevisionReloginRequestResponse> PendingReloginRequests
);

public sealed record CogitaLiveRevisionJoinRequest(
    string Name,
    string? GroupName,
    bool UseExistingName = false
);

public sealed record CogitaLiveRevisionJoinResponse(
    Guid SessionId,
    Guid ParticipantId,
    string ParticipantToken,
    string Name,
    string? GroupName
);

public sealed record CogitaLiveRevisionLeaveRequest(
    string ParticipantToken,
    int? RoundIndex
);

public sealed record CogitaLiveRevisionReloginRequestCreateRequest(string Name, string? GroupName);

public sealed record CogitaLiveRevisionReloginRequestCreateResponse(
    Guid SessionId,
    Guid RequestId,
    string Status,
    string Name,
    string? GroupName
);

public sealed record CogitaLiveRevisionPublicStateResponse(
    Guid SessionId,
    string SessionMode,
    string? Title,
    string? ParticipantViewMode,
    JsonElement? SessionSettings,
    string Status,
    int CurrentRoundIndex,
    int RevealVersion,
    JsonElement? CurrentPrompt,
    JsonElement? CurrentReveal,
    List<CogitaLiveRevisionParticipantScoreResponse> Scoreboard,
    List<CogitaLiveRevisionScoreHistoryPointResponse> ScoreHistory,
    List<CogitaLiveRevisionCorrectnessHistoryPointResponse> CorrectnessHistory,
    bool AnswerSubmitted,
    Guid? ParticipantId,
    string? ParticipantName,
    string? ParticipantGroupName,
    string? ParticipantToken
);

public sealed record CogitaLiveRevisionReviewRoundResponse(
    int RoundIndex,
    string CardKey,
    JsonElement Prompt,
    JsonElement Reveal,
    JsonElement? ParticipantAnswer,
    bool? IsCorrect,
    int PointsAwarded
);

public sealed record CogitaLiveRevisionScoreHistoryPointResponse(
    int RoundIndex,
    DateTimeOffset RecordedUtc,
    List<CogitaLiveRevisionParticipantScoreResponse> Scoreboard
);

public sealed record CogitaLiveRevisionCorrectnessEntryResponse(
    Guid ParticipantId,
    string DisplayName,
    bool? IsCorrect,
    int PointsAwarded,
    DateTimeOffset SubmittedUtc,
    int? DurationMs,
    int BasePoints,
    int FirstBonusPoints,
    int SpeedBonusPoints,
    int StreakBonusPoints
);

public sealed record CogitaLiveRevisionCorrectnessHistoryPointResponse(
    int RoundIndex,
    DateTimeOffset RecordedUtc,
    List<CogitaLiveRevisionCorrectnessEntryResponse> Entries
);

public sealed record CogitaLiveRevisionParticipantSessionListItemResponse(
    Guid SessionId,
    Guid LibraryId,
    Guid RevisionId,
    Guid CollectionId,
    string SessionMode,
    string? HostViewMode,
    string? ParticipantViewMode,
    string Status,
    int CurrentRoundIndex,
    DateTimeOffset UpdatedUtc,
    string? Title,
    int ParticipantCount,
    int ParticipantScore,
    bool IsConnected,
    string ParticipantStatus
);

public sealed record CogitaLiveRevisionHostStateUpdateRequest(
    string Status,
    int CurrentRoundIndex,
    int RevealVersion,
    JsonElement? CurrentPrompt,
    JsonElement? CurrentReveal
);

public sealed record CogitaLiveRevisionAnswerSubmitRequest(
    string ParticipantToken,
    int RoundIndex,
    string? CardKey,
    JsonElement? Answer
);

public sealed record CogitaLiveRevisionTimerControlRequest(
    string ParticipantToken,
    string Action,
    int? RoundIndex,
    string? Source
);

public sealed record CogitaLiveRevisionHostParticipantCreateRequest(
    string Name,
    string? GroupName
);

public sealed record CogitaLiveRevisionRevealScoreRequest(
    List<CogitaLiveRevisionParticipantScoreDeltaRequest> Scores
);

public sealed record CogitaLiveRevisionParticipantScoreDeltaRequest(
    Guid ParticipantId,
    bool? IsCorrect,
    int PointsAwarded
);

public sealed record CogitaComputedSampleResponse(
    string Prompt,
    string ExpectedAnswer,
    Dictionary<string, string> ExpectedAnswers,
    Dictionary<string, double> Values
);

public sealed record CogitaPythonEvaluateRequest(
    string SubmissionSource
);

public sealed record CogitaPythonEvaluateResponse(
    bool Passed,
    string Status,
    int CasesExecuted,
    string? FailingInputJson,
    string? UserOutputJson,
    string? ErrorMessage
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

public sealed record CogitaDependencyGraphCreateRequest(
    string? Name,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CogitaDependencyGraphUpdateRequest(
    string? Name
);

public sealed record CogitaDependencyGraphSummaryResponse(
    Guid GraphId,
    string Name,
    bool IsActive,
    DateTimeOffset UpdatedUtc,
    int NodeCount
);

public sealed record CogitaDependencyGraphListResponse(
    List<CogitaDependencyGraphSummaryResponse> Items
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
