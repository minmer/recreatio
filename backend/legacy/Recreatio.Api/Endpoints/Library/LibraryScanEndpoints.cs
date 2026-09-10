using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Library;
using Recreatio.Api.Services.Library;

namespace Recreatio.Api.Endpoints.Library;

// Barcode scanning. One scan answers both questions at once: is this already on
// a shelf, and — if not — what do the public catalogues know about it.
public static partial class LibraryEndpoints
{
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

            // Compare on bare digits, so a catalogued "978-83-…" still matches a
            // scanner that reports digits only.
            var withIsbn = await db.LibraryManifestations.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.Isbn != null)
                .Select(x => new { x.Id, x.Isbn })
                .ToListAsync(ct);
            var matchedIds = withIsbn
                .Where(x => string.Equals(CompactIsbn(x.Isbn), isbn, StringComparison.OrdinalIgnoreCase))
                .Select(x => x.Id)
                .ToList();

            var matchingManifestations = matchedIds.Count > 0
                ? await LoadManifestationListAsync(db, userId, m => matchedIds.Contains(m.Id), ct)
                : [];

            var ownedItems = new List<LibraryItemListItem>();
            if (matchedIds.Count > 0)
            {
                var items = await db.LibraryItems.AsNoTracking()
                    .Where(x => x.OwnerAccountId == userId && matchedIds.Contains(x.ManifestationId))
                    .OrderBy(x => x.CreatedUtc)
                    .ToListAsync(ct);
                ownedItems = await BuildItemListAsync(db, userId, items, ct);
            }

            // Skip the outbound call when the shelf already answers the question,
            // unless metadata was explicitly asked for.
            var shouldLookup = lookupService.Enabled && (lookup ?? matchedIds.Count == 0);
            LibraryLookupResponse? lookupResponse = null;
            if (shouldLookup)
            {
                var result = await lookupService.LookupAsync(isbn, ct);
                if (result is not null) lookupResponse = ToResponse(result);
            }

            return Results.Ok(new LibraryScanResponse(
                isbn, matchingManifestations, ownedItems, lookupResponse, shouldLookup));
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

            if (req.ShelfId is { } shelfId &&
                !await db.LibraryShelves.AnyAsync(x => x.Id == shelfId && x.OwnerAccountId == userId, ct))
            {
                return Bad("Shelf does not exist.");
            }

            var now = DateTimeOffset.UtcNow;

            var work = new LibraryWork
            {
                OwnerAccountId = userId,
                OriginalTitle = originalTitle,
                OriginalLanguage = originalLanguage,
                Kind = NormalizeFrom(req.Kind, WorkKinds) ?? "book",
                CitationScheme = NormalizeFrom(req.CitationScheme, CitationSchemes) ?? "Page",
                FirstPublishedYear = NormalizeYear(req.FirstPublishedYear),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryWorks.Add(work);
            await db.SaveChangesAsync(ct);

            await AttachContributorsAsync(db, userId, "work", work.Id, req.AuthorNames, "author", now, ct);

            // A translation gets its own expression; an original-language edition
            // does not need one and stays attached straight to the work.
            var expressionLanguage = NormalizeLanguage(req.ExpressionLanguage) ?? originalLanguage;
            long? expressionId = null;
            if (!string.Equals(expressionLanguage, originalLanguage, StringComparison.Ordinal) ||
                Normalize(req.ExpressionName, 240) is not null)
            {
                var expression = new LibraryExpression
                {
                    OwnerAccountId = userId,
                    WorkId = work.Id,
                    Language = expressionLanguage,
                    Name = Normalize(req.ExpressionName, 240),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryExpressions.Add(expression);
                await db.SaveChangesAsync(ct);
                expressionId = expression.Id;

                await AttachContributorsAsync(db, userId, "expression", expression.Id, req.TranslatorNames, "translator", now, ct);
            }

            var manifestation = new LibraryManifestation
            {
                OwnerAccountId = userId,
                WorkId = work.Id,
                ExpressionId = expressionId,
                Format = "Print",
                Title = Normalize(req.ManifestationTitle, 400) ?? originalTitle,
                Subtitle = Normalize(req.ManifestationSubtitle, 400),
                PublisherId = await ResolvePublisherIdAsync(db, userId, req.PublisherName, now, ct),
                PublishedPlace = Normalize(req.PublishedPlace, 160),
                PublishedYear = NormalizeYear(req.PublishedYear),
                Isbn = isbn,
                PageCount = NormalizePositive(req.PageCount, 100000),
                Series = Normalize(req.Series, 200),
                Binding = NormalizeFrom(req.Binding, Bindings),
                CoverImageUrl = NormalizeUrl(req.CoverImageUrl),
                HeightMm = NormalizePositive(req.HeightMm, 2000),
                WidthMm = NormalizePositive(req.WidthMm, 2000),
                DepthMm = NormalizePositive(req.DepthMm, 1000),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryManifestations.Add(manifestation);
            await db.SaveChangesAsync(ct);

            long? itemId = null;
            if (req.CreateItem)
            {
                var item = new LibraryItem
                {
                    OwnerAccountId = userId,
                    ManifestationId = manifestation.Id,
                    ShelfId = req.ShelfId,
                    Status = "shelf",
                    ReadingStatus = "unread",
                    Barcode = isbn,
                    AcquiredDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.LibraryItems.Add(item);
                await db.SaveChangesAsync(ct);
                itemId = item.Id;
            }

            return Results.Ok(new LibraryScanImportResponse(work.Id, expressionId, manifestation.Id, itemId));
        });
    }

    private static LibraryLookupResponse ToResponse(BookLookupResult result) =>
        new(result.Isbn, result.Title, result.Subtitle, result.Authors,
            result.Contributors.Where(x => x.Role == "translator").Select(x => x.Name).ToList(),
            result.Contributors.Select(x => new LibraryLookupContributor(x.Name, x.Role)).ToList(),
            result.Publisher, result.PublishedPlace, result.PublishedYear, result.PageCount,
            result.Language, result.OriginalLanguage, result.Series, result.Binding,
            result.CoverUrl, result.Sources);

    /// <summary>
    /// Attaches contributors by name, reusing existing people so a scan never
    /// forks an author into duplicates.
    /// </summary>
    private static async Task AttachContributorsAsync(
        RecreatioDbContext db,
        Guid userId,
        string targetType,
        long targetId,
        IReadOnlyList<string> names,
        string role,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var sortOrder = 0;
        foreach (var rawName in names)
        {
            var personId = await ResolvePersonIdAsync(db, userId, rawName, now, ct);
            if (personId is null) continue;

            db.LibraryContributions.Add(new LibraryContribution
            {
                OwnerAccountId = userId,
                PersonId = personId.Value,
                TargetType = targetType,
                TargetId = targetId,
                Role = role,
                SortOrder = sortOrder++,
                CreatedUtc = now
            });
        }

        if (sortOrder > 0) await db.SaveChangesAsync(ct);
    }
}
