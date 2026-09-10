using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Library;
using Recreatio.Api.Services.Library;

namespace Recreatio.Api.Endpoints.Library;

// Quotes. A quote is text plus a place in a work; everything else is optional.
//
// LocatorDisplay is rendered on write and stored, so searching and listing never
// parse JSON. It is re-rendered whenever the work's citation scheme changes.
public static partial class LibraryEndpoints
{
    /// <summary>Reading language for locator labels — "S. 42" against "s. 42".</summary>
    private static string ResolveDisplayLanguage(string? requested) =>
        NormalizeLanguage(requested) is { Length: > 0 } language ? language : "pl";

    private static void MapQuoteEndpoints(RouteGroupBuilder group)
    {
        // The form builds its own locator fields from this, so adding a scheme
        // does not mean editing the frontend.
        group.MapGet("/citation-schemes", (ICitationService citations) =>
        {
            var specs = new List<LibraryCitationSchemeSpec>
            {
                new("Page", "manifestation",
                    [
                        new LibraryLocatorFieldSpec("page", "text", "page", true),
                        new LibraryLocatorFieldSpec("pageEnd", "text", "pageEnd", false)
                    ],
                    UsesStructureTemplate: false,
                    Example: "S. 42"),

                new("BibleReference", "expression",
                    [
                        new LibraryLocatorFieldSpec("book", "text", "book", true),
                        new LibraryLocatorFieldSpec("chapter", "number", "chapter", true),
                        new LibraryLocatorFieldSpec("verse", "number", "verse", false),
                        new LibraryLocatorFieldSpec("verseEnd", "number", "verseEnd", false)
                    ],
                    UsesStructureTemplate: false,
                    Example: "Joh 3,16"),

                new("StructuredWork", "work",
                    [],
                    UsesStructureTemplate: true,
                    Example: "STh I, q.2, a.3"),

                new("DocumentParagraph", "work",
                    [
                        new LibraryLocatorFieldSpec("paragraph", "text", "paragraph", true),
                        new LibraryLocatorFieldSpec("paragraphEnd", "text", "paragraphEnd", false)
                    ],
                    UsesStructureTemplate: false,
                    Example: "Nr. 27")
            };

            // Only advertise schemes that actually have a formatter behind them.
            return Results.Ok(specs.Where(x => citations.KnownSchemes.Contains(x.Scheme)).ToList());
        });

        // Styles are advertised with a worked example, so the picker shows what
        // each one actually produces rather than only its name.
        group.MapGet("/citation-styles", (ICitationStyleRegistry styles) =>
        {
            var sample = new CitationSubject(
                "Page",
                [new CitationName("Bolesław Prus", "Prus, Bolesław")],
                [], [],
                "Lalka", null, null, "Lalka",
                "Ossolineum", "Wrocław", 1991, null, null, null,
                "s. 42", "42", null);

            return Results.Ok(styles.All
                .Select(style => new LibraryCitationStyleSpec(
                    style.Key, style.DisplayName, style.FormatNote(sample), style.FormatBibliography(sample)))
                .ToList());
        });

        group.MapGet("/bible-books", (IBibleBookCatalog books) =>
            Results.Ok(books.All.Select(book => new
            {
                id = book.Id,
                names = book.Names.ToDictionary(x => x.Key, x => new { abbr = x.Value.Abbr, name = x.Value.Name })
            }).ToList()));

        // ── Search ──────────────────────────────────────────────────────────

        group.MapGet("/quotes", async (
            string? term,
            long? workId,
            long? tagId,
            long? personId,
            string? citationScheme,
            string? lang,
            string? style,
            string? sort,
            int? skip,
            int? take,
            HttpContext ctx,
            RecreatioDbContext db,
            ICitationService citations,
            ICitationStyleRegistry styles,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var query = db.LibraryQuotes.AsNoTracking().Where(x => x.OwnerAccountId == userId);

            if (workId is { } work) query = query.Where(x => x.WorkId == work);

            if (tagId is { } tag)
            {
                var ids = db.LibraryQuoteTags.AsNoTracking()
                    .Where(t => t.OwnerAccountId == userId && t.TagId == tag)
                    .Select(t => t.QuoteId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            var schemeFilter = NormalizeFrom(citationScheme, CitationSchemes);
            if (schemeFilter is not null)
            {
                var ids = db.LibraryWorks.AsNoTracking()
                    .Where(w => w.OwnerAccountId == userId && w.CitationScheme == schemeFilter)
                    .Select(w => w.Id);
                query = query.Where(x => ids.Contains(x.WorkId));
            }

            if (personId is { } person)
            {
                var ids = db.LibraryContributions.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId && c.PersonId == person && c.TargetType == "work")
                    .Select(c => c.TargetId);
                query = query.Where(x => ids.Contains(x.WorkId));
            }

            var search = Normalize(term, 400);
            if (search is not null)
            {
                // One box searches the passage, the work, the author, the tags and
                // the rendered reference — whatever comes to mind while writing.
                var worksByTitle = db.LibraryWorks.AsNoTracking()
                    .Where(w => w.OwnerAccountId == userId &&
                        (w.OriginalTitle.Contains(search) ||
                         (w.UniformTitle != null && w.UniformTitle.Contains(search))))
                    .Select(w => w.Id);

                var peopleByName = db.LibraryPeople.AsNoTracking()
                    .Where(p => p.OwnerAccountId == userId && p.DisplayName.Contains(search))
                    .Select(p => p.Id);
                var worksByAuthor = db.LibraryContributions.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId && c.TargetType == "work" && peopleByName.Contains(c.PersonId))
                    .Select(c => c.TargetId);

                var tagsByName = db.LibraryTags.AsNoTracking()
                    .Where(t => t.OwnerAccountId == userId && t.Name.Contains(search))
                    .Select(t => t.Id);
                var quotesByTag = db.LibraryQuoteTags.AsNoTracking()
                    .Where(t => t.OwnerAccountId == userId && tagsByName.Contains(t.TagId))
                    .Select(t => t.QuoteId);

                query = query.Where(x =>
                    x.QuoteText.Contains(search) ||
                    (x.LocatorDisplay != null && x.LocatorDisplay.Contains(search)) ||
                    (x.Description != null && x.Description.Contains(search)) ||
                    (x.Context != null && x.Context.Contains(search)) ||
                    worksByTitle.Contains(x.WorkId) ||
                    worksByAuthor.Contains(x.WorkId) ||
                    quotesByTag.Contains(x.Id));
            }

            var total = await query.CountAsync(ct);

            query = sort switch
            {
                "oldest" => query.OrderBy(x => x.CreatedUtc),
                "updated" => query.OrderByDescending(x => x.UpdatedUtc),
                "locator" => query.OrderBy(x => x.LocatorDisplay ?? string.Empty),
                _ => query.OrderByDescending(x => x.CreatedUtc)
            };

            var page = ClampTake(take);
            var offset = Math.Max(0, skip ?? 0);
            var quotes = await query.Skip(offset).Take(page).ToListAsync(ct);

            var items = await BuildQuoteResponsesAsync(db, userId, quotes, citations, ResolveDisplayLanguage(lang), styles.Resolve(style), ct);
            return Results.Ok(new LibraryQuoteListResponse(items, total));
        });

        group.MapGet("/quotes/{id:long}", async (long id, string? lang, string? style, HttpContext ctx, RecreatioDbContext db, ICitationService citations, ICitationStyleRegistry styles, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var quote = await db.LibraryQuotes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (quote is null) return Results.NotFound();

            var built = await BuildQuoteResponsesAsync(db, userId, [quote], citations, ResolveDisplayLanguage(lang), styles.Resolve(style), ct);
            return Results.Ok(built[0]);
        });

        // ── Write ───────────────────────────────────────────────────────────

        group.MapPost("/quotes", async (LibraryQuoteSaveRequest req, string? lang, HttpContext ctx, RecreatioDbContext db, ICitationService citations, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var text = NormalizeText(req.QuoteText);
            if (text is null) return Bad("The quote text is required.");

            var (work, error) = await ResolveQuoteParentsAsync(db, userId, req, ct);
            if (error is not null) return error;

            var locatorJson = NormalizeLocatorJson(req.LocatorJson, out var locatorError);
            if (locatorError is not null) return Bad(locatorError);

            var now = DateTimeOffset.UtcNow;
            var quote = new LibraryQuote
            {
                OwnerAccountId = userId,
                WorkId = req.WorkId,
                ExpressionId = req.ExpressionId,
                ManifestationId = req.ManifestationId,
                QuoteText = text,
                LocatorJson = locatorJson,
                LocatorDisplay = RenderLocator(citations, work!, locatorJson, ResolveDisplayLanguage(lang)),
                Description = NormalizeText(req.Description),
                Context = NormalizeText(req.Context),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryQuotes.Add(quote);
            await db.SaveChangesAsync(ct);

            if (req.TagIds is { Count: > 0 })
            {
                var tagError = await ReplaceQuoteTagsAsync(db, userId, quote.Id, req.TagIds, ct);
                if (tagError is not null) return tagError;
                await db.SaveChangesAsync(ct);
            }

            return Results.Ok(new { id = quote.Id });
        });

        group.MapPut("/quotes/{id:long}", async (long id, LibraryQuoteSaveRequest req, string? lang, HttpContext ctx, RecreatioDbContext db, ICitationService citations, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var quote = await db.LibraryQuotes.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (quote is null) return Results.NotFound();

            var text = NormalizeText(req.QuoteText);
            if (text is null) return Bad("The quote text is required.");

            var (work, error) = await ResolveQuoteParentsAsync(db, userId, req, ct);
            if (error is not null) return error;

            var locatorJson = NormalizeLocatorJson(req.LocatorJson, out var locatorError);
            if (locatorError is not null) return Bad(locatorError);

            quote.WorkId = req.WorkId;
            quote.ExpressionId = req.ExpressionId;
            quote.ManifestationId = req.ManifestationId;
            quote.QuoteText = text;
            quote.LocatorJson = locatorJson;
            quote.LocatorDisplay = RenderLocator(citations, work!, locatorJson, ResolveDisplayLanguage(lang));
            quote.Description = NormalizeText(req.Description);
            quote.Context = NormalizeText(req.Context);
            quote.UpdatedUtc = DateTimeOffset.UtcNow;

            if (req.TagIds is not null)
            {
                var tagError = await ReplaceQuoteTagsAsync(db, userId, quote.Id, req.TagIds, ct);
                if (tagError is not null) return tagError;
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { id = quote.Id });
        });

        group.MapDelete("/quotes/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var quote = await db.LibraryQuotes.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (quote is null) return Results.NotFound();

            await db.LibraryQuoteTags.Where(x => x.OwnerAccountId == userId && x.QuoteId == id).ExecuteDeleteAsync(ct);
            db.LibraryQuotes.Remove(quote);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        MapQuoteImportEndpoint(group);
    }

    // ── Validation ──────────────────────────────────────────────────────────

    /// <summary>
    /// Checks that the work exists and that any expression or manifestation named
    /// really belongs to it — a quote pointing at another work's edition would
    /// render a false reference.
    /// </summary>
    private static async Task<(LibraryWork? Work, IResult? Error)> ResolveQuoteParentsAsync(
        RecreatioDbContext db, Guid userId, LibraryQuoteSaveRequest req, CancellationToken ct)
    {
        var work = await db.LibraryWorks.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == req.WorkId && x.OwnerAccountId == userId, ct);
        if (work is null) return (null, Bad("The work does not exist."));

        if (req.ExpressionId is { } expressionId)
        {
            var belongs = await db.LibraryExpressions.AsNoTracking()
                .AnyAsync(x => x.Id == expressionId && x.OwnerAccountId == userId && x.WorkId == req.WorkId, ct);
            if (!belongs) return (null, Bad("That translation belongs to a different work."));
        }

        if (req.ManifestationId is { } manifestationId)
        {
            var manifestation = await db.LibraryManifestations.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == manifestationId && x.OwnerAccountId == userId, ct);
            if (manifestation is null) return (null, Bad("The edition does not exist."));
            if (manifestation.WorkId != req.WorkId) return (null, Bad("That edition belongs to a different work."));
        }

        return (work, null);
    }

