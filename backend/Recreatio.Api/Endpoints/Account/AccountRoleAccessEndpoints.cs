using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRoleAccessEndpoints
{
    public static void MapAccountRoleAccessEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/roles/{roleId:guid}/access", async (
            Guid roleId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleFieldQueryService fieldQueryService,
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

            var edges = await dbContext.RoleEdges.AsNoTracking()
                .Where(edge => edge.ChildRoleId == roleId)
                .ToListAsync(ct);
            if (edges.Count == 0)
            {
                return Results.Ok(new RoleAccessResponse(roleId, new List<RoleAccessRoleResponse>()));
            }

            var parentRoleIds = edges.Select(edge => edge.ParentRoleId).Distinct().ToList();
            var kindFields = await dbContext.RoleFields.AsNoTracking()
                .Where(field => parentRoleIds.Contains(field.RoleId))
                .ToListAsync(ct);

            var lookup = await fieldQueryService.LoadAsync(kindFields, keyRing, ct);
            var roleKindById = new Dictionary<Guid, string>();
            foreach (var (roleIdKey, values) in lookup.ValuesByRole)
            {
                if (values.TryGetValue(RoleFieldTypes.RoleKind, out var kind))
                {
                    roleKindById[roleIdKey] = kind;
                }
            }

            var roleEdges = edges
                .Select(edge =>
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
                    return new RoleAccessRoleResponse(
                        edge.ParentRoleId,
                        roleKindById.GetValueOrDefault(edge.ParentRoleId, "Role"),
                        relationship);
                })
                .ToList();

            var response = new RoleAccessResponse(roleId, roleEdges);

            return Results.Ok(response);
        });
    }
}
