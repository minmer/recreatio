using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class RoleEndpoints
{
    private static readonly HashSet<string> AllowedRelationshipTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Owner",
        "AdminOf",
        "Write",
        "Read",
        "MemberOf",
        "DelegatedTo"
    };

    public static void MapRoleEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/roles").RequireAuthorization();

        group.MapPost("/{parentRoleId:guid}/edges", async (
            Guid parentRoleId,
            CreateRoleEdgeRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            ILedgerService ledgerService,
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

            if (request.ChildRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "ChildRoleId is required." });
            }

            var relationshipType = request.RelationshipType?.Trim();
            if (string.IsNullOrWhiteSpace(relationshipType))
            {
                return Results.BadRequest(new { error = "RelationshipType is required." });
            }
            if (!AllowedRelationshipTypes.Contains(relationshipType))
            {
                return Results.BadRequest(new { error = "RelationshipType is invalid." });
            }

            if (await dbContext.RoleEdges.AsNoTracking().AnyAsync(x => x.ParentRoleId == parentRoleId && x.ChildRoleId == request.ChildRoleId, ct))
            {
                return Results.Conflict(new { error = "Role edge already exists." });
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

            if (!keyRing.TryGetRoleKey(parentRoleId, out var parentRoleKey))
            {
                return Results.Forbid();
            }

            if (!keyRing.TryGetRoleKey(request.ChildRoleId, out var childRoleKey))
            {
                return Results.BadRequest(new { error = "Child role key not available." });
            }

            var encryptedRoleKeyCopy = encryptionService.Encrypt(parentRoleKey, childRoleKey, request.ChildRoleId.ToByteArray());

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
