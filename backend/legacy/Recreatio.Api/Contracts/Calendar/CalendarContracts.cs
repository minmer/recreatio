namespace Recreatio.Api.Contracts.Calendar;

public sealed record CalendarRoleBindingRequest(
    Guid RoleId,
    string AccessType);

public sealed record CalendarCreateRequest(
    string Name,
    string? Description,
    string? Slug,
    string? OrganizationScope,
    Guid OwnerRoleId,
    string? DefaultTimeZoneId,
    IReadOnlyList<CalendarRoleBindingRequest>? RoleBindings);

public sealed record CalendarUpdateRequest(
    string? Name,
    string? Description,
    string? DefaultTimeZoneId,
    bool? IsArchived);

public sealed record CalendarRoleBindingResponse(
    Guid BindingId,
    Guid RoleId,
    string AccessType,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? RevokedUtc);

public sealed record CalendarResponse(
    Guid CalendarId,
    string? Slug,
    string Name,
    string? Description,
    string? OrganizationScope,
    Guid OwnerRoleId,
    string? DefaultTimeZoneId,
    bool IsArchived,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    bool CanRead,
    bool CanWrite,
    bool CanManage,
    IReadOnlyList<CalendarRoleBindingResponse> RoleBindings);

public sealed record CalendarReminderRequest(
    int MinutesBefore,
    string Channel,
    Guid? TargetRoleId,
    Guid? TargetUserId,
    string? ChannelConfigJson = null);

public sealed record CalendarViewerScopeRequest(
    Guid RoleId,
    bool CanSeeTitle = true,
    bool CanSeeGraph = false);

public sealed record CalendarEventCreateRequest(
    Guid CalendarId,
    Guid? EventGroupId,
    Guid OwnerRoleId,
    string TitlePublic,
    string? SummaryPublic,
    string? LocationPublic,
    string Visibility,
    string Status,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    bool AllDay,
    string? TimeZoneId,
    string? RecurrenceType,
    int? RecurrenceInterval,
    string? RecurrenceByWeekday,
    DateTimeOffset? RecurrenceUntilUtc,
    int? RecurrenceCount,
    string? RecurrenceRule,
    string? ProtectedDetailsJson,
    string? LinkedModule,
    string? LinkedEntityType,
    Guid? LinkedEntityId,
    string? SourceFieldStart,
    string? SourceFieldEnd,
    string? ConflictScopeMode,
    IReadOnlyList<Guid>? ScopedRoleIds,
    IReadOnlyList<CalendarViewerScopeRequest>? ViewerScopes,
    IReadOnlyList<CalendarReminderRequest>? Reminders,
    bool AllowConflicts,
    string ItemType = "appointment",
    string? TaskState = null,
    int? TaskProgressPercent = null,
    bool RequiresCompletionProof = false,
    string? CompletionProofJson = null,
    Guid? AssigneeRoleId = null,
    CalendarGraphUpsertRequest? Graph = null);

public sealed record CalendarEventUpdateRequest(
    string? TitlePublic,
    string? SummaryPublic,
    string? LocationPublic,
    string? Visibility,
    string? Status,
    DateTimeOffset? StartUtc,
    DateTimeOffset? EndUtc,
    bool? AllDay,
    string? TimeZoneId,
    string? RecurrenceType,
    int? RecurrenceInterval,
    string? RecurrenceByWeekday,
    DateTimeOffset? RecurrenceUntilUtc,
    int? RecurrenceCount,
    string? RecurrenceRule,
    bool ReplaceProtectedDetails,
    string? ProtectedDetailsJson,
    string? LinkedModule,
    string? LinkedEntityType,
    Guid? LinkedEntityId,
    Guid? EventGroupId,
    string? SourceFieldStart,
    string? SourceFieldEnd,
    string? ConflictScopeMode,
    IReadOnlyList<Guid>? ScopedRoleIds,
    bool ReplaceRoleScopes,
    IReadOnlyList<CalendarViewerScopeRequest>? ViewerScopes,
    bool ReplaceViewerScopes,
    IReadOnlyList<CalendarReminderRequest>? Reminders,
    bool ReplaceReminders,
    bool? IsArchived,
    bool AllowConflicts,
    string? ItemType = null,
    string? TaskState = null,
    int? TaskProgressPercent = null,
    bool? RequiresCompletionProof = null,
    string? CompletionProofJson = null,
    Guid? AssigneeRoleId = null,
    bool UpsertGraph = false,
    CalendarGraphUpsertRequest? Graph = null);

