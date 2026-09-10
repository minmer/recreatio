using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Library;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints.Library;

/// <summary>
/// The private library. Routes are grouped by the model's two layers:
/// works, expressions, manifestations and quotes carry citations; items,
/// shelves and placement groups describe where a book physically stands.
///
/// Split across partial files by concern — registries, catalogue, quotes,
/// shelving, scanning, overview — sharing the helpers at the bottom of this one.
/// </summary>
public static partial class LibraryEndpoints
{
    private const int MaxPageSize = 200;

    // ── Vocabularies ────────────────────────────────────────────────────────
    // Kept in step with the frontend's copies of the same lists.

    private static readonly HashSet<string> WorkKinds = new(StringComparer.Ordinal)
    {
        "book", "article", "essay", "poetry", "drama", "treatise",
        "collection", "reference", "scripture", "document", "other"
    };

    /// <summary>Must match a registered <c>ICitationLocatorFormatter.Scheme</c>.</summary>
    private static readonly HashSet<string> CitationSchemes = new(StringComparer.Ordinal)
    {
        "Page", "BibleReference", "StructuredWork", "DocumentParagraph"
    };

    private static readonly HashSet<string> ContributionRoles = new(StringComparer.Ordinal)
    {
        "author", "coauthor", "editor", "translator", "illustrator",
        "foreword", "afterword", "commentary", "compiler", "other"
    };

    private static readonly HashSet<string> ContributionTargets = new(StringComparer.Ordinal)
    {
        "work", "expression", "manifestation"
    };

    private static readonly HashSet<string> ManifestationFormats = new(StringComparer.Ordinal)
    {
        "Print", "Web", "Ebook"
    };

    private static readonly HashSet<string> ItemStatuses = new(StringComparer.Ordinal)
    {
        "shelf", "lent", "borrowed", "wanted", "ordered", "lost", "sold"
    };

    private static readonly HashSet<string> ItemConditions = new(StringComparer.Ordinal)
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

    private static readonly HashSet<string> PlacementGroupKinds = new(StringComparer.Ordinal)
    {
        "series", "collection", "free"
    };

    /// <summary>Roles that identify the creator of the work itself.</summary>
    private static readonly string[] AuthorRoles = ["author", "coauthor"];

    public static void MapLibraryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/library");

        // Cookie authentication means every mutating call carries the
        // double-submit CSRF token. One filter covers the whole module.
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

