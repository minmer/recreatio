using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Rowerowa;
using Recreatio.Api.Endpoints;

namespace Recreatio.Api.Endpoints.Rowerowa;

public static class RowerowaEndpoints
{
    private const string DefaultRowerowaSlug = "rowerowa26";
    private const string GlobalEventsLimanowaAdminScope = "events-limanowa";

    public static void MapRowerowaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/rowerowa");

        group.MapGet("/{slug}", async (string slug, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var normalizedSlug = slug.Trim().ToLowerInvariant();
            var rowerowaEvent = await dbContext.RowerowaEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);

            if (rowerowaEvent is null)
            {
                if (!string.Equals(normalizedSlug, DefaultRowerowaSlug, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.NotFound();
                }

                return Results.Ok(CreateDefaultSiteResponse());
            }

            return Results.Ok(ToSiteResponse(rowerowaEvent, true));
        });

        group.MapPost("/admin/events-limanowa/bootstrap-rowerowa26", async (
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

            var rowerowaEvent = await EnsureDefaultRowerowaProvisionedAsync(dbContext, ct);
            return Results.Ok(ToSiteResponse(rowerowaEvent, true));
        }).RequireAuthorization();

        group.MapPost("/{slug}/public/registrations", async (
            string slug,
            RowerowaRegistrationRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Brak identyfikatora wydarzenia." });
            }

            var fullName = NormalizeShort(request.FullName, 200);
            var phone = NormalizePolishPhone(request.Phone);
            var email = NormalizeEmail(request.Email);
            var joinPoint = NormalizeShort(request.JoinPoint, 160);
            var fridayAccommodation = NormalizeShort(request.FridayAccommodation, 160);
            var postPlan = NormalizeShort(request.PostPilgrimagePlan, 200);
            var bikeReturn = NormalizeShort(request.BikeReturn, 200);
            var luggageDropoff = NormalizeShort(request.LuggageDropoff, 120);
            var luggagePickup = NormalizeShort(request.LuggagePickup, 120);
            var skillLevel = NormalizeShort(request.SkillLevel, 220);
            var meals = (request.Meals ?? [])
                .Select(m => m.Trim())
                .Where(m => m.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (string.IsNullOrWhiteSpace(fullName)
                || string.IsNullOrWhiteSpace(phone)
                || string.IsNullOrWhiteSpace(joinPoint)
                || string.IsNullOrWhiteSpace(fridayAccommodation)
                || meals.Count == 0
                || string.IsNullOrWhiteSpace(postPlan)
                || string.IsNullOrWhiteSpace(bikeReturn)
                || string.IsNullOrWhiteSpace(luggageDropoff)
                || string.IsNullOrWhiteSpace(luggagePickup)
                || string.IsNullOrWhiteSpace(skillLevel))
            {
                return Results.BadRequest(new { error = "Uzupełnij wszystkie wymagane pola zgłoszenia." });
            }

            if (!request.HasHelmet || !request.BikeRoadworthy || !request.KnowsSafetyRules)
            {
                return Results.BadRequest(new { error = "Musisz potwierdzić wszystkie oświadczenia dotyczące bezpieczeństwa." });
            }

            var normalizedSlug = slug.Trim().ToLowerInvariant();
            var rowerowaEvent = await dbContext.RowerowaEvents
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);

            if (rowerowaEvent is null)
            {
                if (!string.Equals(normalizedSlug, DefaultRowerowaSlug, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.NotFound();
                }

                rowerowaEvent = await EnsureDefaultRowerowaProvisionedAsync(dbContext, ct);
            }

            var now = DateTimeOffset.UtcNow;
            var registration = new RowerowaRegistration
            {
                Id = Guid.NewGuid(),
                EventId = rowerowaEvent.Id,
                FullName = fullName,
                Phone = phone,
                Email = email,
                JoinPoint = joinPoint,
                FridayAccommodation = fridayAccommodation,
                MealsJson = JsonSerializer.Serialize(meals),
                PostPilgrimagePlan = postPlan,
                BikeReturn = bikeReturn,
                LuggageDropoff = luggageDropoff,
                LuggagePickup = luggagePickup,
                HasHelmet = request.HasHelmet,
                BikeRoadworthy = request.BikeRoadworthy,
                KnowsSafetyRules = request.KnowsSafetyRules,
                SkillLevel = skillLevel,
                HelpOffer = NormalizeLong(request.HelpOffer, 2000),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.RowerowaRegistrations.Add(registration);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new RowerowaRegistrationResponse(registration.Id, registration.CreatedUtc));
        });

