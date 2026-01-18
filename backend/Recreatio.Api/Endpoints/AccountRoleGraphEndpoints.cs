using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRoleGraphEndpoints
{
    public static void MapAccountRoleGraphEndpoints(this RouteGroupBuilder group)
    {
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
