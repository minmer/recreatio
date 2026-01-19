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

public static class AccountDataEndpoints
{
    public static void MapAccountDataEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/roles/{roleId:guid}/data", async (
            Guid roleId,
            CreateDataItemRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            IAsymmetricSigningService signingService,
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

            var itemName = request.ItemName.Trim();
            if (string.IsNullOrWhiteSpace(itemName))
            {
                return Results.BadRequest(new { error = "ItemName is required." });
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

            if (!keyRing.TryGetReadKey(roleId, out var roleReadKey) ||
                !keyRing.TryGetWriteKey(roleId, out var roleWriteKey))
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

            var now = DateTimeOffset.UtcNow;
            var itemType = string.IsNullOrWhiteSpace(request.ItemType) ? "data" : request.ItemType.Trim();
            if (itemType.Equals("key", StringComparison.OrdinalIgnoreCase))
            {
                itemType = "key";
            }
            else
            {
                itemType = "data";
            }
            var dataItemId = Guid.NewGuid();
            var dataKey = RandomNumberGenerator.GetBytes(32);

            using var signingRsa = RSA.Create(2048);
            var publicSigningKey = signingRsa.ExportSubjectPublicKeyInfo();
            var privateSigningKey = signingRsa.ExportPkcs8PrivateKey();
            var signatureAlg = "RSA-SHA256";

            byte[]? encryptedValue = null;
            byte[]? dataSignature = null;
            if (itemType == "data" && !string.IsNullOrWhiteSpace(request.PlainValue))
            {
                encryptedValue = keyRingService.EncryptDataItemValue(dataKey, request.PlainValue.Trim(), dataItemId, itemName);
                dataSignature = signingService.Sign(privateSigningKey, signatureAlg, encryptedValue);
            }

            var item = new DataItem
            {
                Id = dataItemId,
                OwnerRoleId = roleId,
                ItemType = itemType,
                ItemName = itemName,
                EncryptedValue = encryptedValue,
                PublicSigningKey = publicSigningKey,
                PublicSigningKeyAlg = signatureAlg,
                DataSignature = dataSignature,
                DataSignatureAlg = dataSignature is null ? null : signatureAlg,
                DataSignatureRoleId = dataSignature is null ? null : roleId,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            var encryptedDataKey = encryptionService.Encrypt(roleReadKey, dataKey, dataItemId.ToByteArray());
            var encryptedSigningKey = encryptionService.Encrypt(roleWriteKey, privateSigningKey, dataItemId.ToByteArray());

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, roleWriteKey, ct);
            var ledger = await ledgerService.AppendKeyAsync(
                "DataItemCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, dataItemId, itemName, itemType, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            dbContext.DataItems.Add(item);
            dbContext.DataKeyGrants.Add(new DataKeyGrant
            {
                Id = Guid.NewGuid(),
                DataItemId = dataItemId,
                RoleId = roleId,
                PermissionType = RoleRelationships.Owner,
                EncryptedDataKeyBlob = encryptedDataKey,
                EncryptedSigningKeyBlob = encryptedSigningKey,
                CreatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);
            var responseValue = itemType == "data" ? request.PlainValue?.Trim() : null;
            return Results.Ok(new DataItemResponse(dataItemId, itemName, itemType, responseValue));
        });

        group.MapPost("/data/{dataItemId:guid}", async (
            Guid dataItemId,
            UpdateDataItemRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            IAsymmetricSigningService signingService,
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

            var plainValue = request.PlainValue?.Trim();
            if (string.IsNullOrWhiteSpace(plainValue))
            {
                return Results.BadRequest(new { error = "PlainValue is required." });
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

            var dataItem = await dbContext.DataItems.FirstOrDefaultAsync(x => x.Id == dataItemId, ct);
            if (dataItem is null)
            {
                return Results.NotFound();
            }
            if (dataItem.ItemType.Equals("key", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = "Key items do not support values." });
            }

            var grants = await dbContext.DataKeyGrants.AsNoTracking()
                .Where(x => x.DataItemId == dataItemId && x.RevokedUtc == null)
                .ToListAsync(ct);

            var writeGrant = grants.FirstOrDefault(grant =>
                RoleRelationships.AllowsWrite(grant.PermissionType) &&
                keyRing.TryGetReadKey(grant.RoleId, out _) &&
                keyRing.TryGetWriteKey(grant.RoleId, out _));

            if (writeGrant is null)
            {
                return Results.Forbid();
            }

            keyRing.TryGetReadKey(writeGrant.RoleId, out var roleReadKey);
            keyRing.TryGetWriteKey(writeGrant.RoleId, out var roleWriteKey);

            var dataKey = encryptionService.Decrypt(roleReadKey, writeGrant.EncryptedDataKeyBlob, dataItemId.ToByteArray());
            if (writeGrant.EncryptedSigningKeyBlob is null)
            {
                return Results.Forbid();
            }
            var privateSigningKey = encryptionService.Decrypt(roleWriteKey, writeGrant.EncryptedSigningKeyBlob, dataItemId.ToByteArray());

            var encryptedValue = keyRingService.EncryptDataItemValue(dataKey, plainValue, dataItemId, dataItem.ItemName);
            var signatureAlg = dataItem.PublicSigningKeyAlg;
            var signature = signingService.Sign(privateSigningKey, signatureAlg, encryptedValue);

            dataItem.EncryptedValue = encryptedValue;
            dataItem.DataSignature = signature;
            dataItem.DataSignatureAlg = signatureAlg;
            dataItem.DataSignatureRoleId = writeGrant.RoleId;
            dataItem.UpdatedUtc = DateTimeOffset.UtcNow;

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(writeGrant.RoleId, roleWriteKey, ct);
            await ledgerService.AppendBusinessAsync(
                "DataItemUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { dataItemId, roleId = writeGrant.RoleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new DataItemResponse(dataItemId, dataItem.ItemName, dataItem.ItemType, plainValue));
        });

        group.MapDelete("/data/{dataItemId:guid}", async (
            Guid dataItemId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleCryptoService roleCryptoService,
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

            RoleKeyRing keyRing;
            try
            {
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            var dataItem = await dbContext.DataItems.FirstOrDefaultAsync(x => x.Id == dataItemId, ct);
            if (dataItem is null)
            {
                return Results.NotFound();
            }

            var grants = await dbContext.DataKeyGrants
                .Where(x => x.DataItemId == dataItemId && x.RevokedUtc == null)
                .ToListAsync(ct);

            var ownerGrant = grants.FirstOrDefault(grant =>
                grant.PermissionType == RoleRelationships.Owner &&
                keyRing.TryGetWriteKey(grant.RoleId, out _));

            if (ownerGrant is null)
            {
                return Results.Forbid();
            }

            keyRing.TryGetWriteKey(ownerGrant.RoleId, out var ownerWriteKey);
            var signingContext = await roleCryptoService.TryGetSigningContextAsync(ownerGrant.RoleId, ownerWriteKey, ct);
            await ledgerService.AppendBusinessAsync(
                "DataItemDeleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { dataItemId, roleId = ownerGrant.RoleId }),
                ct,
                signingContext);

            dbContext.DataKeyGrants.RemoveRange(grants);
            var pending = await dbContext.PendingDataShares
                .Where(x => x.DataItemId == dataItemId)
                .ToListAsync(ct);
            dbContext.PendingDataShares.RemoveRange(pending);
            dbContext.DataItems.Remove(dataItem);
            await dbContext.SaveChangesAsync(ct);

            return Results.NoContent();
        });

        group.MapPost("/data/{dataItemId:guid}/shares", async (
            Guid dataItemId,
            DataItemShareRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IAsymmetricEncryptionService asymmetricEncryptionService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
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

            if (request.TargetRoleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "TargetRoleId is required." });
            }

            if (!RoleRelationships.IsAllowed(request.PermissionType))
            {
                return Results.BadRequest(new { error = "PermissionType is invalid." });
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

            var dataItem = await dbContext.DataItems.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == dataItemId, ct);
            if (dataItem is null)
            {
                return Results.NotFound();
            }

            var targetRole = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.TargetRoleId, ct);
            if (targetRole is null)
            {
                return Results.NotFound();
            }

            var grants = await dbContext.DataKeyGrants.AsNoTracking()
                .Where(x => x.DataItemId == dataItemId && x.RevokedUtc == null)
                .ToListAsync(ct);

            var ownerGrant = grants.FirstOrDefault(grant =>
                grant.PermissionType == RoleRelationships.Owner &&
                keyRing.TryGetReadKey(grant.RoleId, out _) &&
                keyRing.TryGetWriteKey(grant.RoleId, out _));

            if (ownerGrant is null)
            {
                return Results.Forbid();
            }

            keyRing.TryGetReadKey(ownerGrant.RoleId, out var ownerReadKey);
            keyRing.TryGetWriteKey(ownerGrant.RoleId, out var ownerWriteKey);
            var dataKey = encryptionService.Decrypt(ownerReadKey, ownerGrant.EncryptedDataKeyBlob, dataItemId.ToByteArray());
            var privateSigningKey = ownerGrant.EncryptedSigningKeyBlob is null
                ? null
                : encryptionService.Decrypt(ownerWriteKey, ownerGrant.EncryptedSigningKeyBlob, dataItemId.ToByteArray());

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(ownerGrant.RoleId, ownerWriteKey, ct);
            var normalizedPermission = RoleRelationships.Normalize(request.PermissionType);
            var needsWrite = RoleRelationships.AllowsWrite(normalizedPermission);
            if (keyRing.TryGetReadKey(request.TargetRoleId, out var targetReadKey) &&
                (!needsWrite || keyRing.TryGetWriteKey(request.TargetRoleId, out _)))
            {
                if (await dbContext.DataKeyGrants.AsNoTracking()
                        .AnyAsync(x => x.DataItemId == dataItemId && x.RoleId == request.TargetRoleId && x.RevokedUtc == null, ct))
                {
                    return Results.Conflict(new { error = "Data share already exists." });
                }

                keyRing.TryGetWriteKey(request.TargetRoleId, out var targetWriteKey);
                var directEncryptedDataKey = encryptionService.Encrypt(targetReadKey, dataKey, dataItemId.ToByteArray());
                var directEncryptedSigningKey = needsWrite && privateSigningKey is not null
                    ? encryptionService.Encrypt(targetWriteKey, privateSigningKey, dataItemId.ToByteArray())
                    : null;

                await ledgerService.AppendKeyAsync(
                    "DataShareGranted",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { dataItemId, roleId = ownerGrant.RoleId, targetRoleId = request.TargetRoleId, permissionType = normalizedPermission, signature = request.SignatureBase64 }),
                    ct,
                    signingContext);

                dbContext.DataKeyGrants.Add(new DataKeyGrant
                {
                    Id = Guid.NewGuid(),
                    DataItemId = dataItemId,
                    RoleId = request.TargetRoleId,
                    PermissionType = normalizedPermission,
                    EncryptedDataKeyBlob = directEncryptedDataKey,
                    EncryptedSigningKeyBlob = directEncryptedSigningKey,
                    CreatedUtc = DateTimeOffset.UtcNow
                });

                await dbContext.SaveChangesAsync(ct);
                return Results.Ok();
            }

            if (targetRole.PublicEncryptionKey is null || string.IsNullOrWhiteSpace(targetRole.PublicEncryptionKeyAlg))
            {
                return Results.BadRequest(new { error = "Target role has no encryption key." });
            }

            var encryptedDataKey = asymmetricEncryptionService.EncryptWithPublicKey(
                targetRole.PublicEncryptionKey,
                targetRole.PublicEncryptionKeyAlg,
                dataKey);
            var encryptedSigningKey = needsWrite && privateSigningKey is not null
                ? asymmetricEncryptionService.EncryptWithPublicKey(
                    targetRole.PublicEncryptionKey,
                    targetRole.PublicEncryptionKeyAlg,
                    privateSigningKey)
                : null;

            var ledger = await ledgerService.AppendKeyAsync(
                "DataSharePending",
                userId.ToString(),
                JsonSerializer.Serialize(new { dataItemId, roleId = ownerGrant.RoleId, targetRoleId = request.TargetRoleId, permissionType = normalizedPermission, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            dbContext.PendingDataShares.Add(new PendingDataShare
            {
                Id = Guid.NewGuid(),
                DataItemId = dataItemId,
                SourceRoleId = ownerGrant.RoleId,
                TargetRoleId = request.TargetRoleId,
                PermissionType = normalizedPermission,
                EncryptedDataKeyBlob = encryptedDataKey,
                EncryptedSigningKeyBlob = encryptedSigningKey,
                EncryptionAlg = targetRole.PublicEncryptionKeyAlg,
                Status = "Pending",
                LedgerRefId = ledger.Id,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapGet("/data/shares", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("AccountDataEndpoints");
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
                    return Results.Ok(new List<PendingDataShareResponse>());
                }

                var shares = await dbContext.PendingDataShares.AsNoTracking()
                    .Where(share => roleIds.Contains(share.TargetRoleId) && share.Status == "Pending")
                    .Select(share => new PendingDataShareResponse(
                        share.Id,
                        share.DataItemId,
                        share.SourceRoleId,
                        share.TargetRoleId,
                        share.PermissionType,
                        share.CreatedUtc
                    ))
                    .ToListAsync(ct);

                return Results.Ok(shares);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to load pending data shares.");
                return Results.Problem("Failed to load pending data shares.");
            }
        });

        group.MapPost("/data/shares/{shareId:guid}/accept", async (
            Guid shareId,
            PendingDataShareAcceptRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IAsymmetricEncryptionService asymmetricEncryptionService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
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

            var share = await dbContext.PendingDataShares.FirstOrDefaultAsync(x => x.Id == shareId, ct);
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

            byte[] dataKey;
            try
            {
                dataKey = asymmetricEncryptionService.DecryptWithPrivateKey(
                    Convert.FromBase64String(cryptoMaterial.PrivateEncryptionKeyBase64),
                    cryptoMaterial.PrivateEncryptionKeyAlg,
                    share.EncryptedDataKeyBlob);
            }
            catch (CryptographicException)
            {
                return Results.BadRequest(new { error = "Unable to decrypt shared data key." });
            }

            byte[]? signingKey = null;
            if (share.EncryptedSigningKeyBlob is { Length: > 0 })
            {
                try
                {
                    signingKey = asymmetricEncryptionService.DecryptWithPrivateKey(
                        Convert.FromBase64String(cryptoMaterial.PrivateEncryptionKeyBase64),
                        cryptoMaterial.PrivateEncryptionKeyAlg,
                        share.EncryptedSigningKeyBlob);
                }
                catch (CryptographicException)
                {
                    return Results.BadRequest(new { error = "Unable to decrypt shared signing key." });
                }
            }

            var encryptedDataKey = encryptionService.Encrypt(targetReadKey, dataKey, share.DataItemId.ToByteArray());
            var encryptedSigningKey = signingKey is null
                ? null
                : encryptionService.Encrypt(targetWriteKey, signingKey, share.DataItemId.ToByteArray());

            if (!await dbContext.DataKeyGrants.AsNoTracking()
                    .AnyAsync(x => x.DataItemId == share.DataItemId && x.RoleId == share.TargetRoleId && x.RevokedUtc == null, ct))
            {
                dbContext.DataKeyGrants.Add(new DataKeyGrant
                {
                    Id = Guid.NewGuid(),
                    DataItemId = share.DataItemId,
                    RoleId = share.TargetRoleId,
                    PermissionType = RoleRelationships.Normalize(share.PermissionType),
                    EncryptedDataKeyBlob = encryptedDataKey,
                    EncryptedSigningKeyBlob = encryptedSigningKey,
                    CreatedUtc = DateTimeOffset.UtcNow
                });
            }

            share.Status = "Accepted";
            share.AcceptedUtc = DateTimeOffset.UtcNow;

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(share.TargetRoleId, targetWriteKey, ct);
            await ledgerService.AppendKeyAsync(
                "DataShareAccepted",
                userId.ToString(),
                JsonSerializer.Serialize(new { shareId, dataItemId = share.DataItemId, targetRoleId = share.TargetRoleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });
    }
}