    private static string? NormalizeLocatorJson(string? raw, out string? error)
    {
        error = null;
        var text = NormalizeText(raw);
        if (text is null) return null;

        try
        {
            using var document = JsonDocument.Parse(text);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                error = "The locator must be a JSON object.";
                return null;
            }
        }
        catch (JsonException)
        {
            error = "The locator is not valid JSON.";
            return null;
        }

        return text;
    }

    /// <summary>
    /// The locator without its label — "42" rather than "s. 42". Chicago notes
    /// and the author-date styles supply their own label, or none at all.
    /// Only paged citations differ this way; every other scheme's rendered form
    /// is already the whole locator.
    /// </summary>
    private static string? BareLocator(string? locatorJson, string scheme)
    {
        if (scheme != "Page" || string.IsNullOrWhiteSpace(locatorJson)) return null;

        try
        {
            using var document = JsonDocument.Parse(locatorJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return null;

            string? Read(string property) =>
                document.RootElement.TryGetProperty(property, out var value)
                    ? value.ValueKind switch
                    {
                        JsonValueKind.String => value.GetString(),
                        JsonValueKind.Number => value.ToString(),
                        _ => null
                    }
                    : null;

            var page = Read("page");
            if (string.IsNullOrWhiteSpace(page)) return null;

            var pageEnd = Read("pageEnd");
            return string.IsNullOrWhiteSpace(pageEnd) ? page : $"{page}–{pageEnd}";
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? RenderLocator(
        ICitationService citations, LibraryWork work, string? locatorJson, string displayLanguage) =>
        citations.Render(
            locatorJson,
            work.CitationScheme,
            new CitationContext(work.CitationSigil, work.StructureTemplateJson, displayLanguage));

    /// <summary>
    /// Re-renders every locator on a work. Called when the citation scheme
    /// changes, since the stored display string was produced by the old one.
    /// </summary>
    private static async Task ReRenderQuotesForWorkAsync(
        RecreatioDbContext db, Guid userId, LibraryWork work, ICitationService citations, CancellationToken ct)
    {
        var quotes = await db.LibraryQuotes
            .Where(x => x.OwnerAccountId == userId && x.WorkId == work.Id)
            .ToListAsync(ct);
        if (quotes.Count == 0) return;

        foreach (var quote in quotes)
        {
            quote.LocatorDisplay = RenderLocator(citations, work, quote.LocatorJson, "pl");
        }

        await db.SaveChangesAsync(ct);
    }

    // ── Response building ───────────────────────────────────────────────────

    private static async Task<List<LibraryQuoteResponse>> BuildQuoteResponsesAsync(
        RecreatioDbContext db,
        Guid userId,
        IReadOnlyList<LibraryQuote> quotes,
        ICitationService citations,
        string displayLanguage,
        ICitationStyle style,
        CancellationToken ct)
    {
        if (quotes.Count == 0) return [];

        var workIds = quotes.Select(x => x.WorkId).Distinct().ToList();
        var works = await db.LibraryWorks.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.Id))
            .ToListAsync(ct);
        var workById = works.ToDictionary(x => x.Id);

        var expressionIds = quotes.Where(x => x.ExpressionId != null).Select(x => x.ExpressionId!.Value).Distinct().ToList();
        var expressions = await db.LibraryExpressions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && expressionIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.Language })
            .ToListAsync(ct);
        var expressionById = expressions.ToDictionary(x => x.Id);

        var manifestationIds = quotes.Where(x => x.ManifestationId != null).Select(x => x.ManifestationId!.Value).Distinct().ToList();
        var manifestations = await db.LibraryManifestations.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && manifestationIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id, x.Title, x.PublisherId, x.PublishedYear,
                x.PublishedPlace, x.EditionStatement, x.Series, x.Url
            })
            .ToListAsync(ct);
        var manifestationById = manifestations.ToDictionary(x => x.Id);

        var publisherIds = manifestations.Where(x => x.PublisherId != null).Select(x => x.PublisherId!.Value).Distinct().ToList();
        var publishers = await db.LibraryPublishers.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && publisherIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        var publisherById = publishers.ToDictionary(x => x.Id, x => x.Name);

        // Styles need both name orders, so contributors are loaded in full rather
        // than as display strings.
        var contributionsByWork = await LoadContributionsAsync(db, userId, "work", workIds, ct);
        var contributionsByExpression = await LoadContributionsAsync(db, userId, "expression", expressionIds, ct);
        var contributionsByManifestation = await LoadContributionsAsync(db, userId, "manifestation", manifestationIds, ct);

        var allPersonIds = contributionsByWork.Values.Concat(contributionsByExpression.Values)
            .Concat(contributionsByManifestation.Values)
            .SelectMany(x => x)
            .Select(x => x.PersonId)
            .Distinct()
            .ToList();
        var people = await db.LibraryPeople.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && allPersonIds.Contains(x.Id))
            .Select(x => new { x.Id, x.DisplayName, x.SortName })
            .ToListAsync(ct);
        var nameById = people.ToDictionary(x => x.Id, x => new CitationName(x.DisplayName, x.SortName));

        List<CitationName> NamesFor(
            Dictionary<long, List<LibraryContributionResponse>> source, long? targetId, params string[] roles)
        {
            if (targetId is not { } id) return [];
            return (source.GetValueOrDefault(id) ?? [])
                .Where(x => roles.Contains(x.Role))
                .Select(x => nameById.GetValueOrDefault(x.PersonId))
                .Where(x => x is not null)
                .Select(x => x!)
                .ToList();
        }

        var authorsByWork = await LoadAuthorNamesAsync(db, userId, workIds, ct);
        var tagsByQuote = await LoadTagsForQuotesAsync(db, userId, quotes.Select(x => x.Id).ToList(), ct);

        return quotes.Select(quote =>
        {
            var work = workById.GetValueOrDefault(quote.WorkId);
            var expression = quote.ExpressionId is { } eid ? expressionById.GetValueOrDefault(eid) : null;
            var manifestation = quote.ManifestationId is { } mid ? manifestationById.GetValueOrDefault(mid) : null;
            var publisherName = manifestation?.PublisherId is { } pid ? publisherById.GetValueOrDefault(pid) : null;
            var authors = authorsByWork.GetValueOrDefault(quote.WorkId) ?? [];

            // Render fresh for the requested language rather than trusting the
            // stored string, which was written in whatever language was current.
            var locatorDisplay = work is null
                ? quote.LocatorDisplay
                : RenderLocator(citations, work, quote.LocatorJson, displayLanguage) ?? quote.LocatorDisplay;

            var workTitle = work?.UniformTitle ?? work?.OriginalTitle ?? string.Empty;
            var scheme = work?.CitationScheme ?? "Page";

            var subject = new CitationSubject(
                scheme,
                NamesFor(contributionsByWork, quote.WorkId, "author", "coauthor"),
                NamesFor(contributionsByExpression, quote.ExpressionId, "translator"),
                NamesFor(contributionsByManifestation, quote.ManifestationId, "editor", "compiler"),
                workTitle,
                expression?.Name,
                expression?.Language,
                manifestation?.Title,
                publisherName,
                manifestation?.PublishedPlace,
                manifestation?.PublishedYear,
                manifestation?.EditionStatement,
                manifestation?.Series,
                manifestation?.Url,
                locatorDisplay,
                BareLocator(quote.LocatorJson, scheme),
                work?.CitationSigil);

            var activeStyle = style;

            return new LibraryQuoteResponse(
                quote.Id, quote.WorkId, workTitle, scheme,
                quote.ExpressionId, expression?.Name, expression?.Language,
                quote.ManifestationId, manifestation?.Title, publisherName, manifestation?.PublishedYear,
                authors,
                quote.QuoteText, quote.LocatorJson, locatorDisplay,
                activeStyle.FormatNote(subject),
                activeStyle.FormatBibliography(subject),
                activeStyle.Key,
                quote.Description, quote.Context,
                tagsByQuote.GetValueOrDefault(quote.Id) ?? [],
                quote.CreatedUtc, quote.UpdatedUtc);
        }).ToList();
    }

    // ── JSON import ─────────────────────────────────────────────────────────

    private static void MapQuoteImportEndpoint(RouteGroupBuilder group)
    {
        group.MapPost("/quotes/import", async (
            LibraryQuoteImportRequest req,
            string? lang,
            HttpContext ctx,
            RecreatioDbContext db,
            ICitationService citations,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var displayLanguage = ResolveDisplayLanguage(lang);
            var now = DateTimeOffset.UtcNow;
            var errors = new List<LibraryQuoteImportError>();
            var imported = 0;
            var worksCreated = 0;
            var expressionsCreated = 0;
            var manifestationsCreated = 0;
            var tagsCreated = 0;

            for (var index = 0; index < req.Quotes.Count; index++)
            {
                var item = req.Quotes[index];

                // One bad record must not cost the whole batch.
                try
                {
                    var text = NormalizeText(item.QuoteText);
                    if (text is null)
                    {
                        errors.Add(new LibraryQuoteImportError(index, "quoteText is required."));
                        continue;
                    }

                    var (work, created) = await ResolveImportWorkAsync(db, userId, item, now, ct);
                    if (work is null)
                    {
                        errors.Add(new LibraryQuoteImportError(index,
                            "The work could not be matched or created: give workId, or workTitle with workOriginalLanguage."));
                        continue;
                    }
                    if (created) worksCreated++;

                    var expression = await ResolveImportExpressionAsync(db, userId, item, work, now, ct);
                    if (expression.Created) expressionsCreated++;

                    var manifestation = await ResolveImportManifestationAsync(db, userId, item, work, expression.Id, now, ct);
                    if (manifestation.Created) manifestationsCreated++;

                    var locatorJson = item.Locator is { } locator && locator.ValueKind == JsonValueKind.Object
                        ? locator.GetRawText()
                        : null;

                    var quote = new LibraryQuote
                    {
                        OwnerAccountId = userId,
                        WorkId = work.Id,
                        ExpressionId = expression.Id,
                        ManifestationId = manifestation.Id,
                        QuoteText = text,
                        LocatorJson = locatorJson,
                        // A file may carry a pre-rendered locator; the formatter
                        // wins when it can render, since it stays consistent.
                        LocatorDisplay = RenderLocator(citations, work, locatorJson, displayLanguage)
                                         ?? Normalize(item.LocatorDisplay, 200),
                        Description = NormalizeText(item.Description),
                        Context = NormalizeText(item.Context),
                        CreatedUtc = now,
                        UpdatedUtc = now
                    };
                    db.LibraryQuotes.Add(quote);
                    await db.SaveChangesAsync(ct);

                    foreach (var tagName in item.Tags ?? [])
                    {
                        var existed = await db.LibraryTags
                            .AnyAsync(x => x.OwnerAccountId == userId && x.Name == tagName.Trim(), ct);
                        var tagId = await ResolveTagIdAsync(db, userId, tagName, now, ct);
                        if (tagId is null) continue;
                        if (!existed) tagsCreated++;

                        db.LibraryQuoteTags.Add(new LibraryQuoteTag
                        {
                            OwnerAccountId = userId,
                            QuoteId = quote.Id,
                            TagId = tagId.Value,
                            CreatedUtc = now
                        });
                    }
                    await db.SaveChangesAsync(ct);

                    imported++;
                }
                catch (Exception ex) when (ex is DbUpdateException or InvalidOperationException or JsonException)
                {
                    errors.Add(new LibraryQuoteImportError(index, ex.Message));
                }
            }

            return Results.Ok(new LibraryQuoteImportResponse(
                imported, errors.Count, worksCreated, expressionsCreated, manifestationsCreated, tagsCreated, errors));
        });
    }

    /// <summary>Matches a work by id, then by title, and creates one as a last resort.</summary>
    private static async Task<(LibraryWork? Work, bool Created)> ResolveImportWorkAsync(
        RecreatioDbContext db, Guid userId, LibraryQuoteImportItem item, DateTimeOffset now, CancellationToken ct)
    {
        if (item.WorkId is { } id)
        {
            var byId = await db.LibraryWorks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            return (byId, false);
        }

        var title = Normalize(item.WorkTitle, 400);
        if (title is null) return (null, false);

        var existing = await db.LibraryWorks.AsNoTracking()
            .FirstOrDefaultAsync(x => x.OwnerAccountId == userId &&
                (x.OriginalTitle == title || x.UniformTitle == title), ct);
        if (existing is not null) return (existing, false);

        var language = NormalizeLanguage(item.WorkOriginalLanguage);
        if (language is null) return (null, false);

        var work = new LibraryWork
        {
            OwnerAccountId = userId,
            OriginalTitle = title,
            OriginalLanguage = language,
            Kind = NormalizeFrom(item.WorkKind, WorkKinds) ?? "book",
            CitationScheme = NormalizeFrom(item.WorkCitationScheme, CitationSchemes) ?? "Page",
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.LibraryWorks.Add(work);
        await db.SaveChangesAsync(ct);

        var personId = await ResolvePersonIdAsync(db, userId, item.AuthorName, now, ct);
        if (personId is not null)
        {
            db.LibraryContributions.Add(new LibraryContribution
            {
                OwnerAccountId = userId,
                PersonId = personId.Value,
                TargetType = "work",
                TargetId = work.Id,
                Role = "author",
                SortOrder = 0,
                CreatedUtc = now
            });
            await db.SaveChangesAsync(ct);
        }

        return (work, true);
    }

    private static async Task<(long? Id, bool Created)> ResolveImportExpressionAsync(
        RecreatioDbContext db, Guid userId, LibraryQuoteImportItem item, LibraryWork work, DateTimeOffset now, CancellationToken ct)
    {
        if (item.ExpressionId is { } id)
        {
            var exists = await db.LibraryExpressions.AsNoTracking()
                .AnyAsync(x => x.Id == id && x.OwnerAccountId == userId && x.WorkId == work.Id, ct);
            return (exists ? id : null, false);
        }

        var language = NormalizeLanguage(item.ExpressionLanguage);
        var name = Normalize(item.ExpressionName, 240);
        if (language is null && name is null) return (null, false);

        var existing = await db.LibraryExpressions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.OwnerAccountId == userId && x.WorkId == work.Id &&
                (name != null ? x.Name == name : x.Language == language), ct);
        if (existing is not null) return (existing.Id, false);

        var expression = new LibraryExpression
        {
            OwnerAccountId = userId,
            WorkId = work.Id,
            Language = language ?? work.OriginalLanguage,
            Name = name,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.LibraryExpressions.Add(expression);
        await db.SaveChangesAsync(ct);
        return (expression.Id, true);
    }

    private static async Task<(long? Id, bool Created)> ResolveImportManifestationAsync(
        RecreatioDbContext db,
        Guid userId,
        LibraryQuoteImportItem item,
        LibraryWork work,
        long? expressionId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (item.ManifestationId is { } id)
        {
            var exists = await db.LibraryManifestations.AsNoTracking()
                .AnyAsync(x => x.Id == id && x.OwnerAccountId == userId && x.WorkId == work.Id, ct);
            return (exists ? id : null, false);
        }

        var isbn = NormalizeIsbn(item.Isbn);
        if (isbn is not null)
        {
            var compact = CompactIsbn(isbn);
            var candidates = await db.LibraryManifestations.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.Isbn != null)
                .Select(x => new { x.Id, x.Isbn })
                .ToListAsync(ct);
            var match = candidates.FirstOrDefault(x => CompactIsbn(x.Isbn) == compact);
            if (match is not null) return (match.Id, false);
        }

        var title = Normalize(item.ManifestationTitle, 400);
        if (title is null && isbn is null) return (null, false);

        var manifestation = new LibraryManifestation
        {
            OwnerAccountId = userId,
            WorkId = work.Id,
            ExpressionId = expressionId,
            Format = "Print",
            Title = title ?? work.OriginalTitle,
            Isbn = isbn,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.LibraryManifestations.Add(manifestation);
        await db.SaveChangesAsync(ct);
        return (manifestation.Id, true);
    }
}