public sealed record CalendarReminderResponse(
    Guid ReminderId,
    int MinutesBefore,
    string Channel,
    Guid? TargetRoleId,
    Guid? TargetUserId,
    string Status,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    string? ChannelConfigJson = null);

public sealed record CalendarEventRoleScopeResponse(
    Guid ScopeId,
    Guid RoleId,
    string ScopeType,
    bool CanSeeTitle,
    bool CanSeeGraph,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? RevokedUtc);

public sealed record CalendarEventResponse(
    Guid EventId,
    Guid CalendarId,
    Guid? EventGroupId,
    string? EventGroupName,
    Guid OwnerRoleId,
    string TitlePublic,
    string? SummaryPublic,
    string? LocationPublic,
    string Visibility,
    string Status,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    bool AllDay,
    string? TimeZoneId,
    string RecurrenceType,
    int RecurrenceInterval,
    string? RecurrenceByWeekday,
    DateTimeOffset? RecurrenceUntilUtc,
    int? RecurrenceCount,
    string? RecurrenceRule,
    string? LinkedModule,
    string? LinkedEntityType,
    Guid? LinkedEntityId,
    string? SourceFieldStart,
    string? SourceFieldEnd,
    string ConflictScopeMode,
    bool IsArchived,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    bool HasProtectedDetails,
    bool CanReadProtectedDetails,
    string? ProtectedDetailsJson,
    IReadOnlyList<CalendarEventRoleScopeResponse> RoleScopes,
    IReadOnlyList<CalendarReminderResponse> Reminders,
    string ItemType = "appointment",
    string? TaskState = null,
    DateTimeOffset? CompletedUtc = null,
    int? TaskProgressPercent = null,
    bool RequiresCompletionProof = false,
    Guid? CompletionProofDataItemId = null,
    Guid? AssigneeRoleId = null,
    CalendarGraphSummaryResponse? Graph = null);

public sealed record CalendarGraphSummaryResponse(
    Guid GraphId,
    string TemplateKey,
    string Status,
    int Version,
    DateTimeOffset UpdatedUtc);

public sealed record CalendarEventOccurrenceResponse(
    Guid EventId,
    DateTimeOffset OccurrenceStartUtc,
    DateTimeOffset OccurrenceEndUtc,
    bool IsRecurringInstance,
    CalendarEventResponse Event,
    Guid? GraphExecutionId = null,
    string? OccurrenceSource = null);

public sealed record CalendarConflictResponse(
    Guid EventId,
    string TitlePublic,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    string ConflictReason);

public sealed record CalendarEventsQueryResponse(
    string View,
    DateTimeOffset FromUtc,
    DateTimeOffset ToUtc,
    IReadOnlyList<CalendarEventOccurrenceResponse> Occurrences,
    IReadOnlyList<CalendarConflictResponse> Conflicts);

public sealed record CalendarConflictCheckRequest(
    Guid CalendarId,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    IReadOnlyList<Guid> ScopeRoleIds,
    Guid? IgnoreEventId);

public sealed record CalendarEventShareLinkCreateRequest(
    string? Label,
    int? ExpiresInHours);

public sealed record CalendarSharedViewCreateRequest(
    string? Label,
    int? ExpiresInHours,
    string Mode = "readonly");

public sealed record CalendarEventShareLinkResponse(
    Guid LinkId,
    string Code,
    string Label,
    string Mode,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? ExpiresUtc,
    bool IsActive,
    Guid? SharedViewId = null,
    string? QrPayload = null);

public sealed record CalendarPublicEventResponse(
    Guid EventId,
    Guid CalendarId,
    string TitlePublic,
    string? SummaryPublic,
    string? LocationPublic,
    string Visibility,
    string Status,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    bool AllDay,
    string? TimeZoneId,
    string RecurrenceType,
    int RecurrenceInterval,
    string? RecurrenceByWeekday,
    DateTimeOffset? RecurrenceUntilUtc,
    int? RecurrenceCount,
    string? RecurrenceRule,
    string? LinkedModule,
    string? LinkedEntityType,
    Guid? LinkedEntityId,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    string ItemType = "appointment",
    string? TaskState = null,
    DateTimeOffset? CompletedUtc = null,
    int? TaskProgressPercent = null);

public sealed record CalendarGraphNodeRequest(
    Guid? NodeId,
    string NodeType,
    string NodeKey,
    string? ConfigJson,
    decimal PositionX,
    decimal PositionY);

public sealed record CalendarGraphEdgeRequest(
    Guid? EdgeId,
    Guid FromNodeId,
    string? FromPort,
    Guid ToNodeId,
    string? ToPort,
    string? EdgeType,
    string? ConditionJson);

