using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;
using Recreatio.Api.Data.Pilgrimage;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// Composable events. A site holds one public page plus any number of internal
/// pages; an individual access link opens exactly the internal pages it has been
/// granted. There is no permission ladder — a grant row is the whole authority.
/// </summary>
public static partial class EventEndpoints
{
    private const string EventAdminScope = "events";

    private static readonly string[] AllowedPartKinds =
    [
        "title", "shortinfos", "text", "plan", "map",
        "faq", "form", "costs", "contact", "gallery", "files", "people",
        // Behind an individual link only: correcting one's own submission, and
        // the participant card with its consents.
        "registration", "card", "topics",
        // The organizer's own view of who signed up, placed as a slide.
        "roster",
        // And the participant's own: what is still theirs to do.
        "checklist"
    ];

    private static readonly string[] AllowedFieldKinds =
        ["text", "textarea", "select", "multiselect", "checkbox", "number", "date", "email", "phone"];

    private static readonly string[] AllowedIdentityRoles = ["none", "name", "contact"];

    /// <summary>
    /// Segments the front end routes to the builder rather than to an event, so
    /// no site may claim one as its public address.
    /// </summary>
    private static readonly string[] ReservedSlugs = ["admin", "link", "event", "event_old"];

    public static void MapEventEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/events");

