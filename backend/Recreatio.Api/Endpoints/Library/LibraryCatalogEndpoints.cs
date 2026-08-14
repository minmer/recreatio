using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Library;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Library;

namespace Recreatio.Api.Endpoints.Library;

// Work → Expression → Manifestation → Item.
//
// A manifestation always stores WorkId, even when it hangs off an expression:
// the schema allows either, but keeping the work reference populated means every
// query can reach the work in one hop instead of branching on which parent is set.
public static partial class LibraryEndpoints
{
    // ── Works ───────────────────────────────────────────────────────────────

    private static void MapWorkEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/works", async (
            string? term,
            string? kind,
            string? citationScheme,
            string? originalLanguage,
            string? expressionLanguage,
            long? personId,
            long? tagId,
            long? publisherId,
            bool? onlyTranslated,
            bool? onlyOwned,
            bool? onlyQuoted,
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
                // Match the work's own titles, any manifestation title, and the
                // ISBN — so a scanned barcode or a translated title both land here.
                var viaManifestation = db.LibraryManifestations.AsNoTracking()
                    .Where(m => m.OwnerAccountId == userId &&
                        (m.Title.Contains(search) || (m.Isbn != null && m.Isbn.Contains(search))))
                    .Select(m => m.WorkId);

                query = query.Where(x =>
                    x.OriginalTitle.Contains(search) ||
                    (x.OriginalSubtitle != null && x.OriginalSubtitle.Contains(search)) ||
                    (x.UniformTitle != null && x.UniformTitle.Contains(search)) ||
                    viaManifestation.Contains(x.Id));
            }

            var kindFilter = NormalizeFrom(kind, WorkKinds);
            if (kindFilter is not null) query = query.Where(x => x.Kind == kindFilter);

            var schemeFilter = NormalizeFrom(citationScheme, CitationSchemes);
            if (schemeFilter is not null) query = query.Where(x => x.CitationScheme == schemeFilter);

            var originalFilter = NormalizeLanguage(originalLanguage);
            if (originalFilter is not null) query = query.Where(x => x.OriginalLanguage == originalFilter);

            var expressionFilter = NormalizeLanguage(expressionLanguage);
            if (expressionFilter is not null)
            {
                var ids = db.LibraryExpressions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId && e.Language == expressionFilter)
                    .Select(e => e.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (publisherId is { } publisher)
            {
                var ids = db.LibraryManifestations.AsNoTracking()
                    .Where(m => m.OwnerAccountId == userId && m.PublisherId == publisher)
                    .Select(m => m.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (personId is { } person)
            {
                // Connected through the work, or through any of its expressions
                // or manifestations — a translator counts as connected.
                var direct = db.LibraryContributions.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId && c.PersonId == person && c.TargetType == "work")
                    .Select(c => c.TargetId);
                var expressionIds = db.LibraryContributions.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId && c.PersonId == person && c.TargetType == "expression")
                    .Select(c => c.TargetId);
                var viaExpression = db.LibraryExpressions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId && expressionIds.Contains(e.Id))
                    .Select(e => e.WorkId);
                var manifestationIds = db.LibraryContributions.AsNoTracking()
                    .Where(c => c.OwnerAccountId == userId && c.PersonId == person && c.TargetType == "manifestation")
                    .Select(c => c.TargetId);
                var viaManifestation = db.LibraryManifestations.AsNoTracking()
                    .Where(m => m.OwnerAccountId == userId && manifestationIds.Contains(m.Id))
                    .Select(m => m.WorkId);

                query = query.Where(x =>
                    direct.Contains(x.Id) || viaExpression.Contains(x.Id) || viaManifestation.Contains(x.Id));
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
                var ids = db.LibraryExpressions.AsNoTracking()
                    .Where(e => e.OwnerAccountId == userId)
                    .Join(db.LibraryWorks.AsNoTracking().Where(w => w.OwnerAccountId == userId),
                        e => e.WorkId, w => w.Id, (e, w) => new { e.WorkId, e.Language, w.OriginalLanguage })
                    .Where(x => x.Language != x.OriginalLanguage)
                    .Select(x => x.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (onlyOwned == true)
            {
                var ids = db.LibraryItems.AsNoTracking()
                    .Where(i => i.OwnerAccountId == userId)
                    .Join(db.LibraryManifestations.AsNoTracking().Where(m => m.OwnerAccountId == userId),
                        i => i.ManifestationId, m => m.Id, (i, m) => m.WorkId);
                query = query.Where(x => ids.Contains(x.Id));
            }

            if (onlyQuoted == true)
            {
                var ids = db.LibraryQuotes.AsNoTracking()
                    .Where(q => q.OwnerAccountId == userId)
                    .Select(q => (long?)q.WorkId);
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
            var workIds = works.Select(x => x.Id).ToList();

            var expressions = await db.LibraryExpressions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.WorkId))
                .Select(x => new { x.Id, x.WorkId, x.Language })
                .ToListAsync(ct);

            var manifestations = await db.LibraryManifestations.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.WorkId != null && workIds.Contains(x.WorkId!.Value))
                .Select(x => new { x.Id, WorkId = x.WorkId!.Value })
                .ToListAsync(ct);
            var manifestationIdList = manifestations.Select(x => x.Id).ToList();

            var itemCounts = await db.LibraryItems.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && manifestationIdList.Contains(x.ManifestationId))
                .GroupBy(x => x.ManifestationId)
                .Select(g => new { ManifestationId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var itemCountByManifestation = itemCounts.ToDictionary(x => x.ManifestationId, x => x.Count);

            var quoteCounts = await db.LibraryQuotes.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && workIds.Contains(x.WorkId))
                .GroupBy(x => x.WorkId)
                .Select(g => new { WorkId = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            var quoteCountByWork = quoteCounts.ToDictionary(x => x.WorkId, x => x.Count);

            var authorsByWork = await LoadAuthorNamesAsync(db, userId, workIds, ct);
            var tagsByWork = await LoadTagsForWorksAsync(db, userId, workIds, ct);

            var expressionsByWork = expressions.GroupBy(x => x.WorkId).ToDictionary(g => g.Key, g => g.ToList());
            var manifestationsByWork = manifestations.GroupBy(x => x.WorkId).ToDictionary(g => g.Key, g => g.ToList());

            var items = works.Select(work =>
            {
                var workExpressions = expressionsByWork.GetValueOrDefault(work.Id) ?? [];
                var workManifestations = manifestationsByWork.GetValueOrDefault(work.Id) ?? [];
                return new LibraryWorkListItem(
                    work.Id, work.OriginalTitle, work.OriginalSubtitle, work.OriginalLanguage,
                    work.UniformTitle, work.Kind, work.CitationScheme, work.FirstPublishedYear,
                    authorsByWork.GetValueOrDefault(work.Id) ?? [],
                    workExpressions.Select(x => x.Language).Distinct().OrderBy(x => x, StringComparer.Ordinal).ToList(),
                    tagsByWork.GetValueOrDefault(work.Id) ?? [],
                    workExpressions.Count,
                    workManifestations.Count,
                    workManifestations.Sum(x => itemCountByManifestation.GetValueOrDefault(x.Id, 0)),
                    quoteCountByWork.GetValueOrDefault(work.Id, 0));
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

            var expressions = await LoadExpressionListAsync(db, userId, id, work.OriginalLanguage, ct);
            var manifestations = await LoadManifestationListAsync(db, userId, m => m.WorkId == id, ct);
            var quoteCount = await db.LibraryQuotes.CountAsync(x => x.OwnerAccountId == userId && x.WorkId == id, ct);

            return Results.Ok(new LibraryWorkDetailResponse(
                work.Id, work.OriginalTitle, work.OriginalSubtitle, work.OriginalLanguage, work.UniformTitle,
                work.Kind, work.CitationScheme, work.StructureTemplateJson, work.CitationSigil,
                work.FirstPublishedYear, work.Notes,
                contributions.GetValueOrDefault(id) ?? [],
                tagIds, expressions, manifestations, quoteCount,
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
            var work = new LibraryWork { OwnerAccountId = userId, CreatedUtc = now, UpdatedUtc = now };
            var error = ApplyWork(work, req, title, language);
            if (error is not null) return error;

            db.LibraryWorks.Add(work);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = work.Id });
        });

        group.MapPut("/works/{id:long}", async (
            long id,
            LibraryWorkSaveRequest req,
            HttpContext ctx,
            RecreatioDbContext db,
            Services.Library.ICitationService citations,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var work = await db.LibraryWorks.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var title = Normalize(req.OriginalTitle, 400);
            if (title is null) return Bad("Original title is required.");

            var language = NormalizeLanguage(req.OriginalLanguage);
            if (language is null) return Bad("Original language is required.");

            var schemeChanged = !string.Equals(work.CitationScheme, req.CitationScheme, StringComparison.Ordinal);
            var error = ApplyWork(work, req, title, language);
            if (error is not null) return error;

            work.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            // Changing the scheme invalidates every rendered locator on the work.
            if (schemeChanged) await ReRenderQuotesForWorkAsync(db, userId, work, citations, ct);

            return Results.Ok(new { id = work.Id });
        });

        group.MapDelete("/works/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var work = await db.LibraryWorks.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            // Quotes are the reason to be careful here: deleting a work destroys
            // citations, so the caller has to mean it.
            var quoteCount = await db.LibraryQuotes.CountAsync(x => x.OwnerAccountId == userId && x.WorkId == id, ct);
            if (quoteCount > 0 && !ctx.Request.Query.ContainsKey("force"))
            {
                return Results.Conflict(new
                {
                    error = "This work still has quotes.",
                    quotes = quoteCount
                });
            }

            var quoteIds = await db.LibraryQuotes.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.WorkId == id)
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (quoteIds.Count > 0)
            {
                await db.LibraryQuoteTags.Where(x => x.OwnerAccountId == userId && quoteIds.Contains(x.QuoteId)).ExecuteDeleteAsync(ct);
                await db.LibraryQuotes.Where(x => x.OwnerAccountId == userId && x.WorkId == id).ExecuteDeleteAsync(ct);
            }

            var manifestationIds = await db.LibraryManifestations.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.WorkId == id)
                .Select(x => x.Id)
                .ToListAsync(ct);
            foreach (var manifestationId in manifestationIds)
            {
                await DeleteManifestationCascadeAsync(db, userId, manifestationId, ct);
            }
            await db.LibraryManifestations.Where(x => x.OwnerAccountId == userId && x.WorkId == id).ExecuteDeleteAsync(ct);

            var expressionIds = await db.LibraryExpressions.AsNoTracking()
                .Where(x => x.OwnerAccountId == userId && x.WorkId == id)
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (expressionIds.Count > 0)
            {
                await db.LibraryContributions
                    .Where(x => x.OwnerAccountId == userId && x.TargetType == "expression" && expressionIds.Contains(x.TargetId))
                    .ExecuteDeleteAsync(ct);
                await db.LibraryExpressions.Where(x => x.OwnerAccountId == userId && x.WorkId == id).ExecuteDeleteAsync(ct);
            }

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

            if (!await db.LibraryWorks.AnyAsync(x => x.Id == id && x.OwnerAccountId == userId, ct)) return Results.NotFound();

            var error = await ReplaceContributionsAsync(db, userId, "work", id, req.Contributions, ct);
            if (error is not null) return error;

            await db.SaveChangesAsync(ct);
            var contributions = await LoadContributionsAsync(db, userId, "work", [id], ct);
            return Results.Ok(contributions.GetValueOrDefault(id) ?? []);
        });

        group.MapPut("/works/{id:long}/tags", async (long id, LibraryWorkTagsSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            if (!await db.LibraryWorks.AnyAsync(x => x.Id == id && x.OwnerAccountId == userId, ct)) return Results.NotFound();

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

    private static IResult? ApplyWork(LibraryWork work, LibraryWorkSaveRequest req, string title, string language)
    {
        var scheme = NormalizeFrom(req.CitationScheme, CitationSchemes);
        if (scheme is null) return Bad("Unknown citation scheme.");

        // The template is stored verbatim but must at least be valid JSON.
        var template = NormalizeText(req.StructureTemplateJson);
        if (template is not null)
        {
            try
            {
                using var _ = System.Text.Json.JsonDocument.Parse(template);
            }
            catch (System.Text.Json.JsonException)
            {
                return Bad("The structure template is not valid JSON.");
            }
        }

        work.OriginalTitle = title;
        work.OriginalSubtitle = Normalize(req.OriginalSubtitle, 400);
        work.OriginalLanguage = language;
        work.UniformTitle = Normalize(req.UniformTitle, 400);
        work.Kind = NormalizeFrom(req.Kind, WorkKinds) ?? "book";
        work.CitationScheme = scheme;
        work.StructureTemplateJson = template;
        work.CitationSigil = Normalize(req.CitationSigil, 40);
        work.FirstPublishedYear = NormalizeYear(req.FirstPublishedYear);
        work.Notes = NormalizeText(req.Notes);
        return null;
    }

    // ── Expressions ─────────────────────────────────────────────────────────

    private static void MapExpressionEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/works/{workId:long}/expressions", async (long workId, LibraryExpressionSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            if (!await db.LibraryWorks.AnyAsync(x => x.Id == workId && x.OwnerAccountId == userId, ct)) return Results.NotFound();

            var language = NormalizeLanguage(req.Language);
            if (language is null) return Bad("Language is required.");

            var now = DateTimeOffset.UtcNow;
            var expression = new LibraryExpression
            {
                OwnerAccountId = userId,
                WorkId = workId,
                Language = language,
                Name = Normalize(req.Name, 240),
                Notes = NormalizeText(req.Notes),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.LibraryExpressions.Add(expression);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = expression.Id });
        });

        group.MapGet("/expressions/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var expression = await db.LibraryExpressions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (expression is null) return Results.NotFound();

            var work = await db.LibraryWorks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == expression.WorkId && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var contributions = await LoadContributionsAsync(db, userId, "expression", [id], ct);
            var manifestations = await LoadManifestationListAsync(db, userId, m => m.ExpressionId == id, ct);

            return Results.Ok(new LibraryExpressionDetailResponse(
                expression.Id, expression.WorkId, work.OriginalTitle, work.OriginalLanguage,
                expression.Language, expression.Name,
                !string.Equals(expression.Language, work.OriginalLanguage, StringComparison.Ordinal),
                expression.Notes,
                contributions.GetValueOrDefault(id) ?? [],
                manifestations,
                expression.CreatedUtc, expression.UpdatedUtc));
        });

        group.MapPut("/expressions/{id:long}", async (long id, LibraryExpressionSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var expression = await db.LibraryExpressions.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (expression is null) return Results.NotFound();

            var language = NormalizeLanguage(req.Language);
            if (language is null) return Bad("Language is required.");

            expression.Language = language;
            expression.Name = Normalize(req.Name, 240);
            expression.Notes = NormalizeText(req.Notes);
            expression.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = expression.Id });
        });

        group.MapDelete("/expressions/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var expression = await db.LibraryExpressions.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (expression is null) return Results.NotFound();

            var inUse = await db.LibraryQuotes.CountAsync(x => x.OwnerAccountId == userId && x.ExpressionId == id, ct);
            if (inUse > 0 && !ctx.Request.Query.ContainsKey("force"))
            {
                return Results.Conflict(new { error = "Quotes still point at this translation.", quotes = inUse });
            }

            // Quotes survive: they fall back to citing the work alone.
            await db.LibraryQuotes
                .Where(x => x.OwnerAccountId == userId && x.ExpressionId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ExpressionId, (long?)null), ct);

            // Manifestations survive too, re-attached directly to the work.
            await db.LibraryManifestations
                .Where(x => x.OwnerAccountId == userId && x.ExpressionId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ExpressionId, (long?)null), ct);

            await db.LibraryContributions
                .Where(x => x.OwnerAccountId == userId && x.TargetType == "expression" && x.TargetId == id)
                .ExecuteDeleteAsync(ct);

            db.LibraryExpressions.Remove(expression);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPut("/expressions/{id:long}/contributions", async (long id, LibraryContributionsSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            if (!await db.LibraryExpressions.AnyAsync(x => x.Id == id && x.OwnerAccountId == userId, ct)) return Results.NotFound();

            var error = await ReplaceContributionsAsync(db, userId, "expression", id, req.Contributions, ct);
            if (error is not null) return error;

            await db.SaveChangesAsync(ct);
            var contributions = await LoadContributionsAsync(db, userId, "expression", [id], ct);
            return Results.Ok(contributions.GetValueOrDefault(id) ?? []);
        });
    }

    private static async Task<List<LibraryExpressionListItem>> LoadExpressionListAsync(
        RecreatioDbContext db, Guid userId, long workId, string originalLanguage, CancellationToken ct)
    {
        var expressions = await db.LibraryExpressions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.WorkId == workId)
            .OrderBy(x => x.Language)
            .ToListAsync(ct);
        if (expressions.Count == 0) return [];

        var ids = expressions.Select(x => x.Id).ToList();

        var counts = await db.LibraryManifestations.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.ExpressionId != null && ids.Contains(x.ExpressionId!.Value))
            .GroupBy(x => x.ExpressionId!.Value)
            .Select(g => new { ExpressionId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var countById = counts.ToDictionary(x => x.ExpressionId, x => x.Count);

        var contributions = await LoadContributionsAsync(db, userId, "expression", ids, ct);

        return expressions.Select(x => new LibraryExpressionListItem(
            x.Id, x.WorkId, x.Language, x.Name,
            !string.Equals(x.Language, originalLanguage, StringComparison.Ordinal),
            (contributions.GetValueOrDefault(x.Id) ?? [])
                .Where(c => c.Role == "translator")
                .Select(c => c.PersonName)
                .ToList(),
            countById.GetValueOrDefault(x.Id, 0))).ToList();
    }

    // ── Manifestations ──────────────────────────────────────────────────────

    private static void MapManifestationEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/works/{workId:long}/manifestations", async (long workId, LibraryManifestationSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            if (!await db.LibraryWorks.AnyAsync(x => x.Id == workId && x.OwnerAccountId == userId, ct)) return Results.NotFound();

            var manifestation = new LibraryManifestation
            {
                OwnerAccountId = userId,
                WorkId = workId,
                CreatedUtc = DateTimeOffset.UtcNow,
                UpdatedUtc = DateTimeOffset.UtcNow
            };

            var error = await ApplyManifestationAsync(db, userId, manifestation, req, workId, ct);
            if (error is not null) return error;

            db.LibraryManifestations.Add(manifestation);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = manifestation.Id });
        });

        group.MapGet("/manifestations/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var manifestation = await db.LibraryManifestations.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (manifestation is null || manifestation.WorkId is null) return Results.NotFound();

            var work = await db.LibraryWorks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == manifestation.WorkId && x.OwnerAccountId == userId, ct);
            if (work is null) return Results.NotFound();

            var expression = manifestation.ExpressionId is { } expressionId
                ? await db.LibraryExpressions.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == expressionId && x.OwnerAccountId == userId, ct)
                : null;

            var publisherName = manifestation.PublisherId is { } publisherId
                ? await db.LibraryPublishers.AsNoTracking()
                    .Where(x => x.Id == publisherId && x.OwnerAccountId == userId)
                    .Select(x => x.Name).FirstOrDefaultAsync(ct)
                : null;

            var contributions = await LoadContributionsAsync(db, userId, "manifestation", [id], ct);
            var items = await LoadItemsAsync(db, userId, [id], ct);

            return Results.Ok(new LibraryManifestationDetailResponse(
                manifestation.Id, work.Id, work.OriginalTitle, work.OriginalLanguage, work.CitationScheme,
                manifestation.ExpressionId, expression?.Name, expression?.Language,
                manifestation.Format, manifestation.Title, manifestation.Subtitle,
                manifestation.PublisherId, publisherName, manifestation.PublishedPlace, manifestation.PublishedYear,
                manifestation.EditionStatement, manifestation.Series, manifestation.SeriesNumber,
                manifestation.Isbn, manifestation.Issn, manifestation.PageCount, manifestation.Volume,
                manifestation.Binding, manifestation.Url, manifestation.OriginalTextUrl, manifestation.CoverImageUrl,
                manifestation.HeightMm, manifestation.WidthMm, manifestation.DepthMm, manifestation.Notes,
                contributions.GetValueOrDefault(id) ?? [],
                items.GetValueOrDefault(id) ?? [],
                manifestation.CreatedUtc, manifestation.UpdatedUtc));
        });

        group.MapPut("/manifestations/{id:long}", async (long id, LibraryManifestationSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var manifestation = await db.LibraryManifestations.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (manifestation is null || manifestation.WorkId is null) return Results.NotFound();

            var error = await ApplyManifestationAsync(db, userId, manifestation, req, manifestation.WorkId.Value, ct);
            if (error is not null) return error;

            manifestation.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { id = manifestation.Id });
        });

        group.MapDelete("/manifestations/{id:long}", async (long id, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            var manifestation = await db.LibraryManifestations.FirstOrDefaultAsync(x => x.Id == id && x.OwnerAccountId == userId, ct);
            if (manifestation is null) return Results.NotFound();

            var inUse = await db.LibraryQuotes.CountAsync(x => x.OwnerAccountId == userId && x.ManifestationId == id, ct);
            if (inUse > 0 && !ctx.Request.Query.ContainsKey("force"))
            {
                return Results.Conflict(new { error = "Quotes still point at this edition.", quotes = inUse });
            }

            await DeleteManifestationCascadeAsync(db, userId, id, ct);
            db.LibraryManifestations.Remove(manifestation);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPut("/manifestations/{id:long}/contributions", async (long id, LibraryContributionsSaveRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();

            if (!await db.LibraryManifestations.AnyAsync(x => x.Id == id && x.OwnerAccountId == userId, ct)) return Results.NotFound();

            var error = await ReplaceContributionsAsync(db, userId, "manifestation", id, req.Contributions, ct);
            if (error is not null) return error;

            await db.SaveChangesAsync(ct);
            var contributions = await LoadContributionsAsync(db, userId, "manifestation", [id], ct);
            return Results.Ok(contributions.GetValueOrDefault(id) ?? []);
        });
    }

    private static async Task<IResult?> ApplyManifestationAsync(
        RecreatioDbContext db,
        Guid userId,
        LibraryManifestation manifestation,
        LibraryManifestationSaveRequest req,
        long workId,
        CancellationToken ct)
    {
        var title = Normalize(req.Title, 400);
        if (title is null) return Bad("Title is required.");

        if (req.ExpressionId is { } expressionId)
        {
            var belongs = await db.LibraryExpressions.AsNoTracking()
                .AnyAsync(x => x.Id == expressionId && x.OwnerAccountId == userId && x.WorkId == workId, ct);
            if (!belongs) return Bad("That translation belongs to a different work.");
        }

        if (req.PublisherId is { } publisherId &&
            !await db.LibraryPublishers.AnyAsync(x => x.Id == publisherId && x.OwnerAccountId == userId, ct))
        {
            return Bad("Publisher does not exist.");
        }

        var format = NormalizeFrom(req.Format, ManifestationFormats) ?? "Print";
        var url = NormalizeUrl(req.Url);
        if (format == "Web" && url is null) return Bad("A web source needs a URL.");

        manifestation.WorkId = workId;
        manifestation.ExpressionId = req.ExpressionId;
        manifestation.Format = format;
        manifestation.Title = title;
        manifestation.Subtitle = Normalize(req.Subtitle, 400);
        manifestation.PublisherId = req.PublisherId;
        manifestation.PublishedPlace = Normalize(req.PublishedPlace, 160);
        manifestation.PublishedYear = NormalizeYear(req.PublishedYear);
        manifestation.EditionStatement = Normalize(req.EditionStatement, 160);
        manifestation.Series = Normalize(req.Series, 200);
        manifestation.SeriesNumber = Normalize(req.SeriesNumber, 60);
        manifestation.Isbn = NormalizeIsbn(req.Isbn);
        manifestation.Issn = Normalize(req.Issn, 32);
        manifestation.PageCount = NormalizePositive(req.PageCount, 100000);
        manifestation.Volume = Normalize(req.Volume, 60);
        manifestation.Binding = NormalizeFrom(req.Binding, Bindings);
        manifestation.Url = url;
        manifestation.OriginalTextUrl = NormalizeUrl(req.OriginalTextUrl);
        manifestation.CoverImageUrl = NormalizeUrl(req.CoverImageUrl);
        manifestation.HeightMm = NormalizePositive(req.HeightMm, 2000);
        manifestation.WidthMm = NormalizePositive(req.WidthMm, 2000);
        manifestation.DepthMm = NormalizePositive(req.DepthMm, 1000);
        manifestation.Notes = NormalizeText(req.Notes);
        return null;
    }

    private static async Task<List<LibraryManifestationListItem>> LoadManifestationListAsync(
        RecreatioDbContext db,
        Guid userId,
        System.Linq.Expressions.Expression<Func<LibraryManifestation, bool>> filter,
        CancellationToken ct)
    {
        var manifestations = await db.LibraryManifestations.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId)
            .Where(filter)
            .OrderBy(x => x.PublishedYear ?? int.MaxValue).ThenBy(x => x.Title)
            .ToListAsync(ct);
        if (manifestations.Count == 0) return [];

        var ids = manifestations.Select(x => x.Id).ToList();

        var publisherIds = manifestations.Where(x => x.PublisherId != null).Select(x => x.PublisherId!.Value).Distinct().ToList();
        var publishers = await db.LibraryPublishers.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && publisherIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        var publisherById = publishers.ToDictionary(x => x.Id, x => x.Name);

        var expressionIds = manifestations.Where(x => x.ExpressionId != null).Select(x => x.ExpressionId!.Value).Distinct().ToList();
        var expressions = await db.LibraryExpressions.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && expressionIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.Language })
            .ToListAsync(ct);
        var expressionById = expressions.ToDictionary(x => x.Id);

        var counts = await db.LibraryItems.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && ids.Contains(x.ManifestationId))
            .GroupBy(x => x.ManifestationId)
            .Select(g => new { ManifestationId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var countById = counts.ToDictionary(x => x.ManifestationId, x => x.Count);

        return manifestations.Select(x =>
        {
            var expression = x.ExpressionId is { } id ? expressionById.GetValueOrDefault(id) : null;
            return new LibraryManifestationListItem(
                x.Id, x.WorkId, x.ExpressionId, expression?.Name, expression?.Language,
                x.Format, x.Title, x.Subtitle,
                x.PublisherId, x.PublisherId is { } pid ? publisherById.GetValueOrDefault(pid) : null,
                x.PublishedPlace, x.PublishedYear, x.EditionStatement, x.Isbn, x.PageCount, x.Binding,
                x.Url, x.CoverImageUrl, x.HeightMm, x.WidthMm, x.DepthMm,
                countById.GetValueOrDefault(x.Id, 0));
        }).ToList();
    }

    private static async Task DeleteManifestationCascadeAsync(
        RecreatioDbContext db, Guid userId, long manifestationId, CancellationToken ct)
    {
        var itemIds = await db.LibraryItems.AsNoTracking()
            .Where(x => x.OwnerAccountId == userId && x.ManifestationId == manifestationId)
            .Select(x => x.Id)
            .ToListAsync(ct);

        if (itemIds.Count > 0)
        {
            await db.LibraryLoans.Where(x => x.OwnerAccountId == userId && itemIds.Contains(x.ItemId)).ExecuteDeleteAsync(ct);
            await db.LibraryReadings.Where(x => x.OwnerAccountId == userId && itemIds.Contains(x.ItemId)).ExecuteDeleteAsync(ct);
            await db.LibraryItems.Where(x => x.OwnerAccountId == userId && x.ManifestationId == manifestationId).ExecuteDeleteAsync(ct);
        }

        // Quotes lose the edition pointer but keep the work and the locator.
        await db.LibraryQuotes
            .Where(x => x.OwnerAccountId == userId && x.ManifestationId == manifestationId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ManifestationId, (long?)null), ct);

        await db.LibraryContributions
            .Where(x => x.OwnerAccountId == userId && x.TargetType == "manifestation" && x.TargetId == manifestationId)
            .ExecuteDeleteAsync(ct);
    }
}