        group.MapGet("/{eventId:guid}/organizer/dashboard", async (
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

            var rowerowaEvent = await dbContext.RowerowaEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (rowerowaEvent is null)
            {
                return Results.NotFound();
            }

            var rows = await LoadRegistrationRowsAsync(dbContext, eventId, ct);

            var stats = new RowerowaOrganizerStatsResponse(
                rows.Count,
                rows.Count(x => x.JoinPoint.StartsWith("Kraków", StringComparison.OrdinalIgnoreCase)),
                rows.Count(x => x.FridayAccommodation.Contains("Hostel", StringComparison.OrdinalIgnoreCase)));

            return Results.Ok(new RowerowaOrganizerDashboardResponse(stats, rows));
        }).RequireAuthorization();

        group.MapGet("/{eventId:guid}/organizer/registrations/export", async (
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

            var rowerowaEvent = await dbContext.RowerowaEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (rowerowaEvent is null)
            {
                return Results.NotFound();
            }

            var rows = await LoadRegistrationRowsAsync(dbContext, eventId, ct);

            return Results.Ok(new RowerowaRegistrationExportResponse(
                rowerowaEvent.Id,
                rowerowaEvent.Slug,
                DateTimeOffset.UtcNow,
                rows));
        }).RequireAuthorization();
    }

    private static async Task<List<RowerowaOrganizerRegistrationRow>> LoadRegistrationRowsAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        CancellationToken ct)
    {
        var entities = await dbContext.RowerowaRegistrations.AsNoTracking()
            .Where(x => x.EventId == eventId)
            .OrderByDescending(x => x.CreatedUtc)
            .ToListAsync(ct);

        return entities.Select(x => new RowerowaOrganizerRegistrationRow(
            x.Id,
            x.FullName,
            x.Phone,
            x.Email,
            x.JoinPoint,
            x.FridayAccommodation,
            DeserializeMeals(x.MealsJson),
            x.PostPilgrimagePlan,
            x.BikeReturn,
            x.LuggageDropoff,
            x.LuggagePickup,
            x.HasHelmet,
            x.BikeRoadworthy,
            x.KnowsSafetyRules,
            x.SkillLevel,
            x.HelpOffer,
            x.CreatedUtc)).ToList();
    }

    private static IReadOnlyList<string> DeserializeMeals(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(value) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static async Task<bool> IsGlobalEventsLimanowaAdminAsync(
        RecreatioDbContext dbContext,
        Guid userId,
        CancellationToken ct)
    {
        var assignment = await dbContext.PortalAdminAssignments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScopeKey == GlobalEventsLimanowaAdminScope, ct);
        return assignment is not null && assignment.UserId == userId;
    }

    private static async Task<RowerowaEvent> EnsureDefaultRowerowaProvisionedAsync(
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var existing = await dbContext.RowerowaEvents
            .FirstOrDefaultAsync(x => x.Slug == DefaultRowerowaSlug, ct);
        if (existing is not null)
        {
            return existing;
        }

        var defaults = CreateDefaultSiteResponse();
        var now = DateTimeOffset.UtcNow;
        var created = new RowerowaEvent
        {
            Id = Guid.NewGuid(),
            Slug = DefaultRowerowaSlug,
            Name = defaults.Name,
            Motto = defaults.Motto,
            StartDate = defaults.StartDate,
            EndDate = defaults.EndDate,
            StartLocation = defaults.StartLocation,
            EndLocation = defaults.EndLocation,
            OrganizerName = defaults.OrganizerName,
            OrganizerEmail = defaults.OrganizerEmail,
            OrganizerPhone = defaults.OrganizerPhone,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.RowerowaEvents.Add(created);

        try
        {
            await dbContext.SaveChangesAsync(ct);
            return created;
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
            return await dbContext.RowerowaEvents.FirstAsync(x => x.Slug == DefaultRowerowaSlug, ct);
        }
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

    private static string NormalizeEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Trim();
        if (normalized.Length > 180 || !normalized.Contains('@'))
        {
            return string.Empty;
        }

        return normalized;
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

    private static RowerowaSiteResponse ToSiteResponse(RowerowaEvent rowerowaEvent, bool isProvisioned)
    {
        return new RowerowaSiteResponse(
            rowerowaEvent.Id,
            rowerowaEvent.Slug,
            rowerowaEvent.Name,
            rowerowaEvent.Motto,
            rowerowaEvent.StartDate,
            rowerowaEvent.EndDate,
            rowerowaEvent.StartLocation,
            rowerowaEvent.EndLocation,
            rowerowaEvent.OrganizerName,
            rowerowaEvent.OrganizerEmail,
            rowerowaEvent.OrganizerPhone,
            isProvisioned);
    }

    private static RowerowaSiteResponse CreateDefaultSiteResponse()
    {
        return new RowerowaSiteResponse(
            null,
            DefaultRowerowaSlug,
            "Rowerowa Częstochowa 2026",
            "Pielgrzymka rowerowa z Krakowa do Częstochowy",
            new DateOnly(2026, 8, 28),
            new DateOnly(2026, 8, 29),
            "Kraków",
            "Częstochowa",
            "ks. Michał Mleczek",
            "mleczek_pradnik@outlook.com",
            "+48 505 548 677",
            false);
    }
}
