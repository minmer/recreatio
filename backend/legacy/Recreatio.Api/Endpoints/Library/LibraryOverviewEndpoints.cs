using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Services.Library;

namespace Recreatio.Api.Endpoints.Library;

public static partial class LibraryEndpoints
{
    private static void MapOverviewEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/overview", async (
            string? lang,
            string? style,
            HttpContext ctx,
            RecreatioDbContext db,
            ICitationService citations,
            ICitationStyleRegistry styles,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var works = await db.LibraryWorks.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.Kind, x.CitationScheme, x.OriginalLanguage })
                .ToListAsync(ct);
            var originalLanguageByWork = works.ToDictionary(x => x.Id, x => x.OriginalLanguage);

            var expressions = await db.LibraryExpressions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.WorkId, x.Language })
                .ToListAsync(ct);

            var manifestations = await db.LibraryManifestations.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.WorkId, x.ExpressionId })
                .ToListAsync(ct);

            var items = await db.LibraryItems.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .Select(x => new { x.Id, x.ManifestationId, x.ShelfId, x.ReadingStatus })
                .ToListAsync(ct);

            // A translation is an expression whose language differs from the
            // language its work was written in.
            var translations = expressions.Count(e =>
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

            // An item's language comes from its expression, or from the work when
            // there is none.
            var expressionLanguage = expressions.ToDictionary(x => x.Id, x => x.Language);
            var manifestationLanguage = manifestations.ToDictionary(
                x => x.Id,
                x => x.ExpressionId is { } eid
                    ? expressionLanguage.GetValueOrDefault(eid)
                    : x.WorkId is { } wid ? originalLanguageByWork.GetValueOrDefault(wid) : null);

            var byLanguage = items
                .Select(x => manifestationLanguage.GetValueOrDefault(x.ManifestationId))
                .Where(x => !string.IsNullOrEmpty(x))
                .GroupBy(x => x!)
                .Select(g => new LibraryCountByKey(g.Key, g.Key, g.Count()))
                .OrderByDescending(x => x.Count).ThenBy(x => x.Key, StringComparer.Ordinal)
                .ToList();

            var byScheme = works
                .GroupBy(x => x.CitationScheme)
                .Select(g => new LibraryCountByKey(g.Key, g.Key, g.Count()))
                .OrderByDescending(x => x.Count)
                .ToList();

            var byKind = works
                .GroupBy(x => x.Kind)
                .Select(g => new LibraryCountByKey(g.Key, g.Key, g.Count()))
                .OrderByDescending(x => x.Count)
                .ToList();

            var byShelf = items
                .GroupBy(x => x.ShelfId)
                .Select(g => new LibraryCountByKey(
                    g.Key?.ToString() ?? string.Empty,
                    g.Key is { } id ? shelfNames.GetValueOrDefault(id, string.Empty) : string.Empty,
                    g.Count()))
                .OrderByDescending(x => x.Count)
                .ToList();

            var topAuthors = await LoadTopAuthorsAsync(db, userId, ct);
            var topTags = await LoadTopTagsAsync(db, userId, ct);

            var recentQuoteRows = await db.LibraryQuotes.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(5)
                .ToListAsync(ct);
            var recentQuotes = await BuildQuoteResponsesAsync(
                db, userId, recentQuoteRows, citations, ResolveDisplayLanguage(lang), styles.Resolve(style), ct);

            var recentItemRows = await db.LibraryItems.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(8)
                .ToListAsync(ct);
            var recentlyAdded = await BuildItemListAsync(db, userId, recentItemRows, ct);

            var peopleCount = await db.LibraryPeople.CountAsync(x => x.OwnerAccountId == userId, ct);
            var publisherCount = await db.LibraryPublishers.CountAsync(x => x.OwnerAccountId == userId, ct);
            var tagCount = await db.LibraryTags.CountAsync(x => x.OwnerAccountId == userId, ct);
            var quoteCount = await db.LibraryQuotes.CountAsync(x => x.OwnerAccountId == userId, ct);

            return Results.Ok(new LibraryOverviewResponse(
                works.Count, expressions.Count, manifestations.Count, items.Count, quoteCount,
                peopleCount, publisherCount, shelves.Count, tagCount, translations,
                loans.Count(x => x.Direction == "out"),
                loans.Count(x => x.Direction == "in"),
                loans.Count(x => x.DueOn is { } due && due < today),
                items.Count(x => x.ReadingStatus == "read"),
                items.Count(x => x.ReadingStatus == "reading"),
                items.Count(x => x.ReadingStatus == "unread"),
                byLanguage, byScheme, byKind, byShelf, topAuthors, topTags,
                recentQuotes, recentlyAdded));
        });
    }

    private static async Task<List<LibraryCountByKey>> LoadTopAuthorsAsync(
        RecreatioDbContext db, Guid userId, CancellationToken ct)
    {
        var contributions = await db.LibraryContributions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.TargetType == "work" && AuthorRoles.Contains(x.Role))
            .Select(x => x.PersonId)
            .ToListAsync(ct);

        var top = contributions
            .GroupBy(x => x)
            .OrderByDescending(g => g.Count())
            .Take(10)
            .Select(g => new { PersonId = g.Key, Count = g.Count() })
            .ToList();

        var names = await LoadPersonNamesAsync(db, userId, top.Select(x => x.PersonId), ct);

        return top
            .Select(x => new LibraryCountByKey(
                x.PersonId.ToString(), names.GetValueOrDefault(x.PersonId, string.Empty), x.Count))
            .Where(x => x.Label.Length > 0)
            .ToList();
    }

    private static async Task<List<LibraryCountByKey>> LoadTopTagsAsync(
        RecreatioDbContext db, Guid userId, CancellationToken ct)
    {
        var links = await db.LibraryQuoteTags.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId)
            .Select(x => x.TagId)
            .ToListAsync(ct);

        var top = links
            .GroupBy(x => x)
            .OrderByDescending(g => g.Count())
            .Take(10)
            .Select(g => new { TagId = g.Key, Count = g.Count() })
            .ToList();

        var tagIds = top.Select(x => x.TagId).ToList();
        var tags = await db.LibraryTags.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && tagIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        var nameById = tags.ToDictionary(x => x.Id, x => x.Name);

        return top
            .Select(x => new LibraryCountByKey(x.TagId.ToString(), nameById.GetValueOrDefault(x.TagId, string.Empty), x.Count))
            .Where(x => x.Label.Length > 0)
            .ToList();
    }
}
