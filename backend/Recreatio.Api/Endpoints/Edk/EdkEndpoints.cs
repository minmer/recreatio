using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Edk;
using Recreatio.Api.Endpoints;

namespace Recreatio.Api.Endpoints.Edk;

public static class EdkEndpoints
{
    private const string DefaultEdkSlug = "edk26";
    private const string GlobalEventsLimanowaAdminScope = "events-limanowa";

    private static readonly string[] AllowedParticipantStatuses =
    [
        "adult",
        "minor_with_guardian",
        "adult_guardian_for_minor"
    ];

    public static void MapEdkEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/edk");

        group.MapGet("/{slug}", async (string slug, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Slug is required." });
            }

            var normalizedSlug = slug.Trim().ToLowerInvariant();
            var edkEvent = await dbContext.EdkEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);

            if (edkEvent is null)
            {
                if (!string.Equals(normalizedSlug, DefaultEdkSlug, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.NotFound();
                }

                return Results.Ok(new EdkSiteResponse(
                    null,
                    DefaultEdkSlug,
                    "EDK 2026",
                    "Nocna droga w małej wspólnocie",
                    new DateOnly(2026, 3, 27),
                    new DateOnly(2026, 3, 28),
                    "Kraków",
                    "Dobczyce",
                    "ks. Michał Mleczek",
                    "mleczek_pradnik@outlook.com",
                    "+48 505 548 677",
                    CreateDefaultSiteDocument(),
                    false));
            }

            var siteConfig = await dbContext.EdkSiteConfigs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EventId == edkEvent.Id && x.IsPublished, ct);
            var siteDocument = siteConfig is null
                ? CreateDefaultSiteDocument()
                : DeserializeSiteDocument(siteConfig.SiteConfigJson);

