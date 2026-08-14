using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Library;
using Recreatio.Api.Services;
using Recreatio.Api.Services.Library;

namespace Recreatio.Api.Endpoints.Library;

/// <summary>
/// Private library: works, their editions (including translations), and the copies
/// standing on my shelves. Every row is scoped to the calling account through
/// OwnerAccountId, so ownership is enforced on each query rather than by joining
/// back to a parent.
/// </summary>
public static class LibraryEndpoints
{
    private const int MaxPageSize = 200;

    private static readonly HashSet<string> WorkKinds = new(StringComparer.Ordinal)
    {
        "book", "article", "essay", "poetry", "drama", "treatise", "collection", "reference", "other"
    };

    private static readonly HashSet<string> ContributionRoles = new(StringComparer.Ordinal)
    {
        "author", "coauthor", "editor", "translator", "illustrator",
        "foreword", "afterword", "commentary", "compiler", "other"
    };

    private static readonly HashSet<string> CopyStatuses = new(StringComparer.Ordinal)
    {
        "shelf", "lent", "borrowed", "wanted", "ordered", "lost", "sold"
    };

    private static readonly HashSet<string> CopyConditions = new(StringComparer.Ordinal)
    {
        "new", "good", "fair", "worn", "damaged"
    };

    private static readonly HashSet<string> ReadingStatuses = new(StringComparer.Ordinal)
    {
        "unread", "reading", "read", "abandoned", "reference"
    };

    private static readonly HashSet<string> Bindings = new(StringComparer.Ordinal)
    {
        "hardcover", "paperback", "leather", "ebook", "audiobook", "other"
    };

    private static readonly HashSet<string> LoanDirections = new(StringComparer.Ordinal) { "out", "in" };

    /// <summary>Roles that identify the creator of the work itself.</summary>
    private static readonly string[] AuthorRoles = ["author", "coauthor"];

    public static void MapLibraryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/library");

        // The API authenticates by cookie, so every mutating call carries the
        // double-submit CSRF token. One group filter enforces it for the whole
        // module instead of repeating the check in each of the ~25 handlers.
        group.AddEndpointFilter(async (invocation, next) =>
        {
            var method = invocation.HttpContext.Request.Method;
            if (HttpMethods.IsPost(method) ||
                HttpMethods.IsPut(method) ||
                HttpMethods.IsPatch(method) ||
                HttpMethods.IsDelete(method))
            {
                var csrfService = invocation.HttpContext.RequestServices.GetRequiredService<ICsrfService>();
                if (!csrfService.Validate(invocation.HttpContext))
                {
                    return Results.Forbid();
                }
            }

            return await next(invocation);
        });

