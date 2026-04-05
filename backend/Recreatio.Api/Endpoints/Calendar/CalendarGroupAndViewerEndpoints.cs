using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Calendar;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Calendar;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static partial class CalendarEndpoints
{
    private static void MapCalendarGroupAndViewerEndpoints(RouteGroupBuilder auth, RouteGroupBuilder group)
    {
        auth.MapPost("/events/{eventId:guid}/viewers", async (
            Guid eventId,
            CalendarViewerScopeRequest request,
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

            if (request.RoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "Viewer role id cannot be empty GUID." });
            }

            var roleExists = await dbContext.Roles.AsNoTracking().AnyAsync(role => role.Id == request.RoleId, ct);
            if (!roleExists)
            {
                return Results.BadRequest(new { error = "Viewer role does not exist." });
            }

            var activeParticipant = await dbContext.CalendarEventRoleScopes.AsNoTracking().AnyAsync(
                scope =>
                    scope.EventId == eventId &&
                    scope.RevokedUtc == null &&
                    scope.RoleId == request.RoleId &&
                    scope.ScopeType != "viewer",
                ct);
            if (activeParticipant)
            {
                return Results.BadRequest(new { error = "Role already has participant or owner scope." });
            }

            var now = DateTimeOffset.UtcNow;
            var viewerScope = await dbContext.CalendarEventRoleScopes
                .FirstOrDefaultAsync(scope =>
                    scope.EventId == eventId &&
                    scope.RevokedUtc == null &&
                    scope.ScopeType == "viewer" &&
                    scope.RoleId == request.RoleId,
                    ct);
            if (viewerScope is null)
            {
                dbContext.CalendarEventRoleScopes.Add(new CalendarEventRoleScope
                {
                    Id = Guid.NewGuid(),
                    EventId = eventId,
                    RoleId = request.RoleId,
                    ScopeType = "viewer",
                    ViewerCanSeeTitle = request.CanSeeTitle,
                    ViewerCanSeeGraph = request.CanSeeGraph,
                    CreatedUtc = now,
                    RevokedUtc = null
                });
            }
            else
            {
                viewerScope.ViewerCanSeeTitle = request.CanSeeTitle;
                viewerScope.ViewerCanSeeGraph = request.CanSeeGraph;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventViewerScopeUpserted",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    eventId,
                    viewerRoleId = request.RoleId,
                    request.CanSeeTitle,
                    request.CanSeeGraph
                }),
                ct);

            var scopes = await dbContext.CalendarEventRoleScopes.AsNoTracking()
                .Where(scope => scope.EventId == eventId && scope.RevokedUtc == null)
                .OrderBy(scope => scope.CreatedUtc)
                .ToListAsync(ct);
            return Results.Ok(scopes.Select(scope => new CalendarEventRoleScopeResponse(
                scope.Id,
                scope.RoleId,
                scope.ScopeType,
                scope.ViewerCanSeeTitle,
                scope.ViewerCanSeeGraph,
                scope.CreatedUtc,
                scope.RevokedUtc)).ToList());
        });

        auth.MapDelete("/events/{eventId:guid}/viewers/{roleId:guid}", async (
            Guid eventId,
            Guid roleId,
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

            var scope = await dbContext.CalendarEventRoleScopes
                .FirstOrDefaultAsync(entry =>
                    entry.EventId == eventId &&
                    entry.RoleId == roleId &&
                    entry.ScopeType == "viewer" &&
                    entry.RevokedUtc == null,
                    ct);
            if (scope is null)
            {
                return Results.NotFound();
            }

            scope.RevokedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventViewerScopeRevoked",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventId, viewerRoleId = roleId }),
                ct);

            return Results.Ok(new { revoked = true });
        });

        auth.MapGet("/calendars/{calendarId:guid}/graphs", async (
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

            var graphs = await (
                from graph in dbContext.CalendarScheduleGraphs.AsNoTracking()
                join item in dbContext.CalendarEvents.AsNoTracking() on graph.EventId equals item.Id
                where item.CalendarId == calendarId && !item.IsArchived && graph.Status != "archived"
                orderby graph.UpdatedUtc descending
                select new
                {
                    GraphId = graph.Id,
                    SourceEventId = item.Id,
                    item.TitlePublic,
                    graph.TemplateKey,
                    graph.Status,
                    graph.Version,
                    graph.UpdatedUtc
                })
                .Take(500)
                .ToListAsync(ct);

            return Results.Ok(graphs);
        });

        auth.MapPost("/events/{eventId:guid}/graph/link", async (
            Guid eventId,
            CalendarGraphLinkRequest request,
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

            if (request.GraphId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "GraphId is required." });
            }

            var graph = await dbContext.CalendarScheduleGraphs.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == request.GraphId, ct);
            if (graph is null || graph.Status == "archived")
            {
                return Results.BadRequest(new { error = "Graph does not exist or is archived." });
            }

            var sourceEvent = await dbContext.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == graph.EventId, ct);
            if (sourceEvent is null || sourceEvent.CalendarId != access.Context.Calendar.Id)
            {
                return Results.BadRequest(new { error = "Graph must belong to the same calendar." });
            }

            var now = DateTimeOffset.UtcNow;
            var activeLinks = await dbContext.CalendarEventGraphLinks
                .Where(entry => entry.EventId == eventId && entry.RevokedUtc == null)
                .ToListAsync(ct);
            foreach (var active in activeLinks.Where(entry => entry.GraphId != request.GraphId))
            {
                active.RevokedUtc = now;
            }

            var link = activeLinks.FirstOrDefault(entry => entry.GraphId == request.GraphId);
            if (link is null)
            {
                link = new CalendarEventGraphLink
                {
                    Id = Guid.NewGuid(),
                    EventId = eventId,
                    GraphId = request.GraphId,
                    IsPrimary = true,
                    CreatedByUserId = access.Context.User.UserId,
                    CreatedUtc = now,
                    RevokedUtc = null
                };
                dbContext.CalendarEventGraphLinks.Add(link);
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventGraphLinked",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventId, graphId = request.GraphId, linkId = link.Id }),
                ct);

            return Results.Ok(new CalendarGraphLinkResponse(link.Id, link.EventId, link.GraphId, link.IsPrimary, link.CreatedUtc, link.RevokedUtc));
        });

        auth.MapGet("/calendars/{calendarId:guid}/event-groups", async (
            Guid calendarId,
            bool? includeArchived,
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

            var groupsQuery = dbContext.CalendarEventGroups.AsNoTracking()
                .Where(entry => entry.CalendarId == calendarId);
            if (!(includeArchived ?? false))
            {
                groupsQuery = groupsQuery.Where(entry => !entry.IsArchived);
            }

            var groups = await groupsQuery
                .OrderByDescending(entry => entry.UpdatedUtc)
                .Take(1000)
                .ToListAsync(ct);

            var groupIds = groups.Select(entry => entry.Id).ToList();
            var counts = groupIds.Count == 0
                ? new Dictionary<Guid, int>()
                : await dbContext.CalendarEvents.AsNoTracking()
                    .Where(entry => entry.EventGroupId != null && groupIds.Contains(entry.EventGroupId.Value) && !entry.IsArchived)
                    .GroupBy(entry => entry.EventGroupId!.Value)
                    .ToDictionaryAsync(grouping => grouping.Key, grouping => grouping.Count(), ct);

            return Results.Ok(groups.Select(entry => ToEventGroupResponse(entry, counts.GetValueOrDefault(entry.Id))).ToList());
        });

        auth.MapPost("/calendars/{calendarId:guid}/event-groups", async (
            Guid calendarId,
            CalendarEventGroupCreateRequest request,
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

            var access = await ResolveCalendarAccessAsync(calendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            if (request.OwnerRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "OwnerRoleId is required." });
            }

            if (!access.Context.User.WriteRoleIds.Contains(request.OwnerRoleId) &&
                !access.Context.User.OwnerRoleIds.Contains(request.OwnerRoleId))
            {
                return Results.Forbid();
            }

            var ownerExists = await dbContext.Roles.AsNoTracking().AnyAsync(role => role.Id == request.OwnerRoleId, ct);
            if (!ownerExists)
            {
                return Results.BadRequest(new { error = "Owner role does not exist." });
            }

            var name = (request.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name) || name.Length > 200)
            {
                return Results.BadRequest(new { error = "Name is required and must be <= 200 chars." });
            }

            var description = NormalizeNullable(request.Description, 2000);
            if (request.Description is not null && description is null)
            {
                return Results.BadRequest(new { error = "Description is too long." });
            }

            var category = NormalizeNullable(request.Category, 64);
            if (request.Category is not null && category is null)
            {
                return Results.BadRequest(new { error = "Category is too long." });
            }

            var now = DateTimeOffset.UtcNow;
            var eventGroup = new CalendarEventGroup
            {
                Id = Guid.NewGuid(),
                CalendarId = calendarId,
                OwnerRoleId = request.OwnerRoleId,
                Name = name,
                Description = description,
                Category = category,
                CreatedByUserId = access.Context.User.UserId,
                CreatedUtc = now,
                UpdatedUtc = now,
                IsArchived = false
            };
            dbContext.CalendarEventGroups.Add(eventGroup);

            var trackedCalendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(entry => entry.Id == calendarId, ct);
            if (trackedCalendar is not null)
            {
                trackedCalendar.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventGroupCreated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { calendarId, eventGroupId = eventGroup.Id, eventGroup.Name }),
                ct);

            return Results.Ok(ToEventGroupResponse(eventGroup, 0));
        });

        auth.MapPatch("/event-groups/{eventGroupId:guid}", async (
            Guid eventGroupId,
            CalendarEventGroupUpdateRequest request,
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

            var eventGroup = await dbContext.CalendarEventGroups.FirstOrDefaultAsync(entry => entry.Id == eventGroupId, ct);
            if (eventGroup is null)
            {
                return Results.NotFound();
            }

            var access = await ResolveCalendarAccessAsync(eventGroup.CalendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            var changed = false;
            if (request.Name is not null)
            {
                var name = request.Name.Trim();
                if (string.IsNullOrWhiteSpace(name) || name.Length > 200)
                {
                    return Results.BadRequest(new { error = "Name must be <= 200 chars." });
                }

                if (!string.Equals(eventGroup.Name, name, StringComparison.Ordinal))
                {
                    eventGroup.Name = name;
                    changed = true;
                }
            }

            if (request.Description is not null)
            {
                var description = NormalizeNullable(request.Description, 2000);
                if (description is null)
                {
                    return Results.BadRequest(new { error = "Description is too long." });
                }

                if (!string.Equals(eventGroup.Description, description, StringComparison.Ordinal))
                {
                    eventGroup.Description = description;
                    changed = true;
                }
            }

            if (request.Category is not null)
            {
                var category = NormalizeNullable(request.Category, 64);
                if (category is null)
                {
                    return Results.BadRequest(new { error = "Category is too long." });
                }

                if (!string.Equals(eventGroup.Category, category, StringComparison.Ordinal))
                {
                    eventGroup.Category = category;
                    changed = true;
                }
            }

            if (request.IsArchived is not null && eventGroup.IsArchived != request.IsArchived.Value)
            {
                eventGroup.IsArchived = request.IsArchived.Value;
                changed = true;
            }

            if (!changed)
            {
                var itemCount = await dbContext.CalendarEvents.AsNoTracking()
                    .CountAsync(entry => entry.EventGroupId == eventGroupId && !entry.IsArchived, ct);
                return Results.Ok(ToEventGroupResponse(eventGroup, itemCount));
            }

            eventGroup.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventGroupUpdated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventGroupId, eventGroup.Name, eventGroup.IsArchived }),
                ct);

            var count = await dbContext.CalendarEvents.AsNoTracking()
                .CountAsync(entry => entry.EventGroupId == eventGroupId && !entry.IsArchived, ct);
            return Results.Ok(ToEventGroupResponse(eventGroup, count));
        });

        auth.MapPost("/event-groups/{eventGroupId:guid}/series/weekly", async (
            Guid eventGroupId,
            CalendarWeeklySeriesCreateRequest request,
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

            var eventGroup = await dbContext.CalendarEventGroups.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == eventGroupId && !entry.IsArchived, ct);
            if (eventGroup is null)
            {
                return Results.NotFound();
            }

            var access = await ResolveCalendarAccessAsync(eventGroup.CalendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            if (request.OwnerRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "OwnerRoleId is required." });
            }

            if (!access.Context.User.WriteRoleIds.Contains(request.OwnerRoleId) &&
                !access.Context.User.OwnerRoleIds.Contains(request.OwnerRoleId))
            {
                return Results.Forbid();
            }

            var visibility = NormalizeVisibility(request.Visibility);
            if (visibility is null)
            {
                return Results.BadRequest(new { error = "Visibility is invalid." });
            }

            var title = (request.TitlePublic ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(title) || title.Length > 200)
            {
                return Results.BadRequest(new { error = "Title is required and must be <= 200 chars." });
            }

            var summary = NormalizeNullable(request.SummaryPublic, 2000);
            if (request.SummaryPublic is not null && summary is null)
            {
                return Results.BadRequest(new { error = "Summary is too long." });
            }

            var location = NormalizeNullable(request.LocationPublic, 320);
            if (request.LocationPublic is not null && location is null)
            {
                return Results.BadRequest(new { error = "Location is too long." });
            }

            if (request.FirstEndUtc <= request.FirstStartUtc)
            {
                return Results.BadRequest(new { error = "FirstEndUtc must be after FirstStartUtc." });
            }

            if (request.UntilUtc < request.FirstStartUtc)
            {
                return Results.BadRequest(new { error = "UntilUtc must be >= FirstStartUtc." });
            }

            var intervalWeeks = request.IntervalWeeks <= 0 ? 1 : Math.Clamp(request.IntervalWeeks, 1, 52);
            var participantRoleIds = (request.ScopedRoleIds ?? Array.Empty<Guid>())
                .Where(roleId => roleId != Guid.Empty)
                .Append(request.OwnerRoleId)
                .Distinct()
                .ToList();
            var normalizedViewerScopes = NormalizeViewerScopeRequests(request.ViewerScopes);
            if (normalizedViewerScopes.Error is not null)
            {
                return normalizedViewerScopes.Error;
            }

            var roleIdsToValidate = participantRoleIds
                .Concat(normalizedViewerScopes.Viewers.Select(viewer => viewer.RoleId))
                .Distinct()
                .ToList();
            var existingRoles = await dbContext.Roles.AsNoTracking()
                .Where(role => roleIdsToValidate.Contains(role.Id))
                .Select(role => role.Id)
                .ToListAsync(ct);
            if (existingRoles.Count != roleIdsToValidate.Count)
            {
                return Results.BadRequest(new { error = "One or more roles do not exist." });
            }

            CalendarScheduleGraph? linkedGraph = null;
            if (request.GraphId is not null)
            {
                if (request.GraphId == Guid.Empty)
                {
                    return Results.BadRequest(new { error = "GraphId cannot be empty GUID." });
                }

                linkedGraph = await dbContext.CalendarScheduleGraphs.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == request.GraphId.Value && entry.Status != "archived", ct);
                if (linkedGraph is null)
                {
                    return Results.BadRequest(new { error = "Graph does not exist or is archived." });
                }

                var sourceEvent = await dbContext.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == linkedGraph.EventId, ct);
                if (sourceEvent is null || sourceEvent.CalendarId != eventGroup.CalendarId)
                {
                    return Results.BadRequest(new { error = "Graph must belong to the same calendar." });
                }
            }

            var now = DateTimeOffset.UtcNow;
            var currentStart = request.FirstStartUtc;
            var duration = request.FirstEndUtc - request.FirstStartUtc;
            var createdIds = new List<Guid>();
            var occurrenceLimit = 520;
            var participantScopeSet = participantRoleIds.ToHashSet();

            while (currentStart <= request.UntilUtc && createdIds.Count < occurrenceLimit)
            {
                var currentEnd = currentStart + duration;
                var conflicts = await FindConflictsAsync(
                    dbContext,
                    eventGroup.CalendarId,
                    currentStart,
                    currentEnd,
                    participantRoleIds,
                    ignoreEventId: null,
                    ct);
                if (!request.AllowConflicts && conflicts.Count > 0)
                {
                    return Results.Conflict(new CalendarEventsQueryResponse("list", currentStart, currentEnd, Array.Empty<CalendarEventOccurrenceResponse>(), conflicts));
                }

                var item = new CalendarEvent
                {
                    Id = Guid.NewGuid(),
                    CalendarId = eventGroup.CalendarId,
                    EventGroupId = eventGroupId,
                    OwnerRoleId = request.OwnerRoleId,
                    TitlePublic = title,
                    SummaryPublic = summary,
                    LocationPublic = location,
                    Visibility = visibility,
                    Status = "planned",
                    ItemType = "appointment",
                    StartUtc = currentStart,
                    EndUtc = currentEnd,
                    AllDay = false,
                    TimeZoneId = null,
                    RecurrenceType = "none",
                    RecurrenceInterval = 1,
                    RecurrenceByWeekday = null,
                    RecurrenceUntilUtc = null,
                    RecurrenceCount = null,
                    RecurrenceRule = null,
                    TaskState = null,
                    CompletedUtc = null,
                    TaskProgressPercent = null,
                    RequiresCompletionProof = false,
                    CompletionProofDataItemId = null,
                    AssigneeRoleId = null,
                    ProtectedDataItemId = null,
                    LinkedModule = null,
                    LinkedEntityType = null,
                    LinkedEntityId = null,
                    SourceFieldStart = null,
                    SourceFieldEnd = null,
                    ConflictScopeMode = "role",
                    CreatedByUserId = access.Context.User.UserId,
                    UpdatedByUserId = access.Context.User.UserId,
                    CreatedUtc = now,
                    UpdatedUtc = now,
                    CancelledUtc = null,
                    IsArchived = false
                };
                dbContext.CalendarEvents.Add(item);
                createdIds.Add(item.Id);

                dbContext.CalendarEventRoleScopes.AddRange(participantRoleIds.Select(roleId => new CalendarEventRoleScope
                {
                    Id = Guid.NewGuid(),
                    EventId = item.Id,
                    RoleId = roleId,
                    ScopeType = roleId == request.OwnerRoleId ? "owner" : "participant",
                    ViewerCanSeeTitle = true,
                    ViewerCanSeeGraph = false,
                    CreatedUtc = now,
                    RevokedUtc = null
                }));
                dbContext.CalendarEventRoleScopes.AddRange(normalizedViewerScopes.Viewers
                    .Where(viewer => !participantScopeSet.Contains(viewer.RoleId))
                    .Select(viewer => new CalendarEventRoleScope
                    {
                        Id = Guid.NewGuid(),
                        EventId = item.Id,
                        RoleId = viewer.RoleId,
                        ScopeType = "viewer",
                        ViewerCanSeeTitle = viewer.CanSeeTitle,
                        ViewerCanSeeGraph = viewer.CanSeeGraph,
                        CreatedUtc = now,
                        RevokedUtc = null
                    }));

                if (linkedGraph is not null)
                {
                    dbContext.CalendarEventGraphLinks.Add(new CalendarEventGraphLink
                    {
                        Id = Guid.NewGuid(),
                        EventId = item.Id,
                        GraphId = linkedGraph.Id,
                        IsPrimary = true,
                        CreatedByUserId = access.Context.User.UserId,
                        CreatedUtc = now,
                        RevokedUtc = null
                    });
                }

                currentStart = currentStart.AddDays(intervalWeeks * 7);
            }

            if (createdIds.Count == 0)
            {
                return Results.BadRequest(new { error = "No occurrences were created." });
            }

            var trackedCalendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(entry => entry.Id == eventGroup.CalendarId, ct);
            if (trackedCalendar is not null)
            {
                trackedCalendar.UpdatedUtc = now;
            }

            var trackedGroup = await dbContext.CalendarEventGroups.FirstOrDefaultAsync(entry => entry.Id == eventGroupId, ct);
            if (trackedGroup is not null)
            {
                trackedGroup.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventSeriesCreated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    eventGroupId,
                    createdCount = createdIds.Count,
                    intervalWeeks,
                    request.OwnerRoleId,
                    linkedGraphId = linkedGraph?.Id
                }),
                ct);

            return Results.Ok(new
            {
                eventGroupId,
                createdCount = createdIds.Count,
                eventIds = createdIds
            });
        });

        auth.MapPost("/event-groups/{eventGroupId:guid}/shares", async (
            Guid eventGroupId,
            CalendarEventGroupShareCreateRequest request,
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

            var eventGroup = await dbContext.CalendarEventGroups.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == eventGroupId, ct);
            if (eventGroup is null)
            {
                return Results.NotFound();
            }

            var access = await ResolveCalendarAccessAsync(eventGroup.CalendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var label = string.IsNullOrWhiteSpace(request.Label) ? "group-shared-view" : request.Label.Trim();
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

            var activeLinks = await dbContext.CalendarEventGroupShareLinks
                .Where(entry => entry.EventGroupId == eventGroupId && entry.IsActive && entry.RevokedUtc == null)
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
                OwnerRoleId = eventGroup.OwnerRoleId,
                ViewRoleId = viewRoleId,
                EncViewRoleKey = encViewRoleKey,
                SharedViewSecretHash = secretHash,
                CreatedUtc = now,
                RevokedUtc = null
            });

            var link = new CalendarEventGroupShareLink
            {
                Id = Guid.NewGuid(),
                EventGroupId = eventGroupId,
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
            dbContext.CalendarEventGroupShareLinks.Add(link);

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventGroupSharedViewCreated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventGroupId, linkId = link.Id, link.SharedViewId, link.ExpiresUtc, link.Mode }),
                ct);
            await ledgerService.AppendKeyAsync(
                "CalendarEventGroupSharedViewKeyCreated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventGroupId, sharedViewId, viewRoleId }),
                ct);

            return Results.Ok(new CalendarEventGroupShareResponse(
                link.Id,
                shareCode,
                link.Label,
                link.Mode,
                link.CreatedUtc,
                link.ExpiresUtc,
                link.IsActive,
                link.SharedViewId));
        });

        auth.MapGet("/event-groups/{eventGroupId:guid}/shares", async (
            Guid eventGroupId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            var eventGroup = await dbContext.CalendarEventGroups.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == eventGroupId, ct);
            if (eventGroup is null)
            {
                return Results.NotFound();
            }

            var access = await ResolveCalendarAccessAsync(eventGroup.CalendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            var links = await dbContext.CalendarEventGroupShareLinks.AsNoTracking()
                .Where(entry => entry.EventGroupId == eventGroupId)
                .OrderByDescending(entry => entry.CreatedUtc)
                .ToListAsync(ct);

            return Results.Ok(links.Select(link => new CalendarEventGroupShareResponse(
                link.Id,
                string.Empty,
                link.Label,
                link.Mode,
                link.CreatedUtc,
                link.ExpiresUtc,
                link.IsActive,
                link.SharedViewId)).ToList());
        });

        auth.MapDelete("/event-groups/{eventGroupId:guid}/shares/{linkId:guid}", async (
            Guid eventGroupId,
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

            var eventGroup = await dbContext.CalendarEventGroups.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == eventGroupId, ct);
            if (eventGroup is null)
            {
                return Results.NotFound();
            }

            var access = await ResolveCalendarAccessAsync(eventGroup.CalendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var link = await dbContext.CalendarEventGroupShareLinks
                .FirstOrDefaultAsync(entry => entry.EventGroupId == eventGroupId && entry.Id == linkId, ct);
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
                "CalendarEventGroupSharedViewRevoked",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventGroupId, linkId, link.SharedViewId }),
                ct);

            return Results.Ok(new { revoked = true });
        });

        group.MapGet("/public/group-shared/{code}", async (
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

            var activeLinks = await dbContext.CalendarEventGroupShareLinks
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

            CalendarEventGroupShareLink? matchedLink = null;
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

            var eventGroup = await dbContext.CalendarEventGroups.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == matchedLink.EventGroupId && !entry.IsArchived, ct);
            if (eventGroup is null)
            {
                return Results.NotFound();
            }

            var items = await dbContext.CalendarEvents.AsNoTracking()
                .Where(entry => entry.EventGroupId == eventGroup.Id && !entry.IsArchived)
                .OrderBy(entry => entry.StartUtc)
                .Take(2000)
                .ToListAsync(ct);

            var tracked = await dbContext.CalendarEventGroupShareLinks.FirstOrDefaultAsync(entry => entry.Id == matchedLink.Id, ct);
            if (tracked is not null)
            {
                tracked.LastUsedUtc = now;
                await dbContext.SaveChangesAsync(ct);
            }

            return Results.Ok(new CalendarPublicGroupResponse(
                eventGroup.Id,
                eventGroup.CalendarId,
                eventGroup.Name,
                eventGroup.Description,
                eventGroup.Category,
                eventGroup.CreatedUtc,
                eventGroup.UpdatedUtc,
                items.Select(ToPublicResponse).ToList()));
        });
    }

    private static CalendarEventGroupResponse ToEventGroupResponse(CalendarEventGroup group, int itemCount)
    {
        return new CalendarEventGroupResponse(
            group.Id,
            group.CalendarId,
            group.OwnerRoleId,
            group.Name,
            group.Description,
            group.Category,
            group.IsArchived,
            group.CreatedUtc,
            group.UpdatedUtc,
            itemCount);
    }
}