            return Results.Ok(ToSiteResponse(edkEvent, siteDocument, true));
        });

        group.MapPost("/admin/events-limanowa/bootstrap-edk26", async (
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

            var edkEvent = await EnsureDefaultEdkProvisionedAsync(dbContext, ct);
            var siteConfig = await dbContext.EdkSiteConfigs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EventId == edkEvent.Id && x.IsPublished, ct);
            var siteDocument = siteConfig is null
                ? CreateDefaultSiteDocument()
                : DeserializeSiteDocument(siteConfig.SiteConfigJson);

            return Results.Ok(ToSiteResponse(edkEvent, siteDocument, true));
        }).RequireAuthorization();

        group.MapPost("/{slug}/public/registrations", async (
            string slug,
            EdkRegistrationRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Results.BadRequest(new { error = "Brak identyfikatora wydarzenia." });
            }

            var fullName = NormalizeShort(request.FullName, 200);
            var phone = NormalizePolishPhone(request.Phone);
            if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "Uzupełnij imię i nazwisko oraz poprawny numer telefonu (+48 i 9 cyfr)." });
            }

            var normalizedSlug = slug.Trim().ToLowerInvariant();
            var edkEvent = await dbContext.EdkEvents
                .FirstOrDefaultAsync(x => x.Slug == normalizedSlug, ct);

            if (edkEvent is null)
            {
                if (!string.Equals(normalizedSlug, DefaultEdkSlug, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.NotFound();
                }

                edkEvent = await EnsureDefaultEdkProvisionedAsync(dbContext, ct);
            }

            var now = DateTimeOffset.UtcNow;
            var registration = new EdkRegistration
            {
                Id = Guid.NewGuid(),
                EventId = edkEvent.Id,
                FullName = fullName,
                Phone = phone,
                ParticipantStatus = NormalizeParticipantStatus(request.ParticipantStatus),
                AdditionalInfo = NormalizeLong(request.AdditionalInfo, 2400),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.EdkRegistrations.Add(registration);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EdkRegistrationResponse(registration.Id, registration.CreatedUtc));
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

            var edkEvent = await dbContext.EdkEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (edkEvent is null)
            {
                return Results.NotFound();
            }

            var rows = await dbContext.EdkRegistrations.AsNoTracking()
                .Where(x => x.EventId == eventId)
                .OrderByDescending(x => x.CreatedUtc)
                .Select(x => new EdkOrganizerRegistrationRow(
                    x.Id,
                    x.FullName,
                    x.Phone,
                    x.ParticipantStatus,
                    x.AdditionalInfo,
                    x.CreatedUtc))
                .ToListAsync(ct);

            var stats = new EdkOrganizerStatsResponse(
                rows.Count,
                rows.Count(x => string.Equals(x.ParticipantStatus, "adult", StringComparison.OrdinalIgnoreCase)),
                rows.Count(x => string.Equals(x.ParticipantStatus, "minor_with_guardian", StringComparison.OrdinalIgnoreCase)),
                rows.Count(x => string.Equals(x.ParticipantStatus, "adult_guardian_for_minor", StringComparison.OrdinalIgnoreCase)));

            return Results.Ok(new EdkOrganizerDashboardResponse(stats, rows));
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

            var edkEvent = await dbContext.EdkEvents.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (edkEvent is null)
            {
                return Results.NotFound();
            }

            var rows = await dbContext.EdkRegistrations.AsNoTracking()
                .Where(x => x.EventId == eventId)
                .OrderByDescending(x => x.CreatedUtc)
                .Select(x => new EdkOrganizerRegistrationRow(
                    x.Id,
                    x.FullName,
                    x.Phone,
                    x.ParticipantStatus,
                    x.AdditionalInfo,
                    x.CreatedUtc))
                .ToListAsync(ct);

            return Results.Ok(new EdkRegistrationExportResponse(
                edkEvent.Id,
                edkEvent.Slug,
                DateTimeOffset.UtcNow,
                rows));
        }).RequireAuthorization();
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

    private static async Task<EdkEvent> EnsureDefaultEdkProvisionedAsync(
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var existing = await dbContext.EdkEvents
            .FirstOrDefaultAsync(x => x.Slug == DefaultEdkSlug, ct);
        if (existing is not null)
        {
            await EnsureDefaultSiteConfigExistsAsync(dbContext, existing.Id, ct);
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var created = new EdkEvent
        {
            Id = Guid.NewGuid(),
            Slug = DefaultEdkSlug,
            Name = "EDK 2026",
            Motto = "Nocna droga w małej wspólnocie",
            StartDate = new DateOnly(2026, 3, 27),
            EndDate = new DateOnly(2026, 3, 28),
            StartLocation = "Kraków",
            EndLocation = "Dobczyce",
            OrganizerName = "ks. Michał Mleczek",
            OrganizerEmail = "mleczek_pradnik@outlook.com",
            OrganizerPhone = "+48 505 548 677",
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.EdkEvents.Add(created);
        dbContext.EdkSiteConfigs.Add(new EdkSiteConfig
        {
            Id = Guid.NewGuid(),
            EventId = created.Id,
            SiteConfigJson = SerializeSiteDocument(CreateDefaultSiteDocument()),
            IsPublished = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        try
        {
            await dbContext.SaveChangesAsync(ct);
            return created;
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
            var reloaded = await dbContext.EdkEvents
                .FirstAsync(x => x.Slug == DefaultEdkSlug, ct);
            await EnsureDefaultSiteConfigExistsAsync(dbContext, reloaded.Id, ct);
            return reloaded;
        }
    }

    private static async Task EnsureDefaultSiteConfigExistsAsync(
        RecreatioDbContext dbContext,
        Guid eventId,
        CancellationToken ct)
    {
        var existingConfig = await dbContext.EdkSiteConfigs
            .FirstOrDefaultAsync(x => x.EventId == eventId && x.IsPublished, ct);
        if (existingConfig is not null)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        dbContext.EdkSiteConfigs.Add(new EdkSiteConfig
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            SiteConfigJson = SerializeSiteDocument(CreateDefaultSiteDocument()),
            IsPublished = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
        }
    }

    private static string NormalizeParticipantStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedParticipantStatuses.Contains(normalized, StringComparer.Ordinal)
            ? normalized
            : "adult";
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

    private static EdkSiteResponse ToSiteResponse(EdkEvent edkEvent, EdkSiteDocument site, bool isProvisioned)
    {
        return new EdkSiteResponse(
            edkEvent.Id,
            edkEvent.Slug,
            edkEvent.Name,
            edkEvent.Motto,
            edkEvent.StartDate,
            edkEvent.EndDate,
            edkEvent.StartLocation,
            edkEvent.EndLocation,
            edkEvent.OrganizerName,
            edkEvent.OrganizerEmail,
            edkEvent.OrganizerPhone,
            site,
            isProvisioned);
    }

    private static EdkSiteDocument DeserializeSiteDocument(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return CreateDefaultSiteDocument();
        }

        try
        {
            var site = JsonSerializer.Deserialize<EdkSiteDocument>(value);
            if (site?.RoutePoints is null || site.RoutePoints.Count == 0)
            {
                return CreateDefaultSiteDocument();
            }

            return new EdkSiteDocument(site.RoutePoints
                .Select(NormalizeRoutePoint)
                .ToList());
        }
        catch (JsonException)
        {
            return CreateDefaultSiteDocument();
        }
    }

    private static string SerializeSiteDocument(EdkSiteDocument site)
    {
        return JsonSerializer.Serialize(site);
    }

    private static EdkRoutePoint NormalizeRoutePoint(EdkRoutePoint point)
    {
        var type = NormalizeRoutePointType(point.Type);
        return new EdkRoutePoint(
            type,
            NormalizeShort(point.TitlePl, 240) ?? string.Empty,
            NormalizeShort(point.Url, 2000) ?? string.Empty,
            NormalizeShort(point.DistanceKm, 64) ?? string.Empty);
    }

    private static string NormalizeRoutePointType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "start" => "start",
            "station" => "station",
            "finish" => "finish",
            "distance" => "distance",
            _ => "station"
        };
    }

    private static EdkSiteDocument CreateDefaultSiteDocument()
    {
        return new EdkSiteDocument(
        [
            new EdkRoutePoint("start", "Punkt startowy", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja I — Jezus na śmierć skazany", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja II — Jezus bierze krzyż na swoje ramiona", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja III — Jezus upada po raz pierwszy", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja IV — Jezus spotyka swoją Matkę", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja V — Szymon z Cyreny pomaga nieść krzyż Jezusowi", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja VI — Weronika ociera twarz Jezusowi", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja VII — Jezus upada po raz drugi", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja VIII — Jezus pociesza płaczące niewiasty", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja IX — Jezus upada po raz trzeci", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja X — Jezus z szat obnażony", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja XI — Jezus przybity do krzyża", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja XII — Jezus umiera na krzyżu", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja XIII — Jezus zdjęty z krzyża", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do kolejnego punktu", string.Empty, "[x km]"),
            new EdkRoutePoint("station", "Stacja XIV — Jezus złożony do grobu", string.Empty, string.Empty),
            new EdkRoutePoint("distance", "+ odległość do mety", string.Empty, "[x km]"),
            new EdkRoutePoint("finish", "Punkt końcowy", string.Empty, string.Empty)
        ]);
    }
}