        MapPublicEndpoints(group);
        MapLinkEndpoints(group);
        MapAdminScopeEndpoints(group);
        MapAdminSiteEndpoints(group);
        MapAdminPageEndpoints(group);
        MapAdminPartEndpoints(group);
        MapAdminFieldEndpoints(group);
        MapAdminAccessEndpoints(group);
        MapParticipantEndpoints(group);
        MapProgressEndpoints(group);
        MapParticipantAdminEndpoints(group);
        MapRosterEndpoints(group);
        MapTopicEndpoints(group);
        MapTopicAdminEndpoints(group);
        MapImportEndpoints(group);
        MapImageEndpoints(group);
        MapDocumentEndpoints(group);
    }

    // ── Public ───────────────────────────────────────────────────────────────

    private static void MapPublicEndpoints(RouteGroupBuilder group)
    {
        // The events overview. Everything needed to filter and sort comes back
        // in one call; the client derives the filter options from the rows.
        group.MapGet("/catalogue", async (
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var sites = await dbContext.EventSites.AsNoTracking()
                .Where(x => x.IsPublished)
                .OrderBy(x => x.StartDate == null)
                .ThenBy(x => x.StartDate)
                .ThenBy(x => x.Title)
                .ToListAsync(ct);

            return Results.Ok(sites.Select(ToCatalogueEntry).ToList());
        });

        group.MapGet("/site/{slug}", async (
            string slug,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var site = await FindPublishedSiteAsync(dbContext, slug, ct);
            if (site is null)
            {
                return Results.NotFound();
            }

            var page = await dbContext.EventPages.AsNoTracking()
                .Where(x => x.SiteId == site.Id && x.Kind == "public")
                .OrderBy(x => x.SortOrder)
                .FirstOrDefaultAsync(ct);

            if (page is null)
            {
                return Results.NotFound();
            }

            var pageResponse = await BuildPageResponseAsync(dbContext, page, ct);
            return Results.Ok(new EventPublicSiteResponse(ToHeader(site), pageResponse));
        });

        group.MapPost("/site/{slug}/parts/{partId:guid}/submit", async (
            string slug,
            Guid partId,
            EventSubmitRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var site = await FindPublishedSiteAsync(dbContext, slug, ct);
            if (site is null)
            {
                return Results.NotFound();
            }

            var part = await dbContext.EventParts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null || !part.IsVisible || part.Kind != "form")
            {
                return Results.NotFound();
            }

            var page = await dbContext.EventPages.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == part.PageId && x.SiteId == site.Id, ct);
            if (page is null)
            {
                return Results.NotFound();
            }

            // A form on an internal page needs a link that was granted that page.
            EventAccessLink? link = null;
            if (!string.IsNullOrWhiteSpace(request.AccessToken))
            {
                link = await dbContext.EventAccessLinks
                    .FirstOrDefaultAsync(x => x.Token == request.AccessToken && x.SiteId == site.Id && x.Status == "active", ct);
            }

            if (page.Kind != "public")
            {
                if (link is null)
                {
                    return Results.NotFound();
                }
                var granted = await dbContext.EventAccessLinkPages.AsNoTracking()
                    .AnyAsync(x => x.AccessLinkId == link.Id && x.PageId == page.Id, ct);
                if (!granted)
                {
                    return Results.NotFound();
                }
            }

            var fields = await dbContext.EventPartFields.AsNoTracking()
                .Where(x => x.PartId == partId)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

            if (fields.Count == 0)
            {
                return Results.BadRequest(new { error = "Ten formularz nie ma jeszcze pól." });
            }

            var supplied = (request.Values ?? [])
                .GroupBy(v => v.FieldId)
                .ToDictionary(g => g.Key, g => g.First().Value);

            var registration = new EventRegistration
            {
                Id = Guid.NewGuid(),
                SiteId = site.Id,
                PartId = part.Id,
                AccessLinkId = link?.Id,
                SubmittedUtc = DateTimeOffset.UtcNow
            };

            var values = new List<EventRegistrationValue>();
            foreach (var field in fields)
            {
                supplied.TryGetValue(field.Id, out var raw);
                var value = NormalizeFieldValue(field, raw);

                if (field.IsRequired && string.IsNullOrWhiteSpace(value))
                {
                    return Results.BadRequest(new { error = $"Pole „{field.Label}” jest wymagane." });
                }

                // Copy identity out now, so the organizer's list shows people.
                if (!string.IsNullOrWhiteSpace(value))
                {
                    if (field.IdentityRole == "name" && registration.ParticipantName is null)
                    {
                        registration.ParticipantName = Truncate(value, 200);
                    }
                    else if (field.IdentityRole == "contact" && registration.ParticipantContact is null)
                    {
                        registration.ParticipantContact = Truncate(value, 200);
                    }
                }

                values.Add(new EventRegistrationValue
                {
                    Id = Guid.NewGuid(),
                    RegistrationId = registration.Id,
                    FieldId = field.Id,
                    FieldLabel = field.Label,
                    Value = value
                });
            }

            dbContext.EventRegistrations.Add(registration);
            dbContext.EventRegistrationValues.AddRange(values);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventSubmitResponse(registration.Id, registration.SubmittedUtc));
        });
    }

    // ── Individual link ──────────────────────────────────────────────────────

    private static void MapLinkEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/link/{token}", async (
            string token,
            RecreatioDbContext dbContext,
            CancellationToken ct) => await ReadLinkAsync(dbContext, token, null, ct));

        group.MapGet("/link/{token}/page/{pageSlug}", async (
            string token,
            string pageSlug,
            RecreatioDbContext dbContext,
            CancellationToken ct) => await ReadLinkAsync(dbContext, token, pageSlug, ct));
    }

    private static async Task<IResult> ReadLinkAsync(
        RecreatioDbContext dbContext,
        string token,
        string? pageSlug,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return Results.NotFound();
        }

        var link = await dbContext.EventAccessLinks
            .FirstOrDefaultAsync(x => x.Token == token && x.Status == "active", ct);
        if (link is null)
        {
            return Results.NotFound();
        }

        var site = await dbContext.EventSites.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == link.SiteId, ct);
        if (site is null)
        {
            return Results.NotFound();
        }

        var grantedIds = await dbContext.EventAccessLinkPages.AsNoTracking()
            .Where(x => x.AccessLinkId == link.Id)
            .Select(x => x.PageId)
            .ToListAsync(ct);

        // The public page is always reachable from a link, so the recipient can
        // get back to the shared view without a second address.
        var pages = await dbContext.EventPages.AsNoTracking()
            .Where(x => x.SiteId == site.Id && (x.Kind == "public" || grantedIds.Contains(x.Id)))
            .OrderBy(x => x.Kind == "public" ? 0 : 1)
            .ThenBy(x => x.SortOrder)
            .ToListAsync(ct);

        if (pages.Count == 0)
        {
            return Results.NotFound();
        }

        // Default to the first internal page the link opens; the public page is
        // the fallback when nothing internal has been granted yet.
        var selected = pageSlug is null
            ? pages.FirstOrDefault(x => x.Kind != "public") ?? pages[0]
            : pages.FirstOrDefault(x => x.Slug == pageSlug);

        if (selected is null)
        {
            return Results.NotFound();
        }

        var assignments = await dbContext.EventAccessLinkAssignments.AsNoTracking()
            .Where(x => x.AccessLinkId == link.Id)
            .OrderBy(x => x.SortOrder)
            .Select(x => new EventAssignmentResponse(x.Label, x.Value))
            .ToListAsync(ct);

        var pageResponse = await BuildPageResponseAsync(dbContext, selected, ct);

        // The first open is the verification: this token went to one number and
        // nowhere else, so somebody reading it read it from there.
        link.ContactVerifiedUtc ??= DateTimeOffset.UtcNow;
        link.ViewCount += 1;
        link.LastViewedUtc = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var refs = pages
            .Select(x => new EventPageRef(x.Id, x.Slug, x.MenuLabel, x.Kind))
            .ToList();

        return Results.Ok(new EventLinkViewResponse(
            ToHeader(site),
            link.RecipientName,
            link.PersonalNote,
            assignments,
            refs,
            pageResponse));
    }

    // ── Admin: scope ─────────────────────────────────────────────────────────

    private static void MapAdminScopeEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/admin/status", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var assignment = await dbContext.PortalAdminAssignments.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ScopeKey == EventAdminScope, ct);

            string? adminDisplayName = null;
            var hasAdmin = false;
            var isCurrentUserAdmin = false;

            if (assignment is not null)
            {
                var account = await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == assignment.UserId)
                    .Select(x => new { x.LoginId, x.DisplayName })
                    .FirstOrDefaultAsync(ct);

                var isSystem = account is not null
                    && string.Equals((account.LoginId ?? string.Empty).Trim(), "system", StringComparison.OrdinalIgnoreCase);

                hasAdmin = account is not null && !isSystem;

                if (hasAdmin)
                {
                    adminDisplayName = account?.DisplayName ?? account?.LoginId;
                    if (EndpointHelpers.TryGetUserId(context, out var maybeUserId))
                    {
                        isCurrentUserAdmin = assignment.UserId == maybeUserId;
                    }
                }
            }

            return Results.Ok(new EventAdminStatusResponse(hasAdmin, isCurrentUserAdmin, adminDisplayName));
        });

        group.MapPost("/admin/claim", async (
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
                .FirstOrDefaultAsync(x => x.ScopeKey == EventAdminScope, ct);

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
                ScopeKey = EventAdminScope,
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
                "EventAdminClaimed",
                userId.ToString(),
                JsonSerializer.Serialize(new { scope = EventAdminScope, userId, createdUtc = now }),
                ct);

            return Results.Ok(new { claimed = true });
        }).RequireAuthorization();
    }

    // ── Admin: sites ─────────────────────────────────────────────────────────

    private static void MapAdminSiteEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/admin/sites", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var sites = await dbContext.EventSites.AsNoTracking()
                .OrderByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);

            var siteIds = sites.Select(x => x.Id).ToList();

            var pages = await dbContext.EventPages.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId))
                .Select(x => new { x.Id, x.SiteId })
                .ToListAsync(ct);

            var pageIds = pages.Select(x => x.Id).ToList();
            var partCounts = await dbContext.EventParts.AsNoTracking()
                .Where(x => pageIds.Contains(x.PageId))
                .GroupBy(x => x.PageId)
                .Select(g => new { PageId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var partsByPage = partCounts.ToDictionary(x => x.PageId, x => x.Count);
            var pageCountBySite = pages.GroupBy(x => x.SiteId).ToDictionary(g => g.Key, g => g.Count());
            var partCountBySite = pages
                .GroupBy(x => x.SiteId)
                .ToDictionary(g => g.Key, g => g.Sum(p => partsByPage.GetValueOrDefault(p.Id)));

            var linkCounts = await dbContext.EventAccessLinks.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId))
                .GroupBy(x => x.SiteId)
                .Select(g => new { SiteId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            // Hidden registrations are set aside, so they do not count.
            var registrationCounts = await dbContext.EventRegistrations.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId) && !x.IsHidden)
                .GroupBy(x => x.SiteId)
                .Select(g => new { SiteId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var linkMap = linkCounts.ToDictionary(x => x.SiteId, x => x.Count);
            var registrationMap = registrationCounts.ToDictionary(x => x.SiteId, x => x.Count);

            var rows = sites.Select(x => new EventAdminSiteSummary(
                x.Id,
                x.Slug,
                x.Title,
                x.Category,
                x.StartDate,
                x.IsPublished,
                pageCountBySite.GetValueOrDefault(x.Id),
                partCountBySite.GetValueOrDefault(x.Id),
                linkMap.GetValueOrDefault(x.Id),
                registrationMap.GetValueOrDefault(x.Id),
                x.UpdatedUtc)).ToList();

            return Results.Ok(rows);
        }).RequireAuthorization();

        group.MapGet("/admin/sites/{siteId:guid}", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var site = await dbContext.EventSites.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == siteId, ct);
            if (site is null) return Results.NotFound();

            var pages = await dbContext.EventPages.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderBy(x => x.Kind == "public" ? 0 : 1)
                .ThenBy(x => x.SortOrder)
                .ToListAsync(ct);

            var pageIds = pages.Select(x => x.Id).ToList();

            var parts = pageIds.Count == 0
                ? []
                : await dbContext.EventParts.AsNoTracking()
                    .Where(x => pageIds.Contains(x.PageId))
                    .OrderBy(x => x.SortOrder)
                    .ToListAsync(ct);

            var partIds = parts.Where(x => x.Kind == "form").Select(x => x.Id).ToList();
            var fields = partIds.Count == 0
                ? []
                : await dbContext.EventPartFields.AsNoTracking()
                    .Where(x => partIds.Contains(x.PartId))
                    .OrderBy(x => x.SortOrder)
                    .ToListAsync(ct);

            var fieldsByPart = fields
                .GroupBy(x => x.PartId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<EventPartFieldResponse>)g.Select(ToFieldResponse).ToList());

            var partsByPage = parts
                .GroupBy(x => x.PageId)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<EventAdminPartResponse>)g.Select(p => new EventAdminPartResponse(
                        p.Id, p.SortOrder, p.Kind, p.MenuLabel, p.Title, p.Intro,
                        p.ConfigJson, p.LayersJson, p.IsVisible,
                        fieldsByPart.GetValueOrDefault(p.Id) ?? [])).ToList());

            var pageResponses = pages.Select(x => new EventAdminPageResponse(
                x.Id, x.SortOrder, x.Kind, x.Slug, x.Title, x.MenuLabel, x.Description,
                partsByPage.GetValueOrDefault(x.Id) ?? [])).ToList();

            return Results.Ok(new EventAdminSiteResponse(
                ToHeader(site), ToCatalogueEntry(site), site.IsPublished, site.SmsTemplate, pageResponses));
        }).RequireAuthorization();

        group.MapPost("/admin/sites", async (
            EventSiteUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var slug = NormalizeSlug(request.Slug);
            var title = NormalizeShort(request.Title, 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "Podaj adres (slug) i tytuł wydarzenia." });
            }
            if (await dbContext.EventSites.AnyAsync(x => x.Slug == slug, ct))
            {
                return Results.Conflict(new { error = "Wydarzenie o tym adresie już istnieje." });
            }

            var now = DateTimeOffset.UtcNow;
            var site = new EventSite
            {
                Id = Guid.NewGuid(),
                Slug = slug,
                Title = title,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            ApplyCatalogue(site, request);

            // Every site starts with its public page — the organizer builds that
            // first, then adds internal pages beside it.
            var publicPage = new EventPage
            {
                Id = Guid.NewGuid(),
                SiteId = site.Id,
                SortOrder = 0,
                Kind = "public",
                Slug = "start",
                Title = title,
                MenuLabel = "Strona publiczna",
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.EventSites.Add(site);
            dbContext.EventPages.Add(publicPage);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { id = site.Id, slug = site.Slug, publicPageId = publicPage.Id });
        }).RequireAuthorization();

        group.MapPut("/admin/sites/{siteId:guid}", async (
            Guid siteId,
            EventSiteUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var site = await dbContext.EventSites.FirstOrDefaultAsync(x => x.Id == siteId, ct);
            if (site is null) return Results.NotFound();

            var slug = NormalizeSlug(request.Slug);
            var title = NormalizeShort(request.Title, 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "Podaj adres (slug) i tytuł wydarzenia." });
            }
            if (slug != site.Slug && await dbContext.EventSites.AnyAsync(x => x.Slug == slug, ct))
            {
                return Results.Conflict(new { error = "Wydarzenie o tym adresie już istnieje." });
            }

            site.Slug = slug;
            site.Title = title;
            ApplyCatalogue(site, request);
            site.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = site.Id, slug = site.Slug });
        }).RequireAuthorization();

        group.MapDelete("/admin/sites/{siteId:guid}", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var site = await dbContext.EventSites.FirstOrDefaultAsync(x => x.Id == siteId, ct);
            if (site is null) return Results.NotFound();

            var pageIds = await dbContext.EventPages
                .Where(x => x.SiteId == siteId).Select(x => x.Id).ToListAsync(ct);
            var partIds = await dbContext.EventParts
                .Where(x => pageIds.Contains(x.PageId)).Select(x => x.Id).ToListAsync(ct);
            var registrationIds = await dbContext.EventRegistrations
                .Where(x => x.SiteId == siteId).Select(x => x.Id).ToListAsync(ct);
            var linkIds = await dbContext.EventAccessLinks
                .Where(x => x.SiteId == siteId).Select(x => x.Id).ToListAsync(ct);

            // Depth-first, so no FK is left dangling mid-delete. Cards point at
            // the site, its parts, its links and its registrations, so they go
            // before any of them.
            var siteTopicIds = await dbContext.EventTopics
                .Where(x => x.SiteId == siteId).Select(x => x.Id).ToListAsync(ct);
            dbContext.EventTopicMessages.RemoveRange(
                dbContext.EventTopicMessages.Where(x => siteTopicIds.Contains(x.TopicId)));
            dbContext.EventTopics.RemoveRange(dbContext.EventTopics.Where(x => x.SiteId == siteId));
            dbContext.EventParticipantCards.RemoveRange(
                dbContext.EventParticipantCards.Where(x => x.SiteId == siteId));
            dbContext.EventRegistrationValues.RemoveRange(
                dbContext.EventRegistrationValues.Where(x => registrationIds.Contains(x.RegistrationId)));
            dbContext.EventRegistrations.RemoveRange(
                dbContext.EventRegistrations.Where(x => x.SiteId == siteId));
            dbContext.EventAccessLinkAssignments.RemoveRange(
                dbContext.EventAccessLinkAssignments.Where(x => linkIds.Contains(x.AccessLinkId)));
            dbContext.EventAccessLinkPages.RemoveRange(
                dbContext.EventAccessLinkPages.Where(x => linkIds.Contains(x.AccessLinkId)));
            dbContext.EventAccessLinks.RemoveRange(
                dbContext.EventAccessLinks.Where(x => x.SiteId == siteId));
            dbContext.EventPartFields.RemoveRange(
                dbContext.EventPartFields.Where(x => partIds.Contains(x.PartId)));
            dbContext.EventParts.RemoveRange(
                dbContext.EventParts.Where(x => pageIds.Contains(x.PageId)));
            dbContext.EventPages.RemoveRange(
                dbContext.EventPages.Where(x => x.SiteId == siteId));
            dbContext.EventSites.Remove(site);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();
    }

    // ── Admin: pages ─────────────────────────────────────────────────────────

    private static void MapAdminPageEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/admin/sites/{siteId:guid}/pages", async (
            Guid siteId,
            EventPageUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();
            if (!await dbContext.EventSites.AnyAsync(x => x.Id == siteId, ct)) return Results.NotFound();

            var slug = NormalizeSlug(request.Slug);
            var title = NormalizeShort(request.Title, 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "Podaj adres i tytuł strony." });
            }
            if (await dbContext.EventPages.AnyAsync(x => x.SiteId == siteId && x.Slug == slug, ct))
            {
                return Results.Conflict(new { error = "Strona o tym adresie już istnieje w tym wydarzeniu." });
            }

            var nextOrder = await dbContext.EventPages
                .Where(x => x.SiteId == siteId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(ct) ?? -1;

            var now = DateTimeOffset.UtcNow;
            var page = new EventPage
            {
                Id = Guid.NewGuid(),
                SiteId = siteId,
                SortOrder = nextOrder + 1,
                Kind = "internal",
                Slug = slug,
                Title = title,
                MenuLabel = NormalizeShort(request.MenuLabel, 60) ?? title,
                Description = NormalizeShort(request.Description, 600),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.EventPages.Add(page);
            await TouchSiteAsync(dbContext, siteId, ct);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { id = page.Id, slug = page.Slug });
        }).RequireAuthorization();

        group.MapPut("/admin/pages/{pageId:guid}", async (
            Guid pageId,
            EventPageUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var page = await dbContext.EventPages.FirstOrDefaultAsync(x => x.Id == pageId, ct);
            if (page is null) return Results.NotFound();

            var slug = NormalizeSlug(request.Slug);
            var title = NormalizeShort(request.Title, 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "Podaj adres i tytuł strony." });
            }
            if (slug != page.Slug
                && await dbContext.EventPages.AnyAsync(x => x.SiteId == page.SiteId && x.Slug == slug, ct))
            {
                return Results.Conflict(new { error = "Strona o tym adresie już istnieje w tym wydarzeniu." });
            }

            page.Slug = slug;
            page.Title = title;
            page.MenuLabel = NormalizeShort(request.MenuLabel, 60) ?? title;
            page.Description = NormalizeShort(request.Description, 600);
            page.UpdatedUtc = DateTimeOffset.UtcNow;

            await TouchSiteAsync(dbContext, page.SiteId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = page.Id });
        }).RequireAuthorization();

        group.MapDelete("/admin/pages/{pageId:guid}", async (
            Guid pageId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var page = await dbContext.EventPages.FirstOrDefaultAsync(x => x.Id == pageId, ct);
            if (page is null) return Results.NotFound();
            if (page.Kind == "public")
            {
                return Results.BadRequest(new { error = "Strony publicznej nie można usunąć." });
            }

            var partIds = await dbContext.EventParts
                .Where(x => x.PageId == pageId).Select(x => x.Id).ToListAsync(ct);
            var registrationIds = await dbContext.EventRegistrations
                .Where(x => partIds.Contains(x.PartId)).Select(x => x.Id).ToListAsync(ct);

            var pageTopicIds = await dbContext.EventTopics
                .Where(x => partIds.Contains(x.PartId)).Select(x => x.Id).ToListAsync(ct);
            dbContext.EventTopicMessages.RemoveRange(
                dbContext.EventTopicMessages.Where(x => pageTopicIds.Contains(x.TopicId)));
            dbContext.EventTopics.RemoveRange(dbContext.EventTopics.Where(x => partIds.Contains(x.PartId)));
            dbContext.EventParticipantCards.RemoveRange(
                dbContext.EventParticipantCards.Where(x => partIds.Contains(x.PartId)));
            dbContext.EventRegistrationValues.RemoveRange(
                dbContext.EventRegistrationValues.Where(x => registrationIds.Contains(x.RegistrationId)));
            dbContext.EventRegistrations.RemoveRange(
                dbContext.EventRegistrations.Where(x => partIds.Contains(x.PartId)));
            dbContext.EventAccessLinkPages.RemoveRange(
                dbContext.EventAccessLinkPages.Where(x => x.PageId == pageId));
            dbContext.EventPartFields.RemoveRange(
                dbContext.EventPartFields.Where(x => partIds.Contains(x.PartId)));
            dbContext.EventParts.RemoveRange(
                dbContext.EventParts.Where(x => x.PageId == pageId));
            dbContext.EventPages.Remove(page);

            await TouchSiteAsync(dbContext, page.SiteId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();

        group.MapPost("/admin/sites/{siteId:guid}/pages/reorder", async (
            Guid siteId,
            EventReorderRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var pages = await dbContext.EventPages.Where(x => x.SiteId == siteId).ToListAsync(ct);
            ApplyOrder(pages, request.OrderedIds, x => x.Id, (x, order) => x.SortOrder = order, x => x.SortOrder);

            await TouchSiteAsync(dbContext, siteId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { reordered = true });
        }).RequireAuthorization();
    }

    // ── Admin: parts ─────────────────────────────────────────────────────────

    private static void MapAdminPartEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/admin/pages/{pageId:guid}/parts", async (
            Guid pageId,
            EventPartUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var page = await dbContext.EventPages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == pageId, ct);
            if (page is null) return Results.NotFound();

            var kind = (request.Kind ?? string.Empty).Trim().ToLowerInvariant();
            if (!AllowedPartKinds.Contains(kind))
            {
                return Results.BadRequest(new { error = $"Nieznany typ części: {kind}." });
            }

            var nextOrder = await dbContext.EventParts
                .Where(x => x.PageId == pageId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(ct) ?? -1;

            var now = DateTimeOffset.UtcNow;
            var part = new EventPart
            {
                Id = Guid.NewGuid(),
                PageId = pageId,
                SortOrder = nextOrder + 1,
                Kind = kind,
                MenuLabel = NormalizeShort(request.MenuLabel, 60) ?? kind,
                Title = NormalizeShort(request.Title, 200),
                Intro = NormalizeShort(request.Intro, 600),
                ConfigJson = NormalizeJson(request.ConfigJson),
                LayersJson = NormalizeJson(request.LayersJson),
                IsVisible = request.IsVisible,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.EventParts.Add(part);
            await TouchSiteAsync(dbContext, page.SiteId, ct);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { id = part.Id, sortOrder = part.SortOrder });
        }).RequireAuthorization();

        group.MapPut("/admin/parts/{partId:guid}", async (
            Guid partId,
            EventPartUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var part = await dbContext.EventParts.FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null) return Results.NotFound();

            var kind = (request.Kind ?? string.Empty).Trim().ToLowerInvariant();
            if (!AllowedPartKinds.Contains(kind))
            {
                return Results.BadRequest(new { error = $"Nieznany typ części: {kind}." });
            }

            part.Kind = kind;
            part.MenuLabel = NormalizeShort(request.MenuLabel, 60) ?? kind;
            part.Title = NormalizeShort(request.Title, 200);
            part.Intro = NormalizeShort(request.Intro, 600);
            part.ConfigJson = NormalizeJson(request.ConfigJson);
            part.LayersJson = NormalizeJson(request.LayersJson);
            part.IsVisible = request.IsVisible;
            part.UpdatedUtc = DateTimeOffset.UtcNow;

            await TouchSiteByPageAsync(dbContext, part.PageId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = part.Id });
        }).RequireAuthorization();

        group.MapDelete("/admin/parts/{partId:guid}", async (
            Guid partId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var part = await dbContext.EventParts.FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null) return Results.NotFound();

            var registrationIds = await dbContext.EventRegistrations
                .Where(x => x.PartId == partId).Select(x => x.Id).ToListAsync(ct);

            // Cards and topics were filled in on this part, so they go with it.
            var partTopicIds = await dbContext.EventTopics
                .Where(x => x.PartId == partId).Select(x => x.Id).ToListAsync(ct);
            dbContext.EventTopicMessages.RemoveRange(
                dbContext.EventTopicMessages.Where(x => partTopicIds.Contains(x.TopicId)));
            dbContext.EventTopics.RemoveRange(dbContext.EventTopics.Where(x => x.PartId == partId));
            dbContext.EventParticipantCards.RemoveRange(
                dbContext.EventParticipantCards.Where(x => x.PartId == partId));
            dbContext.EventRegistrationValues.RemoveRange(
                dbContext.EventRegistrationValues.Where(x => registrationIds.Contains(x.RegistrationId)));
            dbContext.EventRegistrations.RemoveRange(
                dbContext.EventRegistrations.Where(x => x.PartId == partId));
            dbContext.EventPartFields.RemoveRange(
                dbContext.EventPartFields.Where(x => x.PartId == partId));
            dbContext.EventParts.Remove(part);

            await TouchSiteByPageAsync(dbContext, part.PageId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();

        group.MapPost("/admin/pages/{pageId:guid}/parts/reorder", async (
            Guid pageId,
            EventReorderRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var parts = await dbContext.EventParts.Where(x => x.PageId == pageId).ToListAsync(ct);
            ApplyOrder(parts, request.OrderedIds, x => x.Id, (x, order) => x.SortOrder = order, x => x.SortOrder);

            await TouchSiteByPageAsync(dbContext, pageId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { reordered = true });
        }).RequireAuthorization();
    }

    // ── Admin: form fields ───────────────────────────────────────────────────

    private static void MapAdminFieldEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/admin/parts/{partId:guid}/fields", async (
            Guid partId,
            EventFieldUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var part = await dbContext.EventParts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null) return Results.NotFound();
            if (part.Kind != "form")
            {
                return Results.BadRequest(new { error = "Pola można dodawać tylko do części typu formularz." });
            }

            var validation = ValidateField(request);
            if (validation is not null) return Results.BadRequest(new { error = validation });

            var nextOrder = await dbContext.EventPartFields
                .Where(x => x.PartId == partId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(ct) ?? -1;

            var identityRole = NormalizeIdentityRole(request.IdentityRole);
            if (identityRole != "none")
            {
                await ClearIdentityRoleAsync(dbContext, partId, identityRole, ct);
            }

            var options = NormalizeOptions(request.Options);
            var field = new EventPartField
            {
                Id = Guid.NewGuid(),
                PartId = partId,
                SortOrder = nextOrder + 1,
                Kind = (request.Kind ?? string.Empty).Trim().ToLowerInvariant(),
                Label = NormalizeShort(request.Label, 300)!,
                HelpText = NormalizeShort(request.HelpText, 400),
                OptionsJson = options.Count > 0 ? JsonSerializer.Serialize(options) : null,
                IsRequired = request.IsRequired,
                IsHalfWidth = request.IsHalfWidth,
                IdentityRole = identityRole
            };

            dbContext.EventPartFields.Add(field);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = field.Id, sortOrder = field.SortOrder });
        }).RequireAuthorization();

        group.MapPut("/admin/fields/{fieldId:guid}", async (
            Guid fieldId,
            EventFieldUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var field = await dbContext.EventPartFields.FirstOrDefaultAsync(x => x.Id == fieldId, ct);
            if (field is null) return Results.NotFound();

            var validation = ValidateField(request);
            if (validation is not null) return Results.BadRequest(new { error = validation });

            var identityRole = NormalizeIdentityRole(request.IdentityRole);
            if (identityRole != "none" && identityRole != field.IdentityRole)
            {
                await ClearIdentityRoleAsync(dbContext, field.PartId, identityRole, ct);
            }

            var options = NormalizeOptions(request.Options);
            field.Kind = (request.Kind ?? string.Empty).Trim().ToLowerInvariant();
            field.Label = NormalizeShort(request.Label, 300)!;
            field.HelpText = NormalizeShort(request.HelpText, 400);
            field.OptionsJson = options.Count > 0 ? JsonSerializer.Serialize(options) : null;
            field.IsRequired = request.IsRequired;
            field.IsHalfWidth = request.IsHalfWidth;
            field.IdentityRole = identityRole;

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = field.Id });
        }).RequireAuthorization();

        group.MapDelete("/admin/fields/{fieldId:guid}", async (
            Guid fieldId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var field = await dbContext.EventPartFields.FirstOrDefaultAsync(x => x.Id == fieldId, ct);
            if (field is null) return Results.NotFound();

            dbContext.EventRegistrationValues.RemoveRange(
                dbContext.EventRegistrationValues.Where(x => x.FieldId == fieldId));
            dbContext.EventPartFields.Remove(field);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();

        group.MapPost("/admin/parts/{partId:guid}/fields/reorder", async (
            Guid partId,
            EventReorderRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var fields = await dbContext.EventPartFields.Where(x => x.PartId == partId).ToListAsync(ct);
            ApplyOrder(fields, request.OrderedIds, x => x.Id, (x, order) => x.SortOrder = order, x => x.SortOrder);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { reordered = true });
        }).RequireAuthorization();
    }

    // ── Admin: registrations and access links ────────────────────────────────

    private static void MapAdminAccessEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/admin/sites/{siteId:guid}/registrations", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var registrations = await dbContext.EventRegistrations.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderByDescending(x => x.SubmittedUtc)
                .ToListAsync(ct);

            if (registrations.Count == 0)
            {
                return Results.Ok(new List<EventAdminRegistrationRow>());
            }

            var registrationIds = registrations.Select(x => x.Id).ToList();

            var values = await dbContext.EventRegistrationValues.AsNoTracking()
                .Where(x => registrationIds.Contains(x.RegistrationId))
                .ToListAsync(ct);

            var pages = await dbContext.EventPages.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .Select(x => new { x.Id, x.MenuLabel })
                .ToListAsync(ct);
            var pageLabels = pages.ToDictionary(x => x.Id, x => x.MenuLabel);

            var pageIds = pages.Select(x => x.Id).ToList();
            var parts = await dbContext.EventParts.AsNoTracking()
                .Where(x => pageIds.Contains(x.PageId))
                .Select(x => new { x.Id, x.MenuLabel, x.PageId })
                .ToListAsync(ct);
            var partInfo = parts.ToDictionary(x => x.Id, x => x);

            // Which registrations already have a link granted from them.
            var links = await dbContext.EventAccessLinks.AsNoTracking()
                .Where(x => x.SiteId == siteId && x.RegistrationId != null)
                .Select(x => new { x.Id, x.Token, x.RegistrationId })
                .ToListAsync(ct);
            var linkByRegistration = links
                .Where(x => x.RegistrationId.HasValue)
                .GroupBy(x => x.RegistrationId!.Value)
                .ToDictionary(g => g.Key, g => g.First());

            var valuesByRegistration = values
                .GroupBy(x => x.RegistrationId)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<EventAdminRegistrationValue>)g
                        .Select(v => new EventAdminRegistrationValue(v.FieldLabel, v.Value)).ToList());

            var rows = registrations.Select(x =>
            {
                partInfo.TryGetValue(x.PartId, out var part);
                linkByRegistration.TryGetValue(x.Id, out var link);
                return new EventAdminRegistrationRow(
                    x.Id,
                    x.PartId,
                    part?.MenuLabel ?? "—",
                    part is not null ? pageLabels.GetValueOrDefault(part.PageId) ?? "—" : "—",
                    x.ParticipantName,
                    x.ParticipantContact,
                    x.SubmittedUtc,
                    x.IsHidden,
                    link?.Id,
                    link?.Token,
                    valuesByRegistration.GetValueOrDefault(x.Id) ?? []);
            }).ToList();

            return Results.Ok(rows);
        }).RequireAuthorization();

        // Hiding is the reversible option: the person stays on file with their
        // answers, but drops out of the counts and out of the working list.
        group.MapPost("/admin/registrations/{registrationId:guid}/hidden", async (
            Guid registrationId,
            EventHiddenRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var registration = await dbContext.EventRegistrations
                .FirstOrDefaultAsync(x => x.Id == registrationId, ct);
            if (registration is null) return Results.NotFound();

            registration.IsHidden = request.Hidden;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { hidden = registration.IsHidden });
        }).RequireAuthorization();

        // Deleting is permanent: the answers go with it.
        group.MapDelete("/admin/registrations/{registrationId:guid}", async (
            Guid registrationId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var registration = await dbContext.EventRegistrations
                .FirstOrDefaultAsync(x => x.Id == registrationId, ct);
            if (registration is null) return Results.NotFound();

            // An access link granted from this registration outlives it; only
            // the back-pointer goes, so the person does not lose their access
            // by surprise. Revoke or delete the link separately to do that.
            var granted = await dbContext.EventAccessLinks
                .Where(x => x.RegistrationId == registrationId)
                .ToListAsync(ct);
            foreach (var link in granted)
            {
                link.RegistrationId = null;
            }

            // Same for a participant card: it belongs to the link, not to the
            // submission, and stays signed and correctable.
            var cards = await dbContext.EventParticipantCards
                .Where(x => x.RegistrationId == registrationId)
                .ToListAsync(ct);
            foreach (var card in cards)
            {
                card.RegistrationId = null;
            }

            dbContext.EventRegistrationValues.RemoveRange(
                dbContext.EventRegistrationValues.Where(x => x.RegistrationId == registrationId));
            dbContext.EventRegistrations.Remove(registration);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();

        group.MapGet("/admin/sites/{siteId:guid}/links", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var links = await dbContext.EventAccessLinks.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var linkIds = links.Select(x => x.Id).ToList();

            var grants = linkIds.Count == 0
                ? []
                : await dbContext.EventAccessLinkPages.AsNoTracking()
                    .Where(x => linkIds.Contains(x.AccessLinkId))
                    .ToListAsync(ct);

            var assignments = linkIds.Count == 0
                ? []
                : await dbContext.EventAccessLinkAssignments.AsNoTracking()
                    .Where(x => linkIds.Contains(x.AccessLinkId))
                    .OrderBy(x => x.SortOrder)
                    .ToListAsync(ct);

            var grantsByLink = grants
                .GroupBy(x => x.AccessLinkId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Select(x => x.PageId).ToList());

            var assignmentsByLink = assignments
                .GroupBy(x => x.AccessLinkId)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<EventAssignmentResponse>)g
                        .Select(a => new EventAssignmentResponse(a.Label, a.Value)).ToList());

            var rows = links.Select(x => new EventAdminAccessLinkRow(
                x.Id, x.Token, x.RecipientName, x.RecipientContact, x.Status,
                x.PersonalNote, x.InternalNote, x.RegistrationId,
                x.ViewCount, x.LastViewedUtc, x.ContactVerifiedUtc, x.CreatedUtc,
                grantsByLink.GetValueOrDefault(x.Id) ?? [],
                assignmentsByLink.GetValueOrDefault(x.Id) ?? [])).ToList();

            return Results.Ok(rows);
        }).RequireAuthorization();

        group.MapPost("/admin/sites/{siteId:guid}/links", async (
            Guid siteId,
            EventAccessLinkUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();
            if (!await dbContext.EventSites.AnyAsync(x => x.Id == siteId, ct)) return Results.NotFound();

            var name = NormalizeShort(request.RecipientName, 200);
            if (name is null)
            {
                return Results.BadRequest(new { error = "Podaj imię i nazwisko odbiorcy linku." });
            }

            var now = DateTimeOffset.UtcNow;
            var link = new EventAccessLink
            {
                Id = Guid.NewGuid(),
                SiteId = siteId,
                Token = GenerateToken(),
                RecipientName = name,
                RecipientContact = NormalizeShort(request.RecipientContact, 200),
                RegistrationId = request.RegistrationId,
                Status = "active",
                PersonalNote = NormalizeShort(request.PersonalNote, 1000),
                InternalNote = NormalizeShort(request.InternalNote, 1000),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.EventAccessLinks.Add(link);
            dbContext.EventAccessLinkPages.AddRange(
                await BuildGrantsAsync(dbContext, siteId, link.Id, request.PageIds, ct));
            dbContext.EventAccessLinkAssignments.AddRange(
                BuildAssignments(link.Id, request.Assignments));

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = link.Id, token = link.Token });
        }).RequireAuthorization();

        group.MapPut("/admin/links/{linkId:guid}", async (
            Guid linkId,
            EventAccessLinkUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var link = await dbContext.EventAccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
            if (link is null) return Results.NotFound();

            var name = NormalizeShort(request.RecipientName, 200);
            if (name is null)
            {
                return Results.BadRequest(new { error = "Podaj imię i nazwisko odbiorcy linku." });
            }

            link.RecipientName = name;
            link.RecipientContact = NormalizeShort(request.RecipientContact, 200);
            link.PersonalNote = NormalizeShort(request.PersonalNote, 1000);
            link.InternalNote = NormalizeShort(request.InternalNote, 1000);
            link.UpdatedUtc = DateTimeOffset.UtcNow;

            dbContext.EventAccessLinkPages.RemoveRange(
                dbContext.EventAccessLinkPages.Where(x => x.AccessLinkId == linkId));
            dbContext.EventAccessLinkPages.AddRange(
                await BuildGrantsAsync(dbContext, link.SiteId, linkId, request.PageIds, ct));

            dbContext.EventAccessLinkAssignments.RemoveRange(
                dbContext.EventAccessLinkAssignments.Where(x => x.AccessLinkId == linkId));
            dbContext.EventAccessLinkAssignments.AddRange(
                BuildAssignments(linkId, request.Assignments));

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = link.Id, token = link.Token });
        }).RequireAuthorization();

        group.MapPost("/admin/links/{linkId:guid}/status", async (
            Guid linkId,
            EventStatusRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var status = (request.Status ?? string.Empty).Trim().ToLowerInvariant();
            if (status != "active" && status != "revoked")
            {
                return Results.BadRequest(new { error = "Dozwolone statusy: active, revoked." });
            }

            var link = await dbContext.EventAccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
            if (link is null) return Results.NotFound();

            link.Status = status;
            link.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { status = link.Status });
        }).RequireAuthorization();

        group.MapPost("/admin/links/{linkId:guid}/rotate", async (
            Guid linkId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var link = await dbContext.EventAccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
            if (link is null) return Results.NotFound();

            link.Token = GenerateToken();
            link.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { token = link.Token });
        }).RequireAuthorization();

        group.MapDelete("/admin/links/{linkId:guid}", async (
            Guid linkId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var link = await dbContext.EventAccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
            if (link is null) return Results.NotFound();

            // Registrations made through this link survive it, minus the pointer.
            var linked = await dbContext.EventRegistrations
                .Where(x => x.AccessLinkId == linkId).ToListAsync(ct);
            foreach (var registration in linked)
            {
                registration.AccessLinkId = null;
            }

            // Topics and their messages go too: every one of them is signed with
            // this link.s name, and a thread nobody can answer is dead weight.
            var linkTopicIds = await dbContext.EventTopics
                .Where(x => x.AccessLinkId == linkId).Select(x => x.Id).ToListAsync(ct);
            dbContext.EventTopicMessages.RemoveRange(
                dbContext.EventTopicMessages.Where(x => x.AccessLinkId == linkId || linkTopicIds.Contains(x.TopicId)));
            dbContext.EventTopics.RemoveRange(
                dbContext.EventTopics.Where(x => x.AccessLinkId == linkId));

            // The participant card does not: it is this link.s document, and a
            // card nobody can open, correct or withdraw is worse to keep than to
            // delete. Revoking the link is the option that keeps it.
            dbContext.EventParticipantCards.RemoveRange(
                dbContext.EventParticipantCards.Where(x => x.AccessLinkId == linkId));
            dbContext.EventAccessLinkAssignments.RemoveRange(
                dbContext.EventAccessLinkAssignments.Where(x => x.AccessLinkId == linkId));
            dbContext.EventAccessLinkPages.RemoveRange(
                dbContext.EventAccessLinkPages.Where(x => x.AccessLinkId == linkId));
            dbContext.EventAccessLinks.Remove(link);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();
    }

    // ── Shared helpers ───────────────────────────────────────────────────────

    private static async Task<EventSite?> FindPublishedSiteAsync(
        RecreatioDbContext dbContext,
        string slug,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;
        var normalized = slug.Trim().ToLowerInvariant();
        var site = await dbContext.EventSites.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Slug == normalized, ct);
        return site is not null && site.IsPublished ? site : null;
    }

    private static async Task<EventPageResponse> BuildPageResponseAsync(
        RecreatioDbContext dbContext,
        EventPage page,
        CancellationToken ct)
    {
        var parts = await dbContext.EventParts.AsNoTracking()
            .Where(x => x.PageId == page.Id && x.IsVisible)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var formPartIds = parts.Where(x => x.Kind == "form").Select(x => x.Id).ToList();
        var fields = formPartIds.Count == 0
            ? []
            : await dbContext.EventPartFields.AsNoTracking()
                .Where(x => formPartIds.Contains(x.PartId))
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

        var fieldsByPart = fields
            .GroupBy(x => x.PartId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<EventPartFieldResponse>)g.Select(ToFieldResponse).ToList());

        var partResponses = parts.Select(x => new EventPartResponse(
            x.Id, x.SortOrder, x.Kind, x.MenuLabel, x.Title, x.Intro,
            x.ConfigJson, x.LayersJson,
            fieldsByPart.GetValueOrDefault(x.Id) ?? [])).ToList();

        return new EventPageResponse(
            page.Id, page.SortOrder, page.Kind, page.Slug, page.Title, page.MenuLabel,
            page.Description, partResponses);
    }

    private static EventPartFieldResponse ToFieldResponse(EventPartField field) =>
        new(field.Id, field.SortOrder, field.Kind, field.Label, field.HelpText,
            DeserializeOptions(field.OptionsJson), field.IsRequired, field.IsHalfWidth, field.IdentityRole);

    private static EventSiteHeader ToHeader(EventSite site) =>
        new(site.Id, site.Slug, site.Title, site.Subtitle, site.DateLabel,
            DeserializeOptions(site.PlacesJson), site.ThemeJson);

    private static EventCatalogueEntry ToCatalogueEntry(EventSite site) =>
        new(site.Id, site.Slug, site.Title, site.Summary, site.Category, site.Audience,
            DeserializeOptions(site.PlacesJson), site.ThumbnailUrl,
            site.StartDate, site.EndDate, site.DateLabel);

    /// <summary>Copies the catalogue block off an upsert onto the entity.</summary>
    private static void ApplyCatalogue(EventSite site, EventSiteUpsertRequest request)
    {
        var places = NormalizeOptions(request.Places);

        site.Subtitle = NormalizeShort(request.Subtitle, 300);
        site.Summary = NormalizeShort(request.Summary, 400);
        site.Category = NormalizeShort(request.Category, 80);
        site.Audience = NormalizeShort(request.Audience, 160);
        site.PlacesJson = places.Count > 0 ? JsonSerializer.Serialize(places) : null;
        site.ThumbnailUrl = NormalizeShort(request.ThumbnailUrl, 600);
        site.StartDate = request.StartDate;
        // An end date before the start is a typo, not a range — drop it rather
        // than let it produce negative-length events in the overview.
        site.EndDate = request.EndDate is not null && request.StartDate is not null
            && request.EndDate < request.StartDate
                ? request.StartDate
                : request.EndDate;
        site.DateLabel = NormalizeShort(request.DateLabel, 120);
        site.ThemeJson = NormalizeJson(request.ThemeJson);
        site.SmsTemplate = NormalizeShort(request.SmsTemplate, 600);
        site.IsPublished = request.IsPublished;
    }

    private static async Task<bool> IsAdminAsync(
        HttpContext context,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId)) return false;
        var assignment = await dbContext.PortalAdminAssignments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScopeKey == EventAdminScope, ct);
        return assignment is not null && assignment.UserId == userId;
    }

    private static async Task TouchSiteAsync(RecreatioDbContext dbContext, Guid siteId, CancellationToken ct)
    {
        var site = await dbContext.EventSites.FirstOrDefaultAsync(x => x.Id == siteId, ct);
        if (site is not null) site.UpdatedUtc = DateTimeOffset.UtcNow;
    }

    private static async Task TouchSiteByPageAsync(RecreatioDbContext dbContext, Guid pageId, CancellationToken ct)
    {
        var siteId = await dbContext.EventPages.AsNoTracking()
            .Where(x => x.Id == pageId)
            .Select(x => (Guid?)x.SiteId)
            .FirstOrDefaultAsync(ct);
        if (siteId.HasValue) await TouchSiteAsync(dbContext, siteId.Value, ct);
    }

    /// <summary>
    /// Applies a client-supplied order, then parks anything it did not mention
    /// at the end in its previous relative order.
    /// </summary>
    private static void ApplyOrder<T>(
        List<T> items,
        IReadOnlyList<Guid>? orderedIds,
        Func<T, Guid> idOf,
        Action<T, int> setOrder,
        Func<T, int> currentOrder)
    {
        var ids = orderedIds ?? [];
        var byId = items.ToDictionary(idOf);
        var order = 0;

        foreach (var id in ids)
        {
            if (byId.TryGetValue(id, out var item))
            {
                setOrder(item, order++);
            }
        }

        foreach (var item in items.Where(x => !ids.Contains(idOf(x))).OrderBy(currentOrder).ToList())
        {
            setOrder(item, order++);
        }
    }

    /// <summary>Grants are only accepted for internal pages of the same site.</summary>
    private static async Task<List<EventAccessLinkPage>> BuildGrantsAsync(
        RecreatioDbContext dbContext,
        Guid siteId,
        Guid linkId,
        IReadOnlyList<Guid>? pageIds,
        CancellationToken ct)
    {
        var requested = (pageIds ?? []).Distinct().ToList();
        if (requested.Count == 0) return [];

        var valid = await dbContext.EventPages.AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Kind == "internal" && requested.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(ct);

        return valid.Select(pageId => new EventAccessLinkPage
        {
            Id = Guid.NewGuid(),
            AccessLinkId = linkId,
            PageId = pageId
        }).ToList();
    }

    private static IEnumerable<EventAccessLinkAssignment> BuildAssignments(
        Guid linkId,
        IReadOnlyList<EventAssignmentResponse>? source)
    {
        var order = 0;
        foreach (var entry in source ?? [])
        {
            var label = NormalizeShort(entry.Label, 160);
            var value = NormalizeShort(entry.Value, 600);
            if (label is null || value is null) continue;

            yield return new EventAccessLinkAssignment
            {
                Id = Guid.NewGuid(),
                AccessLinkId = linkId,
                SortOrder = order++,
                Label = label,
                Value = value
            };
        }
    }

    /// <summary>Only one field per form may carry a given identity role.</summary>
    private static async Task ClearIdentityRoleAsync(
        RecreatioDbContext dbContext,
        Guid partId,
        string identityRole,
        CancellationToken ct)
    {
        var clashes = await dbContext.EventPartFields
            .Where(x => x.PartId == partId && x.IdentityRole == identityRole)
            .ToListAsync(ct);
        foreach (var clash in clashes)
        {
            clash.IdentityRole = "none";
        }
    }

    private static string? ValidateField(EventFieldUpsertRequest request)
    {
        var kind = (request.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (!AllowedFieldKinds.Contains(kind)) return $"Nieznany typ pola: {kind}.";
        if (NormalizeShort(request.Label, 300) is null) return "Podaj etykietę pola.";
        if ((kind == "select" || kind == "multiselect") && NormalizeOptions(request.Options).Count == 0)
        {
            return "Pole wyboru wymaga co najmniej jednej opcji.";
        }
        return null;
    }

    private static string NormalizeIdentityRole(string? value)
    {
        var role = (value ?? "none").Trim().ToLowerInvariant();
        return AllowedIdentityRoles.Contains(role) ? role : "none";
    }

    private static string? NormalizeFieldValue(EventPartField field, string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();

        if (field.Kind == "multiselect")
        {
            List<string>? parsed = null;
            try
            {
                parsed = JsonSerializer.Deserialize<List<string>>(trimmed);
            }
            catch (JsonException)
            {
                // A non-JSON payload is treated as one choice.
            }

            var picked = (parsed ?? [trimmed])
                .Select(x => x.Trim())
                .Where(x => x.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var allowed = DeserializeOptions(field.OptionsJson);
            if (allowed.Count > 0)
            {
                picked = picked.Where(x => allowed.Contains(x, StringComparer.OrdinalIgnoreCase)).ToList();
            }

            return picked.Count == 0 ? null : Truncate(JsonSerializer.Serialize(picked), 4000);
        }

        if (field.Kind == "select")
        {
            var allowed = DeserializeOptions(field.OptionsJson);
            if (allowed.Count > 0 && !allowed.Contains(trimmed, StringComparer.OrdinalIgnoreCase)) return null;
        }

        if (field.Kind == "checkbox")
        {
            var isTrue = trimmed.Equals("true", StringComparison.OrdinalIgnoreCase)
                || trimmed == "1"
                || trimmed.Equals("tak", StringComparison.OrdinalIgnoreCase);
            return isTrue ? "true" : null;
        }

        return Truncate(trimmed, 4000);
    }

    private static IReadOnlyList<string> DeserializeOptions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static List<string> NormalizeOptions(IReadOnlyList<string>? options) =>
        (options ?? [])
            .Select(x => (x ?? string.Empty).Trim())
            .Where(x => x.Length > 0 && x.Length <= 300)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(80)
            .ToList();

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static string? NormalizeSlug(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var cleaned = new string(value.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) || c == '-' ? c : '-')
            .ToArray())
            .Trim('-');

        while (cleaned.Contains("--", StringComparison.Ordinal))
        {
            cleaned = cleaned.Replace("--", "-", StringComparison.Ordinal);
        }

        if (cleaned.Length == 0) return null;
        // A site addressed /event/admin would shadow the builder itself.
        if (ReservedSlugs.Contains(cleaned)) return null;
        return cleaned.Length > 80 ? cleaned[..80] : cleaned;
    }

    private static string? NormalizeJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        // Store only well-formed JSON so readers never have to defend themselves.
        try
        {
            using var _ = JsonDocument.Parse(value);
            return value.Trim();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? NormalizeShort(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim();
        return normalized.Length > maxLength ? normalized[..maxLength] : normalized;
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length > maxLength ? value[..maxLength] : value;
}
