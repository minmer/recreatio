using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRoleGraphEndpoints
{
    public static void MapAccountRoleGraphEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/roles/{roleId:guid}/lookup", async (
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

            var role = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == roleId, ct);
            if (role is null)
            {
                return Results.NotFound();
            }

            var canRead = keyRing.ReadKeys.ContainsKey(roleId);
            var canWrite = keyRing.WriteKeys.ContainsKey(roleId);

            var label = roleId.ToString();
            var kind = "Role";
            if (canRead)
            {
                var fields = await dbContext.RoleFields.AsNoTracking()
                    .Where(field => field.RoleId == roleId)
                    .ToListAsync(ct);
                var lookup = await fieldQueryService.LoadAsync(fields, keyRing, ct);
                if (lookup.ValuesByRole.TryGetValue(roleId, out var values))
                {
                    if (values.TryGetValue(RoleFieldTypes.RoleKind, out var resolvedKind))
                    {
                        kind = resolvedKind;
                    }
                    if (values.TryGetValue(RoleFieldTypes.Nick, out var nick))
                    {
                        label = nick;
                    }
                    else if (values.TryGetValue(RoleFieldTypes.RoleKind, out var kindLabel))
                    {
                        label = $"{kindLabel} {roleId.ToString()[..8]}";
                    }
                }
            }

            var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();

            var nodeType = canRead ? "role" : "external";
            var response = new RoleLookupResponse(
                $"role:{roleId:N}",
                label,
                kind,
                nodeType,
                roleId,
                ownerRoleIds.Contains(roleId),
                canWrite);

            return Results.Ok(response);
        });

        group.MapGet("/roles/search", async (
            string? query,
            HttpContext context,
            IKeyRingService keyRingService,
            IRoleQueryService roleQueryService,
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

            if (string.IsNullOrWhiteSpace(query))
            {
                return Results.BadRequest(new { error = "Query is required." });
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

            var matches = await roleQueryService.SearchAsync(query, keyRing, ct);
            return Results.Ok(matches);
        });

        group.MapGet("/roles/graph", async (
            HttpContext context,
            IKeyRingService keyRingService,
            IRoleQueryService roleQueryService,
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

            var graph = await roleQueryService.BuildGraphAsync(userId, keyRing, ct);
            return Results.Ok(graph);
        });

        group.MapGet("/roles", async (
            HttpContext context,
            IKeyRingService keyRingService,
            IRoleQueryService roleQueryService,
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

            var roles = await roleQueryService.ListAsync(keyRing, ct);
            return Results.Ok(roles);
        });
    }
}
