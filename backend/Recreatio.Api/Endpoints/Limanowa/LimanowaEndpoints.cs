using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Limanowa;
using Recreatio.Api.Data.Pilgrimage;

namespace Recreatio.Api.Endpoints.Limanowa;

public static class LimanowaEndpoints
{
    private const string DefaultSlug = "limanowa";
    private const string GlobalEventsLimanowaAdminScope = "events-limanowa";

    private static readonly string[] AllowedGroupStatuses =
    [
        "nowe zgłoszenie",
        "oczekuje na kontakt",
        "oczekuje na uzupełnienie",
        "gotowe organizacyjnie",
        "zamknięte"
    ];

    private static readonly string[] AllowedParticipantStatuses =
    [
        "nieuzupełniony",
        "w trakcie",
        "gotowy",
        "wymaga poprawy"
    ];

    private static readonly string[] AllowedThreadStatuses =
    [
        "open",
        "answered",
        "closed"
    ];

    private static readonly string[] AllowedAudiences =
    [
        "all",
        "group-admin",
        "participant",
        "admin"
    ];

    public static void MapLimanowaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/limanowa");

        group.MapGet("/admin/events-limanowa/status", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var assignment = await dbContext.PortalAdminAssignments.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ScopeKey == GlobalEventsLimanowaAdminScope, ct);

