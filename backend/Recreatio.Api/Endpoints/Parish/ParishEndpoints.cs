using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Parish;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class ParishEndpoints
{
    private const string RoleKindParish = "parish";
    private const string RoleKindParishAdmin = "parish-admin";
    private const string RoleKindParishPriest = "parish-priest";
    private const string RoleKindParishOffice = "parish-office";
    private const string RoleKindParishFinance = "parish-finance";
    private const string RoleKindParishPublic = "parish-public";
    private const int ConfirmationPhoneLimit = 6;
    private const int ConfirmationMeetingMinCapacity = 2;
    private const int ConfirmationMeetingMaxCapacity = 3;
    private const int ConfirmationMeetingMinDurationMinutes = 10;
    private const int ConfirmationMeetingMaxDurationMinutes = 180;
    private const int ConfirmationMeetingInviteHostHours = 72;
    private const int ConfirmationMeetingInviteCodeLength = 6;
    private const string ConfirmationMeetingStageYear1Start = "year1-start";
    private const string ConfirmationMeetingStageYear1End = "year1-end";
    private const string ConfirmationSecondMeetingAnnouncement =
        "Spotkanie na zakończenie 1. roku formacji zostanie udostępnione do zapisów w czerwcu 2026.";
    private const string ConfirmationMeetingInviteCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const string ConfirmationJoinRequestPending = "pending";
    private const string ConfirmationJoinRequestAccepted = "accepted";
    private const string ConfirmationJoinRequestRejected = "rejected";
    private const string ConfirmationJoinRequestCancelled = "cancelled";
    private const string ConfirmationJoinDecisionAccept = "accept";
    private const string ConfirmationJoinDecisionReject = "reject";
    private const int ConfirmationCelebrationUpcomingDays = 7;
    private const int ConfirmationCelebrationCommentEditGraceDays = 7;
    private const int ConfirmationEventCapacityMax = 500;
    private const string ConfirmationEventJoinPending = "pending";
    private const string ConfirmationEventJoinAccepted = "accepted";
    private const string ConfirmationEventJoinCancelled = "cancelled";
    private const string ConfirmationEventJoinRemoved = "removed";
    private const string ConfirmationEventJoinRejected = "rejected";
    private const string ConfirmationSmsTemplatesLegacyPageKey = "__confirmation_sms_templates";
    private static readonly string[] Breakpoints = { "desktop", "tablet", "mobile" };

    private static ParishSacramentSection NormalizeSacramentSection(ParishSacramentSection? section)
    {
        return new ParishSacramentSection(
            (section?.Title ?? string.Empty).Trim(),
            (section?.Body ?? string.Empty).Trim());
    }

    private static string NormalizeConfirmationMeetingStage(string? stage)
    {
        var normalized = (stage ?? string.Empty).Trim().ToLowerInvariant();
        return normalized == ConfirmationMeetingStageYear1End
            ? ConfirmationMeetingStageYear1End
            : ConfirmationMeetingStageYear1Start;
    }

    private static ParishSacramentParishPage NormalizeSacramentParishPage(ParishSacramentParishPage? page)
    {
        var sections = (page?.Sections ?? Array.Empty<ParishSacramentSection>())
            .Select(NormalizeSacramentSection)
            .Where(section => !string.IsNullOrWhiteSpace(section.Title) || !string.IsNullOrWhiteSpace(section.Body))
            .ToList();
        var notice = string.IsNullOrWhiteSpace(page?.Notice) ? null : page?.Notice?.Trim();

        return new ParishSacramentParishPage(
            (page?.Title ?? string.Empty).Trim(),
            (page?.Lead ?? string.Empty).Trim(),
            notice,
            sections);
    }

    private static Dictionary<string, ParishSacramentParishPage>? NormalizeSacramentParishPages(
        Dictionary<string, ParishSacramentParishPage>? pages)
    {
        if (pages is null || pages.Count == 0)
        {
            return null;
        }

        var normalized = new Dictionary<string, ParishSacramentParishPage>(StringComparer.OrdinalIgnoreCase);
        foreach (var (rawKey, value) in pages)
        {
            var key = (rawKey ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            normalized[key] = NormalizeSacramentParishPage(value);
        }

        return normalized.Count == 0 ? null : normalized;
    }

    private static ParishConfirmationSmsTemplates? NormalizeConfirmationSmsTemplates(ParishConfirmationSmsTemplates? templates)
    {
        if (templates is null)
        {
            return null;
        }

        string NormalizeTemplate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var trimmed = value.Replace("\r\n", "\n").Trim();
            return trimmed.Length <= 4000
                ? trimmed
                : trimmed[..4000];
        }

        var verificationInvite = NormalizeTemplate(templates.VerificationInvite);
        var verificationWarning = NormalizeTemplate(templates.VerificationWarning);
        var portalInvite = NormalizeTemplate(templates.PortalInvite);

        if (verificationInvite.Length == 0 && verificationWarning.Length == 0 && portalInvite.Length == 0)
        {
            return null;
        }

        return new ParishConfirmationSmsTemplates(
            verificationInvite,
            verificationWarning,
            portalInvite);
    }

    private static ParishHomepageConfig NormalizeHomepage(ParishHomepageConfig homepage)
    {
        var modules = homepage.Modules.Count == 0
            ? new List<ParishLayoutItem>()
            : homepage.Modules.Select(module =>
            {
                var layouts = module.Layouts ?? new Dictionary<string, ParishLayoutFrame>(StringComparer.OrdinalIgnoreCase);

                if (layouts.Count == 0 && module.Position is not null && module.Size is not null)
                {
                    var frame = new ParishLayoutFrame(module.Position, module.Size);
                    foreach (var breakpoint in Breakpoints)
                    {
                        layouts[breakpoint] = frame;
                    }
                }

                if (layouts.Count == 0)
                {
                    var fallbackFrame = new ParishLayoutFrame(
                        new ParishLayoutPosition(1, 1),
                        new ParishLayoutSize(2, 1));
                    foreach (var breakpoint in Breakpoints)
                    {
                        layouts[breakpoint] = fallbackFrame;
                    }
                }
                else
                {
                    var fallback = layouts.Values.First();
                    foreach (var breakpoint in Breakpoints)
                    {
                        if (!layouts.ContainsKey(breakpoint))
                        {
                            layouts[breakpoint] = fallback;
                        }
                    }
                }

                layouts = new Dictionary<string, ParishLayoutFrame>(layouts, StringComparer.OrdinalIgnoreCase);

                return new ParishLayoutItem
                {
                    Id = module.Id,
                    Type = module.Type,
                    Layouts = layouts,
                    Position = layouts["desktop"].Position,
                    Size = layouts["desktop"].Size,
                    Props = module.Props
                };
            }).ToList();

        return new ParishHomepageConfig(
            modules,
            NormalizeSacramentParishPages(homepage.SacramentParishPages),
            NormalizeConfirmationSmsTemplates(homepage.ConfirmationSmsTemplates));
    }

    private static ParishConfirmationSmsTemplates? MapConfirmationSmsTemplates(ParishConfirmationSmsTemplate? entity)
    {
        if (entity is null)
        {
            return null;
        }

        return NormalizeConfirmationSmsTemplates(new ParishConfirmationSmsTemplates(
            entity.VerificationInviteTemplate,
            entity.VerificationWarningTemplate,
            entity.PortalInviteTemplate));
    }

    private static ParishConfirmationSmsTemplates? TryReadLegacyConfirmationSmsTemplates(string? homepageConfigJson)
    {
        if (string.IsNullOrWhiteSpace(homepageConfigJson))
        {
            return null;
        }

        try
        {
            var homepage = JsonSerializer.Deserialize<ParishHomepageConfig>(homepageConfigJson);
            if (homepage is null)
            {
                return null;
            }

            var fromDedicatedField = NormalizeConfirmationSmsTemplates(homepage.ConfirmationSmsTemplates);
            if (fromDedicatedField is not null)
            {
                return fromDedicatedField;
            }

            if (homepage.SacramentParishPages is null ||
                !homepage.SacramentParishPages.TryGetValue(ConfirmationSmsTemplatesLegacyPageKey, out var page) ||
                string.IsNullOrWhiteSpace(page?.Notice))
            {
                return null;
            }

            var parsed = JsonSerializer.Deserialize<ParishConfirmationSmsTemplates>(page.Notice!);
            return NormalizeConfirmationSmsTemplates(parsed);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool IsConfirmationEventJoinStatusActive(string? status)
    {
        return string.Equals(status, ConfirmationEventJoinPending, StringComparison.OrdinalIgnoreCase) ||
               string.Equals(status, ConfirmationEventJoinAccepted, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsConfirmationEventJoinStatusAccepted(string? status)
    {
        return string.Equals(status, ConfirmationEventJoinAccepted, StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeConfirmationEventJoinStatus(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            ConfirmationEventJoinPending => ConfirmationEventJoinPending,
            ConfirmationEventJoinAccepted => ConfirmationEventJoinAccepted,
            ConfirmationEventJoinCancelled => ConfirmationEventJoinCancelled,
            ConfirmationEventJoinRemoved => ConfirmationEventJoinRemoved,
            ConfirmationEventJoinRejected => ConfirmationEventJoinRejected,
            _ => null
        };
    }

    private static ParishConfirmationEventResponse BuildConfirmationEventResponse(
        ParishConfirmationEvent confirmationEvent,
        ParishConfirmationEventJoin? candidateJoin,
        int reservedCount,
        int acceptedCount,
        IReadOnlyList<ParishConfirmationEventJoinResponse>? joins)
    {
        return new ParishConfirmationEventResponse(
            confirmationEvent.Id,
            confirmationEvent.Name,
            confirmationEvent.ShortInfo,
            confirmationEvent.StartsAtUtc,
            confirmationEvent.EndsAtUtc,
            confirmationEvent.Description,
            confirmationEvent.Capacity,
            confirmationEvent.IsActive,
            confirmationEvent.CreatedUtc,
            confirmationEvent.UpdatedUtc,
            candidateJoin?.Status,
            candidateJoin?.UpdatedUtc,
            reservedCount,
            acceptedCount,
            joins);
    }

    private static ParishConfirmationCelebrationResponse BuildConfirmationCelebrationResponse(
        ParishConfirmationCelebration celebration,
        ParishConfirmationCelebrationParticipation? participation,
        string? candidateJoinStatus,
        DateTimeOffset? candidateJoinUpdatedUtc,
        int reservedCount,
        int acceptedCount,
        IReadOnlyList<ParishConfirmationCelebrationJoinResponse>? joins)
    {
        return new ParishConfirmationCelebrationResponse(
            celebration.Id,
            celebration.Name,
            celebration.ShortInfo,
            celebration.StartsAtUtc,
            celebration.EndsAtUtc,
            celebration.Description,
            celebration.Capacity,
            celebration.IsActive,
            celebration.CreatedUtc,
            celebration.UpdatedUtc,
            participation?.CommentText,
            participation?.UpdatedUtc,
            candidateJoinStatus,
            candidateJoinUpdatedUtc,
            reservedCount,
            acceptedCount,
            joins);
    }

    public static void MapParishEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/parish");

        group.MapGet("", async (RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            var items = await dbContext.Parishes.AsNoTracking()
                .OrderBy(x => x.Name)
                .Select(x => new ParishSummaryResponse(x.Id, x.Slug, x.Name, x.Location, x.Theme, x.HeroImageUrl))
                .ToListAsync(ct);
            return Results.Ok(items);
        });

        group.MapGet("/{slug}", async (string slug, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var config = await dbContext.ParishSiteConfigs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.IsPublished, ct);
            if (config is null)
            {
                return Results.NotFound();
            }

            ParishHomepageConfig homepage;
            try
            {
                homepage = NormalizeHomepage(JsonSerializer.Deserialize<ParishHomepageConfig>(config.HomepageConfigJson)
                    ?? new ParishHomepageConfig(Array.Empty<ParishLayoutItem>()));
            }
            catch (JsonException)
            {
                homepage = new ParishHomepageConfig(Array.Empty<ParishLayoutItem>());
            }
            return Results.Ok(new ParishSiteResponse(
                parish.Id,
                parish.Slug,
                parish.Name,
                parish.Location,
                parish.Theme,
                parish.HeroImageUrl,
                homepage));
        });

        group.MapGet("/{slug}/public/intentions", async (
            string slug,
            DateTimeOffset? from,
            DateTimeOffset? to,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var fromDate = from ?? DateTimeOffset.UtcNow.AddDays(-1);
            var toDate = to ?? DateTimeOffset.UtcNow.AddDays(14);
            var intentions = await dbContext.ParishIntentions.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.MassDateTime >= fromDate && x.MassDateTime <= toDate)
                .OrderBy(x => x.MassDateTime)
                .Select(x => new ParishIntentionsPublicResponse(
                    x.Id,
                    x.MassDateTime,
                    x.ChurchName,
                    x.PublicText,
                    x.Status))
                .ToListAsync(ct);

            return Results.Ok(intentions);
        });

        group.MapGet("/{slug}/public/masses", async (
            string slug,
            DateTimeOffset? from,
            DateTimeOffset? to,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var fromDate = from ?? DateTimeOffset.UtcNow.AddDays(-1);
            var toDate = to ?? DateTimeOffset.UtcNow.AddDays(30);
            var masses = await dbContext.ParishMasses.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.MassDateTime >= fromDate && x.MassDateTime <= toDate)
                .OrderBy(x => x.MassDateTime)
                .Select(x => new ParishMassPublicResponse(
                    x.Id,
                    x.MassDateTime,
                    x.ChurchName,
                    x.Title,
                    x.Note,
                    x.IsCollective,
                    x.DurationMinutes,
                    x.Kind,
                    x.BeforeService,
                    x.AfterService,
                    x.IntentionsJson,
                    x.DonationSummary))
                .ToListAsync(ct);

            return Results.Ok(masses);
        });

        group.MapPost("/{slug}/public/confirmation-candidates", async (
            string slug,
            ParishConfirmationCandidateCreateRequest request,
            RecreatioDbContext dbContext,
            IDataProtectionProvider dataProtectionProvider,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var name = NormalizeConfirmationText(request.Name, 120);
            var surname = NormalizeConfirmationText(request.Surname, 120);
            var address = NormalizeConfirmationText(request.Address, 260);
            var schoolShort = NormalizeConfirmationText(request.SchoolShort, 140);
            var phoneNumbers = NormalizeConfirmationPhones(request.PhoneNumbers);

            if (name is null || surname is null || address is null || schoolShort is null)
            {
                return Results.BadRequest(new { error = "Name, surname, address and school are required." });
            }

            if (!request.AcceptedRodo)
            {
                return Results.BadRequest(new { error = "RODO consent is required." });
            }

            if (phoneNumbers.Count == 0)
            {
                return Results.BadRequest(new { error = "At least one valid phone number in +48XXXXXXXXX format is required." });
            }

            var now = DateTimeOffset.UtcNow;
            var candidateId = Guid.NewGuid();
            var payload = new ParishConfirmationPayload(name, surname, phoneNumbers, address, schoolShort, true);
            var payloadJson = JsonSerializer.SerializeToUtf8Bytes(payload);
            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parish.Id);
            var payloadEnc = protector.Protect(payloadJson);

            dbContext.ParishConfirmationCandidates.Add(new()
            {
                Id = candidateId,
                ParishId = parish.Id,
                PayloadEnc = payloadEnc,
                AcceptedRodo = true,
                PaperConsentReceived = false,
                CreatedUtc = now,
                UpdatedUtc = now
            });

            for (var index = 0; index < phoneNumbers.Count; index += 1)
            {
                dbContext.ParishConfirmationPhoneVerifications.Add(new()
                {
                    Id = Guid.NewGuid(),
                    ParishId = parish.Id,
                    CandidateId = candidateId,
                    PhoneIndex = index,
                    VerificationToken = CreatePhoneVerificationToken(),
                    VerifiedUtc = null,
                    CreatedUtc = now
                });
            }

            var meetingToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(
                dbContext,
                null,
                ct);
            dbContext.ParishConfirmationMeetingLinks.Add(new ParishConfirmationMeetingLink
            {
                Id = Guid.NewGuid(),
                ParishId = parish.Id,
                CandidateId = candidateId,
                BookingToken = meetingToken,
                SlotId = null,
                BookedUtc = null,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationCandidateCreated",
                "public",
                JsonSerializer.Serialize(new { Id = candidateId, PhoneCount = phoneNumbers.Count }),
                ct);

            return Results.Ok(new { id = candidateId });
        });

        group.MapPost("/{slug}/public/confirmation-phone-verify", async (
            string slug,
            ParishConfirmationPhoneVerifyRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = request.Token?.Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                return Results.BadRequest(new { error = "Verification token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var verification = await dbContext.ParishConfirmationPhoneVerifications
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.VerificationToken == token, ct);
            if (verification is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            if (verification.VerifiedUtc is not null)
            {
                return Results.Ok(new { status = "already-verified", verifiedUtc = verification.VerifiedUtc });
            }

            verification.VerifiedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationPhoneVerified",
                "public",
                JsonSerializer.Serialize(new { verification.CandidateId, verification.PhoneIndex }),
                ct);

            return Results.Ok(new { status = "verified", verifiedUtc = verification.VerifiedUtc });
        });

        group.MapPost("/{slug}/public/confirmation-meeting-availability", async (
            string slug,
            ParishConfirmationMeetingAvailabilityRequest request,
            RecreatioDbContext dbContext,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            var inviteCode = NormalizeConfirmationInviteCode(request.InviteCode);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Meeting token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var candidate = await dbContext.ParishConfirmationCandidates.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == link.CandidateId && x.ParishId == parish.Id, ct);
            if (candidate is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parish.Id);
            var payload = TryUnprotectConfirmationPayload(candidate.PayloadEnc, protector);
            if (payload is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var slots = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                .Where(x =>
                    x.ParishId == parish.Id &&
                    x.IsActive &&
                    x.Stage == ConfirmationMeetingStageYear1Start)
                .OrderBy(x => x.StartsAtUtc)
                .ToListAsync(ct);
            var slotIds = slots.Select(x => x.Id).ToList();
            var reservedCounts = slotIds.Count == 0
                ? new Dictionary<Guid, int>()
                : await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                    .Where(x => x.ParishId == parish.Id && x.SlotId != null && slotIds.Contains(x.SlotId.Value))
                    .GroupBy(x => x.SlotId!.Value)
                    .ToDictionaryAsync(group => group.Key, group => group.Count(), ct);

            var now = DateTimeOffset.UtcNow;
            var selectedSlotId = link.SlotId;
            var selectedSlot = selectedSlotId is null
                ? null
                : slots.FirstOrDefault(slot => slot.Id == selectedSlotId.Value);
            var canInviteToSelectedSlot = selectedSlot is not null
                && CanCandidateInviteToConfirmationSlot(selectedSlot, link.CandidateId, now);
            var pendingJoinRequests = canInviteToSelectedSlot && selectedSlot is not null
                ? await LoadPendingConfirmationMeetingJoinRequestsAsync(
                    parish.Id,
                    selectedSlot.Id,
                    link.CandidateId,
                    dbContext,
                    dataProtectionProvider,
                    ct)
                : new List<ParishConfirmationMeetingJoinRequestResponse>();
            var response = new ParishConfirmationMeetingAvailabilityResponse(
                link.CandidateId,
                $"{payload.Name} {payload.Surname}".Trim(),
                candidate.PaperConsentReceived,
                selectedSlotId,
                link.BookedUtc,
                canInviteToSelectedSlot,
                canInviteToSelectedSlot ? selectedSlot?.HostInviteToken : null,
                canInviteToSelectedSlot ? selectedSlot?.HostInviteExpiresUtc : null,
                pendingJoinRequests,
                slots.Select(slot =>
                {
                    var reserved = reservedCounts.GetValueOrDefault(slot.Id);
                    var isSelected = selectedSlotId == slot.Id;
                    var joinStatus = isSelected
                        ? ConfirmationMeetingJoinStatus.Allowed
                        : EvaluateConfirmationMeetingJoinStatus(slot, link.CandidateId, reserved, inviteCode, now);
                    var isAvailable = isSelected || joinStatus == ConfirmationMeetingJoinStatus.Allowed;
                    var requiresInviteCode = !isSelected && joinStatus == ConfirmationMeetingJoinStatus.InviteRequired;
                    var visualStatus = ResolveConfirmationMeetingVisualStatus(slot, reserved, now);
                    return new ParishConfirmationMeetingPublicSlotResponse(
                        slot.Id,
                        slot.StartsAtUtc,
                        slot.DurationMinutes,
                        slot.Capacity,
                        slot.Label,
                        slot.Stage,
                        reserved,
                        isAvailable,
                        requiresInviteCode,
                        isSelected,
                        visualStatus);
                }).ToList());

            return Results.Ok(response);
        });

        group.MapPost("/{slug}/public/confirmation-meeting-book", async (
            string slug,
            ParishConfirmationMeetingBookRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            var inviteCode = NormalizeConfirmationInviteCode(request.InviteCode);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Meeting token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var slot = await dbContext.ParishConfirmationMeetingSlots
                .FirstOrDefaultAsync(
                    x =>
                        x.ParishId == parish.Id &&
                        x.Id == request.SlotId &&
                        x.IsActive &&
                        x.Stage == ConfirmationMeetingStageYear1Start,
                    ct);
            if (slot is null)
            {
                return Results.NotFound(new { status = "slot-not-found" });
            }

            if (link.SlotId == slot.Id)
            {
                return Results.Ok(new ParishConfirmationMeetingBookResponse("already-selected", link.SlotId, link.BookedUtc));
            }

            var now = DateTimeOffset.UtcNow;
            var previousSlotId = link.SlotId;
            var reservedCount = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.SlotId == slot.Id && x.CandidateId != link.CandidateId)
                .CountAsync(ct);
            var joinStatus = EvaluateConfirmationMeetingJoinStatus(slot, link.CandidateId, reservedCount, inviteCode, now);
            if (joinStatus == ConfirmationMeetingJoinStatus.Full)
            {
                return Results.Ok(new ParishConfirmationMeetingBookResponse("slot-full", link.SlotId, link.BookedUtc));
            }
            if (joinStatus == ConfirmationMeetingJoinStatus.InviteRequired)
            {
                return Results.Ok(new ParishConfirmationMeetingBookResponse("invite-required", link.SlotId, link.BookedUtc));
            }
            if (joinStatus == ConfirmationMeetingJoinStatus.Locked)
            {
                return Results.Ok(new ParishConfirmationMeetingBookResponse("slot-locked", link.SlotId, link.BookedUtc));
            }

            link.SlotId = slot.Id;
            link.BookedUtc = now;
            link.UpdatedUtc = now;

            if (reservedCount == 0)
            {
                slot.HostCandidateId = link.CandidateId;
                slot.HostInviteToken = await CreateUniqueConfirmationMeetingSlotInviteTokenAsync(dbContext, null, ct);
                slot.HostInviteExpiresUtc = now.AddHours(ConfirmationMeetingInviteHostHours);
                slot.UpdatedUtc = now;
            }

            if (previousSlotId is not null && previousSlotId != slot.Id)
            {
                await RefreshConfirmationMeetingSlotHostAsync(
                    parish.Id,
                    previousSlotId.Value,
                    dbContext,
                    now,
                    ct);
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationMeetingSlotSelected",
                "public",
                JsonSerializer.Serialize(new { link.CandidateId, slot.Id, Status = "selected" }),
                ct);

            return Results.Ok(new ParishConfirmationMeetingBookResponse("selected", link.SlotId, link.BookedUtc));
        });

        group.MapPost("/{slug}/public/confirmation-meeting-release-host", async (
            string slug,
            ParishConfirmationMeetingReleaseHostRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Meeting token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            if (link.SlotId is null)
            {
                return Results.Ok(new ParishConfirmationMeetingReleaseHostResponse("no-slot-selected", null));
            }

            var slot = await dbContext.ParishConfirmationMeetingSlots
                .FirstOrDefaultAsync(
                    x =>
                        x.ParishId == parish.Id &&
                        x.Id == link.SlotId.Value &&
                        x.IsActive &&
                        x.Stage == ConfirmationMeetingStageYear1Start,
                    ct);
            if (slot is null)
            {
                return Results.NotFound(new { status = "slot-not-found" });
            }

            if (slot.HostCandidateId is null)
            {
                return Results.Ok(new ParishConfirmationMeetingReleaseHostResponse("already-public", slot.Id));
            }

            if (slot.HostCandidateId != link.CandidateId)
            {
                return Results.Ok(new ParishConfirmationMeetingReleaseHostResponse("not-host", slot.Id));
            }

            var reservedCount = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.SlotId == slot.Id)
                .CountAsync(ct);
            if (reservedCount != 1)
            {
                return Results.Ok(new ParishConfirmationMeetingReleaseHostResponse("not-eligible", slot.Id));
            }

            var now = DateTimeOffset.UtcNow;
            slot.HostCandidateId = null;
            slot.HostInviteToken = null;
            slot.HostInviteExpiresUtc = null;
            slot.UpdatedUtc = now;

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationMeetingHostReleased",
                "public",
                JsonSerializer.Serialize(new { link.CandidateId, slot.Id }),
                ct);

            return Results.Ok(new ParishConfirmationMeetingReleaseHostResponse("released", slot.Id));
        });

        group.MapPost("/{slug}/public/confirmation-meeting-resign", async (
            string slug,
            ParishConfirmationMeetingResignRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Meeting token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            if (link.SlotId is null)
            {
                return Results.Ok(new ParishConfirmationMeetingResignResponse("no-slot-selected", null));
            }

            var previousSlotId = link.SlotId.Value;
            var now = DateTimeOffset.UtcNow;
            link.SlotId = null;
            link.BookedUtc = null;
            link.UpdatedUtc = now;

            await RefreshConfirmationMeetingSlotHostAsync(
                parish.Id,
                previousSlotId,
                dbContext,
                now,
                ct);

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationMeetingSlotResigned",
                "public",
                JsonSerializer.Serialize(new { link.CandidateId, SlotId = previousSlotId }),
                ct);

            return Results.Ok(new ParishConfirmationMeetingResignResponse("resigned", previousSlotId));
        });

        group.MapPost("/{slug}/public/confirmation-meeting-join-request", async (
            string slug,
            ParishConfirmationMeetingJoinRequestCreateRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Meeting token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var slot = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.ParishId == parish.Id &&
                        x.Id == request.SlotId &&
                        x.IsActive &&
                        x.Stage == ConfirmationMeetingStageYear1Start,
                    ct);
            if (slot is null)
            {
                return Results.NotFound(new { status = "slot-not-found" });
            }

            if (link.SlotId == slot.Id)
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestCreateResponse("already-selected", null));
            }

            if (slot.HostCandidateId is null || !IsConfirmationMeetingInviteActive(slot, DateTimeOffset.UtcNow))
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestCreateResponse("slot-not-hosted", null));
            }

            if (slot.HostCandidateId == link.CandidateId)
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestCreateResponse("host-candidate", null));
            }

            var reservedCount = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.SlotId == slot.Id)
                .CountAsync(ct);
            if (reservedCount >= slot.Capacity)
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestCreateResponse("slot-full", null));
            }

            var existingPendingRequest = await dbContext.ParishConfirmationMeetingJoinRequests.AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.ParishId == parish.Id &&
                        x.SlotId == slot.Id &&
                        x.RequestedByCandidateId == link.CandidateId &&
                        x.Status == ConfirmationJoinRequestPending,
                    ct);
            if (existingPendingRequest is not null)
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestCreateResponse("already-pending", existingPendingRequest.Id));
            }

            var now = DateTimeOffset.UtcNow;
            var joinRequest = new ParishConfirmationMeetingJoinRequest
            {
                Id = Guid.NewGuid(),
                ParishId = parish.Id,
                SlotId = slot.Id,
                RequestedByCandidateId = link.CandidateId,
                HostCandidateId = slot.HostCandidateId.Value,
                Status = ConfirmationJoinRequestPending,
                CreatedUtc = now,
                UpdatedUtc = now,
                DecidedUtc = null
            };
            dbContext.ParishConfirmationMeetingJoinRequests.Add(joinRequest);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationMeetingJoinRequested",
                "public",
                JsonSerializer.Serialize(new { slot.Id, RequestId = joinRequest.Id, RequestedByCandidateId = link.CandidateId }),
                ct);

            return Results.Ok(new ParishConfirmationMeetingJoinRequestCreateResponse("requested", joinRequest.Id));
        });

        group.MapPost("/{slug}/public/confirmation-meeting-join-request-decision", async (
            string slug,
            ParishConfirmationMeetingJoinRequestDecisionRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var decision = NormalizeConfirmationJoinDecision(request.Decision);
            if (decision is null)
            {
                return Results.BadRequest(new { error = "Decision must be 'accept' or 'reject'." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Meeting token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var hostLink = await dbContext.ParishConfirmationMeetingLinks
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (hostLink is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            if (hostLink.SlotId is null)
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("no-slot-selected", null, null));
            }

            var slot = await dbContext.ParishConfirmationMeetingSlots
                .FirstOrDefaultAsync(
                    x =>
                        x.ParishId == parish.Id &&
                        x.Id == hostLink.SlotId.Value &&
                        x.IsActive &&
                        x.Stage == ConfirmationMeetingStageYear1Start,
                    ct);
            if (slot is null)
            {
                return Results.NotFound(new { status = "slot-not-found" });
            }

            if (slot.HostCandidateId != hostLink.CandidateId)
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("not-host", null, null));
            }

            var joinRequest = await dbContext.ParishConfirmationMeetingJoinRequests
                .FirstOrDefaultAsync(
                    x =>
                        x.Id == request.RequestId &&
                        x.ParishId == parish.Id &&
                        x.SlotId == slot.Id &&
                        x.HostCandidateId == hostLink.CandidateId,
                    ct);
            if (joinRequest is null)
            {
                return Results.NotFound(new { status = "request-not-found" });
            }

            if (!string.Equals(joinRequest.Status, ConfirmationJoinRequestPending, StringComparison.OrdinalIgnoreCase))
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("already-processed", joinRequest.Id, joinRequest.RequestedByCandidateId));
            }

            var now = DateTimeOffset.UtcNow;
            if (string.Equals(decision, ConfirmationJoinDecisionReject, StringComparison.Ordinal))
            {
                joinRequest.Status = ConfirmationJoinRequestRejected;
                joinRequest.UpdatedUtc = now;
                joinRequest.DecidedUtc = now;
                await dbContext.SaveChangesAsync(ct);

                await ledgerService.AppendParishAsync(
                    parish.Id,
                    "ConfirmationMeetingJoinRejected",
                    "public",
                    JsonSerializer.Serialize(new { slot.Id, RequestId = joinRequest.Id, joinRequest.RequestedByCandidateId }),
                    ct);

                return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("rejected", joinRequest.Id, joinRequest.RequestedByCandidateId));
            }

            var requesterLink = await dbContext.ParishConfirmationMeetingLinks
                .FirstOrDefaultAsync(
                    x =>
                        x.ParishId == parish.Id &&
                        x.CandidateId == joinRequest.RequestedByCandidateId,
                    ct);
            if (requesterLink is null)
            {
                joinRequest.Status = ConfirmationJoinRequestCancelled;
                joinRequest.UpdatedUtc = now;
                joinRequest.DecidedUtc = now;
                await dbContext.SaveChangesAsync(ct);
                return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("request-cancelled", joinRequest.Id, joinRequest.RequestedByCandidateId));
            }

            if (requesterLink.SlotId == slot.Id)
            {
                joinRequest.Status = ConfirmationJoinRequestAccepted;
                joinRequest.UpdatedUtc = now;
                joinRequest.DecidedUtc = now;
                await dbContext.SaveChangesAsync(ct);
                return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("already-joined", joinRequest.Id, joinRequest.RequestedByCandidateId));
            }

            var reservedCount = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.SlotId == slot.Id && x.CandidateId != requesterLink.CandidateId)
                .CountAsync(ct);
            if (reservedCount >= slot.Capacity)
            {
                return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("slot-full", joinRequest.Id, joinRequest.RequestedByCandidateId));
            }

            var previousSlotId = requesterLink.SlotId;
            requesterLink.SlotId = slot.Id;
            requesterLink.BookedUtc = now;
            requesterLink.UpdatedUtc = now;

            joinRequest.Status = ConfirmationJoinRequestAccepted;
            joinRequest.UpdatedUtc = now;
            joinRequest.DecidedUtc = now;

            var otherPendingRequests = await dbContext.ParishConfirmationMeetingJoinRequests
                .Where(x =>
                    x.ParishId == parish.Id &&
                    x.RequestedByCandidateId == requesterLink.CandidateId &&
                    x.Status == ConfirmationJoinRequestPending &&
                    x.Id != joinRequest.Id)
                .ToListAsync(ct);
            foreach (var pendingRequest in otherPendingRequests)
            {
                pendingRequest.Status = ConfirmationJoinRequestCancelled;
                pendingRequest.UpdatedUtc = now;
                pendingRequest.DecidedUtc = now;
            }

            if (previousSlotId is not null && previousSlotId != slot.Id)
            {
                await RefreshConfirmationMeetingSlotHostAsync(
                    parish.Id,
                    previousSlotId.Value,
                    dbContext,
                    now,
                    ct);
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationMeetingJoinAccepted",
                "public",
                JsonSerializer.Serialize(new { slot.Id, RequestId = joinRequest.Id, CandidateId = requesterLink.CandidateId }),
                ct);

            return Results.Ok(new ParishConfirmationMeetingJoinRequestDecisionResponse("accepted", joinRequest.Id, requesterLink.CandidateId));
        });

        group.MapPost("/{slug}/public/confirmation-candidate-portal", async (
            string slug,
            ParishConfirmationPortalRequest request,
            RecreatioDbContext dbContext,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            var inviteCode = NormalizeConfirmationInviteCode(request.InviteCode);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Portal token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var candidate = await dbContext.ParishConfirmationCandidates.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == link.CandidateId && x.ParishId == parish.Id, ct);
            if (candidate is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parish.Id);
            var payload = TryUnprotectConfirmationPayload(candidate.PayloadEnc, protector);
            if (payload is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var verificationRows = await dbContext.ParishConfirmationPhoneVerifications.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.CandidateId == candidate.Id)
                .OrderBy(x => x.PhoneIndex)
                .ToListAsync(ct);
            var verificationByIndex = verificationRows
                .GroupBy(x => x.PhoneIndex)
                .ToDictionary(group => group.Key, group => group.First());
            var phones = payload.PhoneNumbers
                .Select((number, index) =>
                {
                    var verification = verificationByIndex.GetValueOrDefault(index);
                    return new ParishConfirmationPhoneResponse(
                        index,
                        number,
                        verification?.VerifiedUtc is not null,
                        verification?.VerifiedUtc,
                        verification?.VerificationToken ?? string.Empty);
                })
                .ToList();

            var slots = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                .Where(x =>
                    x.ParishId == parish.Id &&
                    x.IsActive &&
                    x.Stage == ConfirmationMeetingStageYear1Start)
                .OrderBy(x => x.StartsAtUtc)
                .ToListAsync(ct);
            var slotIds = slots.Select(x => x.Id).ToList();
            var reservedCounts = slotIds.Count == 0
                ? new Dictionary<Guid, int>()
                : await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                    .Where(x => x.ParishId == parish.Id && x.SlotId != null && slotIds.Contains(x.SlotId.Value))
                    .GroupBy(x => x.SlotId!.Value)
                    .ToDictionaryAsync(group => group.Key, group => group.Count(), ct);

            var messages = await dbContext.ParishConfirmationMessages.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.CandidateId == candidate.Id)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(200)
                .Select(x => new ParishConfirmationMessageResponse(x.Id, x.SenderType, x.MessageText, x.CreatedUtc))
                .ToListAsync(ct);

            var publicNotes = await dbContext.ParishConfirmationNotes.AsNoTracking()
                .Where(x => x.ParishId == parish.Id && x.CandidateId == candidate.Id && x.IsPublic)
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(200)
                .Select(x => new ParishConfirmationNoteResponse(x.Id, x.NoteText, x.IsPublic, x.CreatedUtc, x.UpdatedUtc))
                .ToListAsync(ct);
            var upcomingCelebrations = await LoadConfirmationUpcomingCelebrationsAsync(
                parish.Id,
                candidate.Id,
                dbContext,
                ct);
            var upcomingEvents = await LoadConfirmationUpcomingEventsAsync(
                parish.Id,
                candidate.Id,
                dbContext,
                ct);

            var now = DateTimeOffset.UtcNow;
            var selectedSlot = link.SlotId is null
                ? null
                : slots.FirstOrDefault(slot => slot.Id == link.SlotId.Value);
            var canInviteToSelectedSlot = selectedSlot is not null
                && CanCandidateInviteToConfirmationSlot(selectedSlot, candidate.Id, now);
            var pendingJoinRequests = canInviteToSelectedSlot && selectedSlot is not null
                ? await LoadPendingConfirmationMeetingJoinRequestsAsync(
                    parish.Id,
                    selectedSlot.Id,
                    candidate.Id,
                    dbContext,
                    dataProtectionProvider,
                    ct)
                : new List<ParishConfirmationMeetingJoinRequestResponse>();

            var portal = new ParishConfirmationPortalResponse(
                new ParishConfirmationPortalCandidateDataResponse(
                    candidate.Id,
                    payload.Name,
                    payload.Surname,
                    phones,
                    payload.Address,
                    payload.SchoolShort,
                    candidate.PaperConsentReceived,
                    link.BookingToken,
                    link.SlotId,
                    link.BookedUtc,
                    canInviteToSelectedSlot,
                    canInviteToSelectedSlot ? selectedSlot?.HostInviteToken : null,
                    canInviteToSelectedSlot ? selectedSlot?.HostInviteExpiresUtc : null),
                slots.Select(slot =>
                {
                    var reserved = reservedCounts.GetValueOrDefault(slot.Id);
                    var isSelected = link.SlotId == slot.Id;
                    var joinStatus = isSelected
                        ? ConfirmationMeetingJoinStatus.Allowed
                        : EvaluateConfirmationMeetingJoinStatus(slot, candidate.Id, reserved, inviteCode, now);
                    var isAvailable = isSelected || joinStatus == ConfirmationMeetingJoinStatus.Allowed;
                    var requiresInviteCode = !isSelected && joinStatus == ConfirmationMeetingJoinStatus.InviteRequired;
                    var visualStatus = ResolveConfirmationMeetingVisualStatus(slot, reserved, now);
                    return new ParishConfirmationMeetingPublicSlotResponse(
                        slot.Id,
                        slot.StartsAtUtc,
                        slot.DurationMinutes,
                        slot.Capacity,
                        slot.Label,
                        slot.Stage,
                        reserved,
                        isAvailable,
                        requiresInviteCode,
                        isSelected,
                        visualStatus);
                }).ToList(),
                pendingJoinRequests,
                ConfirmationSecondMeetingAnnouncement,
                upcomingEvents,
                upcomingCelebrations,
                messages,
                publicNotes,
                null);

            return Results.Ok(portal);
        });

        group.MapPost("/{slug}/public/confirmation-candidate-message", async (
            string slug,
            ParishConfirmationPortalMessageCreateRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            var messageText = NormalizeConfirmationText(request.MessageText, 2000);
            if (token is null || messageText is null)
            {
                return Results.BadRequest(new { error = "Token and message are required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var message = new ParishConfirmationMessage
            {
                Id = Guid.NewGuid(),
                ParishId = parish.Id,
                CandidateId = link.CandidateId,
                SenderType = "candidate",
                MessageText = messageText,
                CreatedUtc = DateTimeOffset.UtcNow
            };
            dbContext.ParishConfirmationMessages.Add(message);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationCandidateMessageSent",
                "public",
                JsonSerializer.Serialize(new { link.CandidateId }),
                ct);

            return Results.Ok(new ParishConfirmationMessageResponse(
                message.Id,
                message.SenderType,
                message.MessageText,
                message.CreatedUtc));
        });

        group.MapPost("/{slug}/public/confirmation-celebration-comment", async (
            string slug,
            ParishConfirmationCelebrationCommentCreateRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            var commentText = NormalizeConfirmationText(request.CommentText, 2000);
            if (token is null || commentText is null)
            {
                return Results.BadRequest(new { error = "Token and comment are required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var celebration = await dbContext.ParishConfirmationCelebrations.AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == request.CelebrationId && x.ParishId == parish.Id && x.IsActive,
                    ct);
            if (celebration is null)
            {
                return Results.NotFound(new { status = "celebration-not-found" });
            }

            var now = DateTimeOffset.UtcNow;
            var windowEnd = now.AddDays(ConfirmationCelebrationUpcomingDays);
            var pastWindowStart = now.AddDays(-ConfirmationCelebrationCommentEditGraceDays);
            if (celebration.EndsAtUtc < pastWindowStart || celebration.StartsAtUtc > windowEnd)
            {
                return Results.BadRequest(new { error = "Celebration is outside the upcoming window." });
            }

            var editDeadline = celebration.EndsAtUtc.AddDays(ConfirmationCelebrationCommentEditGraceDays);
            if (now > editDeadline)
            {
                return Results.BadRequest(new { error = "Celebration comment edit window has closed." });
            }

            var participation = await dbContext.ParishConfirmationCelebrationParticipations
                .FirstOrDefaultAsync(
                    x =>
                        x.ParishId == parish.Id &&
                        x.CandidateId == link.CandidateId &&
                        x.CelebrationId == celebration.Id,
                    ct);
            if (participation is null)
            {
                participation = new ParishConfirmationCelebrationParticipation
                {
                    Id = Guid.NewGuid(),
                    ParishId = parish.Id,
                    CandidateId = link.CandidateId,
                    CelebrationId = celebration.Id,
                    CommentText = commentText,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.ParishConfirmationCelebrationParticipations.Add(participation);
            }
            else
            {
                participation.CommentText = commentText;
                participation.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationCelebrationCommentUpserted",
                "public",
                JsonSerializer.Serialize(new { link.CandidateId, celebration.Id }),
                ct);

            return Results.Ok(new
            {
                status = "saved",
                participationId = participation.Id,
                participation.UpdatedUtc
            });
        });

        group.MapPost("/{slug}/public/confirmation-events/join", async (
            string slug,
            ParishConfirmationEventJoinCreateRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var now = DateTimeOffset.UtcNow;
            var confirmationEvent = await dbContext.ParishConfirmationEvents.AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.Id == request.EventId &&
                        x.ParishId == parish.Id &&
                        x.IsActive &&
                        x.EndsAtUtc >= now,
                    ct);
            if (confirmationEvent is null)
            {
                return Results.NotFound(new { status = "event-not-found" });
            }

            var join = await dbContext.ParishConfirmationEventJoins
                .FirstOrDefaultAsync(
                    x => x.ParishId == parish.Id && x.CandidateId == link.CandidateId && x.EventId == confirmationEvent.Id,
                    ct);
            var normalizedStatus = NormalizeConfirmationEventJoinStatus(join?.Status);
            if (normalizedStatus == ConfirmationEventJoinAccepted)
            {
                return Results.Ok(new ParishConfirmationEventJoinActionResponse("already-accepted", join!.Id, join.UpdatedUtc));
            }

            if (normalizedStatus == ConfirmationEventJoinPending)
            {
                return Results.Ok(new ParishConfirmationEventJoinActionResponse("already-pending", join!.Id, join.UpdatedUtc));
            }

            var reservedCount = await dbContext.ParishConfirmationEventJoins.AsNoTracking()
                .Where(x =>
                    x.ParishId == parish.Id &&
                    x.EventId == confirmationEvent.Id &&
                    (x.Status == ConfirmationEventJoinPending || x.Status == ConfirmationEventJoinAccepted) &&
                    (join == null || x.Id != join.Id))
                .CountAsync(ct);
            if (confirmationEvent.Capacity is > 0 && reservedCount >= confirmationEvent.Capacity.Value)
            {
                return Results.Ok(new ParishConfirmationEventJoinActionResponse("full", join?.Id, join?.UpdatedUtc));
            }

            if (join is null)
            {
                join = new ParishConfirmationEventJoin
                {
                    Id = Guid.NewGuid(),
                    ParishId = parish.Id,
                    CandidateId = link.CandidateId,
                    EventId = confirmationEvent.Id,
                    Status = ConfirmationEventJoinPending,
                    RequestedUtc = now,
                    DecisionUtc = null,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.ParishConfirmationEventJoins.Add(join);
            }
            else
            {
                join.Status = ConfirmationEventJoinPending;
                join.RequestedUtc = now;
                join.DecisionUtc = null;
                join.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationEventJoinRequested",
                "public",
                JsonSerializer.Serialize(new
                {
                    CandidateId = link.CandidateId,
                    EventId = confirmationEvent.Id,
                    JoinId = join.Id
                }),
                ct);

            return Results.Ok(new ParishConfirmationEventJoinActionResponse("requested", join.Id, join.UpdatedUtc));
        });

        group.MapPost("/{slug}/public/confirmation-events/leave", async (
            string slug,
            ParishConfirmationEventJoinCreateRequest request,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var token = NormalizeConfirmationToken(request.Token);
            if (token is null)
            {
                return Results.BadRequest(new { error = "Token is required." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == slug, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id && x.BookingToken == token, ct);
            if (link is null)
            {
                return Results.NotFound(new { status = "invalid-token" });
            }

            var join = await dbContext.ParishConfirmationEventJoins
                .FirstOrDefaultAsync(
                    x => x.ParishId == parish.Id && x.CandidateId == link.CandidateId && x.EventId == request.EventId,
                    ct);
            var normalizedStatus = NormalizeConfirmationEventJoinStatus(join?.Status);
            if (join is null || normalizedStatus != ConfirmationEventJoinPending)
            {
                return Results.Ok(new ParishConfirmationEventJoinActionResponse("cannot-leave", join?.Id, join?.UpdatedUtc));
            }

            var now = DateTimeOffset.UtcNow;
            join.Status = ConfirmationEventJoinCancelled;
            join.DecisionUtc = now;
            join.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ConfirmationEventJoinCancelled",
                "public",
                JsonSerializer.Serialize(new { link.CandidateId, request.EventId, join.Id }),
                ct);

            return Results.Ok(new ParishConfirmationEventJoinActionResponse("cancelled", join.Id, join.UpdatedUtc));
        });

        group.MapPost("", async (
            ParishCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ISessionSecretCache sessionSecretCache,
            ILedgerService ledgerService,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("ParishEndpoints");
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
            {
                return Results.BadRequest(new { error = "Name and slug are required." });
            }

            var slug = request.Slug.Trim().ToLowerInvariant();
            if (slug.Length > 80)
            {
                return Results.BadRequest(new { error = "Slug is too long." });
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

            if (await dbContext.Parishes.AsNoTracking().AnyAsync(x => x.Slug == slug, ct))
            {
                return Results.BadRequest(new { error = "Slug is already taken." });
            }

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);
            var now = DateTimeOffset.UtcNow;

            var masterSigningContext = await roleCryptoService.TryGetSigningContextAsync(account.MasterRoleId, masterOwnerKey, ct);

            var parishRole = await CreateRoleAsync(
                request.Name.Trim(),
                RoleKindParish,
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

            var parishSigningContext = await roleCryptoService.TryGetSigningContextAsync(parishRole.RoleId, parishRole.OwnerKey, ct);

            var adminRole = await CreateRoleAsync(
                $"{request.Name.Trim()} • Admin",
                RoleKindParishAdmin,
                parishRole.RoleId,
                parishRole.ReadKey,
                parishRole.WriteKey,
                parishRole.OwnerKey,
                masterKey,
                userId,
                now,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);

            await AddMembershipAsync(
                userId,
                adminRole,
                masterKey,
                now,
                masterSigningContext,
                encryptionService,
                ledgerService,
                dbContext,
                ct);

            var priestRole = await CreateRoleAsync(
                $"{request.Name.Trim()} • Duszpasterze",
                RoleKindParishPriest,
                parishRole.RoleId,
                parishRole.ReadKey,
                parishRole.WriteKey,
                parishRole.OwnerKey,
                masterKey,
                userId,
                now,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);

            var officeRole = await CreateRoleAsync(
                $"{request.Name.Trim()} • Kancelaria",
                RoleKindParishOffice,
                parishRole.RoleId,
                parishRole.ReadKey,
                parishRole.WriteKey,
                parishRole.OwnerKey,
                masterKey,
                userId,
                now,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);

            var financeRole = await CreateRoleAsync(
                $"{request.Name.Trim()} • Finanse",
                RoleKindParishFinance,
                parishRole.RoleId,
                parishRole.ReadKey,
                parishRole.WriteKey,
                parishRole.OwnerKey,
                masterKey,
                userId,
                now,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);

            var publicRole = await CreateRoleAsync(
                $"{request.Name.Trim()} • Publiczne",
                RoleKindParishPublic,
                parishRole.RoleId,
                parishRole.ReadKey,
                parishRole.WriteKey,
                parishRole.OwnerKey,
                masterKey,
                userId,
                now,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);

            var intentionInternal = await CreateParishDataKeyAsync(
                parishRole,
                "intention-internal",
                now,
                userId,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);
            var intentionPublic = await CreateParishDataKeyAsync(
                parishRole,
                "intention-public",
                now,
                userId,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);
            var offering = await CreateParishDataKeyAsync(
                parishRole,
                "offering",
                now,
                userId,
                parishSigningContext,
                keyRingService,
                encryptionService,
                ledgerService,
                dbContext,
                ct);
            await GrantParishDataKeyAsync(intentionInternal, new[] { adminRole, priestRole, officeRole }, now, encryptionService, dbContext, ct);
            await GrantParishDataKeyAsync(intentionPublic, new[] { adminRole, priestRole, officeRole, publicRole }, now, encryptionService, dbContext, ct);
            await GrantParishDataKeyAsync(offering, new[] { adminRole, financeRole, priestRole }, now, encryptionService, dbContext, ct);

            var parish = new Parish
            {
                Id = Guid.NewGuid(),
                Slug = slug,
                Name = request.Name.Trim(),
                Location = request.Location?.Trim() ?? string.Empty,
                Theme = string.IsNullOrWhiteSpace(request.Theme) ? "classic" : request.Theme.Trim(),
                HeroImageUrl = string.IsNullOrWhiteSpace(request.HeroImageUrl) ? null : request.HeroImageUrl.Trim(),
                RoleId = parishRole.RoleId,
                AdminRoleId = adminRole.RoleId,
                PriestRoleId = priestRole.RoleId,
                OfficeRoleId = officeRole.RoleId,
                FinanceRoleId = financeRole.RoleId,
                PublicRoleId = publicRole.RoleId,
                IntentionInternalDataItemId = intentionInternal.DataItemId,
                IntentionPublicDataItemId = intentionPublic.DataItemId,
                OfferingDataItemId = offering.DataItemId,
                IntentionInternalKeyId = intentionInternal.DataKeyId,
                IntentionPublicKeyId = intentionPublic.DataKeyId,
                OfferingKeyId = offering.DataKeyId,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            var homepageConfig = NormalizeHomepage(request.Homepage ?? new ParishHomepageConfig(Array.Empty<ParishLayoutItem>()));
            var config = new ParishSiteConfig
            {
                Id = Guid.NewGuid(),
                ParishId = parish.Id,
                HomepageConfigJson = JsonSerializer.Serialize(homepageConfig),
                IsPublished = true,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.Parishes.Add(parish);
            await dbContext.SaveChangesAsync(ct);

            dbContext.ParishSiteConfigs.Add(config);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ParishCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { parish.Id, parish.Name, parish.Slug, parish.RoleId }),
                ct,
                parishSigningContext);

            await ledgerService.AppendParishAsync(
                parish.Id,
                "ParishSitePublished",
                userId.ToString(),
                JsonSerializer.Serialize(new { ParishId = parish.Id, ConfigId = config.Id }),
                ct,
                parishSigningContext);

            await transaction.CommitAsync(ct);
            EndpointHelpers.InvalidateRoleKeyRing(sessionSecretCache, sessionId);

            return Results.Ok(new ParishSiteResponse(
                parish.Id,
                parish.Slug,
                parish.Name,
                parish.Location,
                parish.Theme,
                parish.HeroImageUrl,
                homepageConfig));
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/site", async (
            Guid parishId,
            ParishSiteConfigUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
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

            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var config = await dbContext.ParishSiteConfigs.FirstOrDefaultAsync(x => x.ParishId == parish.Id, ct);
            if (config is null)
            {
                config = new ParishSiteConfig
                {
                    Id = Guid.NewGuid(),
                    ParishId = parish.Id,
                    CreatedUtc = DateTimeOffset.UtcNow
                };
                dbContext.ParishSiteConfigs.Add(config);
            }

            var normalizedHomepage = NormalizeHomepage(request.Homepage ?? new ParishHomepageConfig(Array.Empty<ParishLayoutItem>()));
            config.HomepageConfigJson = JsonSerializer.Serialize(normalizedHomepage);
            config.IsPublished = request.IsPublished;
            config.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-sms-templates", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
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

            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var entity = await dbContext.ParishConfirmationSmsTemplates.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id, ct);
            var templates = MapConfirmationSmsTemplates(entity);
            if (templates is null && entity is null)
            {
                var config = await dbContext.ParishSiteConfigs.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ParishId == parish.Id, ct);
                templates = TryReadLegacyConfirmationSmsTemplates(config?.HomepageConfigJson);
            }
            return Results.Ok(new ParishConfirmationSmsTemplatesResponse(
                templates,
                entity?.UpdatedUtc));
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/confirmation-sms-templates", async (
            Guid parishId,
            ParishConfirmationSmsTemplatesUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
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

            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var normalizedTemplates = NormalizeConfirmationSmsTemplates(request.Templates);
            var now = DateTimeOffset.UtcNow;
            var entity = await dbContext.ParishConfirmationSmsTemplates
                .FirstOrDefaultAsync(x => x.ParishId == parish.Id, ct);

            if (entity is null)
            {
                entity = new ParishConfirmationSmsTemplate
                {
                    Id = Guid.NewGuid(),
                    ParishId = parish.Id,
                    CreatedUtc = now
                };
                dbContext.ParishConfirmationSmsTemplates.Add(entity);
            }

            entity.VerificationInviteTemplate = normalizedTemplates?.VerificationInvite ?? string.Empty;
            entity.VerificationWarningTemplate = normalizedTemplates?.VerificationWarning ?? string.Empty;
            entity.PortalInviteTemplate = normalizedTemplates?.PortalInvite ?? string.Empty;
            entity.UpdatedUtc = now;

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new ParishConfirmationSmsTemplatesResponse(
                normalizedTemplates,
                entity.UpdatedUtc));
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-candidates", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            await EnsureConfirmationMeetingLinksAsync(parishId, dbContext, ct);

            var candidates = await LoadParishConfirmationCandidateViewsAsync(
                parishId,
                dbContext,
                dataProtectionProvider,
                ct);
            var responses = candidates.Select(candidate => new ParishConfirmationCandidateResponse(
                    candidate.CandidateId,
                    candidate.Name,
                    candidate.Surname,
                    candidate.PhoneNumbers.Select(phone => new ParishConfirmationPhoneResponse(
                        phone.Index,
                        phone.Number,
                        phone.IsVerified,
                        phone.VerifiedUtc,
                        phone.VerificationToken)).ToList(),
                    candidate.Address,
                    candidate.SchoolShort,
                    candidate.AcceptedRodo,
                    candidate.PaperConsentReceived,
                    candidate.CreatedUtc,
                    candidate.MeetingToken,
                    candidate.MeetingSlotId))
                .ToList();

            return Results.Ok(responses);
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-candidates/export", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            await EnsureConfirmationMeetingLinksAsync(parishId, dbContext, ct);

            var candidates = await LoadParishConfirmationCandidateViewsAsync(
                parishId,
                dbContext,
                dataProtectionProvider,
                ct);
            var phoneVerifications = await dbContext.ParishConfirmationPhoneVerifications.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.CandidateId)
                .ThenBy(x => x.PhoneIndex)
                .ThenBy(x => x.CreatedUtc)
                .Select(x => new ParishConfirmationExportPhoneVerificationResponse(
                    x.Id,
                    x.CandidateId,
                    x.PhoneIndex,
                    x.VerificationToken,
                    x.VerifiedUtc,
                    x.CreatedUtc))
                .ToListAsync(ct);
            var meetingSlots = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.StartsAtUtc)
                .ThenBy(x => x.CreatedUtc)
                .Select(x => new ParishConfirmationExportMeetingSlotResponse(
                    x.Id,
                    x.StartsAtUtc,
                    x.DurationMinutes,
                    x.Capacity,
                    x.Label,
                    x.Stage,
                    x.HostCandidateId,
                    x.HostInviteToken,
                    x.HostInviteExpiresUtc,
                    x.IsActive,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);
            var meetingLinks = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.CreatedUtc)
                .Select(x => new ParishConfirmationExportMeetingLinkResponse(
                    x.Id,
                    x.CandidateId,
                    x.BookingToken,
                    x.SlotId,
                    x.BookedUtc,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);
            var messages = await dbContext.ParishConfirmationMessages.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.CreatedUtc)
                .Select(x => new ParishConfirmationExportMessageResponse(
                    x.Id,
                    x.CandidateId,
                    x.SenderType,
                    x.MessageText,
                    x.CreatedUtc))
                .ToListAsync(ct);
            var notes = await dbContext.ParishConfirmationNotes.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.CreatedUtc)
                .ThenBy(x => x.UpdatedUtc)
                .Select(x => new ParishConfirmationExportNoteResponse(
                    x.Id,
                    x.CandidateId,
                    x.NoteText,
                    x.IsPublic,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);
            var celebrations = await dbContext.ParishConfirmationCelebrations.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.StartsAtUtc)
                .ThenBy(x => x.CreatedUtc)
                .Select(x => new ParishConfirmationExportCelebrationResponse(
                    x.Id,
                    x.Name,
                    x.ShortInfo,
                    x.StartsAtUtc,
                    x.EndsAtUtc,
                    x.Description,
                    x.Capacity,
                    x.IsActive,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);
            var meetingTokenByCandidate = meetingLinks
                .GroupBy(x => x.CandidateId)
                .ToDictionary(group => group.Key, group => group.First().BookingToken);
            var celebrationParticipations = await dbContext.ParishConfirmationCelebrationParticipations.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.CreatedUtc)
                .ThenBy(x => x.UpdatedUtc)
                .ToListAsync(ct);
            var celebrationParticipationResponses = celebrationParticipations
                .Select(x => new ParishConfirmationExportCelebrationParticipationResponse(
                    x.Id,
                    x.CandidateId,
                    meetingTokenByCandidate.GetValueOrDefault(x.CandidateId),
                    x.CelebrationId,
                    x.CommentText,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToList();
            var celebrationJoins = await dbContext.ParishConfirmationEventJoins.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.RequestedUtc)
                .ThenBy(x => x.UpdatedUtc)
                .Select(x => new ParishConfirmationExportCelebrationJoinResponse(
                    x.Id,
                    x.CandidateId,
                    meetingTokenByCandidate.GetValueOrDefault(x.CandidateId),
                    x.EventId,
                    x.Status,
                    x.RequestedUtc,
                    x.DecisionUtc,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);
            var response = new ParishConfirmationExportResponse(
                6,
                parishId,
                DateTimeOffset.UtcNow,
                candidates.Select(candidate => new ParishConfirmationExportCandidateResponse(
                        candidate.Name,
                        candidate.Surname,
                        candidate.PhoneNumbers.Select(phone => new ParishConfirmationExportPhoneResponse(
                            phone.Index,
                            phone.Number,
                            phone.IsVerified,
                            phone.VerifiedUtc,
                            phone.VerificationToken,
                            phone.CreatedUtc)).ToList(),
                        candidate.Address,
                        candidate.SchoolShort,
                        candidate.AcceptedRodo,
                        candidate.PaperConsentReceived,
                        candidate.CreatedUtc,
                        candidate.UpdatedUtc,
                        candidate.MeetingToken,
                        candidate.MeetingSlotId))
                    .ToList(),
                phoneVerifications,
                meetingSlots,
                meetingLinks,
                messages,
                notes,
                celebrations,
                celebrationParticipationResponses,
                celebrationJoins);

            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-candidates/import", async (
            Guid parishId,
            JsonElement requestPayload,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            if (!TryParseConfirmationImportRequest(requestPayload, out var request, out var parseError))
            {
                return Results.BadRequest(new { error = parseError ?? "Invalid import payload." });
            }

            var sourceCandidates = request.Candidates;
            var sourceCelebrations = request.Celebrations ?? Array.Empty<ParishConfirmationImportCelebrationRequest>();
            var sourceCelebrationParticipations = request.CelebrationParticipations ?? Array.Empty<ParishConfirmationImportCelebrationParticipationRequest>();
            var sourceCelebrationJoins = request.CelebrationJoins ?? Array.Empty<ParishConfirmationImportCelebrationJoinRequest>();
            if (
                sourceCandidates.Count == 0 &&
                sourceCelebrations.Count == 0 &&
                sourceCelebrationParticipations.Count == 0 &&
                sourceCelebrationJoins.Count == 0 &&
                !request.ReplaceExisting)
            {
                return Results.BadRequest(new { error = "Import payload is empty." });
            }

            if (request.ReplaceExisting)
            {
                var replaceCleanupNow = DateTimeOffset.UtcNow;
                var existingNotes = await dbContext.ParishConfirmationNotes
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingNotes.Count > 0)
                {
                    dbContext.ParishConfirmationNotes.RemoveRange(existingNotes);
                }

                var existingMessages = await dbContext.ParishConfirmationMessages
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingMessages.Count > 0)
                {
                    dbContext.ParishConfirmationMessages.RemoveRange(existingMessages);
                }

                var existingMeetingLinks = await dbContext.ParishConfirmationMeetingLinks
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingMeetingLinks.Count > 0)
                {
                    dbContext.ParishConfirmationMeetingLinks.RemoveRange(existingMeetingLinks);
                }

                var existingVerifications = await dbContext.ParishConfirmationPhoneVerifications
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingVerifications.Count > 0)
                {
                    dbContext.ParishConfirmationPhoneVerifications.RemoveRange(existingVerifications);
                }

                var existingCelebrationParticipations = await dbContext.ParishConfirmationCelebrationParticipations
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingCelebrationParticipations.Count > 0)
                {
                    dbContext.ParishConfirmationCelebrationParticipations.RemoveRange(existingCelebrationParticipations);
                }

                var existingCelebrationJoins = await dbContext.ParishConfirmationEventJoins
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingCelebrationJoins.Count > 0)
                {
                    dbContext.ParishConfirmationEventJoins.RemoveRange(existingCelebrationJoins);
                }

                var existingCelebrations = await dbContext.ParishConfirmationCelebrations
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingCelebrations.Count > 0)
                {
                    dbContext.ParishConfirmationCelebrations.RemoveRange(existingCelebrations);
                }

                var hostedSlots = await dbContext.ParishConfirmationMeetingSlots
                    .Where(x => x.ParishId == parishId && x.HostCandidateId != null)
                    .ToListAsync(ct);
                foreach (var slot in hostedSlots)
                {
                    slot.HostCandidateId = null;
                    slot.HostInviteToken = null;
                    slot.HostInviteExpiresUtc = null;
                    slot.UpdatedUtc = replaceCleanupNow;
                }

                var existingCandidates = await dbContext.ParishConfirmationCandidates
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);

                if (
                    existingNotes.Count > 0 ||
                    existingMessages.Count > 0 ||
                    existingMeetingLinks.Count > 0 ||
                    existingVerifications.Count > 0 ||
                    existingCelebrationParticipations.Count > 0 ||
                    existingCelebrationJoins.Count > 0 ||
                    existingCelebrations.Count > 0 ||
                    hostedSlots.Count > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                }

                if (existingCandidates.Count > 0)
                {
                    dbContext.ParishConfirmationCandidates.RemoveRange(existingCandidates);
                    await dbContext.SaveChangesAsync(ct);
                }
            }

            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);
            var sourceTokens = sourceCandidates
                .SelectMany(candidate => candidate.PhoneNumbers ?? Array.Empty<ParishConfirmationImportPhoneRequest>())
                .Select(phone => NormalizeConfirmationToken(phone.VerificationToken))
                .Where(token => token is not null)
                .Distinct(StringComparer.Ordinal)
                .Cast<string>()
                .ToList();
            HashSet<string> existingTokens;
            if (sourceTokens.Count == 0)
            {
                existingTokens = new HashSet<string>(StringComparer.Ordinal);
            }
            else
            {
                var existingTokenRows = await dbContext.ParishConfirmationPhoneVerifications.AsNoTracking()
                    .Where(x => sourceTokens.Contains(x.VerificationToken))
                    .Select(x => x.VerificationToken)
                    .ToListAsync(ct);
                existingTokens = new HashSet<string>(existingTokenRows, StringComparer.Ordinal);
            }
            var usedTokens = new HashSet<string>(StringComparer.Ordinal);
            var sourceMeetingTokens = sourceCandidates
                .Select(candidate => NormalizeConfirmationToken(GetJsonCandidateMeetingToken(candidate)))
                .Where(token => token is not null)
                .Distinct(StringComparer.Ordinal)
                .Cast<string>()
                .ToList();
            var existingMeetingTokenRows = sourceMeetingTokens.Count == 0
                ? new List<string>()
                : await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                    .Where(x => sourceMeetingTokens.Contains(x.BookingToken))
                    .Select(x => x.BookingToken)
                    .ToListAsync(ct);
            var existingMeetingTokens = new HashSet<string>(existingMeetingTokenRows, StringComparer.Ordinal);
            var usedMeetingTokens = new HashSet<string>(StringComparer.Ordinal);
            var candidateIdByMeetingToken = new Dictionary<string, Guid>(StringComparer.Ordinal);

            var importedCandidates = 0;
            var importedPhoneNumbers = 0;
            var skippedCandidates = 0;
            var importedCelebrations = 0;
            var importedCelebrationParticipations = 0;
            var importedCelebrationJoins = 0;
            var importedCelebrationJoinPairs = new HashSet<string>(StringComparer.Ordinal);
            var now = DateTimeOffset.UtcNow;

            foreach (var sourceCandidate in sourceCandidates)
            {
                var name = NormalizeConfirmationText(sourceCandidate.Name, 120);
                var surname = NormalizeConfirmationText(sourceCandidate.Surname, 120);
                var address = NormalizeConfirmationText(sourceCandidate.Address, 260);
                var schoolShort = NormalizeConfirmationText(sourceCandidate.SchoolShort, 140);
                var phones = NormalizeConfirmationImportPhones(sourceCandidate.PhoneNumbers);

                if (name is null || surname is null || address is null || schoolShort is null || phones.Count == 0)
                {
                    skippedCandidates += 1;
                    continue;
                }

                var createdUtc = sourceCandidate.CreatedUtc is { } created && created.Year >= 2000
                    ? created
                    : now;
                var updatedUtc = sourceCandidate.UpdatedUtc is { } updated && updated >= createdUtc
                    ? updated
                    : createdUtc;
                var phoneNumbers = phones.Select(x => x.Number).ToList();
                var payload = new ParishConfirmationPayload(
                    name,
                    surname,
                    phoneNumbers,
                    address,
                    schoolShort,
                    true);
                var payloadJson = JsonSerializer.SerializeToUtf8Bytes(payload);
                var payloadEnc = protector.Protect(payloadJson);
                var candidateId = Guid.NewGuid();

                dbContext.ParishConfirmationCandidates.Add(new ParishConfirmationCandidate
                {
                    Id = candidateId,
                    ParishId = parishId,
                    PayloadEnc = payloadEnc,
                    AcceptedRodo = true,
                    PaperConsentReceived = sourceCandidate.PaperConsentReceived,
                    CreatedUtc = createdUtc,
                    UpdatedUtc = updatedUtc
                });

                var sourceMeetingToken = NormalizeConfirmationToken(GetJsonCandidateMeetingToken(sourceCandidate));
                var meetingToken = sourceMeetingToken;
                if (string.IsNullOrWhiteSpace(meetingToken) ||
                    existingMeetingTokens.Contains(meetingToken) ||
                    usedMeetingTokens.Contains(meetingToken))
                {
                    meetingToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(
                        dbContext,
                        usedMeetingTokens,
                        ct);
                }
                else
                {
                    usedMeetingTokens.Add(meetingToken);
                }

                dbContext.ParishConfirmationMeetingLinks.Add(new ParishConfirmationMeetingLink
                {
                    Id = Guid.NewGuid(),
                    ParishId = parishId,
                    CandidateId = candidateId,
                    BookingToken = meetingToken,
                    SlotId = null,
                    BookedUtc = null,
                    CreatedUtc = createdUtc,
                    UpdatedUtc = updatedUtc
                });
                candidateIdByMeetingToken[meetingToken] = candidateId;

                for (var index = 0; index < phones.Count; index += 1)
                {
                    var phone = phones[index];
                    var token = phone.VerificationToken;
                    if (string.IsNullOrWhiteSpace(token) || existingTokens.Contains(token) || usedTokens.Contains(token))
                    {
                        token = CreatePhoneVerificationToken();
                        while (existingTokens.Contains(token) || usedTokens.Contains(token))
                        {
                            token = CreatePhoneVerificationToken();
                        }
                    }

                    usedTokens.Add(token);
                    importedPhoneNumbers += 1;

                    dbContext.ParishConfirmationPhoneVerifications.Add(new ParishConfirmationPhoneVerification
                    {
                        Id = Guid.NewGuid(),
                        ParishId = parishId,
                        CandidateId = candidateId,
                        PhoneIndex = index,
                        VerificationToken = token,
                        VerifiedUtc = phone.VerifiedUtc,
                        CreatedUtc = phone.CreatedUtc ?? createdUtc
                    });
                }

                importedCandidates += 1;
            }

            var celebrationIdByExternalId = new Dictionary<Guid, Guid>();
            foreach (var sourceCelebration in sourceCelebrations)
            {
                var name = NormalizeConfirmationText(sourceCelebration.Name, 160);
                var shortInfo = NormalizeConfirmationText(sourceCelebration.ShortInfo, 320);
                var description = NormalizeConfirmationText(sourceCelebration.Description, 4000);
                if (name is null || shortInfo is null || description is null)
                {
                    continue;
                }

                if (sourceCelebration.EndsAtUtc <= sourceCelebration.StartsAtUtc)
                {
                    continue;
                }

                var createdUtc = sourceCelebration.CreatedUtc is { } created && created.Year >= 2000
                    ? created
                    : now;
                var updatedUtc = sourceCelebration.UpdatedUtc is { } updated && updated >= createdUtc
                    ? updated
                    : createdUtc;
                var capacity = sourceCelebration.Capacity is >= 1 and <= ConfirmationEventCapacityMax
                    ? sourceCelebration.Capacity
                    : null;
                var celebrationId = Guid.NewGuid();
                dbContext.ParishConfirmationCelebrations.Add(new ParishConfirmationCelebration
                {
                    Id = celebrationId,
                    ParishId = parishId,
                    Name = name,
                    ShortInfo = shortInfo,
                    StartsAtUtc = sourceCelebration.StartsAtUtc,
                    EndsAtUtc = sourceCelebration.EndsAtUtc,
                    Description = description,
                    Capacity = capacity,
                    IsActive = sourceCelebration.IsActive,
                    CreatedUtc = createdUtc,
                    UpdatedUtc = updatedUtc
                });
                if (sourceCelebration.ExternalId is { } externalId && externalId != Guid.Empty)
                {
                    celebrationIdByExternalId[externalId] = celebrationId;
                }
                importedCelebrations += 1;
            }

            foreach (var sourceParticipation in sourceCelebrationParticipations)
            {
                var meetingToken = NormalizeConfirmationToken(sourceParticipation.CandidateMeetingToken);
                var commentText = NormalizeConfirmationText(sourceParticipation.CommentText, 2000);
                if (meetingToken is null || commentText is null)
                {
                    continue;
                }

                if (!candidateIdByMeetingToken.TryGetValue(meetingToken, out var candidateId))
                {
                    continue;
                }

                if (sourceParticipation.CelebrationExternalId is null ||
                    !celebrationIdByExternalId.TryGetValue(sourceParticipation.CelebrationExternalId.Value, out var celebrationId))
                {
                    continue;
                }

                var createdUtc = sourceParticipation.CreatedUtc is { } created && created.Year >= 2000
                    ? created
                    : now;
                var updatedUtc = sourceParticipation.UpdatedUtc is { } updated && updated >= createdUtc
                    ? updated
                    : createdUtc;

                dbContext.ParishConfirmationCelebrationParticipations.Add(new ParishConfirmationCelebrationParticipation
                {
                    Id = Guid.NewGuid(),
                    ParishId = parishId,
                    CandidateId = candidateId,
                    CelebrationId = celebrationId,
                    CommentText = commentText,
                    CreatedUtc = createdUtc,
                    UpdatedUtc = updatedUtc
                });
                importedCelebrationParticipations += 1;
            }

            foreach (var sourceJoin in sourceCelebrationJoins)
            {
                var meetingToken = NormalizeConfirmationToken(sourceJoin.CandidateMeetingToken);
                var normalizedStatus = NormalizeConfirmationEventJoinStatus(sourceJoin.Status);
                if (meetingToken is null || normalizedStatus is null)
                {
                    continue;
                }

                if (!candidateIdByMeetingToken.TryGetValue(meetingToken, out var candidateId))
                {
                    continue;
                }

                if (sourceJoin.CelebrationExternalId is null ||
                    !celebrationIdByExternalId.TryGetValue(sourceJoin.CelebrationExternalId.Value, out var celebrationId))
                {
                    continue;
                }

                var joinPairKey = $"{candidateId:N}:{celebrationId:N}";
                if (!importedCelebrationJoinPairs.Add(joinPairKey))
                {
                    continue;
                }

                var createdUtc = sourceJoin.CreatedUtc is { } created && created.Year >= 2000
                    ? created
                    : now;
                var updatedUtc = sourceJoin.UpdatedUtc is { } updated && updated >= createdUtc
                    ? updated
                    : createdUtc;
                var requestedUtc = sourceJoin.RequestedUtc is { } requested && requested.Year >= 2000
                    ? requested
                    : createdUtc;
                var decisionUtc = sourceJoin.DecisionUtc;

                dbContext.ParishConfirmationEventJoins.Add(new ParishConfirmationEventJoin
                {
                    Id = Guid.NewGuid(),
                    ParishId = parishId,
                    CandidateId = candidateId,
                    EventId = celebrationId,
                    Status = normalizedStatus,
                    RequestedUtc = requestedUtc,
                    DecisionUtc = decisionUtc,
                    CreatedUtc = createdUtc,
                    UpdatedUtc = updatedUtc
                });
                importedCelebrationJoins += 1;
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationCandidatesImported",
                userId.ToString(),
                JsonSerializer.Serialize(new
                {
                    importedCandidates,
                    importedPhoneNumbers,
                    skippedCandidates,
                    importedCelebrations,
                    importedCelebrationParticipations,
                    importedCelebrationJoins,
                    request.ReplaceExisting
                }),
                ct);

            return Results.Ok(new ParishConfirmationImportResponse(
                importedCandidates,
                importedPhoneNumbers,
                skippedCandidates,
                request.ReplaceExisting));
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-candidates/merge", async (
            Guid parishId,
            ParishConfirmationCandidateMergeRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (request.TargetCandidateId == request.SourceCandidateId)
            {
                return Results.BadRequest(new { error = "Target and source candidate must be different." });
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var name = NormalizeConfirmationText(request.Name, 120);
            var surname = NormalizeConfirmationText(request.Surname, 120);
            var address = NormalizeConfirmationText(request.Address, 260);
            var schoolShort = NormalizeConfirmationText(request.SchoolShort, 140);
            var phoneNumbers = NormalizeConfirmationPhones(request.PhoneNumbers);
            if (name is null || surname is null || address is null || schoolShort is null || phoneNumbers.Count == 0)
            {
                return Results.BadRequest(new { error = "Invalid merged candidate data." });
            }

            if (request.SelectedMeetingSlotId is not null)
            {
                var slotExists = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                    .AnyAsync(x => x.ParishId == parishId && x.Id == request.SelectedMeetingSlotId.Value, ct);
                if (!slotExists)
                {
                    return Results.BadRequest(new { error = "Selected meeting slot does not exist." });
                }
            }

            await EnsureConfirmationMeetingLinksAsync(parishId, dbContext, ct);

            var candidates = await dbContext.ParishConfirmationCandidates
                .Where(x =>
                    x.ParishId == parishId &&
                    (x.Id == request.TargetCandidateId || x.Id == request.SourceCandidateId))
                .ToListAsync(ct);
            if (candidates.Count != 2)
            {
                return Results.NotFound(new { error = "Candidates to merge not found." });
            }

            var targetCandidate = candidates.FirstOrDefault(x => x.Id == request.TargetCandidateId);
            var sourceCandidate = candidates.FirstOrDefault(x => x.Id == request.SourceCandidateId);
            if (targetCandidate is null || sourceCandidate is null)
            {
                return Results.NotFound(new { error = "Candidates to merge not found." });
            }

            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);
            var targetPayload = TryUnprotectConfirmationPayload(targetCandidate.PayloadEnc, protector);
            var sourcePayload = TryUnprotectConfirmationPayload(sourceCandidate.PayloadEnc, protector);
            if (targetPayload is null || sourcePayload is null)
            {
                return Results.BadRequest(new { error = "Cannot read candidate payload for merge." });
            }

            var links = await dbContext.ParishConfirmationMeetingLinks
                .Where(x =>
                    x.ParishId == parishId &&
                    (x.CandidateId == targetCandidate.Id || x.CandidateId == sourceCandidate.Id))
                .ToListAsync(ct);
            var now = DateTimeOffset.UtcNow;
            var targetLinks = links
                .Where(x => x.CandidateId == targetCandidate.Id)
                .OrderByDescending(x => x.UpdatedUtc)
                .ThenByDescending(x => x.CreatedUtc)
                .ToList();
            var sourceLinks = links
                .Where(x => x.CandidateId == sourceCandidate.Id)
                .OrderByDescending(x => x.UpdatedUtc)
                .ThenByDescending(x => x.CreatedUtc)
                .ToList();

            var targetLink = targetLinks.FirstOrDefault();
            if (targetLink is null)
            {
                targetLink = new ParishConfirmationMeetingLink
                {
                    Id = Guid.NewGuid(),
                    ParishId = parishId,
                    CandidateId = targetCandidate.Id,
                    BookingToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(dbContext, null, ct),
                    SlotId = null,
                    BookedUtc = null,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.ParishConfirmationMeetingLinks.Add(targetLink);
                targetLinks.Add(targetLink);
            }

            var sourceLink = sourceLinks.FirstOrDefault();
            if (sourceLink is null)
            {
                sourceLink = new ParishConfirmationMeetingLink
                {
                    Id = Guid.NewGuid(),
                    ParishId = parishId,
                    CandidateId = sourceCandidate.Id,
                    BookingToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(dbContext, null, ct),
                    SlotId = null,
                    BookedUtc = null,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.ParishConfirmationMeetingLinks.Add(sourceLink);
                sourceLinks.Add(sourceLink);
            }

            if (string.IsNullOrWhiteSpace(targetLink.BookingToken))
            {
                targetLink.BookingToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(dbContext, null, ct);
                targetLink.UpdatedUtc = now;
            }

            if (string.IsNullOrWhiteSpace(sourceLink.BookingToken))
            {
                sourceLink.BookingToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(dbContext, null, ct);
                sourceLink.UpdatedUtc = now;
            }

            var linksToRemoveById = new Dictionary<Guid, ParishConfirmationMeetingLink>();
            void QueueLinkRemoval(ParishConfirmationMeetingLink link)
            {
                if (link.Id == targetLink.Id)
                {
                    return;
                }

                linksToRemoveById.TryAdd(link.Id, link);
            }

            foreach (var extraTargetLink in targetLinks.Skip(1))
            {
                QueueLinkRemoval(extraTargetLink);
            }

            foreach (var existingSourceLink in sourceLinks)
            {
                QueueLinkRemoval(existingSourceLink);
            }

            if (sourceLink.Id != targetLink.Id)
            {
                QueueLinkRemoval(sourceLink);
            }

            var linksToRemove = linksToRemoveById.Values.ToList();
            var allCandidateLinks = targetLinks.Concat(sourceLinks).ToList();

            var portalTokenSourceId = request.PortalTokenFromCandidateId == sourceCandidate.Id
                ? sourceCandidate.Id
                : targetCandidate.Id;
            var selectedToken = portalTokenSourceId == sourceCandidate.Id
                ? sourceLink.BookingToken
                : targetLink.BookingToken;
            if (string.IsNullOrWhiteSpace(selectedToken))
            {
                selectedToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(dbContext, null, ct);
            }

            var oldSlotIds = allCandidateLinks
                .Where(x => x.SlotId is not null)
                .Select(x => x.SlotId!.Value)
                .Distinct()
                .ToList();
            var selectedSlotId = request.SelectedMeetingSlotId;
            DateTimeOffset? selectedBookedUtc = null;
            if (selectedSlotId is not null)
            {
                var historicalBookedUtc = allCandidateLinks
                    .Where(x => x.SlotId == selectedSlotId && x.BookedUtc is not null)
                    .Select(x => x.BookedUtc!.Value)
                    .OrderByDescending(x => x)
                    .ToList();
                if (historicalBookedUtc.Count > 0)
                {
                    selectedBookedUtc = historicalBookedUtc[0];
                }

                selectedBookedUtc ??= now;
            }

            var mergedPayload = new ParishConfirmationPayload(
                name,
                surname,
                phoneNumbers,
                address,
                schoolShort,
                true);
            targetCandidate.PayloadEnc = protector.Protect(JsonSerializer.SerializeToUtf8Bytes(mergedPayload));
            targetCandidate.AcceptedRodo = true;
            targetCandidate.PaperConsentReceived = targetCandidate.PaperConsentReceived || sourceCandidate.PaperConsentReceived;
            targetCandidate.CreatedUtc = targetCandidate.CreatedUtc <= sourceCandidate.CreatedUtc
                ? targetCandidate.CreatedUtc
                : sourceCandidate.CreatedUtc;
            targetCandidate.UpdatedUtc = now;

            var verifications = await dbContext.ParishConfirmationPhoneVerifications
                .Where(x =>
                    x.ParishId == parishId &&
                    (x.CandidateId == targetCandidate.Id || x.CandidateId == sourceCandidate.Id))
                .ToListAsync(ct);

            var verificationMeta = new Dictionary<string, (bool Verified, DateTimeOffset? VerifiedUtc, DateTimeOffset CreatedUtc)>(
                StringComparer.OrdinalIgnoreCase);
            void AddVerificationMeta(
                ParishConfirmationPayload payload,
                IReadOnlyList<ParishConfirmationPhoneVerification> candidateVerifications)
            {
                var byIndex = candidateVerifications
                    .GroupBy(x => x.PhoneIndex)
                    .ToDictionary(group => group.Key, group => group.First());
                for (var i = 0; i < payload.PhoneNumbers.Count; i += 1)
                {
                    var number = payload.PhoneNumbers[i];
                    if (string.IsNullOrWhiteSpace(number))
                    {
                        continue;
                    }

                    byIndex.TryGetValue(i, out var verification);
                    var isVerified = verification?.VerifiedUtc is not null;
                    var verifiedUtc = verification?.VerifiedUtc;
                    var createdUtc = verification?.CreatedUtc ?? now;

                    if (!verificationMeta.TryGetValue(number, out var current))
                    {
                        verificationMeta[number] = (isVerified, verifiedUtc, createdUtc);
                        continue;
                    }

                    var mergedVerified = current.Verified || isVerified;
                    DateTimeOffset? mergedVerifiedUtc;
                    if (current.VerifiedUtc is null)
                    {
                        mergedVerifiedUtc = verifiedUtc;
                    }
                    else if (verifiedUtc is null)
                    {
                        mergedVerifiedUtc = current.VerifiedUtc;
                    }
                    else
                    {
                        mergedVerifiedUtc = current.VerifiedUtc >= verifiedUtc
                            ? current.VerifiedUtc
                            : verifiedUtc;
                    }

                    var mergedCreatedUtc = current.CreatedUtc <= createdUtc
                        ? current.CreatedUtc
                        : createdUtc;
                    verificationMeta[number] = (mergedVerified, mergedVerifiedUtc, mergedCreatedUtc);
                }
            }

            AddVerificationMeta(
                targetPayload,
                verifications.Where(x => x.CandidateId == targetCandidate.Id).ToList());
            AddVerificationMeta(
                sourcePayload,
                verifications.Where(x => x.CandidateId == sourceCandidate.Id).ToList());

            if (verifications.Count > 0)
            {
                dbContext.ParishConfirmationPhoneVerifications.RemoveRange(verifications);
            }

            var usedVerificationTokens = new HashSet<string>(StringComparer.Ordinal);
            for (var phoneIndex = 0; phoneIndex < phoneNumbers.Count; phoneIndex += 1)
            {
                var number = phoneNumbers[phoneIndex];
                var meta = verificationMeta.GetValueOrDefault(number);
                var token = await CreateUniqueConfirmationPhoneVerificationTokenAsync(
                    dbContext,
                    usedVerificationTokens,
                    ct);
                dbContext.ParishConfirmationPhoneVerifications.Add(new ParishConfirmationPhoneVerification
                {
                    Id = Guid.NewGuid(),
                    ParishId = parishId,
                    CandidateId = targetCandidate.Id,
                    PhoneIndex = phoneIndex,
                    VerificationToken = token,
                    VerifiedUtc = meta.Verified ? meta.VerifiedUtc : null,
                    CreatedUtc = meta.CreatedUtc == default ? now : meta.CreatedUtc
                });
            }

            var sourceMessages = await dbContext.ParishConfirmationMessages
                .Where(x => x.ParishId == parishId && x.CandidateId == sourceCandidate.Id)
                .ToListAsync(ct);
            foreach (var message in sourceMessages)
            {
                message.CandidateId = targetCandidate.Id;
            }

            var sourceNotes = await dbContext.ParishConfirmationNotes
                .Where(x => x.ParishId == parishId && x.CandidateId == sourceCandidate.Id)
                .ToListAsync(ct);
            foreach (var note in sourceNotes)
            {
                note.CandidateId = targetCandidate.Id;
            }

            var affectedSlotIds = new HashSet<Guid>(oldSlotIds);

            if (selectedSlotId is not null)
            {
                affectedSlotIds.Add(selectedSlotId.Value);
            }

            var hostedBySource = await dbContext.ParishConfirmationMeetingSlots
                .Where(x => x.ParishId == parishId && x.HostCandidateId == sourceCandidate.Id)
                .ToListAsync(ct);
            foreach (var slot in hostedBySource)
            {
                slot.HostCandidateId = null;
                slot.HostInviteToken = null;
                slot.HostInviteExpiresUtc = null;
                slot.UpdatedUtc = now;
                affectedSlotIds.Add(slot.Id);
            }

            foreach (var removableLink in linksToRemove)
            {
                if (!string.Equals(removableLink.BookingToken, selectedToken, StringComparison.Ordinal))
                {
                    continue;
                }

                removableLink.BookingToken = await CreateUniqueConfirmationMeetingBookingTokenAsync(dbContext, null, ct);
                removableLink.UpdatedUtc = now;
            }

            targetLink.BookingToken = selectedToken;
            targetLink.SlotId = selectedSlotId;
            targetLink.BookedUtc = selectedSlotId is null ? null : selectedBookedUtc;
            targetLink.UpdatedUtc = now;

            if (linksToRemove.Count > 0)
            {
                dbContext.ParishConfirmationMeetingLinks.RemoveRange(linksToRemove);
            }

            try
            {
                await dbContext.SaveChangesAsync(ct);

                var staleSourceVerifications = await dbContext.ParishConfirmationPhoneVerifications
                    .Where(x => x.ParishId == parishId && x.CandidateId == sourceCandidate.Id)
                    .ToListAsync(ct);
                if (staleSourceVerifications.Count > 0)
                {
                    dbContext.ParishConfirmationPhoneVerifications.RemoveRange(staleSourceVerifications);
                    await dbContext.SaveChangesAsync(ct);
                }

                dbContext.ParishConfirmationCandidates.Remove(sourceCandidate);
                await dbContext.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                return Results.BadRequest(new
                {
                    error = "Merge failed because of inconsistent candidate data. Refresh the list and try again."
                });
            }

            foreach (var slotId in affectedSlotIds)
            {
                await RefreshConfirmationMeetingSlotHostAsync(parishId, slotId, dbContext, now, ct);
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationCandidatesMerged",
                userId.ToString(),
                JsonSerializer.Serialize(new
                {
                    TargetCandidateId = targetCandidate.Id,
                    RemovedCandidateId = sourceCandidate.Id,
                    PhoneCount = phoneNumbers.Count,
                    SelectedMeetingSlotId = selectedSlotId
                }),
                ct);

            return Results.Ok(new ParishConfirmationCandidateMergeResponse(
                targetCandidate.Id,
                sourceCandidate.Id));
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-meeting-slots", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            await EnsureConfirmationMeetingLinksAsync(parishId, dbContext, ct);

            var candidates = await LoadParishConfirmationCandidateViewsAsync(parishId, dbContext, dataProtectionProvider, ct);
            var candidatesById = candidates.ToDictionary(x => x.CandidateId);
            var slots = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                .Where(x => x.ParishId == parishId && x.IsActive)
                .OrderBy(x => x.StartsAtUtc)
                .ToListAsync(ct);
            var slotIds = slots.Select(x => x.Id).ToList();
            var links = slotIds.Count == 0
                ? new List<ParishConfirmationMeetingLink>()
                : await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                    .Where(x => x.ParishId == parishId && x.SlotId != null && slotIds.Contains(x.SlotId.Value))
                    .ToListAsync(ct);
            var linksBySlot = links.GroupBy(x => x.SlotId!.Value).ToDictionary(group => group.Key, group => group.ToList());

            var response = new ParishConfirmationMeetingSummaryResponse(
                slots.Select(slot =>
                {
                    var slotLinks = linksBySlot.GetValueOrDefault(slot.Id) ?? new List<ParishConfirmationMeetingLink>();
                    var slotCandidates = slotLinks
                        .Select(link => candidatesById.GetValueOrDefault(link.CandidateId))
                        .Where(view => view is not null)
                        .Select(view => new ParishConfirmationMeetingSlotCandidateResponse(
                            view!.CandidateId,
                            view.Name,
                            view.Surname))
                        .ToList();
                    return new ParishConfirmationMeetingSlotResponse(
                        slot.Id,
                        slot.StartsAtUtc,
                        slot.DurationMinutes,
                        slot.Capacity,
                        slot.Label,
                        slot.Stage,
                        slot.IsActive,
                        slotLinks.Count,
                        slotCandidates);
                }).ToList(),
                candidates.Count(candidate => candidate.MeetingSlotId is null));

            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-meeting-slots", async (
            Guid parishId,
            ParishConfirmationMeetingSlotCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var durationMinutes = Math.Clamp(
                request.DurationMinutes,
                ConfirmationMeetingMinDurationMinutes,
                ConfirmationMeetingMaxDurationMinutes);
            var capacity = Math.Clamp(
                request.Capacity,
                ConfirmationMeetingMinCapacity,
                ConfirmationMeetingMaxCapacity);
            var label = NormalizeConfirmationText(request.Label, 160);
            var stage = NormalizeConfirmationMeetingStage(request.Stage);

            var slot = new ParishConfirmationMeetingSlot
            {
                Id = Guid.NewGuid(),
                ParishId = parishId,
                StartsAtUtc = request.StartsAtUtc,
                DurationMinutes = durationMinutes,
                Capacity = capacity,
                Label = label,
                Stage = stage,
                IsActive = true,
                CreatedUtc = DateTimeOffset.UtcNow,
                UpdatedUtc = DateTimeOffset.UtcNow
            };

            dbContext.ParishConfirmationMeetingSlots.Add(slot);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationMeetingSlotCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { slot.Id, slot.StartsAtUtc, slot.DurationMinutes, slot.Capacity, slot.Stage }),
                ct);

            return Results.Ok(new ParishConfirmationMeetingSlotResponse(
                slot.Id,
                slot.StartsAtUtc,
                slot.DurationMinutes,
                slot.Capacity,
                slot.Label,
                slot.Stage,
                slot.IsActive,
                0,
                Array.Empty<ParishConfirmationMeetingSlotCandidateResponse>()));
        }).RequireAuthorization();

        group.MapDelete("/{parishId:guid}/confirmation-meeting-slots/{slotId:guid}", async (
            Guid parishId,
            Guid slotId,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var slot = await dbContext.ParishConfirmationMeetingSlots
                .FirstOrDefaultAsync(x => x.ParishId == parishId && x.Id == slotId, ct);
            if (slot is null)
            {
                return Results.NotFound();
            }

            var links = await dbContext.ParishConfirmationMeetingLinks
                .Where(x => x.ParishId == parishId && x.SlotId == slotId)
                .ToListAsync(ct);
            foreach (var link in links)
            {
                link.SlotId = null;
                link.BookedUtc = null;
                link.UpdatedUtc = DateTimeOffset.UtcNow;
            }

            dbContext.ParishConfirmationMeetingSlots.Remove(slot);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationMeetingSlotDeleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { slotId, UnassignedCandidates = links.Count }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-candidates/{candidateId:guid}/portal", async (
            Guid parishId,
            Guid candidateId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            await EnsureConfirmationMeetingLinksAsync(parishId, dbContext, ct);

            var candidate = await dbContext.ParishConfirmationCandidates.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == candidateId && x.ParishId == parishId, ct);
            if (candidate is null)
            {
                return Results.NotFound();
            }

            var link = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parishId && x.CandidateId == candidateId, ct);
            if (link is null)
            {
                return Results.NotFound();
            }

            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);
            var payload = TryUnprotectConfirmationPayload(candidate.PayloadEnc, protector);
            if (payload is null)
            {
                return Results.NotFound();
            }

            var verificationRows = await dbContext.ParishConfirmationPhoneVerifications.AsNoTracking()
                .Where(x => x.ParishId == parishId && x.CandidateId == candidateId)
                .OrderBy(x => x.PhoneIndex)
                .ToListAsync(ct);
            var verificationByIndex = verificationRows
                .GroupBy(x => x.PhoneIndex)
                .ToDictionary(group => group.Key, group => group.First());
            var phones = payload.PhoneNumbers
                .Select((number, index) =>
                {
                    var verification = verificationByIndex.GetValueOrDefault(index);
                    return new ParishConfirmationPhoneResponse(
                        index,
                        number,
                        verification?.VerifiedUtc is not null,
                        verification?.VerifiedUtc,
                        verification?.VerificationToken ?? string.Empty);
                })
                .ToList();

            var slots = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                .Where(x =>
                    x.ParishId == parishId &&
                    x.IsActive &&
                    x.Stage == ConfirmationMeetingStageYear1Start)
                .OrderBy(x => x.StartsAtUtc)
                .ToListAsync(ct);
            var slotIds = slots.Select(x => x.Id).ToList();
            var reservedCounts = slotIds.Count == 0
                ? new Dictionary<Guid, int>()
                : await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                    .Where(x => x.ParishId == parishId && x.SlotId != null && slotIds.Contains(x.SlotId.Value))
                    .GroupBy(x => x.SlotId!.Value)
                    .ToDictionaryAsync(group => group.Key, group => group.Count(), ct);

            var messages = await dbContext.ParishConfirmationMessages.AsNoTracking()
                .Where(x => x.ParishId == parishId && x.CandidateId == candidateId)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(500)
                .Select(x => new ParishConfirmationMessageResponse(x.Id, x.SenderType, x.MessageText, x.CreatedUtc))
                .ToListAsync(ct);

            var publicNotes = await dbContext.ParishConfirmationNotes.AsNoTracking()
                .Where(x => x.ParishId == parishId && x.CandidateId == candidateId && x.IsPublic)
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(200)
                .Select(x => new ParishConfirmationNoteResponse(x.Id, x.NoteText, x.IsPublic, x.CreatedUtc, x.UpdatedUtc))
                .ToListAsync(ct);

            var privateNotes = await dbContext.ParishConfirmationNotes.AsNoTracking()
                .Where(x => x.ParishId == parishId && x.CandidateId == candidateId && !x.IsPublic)
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(200)
                .Select(x => new ParishConfirmationNoteResponse(x.Id, x.NoteText, x.IsPublic, x.CreatedUtc, x.UpdatedUtc))
                .ToListAsync(ct);
            var upcomingCelebrations = await LoadConfirmationUpcomingCelebrationsAsync(
                parishId,
                candidateId,
                dbContext,
                ct);
            var upcomingEvents = await LoadConfirmationUpcomingEventsAsync(
                parishId,
                candidateId,
                dbContext,
                ct);

            var now = DateTimeOffset.UtcNow;
            var selectedSlot = link.SlotId is null
                ? null
                : slots.FirstOrDefault(slot => slot.Id == link.SlotId.Value);
            var canInviteToSelectedSlot = selectedSlot is not null
                && CanCandidateInviteToConfirmationSlot(selectedSlot, candidateId, now);
            var pendingJoinRequests = canInviteToSelectedSlot && selectedSlot is not null
                ? await LoadPendingConfirmationMeetingJoinRequestsAsync(
                    parishId,
                    selectedSlot.Id,
                    candidateId,
                    dbContext,
                    dataProtectionProvider,
                    ct)
                : new List<ParishConfirmationMeetingJoinRequestResponse>();

            var portal = new ParishConfirmationPortalResponse(
                new ParishConfirmationPortalCandidateDataResponse(
                    candidateId,
                    payload.Name,
                    payload.Surname,
                    phones,
                    payload.Address,
                    payload.SchoolShort,
                    candidate.PaperConsentReceived,
                    link.BookingToken,
                    link.SlotId,
                    link.BookedUtc,
                    canInviteToSelectedSlot,
                    canInviteToSelectedSlot ? selectedSlot?.HostInviteToken : null,
                    canInviteToSelectedSlot ? selectedSlot?.HostInviteExpiresUtc : null),
                slots.Select(slot =>
                {
                    var reserved = reservedCounts.GetValueOrDefault(slot.Id);
                    var isSelected = link.SlotId == slot.Id;
                    var joinStatus = isSelected
                        ? ConfirmationMeetingJoinStatus.Allowed
                        : EvaluateConfirmationMeetingJoinStatus(slot, candidateId, reserved, null, now);
                    var isAvailable = isSelected || joinStatus == ConfirmationMeetingJoinStatus.Allowed;
                    var requiresInviteCode = !isSelected && joinStatus == ConfirmationMeetingJoinStatus.InviteRequired;
                    var visualStatus = ResolveConfirmationMeetingVisualStatus(slot, reserved, now);
                    return new ParishConfirmationMeetingPublicSlotResponse(
                        slot.Id,
                        slot.StartsAtUtc,
                        slot.DurationMinutes,
                        slot.Capacity,
                        slot.Label,
                        slot.Stage,
                        reserved,
                        isAvailable,
                        requiresInviteCode,
                        isSelected,
                        visualStatus);
                }).ToList(),
                pendingJoinRequests,
                ConfirmationSecondMeetingAnnouncement,
                upcomingEvents,
                upcomingCelebrations,
                messages,
                publicNotes,
                privateNotes);

            return Results.Ok(portal);
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/confirmation-candidates/{candidateId:guid}/paper-consent", async (
            Guid parishId,
            Guid candidateId,
            ParishConfirmationCandidatePaperConsentUpdateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var candidate = await dbContext.ParishConfirmationCandidates
                .FirstOrDefaultAsync(x => x.Id == candidateId && x.ParishId == parishId, ct);
            if (candidate is null)
            {
                return Results.NotFound();
            }

            candidate.PaperConsentReceived = request.PaperConsentReceived;
            candidate.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationCandidatePaperConsentUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { candidateId, request.PaperConsentReceived }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/confirmation-candidates/{candidateId:guid}", async (
            Guid parishId,
            Guid candidateId,
            ParishConfirmationCandidateUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var candidate = await dbContext.ParishConfirmationCandidates
                .FirstOrDefaultAsync(x => x.Id == candidateId && x.ParishId == parishId, ct);
            if (candidate is null)
            {
                return Results.NotFound();
            }

            await EnsureConfirmationMeetingLinksAsync(parishId, dbContext, ct);

            var name = NormalizeConfirmationText(request.Name, 120);
            var surname = NormalizeConfirmationText(request.Surname, 120);
            var address = NormalizeConfirmationText(request.Address, 260);
            var schoolShort = NormalizeConfirmationText(request.SchoolShort, 140);
            var phoneNumbers = NormalizeConfirmationPhones(request.PhoneNumbers);
            if (name is null || surname is null || address is null || schoolShort is null || phoneNumbers.Count == 0)
            {
                return Results.BadRequest(new { error = "Invalid candidate personal data." });
            }

            var payload = new ParishConfirmationPayload(
                name,
                surname,
                phoneNumbers,
                address,
                schoolShort,
                true);
            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);
            candidate.PayloadEnc = protector.Protect(JsonSerializer.SerializeToUtf8Bytes(payload));
            candidate.UpdatedUtc = DateTimeOffset.UtcNow;

            var verifications = await dbContext.ParishConfirmationPhoneVerifications
                .Where(x => x.ParishId == parishId && x.CandidateId == candidateId)
                .ToListAsync(ct);
            if (verifications.Count > 0)
            {
                dbContext.ParishConfirmationPhoneVerifications.RemoveRange(verifications);
            }

            var now = DateTimeOffset.UtcNow;
            for (var index = 0; index < phoneNumbers.Count; index += 1)
            {
                dbContext.ParishConfirmationPhoneVerifications.Add(new ParishConfirmationPhoneVerification
                {
                    Id = Guid.NewGuid(),
                    ParishId = parishId,
                    CandidateId = candidateId,
                    PhoneIndex = index,
                    VerificationToken = CreatePhoneVerificationToken(),
                    VerifiedUtc = null,
                    CreatedUtc = now
                });
            }

            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationCandidateUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { candidateId, PhoneCount = phoneNumbers.Count }),
                ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-candidates/{candidateId:guid}/messages", async (
            Guid parishId,
            Guid candidateId,
            ParishConfirmationMessageCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var messageText = NormalizeConfirmationText(request.MessageText, 2000);
            if (messageText is null)
            {
                return Results.BadRequest(new { error = "Message text is required." });
            }

            var candidateExists = await dbContext.ParishConfirmationCandidates.AsNoTracking()
                .AnyAsync(x => x.Id == candidateId && x.ParishId == parishId, ct);
            if (!candidateExists)
            {
                return Results.NotFound();
            }

            var message = new ParishConfirmationMessage
            {
                Id = Guid.NewGuid(),
                ParishId = parishId,
                CandidateId = candidateId,
                SenderType = "admin",
                MessageText = messageText,
                CreatedUtc = DateTimeOffset.UtcNow
            };
            dbContext.ParishConfirmationMessages.Add(message);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationAdminMessageSent",
                userId.ToString(),
                JsonSerializer.Serialize(new { candidateId }),
                ct);

            return Results.Ok(new ParishConfirmationMessageResponse(
                message.Id,
                message.SenderType,
                message.MessageText,
                message.CreatedUtc));
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-candidates/{candidateId:guid}/notes", async (
            Guid parishId,
            Guid candidateId,
            ParishConfirmationNoteCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var noteText = NormalizeConfirmationText(request.NoteText, 2000);
            if (noteText is null)
            {
                return Results.BadRequest(new { error = "Note text is required." });
            }

            var candidateExists = await dbContext.ParishConfirmationCandidates.AsNoTracking()
                .AnyAsync(x => x.Id == candidateId && x.ParishId == parishId, ct);
            if (!candidateExists)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var note = new ParishConfirmationNote
            {
                Id = Guid.NewGuid(),
                ParishId = parishId,
                CandidateId = candidateId,
                NoteText = noteText,
                IsPublic = request.IsPublic,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.ParishConfirmationNotes.Add(note);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationNoteAdded",
                userId.ToString(),
                JsonSerializer.Serialize(new { candidateId, note.IsPublic }),
                ct);

            return Results.Ok(new ParishConfirmationNoteResponse(
                note.Id,
                note.NoteText,
                note.IsPublic,
                note.CreatedUtc,
                note.UpdatedUtc));
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/confirmation-candidates/{candidateId:guid}/notes/{noteId:guid}", async (
            Guid parishId,
            Guid candidateId,
            Guid noteId,
            ParishConfirmationNoteCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var noteText = NormalizeConfirmationText(request.NoteText, 2000);
            if (noteText is null)
            {
                return Results.BadRequest(new { error = "Note text is required." });
            }

            var note = await dbContext.ParishConfirmationNotes
                .FirstOrDefaultAsync(
                    x => x.Id == noteId && x.ParishId == parishId && x.CandidateId == candidateId,
                    ct);
            if (note is null)
            {
                return Results.NotFound();
            }

            note.NoteText = noteText;
            note.IsPublic = request.IsPublic;
            note.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationNoteUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { candidateId, noteId, note.IsPublic }),
                ct);

            return Results.Ok(new ParishConfirmationNoteResponse(
                note.Id,
                note.NoteText,
                note.IsPublic,
                note.CreatedUtc,
                note.UpdatedUtc));
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-notes", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var candidateViews = await LoadParishConfirmationCandidateViewsAsync(parishId, dbContext, dataProtectionProvider, ct);
            var candidateById = candidateViews.ToDictionary(x => x.CandidateId, x => x);

            var notes = await dbContext.ParishConfirmationNotes.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderByDescending(x => x.UpdatedUtc)
                .ThenByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var response = notes
                .Select(note =>
                {
                    var candidate = candidateById.GetValueOrDefault(note.CandidateId);
                    return new ParishConfirmationAggregatedNoteResponse(
                        note.Id,
                        note.CandidateId,
                        candidate?.Name ?? "Nieznany",
                        candidate?.Surname ?? "kandydat",
                        note.NoteText,
                        note.IsPublic,
                        note.CreatedUtc,
                        note.UpdatedUtc);
                })
                .ToList();

            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-messages", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var candidateViews = await LoadParishConfirmationCandidateViewsAsync(parishId, dbContext, dataProtectionProvider, ct);
            var candidateById = candidateViews.ToDictionary(x => x.CandidateId, x => x);

            var messages = await dbContext.ParishConfirmationMessages.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var response = messages
                .Where(message => IsConfirmationCandidatePortalSenderType(message.SenderType))
                .Select(message =>
                {
                    var candidate = candidateById.GetValueOrDefault(message.CandidateId);
                    return new ParishConfirmationAggregatedMessageResponse(
                        message.Id,
                        message.CandidateId,
                        candidate?.Name ?? "Nieznany",
                        candidate?.Surname ?? "kandydat",
                        message.SenderType,
                        message.MessageText,
                        message.CreatedUtc);
                })
                .ToList();

            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-celebrations", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var celebrations = await dbContext.ParishConfirmationCelebrations.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.StartsAtUtc)
                .ThenBy(x => x.CreatedUtc)
                .ToListAsync(ct);
            if (celebrations.Count == 0)
            {
                return Results.Ok(Array.Empty<ParishConfirmationCelebrationResponse>());
            }

            var response = celebrations
                .Select(celebration =>
                {
                    return BuildConfirmationCelebrationResponse(
                        celebration,
                        null,
                        null,
                        null,
                        0,
                        0,
                        null);
                })
                .ToList();

            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-celebrations", async (
            Guid parishId,
            ParishConfirmationCelebrationCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var name = NormalizeConfirmationText(request.Name, 160);
            var shortInfo = NormalizeConfirmationText(request.ShortInfo, 320);
            var description = NormalizeConfirmationText(request.Description, 4000);
            if (name is null || shortInfo is null || description is null)
            {
                return Results.BadRequest(new { error = "Invalid celebration data." });
            }

            if (request.Capacity is < 1 or > ConfirmationEventCapacityMax)
            {
                return Results.BadRequest(new { error = $"Celebration capacity must be between 1 and {ConfirmationEventCapacityMax}." });
            }

            if (request.EndsAtUtc <= request.StartsAtUtc)
            {
                return Results.BadRequest(new { error = "Celebration end time must be after start time." });
            }

            var now = DateTimeOffset.UtcNow;
            var celebration = new ParishConfirmationCelebration
            {
                Id = Guid.NewGuid(),
                ParishId = parishId,
                Name = name,
                ShortInfo = shortInfo,
                StartsAtUtc = request.StartsAtUtc,
                EndsAtUtc = request.EndsAtUtc,
                Description = description,
                Capacity = request.Capacity,
                IsActive = request.IsActive,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.ParishConfirmationCelebrations.Add(celebration);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationCelebrationCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { celebration.Id, celebration.StartsAtUtc, celebration.EndsAtUtc }),
                ct);

            return Results.Ok(new ParishConfirmationCelebrationResponse(
                celebration.Id,
                celebration.Name,
                celebration.ShortInfo,
                celebration.StartsAtUtc,
                celebration.EndsAtUtc,
                celebration.Description,
                celebration.Capacity,
                celebration.IsActive,
                celebration.CreatedUtc,
                celebration.UpdatedUtc,
                null,
                null,
                null,
                null,
                0,
                0,
                null));
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/confirmation-celebrations/{celebrationId:guid}", async (
            Guid parishId,
            Guid celebrationId,
            ParishConfirmationCelebrationCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var celebration = await dbContext.ParishConfirmationCelebrations
                .FirstOrDefaultAsync(x => x.ParishId == parishId && x.Id == celebrationId, ct);
            if (celebration is null)
            {
                return Results.NotFound();
            }

            var name = NormalizeConfirmationText(request.Name, 160);
            var shortInfo = NormalizeConfirmationText(request.ShortInfo, 320);
            var description = NormalizeConfirmationText(request.Description, 4000);
            if (name is null || shortInfo is null || description is null)
            {
                return Results.BadRequest(new { error = "Invalid celebration data." });
            }

            if (request.Capacity is < 1 or > ConfirmationEventCapacityMax)
            {
                return Results.BadRequest(new { error = $"Celebration capacity must be between 1 and {ConfirmationEventCapacityMax}." });
            }

            if (request.EndsAtUtc <= request.StartsAtUtc)
            {
                return Results.BadRequest(new { error = "Celebration end time must be after start time." });
            }

            celebration.Name = name;
            celebration.ShortInfo = shortInfo;
            celebration.StartsAtUtc = request.StartsAtUtc;
            celebration.EndsAtUtc = request.EndsAtUtc;
            celebration.Description = description;
            celebration.Capacity = request.Capacity;
            celebration.IsActive = request.IsActive;
            celebration.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationCelebrationUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { celebration.Id, celebration.StartsAtUtc, celebration.EndsAtUtc }),
                ct);

            return Results.Ok(new ParishConfirmationCelebrationResponse(
                celebration.Id,
                celebration.Name,
                celebration.ShortInfo,
                celebration.StartsAtUtc,
                celebration.EndsAtUtc,
                celebration.Description,
                celebration.Capacity,
                celebration.IsActive,
                celebration.CreatedUtc,
                celebration.UpdatedUtc,
                null,
                null,
                null,
                null,
                0,
                0,
                null));
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/confirmation-events", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var events = await dbContext.ParishConfirmationEvents.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.StartsAtUtc)
                .ThenBy(x => x.CreatedUtc)
                .ToListAsync(ct);
            if (events.Count == 0)
            {
                return Results.Ok(Array.Empty<ParishConfirmationEventResponse>());
            }

            var candidateViews = await LoadParishConfirmationCandidateViewsAsync(parishId, dbContext, dataProtectionProvider, ct);
            var candidateById = candidateViews.ToDictionary(x => x.CandidateId, x => x);
            var eventIds = events.Select(x => x.Id).ToList();
            var joinRows = await dbContext.ParishConfirmationEventJoins.AsNoTracking()
                .Where(x =>
                    x.ParishId == parishId &&
                    eventIds.Contains(x.EventId) &&
                    ((x.Status == ConfirmationEventJoinPending || x.Status == ConfirmationEventJoinAccepted) ||
                     x.Status == ConfirmationEventJoinCancelled ||
                     x.Status == ConfirmationEventJoinRemoved ||
                     x.Status == ConfirmationEventJoinRejected))
                .OrderByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);
            var joinsByEvent = joinRows.GroupBy(x => x.EventId).ToDictionary(group => group.Key, group => group.ToList());

            var response = events.Select(confirmationEvent =>
            {
                var joins = joinsByEvent.GetValueOrDefault(confirmationEvent.Id) ?? new List<ParishConfirmationEventJoin>();
                var reservedCount = joins.Count(join => IsConfirmationEventJoinStatusActive(join.Status));
                var acceptedCount = joins.Count(join => IsConfirmationEventJoinStatusAccepted(join.Status));
                var joinResponses = joins.Select(join =>
                {
                    var candidate = candidateById.GetValueOrDefault(join.CandidateId);
                    return new ParishConfirmationEventJoinResponse(
                        join.Id,
                        join.CandidateId,
                        candidate?.Name ?? "Nieznany",
                        candidate?.Surname ?? "kandydat",
                        join.Status,
                        join.RequestedUtc,
                        join.DecisionUtc,
                        join.UpdatedUtc);
                }).ToList();

                return BuildConfirmationEventResponse(confirmationEvent, null, reservedCount, acceptedCount, joinResponses);
            }).ToList();

            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-events", async (
            Guid parishId,
            ParishConfirmationEventCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var name = NormalizeConfirmationText(request.Name, 160);
            var shortInfo = NormalizeConfirmationText(request.ShortInfo, 320);
            var description = NormalizeConfirmationText(request.Description, 4000);
            if (name is null || shortInfo is null || description is null)
            {
                return Results.BadRequest(new { error = "Invalid event data." });
            }

            if (request.Capacity is < 1 or > ConfirmationEventCapacityMax)
            {
                return Results.BadRequest(new { error = $"Event capacity must be between 1 and {ConfirmationEventCapacityMax}." });
            }

            if (request.EndsAtUtc <= request.StartsAtUtc)
            {
                return Results.BadRequest(new { error = "Event end time must be after start time." });
            }

            var now = DateTimeOffset.UtcNow;
            var confirmationEvent = new ParishConfirmationEvent
            {
                Id = Guid.NewGuid(),
                ParishId = parishId,
                Name = name,
                ShortInfo = shortInfo,
                StartsAtUtc = request.StartsAtUtc,
                EndsAtUtc = request.EndsAtUtc,
                Description = description,
                Capacity = request.Capacity,
                IsActive = request.IsActive,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.ParishConfirmationEvents.Add(confirmationEvent);
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationEventCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { confirmationEvent.Id, confirmationEvent.StartsAtUtc, confirmationEvent.EndsAtUtc }),
                ct);

            return Results.Ok(BuildConfirmationEventResponse(confirmationEvent, null, 0, 0, null));
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/confirmation-events/{eventId:guid}", async (
            Guid parishId,
            Guid eventId,
            ParishConfirmationEventCreateRequest request,
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

            var parish = await dbContext.Parishes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var confirmationEvent = await dbContext.ParishConfirmationEvents
                .FirstOrDefaultAsync(x => x.ParishId == parishId && x.Id == eventId, ct);
            if (confirmationEvent is null)
            {
                return Results.NotFound();
            }

            var name = NormalizeConfirmationText(request.Name, 160);
            var shortInfo = NormalizeConfirmationText(request.ShortInfo, 320);
            var description = NormalizeConfirmationText(request.Description, 4000);
            if (name is null || shortInfo is null || description is null)
            {
                return Results.BadRequest(new { error = "Invalid event data." });
            }

            if (request.Capacity is < 1 or > ConfirmationEventCapacityMax)
            {
                return Results.BadRequest(new { error = $"Event capacity must be between 1 and {ConfirmationEventCapacityMax}." });
            }

            if (request.EndsAtUtc <= request.StartsAtUtc)
            {
                return Results.BadRequest(new { error = "Event end time must be after start time." });
            }

            confirmationEvent.Name = name;
            confirmationEvent.ShortInfo = shortInfo;
            confirmationEvent.StartsAtUtc = request.StartsAtUtc;
            confirmationEvent.EndsAtUtc = request.EndsAtUtc;
            confirmationEvent.Description = description;
            confirmationEvent.Capacity = request.Capacity;
            confirmationEvent.IsActive = request.IsActive;
            confirmationEvent.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationEventUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { confirmationEvent.Id, confirmationEvent.StartsAtUtc, confirmationEvent.EndsAtUtc }),
                ct);

            return Results.Ok(BuildConfirmationEventResponse(confirmationEvent, null, 0, 0, null));
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-events/{eventId:guid}/joins/{joinId:guid}/accept", async (
            Guid parishId,
            Guid eventId,
            Guid joinId,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var confirmationEvent = await dbContext.ParishConfirmationEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ParishId == parishId && x.Id == eventId, ct);
            if (confirmationEvent is null)
            {
                return Results.NotFound();
            }

            var join = await dbContext.ParishConfirmationEventJoins
                .FirstOrDefaultAsync(x => x.ParishId == parishId && x.EventId == eventId && x.Id == joinId, ct);
            if (join is null)
            {
                return Results.NotFound();
            }

            var normalizedStatus = NormalizeConfirmationEventJoinStatus(join.Status);
            if (normalizedStatus == ConfirmationEventJoinAccepted)
            {
                return Results.Ok(new ParishConfirmationEventJoinActionResponse("already-accepted", join.Id, join.UpdatedUtc));
            }

            if (normalizedStatus != ConfirmationEventJoinPending)
            {
                return Results.Ok(new ParishConfirmationEventJoinActionResponse("invalid-status", join.Id, join.UpdatedUtc));
            }

            if (confirmationEvent.Capacity is > 0)
            {
                var reservedOthers = await dbContext.ParishConfirmationEventJoins.AsNoTracking()
                    .Where(x =>
                        x.ParishId == parishId &&
                        x.EventId == eventId &&
                        (x.Status == ConfirmationEventJoinPending || x.Status == ConfirmationEventJoinAccepted) &&
                        x.Id != join.Id)
                    .CountAsync(ct);
                if (reservedOthers >= confirmationEvent.Capacity.Value)
                {
                    return Results.Ok(new ParishConfirmationEventJoinActionResponse("full", join.Id, join.UpdatedUtc));
                }
            }

            var now = DateTimeOffset.UtcNow;
            join.Status = ConfirmationEventJoinAccepted;
            join.DecisionUtc = now;
            join.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationEventJoinAccepted",
                userId.ToString(),
                JsonSerializer.Serialize(new { eventId, joinId, join.CandidateId }),
                ct);

            return Results.Ok(new ParishConfirmationEventJoinActionResponse("accepted", join.Id, join.UpdatedUtc));
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-events/{eventId:guid}/joins/{joinId:guid}/remove", async (
            Guid parishId,
            Guid eventId,
            Guid joinId,
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

            var parish = await dbContext.Parishes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var join = await dbContext.ParishConfirmationEventJoins
                .FirstOrDefaultAsync(x => x.ParishId == parishId && x.EventId == eventId && x.Id == joinId, ct);
            if (join is null)
            {
                return Results.NotFound();
            }

            var normalizedStatus = NormalizeConfirmationEventJoinStatus(join.Status);
            if (normalizedStatus == ConfirmationEventJoinRemoved)
            {
                return Results.Ok(new ParishConfirmationEventJoinActionResponse("already-removed", join.Id, join.UpdatedUtc));
            }

            var now = DateTimeOffset.UtcNow;
            join.Status = ConfirmationEventJoinRemoved;
            join.DecisionUtc = now;
            join.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            await ledgerService.AppendParishAsync(
                parishId,
                "ConfirmationEventJoinRemoved",
                userId.ToString(),
                JsonSerializer.Serialize(new { eventId, joinId, join.CandidateId }),
                ct);

            return Results.Ok(new ParishConfirmationEventJoinActionResponse("removed", join.Id, join.UpdatedUtc));
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/intentions", async (
            Guid parishId,
            ParishIntentionCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var internalKey = await ResolveParishDataKeyAsync(
                parish.IntentionInternalDataItemId,
                keyRing,
                encryptionService,
                dbContext,
                ct);
            if (internalKey is null)
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var intentionId = Guid.NewGuid();
            var internalText = string.IsNullOrWhiteSpace(request.InternalText) ? string.Empty : request.InternalText.Trim();
            var donorRef = string.IsNullOrWhiteSpace(request.DonorReference) ? string.Empty : request.DonorReference.Trim();
            var internalTextEnc = string.IsNullOrWhiteSpace(internalText)
                ? Array.Empty<byte>()
                : encryptionService.Encrypt(internalKey, Encoding.UTF8.GetBytes(internalText), intentionId.ToByteArray());
            var donorRefEnc = string.IsNullOrWhiteSpace(donorRef)
                ? Array.Empty<byte>()
                : encryptionService.Encrypt(internalKey, Encoding.UTF8.GetBytes(donorRef), intentionId.ToByteArray());

            var entity = new ParishIntention
            {
                Id = intentionId,
                ParishId = parish.Id,
                MassDateTime = request.MassDateTime,
                ChurchName = request.ChurchName.Trim(),
                PublicText = request.PublicText.Trim(),
                InternalTextEnc = internalTextEnc,
                DonorRefEnc = donorRefEnc,
                InternalDataKeyId = parish.IntentionInternalKeyId,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.ParishIntentions.Add(entity);
            await dbContext.SaveChangesAsync(ct);

            LedgerSigningContext? signingContext = null;
            if (keyRing.TryGetOwnerKey(parish.AdminRoleId, out var adminOwnerKey))
            {
                signingContext = await roleCryptoService.TryGetSigningContextAsync(parish.AdminRoleId, adminOwnerKey, ct);
            }
            await ledgerService.AppendParishAsync(
                parish.Id,
                "IntentionCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { entity.Id, entity.MassDateTime, entity.Status }),
                ct,
                signingContext);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/intentions/{intentionId:guid}", async (
            Guid parishId,
            Guid intentionId,
            ParishIntentionUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var entity = await dbContext.ParishIntentions.FirstOrDefaultAsync(x => x.Id == intentionId && x.ParishId == parishId, ct);
            if (entity is null)
            {
                return Results.NotFound();
            }

            var internalKey = await ResolveParishDataKeyAsync(
                parish.IntentionInternalDataItemId,
                keyRing,
                encryptionService,
                dbContext,
                ct);
            if (internalKey is null)
            {
                return Results.Forbid();
            }

            var internalText = string.IsNullOrWhiteSpace(request.InternalText) ? string.Empty : request.InternalText.Trim();
            var donorRef = string.IsNullOrWhiteSpace(request.DonorReference) ? string.Empty : request.DonorReference.Trim();
            entity.MassDateTime = request.MassDateTime;
            entity.ChurchName = request.ChurchName.Trim();
            entity.PublicText = request.PublicText.Trim();
            entity.InternalTextEnc = string.IsNullOrWhiteSpace(internalText)
                ? Array.Empty<byte>()
                : encryptionService.Encrypt(internalKey, Encoding.UTF8.GetBytes(internalText), entity.Id.ToByteArray());
            entity.DonorRefEnc = string.IsNullOrWhiteSpace(donorRef)
                ? Array.Empty<byte>()
                : encryptionService.Encrypt(internalKey, Encoding.UTF8.GetBytes(donorRef), entity.Id.ToByteArray());
            entity.Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim();
            entity.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);

            LedgerSigningContext? signingContext = null;
            if (keyRing.TryGetOwnerKey(parish.AdminRoleId, out var adminOwnerKey))
            {
                signingContext = await roleCryptoService.TryGetSigningContextAsync(parish.AdminRoleId, adminOwnerKey, ct);
            }
            await ledgerService.AppendParishAsync(
                parish.Id,
                "IntentionUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { entity.Id, entity.MassDateTime, entity.Status }),
                ct,
                signingContext);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/masses", async (
            Guid parishId,
            ParishMassCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!HasParishMassWriteAccess(keyRing, parish))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var intentionsJson = request.Intentions is { Count: > 0 }
                ? JsonSerializer.Serialize(request.Intentions.Where(x => !string.IsNullOrWhiteSpace(x.Text)).ToList())
                : null;
            var mass = new ParishMass
            {
                Id = Guid.NewGuid(),
                ParishId = parish.Id,
                MassDateTime = request.MassDateTime,
                ChurchName = request.ChurchName.Trim(),
                Title = request.Title.Trim(),
                Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                IsCollective = request.IsCollective,
                DurationMinutes = request.DurationMinutes,
                Kind = string.IsNullOrWhiteSpace(request.Kind) ? null : request.Kind.Trim(),
                BeforeService = string.IsNullOrWhiteSpace(request.BeforeService) ? null : request.BeforeService.Trim(),
                AfterService = string.IsNullOrWhiteSpace(request.AfterService) ? null : request.AfterService.Trim(),
                IntentionsJson = intentionsJson,
                DonationSummary = string.IsNullOrWhiteSpace(request.DonationSummary) ? null : request.DonationSummary.Trim(),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.ParishMasses.Add(mass);
            await dbContext.SaveChangesAsync(ct);

            LedgerSigningContext? signingContext = null;
            if (keyRing.TryGetOwnerKey(parish.AdminRoleId, out var adminOwnerKey))
            {
                signingContext = await roleCryptoService.TryGetSigningContextAsync(parish.AdminRoleId, adminOwnerKey, ct);
            }
            await ledgerService.AppendParishAsync(
                parish.Id,
                "MassCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { mass.Id, mass.MassDateTime }),
                ct,
                signingContext);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/masses/{massId:guid}", async (
            Guid parishId,
            Guid massId,
            ParishMassUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!HasParishMassWriteAccess(keyRing, parish))
            {
                return Results.Forbid();
            }

            var mass = await dbContext.ParishMasses.FirstOrDefaultAsync(x => x.Id == massId && x.ParishId == parishId, ct);
            if (mass is null)
            {
                return Results.NotFound();
            }

            mass.MassDateTime = request.MassDateTime;
            mass.ChurchName = request.ChurchName.Trim();
            mass.Title = request.Title.Trim();
            mass.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            mass.IsCollective = request.IsCollective;
            mass.DurationMinutes = request.DurationMinutes;
            mass.Kind = string.IsNullOrWhiteSpace(request.Kind) ? null : request.Kind.Trim();
            mass.BeforeService = string.IsNullOrWhiteSpace(request.BeforeService) ? null : request.BeforeService.Trim();
            mass.AfterService = string.IsNullOrWhiteSpace(request.AfterService) ? null : request.AfterService.Trim();
            mass.IntentionsJson = request.Intentions is { Count: > 0 }
                ? JsonSerializer.Serialize(request.Intentions.Where(x => !string.IsNullOrWhiteSpace(x.Text)).ToList())
                : null;
            mass.DonationSummary = string.IsNullOrWhiteSpace(request.DonationSummary) ? null : request.DonationSummary.Trim();
            mass.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            LedgerSigningContext? signingContext = null;
            if (keyRing.TryGetOwnerKey(parish.AdminRoleId, out var adminOwnerKey))
            {
                signingContext = await roleCryptoService.TryGetSigningContextAsync(parish.AdminRoleId, adminOwnerKey, ct);
            }
            await ledgerService.AppendParishAsync(
                parish.Id,
                "MassUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { mass.Id, mass.MassDateTime }),
                ct,
                signingContext);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapGet("/{parishId:guid}/mass-rules", async (
            Guid parishId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!HasParishMassWriteAccess(keyRing, parish))
            {
                return Results.Forbid();
            }

            List<ParishMassRule> rulesRaw;
            try
            {
                rulesRaw = await dbContext.ParishMassRules.AsNoTracking()
                    .Where(x => x.ParishId == parishId)
                    .OrderBy(x => x.Name)
                    .ToListAsync(ct);
            }
            catch (SqlException ex) when (ex.Number == 208)
            {
                // Legacy databases may miss this table. Do not crash the parish panel.
                return Results.Ok(Array.Empty<ParishMassRuleResponse>());
            }
            var rules = rulesRaw
                .Select(x =>
                {
                    ParishMassRuleGraph graph;
                    try
                    {
                        graph = JsonSerializer.Deserialize<ParishMassRuleGraph>(x.GraphJson)
                            ?? new ParishMassRuleGraph(string.Empty, Array.Empty<ParishMassRuleNode>(), null);
                    }
                    catch (JsonException)
                    {
                        graph = new ParishMassRuleGraph(string.Empty, Array.Empty<ParishMassRuleNode>(), null);
                    }
                    return new ParishMassRuleResponse(x.Id, x.Name, x.Description, graph, x.UpdatedUtc);
                })
                .ToList();
            return Results.Ok(rules);
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/mass-rules", async (
            Guid parishId,
            ParishMassRuleUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!HasParishMassWriteAccess(keyRing, parish))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var entity = new ParishMassRule
            {
                Id = Guid.NewGuid(),
                ParishId = parishId,
                Name = request.Name.Trim(),
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                GraphJson = JsonSerializer.Serialize(request.Graph),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.ParishMassRules.Add(entity);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(entity.Id);
        }).RequireAuthorization();

        group.MapPut("/{parishId:guid}/mass-rules/{ruleId:guid}", async (
            Guid parishId,
            Guid ruleId,
            ParishMassRuleUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!HasParishMassWriteAccess(keyRing, parish))
            {
                return Results.Forbid();
            }

            var entity = await dbContext.ParishMassRules.FirstOrDefaultAsync(x => x.Id == ruleId && x.ParishId == parishId, ct);
            if (entity is null)
            {
                return Results.NotFound();
            }

            entity.Name = request.Name.Trim();
            entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            entity.GraphJson = JsonSerializer.Serialize(request.Graph);
            entity.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/mass-rules/{ruleId:guid}/simulate", async (
            Guid parishId,
            Guid ruleId,
            ParishMassRuleSimulationRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!HasParishMassWriteAccess(keyRing, parish))
            {
                return Results.Forbid();
            }

            var rule = await dbContext.ParishMassRules.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ruleId && x.ParishId == parishId, ct);
            if (rule is null)
            {
                return Results.NotFound();
            }

            var graph = JsonSerializer.Deserialize<ParishMassRuleGraph>(rule.GraphJson);
            if (graph is null)
            {
                return Results.BadRequest(new { error = "Rule graph is invalid." });
            }

            var simulated = ParishMassRuleEngine.Simulate(parishId, ruleId, graph, request.FromDate, request.ToDate);
            if (!request.IncludeExisting)
            {
                var fromStart = new DateTimeOffset(request.FromDate.ToDateTime(TimeOnly.MinValue));
                var toExclusive = new DateTimeOffset(request.ToDate.AddDays(1).ToDateTime(TimeOnly.MinValue));
                var keys = await dbContext.ParishMasses.AsNoTracking()
                    .Where(x => x.ParishId == parishId
                        && x.MassDateTime >= fromStart
                        && x.MassDateTime < toExclusive)
                    .Select(x => x.MassDateTime)
                    .ToListAsync(ct);
                var taken = keys.Select(x => x.UtcDateTime).ToHashSet();
                simulated = simulated.Where(x => !taken.Contains(x.MassDateTime.UtcDateTime)).ToList();
            }

            return Results.Ok(simulated.Select(x => new ParishMassPublicResponse(
                x.Id,
                x.MassDateTime,
                x.ChurchName,
                x.Title,
                x.Note,
                x.IsCollective,
                x.DurationMinutes,
                x.Kind,
                x.BeforeService,
                x.AfterService,
                x.IntentionsJson,
                x.DonationSummary)).ToList());
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/mass-rules/{ruleId:guid}/apply", async (
            Guid parishId,
            Guid ruleId,
            ParishMassRuleApplyRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!HasParishMassWriteAccess(keyRing, parish))
            {
                return Results.Forbid();
            }

            var rule = await dbContext.ParishMassRules.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ruleId && x.ParishId == parishId, ct);
            if (rule is null)
            {
                return Results.NotFound();
            }

            var graph = JsonSerializer.Deserialize<ParishMassRuleGraph>(rule.GraphJson);
            if (graph is null)
            {
                return Results.BadRequest(new { error = "Rule graph is invalid." });
            }

            var generated = ParishMassRuleEngine.Simulate(parishId, ruleId, graph, request.FromDate, request.ToDate).ToList();
            if (request.ReplaceExisting)
            {
                var fromStart = new DateTimeOffset(request.FromDate.ToDateTime(TimeOnly.MinValue));
                var toExclusive = new DateTimeOffset(request.ToDate.AddDays(1).ToDateTime(TimeOnly.MinValue));
                var existing = await dbContext.ParishMasses
                    .Where(x => x.ParishId == parishId
                        && x.MassDateTime >= fromStart
                        && x.MassDateTime < toExclusive)
                    .ToListAsync(ct);
                dbContext.ParishMasses.RemoveRange(existing);
            }

            dbContext.ParishMasses.AddRange(generated);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { added = generated.Count });
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/offerings", async (
            Guid parishId,
            ParishOfferingCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var parish = await dbContext.Parishes.FirstOrDefaultAsync(x => x.Id == parishId, ct);
            if (parish is null)
            {
                return Results.NotFound();
            }

            var keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            if (!keyRing.ReadKeys.ContainsKey(parish.AdminRoleId))
            {
                return Results.Forbid();
            }

            var intention = await dbContext.ParishIntentions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.IntentionId && x.ParishId == parishId, ct);
            if (intention is null)
            {
                return Results.NotFound();
            }

            var offeringKey = await ResolveParishDataKeyAsync(
                parish.OfferingDataItemId,
                keyRing,
                encryptionService,
                dbContext,
                ct);
            if (offeringKey is null)
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var offeringId = Guid.NewGuid();
            var amountEnc = encryptionService.Encrypt(offeringKey, Encoding.UTF8.GetBytes(request.Amount.Trim()), offeringId.ToByteArray());
            var donorRef = string.IsNullOrWhiteSpace(request.DonorReference) ? string.Empty : request.DonorReference.Trim();
            var donorRefEnc = string.IsNullOrWhiteSpace(donorRef)
                ? Array.Empty<byte>()
                : encryptionService.Encrypt(offeringKey, Encoding.UTF8.GetBytes(donorRef), offeringId.ToByteArray());

            var offering = new ParishOffering
            {
                Id = offeringId,
                ParishId = parish.Id,
                IntentionId = request.IntentionId,
                AmountEnc = amountEnc,
                Currency = string.IsNullOrWhiteSpace(request.Currency) ? "PLN" : request.Currency.Trim(),
                Date = request.Date,
                DonorRefEnc = donorRefEnc,
                DataKeyId = parish.OfferingKeyId,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.ParishOfferings.Add(offering);
            await dbContext.SaveChangesAsync(ct);

            LedgerSigningContext? signingContext = null;
            if (keyRing.TryGetOwnerKey(parish.AdminRoleId, out var adminOwnerKey))
            {
                signingContext = await roleCryptoService.TryGetSigningContextAsync(parish.AdminRoleId, adminOwnerKey, ct);
            }
            await ledgerService.AppendParishAsync(
                parish.Id,
                "OfferingCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { offering.Id, offering.IntentionId, offering.Date }),
                ct,
                signingContext);

            return Results.Ok();
        }).RequireAuthorization();
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

    private static async Task<DataKeyBundle> CreateParishDataKeyAsync(
        RoleBundle parishRole,
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
        var signatureAlg = "RSA-SHA256";

        var encryptedItemName = keyRingService.EncryptDataItemMeta(dataKey, itemName, dataItemId, "item-name");
        var encryptedItemType = keyRingService.EncryptDataItemMeta(dataKey, "key", dataItemId, "item-type");

        dbContext.DataItems.Add(new DataItem
        {
            Id = dataItemId,
            OwnerRoleId = parishRole.RoleId,
            ItemType = string.Empty,
            ItemName = string.Empty,
            EncryptedItemType = encryptedItemType,
            EncryptedItemName = encryptedItemName,
            EncryptedValue = null,
            PublicSigningKey = publicSigningKey,
            PublicSigningKeyAlg = signatureAlg,
            DataSignature = null,
            DataSignatureAlg = null,
            DataSignatureRoleId = null,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        var encryptedDataKey = keyRingService.EncryptDataKey(parishRole.ReadKey, dataKey, dataKeyId);
        var keyLedger = await ledgerService.AppendKeyAsync(
            "ParishDataKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { parishRole.RoleId, dataItemId, dataKeyId, itemName }),
            ct,
            signingContext);

        dbContext.Keys.Add(new KeyEntry
        {
            Id = dataKeyId,
            KeyType = KeyType.DataKey,
            OwnerRoleId = parishRole.RoleId,
            Version = 1,
            EncryptedKeyBlob = encryptedDataKey,
            ScopeType = "parish",
            ScopeSubtype = itemName,
            BoundEntryId = dataItemId,
            LedgerRefId = keyLedger.Id,
            CreatedUtc = now
        });

        dbContext.DataKeyGrants.Add(new DataKeyGrant
        {
            Id = Guid.NewGuid(),
            DataItemId = dataItemId,
            RoleId = parishRole.RoleId,
            PermissionType = RoleRelationships.Owner,
            EncryptedDataKeyBlob = encryptionService.Encrypt(parishRole.ReadKey, dataKey, dataItemId.ToByteArray()),
            EncryptedSigningKeyBlob = encryptionService.Encrypt(parishRole.WriteKey, privateSigningKey, dataItemId.ToByteArray()),
            CreatedUtc = now
        });

        await dbContext.SaveChangesAsync(ct);
        return new DataKeyBundle(dataItemId, dataKeyId, dataKey);
    }

    private static async Task GrantParishDataKeyAsync(
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

    private static async Task<byte[]?> ResolveParishDataKeyAsync(
        Guid dataItemId,
        RoleKeyRing keyRing,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var grants = await dbContext.DataKeyGrants.AsNoTracking()
            .Where(x => x.DataItemId == dataItemId && x.RevokedUtc == null)
            .ToListAsync(ct);

        foreach (var grant in grants)
        {
            if (!keyRing.TryGetReadKey(grant.RoleId, out var readKey))
            {
                continue;
            }

            try
            {
                return encryptionService.Decrypt(readKey, grant.EncryptedDataKeyBlob, dataItemId.ToByteArray());
            }
            catch (CryptographicException)
            {
                continue;
            }
        }

        return null;
    }

    private static string? NormalizeConfirmationText(string? value, int maxLength)
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

    private static List<string> NormalizeConfirmationPhones(IReadOnlyList<string>? phoneNumbers)
    {
        if (phoneNumbers is null || phoneNumbers.Count == 0)
        {
            return new List<string>();
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<string>();
        foreach (var raw in phoneNumbers)
        {
            var normalized = NormalizePolishPhone(raw);
            if (normalized is null)
            {
                continue;
            }

            if (!seen.Add(normalized))
            {
                continue;
            }

            result.Add(normalized);
            if (result.Count >= ConfirmationPhoneLimit)
            {
                break;
            }
        }

        return result;
    }

    private static string? NormalizeConfirmationToken(string? token)
    {
        var normalized = (token ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        if (normalized.Length > 128)
        {
            return null;
        }

        return normalized;
    }

    private static string? NormalizeConfirmationInviteCode(string? inviteCode)
    {
        if (string.IsNullOrWhiteSpace(inviteCode))
        {
            return null;
        }

        var normalized = new string(inviteCode
            .Trim()
            .ToUpperInvariant()
            .Where(ch => char.IsLetterOrDigit(ch))
            .ToArray());
        if (normalized.Length != ConfirmationMeetingInviteCodeLength)
        {
            return null;
        }

        return normalized;
    }

    private static string? NormalizeConfirmationJoinDecision(string? decision)
    {
        var normalized = (decision ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            ConfirmationJoinDecisionAccept => ConfirmationJoinDecisionAccept,
            ConfirmationJoinDecisionReject => ConfirmationJoinDecisionReject,
            _ => null
        };
    }

    private static bool IsConfirmationCandidatePortalSenderType(string? senderType)
    {
        var normalized = (senderType ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            // Keep legacy imports visible even if sender type was omitted.
            return true;
        }

        if (normalized is "admin" or "parish" or "priest" or "office")
        {
            return false;
        }

        return normalized is "candidate" or "kandydat" or "candidate-portal" or "candidateportal" or "portal" or "public"
            || normalized.Contains("candidate")
            || normalized.Contains("kandydat");
    }

    private static List<ParishConfirmationImportPhone> NormalizeConfirmationImportPhones(
        IReadOnlyList<ParishConfirmationImportPhoneRequest>? phoneNumbers)
    {
        if (phoneNumbers is null || phoneNumbers.Count == 0)
        {
            return new List<ParishConfirmationImportPhone>();
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<ParishConfirmationImportPhone>();
        foreach (var item in phoneNumbers)
        {
            var number = NormalizePolishPhone(item.Number);
            if (number is null)
            {
                continue;
            }

            if (!seen.Add(number))
            {
                continue;
            }

            var token = NormalizeConfirmationToken(item.VerificationToken);
            result.Add(new ParishConfirmationImportPhone(number, token, item.VerifiedUtc, item.CreatedUtc));

            if (result.Count >= ConfirmationPhoneLimit)
            {
                break;
            }
        }

        return result;
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

    private static bool TryParseConfirmationImportRequest(
        JsonElement payload,
        out ParishConfirmationImportRequest request,
        out string? error)
    {
        request = new ParishConfirmationImportRequest(Array.Empty<ParishConfirmationImportCandidateRequest>(), false);
        error = null;

        var replaceExisting = false;
        JsonElement candidatesElement;
        JsonElement celebrationsElement = default;
        JsonElement participationsElement = default;
        JsonElement joinsElement = default;
        var hasCelebrationsElement = false;
        var hasParticipationsElement = false;
        var hasJoinsElement = false;

        if (payload.ValueKind == JsonValueKind.Array)
        {
            candidatesElement = payload;
        }
        else if (payload.ValueKind == JsonValueKind.Object)
        {
            if (TryGetJsonProperty(payload, "replaceExisting", out var replaceValue))
            {
                var parsedReplace = GetJsonBooleanValue(replaceValue);
                if (parsedReplace is not null)
                {
                    replaceExisting = parsedReplace.Value;
                }
            }

            if (TryGetJsonProperty(payload, "candidates", out var explicitCandidates))
            {
                candidatesElement = explicitCandidates;
            }
            else if (TryGetJsonProperty(payload, "items", out var legacyItems))
            {
                candidatesElement = legacyItems;
            }
            else
            {
                error = "Import payload must contain candidates.";
                return false;
            }

            if (TryGetJsonProperty(payload, "celebrations", out var explicitCelebrations))
            {
                celebrationsElement = explicitCelebrations;
                hasCelebrationsElement = true;
            }

            if (TryGetJsonProperty(payload, "celebrationParticipations", out var explicitParticipations))
            {
                participationsElement = explicitParticipations;
                hasParticipationsElement = true;
            }

            if (TryGetJsonProperty(payload, "celebrationJoins", out var explicitJoins))
            {
                joinsElement = explicitJoins;
                hasJoinsElement = true;
            }
        }
        else
        {
            error = "Import payload must be a JSON object or array.";
            return false;
        }

        if (candidatesElement.ValueKind != JsonValueKind.Array)
        {
            error = "Candidates must be an array.";
            return false;
        }

        var candidates = new List<ParishConfirmationImportCandidateRequest>();
        foreach (var candidateElement in candidatesElement.EnumerateArray())
        {
            if (candidateElement.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var name = GetJsonString(candidateElement, "name")
                ?? GetJsonString(candidateElement, "firstName")
                ?? string.Empty;
            var surname = GetJsonString(candidateElement, "surname")
                ?? GetJsonString(candidateElement, "lastName")
                ?? string.Empty;
            var address = GetJsonString(candidateElement, "address") ?? string.Empty;
            var schoolShort = GetJsonString(candidateElement, "schoolShort")
                ?? GetJsonString(candidateElement, "school")
                ?? string.Empty;
            var acceptedRodo = GetJsonBoolean(candidateElement, "acceptedRodo") ?? true;
            var paperConsentReceived = GetJsonBoolean(candidateElement, "paperConsentReceived")
                ?? GetJsonBoolean(candidateElement, "paperConsent")
                ?? false;
            var createdUtc = GetJsonDateTimeOffset(candidateElement, "createdUtc");
            var updatedUtc = GetJsonDateTimeOffset(candidateElement, "updatedUtc");
            var meetingToken = GetJsonString(candidateElement, "meetingToken")
                ?? GetJsonString(candidateElement, "bookingToken");
            var phones = ParseConfirmationImportPhoneRequests(candidateElement);

            candidates.Add(new ParishConfirmationImportCandidateRequest(
                name,
                surname,
                phones,
                address,
                schoolShort,
                acceptedRodo,
                paperConsentReceived,
                createdUtc,
                updatedUtc,
                meetingToken));
        }

        var celebrations = hasCelebrationsElement
            ? ParseConfirmationImportCelebrations(celebrationsElement)
            : new List<ParishConfirmationImportCelebrationRequest>();
        var participations = hasParticipationsElement
            ? ParseConfirmationImportCelebrationParticipations(participationsElement)
            : new List<ParishConfirmationImportCelebrationParticipationRequest>();
        var joins = hasJoinsElement
            ? ParseConfirmationImportCelebrationJoins(joinsElement)
            : new List<ParishConfirmationImportCelebrationJoinRequest>();

        request = new ParishConfirmationImportRequest(candidates, replaceExisting, celebrations, participations, joins);
        return true;
    }

    private static List<ParishConfirmationImportCelebrationRequest> ParseConfirmationImportCelebrations(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Array)
        {
            return new List<ParishConfirmationImportCelebrationRequest>();
        }

        var celebrations = new List<ParishConfirmationImportCelebrationRequest>();
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var externalId = GetJsonGuid(item, "id");
            var name = GetJsonString(item, "name") ?? string.Empty;
            var shortInfo = GetJsonString(item, "shortInfo")
                ?? GetJsonString(item, "lead")
                ?? string.Empty;
            var startsAtUtc = GetJsonDateTimeOffset(item, "startsAtUtc")
                ?? GetJsonDateTimeOffset(item, "startUtc");
            var endsAtUtc = GetJsonDateTimeOffset(item, "endsAtUtc")
                ?? GetJsonDateTimeOffset(item, "endUtc");
            var description = GetJsonString(item, "description") ?? string.Empty;
            var capacity = GetJsonInt(item, "capacity");
            var isActive = GetJsonBoolean(item, "isActive") ?? true;
            var createdUtc = GetJsonDateTimeOffset(item, "createdUtc");
            var updatedUtc = GetJsonDateTimeOffset(item, "updatedUtc");

            if (startsAtUtc is null || endsAtUtc is null)
            {
                continue;
            }

            celebrations.Add(new ParishConfirmationImportCelebrationRequest(
                externalId,
                name,
                shortInfo,
                startsAtUtc.Value,
                endsAtUtc.Value,
                description,
                capacity,
                isActive,
                createdUtc,
                updatedUtc));
        }

        return celebrations;
    }

    private static List<ParishConfirmationImportCelebrationParticipationRequest> ParseConfirmationImportCelebrationParticipations(
        JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Array)
        {
            return new List<ParishConfirmationImportCelebrationParticipationRequest>();
        }

        var participations = new List<ParishConfirmationImportCelebrationParticipationRequest>();
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var candidateMeetingToken = GetJsonString(item, "candidateMeetingToken")
                ?? GetJsonString(item, "meetingToken");
            var celebrationExternalId = GetJsonGuid(item, "celebrationExternalId")
                ?? GetJsonGuid(item, "celebrationId");
            var commentText = GetJsonString(item, "commentText")
                ?? GetJsonString(item, "comment")
                ?? string.Empty;
            var createdUtc = GetJsonDateTimeOffset(item, "createdUtc");
            var updatedUtc = GetJsonDateTimeOffset(item, "updatedUtc");

            participations.Add(new ParishConfirmationImportCelebrationParticipationRequest(
                candidateMeetingToken,
                celebrationExternalId,
                commentText,
                createdUtc,
                updatedUtc));
        }

        return participations;
    }

    private static List<ParishConfirmationImportCelebrationJoinRequest> ParseConfirmationImportCelebrationJoins(
        JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Array)
        {
            return new List<ParishConfirmationImportCelebrationJoinRequest>();
        }

        var joins = new List<ParishConfirmationImportCelebrationJoinRequest>();
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var candidateMeetingToken = GetJsonString(item, "candidateMeetingToken")
                ?? GetJsonString(item, "meetingToken");
            var celebrationExternalId = GetJsonGuid(item, "celebrationExternalId")
                ?? GetJsonGuid(item, "celebrationId");
            var status = GetJsonString(item, "status") ?? string.Empty;
            var requestedUtc = GetJsonDateTimeOffset(item, "requestedUtc");
            var decisionUtc = GetJsonDateTimeOffset(item, "decisionUtc");
            var createdUtc = GetJsonDateTimeOffset(item, "createdUtc");
            var updatedUtc = GetJsonDateTimeOffset(item, "updatedUtc");

            joins.Add(new ParishConfirmationImportCelebrationJoinRequest(
                candidateMeetingToken,
                celebrationExternalId,
                status,
                requestedUtc,
                decisionUtc,
                createdUtc,
                updatedUtc));
        }

        return joins;
    }

    private static List<ParishConfirmationImportPhoneRequest> ParseConfirmationImportPhoneRequests(JsonElement candidateElement)
    {
        JsonElement phoneElement;
        if (!TryGetJsonProperty(candidateElement, "phoneNumbers", out phoneElement) &&
            !TryGetJsonProperty(candidateElement, "phones", out phoneElement))
        {
            return new List<ParishConfirmationImportPhoneRequest>();
        }

        if (phoneElement.ValueKind != JsonValueKind.Array)
        {
            return new List<ParishConfirmationImportPhoneRequest>();
        }

        var phones = new List<ParishConfirmationImportPhoneRequest>();
        foreach (var item in phoneElement.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                phones.Add(new ParishConfirmationImportPhoneRequest(
                    item.GetString() ?? string.Empty,
                    null,
                    null,
                    null));
                continue;
            }

            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var number = GetJsonString(item, "number")
                ?? GetJsonString(item, "phone")
                ?? string.Empty;
            var token = GetJsonString(item, "verificationToken")
                ?? GetJsonString(item, "token");
            var createdUtc = GetJsonDateTimeOffset(item, "createdUtc");
            var verifiedUtc = GetJsonDateTimeOffset(item, "verifiedUtc");
            var isVerified = GetJsonBoolean(item, "isVerified") ?? false;
            if (verifiedUtc is null && isVerified)
            {
                verifiedUtc = createdUtc ?? DateTimeOffset.UtcNow;
            }

            phones.Add(new ParishConfirmationImportPhoneRequest(
                number,
                token,
                verifiedUtc,
                createdUtc));
        }

        return phones;
    }

    private static string? GetJsonCandidateMeetingToken(ParishConfirmationImportCandidateRequest candidate)
    {
        return candidate.MeetingToken;
    }

    private static bool TryGetJsonProperty(JsonElement element, string propertyName, out JsonElement value)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    value = property.Value;
                    return true;
                }
            }
        }

        value = default;
        return false;
    }

    private static string? GetJsonString(JsonElement element, string propertyName)
    {
        if (!TryGetJsonProperty(element, propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.String)
        {
            return value.GetString();
        }

        if (value.ValueKind is JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)
        {
            return value.ToString();
        }

        return null;
    }

    private static Guid? GetJsonGuid(JsonElement element, string propertyName)
    {
        if (!TryGetJsonProperty(element, propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.String &&
            Guid.TryParse(value.GetString(), out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static bool? GetJsonBoolean(JsonElement element, string propertyName)
    {
        if (!TryGetJsonProperty(element, propertyName, out var value))
        {
            return null;
        }

        return GetJsonBooleanValue(value);
    }

    private static int? GetJsonInt(JsonElement element, string propertyName)
    {
        if (!TryGetJsonProperty(element, propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number &&
            value.TryGetInt32(out var parsed))
        {
            return parsed;
        }

        if (value.ValueKind == JsonValueKind.String &&
            int.TryParse(value.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed))
        {
            return parsed;
        }

        return null;
    }

    private static bool? GetJsonBooleanValue(JsonElement value)
    {
        if (value.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            return value.GetBoolean();
        }

        if (value.ValueKind == JsonValueKind.String &&
            bool.TryParse(value.GetString(), out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static DateTimeOffset? GetJsonDateTimeOffset(JsonElement element, string propertyName)
    {
        if (!TryGetJsonProperty(element, propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.String &&
            DateTimeOffset.TryParse(
                value.GetString(),
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind | DateTimeStyles.AllowWhiteSpaces,
                out var parsed))
        {
            return parsed;
        }

        if (value.ValueKind == JsonValueKind.Number &&
            value.TryGetInt64(out var unixSeconds))
        {
            try
            {
                return DateTimeOffset.FromUnixTimeSeconds(unixSeconds);
            }
            catch (ArgumentOutOfRangeException)
            {
                return null;
            }
        }

        return null;
    }

    private static async Task<List<ParishConfirmationCandidateView>> LoadParishConfirmationCandidateViewsAsync(
        Guid parishId,
        RecreatioDbContext dbContext,
        IDataProtectionProvider dataProtectionProvider,
        CancellationToken ct)
    {
        var candidateRows = await dbContext.ParishConfirmationCandidates.AsNoTracking()
            .Where(x => x.ParishId == parishId)
            .OrderByDescending(x => x.CreatedUtc)
            .ToListAsync(ct);

        if (candidateRows.Count == 0)
        {
            return new List<ParishConfirmationCandidateView>();
        }

        var candidateIds = candidateRows.Select(x => x.Id).ToList();
        var verificationRows = await dbContext.ParishConfirmationPhoneVerifications.AsNoTracking()
            .Where(x => x.ParishId == parishId && candidateIds.Contains(x.CandidateId))
            .ToListAsync(ct);
        var meetingLinks = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
            .Where(x => x.ParishId == parishId && candidateIds.Contains(x.CandidateId))
            .ToListAsync(ct);
        var verificationsByCandidate = verificationRows
            .GroupBy(x => x.CandidateId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderBy(x => x.PhoneIndex).ToList());
        var meetingLinksByCandidate = meetingLinks
            .GroupBy(x => x.CandidateId)
            .ToDictionary(group => group.Key, group => group.First());
        var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);
        var results = new List<ParishConfirmationCandidateView>();

        foreach (var candidate in candidateRows)
        {
            var payload = TryUnprotectConfirmationPayload(candidate.PayloadEnc, protector);
            if (payload is null)
            {
                continue;
            }

            var candidateVerificationRows = verificationsByCandidate.GetValueOrDefault(candidate.Id) ?? new List<ParishConfirmationPhoneVerification>();
            var verificationByIndex = candidateVerificationRows
                .GroupBy(x => x.PhoneIndex)
                .ToDictionary(group => group.Key, group => group.First());
            var phones = payload.PhoneNumbers
                .Select((number, index) =>
                {
                    var verification = verificationByIndex.GetValueOrDefault(index);
                    return new ParishConfirmationPhoneView(
                        index,
                        number,
                        verification?.VerifiedUtc is not null,
                        verification?.VerifiedUtc,
                        verification?.VerificationToken ?? string.Empty,
                        verification?.CreatedUtc);
                })
                .ToList();
            var meetingLink = meetingLinksByCandidate.GetValueOrDefault(candidate.Id);

            results.Add(new ParishConfirmationCandidateView(
                candidate.Id,
                payload.Name,
                payload.Surname,
                phones,
                payload.Address,
                payload.SchoolShort,
                payload.AcceptedRodo,
                candidate.PaperConsentReceived,
                candidate.CreatedUtc,
                candidate.UpdatedUtc,
                meetingLink?.BookingToken ?? string.Empty,
                meetingLink?.SlotId,
                meetingLink?.BookedUtc));
        }

        return results;
    }

    private static async Task EnsureConfirmationMeetingLinksAsync(
        Guid parishId,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var candidateIds = await dbContext.ParishConfirmationCandidates.AsNoTracking()
            .Where(x => x.ParishId == parishId)
            .Select(x => x.Id)
            .ToListAsync(ct);
        if (candidateIds.Count == 0)
        {
            return;
        }

        var linkedCandidateIds = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
            .Where(x => x.ParishId == parishId && candidateIds.Contains(x.CandidateId))
            .Select(x => x.CandidateId)
            .ToListAsync(ct);
        var linkedSet = new HashSet<Guid>(linkedCandidateIds);
        var missingCandidateIds = candidateIds.Where(id => !linkedSet.Contains(id)).ToList();
        if (missingCandidateIds.Count == 0)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var usedTokens = new HashSet<string>(StringComparer.Ordinal);
        foreach (var candidateId in missingCandidateIds)
        {
            var token = await CreateUniqueConfirmationMeetingBookingTokenAsync(dbContext, usedTokens, ct);
            dbContext.ParishConfirmationMeetingLinks.Add(new ParishConfirmationMeetingLink
            {
                Id = Guid.NewGuid(),
                ParishId = parishId,
                CandidateId = candidateId,
                BookingToken = token,
                SlotId = null,
                BookedUtc = null,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        }

        await dbContext.SaveChangesAsync(ct);
    }

    private static async Task<List<ParishConfirmationCelebrationResponse>> LoadConfirmationUpcomingCelebrationsAsync(
        Guid parishId,
        Guid candidateId,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var windowEnd = now.AddDays(ConfirmationCelebrationUpcomingDays);
        var pastWindowStart = now.AddDays(-ConfirmationCelebrationCommentEditGraceDays);
        var celebrationRows = await dbContext.ParishConfirmationCelebrations.AsNoTracking()
            .Where(x =>
                x.ParishId == parishId &&
                x.IsActive &&
                x.EndsAtUtc >= pastWindowStart &&
                x.StartsAtUtc <= windowEnd)
            .OrderBy(x => x.StartsAtUtc)
            .ThenBy(x => x.CreatedUtc)
            .ToListAsync(ct);
        if (celebrationRows.Count == 0)
        {
            return new List<ParishConfirmationCelebrationResponse>();
        }

        var celebrationIds = celebrationRows.Select(x => x.Id).ToList();
        var participationRows = await dbContext.ParishConfirmationCelebrationParticipations.AsNoTracking()
            .Where(x =>
                x.ParishId == parishId &&
                x.CandidateId == candidateId &&
                celebrationIds.Contains(x.CelebrationId))
            .OrderByDescending(x => x.UpdatedUtc)
            .ToListAsync(ct);
        var participationByCelebrationId = participationRows
            .GroupBy(x => x.CelebrationId)
            .ToDictionary(group => group.Key, group => group.First());
        return celebrationRows
            .Select(celebration =>
            {
                var participation = participationByCelebrationId.GetValueOrDefault(celebration.Id);
                return BuildConfirmationCelebrationResponse(
                    celebration,
                    participation,
                    null,
                    null,
                    0,
                    0,
                    null);
            })
            .ToList();
    }

    private static async Task<List<ParishConfirmationEventResponse>> LoadConfirmationUpcomingEventsAsync(
        Guid parishId,
        Guid candidateId,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var eventRows = await dbContext.ParishConfirmationEvents.AsNoTracking()
            .Where(x =>
                x.ParishId == parishId &&
                x.IsActive &&
                x.EndsAtUtc >= now)
            .OrderBy(x => x.StartsAtUtc)
            .ThenBy(x => x.CreatedUtc)
            .ToListAsync(ct);
        if (eventRows.Count == 0)
        {
            return new List<ParishConfirmationEventResponse>();
        }

        var eventIds = eventRows.Select(x => x.Id).ToList();
        var candidateJoinRows = await dbContext.ParishConfirmationEventJoins.AsNoTracking()
            .Where(x =>
                x.ParishId == parishId &&
                x.CandidateId == candidateId &&
                eventIds.Contains(x.EventId))
            .OrderByDescending(x => x.UpdatedUtc)
            .ToListAsync(ct);
        var candidateJoinByEventId = candidateJoinRows
            .GroupBy(x => x.EventId)
            .ToDictionary(group => group.Key, group => group.First());
        var activeJoinStats = await dbContext.ParishConfirmationEventJoins.AsNoTracking()
            .Where(x =>
                x.ParishId == parishId &&
                eventIds.Contains(x.EventId) &&
                (x.Status == ConfirmationEventJoinPending || x.Status == ConfirmationEventJoinAccepted))
            .GroupBy(x => x.EventId)
            .Select(group => new
            {
                EventId = group.Key,
                ReservedCount = group.Count(),
                AcceptedCount = group.Count(item => item.Status == ConfirmationEventJoinAccepted)
            })
            .ToListAsync(ct);
        var activeJoinStatsByEventId = activeJoinStats.ToDictionary(x => x.EventId, x => (x.ReservedCount, x.AcceptedCount));

        return eventRows
            .Select(confirmationEvent =>
            {
                var candidateJoin = candidateJoinByEventId.GetValueOrDefault(confirmationEvent.Id);
                var joinStats = activeJoinStatsByEventId.GetValueOrDefault(confirmationEvent.Id, (0, 0));
                return BuildConfirmationEventResponse(
                    confirmationEvent,
                    candidateJoin,
                    joinStats.Item1,
                    joinStats.Item2,
                    null);
            })
            .ToList();
    }

    private static ConfirmationMeetingJoinStatus EvaluateConfirmationMeetingJoinStatus(
        ParishConfirmationMeetingSlot slot,
        Guid candidateId,
        int reservedCount,
        string? inviteCode,
        DateTimeOffset nowUtc)
    {
        if (reservedCount >= slot.Capacity)
        {
            return ConfirmationMeetingJoinStatus.Full;
        }

        if (reservedCount == 0)
        {
            return ConfirmationMeetingJoinStatus.Allowed;
        }

        if (IsConfirmationMeetingInviteActive(slot, nowUtc))
        {
            if (slot.HostCandidateId == candidateId || string.Equals(slot.HostInviteToken, inviteCode, StringComparison.OrdinalIgnoreCase))
            {
                return ConfirmationMeetingJoinStatus.Allowed;
            }

            return ConfirmationMeetingJoinStatus.InviteRequired;
        }

        return reservedCount == 1
            ? ConfirmationMeetingJoinStatus.Allowed
            : ConfirmationMeetingJoinStatus.Locked;
    }

    private static bool CanCandidateInviteToConfirmationSlot(
        ParishConfirmationMeetingSlot slot,
        Guid candidateId,
        DateTimeOffset nowUtc)
    {
        return slot.HostCandidateId == candidateId
            && IsConfirmationMeetingInviteActive(slot, nowUtc);
    }

    private static bool IsConfirmationMeetingInviteActive(ParishConfirmationMeetingSlot slot, DateTimeOffset nowUtc)
    {
        return !string.IsNullOrWhiteSpace(slot.HostInviteToken)
            && slot.HostInviteExpiresUtc is not null
            && slot.HostInviteExpiresUtc > nowUtc;
    }

    private static async Task<List<ParishConfirmationMeetingJoinRequestResponse>> LoadPendingConfirmationMeetingJoinRequestsAsync(
        Guid parishId,
        Guid slotId,
        Guid hostCandidateId,
        RecreatioDbContext dbContext,
        IDataProtectionProvider dataProtectionProvider,
        CancellationToken ct)
    {
        var pendingRequests = await dbContext.ParishConfirmationMeetingJoinRequests.AsNoTracking()
            .Where(x =>
                x.ParishId == parishId &&
                x.SlotId == slotId &&
                x.HostCandidateId == hostCandidateId &&
                x.Status == ConfirmationJoinRequestPending)
            .OrderByDescending(x => x.CreatedUtc)
            .ToListAsync(ct);
        if (pendingRequests.Count == 0)
        {
            return new List<ParishConfirmationMeetingJoinRequestResponse>();
        }

        var requesterIds = pendingRequests
            .Select(x => x.RequestedByCandidateId)
            .Distinct()
            .ToList();
        var candidateRows = await dbContext.ParishConfirmationCandidates.AsNoTracking()
            .Where(x => x.ParishId == parishId && requesterIds.Contains(x.Id))
            .ToListAsync(ct);
        var candidateById = candidateRows.ToDictionary(x => x.Id, x => x);
        var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);

        var response = new List<ParishConfirmationMeetingJoinRequestResponse>(pendingRequests.Count);
        foreach (var joinRequest in pendingRequests)
        {
            var name = "Nieznany";
            var surname = "kandydat";
            if (candidateById.TryGetValue(joinRequest.RequestedByCandidateId, out var candidateRow))
            {
                var payload = TryUnprotectConfirmationPayload(candidateRow.PayloadEnc, protector);
                if (payload is not null)
                {
                    name = payload.Name;
                    surname = payload.Surname;
                }
            }

            response.Add(new ParishConfirmationMeetingJoinRequestResponse(
                joinRequest.Id,
                joinRequest.SlotId,
                joinRequest.RequestedByCandidateId,
                name,
                surname,
                joinRequest.CreatedUtc,
                joinRequest.Status));
        }

        return response;
    }

    private static string ResolveConfirmationMeetingVisualStatus(
        ParishConfirmationMeetingSlot slot,
        int reservedCount,
        DateTimeOffset nowUtc)
    {
        if (reservedCount <= 0)
        {
            return "free";
        }

        if (reservedCount >= slot.Capacity)
        {
            return "closed";
        }

        if (slot.HostCandidateId is not null && IsConfirmationMeetingInviteActive(slot, nowUtc))
        {
            return "hosted";
        }

        if (reservedCount > 1)
        {
            return "closed";
        }

        return "free";
    }

    private static async Task RefreshConfirmationMeetingSlotHostAsync(
        Guid parishId,
        Guid slotId,
        RecreatioDbContext dbContext,
        DateTimeOffset nowUtc,
        CancellationToken ct)
    {
        var slot = await dbContext.ParishConfirmationMeetingSlots
            .FirstOrDefaultAsync(x => x.ParishId == parishId && x.Id == slotId, ct);
        if (slot is null)
        {
            return;
        }

        var links = await dbContext.ParishConfirmationMeetingLinks
            .Where(x => x.ParishId == parishId && x.SlotId == slotId)
            .OrderBy(x => x.BookedUtc ?? x.CreatedUtc)
            .ToListAsync(ct);
        if (links.Count == 0)
        {
            slot.HostCandidateId = null;
            slot.HostInviteToken = null;
            slot.HostInviteExpiresUtc = null;
            slot.UpdatedUtc = nowUtc;
            return;
        }

        if (slot.HostCandidateId is not null && links.Any(link => link.CandidateId == slot.HostCandidateId.Value))
        {
            if (string.IsNullOrWhiteSpace(slot.HostInviteToken) || slot.HostInviteExpiresUtc is null)
            {
                slot.HostInviteToken = await CreateUniqueConfirmationMeetingSlotInviteTokenAsync(dbContext, null, ct);
                slot.HostInviteExpiresUtc = nowUtc.AddHours(ConfirmationMeetingInviteHostHours);
                slot.UpdatedUtc = nowUtc;
            }
            return;
        }

        var newHost = links[0];
        slot.HostCandidateId = newHost.CandidateId;
        slot.HostInviteToken = await CreateUniqueConfirmationMeetingSlotInviteTokenAsync(dbContext, null, ct);
        slot.HostInviteExpiresUtc = nowUtc.AddHours(ConfirmationMeetingInviteHostHours);
        slot.UpdatedUtc = nowUtc;
    }

    private static IDataProtector CreateParishConfirmationProtector(IDataProtectionProvider dataProtectionProvider, Guid parishId)
    {
        return dataProtectionProvider.CreateProtector("parish", "confirmation-candidate", parishId.ToString("N"));
    }

    private static ParishConfirmationPayload? TryUnprotectConfirmationPayload(byte[] payloadEnc, IDataProtector protector)
    {
        try
        {
            var json = protector.Unprotect(payloadEnc);
            return JsonSerializer.Deserialize<ParishConfirmationPayload>(json);
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

    private static string CreatePhoneVerificationToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(18);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static async Task<string> CreateUniqueConfirmationPhoneVerificationTokenAsync(
        RecreatioDbContext dbContext,
        HashSet<string>? usedTokens,
        CancellationToken ct)
    {
        while (true)
        {
            var token = CreatePhoneVerificationToken();
            if (usedTokens is not null && usedTokens.Contains(token))
            {
                continue;
            }

            var exists = await dbContext.ParishConfirmationPhoneVerifications.AsNoTracking()
                .AnyAsync(x => x.VerificationToken == token, ct);
            if (exists)
            {
                continue;
            }

            usedTokens?.Add(token);
            return token;
        }
    }

    private static async Task<string> CreateUniqueConfirmationMeetingBookingTokenAsync(
        RecreatioDbContext dbContext,
        HashSet<string>? usedTokens,
        CancellationToken ct)
    {
        while (true)
        {
            var token = CreateMeetingBookingToken();
            if (usedTokens is not null && usedTokens.Contains(token))
            {
                continue;
            }

            var exists = await dbContext.ParishConfirmationMeetingLinks.AsNoTracking()
                .AnyAsync(x => x.BookingToken == token, ct);
            if (exists)
            {
                continue;
            }

            usedTokens?.Add(token);
            return token;
        }
    }

    private static async Task<string> CreateUniqueConfirmationMeetingSlotInviteTokenAsync(
        RecreatioDbContext dbContext,
        HashSet<string>? usedTokens,
        CancellationToken ct)
    {
        while (true)
        {
            var token = CreateMeetingInviteToken();
            if (usedTokens is not null && usedTokens.Contains(token))
            {
                continue;
            }

            var exists = await dbContext.ParishConfirmationMeetingSlots.AsNoTracking()
                .AnyAsync(x => x.HostInviteToken == token, ct);
            if (exists)
            {
                continue;
            }

            usedTokens?.Add(token);
            return token;
        }
    }

    private static string CreateMeetingBookingToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(22);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string CreateMeetingInviteToken()
    {
        var chars = new char[ConfirmationMeetingInviteCodeLength];
        for (var i = 0; i < chars.Length; i += 1)
        {
            var index = RandomNumberGenerator.GetInt32(ConfirmationMeetingInviteCodeAlphabet.Length);
            chars[i] = ConfirmationMeetingInviteCodeAlphabet[index];
        }

        return new string(chars);
    }

    private static bool HasParishMassWriteAccess(RoleKeyRing keyRing, Parish parish)
    {
        return keyRing.ReadKeys.ContainsKey(parish.AdminRoleId)
            || keyRing.ReadKeys.ContainsKey(parish.PriestRoleId)
            || keyRing.ReadKeys.ContainsKey(parish.OfficeRoleId);
    }

    private enum ConfirmationMeetingJoinStatus
    {
        Allowed,
        Full,
        InviteRequired,
        Locked
    }

    private sealed record RoleBundle(Guid RoleId, byte[] ReadKey, byte[] WriteKey, byte[] OwnerKey);

    private sealed record DataKeyBundle(Guid DataItemId, Guid DataKeyId, byte[] DataKey);

    private sealed record ParishConfirmationPhoneView(
        int Index,
        string Number,
        bool IsVerified,
        DateTimeOffset? VerifiedUtc,
        string VerificationToken,
        DateTimeOffset? CreatedUtc);

    private sealed record ParishConfirmationCandidateView(
        Guid CandidateId,
        string Name,
        string Surname,
        IReadOnlyList<ParishConfirmationPhoneView> PhoneNumbers,
        string Address,
        string SchoolShort,
        bool AcceptedRodo,
        bool PaperConsentReceived,
        DateTimeOffset CreatedUtc,
        DateTimeOffset UpdatedUtc,
        string MeetingToken,
        Guid? MeetingSlotId,
        DateTimeOffset? MeetingBookedUtc);

    private sealed record ParishConfirmationImportPhone(
        string Number,
        string? VerificationToken,
        DateTimeOffset? VerifiedUtc,
        DateTimeOffset? CreatedUtc);

    private sealed record ParishConfirmationPayload(
        string Name,
        string Surname,
        IReadOnlyList<string> PhoneNumbers,
        string Address,
        string SchoolShort,
        bool AcceptedRodo);
}
