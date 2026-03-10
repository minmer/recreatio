using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
    private static readonly string[] Breakpoints = { "desktop", "tablet", "mobile" };

    private static ParishSacramentSection NormalizeSacramentSection(ParishSacramentSection? section)
    {
        return new ParishSacramentSection(
            (section?.Title ?? string.Empty).Trim(),
            (section?.Body ?? string.Empty).Trim());
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
            NormalizeSacramentParishPages(homepage.SacramentParishPages));
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
                return Results.BadRequest(new { error = "At least one phone number is required." });
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
                    candidate.CreatedUtc))
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

            var candidates = await LoadParishConfirmationCandidateViewsAsync(
                parishId,
                dbContext,
                dataProtectionProvider,
                ct);
            var response = new ParishConfirmationExportResponse(
                1,
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
                        candidate.CreatedUtc,
                        candidate.UpdatedUtc))
                    .ToList());

            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapPost("/{parishId:guid}/confirmation-candidates/import", async (
            Guid parishId,
            ParishConfirmationImportRequest request,
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

            var sourceCandidates = request.Candidates ?? [];
            if (sourceCandidates.Count == 0 && !request.ReplaceExisting)
            {
                return Results.BadRequest(new { error = "Import payload is empty." });
            }

            if (request.ReplaceExisting)
            {
                var existingVerifications = await dbContext.ParishConfirmationPhoneVerifications
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingVerifications.Count > 0)
                {
                    dbContext.ParishConfirmationPhoneVerifications.RemoveRange(existingVerifications);
                }

                var existingCandidates = await dbContext.ParishConfirmationCandidates
                    .Where(x => x.ParishId == parishId)
                    .ToListAsync(ct);
                if (existingCandidates.Count > 0)
                {
                    dbContext.ParishConfirmationCandidates.RemoveRange(existingCandidates);
                }

                if (existingVerifications.Count > 0 || existingCandidates.Count > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                }
            }

            var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);
            var sourceTokens = sourceCandidates
                .SelectMany(candidate => candidate.PhoneNumbers ?? [])
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

            var importedCandidates = 0;
            var importedPhoneNumbers = 0;
            var skippedCandidates = 0;
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
                var acceptedRodo = sourceCandidate.AcceptedRodo;
                var phoneNumbers = phones.Select(x => x.Number).ToList();
                var payload = new ParishConfirmationPayload(
                    name,
                    surname,
                    phoneNumbers,
                    address,
                    schoolShort,
                    acceptedRodo);
                var payloadJson = JsonSerializer.SerializeToUtf8Bytes(payload);
                var payloadEnc = protector.Protect(payloadJson);
                var candidateId = Guid.NewGuid();

                dbContext.ParishConfirmationCandidates.Add(new ParishConfirmationCandidate
                {
                    Id = candidateId,
                    ParishId = parishId,
                    PayloadEnc = payloadEnc,
                    AcceptedRodo = acceptedRodo,
                    CreatedUtc = createdUtc,
                    UpdatedUtc = updatedUtc
                });

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
                    request.ReplaceExisting
                }),
                ct);

            return Results.Ok(new ParishConfirmationImportResponse(
                importedCandidates,
                importedPhoneNumbers,
                skippedCandidates,
                request.ReplaceExisting));
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

            var rulesRaw = await dbContext.ParishMassRules.AsNoTracking()
                .Where(x => x.ParishId == parishId)
                .OrderBy(x => x.Name)
                .ToListAsync(ct);
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

        var encryptedItemName = keyRingService.EncryptDataItemMeta(parishRole.ReadKey, itemName, dataItemId, "item-name");
        var encryptedItemType = keyRingService.EncryptDataItemMeta(parishRole.ReadKey, "key", dataItemId, "item-type");

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
            var normalized = NormalizeConfirmationText(raw, 40);
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
            var number = NormalizeConfirmationText(item.Number, 40);
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
        var verificationsByCandidate = verificationRows
            .GroupBy(x => x.CandidateId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderBy(x => x.PhoneIndex).ToList());
        var protector = CreateParishConfirmationProtector(dataProtectionProvider, parishId);
        var results = new List<ParishConfirmationCandidateView>();

        foreach (var candidate in candidateRows)
        {
            var payload = TryUnprotectConfirmationPayload(candidate.PayloadEnc, protector);
            if (payload is null)
            {
                continue;
            }

            var candidateVerificationRows = verificationsByCandidate.GetValueOrDefault(candidate.Id) ?? [];
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

            results.Add(new ParishConfirmationCandidateView(
                candidate.Id,
                payload.Name,
                payload.Surname,
                phones,
                payload.Address,
                payload.SchoolShort,
                payload.AcceptedRodo,
                candidate.CreatedUtc,
                candidate.UpdatedUtc));
        }

        return results;
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

    private static bool HasParishMassWriteAccess(RoleKeyRing keyRing, Parish parish)
    {
        return keyRing.ReadKeys.ContainsKey(parish.AdminRoleId)
            || keyRing.ReadKeys.ContainsKey(parish.PriestRoleId)
            || keyRing.ReadKeys.ContainsKey(parish.OfficeRoleId);
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
        DateTimeOffset CreatedUtc,
        DateTimeOffset UpdatedUtc);

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
