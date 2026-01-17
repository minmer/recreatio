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

    private static bool RelationshipAllowsWrite(string relationshipType)
    {
        return relationshipType.Equals("Owner", StringComparison.OrdinalIgnoreCase)
            || relationshipType.Equals("AdminOf", StringComparison.OrdinalIgnoreCase)
            || relationshipType.Equals("Write", StringComparison.OrdinalIgnoreCase);
    }

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

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            var membershipOwners = await dbContext.Memberships.AsNoTracking()
                .Where(x => x.UserId == userId && x.RelationshipType == "Owner")
                .Select(x => x.RoleId)
                .ToListAsync(ct);
            var ownerRoots = new List<Guid> { account.MasterRoleId };
            ownerRoots.AddRange(membershipOwners);
            var ownerRoleIds = await RoleOwnership.GetOwnedRoleIdsAsync(ownerRoots, keyRing.ReadKeys.Keys.ToHashSet(), dbContext, ct);
            if (!ownerRoleIds.Contains(parentRoleId))
            {
                return Results.Forbid();
            }

            if (!keyRing.TryGetReadKey(parentRoleId, out var parentReadKey) ||
                !keyRing.TryGetWriteKey(parentRoleId, out var parentWriteKey))
            {
                return Results.Forbid();
            }

            var parentRole = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parentRoleId, ct);
            if (parentRole is null)
            {
                return Results.NotFound();
            }

            if (!keyRing.TryGetReadKey(request.ChildRoleId, out var childReadKey))
            {
                return Results.BadRequest(new { error = "Child role key not available." });
            }

            byte[]? childWriteKey = null;
            if (RelationshipAllowsWrite(relationshipType))
            {
                if (!keyRing.TryGetWriteKey(request.ChildRoleId, out var resolvedWriteKey))
                {
                    return Results.BadRequest(new { error = "Child role write key not available." });
                }
                childWriteKey = resolvedWriteKey;
            }

            var encryptedReadCopy = encryptionService.Encrypt(parentReadKey, childReadKey, request.ChildRoleId.ToByteArray());
            var encryptedWriteCopy = childWriteKey is null
                ? null
                : encryptionService.Encrypt(parentWriteKey, childWriteKey, request.ChildRoleId.ToByteArray());

            var now = DateTimeOffset.UtcNow;
            var edge = new RoleEdge
            {
                Id = Guid.NewGuid(),
                ParentRoleId = parentRoleId,
                ChildRoleId = request.ChildRoleId,
                RelationshipType = relationshipType,
                EncryptedReadKeyCopy = encryptedReadCopy,
                EncryptedWriteKeyCopy = encryptedWriteCopy,
                CreatedUtc = now
            };

            var ledger = await ledgerService.AppendKeyAsync(
                "RoleEdgeCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId, childRoleId = request.ChildRoleId, relationshipType, signature = request.SignatureBase64 }),
                ct,
                LedgerSigning.TryCreate(parentRole, parentWriteKey, encryptionService));

            dbContext.RoleEdges.Add(edge);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { edgeId = edge.Id, ledgerId = ledger.Id });
        });
    }
}
