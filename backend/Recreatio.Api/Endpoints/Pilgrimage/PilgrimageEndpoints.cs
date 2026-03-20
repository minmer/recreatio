using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Globalization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Pilgrimage;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints.Pilgrimage;

public static class PilgrimageEndpoints
{
    private const string RoleKindPilgrimage = "pilgrimage";
    private const string RoleKindOrganizer = "pilgrimage-organizer";
    private const string RoleKindLogistics = "pilgrimage-logistics";
    private const string RoleKindMedical = "pilgrimage-medical";
    private const string RoleKindPublic = "pilgrimage-public";

    private static readonly string[] AllowedVariants =
    [
        "full",
        "saturday",
        "without-lodging",
        "with-lodging"
    ];
    private static readonly string[] AllowedTaskStatuses = ["todo", "doing", "done", "urgent"];
    private static readonly string[] AllowedTaskPriorities = ["low", "normal", "high", "critical"];
    private static readonly string[] AllowedAudiences = ["public", "participant", "organizer", "all"];
    private static readonly string[] AllowedRegistrationStatuses = ["pending", "confirmed", "cancelled", "rejected"];
    private static readonly string[] AllowedPaymentStatuses = ["pending", "paid", "waived", "refunded"];
    private static readonly string[] AllowedAttendanceStatuses = ["not-checked-in", "checked-in", "absent"];
    private static readonly string[] AllowedIssueKinds = ["problem", "resignation", "pickup", "health-alert", "question"];
    private static readonly string[] AllowedIssueStatuses = ["open", "in-progress", "resolved", "closed"];
    private static readonly string[] AllowedInquiryStatuses = ["new", "in-progress", "resolved", "closed"];
    private static readonly HashSet<string> PublicFallbackSlugs = new(StringComparer.OrdinalIgnoreCase) { "kal26" };
    private const string GlobalEventsLimanowaAdminScope = "events-limanowa";

    public static void MapPilgrimageEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/pilgrimage");

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

            var kal26Provisioned = await dbContext.PilgrimageEvents.AsNoTracking()
                .AnyAsync(x => x.Slug == "kal26", ct);

