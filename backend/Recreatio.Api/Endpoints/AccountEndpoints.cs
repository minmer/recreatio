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

            List<KeyEntry> keyEntries;
            if (nickFields.Count == 0)
            {
                keyEntries = new List<KeyEntry>();
            }
            else
            {
                keyEntries = await (
                    from key in dbContext.Keys.AsNoTracking()
                    join field in dbContext.RoleFields.AsNoTracking() on key.Id equals field.DataKeyId
                    where field.FieldType == "nick"
                    select key
                ).Distinct().ToListAsync(ct);
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

            var roleTypes = await dbContext.Roles.AsNoTracking()
                .Select(x => new { x.Id, x.RoleType })
                .ToListAsync(ct);

            var roleTypeById = roleTypes.ToDictionary(x => x.Id, x => x.RoleType);
            var matches = matchedRoles
                .Select(item => new RoleSearchResponse(item.RoleId, roleTypeById.GetValueOrDefault(item.RoleId, "Unknown"), item.Nick))
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
                .ToListAsync(ct);
            var roleSummaries = roles
                .Where(role => roleIdSet.Contains(role.Id))
                .Select(role => new { role.Id, role.RoleType })
                .ToList();

            var nickFields = await dbContext.RoleFields.AsNoTracking()
                .Where(x => x.FieldType == "nick")
                .ToListAsync(ct);
            nickFields = nickFields.Where(field => roleIdSet.Contains(field.RoleId)).ToList();

            List<KeyEntry> keyEntries;
            if (nickFields.Count == 0)
            {
                keyEntries = new List<KeyEntry>();
            }
            else
            {
                var dataKeyIds = nickFields.Select(x => x.DataKeyId).Distinct().ToHashSet();
                var keys = await dbContext.Keys.AsNoTracking().ToListAsync(ct);
                keyEntries = keys.Where(key => dataKeyIds.Contains(key.Id)).ToList();
            }

            var keyEntryById = keyEntries.ToDictionary(x => x.Id, x => x);
            var nickByRole = new Dictionary<Guid, string>(roleIds.Count);
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

                var nick = keyRingService.TryDecryptFieldValue(dataKey, field.EncryptedValue, field.RoleId, field.FieldType);
                if (!string.IsNullOrWhiteSpace(nick))
                {
                    nickByRole[field.RoleId] = nick;
                }
            }

            var nodes = roleSummaries.Select(role =>
            {
                var label = nickByRole.TryGetValue(role.Id, out var nick)
                    ? nick
                    : $"{role.RoleType} {role.Id.ToString()[..8]}";
                return new RoleGraphNode(role.Id, label, role.RoleType);
            }).ToList();

            var roleEdges = await dbContext.RoleEdges.AsNoTracking().ToListAsync(ct);
            var edges = roleEdges
                .Where(edge => roleIdSet.Contains(edge.ParentRoleId) && roleIdSet.Contains(edge.ChildRoleId))
                .Select(edge => new RoleGraphEdge(
                    $"{edge.ParentRoleId:N}:{edge.ChildRoleId:N}:{edge.RelationshipType}",
                    edge.ParentRoleId,
                    edge.ChildRoleId,
                    edge.RelationshipType))
                .ToList();

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is not null)
            {
                var membershipEdges = await dbContext.Memberships.AsNoTracking()
                    .Where(x => x.UserId == userId)
                    .Select(x => new RoleGraphEdge(
                        $"{account.MasterRoleId:N}:{x.RoleId:N}:{x.RelationshipType}",
                        account.MasterRoleId,
                        x.RoleId,
                        x.RelationshipType))
                    .ToListAsync(ct);
                membershipEdges = membershipEdges
                    .Where(edge => roleIdSet.Contains(edge.SourceRoleId) && roleIdSet.Contains(edge.TargetRoleId))
                    .ToList();

                edges.AddRange(membershipEdges);
            }

            return Results.Ok(new RoleGraphResponse(nodes, edges));
        });

        group.MapGet("/persons", async (HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var personRoles = await (
                from role in dbContext.Roles.AsNoTracking()
                join membership in dbContext.Memberships.AsNoTracking() on role.Id equals membership.RoleId
                where membership.UserId == userId && role.RoleType == "Person"
                select role
            ).Distinct().ToListAsync(ct);

            if (personRoles.Count == 0)
            {
                return Results.Ok(new List<PersonResponse>());
            }

            var fields = await (
                from field in dbContext.RoleFields.AsNoTracking()
                join role in dbContext.Roles.AsNoTracking() on field.RoleId equals role.Id
                join membership in dbContext.Memberships.AsNoTracking() on role.Id equals membership.RoleId
                where membership.UserId == userId && role.RoleType == "Person"
                select field
            ).ToListAsync(ct);

            RoleKeyRing keyRing;
            try
            {
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            List<KeyEntry> keyEntries;
            if (fields.Count == 0)
            {
                keyEntries = new List<KeyEntry>();
            }
            else
            {
                keyEntries = await (
                    from key in dbContext.Keys.AsNoTracking()
                    join field in dbContext.RoleFields.AsNoTracking() on key.Id equals field.DataKeyId
                    join role in dbContext.Roles.AsNoTracking() on field.RoleId equals role.Id
                    join membership in dbContext.Memberships.AsNoTracking() on role.Id equals membership.RoleId
                    where membership.UserId == userId && role.RoleType == "Person"
                    select key
                ).Distinct().ToListAsync(ct);
            }
            var keyEntryById = keyEntries.ToDictionary(x => x.Id, x => x);

            var fieldsByRole = fields.GroupBy(x => x.RoleId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(field => new PersonFieldResponse(
                        field.FieldType,
                        TryGetPlainValue(field, keyRing, keyEntryById, keyRingService),
                        field.DataKeyId
                    )).ToList()
                );

            var response = personRoles.Select(role => new PersonResponse(
                role.Id,
                role.PublicSigningKey is null ? null : Convert.ToBase64String(role.PublicSigningKey),
                role.PublicSigningKeyAlg,
                fieldsByRole.TryGetValue(role.Id, out var list) ? list : new List<PersonFieldResponse>()
            )).ToList();

            return Results.Ok(response);
        });

        group.MapPost("/persons", async (
            CreatePersonRequest request,
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

            byte[] masterKey;
            try
            {
                masterKey = keyRingService.RequireMasterKey(context, userId, sessionId);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            var fields = request.Fields ?? new List<PersonFieldRequest>();
            if (fields.Count == 0)
            {
                return Results.BadRequest(new { error = "At least one field is required." });
            }

            var normalized = fields.Select(field => field.FieldType.Trim().ToLowerInvariant()).ToList();
            if (normalized.Distinct().Count() != normalized.Count)
            {
                return Results.BadRequest(new { error = "Duplicate field types are not allowed." });
            }

            if (!normalized.Contains("nick"))
            {
                return Results.BadRequest(new { error = "Field 'nick' is required." });
            }

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

            var now = DateTimeOffset.UtcNow;
            var roleId = Guid.NewGuid();
            var roleKey = RandomNumberGenerator.GetBytes(32);
            var encryptedRoleKey = encryptionService.Encrypt(masterKey, roleKey, roleId.ToByteArray());

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
                RoleType = "Person",
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
                MetadataJson = JsonSerializer.Serialize(new { roleType = "Person" }),
                LedgerRefId = roleKeyLedger.Id,
                CreatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            var personFields = new List<RoleField>();
            foreach (var field in fields)
            {
                var fieldType = field.FieldType.Trim().ToLowerInvariant();
                var plainValue = field.PlainValue?.Trim();
                if (string.IsNullOrWhiteSpace(plainValue))
                {
                    return Results.BadRequest(new { error = $"PlainValue required for field '{fieldType}'." });
                }

                var dataKeyId = Guid.NewGuid();
                var dataKey = RandomNumberGenerator.GetBytes(32);
                var encryptedDataKey = keyRingService.EncryptDataKey(roleKey, dataKey, dataKeyId);
                var keyLedger = await ledgerService.AppendKeyAsync(
                    "PersonFieldKeyCreated",
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

                personFields.Add(new RoleField
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    FieldType = fieldType,
                    DataKeyId = dataKeyId,
                    EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType),
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
                dbContext.RoleFields.Add(personFields[^1]);
                await dbContext.SaveChangesAsync(ct);
            }

            var membershipLedger = await ledgerService.AppendKeyAsync(
                "PersonMembershipCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, userId, relationshipType = "PersonOwner", signature = request.SignatureBase64 }),
                ct);

            dbContext.Memberships.Add(new Membership
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RoleId = roleId,
                RelationshipType = "PersonOwner",
                EncryptedRoleKeyCopy = encryptedRoleKey,
                LedgerRefId = membershipLedger.Id,
                CreatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            var plainByField = fields
                .GroupBy(req => req.FieldType.Trim().ToLowerInvariant())
                .ToDictionary(group => group.Key, group => group.First().PlainValue?.Trim());

            var response = new PersonResponse(
                role.Id,
                role.PublicSigningKey is null ? null : Convert.ToBase64String(role.PublicSigningKey),
                role.PublicSigningKeyAlg,
                personFields.Select(field => new PersonFieldResponse(
                    field.FieldType,
                    plainByField.GetValueOrDefault(field.FieldType),
                    field.DataKeyId
                )).ToList()
            );

            return Results.Ok(response);
        });

        group.MapPost("/persons/{roleId:guid}/fields", async (
            Guid roleId,
            UpdatePersonFieldRequest request,
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

            var isMember = await dbContext.Memberships.AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.RoleId == roleId, ct);
            if (!isMember)
            {
                return Results.Forbid();
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
                    "PersonFieldKeyCreated",
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
                "PersonFieldUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, fieldType, signature = request.SignatureBase64 }),
                ct);

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new PersonFieldResponse(
                existing.FieldType,
                plainValue,
                existing.DataKeyId
            ));
        });

        group.MapGet("/persons/{roleId:guid}/access", async (Guid roleId, HttpContext context, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var isMember = await dbContext.Memberships.AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.RoleId == roleId, ct);
            if (!isMember)
            {
                return Results.Forbid();
            }

            var roleEdges = await (
                from edge in dbContext.RoleEdges.AsNoTracking()
                join role in dbContext.Roles.AsNoTracking() on edge.ParentRoleId equals role.Id
                where edge.ChildRoleId == roleId
                select new PersonAccessRoleResponse(edge.ParentRoleId, role.RoleType, edge.RelationshipType)
            ).ToListAsync(ct);

            var response = new PersonAccessResponse(roleId, roleEdges);

            return Results.Ok(response);
        });

        group.MapPost("/persons/{roleId:guid}/shares", async (Guid roleId, AddPersonShareRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IAsymmetricEncryptionService asymmetricEncryptionService, ILedgerService ledgerService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var isMember = await dbContext.Memberships.AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.RoleId == roleId, ct);
            if (!isMember)
            {
                return Results.Forbid();
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
                return Results.BadRequest(new { error = "Role key not available." });
            }

            var encryptedRoleKey = asymmetricEncryptionService.EncryptWithPublicKey(
                targetRole.PublicEncryptionKey,
                targetRole.PublicEncryptionKeyAlg,
                roleKey);

            var ledger = await ledgerService.AppendKeyAsync(
                "PersonRoleSharePending",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, targetRoleId = request.TargetRoleId, relationshipType = request.RelationshipType, signature = request.SignatureBase64 }),
                ct);

            dbContext.PendingRoleShares.Add(new PendingRoleShare
            {
                Id = Guid.NewGuid(),
                SourceRoleId = roleId,
                TargetRoleId = request.TargetRoleId,
                RelationshipType = request.RelationshipType,
                EncryptedRoleKeyBlob = encryptedRoleKey,
                EncryptionAlg = targetRole.PublicEncryptionKeyAlg,
                Status = "Pending",
                LedgerRefId = ledger.Id,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapGet("/shares", async (HttpContext context, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var shares = await (
                from share in dbContext.PendingRoleShares.AsNoTracking()
                join membership in dbContext.Memberships.AsNoTracking() on share.TargetRoleId equals membership.RoleId
                where membership.UserId == userId && share.Status == "Pending"
                select new PendingRoleShareResponse(
                    share.Id,
                    share.SourceRoleId,
                    share.TargetRoleId,
                    share.RelationshipType,
                    share.CreatedUtc
                )
            ).ToListAsync(ct);

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

            var isMember = await dbContext.Memberships.AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.RoleId == share.TargetRoleId, ct);
            if (!isMember)
            {
                return Results.Forbid();
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
                return Results.BadRequest(new { error = "Target role key not available." });
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
                "PersonRoleShareAccepted",
                userId.ToString(),
                JsonSerializer.Serialize(new { shareId, sourceRoleId = share.SourceRoleId, targetRoleId = share.TargetRoleId, signature = request.SignatureBase64 }),
                ct);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapPost("/persons/{roleId:guid}/recovery/shares", async (Guid roleId, RecoveryShareRequest request, HttpContext context, RecreatioDbContext dbContext, ILedgerService ledgerService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var isMember = await dbContext.Memberships.AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.RoleId == roleId, ct);
            if (!isMember)
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

        group.MapPost("/persons/{roleId:guid}/recovery/request", async (Guid roleId, RecoveryRequestCreate request, HttpContext context, RecreatioDbContext dbContext, ILedgerService ledgerService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var isMember = await dbContext.Memberships.AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.RoleId == roleId, ct);
            if (!isMember)
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

        group.MapPost("/persons/{roleId:guid}/recovery/request/{requestId:guid}/approve", async (Guid roleId, Guid requestId, RecoveryApproveRequest request, HttpContext context, RecreatioDbContext dbContext, ILedgerService ledgerService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
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

        group.MapPost("/persons/{roleId:guid}/recovery/request/{requestId:guid}/cancel", async (Guid roleId, Guid requestId, HttpContext context, RecreatioDbContext dbContext, ILedgerService ledgerService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
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

        group.MapPost("/persons/{roleId:guid}/recovery/request/{requestId:guid}/complete", async (Guid roleId, Guid requestId, HttpContext context, RecreatioDbContext dbContext, ILedgerService ledgerService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
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
