using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Event2;
using Recreatio.Api.Data.Pilgrimage;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints.Event2;

/// <summary>
/// Composable events. A site holds one public page plus any number of internal
/// pages; an individual access link opens exactly the internal pages it has been
/// granted. There is no permission ladder — a grant row is the whole authority.
/// </summary>
public static partial class Event2Endpoints
{
    private const string Event2AdminScope = "event2";

    private static readonly string[] AllowedPartKinds =
    [
        "title", "shortinfos", "text", "plan", "map",
        "faq", "form", "costs", "contact", "gallery", "files", "people"
    ];

    private static readonly string[] AllowedFieldKinds =
        ["text", "textarea", "select", "multiselect", "checkbox", "number", "date", "email", "phone"];

    private static readonly string[] AllowedIdentityRoles = ["none", "name", "contact"];

    public static void MapEvent2Endpoints(this WebApplication app)
    {
        var group = app.MapGroup("/event2");

        MapPublicEndpoints(group);
        MapLinkEndpoints(group);
        MapAdminScopeEndpoints(group);
        MapAdminSiteEndpoints(group);
        MapAdminPageEndpoints(group);
        MapAdminPartEndpoints(group);
        MapAdminFieldEndpoints(group);
        MapAdminAccessEndpoints(group);
        MapImportEndpoints(group);
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
            var sites = await dbContext.Event2Sites.AsNoTracking()
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

            var page = await dbContext.Event2Pages.AsNoTracking()
                .Where(x => x.SiteId == site.Id && x.Kind == "public")
                .OrderBy(x => x.SortOrder)
                .FirstOrDefaultAsync(ct);

            if (page is null)
            {
                return Results.NotFound();
            }

            var pageResponse = await BuildPageResponseAsync(dbContext, page, ct);
            return Results.Ok(new Event2PublicSiteResponse(ToHeader(site), pageResponse));
        });

        group.MapPost("/site/{slug}/parts/{partId:guid}/submit", async (
            string slug,
            Guid partId,
            Event2SubmitRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var site = await FindPublishedSiteAsync(dbContext, slug, ct);
            if (site is null)
            {
                return Results.NotFound();
            }

            var part = await dbContext.Event2Parts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null || !part.IsVisible || part.Kind != "form")
            {
                return Results.NotFound();
            }

            var page = await dbContext.Event2Pages.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == part.PageId && x.SiteId == site.Id, ct);
            if (page is null)
            {
                return Results.NotFound();
            }

            // A form on an internal page needs a link that was granted that page.
            Event2AccessLink? link = null;
            if (!string.IsNullOrWhiteSpace(request.AccessToken))
            {
                link = await dbContext.Event2AccessLinks
                    .FirstOrDefaultAsync(x => x.Token == request.AccessToken && x.SiteId == site.Id && x.Status == "active", ct);
            }

            if (page.Kind != "public")
            {
                if (link is null)
                {
                    return Results.NotFound();
                }
                var granted = await dbContext.Event2AccessLinkPages.AsNoTracking()
                    .AnyAsync(x => x.AccessLinkId == link.Id && x.PageId == page.Id, ct);
                if (!granted)
                {
                    return Results.NotFound();
                }
            }

            var fields = await dbContext.Event2PartFields.AsNoTracking()
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

            var registration = new Event2Registration
            {
                Id = Guid.NewGuid(),
                SiteId = site.Id,
                PartId = part.Id,
                AccessLinkId = link?.Id,
                SubmittedUtc = DateTimeOffset.UtcNow
            };

            var values = new List<Event2RegistrationValue>();
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

                values.Add(new Event2RegistrationValue
                {
                    Id = Guid.NewGuid(),
                    RegistrationId = registration.Id,
                    FieldId = field.Id,
                    FieldLabel = field.Label,
                    Value = value
                });
            }

            dbContext.Event2Registrations.Add(registration);
            dbContext.Event2RegistrationValues.AddRange(values);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new Event2SubmitResponse(registration.Id, registration.SubmittedUtc));
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

        var link = await dbContext.Event2AccessLinks
            .FirstOrDefaultAsync(x => x.Token == token && x.Status == "active", ct);
        if (link is null)
        {
            return Results.NotFound();
        }

        var site = await dbContext.Event2Sites.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == link.SiteId, ct);
        if (site is null)
        {
            return Results.NotFound();
        }

        var grantedIds = await dbContext.Event2AccessLinkPages.AsNoTracking()
            .Where(x => x.AccessLinkId == link.Id)
            .Select(x => x.PageId)
            .ToListAsync(ct);

        // The public page is always reachable from a link, so the recipient can
        // get back to the shared view without a second address.
        var pages = await dbContext.Event2Pages.AsNoTracking()
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

        var assignments = await dbContext.Event2AccessLinkAssignments.AsNoTracking()
            .Where(x => x.AccessLinkId == link.Id)
            .OrderBy(x => x.SortOrder)
            .Select(x => new Event2AssignmentResponse(x.Label, x.Value))
            .ToListAsync(ct);

        var pageResponse = await BuildPageResponseAsync(dbContext, selected, ct);

        link.ViewCount += 1;
        link.LastViewedUtc = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var refs = pages
            .Select(x => new Event2PageRef(x.Id, x.Slug, x.MenuLabel, x.Kind))
            .ToList();

        return Results.Ok(new Event2LinkViewResponse(
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
                .FirstOrDefaultAsync(x => x.ScopeKey == Event2AdminScope, ct);

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

            return Results.Ok(new Event2AdminStatusResponse(hasAdmin, isCurrentUserAdmin, adminDisplayName));
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
                .FirstOrDefaultAsync(x => x.ScopeKey == Event2AdminScope, ct);

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
                ScopeKey = Event2AdminScope,
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
                "Event2AdminClaimed",
                userId.ToString(),
                JsonSerializer.Serialize(new { scope = Event2AdminScope, userId, createdUtc = now }),
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

            var sites = await dbContext.Event2Sites.AsNoTracking()
                .OrderByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);

            var siteIds = sites.Select(x => x.Id).ToList();

            var pages = await dbContext.Event2Pages.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId))
                .Select(x => new { x.Id, x.SiteId })
                .ToListAsync(ct);

            var pageIds = pages.Select(x => x.Id).ToList();
            var partCounts = await dbContext.Event2Parts.AsNoTracking()
                .Where(x => pageIds.Contains(x.PageId))
                .GroupBy(x => x.PageId)
                .Select(g => new { PageId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var partsByPage = partCounts.ToDictionary(x => x.PageId, x => x.Count);
            var pageCountBySite = pages.GroupBy(x => x.SiteId).ToDictionary(g => g.Key, g => g.Count());
            var partCountBySite = pages
                .GroupBy(x => x.SiteId)
                .ToDictionary(g => g.Key, g => g.Sum(p => partsByPage.GetValueOrDefault(p.Id)));

            var linkCounts = await dbContext.Event2AccessLinks.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId))
                .GroupBy(x => x.SiteId)
                .Select(g => new { SiteId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var registrationCounts = await dbContext.Event2Registrations.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId))
                .GroupBy(x => x.SiteId)
                .Select(g => new { SiteId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var linkMap = linkCounts.ToDictionary(x => x.SiteId, x => x.Count);
            var registrationMap = registrationCounts.ToDictionary(x => x.SiteId, x => x.Count);

            var rows = sites.Select(x => new Event2AdminSiteSummary(
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

            var site = await dbContext.Event2Sites.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == siteId, ct);
            if (site is null) return Results.NotFound();

            var pages = await dbContext.Event2Pages.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderBy(x => x.Kind == "public" ? 0 : 1)
                .ThenBy(x => x.SortOrder)
                .ToListAsync(ct);

            var pageIds = pages.Select(x => x.Id).ToList();

            var parts = pageIds.Count == 0
                ? []
                : await dbContext.Event2Parts.AsNoTracking()
                    .Where(x => pageIds.Contains(x.PageId))
                    .OrderBy(x => x.SortOrder)
                    .ToListAsync(ct);

            var partIds = parts.Where(x => x.Kind == "form").Select(x => x.Id).ToList();
            var fields = partIds.Count == 0
                ? []
                : await dbContext.Event2PartFields.AsNoTracking()
                    .Where(x => partIds.Contains(x.PartId))
                    .OrderBy(x => x.SortOrder)
                    .ToListAsync(ct);

            var fieldsByPart = fields
                .GroupBy(x => x.PartId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<Event2PartFieldResponse>)g.Select(ToFieldResponse).ToList());

            var partsByPage = parts
                .GroupBy(x => x.PageId)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<Event2AdminPartResponse>)g.Select(p => new Event2AdminPartResponse(
                        p.Id, p.SortOrder, p.Kind, p.MenuLabel, p.Title, p.Intro,
                        p.ConfigJson, p.LayersJson, p.IsVisible,
                        fieldsByPart.GetValueOrDefault(p.Id) ?? [])).ToList());

            var pageResponses = pages.Select(x => new Event2AdminPageResponse(
                x.Id, x.SortOrder, x.Kind, x.Slug, x.Title, x.MenuLabel, x.Description,
                partsByPage.GetValueOrDefault(x.Id) ?? [])).ToList();

            return Results.Ok(new Event2AdminSiteResponse(
                ToHeader(site), ToCatalogueEntry(site), site.IsPublished, pageResponses));
        }).RequireAuthorization();

        group.MapPost("/admin/sites", async (
            Event2SiteUpsertRequest request,
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
            if (await dbContext.Event2Sites.AnyAsync(x => x.Slug == slug, ct))
            {
                return Results.Conflict(new { error = "Wydarzenie o tym adresie już istnieje." });
            }

            var now = DateTimeOffset.UtcNow;
            var site = new Event2Site
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
            var publicPage = new Event2Page
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

            dbContext.Event2Sites.Add(site);
            dbContext.Event2Pages.Add(publicPage);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { id = site.Id, slug = site.Slug, publicPageId = publicPage.Id });
        }).RequireAuthorization();

        group.MapPut("/admin/sites/{siteId:guid}", async (
            Guid siteId,
            Event2SiteUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var site = await dbContext.Event2Sites.FirstOrDefaultAsync(x => x.Id == siteId, ct);
            if (site is null) return Results.NotFound();

            var slug = NormalizeSlug(request.Slug);
            var title = NormalizeShort(request.Title, 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "Podaj adres (slug) i tytuł wydarzenia." });
            }
            if (slug != site.Slug && await dbContext.Event2Sites.AnyAsync(x => x.Slug == slug, ct))
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

            var site = await dbContext.Event2Sites.FirstOrDefaultAsync(x => x.Id == siteId, ct);
            if (site is null) return Results.NotFound();

            var pageIds = await dbContext.Event2Pages
                .Where(x => x.SiteId == siteId).Select(x => x.Id).ToListAsync(ct);
            var partIds = await dbContext.Event2Parts
                .Where(x => pageIds.Contains(x.PageId)).Select(x => x.Id).ToListAsync(ct);
            var registrationIds = await dbContext.Event2Registrations
                .Where(x => x.SiteId == siteId).Select(x => x.Id).ToListAsync(ct);
            var linkIds = await dbContext.Event2AccessLinks
                .Where(x => x.SiteId == siteId).Select(x => x.Id).ToListAsync(ct);

            // Depth-first, so no FK is left dangling mid-delete.
            dbContext.Event2RegistrationValues.RemoveRange(
                dbContext.Event2RegistrationValues.Where(x => registrationIds.Contains(x.RegistrationId)));
            dbContext.Event2Registrations.RemoveRange(
                dbContext.Event2Registrations.Where(x => x.SiteId == siteId));
            dbContext.Event2AccessLinkAssignments.RemoveRange(
                dbContext.Event2AccessLinkAssignments.Where(x => linkIds.Contains(x.AccessLinkId)));
            dbContext.Event2AccessLinkPages.RemoveRange(
                dbContext.Event2AccessLinkPages.Where(x => linkIds.Contains(x.AccessLinkId)));
            dbContext.Event2AccessLinks.RemoveRange(
                dbContext.Event2AccessLinks.Where(x => x.SiteId == siteId));
            dbContext.Event2PartFields.RemoveRange(
                dbContext.Event2PartFields.Where(x => partIds.Contains(x.PartId)));
            dbContext.Event2Parts.RemoveRange(
                dbContext.Event2Parts.Where(x => pageIds.Contains(x.PageId)));
            dbContext.Event2Pages.RemoveRange(
                dbContext.Event2Pages.Where(x => x.SiteId == siteId));
            dbContext.Event2Sites.Remove(site);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();
    }

    // ── Admin: pages ─────────────────────────────────────────────────────────

    private static void MapAdminPageEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/admin/sites/{siteId:guid}/pages", async (
            Guid siteId,
            Event2PageUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();
            if (!await dbContext.Event2Sites.AnyAsync(x => x.Id == siteId, ct)) return Results.NotFound();

            var slug = NormalizeSlug(request.Slug);
            var title = NormalizeShort(request.Title, 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "Podaj adres i tytuł strony." });
            }
            if (await dbContext.Event2Pages.AnyAsync(x => x.SiteId == siteId && x.Slug == slug, ct))
            {
                return Results.Conflict(new { error = "Strona o tym adresie już istnieje w tym wydarzeniu." });
            }

            var nextOrder = await dbContext.Event2Pages
                .Where(x => x.SiteId == siteId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(ct) ?? -1;

            var now = DateTimeOffset.UtcNow;
            var page = new Event2Page
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

            dbContext.Event2Pages.Add(page);
            await TouchSiteAsync(dbContext, siteId, ct);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { id = page.Id, slug = page.Slug });
        }).RequireAuthorization();

        group.MapPut("/admin/pages/{pageId:guid}", async (
            Guid pageId,
            Event2PageUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var page = await dbContext.Event2Pages.FirstOrDefaultAsync(x => x.Id == pageId, ct);
            if (page is null) return Results.NotFound();

            var slug = NormalizeSlug(request.Slug);
            var title = NormalizeShort(request.Title, 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "Podaj adres i tytuł strony." });
            }
            if (slug != page.Slug
                && await dbContext.Event2Pages.AnyAsync(x => x.SiteId == page.SiteId && x.Slug == slug, ct))
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

            var page = await dbContext.Event2Pages.FirstOrDefaultAsync(x => x.Id == pageId, ct);
            if (page is null) return Results.NotFound();
            if (page.Kind == "public")
            {
                return Results.BadRequest(new { error = "Strony publicznej nie można usunąć." });
            }

            var partIds = await dbContext.Event2Parts
                .Where(x => x.PageId == pageId).Select(x => x.Id).ToListAsync(ct);
            var registrationIds = await dbContext.Event2Registrations
                .Where(x => partIds.Contains(x.PartId)).Select(x => x.Id).ToListAsync(ct);

            dbContext.Event2RegistrationValues.RemoveRange(
                dbContext.Event2RegistrationValues.Where(x => registrationIds.Contains(x.RegistrationId)));
            dbContext.Event2Registrations.RemoveRange(
                dbContext.Event2Registrations.Where(x => partIds.Contains(x.PartId)));
            dbContext.Event2AccessLinkPages.RemoveRange(
                dbContext.Event2AccessLinkPages.Where(x => x.PageId == pageId));
            dbContext.Event2PartFields.RemoveRange(
                dbContext.Event2PartFields.Where(x => partIds.Contains(x.PartId)));
            dbContext.Event2Parts.RemoveRange(
                dbContext.Event2Parts.Where(x => x.PageId == pageId));
            dbContext.Event2Pages.Remove(page);

            await TouchSiteAsync(dbContext, page.SiteId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();

        group.MapPost("/admin/sites/{siteId:guid}/pages/reorder", async (
            Guid siteId,
            Event2ReorderRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var pages = await dbContext.Event2Pages.Where(x => x.SiteId == siteId).ToListAsync(ct);
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
            Event2PartUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var page = await dbContext.Event2Pages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == pageId, ct);
            if (page is null) return Results.NotFound();

            var kind = (request.Kind ?? string.Empty).Trim().ToLowerInvariant();
            if (!AllowedPartKinds.Contains(kind))
            {
                return Results.BadRequest(new { error = $"Nieznany typ części: {kind}." });
            }

            var nextOrder = await dbContext.Event2Parts
                .Where(x => x.PageId == pageId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(ct) ?? -1;

            var now = DateTimeOffset.UtcNow;
            var part = new Event2Part
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

            dbContext.Event2Parts.Add(part);
            await TouchSiteAsync(dbContext, page.SiteId, ct);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { id = part.Id, sortOrder = part.SortOrder });
        }).RequireAuthorization();

        group.MapPut("/admin/parts/{partId:guid}", async (
            Guid partId,
            Event2PartUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var part = await dbContext.Event2Parts.FirstOrDefaultAsync(x => x.Id == partId, ct);
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

            var part = await dbContext.Event2Parts.FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null) return Results.NotFound();

            var registrationIds = await dbContext.Event2Registrations
                .Where(x => x.PartId == partId).Select(x => x.Id).ToListAsync(ct);

            dbContext.Event2RegistrationValues.RemoveRange(
                dbContext.Event2RegistrationValues.Where(x => registrationIds.Contains(x.RegistrationId)));
            dbContext.Event2Registrations.RemoveRange(
                dbContext.Event2Registrations.Where(x => x.PartId == partId));
            dbContext.Event2PartFields.RemoveRange(
                dbContext.Event2PartFields.Where(x => x.PartId == partId));
            dbContext.Event2Parts.Remove(part);

            await TouchSiteByPageAsync(dbContext, part.PageId, ct);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();

        group.MapPost("/admin/pages/{pageId:guid}/parts/reorder", async (
            Guid pageId,
            Event2ReorderRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var parts = await dbContext.Event2Parts.Where(x => x.PageId == pageId).ToListAsync(ct);
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
            Event2FieldUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var part = await dbContext.Event2Parts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null) return Results.NotFound();
            if (part.Kind != "form")
            {
                return Results.BadRequest(new { error = "Pola można dodawać tylko do części typu formularz." });
            }

            var validation = ValidateField(request);
            if (validation is not null) return Results.BadRequest(new { error = validation });

            var nextOrder = await dbContext.Event2PartFields
                .Where(x => x.PartId == partId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(ct) ?? -1;

            var identityRole = NormalizeIdentityRole(request.IdentityRole);
            if (identityRole != "none")
            {
                await ClearIdentityRoleAsync(dbContext, partId, identityRole, ct);
            }

            var options = NormalizeOptions(request.Options);
            var field = new Event2PartField
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

            dbContext.Event2PartFields.Add(field);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = field.Id, sortOrder = field.SortOrder });
        }).RequireAuthorization();

        group.MapPut("/admin/fields/{fieldId:guid}", async (
            Guid fieldId,
            Event2FieldUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var field = await dbContext.Event2PartFields.FirstOrDefaultAsync(x => x.Id == fieldId, ct);
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

            var field = await dbContext.Event2PartFields.FirstOrDefaultAsync(x => x.Id == fieldId, ct);
            if (field is null) return Results.NotFound();

            dbContext.Event2RegistrationValues.RemoveRange(
                dbContext.Event2RegistrationValues.Where(x => x.FieldId == fieldId));
            dbContext.Event2PartFields.Remove(field);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();

        group.MapPost("/admin/parts/{partId:guid}/fields/reorder", async (
            Guid partId,
            Event2ReorderRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var fields = await dbContext.Event2PartFields.Where(x => x.PartId == partId).ToListAsync(ct);
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

            var registrations = await dbContext.Event2Registrations.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderByDescending(x => x.SubmittedUtc)
                .ToListAsync(ct);

            if (registrations.Count == 0)
            {
                return Results.Ok(new List<Event2AdminRegistrationRow>());
            }

            var registrationIds = registrations.Select(x => x.Id).ToList();

            var values = await dbContext.Event2RegistrationValues.AsNoTracking()
                .Where(x => registrationIds.Contains(x.RegistrationId))
                .ToListAsync(ct);

            var pages = await dbContext.Event2Pages.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .Select(x => new { x.Id, x.MenuLabel })
                .ToListAsync(ct);
            var pageLabels = pages.ToDictionary(x => x.Id, x => x.MenuLabel);

            var pageIds = pages.Select(x => x.Id).ToList();
            var parts = await dbContext.Event2Parts.AsNoTracking()
                .Where(x => pageIds.Contains(x.PageId))
                .Select(x => new { x.Id, x.MenuLabel, x.PageId })
                .ToListAsync(ct);
            var partInfo = parts.ToDictionary(x => x.Id, x => x);

            // Which registrations already have a link granted from them.
            var links = await dbContext.Event2AccessLinks.AsNoTracking()
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
                    g => (IReadOnlyList<Event2AdminRegistrationValue>)g
                        .Select(v => new Event2AdminRegistrationValue(v.FieldLabel, v.Value)).ToList());

            var rows = registrations.Select(x =>
            {
                partInfo.TryGetValue(x.PartId, out var part);
                linkByRegistration.TryGetValue(x.Id, out var link);
                return new Event2AdminRegistrationRow(
                    x.Id,
                    x.PartId,
                    part?.MenuLabel ?? "—",
                    part is not null ? pageLabels.GetValueOrDefault(part.PageId) ?? "—" : "—",
                    x.ParticipantName,
                    x.ParticipantContact,
                    x.SubmittedUtc,
                    link?.Id,
                    link?.Token,
                    valuesByRegistration.GetValueOrDefault(x.Id) ?? []);
            }).ToList();

            return Results.Ok(rows);
        }).RequireAuthorization();

        group.MapGet("/admin/sites/{siteId:guid}/links", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var links = await dbContext.Event2AccessLinks.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var linkIds = links.Select(x => x.Id).ToList();

            var grants = linkIds.Count == 0
                ? []
                : await dbContext.Event2AccessLinkPages.AsNoTracking()
                    .Where(x => linkIds.Contains(x.AccessLinkId))
                    .ToListAsync(ct);

            var assignments = linkIds.Count == 0
                ? []
                : await dbContext.Event2AccessLinkAssignments.AsNoTracking()
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
                    g => (IReadOnlyList<Event2AssignmentResponse>)g
                        .Select(a => new Event2AssignmentResponse(a.Label, a.Value)).ToList());

            var rows = links.Select(x => new Event2AdminAccessLinkRow(
                x.Id, x.Token, x.RecipientName, x.RecipientContact, x.Status,
                x.PersonalNote, x.InternalNote, x.RegistrationId,
                x.ViewCount, x.LastViewedUtc, x.CreatedUtc,
                grantsByLink.GetValueOrDefault(x.Id) ?? [],
                assignmentsByLink.GetValueOrDefault(x.Id) ?? [])).ToList();

            return Results.Ok(rows);
        }).RequireAuthorization();

        group.MapPost("/admin/sites/{siteId:guid}/links", async (
            Guid siteId,
            Event2AccessLinkUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();
            if (!await dbContext.Event2Sites.AnyAsync(x => x.Id == siteId, ct)) return Results.NotFound();

            var name = NormalizeShort(request.RecipientName, 200);
            if (name is null)
            {
                return Results.BadRequest(new { error = "Podaj imię i nazwisko odbiorcy linku." });
            }

            var now = DateTimeOffset.UtcNow;
            var link = new Event2AccessLink
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

            dbContext.Event2AccessLinks.Add(link);
            dbContext.Event2AccessLinkPages.AddRange(
                await BuildGrantsAsync(dbContext, siteId, link.Id, request.PageIds, ct));
            dbContext.Event2AccessLinkAssignments.AddRange(
                BuildAssignments(link.Id, request.Assignments));

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = link.Id, token = link.Token });
        }).RequireAuthorization();

        group.MapPut("/admin/links/{linkId:guid}", async (
            Guid linkId,
            Event2AccessLinkUpsertRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var link = await dbContext.Event2AccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
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

            dbContext.Event2AccessLinkPages.RemoveRange(
                dbContext.Event2AccessLinkPages.Where(x => x.AccessLinkId == linkId));
            dbContext.Event2AccessLinkPages.AddRange(
                await BuildGrantsAsync(dbContext, link.SiteId, linkId, request.PageIds, ct));

            dbContext.Event2AccessLinkAssignments.RemoveRange(
                dbContext.Event2AccessLinkAssignments.Where(x => x.AccessLinkId == linkId));
            dbContext.Event2AccessLinkAssignments.AddRange(
                BuildAssignments(linkId, request.Assignments));

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { id = link.Id, token = link.Token });
        }).RequireAuthorization();

        group.MapPost("/admin/links/{linkId:guid}/status", async (
            Guid linkId,
            Event2StatusRequest request,
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

            var link = await dbContext.Event2AccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
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

            var link = await dbContext.Event2AccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
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

            var link = await dbContext.Event2AccessLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
            if (link is null) return Results.NotFound();

            // Registrations made through this link survive it, minus the pointer.
            var linked = await dbContext.Event2Registrations
                .Where(x => x.AccessLinkId == linkId).ToListAsync(ct);
            foreach (var registration in linked)
            {
                registration.AccessLinkId = null;
            }

            dbContext.Event2AccessLinkAssignments.RemoveRange(
                dbContext.Event2AccessLinkAssignments.Where(x => x.AccessLinkId == linkId));
            dbContext.Event2AccessLinkPages.RemoveRange(
                dbContext.Event2AccessLinkPages.Where(x => x.AccessLinkId == linkId));
            dbContext.Event2AccessLinks.Remove(link);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();
    }

    // ── Shared helpers ───────────────────────────────────────────────────────

    private static async Task<Event2Site?> FindPublishedSiteAsync(
        RecreatioDbContext dbContext,
        string slug,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;
        var normalized = slug.Trim().ToLowerInvariant();
        var site = await dbContext.Event2Sites.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Slug == normalized, ct);
        return site is not null && site.IsPublished ? site : null;
    }

    private static async Task<Event2PageResponse> BuildPageResponseAsync(
        RecreatioDbContext dbContext,
        Event2Page page,
        CancellationToken ct)
    {
        var parts = await dbContext.Event2Parts.AsNoTracking()
            .Where(x => x.PageId == page.Id && x.IsVisible)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var formPartIds = parts.Where(x => x.Kind == "form").Select(x => x.Id).ToList();
        var fields = formPartIds.Count == 0
            ? []
            : await dbContext.Event2PartFields.AsNoTracking()
                .Where(x => formPartIds.Contains(x.PartId))
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

        var fieldsByPart = fields
            .GroupBy(x => x.PartId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Event2PartFieldResponse>)g.Select(ToFieldResponse).ToList());

        var partResponses = parts.Select(x => new Event2PartResponse(
            x.Id, x.SortOrder, x.Kind, x.MenuLabel, x.Title, x.Intro,
            x.ConfigJson, x.LayersJson,
            fieldsByPart.GetValueOrDefault(x.Id) ?? [])).ToList();

        return new Event2PageResponse(
            page.Id, page.SortOrder, page.Kind, page.Slug, page.Title, page.MenuLabel,
            page.Description, partResponses);
    }

    private static Event2PartFieldResponse ToFieldResponse(Event2PartField field) =>
        new(field.Id, field.SortOrder, field.Kind, field.Label, field.HelpText,
            DeserializeOptions(field.OptionsJson), field.IsRequired, field.IsHalfWidth, field.IdentityRole);

    private static Event2SiteHeader ToHeader(Event2Site site) =>
        new(site.Id, site.Slug, site.Title, site.Subtitle, site.DateLabel,
            DeserializeOptions(site.PlacesJson), site.ThemeJson);

    private static Event2CatalogueEntry ToCatalogueEntry(Event2Site site) =>
        new(site.Id, site.Slug, site.Title, site.Summary, site.Category, site.Audience,
            DeserializeOptions(site.PlacesJson), site.ThumbnailUrl,
            site.StartDate, site.EndDate, site.DateLabel);

    /// <summary>Copies the catalogue block off an upsert onto the entity.</summary>
    private static void ApplyCatalogue(Event2Site site, Event2SiteUpsertRequest request)
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
        site.IsPublished = request.IsPublished;
    }

    private static async Task<bool> IsAdminAsync(
        HttpContext context,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId)) return false;
        var assignment = await dbContext.PortalAdminAssignments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScopeKey == Event2AdminScope, ct);
        return assignment is not null && assignment.UserId == userId;
    }

    private static async Task TouchSiteAsync(RecreatioDbContext dbContext, Guid siteId, CancellationToken ct)
    {
        var site = await dbContext.Event2Sites.FirstOrDefaultAsync(x => x.Id == siteId, ct);
        if (site is not null) site.UpdatedUtc = DateTimeOffset.UtcNow;
    }

    private static async Task TouchSiteByPageAsync(RecreatioDbContext dbContext, Guid pageId, CancellationToken ct)
    {
        var siteId = await dbContext.Event2Pages.AsNoTracking()
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
    private static async Task<List<Event2AccessLinkPage>> BuildGrantsAsync(
        RecreatioDbContext dbContext,
        Guid siteId,
        Guid linkId,
        IReadOnlyList<Guid>? pageIds,
        CancellationToken ct)
    {
        var requested = (pageIds ?? []).Distinct().ToList();
        if (requested.Count == 0) return [];

        var valid = await dbContext.Event2Pages.AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Kind == "internal" && requested.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(ct);

        return valid.Select(pageId => new Event2AccessLinkPage
        {
            Id = Guid.NewGuid(),
            AccessLinkId = linkId,
            PageId = pageId
        }).ToList();
    }

    private static IEnumerable<Event2AccessLinkAssignment> BuildAssignments(
        Guid linkId,
        IReadOnlyList<Event2AssignmentResponse>? source)
    {
        var order = 0;
        foreach (var entry in source ?? [])
        {
            var label = NormalizeShort(entry.Label, 160);
            var value = NormalizeShort(entry.Value, 600);
            if (label is null || value is null) continue;

            yield return new Event2AccessLinkAssignment
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
        var clashes = await dbContext.Event2PartFields
            .Where(x => x.PartId == partId && x.IdentityRole == identityRole)
            .ToListAsync(ct);
        foreach (var clash in clashes)
        {
            clash.IdentityRole = "none";
        }
    }

    private static string? ValidateField(Event2FieldUpsertRequest request)
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

    private static string? NormalizeFieldValue(Event2PartField field, string? raw)
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