            return Results.Ok(new { hasAdmin, isCurrentUserAdmin, adminDisplayName, kal26Provisioned });
        });

        group.MapPost("/admin/events-limanowa/claim", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
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
                    return Results.Ok(new { claimed = true, alreadyOwner = true });
                }

                var existingAccount = await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == existing.UserId)
                    .Select(x => new { x.LoginId })
                    .FirstOrDefaultAsync(ct);
                var isStaleOrSystem = existingAccount is null
                    || string.Equals((existingAccount.LoginId ?? string.Empty).Trim(), "system", StringComparison.OrdinalIgnoreCase);

                if (!isStaleOrSystem)
                {
                    return Results.Conflict(new { error = "Admin already assigned." });
                }

                dbContext.PortalAdminAssignments.Remove(existing);
                await dbContext.SaveChangesAsync(ct);
            }

            var now = DateTimeOffset.UtcNow;
            dbContext.PortalAdminAssignments.Add(new PortalAdminAssignment
            {
                Id = Guid.NewGuid(),
                ScopeKey = GlobalEventsLimanowaAdminScope,
                UserId = userId,
                CreatedUtc = now
            });
            try
            {
                await dbContext.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                return Results.Conflict(new { error = "Admin already assigned." });
            }

            await ledgerService.AppendBusinessAsync(
                "PortalAdminClaimed",
                userId.ToString(),
                JsonSerializer.Serialize(new { scope = GlobalEventsLimanowaAdminScope, userId, createdUtc = now }),
                ct);

            return Results.Ok(new { claimed = true });
        }).RequireAuthorization();

        group.MapGet("", async (RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            var items = await dbContext.PilgrimageEvents.AsNoTracking()
                .OrderBy(x => x.StartDate)
                .ThenBy(x => x.Name)
                .Select(x => new PilgrimageSummaryResponse(
                    x.Id,
                    x.Slug,
                    x.Name,
                    x.Motto,
                    x.StartDate,
                    x.EndDate,
                    x.StartLocation,
                    x.EndLocation,
                    x.DistanceKm,
                    x.Theme))
                .ToListAsync(ct);

            return Results.Ok(items);
        });

        group.MapGet("/{slug}", async (string slug, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var normalizedSlug = slug.Trim().ToLowerInvariant();
            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);

            if (pilgrimage is null)
            {
                if (string.Equals(normalizedSlug, "kal26", StringComparison.OrdinalIgnoreCase))
                {
                    var defaultSite = CreateDefaultSiteForSlug("kal26");
                    return Results.Ok(new PilgrimageSiteResponse(
                        null,
                        "kal26",
                        "5. piesza pielgrzymka z Krakowa do Kalwarii Zebrzydowskiej",
                        "Droga, wspolnota i modlitwa",
                        new DateOnly(2026, 4, 17),
                        new DateOnly(2026, 4, 18),
                        "Krakow",
                        "Kalwaria Zebrzydowska",
                        42,
                        "pilgrimage",
                        defaultSite,
                        false));
                }

                return Results.NotFound();
            }

            var config = await dbContext.PilgrimageSiteConfigs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EventId == pilgrimage.Id && x.IsPublished, ct);
            var site = config is null ? CreateDefaultSiteForSlug(pilgrimage.Slug) : DeserializeSiteConfig(config, pilgrimage.Slug);

            return Results.Ok(new PilgrimageSiteResponse(
                pilgrimage.Id,
                pilgrimage.Slug,
                pilgrimage.Name,
                pilgrimage.Motto,
                pilgrimage.StartDate,
                pilgrimage.EndDate,
                pilgrimage.StartLocation,
                pilgrimage.EndLocation,
                pilgrimage.DistanceKm,
                pilgrimage.Theme,
                site,
                true));
        });

        group.MapPost("", async (
            PilgrimageCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ISessionSecretCache sessionSecretCache,
            ILedgerService ledgerService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
            await CreatePilgrimageInternalAsync(
                request,
                context,
                dbContext,
                keyRingService,
                encryptionService,
                roleCryptoService,
                sessionSecretCache,
                ledgerService,
                dataProtectionProvider,
                ct)).RequireAuthorization();

        group.MapPost("/admin/events-limanowa/bootstrap-kal26", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ISessionSecretCache sessionSecretCache,
            ILedgerService ledgerService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            if (!isGlobalAdmin)
            {
                return Results.Forbid();
            }

            var existing = await dbContext.PilgrimageEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == "kal26", ct);
            if (existing is not null)
            {
                var config = await dbContext.PilgrimageSiteConfigs.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.EventId == existing.Id && x.IsPublished, ct);
                var site = config is null ? CreateDefaultSiteForSlug(existing.Slug) : DeserializeSiteConfig(config, existing.Slug);
                return Results.Ok(new PilgrimageSiteResponse(
                    existing.Id,
                    existing.Slug,
                    existing.Name,
                    existing.Motto,
                    existing.StartDate,
                    existing.EndDate,
                    existing.StartLocation,
                    existing.EndLocation,
                    existing.DistanceKm,
                    existing.Theme,
                    site,
                    true));
            }

            var request = new PilgrimageCreateRequest(
                "5. piesza pielgrzymka z Krakowa do Kalwarii Zebrzydowskiej",
                "kal26",
                "Droga, wspolnota i modlitwa",
                new DateOnly(2026, 4, 17),
                new DateOnly(2026, 4, 18),
                "Krakow",
                "Kalwaria Zebrzydowska",
                42,
                "pilgrimage",
                CreateDefaultSiteForSlug("kal26"));

            return await CreatePilgrimageInternalAsync(
                request,
                context,
                dbContext,
                keyRingService,
                encryptionService,
                roleCryptoService,
                sessionSecretCache,
                ledgerService,
                dataProtectionProvider,
                ct);
        }).RequireAuthorization();

        group.MapPost("/{slug}/public/registrations", async (
            string slug,
            PilgrimageRegistrationRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IDataProtectionProvider dataProtectionProvider,
            IEncryptionService encryptionService,
            ILedgerService ledgerService,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("Pilgrimage.PublicRegistrations");
            try
            {
                var fullName = NormalizeShort(request.FullName, 200);
                var phone = NormalizePolishPhone(request.Phone);
                var emergencyName = NormalizeShort(request.EmergencyContactName, 200);
                var emergencyPhone = NormalizePolishPhone(request.EmergencyContactPhone);

                if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(phone) ||
                    string.IsNullOrWhiteSpace(emergencyName) || string.IsNullOrWhiteSpace(emergencyPhone))
                {
                    return Results.BadRequest(new { error = "Full name, valid phone (+48 and 9 digits) and emergency contact are required." });
                }

                if (!request.AcceptedTerms || !request.AcceptedRodo)
                {
                    return Results.BadRequest(new { error = "Terms and RODO consent are required." });
                }

                var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
                var pilgrimage = await dbContext.PilgrimageEvents.FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);
                if (pilgrimage is null)
                {
                    if (!IsPublicFallbackEnabledSlug(normalizedSlug))
                    {
                        return Results.NotFound();
                    }

                    await ledgerService.AppendBusinessAsync(
                        "PilgrimageRegistrationFallbackCaptured",
                        "public",
                        JsonSerializer.Serialize(new
                        {
                            slug = normalizedSlug,
                            fullName,
                            phone,
                            emergencyName,
                            emergencyPhone,
                            request.ParticipationVariant,
                            request.NeedsLodging,
                            request.NeedsBaggageTransport,
                            notes = NormalizeLong(request.HealthNotes, 1400),
                            createdUtc = DateTimeOffset.UtcNow
                        }),
                        ct);

                    return Results.Accepted($"/pilgrimage/{normalizedSlug}/public/registrations", new
                    {
                        fallback = true,
                        message = "Event is not provisioned yet. Registration has been captured in fallback inbox."
                    });
                }

                var variant = NormalizeVariant(request.ParticipationVariant);
                var participantKey = UnprotectEventDataKey(dataProtectionProvider, pilgrimage.Id, "participant", pilgrimage.ParticipantDataKeyServerEnc);
                if (participantKey is null)
                {
                    return Results.Problem(
                        title: "Registration key unavailable",
                        detail: "Event encryption key is not available. Please contact administrator.",
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                var payload = new PilgrimageParticipantPayload(
                    fullName,
                    phone,
                    NormalizeShort(request.Email, 180),
                    NormalizeShort(request.Parish, 180),
                    request.BirthDate,
                    request.IsMinor,
                    variant,
                    request.NeedsLodging,
                    request.NeedsBaggageTransport,
                    emergencyName,
                    emergencyPhone,
                    NormalizeLong(request.HealthNotes, 1400),
                    NormalizeLong(request.DietNotes, 800),
                    request.AcceptedTerms,
                    request.AcceptedRodo,
                    request.AcceptedImageConsent);

                var now = DateTimeOffset.UtcNow;
                var participantId = Guid.NewGuid();
                var payloadJson = JsonSerializer.SerializeToUtf8Bytes(payload);
                var payloadEnc = encryptionService.Encrypt(participantKey, payloadJson, participantId.ToByteArray());
                var identityDigest = SHA256.HashData(Encoding.UTF8.GetBytes($"{fullName.ToLowerInvariant()}|{phone.Trim()}"));

                var participant = new PilgrimageParticipant
                {
                    Id = participantId,
                    EventId = pilgrimage.Id,
                    ParticipationVariant = variant,
                    RegistrationStatus = "pending",
                    PaymentStatus = "pending",
                    AttendanceStatus = "not-checked-in",
                    NeedsLodging = request.NeedsLodging,
                    NeedsBaggageTransport = request.NeedsBaggageTransport,
                    IsMinor = request.IsMinor,
                    AcceptedTerms = request.AcceptedTerms,
                    AcceptedRodo = request.AcceptedRodo,
                    IdentityDigest = identityDigest,
                    PayloadEnc = payloadEnc,
                    PayloadDataKeyId = pilgrimage.ParticipantDataKeyId,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };

                var token = CreateParticipantAccessToken();
                var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
                var expiresUtc = now.AddDays(120);

                await using var registrationTx = await dbContext.Database.BeginTransactionAsync(ct);
                dbContext.PilgrimageParticipants.Add(participant);
                await dbContext.SaveChangesAsync(ct);

                dbContext.PilgrimageParticipantAccessTokens.Add(new PilgrimageParticipantAccessToken
                {
                    Id = Guid.NewGuid(),
                    EventId = pilgrimage.Id,
                    ParticipantId = participantId,
                    TokenHash = tokenHash,
                    ExpiresUtc = expiresUtc,
                    CreatedUtc = now
                });
                await dbContext.SaveChangesAsync(ct);
                await registrationTx.CommitAsync(ct);

                await ledgerService.AppendBusinessAsync(
                    "PilgrimageRegistrationCreated",
                    "public",
                    JsonSerializer.Serialize(new { pilgrimage.Id, participantId }),
                    ct);

                var origin = $"{context.Request.Scheme}://{context.Request.Host}";
                var accessPath = $"/#/event/{pilgrimage.Slug}/uczestnik?token={Uri.EscapeDataString(token)}";
                var accessLink = string.IsNullOrWhiteSpace(context.Request.Host.Value) ? accessPath : $"{origin}{accessPath}";

                return Results.Ok(new PilgrimageRegistrationResponse(participantId, token, accessLink, expiresUtc));
            }
            catch (DbUpdateException exception)
            {
                logger.LogError(exception, "Public registration DB failure for slug {Slug}", slug);
                var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
                if (IsPublicFallbackEnabledSlug(normalizedSlug))
                {
                    dbContext.ChangeTracker.Clear();
                    await ledgerService.AppendBusinessAsync(
                        "PilgrimageRegistrationFallbackCaptured",
                        "public",
                        JsonSerializer.Serialize(new
                        {
                            slug = normalizedSlug,
                            fullName = NormalizeShort(request.FullName, 200),
                            phone = NormalizePolishPhone(request.Phone),
                            emergencyName = NormalizeShort(request.EmergencyContactName, 200),
                            emergencyPhone = NormalizePolishPhone(request.EmergencyContactPhone),
                            reason = "db-update-exception",
                            createdUtc = DateTimeOffset.UtcNow
                        }),
                        ct);

                    return Results.Accepted($"/pilgrimage/{normalizedSlug}/public/registrations", new
                    {
                        fallback = true,
                        message = "Registration persistence failed. Data has been captured in fallback inbox."
                    });
                }

                return Results.Problem(
                    title: "Registration unavailable",
                    detail: "Database error while saving registration.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Public registration failure for slug {Slug}", slug);
                return Results.Problem(
                    title: "Registration unavailable",
                    detail: "Unexpected server error while processing registration.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        group.MapPost("/{slug}/public/contact", async (
            string slug,
            PilgrimageContactInquiryCreateRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
            var name = NormalizeShort(request.Name, 180);
            var topic = NormalizeShort(request.Topic, 120);
            var message = NormalizeLong(request.Message, 2400);
            var phone = NormalizePolishPhone(request.Phone);
            var isPublicQuestion = request.IsPublicQuestion;
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(topic) || string.IsNullOrWhiteSpace(message))
            {
                return Results.BadRequest(new { error = "Name, topic and message are required." });
            }
            if (!isPublicQuestion && string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "Phone is required for private answer and must be in +48XXXXXXXXX format." });
            }
            if (!string.IsNullOrWhiteSpace(request.Phone) && string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "Phone must be in +48XXXXXXXXX format." });
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);
            if (pilgrimage is null)
            {
                if (!IsPublicFallbackEnabledSlug(normalizedSlug))
                {
                    return Results.NotFound();
                }

                var fallbackInquiryId = Guid.NewGuid();
                await ledgerService.AppendBusinessAsync(
                    "PilgrimageContactInquiryFallbackCaptured",
                    "public",
                    JsonSerializer.Serialize(new
                    {
                        inquiryId = fallbackInquiryId,
                        slug = normalizedSlug,
                        name,
                        phone,
                        isPublicQuestion,
                        topic,
                        message,
                        createdUtc = DateTimeOffset.UtcNow
                    }),
                    ct);

                return Results.Ok(fallbackInquiryId);
            }

            var now = DateTimeOffset.UtcNow;
            var entity = new PilgrimageContactInquiry
            {
                Id = Guid.NewGuid(),
                EventId = pilgrimage.Id,
                Name = name,
                Phone = phone,
                IsPublicQuestion = isPublicQuestion,
                Email = NormalizeShort(request.Email, 180),
                Topic = topic,
                Message = message,
                Status = "new",
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.PilgrimageContactInquiries.Add(entity);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageContactInquiryCreated",
                "public",
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, inquiryId = entity.Id, entity.Topic }),
                ct);

            return Results.Ok(entity.Id);
        });

        group.MapGet("/{slug}/public/contact/answers", async (
            string slug,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var answers = await dbContext.PilgrimageContactInquiries.AsNoTracking()
                .Where(x => x.EventId == pilgrimage.Id && x.IsPublicQuestion && !string.IsNullOrEmpty(x.PublicAnswer))
                .OrderByDescending(x => x.PublicAnsweredUtc ?? x.UpdatedUtc)
                .ThenByDescending(x => x.CreatedUtc)
                .Take(120)
                .Select(x => new PilgrimagePublicInquiryAnswerResponse(
                    x.Id,
                    x.Name,
                    x.Topic,
                    x.Message,
                    x.PublicAnswer ?? string.Empty,
                    x.PublicAnsweredBy,
                    x.PublicAnsweredUtc,
                    x.CreatedUtc))
                .ToListAsync(ct);

            return Results.Ok(answers);
        });

        group.MapGet("/{slug}/participant-zone", async (
            string slug,
            string token,
            RecreatioDbContext dbContext,
            IDataProtectionProvider dataProtectionProvider,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            if (string.IsNullOrWhiteSpace(token))
            {
                return Results.BadRequest(new { error = "Token is required." });
            }

            var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim()));
            var now = DateTimeOffset.UtcNow;
            var access = await dbContext.PilgrimageParticipantAccessTokens
                .FirstOrDefaultAsync(x => x.EventId == pilgrimage.Id
                    && x.RevokedUtc == null
                    && x.ExpiresUtc >= now
                    && x.TokenHash == tokenHash, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Invalid participant access token." });
            }

            var participant = await dbContext.PilgrimageParticipants.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == access.ParticipantId && x.EventId == pilgrimage.Id, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            var participantKey = UnprotectEventDataKey(dataProtectionProvider, pilgrimage.Id, "participant", pilgrimage.ParticipantDataKeyServerEnc);
            if (participantKey is null)
            {
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }

            var payload = DecryptParticipantPayload(participant, participantKey, encryptionService);
            if (payload is null)
            {
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }

            var config = await dbContext.PilgrimageSiteConfigs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EventId == pilgrimage.Id && x.IsPublished, ct);
            var site = config is null ? CreateDefaultSiteForSlug(pilgrimage.Slug) : DeserializeSiteConfig(config, pilgrimage.Slug);

            var announcements = await dbContext.PilgrimageAnnouncements.AsNoTracking()
                .Where(x => x.EventId == pilgrimage.Id && (x.Audience == "participant" || x.Audience == "all"))
                .OrderByDescending(x => x.CreatedUtc)
                .Take(30)
                .Select(x => new PilgrimageAnnouncementResponse(
                    x.Id,
                    x.Audience,
                    x.Title,
                    x.Body,
                    x.IsCritical,
                    x.CreatedUtc))
                .ToListAsync(ct);

            access.LastUsedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            var profile = new PilgrimageParticipantProfile(
                participant.Id,
                payload.FullName,
                payload.Phone,
                payload.Email,
                payload.Parish,
                payload.BirthDate,
                payload.IsMinor,
                payload.ParticipationVariant,
                participant.GroupName,
                payload.NeedsLodging,
                payload.NeedsBaggageTransport,
                payload.EmergencyContactName,
                payload.EmergencyContactPhone,
                payload.HealthNotes,
                payload.DietNotes,
                participant.RegistrationStatus,
                participant.PaymentStatus,
                participant.AttendanceStatus,
                participant.CreatedUtc);

            return Results.Ok(new PilgrimageParticipantZoneResponse(profile, site.Participant, announcements));
        });

        group.MapPost("/{slug}/participant-zone/issues", async (
            string slug,
            string token,
            PilgrimageParticipantIssueCreateRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            var normalizedSlug = (slug ?? string.Empty).Trim().ToLowerInvariant();
            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            if (string.IsNullOrWhiteSpace(token))
            {
                return Results.BadRequest(new { error = "Token is required." });
            }

            var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim()));
            var now = DateTimeOffset.UtcNow;
            var access = await dbContext.PilgrimageParticipantAccessTokens.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EventId == pilgrimage.Id
                    && x.RevokedUtc == null
                    && x.ExpiresUtc >= now
                    && x.TokenHash == tokenHash, ct);
            if (access is null)
            {
                return Results.NotFound(new { error = "Invalid participant access token." });
            }

            var kind = NormalizeIssueKind(request.Kind);
            var message = NormalizeLong(request.Message, 2400);
            if (string.IsNullOrWhiteSpace(message))
            {
                return Results.BadRequest(new { error = "Message is required." });
            }

            var issue = new PilgrimageParticipantIssue
            {
                Id = Guid.NewGuid(),
                EventId = pilgrimage.Id,
                ParticipantId = access.ParticipantId,
                Kind = kind,
                Message = message,
                Status = "open",
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.PilgrimageParticipantIssues.Add(issue);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageParticipantIssueCreated",
                "participant",
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, issueId = issue.Id, issue.ParticipantId, issue.Kind }),
                ct);

            return Results.Ok(issue.Id);
        });

        group.MapGet("/{eventId:guid}/organizer/dashboard", async (
            Guid eventId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var canReadHealthNotes = isGlobalAdmin
                || keyRing.ReadKeys.ContainsKey(pilgrimage.OrganizerRoleId)
                || keyRing.ReadKeys.ContainsKey(pilgrimage.MedicalRoleId);

            var participantKey = UnprotectEventDataKey(dataProtectionProvider, pilgrimage.Id, "participant", pilgrimage.ParticipantDataKeyServerEnc);
            if (participantKey is null)
            {
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }

            var participantsRaw = await dbContext.PilgrimageParticipants.AsNoTracking()
                .Where(x => x.EventId == pilgrimage.Id)
                .OrderByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var participants = new List<PilgrimageOrganizerParticipantRow>(participantsRaw.Count);
            foreach (var participant in participantsRaw)
            {
                var payload = DecryptParticipantPayload(participant, participantKey, encryptionService);
                if (payload is null)
                {
                    continue;
                }

                participants.Add(new PilgrimageOrganizerParticipantRow(
                    participant.Id,
                    payload.FullName,
                    payload.Phone,
                    payload.Email,
                    participant.ParticipationVariant,
                    participant.GroupName,
                    participant.NeedsLodging,
                    participant.NeedsBaggageTransport,
                    participant.IsMinor,
                    participant.RegistrationStatus,
                    participant.PaymentStatus,
                    participant.AttendanceStatus,
                    payload.EmergencyContactName,
                    payload.EmergencyContactPhone,
                    canReadHealthNotes ? payload.HealthNotes : null,
                    payload.DietNotes,
                    participant.CreatedUtc));
            }

            var announcements = await dbContext.PilgrimageAnnouncements.AsNoTracking()
                .Where(x => x.EventId == pilgrimage.Id)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(120)
                .Select(x => new PilgrimageAnnouncementResponse(
                    x.Id,
                    x.Audience,
                    x.Title,
                    x.Body,
                    x.IsCritical,
                    x.CreatedUtc))
                .ToListAsync(ct);

            var tasks = await dbContext.PilgrimageTasks.AsNoTracking()
                .Where(x => x.EventId == pilgrimage.Id)
                .OrderBy(x => x.Status)
                .ThenByDescending(x => x.UpdatedUtc)
                .Take(300)
                .Select(x => new PilgrimageTaskResponse(
                    x.Id,
                    x.Title,
                    x.Description,
                    x.Status,
                    x.Priority,
                    x.Assignee,
                    x.Comments,
                    x.Attachments,
                    x.DueUtc,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);

            var participantNameLookup = participants
                .ToDictionary(x => x.Id, x => x.FullName);

            var issues = await dbContext.PilgrimageParticipantIssues.AsNoTracking()
                .Where(x => x.EventId == pilgrimage.Id)
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(300)
                .ToListAsync(ct);
            var issueRows = issues
                .Select(x => new PilgrimageParticipantIssueResponse(
                    x.Id,
                    x.ParticipantId,
                    participantNameLookup.GetValueOrDefault(x.ParticipantId, "Uczestnik"),
                    x.Kind,
                    x.Message,
                    x.Status,
                    x.ResolutionNote,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToList();

            var inquiries = await dbContext.PilgrimageContactInquiries.AsNoTracking()
                .Where(x => x.EventId == pilgrimage.Id)
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(200)
                .Select(x => new PilgrimageContactInquiryResponse(
                    x.Id,
                    x.Name,
                    x.Phone,
                    x.IsPublicQuestion,
                    x.Email,
                    x.Topic,
                    x.Message,
                    x.Status,
                    x.PublicAnswer,
                    x.PublicAnsweredBy,
                    x.PublicAnsweredUtc,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);

            var config = await dbContext.PilgrimageSiteConfigs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EventId == pilgrimage.Id && x.IsPublished, ct);
            var site = config is null ? CreateDefaultSiteForSlug(pilgrimage.Slug) : DeserializeSiteConfig(config, pilgrimage.Slug);

            var stats = new PilgrimageOrganizerStatsResponse(
                participants.Count,
                participants.Count(x => string.Equals(x.RegistrationStatus, "confirmed", StringComparison.OrdinalIgnoreCase)),
                participants.Count(x => string.Equals(x.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)),
                participants.Count(x => x.NeedsLodging),
                participants.Count(x => !string.Equals(x.ParticipationVariant, "full", StringComparison.OrdinalIgnoreCase)),
                participants.Count(x => x.IsMinor),
                tasks.Count(x => !string.Equals(x.Status, "done", StringComparison.OrdinalIgnoreCase)),
                announcements.Count(x => x.IsCritical));

            return Results.Ok(new PilgrimageOrganizerDashboardResponse(
                stats,
                participants,
                announcements,
                tasks,
                issueRows,
                inquiries,
                site.Organizer));
        }).RequireAuthorization();

        group.MapPost("/{eventId:guid}/organizer/announcements", async (
            Guid eventId,
            PilgrimageAnnouncementCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var title = NormalizeShort(request.Title, 180);
            var body = NormalizeLong(request.Body, 2400);
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(body))
            {
                return Results.BadRequest(new { error = "Title and body are required." });
            }

            var audience = NormalizeAudience(request.Audience);
            var roleId = isGlobalAdmin ? pilgrimage.OrganizerRoleId : ResolveActorRoleId(keyRing, pilgrimage);
            var now = DateTimeOffset.UtcNow;
            var entity = new PilgrimageAnnouncement
            {
                Id = Guid.NewGuid(),
                EventId = pilgrimage.Id,
                Audience = audience,
                Title = title,
                Body = body,
                IsCritical = request.IsCritical,
                CreatedByRoleId = roleId,
                CreatedUtc = now
            };

            dbContext.PilgrimageAnnouncements.Add(entity);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageAnnouncementCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, announcementId = entity.Id, entity.Audience, entity.IsCritical }),
                ct);

            return Results.Ok(entity.Id);
        }).RequireAuthorization();

        group.MapPost("/{eventId:guid}/organizer/tasks", async (
            Guid eventId,
            PilgrimageTaskCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var title = NormalizeShort(request.Title, 180);
            var description = NormalizeLong(request.Description, 2400);
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(description))
            {
                return Results.BadRequest(new { error = "Title and description are required." });
            }

            var now = DateTimeOffset.UtcNow;
            var entity = new PilgrimageTask
            {
                Id = Guid.NewGuid(),
                EventId = pilgrimage.Id,
                Title = title,
                Description = description,
                Status = NormalizeTaskStatus(request.Status),
                Priority = NormalizeTaskPriority(request.Priority),
                Assignee = NormalizeShort(request.Assignee, 160) ?? string.Empty,
                Comments = NormalizeLong(request.Comments, 4000),
                Attachments = NormalizeLong(request.Attachments, 2000),
                DueUtc = request.DueUtc,
                CreatedByRoleId = isGlobalAdmin ? pilgrimage.OrganizerRoleId : ResolveActorRoleId(keyRing, pilgrimage),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.PilgrimageTasks.Add(entity);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageTaskCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, taskId = entity.Id, entity.Status, entity.Priority }),
                ct);

            return Results.Ok(entity.Id);
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/organizer/tasks/{taskId:guid}", async (
            Guid eventId,
            Guid taskId,
            PilgrimageTaskUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var task = await dbContext.PilgrimageTasks
                .FirstOrDefaultAsync(x => x.EventId == eventId && x.Id == taskId, ct);
            if (task is null)
            {
                return Results.NotFound();
            }

            var title = NormalizeShort(request.Title, 180);
            var description = NormalizeLong(request.Description, 2400);
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(description))
            {
                return Results.BadRequest(new { error = "Title and description are required." });
            }

            task.Title = title;
            task.Description = description;
            task.Status = NormalizeTaskStatus(request.Status);
            task.Priority = NormalizeTaskPriority(request.Priority);
            task.Assignee = NormalizeShort(request.Assignee, 160) ?? string.Empty;
            task.Comments = NormalizeLong(request.Comments, 4000);
            task.Attachments = NormalizeLong(request.Attachments, 2000);
            task.DueUtc = request.DueUtc;
            task.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageTaskUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, taskId = task.Id, task.Status, task.Priority }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/organizer/participants/{participantId:guid}", async (
            Guid eventId,
            Guid participantId,
            PilgrimageParticipantUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var participant = await dbContext.PilgrimageParticipants
                .FirstOrDefaultAsync(x => x.EventId == eventId && x.Id == participantId, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            participant.RegistrationStatus = NormalizeRegistrationStatus(request.RegistrationStatus);
            participant.PaymentStatus = NormalizePaymentStatus(request.PaymentStatus);
            participant.AttendanceStatus = NormalizeAttendanceStatus(request.AttendanceStatus);
            participant.GroupName = NormalizeShort(request.GroupName, 120);
            if (request.NeedsLodging.HasValue)
            {
                participant.NeedsLodging = request.NeedsLodging.Value;
            }
            if (request.NeedsBaggageTransport.HasValue)
            {
                participant.NeedsBaggageTransport = request.NeedsBaggageTransport.Value;
            }
            participant.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageParticipantUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, participantId = participant.Id, participant.RegistrationStatus, participant.PaymentStatus, participant.GroupName }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/organizer/issues/{issueId:guid}", async (
            Guid eventId,
            Guid issueId,
            PilgrimageParticipantIssueUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var issue = await dbContext.PilgrimageParticipantIssues
                .FirstOrDefaultAsync(x => x.EventId == eventId && x.Id == issueId, ct);
            if (issue is null)
            {
                return Results.NotFound();
            }

            issue.Status = NormalizeIssueStatus(request.Status);
            issue.ResolutionNote = NormalizeLong(request.ResolutionNote, 1200);
            issue.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageParticipantIssueUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, issueId = issue.Id, issue.Status }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPut("/{eventId:guid}/organizer/inquiries/{inquiryId:guid}", async (
            Guid eventId,
            Guid inquiryId,
            PilgrimageContactInquiryUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var inquiry = await dbContext.PilgrimageContactInquiries
                .FirstOrDefaultAsync(x => x.EventId == eventId && x.Id == inquiryId, ct);
            if (inquiry is null)
            {
                return Results.NotFound();
            }

            var responder = await dbContext.UserAccounts.AsNoTracking()
                .Where(x => x.Id == userId)
                .Select(x => x.DisplayName ?? x.LoginId)
                .FirstOrDefaultAsync(ct);
            var publicAnswer = NormalizeLong(request.PublicAnswer, 2400);
            inquiry.Status = NormalizeInquiryStatus(request.Status);
            inquiry.PublicAnswer = publicAnswer;
            if (string.IsNullOrWhiteSpace(publicAnswer))
            {
                inquiry.PublicAnsweredBy = null;
                inquiry.PublicAnsweredUtc = null;
            }
            else
            {
                inquiry.PublicAnsweredBy = responder ?? userId.ToString();
                inquiry.PublicAnsweredUtc = DateTimeOffset.UtcNow;
            }
            inquiry.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageContactInquiryUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, inquiryId = inquiry.Id, inquiry.Status, inquiry.PublicAnsweredUtc }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapDelete("/{eventId:guid}/organizer/inquiries/{inquiryId:guid}", async (
            Guid eventId,
            Guid inquiryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var inquiry = await dbContext.PilgrimageContactInquiries
                .FirstOrDefaultAsync(x => x.EventId == eventId && x.Id == inquiryId, ct);
            if (inquiry is null)
            {
                return Results.NotFound();
            }

            dbContext.PilgrimageContactInquiries.Remove(inquiry);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendBusinessAsync(
                "PilgrimageContactInquiryDeleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { pilgrimageId = pilgrimage.Id, inquiryId }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapGet("/{eventId:guid}/organizer/exports/{kind}.csv", async (
            Guid eventId,
            string kind,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var normalizedKind = (kind ?? string.Empty).Trim().ToLowerInvariant();
            var supportedKinds = new HashSet<string>(StringComparer.Ordinal)
            {
                "participants",
                "lodging",
                "payments",
                "contacts",
                "groups",
                "attendance"
            };
            if (!supportedKinds.Contains(normalizedKind))
            {
                return Results.NotFound();
            }

            var participantKey = UnprotectEventDataKey(dataProtectionProvider, pilgrimage.Id, "participant", pilgrimage.ParticipantDataKeyServerEnc);
            if (participantKey is null)
            {
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }

            var rows = await dbContext.PilgrimageParticipants.AsNoTracking()
                .Where(x => x.EventId == eventId)
                .OrderBy(x => x.CreatedUtc)
                .ToListAsync(ct);

            var builder = new StringBuilder();

            if (string.Equals(normalizedKind, "participants", StringComparison.Ordinal))
            {
                builder.AppendLine("Id,FullName,Phone,Email,ParticipationVariant,GroupName,NeedsLodging,NeedsBaggageTransport,IsMinor,RegistrationStatus,PaymentStatus,AttendanceStatus,EmergencyContactName,EmergencyContactPhone,CreatedUtc");
                foreach (var row in rows)
                {
                    var payload = DecryptParticipantPayload(row, participantKey, encryptionService);
                    if (payload is null)
                    {
                        continue;
                    }

                    builder.Append(EscapeCsv(row.Id.ToString()));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.FullName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.Phone));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.Email));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.ParticipationVariant));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.GroupName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.NeedsLodging ? "true" : "false"));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.NeedsBaggageTransport ? "true" : "false"));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.IsMinor ? "true" : "false"));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.RegistrationStatus));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.PaymentStatus));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.AttendanceStatus));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.EmergencyContactName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.EmergencyContactPhone));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.CreatedUtc.ToString("O", CultureInfo.InvariantCulture)));
                    builder.AppendLine();
                }
            }
            else if (string.Equals(normalizedKind, "lodging", StringComparison.Ordinal))
            {
                builder.AppendLine("Id,FullName,Phone,ParticipationVariant,GroupName,NeedsLodging,NeedsBaggageTransport,CreatedUtc");
                foreach (var row in rows)
                {
                    var payload = DecryptParticipantPayload(row, participantKey, encryptionService);
                    if (payload is null)
                    {
                        continue;
                    }

                    builder.Append(EscapeCsv(row.Id.ToString()));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.FullName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.Phone));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.ParticipationVariant));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.GroupName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.NeedsLodging ? "true" : "false"));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.NeedsBaggageTransport ? "true" : "false"));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.CreatedUtc.ToString("O", CultureInfo.InvariantCulture)));
                    builder.AppendLine();
                }
            }
            else if (string.Equals(normalizedKind, "payments", StringComparison.Ordinal))
            {
                builder.AppendLine("Id,FullName,Phone,ParticipationVariant,RegistrationStatus,PaymentStatus,AttendanceStatus,CreatedUtc");
                foreach (var row in rows)
                {
                    var payload = DecryptParticipantPayload(row, participantKey, encryptionService);
                    if (payload is null)
                    {
                        continue;
                    }

                    builder.Append(EscapeCsv(row.Id.ToString()));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.FullName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.Phone));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.ParticipationVariant));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.RegistrationStatus));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.PaymentStatus));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.AttendanceStatus));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.CreatedUtc.ToString("O", CultureInfo.InvariantCulture)));
                    builder.AppendLine();
                }
            }
            else if (string.Equals(normalizedKind, "contacts", StringComparison.Ordinal))
            {
                builder.AppendLine("Id,FullName,Phone,Email,EmergencyContactName,EmergencyContactPhone,GroupName");
                foreach (var row in rows)
                {
                    var payload = DecryptParticipantPayload(row, participantKey, encryptionService);
                    if (payload is null)
                    {
                        continue;
                    }

                    builder.Append(EscapeCsv(row.Id.ToString()));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.FullName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.Phone));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.Email));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.EmergencyContactName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.EmergencyContactPhone));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.GroupName));
                    builder.AppendLine();
                }
            }
            else if (string.Equals(normalizedKind, "groups", StringComparison.Ordinal))
            {
                builder.AppendLine("GroupName,ParticipantsCount,Participants");
                var grouped = rows
                    .GroupBy(x => string.IsNullOrWhiteSpace(x.GroupName) ? "unassigned" : x.GroupName!, StringComparer.OrdinalIgnoreCase)
                    .OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase);

                foreach (var group in grouped)
                {
                    var participantsInGroup = new List<string>();
                    foreach (var row in group)
                    {
                        var payload = DecryptParticipantPayload(row, participantKey, encryptionService);
                        if (payload is null)
                        {
                            continue;
                        }

                        participantsInGroup.Add(payload.FullName);
                    }

                    builder.Append(EscapeCsv(group.Key));
                    builder.Append(',');
                    builder.Append(EscapeCsv(participantsInGroup.Count.ToString(CultureInfo.InvariantCulture)));
                    builder.Append(',');
                    builder.Append(EscapeCsv(string.Join(" | ", participantsInGroup)));
                    builder.AppendLine();
                }
            }
            else
            {
                builder.AppendLine("Id,FullName,ParticipationVariant,GroupName,AttendanceStatus");
                foreach (var row in rows)
                {
                    var payload = DecryptParticipantPayload(row, participantKey, encryptionService);
                    if (payload is null)
                    {
                        continue;
                    }

                    builder.Append(EscapeCsv(row.Id.ToString()));
                    builder.Append(',');
                    builder.Append(EscapeCsv(payload.FullName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.ParticipationVariant));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.GroupName));
                    builder.Append(',');
                    builder.Append(EscapeCsv(row.AttendanceStatus));
                    builder.AppendLine();
                }
            }

            return Results.File(
                Encoding.UTF8.GetBytes(builder.ToString()),
                "text/csv; charset=utf-8",
                $"{normalizedKind}.csv");
        }).RequireAuthorization();

        group.MapGet("/{eventId:guid}/organizer/registrations/export", async (
            Guid eventId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var participantKey = UnprotectEventDataKey(dataProtectionProvider, pilgrimage.Id, "participant", pilgrimage.ParticipantDataKeyServerEnc);
            if (participantKey is null)
            {
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }

            var rows = await dbContext.PilgrimageParticipants.AsNoTracking()
                .Where(x => x.EventId == eventId)
                .OrderBy(x => x.CreatedUtc)
                .ToListAsync(ct);

            var transferRows = new List<PilgrimageRegistrationTransferRow>(rows.Count);
            foreach (var row in rows)
            {
                var payload = DecryptParticipantPayload(row, participantKey, encryptionService);
                if (payload is null)
                {
                    continue;
                }

                transferRows.Add(new PilgrimageRegistrationTransferRow(
                    payload.FullName,
                    payload.Phone,
                    payload.Email,
                    payload.Parish,
                    payload.BirthDate,
                    payload.IsMinor,
                    payload.ParticipationVariant,
                    payload.NeedsLodging,
                    payload.NeedsBaggageTransport,
                    payload.EmergencyContactName,
                    payload.EmergencyContactPhone,
                    payload.HealthNotes,
                    payload.DietNotes,
                    payload.AcceptedTerms,
                    payload.AcceptedRodo,
                    payload.AcceptedImageConsent,
                    row.RegistrationStatus,
                    row.PaymentStatus,
                    row.AttendanceStatus,
                    row.GroupName,
                    row.CreatedUtc,
                    row.UpdatedUtc));
            }

            return Results.Ok(new PilgrimageRegistrationExportResponse(
                pilgrimage.Id,
                pilgrimage.Slug,
                DateTimeOffset.UtcNow,
                transferRows));
        }).RequireAuthorization();

        group.MapPost("/{eventId:guid}/organizer/registrations/import", async (
            Guid eventId,
            PilgrimageRegistrationImportRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            IEncryptionService encryptionService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var pilgrimage = await dbContext.PilgrimageEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (pilgrimage is null)
            {
                return Results.NotFound();
            }

            var isGlobalAdmin = await IsGlobalEventsLimanowaAdminAsync(dbContext, userId, ct);
            var keyRing = new RoleKeyRing(new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>(), new Dictionary<Guid, byte[]>());
            if (!isGlobalAdmin)
            {
                try
                {
                    keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
                }
            }

            if (!isGlobalAdmin && !HasOrganizerAccess(keyRing, pilgrimage))
            {
                return Results.Forbid();
            }

            var sourceRows = request.Rows ?? Array.Empty<PilgrimageRegistrationTransferRow>();
            if (sourceRows.Count == 0 && !request.ReplaceExisting)
            {
                return Results.BadRequest(new { error = "Import payload is empty." });
            }

            var participantKey = UnprotectEventDataKey(dataProtectionProvider, pilgrimage.Id, "participant", pilgrimage.ParticipantDataKeyServerEnc);
            if (participantKey is null)
            {
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }

            if (request.ReplaceExisting)
            {
                var participantIds = await dbContext.PilgrimageParticipants
                    .Where(x => x.EventId == eventId)
                    .Select(x => x.Id)
                    .ToListAsync(ct);

                if (participantIds.Count > 0)
                {
                    var issues = await dbContext.PilgrimageParticipantIssues
                        .Where(x => x.EventId == eventId && participantIds.Contains(x.ParticipantId))
                        .ToListAsync(ct);
                    if (issues.Count > 0)
                    {
                        dbContext.PilgrimageParticipantIssues.RemoveRange(issues);
                    }

                    var tokens = await dbContext.PilgrimageParticipantAccessTokens
                        .Where(x => x.EventId == eventId && participantIds.Contains(x.ParticipantId))
                        .ToListAsync(ct);
                    if (tokens.Count > 0)
                    {
                        dbContext.PilgrimageParticipantAccessTokens.RemoveRange(tokens);
                    }

                    var participants = await dbContext.PilgrimageParticipants
                        .Where(x => x.EventId == eventId)
                        .ToListAsync(ct);
                    if (participants.Count > 0)
                    {
                        dbContext.PilgrimageParticipants.RemoveRange(participants);
                    }

                    await dbContext.SaveChangesAsync(ct);
                }
            }

            var importedRegistrations = 0;
            var skippedRegistrations = 0;
            var pendingTokens = new List<PilgrimageParticipantAccessToken>();
            var now = DateTimeOffset.UtcNow;
            foreach (var source in sourceRows)
            {
                var fullName = NormalizeShort(source.FullName, 200);
                var phone = NormalizePolishPhone(source.Phone);
                var emergencyName = NormalizeShort(source.EmergencyContactName, 200);
                var emergencyPhone = NormalizePolishPhone(source.EmergencyContactPhone);
                if (string.IsNullOrWhiteSpace(fullName) ||
                    string.IsNullOrWhiteSpace(phone) ||
                    string.IsNullOrWhiteSpace(emergencyName) ||
                    string.IsNullOrWhiteSpace(emergencyPhone))
                {
                    skippedRegistrations += 1;
                    continue;
                }

                var variant = NormalizeVariant(source.ParticipationVariant);
                var payload = new PilgrimageParticipantPayload(
                    fullName,
                    phone,
                    NormalizeShort(source.Email, 180),
                    NormalizeShort(source.Parish, 180),
                    source.BirthDate,
                    source.IsMinor,
                    variant,
                    source.NeedsLodging,
                    source.NeedsBaggageTransport,
                    emergencyName,
                    emergencyPhone,
                    NormalizeLong(source.HealthNotes, 1400),
                    NormalizeLong(source.DietNotes, 800),
                    source.AcceptedTerms,
                    source.AcceptedRodo,
                    source.AcceptedImageConsent);

                if (!payload.AcceptedTerms || !payload.AcceptedRodo)
                {
                    skippedRegistrations += 1;
                    continue;
                }

                var createdUtc = source.CreatedUtc is { } rawCreated && rawCreated.Year >= 2000 ? rawCreated : now;
                var updatedUtc = source.UpdatedUtc is { } rawUpdated && rawUpdated >= createdUtc ? rawUpdated : createdUtc;
                var participantId = Guid.NewGuid();
                var payloadJson = JsonSerializer.SerializeToUtf8Bytes(payload);
                var payloadEnc = encryptionService.Encrypt(participantKey, payloadJson, participantId.ToByteArray());
                var identityDigest = SHA256.HashData(Encoding.UTF8.GetBytes($"{fullName.ToLowerInvariant()}|{phone.Trim()}"));

                var participant = new PilgrimageParticipant
                {
                    Id = participantId,
                    EventId = pilgrimage.Id,
                    ParticipationVariant = variant,
                    RegistrationStatus = NormalizeRegistrationStatus(source.RegistrationStatus),
                    PaymentStatus = NormalizePaymentStatus(source.PaymentStatus),
                    AttendanceStatus = NormalizeAttendanceStatus(source.AttendanceStatus),
                    GroupName = NormalizeShort(source.GroupName, 120),
                    NeedsLodging = source.NeedsLodging,
                    NeedsBaggageTransport = source.NeedsBaggageTransport,
                    IsMinor = source.IsMinor,
                    AcceptedTerms = source.AcceptedTerms,
                    AcceptedRodo = source.AcceptedRodo,
                    IdentityDigest = identityDigest,
                    PayloadEnc = payloadEnc,
                    PayloadDataKeyId = pilgrimage.ParticipantDataKeyId,
                    CreatedUtc = createdUtc,
                    UpdatedUtc = updatedUtc
                };

                dbContext.PilgrimageParticipants.Add(participant);
                var token = CreateParticipantAccessToken();
                var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
                pendingTokens.Add(new PilgrimageParticipantAccessToken
                {
                    Id = Guid.NewGuid(),
                    EventId = pilgrimage.Id,
                    ParticipantId = participantId,
                    TokenHash = tokenHash,
                    ExpiresUtc = now.AddDays(120),
                    CreatedUtc = now
                });

                importedRegistrations += 1;
            }

            await using (var importTx = await dbContext.Database.BeginTransactionAsync(ct))
            {
                await dbContext.SaveChangesAsync(ct);
                if (pendingTokens.Count > 0)
                {
                    dbContext.PilgrimageParticipantAccessTokens.AddRange(pendingTokens);
                    await dbContext.SaveChangesAsync(ct);
                }

                await importTx.CommitAsync(ct);
            }

            await ledgerService.AppendBusinessAsync(
                "PilgrimageRegistrationsImported",
                userId.ToString(),
                JsonSerializer.Serialize(new
                {
                    pilgrimageId = pilgrimage.Id,
                    importedRegistrations,
                    skippedRegistrations,
                    request.ReplaceExisting
                }),
                ct);

            return Results.Ok(new PilgrimageRegistrationImportResponse(
                importedRegistrations,
                skippedRegistrations,
                request.ReplaceExisting));
        }).RequireAuthorization();
    }

    private static async Task<IResult> CreatePilgrimageInternalAsync(
        PilgrimageCreateRequest request,
        HttpContext context,
        RecreatioDbContext dbContext,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        IRoleCryptoService roleCryptoService,
        ISessionSecretCache sessionSecretCache,
        ILedgerService ledgerService,
        IDataProtectionProvider dataProtectionProvider,
        CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
            !EndpointHelpers.TryGetSessionId(context, out var sessionId))
        {
            return Results.Unauthorized();
        }

        var normalizedName = request.Name?.Trim() ?? string.Empty;
        var normalizedSlug = request.Slug?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedName) || string.IsNullOrWhiteSpace(normalizedSlug))
        {
            return Results.BadRequest(new { error = "Name and slug are required." });
        }

        if (normalizedSlug.Length > 80)
        {
            return Results.BadRequest(new { error = "Slug is too long." });
        }

        if (await dbContext.PilgrimageEvents.AsNoTracking().AnyAsync(x => x.Slug == normalizedSlug, ct))
        {
            return Results.BadRequest(new { error = "Slug is already taken." });
        }

        var account = await dbContext.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (account is null)
        {
            return Results.NotFound();
        }

        RoleKeyRing keyRing;
        try
        {
            keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
        }
        catch (InvalidOperationException)
        {
            return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
        }

        if (!keyRing.TryGetReadKey(account.MasterRoleId, out var masterReadKey) ||
            !keyRing.TryGetWriteKey(account.MasterRoleId, out var masterWriteKey) ||
            !keyRing.TryGetOwnerKey(account.MasterRoleId, out var masterOwnerKey))
        {
            return Results.Forbid();
        }

        byte[] masterKey;
        try
        {
            masterKey = keyRingService.RequireMasterKey(context, userId, sessionId);
        }
        catch (InvalidOperationException)
        {
            return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var masterSigningContext = await roleCryptoService.TryGetSigningContextAsync(account.MasterRoleId, masterOwnerKey, ct);

        var eventRole = await CreateRoleAsync(
            normalizedName,
            RoleKindPilgrimage,
            account.MasterRoleId,
            masterReadKey,
            masterWriteKey,
            masterOwnerKey,
            masterKey,
            userId,
            now,
            masterSigningContext,
            keyRingService,
            encryptionService,
            ledgerService,
            dbContext,
            ct);

        var eventSigningContext = await roleCryptoService.TryGetSigningContextAsync(eventRole.RoleId, eventRole.OwnerKey, ct);

        var organizerRole = await CreateRoleAsync(
            $"{normalizedName} - Organizator",
            RoleKindOrganizer,
            eventRole.RoleId,
            eventRole.ReadKey,
            eventRole.WriteKey,
            eventRole.OwnerKey,
            masterKey,
            userId,
            now,
            eventSigningContext,
            keyRingService,
            encryptionService,
            ledgerService,
            dbContext,
            ct);

        await AddMembershipAsync(
            userId,
            organizerRole,
            masterKey,
            now,
            masterSigningContext,
            encryptionService,
            ledgerService,
            dbContext,
            ct);

        var logisticsRole = await CreateRoleAsync(
            $"{normalizedName} - Logistyka",
            RoleKindLogistics,
            eventRole.RoleId,
            eventRole.ReadKey,
            eventRole.WriteKey,
            eventRole.OwnerKey,
            masterKey,
            userId,
            now,
            eventSigningContext,
            keyRingService,
            encryptionService,
            ledgerService,
            dbContext,
            ct);

        var medicalRole = await CreateRoleAsync(
            $"{normalizedName} - Bezpieczenstwo",
            RoleKindMedical,
            eventRole.RoleId,
            eventRole.ReadKey,
            eventRole.WriteKey,
            eventRole.OwnerKey,
            masterKey,
            userId,
            now,
            eventSigningContext,
            keyRingService,
            encryptionService,
            ledgerService,
            dbContext,
            ct);

        var publicRole = await CreateRoleAsync(
            $"{normalizedName} - Publiczne",
            RoleKindPublic,
            eventRole.RoleId,
            eventRole.ReadKey,
            eventRole.WriteKey,
            eventRole.OwnerKey,
            masterKey,
            userId,
            now,
            eventSigningContext,
            keyRingService,
            encryptionService,
            ledgerService,
            dbContext,
            ct);

        var participantData = await CreatePilgrimageDataKeyAsync(
            eventRole,
            "participant-private",
            now,
            userId,
            eventSigningContext,
            keyRingService,
            encryptionService,
            ledgerService,
            dbContext,
            ct);
        var emergencyData = await CreatePilgrimageDataKeyAsync(
            eventRole,
            "participant-emergency",
            now,
            userId,
            eventSigningContext,
            keyRingService,
            encryptionService,
            ledgerService,
            dbContext,
            ct);

        await GrantPilgrimageDataKeyAsync(participantData, [organizerRole, logisticsRole, medicalRole], now, encryptionService, dbContext, ct);
        await GrantPilgrimageDataKeyAsync(emergencyData, [organizerRole, medicalRole], now, encryptionService, dbContext, ct);

        var eventId = Guid.NewGuid();
        var participantServerKeyEnc = ProtectEventDataKey(dataProtectionProvider, eventId, "participant", participantData.DataKey);
        var emergencyServerKeyEnc = ProtectEventDataKey(dataProtectionProvider, eventId, "emergency", emergencyData.DataKey);

        var site = NormalizeSiteDocument(request.Site ?? CreateDefaultSiteForSlug(normalizedSlug));
        var pilgrimage = new PilgrimageEvent
        {
            Id = eventId,
            Slug = normalizedSlug,
            Name = normalizedName,
            Motto = NormalizeShort(request.Motto, 180) ?? string.Empty,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            StartLocation = NormalizeShort(request.StartLocation, 160) ?? string.Empty,
            EndLocation = NormalizeShort(request.EndLocation, 160) ?? string.Empty,
            Theme = string.IsNullOrWhiteSpace(request.Theme) ? "pilgrimage" : request.Theme.Trim(),
            DistanceKm = request.DistanceKm,
            RoleId = eventRole.RoleId,
            OrganizerRoleId = organizerRole.RoleId,
            LogisticsRoleId = logisticsRole.RoleId,
            MedicalRoleId = medicalRole.RoleId,
            PublicRoleId = publicRole.RoleId,
            ParticipantDataItemId = participantData.DataItemId,
            ParticipantDataKeyId = participantData.DataKeyId,
            EmergencyDataItemId = emergencyData.DataItemId,
            EmergencyDataKeyId = emergencyData.DataKeyId,
            ParticipantDataKeyServerEnc = participantServerKeyEnc,
            EmergencyDataKeyServerEnc = emergencyServerKeyEnc,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        var config = new PilgrimageSiteConfig
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            PublicConfigJson = JsonSerializer.Serialize(site.Public),
            ParticipantConfigJson = JsonSerializer.Serialize(site.Participant),
            OrganizerConfigJson = JsonSerializer.Serialize(site.Organizer),
            IsPublished = true,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.PilgrimageEvents.Add(pilgrimage);
        dbContext.PilgrimageSiteConfigs.Add(config);
        await dbContext.SaveChangesAsync(ct);

        await ledgerService.AppendBusinessAsync(
            "PilgrimageCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { pilgrimage.Id, pilgrimage.Name, pilgrimage.Slug }),
            ct,
            eventSigningContext);

        await transaction.CommitAsync(ct);
        EndpointHelpers.InvalidateRoleKeyRing(sessionSecretCache, sessionId);

        return Results.Ok(new PilgrimageSiteResponse(
            pilgrimage.Id,
            pilgrimage.Slug,
            pilgrimage.Name,
            pilgrimage.Motto,
            pilgrimage.StartDate,
            pilgrimage.EndDate,
            pilgrimage.StartLocation,
            pilgrimage.EndLocation,
            pilgrimage.DistanceKm,
            pilgrimage.Theme,
            site,
            true));
    }

    private static PilgrimageSiteDocument DeserializeSiteConfig(PilgrimageSiteConfig config, string? slug)
    {
        try
        {
            var defaultSite = CreateDefaultSiteForSlug(slug);
            var publicConfig = JsonSerializer.Deserialize<PilgrimagePublicConfig>(config.PublicConfigJson)
                ?? defaultSite.Public;
            var participantConfig = JsonSerializer.Deserialize<PilgrimageZoneConfig>(config.ParticipantConfigJson)
                ?? defaultSite.Participant;
            var organizerConfig = JsonSerializer.Deserialize<PilgrimageZoneConfig>(config.OrganizerConfigJson)
                ?? defaultSite.Organizer;
            return NormalizeSiteDocument(new PilgrimageSiteDocument(publicConfig, participantConfig, organizerConfig));
        }
        catch (JsonException)
        {
            return CreateDefaultSiteForSlug(slug);
        }
    }

    private static PilgrimageSiteDocument NormalizeSiteDocument(PilgrimageSiteDocument site)
    {
        return new PilgrimageSiteDocument(
            NormalizePublicConfig(site.Public),
            NormalizeZoneConfig(site.Participant),
            NormalizeZoneConfig(site.Organizer));
    }

    private static PilgrimagePublicConfig NormalizePublicConfig(PilgrimagePublicConfig config)
    {
        var heroTitle = NormalizeShort(config.HeroTitle, 200) ?? "Pielgrzymka";
        var heroSubtitle = NormalizeLong(config.HeroSubtitle, 1200) ?? string.Empty;
        var dateLabel = NormalizeShort(config.DateLabel, 120) ?? string.Empty;
        var routeLabel = NormalizeShort(config.RouteLabel, 220) ?? string.Empty;
        var heroFacts = NormalizeCards(config.HeroFacts);
        var sections = NormalizeSections(config.Sections);
        return new PilgrimagePublicConfig(heroTitle, heroSubtitle, dateLabel, routeLabel, heroFacts, sections);
    }

    private static PilgrimageZoneConfig NormalizeZoneConfig(PilgrimageZoneConfig config)
    {
        return new PilgrimageZoneConfig(NormalizeSections(config.Sections));
    }

    private static IReadOnlyList<PilgrimageSection> NormalizeSections(IReadOnlyList<PilgrimageSection>? sections)
    {
        if (sections is null || sections.Count == 0)
        {
            return Array.Empty<PilgrimageSection>();
        }

        return sections
            .Select(section =>
            {
                var id = NormalizeShort(section.Id, 120) ?? Guid.NewGuid().ToString("N");
                var title = NormalizeShort(section.Title, 220) ?? "Sekcja";
                var lead = NormalizeLong(section.Lead, 1800);
                var cards = NormalizeCards(section.Cards);
                return new PilgrimageSection(id, title, lead, cards);
            })
            .ToList();
    }

    private static IReadOnlyList<PilgrimageCard> NormalizeCards(IReadOnlyList<PilgrimageCard>? cards)
    {
        if (cards is null || cards.Count == 0)
        {
            return Array.Empty<PilgrimageCard>();
        }

        return cards
            .Select(card =>
            {
                var id = NormalizeShort(card.Id, 120) ?? Guid.NewGuid().ToString("N");
                var title = NormalizeShort(card.Title, 220) ?? "Karta";
                var body = NormalizeLong(card.Body, 3200) ?? string.Empty;
                var meta = NormalizeShort(card.Meta, 260);
                var accent = NormalizeShort(card.Accent, 60);
                return new PilgrimageCard(id, title, body, meta, accent);
            })
            .ToList();
    }

    private static string NormalizeVariant(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedVariants.Contains(normalized, StringComparer.Ordinal) ? normalized : "full";
    }

    private static string NormalizeAudience(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedAudiences.Contains(normalized, StringComparer.Ordinal) ? normalized : "participant";
    }

    private static string NormalizeTaskStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedTaskStatuses.Contains(normalized, StringComparer.Ordinal) ? normalized : "todo";
    }

    private static string NormalizeTaskPriority(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedTaskPriorities.Contains(normalized, StringComparer.Ordinal) ? normalized : "normal";
    }

    private static string NormalizeRegistrationStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedRegistrationStatuses.Contains(normalized, StringComparer.Ordinal) ? normalized : "pending";
    }

    private static string NormalizePaymentStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedPaymentStatuses.Contains(normalized, StringComparer.Ordinal) ? normalized : "pending";
    }

    private static string NormalizeAttendanceStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedAttendanceStatuses.Contains(normalized, StringComparer.Ordinal) ? normalized : "not-checked-in";
    }

    private static string NormalizeIssueKind(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedIssueKinds.Contains(normalized, StringComparer.Ordinal) ? normalized : "problem";
    }

    private static string NormalizeIssueStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedIssueStatuses.Contains(normalized, StringComparer.Ordinal) ? normalized : "open";
    }

    private static string NormalizeInquiryStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedInquiryStatuses.Contains(normalized, StringComparer.Ordinal) ? normalized : "new";
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

    private static bool IsPublicFallbackEnabledSlug(string? slug)
    {
        var normalized = (slug ?? string.Empty).Trim();
        return PublicFallbackSlugs.Contains(normalized);
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

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var escaped = value.Replace("\"", "\"\"", StringComparison.Ordinal);
        return $"\"{escaped}\"";
    }

    private static bool HasOrganizerAccess(RoleKeyRing keyRing, PilgrimageEvent pilgrimage)
    {
        return keyRing.ReadKeys.ContainsKey(pilgrimage.OrganizerRoleId)
            || keyRing.ReadKeys.ContainsKey(pilgrimage.LogisticsRoleId)
            || keyRing.ReadKeys.ContainsKey(pilgrimage.MedicalRoleId);
    }

    private static Task<bool> IsGlobalEventsLimanowaAdminAsync(
        RecreatioDbContext dbContext,
        Guid userId,
        CancellationToken ct)
    {
        return dbContext.PortalAdminAssignments.AsNoTracking()
            .AnyAsync(x => x.ScopeKey == GlobalEventsLimanowaAdminScope && x.UserId == userId, ct);
    }

    private static Guid ResolveActorRoleId(RoleKeyRing keyRing, PilgrimageEvent pilgrimage)
    {
        if (keyRing.ReadKeys.ContainsKey(pilgrimage.OrganizerRoleId))
        {
            return pilgrimage.OrganizerRoleId;
        }

        if (keyRing.ReadKeys.ContainsKey(pilgrimage.LogisticsRoleId))
        {
            return pilgrimage.LogisticsRoleId;
        }

        if (keyRing.ReadKeys.ContainsKey(pilgrimage.MedicalRoleId))
        {
            return pilgrimage.MedicalRoleId;
        }

        return pilgrimage.RoleId;
    }

    private static string CreateParticipantAccessToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] ProtectEventDataKey(IDataProtectionProvider dataProtectionProvider, Guid eventId, string scope, byte[] key)
    {
        var protector = dataProtectionProvider.CreateProtector("pilgrimage", "event-data-key", eventId.ToString("N"), scope);
        return protector.Protect(key);
    }

    private static byte[]? UnprotectEventDataKey(IDataProtectionProvider dataProtectionProvider, Guid eventId, string scope, byte[] protectedKey)
    {
        try
        {
            var protector = dataProtectionProvider.CreateProtector("pilgrimage", "event-data-key", eventId.ToString("N"), scope);
            return protector.Unprotect(protectedKey);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    private static PilgrimageParticipantPayload? DecryptParticipantPayload(
        PilgrimageParticipant participant,
        byte[] participantKey,
        IEncryptionService encryptionService)
    {
        try
        {
            var plain = encryptionService.Decrypt(participantKey, participant.PayloadEnc, participant.Id.ToByteArray());
            return JsonSerializer.Deserialize<PilgrimageParticipantPayload>(plain);
        }
        catch (CryptographicException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static async Task<RoleBundle> CreateRoleAsync(
        string nick,
        string roleKind,
        Guid parentRoleId,
        byte[] parentReadKey,
        byte[] parentWriteKey,
        byte[] parentOwnerKey,
        byte[] masterKey,
        Guid userId,
        DateTimeOffset now,
        LedgerSigningContext? signingContext,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var roleId = Guid.NewGuid();
        var readKey = RandomNumberGenerator.GetBytes(32);
        var writeKey = RandomNumberGenerator.GetBytes(32);
        var ownerKey = RandomNumberGenerator.GetBytes(32);

        using var encryptionRsa = RSA.Create(2048);
        var publicEncryptionKey = encryptionRsa.ExportSubjectPublicKeyInfo();
        var privateEncryptionKey = encryptionRsa.ExportPkcs8PrivateKey();

        using var signingRsa = RSA.Create(2048);
        var publicSigningKey = signingRsa.ExportSubjectPublicKeyInfo();
        var privateSigningKey = signingRsa.ExportPkcs8PrivateKey();

        var roleCrypto = new RoleCryptoMaterial(
            Convert.ToBase64String(privateEncryptionKey),
            "RSA-OAEP-SHA256",
            Convert.ToBase64String(privateSigningKey),
            "RSA-SHA256");
        var encryptedRoleBlob = encryptionService.Encrypt(ownerKey, JsonSerializer.SerializeToUtf8Bytes(roleCrypto));

        dbContext.Roles.Add(new Role
        {
            Id = roleId,
            EncryptedRoleBlob = encryptedRoleBlob,
            PublicSigningKey = publicSigningKey,
            PublicSigningKeyAlg = "RSA-SHA256",
            PublicEncryptionKey = publicEncryptionKey,
            PublicEncryptionKeyAlg = "RSA-OAEP-SHA256",
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync(ct);

        var roleReadKeyLedger = await ledgerService.AppendKeyAsync(
            "RoleReadKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { roleId }),
            ct,
            signingContext);
        var roleWriteKeyLedger = await ledgerService.AppendKeyAsync(
            "RoleWriteKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { roleId }),
            ct,
            signingContext);
        var roleOwnerKeyLedger = await ledgerService.AppendKeyAsync(
            "RoleOwnerKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { roleId }),
            ct,
            signingContext);

        dbContext.Keys.Add(new KeyEntry
        {
            Id = Guid.NewGuid(),
            KeyType = KeyType.RoleReadKey,
            OwnerRoleId = roleId,
            Version = 1,
            EncryptedKeyBlob = encryptionService.Encrypt(masterKey, readKey, roleId.ToByteArray()),
            ScopeType = "role-key",
            ScopeSubtype = "read",
            LedgerRefId = roleReadKeyLedger.Id,
            CreatedUtc = now
        });
        dbContext.Keys.Add(new KeyEntry
        {
            Id = Guid.NewGuid(),
            KeyType = KeyType.RoleWriteKey,
            OwnerRoleId = roleId,
            Version = 1,
            EncryptedKeyBlob = encryptionService.Encrypt(masterKey, writeKey, roleId.ToByteArray()),
            ScopeType = "role-key",
            ScopeSubtype = "write",
            LedgerRefId = roleWriteKeyLedger.Id,
            CreatedUtc = now
        });
        dbContext.Keys.Add(new KeyEntry
        {
            Id = Guid.NewGuid(),
            KeyType = KeyType.RoleOwnerKey,
            OwnerRoleId = roleId,
            Version = 1,
            EncryptedKeyBlob = encryptionService.Encrypt(masterKey, ownerKey, roleId.ToByteArray()),
            ScopeType = "role-key",
            ScopeSubtype = "owner",
            LedgerRefId = roleOwnerKeyLedger.Id,
            CreatedUtc = now
        });
        await dbContext.SaveChangesAsync(ct);

        await CreateRoleFieldAsync(roleId, RoleFieldTypes.RoleKind, roleKind, readKey, userId, now, signingContext, keyRingService, ledgerService, dbContext, ct);
        await CreateRoleFieldAsync(roleId, RoleFieldTypes.Nick, nick, readKey, userId, now, signingContext, keyRingService, ledgerService, dbContext, ct);

        var edgeId = Guid.NewGuid();
        var relationshipType = RoleRelationships.Owner;
        var encryptedRelationshipType = keyRingService.EncryptRoleRelationshipType(parentReadKey, relationshipType, edgeId);
        var relationshipTypeHash = HMACSHA256.HashData(parentReadKey, Encoding.UTF8.GetBytes(relationshipType));
        var encryptedReadKeyCopy = encryptionService.Encrypt(parentReadKey, readKey, roleId.ToByteArray());
        var encryptedWriteKeyCopy = encryptionService.Encrypt(parentWriteKey, writeKey, roleId.ToByteArray());
        var encryptedOwnerKeyCopy = encryptionService.Encrypt(parentOwnerKey, ownerKey, roleId.ToByteArray());

        await ledgerService.AppendKeyAsync(
            "RoleEdgeCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { parentRoleId, roleId, relationshipType }),
            ct,
            signingContext);

        dbContext.RoleEdges.Add(new RoleEdge
        {
            Id = edgeId,
            ParentRoleId = parentRoleId,
            ChildRoleId = roleId,
            RelationshipType = string.Empty,
            EncryptedRelationshipType = encryptedRelationshipType,
            RelationshipTypeHash = relationshipTypeHash,
            EncryptedReadKeyCopy = encryptedReadKeyCopy,
            EncryptedWriteKeyCopy = encryptedWriteKeyCopy,
            EncryptedOwnerKeyCopy = encryptedOwnerKeyCopy,
            CreatedUtc = now
        });
        await dbContext.SaveChangesAsync(ct);

        return new RoleBundle(roleId, readKey, writeKey, ownerKey);
    }

    private static async Task CreateRoleFieldAsync(
        Guid roleId,
        string fieldType,
        string plainValue,
        byte[] readKey,
        Guid userId,
        DateTimeOffset now,
        LedgerSigningContext? signingContext,
        IKeyRingService keyRingService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var dataKeyId = Guid.NewGuid();
        var roleFieldId = Guid.NewGuid();
        var dataKey = RandomNumberGenerator.GetBytes(32);
        var encryptedDataKey = keyRingService.EncryptDataKey(readKey, dataKey, dataKeyId);
        var encryptedFieldType = keyRingService.EncryptRoleFieldType(readKey, fieldType, roleFieldId);
        var fieldTypeHash = HMACSHA256.HashData(readKey, Encoding.UTF8.GetBytes(fieldType));

        var keyLedger = await ledgerService.AppendKeyAsync(
            "RoleFieldKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { roleId, fieldType, dataKeyId }),
            ct,
            signingContext);

        dbContext.Keys.Add(new KeyEntry
        {
            Id = dataKeyId,
            KeyType = KeyType.DataKey,
            OwnerRoleId = roleId,
            Version = 1,
            EncryptedKeyBlob = encryptedDataKey,
            ScopeType = "role-field",
            ScopeSubtype = fieldType,
            BoundEntryId = roleFieldId,
            LedgerRefId = keyLedger.Id,
            CreatedUtc = now
        });
        dbContext.KeyEntryBindings.Add(new KeyEntryBinding
        {
            Id = Guid.NewGuid(),
            KeyEntryId = dataKeyId,
            EntryId = roleFieldId,
            EntryType = "role-field",
            EntrySubtype = fieldType,
            CreatedUtc = now
        });

        dbContext.RoleFields.Add(new RoleField
        {
            Id = roleFieldId,
            RoleId = roleId,
            FieldType = string.Empty,
            EncryptedFieldType = encryptedFieldType,
            FieldTypeHash = fieldTypeHash,
            DataKeyId = dataKeyId,
            EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType),
            CreatedUtc = now,
            UpdatedUtc = now
        });

        await dbContext.SaveChangesAsync(ct);
    }

    private static async Task<DataKeyBundle> CreatePilgrimageDataKeyAsync(
        RoleBundle eventRole,
        string itemName,
        DateTimeOffset now,
        Guid userId,
        LedgerSigningContext? signingContext,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var dataItemId = Guid.NewGuid();
        var dataKeyId = Guid.NewGuid();
        var dataKey = RandomNumberGenerator.GetBytes(32);

        using var signingRsa = RSA.Create(2048);
        var publicSigningKey = signingRsa.ExportSubjectPublicKeyInfo();
        var privateSigningKey = signingRsa.ExportPkcs8PrivateKey();

        var encryptedItemName = keyRingService.EncryptDataItemMeta(dataKey, itemName, dataItemId, "item-name");
        var encryptedItemType = keyRingService.EncryptDataItemMeta(dataKey, "key", dataItemId, "item-type");

        dbContext.DataItems.Add(new DataItem
        {
            Id = dataItemId,
            OwnerRoleId = eventRole.RoleId,
            ItemType = string.Empty,
            ItemName = string.Empty,
            EncryptedItemType = encryptedItemType,
            EncryptedItemName = encryptedItemName,
            EncryptedValue = null,
            PublicSigningKey = publicSigningKey,
            PublicSigningKeyAlg = "RSA-SHA256",
            DataSignature = null,
            DataSignatureAlg = null,
            DataSignatureRoleId = null,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        var encryptedDataKey = keyRingService.EncryptDataKey(eventRole.ReadKey, dataKey, dataKeyId);
        var keyLedger = await ledgerService.AppendKeyAsync(
            "PilgrimageDataKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { eventRole.RoleId, dataItemId, dataKeyId, itemName }),
            ct,
            signingContext);

        dbContext.Keys.Add(new KeyEntry
        {
            Id = dataKeyId,
            KeyType = KeyType.DataKey,
            OwnerRoleId = eventRole.RoleId,
            Version = 1,
            EncryptedKeyBlob = encryptedDataKey,
            ScopeType = "pilgrimage",
            ScopeSubtype = itemName,
            BoundEntryId = dataItemId,
            LedgerRefId = keyLedger.Id,
            CreatedUtc = now
        });

        dbContext.DataKeyGrants.Add(new DataKeyGrant
        {
            Id = Guid.NewGuid(),
            DataItemId = dataItemId,
            RoleId = eventRole.RoleId,
            PermissionType = RoleRelationships.Owner,
            EncryptedDataKeyBlob = encryptionService.Encrypt(eventRole.ReadKey, dataKey, dataItemId.ToByteArray()),
            EncryptedSigningKeyBlob = encryptionService.Encrypt(eventRole.WriteKey, privateSigningKey, dataItemId.ToByteArray()),
            CreatedUtc = now
        });

        await dbContext.SaveChangesAsync(ct);
        return new DataKeyBundle(dataItemId, dataKeyId, dataKey);
    }

    private static async Task GrantPilgrimageDataKeyAsync(
        DataKeyBundle bundle,
        IEnumerable<RoleBundle> roles,
        DateTimeOffset now,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        foreach (var role in roles)
        {
            dbContext.DataKeyGrants.Add(new DataKeyGrant
            {
                Id = Guid.NewGuid(),
                DataItemId = bundle.DataItemId,
                RoleId = role.RoleId,
                PermissionType = RoleRelationships.Read,
                EncryptedDataKeyBlob = encryptionService.Encrypt(role.ReadKey, bundle.DataKey, bundle.DataItemId.ToByteArray()),
                CreatedUtc = now
            });
        }

        await dbContext.SaveChangesAsync(ct);
    }

    private static async Task AddMembershipAsync(
        Guid userId,
        RoleBundle role,
        byte[] masterKey,
        DateTimeOffset now,
        LedgerSigningContext? signingContext,
        IEncryptionService encryptionService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var ledger = await ledgerService.AppendKeyAsync(
            "MembershipCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { roleId = role.RoleId }),
            ct,
            signingContext);

        dbContext.Memberships.Add(new Membership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            RoleId = role.RoleId,
            RelationshipType = RoleRelationships.Owner,
            EncryptedReadKeyCopy = encryptionService.Encrypt(masterKey, role.ReadKey, role.RoleId.ToByteArray()),
            EncryptedWriteKeyCopy = encryptionService.Encrypt(masterKey, role.WriteKey, role.RoleId.ToByteArray()),
            EncryptedOwnerKeyCopy = encryptionService.Encrypt(masterKey, role.OwnerKey, role.RoleId.ToByteArray()),
            LedgerRefId = ledger.Id,
            CreatedUtc = now
        });

        await dbContext.SaveChangesAsync(ct);
    }

    private static PilgrimageSiteDocument CreateDefaultSiteForSlug(string? slug)
    {
        return CreateDefaultKal26Site();
    }

    private static PilgrimageSiteDocument CreateDefaultKal26Site()
    {
        var publicConfig = new PilgrimagePublicConfig(
            "5. piesza pielgrzymka Krakow - Kalwaria Zebrzydowska",
            "Publiczna czesc informuje, strefa uczestnika prowadzi krok po kroku, a panel organizatora wspiera koordynacje calego wydarzenia.",
            "17-18.04.2026",
            "Krakow - Tyniec - Kalwaria Zebrzydowska",
            [
                new PilgrimageCard("date", "Data", "Piatek-sobota, 17-18 kwietnia 2026.", "Start po poludniu", "sand"),
                new PilgrimageCard("start", "Miejsce startu", "Krakow, Msza Swieta i wyjscie grupy.", "Zbiorka przed Msza", "blue"),
                new PilgrimageCard("lodging", "Nocleg", "Tyniec: nocleg wspolnotowy i logistyka bagaazowa.", "Sale + namioty", "coral"),
                new PilgrimageCard("distance", "Dystans", "Okolo 40-45 km lacznie, z podzialem na etapy.", "Postoje i cieply posilek", "green")
            ],
            [
                new PilgrimageSection(
                    "najwazniejsze",
                    "Najwazniejsze informacje",
                    "Pierwsza sekcja odpowiada od razu na pytania praktyczne.",
                    [
                        new PilgrimageCard("when", "Kiedy", "Piatek i sobota, model 2-dniowy z noclegiem.", "MVP", "sand"),
                        new PilgrimageCard("who", "Dla kogo", "Dla osob gotowych na wspolna droge piesza i modlitwe.", "Wymagana podstawowa kondycja", "blue"),
                        new PilgrimageCard("signup", "Jak sie zapisac", "Prosty formularz 4-krokowy + zgody.", "Online + potwierdzenie", "coral"),
                        new PilgrimageCard("deadline", "Do kiedy", "Zapisy do wyczerpania limitu lub do terminu zamkniecia.", "Komunikat na stronie", "green")
                    ]),
                new PilgrimageSection(
                    "jak-wyglada",
                    "Jak wyglada pielgrzymka",
                    "Narracja trzyetapowa: start, nocleg, dojscie.",
                    [
                        new PilgrimageCard("step-1", "Krok 1", "Msza Swieta w Krakowie i wyjscie na trase.", "Wspolny poczatek", "blue"),
                        new PilgrimageCard("step-2", "Krok 2", "Wieczorne dojscie do Tynca, nocleg i modlitwa.", "Wspolnota", "sand"),
                        new PilgrimageCard("step-3", "Krok 3", "Sobota: kolejne etapy i wejscie do Kalwarii.", "Final drogi", "coral")
                    ]),
                new PilgrimageSection(
                    "program",
                    "Program w skrocie",
                    "Uklad osi czasu dla mobile i desktop.",
                    [
                        new PilgrimageCard("fri", "Piatek", "Zbiorka, Msza, wyjscie, dojscie do Tynca, kolacja, modlitwa, nocleg.", "Dzien 1", "blue"),
                        new PilgrimageCard("sat", "Sobota", "Pobudka, wyjscie z Tynca, postoje, cieply posilek, dojscie do Kalwarii, zakonczenie.", "Dzien 2", "green"),
                        new PilgrimageCard("fri-time", "Piatek - os czasu", "Zbiorka, Msza, start, dojscie do Tynca, kolacja i modlitwa wieczorna.", "Mobile: karta po karcie", "sand"),
                        new PilgrimageCard("sat-time", "Sobota - os czasu", "Wyjscie, punkty postoju, posilek, final i wspolne zakonczenie.", "Desktop: dwa bloki", "coral")
                    ]),
                new PilgrimageSection(
                    "trasa",
                    "Trasa i mapy",
                    "Strona praktyczna: etapy, dystanse, bezpieczenstwo.",
                    [
                        new PilgrimageCard("map", "Mapa zbiorcza", "Mapa calej trasy z kluczowymi punktami: start, nocleg, postoj, meta.", "PDF + GPX", "blue"),
                        new PilgrimageCard("stage-1", "Etap 1", "Krakow -> Tyniec: start, droga, wieczorne dojscie i nocleg.", "Dzien 1", "sand"),
                        new PilgrimageCard("stage-2", "Etap 2", "Tyniec -> Kalwaria: wyjscie poranne, postoje, dojscie do celu.", "Dzien 2", "green"),
                        new PilgrimageCard("stops", "Punkty postoju", "Postoje techniczne i jeden punkt z cieplym posilkiem.", "Sosnowice + Przytkowice (do potwierdzenia)", "blue"),
                        new PilgrimageCard("safety", "Logistyka i bezpieczenstwo", "Punkty zejscia z trasy, kontakt awaryjny, samochod techniczny.", "Priorytet", "coral")
                    ]),
                new PilgrimageSection(
                    "zapisy",
                    "Zapisy",
                    "Formularz podzielony na 4 kroki, bez sciany tekstu.",
                    [
                        new PilgrimageCard("form-1", "Krok 1: dane", "Imie i nazwisko, telefon, email, parafia/wspolnota.", "Podstawowe", "sand"),
                        new PilgrimageCard("form-2", "Krok 2: udzial", "Wariant udzialu, nocleg, transport bagazu.", "Logistyka", "blue"),
                        new PilgrimageCard("form-3", "Krok 3: bezpieczenstwo", "Kontakt awaryjny, zdrowie, dieta.", "Wazne", "coral"),
                        new PilgrimageCard("form-4", "Krok 4: zgody", "RODO, regulamin, zgoda na wizerunek.", "Wymagane", "green")
                    ]),
                new PilgrimageSection(
                    "niezbednik",
                    "Niezbednik pielgrzyma",
                    "Checklisty zamiast dlugich blokow tekstu.",
                    [
                        new PilgrimageCard("take", "Co zabrac", "Buty, warstwy ubrania, peleryna, latarka, dokumenty, leki.", "Checklista", "blue"),
                        new PilgrimageCard("dont-take", "Czego nie brac za duzo", "Nadmiaru bagazu i rzeczy niepotrzebnych na trasie.", "Lekki plecak", "sand"),
                        new PilgrimageCard("prepare", "Jak sie przygotowac", "Kondycja, organizacja bagazu, plan dnia i nawodnienie.", "Praktycznie", "green")
                    ]),
                new PilgrimageSection(
                    "faq",
                    "FAQ",
                    "Akordeony z najczestszymi pytaniami.",
                    [
                        new PilgrimageCard("q1", "Czy mozna isc tylko w sobote?", "Tak, jesli organizator dopuszcza wariant jednodniowy.", null, "sand"),
                        new PilgrimageCard("q2", "Czy bedzie transport bagazu?", "Tak, zgodnie z komunikatem logistycznym i zasadami pakowania.", null, "blue"),
                        new PilgrimageCard("q3", "Jak wyglada nocleg?", "Tyniec: sale i opcje dodatkowe zalezne od dostepnosci.", null, "green"),
                        new PilgrimageCard("q4", "Co w razie deszczu?", "Wydarzenie trwa, obowiazuje wyposazenie przeciwdeszczowe i komunikaty kryzysowe.", null, "coral"),
                        new PilgrimageCard("q5", "Czy trzeba miec spiwor i karimate?", "Tak, nocleg ma charakter wspolnotowy i wymaga wlasnego wyposazenia.", null, "sand"),
                        new PilgrimageCard("q6", "Czy beda posilki?", "Kolacja, sniadanie i cieply posilek sa organizowane zgodnie z komunikatem.", null, "green"),
                        new PilgrimageCard("q7", "Czy niepelnoletni moga uczestniczyc?", "Tak, jesli dostarczona jest wymagana zgoda opiekuna.", null, "blue"),
                        new PilgrimageCard("q8", "Co jesli musze zrezygnowac?", "Zglos rezygnacje przez strefe uczestnika albo kontakt awaryjny.", null, "coral"),
                        new PilgrimageCard("q9", "Czy moge isc bez noclegu?", "Tak, wariant bez noclegu jest dostepny przy zapisie.", null, "sand"),
                        new PilgrimageCard("q10", "Jak dziala strefa uczestnika?", "Dostep przez prywatny link/token przeslany po rejestracji.", null, "blue")
                    ]),
                new PilgrimageSection(
                    "kontakt",
                    "Kontakt",
                    "Oddzielne kanaly dla zapisow, organizacji i awarii.",
                    [
                        new PilgrimageCard("reg", "Kontakt w sprawie zapisow", "Telefon + email zespolu zapisow.", "Dni robocze", "blue"),
                        new PilgrimageCard("org", "Kontakt organizacyjny", "Pytania o trase, logistyke i program.", "Koordynator", "sand"),
                        new PilgrimageCard("emg", "Kontakt awaryjny", "Numer aktywny podczas pielgrzymki + SMS.", "24/7 w dniach wydarzenia", "coral")
                    ]),
                new PilgrimageSection(
                    "formalnosci",
                    "Regulamin, RODO, zgody",
                    "Jasne zasady i role odpowiedzialnosci danych.",
                    [
                        new PilgrimageCard("gdpr", "Administrator danych", "Wskazana parafia/wspolnota jako administrator.", "Formalnosci", "sand"),
                        new PilgrimageCard("consent", "Zgody", "RODO, regulamin, zgoda opiekuna dla niepelnoletnich, zgoda na wizerunek.", "Wymagane", "blue"),
                        new PilgrimageCard("policy", "Polityka rezygnacji", "Opis terminow i zasad zwrotow/potwierdzen.", "Transparentnie", "green")
                    ]),
                new PilgrimageSection(
                    "foto",
                    "Plan zdjec",
                    "Lista minimalna 10+ ujec wspierajacych narracje wydarzenia.",
                    [
                        new PilgrimageCard("photo-a", "A. Hero", "Szeroki kadr grupy w drodze, naturalne swiatlo i dynamika marszu.", "Obowiazkowe", "blue"),
                        new PilgrimageCard("photo-b", "B. Msza na rozpoczecie", "Wspolna modlitwa i klimat rozpoczecia drogi.", "Start", "sand"),
                        new PilgrimageCard("photo-c", "C. Marsz / otwarta przestrzen", "Perspektywa drogi, ruch grupy i pejzaz.", "Droga", "green"),
                        new PilgrimageCard("photo-d", "D. Tyniec", "Klasztor, dojscie, odpoczynek i miejsce noclegu.", "Dzien 1", "coral"),
                        new PilgrimageCard("photo-e", "E. Posilek i odpoczynek", "Wspolnota i zaufanie do organizacji wydarzenia.", "Logistyka", "sand"),
                        new PilgrimageCard("photo-f", "F. Modlitwa wieczorna", "Skupienie, adoracja, cisza i swiatlo.", "Wieczor", "blue"),
                        new PilgrimageCard("photo-g", "G. Poranek dnia 2", "Start po noclegu, gotowosc do dalszej drogi.", "Dzien 2", "green"),
                        new PilgrimageCard("photo-h", "H. Punkt postoju", "Organizacja postoju i cieplego posilku.", "Operacyjnie", "coral"),
                        new PilgrimageCard("photo-i", "I. Wejscie do Kalwarii", "Emocja dojscia i final pielgrzymki.", "Meta", "blue"),
                        new PilgrimageCard("photo-j", "J. Zakonczenie", "Modlitwa koncowa i wspolne zdjecie grupy.", "Domkniecie historii", "sand")
                    ])
            ]);

        var participantConfig = new PilgrimageZoneConfig([
            new PilgrimageSection(
                "my-participation",
                "Moj udzial",
                "Uczestnik od razu widzi status i najwazniejsze parametry.",
                [
                    new PilgrimageCard("status", "Status zgloszenia", "Status zapisu i potwierdzenia.", "pending/confirmed", "blue"),
                    new PilgrimageCard("payment", "Status platnosci", "Informacja o platnosci i ewentualnych przypomnieniach.", "pending/paid", "sand"),
                    new PilgrimageCard("variant", "Wariant", "Calosc / sobota / nocleg / transport bagazu.", "Zgodnie z formularzem", "green")
                ]),
            new PilgrimageSection(
                "participant-notices",
                "Aktualne komunikaty",
                "Zmiany godzin, pogoda, komunikaty kryzysowe.",
                [
                    new PilgrimageCard("before", "Przed wydarzeniem", "Przypomnienia organizacyjne i dokumenty.", null, "blue"),
                    new PilgrimageCard("during", "W trakcie", "Biezace komunikaty z trasy i postoju.", null, "coral")
                ]),
            new PilgrimageSection(
                "participant-schedule",
                "Harmonogram i zborki",
                "Godziny zborek, miejsca przejsc i etapy dnia.",
                [
                    new PilgrimageCard("sched-1", "Dzien 1", "Zbiorka, Msza, start, dojscie do Tynca.", "Timeline", "blue"),
                    new PilgrimageCard("sched-2", "Dzien 2", "Wyjscie, postoje, final w Kalwarii.", "Timeline", "green")
                ]),
            new PilgrimageSection(
                "participant-docs",
                "Dokumenty do pobrania",
                "Regulamin, mapa PDF, checklista, plan dnia.",
                [
                    new PilgrimageCard("doc-1", "Regulamin + RODO", "Dokumenty formalne i zgody dla uczestnikow.", null, "sand"),
                    new PilgrimageCard("doc-2", "Mapa PDF i GPX", "Trasa i etapy do uzycia offline.", null, "blue")
                ]),
            new PilgrimageSection(
                "participant-checklist",
                "Co zabrac",
                "Wersja skrocona do odhaczania na telefonie.",
                [
                    new PilgrimageCard("gear", "Trasa", "Buty, warstwy, woda, drobny prowiant.", "Checklist", "sand"),
                    new PilgrimageCard("sleep", "Nocleg", "Spiwor, karimata, rzeczy na wieczor i poranek.", "Checklist", "green")
                ]),
            new PilgrimageSection(
                "participant-logistics",
                "Nocleg i logistyka",
                "Miejsce zbioru bagazu, nocleg, postoje, powrot.",
                [
                    new PilgrimageCard("baggage", "Transport bagazu", "Godzina i punkt przekazania bagazu.", null, "blue"),
                    new PilgrimageCard("stops", "Postoje", "Orientacyjne godziny i punkty z cieplym posilkiem.", null, "sand"),
                    new PilgrimageCard("return", "Powrot", "Wspolny lub indywidualny - wg komunikatu koncowego.", null, "green")
                ]),
            new PilgrimageSection(
                "participant-emergency",
                "Kontakt awaryjny",
                "Szybkie kanaly zgloszenia problemu.",
                [
                    new PilgrimageCard("call", "Zadzwon", "Bezposredni numer organizatora dyzurnego.", "Priorytet", "coral"),
                    new PilgrimageCard("sms", "Wyslij SMS", "Szybkie zgloszenie trudnosci na trasie.", "Priorytet", "coral"),
                    new PilgrimageCard("pickup", "Zglos potrzebe odbioru", "Rezygnacja lub zejscie z trasy.", "Bezpieczenstwo", "blue")
                ])
        ]);

        var organizerConfig = new PilgrimageZoneConfig([
            new PilgrimageSection(
                "dashboard",
                "Dashboard",
                "Kluczowe liczby, zadania i komunikaty bez przechodzenia po zakladkach.",
                [
                    new PilgrimageCard("s1", "Liczba zgloszen", "Wszystkie rejestracje.", "Live", "blue"),
                    new PilgrimageCard("s2", "Potwierdzone", "Uczestnicy gotowi do startu.", "Status", "green"),
                    new PilgrimageCard("s3", "Oplaceni", "Kontrola rozliczen.", "Finanse", "sand"),
                    new PilgrimageCard("s4", "Niepelnoletni", "Weryfikacja wymaganych zgod.", "Bezpieczenstwo", "coral")
                ]),
            new PilgrimageSection(
                "participants",
                "Uczestnicy",
                "Tabela z filtrowaniem: dane, warianty i bezpieczenstwo.",
                [
                    new PilgrimageCard("columns", "Pola", "Imie i nazwisko, telefon, email, wariant, nocleg, platnosc, zgody, kontakt awaryjny, zdrowie, grupa.", "Eksport CSV/Excel", "blue")
                ]),
            new PilgrimageSection(
                "groups",
                "Grupy i odpowiedzialni",
                "Przypisanie uczestnikow do grup i liderow.",
                [
                    new PilgrimageCard("group-1", "Grupa marszowa", "Nazwa grupy, lider, liczebnosc.", "Operacyjne", "sand"),
                    new PilgrimageCard("group-2", "Odpowiedzialni", "Logistyka, medyczni, porzadkowi, schola.", "Role", "blue")
                ]),
            new PilgrimageSection(
                "tasks",
                "Zadania organizatorow",
                "Kanban: do zrobienia, w trakcie, zrobione, pilne.",
                [
                    new PilgrimageCard("task-fields", "Element zadania", "Tytul, opis, odpowiedzialny, termin, komentarze, zalaczniki.", "Operacyjnie", "sand")
                ]),
            new PilgrimageSection(
                "communication",
                "Komunikacja",
                "Komunikaty WWW i kanal SMS z historia wysylek.",
                [
                    new PilgrimageCard("audience", "Grupy odbiorcow", "Wszyscy, grupa, pilny alert.", "Public/participant/organizer", "blue"),
                    new PilgrimageCard("history", "Historia", "Archiwum wysylek i komunikatow.", "Audyt", "green")
                ]),
            new PilgrimageSection(
                "logistics",
                "Logistyka",
                "Zakladki: nocleg, posilki, bagaz, samochod techniczny, postoje, schola, porzadkowi.",
                [
                    new PilgrimageCard("lodging", "Nocleg", "Sale K/M, namioty, pokoje - limity i przydzialy.", null, "sand"),
                    new PilgrimageCard("food", "Posilki", "Kolacja, sniadanie, cieply posilek, woda.", null, "green"),
                    new PilgrimageCard("route", "Punkty postoju", "Szkola Sosnowice, Przytkowice i inne punkty operacyjne.", null, "blue")
                ]),
            new PilgrimageSection(
                "safety",
                "Bezpieczenstwo",
                "Kontakty alarmowe, zdrowie, punkty zejscia z trasy i wydruk list awaryjnych.",
                [
                    new PilgrimageCard("health", "Informacje zdrowotne", "Dostep roli medycznej i organizatora.", "Wysoki priorytet", "coral"),
                    new PilgrimageCard("exit", "Punkty zejscia", "Miejsca odbioru i procedury.", "Kryzys", "coral")
                ]),
            new PilgrimageSection(
                "exports",
                "Eksporty",
                "CSV/Excel: uczestnicy, nocleg, oplaty, kontakty, grupy, obecnosc.",
                [
                    new PilgrimageCard("export-list", "Pakiety eksportowe", "Dane pod nocleg, finanse i koordynacje grup.", "Operacje", "blue")
                ])
        ]);

        return NormalizeSiteDocument(new PilgrimageSiteDocument(publicConfig, participantConfig, organizerConfig));
    }

    private sealed record RoleBundle(Guid RoleId, byte[] ReadKey, byte[] WriteKey, byte[] OwnerKey);

    private sealed record DataKeyBundle(Guid DataItemId, Guid DataKeyId, byte[] DataKey);

    private sealed record PilgrimageParticipantPayload(
        string FullName,
        string Phone,
        string? Email,
        string? Parish,
        DateOnly? BirthDate,
        bool IsMinor,
        string ParticipationVariant,
        bool NeedsLodging,
        bool NeedsBaggageTransport,
        string EmergencyContactName,
        string EmergencyContactPhone,
        string? HealthNotes,
        string? DietNotes,
        bool AcceptedTerms,
        bool AcceptedRodo,
        bool AcceptedImageConsent);
}
