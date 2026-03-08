using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Chat;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Chat;
using Recreatio.Api.Security;
using Recreatio.Api.Services;
using Recreatio.Api.Services.Chat;

namespace Recreatio.Api.Endpoints;

public static class ChatEndpoints
{
    private static readonly HashSet<string> AllowedChatTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "group",
        "direct",
        "public-board"
    };

    private static readonly HashSet<string> AllowedScopeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "global",
        "parish",
        "event",
        "limanowa",
        "cogita"
    };

    private static readonly HashSet<string> AllowedVisibility = new(StringComparer.OrdinalIgnoreCase)
    {
        "internal",
        "public"
    };

    private static readonly HashSet<string> AllowedMessageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text",
        "question",
        "answer",
        "system"
    };

    private static readonly HashSet<string> AllowedSubjectTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "role",
        "user"
    };

    private const int MaxTitleLength = 200;
    private const int MaxDescriptionLength = 2000;
    private const int MaxScopeIdLength = 128;
    private const int MaxPublicLinkLabelLength = 120;
    private const int MaxSenderDisplayLength = 120;
    private const int MaxClientMessageIdLength = 64;
    private const int MaxMessageLength = 4000;
    private const int DefaultMessagePageSize = 80;
    private const int MaxMessagePageSize = 200;

    public static void MapChatEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/chat");
        var auth = group.MapGroup(string.Empty).RequireAuthorization();

        auth.MapGet("/conversations", async (
            string? scopeType,
            string? scopeId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            var (userContext, error) = await TryBuildUserContextAsync(context, keyRingService, ct);
            if (error is not null)
            {
                return error;
            }

            var resolvedUser = userContext!;
            var normalizedScopeType = NormalizeScopeTypeOrNull(scopeType);
            var normalizedScopeId = string.IsNullOrWhiteSpace(scopeId) ? null : scopeId.Trim();
            if (scopeType is not null && normalizedScopeType is null)
            {
                return Results.BadRequest(new { error = "Invalid scope type filter." });
            }

            var roleIds = resolvedUser.RoleIds.ToList();
            var memberships = await dbContext.ChatConversationParticipants.AsNoTracking()
                .Where(participant =>
                    participant.RemovedUtc == null &&
                    ((participant.SubjectType == "user" && participant.SubjectId == resolvedUser.UserId)
                    || (participant.SubjectType == "role" && roleIds.Contains(participant.SubjectId))))
                .ToListAsync(ct);

            if (memberships.Count == 0)
            {
                return Results.Ok(Array.Empty<ChatConversationSummaryResponse>());
            }

            var membershipByConversation = memberships
                .GroupBy(participant => participant.ConversationId)
                .ToDictionary(group => group.Key, group => group.ToList());

            var conversationIds = membershipByConversation.Keys.ToList();
            var query = dbContext.ChatConversations.AsNoTracking()
                .Where(conversation => conversationIds.Contains(conversation.Id) && !conversation.IsArchived);

            if (!string.IsNullOrWhiteSpace(normalizedScopeType))
            {
                query = query.Where(conversation => conversation.ScopeType == normalizedScopeType);
            }

            if (normalizedScopeId is not null)
            {
                query = query.Where(conversation => conversation.ScopeId == normalizedScopeId);
            }

            var conversations = await query
                .OrderByDescending(conversation => conversation.UpdatedUtc)
                .ToListAsync(ct);

            if (conversations.Count == 0)
            {
                return Results.Ok(Array.Empty<ChatConversationSummaryResponse>());
            }

            var readStates = await dbContext.ChatConversationReadStates.AsNoTracking()
                .Where(state => state.UserId == resolvedUser.UserId && conversationIds.Contains(state.ConversationId))
                .ToListAsync(ct);
            var readStateByConversation = readStates.ToDictionary(state => state.ConversationId, state => state.LastReadSequence);

            var publicLinks = await dbContext.ChatPublicLinks.AsNoTracking()
                .Where(link =>
                    link.IsActive &&
                    link.RevokedUtc == null &&
                    (link.ExpiresUtc == null || link.ExpiresUtc > DateTimeOffset.UtcNow) &&
                    conversationIds.Contains(link.ConversationId))
                .Select(link => link.ConversationId)
                .Distinct()
                .ToListAsync(ct);
            var conversationWithPublicLink = publicLinks.ToHashSet();

            var response = conversations.Select(conversation =>
            {
                var participantRows = membershipByConversation.GetValueOrDefault(conversation.Id, []);
                var canRead = participantRows.Any(participant => participant.CanRead || participant.CanWrite || participant.CanManage);
                var canWrite = participantRows.Any(participant => participant.CanWrite || participant.CanManage);
                var canManage = participantRows.Any(participant => participant.CanManage);
                var canRespondPublic = participantRows.Any(participant => participant.CanRespondPublic || participant.CanManage);
                var minReadableSequence = participantRows.Count == 0
                    ? 0
                    : participantRows.Min(participant => participant.MinReadableSequence);
                var minimumReadSequence = Math.Max(0, minReadableSequence - 1);
                var lastReadSequence = Math.Max(
                    readStateByConversation.GetValueOrDefault(conversation.Id, 0),
                    minimumReadSequence);
                var unread = conversation.LastMessageSequence > lastReadSequence
                    ? (int)Math.Min(int.MaxValue, conversation.LastMessageSequence - lastReadSequence)
                    : 0;

                return new ChatConversationSummaryResponse(
                    conversation.Id,
                    conversation.ChatType,
                    conversation.ScopeType,
                    conversation.ScopeId,
                    conversation.Title,
                    conversation.Description,
                    conversation.IsPublic,
                    conversation.PublicReadEnabled,
                    conversation.PublicQuestionEnabled,
                    conversation.LastMessageSequence,
                    lastReadSequence,
                    unread,
                    conversation.UpdatedUtc,
                    canRead,
                    canWrite,
                    canManage,
                    canRespondPublic,
                    conversationWithPublicLink.Contains(conversation.Id));
            }).ToList();

            return Results.Ok(response);
        });

        auth.MapPost("/conversations", async (
            ChatConversationCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IChatCryptoService chatCryptoService,
            ICsrfService csrfService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var (userContext, error) = await TryBuildUserContextAsync(context, keyRingService, ct);
            if (error is not null)
            {
                return error;
            }

            var resolvedUser = userContext!;
            var chatType = NormalizeChatType(request.ChatType);
            if (chatType is null)
            {
                return Results.BadRequest(new { error = "Invalid chat type." });
            }

            var scopeType = NormalizeScopeTypeOrNull(request.ScopeType);
            if (scopeType is null)
            {
                return Results.BadRequest(new { error = "Invalid scope type." });
            }

            var title = (request.Title ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                return Results.BadRequest(new { error = "Title is required." });
            }

            if (title.Length > MaxTitleLength)
            {
                return Results.BadRequest(new { error = "Title is too long." });
            }

            var scopeId = string.IsNullOrWhiteSpace(request.ScopeId) ? null : request.ScopeId.Trim();
            if (scopeId is not null && scopeId.Length > MaxScopeIdLength)
            {
                return Results.BadRequest(new { error = "Scope id is too long." });
            }

            var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            if (description is not null && description.Length > MaxDescriptionLength)
            {
                return Results.BadRequest(new { error = "Description is too long." });
            }

            Guid? createdByRoleId = request.CreatedByRoleId;
            if (createdByRoleId is not null && !resolvedUser.RoleIds.Contains(createdByRoleId.Value))
            {
                return Results.Forbid();
            }

            var participants = new List<ChatParticipantRequest>();
            foreach (var participant in request.Participants ?? Array.Empty<ChatParticipantRequest>())
            {
                var subjectType = NormalizeSubjectType(participant.SubjectType);
                if (subjectType is null)
                {
                    return Results.BadRequest(new { error = "Invalid participant subject type." });
                }

                if (subjectType == "role" && !await dbContext.Roles.AsNoTracking().AnyAsync(role => role.Id == participant.SubjectId, ct))
                {
                    return Results.BadRequest(new { error = $"Role {participant.SubjectId} does not exist." });
                }

                if (subjectType == "user" && !await dbContext.UserAccounts.AsNoTracking().AnyAsync(user => user.Id == participant.SubjectId, ct))
                {
                    return Results.BadRequest(new { error = $"User {participant.SubjectId} does not exist." });
                }

                participants.Add(participant with { SubjectType = subjectType });
            }

            if (createdByRoleId is not null)
            {
                participants.Add(new ChatParticipantRequest(
                    "role",
                    createdByRoleId.Value,
                    CanRead: true,
                    CanWrite: true,
                    CanManage: true,
                    CanRespondPublic: true));
            }
            else
            {
                participants.Add(new ChatParticipantRequest(
                    "user",
                    resolvedUser.UserId,
                    CanRead: true,
                    CanWrite: true,
                    CanManage: true,
                    CanRespondPublic: true));
            }

            var deduplicatedParticipants = participants
                .GroupBy(participant => $"{participant.SubjectType}:{participant.SubjectId:N}", StringComparer.Ordinal)
                .Select(group =>
                {
                    var first = group.First();
                    return first with
                    {
                        CanRead = group.Any(item => item.CanRead || item.CanWrite || item.CanManage),
                        CanWrite = group.Any(item => item.CanWrite || item.CanManage),
                        CanManage = group.Any(item => item.CanManage),
                        CanRespondPublic = group.Any(item => item.CanRespondPublic || item.CanManage)
                    };
                })
                .ToList();

            if (deduplicatedParticipants.Count == 0)
            {
                return Results.BadRequest(new { error = "At least one participant is required." });
            }

            var now = DateTimeOffset.UtcNow;
            var conversation = new ChatConversation
            {
                Id = Guid.NewGuid(),
                ChatType = chatType,
                ScopeType = scopeType,
                ScopeId = scopeId,
                Title = title,
                Description = description,
                CreatedByUserId = resolvedUser.UserId,
                CreatedByRoleId = createdByRoleId,
                IsArchived = false,
                IsPublic = request.IsPublic,
                PublicReadEnabled = request.IsPublic && request.PublicReadEnabled,
                PublicQuestionEnabled = request.IsPublic && request.PublicQuestionEnabled,
                ActiveKeyVersion = 1,
                LastMessageSequence = 0,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            var initialKey = chatCryptoService.CreateConversationKey();
            var initialKeyVersion = new ChatConversationKeyVersion
            {
                Id = Guid.NewGuid(),
                ConversationId = conversation.Id,
                Version = 1,
                EncryptedKeyBlob = chatCryptoService.ProtectConversationKey(initialKey),
                Reason = "initial",
                RotatedByUserId = resolvedUser.UserId,
                CreatedUtc = now
            };

            var participantEntities = deduplicatedParticipants.Select(participant => new ChatConversationParticipant
            {
                Id = Guid.NewGuid(),
                ConversationId = conversation.Id,
                SubjectType = participant.SubjectType,
                SubjectId = participant.SubjectId,
                DisplayLabel = null,
                CanRead = participant.CanRead || participant.CanWrite || participant.CanManage,
                CanWrite = participant.CanWrite || participant.CanManage,
                CanManage = participant.CanManage,
                CanRespondPublic = participant.CanRespondPublic || participant.CanManage,
                MinReadableSequence = 0,
                JoinedUtc = now,
                AddedByUserId = resolvedUser.UserId
            }).ToList();

            dbContext.ChatConversations.Add(conversation);
            dbContext.ChatConversationKeyVersions.Add(initialKeyVersion);
            dbContext.ChatConversationParticipants.AddRange(participantEntities);
            await dbContext.SaveChangesAsync(ct);

            var summary = new ChatConversationSummaryResponse(
                conversation.Id,
                conversation.ChatType,
                conversation.ScopeType,
                conversation.ScopeId,
                conversation.Title,
                conversation.Description,
                conversation.IsPublic,
                conversation.PublicReadEnabled,
                conversation.PublicQuestionEnabled,
                conversation.LastMessageSequence,
                0,
                0,
                conversation.UpdatedUtc,
                CanRead: true,
                CanWrite: true,
                CanManage: true,
                CanRespondPublic: true,
                HasActivePublicLink: false);

            var detail = new ChatConversationDetailResponse(
                summary,
                participantEntities.Select(ToParticipantResponse).ToList());

            return Results.Ok(detail);
        });

        auth.MapGet("/conversations/{conversationId:guid}", async (
            Guid conversationId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var summary = await BuildSummaryAsync(access.Context!, dbContext, ct);
            var detail = new ChatConversationDetailResponse(
                summary,
                access.Context!.Participants.Select(ToParticipantResponse).ToList());
            return Results.Ok(detail);
        });

        auth.MapGet("/conversations/{conversationId:guid}/messages", async (
            Guid conversationId,
            long? afterSequence,
            int? take,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IChatCryptoService chatCryptoService,
            CancellationToken ct) =>
        {
            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var response = await LoadMessagesAsync(
                dbContext,
                chatCryptoService,
                access.Context!.Conversation,
                afterSequence,
                take,
                access.Context.MinReadableSequence,
                publicOnly: false,
                ct);

            return Results.Ok(response);
        });

        auth.MapGet("/conversations/{conversationId:guid}/messages/poll", async (
            Guid conversationId,
            long? afterSequence,
            int? waitSeconds,
            int? take,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IChatCryptoService chatCryptoService,
            CancellationToken ct) =>
        {
            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var after = Math.Max(afterSequence ?? 0, 0);
            var wait = Math.Clamp(waitSeconds ?? 20, 0, 30);
            if (wait > 0)
            {
                var deadline = DateTimeOffset.UtcNow.AddSeconds(wait);
                while (DateTimeOffset.UtcNow < deadline)
                {
                    ct.ThrowIfCancellationRequested();
                    var currentSequence = await dbContext.ChatConversations.AsNoTracking()
                        .Where(conversation => conversation.Id == conversationId)
                        .Select(conversation => conversation.LastMessageSequence)
                        .FirstOrDefaultAsync(ct);
                    if (currentSequence > after)
                    {
                        break;
                    }

                    await Task.Delay(TimeSpan.FromMilliseconds(850), ct);
                }
            }

            var response = await LoadMessagesAsync(
                dbContext,
                chatCryptoService,
                access.Context!.Conversation,
                after,
                take,
                access.Context.MinReadableSequence,
                publicOnly: false,
                ct);

            return Results.Ok(response);
        });

        auth.MapPost("/conversations/{conversationId:guid}/messages", async (
            Guid conversationId,
            ChatSendMessageRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IChatCryptoService chatCryptoService,
            ICsrfService csrfService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var text = (request.Text ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                return Results.BadRequest(new { error = "Message text is required." });
            }

            if (text.Length > MaxMessageLength)
            {
                return Results.BadRequest(new { error = $"Message exceeds {MaxMessageLength} characters." });
            }

            var visibility = NormalizeVisibility(request.Visibility);
            if (visibility is null)
            {
                return Results.BadRequest(new { error = "Invalid visibility." });
            }

            var messageType = NormalizeMessageType(request.MessageType) ?? "text";
            var conversation = access.Context!.Conversation;
            var clientMessageId = string.IsNullOrWhiteSpace(request.ClientMessageId) ? null : request.ClientMessageId.Trim();
            if (clientMessageId is not null && clientMessageId.Length > MaxClientMessageIdLength)
            {
                return Results.BadRequest(new { error = "Client message id is too long." });
            }

            if (visibility == "public" && !conversation.IsPublic)
            {
                return Results.BadRequest(new { error = "Public visibility is available only in public chats." });
            }

            var canWrite = access.Context.CanWrite;
            var canRespondPublic = access.Context.CanRespondPublic;
            if (visibility == "public")
            {
                if (!canWrite && !canRespondPublic)
                {
                    return Results.Forbid();
                }
            }
            else if (!canWrite)
            {
                return Results.Forbid();
            }

            Guid? senderRoleId = request.SenderRoleId;
            if (senderRoleId is not null && !access.Context.User.RoleIds.Contains(senderRoleId.Value))
            {
                return Results.Forbid();
            }

            var senderDisplay = await ResolveSenderDisplayAsync(dbContext, access.Context.User.UserId, senderRoleId, ct);
            var now = DateTimeOffset.UtcNow;

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);
            var trackedConversation = await dbContext.ChatConversations
                .FirstOrDefaultAsync(item => item.Id == conversationId, ct);
            if (trackedConversation is null)
            {
                return Results.NotFound();
            }

            var keyVersion = await dbContext.ChatConversationKeyVersions.AsNoTracking()
                .FirstOrDefaultAsync(version =>
                    version.ConversationId == conversationId &&
                    version.Version == trackedConversation.ActiveKeyVersion,
                    ct);
            if (keyVersion is null)
            {
                return Results.BadRequest(new { error = "Conversation key missing." });
            }

            var nextSequence = trackedConversation.LastMessageSequence + 1;
            var key = chatCryptoService.UnprotectConversationKey(keyVersion.EncryptedKeyBlob);
            var ciphertext = chatCryptoService.EncryptMessage(
                key,
                trackedConversation.Id,
                nextSequence,
                trackedConversation.ActiveKeyVersion,
                text);

            var message = new ChatMessage
            {
                Id = Guid.NewGuid(),
                ConversationId = conversationId,
                Sequence = nextSequence,
                SenderUserId = access.Context.User.UserId,
                SenderRoleId = senderRoleId,
                SenderDisplay = senderDisplay,
                MessageType = messageType,
                Visibility = visibility,
                ClientMessageId = clientMessageId,
                KeyVersion = trackedConversation.ActiveKeyVersion,
                Ciphertext = ciphertext,
                CreatedUtc = now
            };

            trackedConversation.LastMessageSequence = nextSequence;
            trackedConversation.UpdatedUtc = now;

            dbContext.ChatMessages.Add(message);
            await dbContext.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            var response = new ChatMessageResponse(
                message.Id,
                message.ConversationId,
                message.Sequence,
                message.SenderUserId,
                message.SenderRoleId,
                message.SenderDisplay,
                message.MessageType,
                message.Visibility,
                text,
                message.ClientMessageId,
                message.CreatedUtc,
                message.EditedUtc,
                message.DeletedUtc);

            return Results.Ok(response);
        });

        auth.MapPost("/conversations/{conversationId:guid}/read", async (
            Guid conversationId,
            ChatMarkReadRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICsrfService csrfService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var minReadableSequence = access.Context!.MinReadableSequence;
            var maxSequence = Math.Max(
                Math.Max(0, minReadableSequence - 1),
                Math.Min(request.LastReadSequence, access.Context.Conversation.LastMessageSequence));
            var state = await dbContext.ChatConversationReadStates
                .FirstOrDefaultAsync(item =>
                    item.ConversationId == conversationId &&
                    item.UserId == access.Context.User.UserId,
                    ct);

            if (state is null)
            {
                state = new ChatConversationReadState
                {
                    Id = Guid.NewGuid(),
                    ConversationId = conversationId,
                    UserId = access.Context.User.UserId,
                    LastReadSequence = maxSequence,
                    UpdatedUtc = DateTimeOffset.UtcNow
                };
                dbContext.ChatConversationReadStates.Add(state);
            }
            else if (maxSequence > state.LastReadSequence)
            {
                state.LastReadSequence = maxSequence;
                state.UpdatedUtc = DateTimeOffset.UtcNow;
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { conversationId, lastReadSequence = state.LastReadSequence });
        });

        auth.MapPost("/conversations/{conversationId:guid}/participants", async (
            Guid conversationId,
            ChatParticipantsAddRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IChatCryptoService chatCryptoService,
            ICsrfService csrfService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var normalized = new List<ChatParticipantRequest>();
            foreach (var participant in request.Participants ?? Array.Empty<ChatParticipantRequest>())
            {
                var subjectType = NormalizeSubjectType(participant.SubjectType);
                if (subjectType is null)
                {
                    return Results.BadRequest(new { error = "Invalid participant subject type." });
                }

                if (subjectType == "role" && !await dbContext.Roles.AsNoTracking().AnyAsync(role => role.Id == participant.SubjectId, ct))
                {
                    return Results.BadRequest(new { error = $"Role {participant.SubjectId} does not exist." });
                }

                if (subjectType == "user" && !await dbContext.UserAccounts.AsNoTracking().AnyAsync(user => user.Id == participant.SubjectId, ct))
                {
                    return Results.BadRequest(new { error = $"User {participant.SubjectId} does not exist." });
                }

                normalized.Add(participant with { SubjectType = subjectType });
            }

            if (normalized.Count == 0)
            {
                return Results.BadRequest(new { error = "Participants payload is empty." });
            }

            var now = DateTimeOffset.UtcNow;
            var activeParticipants = await dbContext.ChatConversationParticipants
                .Where(participant => participant.ConversationId == conversationId && participant.RemovedUtc == null)
                .ToListAsync(ct);
            var activeByKey = activeParticipants.ToDictionary(
                participant => $"{participant.SubjectType}:{participant.SubjectId:N}",
                participant => participant,
                StringComparer.Ordinal);

            var changed = false;
            foreach (var participant in normalized)
            {
                var key = $"{participant.SubjectType}:{participant.SubjectId:N}";
                if (!activeByKey.TryGetValue(key, out var existing))
                {
                    var minReadableSequence = request.IncludeHistory
                        ? 0
                        : access.Context.Conversation.LastMessageSequence + 1;
                    dbContext.ChatConversationParticipants.Add(new ChatConversationParticipant
                    {
                        Id = Guid.NewGuid(),
                        ConversationId = conversationId,
                        SubjectType = participant.SubjectType,
                        SubjectId = participant.SubjectId,
                        DisplayLabel = null,
                        CanRead = participant.CanRead || participant.CanWrite || participant.CanManage,
                        CanWrite = participant.CanWrite || participant.CanManage,
                        CanManage = participant.CanManage,
                        CanRespondPublic = participant.CanRespondPublic || participant.CanManage,
                        MinReadableSequence = minReadableSequence,
                        JoinedUtc = now,
                        AddedByUserId = access.Context.User.UserId
                    });
                    changed = true;
                    continue;
                }

                var nextCanRead = participant.CanRead || participant.CanWrite || participant.CanManage;
                var nextCanWrite = participant.CanWrite || participant.CanManage;
                var nextCanManage = participant.CanManage;
                var nextCanRespondPublic = participant.CanRespondPublic || participant.CanManage;
                var nextMinReadableSequence = request.IncludeHistory ? 0 : existing.MinReadableSequence;

                if (existing.CanRead != nextCanRead ||
                    existing.CanWrite != nextCanWrite ||
                    existing.CanManage != nextCanManage ||
                    existing.CanRespondPublic != nextCanRespondPublic ||
                    existing.MinReadableSequence != nextMinReadableSequence)
                {
                    existing.CanRead = nextCanRead;
                    existing.CanWrite = nextCanWrite;
                    existing.CanManage = nextCanManage;
                    existing.CanRespondPublic = nextCanRespondPublic;
                    existing.MinReadableSequence = nextMinReadableSequence;
                    changed = true;
                }
            }

            if (changed)
            {
                await dbContext.SaveChangesAsync(ct);
                await RotateConversationKeyAsync(
                    dbContext,
                    chatCryptoService,
                    conversationId,
                    access.Context.User.UserId,
                    "participant-change",
                    request.IncludeHistory,
                    ct);
            }

            var participantsResponse = await dbContext.ChatConversationParticipants.AsNoTracking()
                .Where(participant => participant.ConversationId == conversationId)
                .OrderBy(participant => participant.JoinedUtc)
                .ToListAsync(ct);

            return Results.Ok(participantsResponse.Select(ToParticipantResponse).ToList());
        });

        auth.MapDelete("/conversations/{conversationId:guid}/participants/{participantId:guid}", async (
            Guid conversationId,
            Guid participantId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IChatCryptoService chatCryptoService,
            ICsrfService csrfService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var participant = await dbContext.ChatConversationParticipants
                .FirstOrDefaultAsync(item =>
                    item.ConversationId == conversationId &&
                    item.Id == participantId &&
                    item.RemovedUtc == null,
                    ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            participant.RemovedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await RotateConversationKeyAsync(
                dbContext,
                chatCryptoService,
                conversationId,
                access.Context.User.UserId,
                "participant-removed",
                true,
                ct);

            return Results.Ok(new { removed = true });
        });

        auth.MapPost("/conversations/{conversationId:guid}/public-links", async (
            Guid conversationId,
            ChatPublicLinkCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IChatCryptoService chatCryptoService,
            ICsrfService csrfService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveConversationAccessAsync(conversationId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            if (!access.Context.Conversation.IsPublic)
            {
                return Results.BadRequest(new { error = "Public links are allowed only for public chats." });
            }

            var now = DateTimeOffset.UtcNow;
            DateTimeOffset? expiresUtc = request.ExpiresInHours is > 0
                ? now.AddHours(Math.Clamp(request.ExpiresInHours.Value, 1, 24 * 365))
                : null;
            var code = chatCryptoService.CreatePublicCode();
            var codeHash = chatCryptoService.HashPublicCode(code);
            var label = string.IsNullOrWhiteSpace(request.Label) ? "public" : request.Label.Trim();
            if (label.Length > MaxPublicLinkLabelLength)
            {
                return Results.BadRequest(new { error = "Public link label is too long." });
            }

            var activeLinks = await dbContext.ChatPublicLinks
                .Where(link => link.ConversationId == conversationId && link.IsActive && link.RevokedUtc == null)
                .ToListAsync(ct);
            foreach (var link in activeLinks)
            {
                link.IsActive = false;
                link.RevokedUtc = now;
            }

            var publicLink = new ChatPublicLink
            {
                Id = Guid.NewGuid(),
                ConversationId = conversationId,
                CodeHash = codeHash,
                Label = label,
                IsActive = true,
                ExpiresUtc = expiresUtc,
                CreatedByUserId = access.Context.User.UserId,
                CreatedUtc = now,
                LastUsedUtc = null,
                RevokedUtc = null
            };

            var conversation = await dbContext.ChatConversations
                .FirstOrDefaultAsync(item => item.Id == conversationId, ct);
            if (conversation is null)
            {
                return Results.NotFound();
            }

            conversation.PublicCodeHash = codeHash;
            conversation.UpdatedUtc = now;

            dbContext.ChatPublicLinks.Add(publicLink);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new ChatPublicLinkResponse(
                publicLink.Id,
                code,
                publicLink.Label,
                publicLink.CreatedUtc,
                publicLink.ExpiresUtc,
                publicLink.IsActive));
        });

        group.MapGet("/public/{code}", async (
            string code,
            long? afterSequence,
            int? take,
            RecreatioDbContext dbContext,
            IChatCryptoService chatCryptoService,
            CancellationToken ct) =>
        {
            var resolved = await ResolvePublicConversationAsync(code, dbContext, chatCryptoService, updateLastUsed: false, ct);
            if (resolved.Error is not null)
            {
                return resolved.Error;
            }

            var response = await LoadMessagesAsync(
                dbContext,
                chatCryptoService,
                resolved.Conversation!,
                afterSequence,
                take,
                0,
                publicOnly: true,
                ct);

            return Results.Ok(new ChatPublicConversationResponse(
                resolved.Conversation!.Id,
                resolved.Conversation.Title,
                resolved.Conversation.ScopeType,
                resolved.Conversation.ScopeId,
                response));
        });

        group.MapGet("/public/{code}/poll", async (
            string code,
            long? afterSequence,
            int? waitSeconds,
            int? take,
            RecreatioDbContext dbContext,
            IChatCryptoService chatCryptoService,
            CancellationToken ct) =>
        {
            var resolved = await ResolvePublicConversationAsync(code, dbContext, chatCryptoService, updateLastUsed: false, ct);
            if (resolved.Error is not null)
            {
                return resolved.Error;
            }

            var conversation = resolved.Conversation!;
            var after = Math.Max(afterSequence ?? 0, 0);
            var wait = Math.Clamp(waitSeconds ?? 20, 0, 30);
            if (wait > 0)
            {
                var deadline = DateTimeOffset.UtcNow.AddSeconds(wait);
                while (DateTimeOffset.UtcNow < deadline)
                {
                    ct.ThrowIfCancellationRequested();
                    var currentSequence = await dbContext.ChatMessages.AsNoTracking()
                        .Where(message =>
                            message.ConversationId == conversation.Id &&
                            message.Visibility == "public" &&
                            message.DeletedUtc == null)
                        .Select(message => message.Sequence)
                        .DefaultIfEmpty(0)
                        .MaxAsync(ct);
                    if (currentSequence > after)
                    {
                        break;
                    }

                    await Task.Delay(TimeSpan.FromMilliseconds(900), ct);
                }
            }

            var response = await LoadMessagesAsync(
                dbContext,
                chatCryptoService,
                conversation,
                after,
                take,
                0,
                publicOnly: true,
                ct);

            return Results.Ok(new ChatPublicConversationResponse(
                conversation.Id,
                conversation.Title,
                conversation.ScopeType,
                conversation.ScopeId,
                response));
        });

        group.MapPost("/public/{code}/questions", async (
            string code,
            ChatPublicQuestionRequest request,
            RecreatioDbContext dbContext,
            IChatCryptoService chatCryptoService,
            CancellationToken ct) =>
        {
            var resolved = await ResolvePublicConversationAsync(code, dbContext, chatCryptoService, updateLastUsed: true, ct);
            if (resolved.Error is not null)
            {
                return resolved.Error;
            }

            var conversation = resolved.Conversation!;
            if (!conversation.PublicQuestionEnabled)
            {
                return Results.Forbid();
            }

            var text = (request.Text ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                return Results.BadRequest(new { error = "Question text is required." });
            }

            if (text.Length > MaxMessageLength)
            {
                return Results.BadRequest(new { error = $"Question exceeds {MaxMessageLength} characters." });
            }

            var senderDisplay = string.IsNullOrWhiteSpace(request.DisplayName)
                ? "Guest"
                : request.DisplayName.Trim();
            if (senderDisplay.Length > MaxSenderDisplayLength)
            {
                return Results.BadRequest(new { error = "Display name is too long." });
            }
            var clientMessageId = string.IsNullOrWhiteSpace(request.ClientMessageId) ? null : request.ClientMessageId.Trim();
            if (clientMessageId is not null && clientMessageId.Length > MaxClientMessageIdLength)
            {
                return Results.BadRequest(new { error = "Client message id is too long." });
            }

            var now = DateTimeOffset.UtcNow;
            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

            var trackedConversation = await dbContext.ChatConversations
                .FirstOrDefaultAsync(item => item.Id == conversation.Id, ct);
            if (trackedConversation is null)
            {
                return Results.NotFound();
            }

            var keyVersion = await dbContext.ChatConversationKeyVersions.AsNoTracking()
                .FirstOrDefaultAsync(version =>
                    version.ConversationId == conversation.Id &&
                    version.Version == trackedConversation.ActiveKeyVersion,
                    ct);
            if (keyVersion is null)
            {
                return Results.BadRequest(new { error = "Conversation key missing." });
            }

            var sequence = trackedConversation.LastMessageSequence + 1;
            var key = chatCryptoService.UnprotectConversationKey(keyVersion.EncryptedKeyBlob);
            var ciphertext = chatCryptoService.EncryptMessage(
                key,
                trackedConversation.Id,
                sequence,
                trackedConversation.ActiveKeyVersion,
                text);

            var message = new ChatMessage
            {
                Id = Guid.NewGuid(),
                ConversationId = trackedConversation.Id,
                Sequence = sequence,
                SenderUserId = null,
                SenderRoleId = null,
                SenderDisplay = senderDisplay,
                MessageType = "question",
                Visibility = "public",
                ClientMessageId = clientMessageId,
                KeyVersion = trackedConversation.ActiveKeyVersion,
                Ciphertext = ciphertext,
                CreatedUtc = now
            };

            trackedConversation.LastMessageSequence = sequence;
            trackedConversation.UpdatedUtc = now;

            dbContext.ChatMessages.Add(message);
            await dbContext.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Results.Ok(new ChatMessageResponse(
                message.Id,
                message.ConversationId,
                message.Sequence,
                message.SenderUserId,
                message.SenderRoleId,
                message.SenderDisplay,
                message.MessageType,
                message.Visibility,
                text,
                message.ClientMessageId,
                message.CreatedUtc,
                message.EditedUtc,
                message.DeletedUtc));
        }).RequireRateLimiting("auth");
    }

    private static async Task RotateConversationKeyAsync(
        RecreatioDbContext dbContext,
        IChatCryptoService chatCryptoService,
        Guid conversationId,
        Guid rotatedByUserId,
        string reason,
        bool reencryptHistory,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var conversation = await dbContext.ChatConversations
            .FirstOrDefaultAsync(item => item.Id == conversationId, ct);
        if (conversation is null)
        {
            return;
        }

        var keyVersions = await dbContext.ChatConversationKeyVersions
            .Where(version => version.ConversationId == conversationId)
            .ToListAsync(ct);
        if (keyVersions.Count == 0)
        {
            return;
        }

        var nextVersion = conversation.ActiveKeyVersion + 1;
        var newKey = chatCryptoService.CreateConversationKey();
        var newKeyProtected = chatCryptoService.ProtectConversationKey(newKey);

        if (reencryptHistory)
        {
            var keyByVersion = keyVersions.ToDictionary(
                version => version.Version,
                version => chatCryptoService.UnprotectConversationKey(version.EncryptedKeyBlob));

            var messages = await dbContext.ChatMessages
                .Where(message => message.ConversationId == conversationId && message.DeletedUtc == null)
                .OrderBy(message => message.Sequence)
                .ToListAsync(ct);

            foreach (var message in messages)
            {
                if (!keyByVersion.TryGetValue(message.KeyVersion, out var oldKey))
                {
                    continue;
                }

                var text = chatCryptoService.TryDecryptMessage(
                    oldKey,
                    message.ConversationId,
                    message.Sequence,
                    message.KeyVersion,
                    message.Ciphertext);
                if (text is null)
                {
                    continue;
                }

                message.Ciphertext = chatCryptoService.EncryptMessage(
                    newKey,
                    message.ConversationId,
                    message.Sequence,
                    nextVersion,
                    text);
                message.KeyVersion = nextVersion;
            }
        }

        dbContext.ChatConversationKeyVersions.Add(new ChatConversationKeyVersion
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            Version = nextVersion,
            EncryptedKeyBlob = newKeyProtected,
            Reason = string.IsNullOrWhiteSpace(reason) ? "rekey" : reason,
            RotatedByUserId = rotatedByUserId,
            CreatedUtc = now
        });

        conversation.ActiveKeyVersion = nextVersion;
        conversation.UpdatedUtc = now;
        await dbContext.SaveChangesAsync(ct);
    }

    private static async Task<(ChatConversation? Conversation, IResult? Error)> ResolvePublicConversationAsync(
        string code,
        RecreatioDbContext dbContext,
        IChatCryptoService chatCryptoService,
        bool updateLastUsed,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return (null, Results.NotFound());
        }

        var now = DateTimeOffset.UtcNow;
        var hash = chatCryptoService.HashPublicCode(code);
        var candidates = await dbContext.ChatPublicLinks
            .Where(item =>
                item.IsActive &&
                item.RevokedUtc == null)
            .ToListAsync(ct);
        var link = candidates.FirstOrDefault(item => item.CodeHash.SequenceEqual(hash));
        if (link is null)
        {
            return (null, Results.NotFound());
        }

        if (link.ExpiresUtc is not null && link.ExpiresUtc <= now)
        {
            return (null, Results.NotFound());
        }

        var conversation = await dbContext.ChatConversations
            .FirstOrDefaultAsync(item =>
                item.Id == link.ConversationId &&
                item.IsPublic &&
                item.PublicReadEnabled &&
                !item.IsArchived,
                ct);
        if (conversation is null)
        {
            return (null, Results.NotFound());
        }

        if (updateLastUsed)
        {
            link.LastUsedUtc = now;
            await dbContext.SaveChangesAsync(ct);
        }

        return (conversation, null);
    }

    private static async Task<ChatConversationSummaryResponse> BuildSummaryAsync(
        ConversationAccessContext access,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var conversation = access.Conversation;
        var readState = await dbContext.ChatConversationReadStates.AsNoTracking()
            .FirstOrDefaultAsync(state =>
                state.ConversationId == conversation.Id &&
                state.UserId == access.User.UserId,
                ct);
        var hasPublicLink = await dbContext.ChatPublicLinks.AsNoTracking()
            .AnyAsync(link =>
                link.ConversationId == conversation.Id &&
                link.IsActive &&
                link.RevokedUtc == null &&
                (link.ExpiresUtc == null || link.ExpiresUtc > DateTimeOffset.UtcNow),
                ct);
        var minReadableSequence = access.MinReadableSequence;
        var minimumReadSequence = Math.Max(0, minReadableSequence - 1);
        var lastRead = Math.Max(readState?.LastReadSequence ?? 0, minimumReadSequence);
        var unread = conversation.LastMessageSequence > lastRead
            ? (int)Math.Min(int.MaxValue, conversation.LastMessageSequence - lastRead)
            : 0;

        return new ChatConversationSummaryResponse(
            conversation.Id,
            conversation.ChatType,
            conversation.ScopeType,
            conversation.ScopeId,
            conversation.Title,
            conversation.Description,
            conversation.IsPublic,
            conversation.PublicReadEnabled,
            conversation.PublicQuestionEnabled,
            conversation.LastMessageSequence,
            lastRead,
            unread,
            conversation.UpdatedUtc,
            access.CanRead,
            access.CanWrite,
            access.CanManage,
            access.CanRespondPublic,
            hasPublicLink);
    }

    private static async Task<ChatMessagesResponse> LoadMessagesAsync(
        RecreatioDbContext dbContext,
        IChatCryptoService chatCryptoService,
        ChatConversation conversation,
        long? afterSequence,
        int? take,
        long minReadableSequence,
        bool publicOnly,
        CancellationToken ct)
    {
        var pageSize = Math.Clamp(take ?? DefaultMessagePageSize, 1, MaxMessagePageSize);
        var query = dbContext.ChatMessages.AsNoTracking()
            .Where(message =>
                message.ConversationId == conversation.Id &&
                message.DeletedUtc == null &&
                message.Sequence >= minReadableSequence);

        if (publicOnly)
        {
            query = query.Where(message => message.Visibility == "public");
        }

        List<ChatMessage> messages;
        if (afterSequence is > 0)
        {
            messages = await query
                .Where(message => message.Sequence > afterSequence.Value)
                .OrderBy(message => message.Sequence)
                .Take(pageSize)
                .ToListAsync(ct);
        }
        else
        {
            messages = await query
                .OrderByDescending(message => message.Sequence)
                .Take(pageSize)
                .ToListAsync(ct);
            messages.Reverse();
        }

        if (messages.Count == 0)
        {
            return new ChatMessagesResponse(conversation.Id, afterSequence ?? conversation.LastMessageSequence, Array.Empty<ChatMessageResponse>());
        }

        var requestedVersions = messages.Select(message => message.KeyVersion).Distinct().ToList();
        var keyVersions = await dbContext.ChatConversationKeyVersions.AsNoTracking()
            .Where(version => version.ConversationId == conversation.Id && requestedVersions.Contains(version.Version))
            .ToListAsync(ct);

        var keyByVersion = new Dictionary<int, byte[]>();
        foreach (var version in keyVersions)
        {
            keyByVersion[version.Version] = chatCryptoService.UnprotectConversationKey(version.EncryptedKeyBlob);
        }

        var responseMessages = new List<ChatMessageResponse>(messages.Count);
        foreach (var message in messages)
        {
            if (!keyByVersion.TryGetValue(message.KeyVersion, out var key))
            {
                continue;
            }

            var text = chatCryptoService.TryDecryptMessage(
                key,
                message.ConversationId,
                message.Sequence,
                message.KeyVersion,
                message.Ciphertext) ?? "[message unavailable]";

            responseMessages.Add(new ChatMessageResponse(
                message.Id,
                message.ConversationId,
                message.Sequence,
                message.SenderUserId,
                message.SenderRoleId,
                message.SenderDisplay,
                message.MessageType,
                message.Visibility,
                text,
                message.ClientMessageId,
                message.CreatedUtc,
                message.EditedUtc,
                message.DeletedUtc));
        }

        var lastSequence = responseMessages.Count > 0
            ? responseMessages[^1].Sequence
            : afterSequence ?? conversation.LastMessageSequence;
        return new ChatMessagesResponse(conversation.Id, lastSequence, responseMessages);
    }

    private static async Task<string> ResolveSenderDisplayAsync(
        RecreatioDbContext dbContext,
        Guid userId,
        Guid? senderRoleId,
        CancellationToken ct)
    {
        if (senderRoleId is not null)
        {
            return $"Role {senderRoleId.Value.ToString("N")[..8]}";
        }

        var account = await dbContext.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId, ct);
        if (account is null)
        {
            return "User";
        }

        if (!string.IsNullOrWhiteSpace(account.DisplayName))
        {
            var trimmed = account.DisplayName.Trim();
            return trimmed[..Math.Min(trimmed.Length, MaxSenderDisplayLength)];
        }

        return account.LoginId[..Math.Min(account.LoginId.Length, MaxSenderDisplayLength)];
    }

    private static async Task<(UserContext? User, IResult? Error)> TryBuildUserContextAsync(
        HttpContext context,
        IKeyRingService keyRingService,
        CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId))
        {
            return (null, Results.Unauthorized());
        }

        if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
        {
            return (null, Results.Unauthorized());
        }

        RoleKeyRing keyRing;
        try
        {
            keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
        }
        catch (InvalidOperationException)
        {
            return (null, Results.StatusCode(StatusCodes.Status428PreconditionRequired));
        }

        return (new UserContext(userId, keyRing.ReadKeys.Keys.ToHashSet()), null);
    }

    private static async Task<(ConversationAccessContext? Context, IResult? Error)> ResolveConversationAccessAsync(
        Guid conversationId,
        HttpContext context,
        RecreatioDbContext dbContext,
        IKeyRingService keyRingService,
        CancellationToken ct)
    {
        var (user, error) = await TryBuildUserContextAsync(context, keyRingService, ct);
        if (error is not null)
        {
            return (null, error);
        }

        var resolvedUser = user!;
        var conversation = await dbContext.ChatConversations.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == conversationId && !item.IsArchived, ct);
        if (conversation is null)
        {
            return (null, Results.NotFound());
        }

        var participants = await dbContext.ChatConversationParticipants.AsNoTracking()
            .Where(participant => participant.ConversationId == conversationId && participant.RemovedUtc == null)
            .ToListAsync(ct);
        if (participants.Count == 0)
        {
            return (null, Results.Forbid());
        }

        var matchedParticipants = participants.Where(participant =>
            (participant.SubjectType == "user" && participant.SubjectId == resolvedUser.UserId)
            || (participant.SubjectType == "role" && resolvedUser.RoleIds.Contains(participant.SubjectId)))
            .ToList();

        var canRead = matchedParticipants.Any(participant => participant.CanRead || participant.CanWrite || participant.CanManage);
        if (!canRead)
        {
            return (null, Results.Forbid());
        }

        var canWrite = matchedParticipants.Any(participant => participant.CanWrite || participant.CanManage);
        var canManage = matchedParticipants.Any(participant => participant.CanManage);
        var canRespondPublic = matchedParticipants.Any(participant => participant.CanRespondPublic || participant.CanManage);
        var minReadableSequence = matchedParticipants.Count == 0
            ? 0
            : matchedParticipants.Min(participant => participant.MinReadableSequence);

        return (new ConversationAccessContext(
            resolvedUser,
            conversation,
            participants,
            canRead,
            canWrite,
            canManage,
            canRespondPublic,
            minReadableSequence), null);
    }

    private static ChatConversationParticipantResponse ToParticipantResponse(ChatConversationParticipant participant)
    {
        return new ChatConversationParticipantResponse(
            participant.Id,
            participant.SubjectType,
            participant.SubjectId,
            participant.DisplayLabel,
            participant.CanRead,
            participant.CanWrite,
            participant.CanManage,
            participant.CanRespondPublic,
            participant.JoinedUtc,
            participant.RemovedUtc);
    }

    private static string? NormalizeChatType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (!AllowedChatTypes.Contains(normalized))
        {
            return null;
        }

        return normalized;
    }

    private static string? NormalizeScopeTypeOrNull(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (!AllowedScopeTypes.Contains(normalized))
        {
            return null;
        }

        return normalized;
    }

    private static string? NormalizeVisibility(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value)
            ? "internal"
            : value.Trim().ToLowerInvariant();
        return AllowedVisibility.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeMessageType(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value)
            ? "text"
            : value.Trim().ToLowerInvariant();
        return AllowedMessageTypes.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeSubjectType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedSubjectTypes.Contains(normalized) ? normalized : null;
    }

    private sealed record UserContext(
        Guid UserId,
        HashSet<Guid> RoleIds);

    private sealed record ConversationAccessContext(
        UserContext User,
        ChatConversation Conversation,
        List<ChatConversationParticipant> Participants,
        bool CanRead,
        bool CanWrite,
        bool CanManage,
        bool CanRespondPublic,
        long MinReadableSequence);
}
