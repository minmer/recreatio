using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountShareEndpoints
{
    public static void MapAccountShareEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/roles/{roleId:guid}/shares", async (Guid roleId, AddRoleShareRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IAsymmetricEncryptionService asymmetricEncryptionService, IEncryptionService encryptionService, IRoleCryptoService roleCryptoService, ILedgerService ledgerService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (request.TargetRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "TargetRoleId is required." });
            }

            if (string.IsNullOrWhiteSpace(request.RelationshipType))
            {
                return Results.BadRequest(new { error = "RelationshipType is required." });
            }
            var relationshipType = request.RelationshipType.Trim();
            if (!RoleRelationships.IsAllowed(relationshipType))
            {
                return Results.BadRequest(new { error = "RelationshipType is invalid." });
            }
            relationshipType = RoleRelationships.Normalize(relationshipType);

            var targetRole = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.TargetRoleId, ct);
            if (targetRole is null)
            {
                return Results.NotFound();
            }

            var existing = await dbContext.RoleEdges.AsNoTracking()
                .AnyAsync(x => x.ParentRoleId == request.TargetRoleId && x.ChildRoleId == roleId, ct);
            if (existing)
            {
                return Results.Conflict(new { error = "Role share already exists." });
            }

            if (targetRole.PublicEncryptionKey is null || string.IsNullOrWhiteSpace(targetRole.PublicEncryptionKeyAlg))
            {
                return Results.BadRequest(new { error = "Target role has no encryption key." });
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

            if (!keyRing.TryGetReadKey(roleId, out var readKey))
            {
                return Results.Forbid();
            }

            if (!keyRing.TryGetWriteKey(roleId, out var roleWriteKey))
            {
                return Results.Forbid();
            }

            var writeKeyToShare = RoleRelationships.AllowsWrite(relationshipType) ? roleWriteKey : null;

            var encryptedReadKey = asymmetricEncryptionService.EncryptWithPublicKey(
                targetRole.PublicEncryptionKey,
                targetRole.PublicEncryptionKeyAlg,
                readKey);
            var encryptedWriteKey = writeKeyToShare is null
                ? null
                : asymmetricEncryptionService.EncryptWithPublicKey(
                    targetRole.PublicEncryptionKey,
                    targetRole.PublicEncryptionKeyAlg,
                    writeKeyToShare);

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, roleWriteKey, ct);

            var ledger = await ledgerService.AppendKeyAsync(
                "RoleSharePending",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, targetRoleId = request.TargetRoleId, relationshipType, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            dbContext.PendingRoleShares.Add(new PendingRoleShare
            {
                Id = Guid.NewGuid(),
                SourceRoleId = roleId,
                TargetRoleId = request.TargetRoleId,
                RelationshipType = relationshipType,
                EncryptedReadKeyBlob = encryptedReadKey,
                EncryptedWriteKeyBlob = encryptedWriteKey,
                EncryptionAlg = targetRole.PublicEncryptionKeyAlg,
                Status = "Pending",
                LedgerRefId = ledger.Id,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapGet("/shares", async (HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, ILoggerFactory loggerFactory, CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("AccountShareEndpoints");
            try
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

                var roleIds = keyRing.ReadKeys.Keys.ToList();
                if (roleIds.Count == 0)
                {
                    return Results.Ok(new List<PendingRoleShareResponse>());
                }

                var shares = await dbContext.PendingRoleShares.AsNoTracking()
                    .Where(share => roleIds.Contains(share.TargetRoleId) && share.Status == "Pending")
                    .Select(share => new PendingRoleShareResponse(
                        share.Id,
                        share.SourceRoleId,
                        share.TargetRoleId,
                        share.RelationshipType,
                        share.CreatedUtc
                    ))
                    .ToListAsync(ct);

                return Results.Ok(shares);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to load pending shares.");
                return Results.Problem("Failed to load pending shares.");
            }
        });

        group.MapPost("/shares/{shareId:guid}/accept", async (Guid shareId, PendingRoleShareAcceptRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IAsymmetricEncryptionService asymmetricEncryptionService, IEncryptionService encryptionService, IRoleCryptoService roleCryptoService, ILedgerService ledgerService, ISessionSecretCache sessionSecretCache, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var share = await dbContext.PendingRoleShares.FirstOrDefaultAsync(x => x.Id == shareId, ct);
            if (share is null || share.Status != "Pending")
            {
                return Results.NotFound();
            }

            var targetRole = await dbContext.Roles.FirstOrDefaultAsync(x => x.Id == share.TargetRoleId, ct);
            if (targetRole is null)
            {
                return Results.NotFound();
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

            if (!keyRing.TryGetReadKey(share.TargetRoleId, out var targetReadKey) ||
                !keyRing.TryGetWriteKey(share.TargetRoleId, out var targetWriteKey))
            {
                return Results.Forbid();
            }

            var cryptoMaterial = roleCryptoService.TryReadRoleCryptoMaterial(targetRole, targetWriteKey);
            if (cryptoMaterial is null)
            {
                return Results.BadRequest(new { error = "Target role crypto material missing." });
            }

            byte[] sharedReadKey;
            try
            {
                sharedReadKey = asymmetricEncryptionService.DecryptWithPrivateKey(
                    Convert.FromBase64String(cryptoMaterial.PrivateEncryptionKeyBase64),
                    cryptoMaterial.PrivateEncryptionKeyAlg,
                    share.EncryptedReadKeyBlob);
            }
            catch (CryptographicException)
            {
                return Results.BadRequest(new { error = "Unable to decrypt shared read key." });
            }

            byte[]? sharedWriteKey = null;
            if (share.EncryptedWriteKeyBlob is { Length: > 0 })
            {
                try
                {
                    sharedWriteKey = asymmetricEncryptionService.DecryptWithPrivateKey(
                        Convert.FromBase64String(cryptoMaterial.PrivateEncryptionKeyBase64),
                        cryptoMaterial.PrivateEncryptionKeyAlg,
                        share.EncryptedWriteKeyBlob);
                }
                catch (CryptographicException)
                {
                    return Results.BadRequest(new { error = "Unable to decrypt shared write key." });
                }
            }

            var encryptedReadCopy = encryptionService.Encrypt(targetReadKey, sharedReadKey, share.SourceRoleId.ToByteArray());
            var encryptedWriteCopy = sharedWriteKey is null
                ? null
                : encryptionService.Encrypt(targetWriteKey, sharedWriteKey, share.SourceRoleId.ToByteArray());

            var normalizedShareType = RoleRelationships.Normalize(share.RelationshipType);
            if (!await dbContext.RoleEdges.AsNoTracking().AnyAsync(x => x.ParentRoleId == share.TargetRoleId && x.ChildRoleId == share.SourceRoleId, ct))
            {
                dbContext.RoleEdges.Add(new RoleEdge
                {
                    Id = Guid.NewGuid(),
                    ParentRoleId = share.TargetRoleId,
                    ChildRoleId = share.SourceRoleId,
                    RelationshipType = normalizedShareType,
                    EncryptedReadKeyCopy = encryptedReadCopy,
                    EncryptedWriteKeyCopy = encryptedWriteCopy,
                    CreatedUtc = DateTimeOffset.UtcNow
                });
            }

            share.Status = "Accepted";
            share.AcceptedUtc = DateTimeOffset.UtcNow;

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(share.TargetRoleId, targetWriteKey, ct);

            await ledgerService.AppendKeyAsync(
                "RoleShareAccepted",
                userId.ToString(),
                JsonSerializer.Serialize(new { shareId, sourceRoleId = share.SourceRoleId, targetRoleId = share.TargetRoleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            EndpointHelpers.InvalidateRoleKeyRing(sessionSecretCache, sessionId);
            return Results.Ok();
        });
    }
}
