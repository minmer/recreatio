using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Library;

namespace Recreatio.Api.Endpoints.Library;

// People, publishers, shelves, tags and placement groups: the small lists the
// rest of the module points at.
public static partial class LibraryEndpoints
{
    private static void MapRegistryEndpoints(RouteGroupBuilder group)
    {
        MapPeople(group);
        MapPublishers(group);
        MapShelves(group);
        MapTags(group);
        MapPlacementGroups(group);
    }

    // ── People ──────────────────────────────────────────────────────────────

    private static void MapPeople(RouteGroupBuilder group)
    {
        group.MapGet("/people", async (string? term, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var query = db.LibraryPeople.AsNoTracking().Where(x => x.OwnerAccountId == userId);
            var search = Normalize(term, 240);
            if (search is not null)
            {
                query = query.Where(x => x.DisplayName.Contains(search) ||
                                         (x.SortName != null && x.SortName.Contains(search)));
            }

            var people = await query.ToListAsync(ct);
            var ids = people.Select(x => x.Id).ToList();

            var counts = await db.LibraryContributions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && ids.Contains(x.PersonId))
                .GroupBy(x => x.PersonId)
                .Select(g => new { PersonId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var countMap = counts.ToDictionary(x => x.PersonId, x => x.Count);

            var result = people
                .OrderBy(x => x.SortName ?? x.DisplayName, StringComparer.CurrentCulture)
                .Select(x => new LibraryPersonResponse(
                    x.Id, x.DisplayName, x.SortName, x.BirthYear, x.DeathYear, x.Nationality, x.Notes,
                    countMap.GetValueOrDefault(x.Id, 0)))
                .ToList();

            return Results.Ok(result);
        });

        group.MapPost("/people", async (LibraryPersonSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var displayName = Normalize(req.DisplayName, 240);
            if (displayName is null) return Bad("Display name is required.");

            var now = DateTimeOffset.UtcNow;
            var person = new LibraryPerson { OwnerAccountId = userId, CreatedUtc = now, UpdatedUtc = now };
            ApplyPerson(person, req, displayName);
            db.LibraryPeople.Add(person);
            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(person, 0));
        });

        group.MapPut("/people/{id:long}", async (long id, LibraryPersonSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var person = await db.LibraryPeople.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (person is null) return Results.NotFound();

            var displayName = Normalize(req.DisplayName, 240);
            if (displayName is null) return Bad("Display name is required.");

            ApplyPerson(person, req, displayName);
            person.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(person, 0));
        });

