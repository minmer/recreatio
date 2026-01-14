using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class RoleEndpoints
{
    public static void MapRoleEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/roles").RequireAuthorization();

        group.MapPost("/{parentRoleId:guid}/edges", async (
            Guid parentRoleId,
            CreateRoleEdgeRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var isMember = await dbContext.Memberships.AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.RoleId == parentRoleId, ct);
            if (!isMember)
            {
                return Results.Forbid();
            }

            if (request.ChildRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "ChildRoleId is required." });
            }

            var relationshipType = request.RelationshipType?.Trim();
            if (string.IsNullOrWhiteSpace(relationshipType))
            {
                return Results.BadRequest(new { error = "RelationshipType is required." });
            }

            if (await dbContext.RoleEdges.AsNoTracking().AnyAsync(x => x.ParentRoleId == parentRoleId && x.ChildRoleId == request.ChildRoleId, ct))
            {
                return Results.Conflict(new { error = "Role edge already exists." });
            }

            byte[] encryptedRoleKeyCopy;
            try
            {
                encryptedRoleKeyCopy = Convert.FromBase64String(request.EncryptedRoleKeyCopyBase64);
            }
            catch (FormatException)
            {
                return Results.BadRequest(new { error = "EncryptedRoleKeyCopyBase64 is invalid." });
            }

            var now = DateTimeOffset.UtcNow;
            var edge = new RoleEdge
            {
                Id = Guid.NewGuid(),
                ParentRoleId = parentRoleId,
                ChildRoleId = request.ChildRoleId,
                RelationshipType = relationshipType,
                EncryptedRoleKeyCopy = encryptedRoleKeyCopy,
                CreatedUtc = now
            };

            var ledger = await ledgerService.AppendKeyAsync(
                "RoleEdgeCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId, childRoleId = request.ChildRoleId, relationshipType, signature = request.SignatureBase64 }),
                ct);

            dbContext.RoleEdges.Add(edge);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { edgeId = edge.Id, ledgerId = ledger.Id });
        });
    }
}
