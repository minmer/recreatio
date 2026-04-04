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
    Guid? TargetUserId);

public sealed record CalendarEventCreateRequest(
    Guid CalendarId,
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
    IReadOnlyList<CalendarReminderRequest>? Reminders,
    bool AllowConflicts);

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
    string? SourceFieldStart,
    string? SourceFieldEnd,
    string? ConflictScopeMode,
    IReadOnlyList<Guid>? ScopedRoleIds,
    bool ReplaceRoleScopes,
    IReadOnlyList<CalendarReminderRequest>? Reminders,
    bool ReplaceReminders,
    bool? IsArchived,
    bool AllowConflicts);

public sealed record CalendarReminderResponse(
    Guid ReminderId,
    int MinutesBefore,
    string Channel,
    Guid? TargetRoleId,
    Guid? TargetUserId,
    string Status,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

public sealed record CalendarEventRoleScopeResponse(
    Guid ScopeId,
    Guid RoleId,
    string ScopeType,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? RevokedUtc);

public sealed record CalendarEventResponse(
    Guid EventId,
    Guid CalendarId,
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
    IReadOnlyList<CalendarReminderResponse> Reminders);

public sealed record CalendarEventOccurrenceResponse(
    Guid EventId,
    DateTimeOffset OccurrenceStartUtc,
    DateTimeOffset OccurrenceEndUtc,
    bool IsRecurringInstance,
    CalendarEventResponse Event);

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

public sealed record CalendarEventShareLinkResponse(
    Guid LinkId,
    string Code,
    string Label,
    string Mode,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? ExpiresUtc,
    bool IsActive);

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
    DateTimeOffset UpdatedUtc);
