using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Calendar;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Calendar;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static partial class CalendarEndpoints
{
    private static void MapCalendarAdvancedEndpoints(RouteGroupBuilder auth, RouteGroupBuilder group)
    {
        auth.MapGet("/calendars/{calendarId:guid}", async (
            Guid calendarId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            var access = await ResolveCalendarAccessAsync(calendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var bindings = await dbContext.CalendarRoleBindings.AsNoTracking()
                .Where(entry => entry.CalendarId == calendarId)
                .OrderBy(entry => entry.CreatedUtc)
                .ToListAsync(ct);

            return Results.Ok(BuildCalendarResponse(access.Context!.Calendar, bindings, access.Context.User));
        });

        auth.MapGet("/graph/templates", async (
            ICalendarGraphRuntimeService graphRuntimeService,
            CancellationToken ct) =>
        {
            var templates = await graphRuntimeService.GetTemplatesAsync(ct);
            return Results.Ok(templates);
        });

        auth.MapGet("/events/{eventId:guid}/graph", async (
            Guid eventId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICalendarGraphRuntimeService graphRuntimeService,
            CancellationToken ct) =>
        {
            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var graph = await graphRuntimeService.GetGraphAsync(eventId, ct);
            if (graph is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(graph);
        });

        auth.MapPut("/events/{eventId:guid}/graph", async (
            Guid eventId,
            CalendarGraphUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICsrfService csrfService,
            ICalendarGraphRuntimeService graphRuntimeService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            try
            {
                var graph = await graphRuntimeService.UpsertGraphAsync(eventId, request, access.Context.User.UserId, ct);
                return Results.Ok(graph);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        auth.MapPost("/events/{eventId:guid}/graph/execute", async (
            Guid eventId,
            CalendarGraphExecutionTriggerRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICsrfService csrfService,
            ICalendarGraphRuntimeService graphRuntimeService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            try
            {
                var execution = await graphRuntimeService.ExecuteGraphAsync(eventId, request, access.Context.User.UserId, ct);
                return Results.Ok(execution);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        auth.MapGet("/events/{eventId:guid}/graph/executions", async (
            Guid eventId,
            int? take,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICalendarGraphRuntimeService graphRuntimeService,
            CancellationToken ct) =>
        {
            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var history = await graphRuntimeService.GetExecutionsAsync(eventId, take ?? 30, ct);
            return Results.Ok(history);
        });

        auth.MapPost("/events/{eventId:guid}/complete", async (
            Guid eventId,
            CalendarTaskCompleteRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICsrfService csrfService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            var item = await dbContext.CalendarEvents.FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
            if (item is null)
            {
                return Results.NotFound();
            }

            if (item.ItemType != "task")
            {
                return Results.BadRequest(new { error = "Only task items support completion actions." });
            }

            var now = DateTimeOffset.UtcNow;
            item.TaskState = string.IsNullOrWhiteSpace(request.TaskState) ? "done" : request.TaskState.Trim().ToLowerInvariant();
            if (item.TaskState != "done" && item.TaskState != "cancelled")
            {
                item.TaskState = "done";
            }

            item.Status = item.TaskState == "cancelled" ? "cancelled" : "completed";
            item.CompletedUtc = now;
            item.TaskProgressPercent = item.TaskState == "done" ? 100 : item.TaskProgressPercent;
            item.UpdatedUtc = now;
            item.UpdatedByUserId = access.Context.User.UserId;

            if (!string.IsNullOrWhiteSpace(request.CompletionProofJson))
            {
                var proofDataItemId = CreateProtectedDataItem(
                    item.OwnerRoleId,
                    request.CompletionProofJson.Trim(),
                    access.Context.User,
                    keyRingService,
                    dbContext,
                    now);
                if (proofDataItemId == Guid.Empty)
                {
                    return Results.Forbid();
                }

                item.CompletionProofDataItemId = proofDataItemId;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarTaskCompleted",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    eventId,
                    completionAction = "complete_only",
                    item.TaskState,
                    item.CompletedUtc
                }),
                ct);

            return Results.Ok(new CalendarTaskCompletionResponse(eventId, item.TaskState ?? "done", item.CompletedUtc, null));
        });

        auth.MapPost("/events/{eventId:guid}/complete-and-run-graph", async (
            Guid eventId,
            CalendarTaskCompleteRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICsrfService csrfService,
            ILedgerService ledgerService,
            ICalendarGraphRuntimeService graphRuntimeService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            var item = await dbContext.CalendarEvents.FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
            if (item is null)
            {
                return Results.NotFound();
            }

            if (item.ItemType != "task")
            {
                return Results.BadRequest(new { error = "Only task items support completion actions." });
            }

            var now = DateTimeOffset.UtcNow;
            item.TaskState = "done";
            item.Status = "completed";
            item.CompletedUtc = now;
            item.TaskProgressPercent = 100;
            item.UpdatedUtc = now;
            item.UpdatedByUserId = access.Context.User.UserId;

            if (!string.IsNullOrWhiteSpace(request.CompletionProofJson))
            {
                var proofDataItemId = CreateProtectedDataItem(
                    item.OwnerRoleId,
                    request.CompletionProofJson.Trim(),
                    access.Context.User,
                    keyRingService,
                    dbContext,
                    now);
                if (proofDataItemId == Guid.Empty)
                {
                    return Results.Forbid();
                }

                item.CompletionProofDataItemId = proofDataItemId;
            }

            await dbContext.SaveChangesAsync(ct);

            CalendarGraphExecutionResponse? execution = null;
            try
            {
                execution = await graphRuntimeService.ExecuteGraphAsync(eventId, new CalendarGraphExecutionTriggerRequest(
                    TriggerType: "completion",
                    CompletionAction: "run_graph",
                    IdempotencyKey: request.IdempotencyKey,
                    TriggerPayloadJson: request.TriggerPayloadJson), access.Context.User.UserId, ct);
            }
            catch (InvalidOperationException)
            {
                execution = null;
            }

            await ledgerService.AppendBusinessAsync(
                "CalendarTaskCompleted",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    eventId,
                    completionAction = "run_graph",
                    item.TaskState,
                    item.CompletedUtc,
                    graphExecutionId = execution?.ExecutionId
                }),
                ct);

            return Results.Ok(new CalendarTaskCompletionResponse(eventId, item.TaskState ?? "done", item.CompletedUtc, execution));
        });

        auth.MapGet("/events/{eventId:guid}/conflicts", async (
            Guid eventId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var item = access.Context!.Event;
            var conflicts = await FindConflictsAsync(
                dbContext,
                item.CalendarId,
                item.StartUtc,
                item.EndUtc,
                access.Context.ScopeRoleIds.ToList(),
                item.Id,
                ct);
            return Results.Ok(conflicts);
        });

        auth.MapPost("/events/{eventId:guid}/shares", async (
            Guid eventId,
            CalendarSharedViewCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICsrfService csrfService,
            IHashingService hashingService,
            IEncryptionService encryptionService,
            IMasterKeyService masterKeyService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var label = string.IsNullOrWhiteSpace(request.Label) ? "shared-view" : request.Label.Trim();
            if (label.Length > MaxShareLabelLength)
            {
                return Results.BadRequest(new { error = "Share label is too long." });
            }

            var mode = string.IsNullOrWhiteSpace(request.Mode) ? "readonly" : request.Mode.Trim().ToLowerInvariant();
            if (mode != "readonly")
            {
                return Results.BadRequest(new { error = "Only readonly mode is supported." });
            }

            var now = DateTimeOffset.UtcNow;
            DateTimeOffset? expiresUtc = request.ExpiresInHours is > 0
                ? now.AddHours(Math.Clamp(request.ExpiresInHours.Value, 1, 24 * 365))
                : null;

            var activeLinks = await dbContext.CalendarSharedViewLinks
                .Where(entry => entry.EventId == eventId && entry.IsActive && entry.RevokedUtc == null)
                .ToListAsync(ct);
            foreach (var active in activeLinks)
            {
                active.IsActive = false;
                active.RevokedUtc = now;
                var staleSharedView = await dbContext.SharedViews.FirstOrDefaultAsync(entry => entry.Id == active.SharedViewId, ct);
                if (staleSharedView is not null)
                {
                    staleSharedView.RevokedUtc = now;
                }
            }

            var shareCode = CreateShareCode();
            var shareCodeBytes = Encoding.UTF8.GetBytes(shareCode);
            var secretHash = hashingService.Hash(shareCodeBytes);

            var sharedViewId = Guid.NewGuid();
            var viewRoleId = Guid.NewGuid();
            var viewRoleReadKey = RandomNumberGenerator.GetBytes(32);
            var sharedViewKey = masterKeyService.DeriveSharedViewKey(shareCodeBytes, sharedViewId);
            var encViewRoleKey = encryptionService.Encrypt(sharedViewKey, viewRoleReadKey, sharedViewId.ToByteArray());

            dbContext.Roles.Add(new Role
            {
                Id = viewRoleId,
                EncryptedRoleBlob = Array.Empty<byte>(),
                PublicSigningKey = null,
                PublicSigningKeyAlg = null,
                PublicEncryptionKey = null,
                PublicEncryptionKeyAlg = null,
                CreatedUtc = now,
                UpdatedUtc = now
            });

            dbContext.SharedViews.Add(new SharedView
            {
                Id = sharedViewId,
                OwnerRoleId = access.Context.Event.OwnerRoleId,
                ViewRoleId = viewRoleId,
                EncViewRoleKey = encViewRoleKey,
                SharedViewSecretHash = secretHash,
                CreatedUtc = now,
                RevokedUtc = null
            });

            var link = new CalendarSharedViewLink
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                SharedViewId = sharedViewId,
                Label = label,
                Mode = mode,
                IsActive = true,
                ExpiresUtc = expiresUtc,
                CreatedByUserId = access.Context.User.UserId,
                CreatedUtc = now,
                LastUsedUtc = null,
                RevokedUtc = null
            };
            dbContext.CalendarSharedViewLinks.Add(link);

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarSharedViewCreated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventId, linkId = link.Id, link.SharedViewId, link.ExpiresUtc, link.Mode }),
                ct);
            await ledgerService.AppendKeyAsync(
                "CalendarSharedViewKeyCreated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventId, sharedViewId, viewRoleId }),
                ct);

            return Results.Ok(new CalendarEventShareLinkResponse(
                link.Id,
                shareCode,
                link.Label,
                link.Mode,
                link.CreatedUtc,
                link.ExpiresUtc,
                link.IsActive,
                link.SharedViewId,
                $"recreatio://calendar/share/{shareCode}"));
        });

        auth.MapGet("/events/{eventId:guid}/shares", async (
            Guid eventId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var links = await dbContext.CalendarSharedViewLinks.AsNoTracking()
                .Where(entry => entry.EventId == eventId)
                .OrderByDescending(entry => entry.CreatedUtc)
                .ToListAsync(ct);

            var response = links.Select(link => new CalendarEventShareLinkResponse(
                link.Id,
                string.Empty,
                link.Label,
                link.Mode,
                link.CreatedUtc,
                link.ExpiresUtc,
                link.IsActive,
                link.SharedViewId,
                null)).ToList();
            return Results.Ok(response);
        });

        auth.MapDelete("/events/{eventId:guid}/shares/{linkId:guid}", async (
            Guid eventId,
            Guid linkId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ICsrfService csrfService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var link = await dbContext.CalendarSharedViewLinks
                .FirstOrDefaultAsync(entry => entry.EventId == eventId && entry.Id == linkId, ct);
            if (link is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            link.IsActive = false;
            link.RevokedUtc = now;

            var sharedView = await dbContext.SharedViews.FirstOrDefaultAsync(entry => entry.Id == link.SharedViewId, ct);
            if (sharedView is not null)
            {
                sharedView.RevokedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarSharedViewRevoked",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventId, linkId, link.SharedViewId }),
                ct);

            return Results.Ok(new { revoked = true });
        });

        auth.MapGet("/events/{eventId:guid}/reminder-dispatches", async (
            Guid eventId,
            int? take,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            var access = await ResolveEventAccessAsync(eventId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var normalizedTake = Math.Clamp(take ?? 50, 1, 300);
            var dispatches = await dbContext.CalendarReminderDispatches.AsNoTracking()
                .Where(entry => entry.EventId == eventId)
                .OrderByDescending(entry => entry.CreatedUtc)
                .Take(normalizedTake)
                .ToListAsync(ct);

            return Results.Ok(dispatches.Select(dispatch => new CalendarReminderDispatchResponse(
                dispatch.Id,
                dispatch.ReminderId,
                dispatch.EventId,
                dispatch.OccurrenceStartUtc,
                dispatch.Channel,
                dispatch.Status,
                dispatch.AttemptCount,
                dispatch.NextRetryUtc,
                dispatch.LastAttemptUtc,
                dispatch.DeliveredUtc,
                dispatch.LastError,
                dispatch.CreatedUtc,
                dispatch.UpdatedUtc)).ToList());
        });

        group.MapGet("/public/shared/{code}", async (
            string code,
            RecreatioDbContext dbContext,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return Results.NotFound();
            }

            var normalizedCode = code.Trim();
            if (normalizedCode.Length is < 6 or > 256)
            {
                return Results.NotFound();
            }

            var codeBytes = Encoding.UTF8.GetBytes(normalizedCode);
            var secretHash = hashingService.Hash(codeBytes);

            var activeLinks = await dbContext.CalendarSharedViewLinks
                .Where(entry => entry.IsActive && entry.RevokedUtc == null)
                .OrderByDescending(entry => entry.CreatedUtc)
                .Take(500)
                .ToListAsync(ct);
            if (activeLinks.Count == 0)
            {
                return Results.NotFound();
            }

            var sharedViewIds = activeLinks.Select(entry => entry.SharedViewId).Distinct().ToList();
            var sharedViews = await dbContext.SharedViews.AsNoTracking()
                .Where(entry => sharedViewIds.Contains(entry.Id) && entry.RevokedUtc == null)
                .ToListAsync(ct);
            var sharedViewMap = sharedViews.ToDictionary(entry => entry.Id, entry => entry);

            CalendarSharedViewLink? matchedLink = null;
            foreach (var candidate in activeLinks)
            {
                if (!sharedViewMap.TryGetValue(candidate.SharedViewId, out var sharedView))
                {
                    continue;
                }

                if (sharedView.SharedViewSecretHash.Length == 0 ||
                    sharedView.SharedViewSecretHash.Length != secretHash.Length ||
                    !CryptographicOperations.FixedTimeEquals(sharedView.SharedViewSecretHash, secretHash))
                {
                    continue;
                }

                matchedLink = candidate;
                break;
            }

            if (matchedLink is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            if (matchedLink.ExpiresUtc is not null && matchedLink.ExpiresUtc <= now)
            {
                return Results.NotFound();
            }

            var item = await dbContext.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == matchedLink.EventId, ct);
            if (item is null || item.IsArchived)
            {
                return Results.NotFound();
            }

            var tracked = await dbContext.CalendarSharedViewLinks.FirstOrDefaultAsync(entry => entry.Id == matchedLink.Id, ct);
            if (tracked is not null)
            {
                tracked.LastUsedUtc = now;
                await dbContext.SaveChangesAsync(ct);
            }

            return Results.Ok(ToPublicResponse(item));
        });
    }
}
