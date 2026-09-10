using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Services.Library;

namespace Recreatio.Api.Endpoints.Library;

// Shelf arrangement. The service only ever proposes; applying a proposal is a
// separate, explicit call, so a suggestion never rearranges the room by itself.
public static partial class LibraryEndpoints
{
    private static void MapShelvingEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/arrangement", async (
            long? shelfId,
            HttpContext ctx,
            RecreatioDbContext db,
            IShelfArrangementService arrangement,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var shelfQuery = db.LibraryShelves.AsNoTracking().Where(x => x.OwnerAccountId == userId);
            if (shelfId is { } only) shelfQuery = shelfQuery.Where(x => x.Id == only);

            var shelves = await shelfQuery.OrderBy(x => x.SortOrder).ToListAsync(ct);

            // Only books actually on hand can be arranged: wanted, lent and sold
            // items have nothing to place.
            var items = await db.LibraryItems.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && (x.Status == "shelf" || x.Status == "borrowed"))
                .ToListAsync(ct);

            var manifestationIds = items.Select(x => x.ManifestationId).Distinct().ToList();
            var manifestations = await db.LibraryManifestations.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && manifestationIds.Contains(x.Id))
                .Select(x => new { x.Id, x.Title, x.HeightMm, x.WidthMm, x.DepthMm, x.CoverImageUrl })
                .ToListAsync(ct);
            var manifestationById = manifestations.ToDictionary(x => x.Id);

            var groupIds = items.Where(x => x.PlacementGroupId != null).Select(x => x.PlacementGroupId!.Value).Distinct().ToList();
            var groups = await db.LibraryPlacementGroups.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && groupIds.Contains(x.Id))
                .Select(x => new { x.Id, x.Name, x.GroupKind })
                .ToListAsync(ct);
            var groupById = groups.ToDictionary(x => x.Id);

            var candidates = items.Select(item =>
            {
                var manifestation = manifestationById.GetValueOrDefault(item.ManifestationId);
                var placementGroup = item.PlacementGroupId is { } gid ? groupById.GetValueOrDefault(gid) : null;
                return new ArrangementCandidate(
                    item.Id,
                    manifestation?.Title ?? $"#{item.Id}",
                    item.Signature,
                    item.PlacementGroupId,
                    placementGroup?.GroupKind ?? "free",
                    placementGroup?.Name,
                    item.SeriesPosition,
                    manifestation?.HeightMm,
                    manifestation?.WidthMm,
                    manifestation?.DepthMm);
            }).ToList();

            var proposal = arrangement.Propose(
                shelves.Select(x => new ArrangementShelf(x.Id, x.Name, x.SortOrder, x.HeightMm, x.DepthMm, x.WidthMm)).ToList(),
                candidates);

            var shelfNames = shelves.ToDictionary(x => x.Id, x => x.Name);
            var titleByItem = candidates.ToDictionary(x => x.ItemId, x => x.Title);
            var currentPlacement = items.ToDictionary(x => x.Id, x => (x.ShelfId, x.PositionInShelf));
            var imageByItem = items.ToDictionary(
                x => x.Id,
                x => manifestationById.GetValueOrDefault(x.ManifestationId)?.CoverImageUrl ?? x.ScanImageUrl);

            var placements = proposal.Placements.Select(placement =>
            {
                var current = currentPlacement.GetValueOrDefault(placement.ItemId);
                return new LibraryArrangementPlacement(
                    placement.ItemId, placement.Title, placement.ShelfId,
                    shelfNames.GetValueOrDefault(placement.ShelfId, string.Empty),
                    placement.Position,
                    placement.PreviousItemId,
                    placement.PreviousItemId is { } prev ? titleByItem.GetValueOrDefault(prev) : null,
                    placement.NextItemId,
                    placement.NextItemId is { } next ? titleByItem.GetValueOrDefault(next) : null,
                    placement.GroupName,
                    imageByItem.GetValueOrDefault(placement.ItemId),
                    current.ShelfId == placement.ShelfId && current.PositionInShelf == placement.Position);
            }).ToList();

            return Results.Ok(new LibraryArrangementResponse(
                placements,
                proposal.Unplaced.Select(x => new LibraryArrangementUnplaced(x.ItemId, x.Title, x.Reason)).ToList(),
                proposal.Notes));
        });

        group.MapPost("/arrangement/apply", async (
            LibraryArrangementApplyRequest req,
            HttpContext ctx,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var itemIds = req.Placements.Select(x => x.ItemId).Distinct().ToList();
            var shelfIds = req.Placements.Select(x => x.ShelfId).Distinct().ToList();

            var items = await db.LibraryItems
                .Where(x => x.OwnerAccountId == userId && itemIds.Contains(x.Id))
                .ToListAsync(ct);
            if (items.Count != itemIds.Count) return Bad("One or more items do not exist.");

            var knownShelves = await db.LibraryShelves.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && shelfIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (knownShelves.Count != shelfIds.Count) return Bad("One or more shelves do not exist.");

            var byId = items.ToDictionary(x => x.Id);
            var now = DateTimeOffset.UtcNow;
            foreach (var placement in req.Placements)
            {
                var item = byId[placement.ItemId];
                item.ShelfId = placement.ShelfId;
                item.PositionInShelf = placement.Position;
                item.UpdatedUtc = now;
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { applied = req.Placements.Count });
        });
    }
}