        MapRegistryEndpoints(group);
        MapWorkEndpoints(group);
        MapExpressionEndpoints(group);
        MapManifestationEndpoints(group);
        MapItemEndpoints(group);
        MapQuoteEndpoints(group);
        MapLoanEndpoints(group);
        MapReadingEndpoints(group);
        MapShelvingEndpoints(group);
        MapScanEndpoints(group);
        MapOverviewEndpoints(group);
    }

    // ── Contributions ───────────────────────────────────────────────────────

    private static async Task<Dictionary<long, List<LibraryContributionResponse>>> LoadContributionsAsync(
        RecreatioDbContext db, Guid userId, string targetType, IReadOnlyList<long> targetIds, CancellationToken ct)
    {
        if (targetIds.Count == 0) return [];

        var contributions = await db.LibraryContributions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.TargetType == targetType && targetIds.Contains(x.TargetId))
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var names = await LoadPersonNamesAsync(db, userId, contributions.Select(x => x.PersonId), ct);

        return contributions
            .GroupBy(x => x.TargetId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => new LibraryContributionResponse(
                        x.Id, x.PersonId, names.GetValueOrDefault(x.PersonId, string.Empty), x.Role, x.SortOrder))
                      .ToList());
    }

    private static async Task<Dictionary<long, string>> LoadPersonNamesAsync(
        RecreatioDbContext db, Guid userId, IEnumerable<long> personIds, CancellationToken ct)
    {
        var ids = personIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        var people = await db.LibraryPeople.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && ids.Contains(x.Id))
            .Select(x => new { x.Id, x.DisplayName })
            .ToListAsync(ct);
        return people.ToDictionary(x => x.Id, x => x.DisplayName);
    }

    /// <summary>Author names per work, in the order they were entered.</summary>
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

        var names = await LoadPersonNamesAsync(db, userId, contributions.Select(x => x.PersonId), ct);

        return contributions
            .GroupBy(x => x.TargetId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => names.GetValueOrDefault(x.PersonId))
                      .Where(x => !string.IsNullOrEmpty(x))
                      .Select(x => x!)
                      .ToList());
    }

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

    /// <summary>
    /// Finds an existing person by display name or creates one. Used by the
    /// scan and import paths so repeated names never fork into duplicates.
    /// </summary>
    private static async Task<long?> ResolvePersonIdAsync(
        RecreatioDbContext db, Guid userId, string? rawName, DateTimeOffset now, CancellationToken ct)
    {
        var name = Normalize(rawName, 240);
        if (name is null) return null;

        var existing = await db.LibraryPeople
            .FirstOrDefaultAsync(x => x.OwnerAccountId == userId && x.DisplayName == name, ct);
        if (existing is not null) return existing.Id;

        var person = new LibraryPerson
        {
            OwnerAccountId = userId,
            DisplayName = name,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.LibraryPeople.Add(person);
        await db.SaveChangesAsync(ct);
        return person.Id;
    }

    private static async Task<long?> ResolvePublisherIdAsync(
        RecreatioDbContext db, Guid userId, string? rawName, DateTimeOffset now, CancellationToken ct)
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

    private static async Task<long?> ResolveTagIdAsync(
        RecreatioDbContext db, Guid userId, string? rawName, DateTimeOffset now, CancellationToken ct)
    {
        var name = Normalize(rawName, 120);
        if (name is null) return null;

        var existing = await db.LibraryTags
            .FirstOrDefaultAsync(x => x.OwnerAccountId == userId && x.Name == name, ct);
        if (existing is not null) return existing.Id;

        var tag = new LibraryTag
        {
            OwnerAccountId = userId,
            Name = name,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.LibraryTags.Add(tag);
        await db.SaveChangesAsync(ct);
        return tag.Id;
    }

    // ── Tags ────────────────────────────────────────────────────────────────

    private static async Task<Dictionary<long, List<LibraryTagResponse>>> LoadTagsForWorksAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> workIds, CancellationToken ct)
    {
        if (workIds.Count == 0) return [];

        var links = await db.LibraryWorkTags.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.WorkId))
            .Select(x => new { Owner = x.WorkId, x.TagId })
            .ToListAsync(ct);

        return await GroupTagsAsync(db, userId, links.Select(x => (x.Owner, x.TagId)).ToList(), ct);
    }

    private static async Task<Dictionary<long, List<LibraryTagResponse>>> LoadTagsForQuotesAsync(
        RecreatioDbContext db, Guid userId, IReadOnlyList<long> quoteIds, CancellationToken ct)
    {
        if (quoteIds.Count == 0) return [];

        var links = await db.LibraryQuoteTags.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && quoteIds.Contains(x.QuoteId))
            .Select(x => new { Owner = x.QuoteId, x.TagId })
            .ToListAsync(ct);

        return await GroupTagsAsync(db, userId, links.Select(x => (x.Owner, x.TagId)).ToList(), ct);
    }

    private static async Task<Dictionary<long, List<LibraryTagResponse>>> GroupTagsAsync(
        RecreatioDbContext db, Guid userId, List<(long Owner, long TagId)> links, CancellationToken ct)
    {
        if (links.Count == 0) return [];

        var tagIds = links.Select(x => x.TagId).Distinct().ToList();
        var tags = await db.LibraryTags.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && tagIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.Color })
            .ToListAsync(ct);
        var byId = tags.ToDictionary(x => x.Id, x => new LibraryTagResponse(x.Id, x.Name, x.Color, 0, 0));

        return links
            .GroupBy(x => x.Owner)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => byId.GetValueOrDefault(x.TagId))
                      .Where(x => x is not null)
                      .Select(x => x!)
                      .OrderBy(x => x.Name, StringComparer.CurrentCulture)
                      .ToList());
    }

    /// <summary>Replaces a quote's tags, verifying every id belongs to the caller.</summary>
    private static async Task<IResult?> ReplaceQuoteTagsAsync(
        RecreatioDbContext db, Guid userId, long quoteId, IReadOnlyList<long> tagIds, CancellationToken ct)
    {
        var requested = tagIds.Distinct().ToList();
        if (requested.Count > 0)
        {
            var valid = await db.LibraryTags.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && requested.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (valid.Count != requested.Count) return Bad("One or more tags do not exist.");
        }

        await db.LibraryQuoteTags
            .Where(x => x.OwnerAccountId == userId && x.QuoteId == quoteId)
            .ExecuteDeleteAsync(ct);

        var now = DateTimeOffset.UtcNow;
        foreach (var tagId in requested)
        {
            db.LibraryQuoteTags.Add(new LibraryQuoteTag
            {
                OwnerAccountId = userId,
                QuoteId = quoteId,
                TagId = tagId,
                CreatedUtc = now
            });
        }

        return null;
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
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static string? NormalizeFrom(string? value, HashSet<string> allowed)
    {
        if (value is null) return null;
        var trimmed = value.Trim();
        if (allowed.Contains(trimmed)) return trimmed;
        // Vocabularies are lowercase apart from the citation schemes.
        var lowered = trimmed.ToLowerInvariant();
        return allowed.Contains(lowered) ? lowered : null;
    }

    /// <summary>Language codes are stored lowercase: "pl", "grc", "pt-br".</summary>
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

    private static string? NormalizeUrl(string? value, int maxLength = 1000)
    {
        var trimmed = Normalize(value, maxLength);
        if (trimmed is null) return null;
        return Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? trimmed
            : null;
    }

    private static int? NormalizeYear(int? value) => value is >= -3000 and <= 3000 ? value : null;

    private static int? NormalizePositive(int? value, int max) => value is > 0 && value <= max ? value : null;

    private static int? NormalizeRating(int? value) => value is >= 1 and <= 10 ? value : null;

    private static decimal? NormalizePrice(decimal? value)
    {
        if (value is null) return null;
        return value is >= 0 and <= 9_999_999m ? decimal.Round(value.Value, 2) : null;
    }

    /// <summary>Strips separators so a stored ISBN compares equal to a scanned one.</summary>
    private static string CompactIsbn(string? value) =>
        value is null ? string.Empty : new string(value.Where(char.IsAsciiLetterOrDigit).ToArray()).ToUpperInvariant();
}
