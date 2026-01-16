using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountEndpoints
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

    public static void MapAccountEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/account").RequireAuthorization();

        group.MapGet("/profile", async (HttpContext context, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new ProfileResponse(account.LoginId, account.DisplayName));
        });

        group.MapPost("/profile", async (ProfileUpdateRequest request, HttpContext context, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var account = await dbContext.UserAccounts.FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            var displayName = request.DisplayName?.Trim();
            if (displayName is { Length: > 128 })
            {
                return Results.BadRequest(new { error = "DisplayName too long." });
            }

            account.DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName;
            account.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new ProfileResponse(account.LoginId, account.DisplayName));
        });

        group.MapGet("/roles/search", async (string? query, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(query))
            {
                return Results.BadRequest(new { error = "Query is required." });
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

            var nickFields = await dbContext.RoleFields.AsNoTracking()
                .Where(x => x.FieldType == "nick")
                .ToListAsync(ct);
            var roleKindFields = await dbContext.RoleFields.AsNoTracking()
                .Where(x => x.FieldType == "role_kind")
                .ToListAsync(ct);
            var allFields = nickFields.Concat(roleKindFields).ToList();

            List<KeyEntry> keyEntries;
            if (allFields.Count == 0)
            {
                keyEntries = new List<KeyEntry>();
            }
            else
            {
                var dataKeyIds = allFields.Select(x => x.DataKeyId).Distinct().ToHashSet();
                keyEntries = await dbContext.Keys.AsNoTracking()
                    .Where(key => dataKeyIds.Contains(key.Id))
                    .ToListAsync(ct);
            }

            var keyEntryById = keyEntries.ToDictionary(x => x.Id, x => x);
            var normalized = query.Trim();
            var matchedRoles = new List<(Guid RoleId, string Nick)>();

            foreach (var field in nickFields)
            {
                if (!keyRing.TryGetRoleKey(field.RoleId, out var roleKey))
                {
                    continue;
                }

                if (!keyEntryById.TryGetValue(field.DataKeyId, out var keyEntry) || keyEntry.KeyType != KeyType.DataKey)
                {
                    continue;
                }

                byte[] dataKey;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, roleKey);
                }
                catch (CryptographicException)
                {
                    continue;
                }

                var plain = keyRingService.TryDecryptFieldValue(dataKey, field.EncryptedValue, field.RoleId, field.FieldType);
                if (string.IsNullOrWhiteSpace(plain))
                {
                    continue;
                }

                if (!plain.Equals(normalized, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                matchedRoles.Add((field.RoleId, plain));
            }

            if (matchedRoles.Count == 0)
            {
                return Results.Ok(new List<RoleSearchResponse>());
            }

            var roleKindById = new Dictionary<Guid, string>();
            foreach (var field in roleKindFields)
            {
                var roleKind = TryGetPlainValue(field, keyRing, keyEntryById, keyRingService);
                if (!string.IsNullOrWhiteSpace(roleKind))
                {
                    roleKindById[field.RoleId] = roleKind;
                }
            }
            var matches = matchedRoles
                .Select(item => new RoleSearchResponse(item.RoleId, roleKindById.GetValueOrDefault(item.RoleId, "Role"), item.Nick))
                .ToList();

            return Results.Ok(matches);
        });

        group.MapGet("/roles/graph", async (HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, CancellationToken ct) =>
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

            var roleIds = keyRing.RoleKeys.Keys.ToList();
            if (roleIds.Count == 0)
            {
                return Results.Ok(new RoleGraphResponse(new List<RoleGraphNode>(), new List<RoleGraphEdge>()));
            }

            var roleIdSet = roleIds.ToHashSet();
            var roles = await dbContext.Roles.AsNoTracking()
                .Where(role => roleIdSet.Contains(role.Id))
                .ToListAsync(ct);

            var fields = await dbContext.RoleFields.AsNoTracking()
                .Where(field => roleIdSet.Contains(field.RoleId))
                .ToListAsync(ct);

            List<KeyEntry> keyEntries;
            if (fields.Count == 0)
            {
                keyEntries = new List<KeyEntry>();
            }
            else
            {
                var dataKeyIds = fields.Select(x => x.DataKeyId).Distinct().ToHashSet();
                keyEntries = await dbContext.Keys.AsNoTracking()
                    .Where(key => dataKeyIds.Contains(key.Id))
                    .ToListAsync(ct);
            }

            var keyEntryById = keyEntries.ToDictionary(x => x.Id, x => x);
            var valuesByRole = new Dictionary<Guid, Dictionary<string, string>>();
            foreach (var field in fields)
            {
                var plain = TryGetPlainValue(field, keyRing, keyEntryById, keyRingService);
                if (string.IsNullOrWhiteSpace(plain))
                {
                    continue;
                }

                if (!valuesByRole.TryGetValue(field.RoleId, out var fieldValues))
                {
                    fieldValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    valuesByRole[field.RoleId] = fieldValues;
                }

                fieldValues[field.FieldType] = plain;
            }

            var nodes = new List<RoleGraphNode>();
            foreach (var role in roles)
            {
                valuesByRole.TryGetValue(role.Id, out var fieldValues);
                var roleKind = fieldValues is not null && fieldValues.TryGetValue("role_kind", out var kindValue)
                    ? kindValue
                    : "Role";
                var label = fieldValues is not null && fieldValues.TryGetValue("nick", out var nickValue)
                    ? nickValue
                    : $"{roleKind} {role.Id.ToString()[..8]}";
                nodes.Add(new RoleGraphNode($"role:{role.Id:N}", label, "role", roleKind, null, role.Id, null, null));
            }

            var edges = new List<RoleGraphEdge>();

            foreach (var field in fields)
            {
                if (field.FieldType is "nick" or "role_kind")
                {
                    continue;
                }

                valuesByRole.TryGetValue(field.RoleId, out var fieldValues);
                string? value = null;
                if (fieldValues is not null && fieldValues.TryGetValue(field.FieldType, out var resolved))
                {
                    value = resolved;
                }
                var dataNodeId = $"data:{field.Id:N}";
                nodes.Add(new RoleGraphNode(
                    dataNodeId,
                    field.FieldType,
                    "data",
                    field.FieldType,
                    value,
                    field.RoleId,
                    field.FieldType,
                    field.DataKeyId));
                edges.Add(new RoleGraphEdge(
                    $"{field.RoleId:N}:{field.Id:N}:data",
                    $"role:{field.RoleId:N}",
                    dataNodeId,
                    "Data"));
            }

            var recoveryShares = await dbContext.RoleRecoveryShares.AsNoTracking()
                .Where(share => roleIdSet.Contains(share.TargetRoleId))
                .ToListAsync(ct);
            foreach (var targetRoleId in recoveryShares.Select(x => x.TargetRoleId).Distinct())
            {
                var recoveryNodeId = $"recovery:{targetRoleId:N}";
                nodes.Add(new RoleGraphNode(recoveryNodeId, "Recovery key", "recovery", "RecoveryKey", null, targetRoleId, null, null));
                edges.Add(new RoleGraphEdge(
                    $"role:{targetRoleId:N}:{recoveryNodeId}:recovery-owner",
                    $"role:{targetRoleId:N}",
                    recoveryNodeId,
                    "RecoveryOwner"));

                var sharedNodeId = $"recovery-shared:{targetRoleId:N}";
                nodes.Add(new RoleGraphNode(sharedNodeId, "Shared recovery", "recovery_shared", "RecoveryShare", null, targetRoleId, null, null));
                edges.Add(new RoleGraphEdge(
                    $"recovery:{targetRoleId:N}:{sharedNodeId}:recovery-share",
                    $"recovery:{targetRoleId:N}",
                    sharedNodeId,
                    "RecoveryShare"));

                foreach (var share in recoveryShares.Where(x => x.TargetRoleId == targetRoleId))
                {
                    if (!roleIdSet.Contains(share.SharedWithRoleId))
                    {
                        continue;
                    }
                    edges.Add(new RoleGraphEdge(
                        $"{sharedNodeId}:role:{share.SharedWithRoleId:N}:recovery-access",
                        sharedNodeId,
                        $"role:{share.SharedWithRoleId:N}",
                        "RecoveryAccess"));
                }
            }

            var roleEdges = await dbContext.RoleEdges.AsNoTracking().ToListAsync(ct);
            edges.AddRange(roleEdges
                .Where(edge => roleIdSet.Contains(edge.ParentRoleId) && roleIdSet.Contains(edge.ChildRoleId))
                .Select(edge => new RoleGraphEdge(
                    $"{edge.ParentRoleId:N}:{edge.ChildRoleId:N}:{edge.RelationshipType}",
                    $"role:{edge.ParentRoleId:N}",
                    $"role:{edge.ChildRoleId:N}",
                    edge.RelationshipType)));

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is not null)
            {
                var membershipEdges = await dbContext.Memberships.AsNoTracking()
                    .Where(x => x.UserId == userId)
                    .ToListAsync(ct);
                edges.AddRange(membershipEdges
                    .Where(edge => roleIdSet.Contains(edge.RoleId))
                    .Select(edge => new RoleGraphEdge(
                        $"{account.MasterRoleId:N}:{edge.RoleId:N}:{edge.RelationshipType}",
                        $"role:{account.MasterRoleId:N}",
                        $"role:{edge.RoleId:N}",
                        edge.RelationshipType)));
            }

            return Results.Ok(new RoleGraphResponse(nodes, edges));
        });

        group.MapGet("/roles", async (HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, CancellationToken ct) =>
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

            var roleIds = keyRing.RoleKeys.Keys.ToList();
            if (roleIds.Count == 0)
            {
                return Results.Ok(new List<RoleResponse>());
            }

            var roles = await dbContext.Roles.AsNoTracking()
                .Where(role => roleIds.Contains(role.Id))
                .ToListAsync(ct);

            var fields = await dbContext.RoleFields.AsNoTracking()
                .Where(field => roleIds.Contains(field.RoleId))
                .ToListAsync(ct);

            List<KeyEntry> keyEntries;
            if (fields.Count == 0)
            {
                keyEntries = new List<KeyEntry>();
            }
            else
            {
                var dataKeyIds = fields.Select(x => x.DataKeyId).Distinct().ToHashSet();
                keyEntries = await dbContext.Keys.AsNoTracking()
                    .Where(key => dataKeyIds.Contains(key.Id))
                    .ToListAsync(ct);
            }
            var keyEntryById = keyEntries.ToDictionary(x => x.Id, x => x);
            var valuesByRole = new Dictionary<Guid, Dictionary<string, string>>();
            foreach (var field in fields)
            {
                var plain = TryGetPlainValue(field, keyRing, keyEntryById, keyRingService);
                if (string.IsNullOrWhiteSpace(plain))
                {
                    continue;
                }

                if (!valuesByRole.TryGetValue(field.RoleId, out var fieldValues))
                {
                    fieldValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    valuesByRole[field.RoleId] = fieldValues;
                }

                fieldValues[field.FieldType] = plain;
            }

            var fieldsByRole = fields
                .GroupBy(x => x.RoleId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(field => new RoleFieldResponse(
                        field.FieldType,
                        TryGetPlainValue(field, keyRing, keyEntryById, keyRingService),
                        field.DataKeyId
                    )).ToList()
                );

            var response = roles
                .Select(role => new RoleResponse(
                    role.Id,
                    role.PublicSigningKey is null ? null : Convert.ToBase64String(role.PublicSigningKey),
                    role.PublicSigningKeyAlg,
                    fieldsByRole.TryGetValue(role.Id, out var list) ? list : new List<RoleFieldResponse>()
                )).ToList();

            return Results.Ok(response);
        });

        group.MapPost("/roles", async (
            CreateRoleRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
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
                ? "Owner"
                : request.RelationshipType.Trim();
            if (!AllowedRelationshipTypes.Contains(relationshipType))
            {
                return Fail("RelationshipType is invalid.");
            }

            if (!keyRing.TryGetRoleKey(parentRoleId, out var parentRoleKey))
            {
                logger.LogWarning("Create role failed: parent role key not available for user {UserId}, parent {ParentRoleId}.", userId, parentRoleId);
                return Results.Forbid();
            }

            var parentRoleExists = await dbContext.Roles.AsNoTracking()
                .AnyAsync(role => role.Id == parentRoleId, ct);
            if (!parentRoleExists)
            {
                logger.LogWarning("Create role failed: parent role {ParentRoleId} not found for user {UserId}.", parentRoleId, userId);
                return Results.NotFound();
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
            if (!fields.Any(field => field.FieldType.Trim().Equals("role_kind", StringComparison.OrdinalIgnoreCase)))
            {
                fields.Add(new RoleFieldRequest("role_kind", "Role", null, request.SignatureBase64));
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

            if (!normalized.Contains("nick"))
            {
                return Fail("Field 'nick' is required.");
            }

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

            var now = DateTimeOffset.UtcNow;
            var roleId = Guid.NewGuid();
            var roleKey = RandomNumberGenerator.GetBytes(32);
            var encryptedRoleKey = encryptionService.Encrypt(masterKey, roleKey, roleId.ToByteArray());
            var encryptedRoleKeyCopy = encryptionService.Encrypt(parentRoleKey, roleKey, roleId.ToByteArray());

            using var rsa = RSA.Create(2048);
            var publicEncryptionKey = rsa.ExportSubjectPublicKeyInfo();
            var privateEncryptionKey = rsa.ExportPkcs8PrivateKey();
            var roleCrypto = new RoleCryptoMaterial(
                Convert.ToBase64String(privateEncryptionKey),
                "RSA-OAEP-SHA256");
            var encryptedRoleBlob = encryptionService.Encrypt(roleKey, JsonSerializer.SerializeToUtf8Bytes(roleCrypto));

            var role = new Role
            {
                Id = roleId,
                EncryptedRoleBlob = encryptedRoleBlob,
                PublicSigningKey = string.IsNullOrWhiteSpace(request.PublicSigningKeyBase64)
                    ? null
                    : Convert.FromBase64String(request.PublicSigningKeyBase64),
                PublicSigningKeyAlg = request.PublicSigningKeyAlg,
                PublicEncryptionKey = publicEncryptionKey,
                PublicEncryptionKeyAlg = "RSA-OAEP-SHA256",
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.Roles.Add(role);
            await dbContext.SaveChangesAsync(ct);

            var roleKeyLedger = await ledgerService.AppendKeyAsync(
                "RoleKeyCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, signature = request.SignatureBase64 }),
                ct);

            dbContext.Keys.Add(new KeyEntry
            {
                Id = Guid.NewGuid(),
                KeyType = KeyType.RoleKey,
                OwnerRoleId = roleId,
                Version = 1,
                EncryptedKeyBlob = encryptedRoleKey,
                MetadataJson = "{}",
                LedgerRefId = roleKeyLedger.Id,
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
                var encryptedDataKey = keyRingService.EncryptDataKey(roleKey, dataKey, dataKeyId);
                var keyLedger = await ledgerService.AppendKeyAsync(
                    "RoleFieldKeyCreated",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, fieldType, dataKeyId, signature = field.SignatureBase64 }),
                    ct);

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

            var edgeLedger = await ledgerService.AppendKeyAsync(
                "RoleEdgeCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId, roleId, relationshipType, signature = request.SignatureBase64 }),
                ct);

            dbContext.RoleEdges.Add(new RoleEdge
            {
                Id = Guid.NewGuid(),
                ParentRoleId = parentRoleId,
                ChildRoleId = roleId,
                RelationshipType = relationshipType,
                EncryptedRoleKeyCopy = encryptedRoleKeyCopy,
                CreatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);
            await ledgerService.AppendAuthAsync(
                "RoleCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, parentRoleId, relationshipType }),
                ct);
            await transaction.CommitAsync(ct);

            var plainByField = fields
                .GroupBy(req => req.FieldType.Trim().ToLowerInvariant())
                .ToDictionary(group => group.Key, group => group.First().PlainValue?.Trim());

            var response = new RoleResponse(
                role.Id,
                role.PublicSigningKey is null ? null : Convert.ToBase64String(role.PublicSigningKey),
                role.PublicSigningKeyAlg,
                roleFields.Select(field => new RoleFieldResponse(
                    field.FieldType,
                    plainByField.GetValueOrDefault(field.FieldType),
                    field.DataKeyId
                )).ToList()
            );

            return Results.Ok(response);
        });

        group.MapPost("/roles/{roleId:guid}/fields", async (
            Guid roleId,
            UpdateRoleFieldRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
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

            if (!keyRing.TryGetRoleKey(roleId, out var roleKey))
            {
                return Results.Forbid();
            }

            var fieldType = request.FieldType.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(fieldType))
            {
                return Results.BadRequest(new { error = "FieldType is required." });
            }

            var plainValue = request.PlainValue?.Trim();
            if (string.IsNullOrWhiteSpace(plainValue))
            {
                return Results.BadRequest(new { error = "PlainValue is required." });
            }

            var existing = await dbContext.RoleFields
                .FirstOrDefaultAsync(x => x.RoleId == roleId && x.FieldType == fieldType, ct);

            var now = DateTimeOffset.UtcNow;
            if (existing is null)
            {
                var dataKeyId = Guid.NewGuid();
                var dataKey = RandomNumberGenerator.GetBytes(32);
                var encryptedDataKey = keyRingService.EncryptDataKey(roleKey, dataKey, dataKeyId);
                var keyLedger = await ledgerService.AppendKeyAsync(
                    "RoleFieldKeyCreated",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, fieldType, dataKeyId, signature = request.SignatureBase64 }),
                    ct);

                dbContext.Keys.Add(new KeyEntry
                {
                    Id = dataKeyId,
                    KeyType = KeyType.DataKey,
                    OwnerRoleId = roleId,
                    Version = 1,
                    EncryptedKeyBlob = encryptedDataKey,
                    MetadataJson = JsonSerializer.Serialize(new { fieldType }),
                    LedgerRefId = keyLedger.Id,
                    CreatedUtc = now
                });

                existing = new RoleField
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    FieldType = fieldType,
                    DataKeyId = dataKeyId,
                    EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.RoleFields.Add(existing);
            }
            else
            {
                var keyEntry = await dbContext.Keys.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == existing.DataKeyId && x.KeyType == KeyType.DataKey, ct);
                if (keyEntry is null)
                {
                    return Results.BadRequest(new { error = "DataKey missing for field." });
                }

                var dataKey = keyRingService.DecryptDataKey(keyEntry, roleKey);
                existing.EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType);
                existing.UpdatedUtc = now;
            }

            await ledgerService.AppendBusinessAsync(
                "RoleFieldUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, fieldType, signature = request.SignatureBase64 }),
                ct);

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new RoleFieldResponse(
                existing.FieldType,
                plainValue,
                existing.DataKeyId
            ));
        });

        group.MapGet("/roles/{roleId:guid}/access", async (Guid roleId, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, CancellationToken ct) =>
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

            if (!keyRing.TryGetRoleKey(roleId, out _))
            {
                return Results.Forbid();
            }

            var edges = await dbContext.RoleEdges.AsNoTracking()
                .Where(edge => edge.ChildRoleId == roleId)
                .ToListAsync(ct);
            if (edges.Count == 0)
            {
                return Results.Ok(new RoleAccessResponse(roleId, new List<RoleAccessRoleResponse>()));
            }

            var parentRoleIds = edges.Select(edge => edge.ParentRoleId).Distinct().ToList();
            var kindFields = await dbContext.RoleFields.AsNoTracking()
                .Where(field => field.FieldType == "role_kind" && parentRoleIds.Contains(field.RoleId))
                .ToListAsync(ct);

            List<KeyEntry> keyEntries;
            if (kindFields.Count == 0)
            {
                keyEntries = new List<KeyEntry>();
            }
            else
            {
                var dataKeyIds = kindFields.Select(x => x.DataKeyId).Distinct().ToHashSet();
                keyEntries = await dbContext.Keys.AsNoTracking()
                    .Where(key => dataKeyIds.Contains(key.Id))
                    .ToListAsync(ct);
            }

            var keyEntryById = keyEntries.ToDictionary(x => x.Id, x => x);
            var roleKindById = new Dictionary<Guid, string>();
            foreach (var field in kindFields)
            {
                var kind = TryGetPlainValue(field, keyRing, keyEntryById, keyRingService);
                if (!string.IsNullOrWhiteSpace(kind))
                {
                    roleKindById[field.RoleId] = kind;
                }
            }

            var roleEdges = edges
                .Select(edge => new RoleAccessRoleResponse(
                    edge.ParentRoleId,
                    roleKindById.GetValueOrDefault(edge.ParentRoleId, "Role"),
                    edge.RelationshipType))
                .ToList();

            var response = new RoleAccessResponse(roleId, roleEdges);

            return Results.Ok(response);
        });

        group.MapPost("/roles/{roleId:guid}/shares", async (Guid roleId, AddRoleShareRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IAsymmetricEncryptionService asymmetricEncryptionService, ILedgerService ledgerService, CancellationToken ct) =>
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
            if (!AllowedRelationshipTypes.Contains(relationshipType))
            {
                return Results.BadRequest(new { error = "RelationshipType is invalid." });
            }

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

            if (!keyRing.TryGetRoleKey(roleId, out var roleKey))
            {
                return Results.Forbid();
            }

            var encryptedRoleKey = asymmetricEncryptionService.EncryptWithPublicKey(
                targetRole.PublicEncryptionKey,
                targetRole.PublicEncryptionKeyAlg,
                roleKey);

            var ledger = await ledgerService.AppendKeyAsync(
                "RoleSharePending",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, targetRoleId = request.TargetRoleId, relationshipType, signature = request.SignatureBase64 }),
                ct);

            dbContext.PendingRoleShares.Add(new PendingRoleShare
            {
                Id = Guid.NewGuid(),
                SourceRoleId = roleId,
                TargetRoleId = request.TargetRoleId,
                RelationshipType = relationshipType,
                EncryptedRoleKeyBlob = encryptedRoleKey,
                EncryptionAlg = targetRole.PublicEncryptionKeyAlg,
                Status = "Pending",
                LedgerRefId = ledger.Id,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapGet("/shares", async (HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, CancellationToken ct) =>
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

            var roleIds = keyRing.RoleKeys.Keys.ToList();
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
        });

        group.MapPost("/shares/{shareId:guid}/accept", async (Guid shareId, PendingRoleShareAcceptRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IAsymmetricEncryptionService asymmetricEncryptionService, IEncryptionService encryptionService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetRoleKey(share.TargetRoleId, out var targetRoleKey))
            {
                return Results.Forbid();
            }

            var cryptoMaterial = TryReadRoleCryptoMaterial(targetRole, targetRoleKey, encryptionService);
            if (cryptoMaterial is null)
            {
                return Results.BadRequest(new { error = "Target role crypto material missing." });
            }

            byte[] sharedRoleKey;
            try
            {
                sharedRoleKey = asymmetricEncryptionService.DecryptWithPrivateKey(
                    Convert.FromBase64String(cryptoMaterial.PrivateEncryptionKeyBase64),
                    cryptoMaterial.PrivateEncryptionKeyAlg,
                    share.EncryptedRoleKeyBlob);
            }
            catch (CryptographicException)
            {
                return Results.BadRequest(new { error = "Unable to decrypt shared role key." });
            }

            var encryptedCopy = encryptionService.Encrypt(targetRoleKey, sharedRoleKey, share.SourceRoleId.ToByteArray());

            if (!await dbContext.RoleEdges.AsNoTracking().AnyAsync(x => x.ParentRoleId == share.TargetRoleId && x.ChildRoleId == share.SourceRoleId, ct))
            {
                dbContext.RoleEdges.Add(new RoleEdge
                {
                    Id = Guid.NewGuid(),
                    ParentRoleId = share.TargetRoleId,
                    ChildRoleId = share.SourceRoleId,
                    RelationshipType = share.RelationshipType,
                    EncryptedRoleKeyCopy = encryptedCopy,
                    CreatedUtc = DateTimeOffset.UtcNow
                });
            }

            share.Status = "Accepted";
            share.AcceptedUtc = DateTimeOffset.UtcNow;

            await ledgerService.AppendKeyAsync(
                "RoleShareAccepted",
                userId.ToString(),
                JsonSerializer.Serialize(new { shareId, sourceRoleId = share.SourceRoleId, targetRoleId = share.TargetRoleId, signature = request.SignatureBase64 }),
                ct);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapPost("/roles/{roleId:guid}/recovery/shares", async (Guid roleId, RecoveryShareRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetRoleKey(roleId, out _))
            {
                return Results.Forbid();
            }

            var share = await dbContext.RoleRecoveryShares
                .FirstOrDefaultAsync(x => x.TargetRoleId == roleId && x.SharedWithRoleId == request.SharedWithRoleId, ct);

            var now = DateTimeOffset.UtcNow;
            if (share is null)
            {
                share = new RoleRecoveryShare
                {
                    Id = Guid.NewGuid(),
                    TargetRoleId = roleId,
                    SharedWithRoleId = request.SharedWithRoleId,
                    EncryptedShareBlob = Convert.FromBase64String(request.EncryptedShareBase64),
                    CreatedUtc = now
                };
                dbContext.RoleRecoveryShares.Add(share);
            }
            else
            {
                share.EncryptedShareBlob = Convert.FromBase64String(request.EncryptedShareBase64);
                share.RevokedUtc = null;
            }

            await ledgerService.AppendKeyAsync(
                "RecoveryShareUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, sharedWithRoleId = request.SharedWithRoleId, signature = request.SignatureBase64 }),
                ct);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request", async (Guid roleId, RecoveryRequestCreate request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetRoleKey(roleId, out _))
            {
                return Results.Forbid();
            }

            var activeShares = await dbContext.RoleRecoveryShares.AsNoTracking()
                .Where(x => x.TargetRoleId == roleId && x.RevokedUtc == null)
                .CountAsync(ct);

            if (activeShares == 0)
            {
                return Results.BadRequest(new { error = "No recovery shares exist." });
            }

            var now = DateTimeOffset.UtcNow;
            var recovery = new RoleRecoveryRequest
            {
                Id = Guid.NewGuid(),
                TargetRoleId = roleId,
                InitiatorRoleId = request.InitiatorRoleId,
                Status = "Pending",
                RequiredApprovals = activeShares,
                CreatedUtc = now
            };

            dbContext.RoleRecoveryRequests.Add(recovery);
            await ledgerService.AppendAuthAsync(
                "RecoveryRequestCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId = recovery.Id, requiredApprovals = activeShares, signature = request.SignatureBase64 }),
                ct);

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request/{requestId:guid}/approve", async (Guid roleId, Guid requestId, RecoveryApproveRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetRoleKey(request.ApproverRoleId, out _))
            {
                return Results.Forbid();
            }

            var recovery = await dbContext.RoleRecoveryRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.TargetRoleId == roleId, ct);
            if (recovery is null)
            {
                return Results.NotFound();
            }

            if (recovery.CanceledUtc is not null || recovery.CompletedUtc is not null)
            {
                return Results.BadRequest(new { error = "Recovery request is not active." });
            }

            var shareExists = await dbContext.RoleRecoveryShares.AsNoTracking()
                .AnyAsync(x => x.TargetRoleId == roleId && x.SharedWithRoleId == request.ApproverRoleId && x.RevokedUtc == null, ct);
            if (!shareExists)
            {
                return Results.Forbid();
            }

            var existing = await dbContext.RoleRecoveryApprovals
                .FirstOrDefaultAsync(x => x.RequestId == requestId && x.ApproverRoleId == request.ApproverRoleId, ct);
            if (existing is not null)
            {
                return Results.Conflict(new { error = "Already approved." });
            }

            dbContext.RoleRecoveryApprovals.Add(new RoleRecoveryApproval
            {
                Id = Guid.NewGuid(),
                RequestId = requestId,
                ApproverRoleId = request.ApproverRoleId,
                EncryptedApprovalBlob = Convert.FromBase64String(request.EncryptedApprovalBase64),
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await ledgerService.AppendAuthAsync(
                "RecoveryApprovalAdded",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId, approverRoleId = request.ApproverRoleId, signature = request.SignatureBase64 }),
                ct);

            var approvals = await dbContext.RoleRecoveryApprovals.CountAsync(x => x.RequestId == requestId, ct);
            if (approvals >= recovery.RequiredApprovals && recovery.Status != "Ready")
            {
                recovery.Status = "Ready";
                await ledgerService.AppendAuthAsync(
                    "RecoveryRequestReady",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, requestId }),
                    ct);
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request/{requestId:guid}/cancel", async (Guid roleId, Guid requestId, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetRoleKey(roleId, out _))
            {
                return Results.Forbid();
            }

            var recovery = await dbContext.RoleRecoveryRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.TargetRoleId == roleId, ct);
            if (recovery is null)
            {
                return Results.NotFound();
            }

            if (recovery.CanceledUtc is not null || recovery.CompletedUtc is not null)
            {
                return Results.BadRequest(new { error = "Recovery request is not active." });
            }

            recovery.Status = "Canceled";
            recovery.CanceledUtc = DateTimeOffset.UtcNow;

            await ledgerService.AppendAuthAsync(
                "RecoveryRequestCanceled",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId }),
                ct);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request/{requestId:guid}/complete", async (Guid roleId, Guid requestId, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetRoleKey(roleId, out _))
            {
                return Results.Forbid();
            }

            var recovery = await dbContext.RoleRecoveryRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.TargetRoleId == roleId, ct);
            if (recovery is null)
            {
                return Results.NotFound();
            }

            if (recovery.Status != "Ready")
            {
                return Results.BadRequest(new { error = "Recovery request is not ready." });
            }

            recovery.Status = "Completed";
            recovery.CompletedUtc = DateTimeOffset.UtcNow;

            var shares = await dbContext.RoleRecoveryShares
                .Where(x => x.TargetRoleId == roleId && x.RevokedUtc == null)
                .ToListAsync(ct);

            foreach (var share in shares)
            {
                share.RevokedUtc = DateTimeOffset.UtcNow;
            }

            await ledgerService.AppendAuthAsync(
                "RecoveryRequestCompleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId }),
                ct);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });
    }

    private static string? TryGetPlainValue(
        RoleField field,
        RoleKeyRing keyRing,
        IReadOnlyDictionary<Guid, KeyEntry> keyEntryById,
        IKeyRingService keyRingService)
    {
        if (!keyRing.TryGetRoleKey(field.RoleId, out var roleKey))
        {
            return null;
        }

        if (!keyEntryById.TryGetValue(field.DataKeyId, out var keyEntry) || keyEntry.KeyType != KeyType.DataKey)
        {
            return null;
        }

        byte[] dataKey;
        try
        {
            dataKey = keyRingService.DecryptDataKey(keyEntry, roleKey);
        }
        catch (CryptographicException)
        {
            return null;
        }

        return keyRingService.TryDecryptFieldValue(dataKey, field.EncryptedValue, field.RoleId, field.FieldType);
    }

    private static RoleCryptoMaterial? TryReadRoleCryptoMaterial(Role role, byte[] roleKey, IEncryptionService encryptionService)
    {
        if (role.EncryptedRoleBlob.Length == 0)
        {
            return null;
        }

        try
        {
            var json = encryptionService.Decrypt(roleKey, role.EncryptedRoleBlob);
            return JsonSerializer.Deserialize<RoleCryptoMaterial>(json);
        }
        catch (JsonException)
        {
            return null;
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