            var adminAccount = assignment is null
                ? null
                : await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == assignment.UserId)
                    .Select(x => new { x.Id, x.LoginId, x.DisplayName })
                    .FirstOrDefaultAsync(ct);

            var isSystemLikeAdmin = adminAccount is not null
                && string.Equals((adminAccount.LoginId ?? string.Empty).Trim(), "system", StringComparison.OrdinalIgnoreCase);
            var hasAdmin = assignment is not null && adminAccount is not null && !isSystemLikeAdmin;
            var isCurrentUserAdmin = false;
            if (hasAdmin && assignment is not null && EndpointHelpers.TryGetUserId(context, out var maybeUserId))
            {
                isCurrentUserAdmin = assignment.UserId == maybeUserId;
            }

            var adminDisplayName = hasAdmin
                ? (adminAccount?.DisplayName ?? adminAccount?.LoginId)
                : null;

            var limanowaProvisioned = await dbContext.LimanowaEvents.AsNoTracking()
                .AnyAsync(x => x.Slug == DefaultSlug, ct);

            return Results.Ok(new LimanowaAdminStatusResponse(hasAdmin, isCurrentUserAdmin, adminDisplayName, limanowaProvisioned));
        });

        group.MapPost("/admin/events-limanowa/claim", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var existing = await dbContext.PortalAdminAssignments
                .FirstOrDefaultAsync(x => x.ScopeKey == GlobalEventsLimanowaAdminScope, ct);
            if (existing is not null)
            {
                if (existing.UserId == userId)
                {
                    return Results.Ok(new LimanowaClaimAdminResponse(true, true));
                }

                var existingAccount = await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == existing.UserId)
                    .Select(x => new { x.LoginId })
                    .FirstOrDefaultAsync(ct);
                var isStaleOrSystem = existingAccount is null
                    || string.Equals((existingAccount.LoginId ?? string.Empty).Trim(), "system", StringComparison.OrdinalIgnoreCase);
                if (!isStaleOrSystem)
                {
                    return Results.Conflict(new { error = "Administrator jest już przypisany." });
                }

                dbContext.PortalAdminAssignments.Remove(existing);
                await dbContext.SaveChangesAsync(ct);
            }

            dbContext.PortalAdminAssignments.Add(new PortalAdminAssignment
            {
                Id = Guid.NewGuid(),
                ScopeKey = GlobalEventsLimanowaAdminScope,
                UserId = userId,
                CreatedUtc = DateTimeOffset.UtcNow
            });
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new LimanowaClaimAdminResponse(true, false));
        }).RequireAuthorization();

        group.MapPost("/admin/events-limanowa/bootstrap-limanowa", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var limanowaEvent = await EnsureDefaultEventProvisionedAsync(dbContext, ct);
            var policy = await EnsurePolicyLinksAsync(dbContext, limanowaEvent.Id, ct);
            return Results.Ok(ToEventSiteResponse(limanowaEvent, policy, true));
        }).RequireAuthorization();

        group.MapGet("/{slug}", async (
            string slug,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalizedSlug))
            {
                return Results.BadRequest(new { error = "Brak slugu wydarzenia." });
            }

            var limanowaEvent = await dbContext.LimanowaEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);
            if (limanowaEvent is null)
            {
                if (!string.Equals(normalizedSlug, DefaultSlug, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.NotFound();
                }

                var fallback = BuildDefaultEvent();
                var fallbackPolicy = BuildDefaultPolicyLinks();
                return Results.Ok(ToEventSiteResponse(fallback, fallbackPolicy, false));
            }

            var policy = await GetPolicyLinksAsync(dbContext, limanowaEvent.Id, ct) ?? BuildDefaultPolicyLinks();
            return Results.Ok(ToEventSiteResponse(limanowaEvent, policy, true));
        });

        group.MapPost("/{slug}/public/group-registrations", async (
            string slug,
            LimanowaGroupRegistrationRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalizedSlug))
            {
                return Results.BadRequest(new { error = "Brak slugu wydarzenia." });
            }

            var limanowaEvent = await dbContext.LimanowaEvents
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);
            if (limanowaEvent is null)
            {
                return Results.NotFound();
            }

            if (!limanowaEvent.RegistrationOpen)
            {
                return Results.BadRequest(new { error = "Zapisy grup są obecnie zamknięte." });
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (today > limanowaEvent.RegistrationGroupsDeadline)
            {
                return Results.BadRequest(new { error = "Termin zapisów grupowych już minął." });
            }

            var parishName = NormalizeShort(request.ParishName, 220);
            var responsibleName = NormalizeShort(request.ResponsibleName, 200);
            var phone = NormalizePolishPhone(request.Phone);
            var email = NormalizeShort(request.Email, 180);
            if (string.IsNullOrWhiteSpace(parishName) || string.IsNullOrWhiteSpace(responsibleName) || string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(email))
            {
                return Results.BadRequest(new { error = "Uzupełnij parafię/wspólnotę, dane osoby odpowiedzialnej, telefon i e-mail." });
            }

            if (request.ExpectedParticipantCount < 0 || request.ExpectedGuardianCount < 1)
            {
                return Results.BadRequest(new { error = "Podaj poprawne liczby uczestników i opiekunów." });
            }

            var totalInGroup = request.ExpectedParticipantCount + request.ExpectedGuardianCount;
            if (totalInGroup > 12)
            {
                return Results.BadRequest(new { error = "Jedna grupa może liczyć maksymalnie 12 osób łącznie z opiekunami." });
            }

            var existingDeclared = await dbContext.LimanowaGroups.AsNoTracking()
                .Where(x => x.EventId == limanowaEvent.Id && x.Status != "zamknięte")
                .SumAsync(x => x.ExpectedParticipantCount + x.ExpectedGuardianCount, ct);
            if (existingDeclared + totalInGroup > limanowaEvent.CapacityTotal)
            {
                return Results.Conflict(new { error = "Brak wolnych miejsc w limicie wydarzenia." });
            }

            var now = DateTimeOffset.UtcNow;
            var entity = new LimanowaGroup
            {
                Id = Guid.NewGuid(),
                EventId = limanowaEvent.Id,
                ParishName = parishName,
                ResponsibleName = responsibleName,
                Phone = phone,
                Email = email,
                ExpectedParticipantCount = request.ExpectedParticipantCount,
                ExpectedGuardianCount = request.ExpectedGuardianCount,
                Notes = NormalizeLong(request.Notes, 2400),
                Status = "nowe zgłoszenie",
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.LimanowaGroups.Add(entity);
            dbContext.LimanowaRegistrationStatusLogs.Add(new LimanowaRegistrationStatusLog
            {
                Id = Guid.NewGuid(),
                EventId = limanowaEvent.Id,
                RelatedType = "group",
                RelatedId = entity.Id,
                PreviousStatus = null,
                NewStatus = entity.Status,
                ChangedByType = "public",
                ChangedById = null,
                CreatedAt = now
            });
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new LimanowaGroupRegistrationResponse(entity.Id, entity.Status, entity.CreatedAt));
        });

        group.MapGet("/group-admin/zone", async (
            string token,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveGroupAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link grupy." });
            }

            var limanowaEvent = await dbContext.LimanowaEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == access.EventId, ct);
            var groupRow = await dbContext.LimanowaGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == access.GroupId, ct);
            if (limanowaEvent is null || groupRow is null)
            {
                return Results.NotFound();
            }

            access.LastOpenedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            var policy = await GetPolicyLinksAsync(dbContext, limanowaEvent.Id, ct) ?? BuildDefaultPolicyLinks();
            var participants = await BuildParticipantsAsync(dbContext, limanowaEvent.Id, groupRow.Id, ct);
            var announcements = await BuildAnnouncementsAsync(dbContext, limanowaEvent.Id, "group-admin", ct);
            var thread = await BuildThreadAsync(dbContext, limanowaEvent.Id, "group", groupRow.Id, ct);

            return Results.Ok(new LimanowaGroupAdminZoneResponse(
                ToEventSiteResponse(limanowaEvent, policy, true),
                ToGroupResponse(groupRow),
                participants,
                announcements,
                thread,
                ToPolicyLinksResponse(policy)));
        });

        group.MapPut("/group-admin/group", async (
            string token,
            LimanowaGroupAdminUpdateRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveGroupAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link grupy." });
            }

            var groupRow = await dbContext.LimanowaGroups.FirstOrDefaultAsync(x => x.Id == access.GroupId, ct);
            if (groupRow is null)
            {
                return Results.NotFound();
            }

            var parishName = NormalizeShort(request.ParishName, 220);
            var responsibleName = NormalizeShort(request.ResponsibleName, 200);
            var phone = NormalizePolishPhone(request.Phone);
            var email = NormalizeShort(request.Email, 180);
            if (string.IsNullOrWhiteSpace(parishName) || string.IsNullOrWhiteSpace(responsibleName) || string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(email))
            {
                return Results.BadRequest(new { error = "Uzupełnij wymagane dane grupy." });
            }

            if (request.ExpectedParticipantCount < 0 || request.ExpectedGuardianCount < 1)
            {
                return Results.BadRequest(new { error = "Podaj poprawne liczby uczestników i opiekunów." });
            }

            var totalInGroup = request.ExpectedParticipantCount + request.ExpectedGuardianCount;
            if (totalInGroup > 12)
            {
                return Results.BadRequest(new { error = "Jedna grupa może liczyć maksymalnie 12 osób łącznie z opiekunami." });
            }

            groupRow.ParishName = parishName;
            groupRow.ResponsibleName = responsibleName;
            groupRow.Phone = phone;
            groupRow.Email = email;
            groupRow.ExpectedParticipantCount = request.ExpectedParticipantCount;
            groupRow.ExpectedGuardianCount = request.ExpectedGuardianCount;
            groupRow.Notes = NormalizeLong(request.Notes, 2400);
            groupRow.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(ToGroupResponse(groupRow));
        });

        group.MapPost("/group-admin/participants", async (
            string token,
            LimanowaParticipantUpsertRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveGroupAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link grupy." });
            }

            var groupRow = await dbContext.LimanowaGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == access.GroupId, ct);
            if (groupRow is null)
            {
                return Results.NotFound();
            }

            var existingParticipants = await dbContext.LimanowaParticipants.AsNoTracking()
                .CountAsync(x => x.GroupId == groupRow.Id, ct);
            if (existingParticipants + groupRow.ExpectedGuardianCount >= 12)
            {
                return Results.BadRequest(new { error = "Limit 12 osób w grupie został osiągnięty." });
            }

            var fullName = NormalizeShort(request.FullName, 200);
            var phone = NormalizePolishPhone(request.Phone);
            if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "Imię i nazwisko oraz telefon uczestnika są wymagane." });
            }

            var now = DateTimeOffset.UtcNow;
            var participant = new LimanowaParticipant
            {
                Id = Guid.NewGuid(),
                EventId = access.EventId,
                GroupId = groupRow.Id,
                FullName = fullName,
                Phone = phone,
                ParishName = NormalizeShort(request.ParishName, 220) ?? groupRow.ParishName,
                ParentContactName = NormalizeShort(request.ParentContactName, 200),
                ParentContactPhone = NormalizePolishPhone(request.ParentContactPhone),
                GuardianName = NormalizeShort(request.GuardianName, 200),
                GuardianPhone = NormalizePolishPhone(request.GuardianPhone),
                Notes = NormalizeLong(request.Notes, 2400),
                HealthNotes = NormalizeLong(request.HealthNotes, 2400),
                AccommodationType = NormalizeShort(request.AccommodationType, 64),
                Status = NormalizeParticipantStatus(request.Status),
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.LimanowaParticipants.Add(participant);
            dbContext.LimanowaRegistrationStatusLogs.Add(new LimanowaRegistrationStatusLog
            {
                Id = Guid.NewGuid(),
                EventId = access.EventId,
                RelatedType = "participant",
                RelatedId = participant.Id,
                PreviousStatus = null,
                NewStatus = participant.Status,
                ChangedByType = "group-admin",
                ChangedById = groupRow.Id,
                CreatedAt = now
            });

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(await BuildParticipantAsync(dbContext, participant.Id, ct));
        });

        group.MapPut("/group-admin/participants/{participantId:guid}", async (
            string token,
            Guid participantId,
            LimanowaParticipantUpsertRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveGroupAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link grupy." });
            }

            var participant = await dbContext.LimanowaParticipants
                .FirstOrDefaultAsync(x => x.Id == participantId && x.GroupId == access.GroupId && x.EventId == access.EventId, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            var fullName = NormalizeShort(request.FullName, 200);
            var phone = NormalizePolishPhone(request.Phone);
            if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "Imię i nazwisko oraz telefon uczestnika są wymagane." });
            }

            var previousStatus = participant.Status;
            participant.FullName = fullName;
            participant.Phone = phone;
            participant.ParishName = NormalizeShort(request.ParishName, 220) ?? participant.ParishName;
            participant.ParentContactName = NormalizeShort(request.ParentContactName, 200);
            participant.ParentContactPhone = NormalizePolishPhone(request.ParentContactPhone);
            participant.GuardianName = NormalizeShort(request.GuardianName, 200);
            participant.GuardianPhone = NormalizePolishPhone(request.GuardianPhone);
            participant.Notes = NormalizeLong(request.Notes, 2400);
            participant.HealthNotes = NormalizeLong(request.HealthNotes, 2400);
            participant.AccommodationType = NormalizeShort(request.AccommodationType, 64);
            participant.Status = NormalizeParticipantStatus(request.Status);
            participant.UpdatedAt = DateTimeOffset.UtcNow;

            if (!string.Equals(previousStatus, participant.Status, StringComparison.Ordinal))
            {
                dbContext.LimanowaRegistrationStatusLogs.Add(new LimanowaRegistrationStatusLog
                {
                    Id = Guid.NewGuid(),
                    EventId = access.EventId,
                    RelatedType = "participant",
                    RelatedId = participant.Id,
                    PreviousStatus = previousStatus,
                    NewStatus = participant.Status,
                    ChangedByType = "group-admin",
                    ChangedById = access.GroupId,
                    CreatedAt = participant.UpdatedAt
                });
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(await BuildParticipantAsync(dbContext, participant.Id, ct));
        });

        group.MapPost("/group-admin/questions", async (
            string token,
            LimanowaQuestionCreateRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveGroupAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link grupy." });
            }

            var text = NormalizeLong(request.Message, 2400);
            if (string.IsNullOrWhiteSpace(text))
            {
                return Results.BadRequest(new { error = "Treść pytania jest wymagana." });
            }

            var thread = await GetOrCreateThreadAsync(dbContext, access.EventId, "group", access.GroupId, ct);
            var now = DateTimeOffset.UtcNow;
            dbContext.LimanowaQuestionMessages.Add(new LimanowaQuestionMessage
            {
                Id = Guid.NewGuid(),
                ThreadId = thread.Id,
                AuthorType = "group-admin",
                Message = text,
                CreatedAt = now
            });
            thread.Status = "open";
            thread.UpdatedAt = now;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(await BuildThreadByIdAsync(dbContext, thread.Id, ct));
        });

        group.MapGet("/participant/zone", async (
            string token,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveParticipantAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link uczestnika." });
            }

            var limanowaEvent = await dbContext.LimanowaEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == access.EventId, ct);
            var participant = await dbContext.LimanowaParticipants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == access.ParticipantId, ct);
            if (limanowaEvent is null || participant is null)
            {
                return Results.NotFound();
            }

            var groupRow = await dbContext.LimanowaGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == participant.GroupId, ct);
            if (groupRow is null)
            {
                return Results.NotFound();
            }

            access.LastOpenedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            var policy = await GetPolicyLinksAsync(dbContext, limanowaEvent.Id, ct) ?? BuildDefaultPolicyLinks();
            var announcements = await BuildAnnouncementsAsync(dbContext, limanowaEvent.Id, "participant", ct);
            var thread = await BuildThreadAsync(dbContext, limanowaEvent.Id, "participant", participant.Id, ct);
            var participantResponse = await BuildParticipantAsync(dbContext, participant.Id, ct);

            return Results.Ok(new LimanowaParticipantZoneResponse(
                ToEventSiteResponse(limanowaEvent, policy, true),
                ToGroupResponse(groupRow),
                participantResponse,
                announcements,
                thread,
                ToPolicyLinksResponse(policy)));
        });

        group.MapPut("/participant/profile", async (
            string token,
            LimanowaParticipantSelfUpdateRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveParticipantAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link uczestnika." });
            }

            var participant = await dbContext.LimanowaParticipants
                .FirstOrDefaultAsync(x => x.Id == access.ParticipantId && x.EventId == access.EventId, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            var fullName = NormalizeShort(request.FullName, 200);
            var phone = NormalizePolishPhone(request.Phone);
            if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "Imię i nazwisko oraz telefon uczestnika są wymagane." });
            }

            participant.FullName = fullName;
            participant.Phone = phone;
            participant.ParishName = NormalizeShort(request.ParishName, 220) ?? participant.ParishName;
            participant.ParentContactName = NormalizeShort(request.ParentContactName, 200);
            participant.ParentContactPhone = NormalizePolishPhone(request.ParentContactPhone);
            participant.GuardianName = NormalizeShort(request.GuardianName, 200);
            participant.GuardianPhone = NormalizePolishPhone(request.GuardianPhone);
            participant.Notes = NormalizeLong(request.Notes, 2400);
            participant.HealthNotes = NormalizeLong(request.HealthNotes, 2400);

            var now = DateTimeOffset.UtcNow;
            participant.UpdatedAt = now;

            var consent = await dbContext.LimanowaConsentRecords
                .FirstOrDefaultAsync(x => x.ParticipantId == participant.Id, ct);
            if (consent is null)
            {
                consent = new LimanowaConsentRecord
                {
                    Id = Guid.NewGuid(),
                    ParticipantId = participant.Id,
                    RulesAccepted = request.RulesAccepted,
                    PrivacyAccepted = request.PrivacyAccepted,
                    SubmittedAt = now
                };
                dbContext.LimanowaConsentRecords.Add(consent);
            }
            else
            {
                consent.RulesAccepted = request.RulesAccepted;
                consent.PrivacyAccepted = request.PrivacyAccepted;
                consent.SubmittedAt = now;
            }

            var previousStatus = participant.Status;
            var statusFromCompletion = request.RulesAccepted && request.PrivacyAccepted
                ? "gotowy"
                : "w trakcie";
            participant.Status = statusFromCompletion;

            if (!string.Equals(previousStatus, participant.Status, StringComparison.Ordinal))
            {
                dbContext.LimanowaRegistrationStatusLogs.Add(new LimanowaRegistrationStatusLog
                {
                    Id = Guid.NewGuid(),
                    EventId = participant.EventId,
                    RelatedType = "participant",
                    RelatedId = participant.Id,
                    PreviousStatus = previousStatus,
                    NewStatus = participant.Status,
                    ChangedByType = "participant",
                    ChangedById = participant.Id,
                    CreatedAt = now
                });
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(await BuildParticipantAsync(dbContext, participant.Id, ct));
        });

        group.MapPost("/participant/questions", async (
            string token,
            LimanowaQuestionCreateRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var access = await ResolveParticipantAccessByTokenAsync(dbContext, token, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Nieprawidłowy lub nieaktywny link uczestnika." });
            }

            var text = NormalizeLong(request.Message, 2400);
            if (string.IsNullOrWhiteSpace(text))
            {
                return Results.BadRequest(new { error = "Treść pytania jest wymagana." });
            }

            var thread = await GetOrCreateThreadAsync(dbContext, access.EventId, "participant", access.ParticipantId, ct);
            var now = DateTimeOffset.UtcNow;
            dbContext.LimanowaQuestionMessages.Add(new LimanowaQuestionMessage
            {
                Id = Guid.NewGuid(),
                ThreadId = thread.Id,
                AuthorType = "participant",
                Message = text,
                CreatedAt = now
            });
            thread.Status = "open";
            thread.UpdatedAt = now;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(await BuildThreadByIdAsync(dbContext, thread.Id, ct));
        });

        group.MapGet("/{eventId:guid}/admin/dashboard", async (
            Guid eventId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var limanowaEvent = await dbContext.LimanowaEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (limanowaEvent is null)
            {
                return Results.NotFound();
            }

            var policy = await GetPolicyLinksAsync(dbContext, eventId, ct) ?? BuildDefaultPolicyLinks();
            var groups = await dbContext.LimanowaGroups.AsNoTracking()
                .Where(x => x.EventId == eventId)
                .OrderBy(x => x.CreatedAt)
                .ToListAsync(ct);

            var participants = await dbContext.LimanowaParticipants.AsNoTracking()
                .Where(x => x.EventId == eventId)
                .OrderBy(x => x.CreatedAt)
                .ToListAsync(ct);

            var participantIds = participants.Select(x => x.Id).ToArray();
            var consentMap = await dbContext.LimanowaConsentRecords.AsNoTracking()
                .Where(x => participantIds.Contains(x.ParticipantId))
                .ToDictionaryAsync(x => x.ParticipantId, ct);

            var announcements = await BuildAnnouncementsAsync(dbContext, eventId, "admin", ct);
            var threads = await BuildAllThreadsAsync(dbContext, eventId, ct);

            var accommodationAssigned = await dbContext.LimanowaAccommodationAssignments.AsNoTracking()
                .CountAsync(x => participantIds.Contains(x.ParticipantId), ct);

            var participantsReady = participants.Count(x => string.Equals(x.Status, "gotowy", StringComparison.Ordinal));
            var participantsNeedsFix = participants.Count(x => string.Equals(x.Status, "wymaga poprawy", StringComparison.Ordinal));
            var openThreads = threads.Count(x => string.Equals(x.Status, "open", StringComparison.Ordinal));

            return Results.Ok(new LimanowaAdminDashboardResponse(
                ToEventSiteResponse(limanowaEvent, policy, true),
                new LimanowaAdminStatsResponse(
                    groups.Count,
                    participants.Count,
                    participantsReady,
                    participantsNeedsFix,
                    accommodationAssigned,
                    openThreads,
                    announcements.Count),
                groups.Select(ToGroupResponse).ToList(),
                participants.Select(x => ToParticipantResponse(x, consentMap.GetValueOrDefault(x.Id))).ToList(),
                announcements,
                threads,
                ToPolicyLinksResponse(policy)));
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/admin/event-settings", async (
            Guid eventId,
            LimanowaAdminEventSettingsUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var limanowaEvent = await dbContext.LimanowaEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (limanowaEvent is null)
            {
                return Results.NotFound();
            }

            limanowaEvent.Title = NormalizeShort(request.Title, 220) ?? limanowaEvent.Title;
            limanowaEvent.Subtitle = NormalizeLong(request.Subtitle, 520) ?? limanowaEvent.Subtitle;
            limanowaEvent.Tagline = NormalizeShort(request.Tagline, 260) ?? limanowaEvent.Tagline;
            limanowaEvent.CapacityTotal = Math.Max(1, request.CapacityTotal);
            limanowaEvent.RegistrationOpen = request.RegistrationOpen;
            limanowaEvent.RegistrationGroupsDeadline = request.RegistrationGroupsDeadline;
            limanowaEvent.RegistrationParticipantsDeadline = request.RegistrationParticipantsDeadline;
            limanowaEvent.Published = request.Published;
            limanowaEvent.UpdatedUtc = DateTimeOffset.UtcNow;

            var policy = await EnsurePolicyLinksAsync(dbContext, eventId, ct);
            policy.PrivacyPolicyUrl = NormalizeShort(request.PrivacyPolicyUrl, 520) ?? policy.PrivacyPolicyUrl;
            policy.EventRulesUrl = NormalizeShort(request.EventRulesUrl, 520) ?? policy.EventRulesUrl;
            policy.ThingsToBringUrl = NormalizeShort(request.ThingsToBringUrl, 520) ?? policy.ThingsToBringUrl;
            policy.UpdatedAt = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(ToEventSiteResponse(limanowaEvent, policy, true));
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/admin/groups/{groupId:guid}/status", async (
            Guid eventId,
            Guid groupId,
            LimanowaGroupStatusUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var groupRow = await dbContext.LimanowaGroups
                .FirstOrDefaultAsync(x => x.Id == groupId && x.EventId == eventId, ct);
            if (groupRow is null)
            {
                return Results.NotFound();
            }

            var previous = groupRow.Status;
            groupRow.Status = NormalizeGroupStatus(request.Status);
            groupRow.UpdatedAt = DateTimeOffset.UtcNow;
            if (!string.Equals(previous, groupRow.Status, StringComparison.Ordinal))
            {
                dbContext.LimanowaRegistrationStatusLogs.Add(new LimanowaRegistrationStatusLog
                {
                    Id = Guid.NewGuid(),
                    EventId = eventId,
                    RelatedType = "group",
                    RelatedId = groupId,
                    PreviousStatus = previous,
                    NewStatus = groupRow.Status,
                    ChangedByType = "admin",
                    ChangedById = userId,
                    CreatedAt = groupRow.UpdatedAt
                });
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(ToGroupResponse(groupRow));
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/admin/participants/{participantId:guid}/status", async (
            Guid eventId,
            Guid participantId,
            LimanowaParticipantStatusUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var participant = await dbContext.LimanowaParticipants
                .FirstOrDefaultAsync(x => x.Id == participantId && x.EventId == eventId, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            var previous = participant.Status;
            participant.Status = NormalizeParticipantStatus(request.Status);
            participant.UpdatedAt = DateTimeOffset.UtcNow;
            if (!string.Equals(previous, participant.Status, StringComparison.Ordinal))
            {
                dbContext.LimanowaRegistrationStatusLogs.Add(new LimanowaRegistrationStatusLog
                {
                    Id = Guid.NewGuid(),
                    EventId = eventId,
                    RelatedType = "participant",
                    RelatedId = participantId,
                    PreviousStatus = previous,
                    NewStatus = participant.Status,
                    ChangedByType = "admin",
                    ChangedById = userId,
                    CreatedAt = participant.UpdatedAt
                });
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(await BuildParticipantAsync(dbContext, participantId, ct));
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/admin/accommodation/{participantId:guid}", async (
            Guid eventId,
            Guid participantId,
            LimanowaAccommodationUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var participant = await dbContext.LimanowaParticipants
                .FirstOrDefaultAsync(x => x.Id == participantId && x.EventId == eventId, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            var assignment = await dbContext.LimanowaAccommodationAssignments
                .FirstOrDefaultAsync(x => x.ParticipantId == participantId, ct);
            if (assignment is null)
            {
                assignment = new LimanowaAccommodationAssignment
                {
                    Id = Guid.NewGuid(),
                    ParticipantId = participantId,
                    Type = NormalizeShort(request.Type, 64) ?? "nieprzypisano",
                    Note = NormalizeLong(request.Note, 1200),
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                dbContext.LimanowaAccommodationAssignments.Add(assignment);
            }
            else
            {
                assignment.Type = NormalizeShort(request.Type, 64) ?? assignment.Type;
                assignment.Note = NormalizeLong(request.Note, 1200);
                assignment.UpdatedAt = DateTimeOffset.UtcNow;
            }

            participant.AccommodationType = assignment.Type;
            participant.UpdatedAt = assignment.UpdatedAt;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(await BuildParticipantAsync(dbContext, participantId, ct));
        }).RequireAuthorization();

        group.MapPost("/{eventId:guid}/admin/announcements", async (
            Guid eventId,
            LimanowaAnnouncementCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var limanowaEvent = await dbContext.LimanowaEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (limanowaEvent is null)
            {
                return Results.NotFound();
            }

            var title = NormalizeShort(request.Title, 220);
            var body = NormalizeLong(request.Body, 3200);
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(body))
            {
                return Results.BadRequest(new { error = "Tytuł i treść komunikatu są wymagane." });
            }

            var entity = new LimanowaAnnouncement
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                Title = title,
                Body = body,
                AudienceType = NormalizeAudienceType(request.AudienceType),
                PublishedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow
            };
            dbContext.LimanowaAnnouncements.Add(entity);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(ToAnnouncementResponse(entity));
        }).RequireAuthorization();

        group.MapPost("/{eventId:guid}/admin/questions/{threadId:guid}/reply", async (
            Guid eventId,
            Guid threadId,
            LimanowaAdminQuestionReplyRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var thread = await dbContext.LimanowaQuestionThreads
                .FirstOrDefaultAsync(x => x.Id == threadId && x.EventId == eventId, ct);
            if (thread is null)
            {
                return Results.NotFound();
            }

            var text = NormalizeLong(request.Message, 2400);
            if (string.IsNullOrWhiteSpace(text))
            {
                return Results.BadRequest(new { error = "Treść odpowiedzi jest wymagana." });
            }

            var now = DateTimeOffset.UtcNow;
            dbContext.LimanowaQuestionMessages.Add(new LimanowaQuestionMessage
            {
                Id = Guid.NewGuid(),
                ThreadId = threadId,
                AuthorType = "admin",
                Message = text,
                CreatedAt = now
            });
            thread.Status = NormalizeThreadStatus(request.Status ?? "answered");
            thread.UpdatedAt = now;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(await BuildThreadByIdAsync(dbContext, threadId, ct));
        }).RequireAuthorization();

        group.MapPost("/{eventId:guid}/admin/groups/{groupId:guid}/generate-access", async (
            Guid eventId,
            Guid groupId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var groupRow = await dbContext.LimanowaGroups
                .FirstOrDefaultAsync(x => x.Id == groupId && x.EventId == eventId, ct);
            if (groupRow is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var existing = await dbContext.LimanowaGroupAdminAccesses
                .Where(x => x.EventId == eventId && x.GroupId == groupId && x.Active)
                .ToListAsync(ct);
            foreach (var access in existing)
            {
                access.Active = false;
            }

            var token = CreateAccessToken();
            var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            var row = new LimanowaGroupAdminAccess
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                GroupId = groupId,
                TokenHash = tokenHash,
                Phone = groupRow.Phone,
                SentAt = now,
                LastOpenedAt = null,
                Active = true,
                CreatedAt = now
            };
            dbContext.LimanowaGroupAdminAccesses.Add(row);
            await dbContext.SaveChangesAsync(ct);

            var link = BuildAccessLink(context, $"/#/event/{DefaultSlug}/group-admin/{Uri.EscapeDataString(token)}");
            var smsHref = BuildSmsHref(groupRow.Phone, "Link do panelu grupy", link);

            return Results.Ok(new LimanowaAccessLinkResponse(row.Id, token, link, smsHref, now));
        }).RequireAuthorization();

        group.MapPost("/{eventId:guid}/admin/participants/{participantId:guid}/generate-access", async (
            Guid eventId,
            Guid participantId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var participant = await dbContext.LimanowaParticipants
                .FirstOrDefaultAsync(x => x.Id == participantId && x.EventId == eventId, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var existing = await dbContext.LimanowaParticipantAccesses
                .Where(x => x.EventId == eventId && x.ParticipantId == participantId && x.Active)
                .ToListAsync(ct);
            foreach (var access in existing)
            {
                access.Active = false;
            }

            var token = CreateAccessToken();
            var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            var row = new LimanowaParticipantAccess
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                ParticipantId = participantId,
                TokenHash = tokenHash,
                Phone = participant.Phone,
                SentAt = now,
                LastOpenedAt = null,
                Active = true,
                CreatedAt = now
            };
            dbContext.LimanowaParticipantAccesses.Add(row);
            await dbContext.SaveChangesAsync(ct);

            var link = BuildAccessLink(context, $"/#/event/{DefaultSlug}/participant/{Uri.EscapeDataString(token)}");
            var smsHref = BuildSmsHref(participant.Phone, "Link do panelu uczestnika", link);

            return Results.Ok(new LimanowaAccessLinkResponse(row.Id, token, link, smsHref, now));
        }).RequireAuthorization();

        group.MapGet("/{eventId:guid}/admin/exports/{kind}.csv", async (
            Guid eventId,
            string kind,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct))
            {
                return Results.Forbid();
            }

            var limanowaEvent = await dbContext.LimanowaEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (limanowaEvent is null)
            {
                return Results.NotFound();
            }

            var normalizedKind = (kind ?? string.Empty).Trim().ToLowerInvariant();
            var builder = new StringBuilder();

            if (normalizedKind == "groups")
            {
                builder.AppendLine("GroupId,Parafia,OsobaOdpowiedzialna,Telefon,Email,Uczestnicy,Opiekunowie,Status,CreatedAt");
                var rows = await dbContext.LimanowaGroups.AsNoTracking().Where(x => x.EventId == eventId).OrderBy(x => x.CreatedAt).ToListAsync(ct);
                foreach (var row in rows)
                {
                    builder.AppendLine(string.Join(",", new[]
                    {
                        EscapeCsv(row.Id.ToString()),
                        EscapeCsv(row.ParishName),
                        EscapeCsv(row.ResponsibleName),
                        EscapeCsv(row.Phone),
                        EscapeCsv(row.Email),
                        EscapeCsv(row.ExpectedParticipantCount.ToString(CultureInfo.InvariantCulture)),
                        EscapeCsv(row.ExpectedGuardianCount.ToString(CultureInfo.InvariantCulture)),
                        EscapeCsv(row.Status),
                        EscapeCsv(row.CreatedAt.ToString("O", CultureInfo.InvariantCulture))
                    }));
                }
            }
            else if (normalizedKind == "participants")
            {
                builder.AppendLine("ParticipantId,GroupId,ImieNazwisko,Telefon,Parafia,Status,OpiekunTelefon,RodzicTelefon,CreatedAt");
                var rows = await dbContext.LimanowaParticipants.AsNoTracking().Where(x => x.EventId == eventId).OrderBy(x => x.CreatedAt).ToListAsync(ct);
                foreach (var row in rows)
                {
                    builder.AppendLine(string.Join(",", new[]
                    {
                        EscapeCsv(row.Id.ToString()),
                        EscapeCsv(row.GroupId.ToString()),
                        EscapeCsv(row.FullName),
                        EscapeCsv(row.Phone),
                        EscapeCsv(row.ParishName),
                        EscapeCsv(row.Status),
                        EscapeCsv(row.GuardianPhone),
                        EscapeCsv(row.ParentContactPhone),
                        EscapeCsv(row.CreatedAt.ToString("O", CultureInfo.InvariantCulture))
                    }));
                }
            }
            else if (normalizedKind == "statuses")
            {
                builder.AppendLine("Id,RelatedType,RelatedId,PreviousStatus,NewStatus,ChangedByType,ChangedById,CreatedAt");
                var rows = await dbContext.LimanowaRegistrationStatusLogs.AsNoTracking()
                    .Where(x => x.EventId == eventId)
                    .OrderBy(x => x.CreatedAt)
                    .ToListAsync(ct);
                foreach (var row in rows)
                {
                    builder.AppendLine(string.Join(",", new[]
                    {
                        EscapeCsv(row.Id.ToString()),
                        EscapeCsv(row.RelatedType),
                        EscapeCsv(row.RelatedId.ToString()),
                        EscapeCsv(row.PreviousStatus),
                        EscapeCsv(row.NewStatus),
                        EscapeCsv(row.ChangedByType),
                        EscapeCsv(row.ChangedById?.ToString()),
                        EscapeCsv(row.CreatedAt.ToString("O", CultureInfo.InvariantCulture))
                    }));
                }
            }
            else if (normalizedKind == "accommodation")
            {
                builder.AppendLine("ParticipantId,ImieNazwisko,Typ,Notatka,UpdatedAt");
                var rows = await dbContext.LimanowaAccommodationAssignments.AsNoTracking().ToListAsync(ct);
                var participantMap = await dbContext.LimanowaParticipants.AsNoTracking()
                    .Where(x => x.EventId == eventId)
                    .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
                foreach (var row in rows.Where(x => participantMap.ContainsKey(x.ParticipantId)))
                {
                    builder.AppendLine(string.Join(",", new[]
                    {
                        EscapeCsv(row.ParticipantId.ToString()),
                        EscapeCsv(participantMap.GetValueOrDefault(row.ParticipantId)),
                        EscapeCsv(row.Type),
                        EscapeCsv(row.Note),
                        EscapeCsv(row.UpdatedAt.ToString("O", CultureInfo.InvariantCulture))
                    }));
                }
            }
            else if (normalizedKind == "consents")
            {
                builder.AppendLine("ParticipantId,ImieNazwisko,RulesAccepted,PrivacyAccepted,SubmittedAt");
                var participantMap = await dbContext.LimanowaParticipants.AsNoTracking()
                    .Where(x => x.EventId == eventId)
                    .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
                var rows = await dbContext.LimanowaConsentRecords.AsNoTracking().ToListAsync(ct);
                foreach (var row in rows.Where(x => participantMap.ContainsKey(x.ParticipantId)))
                {
                    builder.AppendLine(string.Join(",", new[]
                    {
                        EscapeCsv(row.ParticipantId.ToString()),
                        EscapeCsv(participantMap.GetValueOrDefault(row.ParticipantId)),
                        EscapeCsv(row.RulesAccepted ? "true" : "false"),
                        EscapeCsv(row.PrivacyAccepted ? "true" : "false"),
                        EscapeCsv(row.SubmittedAt.ToString("O", CultureInfo.InvariantCulture))
                    }));
                }
            }
            else if (normalizedKind == "questions")
            {
                builder.AppendLine("ThreadId,RelatedType,RelatedId,ThreadStatus,AuthorType,Message,CreatedAt");
                var threads = await dbContext.LimanowaQuestionThreads.AsNoTracking().Where(x => x.EventId == eventId).ToListAsync(ct);
                var threadIds = threads.Select(x => x.Id).ToArray();
                var messages = await dbContext.LimanowaQuestionMessages.AsNoTracking()
                    .Where(x => threadIds.Contains(x.ThreadId))
                    .OrderBy(x => x.CreatedAt)
                    .ToListAsync(ct);
                var threadMap = threads.ToDictionary(x => x.Id);
                foreach (var message in messages)
                {
                    var thread = threadMap.GetValueOrDefault(message.ThreadId);
                    if (thread is null)
                    {
                        continue;
                    }

                    builder.AppendLine(string.Join(",", new[]
                    {
                        EscapeCsv(thread.Id.ToString()),
                        EscapeCsv(thread.RelatedType),
                        EscapeCsv(thread.RelatedId.ToString()),
                        EscapeCsv(thread.Status),
                        EscapeCsv(message.AuthorType),
                        EscapeCsv(message.Message),
                        EscapeCsv(message.CreatedAt.ToString("O", CultureInfo.InvariantCulture))
                    }));
                }
            }
            else
            {
                return Results.NotFound();
            }

            return Results.File(
                Encoding.UTF8.GetBytes(builder.ToString()),
                "text/csv; charset=utf-8",
                $"limanowa-{normalizedKind}.csv");
        }).RequireAuthorization();
    }

    private static async Task<bool> IsGlobalEventsLimanowaAdminAsync(
        RecreatioDbContext dbContext,
        Guid userId,
        CancellationToken ct)
    {
        return await dbContext.PortalAdminAssignments.AsNoTracking()
            .AnyAsync(x => x.ScopeKey == GlobalEventsLimanowaAdminScope && x.UserId == userId, ct);
    }

    private static async Task<LimanowaEvent> EnsureDefaultEventProvisionedAsync(
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var existing = await dbContext.LimanowaEvents.FirstOrDefaultAsync(x => x.Slug == DefaultSlug, ct);
        if (existing is not null)
        {
            await EnsurePolicyLinksAsync(dbContext, existing.Id, ct);
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var created = BuildDefaultEvent();
        created.Id = Guid.NewGuid();
        created.CreatedUtc = now;
        created.UpdatedUtc = now;

        dbContext.LimanowaEvents.Add(created);
        await dbContext.SaveChangesAsync(ct);
        await EnsurePolicyLinksAsync(dbContext, created.Id, ct);
        return created;
    }

    private static LimanowaEvent BuildDefaultEvent()
    {
        return new LimanowaEvent
        {
            Id = Guid.Empty,
            Slug = DefaultSlug,
            Title = "Gra o wolność",
            Subtitle = "Zośka i parasol: Przygoda, która uczy. Historia, która porusza. Wspólnota, która formuje.",
            Tagline = "Śladami tych, którzy byli gotowi.",
            StartDate = new DateOnly(2026, 6, 19),
            EndDate = new DateOnly(2026, 6, 21),
            CapacityTotal = 40,
            RegistrationOpen = true,
            RegistrationGroupsDeadline = new DateOnly(2026, 5, 24),
            RegistrationParticipantsDeadline = new DateOnly(2026, 6, 1),
            Published = true,
            CreatedUtc = DateTimeOffset.UtcNow,
            UpdatedUtc = DateTimeOffset.UtcNow
        };
    }

    private static LimanowaPolicyLinkConfig BuildDefaultPolicyLinks()
    {
        return new LimanowaPolicyLinkConfig
        {
            Id = Guid.Empty,
            EventId = Guid.Empty,
            PrivacyPolicyUrl = "/#/legal",
            EventRulesUrl = "/#/event/limanowa/start?sekcja=faq",
            ThingsToBringUrl = "/#/event/limanowa/start?sekcja=co-zabrac",
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    private static async Task<LimanowaPolicyLinkConfig> EnsurePolicyLinksAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        CancellationToken ct)
    {
        var existing = await dbContext.LimanowaPolicyLinkConfigs.FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (existing is not null)
        {
            return existing;
        }

        var defaults = BuildDefaultPolicyLinks();
        defaults.Id = Guid.NewGuid();
        defaults.EventId = eventId;
        defaults.UpdatedAt = DateTimeOffset.UtcNow;
        dbContext.LimanowaPolicyLinkConfigs.Add(defaults);
        await dbContext.SaveChangesAsync(ct);
        return defaults;
    }

    private static async Task<LimanowaPolicyLinkConfig?> GetPolicyLinksAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        CancellationToken ct)
    {
        return await dbContext.LimanowaPolicyLinkConfigs.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == eventId, ct);
    }

    private static LimanowaEventSiteResponse ToEventSiteResponse(
        LimanowaEvent limanowaEvent,
        LimanowaPolicyLinkConfig policy,
        bool isProvisioned)
    {
        return new LimanowaEventSiteResponse(
            limanowaEvent.Id == Guid.Empty ? null : limanowaEvent.Id,
            limanowaEvent.Slug,
            limanowaEvent.Title,
            limanowaEvent.Subtitle,
            limanowaEvent.Tagline,
            limanowaEvent.StartDate,
            limanowaEvent.EndDate,
            limanowaEvent.CapacityTotal,
            limanowaEvent.RegistrationOpen,
            limanowaEvent.RegistrationGroupsDeadline,
            limanowaEvent.RegistrationParticipantsDeadline,
            limanowaEvent.Published,
            ToPolicyLinksResponse(policy),
            isProvisioned);
    }

    private static LimanowaPolicyLinksResponse ToPolicyLinksResponse(LimanowaPolicyLinkConfig policy)
    {
        return new LimanowaPolicyLinksResponse(
            policy.PrivacyPolicyUrl,
            policy.EventRulesUrl,
            policy.ThingsToBringUrl);
    }

    private static LimanowaGroupResponse ToGroupResponse(LimanowaGroup row)
    {
        return new LimanowaGroupResponse(
            row.Id,
            row.ParishName,
            row.ResponsibleName,
            row.Phone,
            row.Email,
            row.ExpectedParticipantCount,
            row.ExpectedGuardianCount,
            row.Notes,
            row.Status,
            row.CreatedAt,
            row.UpdatedAt);
    }

    private static LimanowaParticipantResponse ToParticipantResponse(
        LimanowaParticipant row,
        LimanowaConsentRecord? consent)
    {
        return new LimanowaParticipantResponse(
            row.Id,
            row.GroupId,
            row.FullName,
            row.Phone,
            row.ParishName,
            row.ParentContactName,
            row.ParentContactPhone,
            row.GuardianName,
            row.GuardianPhone,
            row.Notes,
            row.HealthNotes,
            row.AccommodationType,
            row.Status,
            consent?.RulesAccepted ?? false,
            consent?.PrivacyAccepted ?? false,
            consent?.SubmittedAt,
            row.CreatedAt,
            row.UpdatedAt);
    }

    private static LimanowaAnnouncementResponse ToAnnouncementResponse(LimanowaAnnouncement row)
    {
        return new LimanowaAnnouncementResponse(
            row.Id,
            row.Title,
            row.Body,
            row.AudienceType,
            row.PublishedAt);
    }

    private static async Task<IReadOnlyList<LimanowaParticipantResponse>> BuildParticipantsAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        Guid groupId,
        CancellationToken ct)
    {
        var rows = await dbContext.LimanowaParticipants.AsNoTracking()
            .Where(x => x.EventId == eventId && x.GroupId == groupId)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(ct);

        var participantIds = rows.Select(x => x.Id).ToArray();
        var consentMap = await dbContext.LimanowaConsentRecords.AsNoTracking()
            .Where(x => participantIds.Contains(x.ParticipantId))
            .ToDictionaryAsync(x => x.ParticipantId, ct);

        return rows.Select(x => ToParticipantResponse(x, consentMap.GetValueOrDefault(x.Id))).ToList();
    }

    private static async Task<LimanowaParticipantResponse> BuildParticipantAsync(
        RecreatioDbContext dbContext,
        Guid participantId,
        CancellationToken ct)
    {
        var row = await dbContext.LimanowaParticipants.AsNoTracking().FirstAsync(x => x.Id == participantId, ct);
        var consent = await dbContext.LimanowaConsentRecords.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == participantId, ct);
        return ToParticipantResponse(row, consent);
    }

    private static async Task<IReadOnlyList<LimanowaAnnouncementResponse>> BuildAnnouncementsAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        string audience,
        CancellationToken ct)
    {
        return await dbContext.LimanowaAnnouncements.AsNoTracking()
            .Where(x => x.EventId == eventId
                && (x.AudienceType == "all" || x.AudienceType == audience || audience == "admin"))
            .OrderByDescending(x => x.PublishedAt)
            .ThenByDescending(x => x.CreatedAt)
            .Take(120)
            .Select(x => ToAnnouncementResponse(x))
            .ToListAsync(ct);
    }

    private static async Task<LimanowaQuestionThreadResponse?> BuildThreadAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        string relatedType,
        Guid relatedId,
        CancellationToken ct)
    {
        var thread = await dbContext.LimanowaQuestionThreads.AsNoTracking()
            .FirstOrDefaultAsync(x => x.EventId == eventId && x.RelatedType == relatedType && x.RelatedId == relatedId, ct);
        if (thread is null)
        {
            return null;
        }

        return await BuildThreadByIdAsync(dbContext, thread.Id, ct);
    }

    private static async Task<IReadOnlyList<LimanowaQuestionThreadResponse>> BuildAllThreadsAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        CancellationToken ct)
    {
        var threads = await dbContext.LimanowaQuestionThreads.AsNoTracking()
            .Where(x => x.EventId == eventId)
            .OrderByDescending(x => x.UpdatedAt)
            .ToListAsync(ct);
        var threadIds = threads.Select(x => x.Id).ToArray();
        var messages = await dbContext.LimanowaQuestionMessages.AsNoTracking()
            .Where(x => threadIds.Contains(x.ThreadId))
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(ct);

        var messageMap = messages
            .GroupBy(x => x.ThreadId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<LimanowaQuestionMessageResponse>)g
                    .Select(m => new LimanowaQuestionMessageResponse(m.Id, m.AuthorType, m.Message, m.CreatedAt))
                    .ToList());

        return threads
            .Select(x => new LimanowaQuestionThreadResponse(
                x.Id,
                x.RelatedType,
                x.RelatedId,
                x.Status,
                x.CreatedAt,
                x.UpdatedAt,
                messageMap.GetValueOrDefault(x.Id, Array.Empty<LimanowaQuestionMessageResponse>())))
            .ToList();
    }

    private static async Task<LimanowaQuestionThreadResponse> BuildThreadByIdAsync(
        RecreatioDbContext dbContext,
        Guid threadId,
        CancellationToken ct)
    {
        var thread = await dbContext.LimanowaQuestionThreads.AsNoTracking().FirstAsync(x => x.Id == threadId, ct);
        var messages = await dbContext.LimanowaQuestionMessages.AsNoTracking()
            .Where(x => x.ThreadId == threadId)
            .OrderBy(x => x.CreatedAt)
            .Select(x => new LimanowaQuestionMessageResponse(x.Id, x.AuthorType, x.Message, x.CreatedAt))
            .ToListAsync(ct);

        return new LimanowaQuestionThreadResponse(
            thread.Id,
            thread.RelatedType,
            thread.RelatedId,
            thread.Status,
            thread.CreatedAt,
            thread.UpdatedAt,
            messages);
    }

    private static async Task<LimanowaQuestionThread> GetOrCreateThreadAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        string relatedType,
        Guid relatedId,
        CancellationToken ct)
    {
        var thread = await dbContext.LimanowaQuestionThreads
            .FirstOrDefaultAsync(x => x.EventId == eventId && x.RelatedType == relatedType && x.RelatedId == relatedId, ct);
        if (thread is not null)
        {
            return thread;
        }

        thread = new LimanowaQuestionThread
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            RelatedType = relatedType,
            RelatedId = relatedId,
            Status = "open",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.LimanowaQuestionThreads.Add(thread);
        await dbContext.SaveChangesAsync(ct);
        return thread;
    }

    private static async Task<LimanowaGroupAdminAccess?> ResolveGroupAccessByTokenAsync(
        RecreatioDbContext dbContext,
        string token,
        CancellationToken ct)
    {
        var normalized = (token ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return await dbContext.LimanowaGroupAdminAccesses
            .FirstOrDefaultAsync(x => x.Active && x.TokenHash == hash, ct);
    }

    private static async Task<LimanowaParticipantAccess?> ResolveParticipantAccessByTokenAsync(
        RecreatioDbContext dbContext,
        string token,
        CancellationToken ct)
    {
        var normalized = (token ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return await dbContext.LimanowaParticipantAccesses
            .FirstOrDefaultAsync(x => x.Active && x.TokenHash == hash, ct);
    }

    private static string CreateAccessToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string BuildAccessLink(HttpContext context, string hashPath)
    {
        if (string.IsNullOrWhiteSpace(context.Request.Host.Value))
        {
            return hashPath;
        }

        return $"{context.Request.Scheme}://{context.Request.Host}{hashPath}";
    }

    private static string BuildSmsHref(string? phone, string title, string link)
    {
        var normalizedPhone = NormalizePolishPhone(phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
        {
            return string.Empty;
        }

        var smsBody = $"Szczęść Boże,\n{title}\n{link}\n\nGra o wolność";
        return $"sms:{normalizedPhone}?body={Uri.EscapeDataString(smsBody)}";
    }

    private static string NormalizeGroupStatus(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedGroupStatuses.Contains(normalized, StringComparer.Ordinal)
            ? normalized
            : "nowe zgłoszenie";
    }

    private static string NormalizeParticipantStatus(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedParticipantStatuses.Contains(normalized, StringComparer.Ordinal)
            ? normalized
            : "nieuzupełniony";
    }

    private static string NormalizeThreadStatus(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedThreadStatuses.Contains(normalized, StringComparer.Ordinal)
            ? normalized
            : "open";
    }

    private static string NormalizeAudienceType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedAudiences.Contains(normalized, StringComparer.Ordinal) ? normalized : "all";
    }

    private static string? NormalizePolishPhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var digits = new string(value.Where(char.IsDigit).ToArray());
        string? national = null;
        if (digits.Length == 9)
        {
            national = digits;
        }
        else if (digits.Length == 11 && digits.StartsWith("48", StringComparison.Ordinal))
        {
            national = digits[2..];
        }
        else if (digits.Length == 13 && digits.StartsWith("0048", StringComparison.Ordinal))
        {
            national = digits[4..];
        }

        if (string.IsNullOrWhiteSpace(national) || national.Length != 9)
        {
            return null;
        }

        return $"+48{national}";
    }

    private static string? NormalizeShort(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
        {
            normalized = normalized[..maxLength];
        }

        return normalized;
    }

    private static string? NormalizeLong(string? value, int maxLength)
    {
        return NormalizeShort(value, maxLength);
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var escaped = value.Replace("\"", "\"\"", StringComparison.Ordinal);
        return $"\"{escaped}\"";
    }
}
