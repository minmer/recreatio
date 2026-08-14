using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Library;

namespace Recreatio.Api.Endpoints.Library;

// The physical layer: the copies on the shelves, what has been lent out, and
// what has been read. None of this touches a citation.
public static partial class LibraryEndpoints
{
    private static void MapItemEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/items", async (
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

            var query = db.LibraryItems.AsNoTracking().Where(x => x.OwnerAccountId == userId);

            if (shelfId is { } shelf) query = query.Where(x => x.ShelfId == shelf);

            var statusFilter = NormalizeFrom(status, ItemStatuses);
            if (statusFilter is not null) query = query.Where(x => x.Status == statusFilter);

            var readingFilter = NormalizeFrom(readingStatus, ReadingStatuses);
            if (readingFilter is not null) query = query.Where(x => x.ReadingStatus == readingFilter);

            if (favourite == true) query = query.Where(x => x.IsFavourite);
            if (minRating is { } rating && rating > 0) query = query.Where(x => x.Rating != null && x.Rating >= rating);

            var languageFilter = NormalizeLanguage(language);
            if (languageFilter is not null)
            {
                // The language lives on the expression; a manifestation with none
                // inherits the work's original language.
                var viaExpression = db.LibraryExpressions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId && e.Language == languageFilter)
                    .Select(e => e.Id);
                var viaWork = db.LibraryWorks.AsNoTracking()
                    .Where(w => w.OwnerAccountId == userId && w.OriginalLanguage == languageFilter)
                    .Select(w => w.Id);
                var ids = db.LibraryManifestations.AsNoTracking()
                    .Where(m => m.OwnerAccountId == userId &&
                        ((m.ExpressionId != null && viaExpression.Contains(m.ExpressionId.Value)) ||
                         (m.ExpressionId == null && m.WorkId != null && viaWork.Contains(m.WorkId.Value))))
                    .Select(m => m.Id);
                query = query.Where(x => ids.Contains(x.ManifestationId));
            }

            var search = Normalize(term, 400);
            if (search is not null)
            {
                var manifestationIds = db.LibraryManifestations.AsNoTracking()
                    .Where(m => m.OwnerAccountId == userId &&
                        (m.Title.Contains(search) || (m.Isbn != null && m.Isbn.Contains(search))))
                    .Select(m => m.Id);
                query = query.Where(x =>
                    manifestationIds.Contains(x.ManifestationId) ||
                    (x.Signature != null && x.Signature.Contains(search)) ||
                    (x.Barcode != null && x.Barcode.Contains(search)));
            }

            var total = await query.CountAsync(ct);

            query = sort switch
            {
                "rating" => query.OrderBy(x => x.Rating == null).ThenByDescending(x => x.Rating),
                "acquired" => query.OrderBy(x => x.AcquiredDate == null).ThenByDescending(x => x.AcquiredDate),
                "signature" => query.OrderBy(x => x.Signature ?? string.Empty),
                "shelf" => query.OrderBy(x => x.ShelfId == null).ThenBy(x => x.ShelfId).ThenBy(x => x.PositionInShelf),
                _ => query.OrderByDescending(x => x.CreatedUtc)
            };

            var page = ClampTake(take);
            var offset = Math.Max(0, skip ?? 0);
            var items = await query.Skip(offset).Take(page).ToListAsync(ct);

            return Results.Ok(new LibraryItemListResponse(await BuildItemListAsync(db, userId, items, ct), total));
        });

        group.MapPost("/manifestations/{manifestationId:long}/items", async (long manifestationId, LibraryItemSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            if (!await db.LibraryManifestations.AnyAsync(x => x.Id == manifestationId && x.OwnerAccountId == userId, ct))
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var item = new LibraryItem
            {
                OwnerAccountId = userId,
                ManifestationId = manifestationId,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            var error = await ApplyItemAsync(db, userId, item, req, ct);
            if (error is not null) return error;

            db.LibraryItems.Add(item);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = item.Id });
        });

        group.MapPut("/items/{id:long}", async (long id, LibraryItemSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var item = await db.LibraryItems.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (item is null) return Results.NotFound();

            var error = await ApplyItemAsync(db, userId, item, req, ct);
            if (error is not null) return error;

            item.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = item.Id });
        });

        group.MapDelete("/items/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var item = await db.LibraryItems.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (item is null) return Results.NotFound();

            await db.LibraryLoans.Where(x => x.OwnerAccountId == userId && x.ItemId == id).ExecuteDeleteAsync(ct);
            await db.LibraryReadings.Where(x => x.OwnerAccountId == userId && x.ItemId == id).ExecuteDeleteAsync(ct);

            db.LibraryItems.Remove(item);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static async Task<IResult?> ApplyItemAsync(
        RecreatioDbContext db, Guid userId, LibraryItem item, LibraryItemSaveRequest req, CancellationToken ct)
    {
        if (req.ShelfId is { } shelfId &&
            !await db.LibraryShelves.AnyAsync(x => x.Id == shelfId && x.OwnerAccountId == userId, ct))
        {
            return Bad("Shelf does not exist.");
        }

        if (req.PlacementGroupId is { } groupId &&
            !await db.LibraryPlacementGroups.AnyAsync(x => x.Id == groupId && x.OwnerAccountId == userId, ct))
        {
            return Bad("Placement group does not exist.");
        }

        item.ShelfId = req.ShelfId;
        item.PlacementGroupId = req.PlacementGroupId;
        item.PositionInShelf = req.PositionInShelf;
        item.SeriesPosition = req.SeriesPosition;
        item.Signature = Normalize(req.Signature, 80);
        item.Status = NormalizeFrom(req.Status, ItemStatuses) ?? "shelf";
        item.Condition = NormalizeFrom(req.Condition, ItemConditions);
        item.AcquiredDate = req.AcquiredDate;
        item.AcquiredFrom = Normalize(req.AcquiredFrom, 200);
        item.Price = NormalizePrice(req.Price);
        item.Currency = Normalize(req.Currency, 8);
        item.Barcode = Normalize(req.Barcode, 64);
        item.ReadingStatus = NormalizeFrom(req.ReadingStatus, ReadingStatuses) ?? "unread";
        item.Rating = NormalizeRating(req.Rating);
        item.IsFavourite = req.IsFavourite;
        item.ScanImageUrl = NormalizeUrl(req.ScanImageUrl);
        item.Notes = NormalizeText(req.Notes);
        return null;
    }

    // ── Item loading ────────────────────────────────────────────────────────

    private static async Task<Dictionary<long, List<LibraryItemResponse>>> LoadItemsAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> manifestationIds, CancellationToken ct)
    {
        if (manifestationIds.Count == 0) return [];

        var items = await db.LibraryItems.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && manifestationIds.Contains(x.ManifestationId))
            .OrderBy(x => x.CreatedUtc)
            .ToListAsync(ct);
        if (items.Count == 0) return [];

        var shelfNames = await LoadShelfNamesAsync(db, userId, items.Select(x => x.ShelfId), ct);
        var groupNames = await LoadPlacementGroupNamesAsync(db, userId, items.Select(x => x.PlacementGroupId), ct);
        var openLoans = await LoadOpenLoansAsync(db, userId, items.Select(x => x.Id).ToList(), ct);

        return items
            .GroupBy(x => x.ManifestationId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(item => new LibraryItemResponse(
                        item.Id, item.ManifestationId,
                        item.ShelfId, item.ShelfId is { } sid ? shelfNames.GetValueOrDefault(sid) : null,
                        item.PlacementGroupId, item.PlacementGroupId is { } gid ? groupNames.GetValueOrDefault(gid) : null,
                        item.PositionInShelf, item.SeriesPosition, item.Signature, item.Status, item.Condition,
                        item.AcquiredDate, item.AcquiredFrom, item.Price, item.Currency, item.Barcode,
                        item.ReadingStatus, item.Rating, item.IsFavourite, item.ScanImageUrl, item.Notes,
                        openLoans.GetValueOrDefault(item.Id)))
                      .ToList());
    }

    /// <summary>
    /// Turns item rows into browse entries, resolving the manifestation, its work
    /// and authors, and choosing the cover: fetched image first, own scan second.
    /// </summary>
    private static async Task<List<LibraryItemListItem>> BuildItemListAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<LibraryItem> items, CancellationToken ct)
    {
        if (items.Count == 0) return [];

        var manifestationIds = items.Select(x => x.ManifestationId).Distinct().ToList();
        var manifestations = await db.LibraryManifestations.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && manifestationIds.Contains(x.Id))
            .ToListAsync(ct);
        var manifestationById = manifestations.ToDictionary(x => x.Id);

        var workIds = manifestations.Where(x => x.WorkId != null).Select(x => x.WorkId!.Value).Distinct().ToList();
        var works = await db.LibraryWorks.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.Id))
            .Select(x => new { x.Id, x.OriginalTitle, x.OriginalLanguage })
            .ToListAsync(ct);
        var workById = works.ToDictionary(x => x.Id);

        var expressionIds = manifestations.Where(x => x.ExpressionId != null).Select(x => x.ExpressionId!.Value).Distinct().ToList();
        var expressions = await db.LibraryExpressions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && expressionIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Language })
            .ToListAsync(ct);
        var expressionById = expressions.ToDictionary(x => x.Id, x => x.Language);

        var publisherIds = manifestations.Where(x => x.PublisherId != null).Select(x => x.PublisherId!.Value).Distinct().ToList();
        var publishers = await db.LibraryPublishers.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && publisherIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        var publisherById = publishers.ToDictionary(x => x.Id, x => x.Name);

        var authorsByWork = await LoadAuthorNamesAsync(db, userId, workIds, ct);
        var shelfNames = await LoadShelfNamesAsync(db, userId, items.Select(x => x.ShelfId), ct);
        var openLoans = await LoadOpenLoansAsync(db, userId, items.Select(x => x.Id).ToList(), ct);

        return items.Select(item =>
        {
            var manifestation = manifestationById.GetValueOrDefault(item.ManifestationId);
            var work = manifestation?.WorkId is { } workId ? workById.GetValueOrDefault(workId) : null;
            var language = manifestation?.ExpressionId is { } expressionId
                ? expressionById.GetValueOrDefault(expressionId)
                : work?.OriginalLanguage;

            return new LibraryItemListItem(
                item.Id, item.ManifestationId, manifestation?.WorkId ?? 0,
                manifestation?.Title ?? string.Empty,
                work?.OriginalTitle ?? string.Empty,
                language,
                language is not null && work is not null &&
                    !string.Equals(language, work.OriginalLanguage, StringComparison.Ordinal),
                (manifestation?.WorkId is { } id ? authorsByWork.GetValueOrDefault(id) : null) ?? [],
                manifestation?.PublisherId is { } pid ? publisherById.GetValueOrDefault(pid) : null,
                manifestation?.PublishedYear,
                item.ShelfId, item.ShelfId is { } sid ? shelfNames.GetValueOrDefault(sid) : null,
                item.PositionInShelf, item.Signature, item.Status, item.Condition,
                item.ReadingStatus, item.Rating, item.IsFavourite,
                // A fetched cover wins; the user's scan is the fallback.
                manifestation?.CoverImageUrl ?? item.ScanImageUrl,
                openLoans.GetValueOrDefault(item.Id));
        }).ToList();
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

    private static async Task<Dictionary<long, string>> LoadPlacementGroupNamesAsync(
        RecreatioDbContext db, Guid userId, IEnumerable<long?> groupIds, CancellationToken ct)
    {
        var ids = groupIds.Where(x => x != null).Select(x => x!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];

        var groups = await db.LibraryPlacementGroups.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && ids.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        return groups.ToDictionary(x => x.Id, x => x.Name);
    }

    private static async Task<Dictionary<long, LibraryLoanResponse>> LoadOpenLoansAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> itemIds, CancellationToken ct)
    {
        if (itemIds.Count == 0) return [];

        var loans = await db.LibraryLoans.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && itemIds.Contains(x.ItemId) && x.ReturnedOn == null)
            .OrderByDescending(x => x.LentOn)
            .ToListAsync(ct);

        // Only the most recent open loan matters in a list row.
        return loans.GroupBy(x => x.ItemId).ToDictionary(g => g.Key, g => ToResponse(g.First()));
    }

    /// <summary>Title and authors for an item, used by the loan and reading lists.</summary>
    private sealed record ItemContext(long ManifestationId, string Title, IReadOnlyList<string> Authors);

    private static async Task<Dictionary<long, ItemContext>> LoadItemContextAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> itemIds, CancellationToken ct)
    {
        if (itemIds.Count == 0) return [];

        var items = await db.LibraryItems.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && itemIds.Contains(x.Id))
            .Select(x => new { x.Id, x.ManifestationId })
            .ToListAsync(ct);

        var manifestationIds = items.Select(x => x.ManifestationId).Distinct().ToList();
        var manifestations = await db.LibraryManifestations.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && manifestationIds.Contains(x.Id))
            .Select(x => new { x.Id, x.WorkId, x.Title })
            .ToListAsync(ct);
        var manifestationById = manifestations.ToDictionary(x => x.Id);

        var authorsByWork = await LoadAuthorNamesAsync(
            db, userId, manifestations.Where(x => x.WorkId != null).Select(x => x.WorkId!.Value).Distinct().ToList(), ct);

        return items.ToDictionary(
            x => x.Id,
            x =>
            {
                var manifestation = manifestationById.GetValueOrDefault(x.ManifestationId);
                return new ItemContext(
                    x.ManifestationId,
                    manifestation?.Title ?? string.Empty,
                    (manifestation?.WorkId is { } workId ? authorsByWork.GetValueOrDefault(workId) : null) ?? []);
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

            var context = await LoadItemContextAsync(db, userId, loans.Select(x => x.ItemId).Distinct().ToList(), ct);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            return Results.Ok(loans.Select(loan =>
            {
                var info = context.GetValueOrDefault(loan.ItemId);
                return new LibraryLoanListItem(
                    loan.Id, loan.ItemId, info?.ManifestationId ?? 0, info?.Title ?? string.Empty,
                    info?.Authors ?? [], loan.Direction, loan.CounterpartName, loan.CounterpartContact,
                    loan.LentOn, loan.DueOn, loan.ReturnedOn,
                    loan.ReturnedOn is null && loan.DueOn is { } due && due < today,
                    loan.Notes);
            }).ToList());
        });

        group.MapPost("/items/{itemId:long}/loans", async (long itemId, LibraryLoanSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var item = await db.LibraryItems.FirstOrDefaultAsync(x => x.Id == itemId && x.OwnerAccountId == userId, ct);
            if (item is null) return Results.NotFound();

            var name = Normalize(req.CounterpartName, 200);
            if (name is null) return Bad("Counterpart name is required.");
            if (req.ReturnedOn is { } returned && returned < req.LentOn) return Bad("Return date cannot precede the lending date.");

            var now = DateTimeOffset.UtcNow;
            var loan = new LibraryLoan
            {
                OwnerAccountId = userId,
                ItemId = itemId,
                Direction = NormalizeFrom(req.Direction, LoanDirections) ?? "out",
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

            SyncItemStatusForLoan(item, loan);
            item.UpdatedUtc = now;

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

            var item = await db.LibraryItems.FirstOrDefaultAsync(x => x.Id == loan.ItemId && x.OwnerAccountId == userId, ct);
            if (item is not null)
            {
                var stillOpen = await db.LibraryLoans.AsNoTracking()
                    .AnyAsync(x => x.OwnerAccountId == userId && x.ItemId == item.Id && x.Id != loan.Id && x.ReturnedOn == null, ct);
                if (!stillOpen) SyncItemStatusForLoan(item, loan);
                item.UpdatedUtc = DateTimeOffset.UtcNow;
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

    /// <summary>
    /// Keeps the item's status in step with its loan: an open outgoing loan means
    /// lent, an open incoming loan means borrowed, and a return puts it back.
    /// </summary>
    private static void SyncItemStatusForLoan(LibraryItem item, LibraryLoan loan)
    {
        if (loan.ReturnedOn is not null)
        {
            if (loan.Direction == "out" && item.Status == "lent") item.Status = "shelf";
            return;
        }

        item.Status = loan.Direction == "out" ? "lent" : "borrowed";
    }

    private static LibraryLoanResponse ToResponse(LibraryLoan loan) =>
        new(loan.Id, loan.ItemId, loan.Direction, loan.CounterpartName, loan.CounterpartContact,
            loan.LentOn, loan.DueOn, loan.ReturnedOn, loan.Notes);

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

            var context = await LoadItemContextAsync(db, userId, readings.Select(x => x.ItemId).Distinct().ToList(), ct);

            return Results.Ok(readings.Select(reading =>
            {
                var info = context.GetValueOrDefault(reading.ItemId);
                return new LibraryReadingListItem(
                    reading.Id, reading.ItemId, info?.ManifestationId ?? 0, info?.Title ?? string.Empty,
                    info?.Authors ?? [], reading.StartedOn, reading.FinishedOn, reading.Rating, reading.Notes);
            }).ToList());
        });

        group.MapPost("/items/{itemId:long}/readings", async (long itemId, LibraryReadingSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var item = await db.LibraryItems.FirstOrDefaultAsync(x => x.Id == itemId && x.OwnerAccountId == userId, ct);
            if (item is null) return Results.NotFound();
            if (req.StartedOn is { } start && req.FinishedOn is { } finish && finish < start)
            {
                return Bad("Finish date cannot precede the start date.");
            }

            var now = DateTimeOffset.UtcNow;
            var reading = new LibraryReading
            {
                OwnerAccountId = userId,
                ItemId = itemId,
                StartedOn = req.StartedOn,
                FinishedOn = req.FinishedOn,
                Rating = NormalizeRating(req.Rating),
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryReadings.Add(reading);

            // Finishing a reading is the natural moment for the item to be read.
            if (reading.FinishedOn is not null) item.ReadingStatus = "read";
            else if (reading.StartedOn is not null && item.ReadingStatus == "unread") item.ReadingStatus = "reading";
            if (reading.Rating is not null) item.Rating = reading.Rating;
            item.UpdatedUtc = now;

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { id = reading.Id });
        });

        group.MapPut("/readings/{id:long}", async (long id, LibraryReadingSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var reading = await db.LibraryReadings.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (reading is null) return Results.NotFound();
            if (req.StartedOn is { } start && req.FinishedOn is { } finish && finish < start)
            {
                return Bad("Finish date cannot precede the start date.");
            }

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
}
