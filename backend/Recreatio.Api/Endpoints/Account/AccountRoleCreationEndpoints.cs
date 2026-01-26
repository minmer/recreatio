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

            if (!keyRing.TryGetReadKey(parentRoleId, out var parentReadKey) ||
                !keyRing.TryGetWriteKey(parentRoleId, out var parentWriteKey) ||
                !keyRing.TryGetOwnerKey(parentRoleId, out var parentOwnerKey))
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

            var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();
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
            var ownerKey = RandomNumberGenerator.GetBytes(32);
            var encryptedReadKeyCopy = encryptionService.Encrypt(parentReadKey, readKey, roleId.ToByteArray());
            var encryptedWriteKeyCopy = encryptionService.Encrypt(parentWriteKey, writeKey, roleId.ToByteArray());
            var encryptedOwnerKeyCopy = encryptionService.Encrypt(parentOwnerKey, ownerKey, roleId.ToByteArray());

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
            var encryptedRoleBlob = encryptionService.Encrypt(ownerKey, JsonSerializer.SerializeToUtf8Bytes(roleCrypto));

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

            var signingContext = LedgerSigning.TryCreate(parentRole, parentOwnerKey, encryptionService);

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
                ScopeType = "role-key",
                ScopeSubtype = "read",
                LedgerRefId = roleReadKeyLedger.Id,
                CreatedUtc = now
            });
            var roleWriteKeyLedger = await ledgerService.AppendKeyAsync(
                "RoleWriteKeyCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);
            var roleOwnerKeyLedger = await ledgerService.AppendKeyAsync(
                "RoleOwnerKeyCreated",
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
                ScopeType = "role-key",
                ScopeSubtype = "write",
                LedgerRefId = roleWriteKeyLedger.Id,
                CreatedUtc = now
            });
            dbContext.Keys.Add(new KeyEntry
            {
                Id = Guid.NewGuid(),
                KeyType = KeyType.RoleOwnerKey,
                OwnerRoleId = roleId,
                Version = 1,
                EncryptedKeyBlob = encryptionService.Encrypt(masterKey, ownerKey, roleId.ToByteArray()),
                ScopeType = "role-key",
                ScopeSubtype = "owner",
                LedgerRefId = roleOwnerKeyLedger.Id,
                CreatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            var roleFields = new List<RoleField>();
            var roleFieldsByType = new Dictionary<string, RoleField>(StringComparer.OrdinalIgnoreCase);
            foreach (var field in fields)
            {
                var fieldType = field.FieldType.Trim().ToLowerInvariant();
                var plainValue = field.PlainValue?.Trim();
                if (string.IsNullOrWhiteSpace(plainValue))
                {
                    return Fail($"PlainValue required for field '{fieldType}'.");
                }

                var dataKeyId = Guid.NewGuid();
                var roleFieldId = Guid.NewGuid();
                var dataKey = RandomNumberGenerator.GetBytes(32);
                var encryptedDataKey = keyRingService.EncryptDataKey(readKey, dataKey, dataKeyId);
                var encryptedFieldType = keyRingService.EncryptRoleFieldType(readKey, fieldType, roleFieldId);
                var fieldTypeHash = HMACSHA256.HashData(readKey, System.Text.Encoding.UTF8.GetBytes(fieldType));
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
                    ScopeType = "role-field",
                    ScopeSubtype = fieldType,
                    BoundEntryId = roleFieldId,
                    LedgerRefId = keyLedger.Id,
                    CreatedUtc = now
                };
                dbContext.Keys.Add(keyEntry);
                dbContext.KeyEntryBindings.Add(new KeyEntryBinding
                {
                    Id = Guid.NewGuid(),
                    KeyEntryId = dataKeyId,
                    EntryId = roleFieldId,
                    EntryType = "role-field",
                    EntrySubtype = fieldType,
                    CreatedUtc = now
                });
                await dbContext.SaveChangesAsync(ct);

                var roleField = new RoleField
                {
                    Id = roleFieldId,
                    RoleId = roleId,
                    FieldType = string.Empty,
                    EncryptedFieldType = encryptedFieldType,
                    FieldTypeHash = fieldTypeHash,
                    DataKeyId = dataKeyId,
                    EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                roleFields.Add(roleField);
                roleFieldsByType[fieldType] = roleField;
                dbContext.RoleFields.Add(roleField);
                await dbContext.SaveChangesAsync(ct);
            }

            _ = await ledgerService.AppendKeyAsync(
                "RoleEdgeCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId, roleId, relationshipType, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            var edgeId = Guid.NewGuid();
            var encryptedRelationshipType = keyRingService.EncryptRoleRelationshipType(parentReadKey, relationshipType, edgeId);
            var relationshipTypeHash = HMACSHA256.HashData(parentReadKey, System.Text.Encoding.UTF8.GetBytes(relationshipType));
            dbContext.RoleEdges.Add(new RoleEdge
            {
                Id = edgeId,
                ParentRoleId = parentRoleId,
                ChildRoleId = roleId,
                RelationshipType = string.Empty,
                EncryptedRelationshipType = encryptedRelationshipType,
                RelationshipTypeHash = relationshipTypeHash,
                EncryptedReadKeyCopy = encryptedReadKeyCopy,
                EncryptedWriteKeyCopy = RoleRelationships.AllowsWrite(relationshipType) ? encryptedWriteKeyCopy : null,
                EncryptedOwnerKeyCopy = RoleRelationships.IsOwner(relationshipType) ? encryptedOwnerKeyCopy : null,
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
                roleFieldsByType.Select(pair => new RoleFieldResponse(
                    pair.Value.Id,
                    pair.Key,
                    plainByField.GetValueOrDefault(pair.Key),
                    pair.Value.DataKeyId
                )).ToList()
            );

            return Results.Ok(response);
        });
    }
}
