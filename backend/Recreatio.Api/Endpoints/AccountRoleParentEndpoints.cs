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

            if (!keyRing.TryGetWriteKey(roleId, out var writeKey))
            {
                return Results.Forbid();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            var membershipOwners = await dbContext.Memberships.AsNoTracking()
                .Where(x => x.UserId == userId && x.RelationshipType == RoleRelationships.Owner)
                .Select(x => x.RoleId)
                .ToListAsync(ct);
            var ownerRoots = new List<Guid> { account.MasterRoleId };
            ownerRoots.AddRange(membershipOwners);
            var ownerRoleIds = await RoleOwnership.GetOwnedRoleIdsAsync(ownerRoots, keyRing.ReadKeys.Keys.ToHashSet(), dbContext, ct);
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

            dbContext.RoleEdges.Remove(edge);
            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);
            await ledgerService.AppendKeyAsync(
                "RoleEdgeDeleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId, roleId, relationshipType = edge.RelationshipType }),
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

            var parentRoleIds = await dbContext.RoleEdges.AsNoTracking()
                .Where(edge => edge.ChildRoleId == roleId)
                .Select(edge => edge.ParentRoleId)
                .Distinct()
                .ToListAsync(ct);

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is not null)
            {
                var isMembership = await dbContext.Memberships.AsNoTracking()
                    .AnyAsync(x => x.UserId == userId && x.RoleId == roleId, ct);
                if (isMembership && !parentRoleIds.Contains(account.MasterRoleId))
                {
                    parentRoleIds.Add(account.MasterRoleId);
                }
            }

            return Results.Ok(new RoleParentsResponse(roleId, parentRoleIds));
        });
    }
}
