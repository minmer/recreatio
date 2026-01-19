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

public static class AccountRoleCreationEndpoints
{
    public static void MapAccountRoleCreationEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/roles", async (
            CreateRoleRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            ISessionSecretCache sessionSecretCache,
            ILoggerFactory loggerFactory,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("AccountEndpoints");
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            IResult Fail(string message)
            {
                logger.LogWarning("Create role failed for user {UserId}: {Message}", userId, message);
                return Results.BadRequest(new { error = message });
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                logger.LogWarning("Create role failed: account not found for user {UserId}.", userId);
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

            if (request.ParentRoleId.HasValue && request.ParentRoleId.Value == Guid.Empty)
            {
                return Fail("ParentRoleId is invalid.");
            }

            var parentRoleId = request.ParentRoleId ?? account.MasterRoleId;
            var relationshipType = string.IsNullOrWhiteSpace(request.RelationshipType)
                ? RoleRelationships.Owner
                : request.RelationshipType.Trim();
            if (!RoleRelationships.IsAllowed(relationshipType))
            {
                return Fail("RelationshipType is invalid.");
            }
            relationshipType = RoleRelationships.Normalize(relationshipType);
            if (request.ParentRoleId.HasValue && relationshipType != RoleRelationships.Owner)
            {
                return Fail("RelationshipType must be Owner for subroles.");
            }

            if (!keyRing.TryGetReadKey(parentRoleId, out var parentReadKey) || !keyRing.TryGetWriteKey(parentRoleId, out var parentWriteKey))
            {
                logger.LogWarning("Create role failed: parent role keys not available for user {UserId}, parent {ParentRoleId}.", userId, parentRoleId);
                return Results.Forbid();
            }

            var parentRole = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(role => role.Id == parentRoleId, ct);
            if (parentRole is null)
            {
                logger.LogWarning("Create role failed: parent role {ParentRoleId} not found for user {UserId}.", parentRoleId, userId);
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
                logger.LogWarning("Create role failed: parent role {ParentRoleId} not owned by user {UserId}.", parentRoleId, userId);
                return Results.Forbid();
            }

            byte[] masterKey;
            try
            {
                masterKey = keyRingService.RequireMasterKey(context, userId, sessionId);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            var fields = request.Fields ?? new List<RoleFieldRequest>();
            if (!fields.Any(field => field.FieldType.Trim().Equals(RoleFieldTypes.RoleKind, StringComparison.OrdinalIgnoreCase)))
            {
                fields.Add(new RoleFieldRequest(RoleFieldTypes.RoleKind, "Role", null, request.SignatureBase64));
            }
            if (fields.Count == 0)
            {
                return Fail("At least one field is required.");
            }

            var normalized = fields.Select(field => field.FieldType.Trim().ToLowerInvariant()).ToList();
            if (normalized.Distinct().Count() != normalized.Count)
            {
                return Fail("Duplicate field types are not allowed.");
            }

            if (!normalized.Contains(RoleFieldTypes.Nick))
            {
                return Fail($"Field '{RoleFieldTypes.Nick}' is required.");
            }

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

            var now = DateTimeOffset.UtcNow;
            var roleId = Guid.NewGuid();
            var readKey = RandomNumberGenerator.GetBytes(32);
            var writeKey = RandomNumberGenerator.GetBytes(32);
            var encryptedReadKeyCopy = encryptionService.Encrypt(parentReadKey, readKey, roleId.ToByteArray());
            var encryptedWriteKeyCopy = encryptionService.Encrypt(parentWriteKey, writeKey, roleId.ToByteArray());

            using var encryptionRsa = RSA.Create(2048);
            var publicEncryptionKey = encryptionRsa.ExportSubjectPublicKeyInfo();
            var privateEncryptionKey = encryptionRsa.ExportPkcs8PrivateKey();

            using var signingRsa = RSA.Create(2048);
            var publicSigningKey = signingRsa.ExportSubjectPublicKeyInfo();
            var privateSigningKey = signingRsa.ExportPkcs8PrivateKey();
            var publicSigningKeyHash = Convert.ToBase64String(SHA256.HashData(publicSigningKey));
            var publicEncryptionKeyHash = Convert.ToBase64String(SHA256.HashData(publicEncryptionKey));

            var roleCrypto = new RoleCryptoMaterial(
                Convert.ToBase64String(privateEncryptionKey),
                "RSA-OAEP-SHA256",
                Convert.ToBase64String(privateSigningKey),
                "RSA-SHA256");
            var encryptedRoleBlob = encryptionService.Encrypt(writeKey, JsonSerializer.SerializeToUtf8Bytes(roleCrypto));

            var role = new Role
            {
                Id = roleId,
                EncryptedRoleBlob = encryptedRoleBlob,
                PublicSigningKey = publicSigningKey,
                PublicSigningKeyAlg = "RSA-SHA256",
                PublicEncryptionKey = publicEncryptionKey,
                PublicEncryptionKeyAlg = "RSA-OAEP-SHA256",
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.Roles.Add(role);
            await dbContext.SaveChangesAsync(ct);

            var signingContext = LedgerSigning.TryCreate(parentRole, parentWriteKey, encryptionService);

            var roleReadKeyLedger = await ledgerService.AppendKeyAsync(
                "RoleReadKeyCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            dbContext.Keys.Add(new KeyEntry
            {
                Id = Guid.NewGuid(),
                KeyType = KeyType.RoleReadKey,
                OwnerRoleId = roleId,
                Version = 1,
                EncryptedKeyBlob = encryptionService.Encrypt(masterKey, readKey, roleId.ToByteArray()),
                MetadataJson = "{}",
                LedgerRefId = roleReadKeyLedger.Id,
                CreatedUtc = now
            });
            var roleWriteKeyLedger = await ledgerService.AppendKeyAsync(
                "RoleWriteKeyCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);
            dbContext.Keys.Add(new KeyEntry
            {
                Id = Guid.NewGuid(),
                KeyType = KeyType.RoleWriteKey,
                OwnerRoleId = roleId,
                Version = 1,
                EncryptedKeyBlob = encryptionService.Encrypt(masterKey, writeKey, roleId.ToByteArray()),
                MetadataJson = "{}",
                LedgerRefId = roleWriteKeyLedger.Id,
                CreatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            var roleFields = new List<RoleField>();
            foreach (var field in fields)
            {
                var fieldType = field.FieldType.Trim().ToLowerInvariant();
                var plainValue = field.PlainValue?.Trim();
                if (string.IsNullOrWhiteSpace(plainValue))
                {
                    return Fail($"PlainValue required for field '{fieldType}'.");
                }

                var dataKeyId = Guid.NewGuid();
                var dataKey = RandomNumberGenerator.GetBytes(32);
                var encryptedDataKey = keyRingService.EncryptDataKey(readKey, dataKey, dataKeyId);
                var keyLedger = await ledgerService.AppendKeyAsync(
                    "RoleFieldKeyCreated",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, fieldType, dataKeyId, signature = field.SignatureBase64 }),
                    ct,
                    signingContext);

                var keyEntry = new KeyEntry
                {
                    Id = dataKeyId,
                    KeyType = KeyType.DataKey,
                    OwnerRoleId = roleId,
                    Version = 1,
                    EncryptedKeyBlob = encryptedDataKey,
                    MetadataJson = JsonSerializer.Serialize(new { fieldType }),
                    LedgerRefId = keyLedger.Id,
                    CreatedUtc = now
                };
                dbContext.Keys.Add(keyEntry);
                await dbContext.SaveChangesAsync(ct);

                roleFields.Add(new RoleField
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    FieldType = fieldType,
                    DataKeyId = dataKeyId,
                    EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType),
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
                dbContext.RoleFields.Add(roleFields[^1]);
                await dbContext.SaveChangesAsync(ct);
            }

            _ = await ledgerService.AppendKeyAsync(
                "RoleEdgeCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId, roleId, relationshipType, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            dbContext.RoleEdges.Add(new RoleEdge
            {
                Id = Guid.NewGuid(),
                ParentRoleId = parentRoleId,
                ChildRoleId = roleId,
                RelationshipType = relationshipType,
                EncryptedReadKeyCopy = encryptedReadKeyCopy,
                EncryptedWriteKeyCopy = RoleRelationships.AllowsWrite(relationshipType) ? encryptedWriteKeyCopy : null,
                CreatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);
            await ledgerService.AppendAuthAsync(
                "RoleCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new
                {
                    roleId,
                    parentRoleId,
                    relationshipType,
                    publicSigningKeyHash,
                    publicEncryptionKeyHash,
                    role.PublicSigningKeyAlg,
                    role.PublicEncryptionKeyAlg
                }),
                ct,
                signingContext);
            await transaction.CommitAsync(ct);
            EndpointHelpers.InvalidateRoleKeyRing(sessionSecretCache, sessionId);

            var plainByField = fields
                .GroupBy(req => req.FieldType.Trim().ToLowerInvariant())
                .ToDictionary(group => group.Key, group => group.First().PlainValue?.Trim());

            var response = new RoleResponse(
                role.Id,
                role.PublicSigningKey is null ? null : Convert.ToBase64String(role.PublicSigningKey),
                role.PublicSigningKeyAlg,
                roleFields.Select(field => new RoleFieldResponse(
                    field.Id,
                    field.FieldType,
                    plainByField.GetValueOrDefault(field.FieldType),
                    field.DataKeyId
                )).ToList()
            );

            return Results.Ok(response);
        });
    }
}