public sealed record CalendarGraphUpsertRequest(
    string TemplateKey,
    string? TemplateConfigJson,
    string Status,
    IReadOnlyList<CalendarGraphNodeRequest> Nodes,
    IReadOnlyList<CalendarGraphEdgeRequest> Edges);

public sealed record CalendarGraphNodeResponse(
    Guid NodeId,
    string NodeType,
    string NodeKey,
    string ConfigJson,
    decimal PositionX,
    decimal PositionY);

public sealed record CalendarGraphEdgeResponse(
    Guid EdgeId,
    Guid FromNodeId,
    string? FromPort,
    Guid ToNodeId,
    string? ToPort,
    string? EdgeType,
    string? ConditionJson);

public sealed record CalendarGraphResponse(
    Guid GraphId,
    Guid EventId,
    string TemplateKey,
    string TemplateConfigJson,
    string Status,
    int Version,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    IReadOnlyList<CalendarGraphNodeResponse> Nodes,
    IReadOnlyList<CalendarGraphEdgeResponse> Edges);

public sealed record CalendarGraphTemplateResponse(
    string TemplateKey,
    string Name,
    string Description,
    string Category,
    string DefaultConfigJson,
    IReadOnlyList<CalendarGraphNodeResponse> Nodes,
    IReadOnlyList<CalendarGraphEdgeResponse> Edges);

public sealed record CalendarGraphExecutionTriggerRequest(
    string TriggerType,
    string? CompletionAction,
    string? IdempotencyKey,
    string? TriggerPayloadJson);

public sealed record CalendarGraphExecutionResponse(
    Guid ExecutionId,
    Guid GraphId,
    Guid EventId,
    string IdempotencyKey,
    string TriggerType,
    string Status,
    string? TriggerPayloadJson,
    string? ResultPayloadJson,
    DateTimeOffset CreatedUtc,
    DateTimeOffset StartedUtc,
    DateTimeOffset? FinishedUtc);

public sealed record CalendarTaskCompleteRequest(
    string? CompletionProofJson,
    string? TaskState,
    string? TriggerPayloadJson,
    string? IdempotencyKey);

public sealed record CalendarTaskCompletionResponse(
    Guid EventId,
    string TaskState,
    DateTimeOffset? CompletedUtc,
    CalendarGraphExecutionResponse? GraphExecution);

public sealed record CalendarGraphLinkRequest(
    Guid GraphId);

public sealed record CalendarGraphLinkResponse(
    Guid LinkId,
    Guid EventId,
    Guid GraphId,
    bool IsPrimary,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? RevokedUtc);

public sealed record CalendarEventGroupCreateRequest(
    string Name,
    string? Description,
    string? Category,
    Guid OwnerRoleId);

public sealed record CalendarEventGroupUpdateRequest(
    string? Name,
    string? Description,
    string? Category,
    bool? IsArchived);

public sealed record CalendarEventGroupResponse(
    Guid EventGroupId,
    Guid CalendarId,
    Guid OwnerRoleId,
    string Name,
    string? Description,
    string? Category,
    bool IsArchived,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    int ItemCount);

public sealed record CalendarEventGroupShareCreateRequest(
    string? Label,
    int? ExpiresInHours,
    string Mode = "readonly");

public sealed record CalendarEventGroupShareResponse(
    Guid LinkId,
    string Code,
    string Label,
    string Mode,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? ExpiresUtc,
    bool IsActive,
    Guid SharedViewId);

public sealed record CalendarWeeklySeriesCreateRequest(
    Guid OwnerRoleId,
    string TitlePublic,
    string? SummaryPublic,
    string? LocationPublic,
    string Visibility,
    DateTimeOffset FirstStartUtc,
    DateTimeOffset FirstEndUtc,
    DateTimeOffset UntilUtc,
    int IntervalWeeks,
    IReadOnlyList<Guid>? ScopedRoleIds,
    IReadOnlyList<CalendarViewerScopeRequest>? ViewerScopes,
    Guid? GraphId,
    bool AllowConflicts);

public sealed record CalendarPublicGroupResponse(
    Guid EventGroupId,
    Guid CalendarId,
    string Name,
    string? Description,
    string? Category,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc,
    IReadOnlyList<CalendarPublicEventResponse> Items);

public sealed record CalendarReminderDispatchResponse(
    Guid DispatchId,
    Guid ReminderId,
    Guid EventId,
    DateTimeOffset OccurrenceStartUtc,
    string Channel,
    string Status,
    int AttemptCount,
    DateTimeOffset? NextRetryUtc,
    DateTimeOffset? LastAttemptUtc,
    DateTimeOffset? DeliveredUtc,
    string? LastError,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);
