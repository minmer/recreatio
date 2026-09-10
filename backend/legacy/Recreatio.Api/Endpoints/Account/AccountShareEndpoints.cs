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

            var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();
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

            if (!keyRing.TryGetOwnerKey(roleId, out var roleOwnerKey))
            {
                return Results.Forbid();
            }

            var writeKeyToShare = RoleRelationships.AllowsWrite(relationshipType) ? roleWriteKey : null;
            var ownerKeyToShare = RoleRelationships.IsOwner(relationshipType) ? roleOwnerKey : null;

            if (keyRing.TryGetReadKey(request.TargetRoleId, out var targetReadKey) &&
                (!RoleRelationships.AllowsWrite(relationshipType) || keyRing.TryGetWriteKey(request.TargetRoleId, out _)) &&
                (!RoleRelationships.IsOwner(relationshipType) || keyRing.TryGetOwnerKey(request.TargetRoleId, out _)))
            {
                keyRing.TryGetWriteKey(request.TargetRoleId, out var targetWriteKey);
                keyRing.TryGetOwnerKey(request.TargetRoleId, out var targetOwnerKey);
                var directReadCopy = encryptionService.Encrypt(targetReadKey, readKey, roleId.ToByteArray());
                var directWriteCopy = writeKeyToShare is null
                    ? null
                    : encryptionService.Encrypt(targetWriteKey, writeKeyToShare, roleId.ToByteArray());
                var directOwnerCopy = ownerKeyToShare is null
                    ? null
                    : encryptionService.Encrypt(targetOwnerKey, ownerKeyToShare, roleId.ToByteArray());

                if (!await dbContext.RoleEdges.AsNoTracking()
                        .AnyAsync(x => x.ParentRoleId == request.TargetRoleId && x.ChildRoleId == roleId, ct))
                {
                    var edgeId = Guid.NewGuid();
                    var encryptedRelationshipType = keyRingService.EncryptRoleRelationshipType(targetReadKey, relationshipType, edgeId);
                    var relationshipTypeHash = HMACSHA256.HashData(targetReadKey, System.Text.Encoding.UTF8.GetBytes(relationshipType));
                    dbContext.RoleEdges.Add(new RoleEdge
                    {
                        Id = edgeId,
                        ParentRoleId = request.TargetRoleId,
                        ChildRoleId = roleId,
                        RelationshipType = string.Empty,
                        EncryptedRelationshipType = encryptedRelationshipType,
                        RelationshipTypeHash = relationshipTypeHash,
                        EncryptedReadKeyCopy = directReadCopy,
                        EncryptedWriteKeyCopy = directWriteCopy,
                        EncryptedOwnerKeyCopy = directOwnerCopy,
                        CreatedUtc = DateTimeOffset.UtcNow
                    });
                }

                var directSigningContext = await roleCryptoService.TryGetSigningContextAsync(roleId, roleOwnerKey, ct);
                await ledgerService.AppendKeyAsync(
                    "RoleShareGranted",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, targetRoleId = request.TargetRoleId, relationshipType, signature = request.SignatureBase64 }),
                    ct,
                    directSigningContext);

                await dbContext.SaveChangesAsync(ct);
                return Results.Ok();
            }

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
            var encryptedOwnerKey = ownerKeyToShare is null
                ? null
                : asymmetricEncryptionService.EncryptWithPublicKey(
                    targetRole.PublicEncryptionKey,
                    targetRole.PublicEncryptionKeyAlg,
                    ownerKeyToShare);

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, roleOwnerKey, ct);

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
                EncryptedOwnerKeyBlob = encryptedOwnerKey,
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
                !keyRing.TryGetWriteKey(share.TargetRoleId, out var targetWriteKey) ||
                !keyRing.TryGetOwnerKey(share.TargetRoleId, out var targetOwnerKey))
            {
                return Results.Forbid();
            }

            var cryptoMaterial = roleCryptoService.TryReadRoleCryptoMaterial(targetRole, targetOwnerKey);
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

            byte[]? sharedOwnerKey = null;
            if (share.EncryptedOwnerKeyBlob is { Length: > 0 })
            {
                try
                {
                    sharedOwnerKey = asymmetricEncryptionService.DecryptWithPrivateKey(
                        Convert.FromBase64String(cryptoMaterial.PrivateEncryptionKeyBase64),
                        cryptoMaterial.PrivateEncryptionKeyAlg,
                        share.EncryptedOwnerKeyBlob);
                }
                catch (CryptographicException)
                {
                    return Results.BadRequest(new { error = "Unable to decrypt shared owner key." });
                }
            }

            var encryptedReadCopy = encryptionService.Encrypt(targetReadKey, sharedReadKey, share.SourceRoleId.ToByteArray());
            var encryptedWriteCopy = sharedWriteKey is null
                ? null
                : encryptionService.Encrypt(targetWriteKey, sharedWriteKey, share.SourceRoleId.ToByteArray());
            var encryptedOwnerCopy = sharedOwnerKey is null
                ? null
                : encryptionService.Encrypt(targetOwnerKey, sharedOwnerKey, share.SourceRoleId.ToByteArray());

            var normalizedShareType = RoleRelationships.Normalize(share.RelationshipType);
            if (!await dbContext.RoleEdges.AsNoTracking().AnyAsync(x => x.ParentRoleId == share.TargetRoleId && x.ChildRoleId == share.SourceRoleId, ct))
            {
                var edgeId = Guid.NewGuid();
                var encryptedRelationshipType = keyRingService.EncryptRoleRelationshipType(targetReadKey, normalizedShareType, edgeId);
                var relationshipTypeHash = HMACSHA256.HashData(targetReadKey, System.Text.Encoding.UTF8.GetBytes(normalizedShareType));
                dbContext.RoleEdges.Add(new RoleEdge
                {
                    Id = edgeId,
                    ParentRoleId = share.TargetRoleId,
                    ChildRoleId = share.SourceRoleId,
                    RelationshipType = string.Empty,
                    EncryptedRelationshipType = encryptedRelationshipType,
                    RelationshipTypeHash = relationshipTypeHash,
                    EncryptedReadKeyCopy = encryptedReadCopy,
                    EncryptedWriteKeyCopy = encryptedWriteCopy,
                    EncryptedOwnerKeyCopy = encryptedOwnerCopy,
                    CreatedUtc = DateTimeOffset.UtcNow
                });
            }

            share.Status = "Accepted";
            share.AcceptedUtc = DateTimeOffset.UtcNow;

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(share.TargetRoleId, targetOwnerKey, ct);

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
