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
    private sealed record DataItemFileMeta(string FileName, string ContentType, long SizeBytes);

    private sealed record DataItemAccessContext(byte[] DataKey, string ItemName, string ItemType);

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
                !keyRing.TryGetWriteKey(roleId, out var roleWriteKey) ||
                !keyRing.TryGetOwnerKey(roleId, out var roleOwnerKey))
            {
                return Results.Forbid();
            }

            var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();
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

            var encryptedItemName = keyRingService.EncryptDataItemMeta(dataKey, itemName, dataItemId, "item-name");
            var encryptedItemType = keyRingService.EncryptDataItemMeta(dataKey, itemType, dataItemId, "item-type");

            var item = new DataItem
            {
                Id = dataItemId,
                OwnerRoleId = roleId,
                ItemType = string.Empty,
                ItemName = string.Empty,
                EncryptedItemType = encryptedItemType,
                EncryptedItemName = encryptedItemName,
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

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, roleOwnerKey, ct);
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

        group.MapPost("/roles/{roleId:guid}/data/files", async (
            Guid roleId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IEncryptedBlobStore encryptedBlobStore,
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

            if (!context.Request.HasFormContentType)
            {
                return Results.BadRequest(new { error = "Multipart form data is required." });
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
                !keyRing.TryGetWriteKey(roleId, out var roleWriteKey) ||
                !keyRing.TryGetOwnerKey(roleId, out var roleOwnerKey))
            {
                return Results.Forbid();
            }

            var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();
            if (!ownerRoleIds.Contains(roleId))
            {
                return Results.Forbid();
            }

            var form = await context.Request.ReadFormAsync(ct);
            var file = form.Files.GetFile("file");
            if (file is null || file.Length <= 0)
            {
                return Results.BadRequest(new { error = "File is required." });
            }

            if (file.Length > encryptedBlobStore.MaxUploadBytes)
            {
                return Results.BadRequest(new { error = $"File exceeds max size ({encryptedBlobStore.MaxUploadBytes} bytes)." });
            }

            var itemName = form["itemName"].FirstOrDefault()?.Trim();
            if (string.IsNullOrWhiteSpace(itemName))
            {
                itemName = Path.GetFileName(file.FileName);
            }

            if (string.IsNullOrWhiteSpace(itemName))
            {
                itemName = $"file-{Guid.NewGuid():N}";
            }

            var fileName = Path.GetFileName(file.FileName);
            if (string.IsNullOrWhiteSpace(fileName))
            {
                fileName = $"{Guid.NewGuid():N}.bin";
            }

            var contentType = string.IsNullOrWhiteSpace(file.ContentType)
                ? "application/octet-stream"
                : file.ContentType.Trim();

            var now = DateTimeOffset.UtcNow;
            var dataItemId = Guid.NewGuid();
            var dataKey = RandomNumberGenerator.GetBytes(32);
            var encryptedItemName = keyRingService.EncryptDataItemMeta(dataKey, itemName, dataItemId, "item-name");
            var encryptedItemType = keyRingService.EncryptDataItemMeta(dataKey, "file", dataItemId, "item-type");

            var fileMeta = JsonSerializer.Serialize(new DataItemFileMeta(fileName, contentType, file.Length));
            var encryptedFileMeta = keyRingService.EncryptDataItemMeta(dataKey, fileMeta, dataItemId, "file-meta");

            string? storagePath = null;
            EncryptedBlobWriteResult? writeResult = null;
            await using (var uploadStream = file.OpenReadStream())
            {
                try
                {
                    writeResult = await encryptedBlobStore.WriteEncryptedAsync(uploadStream, dataKey, dataItemId, ct);
                    storagePath = writeResult.StoragePath;
                }
                catch
                {
                    if (!string.IsNullOrWhiteSpace(storagePath))
                    {
                        await encryptedBlobStore.DeleteIfExistsAsync(storagePath, ct);
                    }
                    throw;
                }
            }

            if (writeResult is null || string.IsNullOrWhiteSpace(writeResult.StoragePath))
            {
                return Results.Problem("Failed to persist encrypted file.");
            }

            using var signingRsa = RSA.Create(2048);
            var publicSigningKey = signingRsa.ExportSubjectPublicKeyInfo();
            var privateSigningKey = signingRsa.ExportPkcs8PrivateKey();
            var signatureAlg = "RSA-SHA256";

            var item = new DataItem
            {
                Id = dataItemId,
                OwnerRoleId = roleId,
                ItemType = string.Empty,
                ItemName = string.Empty,
                EncryptedItemType = encryptedItemType,
                EncryptedItemName = encryptedItemName,
                EncryptedValue = encryptedFileMeta,
                StorageProvider = "localfs",
                StoragePath = writeResult.StoragePath,
                StorageSizeBytes = writeResult.PlaintextLength,
                StorageSha256 = writeResult.PlaintextSha256,
                PublicSigningKey = publicSigningKey,
                PublicSigningKeyAlg = signatureAlg,
                DataSignature = null,
                DataSignatureAlg = null,
                DataSignatureRoleId = null,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            var encryptedDataKey = encryptionService.Encrypt(roleReadKey, dataKey, dataItemId.ToByteArray());
            var encryptedSigningKey = encryptionService.Encrypt(roleWriteKey, privateSigningKey, dataItemId.ToByteArray());

            try
            {
                var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, roleOwnerKey, ct);
                await ledgerService.AppendKeyAsync(
                    "DataFileUploaded",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, dataItemId, itemName, fileName, contentType }),
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
            }
            catch
            {
                await encryptedBlobStore.DeleteIfExistsAsync(writeResult.StoragePath, ct);
                throw;
            }

            return Results.Ok(new DataFileUploadResponse(
                dataItemId,
                itemName,
                "file",
                fileName,
                contentType,
                writeResult.PlaintextLength));
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
            var hasOwnerKey = keyRing.TryGetOwnerKey(writeGrant.RoleId, out var roleOwnerKey);

            var dataKey = encryptionService.Decrypt(roleReadKey, writeGrant.EncryptedDataKeyBlob, dataItemId.ToByteArray());
            if (writeGrant.EncryptedSigningKeyBlob is null)
            {
                return Results.Forbid();
            }
            var privateSigningKey = encryptionService.Decrypt(roleWriteKey, writeGrant.EncryptedSigningKeyBlob, dataItemId.ToByteArray());

            var itemName = keyRingService.TryDecryptDataItemMeta(dataKey, dataItem.EncryptedItemName, dataItem.Id, "item-name");
            var itemType = keyRingService.TryDecryptDataItemMeta(dataKey, dataItem.EncryptedItemType, dataItem.Id, "item-type");
            if (string.IsNullOrWhiteSpace(itemName) || string.IsNullOrWhiteSpace(itemType))
            {
                if (keyRing.TryGetReadKey(dataItem.OwnerRoleId, out var ownerReadKey))
                {
                    itemName ??= keyRingService.TryDecryptDataItemMeta(ownerReadKey, dataItem.EncryptedItemName, dataItem.Id, "item-name");
                    itemType ??= keyRingService.TryDecryptDataItemMeta(ownerReadKey, dataItem.EncryptedItemType, dataItem.Id, "item-type");
                }
            }

            if (string.IsNullOrWhiteSpace(itemType) || string.IsNullOrWhiteSpace(itemName))
            {
                return Results.BadRequest(new { error = "Unable to decrypt data item metadata." });
            }

            if (itemType.Equals("key", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = "Key items do not support values." });
            }

            if (itemType.Equals("file", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = "File items do not support plain-value updates." });
            }

            var encryptedValue = keyRingService.EncryptDataItemValue(dataKey, plainValue, dataItemId, itemName);
            var signatureAlg = dataItem.PublicSigningKeyAlg;
            var signature = signingService.Sign(privateSigningKey, signatureAlg, encryptedValue);

            dataItem.EncryptedValue = encryptedValue;
            dataItem.DataSignature = signature;
            dataItem.DataSignatureAlg = signatureAlg;
            dataItem.DataSignatureRoleId = writeGrant.RoleId;
            dataItem.UpdatedUtc = DateTimeOffset.UtcNow;

            LedgerSigningContext? signingContext = null;
            if (hasOwnerKey)
            {
                signingContext = await roleCryptoService.TryGetSigningContextAsync(writeGrant.RoleId, roleOwnerKey, ct);
            }
            await ledgerService.AppendBusinessAsync(
                "DataItemUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { dataItemId, roleId = writeGrant.RoleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new DataItemResponse(dataItemId, itemName, itemType, plainValue));
        });

        group.MapGet("/data/{dataItemId:guid}/file", async (
            Guid dataItemId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IEncryptedBlobStore encryptedBlobStore,
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

            var dataItem = await dbContext.DataItems.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == dataItemId, ct);
            if (dataItem is null)
            {
                return Results.NotFound();
            }

            var grants = await dbContext.DataKeyGrants.AsNoTracking()
                .Where(x => x.DataItemId == dataItemId && x.RevokedUtc == null)
                .ToListAsync(ct);

            if (!TryResolveReadableDataAccess(dataItem, grants, keyRing, keyRingService, encryptionService, out var access))
            {
                return Results.Forbid();
            }

            if (!string.Equals(access.ItemType, "file", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = "Data item is not a file." });
            }

            if (string.IsNullOrWhiteSpace(dataItem.StoragePath))
            {
                return Results.NotFound();
            }

            var fileName = access.ItemName;
            var contentType = "application/octet-stream";
            if (dataItem.EncryptedValue is { Length: > 0 })
            {
                var fileMetaJson = keyRingService.TryDecryptDataItemMeta(access.DataKey, dataItem.EncryptedValue, dataItemId, "file-meta");
                if (!string.IsNullOrWhiteSpace(fileMetaJson))
                {
                    try
                    {
                        var fileMeta = JsonSerializer.Deserialize<DataItemFileMeta>(fileMetaJson);
                        if (!string.IsNullOrWhiteSpace(fileMeta?.FileName))
                        {
                            fileName = Path.GetFileName(fileMeta.FileName);
                        }
                        if (!string.IsNullOrWhiteSpace(fileMeta?.ContentType))
                        {
                            contentType = fileMeta.ContentType;
                        }
                    }
                    catch (JsonException)
                    {
                        // keep fallback values
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(fileName))
            {
                fileName = $"{dataItemId:N}.bin";
            }

            context.Response.ContentType = contentType;
            if (dataItem.StorageSizeBytes is > 0)
            {
                context.Response.ContentLength = dataItem.StorageSizeBytes.Value;
            }
            context.Response.Headers.ContentDisposition = $"attachment; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";

            bool downloaded;
            try
            {
                downloaded = await encryptedBlobStore.DecryptToStreamAsync(
                    dataItem.StoragePath,
                    access.DataKey,
                    dataItemId,
                    context.Response.Body,
                    ct);
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            if (!downloaded)
            {
                return Results.NotFound();
            }

            return Results.Empty;
        });

        group.MapDelete("/data/{dataItemId:guid}", async (
            Guid dataItemId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptedBlobStore encryptedBlobStore,
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
                keyRing.TryGetOwnerKey(grant.RoleId, out _));

            if (ownerGrant is null)
            {
                return Results.Forbid();
            }

            keyRing.TryGetOwnerKey(ownerGrant.RoleId, out var ownerKey);
            var signingContext = await roleCryptoService.TryGetSigningContextAsync(ownerGrant.RoleId, ownerKey, ct);
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
            if (!string.IsNullOrWhiteSpace(dataItem.StoragePath))
            {
                await encryptedBlobStore.DeleteIfExistsAsync(dataItem.StoragePath, ct);
            }

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
                keyRing.TryGetWriteKey(grant.RoleId, out _) &&
                keyRing.TryGetOwnerKey(grant.RoleId, out _));

            if (ownerGrant is null)
            {
                return Results.Forbid();
            }

            keyRing.TryGetReadKey(ownerGrant.RoleId, out var ownerReadKey);
            keyRing.TryGetWriteKey(ownerGrant.RoleId, out var ownerWriteKey);
            keyRing.TryGetOwnerKey(ownerGrant.RoleId, out var ownerKey);
            var dataKey = encryptionService.Decrypt(ownerReadKey, ownerGrant.EncryptedDataKeyBlob, dataItemId.ToByteArray());
            var privateSigningKey = ownerGrant.EncryptedSigningKeyBlob is null
                ? null
                : encryptionService.Decrypt(ownerWriteKey, ownerGrant.EncryptedSigningKeyBlob, dataItemId.ToByteArray());

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(ownerGrant.RoleId, ownerKey, ct);
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

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(share.TargetRoleId, targetOwnerKey, ct);
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

    private static bool TryResolveReadableDataAccess(
        DataItem dataItem,
        IReadOnlyList<DataKeyGrant> grants,
        RoleKeyRing keyRing,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        out DataItemAccessContext access)
    {
        foreach (var grant in grants)
        {
            if (!keyRing.TryGetReadKey(grant.RoleId, out var roleReadKey))
            {
                continue;
            }

            byte[] dataKey;
            try
            {
                dataKey = encryptionService.Decrypt(roleReadKey, grant.EncryptedDataKeyBlob, dataItem.Id.ToByteArray());
            }
            catch (CryptographicException)
            {
                continue;
            }

            var itemName = keyRingService.TryDecryptDataItemMeta(dataKey, dataItem.EncryptedItemName, dataItem.Id, "item-name");
            var itemType = keyRingService.TryDecryptDataItemMeta(dataKey, dataItem.EncryptedItemType, dataItem.Id, "item-type");
            if (string.IsNullOrWhiteSpace(itemName) || string.IsNullOrWhiteSpace(itemType))
            {
                if (keyRing.TryGetReadKey(dataItem.OwnerRoleId, out var ownerReadKey))
                {
                    itemName ??= keyRingService.TryDecryptDataItemMeta(ownerReadKey, dataItem.EncryptedItemName, dataItem.Id, "item-name");
                    itemType ??= keyRingService.TryDecryptDataItemMeta(ownerReadKey, dataItem.EncryptedItemType, dataItem.Id, "item-type");
                }
            }

            if (string.IsNullOrWhiteSpace(itemName) || string.IsNullOrWhiteSpace(itemType))
            {
                continue;
            }

            access = new DataItemAccessContext(dataKey, itemName, itemType);
            return true;
        }

        access = new DataItemAccessContext(Array.Empty<byte>(), string.Empty, string.Empty);
        return false;
    }
}
