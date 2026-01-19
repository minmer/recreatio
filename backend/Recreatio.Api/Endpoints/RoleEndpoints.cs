using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class RoleEndpoints
{
    private static string NormalizeRelationshipType(string relationshipType)
    {
        return RoleRelationships.Normalize(relationshipType);
    }

    public static void MapRoleEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/roles").RequireAuthorization();

        group.MapPost("/{parentRoleId:guid}/edges", async (
            Guid parentRoleId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            ILedgerService ledgerService,
            ISessionSecretCache sessionSecretCache,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("RoleEndpoints");
            CreateRoleEdgeRequest? request;
            try
            {
                request = await context.Request.ReadFromJsonAsync<CreateRoleEdgeRequest>(cancellationToken: ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Create edge failed: invalid JSON payload. Parent {ParentRoleId}.", parentRoleId);
                return Results.BadRequest(new { error = "Invalid JSON payload." });
            }

            if (request is null)
            {
                logger.LogWarning("Create edge failed: empty payload. Parent {ParentRoleId}.", parentRoleId);
                return Results.BadRequest(new { error = "Request body is required." });
            }
            var requestSnapshot = JsonSerializer.Serialize(new
            {
                request.ChildRoleId,
                request.RelationshipType
            });
            IResult Forbidden(string message)
            {
                logger.LogWarning("Create edge forbidden: {Message} Parent {ParentRoleId}, Request {Request}.", message, parentRoleId, requestSnapshot);
                return Results.Json(new { error = message }, statusCode: StatusCodes.Status403Forbidden);
            }
            IResult BadRequest(string message)
            {
                logger.LogWarning("Create edge bad request: {Message} Parent {ParentRoleId}, Request {Request}.", message, parentRoleId, requestSnapshot);
                return Results.BadRequest(new { error = message });
            }

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
                return BadRequest("ChildRoleId is required.");
            }

            var relationshipType = request.RelationshipType?.Trim();
            if (string.IsNullOrWhiteSpace(relationshipType))
            {
                return BadRequest("RelationshipType is required.");
            }
            if (!RoleRelationships.IsAllowed(relationshipType))
            {
                return BadRequest("RelationshipType is invalid.");
            }
            relationshipType = NormalizeRelationshipType(relationshipType);

            if (await dbContext.RoleEdges.AsNoTracking().AnyAsync(x => x.ParentRoleId == parentRoleId && x.ChildRoleId == request.ChildRoleId, ct))
            {
                logger.LogWarning("Create edge failed: edge already exists. Parent {ParentRoleId}, Request {Request}.", parentRoleId, requestSnapshot);
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
                logger.LogWarning("Create edge failed: account not found for user {UserId}.", userId);
                return Results.NotFound();
            }

            var membershipOwners = await dbContext.Memberships.AsNoTracking()
                .Where(x => x.UserId == userId && x.RelationshipType == RoleRelationships.Owner)
                .Select(x => x.RoleId)
                .ToListAsync(ct);
            var ownerRoots = new List<Guid> { account.MasterRoleId };
            ownerRoots.AddRange(membershipOwners);
            var ownerRoleIds = await RoleOwnership.GetOwnedRoleIdsAsync(ownerRoots, keyRing.ReadKeys.Keys.ToHashSet(), dbContext, ct);
            if (!ownerRoleIds.Contains(parentRoleId))
            {
                logger.LogWarning("Create edge failed: parent role not owned. Parent {ParentRoleId}, child {ChildRoleId}, user {UserId}.", parentRoleId, request.ChildRoleId, userId);
                return Forbidden("Parent role is not owned by the user.");
            }

            if (!keyRing.TryGetReadKey(parentRoleId, out var parentReadKey) ||
                !keyRing.TryGetWriteKey(parentRoleId, out var parentWriteKey))
            {
                logger.LogWarning("Create edge failed: parent keys missing. Parent {ParentRoleId}, user {UserId}.", parentRoleId, userId);
                return Forbidden("Parent role keys not available.");
            }

            var parentRole = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == parentRoleId, ct);
            if (parentRole is null)
            {
                logger.LogWarning("Create edge failed: parent role not found. Parent {ParentRoleId}, user {UserId}.", parentRoleId, userId);
                return Results.NotFound();
            }

            var childRole = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.ChildRoleId, ct);
            if (childRole is null)
            {
                logger.LogWarning("Create edge failed: child role not found. Parent {ParentRoleId}, child {ChildRoleId}, user {UserId}.", parentRoleId, request.ChildRoleId, userId);
                return Results.NotFound();
            }

            if (!keyRing.TryGetReadKey(request.ChildRoleId, out var childReadKey))
            {
                logger.LogWarning("Create edge failed: child read key missing. Parent {ParentRoleId}, child {ChildRoleId}, user {UserId}.", parentRoleId, request.ChildRoleId, userId);
                return Forbidden("Child role key not available.");
            }

            byte[]? childWriteKey = null;
            if (RoleRelationships.AllowsWrite(relationshipType))
            {
                if (!keyRing.TryGetWriteKey(request.ChildRoleId, out var resolvedWriteKey))
                {
                    logger.LogWarning("Create edge failed: child write key missing. Parent {ParentRoleId}, child {ChildRoleId}, user {UserId}.", parentRoleId, request.ChildRoleId, userId);
                    return Forbidden("Child role write key not available.");
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
            EndpointHelpers.InvalidateRoleKeyRing(sessionSecretCache, sessionId);
            return Results.Ok(new { edgeId = edge.Id, ledgerId = ledger.Id });
        });
    }
}
