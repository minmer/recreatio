using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;
using Recreatio.Api.Domain.Cogita;
using Recreatio.Api.Endpoints;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaCoreEndpoints
{
    public static void MapCogitaCoreEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/cogita/core").RequireAuthorization();

        group.MapGet("/libraries/{libraryId:guid}/type-specs", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var rows = await dbContext.CogitaKnowledgeTypeSpecs
                .AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .OrderBy(x => x.TypeKey)
                .ThenByDescending(x => x.Version)
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapPut("/libraries/{libraryId:guid}/type-specs/{typeKey}/{version:int}", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            string typeKey,
            int version,
            UpsertKnowledgeTypeSpecRequest request,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var normalizedTypeKey = (typeKey ?? string.Empty).Trim();
            if (normalizedTypeKey.Length == 0)
            {
                return Results.BadRequest(new { error = "typeKey is required" });
            }

            var existing = await dbContext.CogitaKnowledgeTypeSpecs
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.TypeKey == normalizedTypeKey && x.Version == version, ct);
            if (existing is null)
            {
                existing = new Data.Cogita.CogitaKnowledgeTypeSpec
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    TypeKey = normalizedTypeKey,
                    Version = version,
                    DisplayName = (request.DisplayName ?? normalizedTypeKey).Trim(),
                    SpecJson = string.IsNullOrWhiteSpace(request.SpecJson) ? "{}" : request.SpecJson,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaKnowledgeTypeSpecs.Add(existing);
            }
            else
            {
                existing.DisplayName = (request.DisplayName ?? existing.DisplayName).Trim();
                existing.SpecJson = string.IsNullOrWhiteSpace(request.SpecJson) ? existing.SpecJson : request.SpecJson;
                existing.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(existing);
        });

        group.MapGet("/libraries/{libraryId:guid}/items", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            string? q,
            string? typeKey,
            int? limit,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var normalizedLimit = Math.Clamp(limit ?? 200, 1, 2000);
            var normalizedQuery = (q ?? string.Empty).Trim();
            var normalizedType = (typeKey ?? string.Empty).Trim();

            var query = dbContext.CogitaKnowledgeItems
                .AsNoTracking()
                .Where(x => x.LibraryId == libraryId);
            if (normalizedType.Length > 0)
            {
                query = query.Where(x => x.TypeKey == normalizedType);
            }
            if (normalizedQuery.Length > 0)
            {
                query = query.Where(x => x.Title.Contains(normalizedQuery) || x.SearchText.Contains(normalizedQuery));
            }

            var rows = await query
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(normalizedLimit)
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapPost("/libraries/{libraryId:guid}/items", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            UpsertKnowledgeItemRequest request,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var normalizedType = (request.TypeKey ?? string.Empty).Trim();
            var normalizedTitle = (request.Title ?? string.Empty).Trim();
            if (normalizedType.Length == 0 || normalizedTitle.Length == 0)
            {
                return Results.BadRequest(new { error = "typeKey and title are required" });
            }

            var typeSpec = await dbContext.CogitaKnowledgeTypeSpecs
                .AsNoTracking()
                .OrderByDescending(x => x.Version)
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.TypeKey == normalizedType, ct);
            if (typeSpec is null)
            {
                return Results.BadRequest(new { error = "No type spec found for typeKey" });
            }

            var roleId = request.RoleId;
            if (roleId == Guid.Empty)
            {
                roleId = await dbContext.CogitaLibraries.AsNoTracking()
                    .Where(x => x.Id == libraryId)
                    .Select(x => x.RoleId)
                    .FirstOrDefaultAsync(ct);
            }
            if (roleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "roleId is required" });
            }

            var item = new Data.Cogita.CogitaKnowledgeItem
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RoleId = roleId,
                TypeSpecId = typeSpec.Id,
                TypeKey = normalizedType,
                Title = normalizedTitle,
                SearchText = string.IsNullOrWhiteSpace(request.SearchText) ? normalizedTitle : request.SearchText,
                PayloadJson = string.IsNullOrWhiteSpace(request.PayloadJson) ? "{}" : request.PayloadJson,
                IsExcludedFromKnowness = request.IsExcludedFromKnowness,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaKnowledgeItems.Add(item);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(item);
        });

        group.MapPost("/libraries/{libraryId:guid}/runs/{runId:guid}/next-card", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            NextCardRequest request,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var cards = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.IsActive)
                .OrderBy(x => x.CardKey)
                .Select(x => x.CardKey)
                .ToListAsync(ct);
            if (cards.Count == 0)
            {
                return Results.Ok(new { cardKey = (string?)null, reason = "no-cards" });
            }

            var answeredRoundIndexes = await dbContext.CogitaRunAttempts.AsNoTracking()
                .Where(x => x.RunId == runId && x.ParticipantId == request.ParticipantId)
                .Select(x => x.RoundIndex)
                .ToListAsync(ct);

            var mode = CogitaRunSelectionCore.NormalizeMode(run.RunScope);
            var answeredRoundIndexSet = answeredRoundIndexes.ToHashSet();
            var remainingRoundIndexes = Enumerable.Range(0, cards.Count)
                .Where(index => !answeredRoundIndexSet.Contains(index));
            var remainingIndexes = CogitaRunSelectionCore.OrderRemainingRoundIndexes(
                remainingRoundIndexes,
                request.ParticipantSeed,
                mode,
                knownessByRound: null);
            if (remainingIndexes.Count == 0)
            {
                return Results.Ok(new { cardKey = (string?)null, reason = "finished" });
            }

            var nextIndex = remainingIndexes[0];
            return Results.Ok(new { cardKey = cards[nextIndex], roundIndex = nextIndex, reason = "selected" });
        });

        group.MapGet("/libraries/{libraryId:guid}/runs/{runId:guid}/attempts", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            Guid? participantId,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var query = dbContext.CogitaRunAttempts
                .AsNoTracking()
                .Where(x => x.RunId == runId);
            if (participantId.HasValue && participantId.Value != Guid.Empty)
            {
                query = query.Where(x => x.ParticipantId == participantId.Value);
            }

            var rows = await query
                .OrderBy(x => x.RoundIndex)
                .ThenBy(x => x.UpdatedUtc)
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapGet("/libraries/{libraryId:guid}/runs/{runId:guid}/exposures", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            Guid? participantId,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var query = dbContext.CogitaRunExposures
                .AsNoTracking()
                .Where(x => x.RunId == runId);
            if (participantId.HasValue && participantId.Value != Guid.Empty)
            {
                query = query.Where(x => x.ParticipantId == participantId.Value);
            }

            var rows = await query
                .OrderBy(x => x.RoundIndex)
                .ThenBy(x => x.PromptShownUtc)
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapGet("/libraries/{libraryId:guid}/knowness/{personRoleId:guid}", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid personRoleId,
            int? limit,
            CancellationToken ct) =>
        {
            if (!await HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var normalizedLimit = Math.Clamp(limit ?? 1000, 1, 10000);
            var rows = await dbContext.CogitaKnownessSnapshots
                .AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.PersonRoleId == personRoleId)
                .OrderByDescending(x => x.SnapshotUtc)
                .Take(normalizedLimit)
                .ToListAsync(ct);
            return Results.Ok(rows);
        });
    }

    private static async Task<bool> HasLibraryAccess(HttpContext context, RecreatioDbContext dbContext, Guid libraryId, CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId))
        {
            return false;
        }

        var libraryRoleId = await dbContext.CogitaLibraries.AsNoTracking()
            .Where(x => x.Id == libraryId)
            .Select(x => x.RoleId)
            .FirstOrDefaultAsync(ct);
        if (libraryRoleId == Guid.Empty)
        {
            return false;
        }

        return await dbContext.Memberships.AsNoTracking()
            .AnyAsync(x => x.UserId == userId && x.RoleId == libraryRoleId, ct);
    }

    public sealed record UpsertKnowledgeTypeSpecRequest(
        [property: JsonPropertyName("displayName")] string? DisplayName,
        [property: JsonPropertyName("specJson")] string? SpecJson);

    public sealed record UpsertKnowledgeItemRequest(
        [property: JsonPropertyName("roleId")] Guid RoleId,
        [property: JsonPropertyName("typeKey")] string TypeKey,
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("searchText")] string? SearchText,
        [property: JsonPropertyName("payloadJson")] string? PayloadJson,
        [property: JsonPropertyName("isExcludedFromKnowness")] bool IsExcludedFromKnowness);

    public sealed record NextCardRequest(
        [property: JsonPropertyName("participantId")] Guid ParticipantId,
        [property: JsonPropertyName("participantSeed")] Guid ParticipantSeed);
}
