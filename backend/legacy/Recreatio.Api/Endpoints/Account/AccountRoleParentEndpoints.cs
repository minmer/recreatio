using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRoleParentEndpoints
{
    public static void MapAccountRoleParentEndpoints(this RouteGroupBuilder group)
    {
        group.MapDelete("/roles/{roleId:guid}/parents/{parentRoleId:guid}", async (
            Guid roleId,
            Guid parentRoleId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            ISessionSecretCache sessionSecretCache,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            RoleKeyRing keyRing;
            try
            {
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(roleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(roleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();
            if (!ownerRoleIds.Contains(roleId))
            {
                return Results.Forbid();
            }

            var edge = await dbContext.RoleEdges
                .FirstOrDefaultAsync(x => x.ParentRoleId == parentRoleId && x.ChildRoleId == roleId, ct);
            if (edge is null)
            {
                return Results.NotFound();
            }

            var edgeRelationship = RoleRelationships.Read;
            if (keyRing.TryGetReadKey(parentRoleId, out var parentReadKey))
            {
                var decrypted = keyRingService.TryDecryptRoleRelationshipType(parentReadKey, edge.EncryptedRelationshipType, edge.Id);
                if (!string.IsNullOrWhiteSpace(decrypted))
                {
                    edgeRelationship = RoleRelationships.Normalize(decrypted);
                }
            }

            if (edgeRelationship == RoleRelationships.Owner && roleId != account.MasterRoleId)
            {
                var remainingEdges = await dbContext.RoleEdges.AsNoTracking()
                    .Where(x => x.ChildRoleId == roleId && x.ParentRoleId != parentRoleId)
                    .ToListAsync(ct);

                var hasOwner = false;
                foreach (var remaining in remainingEdges)
                {
                    if (!keyRing.TryGetReadKey(remaining.ParentRoleId, out var remainingReadKey))
                    {
                        continue;
                    }

                    var decrypted = keyRingService.TryDecryptRoleRelationshipType(remainingReadKey, remaining.EncryptedRelationshipType, remaining.Id);
                    if (!string.IsNullOrWhiteSpace(decrypted) &&
                        RoleRelationships.Normalize(decrypted) == RoleRelationships.Owner)
                    {
                        hasOwner = true;
                        break;
                    }
                }

                if (!hasOwner)
                {
                    return Results.BadRequest(new { error = "At least one Owner relation is required." });
                }
            }

            dbContext.RoleEdges.Remove(edge);
            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, ownerKey, ct);
            await ledgerService.AppendKeyAsync(
                "RoleEdgeDeleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId, roleId, relationshipType = edgeRelationship }),
                ct,
                signingContext);

            EndpointHelpers.InvalidateRoleKeyRing(sessionSecretCache, sessionId);
            return Results.NoContent();
        });

        group.MapGet("/roles/{roleId:guid}/parents", async (
            Guid roleId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            RoleKeyRing keyRing;
            try
            {
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetReadKey(roleId, out _))
            {
                return Results.Forbid();
            }

            var parentLinks = await dbContext.RoleEdges.AsNoTracking()
                .Where(edge => edge.ChildRoleId == roleId)
                .ToListAsync(ct);

            var linkResponses = parentLinks.Select(edge =>
            {
                var relationship = RoleRelationships.Read;
                if (keyRing.TryGetReadKey(edge.ParentRoleId, out var parentReadKey))
                {
                    var decrypted = keyRingService.TryDecryptRoleRelationshipType(parentReadKey, edge.EncryptedRelationshipType, edge.Id);
                    if (!string.IsNullOrWhiteSpace(decrypted))
                    {
                        relationship = RoleRelationships.Normalize(decrypted);
                    }
                }

                return new RoleParentLinkResponse(edge.ParentRoleId, relationship);
            }).ToList();

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is not null)
            {
                var isMembership = await dbContext.Memberships.AsNoTracking()
                    .AnyAsync(x => x.UserId == userId && x.RoleId == roleId, ct);
                if (isMembership && linkResponses.All(link => link.ParentRoleId != account.MasterRoleId))
                {
                    linkResponses.Add(new RoleParentLinkResponse(account.MasterRoleId, RoleRelationships.Owner));
                }
            }

            return Results.Ok(new RoleParentsResponse(roleId, linkResponses));
        });
    }
}
