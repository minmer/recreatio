namespace Recreatio.Api.Contracts.Chat;

public sealed record ChatParticipantRequest(
    string SubjectType,
    Guid SubjectId,
    bool CanRead,
    bool CanWrite,
    bool CanManage,
    bool CanRespondPublic);

public sealed record ChatConversationCreateRequest(
    string ChatType,
    string ScopeType,
    string? ScopeId,
    string Title,
    string? Description,
    bool IsPublic,
    bool PublicReadEnabled,
    bool PublicQuestionEnabled,
    Guid? CreatedByRoleId,
    IReadOnlyList<ChatParticipantRequest> Participants);

public sealed record ChatConversationParticipantResponse(
    Guid ParticipantId,
    string SubjectType,
    Guid SubjectId,
    string? DisplayLabel,
    bool CanRead,
    bool CanWrite,
    bool CanManage,
    bool CanRespondPublic,
    DateTimeOffset JoinedUtc,
    DateTimeOffset? RemovedUtc);

public sealed record ChatConversationSummaryResponse(
    Guid ConversationId,
    string ChatType,
    string ScopeType,
    string? ScopeId,
    string Title,
    string? Description,
    bool IsPublic,
    bool PublicReadEnabled,
    bool PublicQuestionEnabled,
    long LastMessageSequence,
    long LastReadSequence,
    int UnreadCount,
    DateTimeOffset UpdatedUtc,
    bool CanRead,
    bool CanWrite,
    bool CanManage,
    bool CanRespondPublic,
    bool HasActivePublicLink);

public sealed record ChatConversationDetailResponse(
    ChatConversationSummaryResponse Summary,
    IReadOnlyList<ChatConversationParticipantResponse> Participants);

public sealed record ChatMessageResponse(
    Guid MessageId,
    Guid ConversationId,
    long Sequence,
    Guid? SenderUserId,
    Guid? SenderRoleId,
    string SenderDisplay,
    string MessageType,
    string Visibility,
    string Text,
    string? ClientMessageId,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? EditedUtc,
    DateTimeOffset? DeletedUtc);

public sealed record ChatMessagesResponse(
    Guid ConversationId,
    long LastSequence,
    IReadOnlyList<ChatMessageResponse> Messages);

public sealed record ChatSendMessageRequest(
    string Text,
    string? Visibility,
    string? MessageType,
    string? ClientMessageId,
    Guid? SenderRoleId);

public sealed record ChatMarkReadRequest(long LastReadSequence);

public sealed record ChatParticipantsAddRequest(
    bool IncludeHistory,
    IReadOnlyList<ChatParticipantRequest> Participants);

public sealed record ChatPublicLinkCreateRequest(
    string? Label,
    int? ExpiresInHours);

public sealed record ChatPublicLinkResponse(
    Guid LinkId,
    string Code,
    string Label,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? ExpiresUtc,
    bool IsActive);

public sealed record ChatPublicConversationResponse(
    Guid ConversationId,
    string Title,
    string ScopeType,
    string? ScopeId,
    ChatMessagesResponse Messages);

public sealed record ChatPublicQuestionRequest(
    string Text,
    string? DisplayName,
    string? ClientMessageId);