        group.MapDelete("/people/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var person = await db.LibraryPeople.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (person is null) return Results.NotFound();

            // Attributions go; the works they were attached to stay.
            await db.LibraryContributions
                .Where(x => x.OwnerAccountId == userId && x.PersonId == id)
                .ExecuteDeleteAsync(ct);

            db.LibraryPeople.Remove(person);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static void ApplyPerson(LibraryPerson person, LibraryPersonSaveRequest req, string displayName)
    {
        person.DisplayName = displayName;
        person.SortName = Normalize(req.SortName, 240);
        person.BirthYear = NormalizeYear(req.BirthYear);
        person.DeathYear = NormalizeYear(req.DeathYear);
        person.Nationality = Normalize(req.Nationality, 80);
        person.Notes = NormalizeText(req.Notes);
    }

    private static LibraryPersonResponse ToResponse(LibraryPerson person, int contributionCount) =>
        new(person.Id, person.DisplayName, person.SortName, person.BirthYear, person.DeathYear,
            person.Nationality, person.Notes, contributionCount);

    // ── Publishers ──────────────────────────────────────────────────────────

    private static void MapPublishers(RouteGroupBuilder group)
    {
        group.MapGet("/publishers", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var publishers = await db.LibraryPublishers.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .ToListAsync(ct);

            var counts = await db.LibraryManifestations.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.PublisherId != null)
                .GroupBy(x => x.PublisherId!.Value)
                .Select(g => new { PublisherId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var countMap = counts.ToDictionary(x => x.PublisherId, x => x.Count);

            return Results.Ok(publishers
                .OrderBy(x => x.Name, StringComparer.CurrentCulture)
                .Select(x => new LibraryPublisherResponse(x.Id, x.Name, x.City, x.Notes, countMap.GetValueOrDefault(x.Id, 0)))
                .ToList());
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

            await db.LibraryManifestations
                .Where(x => x.OwnerAccountId == userId && x.PublisherId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.PublisherId, (long?)null), ct);

            db.LibraryPublishers.Remove(publisher);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Shelves ─────────────────────────────────────────────────────────────

    private static void MapShelves(RouteGroupBuilder group)
    {
        group.MapGet("/shelves", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var shelves = await db.LibraryShelves.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
                .ToListAsync(ct);

            var counts = await db.LibraryItems.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.ShelfId != null)
                .GroupBy(x => x.ShelfId!.Value)
                .Select(g => new { ShelfId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var countMap = counts.ToDictionary(x => x.ShelfId, x => x.Count);

            return Results.Ok(shelves
                .Select(x => new LibraryShelfResponse(
                    x.Id, x.Name, x.Location, x.Description, x.SortOrder,
                    x.HeightMm, x.DepthMm, x.WidthMm, countMap.GetValueOrDefault(x.Id, 0)))
                .ToList());
        });

        group.MapPost("/shelves", async (LibraryShelfSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var name = Normalize(req.Name, 160);
            if (name is null) return Bad("Name is required.");

            var now = DateTimeOffset.UtcNow;
            var shelf = new LibraryShelf { OwnerAccountId = userId, CreatedUtc = now, UpdatedUtc = now };
            ApplyShelf(shelf, req, name);
            db.LibraryShelves.Add(shelf);
            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(shelf, 0));
        });

        group.MapPut("/shelves/{id:long}", async (long id, LibraryShelfSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var shelf = await db.LibraryShelves.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (shelf is null) return Results.NotFound();

            var name = Normalize(req.Name, 160);
            if (name is null) return Bad("Name is required.");

            ApplyShelf(shelf, req, name);
            shelf.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(shelf, 0));
        });

        group.MapDelete("/shelves/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var shelf = await db.LibraryShelves.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (shelf is null) return Results.NotFound();

            // Items stay in the catalogue; they just become unshelved.
            await db.LibraryItems
                .Where(x => x.OwnerAccountId == userId && x.ShelfId == id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.ShelfId, (long?)null)
                    .SetProperty(x => x.PositionInShelf, (int?)null), ct);

            db.LibraryShelves.Remove(shelf);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static void ApplyShelf(LibraryShelf shelf, LibraryShelfSaveRequest req, string name)
    {
        shelf.Name = name;
        shelf.Location = Normalize(req.Location, 240);
        shelf.Description = NormalizeText(req.Description);
        shelf.SortOrder = req.SortOrder;
        shelf.HeightMm = NormalizePositive(req.HeightMm, 5000);
        shelf.DepthMm = NormalizePositive(req.DepthMm, 5000);
        shelf.WidthMm = NormalizePositive(req.WidthMm, 20000);
    }

    private static LibraryShelfResponse ToResponse(LibraryShelf shelf, int itemCount) =>
        new(shelf.Id, shelf.Name, shelf.Location, shelf.Description, shelf.SortOrder,
            shelf.HeightMm, shelf.DepthMm, shelf.WidthMm, itemCount);

    // ── Tags ────────────────────────────────────────────────────────────────

    private static void MapTags(RouteGroupBuilder group)
    {
        group.MapGet("/tags", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var tags = await db.LibraryTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .ToListAsync(ct);

            var workCounts = await db.LibraryWorkTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .GroupBy(x => x.TagId)
                .Select(g => new { TagId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var quoteCounts = await db.LibraryQuoteTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .GroupBy(x => x.TagId)
                .Select(g => new { TagId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var workMap = workCounts.ToDictionary(x => x.TagId, x => x.Count);
            var quoteMap = quoteCounts.ToDictionary(x => x.TagId, x => x.Count);

            return Results.Ok(tags
                .OrderBy(x => x.Name, StringComparer.CurrentCulture)
                .Select(x => new LibraryTagResponse(
                    x.Id, x.Name, x.Color, workMap.GetValueOrDefault(x.Id, 0), quoteMap.GetValueOrDefault(x.Id, 0)))
                .ToList());
        });

        group.MapPost("/tags", async (LibraryTagSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var name = Normalize(req.Name, 120);
            if (name is null) return Bad("Name is required.");

            if (await db.LibraryTags.AnyAsync(x => x.OwnerAccountId == userId && x.Name == name, ct))
            {
                return Results.Conflict(new { error = "A tag with this name already exists." });
            }

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

            return Results.Ok(new LibraryTagResponse(tag.Id, tag.Name, tag.Color, 0, 0));
        });

        group.MapPut("/tags/{id:long}", async (long id, LibraryTagSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var tag = await db.LibraryTags.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (tag is null) return Results.NotFound();

            var name = Normalize(req.Name, 120);
            if (name is null) return Bad("Name is required.");

            if (await db.LibraryTags.AnyAsync(x => x.OwnerAccountId == userId && x.Name == name && x.Id != id, ct))
            {
                return Results.Conflict(new { error = "A tag with this name already exists." });
            }

            tag.Name = name;
            tag.Color = Normalize(req.Color, 16);
            tag.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryTagResponse(tag.Id, tag.Name, tag.Color, 0, 0));
        });

        group.MapDelete("/tags/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var tag = await db.LibraryTags.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (tag is null) return Results.NotFound();

            await db.LibraryWorkTags.Where(x => x.OwnerAccountId == userId && x.TagId == id).ExecuteDeleteAsync(ct);
            await db.LibraryQuoteTags.Where(x => x.OwnerAccountId == userId && x.TagId == id).ExecuteDeleteAsync(ct);

            db.LibraryTags.Remove(tag);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Placement groups ────────────────────────────────────────────────────

    private static void MapPlacementGroups(RouteGroupBuilder group)
    {
        group.MapGet("/placement-groups", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var groups = await db.LibraryPlacementGroups.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderBy(x => x.Name)
                .ToListAsync(ct);

            var counts = await db.LibraryItems.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.PlacementGroupId != null)
                .GroupBy(x => x.PlacementGroupId!.Value)
                .Select(g => new { GroupId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var countMap = counts.ToDictionary(x => x.GroupId, x => x.Count);

            return Results.Ok(groups
                .Select(x => new LibraryPlacementGroupResponse(
                    x.Id, x.Name, x.GroupKind, x.Notes, countMap.GetValueOrDefault(x.Id, 0)))
                .ToList());
        });

        group.MapPost("/placement-groups", async (LibraryPlacementGroupSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var name = Normalize(req.Name, 200);
            if (name is null) return Bad("Name is required.");

            var now = DateTimeOffset.UtcNow;
            var placementGroup = new LibraryPlacementGroup
            {
                OwnerAccountId = userId,
                Name = name,
                GroupKind = NormalizeFrom(req.GroupKind, PlacementGroupKinds) ?? "collection",
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryPlacementGroups.Add(placementGroup);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryPlacementGroupResponse(
                placementGroup.Id, placementGroup.Name, placementGroup.GroupKind, placementGroup.Notes, 0));
        });

        group.MapPut("/placement-groups/{id:long}", async (long id, LibraryPlacementGroupSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var placementGroup = await db.LibraryPlacementGroups
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (placementGroup is null) return Results.NotFound();

            var name = Normalize(req.Name, 200);
            if (name is null) return Bad("Name is required.");

            placementGroup.Name = name;
            placementGroup.GroupKind = NormalizeFrom(req.GroupKind, PlacementGroupKinds) ?? "collection";
            placementGroup.Notes = NormalizeText(req.Notes);
            placementGroup.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new LibraryPlacementGroupResponse(
                placementGroup.Id, placementGroup.Name, placementGroup.GroupKind, placementGroup.Notes, 0));
        });

        group.MapDelete("/placement-groups/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var placementGroup = await db.LibraryPlacementGroups
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (placementGroup is null) return Results.NotFound();

            await db.LibraryItems
                .Where(x => x.OwnerAccountId == userId && x.PlacementGroupId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.PlacementGroupId, (long?)null), ct);

            db.LibraryPlacementGroups.Remove(placementGroup);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