        MapPeopleEndpoints(group);
        MapPublisherEndpoints(group);
        MapShelfEndpoints(group);
        MapTagEndpoints(group);
        MapWorkEndpoints(group);
        MapEditionEndpoints(group);
        MapCopyEndpoints(group);
        MapLoanEndpoints(group);
        MapReadingEndpoints(group);
        MapOverviewEndpoints(group);
        MapScanEndpoints(group);
        MapTransferEndpoints(group);
    }

    // ── People ──────────────────────────────────────────────────────────────

    private static void MapPeopleEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/people", async (string? term, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var query = db.LibraryPeople.AsNoTracking().Where(x => x.OwnerAccountId == userId);
            var search = Normalize(term, 240);
            if (search is not null)
            {
                query = query.Where(x =>
                    x.DisplayName.Contains(search) ||
                    (x.SortName != null && x.SortName.Contains(search)));
            }

            var people = await query.ToListAsync(ct);
            var ids = people.Select(x => x.Id).ToList();

            var contributions = await db.LibraryContributions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && ids.Contains(x.PersonId))
                .Select(x => new { x.PersonId, x.TargetType })
                .ToListAsync(ct);

            var workCounts = contributions
                .Where(x => x.TargetType == "work")
                .GroupBy(x => x.PersonId)
                .ToDictionary(g => g.Key, g => g.Count());
            var editionCounts = contributions
                .Where(x => x.TargetType == "edition")
                .GroupBy(x => x.PersonId)
                .ToDictionary(g => g.Key, g => g.Count());

            var result = people
                .OrderBy(x => x.SortName ?? x.DisplayName, StringComparer.CurrentCulture)
                .Select(x => new LibraryPersonResponse(
                    x.Id, x.DisplayName, x.SortName, x.BirthYear, x.DeathYear, x.Nationality, x.Notes,
                    workCounts.GetValueOrDefault(x.Id, 0),
                    editionCounts.GetValueOrDefault(x.Id, 0)))
                .ToList();

            return Results.Ok(result);
        });

        group.MapPost("/people", async (LibraryPersonSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var displayName = Normalize(req.DisplayName, 240);
            if (displayName is null) return Bad("Display name is required.");

            var now = DateTimeOffset.UtcNow;
            var person = new LibraryPerson
            {
                OwnerAccountId = userId,
                DisplayName = displayName,
                SortName = Normalize(req.SortName, 240),
                BirthYear = NormalizeYear(req.BirthYear),
                DeathYear = NormalizeYear(req.DeathYear),
                Nationality = Normalize(req.Nationality, 80),
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryPeople.Add(person);
            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(person, 0, 0));
        });

        group.MapPut("/people/{id:long}", async (long id, LibraryPersonSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var person = await db.LibraryPeople.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (person is null) return Results.NotFound();

            var displayName = Normalize(req.DisplayName, 240);
            if (displayName is null) return Bad("Display name is required.");

            person.DisplayName = displayName;
            person.SortName = Normalize(req.SortName, 240);
            person.BirthYear = NormalizeYear(req.BirthYear);
            person.DeathYear = NormalizeYear(req.DeathYear);
            person.Nationality = Normalize(req.Nationality, 80);
            person.Notes = NormalizeText(req.Notes);
            person.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(person, 0, 0));
        });

        group.MapDelete("/people/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var person = await db.LibraryPeople.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (person is null) return Results.NotFound();

            // Deleting a person removes their attributions but never the works themselves.
            await db.LibraryContributions
                .Where(x => x.OwnerAccountId == userId && x.PersonId == id)
                .ExecuteDeleteAsync(ct);

            db.LibraryPeople.Remove(person);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Publishers ──────────────────────────────────────────────────────────

    private static void MapPublisherEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/publishers", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var publishers = await db.LibraryPublishers.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .ToListAsync(ct);

            var counts = await db.LibraryEditions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.PublisherId != null)
                .GroupBy(x => x.PublisherId!.Value)
                .Select(g => new { PublisherId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var countMap = counts.ToDictionary(x => x.PublisherId, x => x.Count);

            var result = publishers
                .OrderBy(x => x.Name, StringComparer.CurrentCulture)
                .Select(x => new LibraryPublisherResponse(x.Id, x.Name, x.City, x.Notes, countMap.GetValueOrDefault(x.Id, 0)))
                .ToList();

            return Results.Ok(result);
        });

        group.MapPost("/publishers", async (LibraryPublisherSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var name = Normalize(req.Name, 240);
            if (name is null) return Bad("Name is required.");

            var now = DateTimeOffset.UtcNow;
            var publisher = new LibraryPublisher
            {
                OwnerAccountId = userId,
                Name = name,
                City = Normalize(req.City, 160),
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryPublishers.Add(publisher);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryPublisherResponse(publisher.Id, publisher.Name, publisher.City, publisher.Notes, 0));
        });

        group.MapPut("/publishers/{id:long}", async (long id, LibraryPublisherSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var publisher = await db.LibraryPublishers.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (publisher is null) return Results.NotFound();

            var name = Normalize(req.Name, 240);
            if (name is null) return Bad("Name is required.");

            publisher.Name = name;
            publisher.City = Normalize(req.City, 160);
            publisher.Notes = NormalizeText(req.Notes);
            publisher.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryPublisherResponse(publisher.Id, publisher.Name, publisher.City, publisher.Notes, 0));
        });

        group.MapDelete("/publishers/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var publisher = await db.LibraryPublishers.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (publisher is null) return Results.NotFound();

            // Editions survive; they simply lose the publisher reference.
            await db.LibraryEditions
                .Where(x => x.OwnerAccountId == userId && x.PublisherId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.PublisherId, (long?)null), ct);

            db.LibraryPublishers.Remove(publisher);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Shelves ─────────────────────────────────────────────────────────────

    private static void MapShelfEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/shelves", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var shelves = await db.LibraryShelves.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
                .ToListAsync(ct);

            var counts = await db.LibraryCopies.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.ShelfId != null)
                .GroupBy(x => x.ShelfId!.Value)
                .Select(g => new { ShelfId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var countMap = counts.ToDictionary(x => x.ShelfId, x => x.Count);

            var result = shelves
                .Select(x => new LibraryShelfResponse(x.Id, x.Name, x.Location, x.Description, x.SortOrder, countMap.GetValueOrDefault(x.Id, 0)))
                .ToList();

            return Results.Ok(result);
        });

        group.MapPost("/shelves", async (LibraryShelfSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var name = Normalize(req.Name, 160);
            if (name is null) return Bad("Name is required.");

            var now = DateTimeOffset.UtcNow;
            var shelf = new LibraryShelf
            {
                OwnerAccountId = userId,
                Name = name,
                Location = Normalize(req.Location, 240),
                Description = NormalizeText(req.Description),
                SortOrder = req.SortOrder,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryShelves.Add(shelf);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryShelfResponse(shelf.Id, shelf.Name, shelf.Location, shelf.Description, shelf.SortOrder, 0));
        });

        group.MapPut("/shelves/{id:long}", async (long id, LibraryShelfSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var shelf = await db.LibraryShelves.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (shelf is null) return Results.NotFound();

            var name = Normalize(req.Name, 160);
            if (name is null) return Bad("Name is required.");

            shelf.Name = name;
            shelf.Location = Normalize(req.Location, 240);
            shelf.Description = NormalizeText(req.Description);
            shelf.SortOrder = req.SortOrder;
            shelf.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryShelfResponse(shelf.Id, shelf.Name, shelf.Location, shelf.Description, shelf.SortOrder, 0));
        });

        group.MapDelete("/shelves/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var shelf = await db.LibraryShelves.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (shelf is null) return Results.NotFound();

            // Copies stay in the catalogue; they just become unshelved.
            await db.LibraryCopies
                .Where(x => x.OwnerAccountId == userId && x.ShelfId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ShelfId, (long?)null), ct);

            db.LibraryShelves.Remove(shelf);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Tags ────────────────────────────────────────────────────────────────

    private static void MapTagEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/tags", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var tags = await db.LibraryTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .ToListAsync(ct);

            var counts = await db.LibraryWorkTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .GroupBy(x => x.TagId)
                .Select(g => new { TagId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var countMap = counts.ToDictionary(x => x.TagId, x => x.Count);

            var result = tags
                .OrderBy(x => x.Name, StringComparer.CurrentCulture)
                .Select(x => new LibraryTagResponse(x.Id, x.Name, x.Color, countMap.GetValueOrDefault(x.Id, 0)))
                .ToList();

            return Results.Ok(result);
        });

        group.MapPost("/tags", async (LibraryTagSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var name = Normalize(req.Name, 120);
            if (name is null) return Bad("Name is required.");

            var exists = await db.LibraryTags.AnyAsync(x => x.OwnerAccountId == userId && x.Name == name, ct);
            if (exists) return Results.Conflict(new { error = "A tag with this name already exists." });

            var now = DateTimeOffset.UtcNow;
            var tag = new LibraryTag
            {
                OwnerAccountId = userId,
                Name = name,
                Color = Normalize(req.Color, 16),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryTags.Add(tag);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryTagResponse(tag.Id, tag.Name, tag.Color, 0));
        });

        group.MapPut("/tags/{id:long}", async (long id, LibraryTagSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var tag = await db.LibraryTags.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (tag is null) return Results.NotFound();

            var name = Normalize(req.Name, 120);
            if (name is null) return Bad("Name is required.");

            var clash = await db.LibraryTags.AnyAsync(x => x.OwnerAccountId == userId && x.Name == name && x.Id != id, ct);
            if (clash) return Results.Conflict(new { error = "A tag with this name already exists." });

            tag.Name = name;
            tag.Color = Normalize(req.Color, 16);
            tag.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryTagResponse(tag.Id, tag.Name, tag.Color, 0));
        });

        group.MapDelete("/tags/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var tag = await db.LibraryTags.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (tag is null) return Results.NotFound();

            await db.LibraryWorkTags
                .Where(x => x.OwnerAccountId == userId && x.TagId == id)
                .ExecuteDeleteAsync(ct);

            db.LibraryTags.Remove(tag);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Works ───────────────────────────────────────────────────────────────

    private static void MapWorkEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/works", async (
            string? term,
            string? kind,
            string? originalLanguage,
            string? editionLanguage,
            long? personId,
            long? tagId,
            long? publisherId,
            bool? onlyTranslated,
            bool? onlyOwned,
            string? sort,
            int? skip,
            int? take,
            HttpContext ctx,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var query = db.LibraryWorks.AsNoTracking().Where(x => x.OwnerAccountId == userId);

            var search = Normalize(term, 400);
            if (search is not null)
            {
                // Match on the work's own titles, on any edition title — so searching
                // for a translated title finds the original work — and on the ISBN,
                // so a scanned barcode pasted into the search box lands here too.
                var editionMatchIds = db.LibraryEditions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId &&
                        (e.Title.Contains(search) || (e.Isbn != null && e.Isbn.Contains(search))))
                    .Select(e => e.WorkId);

                query = query.Where(x =>
                    x.OriginalTitle.Contains(search) ||
                    (x.OriginalSubtitle != null && x.OriginalSubtitle.Contains(search)) ||
                    (x.UniformTitle != null && x.UniformTitle.Contains(search)) ||
                    editionMatchIds.Contains(x.Id));
            }

            var kindFilter = NormalizeFrom(kind, WorkKinds);
            if (kindFilter is not null) query = query.Where(x => x.Kind == kindFilter);

            var originalLanguageFilter = NormalizeLanguage(originalLanguage);
            if (originalLanguageFilter is not null) query = query.Where(x => x.OriginalLanguage == originalLanguageFilter);

            var editionLanguageFilter = NormalizeLanguage(editionLanguage);
            if (editionLanguageFilter is not null)
            {
                var ids = db.LibraryEditions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId && e.Language == editionLanguageFilter)
                    .Select(e => e.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (publisherId is { } publisher)
            {
                var ids = db.LibraryEditions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId && e.PublisherId == publisher)
                    .Select(e => e.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (personId is { } person)
            {
                // A person counts as connected either through the work or through
                // any of its editions (translator, illustrator, …).
                var workIds = db.LibraryContributions.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId && c.PersonId == person && c.TargetType == "work")
                    .Select(c => c.TargetId);
                var editionIds = db.LibraryContributions.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId && c.PersonId == person && c.TargetType == "edition")
                    .Select(c => c.TargetId);
                var viaEdition = db.LibraryEditions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId && editionIds.Contains(e.Id))
                    .Select(e => e.WorkId);

                query = query.Where(x => workIds.Contains(x.Id) || viaEdition.Contains(x.Id));
            }

            if (tagId is { } tag)
            {
                var ids = db.LibraryWorkTags.AsNoTracking()
                    .Where(t => t.OwnerAccountId == userId && t.TagId == tag)
                    .Select(t => t.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (onlyTranslated == true)
            {
                var ids = db.LibraryEditions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId)
                    .Join(db.LibraryWorks.AsNoTracking().Where(w => w.OwnerAccountId == userId),
                        e => e.WorkId, w => w.Id, (e, w) => new { e.WorkId, e.Language, w.OriginalLanguage })
                    .Where(x => x.Language != x.OriginalLanguage)
                    .Select(x => x.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (onlyOwned == true)
            {
                var ids = db.LibraryCopies.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId)
                    .Join(db.LibraryEditions.AsNoTracking().Where(e => e.OwnerAccountId == userId),
                        c => c.EditionId, e => e.Id, (c, e) => e.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            var total = await query.CountAsync(ct);

            query = sort switch
            {
                "created" => query.OrderByDescending(x => x.CreatedUtc),
                "updated" => query.OrderByDescending(x => x.UpdatedUtc),
                "year" => query.OrderBy(x => x.FirstPublishedYear == null).ThenBy(x => x.FirstPublishedYear),
                "year_desc" => query.OrderBy(x => x.FirstPublishedYear == null).ThenByDescending(x => x.FirstPublishedYear),
                _ => query.OrderBy(x => x.UniformTitle ?? x.OriginalTitle)
            };

            var page = ClampTake(take);
            var offset = Math.Max(0, skip ?? 0);
            var works = await query.Skip(offset).Take(page).ToListAsync(ct);
            var workIdList = works.Select(x => x.Id).ToList();

            var editions = await db.LibraryEditions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && workIdList.Contains(x.WorkId))
                .Select(x => new { x.Id, x.WorkId, x.Language })
                .ToListAsync(ct);
            var editionIdList = editions.Select(x => x.Id).ToList();

            var copyCounts = await db.LibraryCopies.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && editionIdList.Contains(x.EditionId))
                .GroupBy(x => x.EditionId)
                .Select(g => new { EditionId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var copyCountByEdition = copyCounts.ToDictionary(x => x.EditionId, x => x.Count);

            var authorsByWork = await LoadAuthorNamesAsync(db, userId, workIdList, ct);
            var tagsByWork = await LoadTagsByWorkAsync(db, userId, workIdList, ct);

            var editionsByWork = editions.GroupBy(x => x.WorkId).ToDictionary(g => g.Key, g => g.ToList());

            var items = works.Select(work =>
            {
                var workEditions = editionsByWork.GetValueOrDefault(work.Id) ?? [];
                return new LibraryWorkListItem(
                    work.Id,
                    work.OriginalTitle,
                    work.OriginalSubtitle,
                    work.OriginalLanguage,
                    work.UniformTitle,
                    work.Kind,
                    work.FirstPublishedYear,
                    authorsByWork.GetValueOrDefault(work.Id) ?? [],
                    workEditions.Select(x => x.Language).Distinct().OrderBy(x => x, StringComparer.Ordinal).ToList(),
                    tagsByWork.GetValueOrDefault(work.Id) ?? [],
                    workEditions.Count,
                    workEditions.Sum(x => copyCountByEdition.GetValueOrDefault(x.Id, 0)));
            }).ToList();

            return Results.Ok(new LibraryWorkListResponse(items, total));
        });

        group.MapGet("/works/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var work = await db.LibraryWorks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var contributions = await LoadContributionsAsync(db, userId, "work", [id], ct);
            var tagIds = await db.LibraryWorkTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.WorkId == id)
                .Select(x => x.TagId)
                .ToListAsync(ct);

            var editions = await LoadEditionListAsync(db, userId, id, work.OriginalLanguage, ct);

            return Results.Ok(new LibraryWorkDetailResponse(
                work.Id, work.OriginalTitle, work.OriginalSubtitle, work.OriginalLanguage,
                work.UniformTitle, work.Kind, work.FirstPublishedYear, work.Notes,
                contributions.GetValueOrDefault(id) ?? [],
                tagIds,
                editions,
                work.CreatedUtc, work.UpdatedUtc));
        });

        group.MapPost("/works", async (LibraryWorkSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var title = Normalize(req.OriginalTitle, 400);
            if (title is null) return Bad("Original title is required.");

            var language = NormalizeLanguage(req.OriginalLanguage);
            if (language is null) return Bad("Original language is required.");

            var now = DateTimeOffset.UtcNow;
            var work = new LibraryWork
            {
                OwnerAccountId = userId,
                OriginalTitle = title,
                OriginalSubtitle = Normalize(req.OriginalSubtitle, 400),
                OriginalLanguage = language,
                UniformTitle = Normalize(req.UniformTitle, 400),
                Kind = NormalizeFrom(req.Kind, WorkKinds) ?? "book",
                FirstPublishedYear = NormalizeYear(req.FirstPublishedYear),
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryWorks.Add(work);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = work.Id });
        });

        group.MapPut("/works/{id:long}", async (long id, LibraryWorkSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var work = await db.LibraryWorks.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var title = Normalize(req.OriginalTitle, 400);
            if (title is null) return Bad("Original title is required.");

            var language = NormalizeLanguage(req.OriginalLanguage);
            if (language is null) return Bad("Original language is required.");

            work.OriginalTitle = title;
            work.OriginalSubtitle = Normalize(req.OriginalSubtitle, 400);
            work.OriginalLanguage = language;
            work.UniformTitle = Normalize(req.UniformTitle, 400);
            work.Kind = NormalizeFrom(req.Kind, WorkKinds) ?? "book";
            work.FirstPublishedYear = NormalizeYear(req.FirstPublishedYear);
            work.Notes = NormalizeText(req.Notes);
            work.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = work.Id });
        });

        group.MapDelete("/works/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var work = await db.LibraryWorks.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var editionIds = await db.LibraryEditions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.WorkId == id)
                .Select(x => x.Id)
                .ToListAsync(ct);

            foreach (var editionId in editionIds)
            {
                await DeleteEditionCascadeAsync(db, userId, editionId, ct);
            }

            await db.LibraryEditions.Where(x => x.OwnerAccountId == userId && x.WorkId == id).ExecuteDeleteAsync(ct);
            await db.LibraryWorkTags.Where(x => x.OwnerAccountId == userId && x.WorkId == id).ExecuteDeleteAsync(ct);
            await db.LibraryContributions
                .Where(x => x.OwnerAccountId == userId && x.TargetType == "work" && x.TargetId == id)
                .ExecuteDeleteAsync(ct);

            db.LibraryWorks.Remove(work);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPut("/works/{id:long}/contributions", async (long id, LibraryContributionsSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var exists = await db.LibraryWorks.AnyAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (!exists) return Results.NotFound();

            var error = await ReplaceContributionsAsync(db, userId, "work", id, req.Contributions, ct);
            if (error is not null) return error;

            await db.SaveChangesAsync(ct);
            var contributions = await LoadContributionsAsync(db, userId, "work", [id], ct);
            return Results.Ok(contributions.GetValueOrDefault(id) ?? []);
        });

        group.MapPut("/works/{id:long}/tags", async (long id, LibraryWorkTagsSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var exists = await db.LibraryWorks.AnyAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (!exists) return Results.NotFound();

            var requested = req.TagIds.Distinct().ToList();
            var valid = await db.LibraryTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && requested.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (valid.Count != requested.Count) return Bad("One or more tags do not exist.");

            await db.LibraryWorkTags.Where(x => x.OwnerAccountId == userId && x.WorkId == id).ExecuteDeleteAsync(ct);

            var now = DateTimeOffset.UtcNow;
            foreach (var tagId in valid)
            {
                db.LibraryWorkTags.Add(new LibraryWorkTag
                {
                    OwnerAccountId = userId,
                    WorkId = id,
                    TagId = tagId,
                    CreatedUtc = now
                });
            }
            await db.SaveChangesAsync(ct);

            return Results.Ok(valid);
        });
    }

    // ── Editions ────────────────────────────────────────────────────────────

    private static void MapEditionEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/works/{workId:long}/editions", async (long workId, LibraryEditionSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var work = await db.LibraryWorks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == workId && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var title = Normalize(req.Title, 400);
            if (title is null) return Bad("Title is required.");

            var language = NormalizeLanguage(req.Language);
            if (language is null) return Bad("Language is required.");

            if (req.PublisherId is { } publisherId)
            {
                var publisherExists = await db.LibraryPublishers.AnyAsync(x => x.Id == publisherId && x.OwnerAccountId == userId, ct);
                if (!publisherExists) return Bad("Publisher does not exist.");
            }

            var now = DateTimeOffset.UtcNow;
            var edition = new LibraryEdition
            {
                OwnerAccountId = userId,
                WorkId = workId,
                Title = title,
                Subtitle = Normalize(req.Subtitle, 400),
                Language = language,
                PublisherId = req.PublisherId,
                PublishedPlace = Normalize(req.PublishedPlace, 160),
                PublishedYear = NormalizeYear(req.PublishedYear),
                EditionStatement = Normalize(req.EditionStatement, 160),
                Series = Normalize(req.Series, 200),
                SeriesNumber = Normalize(req.SeriesNumber, 60),
                Isbn = NormalizeIsbn(req.Isbn),
                Issn = Normalize(req.Issn, 32),
                PageCount = NormalizePositive(req.PageCount, 100000),
                Volume = Normalize(req.Volume, 60),
                Binding = NormalizeFrom(req.Binding, Bindings),
                CoverUrl = NormalizeUrl(req.CoverUrl),
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryEditions.Add(edition);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = edition.Id });
        });

        group.MapGet("/editions/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var edition = await db.LibraryEditions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (edition is null) return Results.NotFound();

            var work = await db.LibraryWorks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == edition.WorkId && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var publisherName = edition.PublisherId is { } pid
                ? await db.LibraryPublishers.AsNoTracking().Where(x => x.Id == pid && x.OwnerAccountId == userId).Select(x => x.Name).FirstOrDefaultAsync(ct)
                : null;

            var contributions = await LoadContributionsAsync(db, userId, "edition", [id], ct);
            var copies = await LoadCopiesAsync(db, userId, [id], ct);

            return Results.Ok(new LibraryEditionDetailResponse(
                edition.Id, edition.WorkId, work.OriginalTitle, work.OriginalLanguage,
                edition.Title, edition.Subtitle, edition.Language,
                !string.Equals(edition.Language, work.OriginalLanguage, StringComparison.Ordinal),
                edition.PublisherId, publisherName, edition.PublishedPlace, edition.PublishedYear,
                edition.EditionStatement, edition.Series, edition.SeriesNumber, edition.Isbn, edition.Issn,
                edition.PageCount, edition.Volume, edition.Binding, edition.CoverUrl, edition.Notes,
                contributions.GetValueOrDefault(id) ?? [],
                copies.GetValueOrDefault(id) ?? [],
                edition.CreatedUtc, edition.UpdatedUtc));
        });

        group.MapPut("/editions/{id:long}", async (long id, LibraryEditionSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var edition = await db.LibraryEditions.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (edition is null) return Results.NotFound();

            var title = Normalize(req.Title, 400);
            if (title is null) return Bad("Title is required.");

            var language = NormalizeLanguage(req.Language);
            if (language is null) return Bad("Language is required.");

            if (req.PublisherId is { } publisherId)
            {
                var publisherExists = await db.LibraryPublishers.AnyAsync(x => x.Id == publisherId && x.OwnerAccountId == userId, ct);
                if (!publisherExists) return Bad("Publisher does not exist.");
            }

            edition.Title = title;
            edition.Subtitle = Normalize(req.Subtitle, 400);
            edition.Language = language;
            edition.PublisherId = req.PublisherId;
            edition.PublishedPlace = Normalize(req.PublishedPlace, 160);
            edition.PublishedYear = NormalizeYear(req.PublishedYear);
            edition.EditionStatement = Normalize(req.EditionStatement, 160);
            edition.Series = Normalize(req.Series, 200);
            edition.SeriesNumber = Normalize(req.SeriesNumber, 60);
            edition.Isbn = NormalizeIsbn(req.Isbn);
            edition.Issn = Normalize(req.Issn, 32);
            edition.PageCount = NormalizePositive(req.PageCount, 100000);
            edition.Volume = Normalize(req.Volume, 60);
            edition.Binding = NormalizeFrom(req.Binding, Bindings);
            edition.CoverUrl = NormalizeUrl(req.CoverUrl);
            edition.Notes = NormalizeText(req.Notes);
            edition.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = edition.Id });
        });

        group.MapDelete("/editions/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var edition = await db.LibraryEditions.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (edition is null) return Results.NotFound();

            await DeleteEditionCascadeAsync(db, userId, id, ct);
            db.LibraryEditions.Remove(edition);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPut("/editions/{id:long}/contributions", async (long id, LibraryContributionsSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var exists = await db.LibraryEditions.AnyAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (!exists) return Results.NotFound();

            var error = await ReplaceContributionsAsync(db, userId, "edition", id, req.Contributions, ct);
            if (error is not null) return error;

            await db.SaveChangesAsync(ct);
            var contributions = await LoadContributionsAsync(db, userId, "edition", [id], ct);
            return Results.Ok(contributions.GetValueOrDefault(id) ?? []);
        });
    }

    // ── Copies ──────────────────────────────────────────────────────────────

    private static void MapCopyEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/copies", async (
            string? term,
            long? shelfId,
            string? status,
            string? readingStatus,
            string? language,
            bool? favourite,
            int? minRating,
            string? sort,
            int? skip,
            int? take,
            HttpContext ctx,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var query = db.LibraryCopies.AsNoTracking().Where(x => x.OwnerAccountId == userId);

            if (shelfId is { } shelf) query = query.Where(x => x.ShelfId == shelf);

            var statusFilter = NormalizeFrom(status, CopyStatuses);
            if (statusFilter is not null) query = query.Where(x => x.Status == statusFilter);

            var readingFilter = NormalizeFrom(readingStatus, ReadingStatuses);
            if (readingFilter is not null) query = query.Where(x => x.ReadingStatus == readingFilter);

            if (favourite == true) query = query.Where(x => x.IsFavourite);
            if (minRating is { } rating && rating > 0) query = query.Where(x => x.Rating != null && x.Rating >= rating);

            var languageFilter = NormalizeLanguage(language);
            if (languageFilter is not null)
            {
                var ids = db.LibraryEditions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId && e.Language == languageFilter)
                    .Select(e => e.Id);
                query = query.Where(x => ids.Contains(x.EditionId));
            }

            var search = Normalize(term, 400);
            if (search is not null)
            {
                var editionIds = db.LibraryEditions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId &&
                        (e.Title.Contains(search) || (e.Isbn != null && e.Isbn.Contains(search))))
                    .Select(e => e.Id);
                query = query.Where(x =>
                    editionIds.Contains(x.EditionId) ||
                    (x.Signature != null && x.Signature.Contains(search)) ||
                    (x.Barcode != null && x.Barcode.Contains(search)));
            }

            var total = await query.CountAsync(ct);

            query = sort switch
            {
                "rating" => query.OrderBy(x => x.Rating == null).ThenByDescending(x => x.Rating),
                "acquired" => query.OrderBy(x => x.AcquiredDate == null).ThenByDescending(x => x.AcquiredDate),
                "signature" => query.OrderBy(x => x.Signature ?? string.Empty),
                _ => query.OrderByDescending(x => x.CreatedUtc)
            };

            var page = ClampTake(take);
            var offset = Math.Max(0, skip ?? 0);
            var copies = await query.Skip(offset).Take(page).ToListAsync(ct);

            var items = await BuildCopyListAsync(db, userId, copies, ct);
            return Results.Ok(new LibraryCopyListResponse(items, total));
        });

        group.MapPost("/editions/{editionId:long}/copies", async (long editionId, LibraryCopySaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var editionExists = await db.LibraryEditions.AnyAsync(x => x.Id == editionId && x.OwnerAccountId == userId, ct);
            if (!editionExists) return Results.NotFound();

            if (req.ShelfId is { } shelfId)
            {
                var shelfExists = await db.LibraryShelves.AnyAsync(x => x.Id == shelfId && x.OwnerAccountId == userId, ct);
                if (!shelfExists) return Bad("Shelf does not exist.");
            }

            var now = DateTimeOffset.UtcNow;
            var copy = new LibraryCopy
            {
                OwnerAccountId = userId,
                EditionId = editionId,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            ApplyCopy(copy, req);
            db.LibraryCopies.Add(copy);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = copy.Id });
        });

        group.MapPut("/copies/{id:long}", async (long id, LibraryCopySaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var copy = await db.LibraryCopies.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (copy is null) return Results.NotFound();

            if (req.ShelfId is { } shelfId)
            {
                var shelfExists = await db.LibraryShelves.AnyAsync(x => x.Id == shelfId && x.OwnerAccountId == userId, ct);
                if (!shelfExists) return Bad("Shelf does not exist.");
            }

            ApplyCopy(copy, req);
            copy.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = copy.Id });
        });

        group.MapDelete("/copies/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var copy = await db.LibraryCopies.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (copy is null) return Results.NotFound();

            await db.LibraryLoans.Where(x => x.OwnerAccountId == userId && x.CopyId == id).ExecuteDeleteAsync(ct);
            await db.LibraryReadings.Where(x => x.OwnerAccountId == userId && x.CopyId == id).ExecuteDeleteAsync(ct);

            db.LibraryCopies.Remove(copy);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Loans ───────────────────────────────────────────────────────────────

    private static void MapLoanEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/loans", async (bool? openOnly, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var query = db.LibraryLoans.AsNoTracking().Where(x => x.OwnerAccountId == userId);
            if (openOnly == true) query = query.Where(x => x.ReturnedOn == null);

            var loans = await query
                .OrderBy(x => x.ReturnedOn != null)
                .ThenByDescending(x => x.LentOn)
                .ToListAsync(ct);

            var copyIds = loans.Select(x => x.CopyId).Distinct().ToList();
            var context = await LoadCopyContextAsync(db, userId, copyIds, ct);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var items = loans.Select(loan =>
            {
                var info = context.GetValueOrDefault(loan.CopyId);
                return new LibraryLoanListItem(
                    loan.Id, loan.CopyId, info?.EditionId ?? 0, info?.EditionTitle ?? string.Empty,
                    info?.Authors ?? [], loan.Direction, loan.CounterpartName, loan.CounterpartContact,
                    loan.LentOn, loan.DueOn, loan.ReturnedOn,
                    loan.ReturnedOn is null && loan.DueOn is { } due && due < today,
                    loan.Notes);
            }).ToList();

            return Results.Ok(items);
        });

        group.MapPost("/copies/{copyId:long}/loans", async (long copyId, LibraryLoanSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var copy = await db.LibraryCopies.FirstOrDefaultAsync(x => x.Id == copyId && x.OwnerAccountId == userId, ct);
            if (copy is null) return Results.NotFound();

            var name = Normalize(req.CounterpartName, 200);
            if (name is null) return Bad("Counterpart name is required.");

            var direction = NormalizeFrom(req.Direction, LoanDirections) ?? "out";
            if (req.ReturnedOn is { } returned && returned < req.LentOn) return Bad("Return date cannot precede the lending date.");

            var now = DateTimeOffset.UtcNow;
            var loan = new LibraryLoan
            {
                OwnerAccountId = userId,
                CopyId = copyId,
                Direction = direction,
                CounterpartName = name,
                CounterpartContact = Normalize(req.CounterpartContact, 200),
                LentOn = req.LentOn,
                DueOn = req.DueOn,
                ReturnedOn = req.ReturnedOn,
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryLoans.Add(loan);

            SyncCopyStatusForLoan(copy, loan);
            copy.UpdatedUtc = now;

            await db.SaveChangesAsync(ct);
            return Results.Ok(ToResponse(loan));
        });

        group.MapPut("/loans/{id:long}", async (long id, LibraryLoanSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var loan = await db.LibraryLoans.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (loan is null) return Results.NotFound();

            var name = Normalize(req.CounterpartName, 200);
            if (name is null) return Bad("Counterpart name is required.");
            if (req.ReturnedOn is { } returned && returned < req.LentOn) return Bad("Return date cannot precede the lending date.");

            loan.Direction = NormalizeFrom(req.Direction, LoanDirections) ?? "out";
            loan.CounterpartName = name;
            loan.CounterpartContact = Normalize(req.CounterpartContact, 200);
            loan.LentOn = req.LentOn;
            loan.DueOn = req.DueOn;
            loan.ReturnedOn = req.ReturnedOn;
            loan.Notes = NormalizeText(req.Notes);
            loan.UpdatedUtc = DateTimeOffset.UtcNow;

            var copy = await db.LibraryCopies.FirstOrDefaultAsync(x => x.Id == loan.CopyId && x.OwnerAccountId == userId, ct);
            if (copy is not null)
            {
                var stillOpen = await db.LibraryLoans.AsNoTracking()
                    .AnyAsync(x => x.OwnerAccountId == userId && x.CopyId == copy.Id && x.Id != loan.Id && x.ReturnedOn == null, ct);
                if (!stillOpen) SyncCopyStatusForLoan(copy, loan);
                copy.UpdatedUtc = DateTimeOffset.UtcNow;
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(ToResponse(loan));
        });

        group.MapDelete("/loans/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var loan = await db.LibraryLoans.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (loan is null) return Results.NotFound();

            db.LibraryLoans.Remove(loan);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Readings ────────────────────────────────────────────────────────────

    private static void MapReadingEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/readings", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var readings = await db.LibraryReadings.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderByDescending(x => x.FinishedOn ?? x.StartedOn)
                .ThenByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var copyIds = readings.Select(x => x.CopyId).Distinct().ToList();
            var context = await LoadCopyContextAsync(db, userId, copyIds, ct);

            var items = readings.Select(reading =>
            {
                var info = context.GetValueOrDefault(reading.CopyId);
                return new LibraryReadingListItem(
                    reading.Id, reading.CopyId, info?.EditionId ?? 0, info?.EditionTitle ?? string.Empty,
                    info?.Authors ?? [], reading.StartedOn, reading.FinishedOn, reading.Rating, reading.Notes);
            }).ToList();

            return Results.Ok(items);
        });

        group.MapPost("/copies/{copyId:long}/readings", async (long copyId, LibraryReadingSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var copy = await db.LibraryCopies.FirstOrDefaultAsync(x => x.Id == copyId && x.OwnerAccountId == userId, ct);
            if (copy is null) return Results.NotFound();
            if (req.StartedOn is { } start && req.FinishedOn is { } finish && finish < start)
                return Bad("Finish date cannot precede the start date.");

            var now = DateTimeOffset.UtcNow;
            var reading = new LibraryReading
            {
                OwnerAccountId = userId,
                CopyId = copyId,
                StartedOn = req.StartedOn,
                FinishedOn = req.FinishedOn,
                Rating = NormalizeRating(req.Rating),
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryReadings.Add(reading);

            // Finishing a reading is the natural moment for the copy to become "read".
            if (reading.FinishedOn is not null) copy.ReadingStatus = "read";
            else if (reading.StartedOn is not null && copy.ReadingStatus == "unread") copy.ReadingStatus = "reading";
            if (reading.Rating is not null) copy.Rating = reading.Rating;
            copy.UpdatedUtc = now;

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { id = reading.Id });
        });

        group.MapPut("/readings/{id:long}", async (long id, LibraryReadingSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var reading = await db.LibraryReadings.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (reading is null) return Results.NotFound();
            if (req.StartedOn is { } start && req.FinishedOn is { } finish && finish < start)
                return Bad("Finish date cannot precede the start date.");

            reading.StartedOn = req.StartedOn;
            reading.FinishedOn = req.FinishedOn;
            reading.Rating = NormalizeRating(req.Rating);
            reading.Notes = NormalizeText(req.Notes);
            reading.UpdatedUtc = DateTimeOffset.UtcNow;

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { id = reading.Id });
        });

        group.MapDelete("/readings/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var reading = await db.LibraryReadings.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (reading is null) return Results.NotFound();

            db.LibraryReadings.Remove(reading);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Overview ────────────────────────────────────────────────────────────

    private static void MapOverviewEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/overview", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var works = await db.LibraryWorks.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.Kind, x.OriginalLanguage })
                .ToListAsync(ct);
            var editions = await db.LibraryEditions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.WorkId, x.Language })
                .ToListAsync(ct);
            var copies = await db.LibraryCopies.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.EditionId, x.ShelfId, x.ReadingStatus })
                .ToListAsync(ct);

            var originalLanguageByWork = works.ToDictionary(x => x.Id, x => x.OriginalLanguage);
            var translations = editions.Count(e =>
                originalLanguageByWork.TryGetValue(e.WorkId, out var original) &&
                !string.Equals(e.Language, original, StringComparison.Ordinal));

            var loans = await db.LibraryLoans.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.ReturnedOn == null)
                .Select(x => new { x.Direction, x.DueOn })
                .ToListAsync(ct);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var shelves = await db.LibraryShelves.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.Name })
                .ToListAsync(ct);
            var shelfNames = shelves.ToDictionary(x => x.Id, x => x.Name);

            var languageOfEdition = editions.ToDictionary(x => x.Id, x => x.Language);
            var byLanguage = copies
                .Select(c => languageOfEdition.GetValueOrDefault(c.EditionId) ?? string.Empty)
                .Where(x => x.Length > 0)
                .GroupBy(x => x)
                .Select(g => new LibraryCountByKey(g.Key, g.Key, g.Count()))
                .OrderByDescending(x => x.Count).ThenBy(x => x.Key, StringComparer.Ordinal)
                .ToList();

            var byOriginalLanguage = works
                .Where(x => x.OriginalLanguage.Length > 0)
                .GroupBy(x => x.OriginalLanguage)
                .Select(g => new LibraryCountByKey(g.Key, g.Key, g.Count()))
                .OrderByDescending(x => x.Count).ThenBy(x => x.Key, StringComparer.Ordinal)
                .ToList();

            var byKind = works
                .GroupBy(x => x.Kind)
                .Select(g => new LibraryCountByKey(g.Key, g.Key, g.Count()))
                .OrderByDescending(x => x.Count).ThenBy(x => x.Key, StringComparer.Ordinal)
                .ToList();

            var byShelf = copies
                .GroupBy(x => x.ShelfId)
                .Select(g => new LibraryCountByKey(
                    g.Key?.ToString() ?? string.Empty,
                    g.Key is { } id ? shelfNames.GetValueOrDefault(id, string.Empty) : string.Empty,
                    g.Count()))
                .OrderByDescending(x => x.Count)
                .ToList();

            var authorContributions = await db.LibraryContributions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.TargetType == "work" && AuthorRoles.Contains(x.Role))
                .Select(x => x.PersonId)
                .ToListAsync(ct);
            var topAuthorIds = authorContributions
                .GroupBy(x => x)
                .OrderByDescending(g => g.Count())
                .Take(10)
                .Select(g => new { PersonId = g.Key, Count = g.Count() })
                .ToList();
            var topAuthorNames = await db.LibraryPeople.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && topAuthorIds.Select(a => a.PersonId).Contains(x.Id))
                .Select(x => new { x.Id, x.DisplayName })
                .ToListAsync(ct);
            var nameById = topAuthorNames.ToDictionary(x => x.Id, x => x.DisplayName);
            var topAuthors = topAuthorIds
                .Select(x => new LibraryCountByKey(x.PersonId.ToString(), nameById.GetValueOrDefault(x.PersonId, string.Empty), x.Count))
                .Where(x => x.Label.Length > 0)
                .ToList();

            var recentCopies = await db.LibraryCopies.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(8)
                .ToListAsync(ct);
            var recentlyAdded = await BuildCopyListAsync(db, userId, recentCopies, ct);

            var peopleCount = await db.LibraryPeople.CountAsync(x => x.OwnerAccountId == userId, ct);
            var publisherCount = await db.LibraryPublishers.CountAsync(x => x.OwnerAccountId == userId, ct);
            var tagCount = await db.LibraryTags.CountAsync(x => x.OwnerAccountId == userId, ct);

            return Results.Ok(new LibraryOverviewResponse(
                works.Count, editions.Count, copies.Count,
                peopleCount, publisherCount, shelves.Count, tagCount,
                translations,
                loans.Count(x => x.Direction == "out"),
                loans.Count(x => x.Direction == "in"),
                loans.Count(x => x.DueOn is { } due && due < today),
                copies.Count(x => x.ReadingStatus == "read"),
                copies.Count(x => x.ReadingStatus == "reading"),
                copies.Count(x => x.ReadingStatus == "unread"),
                byLanguage, byOriginalLanguage, byKind, byShelf, topAuthors, recentlyAdded));
        });
    }

    // ── Barcode scanning ────────────────────────────────────────────────────

    private static void MapScanEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/scan", async (
            string? code,
            bool? lookup,
            HttpContext ctx,
            RecreatioDbContext db,
            IBookLookupService lookupService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var isbn = lookupService.NormalizeIsbn(code);
            if (isbn is null) return Bad("The scanned code is not a valid ISBN.");

            // Match on the ISBN as stored and on its bare digits, so a catalogued
            // "978-83-06-01234-5" is still found by a scanner that reports digits only.
            var editions = await db.LibraryEditions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.Isbn != null)
                .ToListAsync(ct);
            var matched = editions
                .Where(x => string.Equals(CompactIsbn(x.Isbn), isbn, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var matchingEditions = new List<LibraryEditionListItem>();
            var ownedCopies = new List<LibraryCopyListItem>();

            if (matched.Count > 0)
            {
                var workIds = matched.Select(x => x.WorkId).Distinct().ToList();
                var originalLanguages = await db.LibraryWorks.AsNoTracking()
                    .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.OriginalLanguage })
                    .ToListAsync(ct);
                var originalLanguageByWork = originalLanguages.ToDictionary(x => x.Id, x => x.OriginalLanguage);

                foreach (var workId in workIds)
                {
                    var forWork = await LoadEditionListAsync(
                        db, userId, workId, originalLanguageByWork.GetValueOrDefault(workId, string.Empty), ct);
                    matchingEditions.AddRange(forWork.Where(edition => matched.Any(x => x.Id == edition.Id)));
                }

                var editionIds = matched.Select(x => x.Id).ToList();
                var copies = await db.LibraryCopies.AsNoTracking()
                    .Where(x => x.OwnerAccountId == userId && editionIds.Contains(x.EditionId))
                    .OrderBy(x => x.CreatedUtc)
                    .ToListAsync(ct);
                ownedCopies = await BuildCopyListAsync(db, userId, copies, ct);
            }

            // Skip the outbound call when the shelf already answers the question,
            // unless the caller explicitly asks for metadata anyway.
            var shouldLookup = lookupService.Enabled && (lookup ?? matched.Count == 0);
            LibraryLookupResponse? lookupResponse = null;
            if (shouldLookup)
            {
                var result = await lookupService.LookupAsync(isbn, ct);
                if (result is not null)
                {
                    lookupResponse = new LibraryLookupResponse(
                        result.Isbn, result.Title, result.Subtitle, result.Authors, result.Publisher,
                        result.PublishedPlace, result.PublishedYear, result.PageCount, result.Language,
                        result.Series, result.CoverUrl, result.Sources);
                }
            }

            return Results.Ok(new LibraryScanResponse(isbn, matchingEditions, ownedCopies, lookupResponse, shouldLookup));
        });

        group.MapPost("/scan/import", async (
            LibraryScanImportRequest req,
            HttpContext ctx,
            RecreatioDbContext db,
            IBookLookupService lookupService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var isbn = lookupService.NormalizeIsbn(req.Isbn);
            if (isbn is null) return Bad("The scanned code is not a valid ISBN.");

            var originalTitle = Normalize(req.OriginalTitle, 400);
            if (originalTitle is null) return Bad("Original title is required.");

            var originalLanguage = NormalizeLanguage(req.OriginalLanguage);
            if (originalLanguage is null) return Bad("Original language is required.");

            var editionTitle = Normalize(req.EditionTitle, 400) ?? originalTitle;
            var editionLanguage = NormalizeLanguage(req.EditionLanguage) ?? originalLanguage;

            if (req.ShelfId is { } shelfId)
            {
                var shelfExists = await db.LibraryShelves.AnyAsync(x => x.Id == shelfId && x.OwnerAccountId == userId, ct);
                if (!shelfExists) return Bad("Shelf does not exist.");
            }

            var now = DateTimeOffset.UtcNow;

            var work = new LibraryWork
            {
                OwnerAccountId = userId,
                OriginalTitle = originalTitle,
                OriginalLanguage = originalLanguage,
                Kind = NormalizeFrom(req.Kind, WorkKinds) ?? "book",
                FirstPublishedYear = NormalizeYear(req.FirstPublishedYear),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryWorks.Add(work);
            await db.SaveChangesAsync(ct);

            await AttachContributorsAsync(db, userId, "work", work.Id, req.AuthorNames, "author", 0, now, ct);

            var publisherId = await ResolvePublisherIdAsync(db, userId, req.PublisherName, now, ct);

            var edition = new LibraryEdition
            {
                OwnerAccountId = userId,
                WorkId = work.Id,
                Title = editionTitle,
                Subtitle = Normalize(req.EditionSubtitle, 400),
                Language = editionLanguage,
                PublisherId = publisherId,
                PublishedPlace = Normalize(req.PublishedPlace, 160),
                PublishedYear = NormalizeYear(req.PublishedYear),
                Isbn = isbn,
                Series = Normalize(req.Series, 200),
                PageCount = NormalizePositive(req.PageCount, 100000),
                CoverUrl = NormalizeUrl(req.CoverUrl),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryEditions.Add(edition);
            await db.SaveChangesAsync(ct);

            await AttachContributorsAsync(db, userId, "edition", edition.Id, req.TranslatorNames, "translator", 0, now, ct);

            long? copyId = null;
            if (req.CreateCopy)
            {
                var copy = new LibraryCopy
                {
                    OwnerAccountId = userId,
                    EditionId = edition.Id,
                    ShelfId = req.ShelfId,
                    Status = "shelf",
                    ReadingStatus = "unread",
                    Barcode = isbn,
                    AcquiredDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryCopies.Add(copy);
                await db.SaveChangesAsync(ct);
                copyId = copy.Id;
            }

            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryScanImportResponse(work.Id, edition.Id, copyId));
        });
    }

    /// <summary>
    /// Resolves contributor names to people, reusing an existing person when the
    /// display name already matches so a scan does not create duplicate authors.
    /// </summary>
    private static async Task AttachContributorsAsync(
        RecreatioDbContext db,
        Guid userId,
        string targetType,
        long targetId,
        IReadOnlyList<string> names,
        string role,
        int startOrder,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var sortOrder = startOrder;
        foreach (var rawName in names)
        {
            var name = Normalize(rawName, 240);
            if (name is null) continue;

            var person = await db.LibraryPeople
                .FirstOrDefaultAsync(x => x.OwnerAccountId == userId && x.DisplayName == name, ct);
            if (person is null)
            {
                person = new LibraryPerson
                {
                    OwnerAccountId = userId,
                    DisplayName = name,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryPeople.Add(person);
                await db.SaveChangesAsync(ct);
            }

            db.LibraryContributions.Add(new LibraryContribution
            {
                OwnerAccountId = userId,
                PersonId = person.Id,
                TargetType = targetType,
                TargetId = targetId,
                Role = role,
                SortOrder = sortOrder++,
                CreatedUtc = now
            });
        }

        if (sortOrder > startOrder) await db.SaveChangesAsync(ct);
    }

    private static async Task<long?> ResolvePublisherIdAsync(
        RecreatioDbContext db,
        Guid userId,
        string? rawName,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var name = Normalize(rawName, 240);
        if (name is null) return null;

        var existing = await db.LibraryPublishers
            .FirstOrDefaultAsync(x => x.OwnerAccountId == userId && x.Name == name, ct);
        if (existing is not null) return existing.Id;

        var publisher = new LibraryPublisher
        {
            OwnerAccountId = userId,
            Name = name,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.LibraryPublishers.Add(publisher);
        await db.SaveChangesAsync(ct);
        return publisher.Id;
    }

    /// <summary>Strips separators so stored and scanned ISBNs compare equal.</summary>
    private static string CompactIsbn(string? value) =>
        value is null ? string.Empty : new string(value.Where(char.IsAsciiLetterOrDigit).ToArray()).ToUpperInvariant();

    // ── Import / export ─────────────────────────────────────────────────────

    private static void MapTransferEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/export", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var people = await db.LibraryPeople.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var publishers = await db.LibraryPublishers.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var shelves = await db.LibraryShelves.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var tags = await db.LibraryTags.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var works = await db.LibraryWorks.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var editions = await db.LibraryEditions.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var copies = await db.LibraryCopies.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var loans = await db.LibraryLoans.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var readings = await db.LibraryReadings.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var contributions = await db.LibraryContributions.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);
            var workTags = await db.LibraryWorkTags.AsNoTracking().Where(x => x.OwnerAccountId == userId).ToListAsync(ct);

            var loansByCopy = loans.GroupBy(x => x.CopyId).ToDictionary(g => g.Key, g => g.ToList());
            var readingsByCopy = readings.GroupBy(x => x.CopyId).ToDictionary(g => g.Key, g => g.ToList());
            var copiesByEdition = copies.GroupBy(x => x.EditionId).ToDictionary(g => g.Key, g => g.ToList());
            var editionsByWork = editions.GroupBy(x => x.WorkId).ToDictionary(g => g.Key, g => g.ToList());
            var tagsByWork = workTags.GroupBy(x => x.WorkId).ToDictionary(g => g.Key, g => g.Select(t => t.TagId).ToList());
            var contributionsByTarget = contributions
                .GroupBy(x => (x.TargetType, x.TargetId))
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.SortOrder).ToList());

            LibraryExportContribution[] ExportContributions(string targetType, long targetId) =>
                contributionsByTarget.TryGetValue((targetType, targetId), out var list)
                    ? list.Select(x => new LibraryExportContribution(x.PersonId, x.Role, x.SortOrder)).ToArray()
                    : [];

            var exportWorks = works.Select(work => new LibraryExportWork(
                work.Id, work.OriginalTitle, work.OriginalSubtitle, work.OriginalLanguage,
                work.UniformTitle, work.Kind, work.FirstPublishedYear, work.Notes,
                ExportContributions("work", work.Id),
                tagsByWork.GetValueOrDefault(work.Id) ?? [],
                (editionsByWork.GetValueOrDefault(work.Id) ?? []).Select(edition => new LibraryExportEdition(
                    edition.Id, edition.Title, edition.Subtitle, edition.Language, edition.PublisherId,
                    edition.PublishedPlace, edition.PublishedYear, edition.EditionStatement, edition.Series,
                    edition.SeriesNumber, edition.Isbn, edition.Issn, edition.PageCount, edition.Volume,
                    edition.Binding, edition.CoverUrl, edition.Notes,
                    ExportContributions("edition", edition.Id),
                    (copiesByEdition.GetValueOrDefault(edition.Id) ?? []).Select(copy => new LibraryExportCopy(
                        copy.Id, copy.ShelfId, copy.Signature, copy.Status, copy.Condition, copy.AcquiredDate,
                        copy.AcquiredFrom, copy.Price, copy.Currency, copy.Barcode, copy.ReadingStatus,
                        copy.Rating, copy.IsFavourite, copy.Notes,
                        (loansByCopy.GetValueOrDefault(copy.Id) ?? []).Select(loan => new LibraryLoanSaveRequest(
                            loan.Direction, loan.CounterpartName, loan.CounterpartContact,
                            loan.LentOn, loan.DueOn, loan.ReturnedOn, loan.Notes)).ToArray(),
                        (readingsByCopy.GetValueOrDefault(copy.Id) ?? []).Select(reading => new LibraryReadingSaveRequest(
                            reading.StartedOn, reading.FinishedOn, reading.Rating, reading.Notes)).ToArray()
                    )).ToArray()
                )).ToArray()
            )).ToList();

            var bundle = new LibraryExportBundle(
                "recreatio-library",
                1,
                DateTimeOffset.UtcNow,
                people.Select(x => new LibraryExportPerson(x.Id, x.DisplayName, x.SortName, x.BirthYear, x.DeathYear, x.Nationality, x.Notes)).ToList(),
                publishers.Select(x => new LibraryExportPublisher(x.Id, x.Name, x.City, x.Notes)).ToList(),
                shelves.Select(x => new LibraryExportShelf(x.Id, x.Name, x.Location, x.Description, x.SortOrder)).ToList(),
                tags.Select(x => new LibraryExportTag(x.Id, x.Name, x.Color)).ToList(),
                exportWorks);

            return Results.Ok(bundle);
        });

        group.MapPost("/import", async (LibraryExportBundle bundle, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            if (!string.Equals(bundle.Format, "recreatio-library", StringComparison.Ordinal))
                return Bad("Unrecognised bundle format.");

            var now = DateTimeOffset.UtcNow;
            var counts = new int[9];

            // Imported rows always get fresh identities; the bundle's ids are only
            // used to rebuild relationships inside the bundle itself.
            var personIdMap = new Dictionary<long, long>();
            foreach (var item in bundle.People)
            {
                var displayName = Normalize(item.DisplayName, 240);
                if (displayName is null) continue;
                var person = new LibraryPerson
                {
                    OwnerAccountId = userId,
                    DisplayName = displayName,
                    SortName = Normalize(item.SortName, 240),
                    BirthYear = NormalizeYear(item.BirthYear),
                    DeathYear = NormalizeYear(item.DeathYear),
                    Nationality = Normalize(item.Nationality, 80),
                    Notes = NormalizeText(item.Notes),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryPeople.Add(person);
                await db.SaveChangesAsync(ct);
                personIdMap[item.Id] = person.Id;
                counts[0]++;
            }

            var publisherIdMap = new Dictionary<long, long>();
            foreach (var item in bundle.Publishers)
            {
                var name = Normalize(item.Name, 240);
                if (name is null) continue;
                var publisher = new LibraryPublisher
                {
                    OwnerAccountId = userId,
                    Name = name,
                    City = Normalize(item.City, 160),
                    Notes = NormalizeText(item.Notes),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryPublishers.Add(publisher);
                await db.SaveChangesAsync(ct);
                publisherIdMap[item.Id] = publisher.Id;
                counts[1]++;
            }

            var shelfIdMap = new Dictionary<long, long>();
            foreach (var item in bundle.Shelves)
            {
                var name = Normalize(item.Name, 160);
                if (name is null) continue;
                var shelf = new LibraryShelf
                {
                    OwnerAccountId = userId,
                    Name = name,
                    Location = Normalize(item.Location, 240),
                    Description = NormalizeText(item.Description),
                    SortOrder = item.SortOrder,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryShelves.Add(shelf);
                await db.SaveChangesAsync(ct);
                shelfIdMap[item.Id] = shelf.Id;
                counts[2]++;
            }

            var tagIdMap = new Dictionary<long, long>();
            foreach (var item in bundle.Tags)
            {
                var name = Normalize(item.Name, 120);
                if (name is null) continue;
                var existing = await db.LibraryTags.FirstOrDefaultAsync(x => x.OwnerAccountId == userId && x.Name == name, ct);
                if (existing is not null)
                {
                    tagIdMap[item.Id] = existing.Id;
                    continue;
                }
                var tag = new LibraryTag
                {
                    OwnerAccountId = userId,
                    Name = name,
                    Color = Normalize(item.Color, 16),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryTags.Add(tag);
                await db.SaveChangesAsync(ct);
                tagIdMap[item.Id] = tag.Id;
                counts[3]++;
            }

            foreach (var workItem in bundle.Works)
            {
                var title = Normalize(workItem.OriginalTitle, 400);
                var language = NormalizeLanguage(workItem.OriginalLanguage);
                if (title is null || language is null) continue;

                var work = new LibraryWork
                {
                    OwnerAccountId = userId,
                    OriginalTitle = title,
                    OriginalSubtitle = Normalize(workItem.OriginalSubtitle, 400),
                    OriginalLanguage = language,
                    UniformTitle = Normalize(workItem.UniformTitle, 400),
                    Kind = NormalizeFrom(workItem.Kind, WorkKinds) ?? "book",
                    FirstPublishedYear = NormalizeYear(workItem.FirstPublishedYear),
                    Notes = NormalizeText(workItem.Notes),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryWorks.Add(work);
                await db.SaveChangesAsync(ct);
                counts[4]++;

                AddImportedContributions(db, userId, personIdMap, "work", work.Id, workItem.Contributions, now);

                foreach (var bundleTagId in workItem.TagIds)
                {
                    if (!tagIdMap.TryGetValue(bundleTagId, out var tagId)) continue;
                    db.LibraryWorkTags.Add(new LibraryWorkTag
                    {
                        OwnerAccountId = userId,
                        WorkId = work.Id,
                        TagId = tagId,
                        CreatedUtc = now
                    });
                }

                foreach (var editionItem in workItem.Editions)
                {
                    var editionTitle = Normalize(editionItem.Title, 400);
                    var editionLanguage = NormalizeLanguage(editionItem.Language);
                    if (editionTitle is null || editionLanguage is null) continue;

                    var edition = new LibraryEdition
                    {
                        OwnerAccountId = userId,
                        WorkId = work.Id,
                        Title = editionTitle,
                        Subtitle = Normalize(editionItem.Subtitle, 400),
                        Language = editionLanguage,
                        PublisherId = editionItem.PublisherId is { } bundlePublisherId && publisherIdMap.TryGetValue(bundlePublisherId, out var mappedPublisher)
                            ? mappedPublisher
                            : null,
                        PublishedPlace = Normalize(editionItem.PublishedPlace, 160),
                        PublishedYear = NormalizeYear(editionItem.PublishedYear),
                        EditionStatement = Normalize(editionItem.EditionStatement, 160),
                        Series = Normalize(editionItem.Series, 200),
                        SeriesNumber = Normalize(editionItem.SeriesNumber, 60),
                        Isbn = NormalizeIsbn(editionItem.Isbn),
                        Issn = Normalize(editionItem.Issn, 32),
                        PageCount = NormalizePositive(editionItem.PageCount, 100000),
                        Volume = Normalize(editionItem.Volume, 60),
                        Binding = NormalizeFrom(editionItem.Binding, Bindings),
                        CoverUrl = NormalizeUrl(editionItem.CoverUrl),
                        Notes = NormalizeText(editionItem.Notes),
                        CreatedUtc = now,
                        UpdatedUtc = now
                    };
                    db.LibraryEditions.Add(edition);
                    await db.SaveChangesAsync(ct);
                    counts[5]++;

                    AddImportedContributions(db, userId, personIdMap, "edition", edition.Id, editionItem.Contributions, now);

                    foreach (var copyItem in editionItem.Copies)
                    {
                        var copy = new LibraryCopy
                        {
                            OwnerAccountId = userId,
                            EditionId = edition.Id,
                            ShelfId = copyItem.ShelfId is { } bundleShelfId && shelfIdMap.TryGetValue(bundleShelfId, out var mappedShelf)
                                ? mappedShelf
                                : null,
                            Signature = Normalize(copyItem.Signature, 80),
                            Status = NormalizeFrom(copyItem.Status, CopyStatuses) ?? "shelf",
                            Condition = NormalizeFrom(copyItem.Condition, CopyConditions),
                            AcquiredDate = copyItem.AcquiredDate,
                            AcquiredFrom = Normalize(copyItem.AcquiredFrom, 200),
                            Price = NormalizePrice(copyItem.Price),
                            Currency = Normalize(copyItem.Currency, 8),
                            Barcode = Normalize(copyItem.Barcode, 64),
                            ReadingStatus = NormalizeFrom(copyItem.ReadingStatus, ReadingStatuses) ?? "unread",
                            Rating = NormalizeRating(copyItem.Rating),
                            IsFavourite = copyItem.IsFavourite,
                            Notes = NormalizeText(copyItem.Notes),
                            CreatedUtc = now,
                            UpdatedUtc = now
                        };
                        db.LibraryCopies.Add(copy);
                        await db.SaveChangesAsync(ct);
                        counts[6]++;

                        foreach (var loanItem in copyItem.Loans)
                        {
                            var counterpart = Normalize(loanItem.CounterpartName, 200);
                            if (counterpart is null) continue;
                            db.LibraryLoans.Add(new LibraryLoan
                            {
                                OwnerAccountId = userId,
                                CopyId = copy.Id,
                                Direction = NormalizeFrom(loanItem.Direction, LoanDirections) ?? "out",
                                CounterpartName = counterpart,
                                CounterpartContact = Normalize(loanItem.CounterpartContact, 200),
                                LentOn = loanItem.LentOn,
                                DueOn = loanItem.DueOn,
                                ReturnedOn = loanItem.ReturnedOn,
                                Notes = NormalizeText(loanItem.Notes),
                                CreatedUtc = now,
                                UpdatedUtc = now
                            });
                            counts[7]++;
                        }

                        foreach (var readingItem in copyItem.Readings)
                        {
                            db.LibraryReadings.Add(new LibraryReading
                            {
                                OwnerAccountId = userId,
                                CopyId = copy.Id,
                                StartedOn = readingItem.StartedOn,
                                FinishedOn = readingItem.FinishedOn,
                                Rating = NormalizeRating(readingItem.Rating),
                                Notes = NormalizeText(readingItem.Notes),
                                CreatedUtc = now,
                                UpdatedUtc = now
                            });
                            counts[8]++;
                        }
                    }
                }
            }

            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryImportResponse(
                counts[0], counts[1], counts[2], counts[3], counts[4], counts[5], counts[6], counts[7], counts[8]));
        });
    }

    // ── Shared loaders ──────────────────────────────────────────────────────

    private sealed record CopyContext(long EditionId, string EditionTitle, IReadOnlyList<string> Authors);

    /// <summary>Author names for a set of works, ordered as entered.</summary>
    private static async Task<Dictionary<long, List<string>>> LoadAuthorNamesAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> workIds, CancellationToken ct)
    {
        if (workIds.Count == 0) return [];

        var contributions = await db.LibraryContributions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.TargetType == "work"
                && workIds.Contains(x.TargetId) && AuthorRoles.Contains(x.Role))
            .OrderBy(x => x.SortOrder)
            .Select(x => new { x.TargetId, x.PersonId })
            .ToListAsync(ct);

        var personIds = contributions.Select(x => x.PersonId).Distinct().ToList();
        var names = await db.LibraryPeople.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && personIds.Contains(x.Id))
            .Select(x => new { x.Id, x.DisplayName })
            .ToListAsync(ct);
        var nameById = names.ToDictionary(x => x.Id, x => x.DisplayName);

        return contributions
            .GroupBy(x => x.TargetId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => nameById.GetValueOrDefault(x.PersonId))
                      .Where(x => !string.IsNullOrEmpty(x))
                      .Select(x => x!)
                      .ToList());
    }

    private static async Task<Dictionary<long, List<LibraryTagResponse>>> LoadTagsByWorkAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> workIds, CancellationToken ct)
    {
        if (workIds.Count == 0) return [];

        var links = await db.LibraryWorkTags.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.WorkId))
            .Select(x => new { x.WorkId, x.TagId })
            .ToListAsync(ct);

        var tagIds = links.Select(x => x.TagId).Distinct().ToList();
        var tags = await db.LibraryTags.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && tagIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.Color })
            .ToListAsync(ct);
        var tagById = tags.ToDictionary(x => x.Id, x => new LibraryTagResponse(x.Id, x.Name, x.Color, 0));

        return links
            .GroupBy(x => x.WorkId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => tagById.GetValueOrDefault(x.TagId))
                      .Where(x => x is not null)
                      .Select(x => x!)
                      .OrderBy(x => x.Name, StringComparer.CurrentCulture)
                      .ToList());
    }

    private static async Task<Dictionary<long, List<LibraryContributionResponse>>> LoadContributionsAsync(
        RecreatioDbContext db, Guid userId, string targetType, IReadOnlyList<long> targetIds, CancellationToken ct)
    {
        if (targetIds.Count == 0) return [];

        var contributions = await db.LibraryContributions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.TargetType == targetType && targetIds.Contains(x.TargetId))
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var personIds = contributions.Select(x => x.PersonId).Distinct().ToList();
        var names = await db.LibraryPeople.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && personIds.Contains(x.Id))
            .Select(x => new { x.Id, x.DisplayName })
            .ToListAsync(ct);
        var nameById = names.ToDictionary(x => x.Id, x => x.DisplayName);

        return contributions
            .GroupBy(x => x.TargetId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => new LibraryContributionResponse(
                        x.Id, x.PersonId, nameById.GetValueOrDefault(x.PersonId, string.Empty), x.Role, x.SortOrder))
                      .ToList());
    }

    private static async Task<List<LibraryEditionListItem>> LoadEditionListAsync(
        RecreatioDbContext db, Guid userId, long workId, string originalLanguage, CancellationToken ct)
    {
        var editions = await db.LibraryEditions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.WorkId == workId)
            .OrderBy(x => x.Language).ThenBy(x => x.PublishedYear)
            .ToListAsync(ct);
        if (editions.Count == 0) return [];

        var editionIds = editions.Select(x => x.Id).ToList();

        var publisherIds = editions.Where(x => x.PublisherId != null).Select(x => x.PublisherId!.Value).Distinct().ToList();
        var publishers = await db.LibraryPublishers.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && publisherIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        var publisherById = publishers.ToDictionary(x => x.Id, x => x.Name);

        var copyCounts = await db.LibraryCopies.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && editionIds.Contains(x.EditionId))
            .GroupBy(x => x.EditionId)
            .Select(g => new { EditionId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var copyCountById = copyCounts.ToDictionary(x => x.EditionId, x => x.Count);

        var contributionsByEdition = await LoadContributionsAsync(db, userId, "edition", editionIds, ct);

        return editions.Select(edition => new LibraryEditionListItem(
            edition.Id, edition.WorkId, edition.Title, edition.Subtitle, edition.Language,
            !string.Equals(edition.Language, originalLanguage, StringComparison.Ordinal),
            edition.PublisherId,
            edition.PublisherId is { } pid ? publisherById.GetValueOrDefault(pid) : null,
            edition.PublishedPlace, edition.PublishedYear, edition.EditionStatement, edition.Isbn,
            edition.PageCount, edition.Binding,
            (contributionsByEdition.GetValueOrDefault(edition.Id) ?? [])
                .Where(x => x.Role == "translator")
                .Select(x => x.PersonName)
                .ToList(),
            copyCountById.GetValueOrDefault(edition.Id, 0))).ToList();
    }

    private static async Task<Dictionary<long, List<LibraryCopyResponse>>> LoadCopiesAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> editionIds, CancellationToken ct)
    {
        if (editionIds.Count == 0) return [];

        var copies = await db.LibraryCopies.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && editionIds.Contains(x.EditionId))
            .OrderBy(x => x.CreatedUtc)
            .ToListAsync(ct);
        if (copies.Count == 0) return [];

        var shelfNames = await LoadShelfNamesAsync(db, userId, copies.Select(x => x.ShelfId), ct);
        var openLoans = await LoadOpenLoansAsync(db, userId, copies.Select(x => x.Id).ToList(), ct);

        return copies
            .GroupBy(x => x.EditionId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(copy => new LibraryCopyResponse(
                        copy.Id, copy.EditionId, copy.ShelfId,
                        copy.ShelfId is { } sid ? shelfNames.GetValueOrDefault(sid) : null,
                        copy.Signature, copy.Status, copy.Condition, copy.AcquiredDate, copy.AcquiredFrom,
                        copy.Price, copy.Currency, copy.Barcode, copy.ReadingStatus, copy.Rating,
                        copy.IsFavourite, copy.Notes,
                        openLoans.GetValueOrDefault(copy.Id)))
                      .ToList());
    }

    /// <summary>Turns copy rows into browse items, resolving edition, work, author and shelf.</summary>
    private static async Task<List<LibraryCopyListItem>> BuildCopyListAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<LibraryCopy> copies, CancellationToken ct)
    {
        if (copies.Count == 0) return [];

        var editionIds = copies.Select(x => x.EditionId).Distinct().ToList();
        var editions = await db.LibraryEditions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && editionIds.Contains(x.Id))
            .ToListAsync(ct);
        var editionById = editions.ToDictionary(x => x.Id);

        var workIds = editions.Select(x => x.WorkId).Distinct().ToList();
        var works = await db.LibraryWorks.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.Id))
            .Select(x => new { x.Id, x.OriginalTitle, x.OriginalLanguage })
            .ToListAsync(ct);
        var workById = works.ToDictionary(x => x.Id);

        var publisherIds = editions.Where(x => x.PublisherId != null).Select(x => x.PublisherId!.Value).Distinct().ToList();
        var publishers = await db.LibraryPublishers.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && publisherIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        var publisherById = publishers.ToDictionary(x => x.Id, x => x.Name);

        var authorsByWork = await LoadAuthorNamesAsync(db, userId, workIds, ct);
        var shelfNames = await LoadShelfNamesAsync(db, userId, copies.Select(x => x.ShelfId), ct);
        var openLoans = await LoadOpenLoansAsync(db, userId, copies.Select(x => x.Id).ToList(), ct);

        return copies.Select(copy =>
        {
            var edition = editionById.GetValueOrDefault(copy.EditionId);
            var work = edition is not null ? workById.GetValueOrDefault(edition.WorkId) : null;
            return new LibraryCopyListItem(
                copy.Id, copy.EditionId, edition?.WorkId ?? 0,
                edition?.Title ?? string.Empty,
                work?.OriginalTitle ?? string.Empty,
                edition?.Language ?? string.Empty,
                edition is not null && work is not null &&
                    !string.Equals(edition.Language, work.OriginalLanguage, StringComparison.Ordinal),
                (edition is not null ? authorsByWork.GetValueOrDefault(edition.WorkId) : null) ?? [],
                edition?.PublisherId is { } pid ? publisherById.GetValueOrDefault(pid) : null,
                edition?.PublishedYear,
                copy.ShelfId,
                copy.ShelfId is { } sid ? shelfNames.GetValueOrDefault(sid) : null,
                copy.Signature, copy.Status, copy.Condition, copy.ReadingStatus, copy.Rating, copy.IsFavourite,
                openLoans.GetValueOrDefault(copy.Id));
        }).ToList();
    }

    private static async Task<Dictionary<long, CopyContext>> LoadCopyContextAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> copyIds, CancellationToken ct)
    {
        if (copyIds.Count == 0) return [];

        var copies = await db.LibraryCopies.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && copyIds.Contains(x.Id))
            .Select(x => new { x.Id, x.EditionId })
            .ToListAsync(ct);

        var editionIds = copies.Select(x => x.EditionId).Distinct().ToList();
        var editions = await db.LibraryEditions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && editionIds.Contains(x.Id))
            .Select(x => new { x.Id, x.WorkId, x.Title })
            .ToListAsync(ct);
        var editionById = editions.ToDictionary(x => x.Id);

        var authorsByWork = await LoadAuthorNamesAsync(db, userId, editions.Select(x => x.WorkId).Distinct().ToList(), ct);

        return copies.ToDictionary(
            copy => copy.Id,
            copy =>
            {
                var edition = editionById.GetValueOrDefault(copy.EditionId);
                return new CopyContext(
                    copy.EditionId,
                    edition?.Title ?? string.Empty,
                    (edition is not null ? authorsByWork.GetValueOrDefault(edition.WorkId) : null) ?? []);
            });
    }

    private static async Task<Dictionary<long, string>> LoadShelfNamesAsync(
        RecreatioDbContext db, Guid userId, IEnumerable<long?> shelfIds, CancellationToken ct)
    {
        var ids = shelfIds.Where(x => x != null).Select(x => x!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];

        var shelves = await db.LibraryShelves.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && ids.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        return shelves.ToDictionary(x => x.Id, x => x.Name);
    }

    private static async Task<Dictionary<long, LibraryLoanResponse>> LoadOpenLoansAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> copyIds, CancellationToken ct)
    {
        if (copyIds.Count == 0) return [];

        var loans = await db.LibraryLoans.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && copyIds.Contains(x.CopyId) && x.ReturnedOn == null)
            .OrderByDescending(x => x.LentOn)
            .ToListAsync(ct);

        // Only the most recent open loan per copy is meaningful in a list row.
        return loans
            .GroupBy(x => x.CopyId)
            .ToDictionary(g => g.Key, g => ToResponse(g.First()));
    }

    // ── Shared mutations ────────────────────────────────────────────────────

    private static async Task<IResult?> ReplaceContributionsAsync(
        RecreatioDbContext db,
        Guid userId,
        string targetType,
        long targetId,
        IReadOnlyList<LibraryContributionSaveItem> items,
        CancellationToken ct)
    {
        var personIds = items.Select(x => x.PersonId).Distinct().ToList();
        if (personIds.Count > 0)
        {
            var known = await db.LibraryPeople.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && personIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (known.Count != personIds.Count) return Bad("One or more people do not exist.");
        }

        await db.LibraryContributions
            .Where(x => x.OwnerAccountId == userId && x.TargetType == targetType && x.TargetId == targetId)
            .ExecuteDeleteAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var sortOrder = 0;
        foreach (var item in items)
        {
            db.LibraryContributions.Add(new LibraryContribution
            {
                OwnerAccountId = userId,
                PersonId = item.PersonId,
                TargetType = targetType,
                TargetId = targetId,
                Role = NormalizeFrom(item.Role, ContributionRoles) ?? "author",
                SortOrder = sortOrder++,
                CreatedUtc = now
            });
        }

        return null;
    }

    private static void AddImportedContributions(
        RecreatioDbContext db,
        Guid userId,
        IReadOnlyDictionary<long, long> personIdMap,
        string targetType,
        long targetId,
        IReadOnlyList<LibraryExportContribution> items,
        DateTimeOffset now)
    {
        foreach (var item in items)
        {
            if (!personIdMap.TryGetValue(item.PersonId, out var personId)) continue;
            db.LibraryContributions.Add(new LibraryContribution
            {
                OwnerAccountId = userId,
                PersonId = personId,
                TargetType = targetType,
                TargetId = targetId,
                Role = NormalizeFrom(item.Role, ContributionRoles) ?? "author",
                SortOrder = item.SortOrder,
                CreatedUtc = now
            });
        }
    }

    private static async Task DeleteEditionCascadeAsync(RecreatioDbContext db, Guid userId, long editionId, CancellationToken ct)
    {
        var copyIds = await db.LibraryCopies.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.EditionId == editionId)
            .Select(x => x.Id)
            .ToListAsync(ct);

        if (copyIds.Count > 0)
        {
            await db.LibraryLoans.Where(x => x.OwnerAccountId == userId && copyIds.Contains(x.CopyId)).ExecuteDeleteAsync(ct);
            await db.LibraryReadings.Where(x => x.OwnerAccountId == userId && copyIds.Contains(x.CopyId)).ExecuteDeleteAsync(ct);
            await db.LibraryCopies.Where(x => x.OwnerAccountId == userId && x.EditionId == editionId).ExecuteDeleteAsync(ct);
        }

        await db.LibraryContributions
            .Where(x => x.OwnerAccountId == userId && x.TargetType == "edition" && x.TargetId == editionId)
            .ExecuteDeleteAsync(ct);
    }

    private static void ApplyCopy(LibraryCopy copy, LibraryCopySaveRequest req)
    {
        copy.ShelfId = req.ShelfId;
        copy.Signature = Normalize(req.Signature, 80);
        copy.Status = NormalizeFrom(req.Status, CopyStatuses) ?? "shelf";
        copy.Condition = NormalizeFrom(req.Condition, CopyConditions);
        copy.AcquiredDate = req.AcquiredDate;
        copy.AcquiredFrom = Normalize(req.AcquiredFrom, 200);
        copy.Price = NormalizePrice(req.Price);
        copy.Currency = Normalize(req.Currency, 8);
        copy.Barcode = Normalize(req.Barcode, 64);
        copy.ReadingStatus = NormalizeFrom(req.ReadingStatus, ReadingStatuses) ?? "unread";
        copy.Rating = NormalizeRating(req.Rating);
        copy.IsFavourite = req.IsFavourite;
        copy.Notes = NormalizeText(req.Notes);
    }

    /// <summary>
    /// Keeps the copy's status in step with its loan: an open outgoing loan means
    /// the copy is lent, an open incoming loan means it is borrowed, and returning
    /// it puts it back on the shelf.
    /// </summary>
    private static void SyncCopyStatusForLoan(LibraryCopy copy, LibraryLoan loan)
    {
        if (loan.ReturnedOn is not null)
        {
            if (loan.Direction == "out" && copy.Status == "lent") copy.Status = "shelf";
            return;
        }

        copy.Status = loan.Direction == "out" ? "lent" : "borrowed";
    }

    // ── Normalisation ───────────────────────────────────────────────────────

    private static IResult Bad(string message) => Results.BadRequest(new { error = message });

    private static int ClampTake(int? take) => Math.Clamp(take ?? 50, 1, MaxPageSize);

    private static string? Normalize(string? value, int maxLength)
    {
        if (value is null) return null;
        var trimmed = value.Trim();
        if (trimmed.Length == 0) return null;
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static string? NormalizeText(string? value)
    {
        if (value is null) return null;
        var trimmed = value.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    private static string? NormalizeFrom(string? value, HashSet<string> allowed)
    {
        if (value is null) return null;
        var normalized = value.Trim().ToLowerInvariant();
        return allowed.Contains(normalized) ? normalized : null;
    }

    /// <summary>Language codes are stored lowercase, letters and dashes only ("pt-br", "grc").</summary>
    private static string? NormalizeLanguage(string? value)
    {
        if (value is null) return null;
        var trimmed = value.Trim().ToLowerInvariant();
        if (trimmed.Length == 0 || trimmed.Length > 16) return null;
        return trimmed.All(c => char.IsAsciiLetter(c) || c == '-') ? trimmed : null;
    }

    private static string? NormalizeIsbn(string? value)
    {
        if (value is null) return null;
        var compact = new string(value.Where(c => char.IsAsciiLetterOrDigit(c) || c == '-').ToArray()).Trim();
        if (compact.Length == 0) return null;
        return compact.Length <= 32 ? compact : compact[..32];
    }

    private static string? NormalizeUrl(string? value)
    {
        var trimmed = Normalize(value, 500);
        if (trimmed is null) return null;
        return Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? trimmed
            : null;
    }

    private static int? NormalizeYear(int? value)
    {
        if (value is null) return null;
        return value is >= -3000 and <= 3000 ? value : null;
    }

    private static int? NormalizePositive(int? value, int max)
    {
        if (value is null) return null;
        return value is > 0 && value <= max ? value : null;
    }

    private static int? NormalizeRating(int? value)
    {
        if (value is null) return null;
        return value is >= 1 and <= 10 ? value : null;
    }

    private static decimal? NormalizePrice(decimal? value)
    {
        if (value is null) return null;
        return value is >= 0 and <= 9_999_999m ? decimal.Round(value.Value, 2) : null;
    }

    // ── Response mapping ────────────────────────────────────────────────────

    private static LibraryPersonResponse ToResponse(LibraryPerson person, int workCount, int editionCount) =>
        new(person.Id, person.DisplayName, person.SortName, person.BirthYear, person.DeathYear,
            person.Nationality, person.Notes, workCount, editionCount);

    private static LibraryLoanResponse ToResponse(LibraryLoan loan) =>
        new(loan.Id, loan.CopyId, loan.Direction, loan.CounterpartName, loan.CounterpartContact,
            loan.LentOn, loan.DueOn, loan.ReturnedOn, loan.Notes);
}
