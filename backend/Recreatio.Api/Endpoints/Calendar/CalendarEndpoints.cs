using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Calendar;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Calendar;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class CalendarEndpoints
{
    private static readonly HashSet<string> AllowedAccessTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "viewer",
        "editor",
        "manager"
    };

    private static readonly HashSet<string> AllowedVisibility = new(StringComparer.OrdinalIgnoreCase)
    {
        "private",
        "role",
        "public"
    };

    private static readonly HashSet<string> AllowedStatus = new(StringComparer.OrdinalIgnoreCase)
    {
        "planned",
        "confirmed",
        "cancelled",
        "completed"
    };

    private static readonly HashSet<string> AllowedRecurrenceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "none",
        "daily",
        "weekly",
        "monthly",
        "custom"
    };

    private static readonly HashSet<string> AllowedReminderChannels = new(StringComparer.OrdinalIgnoreCase)
    {
        "inapp",
        "email",
        "sms",
        "push",
        "webhook"
    };

    private static readonly HashSet<string> AllowedConflictScopeModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "role",
        "calendar"
    };

    private const int MaxCalendarNameLength = 200;
    private const int MaxCalendarDescriptionLength = 2000;
    private const int MaxCalendarSlugLength = 120;
    private const int MaxOrganizationScopeLength = 128;
    private const int MaxTimeZoneLength = 64;
    private const int MaxTitleLength = 200;
    private const int MaxSummaryLength = 2000;
    private const int MaxLocationLength = 320;
    private const int MaxRecurrenceRuleLength = 512;
    private const int MaxLinkedModuleLength = 64;
    private const int MaxLinkedEntityTypeLength = 64;
    private const int MaxSourceFieldLength = 64;
    private const int MaxShareLabelLength = 120;
    private const int MaxOccurrencePerEvent = 512;
    private const string CalendarProtectedItemName = "calendar-protected";
    private const string CalendarProtectedItemType = "calendar-event-protected";

    public static void MapCalendarEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/calendar");
        var auth = group.MapGroup(string.Empty).RequireAuthorization();

        auth.MapGet("/calendars", async (
            string? organizationScope,
            bool? includeArchived,
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
            var roleIds = resolvedUser.ReadRoleIds;
            if (roleIds.Count == 0)
            {
                return Results.Ok(Array.Empty<CalendarResponse>());
            }

            var normalizedOrganization = NormalizeNullable(organizationScope, MaxOrganizationScopeLength);
            if (organizationScope is not null && normalizedOrganization is null)
            {
                return Results.BadRequest(new { error = "Organization scope is too long." });
            }

            var calendarsQuery = dbContext.CalendarContainers.AsNoTracking();
            if (!(includeArchived ?? false))
            {
                calendarsQuery = calendarsQuery.Where(calendar => !calendar.IsArchived);
            }

            if (normalizedOrganization is not null)
            {
                calendarsQuery = calendarsQuery.Where(calendar => calendar.OrganizationScope == normalizedOrganization);
            }

            var accessibleByOwner = await calendarsQuery
                .Where(calendar => roleIds.Contains(calendar.OwnerRoleId))
                .ToListAsync(ct);

            var accessibleByBindingIds = await dbContext.CalendarRoleBindings.AsNoTracking()
                .Where(binding =>
                    binding.RevokedUtc == null &&
                    roleIds.Contains(binding.RoleId))
                .Select(binding => binding.CalendarId)
                .Distinct()
                .ToListAsync(ct);

            var accessibleByBinding = accessibleByBindingIds.Count == 0
                ? new List<CalendarContainer>()
                : await calendarsQuery
                    .Where(calendar => accessibleByBindingIds.Contains(calendar.Id))
                    .ToListAsync(ct);

            var merged = accessibleByOwner
                .Concat(accessibleByBinding)
                .GroupBy(calendar => calendar.Id)
                .Select(grouping => grouping.First())
                .OrderByDescending(calendar => calendar.UpdatedUtc)
                .ToList();

            var mergedIds = merged.Select(calendar => calendar.Id).ToList();
            var allBindings = mergedIds.Count == 0
                ? new List<CalendarRoleBinding>()
                : await dbContext.CalendarRoleBindings.AsNoTracking()
                    .Where(binding => mergedIds.Contains(binding.CalendarId))
                    .OrderBy(binding => binding.CreatedUtc)
                    .ToListAsync(ct);

            var bindingsByCalendar = allBindings
                .GroupBy(binding => binding.CalendarId)
                .ToDictionary(grouping => grouping.Key, grouping => grouping.ToList());

            var response = merged
                .Select(calendar => BuildCalendarResponse(
                    calendar,
                    bindingsByCalendar.GetValueOrDefault(calendar.Id, new List<CalendarRoleBinding>()),
                    resolvedUser))
                .ToList();

            return Results.Ok(response);
        });

        auth.MapPost("/calendars", async (
            CalendarCreateRequest request,
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

            var (userContext, error) = await TryBuildUserContextAsync(context, keyRingService, ct);
            if (error is not null)
            {
                return error;
            }

            var resolvedUser = userContext!;

            if (request.OwnerRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "OwnerRoleId is required." });
            }

            if (!resolvedUser.OwnerRoleIds.Contains(request.OwnerRoleId))
            {
                return Results.Forbid();
            }

            var ownerRoleExists = await dbContext.Roles.AsNoTracking().AnyAsync(role => role.Id == request.OwnerRoleId, ct);
            if (!ownerRoleExists)
            {
                return Results.BadRequest(new { error = "Owner role does not exist." });
            }

            var name = (request.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Calendar name is required." });
            }

            if (name.Length > MaxCalendarNameLength)
            {
                return Results.BadRequest(new { error = "Calendar name is too long." });
            }

            var description = NormalizeNullable(request.Description, MaxCalendarDescriptionLength);
            if (request.Description is not null && description is null)
            {
                return Results.BadRequest(new { error = "Description is too long." });
            }

            var slug = NormalizeNullable(request.Slug, MaxCalendarSlugLength)?.ToLowerInvariant();
            if (request.Slug is not null && slug is null)
            {
                return Results.BadRequest(new { error = "Slug is too long." });
            }

            if (!string.IsNullOrWhiteSpace(slug))
            {
                var slugExists = await dbContext.CalendarContainers.AsNoTracking()
                    .AnyAsync(calendar => calendar.Slug == slug, ct);
                if (slugExists)
                {
                    return Results.Conflict(new { error = "Calendar slug already exists." });
                }
            }

            var organizationScope = NormalizeNullable(request.OrganizationScope, MaxOrganizationScopeLength);
            if (request.OrganizationScope is not null && organizationScope is null)
            {
                return Results.BadRequest(new { error = "Organization scope is too long." });
            }

            var defaultTimeZone = NormalizeNullable(request.DefaultTimeZoneId, MaxTimeZoneLength);
            if (request.DefaultTimeZoneId is not null && defaultTimeZone is null)
            {
                return Results.BadRequest(new { error = "Default time zone is too long." });
            }

            var normalizedBindings = new List<CalendarRoleBindingRequest>();
            foreach (var binding in request.RoleBindings ?? Array.Empty<CalendarRoleBindingRequest>())
            {
                if (binding.RoleId == Guid.Empty)
                {
                    return Results.BadRequest(new { error = "Role binding RoleId is required." });
                }

                var accessType = NormalizeAccessType(binding.AccessType);
                if (accessType is null)
                {
                    return Results.BadRequest(new { error = "Role binding access type is invalid." });
                }

                normalizedBindings.Add(binding with { AccessType = accessType });
            }

            normalizedBindings.Add(new CalendarRoleBindingRequest(request.OwnerRoleId, "manager"));

            var requestedRoles = normalizedBindings.Select(binding => binding.RoleId).Distinct().ToList();
            if (requestedRoles.Count > 0)
            {
                var existingRoles = await dbContext.Roles.AsNoTracking()
                    .Where(role => requestedRoles.Contains(role.Id))
                    .Select(role => role.Id)
                    .ToListAsync(ct);
                if (existingRoles.Count != requestedRoles.Count)
                {
                    return Results.BadRequest(new { error = "One or more role bindings target a missing role." });
                }
            }

            var now = DateTimeOffset.UtcNow;
            var calendar = new CalendarContainer
            {
                Id = Guid.NewGuid(),
                Slug = slug,
                Name = name,
                Description = description,
                OrganizationScope = organizationScope,
                OwnerRoleId = request.OwnerRoleId,
                CreatedByUserId = resolvedUser.UserId,
                DefaultTimeZoneId = defaultTimeZone,
                IsArchived = false,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            var bindings = normalizedBindings
                .GroupBy(binding => binding.RoleId)
                .Select(grouping =>
                {
                    var manager = grouping.Any(item => item.AccessType.Equals("manager", StringComparison.OrdinalIgnoreCase));
                    var editor = manager || grouping.Any(item => item.AccessType.Equals("editor", StringComparison.OrdinalIgnoreCase));
                    var accessType = manager ? "manager" : editor ? "editor" : "viewer";
                    return new CalendarRoleBinding
                    {
                        Id = Guid.NewGuid(),
                        CalendarId = calendar.Id,
                        RoleId = grouping.Key,
                        AccessType = accessType,
                        AddedByUserId = resolvedUser.UserId,
                        CreatedUtc = now,
                        RevokedUtc = null
                    };
                })
                .ToList();

            dbContext.CalendarContainers.Add(calendar);
            dbContext.CalendarRoleBindings.AddRange(bindings);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarCreated",
                resolvedUser.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    calendarId = calendar.Id,
                    calendar.OwnerRoleId,
                    calendar.OrganizationScope,
                    roleBindingCount = bindings.Count
                }),
                ct);

            var response = BuildCalendarResponse(calendar, bindings, resolvedUser);
            return Results.Ok(response);
        });

        auth.MapPatch("/calendars/{calendarId:guid}", async (
            Guid calendarId,
            CalendarUpdateRequest request,
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

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var calendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(item => item.Id == calendarId, ct);
            if (calendar is null)
            {
                return Results.NotFound();
            }

            var changed = false;
            if (request.Name is not null)
            {
                var name = request.Name.Trim();
                if (string.IsNullOrWhiteSpace(name))
                {
                    return Results.BadRequest(new { error = "Calendar name cannot be empty." });
                }

                if (name.Length > MaxCalendarNameLength)
                {
                    return Results.BadRequest(new { error = "Calendar name is too long." });
                }

                if (!string.Equals(calendar.Name, name, StringComparison.Ordinal))
                {
                    calendar.Name = name;
                    changed = true;
                }
            }

            if (request.Description is not null)
            {
                var description = NormalizeNullable(request.Description, MaxCalendarDescriptionLength);
                if (description is null)
                {
                    return Results.BadRequest(new { error = "Description is too long." });
                }

                if (!string.Equals(calendar.Description, description, StringComparison.Ordinal))
                {
                    calendar.Description = description;
                    changed = true;
                }
            }

            if (request.DefaultTimeZoneId is not null)
            {
                var timeZone = NormalizeNullable(request.DefaultTimeZoneId, MaxTimeZoneLength);
                if (timeZone is null)
                {
                    return Results.BadRequest(new { error = "Default time zone is too long." });
                }

                if (!string.Equals(calendar.DefaultTimeZoneId, timeZone, StringComparison.Ordinal))
                {
                    calendar.DefaultTimeZoneId = timeZone;
                    changed = true;
                }
            }

            if (request.IsArchived is not null && calendar.IsArchived != request.IsArchived.Value)
            {
                calendar.IsArchived = request.IsArchived.Value;
                changed = true;
            }

            if (!changed)
            {
                var existingBindings = await dbContext.CalendarRoleBindings.AsNoTracking()
                    .Where(binding => binding.CalendarId == calendarId)
                    .ToListAsync(ct);
                return Results.Ok(BuildCalendarResponse(calendar, existingBindings, access.Context.User));
            }

            calendar.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarUpdated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    calendarId,
                    calendar.IsArchived,
                    calendar.Name
                }),
                ct);

            var bindings = await dbContext.CalendarRoleBindings.AsNoTracking()
                .Where(binding => binding.CalendarId == calendarId)
                .ToListAsync(ct);
            return Results.Ok(BuildCalendarResponse(calendar, bindings, access.Context.User));
        });

        auth.MapPost("/calendars/{calendarId:guid}/roles", async (
            Guid calendarId,
            CalendarRoleBindingRequest request,
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

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            if (request.RoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "RoleId is required." });
            }

            var accessType = NormalizeAccessType(request.AccessType);
            if (accessType is null)
            {
                return Results.BadRequest(new { error = "AccessType is invalid." });
            }

            var roleExists = await dbContext.Roles.AsNoTracking().AnyAsync(role => role.Id == request.RoleId, ct);
            if (!roleExists)
            {
                return Results.BadRequest(new { error = "Role does not exist." });
            }

            var existing = await dbContext.CalendarRoleBindings
                .FirstOrDefaultAsync(binding => binding.CalendarId == calendarId && binding.RoleId == request.RoleId && binding.RevokedUtc == null, ct);
            if (existing is null)
            {
                dbContext.CalendarRoleBindings.Add(new CalendarRoleBinding
                {
                    Id = Guid.NewGuid(),
                    CalendarId = calendarId,
                    RoleId = request.RoleId,
                    AccessType = accessType,
                    AddedByUserId = access.Context.User.UserId,
                    CreatedUtc = DateTimeOffset.UtcNow,
                    RevokedUtc = null
                });
            }
            else
            {
                existing.AccessType = accessType;
            }

            var calendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(item => item.Id == calendarId, ct);
            if (calendar is not null)
            {
                calendar.UpdatedUtc = DateTimeOffset.UtcNow;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarRoleBound",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { calendarId, roleId = request.RoleId, accessType }),
                ct);

            var bindings = await dbContext.CalendarRoleBindings.AsNoTracking()
                .Where(binding => binding.CalendarId == calendarId)
                .ToListAsync(ct);

            return Results.Ok(bindings.Where(binding => binding.RevokedUtc == null).Select(ToRoleBindingResponse).ToList());
        });

        auth.MapDelete("/calendars/{calendarId:guid}/roles/{roleId:guid}", async (
            Guid calendarId,
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

            var access = await ResolveCalendarAccessAsync(calendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanManage)
            {
                return Results.Forbid();
            }

            var binding = await dbContext.CalendarRoleBindings
                .FirstOrDefaultAsync(item => item.CalendarId == calendarId && item.RoleId == roleId && item.RevokedUtc == null, ct);
            if (binding is null)
            {
                return Results.NotFound();
            }

            binding.RevokedUtc = DateTimeOffset.UtcNow;
            var calendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(item => item.Id == calendarId, ct);
            if (calendar is not null)
            {
                calendar.UpdatedUtc = DateTimeOffset.UtcNow;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarRoleUnbound",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { calendarId, roleId }),
                ct);

            var bindings = await dbContext.CalendarRoleBindings.AsNoTracking()
                .Where(item => item.CalendarId == calendarId)
                .ToListAsync(ct);

            return Results.Ok(bindings.Where(item => item.RevokedUtc == null).Select(ToRoleBindingResponse).ToList());
        });

        auth.MapGet("/events/{eventId:guid}", async (
            Guid eventId,
            bool? includeProtected,
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

            var response = await BuildEventResponseAsync(
                access.Context!.Event,
                access.Context.User,
                dbContext,
                keyRingService,
                includeProtected ?? false,
                ct);
            return Results.Ok(response);
        });

        auth.MapPost("/events", async (
            CalendarEventCreateRequest request,
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

            var calendarAccess = await ResolveCalendarAccessAsync(request.CalendarId, context, dbContext, keyRingService, ct);
            if (calendarAccess.Error is not null)
            {
                return calendarAccess.Error;
            }

            if (!calendarAccess.Context!.CanWrite)
            {
                return Results.Forbid();
            }

            var userContext = calendarAccess.Context.User;
            if (request.OwnerRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "OwnerRoleId is required." });
            }

            if (!userContext.WriteRoleIds.Contains(request.OwnerRoleId) && !userContext.OwnerRoleIds.Contains(request.OwnerRoleId))
            {
                return Results.Forbid();
            }

            var title = (request.TitlePublic ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                return Results.BadRequest(new { error = "TitlePublic is required." });
            }

            if (title.Length > MaxTitleLength)
            {
                return Results.BadRequest(new { error = "TitlePublic is too long." });
            }

            var summary = NormalizeNullable(request.SummaryPublic, MaxSummaryLength);
            if (request.SummaryPublic is not null && summary is null)
            {
                return Results.BadRequest(new { error = "SummaryPublic is too long." });
            }

            var location = NormalizeNullable(request.LocationPublic, MaxLocationLength);
            if (request.LocationPublic is not null && location is null)
            {
                return Results.BadRequest(new { error = "LocationPublic is too long." });
            }

            var visibility = NormalizeVisibility(request.Visibility);
            if (visibility is null)
            {
                return Results.BadRequest(new { error = "Visibility is invalid." });
            }

            var status = NormalizeStatus(request.Status);
            if (status is null)
            {
                return Results.BadRequest(new { error = "Status is invalid." });
            }

            if (request.EndUtc <= request.StartUtc)
            {
                return Results.BadRequest(new { error = "EndUtc must be after StartUtc." });
            }

            var recurrenceType = NormalizeRecurrenceType(request.RecurrenceType);
            if (recurrenceType is null)
            {
                return Results.BadRequest(new { error = "RecurrenceType is invalid." });
            }

            var recurrenceInterval = Math.Max(1, request.RecurrenceInterval ?? 1);
            var recurrenceByWeekday = NormalizeNullable(request.RecurrenceByWeekday, 32);
            var recurrenceRule = NormalizeNullable(request.RecurrenceRule, MaxRecurrenceRuleLength);
            if (request.RecurrenceRule is not null && recurrenceRule is null)
            {
                return Results.BadRequest(new { error = "RecurrenceRule is too long." });
            }

            var linkedModule = NormalizeNullable(request.LinkedModule, MaxLinkedModuleLength)?.ToLowerInvariant();
            if (request.LinkedModule is not null && linkedModule is null)
            {
                return Results.BadRequest(new { error = "LinkedModule is too long." });
            }

            var linkedEntityType = NormalizeNullable(request.LinkedEntityType, MaxLinkedEntityTypeLength);
            if (request.LinkedEntityType is not null && linkedEntityType is null)
            {
                return Results.BadRequest(new { error = "LinkedEntityType is too long." });
            }

            var sourceFieldStart = NormalizeNullable(request.SourceFieldStart, MaxSourceFieldLength);
            if (request.SourceFieldStart is not null && sourceFieldStart is null)
            {
                return Results.BadRequest(new { error = "SourceFieldStart is too long." });
            }

            var sourceFieldEnd = NormalizeNullable(request.SourceFieldEnd, MaxSourceFieldLength);
            if (request.SourceFieldEnd is not null && sourceFieldEnd is null)
            {
                return Results.BadRequest(new { error = "SourceFieldEnd is too long." });
            }

            var timeZoneId = NormalizeNullable(request.TimeZoneId, MaxTimeZoneLength);
            if (request.TimeZoneId is not null && timeZoneId is null)
            {
                return Results.BadRequest(new { error = "TimeZoneId is too long." });
            }

            var conflictScopeMode = NormalizeConflictScopeMode(request.ConflictScopeMode) ?? "role";
            var scopeRoleIds = (request.ScopedRoleIds ?? Array.Empty<Guid>())
                .Where(roleId => roleId != Guid.Empty)
                .Append(request.OwnerRoleId)
                .Distinct()
                .ToList();

            if (scopeRoleIds.Count == 0)
            {
                return Results.BadRequest(new { error = "At least one scoped role is required." });
            }

            var rolesExist = await dbContext.Roles.AsNoTracking()
                .Where(role => scopeRoleIds.Contains(role.Id))
                .Select(role => role.Id)
                .ToListAsync(ct);
            if (rolesExist.Count != scopeRoleIds.Count)
            {
                return Results.BadRequest(new { error = "One or more scoped roles do not exist." });
            }

            var conflicts = await FindConflictsAsync(
                dbContext,
                request.CalendarId,
                request.StartUtc,
                request.EndUtc,
                scopeRoleIds,
                ignoreEventId: null,
                ct);

            if (!request.AllowConflicts && conflicts.Count > 0)
            {
                return Results.Conflict(new CalendarEventsQueryResponse("list", request.StartUtc, request.EndUtc, Array.Empty<CalendarEventOccurrenceResponse>(), conflicts));
            }

            var now = DateTimeOffset.UtcNow;
            var item = new CalendarEvent
            {
                Id = Guid.NewGuid(),
                CalendarId = request.CalendarId,
                OwnerRoleId = request.OwnerRoleId,
                TitlePublic = title,
                SummaryPublic = summary,
                LocationPublic = location,
                Visibility = visibility,
                Status = status,
                StartUtc = request.StartUtc,
                EndUtc = request.EndUtc,
                AllDay = request.AllDay,
                TimeZoneId = timeZoneId,
                RecurrenceType = recurrenceType,
                RecurrenceInterval = recurrenceInterval,
                RecurrenceByWeekday = recurrenceByWeekday,
                RecurrenceUntilUtc = request.RecurrenceUntilUtc,
                RecurrenceCount = request.RecurrenceCount,
                RecurrenceRule = recurrenceRule,
                LinkedModule = linkedModule,
                LinkedEntityType = linkedEntityType,
                LinkedEntityId = request.LinkedEntityId,
                SourceFieldStart = sourceFieldStart,
                SourceFieldEnd = sourceFieldEnd,
                ConflictScopeMode = conflictScopeMode,
                CreatedByUserId = userContext.UserId,
                UpdatedByUserId = userContext.UserId,
                CreatedUtc = now,
                UpdatedUtc = now,
                IsArchived = false,
                CancelledUtc = status == "cancelled" ? now : null
            };

            if (!string.IsNullOrWhiteSpace(request.ProtectedDetailsJson))
            {
                var protectedDataItemId = CreateProtectedDataItem(
                    item.OwnerRoleId,
                    request.ProtectedDetailsJson!.Trim(),
                    userContext,
                    keyRingService,
                    dbContext,
                    now);
                if (protectedDataItemId == Guid.Empty)
                {
                    return Results.Forbid();
                }

                item.ProtectedDataItemId = protectedDataItemId;
            }

            dbContext.CalendarEvents.Add(item);
            dbContext.CalendarEventRoleScopes.AddRange(scopeRoleIds.Select(roleId => new CalendarEventRoleScope
            {
                Id = Guid.NewGuid(),
                EventId = item.Id,
                RoleId = roleId,
                ScopeType = roleId == item.OwnerRoleId ? "owner" : "participant",
                CreatedUtc = now,
                RevokedUtc = null
            }));

            var reminderEntities = NormalizeReminderRequests(request.Reminders);
            if (reminderEntities.Error is not null)
            {
                return reminderEntities.Error;
            }

            dbContext.CalendarEventReminders.AddRange(reminderEntities.Reminders.Select(reminder => new CalendarEventReminder
            {
                Id = Guid.NewGuid(),
                EventId = item.Id,
                MinutesBefore = reminder.MinutesBefore,
                Channel = reminder.Channel,
                TargetRoleId = reminder.TargetRoleId,
                TargetUserId = reminder.TargetUserId,
                Status = "active",
                CreatedUtc = now,
                UpdatedUtc = now
            }));

            var trackedCalendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(calendar => calendar.Id == request.CalendarId, ct);
            if (trackedCalendar is not null)
            {
                trackedCalendar.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventCreated",
                userContext.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    eventId = item.Id,
                    item.CalendarId,
                    item.OwnerRoleId,
                    item.Visibility,
                    item.Status,
                    item.StartUtc,
                    item.EndUtc,
                    conflictCount = conflicts.Count
                }),
                ct);

            if (item.ProtectedDataItemId is not null)
            {
                await ledgerService.AppendKeyAsync(
                    "CalendarEventProtectedDataCreated",
                    userContext.UserId.ToString(),
                    JsonSerializer.Serialize(new { eventId = item.Id, dataItemId = item.ProtectedDataItemId }),
                    ct);
            }

            var response = await BuildEventResponseAsync(item, userContext, dbContext, keyRingService, includeProtected: true, ct);
            return Results.Ok(response);
        });

        auth.MapPatch("/events/{eventId:guid}", async (
            Guid eventId,
            CalendarEventUpdateRequest request,
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

            var userContext = access.Context.User;
            var item = await dbContext.CalendarEvents.FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
            if (item is null)
            {
                return Results.NotFound();
            }

            var changed = false;
            if (request.TitlePublic is not null)
            {
                var title = request.TitlePublic.Trim();
                if (string.IsNullOrWhiteSpace(title))
                {
                    return Results.BadRequest(new { error = "TitlePublic cannot be empty." });
                }

                if (title.Length > MaxTitleLength)
                {
                    return Results.BadRequest(new { error = "TitlePublic is too long." });
                }

                if (!string.Equals(item.TitlePublic, title, StringComparison.Ordinal))
                {
                    item.TitlePublic = title;
                    changed = true;
                }
            }

            if (request.SummaryPublic is not null)
            {
                var summary = NormalizeNullable(request.SummaryPublic, MaxSummaryLength);
                if (summary is null)
                {
                    return Results.BadRequest(new { error = "SummaryPublic is too long." });
                }

                if (!string.Equals(item.SummaryPublic, summary, StringComparison.Ordinal))
                {
                    item.SummaryPublic = summary;
                    changed = true;
                }
            }

            if (request.LocationPublic is not null)
            {
                var location = NormalizeNullable(request.LocationPublic, MaxLocationLength);
                if (location is null)
                {
                    return Results.BadRequest(new { error = "LocationPublic is too long." });
                }

                if (!string.Equals(item.LocationPublic, location, StringComparison.Ordinal))
                {
                    item.LocationPublic = location;
                    changed = true;
                }
            }

            if (request.Visibility is not null)
            {
                var visibility = NormalizeVisibility(request.Visibility);
                if (visibility is null)
                {
                    return Results.BadRequest(new { error = "Visibility is invalid." });
                }

                if (!string.Equals(item.Visibility, visibility, StringComparison.Ordinal))
                {
                    item.Visibility = visibility;
                    changed = true;
                }
            }

            if (request.Status is not null)
            {
                var status = NormalizeStatus(request.Status);
                if (status is null)
                {
                    return Results.BadRequest(new { error = "Status is invalid." });
                }

                if (!string.Equals(item.Status, status, StringComparison.Ordinal))
                {
                    item.Status = status;
                    item.CancelledUtc = status == "cancelled" ? DateTimeOffset.UtcNow : null;
                    changed = true;
                }
            }

            if (request.StartUtc is not null)
            {
                item.StartUtc = request.StartUtc.Value;
                changed = true;
            }

            if (request.EndUtc is not null)
            {
                item.EndUtc = request.EndUtc.Value;
                changed = true;
            }

            if (item.EndUtc <= item.StartUtc)
            {
                return Results.BadRequest(new { error = "EndUtc must be after StartUtc." });
            }

            if (request.AllDay is not null)
            {
                item.AllDay = request.AllDay.Value;
                changed = true;
            }

            if (request.TimeZoneId is not null)
            {
                var timeZone = NormalizeNullable(request.TimeZoneId, MaxTimeZoneLength);
                if (timeZone is null)
                {
                    return Results.BadRequest(new { error = "TimeZoneId is too long." });
                }

                item.TimeZoneId = timeZone;
                changed = true;
            }

            if (request.RecurrenceType is not null)
            {
                var recurrenceType = NormalizeRecurrenceType(request.RecurrenceType);
                if (recurrenceType is null)
                {
                    return Results.BadRequest(new { error = "RecurrenceType is invalid." });
                }

                item.RecurrenceType = recurrenceType;
                changed = true;
            }

            if (request.RecurrenceInterval is not null)
            {
                item.RecurrenceInterval = Math.Max(1, request.RecurrenceInterval.Value);
                changed = true;
            }

            if (request.RecurrenceByWeekday is not null)
            {
                var recurrenceByWeekday = NormalizeNullable(request.RecurrenceByWeekday, 32);
                if (recurrenceByWeekday is null)
                {
                    return Results.BadRequest(new { error = "RecurrenceByWeekday is too long." });
                }

                item.RecurrenceByWeekday = recurrenceByWeekday;
                changed = true;
            }

            if (request.RecurrenceUntilUtc is not null)
            {
                item.RecurrenceUntilUtc = request.RecurrenceUntilUtc;
                changed = true;
            }

            if (request.RecurrenceCount is not null)
            {
                item.RecurrenceCount = request.RecurrenceCount;
                changed = true;
            }

            if (request.RecurrenceRule is not null)
            {
                var recurrenceRule = NormalizeNullable(request.RecurrenceRule, MaxRecurrenceRuleLength);
                if (recurrenceRule is null)
                {
                    return Results.BadRequest(new { error = "RecurrenceRule is too long." });
                }

                item.RecurrenceRule = recurrenceRule;
                changed = true;
            }

            if (request.LinkedModule is not null)
            {
                var linkedModule = NormalizeNullable(request.LinkedModule, MaxLinkedModuleLength)?.ToLowerInvariant();
                if (linkedModule is null)
                {
                    return Results.BadRequest(new { error = "LinkedModule is too long." });
                }

                item.LinkedModule = linkedModule;
                changed = true;
            }

            if (request.LinkedEntityType is not null)
            {
                var linkedEntityType = NormalizeNullable(request.LinkedEntityType, MaxLinkedEntityTypeLength);
                if (linkedEntityType is null)
                {
                    return Results.BadRequest(new { error = "LinkedEntityType is too long." });
                }

                item.LinkedEntityType = linkedEntityType;
                changed = true;
            }

            if (request.LinkedEntityId is not null)
            {
                item.LinkedEntityId = request.LinkedEntityId;
                changed = true;
            }

            if (request.SourceFieldStart is not null)
            {
                var sourceFieldStart = NormalizeNullable(request.SourceFieldStart, MaxSourceFieldLength);
                if (sourceFieldStart is null)
                {
                    return Results.BadRequest(new { error = "SourceFieldStart is too long." });
                }

                item.SourceFieldStart = sourceFieldStart;
                changed = true;
            }

            if (request.SourceFieldEnd is not null)
            {
                var sourceFieldEnd = NormalizeNullable(request.SourceFieldEnd, MaxSourceFieldLength);
                if (sourceFieldEnd is null)
                {
                    return Results.BadRequest(new { error = "SourceFieldEnd is too long." });
                }

                item.SourceFieldEnd = sourceFieldEnd;
                changed = true;
            }

            if (request.ConflictScopeMode is not null)
            {
                var scopeMode = NormalizeConflictScopeMode(request.ConflictScopeMode);
                if (scopeMode is null)
                {
                    return Results.BadRequest(new { error = "ConflictScopeMode is invalid." });
                }

                item.ConflictScopeMode = scopeMode;
                changed = true;
            }

            if (request.IsArchived is not null)
            {
                item.IsArchived = request.IsArchived.Value;
                changed = true;
            }

            if (request.ReplaceProtectedDetails)
            {
                if (string.IsNullOrWhiteSpace(request.ProtectedDetailsJson))
                {
                    item.ProtectedDataItemId = null;
                }
                else
                {
                    var upserted = await UpsertProtectedDataAsync(item, request.ProtectedDetailsJson.Trim(), userContext, keyRingService, dbContext, ct);
                    if (!upserted)
                    {
                        return Results.Forbid();
                    }
                }

                changed = true;
            }

            var updatedScopeRoleIds = new List<Guid>();
            if (request.ReplaceRoleScopes)
            {
                updatedScopeRoleIds = (request.ScopedRoleIds ?? Array.Empty<Guid>())
                    .Where(roleId => roleId != Guid.Empty)
                    .Append(item.OwnerRoleId)
                    .Distinct()
                    .ToList();

                var existingRoles = await dbContext.Roles.AsNoTracking()
                    .Where(role => updatedScopeRoleIds.Contains(role.Id))
                    .Select(role => role.Id)
                    .ToListAsync(ct);
                if (existingRoles.Count != updatedScopeRoleIds.Count)
                {
                    return Results.BadRequest(new { error = "One or more scoped roles do not exist." });
                }

                var currentScopes = await dbContext.CalendarEventRoleScopes
                    .Where(scope => scope.EventId == item.Id && scope.RevokedUtc == null)
                    .ToListAsync(ct);
                foreach (var scope in currentScopes)
                {
                    scope.RevokedUtc = DateTimeOffset.UtcNow;
                }

                dbContext.CalendarEventRoleScopes.AddRange(updatedScopeRoleIds.Select(roleId => new CalendarEventRoleScope
                {
                    Id = Guid.NewGuid(),
                    EventId = item.Id,
                    RoleId = roleId,
                    ScopeType = roleId == item.OwnerRoleId ? "owner" : "participant",
                    CreatedUtc = DateTimeOffset.UtcNow,
                    RevokedUtc = null
                }));
                changed = true;
            }

            if (request.ReplaceReminders)
            {
                var reminders = NormalizeReminderRequests(request.Reminders);
                if (reminders.Error is not null)
                {
                    return reminders.Error;
                }

                var existingReminders = await dbContext.CalendarEventReminders
                    .Where(reminder => reminder.EventId == item.Id)
                    .ToListAsync(ct);
                if (existingReminders.Count > 0)
                {
                    dbContext.CalendarEventReminders.RemoveRange(existingReminders);
                }

                var now = DateTimeOffset.UtcNow;
                dbContext.CalendarEventReminders.AddRange(reminders.Reminders.Select(reminder => new CalendarEventReminder
                {
                    Id = Guid.NewGuid(),
                    EventId = item.Id,
                    MinutesBefore = reminder.MinutesBefore,
                    Channel = reminder.Channel,
                    TargetRoleId = reminder.TargetRoleId,
                    TargetUserId = reminder.TargetUserId,
                    Status = "active",
                    CreatedUtc = now,
                    UpdatedUtc = now
                }));
                changed = true;
            }

            if (!changed)
            {
                var unchangedResponse = await BuildEventResponseAsync(item, userContext, dbContext, keyRingService, includeProtected: true, ct);
                return Results.Ok(unchangedResponse);
            }

            var scopesForConflict = updatedScopeRoleIds;
            if (scopesForConflict.Count == 0)
            {
                scopesForConflict = await dbContext.CalendarEventRoleScopes.AsNoTracking()
                    .Where(scope => scope.EventId == item.Id && scope.RevokedUtc == null)
                    .Select(scope => scope.RoleId)
                    .ToListAsync(ct);
            }

            if (scopesForConflict.Count == 0)
            {
                scopesForConflict.Add(item.OwnerRoleId);
            }

            var conflicts = await FindConflictsAsync(
                dbContext,
                item.CalendarId,
                item.StartUtc,
                item.EndUtc,
                scopesForConflict,
                item.Id,
                ct);
            if (!request.AllowConflicts && conflicts.Count > 0)
            {
                return Results.Conflict(new CalendarEventsQueryResponse("list", item.StartUtc, item.EndUtc, Array.Empty<CalendarEventOccurrenceResponse>(), conflicts));
            }

            item.UpdatedByUserId = userContext.UserId;
            item.UpdatedUtc = DateTimeOffset.UtcNow;

            var trackedCalendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(calendar => calendar.Id == item.CalendarId, ct);
            if (trackedCalendar is not null)
            {
                trackedCalendar.UpdatedUtc = DateTimeOffset.UtcNow;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventUpdated",
                userContext.UserId.ToString(),
                JsonSerializer.Serialize(new
                {
                    eventId = item.Id,
                    item.CalendarId,
                    item.Status,
                    item.Visibility,
                    item.StartUtc,
                    item.EndUtc,
                    conflictCount = conflicts.Count
                }),
                ct);

            var response = await BuildEventResponseAsync(item, userContext, dbContext, keyRingService, includeProtected: true, ct);
            return Results.Ok(response);
        });

        auth.MapDelete("/events/{eventId:guid}", async (
            Guid eventId,
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

            var item = await dbContext.CalendarEvents.FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
            if (item is null)
            {
                return Results.NotFound();
            }

            if (item.IsArchived)
            {
                return Results.Ok(new { archived = true });
            }

            item.IsArchived = true;
            item.Status = "cancelled";
            item.CancelledUtc = DateTimeOffset.UtcNow;
            item.UpdatedByUserId = access.Context.User.UserId;
            item.UpdatedUtc = DateTimeOffset.UtcNow;

            var trackedCalendar = await dbContext.CalendarContainers.FirstOrDefaultAsync(calendar => calendar.Id == item.CalendarId, ct);
            if (trackedCalendar is not null)
            {
                trackedCalendar.UpdatedUtc = DateTimeOffset.UtcNow;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventArchived",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventId = item.Id, item.CalendarId }),
                ct);

            return Results.Ok(new { archived = true });
        });

        auth.MapGet("/calendars/{calendarId:guid}/events", async (
            Guid calendarId,
            string? view,
            DateTimeOffset? fromUtc,
            DateTimeOffset? toUtc,
            string? status,
            string? visibility,
            string? linkedModule,
            Guid? linkedEntityId,
            bool? includeArchived,
            bool? includeProtected,
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

            if (!access.Context!.CanRead)
            {
                return Results.Forbid();
            }

            var range = ResolveRange(view, fromUtc, toUtc);
            var normalizedStatus = NormalizeStatusFilter(status);
            if (status is not null && normalizedStatus is null)
            {
                return Results.BadRequest(new { error = "Status filter is invalid." });
            }

            var normalizedVisibility = NormalizeVisibilityFilter(visibility);
            if (visibility is not null && normalizedVisibility is null)
            {
                return Results.BadRequest(new { error = "Visibility filter is invalid." });
            }

            var normalizedModule = NormalizeNullable(linkedModule, MaxLinkedModuleLength)?.ToLowerInvariant();
            if (linkedModule is not null && normalizedModule is null)
            {
                return Results.BadRequest(new { error = "linkedModule filter is too long." });
            }

            var query = dbContext.CalendarEvents.AsNoTracking()
                .Where(item =>
                    item.CalendarId == calendarId &&
                    item.StartUtc < range.ToUtc &&
                    (item.EndUtc > range.FromUtc || item.RecurrenceType != "none"));

            if (!(includeArchived ?? false))
            {
                query = query.Where(item => !item.IsArchived);
            }

            if (!string.IsNullOrWhiteSpace(normalizedStatus))
            {
                query = query.Where(item => item.Status == normalizedStatus);
            }

            if (!string.IsNullOrWhiteSpace(normalizedVisibility))
            {
                query = query.Where(item => item.Visibility == normalizedVisibility);
            }

            if (!string.IsNullOrWhiteSpace(normalizedModule))
            {
                query = query.Where(item => item.LinkedModule == normalizedModule);
            }

            if (linkedEntityId is not null && linkedEntityId != Guid.Empty)
            {
                query = query.Where(item => item.LinkedEntityId == linkedEntityId);
            }

            var items = await query
                .OrderBy(item => item.StartUtc)
                .Take(1000)
                .ToListAsync(ct);

            if (items.Count == 0)
            {
                return Results.Ok(new CalendarEventsQueryResponse(range.View, range.FromUtc, range.ToUtc, Array.Empty<CalendarEventOccurrenceResponse>(), Array.Empty<CalendarConflictResponse>()));
            }

            var eventIds = items.Select(item => item.Id).ToList();
            var scopes = await dbContext.CalendarEventRoleScopes.AsNoTracking()
                .Where(scope => eventIds.Contains(scope.EventId) && scope.RevokedUtc == null)
                .ToListAsync(ct);
            var scopeByEvent = scopes.GroupBy(scope => scope.EventId)
                .ToDictionary(grouping => grouping.Key, grouping => grouping.Select(scope => scope.RoleId).ToHashSet());

            var visibleItems = items.Where(item =>
                CanReadEventByVisibility(
                    item,
                    scopeByEvent.GetValueOrDefault(item.Id, new HashSet<Guid>()),
                    access.Context.User.ReadRoleIds)).ToList();
            if (visibleItems.Count == 0)
            {
                return Results.Ok(new CalendarEventsQueryResponse(range.View, range.FromUtc, range.ToUtc, Array.Empty<CalendarEventOccurrenceResponse>(), Array.Empty<CalendarConflictResponse>()));
            }

            var responses = new List<CalendarEventOccurrenceResponse>();
            foreach (var item in visibleItems)
            {
                var eventResponse = await BuildEventResponseAsync(item, access.Context.User, dbContext, keyRingService, includeProtected ?? false, ct);
                var occurrences = ExpandOccurrences(item, range.FromUtc, range.ToUtc);
                foreach (var occurrence in occurrences)
                {
                    responses.Add(new CalendarEventOccurrenceResponse(
                        item.Id,
                        occurrence.StartUtc,
                        occurrence.EndUtc,
                        occurrence.IsRecurringInstance,
                        eventResponse));
                }
            }

            responses = responses
                .OrderBy(occurrence => occurrence.OccurrenceStartUtc)
                .ThenBy(occurrence => occurrence.Event.TitlePublic)
                .Take(3000)
                .ToList();

            var conflicts = BuildOccurrenceConflicts(responses, scopeByEvent);
            return Results.Ok(new CalendarEventsQueryResponse(range.View, range.FromUtc, range.ToUtc, responses, conflicts));
        });

        auth.MapPost("/calendars/conflicts", async (
            CalendarConflictCheckRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (request.CalendarId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "CalendarId is required." });
            }

            if (request.EndUtc <= request.StartUtc)
            {
                return Results.BadRequest(new { error = "EndUtc must be after StartUtc." });
            }

            var access = await ResolveCalendarAccessAsync(request.CalendarId, context, dbContext, keyRingService, ct);
            if (access.Error is not null)
            {
                return access.Error;
            }

            if (!access.Context!.CanRead)
            {
                return Results.Forbid();
            }

            var scopeRoleIds = (request.ScopeRoleIds ?? Array.Empty<Guid>())
                .Where(roleId => roleId != Guid.Empty)
                .Distinct()
                .ToList();
            if (scopeRoleIds.Count == 0)
            {
                scopeRoleIds = access.Context.User.ReadRoleIds.ToList();
            }

            var conflicts = await FindConflictsAsync(
                dbContext,
                request.CalendarId,
                request.StartUtc,
                request.EndUtc,
                scopeRoleIds,
                request.IgnoreEventId,
                ct);

            return Results.Ok(conflicts);
        });

        auth.MapPost("/events/{eventId:guid}/share-links", async (
            Guid eventId,
            CalendarEventShareLinkCreateRequest request,
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

            var label = string.IsNullOrWhiteSpace(request.Label) ? "shared-view" : request.Label.Trim();
            if (label.Length > MaxShareLabelLength)
            {
                return Results.BadRequest(new { error = "Share link label is too long." });
            }

            var now = DateTimeOffset.UtcNow;
            DateTimeOffset? expiresUtc = request.ExpiresInHours is > 0
                ? now.AddHours(Math.Clamp(request.ExpiresInHours.Value, 1, 24 * 365))
                : null;

            var activeLinks = await dbContext.CalendarEventShareLinks
                .Where(link => link.EventId == eventId && link.IsActive && link.RevokedUtc == null)
                .ToListAsync(ct);
            foreach (var activeLink in activeLinks)
            {
                activeLink.IsActive = false;
                activeLink.RevokedUtc = now;
            }

            var code = CreateShareCode();
            var link = new CalendarEventShareLink
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                CodeHash = HashCode(code),
                Label = label,
                Mode = "readonly",
                IsActive = true,
                ExpiresUtc = expiresUtc,
                CreatedByUserId = access.Context.User.UserId,
                CreatedUtc = now,
                LastUsedUtc = null,
                RevokedUtc = null
            };

            dbContext.CalendarEventShareLinks.Add(link);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "CalendarEventShareLinkCreated",
                access.Context.User.UserId.ToString(),
                JsonSerializer.Serialize(new { eventId, linkId = link.Id, link.Mode, link.ExpiresUtc }),
                ct);

            return Results.Ok(new CalendarEventShareLinkResponse(
                link.Id,
                code,
                link.Label,
                link.Mode,
                link.CreatedUtc,
                link.ExpiresUtc,
                link.IsActive));
        });

        group.MapGet("/calendars/{calendarId:guid}/public/events", async (
            Guid calendarId,
            string? view,
            DateTimeOffset? fromUtc,
            DateTimeOffset? toUtc,
            string? status,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var range = ResolveRange(view, fromUtc, toUtc);
            var normalizedStatus = NormalizeStatusFilter(status);
            if (status is not null && normalizedStatus is null)
            {
                return Results.BadRequest(new { error = "Status filter is invalid." });
            }

            var query = dbContext.CalendarEvents.AsNoTracking()
                .Where(item =>
                    item.CalendarId == calendarId &&
                    !item.IsArchived &&
                    item.Visibility == "public" &&
                    item.StartUtc < range.ToUtc &&
                    (item.EndUtc > range.FromUtc || item.RecurrenceType != "none"));

            if (!string.IsNullOrWhiteSpace(normalizedStatus))
            {
                query = query.Where(item => item.Status == normalizedStatus);
            }

            var events = await query
                .OrderBy(item => item.StartUtc)
                .Take(1000)
                .ToListAsync(ct);

            var response = events.Select(ToPublicResponse).ToList();
            return Results.Ok(response);
        });

        group.MapGet("/public/events/{code}", async (
            string code,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return Results.NotFound();
            }

            var hash = HashCode(code.Trim());
            var now = DateTimeOffset.UtcNow;
            var candidates = await dbContext.CalendarEventShareLinks
                .Where(link => link.IsActive && link.RevokedUtc == null)
                .ToListAsync(ct);

            var link = candidates.FirstOrDefault(candidate => candidate.CodeHash.SequenceEqual(hash));
            if (link is null)
            {
                return Results.NotFound();
            }

            if (link.ExpiresUtc is not null && link.ExpiresUtc <= now)
            {
                return Results.NotFound();
            }

            var item = await dbContext.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == link.EventId, ct);
            if (item is null || item.IsArchived)
            {
                return Results.NotFound();
            }

            link.LastUsedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(ToPublicResponse(item));
        });
    }

    private static CalendarResponse BuildCalendarResponse(CalendarContainer calendar, IReadOnlyList<CalendarRoleBinding> bindings, UserContext user)
    {
        var activeBindings = bindings.Where(binding => binding.RevokedUtc == null).ToList();
        var canReadByOwner = user.ReadRoleIds.Contains(calendar.OwnerRoleId);
        var canWriteByOwner = user.WriteRoleIds.Contains(calendar.OwnerRoleId) || user.OwnerRoleIds.Contains(calendar.OwnerRoleId);
        var canManageByOwner = user.OwnerRoleIds.Contains(calendar.OwnerRoleId);

        var canReadByBinding = activeBindings.Any(binding => user.ReadRoleIds.Contains(binding.RoleId));
        var canWriteByBinding = activeBindings.Any(binding =>
            user.WriteRoleIds.Contains(binding.RoleId) &&
            (binding.AccessType == "editor" || binding.AccessType == "manager"));
        var canManageByBinding = activeBindings.Any(binding =>
            user.WriteRoleIds.Contains(binding.RoleId) &&
            binding.AccessType == "manager");

        return new CalendarResponse(
            calendar.Id,
            calendar.Slug,
            calendar.Name,
            calendar.Description,
            calendar.OrganizationScope,
            calendar.OwnerRoleId,
            calendar.DefaultTimeZoneId,
            calendar.IsArchived,
            calendar.CreatedUtc,
            calendar.UpdatedUtc,
            CanRead: canReadByOwner || canReadByBinding,
            CanWrite: canWriteByOwner || canWriteByBinding,
            CanManage: canManageByOwner || canManageByBinding,
            activeBindings.Select(ToRoleBindingResponse).ToList());
    }

    private static CalendarRoleBindingResponse ToRoleBindingResponse(CalendarRoleBinding binding) =>
        new(
            binding.Id,
            binding.RoleId,
            binding.AccessType,
            binding.CreatedUtc,
            binding.RevokedUtc);

    private static async Task<CalendarEventResponse> BuildEventResponseAsync(
        CalendarEvent item,
        UserContext user,
        RecreatioDbContext dbContext,
        IKeyRingService keyRingService,
        bool includeProtected,
        CancellationToken ct)
    {
        var scopes = await dbContext.CalendarEventRoleScopes.AsNoTracking()
            .Where(scope => scope.EventId == item.Id)
            .OrderBy(scope => scope.CreatedUtc)
            .ToListAsync(ct);
        var reminders = await dbContext.CalendarEventReminders.AsNoTracking()
            .Where(reminder => reminder.EventId == item.Id)
            .OrderBy(reminder => reminder.MinutesBefore)
            .ThenBy(reminder => reminder.CreatedUtc)
            .ToListAsync(ct);

        var protectedResult = await ResolveProtectedDataAsync(item, user, dbContext, keyRingService, includeProtected, ct);

        return new CalendarEventResponse(
            item.Id,
            item.CalendarId,
            item.OwnerRoleId,
            item.TitlePublic,
            item.SummaryPublic,
            item.LocationPublic,
            item.Visibility,
            item.Status,
            item.StartUtc,
            item.EndUtc,
            item.AllDay,
            item.TimeZoneId,
            item.RecurrenceType,
            item.RecurrenceInterval,
            item.RecurrenceByWeekday,
            item.RecurrenceUntilUtc,
            item.RecurrenceCount,
            item.RecurrenceRule,
            item.LinkedModule,
            item.LinkedEntityType,
            item.LinkedEntityId,
            item.SourceFieldStart,
            item.SourceFieldEnd,
            item.ConflictScopeMode,
            item.IsArchived,
            item.CreatedUtc,
            item.UpdatedUtc,
            HasProtectedDetails: protectedResult.HasProtectedDetails,
            CanReadProtectedDetails: protectedResult.CanReadProtectedDetails,
            ProtectedDetailsJson: protectedResult.ProtectedDetailsJson,
            RoleScopes: scopes.Select(scope => new CalendarEventRoleScopeResponse(
                scope.Id,
                scope.RoleId,
                scope.ScopeType,
                scope.CreatedUtc,
                scope.RevokedUtc)).ToList(),
            Reminders: reminders.Select(reminder => new CalendarReminderResponse(
                reminder.Id,
                reminder.MinutesBefore,
                reminder.Channel,
                reminder.TargetRoleId,
                reminder.TargetUserId,
                reminder.Status,
                reminder.CreatedUtc,
                reminder.UpdatedUtc)).ToList());
    }

    private static async Task<(bool HasProtectedDetails, bool CanReadProtectedDetails, string? ProtectedDetailsJson)> ResolveProtectedDataAsync(
        CalendarEvent item,
        UserContext user,
        RecreatioDbContext dbContext,
        IKeyRingService keyRingService,
        bool includeProtected,
        CancellationToken ct)
    {
        if (item.ProtectedDataItemId is null)
        {
            return (false, false, null);
        }

        if (!includeProtected)
        {
            return (true, false, null);
        }

        var grants = await dbContext.DataKeyGrants.AsNoTracking()
            .Where(grant =>
                grant.DataItemId == item.ProtectedDataItemId.Value &&
                grant.RevokedUtc == null &&
                user.ReadRoleIds.Contains(grant.RoleId))
            .ToListAsync(ct);
        if (grants.Count == 0)
        {
            return (true, false, null);
        }

        var dataItem = await dbContext.DataItems.AsNoTracking()
            .FirstOrDefaultAsync(entry => entry.Id == item.ProtectedDataItemId.Value, ct);
        if (dataItem is null || dataItem.EncryptedValue is null)
        {
            return (true, false, null);
        }

        foreach (var grant in grants)
        {
            if (!user.KeyRing.TryGetReadKey(grant.RoleId, out var readKey))
            {
                continue;
            }

            try
            {
                var dataKey = keyRingService.DecryptDataKey(
                    new KeyEntry
                    {
                        Id = dataItem.Id,
                        EncryptedKeyBlob = grant.EncryptedDataKeyBlob
                    },
                    readKey);

                var value = keyRingService.TryDecryptDataItemValue(dataKey, dataItem.EncryptedValue, dataItem.Id, CalendarProtectedItemName);
                if (value is not null)
                {
                    return (true, true, value);
                }
            }
            catch
            {
                // ignored - try next grant
            }
        }

        return (true, false, null);
    }

    private static Guid CreateProtectedDataItem(
        Guid ownerRoleId,
        string protectedJson,
        UserContext user,
        IKeyRingService keyRingService,
        RecreatioDbContext dbContext,
        DateTimeOffset now)
    {
        if (!user.KeyRing.TryGetReadKey(ownerRoleId, out var ownerReadKey))
        {
            return Guid.Empty;
        }

        var dataItemId = Guid.NewGuid();
        var dataKey = RandomNumberGenerator.GetBytes(32);

        var encryptedValue = keyRingService.EncryptDataItemValue(dataKey, protectedJson, dataItemId, CalendarProtectedItemName);
        var encryptedItemName = keyRingService.EncryptDataItemMeta(dataKey, CalendarProtectedItemName, dataItemId, "item-name");
        var encryptedItemType = keyRingService.EncryptDataItemMeta(dataKey, CalendarProtectedItemType, dataItemId, "item-type");

        var dataItem = new DataItem
        {
            Id = dataItemId,
            OwnerRoleId = ownerRoleId,
            ItemType = string.Empty,
            ItemName = string.Empty,
            EncryptedItemType = encryptedItemType,
            EncryptedItemName = encryptedItemName,
            EncryptedValue = encryptedValue,
            PublicSigningKey = Array.Empty<byte>(),
            PublicSigningKeyAlg = "none",
            DataSignature = null,
            DataSignatureAlg = null,
            DataSignatureRoleId = null,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        var encryptedDataKeyBlob = keyRingService.EncryptDataKey(ownerReadKey, dataKey, dataItemId);

        var dataGrant = new DataKeyGrant
        {
            Id = Guid.NewGuid(),
            DataItemId = dataItemId,
            RoleId = ownerRoleId,
            PermissionType = RoleRelationships.Owner,
            EncryptedDataKeyBlob = encryptedDataKeyBlob,
            EncryptedSigningKeyBlob = null,
            CreatedUtc = now,
            RevokedUtc = null
        };

        dbContext.DataItems.Add(dataItem);
        dbContext.DataKeyGrants.Add(dataGrant);

        return dataItemId;
    }

    private static async Task<bool> UpsertProtectedDataAsync(
        CalendarEvent item,
        string protectedJson,
        UserContext user,
        IKeyRingService keyRingService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        if (item.ProtectedDataItemId is null)
        {
            var createdId = CreateProtectedDataItem(item.OwnerRoleId, protectedJson, user, keyRingService, dbContext, now);
            if (createdId == Guid.Empty)
            {
                return false;
            }

            item.ProtectedDataItemId = createdId;
            return true;
        }

        var dataItem = await dbContext.DataItems.FirstOrDefaultAsync(entry => entry.Id == item.ProtectedDataItemId.Value, ct);
        if (dataItem is null)
        {
            var createdId = CreateProtectedDataItem(item.OwnerRoleId, protectedJson, user, keyRingService, dbContext, now);
            if (createdId == Guid.Empty)
            {
                return false;
            }

            item.ProtectedDataItemId = createdId;
            return true;
        }

        var grants = await dbContext.DataKeyGrants.AsNoTracking()
            .Where(grant =>
                grant.DataItemId == dataItem.Id &&
                grant.RevokedUtc == null &&
                user.ReadRoleIds.Contains(grant.RoleId))
            .ToListAsync(ct);

        foreach (var grant in grants)
        {
            if (!user.KeyRing.TryGetReadKey(grant.RoleId, out var readKey))
            {
                continue;
            }

            try
            {
                var dataKey = keyRingService.DecryptDataKey(
                    new KeyEntry
                    {
                        Id = dataItem.Id,
                        EncryptedKeyBlob = grant.EncryptedDataKeyBlob
                    },
                    readKey);

                dataItem.EncryptedValue = keyRingService.EncryptDataItemValue(dataKey, protectedJson, dataItem.Id, CalendarProtectedItemName);
                dataItem.UpdatedUtc = now;
                return true;
            }
            catch
            {
                // ignored
            }
        }

        var fallbackId = CreateProtectedDataItem(item.OwnerRoleId, protectedJson, user, keyRingService, dbContext, now);
        if (fallbackId == Guid.Empty)
        {
            return false;
        }

        item.ProtectedDataItemId = fallbackId;
        return true;
    }

    private static (List<NormalizedReminder> Reminders, IResult? Error) NormalizeReminderRequests(IReadOnlyList<CalendarReminderRequest>? reminders)
    {
        var normalized = new List<NormalizedReminder>();
        foreach (var reminder in reminders ?? Array.Empty<CalendarReminderRequest>())
        {
            var channel = NormalizeReminderChannel(reminder.Channel);
            if (channel is null)
            {
                return (new List<NormalizedReminder>(), Results.BadRequest(new { error = "Reminder channel is invalid." }));
            }

            if (reminder.MinutesBefore is < 0 or > 60 * 24 * 365)
            {
                return (new List<NormalizedReminder>(), Results.BadRequest(new { error = "Reminder minutes range is invalid." }));
            }

            if (reminder.TargetRoleId is Guid.Empty)
            {
                return (new List<NormalizedReminder>(), Results.BadRequest(new { error = "Reminder TargetRoleId cannot be empty GUID." }));
            }

            if (reminder.TargetUserId is Guid.Empty)
            {
                return (new List<NormalizedReminder>(), Results.BadRequest(new { error = "Reminder TargetUserId cannot be empty GUID." }));
            }

            normalized.Add(new NormalizedReminder(reminder.MinutesBefore, channel, reminder.TargetRoleId, reminder.TargetUserId));
        }

        return (normalized, null);
    }

    private static async Task<List<CalendarConflictResponse>> FindConflictsAsync(
        RecreatioDbContext dbContext,
        Guid calendarId,
        DateTimeOffset startUtc,
        DateTimeOffset endUtc,
        IReadOnlyCollection<Guid> scopeRoleIds,
        Guid? ignoreEventId,
        CancellationToken ct)
    {
        var query = dbContext.CalendarEvents.AsNoTracking()
            .Where(item =>
                item.CalendarId == calendarId &&
                !item.IsArchived &&
                item.Status != "cancelled" &&
                item.StartUtc < endUtc &&
                item.EndUtc > startUtc);

        if (ignoreEventId is not null)
        {
            query = query.Where(item => item.Id != ignoreEventId.Value);
        }

        var candidates = await query
            .OrderBy(item => item.StartUtc)
            .Take(300)
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            return new List<CalendarConflictResponse>();
        }

        var candidateIds = candidates.Select(item => item.Id).ToList();
        var scopes = await dbContext.CalendarEventRoleScopes.AsNoTracking()
            .Where(scope => candidateIds.Contains(scope.EventId) && scope.RevokedUtc == null)
            .ToListAsync(ct);

        var scopeByEvent = scopes
            .GroupBy(scope => scope.EventId)
            .ToDictionary(grouping => grouping.Key, grouping => grouping.Select(scope => scope.RoleId).ToHashSet());

        var conflicts = new List<CalendarConflictResponse>();
        foreach (var candidate in candidates)
        {
            var candidateRoles = scopeByEvent.GetValueOrDefault(candidate.Id, new HashSet<Guid>());
            var include = candidateRoles.Count == 0 || candidateRoles.Any(scopeRoleIds.Contains);
            if (!include)
            {
                continue;
            }

            conflicts.Add(new CalendarConflictResponse(
                candidate.Id,
                candidate.TitlePublic,
                candidate.StartUtc,
                candidate.EndUtc,
                "time-overlap"));
        }

        return conflicts;
    }

    private static List<CalendarConflictResponse> BuildOccurrenceConflicts(
        IReadOnlyList<CalendarEventOccurrenceResponse> occurrences,
        IReadOnlyDictionary<Guid, HashSet<Guid>> scopesByEvent)
    {
        var results = new List<CalendarConflictResponse>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < occurrences.Count; i++)
        {
            var left = occurrences[i];
            var leftRoles = scopesByEvent.GetValueOrDefault(left.EventId, new HashSet<Guid>());

            for (var j = i + 1; j < occurrences.Count; j++)
            {
                var right = occurrences[j];
                if (right.OccurrenceStartUtc >= left.OccurrenceEndUtc)
                {
                    break;
                }

                if (left.EventId == right.EventId)
                {
                    continue;
                }

                var rightRoles = scopesByEvent.GetValueOrDefault(right.EventId, new HashSet<Guid>());
                var shareScope = leftRoles.Count == 0 || rightRoles.Count == 0 || leftRoles.Overlaps(rightRoles);
                if (!shareScope)
                {
                    continue;
                }

                var start = left.OccurrenceStartUtc > right.OccurrenceStartUtc ? left.OccurrenceStartUtc : right.OccurrenceStartUtc;
                var end = left.OccurrenceEndUtc < right.OccurrenceEndUtc ? left.OccurrenceEndUtc : right.OccurrenceEndUtc;
                if (end <= start)
                {
                    continue;
                }

                var key = string.CompareOrdinal(left.EventId.ToString("N"), right.EventId.ToString("N")) < 0
                    ? $"{left.EventId:N}:{right.EventId:N}:{start:O}:{end:O}"
                    : $"{right.EventId:N}:{left.EventId:N}:{start:O}:{end:O}";
                if (!seen.Add(key))
                {
                    continue;
                }

                results.Add(new CalendarConflictResponse(left.EventId, left.Event.TitlePublic, start, end, "time-overlap"));
                results.Add(new CalendarConflictResponse(right.EventId, right.Event.TitlePublic, start, end, "time-overlap"));
            }
        }

        return results.OrderBy(conflict => conflict.StartUtc).Take(300).ToList();
    }

    private static bool CanReadEventByVisibility(CalendarEvent item, IReadOnlySet<Guid> scopeRoleIds, IReadOnlySet<Guid> userRoleIds)
    {
        if (item.Visibility == "public")
        {
            return true;
        }

        if (scopeRoleIds.Count == 0)
        {
            return true;
        }

        return scopeRoleIds.Any(userRoleIds.Contains);
    }

    private static IEnumerable<(DateTimeOffset StartUtc, DateTimeOffset EndUtc, bool IsRecurringInstance)> ExpandOccurrences(
        CalendarEvent item,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc)
    {
        if (item.RecurrenceType == "none" || item.RecurrenceType == "custom")
        {
            if (item.StartUtc < toUtc && item.EndUtc > fromUtc)
            {
                yield return (item.StartUtc, item.EndUtc, false);
            }

            yield break;
        }

        var duration = item.EndUtc - item.StartUtc;
        if (duration <= TimeSpan.Zero)
        {
            duration = TimeSpan.FromHours(1);
        }

        var maxCount = item.RecurrenceCount is > 0 ? Math.Min(item.RecurrenceCount.Value, MaxOccurrencePerEvent) : MaxOccurrencePerEvent;
        var currentStart = item.StartUtc;
        var emitted = 0;
        var generated = 0;

        while (generated < maxCount)
        {
            if (item.RecurrenceUntilUtc is not null && currentStart > item.RecurrenceUntilUtc.Value)
            {
                break;
            }

            var currentEnd = currentStart + duration;
            if (currentStart < toUtc && currentEnd > fromUtc)
            {
                yield return (currentStart, currentEnd, true);
                emitted++;
                if (emitted >= MaxOccurrencePerEvent)
                {
                    break;
                }
            }

            if (currentStart > toUtc)
            {
                break;
            }

            currentStart = item.RecurrenceType switch
            {
                "daily" => currentStart.AddDays(Math.Max(1, item.RecurrenceInterval)),
                "weekly" => currentStart.AddDays(7 * Math.Max(1, item.RecurrenceInterval)),
                "monthly" => currentStart.AddMonths(Math.Max(1, item.RecurrenceInterval)),
                _ => currentStart.AddDays(Math.Max(1, item.RecurrenceInterval))
            };
            generated++;
        }
    }

    private static CalendarPublicEventResponse ToPublicResponse(CalendarEvent item) =>
        new(
            item.Id,
            item.CalendarId,
            item.TitlePublic,
            item.SummaryPublic,
            item.LocationPublic,
            item.Visibility,
            item.Status,
            item.StartUtc,
            item.EndUtc,
            item.AllDay,
            item.TimeZoneId,
            item.RecurrenceType,
            item.RecurrenceInterval,
            item.RecurrenceByWeekday,
            item.RecurrenceUntilUtc,
            item.RecurrenceCount,
            item.RecurrenceRule,
            item.LinkedModule,
            item.LinkedEntityType,
            item.LinkedEntityId,
            item.CreatedUtc,
            item.UpdatedUtc);

    private static byte[] HashCode(string code)
    {
        using var sha = SHA256.Create();
        return sha.ComputeHash(Encoding.UTF8.GetBytes(code));
    }

    private static string CreateShareCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static (string View, DateTimeOffset FromUtc, DateTimeOffset ToUtc) ResolveRange(string? view, DateTimeOffset? fromUtc, DateTimeOffset? toUtc)
    {
        var normalizedView = string.IsNullOrWhiteSpace(view) ? "list" : view.Trim().ToLowerInvariant();
        if (fromUtc is not null && toUtc is not null && toUtc > fromUtc)
        {
            return (normalizedView, fromUtc.Value, toUtc.Value);
        }

        var now = DateTimeOffset.UtcNow;
        return normalizedView switch
        {
            "day" => ("day", new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero), new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero).AddDays(1)),
            "week" => ResolveWeekRange(now),
            "month" => ResolveMonthRange(now),
            _ => ("list", now, now.AddDays(30))
        };
    }

    private static (string View, DateTimeOffset FromUtc, DateTimeOffset ToUtc) ResolveWeekRange(DateTimeOffset now)
    {
        var dayStart = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero);
        var dayOfWeek = (int)dayStart.DayOfWeek;
        var offset = dayOfWeek == 0 ? 6 : dayOfWeek - 1;
        var from = dayStart.AddDays(-offset);
        return ("week", from, from.AddDays(7));
    }

    private static (string View, DateTimeOffset FromUtc, DateTimeOffset ToUtc) ResolveMonthRange(DateTimeOffset now)
    {
        var from = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        return ("month", from, from.AddMonths(1));
    }

    private static string? NormalizeAccessType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedAccessTypes.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeVisibility(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedVisibility.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeVisibilityFilter(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return NormalizeVisibility(value);
    }

    private static string? NormalizeStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedStatus.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeStatusFilter(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return NormalizeStatus(value);
    }

    private static string? NormalizeReminderChannel(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedReminderChannels.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeRecurrenceType(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? "none" : value.Trim().ToLowerInvariant();
        return AllowedRecurrenceTypes.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeConflictScopeMode(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? "role" : value.Trim().ToLowerInvariant();
        return AllowedConflictScopeModes.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeNullable(string? value, int maxLength)
    {
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length == 0)
        {
            return null;
        }

        return trimmed.Length <= maxLength ? trimmed : null;
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

        return (new UserContext(
            userId,
            keyRing,
            keyRing.ReadKeys.Keys.ToHashSet(),
            keyRing.WriteKeys.Keys.ToHashSet(),
            keyRing.OwnerKeys.Keys.ToHashSet()), null);
    }

    private static async Task<(CalendarAccessContext? Context, IResult? Error)> ResolveCalendarAccessAsync(
        Guid calendarId,
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
        var calendar = await dbContext.CalendarContainers.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == calendarId, ct);
        if (calendar is null)
        {
            return (null, Results.NotFound());
        }

        var activeBindings = await dbContext.CalendarRoleBindings.AsNoTracking()
            .Where(binding => binding.CalendarId == calendarId && binding.RevokedUtc == null)
            .ToListAsync(ct);

        var canReadByOwner = resolvedUser.ReadRoleIds.Contains(calendar.OwnerRoleId);
        var canWriteByOwner = resolvedUser.WriteRoleIds.Contains(calendar.OwnerRoleId) || resolvedUser.OwnerRoleIds.Contains(calendar.OwnerRoleId);
        var canManageByOwner = resolvedUser.OwnerRoleIds.Contains(calendar.OwnerRoleId);

        var canReadByBinding = activeBindings.Any(binding => resolvedUser.ReadRoleIds.Contains(binding.RoleId));
        var canWriteByBinding = activeBindings.Any(binding =>
            resolvedUser.WriteRoleIds.Contains(binding.RoleId) &&
            (binding.AccessType == "editor" || binding.AccessType == "manager"));
        var canManageByBinding = activeBindings.Any(binding =>
            resolvedUser.WriteRoleIds.Contains(binding.RoleId) &&
            binding.AccessType == "manager");

        var canRead = canReadByOwner || canReadByBinding;
        if (!canRead)
        {
            return (null, Results.Forbid());
        }

        return (new CalendarAccessContext(
            resolvedUser,
            calendar,
            activeBindings,
            canRead,
            canWriteByOwner || canWriteByBinding,
            canManageByOwner || canManageByBinding), null);
    }

    private static async Task<(EventAccessContext? Context, IResult? Error)> ResolveEventAccessAsync(
        Guid eventId,
        HttpContext context,
        RecreatioDbContext dbContext,
        IKeyRingService keyRingService,
        CancellationToken ct)
    {
        var item = await dbContext.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
        if (item is null)
        {
            return (null, Results.NotFound());
        }

        var calendarAccess = await ResolveCalendarAccessAsync(item.CalendarId, context, dbContext, keyRingService, ct);
        if (calendarAccess.Error is not null)
        {
            return (null, calendarAccess.Error);
        }

        var scopeRoleIds = await dbContext.CalendarEventRoleScopes.AsNoTracking()
            .Where(scope => scope.EventId == eventId && scope.RevokedUtc == null)
            .Select(scope => scope.RoleId)
            .Distinct()
            .ToListAsync(ct);

        var user = calendarAccess.Context!.User;
        var scopeSet = scopeRoleIds.ToHashSet();
        var readAllowedByScope = item.Visibility == "public" || scopeSet.Count == 0 || scopeSet.Any(user.ReadRoleIds.Contains);
        if (!readAllowedByScope)
        {
            return (null, Results.Forbid());
        }

        var canWriteByOwner = user.WriteRoleIds.Contains(item.OwnerRoleId) || user.OwnerRoleIds.Contains(item.OwnerRoleId);
        var canWriteByScope = scopeSet.Any(user.WriteRoleIds.Contains);
        var canManageByOwner = user.OwnerRoleIds.Contains(item.OwnerRoleId);

        return (new EventAccessContext(
            user,
            calendarAccess.Context.Calendar,
            item,
            scopeSet,
            canRead: true,
            canWrite: calendarAccess.Context.CanWrite && (canWriteByOwner || canWriteByScope || calendarAccess.Context.CanManage),
            canManage: canManageByOwner || calendarAccess.Context.CanManage), null);
    }

    private sealed record UserContext(
        Guid UserId,
        RoleKeyRing KeyRing,
        HashSet<Guid> ReadRoleIds,
        HashSet<Guid> WriteRoleIds,
        HashSet<Guid> OwnerRoleIds);

    private sealed record CalendarAccessContext(
        UserContext User,
        CalendarContainer Calendar,
        IReadOnlyList<CalendarRoleBinding> ActiveBindings,
        bool CanRead,
        bool CanWrite,
        bool CanManage);

    private sealed record EventAccessContext(
        UserContext User,
        CalendarContainer Calendar,
        CalendarEvent Event,
        IReadOnlySet<Guid> ScopeRoleIds,
        bool CanRead,
        bool CanWrite,
        bool CanManage);

    private sealed record NormalizedReminder(
        int MinutesBefore,
        string Channel,
        Guid? TargetRoleId,
        Guid? TargetUserId);
}
