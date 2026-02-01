using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Cogita;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cogita;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaEndpoints
{
    private static readonly string[] SupportedInfoTypes =
    {
        "language",
        "word",
        "sentence",
        "topic",
        "collection",
        "person",
        "address",
        "email",
        "phone",
        "book",
        "media",
        "geo",
        "music_piece",
        "music_fragment",
        "computed"
    };

    private static readonly string[] SupportedConnectionTypes =
    {
        "word-language",
        "language-sentence",
        "translation",
        "word-topic"
    };

    private static readonly string[] SupportedGroupTypes = { "vocab" };

    private static readonly string[] SupportedCollectionGraphNodeTypes =
    {
        "source.translation",
        "filter.tag",
        "filter.language",
        "logic.and",
        "logic.or",
        "output.collection"
    };

    public static void MapCogitaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/cogita").RequireAuthorization();

        group.MapGet("/libraries", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleFieldQueryService fieldQueryService,
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

            var roleIds = keyRing.ReadKeys.Keys.ToList();
            var libraries = await dbContext.CogitaLibraries.AsNoTracking()
                .Where(x => roleIds.Contains(x.RoleId))
                .ToListAsync(ct);

            if (libraries.Count == 0)
            {
                return Results.Ok(Array.Empty<CogitaLibraryResponse>());
            }

            var roleFields = await dbContext.RoleFields.AsNoTracking()
                .Where(x => roleIds.Contains(x.RoleId))
                .ToListAsync(ct);
            var lookup = await fieldQueryService.LoadAsync(roleFields, keyRing, ct);
            var valuesByRole = lookup.ValuesByRole;

            var libraryResponses = libraries.Select(library =>
            {
                if (!valuesByRole.TryGetValue(library.RoleId, out var fieldsByType))
                {
                    return null;
                }

                if (!fieldsByType.TryGetValue(RoleFieldTypes.RoleKind, out var roleKind) ||
                    !string.Equals(roleKind, "cogita-library", StringComparison.OrdinalIgnoreCase))
                {
                    return null;
                }

                var name = fieldsByType.TryGetValue(RoleFieldTypes.Nick, out var nick)
                    ? nick
                    : "Cogita Library";
                return new CogitaLibraryResponse(library.Id, library.RoleId, name, library.CreatedUtc);
            }).Where(response => response is not null).Select(response => response!).ToList();

            return Results.Ok(libraryResponses);
        });

        group.MapPost("/libraries", async (
            CogitaLibraryCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            ISessionSecretCache sessionSecretCache,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("CogitaEndpoints");
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
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

            if (!keyRing.TryGetReadKey(account.MasterRoleId, out var parentReadKey) ||
                !keyRing.TryGetWriteKey(account.MasterRoleId, out var parentWriteKey) ||
                !keyRing.TryGetOwnerKey(account.MasterRoleId, out var parentOwnerKey))
            {
                return Results.Forbid();
            }

            var parentRole = await dbContext.Roles.AsNoTracking()
                .FirstOrDefaultAsync(role => role.Id == account.MasterRoleId, ct);
            if (parentRole is null)
            {
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

            var name = string.IsNullOrWhiteSpace(request.Name) ? "Cogita Library" : request.Name.Trim();

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

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(account.MasterRoleId, parentOwnerKey, ct);

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

            var fieldRequests = new List<(string FieldType, string Value)>
            {
                (RoleFieldTypes.Nick, name),
                (RoleFieldTypes.RoleKind, "cogita-library")
            };

            foreach (var field in fieldRequests)
            {
                var dataKeyId = Guid.NewGuid();
                var fieldId = Guid.NewGuid();
                var dataKey = RandomNumberGenerator.GetBytes(32);
                var encryptedDataKey = keyRingService.EncryptDataKey(readKey, dataKey, dataKeyId);
                var encryptedFieldType = keyRingService.EncryptRoleFieldType(readKey, field.FieldType, fieldId);
                var fieldTypeHash = HMACSHA256.HashData(readKey, System.Text.Encoding.UTF8.GetBytes(field.FieldType));
                var keyLedger = await ledgerService.AppendKeyAsync(
                    "RoleFieldKeyCreated",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, fieldType = field.FieldType, dataKeyId, signature = request.SignatureBase64 }),
                    ct,
                    signingContext);

                dbContext.Keys.Add(new KeyEntry
                {
                    Id = dataKeyId,
                    KeyType = KeyType.DataKey,
                    OwnerRoleId = roleId,
                    Version = 1,
                    EncryptedKeyBlob = encryptedDataKey,
                    ScopeType = "role-field",
                    ScopeSubtype = field.FieldType,
                    BoundEntryId = fieldId,
                    LedgerRefId = keyLedger.Id,
                    CreatedUtc = now
                });
                dbContext.KeyEntryBindings.Add(new KeyEntryBinding
                {
                    Id = Guid.NewGuid(),
                    KeyEntryId = dataKeyId,
                    EntryId = fieldId,
                    EntryType = "role-field",
                    EntrySubtype = field.FieldType,
                    CreatedUtc = now
                });
                dbContext.RoleFields.Add(new RoleField
                {
                    Id = fieldId,
                    RoleId = roleId,
                    FieldType = string.Empty,
                    EncryptedFieldType = encryptedFieldType,
                    FieldTypeHash = fieldTypeHash,
                    DataKeyId = dataKeyId,
                    EncryptedValue = keyRingService.EncryptFieldValue(dataKey, field.Value, roleId, field.FieldType),
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
                await dbContext.SaveChangesAsync(ct);
            }

            _ = await ledgerService.AppendKeyAsync(
                "RoleEdgeCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { parentRoleId = account.MasterRoleId, roleId, relationshipType = RoleRelationships.Owner, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            var edgeId = Guid.NewGuid();
            var encryptedRelationshipType = keyRingService.EncryptRoleRelationshipType(parentReadKey, RoleRelationships.Owner, edgeId);
            var relationshipTypeHash = HMACSHA256.HashData(parentReadKey, System.Text.Encoding.UTF8.GetBytes(RoleRelationships.Owner));
            dbContext.RoleEdges.Add(new RoleEdge
            {
                Id = edgeId,
                ParentRoleId = account.MasterRoleId,
                ChildRoleId = roleId,
                RelationshipType = string.Empty,
                EncryptedRelationshipType = encryptedRelationshipType,
                RelationshipTypeHash = relationshipTypeHash,
                EncryptedReadKeyCopy = encryptedReadKeyCopy,
                EncryptedWriteKeyCopy = encryptedWriteKeyCopy,
                EncryptedOwnerKeyCopy = encryptedOwnerKeyCopy,
                CreatedUtc = now
            });

            var library = new CogitaLibrary
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.CogitaLibraries.Add(library);

            await dbContext.SaveChangesAsync(ct);
            await ledgerService.AppendAuthAsync(
                "CogitaLibraryCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new
                {
                    libraryId = library.Id,
                    roleId,
                    publicSigningKeyHash,
                    publicEncryptionKeyHash,
                    role.PublicSigningKeyAlg,
                    role.PublicEncryptionKeyAlg
                }),
                ct,
                signingContext);

            await transaction.CommitAsync(ct);
            EndpointHelpers.InvalidateRoleKeyRing(sessionSecretCache, sessionId);

            return Results.Ok(new CogitaLibraryResponse(library.Id, roleId, name, library.CreatedUtc));
        });

        group.MapGet("/libraries/{libraryId:guid}/stats", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var totalInfos = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId, ct);
            var totalConnections = await dbContext.CogitaConnections.AsNoTracking().CountAsync(x => x.LibraryId == libraryId, ct);
            var totalGroups = 0;
            var totalCollections = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "collection", ct);
            var totalLanguages = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "language", ct);
            var totalWords = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "word", ct);
            var totalSentences = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "sentence", ct);
            var totalTopics = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "topic", ct);

            return Results.Ok(new CogitaLibraryStatsResponse(
                totalInfos,
                totalConnections,
                totalGroups,
                totalCollections,
                totalLanguages,
                totalWords,
                totalSentences,
                totalTopics
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/infos", async (
            Guid libraryId,
            string? type,
            string? query,
            int? limit,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var infoType = string.IsNullOrWhiteSpace(type) ? null : type.Trim().ToLowerInvariant();
            if (infoType is not null && !SupportedInfoTypes.Contains(infoType))
            {
                return Results.BadRequest(new { error = "InfoType is invalid." });
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var loweredQuery = query?.Trim().ToLowerInvariant();
            var pageSize = Math.Clamp(limit ?? 50, 1, 200);
            await EnsureInfoSearchIndexAsync(
                libraryId,
                infoType,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);

            var indexQuery = dbContext.CogitaInfoSearchIndexes.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && (infoType == null || x.InfoType == infoType));

            if (!string.IsNullOrWhiteSpace(loweredQuery))
            {
                if (loweredQuery.Length < 3)
                {
                    indexQuery = indexQuery.Where(x => x.LabelNormalized.StartsWith(loweredQuery));
                }
                else
                {
                    indexQuery = indexQuery.Where(x => x.LabelNormalized.Contains(loweredQuery));
                }
            }

            var responses = await indexQuery
                .OrderBy(x => x.LabelNormalized)
                .Take(pageSize)
                .Select(x => new CogitaInfoSearchResponse(x.InfoId, x.InfoType, x.Label))
                .ToListAsync(ct);

            return Results.Ok(responses);
        });

        group.MapGet("/libraries/{libraryId:guid}/infos/{infoId:guid}", async (
            Guid libraryId,
            Guid infoId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var info = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == infoId && x.LibraryId == libraryId, ct);
            if (info is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                return Results.NotFound();
            }

            var keyEntry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
            if (keyEntry is null)
            {
                return Results.NotFound();
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            JsonElement payloadJson;
            try
            {
                var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, info.Id.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                payloadJson = doc.RootElement.Clone();
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            return Results.Ok(new CogitaInfoDetailResponse(info.Id, info.InfoType, payloadJson));
        });

        group.MapPut("/libraries/{libraryId:guid}/infos/{infoId:guid}", async (
            Guid libraryId,
            Guid infoId,
            CogitaUpdateInfoRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var info = await dbContext.CogitaInfos.FirstOrDefaultAsync(x => x.Id == infoId && x.LibraryId == libraryId, ct);
            if (info is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out _) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            Guid dataKeyId;
            byte[] dataKey;
            if (request.DataKeyId.HasValue)
            {
                try
                {
                    var resolved = await ResolveDataKeyAsync(
                        library.RoleId,
                        request.DataKeyId,
                        info.InfoType,
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct);
                    dataKeyId = resolved.DataKeyId;
                    dataKey = resolved.DataKey;
                }
                catch (InvalidOperationException)
                {
                    return Results.BadRequest(new { error = "DataKeyId is invalid." });
                }
            }
            else
            {
                var payloadRow = await LoadInfoPayloadAsync(info, dbContext, ct);
                if (payloadRow is null)
                {
                    return Results.NotFound();
                }

                dataKeyId = payloadRow.Value.DataKeyId;
                var keyEntry = await dbContext.Keys.FirstOrDefaultAsync(x => x.Id == dataKeyId, ct);
                if (keyEntry is null)
                {
                    return Results.NotFound();
                }

                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                }
                catch (CryptographicException)
                {
                    return Results.Forbid();
                }
            }

            var sanitizedPayload = info.InfoType == "computed" ? SanitizeComputedPayload(request.Payload) : request.Payload;
            var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(sanitizedPayload);
            var encrypted = encryptionService.Encrypt(dataKey, payloadBytes, info.Id.ToByteArray());

            var updated = UpdateInfoPayload(info.InfoType, info.Id, dataKeyId, encrypted, now, dbContext);
            if (!updated)
            {
                return Results.NotFound();
            }

            info.UpdatedUtc = now;
            await UpsertInfoSearchIndexAsync(libraryId, info.Id, info.InfoType, sanitizedPayload, now, dbContext, ct);

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaUpdateInfoResponse(info.Id, info.InfoType));
        });

        group.MapGet("/libraries/{libraryId:guid}/cards", async (
            Guid libraryId,
            string? type,
            string? query,
            Guid? languageAId,
            Guid? languageBId,
            Guid? topicId,
            Guid? levelId,
            int? limit,
            string? cursor,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var cardType = string.IsNullOrWhiteSpace(type) ? "any" : type.Trim().ToLowerInvariant();
            if (cardType != "any" && cardType != "vocab" && !SupportedInfoTypes.Contains(cardType))
            {
                return Results.BadRequest(new { error = "CardType is invalid." });
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var loweredQuery = query?.Trim().ToLowerInvariant();
            var pageSize = Math.Clamp(limit ?? 30, 1, 100);
            DateTimeOffset? cursorCreatedUtc = null;
            Guid? cursorId = null;
            if (!string.IsNullOrWhiteSpace(cursor))
            {
                var parts = cursor.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 2 &&
                    DateTimeOffset.TryParse(parts[0], out var parsedTime) &&
                    Guid.TryParse(parts[1], out var parsedId))
                {
                    cursorCreatedUtc = parsedTime;
                    cursorId = parsedId;
                }
            }

            var responses = new List<CogitaCardSearchResponse>();
            var nextCursor = (string?)null;
            var total = 0;
            var infoTotal = 0;
            var translationTotal = 0;
            const int translationCardMultiplier = 3;

            var includeInfos = cardType != "vocab";
            if (includeInfos)
            {
                var infoFilter = cardType == "any" ? null : cardType;
                var infoQuery = dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && (infoFilter == null || x.InfoType == infoFilter));

                infoTotal = await infoQuery.CountAsync(ct);
                total = infoTotal;

                if (cursorCreatedUtc.HasValue && cursorId.HasValue)
                {
                    infoQuery = infoQuery.Where(x =>
                        x.CreatedUtc < cursorCreatedUtc.Value ||
                        (x.CreatedUtc == cursorCreatedUtc.Value && x.Id.CompareTo(cursorId.Value) < 0));
                }

                var infosPage = await infoQuery
                    .OrderByDescending(x => x.CreatedUtc)
                    .ThenByDescending(x => x.Id)
                    .Take(pageSize)
                    .ToListAsync(ct);

                var lookup = new Dictionary<Guid, (Guid InfoId, string InfoType, Guid DataKeyId, byte[] EncryptedBlob)>();
                foreach (var info in infosPage)
                {
                    var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
                    if (payload is null)
                    {
                        continue;
                    }
                    lookup[info.Id] = (info.Id, info.InfoType, payload.Value.DataKeyId, payload.Value.EncryptedBlob);
                }

                if (infosPage.Count > 0)
                {
                    var last = infosPage[^1];
                    nextCursor = $"{last.CreatedUtc:O}:{last.Id}";
                }

                var dataKeyIds = lookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
                var keyEntryById = await dbContext.Keys.AsNoTracking()
                    .Where(x => dataKeyIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, ct);

                var wordInfoIds = lookup.Values
                    .Where(entry => entry.InfoType == "word")
                    .Select(entry => entry.InfoId)
                    .Distinct()
                    .ToList();
                var wordLanguageMap = new Dictionary<Guid, Guid>();
                if (wordInfoIds.Count > 0)
                {
                    wordLanguageMap = await dbContext.CogitaWordLanguages.AsNoTracking()
                        .Where(x => wordInfoIds.Contains(x.WordInfoId))
                        .GroupBy(x => x.WordInfoId)
                        .ToDictionaryAsync(group => group.Key, group => group.Select(x => x.LanguageInfoId).First(), ct);
                }

                var languageIds = wordLanguageMap.Values.Distinct().ToList();
                var languageLabels = await ResolveInfoLabelsAsync(
                    libraryId,
                    "language",
                    languageIds,
                    readKey,
                    keyRingService,
                    encryptionService,
                    dbContext,
                    ct);

                foreach (var entry in lookup.Values)
                {
                    if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
                    {
                        continue;
                    }

                    byte[] dataKey;
                    try
                    {
                        dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                    }
                    catch (CryptographicException)
                    {
                        continue;
                    }

                    string label;
                    string description;
                    try
                    {
                        var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                        using var doc = JsonDocument.Parse(plain);
                        label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                        description = ResolveDescription(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                        var checkType = entry.InfoType == "word"
                            ? "word-language"
                            : entry.InfoType == "computed"
                                ? "computed"
                                : "info";
                        var direction = entry.InfoType == "word" ? "word-to-language" : null;

                        if (entry.InfoType == "word" && wordLanguageMap.TryGetValue(entry.InfoId, out var languageInfoId))
                        {
                            if (languageLabels.TryGetValue(languageInfoId, out var langLabel) && !string.IsNullOrWhiteSpace(langLabel))
                            {
                                description = $"Language: {langLabel}";
                            }
                        }

                        var matchText = $"{label} {description}".ToLowerInvariant();
                        if (!string.IsNullOrWhiteSpace(loweredQuery) && !matchText.Contains(loweredQuery))
                        {
                            continue;
                        }

                        responses.Add(new CogitaCardSearchResponse(entry.InfoId, "info", label, description, entry.InfoType, checkType, direction));
                        continue;
                    }
                    catch (CryptographicException)
                    {
                        continue;
                    }
                }
            }

            if (cardType == "vocab" || cardType == "any")
            {
                var connectionQuery = dbContext.CogitaConnections.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.ConnectionType == "translation");

                if (cardType == "vocab")
                {
                    translationTotal = await connectionQuery.CountAsync(ct);
                    total = translationTotal * translationCardMultiplier;
                }
                else if (cardType == "any")
                {
                    translationTotal = await connectionQuery.CountAsync(ct);
                    total = infoTotal + translationTotal * translationCardMultiplier;
                }

                if (cardType == "vocab" && cursorCreatedUtc.HasValue && cursorId.HasValue)
                {
                    connectionQuery = connectionQuery.Where(x =>
                        x.CreatedUtc < cursorCreatedUtc.Value ||
                        (x.CreatedUtc == cursorCreatedUtc.Value && x.Id.CompareTo(cursorId.Value) < 0));
                }

                var translations = await connectionQuery
                    .OrderByDescending(x => x.CreatedUtc)
                    .ThenByDescending(x => x.Id)
                    .Take(pageSize)
                    .Select(x => new { x.Id, x.CreatedUtc })
                    .ToListAsync(ct);

                if (translations.Count > 0)
                {
                    if (cardType == "vocab" && translationTotal == 0)
                    {
                        translationTotal = await dbContext.CogitaConnections.AsNoTracking()
                            .CountAsync(x => x.LibraryId == libraryId && x.ConnectionType == "translation", ct);
                        total = translationTotal * translationCardMultiplier;
                    }

                    var items = await dbContext.CogitaConnectionItems.AsNoTracking()
                        .Where(x => translations.Select(t => t.Id).Contains(x.ConnectionId))
                        .OrderBy(x => x.SortOrder)
                        .ToListAsync(ct);

                    var itemsByConnection = items.GroupBy(x => x.ConnectionId)
                        .ToDictionary(group => group.Key, group => group.Select(x => x.InfoId).ToList());

                    var translationWordIds = itemsByConnection.Values.SelectMany(x => x).Distinct().ToList();
                    var wordLabels = await ResolveInfoLabelsAsync(
                        libraryId,
                        "word",
                        translationWordIds,
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);
                    var wordLanguageMap = new Dictionary<Guid, Guid>();
                    if (translationWordIds.Count > 0)
                    {
                        var wordLanguageRows = await dbContext.CogitaWordLanguages.AsNoTracking()
                            .Where(x => translationWordIds.Contains(x.WordInfoId))
                            .ToListAsync(ct);
                        foreach (var row in wordLanguageRows)
                        {
                            if (!wordLanguageMap.ContainsKey(row.WordInfoId))
                            {
                                wordLanguageMap[row.WordInfoId] = row.LanguageInfoId;
                            }
                        }
                    }
                    var translationLanguageIds = wordLanguageMap.Values.Distinct().ToList();
                    var translationLanguageLabels = await ResolveInfoLabelsAsync(
                        libraryId,
                        "language",
                        translationLanguageIds,
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);
                    var connectionTags = new Dictionary<Guid, HashSet<Guid>>();
                    if (topicId.HasValue || levelId.HasValue)
                    {
                        var translationIds = translations.Select(t => t.Id).ToList();
                        var connectionPayloads = await dbContext.CogitaConnections.AsNoTracking()
                            .Where(x => translationIds.Contains(x.Id))
                            .Select(x => new { x.Id, x.DataKeyId, x.EncryptedBlob })
                            .ToListAsync(ct);
                        var keyEntries = await dbContext.Keys.AsNoTracking()
                            .Where(x => connectionPayloads.Select(p => p.DataKeyId).Contains(x.Id))
                            .ToDictionaryAsync(x => x.Id, ct);
                        foreach (var payload in connectionPayloads)
                        {
                            if (!keyEntries.TryGetValue(payload.DataKeyId, out var keyEntry))
                            {
                                continue;
                            }
                            byte[] dataKey;
                            try
                            {
                                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                            }
                            catch (CryptographicException)
                            {
                                continue;
                            }

                            try
                            {
                                var plain = encryptionService.Decrypt(dataKey, payload.EncryptedBlob, payload.Id.ToByteArray());
                                using var doc = JsonDocument.Parse(plain);
                                var tags = new HashSet<Guid>();
                                if (doc.RootElement.TryGetProperty("levelId", out var levelProp) &&
                                    levelProp.ValueKind == JsonValueKind.String &&
                                    Guid.TryParse(levelProp.GetString(), out var levelGuid))
                                {
                                    tags.Add(levelGuid);
                                }
                                if (doc.RootElement.TryGetProperty("topicId", out var topicProp) &&
                                    topicProp.ValueKind == JsonValueKind.String &&
                                    Guid.TryParse(topicProp.GetString(), out var topicGuid))
                                {
                                    tags.Add(topicGuid);
                                }
                                if (doc.RootElement.TryGetProperty("tagIds", out var tagArray) &&
                                    tagArray.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var element in tagArray.EnumerateArray())
                                    {
                                        if (element.ValueKind == JsonValueKind.String &&
                                            Guid.TryParse(element.GetString(), out var tagGuid))
                                        {
                                            tags.Add(tagGuid);
                                        }
                                    }
                                }
                                if (tags.Count > 0)
                                {
                                    connectionTags[payload.Id] = tags;
                                }
                            }
                            catch (CryptographicException)
                            {
                                continue;
                            }
                        }
                    }

                    foreach (var pair in itemsByConnection)
                    {
                        if (pair.Value.Count < 2)
                        {
                            continue;
                        }

                        var wordA = pair.Value[0];
                        var wordB = pair.Value[1];
                        var wordALabel = wordLabels.TryGetValue(wordA, out var w1) ? w1 : "Word";
                        var wordBLabel = wordLabels.TryGetValue(wordB, out var w2) ? w2 : "Word";

                        var langAId = wordLanguageMap.TryGetValue(wordA, out var langA) ? langA : Guid.Empty;
                        var langBId = wordLanguageMap.TryGetValue(wordB, out var langB) ? langB : Guid.Empty;

                        if (languageAId.HasValue && languageBId.HasValue)
                        {
                            var matches = (langAId == languageAId.Value && langBId == languageBId.Value) ||
                                          (langAId == languageBId.Value && langBId == languageAId.Value);
                            if (!matches)
                            {
                                continue;
                            }
                        }

                        if (topicId.HasValue || levelId.HasValue)
                        {
                            if (!connectionTags.TryGetValue(pair.Key, out var tags))
                            {
                                continue;
                            }
                            if (topicId.HasValue && !tags.Contains(topicId.Value))
                            {
                                continue;
                            }
                            if (levelId.HasValue && !tags.Contains(levelId.Value))
                            {
                                continue;
                            }
                        }

                        var langALabel = langAId != Guid.Empty && translationLanguageLabels.TryGetValue(langAId, out var l1)
                            ? l1
                            : "Language";
                        var langBLabel = langBId != Guid.Empty && translationLanguageLabels.TryGetValue(langBId, out var l2)
                            ? l2
                            : "Language";

                        var label = $"{wordALabel} ↔ {wordBLabel}";
                        var description = $"{langALabel} ↔ {langBLabel}";

                        var matchText = $"{label} {description}".ToLowerInvariant();
                        if (!string.IsNullOrWhiteSpace(loweredQuery) && !matchText.Contains(loweredQuery))
                        {
                            continue;
                        }

                        responses.Add(new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation", "a-to-b"));
                        responses.Add(new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation", "b-to-a"));
                        responses.Add(new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation-match", null));
                    }

                    var last = translations[^1];
                    nextCursor = $"{last.CreatedUtc:O}:{last.Id}";
                }
            }

            return Results.Ok(new CogitaCardSearchBundleResponse(total, pageSize, nextCursor, responses));
        });

        group.MapGet("/libraries/{libraryId:guid}/collections", async (
            Guid libraryId,
            string? query,
            int? limit,
            string? cursor,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var pageSize = Math.Clamp(limit ?? 30, 1, 100);
            DateTimeOffset? cursorCreatedUtc = null;
            Guid? cursorId = null;
            if (!string.IsNullOrWhiteSpace(cursor))
            {
                var parts = cursor.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 2 &&
                    DateTimeOffset.TryParse(parts[0], out var parsedTime) &&
                    Guid.TryParse(parts[1], out var parsedId))
                {
                    cursorCreatedUtc = parsedTime;
                    cursorId = parsedId;
                }
            }

            var loweredQuery = query?.Trim().ToLowerInvariant();

            var collectionQuery = dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.InfoType == "collection");

            var total = await collectionQuery.CountAsync(ct);

            if (cursorCreatedUtc.HasValue && cursorId.HasValue)
            {
                collectionQuery = collectionQuery.Where(x =>
                    x.CreatedUtc < cursorCreatedUtc.Value ||
                    (x.CreatedUtc == cursorCreatedUtc.Value && x.Id.CompareTo(cursorId.Value) < 0));
            }

            var infosPage = await collectionQuery
                .OrderByDescending(x => x.CreatedUtc)
                .ThenByDescending(x => x.Id)
                .Take(pageSize)
                .ToListAsync(ct);

            var nextCursor = infosPage.Count > 0
                ? $"{infosPage[^1].CreatedUtc:O}:{infosPage[^1].Id}"
                : null;

            var collectionIds = infosPage.Select(x => x.Id).ToList();
            var itemCounts = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => collectionIds.Contains(x.CollectionInfoId))
                .GroupBy(x => x.CollectionInfoId)
                .Select(group => new { group.Key, Count = group.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

            var collectionGraphs = await dbContext.CogitaCollectionGraphs.AsNoTracking()
                .Where(x => collectionIds.Contains(x.CollectionInfoId))
                .ToListAsync(ct);
            foreach (var graph in collectionGraphs)
            {
                try
                {
                    var nodes = await dbContext.CogitaCollectionGraphNodes.AsNoTracking()
                        .Where(x => x.GraphId == graph.Id)
                        .ToListAsync(ct);
                    var edges = await dbContext.CogitaCollectionGraphEdges.AsNoTracking()
                        .Where(x => x.GraphId == graph.Id)
                        .ToListAsync(ct);
                    var graphResult = await EvaluateCollectionGraphAsync(
                        libraryId,
                        graph,
                        nodes,
                        edges,
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);
                    itemCounts[graph.CollectionInfoId] = graphResult.Total;
                }
                catch (Exception)
                {
                    // Keep list rendering even if a graph evaluation fails.
                    continue;
                }
            }

            var lookup = new Dictionary<Guid, (Guid InfoId, string InfoType, Guid DataKeyId, byte[] EncryptedBlob)>();
            foreach (var info in infosPage)
            {
                var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
                if (payload is null)
                {
                    continue;
                }
                lookup[info.Id] = (info.Id, info.InfoType, payload.Value.DataKeyId, payload.Value.EncryptedBlob);
            }

            var dataKeyIds = lookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
            var keyEntryById = await dbContext.Keys.AsNoTracking()
                .Where(x => dataKeyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

            var responses = new List<CogitaCollectionSummaryResponse>();
            foreach (var info in infosPage)
            {
                if (!lookup.TryGetValue(info.Id, out var entry))
                {
                    continue;
                }

                if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
                {
                    continue;
                }

                byte[] dataKey;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                }
                catch (CryptographicException)
                {
                    continue;
                }

                string label;
                string description;
                try
                {
                    var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                    description = ResolveDescription(doc.RootElement, entry.InfoType) ?? string.Empty;
                }
                catch (CryptographicException)
                {
                    continue;
                }

                var matchText = $"{label} {description}".ToLowerInvariant();
                if (!string.IsNullOrWhiteSpace(loweredQuery) && !matchText.Contains(loweredQuery))
                {
                    continue;
                }

                responses.Add(new CogitaCollectionSummaryResponse(
                    info.Id,
                    label,
                    string.IsNullOrWhiteSpace(description) ? null : description,
                    itemCounts.TryGetValue(info.Id, out var count) ? count : 0,
                    info.CreatedUtc
                ));
            }

            return Results.Ok(new CogitaCollectionBundleResponse(total, pageSize, nextCursor, responses));
        });

        group.MapPost("/libraries/{libraryId:guid}/collections", async (
            Guid libraryId,
            CogitaCreateCollectionRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var name = request.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Collection name is required." });
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out _) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var items = request.Items ?? new List<CogitaCollectionItemRequest>();
            var infoItemIds = new List<Guid>();
            var connectionItemIds = new List<Guid>();
            var normalizedItems = new List<(string ItemType, Guid ItemId)>();
            var seen = new HashSet<(string, Guid)>();
            foreach (var item in items)
            {
                var itemType = item.ItemType.Trim().ToLowerInvariant();
                if (itemType != "info" && itemType != "connection")
                {
                    return Results.BadRequest(new { error = "Collection item type is invalid." });
                }

                if (!seen.Add((itemType, item.ItemId)))
                {
                    continue;
                }

                normalizedItems.Add((itemType, item.ItemId));
                if (itemType == "info")
                {
                    infoItemIds.Add(item.ItemId);
                }
                else
                {
                    connectionItemIds.Add(item.ItemId);
                }
            }

            if (infoItemIds.Count > 0)
            {
                var infoCount = await dbContext.CogitaInfos.AsNoTracking()
                    .CountAsync(x => x.LibraryId == libraryId && infoItemIds.Contains(x.Id), ct);
                if (infoCount != infoItemIds.Count)
                {
                    return Results.BadRequest(new { error = "Collection info items must belong to the library." });
                }
            }

            if (connectionItemIds.Count > 0)
            {
                var connectionCount = await dbContext.CogitaConnections.AsNoTracking()
                    .CountAsync(x => x.LibraryId == libraryId && connectionItemIds.Contains(x.Id), ct);
                if (connectionCount != connectionItemIds.Count)
                {
                    return Results.BadRequest(new { error = "Collection connection items must belong to the library." });
                }
            }

            var payload = JsonSerializer.SerializeToElement(new
            {
                label = name,
                notes = request.Notes ?? string.Empty
            });

            var infoResponse = await CreateInfoInternalAsync(
                library,
                new CogitaCreateInfoRequest("collection", payload, request.DataKeyId, request.SignatureBase64),
                readKey,
                ownerKey,
                userId,
                keyRingService,
                encryptionService,
                roleCryptoService,
                ledgerService,
                dbContext,
                ct);

            var now = DateTimeOffset.UtcNow;
            var sortOrder = 0;
            foreach (var (itemType, itemId) in normalizedItems)
            {
                dbContext.CogitaCollectionItems.Add(new CogitaCollectionItem
                {
                    Id = Guid.NewGuid(),
                    CollectionInfoId = infoResponse.InfoId,
                    ItemType = itemType,
                    ItemId = itemId,
                    SortOrder = sortOrder++,
                    CreatedUtc = now
                });
            }

            if (request.Graph is not null)
            {
                (Guid DataKeyId, byte[] DataKey) graphKeyResult;
                try
                {
                    graphKeyResult = await ResolveDataKeyAsync(
                        library.RoleId,
                        request.Graph.DataKeyId,
                        "collection-graph",
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct);
                }
                catch (InvalidOperationException)
                {
                    return Results.BadRequest(new { error = "Graph DataKeyId is invalid." });
                }

                var graph = new CogitaCollectionGraph
                {
                    Id = Guid.NewGuid(),
                    CollectionInfoId = infoResponse.InfoId,
                    DataKeyId = graphKeyResult.DataKeyId,
                    EncryptedBlob = Array.Empty<byte>(),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaCollectionGraphs.Add(graph);
                await dbContext.SaveChangesAsync(ct);
                graph.EncryptedBlob = encryptionService.Encrypt(
                    graphKeyResult.DataKey,
                    JsonSerializer.SerializeToUtf8Bytes(new { version = 1 }),
                    graph.Id.ToByteArray());

                foreach (var node in request.Graph.Nodes ?? new List<CogitaCollectionGraphNodeRequest>())
                {
                    var nodeId = node.NodeId ?? Guid.NewGuid();
                    var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(node.Payload);
                    var encrypted = encryptionService.Encrypt(graphKeyResult.DataKey, payloadBytes, nodeId.ToByteArray());
                    dbContext.CogitaCollectionGraphNodes.Add(new CogitaCollectionGraphNode
                    {
                        Id = nodeId,
                        GraphId = graph.Id,
                        NodeType = node.NodeType.Trim(),
                        DataKeyId = graphKeyResult.DataKeyId,
                        EncryptedBlob = encrypted,
                        CreatedUtc = now,
                        UpdatedUtc = now
                    });
                }

                foreach (var edge in request.Graph.Edges ?? new List<CogitaCollectionGraphEdgeRequest>())
                {
                    var edgeId = edge.EdgeId ?? Guid.NewGuid();
                    dbContext.CogitaCollectionGraphEdges.Add(new CogitaCollectionGraphEdge
                    {
                        Id = edgeId,
                        GraphId = graph.Id,
                        FromNodeId = edge.FromNodeId,
                        FromPort = edge.FromPort,
                        ToNodeId = edge.ToNodeId,
                        ToPort = edge.ToPort,
                        CreatedUtc = now
                    });
                }
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCreateCollectionResponse(infoResponse.InfoId));
        });

        group.MapGet("/libraries/{libraryId:guid}/collections/{collectionId:guid}", async (
            Guid libraryId,
            Guid collectionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var info = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (info is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                return Results.NotFound();
            }

            var keyEntry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
            if (keyEntry is null)
            {
                return Results.NotFound();
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            string label;
            string description;
            try
            {
                var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, info.Id.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                label = ResolveLabel(doc.RootElement, info.InfoType) ?? info.InfoType;
                description = ResolveDescription(doc.RootElement, info.InfoType) ?? string.Empty;
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaCollectionGraphs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CollectionInfoId == info.Id, ct);
            var itemCount = 0;
            if (graph is not null)
            {
                var nodes = await dbContext.CogitaCollectionGraphNodes.AsNoTracking()
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                var edges = await dbContext.CogitaCollectionGraphEdges.AsNoTracking()
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                var graphResult = await EvaluateCollectionGraphAsync(
                    libraryId,
                    graph,
                    nodes,
                    edges,
                    readKey,
                    keyRingService,
                    encryptionService,
                    dbContext,
                    ct);
                itemCount = graphResult.Total;
            }
            else
            {
                itemCount = await dbContext.CogitaCollectionItems.AsNoTracking()
                    .CountAsync(x => x.CollectionInfoId == info.Id, ct);
            }

            return Results.Ok(new CogitaCollectionDetailResponse(
                info.Id,
                label,
                string.IsNullOrWhiteSpace(description) ? null : description,
                itemCount,
                info.CreatedUtc
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/collections/{collectionId:guid}/dependencies", async (
            Guid libraryId,
            Guid collectionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out _) ||
                !EndpointHelpers.TryGetSessionId(context, out _))
            {
                return Results.Unauthorized();
            }

            var collectionExists = await dbContext.CogitaInfos.AsNoTracking()
                .AnyAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (!collectionExists)
            {
                return Results.NotFound();
            }

            var parentDeps = await dbContext.CogitaCollectionDependencies.AsNoTracking()
                .Where(x => x.ChildCollectionInfoId == collectionId)
                .ToListAsync(ct);
            var childDeps = await dbContext.CogitaCollectionDependencies.AsNoTracking()
                .Where(x => x.ParentCollectionInfoId == collectionId)
                .ToListAsync(ct);

            var parentIds = parentDeps.Select(x => x.ParentCollectionInfoId).ToHashSet();
            var childIds = childDeps.Select(x => x.ChildCollectionInfoId).ToHashSet();

            var validCollections = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.InfoType == "collection" &&
                            (parentIds.Contains(x.Id) || childIds.Contains(x.Id)))
                .Select(x => x.Id)
                .ToListAsync(ct);
            var validSet = validCollections.ToHashSet();

            var parents = parentDeps
                .Where(x => validSet.Contains(x.ParentCollectionInfoId))
                .Select(x => new CogitaCollectionDependencyResponse(x.ParentCollectionInfoId, x.ChildCollectionInfoId))
                .ToList();
            var children = childDeps
                .Where(x => validSet.Contains(x.ChildCollectionInfoId))
                .Select(x => new CogitaCollectionDependencyResponse(x.ParentCollectionInfoId, x.ChildCollectionInfoId))
                .ToList();

            return Results.Ok(new CogitaCollectionDependencyBundleResponse(parents, children));
        });

        group.MapPost("/libraries/{libraryId:guid}/collections/{collectionId:guid}/dependencies", async (
            Guid libraryId,
            Guid collectionId,
            CogitaCollectionDependencyRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out _) ||
                !EndpointHelpers.TryGetSessionId(context, out _))
            {
                return Results.Unauthorized();
            }

            if (request.ParentCollectionId == Guid.Empty || request.ChildCollectionId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "ParentCollectionId and ChildCollectionId are required." });
            }

            if (request.ParentCollectionId != collectionId && request.ChildCollectionId != collectionId)
            {
                return Results.BadRequest(new { error = "CollectionId must match parent or child." });
            }

            var collectionIds = new[] { request.ParentCollectionId, request.ChildCollectionId };
            var collections = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.InfoType == "collection" && collectionIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (collections.Count != 2)
            {
                return Results.BadRequest(new { error = "Both collections must belong to the library." });
            }

            var exists = await dbContext.CogitaCollectionDependencies.AsNoTracking()
                .AnyAsync(x => x.ParentCollectionInfoId == request.ParentCollectionId && x.ChildCollectionInfoId == request.ChildCollectionId, ct);
            if (exists)
            {
                return Results.Ok(new CogitaCollectionDependencyResponse(request.ParentCollectionId, request.ChildCollectionId));
            }

            dbContext.CogitaCollectionDependencies.Add(new CogitaCollectionDependency
            {
                Id = Guid.NewGuid(),
                ParentCollectionInfoId = request.ParentCollectionId,
                ChildCollectionInfoId = request.ChildCollectionId,
                CreatedUtc = DateTimeOffset.UtcNow
            });
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCollectionDependencyResponse(request.ParentCollectionId, request.ChildCollectionId));
        });

        group.MapGet("/libraries/{libraryId:guid}/reviewers", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleFieldQueryService fieldQueryService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            var reviewerRoleIds = keyRing.WriteKeys.Keys.ToHashSet();
            if (reviewerRoleIds.Count == 0)
            {
                return Results.Ok(new List<CogitaReviewerResponse>());
            }

            var fields = await dbContext.RoleFields.AsNoTracking()
                .Where(field => reviewerRoleIds.Contains(field.RoleId))
                .ToListAsync(ct);
            var lookup = await fieldQueryService.LoadAsync(fields, keyRing, ct);

            var responses = reviewerRoleIds
                .Select(roleId =>
                {
                    var label = lookup.ValuesByRole.TryGetValue(roleId, out var values) &&
                                values.TryGetValue(RoleFieldTypes.Nick, out var nick)
                        ? nick
                        : $"Role {roleId:N}";
                    return new CogitaReviewerResponse(roleId, label);
                })
                .OrderBy(x => x.Label)
                .ToList();

            return Results.Ok(responses);
        });

        group.MapPost("/libraries/{libraryId:guid}/reviews", async (
            Guid libraryId,
            CogitaReviewEventRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
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

            var personRoleId = request.PersonRoleId ?? account.MasterRoleId;
            if (!keyRing.WriteKeys.ContainsKey(personRoleId))
            {
                return Results.Forbid();
            }
            if (!keyRing.TryGetReadKey(personRoleId, out var personReadKey))
            {
                return Results.Forbid();
            }
            var hasOwnerKey = keyRing.TryGetOwnerKey(personRoleId, out var personOwnerKey);
            if (!hasOwnerKey)
            {
                personOwnerKey = Array.Empty<byte>();
            }

            var itemType = request.ItemType.Trim().ToLowerInvariant();
            if (itemType != "info" && itemType != "connection")
            {
                return Results.BadRequest(new { error = "ItemType must be info or connection." });
            }

            var itemExists = itemType == "info"
                ? await dbContext.CogitaInfos.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == request.ItemId, ct)
                : await dbContext.CogitaConnections.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == request.ItemId, ct);

            if (!itemExists)
            {
                return Results.BadRequest(new { error = "Item does not belong to the library." });
            }

            byte[] payloadBytes;
            try
            {
                payloadBytes = Convert.FromBase64String(request.PayloadBase64);
            }
            catch (FormatException)
            {
                return Results.BadRequest(new { error = "PayloadBase64 is invalid." });
            }

            var existingKey = await dbContext.Keys.AsNoTracking()
                .Where(x => x.OwnerRoleId == personRoleId && x.KeyType == KeyType.DataKey && x.ScopeType == "cogita" && x.ScopeSubtype == "review-event")
                .OrderByDescending(x => x.CreatedUtc)
                .FirstOrDefaultAsync(ct);

            Guid dataKeyId;
            byte[] dataKey;
            if (existingKey is not null)
            {
                dataKeyId = existingKey.Id;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(existingKey, personReadKey);
                }
                catch (CryptographicException)
                {
                    return Results.Forbid();
                }
            }
            else
            {
                if (!hasOwnerKey)
                {
                    return Results.Forbid();
                }
                var keyResult = await ResolveDataKeyAsync(
                    personRoleId,
                    null,
                    "review-event",
                    personReadKey,
                    personOwnerKey,
                    userId,
                    keyRingService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
                dataKeyId = keyResult.DataKeyId;
                dataKey = keyResult.DataKey;
            }

            var reviewId = Guid.NewGuid();
            var encrypted = encryptionService.Encrypt(dataKey, payloadBytes, reviewId.ToByteArray());

            dbContext.CogitaReviewEvents.Add(new CogitaReviewEvent
            {
                Id = reviewId,
                LibraryId = libraryId,
                PersonRoleId = personRoleId,
                ItemType = itemType,
                ItemId = request.ItemId,
                Direction = string.IsNullOrWhiteSpace(request.Direction) ? null : request.Direction,
                DataKeyId = dataKeyId,
                EncryptedBlob = encrypted,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            dbContext.KeyEntryBindings.Add(new KeyEntryBinding
            {
                Id = Guid.NewGuid(),
                KeyEntryId = dataKeyId,
                EntryId = reviewId,
                EntryType = "cogita-review",
                EntrySubtype = itemType,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaReviewEventResponse(reviewId, DateTimeOffset.UtcNow));
        });

        group.MapGet("/libraries/{libraryId:guid}/reviews/{itemType}/{itemId:guid}/summary", async (
            Guid libraryId,
            string itemType,
            Guid itemId,
            string? checkType,
            string? direction,
            Guid? personRoleId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var normalizedType = itemType.Trim().ToLowerInvariant();
            if (normalizedType != "info" && normalizedType != "connection")
            {
                return Results.BadRequest(new { error = "ItemType must be info or connection." });
            }

            var itemExists = normalizedType == "info"
                ? await dbContext.CogitaInfos.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == itemId, ct)
                : await dbContext.CogitaConnections.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == itemId, ct);

            if (!itemExists)
            {
                return Results.BadRequest(new { error = "Item does not belong to the library." });
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
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

            var reviewerRoleId = personRoleId ?? account.MasterRoleId;
            if (!keyRing.WriteKeys.ContainsKey(reviewerRoleId))
            {
                return Results.Forbid();
            }
            if (!keyRing.TryGetReadKey(reviewerRoleId, out var personReadKey))
            {
                return Results.Forbid();
            }

            var normalizedCheckType = string.IsNullOrWhiteSpace(checkType) ? null : checkType.Trim().ToLowerInvariant();
            var normalizedDirection = string.IsNullOrWhiteSpace(direction) ? null : direction.Trim().ToLowerInvariant();

            var outcomesQuery = dbContext.CogitaReviewOutcomes.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.PersonRoleId == reviewerRoleId &&
                            x.ItemType == normalizedType && x.ItemId == itemId);
            if (!string.IsNullOrWhiteSpace(normalizedCheckType))
            {
                outcomesQuery = outcomesQuery.Where(x => x.CheckType == normalizedCheckType);
            }
            if (!string.IsNullOrWhiteSpace(normalizedDirection))
            {
                outcomesQuery = outcomesQuery.Where(x => x.Direction == normalizedDirection);
            }

            var outcomes = await outcomesQuery
                .OrderByDescending(x => x.CreatedUtc)
                .Take(50)
                .ToListAsync(ct);

            if (outcomes.Count == 0)
            {
                return Results.Ok(new CogitaReviewSummaryResponse(normalizedType, itemId, 0, 0, null, 0));
            }

            var total = outcomes.Count;
            var correct = outcomes.Count(x => x.Correct);
            var lastReviewed = outcomes.Max(x => x.CreatedUtc);
            var daysSince = (DateTimeOffset.UtcNow - lastReviewed).TotalDays;
            var recencyWeight = Math.Exp(-daysSince / 30.0);
            var accuracy = total == 0 ? 0 : (double)correct / total;
            var score = Math.Round(accuracy * 100 * recencyWeight, 2);

            return Results.Ok(new CogitaReviewSummaryResponse(
                normalizedType,
                itemId,
                total,
                correct,
                lastReviewed,
                score
            ));
        });

        group.MapPost("/libraries/{libraryId:guid}/review-outcomes", async (
            Guid libraryId,
            CogitaReviewOutcomeRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
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

            var reviewerRoleId = request.PersonRoleId ?? account.MasterRoleId;
            if (!keyRing.WriteKeys.ContainsKey(reviewerRoleId))
            {
                return Results.Forbid();
            }
            if (!keyRing.TryGetReadKey(reviewerRoleId, out var personReadKey))
            {
                return Results.Forbid();
            }
            var hasOwnerKey = keyRing.TryGetOwnerKey(reviewerRoleId, out var personOwnerKey);
            if (!hasOwnerKey)
            {
                personOwnerKey = Array.Empty<byte>();
            }

            var itemType = request.ItemType.Trim().ToLowerInvariant();
            if (itemType != "info" && itemType != "connection")
            {
                return Results.BadRequest(new { error = "ItemType must be info or connection." });
            }

            var itemExists = itemType == "info"
                ? await dbContext.CogitaInfos.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == request.ItemId, ct)
                : await dbContext.CogitaConnections.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == request.ItemId, ct);

            if (!itemExists)
            {
                return Results.BadRequest(new { error = "Item does not belong to the library." });
            }

            byte[] payloadBytes;
            if (!string.IsNullOrWhiteSpace(request.PayloadBase64))
            {
                try
                {
                    payloadBytes = Convert.FromBase64String(request.PayloadBase64);
                }
                catch (FormatException)
                {
                    return Results.BadRequest(new { error = "PayloadBase64 is invalid." });
                }
            }
            else
            {
                payloadBytes = JsonSerializer.SerializeToUtf8Bytes(new
                {
                    request.RevisionType,
                    request.EvalType,
                    request.Correct,
                    request.MaskBase64,
                    request.PayloadHashBase64
                });
            }

            byte[]? payloadHash = null;
            if (!string.IsNullOrWhiteSpace(request.PayloadHashBase64))
            {
                try
                {
                    payloadHash = Convert.FromBase64String(request.PayloadHashBase64);
                }
                catch (FormatException)
                {
                    return Results.BadRequest(new { error = "PayloadHashBase64 is invalid." });
                }
            }

            var existingKey = await dbContext.Keys.AsNoTracking()
                .Where(x => x.OwnerRoleId == reviewerRoleId && x.KeyType == KeyType.DataKey && x.ScopeType == "cogita" && x.ScopeSubtype == "review-outcome")
                .OrderByDescending(x => x.CreatedUtc)
                .FirstOrDefaultAsync(ct);

            Guid dataKeyId;
            byte[] dataKey;
            if (existingKey is not null)
            {
                dataKeyId = existingKey.Id;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(existingKey, personReadKey);
                }
                catch (CryptographicException)
                {
                    return Results.Forbid();
                }
            }
            else
            {
                if (!hasOwnerKey)
                {
                    return Results.Forbid();
                }
                var keyResult = await ResolveDataKeyAsync(
                    reviewerRoleId,
                    null,
                    "review-outcome",
                    personReadKey,
                    personOwnerKey,
                    userId,
                    keyRingService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
                dataKeyId = keyResult.DataKeyId;
                dataKey = keyResult.DataKey;
            }

            var outcomeId = Guid.NewGuid();
            var encrypted = encryptionService.Encrypt(dataKey, payloadBytes, outcomeId.ToByteArray());

            dbContext.CogitaReviewOutcomes.Add(new CogitaReviewOutcome
            {
                Id = outcomeId,
                LibraryId = libraryId,
                PersonRoleId = reviewerRoleId,
                ItemType = itemType,
                ItemId = request.ItemId,
                CheckType = request.CheckType?.Trim().ToLowerInvariant() ?? string.Empty,
                Direction = string.IsNullOrWhiteSpace(request.Direction) ? null : request.Direction.Trim().ToLowerInvariant(),
                RevisionType = request.RevisionType?.Trim() ?? string.Empty,
                EvalType = request.EvalType?.Trim() ?? string.Empty,
                Correct = request.Correct,
                ClientId = request.ClientId?.Trim() ?? string.Empty,
                ClientSequence = request.ClientSequence,
                PayloadHash = payloadHash,
                DataKeyId = dataKeyId,
                EncryptedBlob = encrypted,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            dbContext.KeyEntryBindings.Add(new KeyEntryBinding
            {
                Id = Guid.NewGuid(),
                KeyEntryId = dataKeyId,
                EntryId = outcomeId,
                EntryType = "cogita-review-outcome",
                EntrySubtype = request.RevisionType ?? string.Empty,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaReviewOutcomeResponse(outcomeId, DateTimeOffset.UtcNow));
        });

        group.MapPost("/libraries/{libraryId:guid}/review-outcomes/bulk", async (
            Guid libraryId,
            CogitaReviewOutcomeBulkRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (request.Outcomes is null || request.Outcomes.Count == 0)
            {
                return Results.BadRequest(new { error = "Outcomes list is empty." });
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            var reviewerRoleId = request.Outcomes.FirstOrDefault(x => x.PersonRoleId.HasValue)?.PersonRoleId ?? account.MasterRoleId;
            if (request.Outcomes.Any(x => x.PersonRoleId.HasValue && x.PersonRoleId != reviewerRoleId))
            {
                return Results.BadRequest(new { error = "Mixed PersonRoleId values are not supported in bulk." });
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

            if (!keyRing.WriteKeys.ContainsKey(reviewerRoleId))
            {
                return Results.Forbid();
            }
            if (!keyRing.TryGetReadKey(reviewerRoleId, out var personReadKey))
            {
                return Results.Forbid();
            }
            var hasOwnerKey = keyRing.TryGetOwnerKey(reviewerRoleId, out var personOwnerKey);
            if (!hasOwnerKey)
            {
                personOwnerKey = Array.Empty<byte>();
            }

            var invalidType = request.Outcomes.FirstOrDefault(x => x.ItemType.Trim().ToLowerInvariant() is not ("info" or "connection"));
            if (invalidType is not null)
            {
                return Results.BadRequest(new { error = "ItemType must be info or connection." });
            }

            var infoIds = request.Outcomes
                .Where(x => x.ItemType.Trim().ToLowerInvariant() == "info")
                .Select(x => x.ItemId)
                .Distinct()
                .ToList();
            var connectionIds = request.Outcomes
                .Where(x => x.ItemType.Trim().ToLowerInvariant() == "connection")
                .Select(x => x.ItemId)
                .Distinct()
                .ToList();

            if (infoIds.Count > 0)
            {
                var existingInfos = await dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && infoIds.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                if (existingInfos.Count != infoIds.Count)
                {
                    return Results.BadRequest(new { error = "One or more info items do not belong to the library." });
                }
            }
            if (connectionIds.Count > 0)
            {
                var existingConnections = await dbContext.CogitaConnections.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && connectionIds.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                if (existingConnections.Count != connectionIds.Count)
                {
                    return Results.BadRequest(new { error = "One or more connection items do not belong to the library." });
                }
            }

            var clientIds = request.Outcomes
                .Select(x => x.ClientId.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();
            var sequences = request.Outcomes.Select(x => x.ClientSequence).ToList();
            var existing = await dbContext.CogitaReviewOutcomes.AsNoTracking()
                .Where(x => x.PersonRoleId == reviewerRoleId && clientIds.Contains(x.ClientId) && sequences.Contains(x.ClientSequence))
                .Select(x => new { x.ClientId, x.ClientSequence })
                .ToListAsync(ct);
            var existingSet = existing
                .Select(x => $"{x.ClientId}:{x.ClientSequence}")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var existingKey = await dbContext.Keys.AsNoTracking()
                .Where(x => x.OwnerRoleId == reviewerRoleId && x.KeyType == KeyType.DataKey && x.ScopeType == "cogita" && x.ScopeSubtype == "review-outcome")
                .OrderByDescending(x => x.CreatedUtc)
                .FirstOrDefaultAsync(ct);

            Guid dataKeyId;
            byte[] dataKey;
            if (existingKey is not null)
            {
                dataKeyId = existingKey.Id;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(existingKey, personReadKey);
                }
                catch (CryptographicException)
                {
                    return Results.Forbid();
                }
            }
            else
            {
                if (!hasOwnerKey)
                {
                    return Results.Forbid();
                }
                var keyResult = await ResolveDataKeyAsync(
                    reviewerRoleId,
                    null,
                    "review-outcome",
                    personReadKey,
                    personOwnerKey,
                    userId,
                    keyRingService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
                dataKeyId = keyResult.DataKeyId;
                dataKey = keyResult.DataKey;
            }

            var stored = 0;
            var batchSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var outcome in request.Outcomes)
            {
                var clientKey = $"{outcome.ClientId.Trim()}:{outcome.ClientSequence}";
                if (existingSet.Contains(clientKey) || !batchSet.Add(clientKey))
                {
                    continue;
                }

                byte[] payloadBytes;
                if (!string.IsNullOrWhiteSpace(outcome.PayloadBase64))
                {
                    try
                    {
                        payloadBytes = Convert.FromBase64String(outcome.PayloadBase64);
                    }
                    catch (FormatException)
                    {
                        return Results.BadRequest(new { error = "PayloadBase64 is invalid." });
                    }
                }
                else
                {
                    payloadBytes = JsonSerializer.SerializeToUtf8Bytes(new
                    {
                        outcome.RevisionType,
                        outcome.EvalType,
                        outcome.Correct,
                        outcome.MaskBase64,
                        outcome.PayloadHashBase64
                    });
                }

                byte[]? payloadHash = null;
                if (!string.IsNullOrWhiteSpace(outcome.PayloadHashBase64))
                {
                    try
                    {
                        payloadHash = Convert.FromBase64String(outcome.PayloadHashBase64);
                    }
                    catch (FormatException)
                    {
                        return Results.BadRequest(new { error = "PayloadHashBase64 is invalid." });
                    }
                }

                var outcomeId = Guid.NewGuid();
                var encrypted = encryptionService.Encrypt(dataKey, payloadBytes, outcomeId.ToByteArray());
                var normalizedType = outcome.ItemType.Trim().ToLowerInvariant();

                dbContext.CogitaReviewOutcomes.Add(new CogitaReviewOutcome
                {
                    Id = outcomeId,
                    LibraryId = libraryId,
                    PersonRoleId = reviewerRoleId,
                    ItemType = normalizedType,
                    ItemId = outcome.ItemId,
                    CheckType = outcome.CheckType?.Trim().ToLowerInvariant() ?? string.Empty,
                    Direction = string.IsNullOrWhiteSpace(outcome.Direction) ? null : outcome.Direction.Trim().ToLowerInvariant(),
                    RevisionType = outcome.RevisionType?.Trim() ?? string.Empty,
                    EvalType = outcome.EvalType?.Trim() ?? string.Empty,
                    Correct = outcome.Correct,
                    ClientId = outcome.ClientId.Trim(),
                    ClientSequence = outcome.ClientSequence,
                    PayloadHash = payloadHash,
                    DataKeyId = dataKeyId,
                    EncryptedBlob = encrypted,
                    CreatedUtc = DateTimeOffset.UtcNow
                });

                dbContext.KeyEntryBindings.Add(new KeyEntryBinding
                {
                    Id = Guid.NewGuid(),
                    KeyEntryId = dataKeyId,
                    EntryId = outcomeId,
                    EntryType = "cogita-review-outcome",
                    EntrySubtype = outcome.RevisionType ?? string.Empty,
                    CreatedUtc = DateTimeOffset.UtcNow
                });

                stored += 1;
            }

            if (stored > 0)
            {
                await dbContext.SaveChangesAsync(ct);
            }

            return Results.Ok(new { stored });
        });

        group.MapGet("/libraries/{libraryId:guid}/computed/{infoId:guid}/sample", async (
            Guid libraryId,
            Guid infoId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var info = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == infoId && x.LibraryId == libraryId && x.InfoType == "computed", ct);
            if (info is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                return Results.NotFound();
            }

            var keyEntry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
            if (keyEntry is null)
            {
                return Results.NotFound();
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            try
            {
                var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, info.Id.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                var sample = BuildComputedSample(doc.RootElement);
                return Results.Ok(sample);
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }
        });

        group.MapPost("/libraries/{libraryId:guid}/revision-shares", async (
            Guid libraryId,
            CogitaRevisionShareCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IMasterKeyService masterKeyService,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var collectionId = request.CollectionId;
            if (collectionId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "CollectionId is invalid." });
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (collectionInfo is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var libraryReadKey))
            {
                return Results.Forbid();
            }

            if (!keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var mode = string.IsNullOrWhiteSpace(request.Mode) ? "random" : request.Mode.Trim().ToLowerInvariant();

            var checkMode = string.IsNullOrWhiteSpace(request.Check) ? "exact" : request.Check.Trim().ToLowerInvariant();
            if (checkMode != "exact" && checkMode != "lenient")
            {
                return Results.BadRequest(new { error = "Check mode is invalid." });
            }

            var limit = Math.Clamp(request.Limit, 1, 200);
            var revisionType = string.IsNullOrWhiteSpace(request.RevisionType)
                ? null
                : request.RevisionType.Trim().ToLowerInvariant();
            string? revisionSettingsJson = null;
            if (request.RevisionSettings.HasValue)
            {
                revisionSettingsJson = request.RevisionSettings.Value.GetRawText();
            }

            var sharedViewId = Guid.NewGuid();
            var viewRoleId = Guid.NewGuid();
            var viewRoleReadKey = RandomNumberGenerator.GetBytes(32);
            string shareCode;
            byte[] shareCodeBytes;
            byte[] secretHash;
            var attempts = 0;
            while (true)
            {
                shareCode = GenerateNumericShareCode(18);
                shareCodeBytes = System.Text.Encoding.UTF8.GetBytes(shareCode);
                secretHash = hashingService.Hash(shareCodeBytes);
                var exists = await dbContext.CogitaRevisionShares.AsNoTracking()
                    .AnyAsync(x => x.PublicCodeHash == secretHash, ct);
                attempts++;
                if (!exists || attempts >= 5)
                {
                    break;
                }
            }

            if (attempts >= 5)
            {
                return Results.Problem("Unable to generate a unique share code.");
            }

            var sharedViewKey = masterKeyService.DeriveSharedViewKey(shareCodeBytes, sharedViewId);
            var encViewRoleKey = encryptionService.Encrypt(sharedViewKey, viewRoleReadKey, sharedViewId.ToByteArray());
            var now = DateTimeOffset.UtcNow;

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

            dbContext.Roles.Add(new Role
            {
                Id = viewRoleId,
                EncryptedRoleBlob = Array.Empty<byte>(),
                PublicSigningKey = null,
                PublicSigningKeyAlg = null,
                PublicEncryptionKey = null,
                PublicEncryptionKeyAlg = null,
                CreatedUtc = now,
                UpdatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);

            var edgeId = Guid.NewGuid();
            var encryptedRelationshipType = keyRingService.EncryptRoleRelationshipType(viewRoleReadKey, RoleRelationships.Read, edgeId);
            var relationshipTypeHash = HMACSHA256.HashData(viewRoleReadKey, System.Text.Encoding.UTF8.GetBytes(RoleRelationships.Read));
            var encryptedReadKeyCopy = encryptionService.Encrypt(viewRoleReadKey, libraryReadKey, library.RoleId.ToByteArray());

            dbContext.RoleEdges.Add(new RoleEdge
            {
                Id = edgeId,
                ParentRoleId = viewRoleId,
                ChildRoleId = library.RoleId,
                RelationshipType = string.Empty,
                EncryptedRelationshipType = encryptedRelationshipType,
                RelationshipTypeHash = relationshipTypeHash,
                EncryptedReadKeyCopy = encryptedReadKeyCopy,
                CreatedUtc = now
            });

            dbContext.SharedViews.Add(new SharedView
            {
                Id = sharedViewId,
                OwnerRoleId = library.RoleId,
                ViewRoleId = viewRoleId,
                EncViewRoleKey = encViewRoleKey,
                SharedViewSecretHash = secretHash,
                CreatedUtc = now,
                RevokedUtc = null
            });

            await dbContext.SaveChangesAsync(ct);

            var shareId = Guid.NewGuid();
            var encShareCode = encryptionService.Encrypt(ownerKey, shareCodeBytes, shareId.ToByteArray());

            dbContext.CogitaRevisionShares.Add(new CogitaRevisionShare
            {
                Id = shareId,
                LibraryId = libraryId,
                CollectionId = collectionId,
                OwnerRoleId = library.RoleId,
                SharedViewId = sharedViewId,
                PublicCodeHash = secretHash,
                EncShareCode = encShareCode,
                Mode = mode,
                CheckMode = checkMode,
                CardLimit = limit,
                RevisionType = revisionType,
                RevisionSettingsJson = revisionSettingsJson,
                CreatedUtc = now,
                RevokedUtc = null
            });

            await dbContext.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            JsonElement? revisionSettingsElement = null;
            if (!string.IsNullOrWhiteSpace(revisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(revisionSettingsJson);
                revisionSettingsElement = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaRevisionShareCreateResponse(
                shareId,
                collectionId,
                shareCode,
                revisionType,
                revisionSettingsElement,
                mode,
                checkMode,
                limit,
                now
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/revision-shares", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            if (!keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var shares = await dbContext.CogitaRevisionShares.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .OrderByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            if (shares.Count == 0)
            {
                return Results.Ok(new List<CogitaRevisionShareResponse>());
            }

            var collectionIds = shares.Select(x => x.CollectionId).Distinct().ToList();
            var collections = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.InfoType == "collection" && collectionIds.Contains(x.Id))
                .ToListAsync(ct);
            var collectionLookup = collections.ToDictionary(x => x.Id, x => x);

            var response = new List<CogitaRevisionShareResponse>();
            foreach (var share in shares)
            {
                var collectionName = "Collection";
                if (collectionLookup.TryGetValue(share.CollectionId, out var info))
                {
                    var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
                    if (payload is not null)
                    {
                        var keyEntry = await dbContext.Keys.AsNoTracking()
                            .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
                        if (keyEntry is not null)
                        {
                            try
                            {
                                var dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                                var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, info.Id.ToByteArray());
                                using var doc = JsonDocument.Parse(plain);
                                collectionName = ResolveLabel(doc.RootElement, info.InfoType) ?? collectionName;
                            }
                            catch (CryptographicException)
                            {
                                // keep fallback
                            }
                        }
                    }
                }

                var shareCode = string.Empty;
                if (share.EncShareCode.Length > 0)
                {
                    try
                    {
                        var plain = encryptionService.Decrypt(ownerKey, share.EncShareCode, share.Id.ToByteArray());
                        shareCode = System.Text.Encoding.UTF8.GetString(plain);
                    }
                    catch (CryptographicException)
                    {
                        shareCode = string.Empty;
                    }
                }

                JsonElement? revisionSettingsElement = null;
                if (!string.IsNullOrWhiteSpace(share.RevisionSettingsJson))
                {
                    using var doc = JsonDocument.Parse(share.RevisionSettingsJson);
                    revisionSettingsElement = doc.RootElement.Clone();
                }

                response.Add(new CogitaRevisionShareResponse(
                    share.Id,
                    share.CollectionId,
                    collectionName,
                    shareCode,
                    share.RevisionType,
                    revisionSettingsElement,
                    share.Mode,
                    share.CheckMode,
                    share.CardLimit,
                    share.CreatedUtc,
                    share.RevokedUtc
                ));
            }

            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/revision-shares/{shareId:guid}/revoke", async (
            Guid libraryId,
            Guid shareId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetOwnerKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var share = await dbContext.CogitaRevisionShares
                .FirstOrDefaultAsync(x => x.Id == shareId && x.LibraryId == libraryId, ct);
            if (share is null)
            {
                return Results.NotFound();
            }

            if (share.RevokedUtc is not null)
            {
                return Results.Ok();
            }

            var sharedView = await dbContext.SharedViews
                .FirstOrDefaultAsync(x => x.Id == share.SharedViewId, ct);
            var now = DateTimeOffset.UtcNow;
            share.RevokedUtc = now;
            if (sharedView is not null)
            {
                sharedView.RevokedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapGet("/public/revision/{code}", async (
            string code,
            string? key,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IMasterKeyService masterKeyService,
            IHashingService hashingService,
            IRoleFieldQueryService fieldQueryService,
            CancellationToken ct) =>
        {
            var shareContext = await TryResolveRevisionShareAsync(
                code,
                key,
                dbContext,
                encryptionService,
                masterKeyService,
                hashingService,
                ct);
            if (shareContext is null)
            {
                return Results.NotFound();
            }

            var (share, library, libraryReadKey) = shareContext.Value;

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == share.CollectionId && x.LibraryId == share.LibraryId && x.InfoType == "collection", ct);
            if (collectionInfo is null)
            {
                return Results.NotFound();
            }

            var collectionName = "Collection";
            var payload = await LoadInfoPayloadAsync(collectionInfo, dbContext, ct);
            if (payload is not null)
            {
                var keyEntry = await dbContext.Keys.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
                if (keyEntry is not null)
                {
                    try
                    {
                        var dataKey = keyRingService.DecryptDataKey(keyEntry, libraryReadKey);
                        var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, collectionInfo.Id.ToByteArray());
                        using var doc = JsonDocument.Parse(plain);
                        collectionName = ResolveLabel(doc.RootElement, collectionInfo.InfoType) ?? collectionName;
                    }
                    catch (CryptographicException)
                    {
                        // keep fallback
                    }
                }
            }

            var roleFields = await dbContext.RoleFields.AsNoTracking()
                .Where(x => x.RoleId == library.RoleId)
                .ToListAsync(ct);
            var roleKeyRing = new RoleKeyRing(
                new Dictionary<Guid, byte[]> { [library.RoleId] = libraryReadKey },
                new Dictionary<Guid, byte[]>(),
                new Dictionary<Guid, byte[]>());
            var lookup = await fieldQueryService.LoadAsync(roleFields, roleKeyRing, ct);
            var libraryName = lookup.ValuesByRole.TryGetValue(library.RoleId, out var values) &&
                              values.TryGetValue(RoleFieldTypes.Nick, out var nick)
                ? nick
                : "Cogita Library";

            JsonElement? revisionSettingsElement = null;
            if (!string.IsNullOrWhiteSpace(share.RevisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(share.RevisionSettingsJson);
                revisionSettingsElement = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaPublicRevisionShareResponse(
                share.Id,
                share.LibraryId,
                share.CollectionId,
                collectionName,
                libraryName,
                share.RevisionType,
                revisionSettingsElement,
                share.Mode,
                share.CheckMode,
                share.CardLimit
            ));
        }).AllowAnonymous();

        group.MapGet("/public/revision/{code}/infos", async (
            string code,
            string? key,
            string? type,
            string? query,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IMasterKeyService masterKeyService,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            var shareContext = await TryResolveRevisionShareAsync(
                code,
                key,
                dbContext,
                encryptionService,
                masterKeyService,
                hashingService,
                ct);
            if (shareContext is null)
            {
                return Results.NotFound();
            }

            var (share, _, libraryReadKey) = shareContext.Value;
            var infoType = string.IsNullOrWhiteSpace(type) ? null : type.Trim().ToLowerInvariant();
            if (infoType is not null && !SupportedInfoTypes.Contains(infoType))
            {
                return Results.BadRequest(new { error = "InfoType is invalid." });
            }

            var lookup = await BuildInfoLookupAsync(share.LibraryId, infoType, dbContext, ct);
            var dataKeyIds = lookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
            var keyEntryById = await dbContext.Keys.AsNoTracking()
                .Where(x => dataKeyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

            var loweredQuery = query?.Trim().ToLowerInvariant();
            var responses = new List<CogitaInfoSearchResponse>();

            foreach (var entry in lookup.Values)
            {
                if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
                {
                    continue;
                }

                byte[] dataKey;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, libraryReadKey);
                }
                catch (CryptographicException)
                {
                    continue;
                }

                string label;
                try
                {
                    var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                }
                catch (CryptographicException)
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(loweredQuery) && !label.ToLowerInvariant().Contains(loweredQuery))
                {
                    continue;
                }

                responses.Add(new CogitaInfoSearchResponse(entry.InfoId, entry.InfoType, label));
            }

            return Results.Ok(responses);
        }).AllowAnonymous();

        group.MapGet("/public/revision/{code}/infos/{infoId:guid}", async (
            string code,
            string? key,
            Guid infoId,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IMasterKeyService masterKeyService,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            var shareContext = await TryResolveRevisionShareAsync(
                code,
                key,
                dbContext,
                encryptionService,
                masterKeyService,
                hashingService,
                ct);
            if (shareContext is null)
            {
                return Results.NotFound();
            }

            var (share, _, readKey) = shareContext.Value;
            var info = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == infoId && x.LibraryId == share.LibraryId, ct);
            if (info is null)
            {
                return Results.NotFound();
            }

            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                return Results.NotFound();
            }

            var keyEntry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
            if (keyEntry is null)
            {
                return Results.NotFound();
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                return Results.NotFound();
            }

            JsonElement payloadJson;
            try
            {
                var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, infoId.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                payloadJson = doc.RootElement.Clone();
            }
            catch (CryptographicException)
            {
                return Results.NotFound();
            }

            return Results.Ok(new CogitaInfoDetailResponse(info.Id, info.InfoType, payloadJson));
        }).AllowAnonymous();

        group.MapGet("/public/revision/{code}/cards", async (
            string code,
            string? key,
            int? limit,
            string? cursor,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IMasterKeyService masterKeyService,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            var shareContext = await TryResolveRevisionShareAsync(
                code,
                key,
                dbContext,
                encryptionService,
                masterKeyService,
                hashingService,
                ct);
            if (shareContext is null)
            {
                return Results.NotFound();
            }

            var (share, _, readKey) = shareContext.Value;

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == share.CollectionId && x.LibraryId == share.LibraryId && x.InfoType == "collection", ct);
            if (collectionInfo is null)
            {
                return Results.NotFound();
            }

            var pageSize = Math.Clamp(limit ?? 40, 1, 500);
            var graph = await dbContext.CogitaCollectionGraphs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CollectionInfoId == share.CollectionId, ct);

            if (graph is not null)
            {
                DateTimeOffset? cursorCreatedUtc = null;
                Guid? cursorGraphId = null;
                if (!string.IsNullOrWhiteSpace(cursor))
                {
                    var parts = cursor.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 2 &&
                        DateTimeOffset.TryParse(parts[0], out var parsedTime) &&
                        Guid.TryParse(parts[1], out var parsedId))
                    {
                        cursorCreatedUtc = parsedTime;
                        cursorGraphId = parsedId;
                    }
                }

                var nodes = await dbContext.CogitaCollectionGraphNodes.AsNoTracking()
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                var edges = await dbContext.CogitaCollectionGraphEdges.AsNoTracking()
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                var hasOutputNodes = nodes.Any(n => n.NodeType.Trim().Equals("output.collection", StringComparison.OrdinalIgnoreCase));

                if (nodes.Count > 0 && hasOutputNodes)
                {
                    var graphResult = await EvaluateCollectionGraphAsync(
                        share.LibraryId,
                        graph,
                        nodes,
                        edges,
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);

                    if (graphResult.Items.Count == 0)
                    {
                        return Results.Ok(new CogitaCardSearchBundleResponse(0, pageSize, null, new List<CogitaCardSearchResponse>()));
                    }

                var infoIds = graphResult.Items.Where(x => x.ItemType == "info").Select(x => x.ItemId).ToList();
                var connectionIds = graphResult.Items.Where(x => x.ItemType == "connection").Select(x => x.ItemId).ToList();

                var infoMeta = await dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == share.LibraryId && infoIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.CreatedUtc, x.InfoType })
                    .ToListAsync(ct);
                var connectionMeta = await dbContext.CogitaConnections.AsNoTracking()
                    .Where(x => x.LibraryId == share.LibraryId && connectionIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.CreatedUtc, x.ConnectionType })
                    .ToListAsync(ct);
                var translationCountGraph = connectionMeta.Count(x => x.ConnectionType == "translation");

                var orderedItems = infoMeta
                    .Select(x => new { ItemType = "info", ItemId = x.Id, x.CreatedUtc })
                    .Concat(connectionMeta.Select(x => new { ItemType = "connection", ItemId = x.Id, x.CreatedUtc }))
                    .ToList();

                if (cursorCreatedUtc.HasValue && cursorGraphId.HasValue)
                {
                    orderedItems = orderedItems
                        .Where(x => x.CreatedUtc < cursorCreatedUtc.Value ||
                                    (x.CreatedUtc == cursorCreatedUtc.Value && x.ItemId.CompareTo(cursorGraphId.Value) < 0))
                        .ToList();
                }

                var itemsPageGraph = orderedItems
                    .OrderByDescending(x => x.CreatedUtc)
                    .ThenByDescending(x => x.ItemId)
                    .Take(pageSize)
                    .ToList();

                var nextCursor = itemsPageGraph.Count == pageSize
                    ? $"{itemsPageGraph[^1].CreatedUtc:O}:{itemsPageGraph[^1].ItemId:D}"
                    : null;

                var graphResponses = await BuildCollectionCardResponsesAsync(
                    itemsPageGraph.Select(x => (x.ItemType, x.ItemId)).ToList(),
                    share.LibraryId,
                    readKey,
                    keyRingService,
                    encryptionService,
                    dbContext,
                    ct);

                    return Results.Ok(new CogitaCardSearchBundleResponse(
                        graphResult.Total + translationCountGraph * 2,
                        pageSize,
                        nextCursor,
                        graphResponses));
                }
            }

            var itemsQuery = dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => x.CollectionInfoId == share.CollectionId);
            var total = await itemsQuery.CountAsync(ct);
            var translationCount = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => x.CollectionInfoId == share.CollectionId && x.ItemType == "connection")
                .Join(dbContext.CogitaConnections.AsNoTracking(),
                    item => item.ItemId,
                    connection => connection.Id,
                    (item, connection) => new { connection.ConnectionType })
                .CountAsync(x => x.ConnectionType == "translation", ct);
            var totalCards = total + translationCount * 2;

            if (!string.IsNullOrWhiteSpace(cursor))
            {
                var parts = cursor.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 2 &&
                    int.TryParse(parts[0], out var sortOrder) &&
                    Guid.TryParse(parts[1], out var itemId))
                {
                    itemsQuery = itemsQuery.Where(x => x.SortOrder > sortOrder ||
                                                       (x.SortOrder == sortOrder && x.Id.CompareTo(itemId) > 0));
                }
            }

            var items = await itemsQuery
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Id)
                .Take(pageSize)
                .ToListAsync(ct);

            var cardResponses = await BuildCollectionCardResponsesAsync(
                items.Select(x => (x.ItemType, x.ItemId)).ToList(),
                share.LibraryId,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);

            var next = items.Count == pageSize
                ? $"{items[^1].SortOrder}:{items[^1].Id:D}"
                : null;

            return Results.Ok(new CogitaCardSearchBundleResponse(
                totalCards,
                pageSize,
                next,
                cardResponses));
        }).AllowAnonymous();

        group.MapGet("/public/revision/{code}/computed/{infoId:guid}/sample", async (
            string code,
            string? key,
            Guid infoId,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IMasterKeyService masterKeyService,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            var shareContext = await TryResolveRevisionShareAsync(
                code,
                key,
                dbContext,
                encryptionService,
                masterKeyService,
                hashingService,
                ct);
            if (shareContext is null)
            {
                return Results.NotFound();
            }

            var (share, _, readKey) = shareContext.Value;

            var info = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == infoId && x.LibraryId == share.LibraryId && x.InfoType == "computed", ct);
            if (info is null)
            {
                return Results.NotFound();
            }

            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                return Results.NotFound();
            }

            var keyEntry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
            if (keyEntry is null)
            {
                return Results.NotFound();
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                return Results.NotFound();
            }

            JsonElement payloadJson;
            try
            {
                var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, infoId.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                payloadJson = doc.RootElement.Clone();
            }
            catch (CryptographicException)
            {
                return Results.NotFound();
            }

            var response = BuildComputedSample(payloadJson);
            return Results.Ok(response);
        }).AllowAnonymous();

        group.MapGet("/libraries/{libraryId:guid}/collections/{collectionId:guid}/graph", async (
            Guid libraryId,
            Guid collectionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (collectionInfo is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaCollectionGraphs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CollectionInfoId == collectionId, ct);
            if (graph is null)
            {
                return Results.Ok(new CogitaCollectionGraphResponse(Guid.Empty, new List<CogitaCollectionGraphNodeResponse>(), new List<CogitaCollectionGraphEdgeResponse>()));
            }

            var nodes = await dbContext.CogitaCollectionGraphNodes.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);
            var edges = await dbContext.CogitaCollectionGraphEdges.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);

            var keyEntries = await dbContext.Keys.AsNoTracking()
                .Where(x => nodes.Select(n => n.DataKeyId).Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

            var responseNodes = new List<CogitaCollectionGraphNodeResponse>();
            foreach (var node in nodes)
            {
                if (!keyEntries.TryGetValue(node.DataKeyId, out var keyEntry))
                {
                    continue;
                }
                byte[] dataKey;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                }
                catch (CryptographicException)
                {
                    continue;
                }

                try
                {
                    var plain = encryptionService.Decrypt(dataKey, node.EncryptedBlob, node.Id.ToByteArray());
                    var payload = JsonSerializer.Deserialize<JsonElement>(plain);
                    responseNodes.Add(new CogitaCollectionGraphNodeResponse(node.Id, node.NodeType, payload));
                }
                catch (CryptographicException)
                {
                    continue;
                }
            }

            var responseEdges = edges.Select(edge => new CogitaCollectionGraphEdgeResponse(edge.Id, edge.FromNodeId, edge.FromPort, edge.ToNodeId, edge.ToPort)).ToList();

            return Results.Ok(new CogitaCollectionGraphResponse(graph.Id, responseNodes, responseEdges));
        });

        group.MapPut("/libraries/{libraryId:guid}/collections/{collectionId:guid}/graph", async (
            Guid libraryId,
            Guid collectionId,
            CogitaCollectionGraphRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (collectionInfo is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var graph = await dbContext.CogitaCollectionGraphs.FirstOrDefaultAsync(x => x.CollectionInfoId == collectionId, ct);
            (Guid DataKeyId, byte[] DataKey) dataKeyResult;
            try
            {
                dataKeyResult = await ResolveDataKeyAsync(
                    library.RoleId,
                    request.DataKeyId,
                    "collection-graph",
                    readKey,
                    ownerKey,
                    userId,
                    keyRingService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
            }
            catch (InvalidOperationException)
            {
                return Results.BadRequest(new { error = "DataKeyId is invalid." });
            }

            if (graph is null)
            {
                graph = new CogitaCollectionGraph
                {
                    Id = Guid.NewGuid(),
                    CollectionInfoId = collectionId,
                    DataKeyId = dataKeyResult.DataKeyId,
                    EncryptedBlob = Array.Empty<byte>(),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaCollectionGraphs.Add(graph);
                await dbContext.SaveChangesAsync(ct);
                graph.EncryptedBlob = encryptionService.Encrypt(dataKeyResult.DataKey, JsonSerializer.SerializeToUtf8Bytes(new { version = 1 }), graph.Id.ToByteArray());
            }
            else
            {
                graph.DataKeyId = dataKeyResult.DataKeyId;
                graph.EncryptedBlob = encryptionService.Encrypt(dataKeyResult.DataKey, JsonSerializer.SerializeToUtf8Bytes(new { version = 1 }), graph.Id.ToByteArray());
                graph.UpdatedUtc = now;
            }

            var existingNodes = await dbContext.CogitaCollectionGraphNodes.Where(x => x.GraphId == graph.Id).ToListAsync(ct);
            var existingEdges = await dbContext.CogitaCollectionGraphEdges.Where(x => x.GraphId == graph.Id).ToListAsync(ct);
            dbContext.CogitaCollectionGraphEdges.RemoveRange(existingEdges);
            dbContext.CogitaCollectionGraphNodes.RemoveRange(existingNodes);
            await dbContext.SaveChangesAsync(ct);

            var responseNodes = new List<CogitaCollectionGraphNodeResponse>();
            foreach (var node in request.Nodes)
            {
                var nodeId = node.NodeId ?? Guid.NewGuid();
                var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(node.Payload);
                var encrypted = encryptionService.Encrypt(dataKeyResult.DataKey, payloadBytes, nodeId.ToByteArray());
                var stored = new CogitaCollectionGraphNode
                {
                    Id = nodeId,
                    GraphId = graph.Id,
                    NodeType = node.NodeType.Trim(),
                    DataKeyId = dataKeyResult.DataKeyId,
                    EncryptedBlob = encrypted,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaCollectionGraphNodes.Add(stored);
                responseNodes.Add(new CogitaCollectionGraphNodeResponse(nodeId, stored.NodeType, node.Payload));
            }

            var responseEdges = new List<CogitaCollectionGraphEdgeResponse>();
            foreach (var edge in request.Edges)
            {
                var edgeId = edge.EdgeId ?? Guid.NewGuid();
                var stored = new CogitaCollectionGraphEdge
                {
                    Id = edgeId,
                    GraphId = graph.Id,
                    FromNodeId = edge.FromNodeId,
                    FromPort = edge.FromPort,
                    ToNodeId = edge.ToNodeId,
                    ToPort = edge.ToPort,
                    CreatedUtc = now
                };
                dbContext.CogitaCollectionGraphEdges.Add(stored);
                responseEdges.Add(new CogitaCollectionGraphEdgeResponse(edgeId, edge.FromNodeId, edge.FromPort, edge.ToNodeId, edge.ToPort));
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCollectionGraphResponse(graph.Id, responseNodes, responseEdges));
        });

        group.MapPost("/libraries/{libraryId:guid}/collections/{collectionId:guid}/graph/preview", async (
            Guid libraryId,
            Guid collectionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var graph = await dbContext.CogitaCollectionGraphs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CollectionInfoId == collectionId, ct);
            if (graph is null)
            {
                return Results.Ok(new CogitaCollectionGraphPreviewResponse(0, 0, 0));
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var nodes = await dbContext.CogitaCollectionGraphNodes.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);
            var edges = await dbContext.CogitaCollectionGraphEdges.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);

            var result = await EvaluateCollectionGraphAsync(
                libraryId,
                graph,
                nodes,
                edges,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);

            return Results.Ok(new CogitaCollectionGraphPreviewResponse(result.Total, result.ConnectionCount, result.InfoCount));
        });

        group.MapGet("/libraries/{libraryId:guid}/dependency-graph", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaDependencyGraphs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId, ct);

            if (graph is null)
            {
                return Results.Ok(new CogitaDependencyGraphResponse(Guid.Empty, new List<CogitaDependencyGraphNodeResponse>(), new List<CogitaDependencyGraphEdgeResponse>()));
            }

            var keyEntry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == graph.DataKeyId, ct);
            if (keyEntry is null)
            {
                return Results.NotFound();
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            var nodes = await dbContext.CogitaDependencyGraphNodes.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);
            var edges = await dbContext.CogitaDependencyGraphEdges.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);

            var nodeResponses = new List<CogitaDependencyGraphNodeResponse>();
            foreach (var node in nodes)
            {
                try
                {
                    var plain = encryptionService.Decrypt(dataKey, node.EncryptedBlob, node.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    nodeResponses.Add(new CogitaDependencyGraphNodeResponse(node.Id, node.NodeType, doc.RootElement.Clone()));
                }
                catch (CryptographicException)
                {
                    continue;
                }
            }

            var edgeResponses = edges.Select(edge => new CogitaDependencyGraphEdgeResponse(edge.Id, edge.FromNodeId, edge.ToNodeId)).ToList();

            return Results.Ok(new CogitaDependencyGraphResponse(graph.Id, nodeResponses, edgeResponses));
        });

        group.MapPut("/libraries/{libraryId:guid}/dependency-graph", async (
            Guid libraryId,
            CogitaDependencyGraphRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaDependencyGraphs.FirstOrDefaultAsync(x => x.LibraryId == libraryId, ct);
            var now = DateTimeOffset.UtcNow;
            byte[] dataKey;
            Guid dataKeyId;

            if (graph is null)
            {
                var keyResult = await ResolveDataKeyAsync(
                    library.RoleId,
                    request.DataKeyId,
                    "dependency-graph",
                    readKey,
                    ownerKey,
                    userId,
                    keyRingService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
                dataKey = keyResult.DataKey;
                dataKeyId = keyResult.DataKeyId;
                graph = new CogitaDependencyGraph
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    DataKeyId = dataKeyId,
                    EncryptedBlob = encryptionService.Encrypt(dataKey, JsonSerializer.SerializeToUtf8Bytes(new { version = 1 }), libraryId.ToByteArray()),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaDependencyGraphs.Add(graph);
            }
            else
            {
                var keyEntry = await dbContext.Keys.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == graph.DataKeyId, ct);
                if (keyEntry is null)
                {
                    return Results.NotFound();
                }
                dataKeyId = graph.DataKeyId;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                }
                catch (CryptographicException)
                {
                    return Results.Forbid();
                }
                graph.EncryptedBlob = encryptionService.Encrypt(dataKey, JsonSerializer.SerializeToUtf8Bytes(new { version = 1 }), libraryId.ToByteArray());
                graph.UpdatedUtc = now;
            }

            var existingNodes = await dbContext.CogitaDependencyGraphNodes
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);
            var existingEdges = await dbContext.CogitaDependencyGraphEdges
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);
            dbContext.CogitaDependencyGraphEdges.RemoveRange(existingEdges);
            dbContext.CogitaDependencyGraphNodes.RemoveRange(existingNodes);

            var nodeIdMap = new Dictionary<Guid, Guid>();
            var responseNodes = new List<CogitaDependencyGraphNodeResponse>();
            foreach (var node in request.Nodes)
            {
                var nodeId = node.NodeId ?? Guid.NewGuid();
                nodeIdMap[nodeId] = nodeId;
                var encryptedPayload = encryptionService.Encrypt(
                    dataKey,
                    JsonSerializer.SerializeToUtf8Bytes(node.Payload),
                    nodeId.ToByteArray());
                dbContext.CogitaDependencyGraphNodes.Add(new CogitaDependencyGraphNode
                {
                    Id = nodeId,
                    GraphId = graph.Id,
                    NodeType = node.NodeType.Trim(),
                    DataKeyId = dataKeyId,
                    EncryptedBlob = encryptedPayload,
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
                responseNodes.Add(new CogitaDependencyGraphNodeResponse(nodeId, node.NodeType, node.Payload));
            }

            var responseEdges = new List<CogitaDependencyGraphEdgeResponse>();
            foreach (var edge in request.Edges)
            {
                if (!nodeIdMap.ContainsKey(edge.FromNodeId) || !nodeIdMap.ContainsKey(edge.ToNodeId))
                {
                    continue;
                }
                var edgeId = edge.EdgeId ?? Guid.NewGuid();
                dbContext.CogitaDependencyGraphEdges.Add(new CogitaDependencyGraphEdge
                {
                    Id = edgeId,
                    GraphId = graph.Id,
                    FromNodeId = edge.FromNodeId,
                    ToNodeId = edge.ToNodeId,
                    CreatedUtc = now
                });
                responseEdges.Add(new CogitaDependencyGraphEdgeResponse(edgeId, edge.FromNodeId, edge.ToNodeId));
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaDependencyGraphResponse(graph.Id, responseNodes, responseEdges));
        });

        group.MapPost("/libraries/{libraryId:guid}/dependency-graph/preview", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaDependencyGraphs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId, ct);
            if (graph is null)
            {
                return Results.Ok(new CogitaDependencyGraphPreviewResponse(0, new List<Guid>()));
            }

            var keyEntry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == graph.DataKeyId, ct);
            if (keyEntry is null)
            {
                return Results.NotFound();
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                return Results.Forbid();
            }

            var nodes = await dbContext.CogitaDependencyGraphNodes.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);

            var collectionIds = new HashSet<Guid>();
            foreach (var node in nodes)
            {
                try
                {
                    var plain = encryptionService.Decrypt(dataKey, node.EncryptedBlob, node.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    if (doc.RootElement.TryGetProperty("collectionId", out var idEl) && idEl.ValueKind == JsonValueKind.String &&
                        Guid.TryParse(idEl.GetString(), out var collectionId))
                    {
                        collectionIds.Add(collectionId);
                    }
                }
                catch (CryptographicException)
                {
                    continue;
                }
            }

            return Results.Ok(new CogitaDependencyGraphPreviewResponse(collectionIds.Count, collectionIds.ToList()));
        });

        group.MapGet("/libraries/{libraryId:guid}/collections/{collectionId:guid}/cards", async (
            Guid libraryId,
            Guid collectionId,
            int? limit,
            string? cursor,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (collectionInfo is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var pageSize = Math.Clamp(limit ?? 40, 1, 500);
            var graph = await dbContext.CogitaCollectionGraphs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CollectionInfoId == collectionId, ct);

            if (graph is not null)
            {
                DateTimeOffset? cursorCreatedUtc = null;
                Guid? cursorGraphId = null;
                if (!string.IsNullOrWhiteSpace(cursor))
                {
                    var parts = cursor.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 2 &&
                        DateTimeOffset.TryParse(parts[0], out var parsedTime) &&
                        Guid.TryParse(parts[1], out var parsedId))
                    {
                        cursorCreatedUtc = parsedTime;
                        cursorGraphId = parsedId;
                    }
                }

                var nodes = await dbContext.CogitaCollectionGraphNodes.AsNoTracking()
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                var edges = await dbContext.CogitaCollectionGraphEdges.AsNoTracking()
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                var hasOutputNodes = nodes.Any(n => n.NodeType.Trim().Equals("output.collection", StringComparison.OrdinalIgnoreCase));

                if (nodes.Count > 0 && hasOutputNodes)
                {
                    var graphResult = await EvaluateCollectionGraphAsync(
                        libraryId,
                        graph,
                        nodes,
                        edges,
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);

                    if (graphResult.Items.Count == 0)
                    {
                        return Results.Ok(new CogitaCardSearchBundleResponse(0, pageSize, null, new List<CogitaCardSearchResponse>()));
                    }

                    var infoIds = graphResult.Items.Where(x => x.ItemType == "info").Select(x => x.ItemId).ToList();
                    var connectionIds = graphResult.Items.Where(x => x.ItemType == "connection").Select(x => x.ItemId).ToList();

                    var infoMeta = await dbContext.CogitaInfos.AsNoTracking()
                        .Where(x => x.LibraryId == libraryId && infoIds.Contains(x.Id))
                        .Select(x => new { x.Id, x.CreatedUtc, x.InfoType })
                        .ToListAsync(ct);
                    var connectionMeta = await dbContext.CogitaConnections.AsNoTracking()
                        .Where(x => x.LibraryId == libraryId && connectionIds.Contains(x.Id))
                        .Select(x => new { x.Id, x.CreatedUtc, x.ConnectionType })
                        .ToListAsync(ct);
                    var translationCountGraph = connectionMeta.Count(x => x.ConnectionType == "translation");

                    var orderedItems = infoMeta
                        .Select(x => new { ItemType = "info", ItemId = x.Id, x.CreatedUtc })
                        .Concat(connectionMeta.Select(x => new { ItemType = "connection", ItemId = x.Id, x.CreatedUtc }))
                        .ToList();

                    if (cursorCreatedUtc.HasValue && cursorGraphId.HasValue)
                    {
                        orderedItems = orderedItems
                            .Where(x => x.CreatedUtc < cursorCreatedUtc.Value ||
                                        (x.CreatedUtc == cursorCreatedUtc.Value && x.ItemId.CompareTo(cursorGraphId.Value) < 0))
                            .ToList();
                    }

                    var itemsPageGraph = orderedItems
                        .OrderByDescending(x => x.CreatedUtc)
                        .ThenByDescending(x => x.ItemId)
                        .Take(pageSize)
                        .ToList();

                    var nextCursorGraph = itemsPageGraph.Count > 0
                        ? $"{itemsPageGraph[^1].CreatedUtc:O}:{itemsPageGraph[^1].ItemId}"
                        : null;

                    var infoItemIdsGraph = itemsPageGraph.Where(x => x.ItemType == "info").Select(x => x.ItemId).ToList();
                    var connectionItemIdsGraph = itemsPageGraph.Where(x => x.ItemType == "connection").Select(x => x.ItemId).ToList();

                    var infosGraph = await dbContext.CogitaInfos.AsNoTracking()
                        .Where(x => x.LibraryId == libraryId && infoItemIdsGraph.Contains(x.Id))
                        .ToListAsync(ct);

                    var lookupGraph = new Dictionary<Guid, (Guid InfoId, string InfoType, Guid DataKeyId, byte[] EncryptedBlob)>();
                    foreach (var info in infosGraph)
                    {
                        var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
                        if (payload is null)
                        {
                            continue;
                        }
                        lookupGraph[info.Id] = (info.Id, info.InfoType, payload.Value.DataKeyId, payload.Value.EncryptedBlob);
                    }

                    var dataKeyIdsGraph = lookupGraph.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
                    var keyEntryByIdGraph = await dbContext.Keys.AsNoTracking()
                        .Where(x => dataKeyIdsGraph.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, ct);

                    var infoResponsesGraph = new Dictionary<Guid, CogitaCardSearchResponse>();
                    foreach (var entry in lookupGraph.Values)
                    {
                        if (!keyEntryByIdGraph.TryGetValue(entry.DataKeyId, out var keyEntry))
                        {
                            continue;
                        }

                        byte[] dataKey;
                        try
                        {
                            dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                        }
                        catch (CryptographicException)
                        {
                            continue;
                        }

                        string label;
                        string description;
                        try
                        {
                            var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                            using var doc = JsonDocument.Parse(plain);
                            label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                            description = ResolveDescription(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                            var checkType = entry.InfoType == "word"
                                ? "word-language"
                                : entry.InfoType == "computed"
                                    ? "computed"
                                    : "info";
                            var direction = entry.InfoType == "word" ? "word-to-language" : null;
                            infoResponsesGraph[entry.InfoId] = new CogitaCardSearchResponse(entry.InfoId, "info", label, description, entry.InfoType, checkType, direction);
                            continue;
                        }
                        catch (CryptographicException)
                        {
                            continue;
                        }
                    }

                    var connectionResponsesGraph = new Dictionary<Guid, List<CogitaCardSearchResponse>>();
                    if (connectionItemIdsGraph.Count > 0)
                    {
                        var connections = await dbContext.CogitaConnections.AsNoTracking()
                            .Where(x => x.LibraryId == libraryId && connectionItemIdsGraph.Contains(x.Id))
                            .ToListAsync(ct);

                        var connectionLookup = connections.ToDictionary(x => x.Id, x => x);

                        var translationIds = connections
                            .Where(x => x.ConnectionType == "translation")
                            .Select(x => x.Id)
                            .ToList();

                        if (translationIds.Count > 0)
                        {
                            var translationResponses = await BuildTranslationCardResponsesAsync(
                                libraryId,
                                translationIds,
                                readKey,
                                keyRingService,
                                encryptionService,
                                dbContext,
                                ct);
                            foreach (var response in translationResponses)
                            {
                                if (!connectionResponsesGraph.TryGetValue(response.CardId, out var list))
                                {
                                    list = new List<CogitaCardSearchResponse>();
                                    connectionResponsesGraph[response.CardId] = list;
                                }
                                list.Add(response);
                            }
                        }

                        foreach (var connection in connections)
                        {
                            if (connection.ConnectionType == "translation")
                            {
                                continue;
                            }

                            connectionResponsesGraph[connection.Id] = new List<CogitaCardSearchResponse>
                            {
                                new CogitaCardSearchResponse(
                                    connection.Id,
                                    "connection",
                                    connection.ConnectionType,
                                    "Connection",
                                    null,
                                    connection.ConnectionType,
                                    null)
                            };
                        }
                    }

                    var orderedResponsesGraph = new List<CogitaCardSearchResponse>();
                    foreach (var item in itemsPageGraph)
                    {
                        if (item.ItemType == "info")
                        {
                            if (infoResponsesGraph.TryGetValue(item.ItemId, out var response))
                            {
                                orderedResponsesGraph.Add(response);
                            }
                        }
                        else if (item.ItemType == "connection")
                        {
                            if (connectionResponsesGraph.TryGetValue(item.ItemId, out var responseList))
                            {
                                orderedResponsesGraph.AddRange(responseList);
                            }
                        }
                    }

                    return Results.Ok(new CogitaCardSearchBundleResponse(
                        graphResult.Total + translationCountGraph * 2,
                        pageSize,
                        nextCursorGraph,
                        orderedResponsesGraph));
                }
            }

            int? cursorSort = null;
            Guid? cursorId = null;
            if (!string.IsNullOrWhiteSpace(cursor))
            {
                var parts = cursor.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 2 && int.TryParse(parts[0], out var parsedSort) && Guid.TryParse(parts[1], out var parsedId))
                {
                    cursorSort = parsedSort;
                    cursorId = parsedId;
                }
            }

            var itemsQuery = dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => x.CollectionInfoId == collectionId);
            var total = await itemsQuery.CountAsync(ct);
            var translationCount = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => x.CollectionInfoId == collectionId && x.ItemType == "connection")
                .Join(dbContext.CogitaConnections.AsNoTracking(),
                    item => item.ItemId,
                    connection => connection.Id,
                    (item, connection) => new { connection.ConnectionType })
                .CountAsync(x => x.ConnectionType == "translation", ct);
            var totalCards = total + translationCount * 2;

            if (cursorSort.HasValue && cursorId.HasValue)
            {
                itemsQuery = itemsQuery.Where(x =>
                    x.SortOrder > cursorSort.Value ||
                    (x.SortOrder == cursorSort.Value && x.Id.CompareTo(cursorId.Value) > 0));
            }

            var itemsPage = await itemsQuery
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Id)
                .Take(pageSize)
                .ToListAsync(ct);

            var nextCursor = itemsPage.Count > 0
                ? $"{itemsPage[^1].SortOrder}:{itemsPage[^1].Id}"
                : null;

            var infoItemIds = itemsPage.Where(x => x.ItemType == "info").Select(x => x.ItemId).ToList();
            var connectionItemIds = itemsPage.Where(x => x.ItemType == "connection").Select(x => x.ItemId).ToList();

            var infos = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && infoItemIds.Contains(x.Id))
                .ToListAsync(ct);
            var infoLookup = infos.ToDictionary(x => x.Id, x => x);

            var payloadLookup = new Dictionary<Guid, (Guid InfoId, string InfoType, Guid DataKeyId, byte[] EncryptedBlob)>();
            foreach (var info in infos)
            {
                var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
                if (payload is null)
                {
                    continue;
                }
                payloadLookup[info.Id] = (info.Id, info.InfoType, payload.Value.DataKeyId, payload.Value.EncryptedBlob);
            }

            var dataKeyIds = payloadLookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
            var keyEntryById = await dbContext.Keys.AsNoTracking()
                .Where(x => dataKeyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

            var wordInfoIds = payloadLookup.Values
                .Where(entry => entry.InfoType == "word")
                .Select(entry => entry.InfoId)
                .Distinct()
                .ToList();
            var wordLanguageMap = new Dictionary<Guid, Guid>();
            if (wordInfoIds.Count > 0)
            {
                var wordLanguageRows = await dbContext.CogitaWordLanguages.AsNoTracking()
                    .Where(x => wordInfoIds.Contains(x.WordInfoId))
                    .ToListAsync(ct);
                foreach (var row in wordLanguageRows)
                {
                    if (!wordLanguageMap.ContainsKey(row.WordInfoId))
                    {
                        wordLanguageMap[row.WordInfoId] = row.LanguageInfoId;
                    }
                }
            }

            var languageIds = wordLanguageMap.Values.Distinct().ToList();
            var languageLabels = await ResolveInfoLabelsAsync(
                libraryId,
                "language",
                languageIds,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);

            var infoResponses = new Dictionary<Guid, CogitaCardSearchResponse>();

            foreach (var item in itemsPage)
            {
                if (item.ItemType == "info")
                {
                    if (!payloadLookup.TryGetValue(item.ItemId, out var entry))
                    {
                        continue;
                    }

                    if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
                    {
                        continue;
                    }

                    byte[] dataKey;
                    try
                    {
                        dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                    }
                    catch (CryptographicException)
                    {
                        continue;
                    }

                    string label;
                    string description;
                    try
                    {
                        var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                        using var doc = JsonDocument.Parse(plain);
                        label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                        description = ResolveDescription(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                        if (entry.InfoType == "word" && wordLanguageMap.TryGetValue(entry.InfoId, out var languageInfoId))
                        {
                            if (languageLabels.TryGetValue(languageInfoId, out var langLabel) && !string.IsNullOrWhiteSpace(langLabel))
                            {
                                description = $"Language: {langLabel}";
                            }
                        }

                        var checkType = entry.InfoType == "word"
                            ? "word-language"
                            : entry.InfoType == "computed"
                                ? "computed"
                                : "info";
                        var direction = entry.InfoType == "word" ? "word-to-language" : null;
                        infoResponses[entry.InfoId] = new CogitaCardSearchResponse(entry.InfoId, "info", label, description, entry.InfoType, checkType, direction);
                        continue;
                    }
                    catch (CryptographicException)
                    {
                        continue;
                    }
                }
            }

            var connectionResponses = new Dictionary<Guid, List<CogitaCardSearchResponse>>();
            if (connectionItemIds.Count > 0)
            {
                var connections = await dbContext.CogitaConnections.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && connectionItemIds.Contains(x.Id))
                    .ToListAsync(ct);

                var connectionLookup = connections.ToDictionary(x => x.Id, x => x);

                var translationIds = connections
                    .Where(x => x.ConnectionType == "translation")
                    .Select(x => x.Id)
                    .ToList();

                if (translationIds.Count > 0)
                {
                    var items = await dbContext.CogitaConnectionItems.AsNoTracking()
                        .Where(x => translationIds.Contains(x.ConnectionId))
                        .OrderBy(x => x.SortOrder)
                        .ToListAsync(ct);

                    var itemsByConnection = items.GroupBy(x => x.ConnectionId)
                        .ToDictionary(group => group.Key, group => group.Select(x => x.InfoId).ToList());

                    var translationWordIds = itemsByConnection.Values.SelectMany(x => x).Distinct().ToList();
                    var wordLabels = await ResolveInfoLabelsAsync(
                        libraryId,
                        "word",
                        translationWordIds,
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);

                    var translationWordLanguageMap = new Dictionary<Guid, Guid>();
                    if (translationWordIds.Count > 0)
                    {
                        var wordLanguageRows = await dbContext.CogitaWordLanguages.AsNoTracking()
                            .Where(x => translationWordIds.Contains(x.WordInfoId))
                            .ToListAsync(ct);
                        foreach (var row in wordLanguageRows)
                        {
                            if (!translationWordLanguageMap.ContainsKey(row.WordInfoId))
                            {
                                translationWordLanguageMap[row.WordInfoId] = row.LanguageInfoId;
                            }
                        }
                    }
                    var translationLanguageIds = translationWordLanguageMap.Values.Distinct().ToList();
                    var translationLanguageLabels = await ResolveInfoLabelsAsync(
                        libraryId,
                        "language",
                        translationLanguageIds,
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);

                    foreach (var pair in itemsByConnection)
                    {
                        if (pair.Value.Count < 2)
                        {
                            continue;
                        }

                        var wordA = pair.Value[0];
                        var wordB = pair.Value[1];
                        var wordALabel = wordLabels.TryGetValue(wordA, out var w1) ? w1 : "Word";
                        var wordBLabel = wordLabels.TryGetValue(wordB, out var w2) ? w2 : "Word";

                        var langALabel = translationWordLanguageMap.TryGetValue(wordA, out var langA) && translationLanguageLabels.TryGetValue(langA, out var l1)
                            ? l1
                            : "Language";
                        var langBLabel = translationWordLanguageMap.TryGetValue(wordB, out var langB) && translationLanguageLabels.TryGetValue(langB, out var l2)
                            ? l2
                            : "Language";

                        var label = $"{wordALabel} ↔ {wordBLabel}";
                        var description = $"{langALabel} ↔ {langBLabel}";

                        connectionResponses[pair.Key] = new List<CogitaCardSearchResponse>
                        {
                            new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation", "a-to-b"),
                            new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation", "b-to-a"),
                            new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation-match", null)
                        };
                    }
                }

                foreach (var item in itemsPage.Where(x => x.ItemType == "connection"))
                {
                    if (!connectionLookup.TryGetValue(item.ItemId, out var connection))
                    {
                        continue;
                    }

                    if (connection.ConnectionType == "translation")
                    {
                        continue;
                    }

                    connectionResponses[connection.Id] = new List<CogitaCardSearchResponse>
                    {
                        new CogitaCardSearchResponse(
                            connection.Id,
                            "connection",
                            connection.ConnectionType,
                            "Connection",
                            null,
                            connection.ConnectionType,
                            null)
                    };
                }
            }

            var orderedResponses = new List<CogitaCardSearchResponse>();
            foreach (var item in itemsPage)
            {
                if (item.ItemType == "info")
                {
                    if (infoResponses.TryGetValue(item.ItemId, out var response))
                    {
                        orderedResponses.Add(response);
                    }
                }
                else if (item.ItemType == "connection")
                {
                    if (connectionResponses.TryGetValue(item.ItemId, out var responseList))
                    {
                        orderedResponses.AddRange(responseList);
                    }
                }
            }

            return Results.Ok(new CogitaCardSearchBundleResponse(totalCards, pageSize, nextCursor, orderedResponses));
        });

        group.MapPost("/libraries/{libraryId:guid}/mock-data", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out _) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var languageNames = new[] { "English", "German", "Polish", "Spanish" };
            var translationRows = new (string English, string German, string Polish, string Spanish)[]
            {
                ("house", "haus", "dom", "casa"),
                ("book", "buch", "ksiazka", "libro"),
                ("water", "wasser", "woda", "agua"),
                ("sun", "sonne", "slonce", "sol"),
                ("moon", "mond", "ksiezyc", "luna"),
                ("tree", "baum", "drzewo", "arbol"),
                ("city", "stadt", "miasto", "ciudad"),
                ("school", "schule", "szkola", "escuela"),
                ("bread", "brot", "chleb", "pan"),
                ("milk", "milch", "mleko", "leche"),
                ("coffee", "kaffee", "kawa", "cafe"),
                ("road", "strasse", "droga", "camino"),
                ("bridge", "brucke", "most", "puente"),
                ("river", "fluss", "rzeka", "rio"),
                ("mountain", "berg", "gora", "montana"),
                ("friend", "freund", "przyjaciel", "amigo"),
                ("family", "familie", "rodzina", "familia"),
                ("work", "arbeit", "praca", "trabajo"),
                ("time", "zeit", "czas", "tiempo"),
                ("music", "musik", "muzyka", "musica"),
                ("language", "sprache", "jezyk", "idioma"),
                ("picture", "bild", "obraz", "imagen"),
                ("market", "markt", "targ", "mercado"),
                ("garden", "garten", "ogrod", "jardin"),
                ("story", "geschichte", "opowiesc", "historia")
            };

            var languages = new Dictionary<string, Guid>();
            var wordsByLanguage = new Dictionary<string, List<Guid>>();

            foreach (var name in languageNames)
            {
                var payload = JsonSerializer.SerializeToElement(new { label = name, notes = "Mock language" });
                var infoResponse = await CreateInfoInternalAsync(
                    library,
                    new CogitaCreateInfoRequest("language", payload, null, null),
                    readKey,
                    ownerKey,
                    userId,
                    keyRingService,
                    encryptionService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
                languages[name] = infoResponse.InfoId;
                wordsByLanguage[name] = new List<Guid>();
            }

            foreach (var row in translationRows)
            {
                var rowByLanguage = new Dictionary<string, string>
                {
                    ["English"] = row.English,
                    ["German"] = row.German,
                    ["Polish"] = row.Polish,
                    ["Spanish"] = row.Spanish
                };

                foreach (var (langName, langId) in languages)
                {
                    var wordLabel = rowByLanguage[langName];
                    var payload = JsonSerializer.SerializeToElement(new { label = wordLabel, notes = "Mock word" });
                    var wordResponse = await CreateInfoInternalAsync(
                        library,
                        new CogitaCreateInfoRequest("word", payload, null, null),
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct);
                    wordsByLanguage[langName].Add(wordResponse.InfoId);

                    try
                    {
                        await CreateConnectionInternalAsync(
                            library,
                            new CogitaCreateConnectionRequest(
                                "word-language",
                                new List<Guid> { langId, wordResponse.InfoId },
                                JsonSerializer.SerializeToElement(new { note = "Mock word-language" }),
                                null,
                                null),
                            readKey,
                            ownerKey,
                            userId,
                            keyRingService,
                            encryptionService,
                            roleCryptoService,
                            ledgerService,
                            dbContext,
                            ct);
                    }
                    catch (InvalidOperationException)
                    {
                        // Ignore existing or invalid word-language links to keep mock data seeding robust.
                    }
                }
            }

            var languageList = languageNames.ToList();
            for (var i = 0; i < languageList.Count; i++)
            {
                for (var j = i + 1; j < languageList.Count; j++)
                {
                    var langA = languageList[i];
                    var langB = languageList[j];
                    for (var index = 0; index < translationRows.Length; index++)
                    {
                        var wordA = wordsByLanguage[langA][index];
                        var wordB = wordsByLanguage[langB][index];
                        try
                        {
                            await CreateConnectionInternalAsync(
                                library,
                                new CogitaCreateConnectionRequest(
                                    "translation",
                                    new List<Guid> { wordA, wordB },
                                    JsonSerializer.SerializeToElement(new { note = "Mock translation" }),
                                    null,
                                    null),
                                readKey,
                                ownerKey,
                                userId,
                                keyRingService,
                                encryptionService,
                                roleCryptoService,
                                ledgerService,
                                dbContext,
                                ct);
                        }
                        catch (InvalidOperationException)
                        {
                            // Skip duplicates if mock data was already seeded.
                        }
                    }
                }
            }

            var languageCount = await dbContext.CogitaInfos.AsNoTracking()
                .CountAsync(x => x.LibraryId == libraryId && x.InfoType == "language", ct);
            var wordCount = await dbContext.CogitaInfos.AsNoTracking()
                .CountAsync(x => x.LibraryId == libraryId && x.InfoType == "word", ct);
            var wordLanguageLinks = await dbContext.CogitaWordLanguages.AsNoTracking()
                .CountAsync(ct);
            var translationCount = await dbContext.CogitaConnections.AsNoTracking()
                .CountAsync(x => x.LibraryId == libraryId && x.ConnectionType == "translation", ct);

            return Results.Ok(new CogitaMockDataResponse(
                languageCount,
                wordCount,
                wordLanguageLinks,
                translationCount
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/export", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
            {
                return Results.Forbid();
            }

            var infos = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .ToListAsync(ct);
            var connections = await dbContext.CogitaConnections.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .ToListAsync(ct);
            var connectionIds = connections.Select(x => x.Id).ToList();
            var connectionItems = connectionIds.Count == 0
                ? new List<CogitaConnectionItem>()
                : await dbContext.CogitaConnectionItems.AsNoTracking()
                    .Where(x => connectionIds.Contains(x.ConnectionId))
                    .OrderBy(x => x.SortOrder)
                    .ToListAsync(ct);
            var connectionItemsLookup = connectionItems
                .GroupBy(x => x.ConnectionId)
                .ToDictionary(group => group.Key, group => group.Select(x => x.InfoId).ToList());

            var infoIds = infos.Select(x => x.Id).ToList();
            var collectionItems = infoIds.Count == 0
                ? new List<CogitaCollectionItem>()
                : await dbContext.CogitaCollectionItems.AsNoTracking()
                    .Where(x => infoIds.Contains(x.CollectionInfoId))
                    .OrderBy(x => x.SortOrder)
                    .ToListAsync(ct);
            var collectionGroups = collectionItems
                .GroupBy(x => x.CollectionInfoId)
                .ToList();

            context.Response.ContentType = "application/json";
            context.Response.Headers.ContentDisposition =
                $"attachment; filename=\"cogita-library-{libraryId}.json\"";

            await using var writer = new Utf8JsonWriter(context.Response.Body, new JsonWriterOptions
            {
                Indented = false,
                SkipValidation = false
            });

            writer.WriteStartObject();
            writer.WriteNumber("version", 1);

            writer.WritePropertyName("infos");
            writer.WriteStartArray();
            var infoIndex = 0;
            foreach (var info in infos)
            {
                var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
                if (payload is null)
                {
                    continue;
                }

                var keyEntry = await dbContext.Keys.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
                if (keyEntry is null)
                {
                    continue;
                }

                byte[] dataKey;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                }
                catch (CryptographicException)
                {
                    continue;
                }

                try
                {
                    var plain = encryptionService.Decrypt(dataKey, payload.Value.EncryptedBlob, info.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    writer.WriteStartObject();
                    writer.WriteString("infoId", info.Id);
                    writer.WriteString("infoType", info.InfoType);
                    writer.WritePropertyName("payload");
                    doc.RootElement.WriteTo(writer);
                    writer.WriteEndObject();
                    infoIndex++;
                    if (infoIndex % 50 == 0)
                    {
                        await writer.FlushAsync(ct);
                    }
                }
                catch (CryptographicException)
                {
                    continue;
                }
            }
            writer.WriteEndArray();

            writer.WritePropertyName("connections");
            writer.WriteStartArray();
            var connectionIndex = 0;
            foreach (var connection in connections)
            {
                var keyEntry = await dbContext.Keys.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == connection.DataKeyId, ct);
                if (keyEntry is null)
                {
                    continue;
                }

                byte[] dataKey;
                try
                {
                    dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                }
                catch (CryptographicException)
                {
                    continue;
                }

                writer.WriteStartObject();
                writer.WriteString("connectionId", connection.Id);
                writer.WriteString("connectionType", connection.ConnectionType);
                writer.WritePropertyName("infoIds");
                writer.WriteStartArray();
                if (connectionItemsLookup.TryGetValue(connection.Id, out var infoIdsForConnection))
                {
                    foreach (var infoId in infoIdsForConnection)
                    {
                        writer.WriteStringValue(infoId);
                    }
                }
                writer.WriteEndArray();

                try
                {
                    var plain = encryptionService.Decrypt(dataKey, connection.EncryptedBlob, connection.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    writer.WritePropertyName("payload");
                    doc.RootElement.WriteTo(writer);
                }
                catch (CryptographicException)
                {
                    writer.WriteNull("payload");
                }

                writer.WriteEndObject();
                connectionIndex++;
                if (connectionIndex % 50 == 0)
                {
                    await writer.FlushAsync(ct);
                }
            }
            writer.WriteEndArray();

            writer.WritePropertyName("collections");
            writer.WriteStartArray();
            foreach (var group in collectionGroups)
            {
                writer.WriteStartObject();
                writer.WriteString("collectionInfoId", group.Key);
                writer.WritePropertyName("items");
                writer.WriteStartArray();
                foreach (var item in group.OrderBy(x => x.SortOrder))
                {
                    writer.WriteStartObject();
                    writer.WriteString("itemType", item.ItemType);
                    writer.WriteString("itemId", item.ItemId);
                    writer.WriteNumber("sortOrder", item.SortOrder);
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
                writer.WriteEndObject();
            }
            writer.WriteEndArray();

            writer.WriteEndObject();
            await writer.FlushAsync(ct);
            return Results.Empty;
        });

        group.MapPost("/libraries/{libraryId:guid}/import", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            CogitaLibraryImportRequest? request;
            try
            {
                request = await JsonSerializer.DeserializeAsync<CogitaLibraryImportRequest>(
                    context.Request.Body,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                    ct);
            }
            catch (JsonException)
            {
                return Results.BadRequest(new { error = "Invalid import payload." });
            }

            if (request is null)
            {
                return Results.BadRequest(new { error = "Import payload is empty." });
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var infoMap = new Dictionary<Guid, Guid>();
            var connectionMap = new Dictionary<Guid, Guid>();
            const int importBatchSize = 250;
            var previousDetectChanges = dbContext.ChangeTracker.AutoDetectChangesEnabled;
            dbContext.ChangeTracker.AutoDetectChangesEnabled = false;

            try
            {
                var infoKeyMap = new Dictionary<string, Guid>();
                var connectionKeyMap = new Dictionary<string, Guid>();

                foreach (var infoType in request.Infos.Select(x => x.InfoType.Trim().ToLowerInvariant()).Distinct())
                {
                    if (!SupportedInfoTypes.Contains(infoType))
                    {
                        continue;
                    }

                    var keyResult = await ResolveDataKeyAsync(
                        library.RoleId,
                        null,
                        infoType,
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    infoKeyMap[infoType] = keyResult.DataKeyId;
                }

                foreach (var connectionType in request.Connections.Select(x => x.ConnectionType.Trim().ToLowerInvariant()).Distinct())
                {
                    if (!SupportedConnectionTypes.Contains(connectionType))
                    {
                        continue;
                    }

                    var keyResult = await ResolveDataKeyAsync(
                        library.RoleId,
                        null,
                        $"connection:{connectionType}",
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    connectionKeyMap[connectionType] = keyResult.DataKeyId;
                }

                if (infoKeyMap.Count > 0 || connectionKeyMap.Count > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                }

                var pendingInfos = 0;
                foreach (var info in request.Infos)
                {
                    var infoType = info.InfoType.Trim().ToLowerInvariant();
                    if (!SupportedInfoTypes.Contains(infoType))
                    {
                        continue;
                    }

                    infoKeyMap.TryGetValue(infoType, out var infoKeyId);
                    var created = await CreateInfoInternalAsync(
                        library,
                        new CogitaCreateInfoRequest(infoType, info.Payload, infoKeyId == Guid.Empty ? null : infoKeyId, null),
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    infoMap[info.InfoId] = created.InfoId;
                    pendingInfos++;
                    if (pendingInfos >= importBatchSize)
                    {
                        await dbContext.SaveChangesAsync(ct);
                        dbContext.ChangeTracker.Clear();
                        pendingInfos = 0;
                    }
                }

                if (pendingInfos > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                }

                var pendingConnections = 0;
                foreach (var connection in request.Connections)
                {
                    var connectionType = connection.ConnectionType.Trim().ToLowerInvariant();
                    if (!SupportedConnectionTypes.Contains(connectionType))
                    {
                        continue;
                    }
                    var mappedIds = connection.InfoIds
                        .Where(id => infoMap.ContainsKey(id))
                        .Select(id => infoMap[id])
                        .ToList();
                    if (mappedIds.Count == 0)
                    {
                        continue;
                    }

                    connectionKeyMap.TryGetValue(connectionType, out var connectionKeyId);
                    var created = await CreateConnectionInternalAsync(
                        library,
                        new CogitaCreateConnectionRequest(connectionType, mappedIds, connection.Payload, connectionKeyId == Guid.Empty ? null : connectionKeyId, null),
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    connectionMap[connection.ConnectionId] = created.ConnectionId;
                    pendingConnections++;
                    if (pendingConnections >= importBatchSize)
                    {
                        await dbContext.SaveChangesAsync(ct);
                        dbContext.ChangeTracker.Clear();
                        pendingConnections = 0;
                    }
                }

                if (pendingConnections > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                }

                var pendingCollections = 0;
                foreach (var collection in request.Collections)
                {
                    if (!infoMap.TryGetValue(collection.CollectionInfoId, out var collectionInfoId))
                    {
                        continue;
                    }

                    foreach (var item in collection.Items.OrderBy(x => x.SortOrder))
                    {
                        Guid mappedId;
                        if (item.ItemType == "info")
                        {
                            if (!infoMap.TryGetValue(item.ItemId, out mappedId))
                            {
                                continue;
                            }
                        }
                        else
                        {
                            if (!connectionMap.TryGetValue(item.ItemId, out mappedId))
                            {
                                continue;
                            }
                        }

                        dbContext.CogitaCollectionItems.Add(new CogitaCollectionItem
                        {
                            Id = Guid.NewGuid(),
                            CollectionInfoId = collectionInfoId,
                            ItemType = item.ItemType,
                            ItemId = mappedId,
                            SortOrder = item.SortOrder,
                            CreatedUtc = DateTimeOffset.UtcNow
                        });
                        pendingCollections++;
                        if (pendingCollections >= importBatchSize)
                        {
                            await dbContext.SaveChangesAsync(ct);
                            dbContext.ChangeTracker.Clear();
                            pendingCollections = 0;
                        }
                    }
                }

                if (pendingCollections > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                }
            }
            finally
            {
                dbContext.ChangeTracker.AutoDetectChangesEnabled = previousDetectChanges;
            }

            return Results.Ok(new CogitaLibraryImportResponse(
                infoMap.Count,
                connectionMap.Count,
                request.Collections.Count
            ));
        });

        group.MapPost("/libraries/{libraryId:guid}/import/stream", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            CogitaLibraryImportRequest? request;
            try
            {
                request = await JsonSerializer.DeserializeAsync<CogitaLibraryImportRequest>(
                    context.Request.Body,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                    ct);
            }
            catch (JsonException)
            {
                return Results.BadRequest(new { error = "Invalid import payload." });
            }

            if (request is null)
            {
                return Results.BadRequest(new { error = "Import payload is empty." });
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            context.Response.Headers.CacheControl = "no-cache";
            context.Response.Headers.Pragma = "no-cache";
            context.Response.Headers["X-Accel-Buffering"] = "no";
            context.Response.ContentType = "text/plain; charset=utf-8";

            await using var writer = new StreamWriter(context.Response.Body, leaveOpen: true);
            async Task WriteProgressAsync(string stage, int processed, int total, int infos, int connections, int collections)
            {
                var payload = JsonSerializer.Serialize(new
                {
                    stage,
                    processed,
                    total,
                    infos,
                    connections,
                    collections
                });
                await writer.WriteLineAsync($"progress {payload}");
                await writer.FlushAsync();
            }

            var infoMap = new Dictionary<Guid, Guid>();
            var connectionMap = new Dictionary<Guid, Guid>();
            var infoKeyMap = new Dictionary<string, Guid>();
            var connectionKeyMap = new Dictionary<string, Guid>();
            var importBatchSize = 200;
            var previousDetectChanges = dbContext.ChangeTracker.AutoDetectChangesEnabled;
            dbContext.ChangeTracker.AutoDetectChangesEnabled = false;

            try
            {
                foreach (var infoType in request.Infos.Select(x => x.InfoType.Trim().ToLowerInvariant()).Distinct())
                {
                    if (!SupportedInfoTypes.Contains(infoType))
                    {
                        continue;
                    }

                    var keyResult = await ResolveDataKeyAsync(
                        library.RoleId,
                        null,
                        $"info:{infoType}",
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    infoKeyMap[infoType] = keyResult.DataKeyId;
                }

                foreach (var connectionType in request.Connections.Select(x => x.ConnectionType.Trim().ToLowerInvariant()).Distinct())
                {
                    if (!SupportedConnectionTypes.Contains(connectionType))
                    {
                        continue;
                    }

                    var keyResult = await ResolveDataKeyAsync(
                        library.RoleId,
                        null,
                        $"connection:{connectionType}",
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    connectionKeyMap[connectionType] = keyResult.DataKeyId;
                }

                if (infoKeyMap.Count > 0 || connectionKeyMap.Count > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                }

                var totalInfos = request.Infos.Count;
                var totalConnections = request.Connections.Count;
                var totalCollections = request.Collections.Count;
                var pendingInfos = 0;
                var processedInfos = 0;
                foreach (var info in request.Infos)
                {
                    var infoType = info.InfoType.Trim().ToLowerInvariant();
                    if (!SupportedInfoTypes.Contains(infoType))
                    {
                        processedInfos++;
                        continue;
                    }

                    infoKeyMap.TryGetValue(infoType, out var infoKeyId);
                    var created = await CreateInfoInternalAsync(
                        library,
                        new CogitaCreateInfoRequest(infoType, info.Payload, infoKeyId == Guid.Empty ? null : infoKeyId, null),
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    infoMap[info.InfoId] = created.InfoId;
                    pendingInfos++;
                    processedInfos++;
                    if (pendingInfos >= importBatchSize)
                    {
                        await dbContext.SaveChangesAsync(ct);
                        dbContext.ChangeTracker.Clear();
                        pendingInfos = 0;
                        await WriteProgressAsync("infos", processedInfos, totalInfos, infoMap.Count, connectionMap.Count, 0);
                    }
                }

                if (pendingInfos > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                    await WriteProgressAsync("infos", processedInfos, totalInfos, infoMap.Count, connectionMap.Count, 0);
                }

                var pendingConnections = 0;
                var processedConnections = 0;
                foreach (var connection in request.Connections)
                {
                    var connectionType = connection.ConnectionType.Trim().ToLowerInvariant();
                    if (!SupportedConnectionTypes.Contains(connectionType))
                    {
                        processedConnections++;
                        continue;
                    }
                    var mappedIds = connection.InfoIds
                        .Where(id => infoMap.ContainsKey(id))
                        .Select(id => infoMap[id])
                        .ToList();
                    if (mappedIds.Count == 0)
                    {
                        processedConnections++;
                        continue;
                    }

                    connectionKeyMap.TryGetValue(connectionType, out var connectionKeyId);
                    var created = await CreateConnectionInternalAsync(
                        library,
                        new CogitaCreateConnectionRequest(connectionType, mappedIds, connection.Payload, connectionKeyId == Guid.Empty ? null : connectionKeyId, null),
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct,
                        saveChanges: false);
                    connectionMap[connection.ConnectionId] = created.ConnectionId;
                    pendingConnections++;
                    processedConnections++;
                    if (pendingConnections >= importBatchSize)
                    {
                        await dbContext.SaveChangesAsync(ct);
                        dbContext.ChangeTracker.Clear();
                        pendingConnections = 0;
                        await WriteProgressAsync("connections", processedConnections, totalConnections, infoMap.Count, connectionMap.Count, 0);
                    }
                }

                if (pendingConnections > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                    await WriteProgressAsync("connections", processedConnections, totalConnections, infoMap.Count, connectionMap.Count, 0);
                }

                var pendingCollections = 0;
                var processedCollections = 0;
                foreach (var collection in request.Collections)
                {
                    if (!infoMap.TryGetValue(collection.CollectionInfoId, out var collectionInfoId))
                    {
                        processedCollections++;
                        continue;
                    }

                    foreach (var item in collection.Items.OrderBy(x => x.SortOrder))
                    {
                        Guid mappedId;
                        if (item.ItemType == "info")
                        {
                            if (!infoMap.TryGetValue(item.ItemId, out mappedId))
                            {
                                continue;
                            }
                        }
                        else
                        {
                            if (!connectionMap.TryGetValue(item.ItemId, out mappedId))
                            {
                                continue;
                            }
                        }

                        dbContext.CogitaCollectionItems.Add(new CogitaCollectionItem
                        {
                            Id = Guid.NewGuid(),
                            CollectionInfoId = collectionInfoId,
                            ItemType = item.ItemType,
                            ItemId = mappedId,
                            SortOrder = item.SortOrder,
                            CreatedUtc = DateTimeOffset.UtcNow
                        });
                        pendingCollections++;
                        if (pendingCollections >= importBatchSize)
                        {
                            await dbContext.SaveChangesAsync(ct);
                            dbContext.ChangeTracker.Clear();
                            pendingCollections = 0;
                        }
                    }

                    processedCollections++;
                    if (processedCollections % Math.Max(1, importBatchSize / 5) == 0)
                    {
                        await WriteProgressAsync("collections", processedCollections, totalCollections, infoMap.Count, connectionMap.Count, processedCollections);
                    }
                }

                if (pendingCollections > 0)
                {
                    await dbContext.SaveChangesAsync(ct);
                    dbContext.ChangeTracker.Clear();
                }

                await WriteProgressAsync("collections", totalCollections, totalCollections, infoMap.Count, connectionMap.Count, processedCollections);
            }
            finally
            {
                dbContext.ChangeTracker.AutoDetectChangesEnabled = previousDetectChanges;
            }

            var response = new CogitaLibraryImportResponse(
                infoMap.Count,
                connectionMap.Count,
                request.Collections.Count
            );
            await writer.WriteLineAsync($"done {JsonSerializer.Serialize(response)}");
            await writer.FlushAsync();
            return Results.Empty;
        });

        group.MapPost("/libraries/{libraryId:guid}/infos", async (
            Guid libraryId,
            CogitaCreateInfoRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var infoType = request.InfoType.Trim().ToLowerInvariant();
            if (!SupportedInfoTypes.Contains(infoType))
            {
                return Results.BadRequest(new { error = "InfoType is invalid." });
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var infoId = Guid.NewGuid();
            (Guid DataKeyId, byte[] DataKey) dataKeyResult;
            try
            {
                dataKeyResult = await ResolveDataKeyAsync(
                    library.RoleId,
                    request.DataKeyId,
                    infoType,
                    readKey,
                    ownerKey,
                    userId,
                    keyRingService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
            }
            catch (InvalidOperationException)
            {
                return Results.BadRequest(new { error = "DataKeyId is invalid." });
            }

            var sanitizedPayload = infoType == "computed" ? SanitizeComputedPayload(request.Payload) : request.Payload;
            var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(sanitizedPayload);
            var encrypted = encryptionService.Encrypt(dataKeyResult.DataKey, payloadBytes, infoId.ToByteArray());

            dbContext.CogitaInfos.Add(new CogitaInfo
            {
                Id = infoId,
                LibraryId = libraryId,
                InfoType = infoType,
                CreatedUtc = now,
                UpdatedUtc = now
            });

            AddInfoPayload(infoType, infoId, dataKeyResult.DataKeyId, encrypted, now, dbContext);
            await UpsertInfoSearchIndexAsync(libraryId, infoId, infoType, sanitizedPayload, now, dbContext, ct);

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCreateInfoResponse(infoId, infoType));
        });

        group.MapPost("/libraries/{libraryId:guid}/connections", async (
            Guid libraryId,
            CogitaCreateConnectionRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var connectionType = request.ConnectionType.Trim().ToLowerInvariant();
            if (!SupportedConnectionTypes.Contains(connectionType))
            {
                return Results.BadRequest(new { error = "ConnectionType is invalid." });
            }

            var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            if (request.InfoIds.Count < 2)
            {
                return Results.BadRequest(new { error = "At least two InfoIds are required." });
            }

            var infoIds = request.InfoIds.Distinct().ToList();
            var infoCount = await dbContext.CogitaInfos.AsNoTracking()
                .CountAsync(x => x.LibraryId == libraryId && infoIds.Contains(x.Id), ct);
            if (infoCount != infoIds.Count)
            {
                return Results.BadRequest(new { error = "InfoIds must belong to the library." });
            }

            var now = DateTimeOffset.UtcNow;
            var connectionId = Guid.NewGuid();
            Guid? languageInfoId = null;
            Guid? wordInfoId = null;

            if (connectionType == "word-language")
            {
                if (infoIds.Count != 2)
                {
                    return Results.BadRequest(new { error = "Word-language connections require exactly two infos." });
                }

                var infoTypes = await dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => infoIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.InfoType })
                    .ToListAsync(ct);
                foreach (var info in infoTypes)
                {
                    if (info.InfoType == "language")
                    {
                        languageInfoId = info.Id;
                    }
                    else if (info.InfoType == "word")
                    {
                        wordInfoId = info.Id;
                    }
                }

                if (!languageInfoId.HasValue || !wordInfoId.HasValue)
                {
                    return Results.BadRequest(new { error = "Word-language connections require one language and one word." });
                }

                var exists = await dbContext.CogitaWordLanguages.AsNoTracking()
                    .AnyAsync(x => x.LanguageInfoId == languageInfoId.Value && x.WordInfoId == wordInfoId.Value, ct);
                if (exists)
                {
                    return Results.Conflict(new { error = "Word is already connected to this language." });
                }
            }
            (Guid DataKeyId, byte[] DataKey) dataKeyResult;
            try
            {
                dataKeyResult = await ResolveDataKeyAsync(
                    library.RoleId,
                    request.DataKeyId,
                    $"connection:{connectionType}",
                    readKey,
                    ownerKey,
                    userId,
                    keyRingService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
            }
            catch (InvalidOperationException)
            {
                return Results.BadRequest(new { error = "DataKeyId is invalid." });
            }

            var payload = request.Payload.HasValue
                ? JsonSerializer.SerializeToUtf8Bytes(request.Payload.Value)
                : JsonSerializer.SerializeToUtf8Bytes(new { infoIds });
            var encrypted = encryptionService.Encrypt(dataKeyResult.DataKey, payload, connectionId.ToByteArray());

            var typeHash = HMACSHA256.HashData(dataKeyResult.DataKey, JsonSerializer.SerializeToUtf8Bytes(connectionType));

            dbContext.CogitaConnections.Add(new CogitaConnection
            {
                Id = connectionId,
                LibraryId = libraryId,
                ConnectionType = connectionType,
                ConnectionTypeHash = typeHash,
                DataKeyId = dataKeyResult.DataKeyId,
                EncryptedBlob = encrypted,
                CreatedUtc = now,
                UpdatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);

            if (connectionType == "word-language" && languageInfoId.HasValue && wordInfoId.HasValue)
            {
                dbContext.CogitaWordLanguages.Add(new CogitaWordLanguage
                {
                    LanguageInfoId = languageInfoId.Value,
                    WordInfoId = wordInfoId.Value,
                    CreatedUtc = now
                });
                await dbContext.SaveChangesAsync(ct);
            }

            var sort = 0;
            foreach (var infoId in infoIds)
            {
                dbContext.CogitaConnectionItems.Add(new CogitaConnectionItem
                {
                    Id = Guid.NewGuid(),
                    ConnectionId = connectionId,
                    InfoId = infoId,
                    SortOrder = sort++
                });
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCreateConnectionResponse(connectionId, connectionType));
        });

        group.MapDelete("/libraries/{libraryId:guid}/connections/{connectionId:guid}", async (
            Guid libraryId,
            Guid connectionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var connection = await dbContext.CogitaConnections
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Id == connectionId, ct);
            if (connection is null)
            {
                return Results.NotFound();
            }

            var connectionItems = await dbContext.CogitaConnectionItems
                .Where(x => x.ConnectionId == connectionId)
                .ToListAsync(ct);
            var infoIds = connectionItems.Select(x => x.InfoId).Distinct().ToList();


            if (connectionItems.Count > 0)
            {
                dbContext.CogitaConnectionItems.RemoveRange(connectionItems);
            }

            var collectionItems = await dbContext.CogitaCollectionItems
                .Where(x => x.ItemType == "connection" && x.ItemId == connectionId)
                .ToListAsync(ct);
            if (collectionItems.Count > 0)
            {
                dbContext.CogitaCollectionItems.RemoveRange(collectionItems);
            }

            var outcomes = await dbContext.CogitaReviewOutcomes
                .Where(x => x.LibraryId == libraryId && x.ItemType == "connection" && x.ItemId == connectionId)
                .ToListAsync(ct);
            if (outcomes.Count > 0)
            {
                dbContext.CogitaReviewOutcomes.RemoveRange(outcomes);
            }

            dbContext.CogitaConnections.Remove(connection);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { deleted = true });
        });

        group.MapGet("/libraries/{libraryId:guid}/word-languages", async (
            Guid libraryId,
            Guid languageId,
            Guid wordId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
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

            if (!keyRing.TryGetReadKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var infoTypes = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && (x.Id == languageId || x.Id == wordId))
                .Select(x => new { x.Id, x.InfoType })
                .ToListAsync(ct);
            if (infoTypes.Count != 2)
            {
                return Results.Ok(new { exists = false });
            }

            var languageOk = infoTypes.Any(x => x.Id == languageId && x.InfoType == "language");
            var wordOk = infoTypes.Any(x => x.Id == wordId && x.InfoType == "word");
            if (!languageOk || !wordOk)
            {
                return Results.Ok(new { exists = false });
            }

            var exists = await dbContext.CogitaWordLanguages.AsNoTracking()
                .AnyAsync(x => x.LanguageInfoId == languageId && x.WordInfoId == wordId, ct);

            return Results.Ok(new { exists });
        });

        group.MapPost("/libraries/{libraryId:guid}/groups", async (
            Guid libraryId,
            CogitaCreateGroupRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("CogitaEndpoints");
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            try
            {
                var groupType = request.GroupType.Trim().ToLowerInvariant();
                if (!SupportedGroupTypes.Contains(groupType))
                {
                    return Results.BadRequest(new { error = "GroupType is invalid." });
                }

                var library = await dbContext.CogitaLibraries.FirstOrDefaultAsync(x => x.Id == libraryId, ct);
                if (library is null)
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

                if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                    !keyRing.TryGetWriteKey(library.RoleId, out var writeKey) ||
                    !keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
                {
                    return Results.Forbid();
                }

                await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);
                var infoIds = new List<Guid>();
                var infoTypeMap = new List<(Guid InfoId, string InfoType)>();

                var infoRequests = request.InfoItems ?? new List<CogitaGroupInfoRequest>();
                var connectionRequests = request.Connections ?? new List<CogitaGroupConnectionRequest>();

                foreach (var infoRequest in infoRequests)
                {
                    if (infoRequest.InfoId.HasValue)
                    {
                        var resolvedId = infoRequest.InfoId.Value;
                        infoIds.Add(resolvedId);
                        infoTypeMap.Add((resolvedId, infoRequest.InfoType.Trim().ToLowerInvariant()));
                        continue;
                    }

                    var createRequest = new CogitaCreateInfoRequest(
                        infoRequest.InfoType,
                        infoRequest.Payload,
                        null,
                        request.SignatureBase64);
                    var infoResult = await CreateInfoInternalAsync(
                        library,
                        createRequest,
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct);

                    infoIds.Add(infoResult.InfoId);
                    infoTypeMap.Add((infoResult.InfoId, infoResult.InfoType));
                }

                var connectionIds = new List<Guid>();
                foreach (var connectionRequest in connectionRequests)
                {
                    if (connectionRequest.ConnectionId.HasValue)
                    {
                        connectionIds.Add(connectionRequest.ConnectionId.Value);
                        continue;
                    }

                    var resolvedInfoIds = connectionRequest.InfoIds;
                    if (resolvedInfoIds.Count == 0)
                    {
                        var wordIds = infoTypeMap
                            .Where(item => item.InfoType == "word")
                            .Select(item => item.InfoId)
                            .ToList();
                        resolvedInfoIds = wordIds.Count >= 2 ? wordIds : infoIds;
                    }

                    var createRequest = new CogitaCreateConnectionRequest(
                        connectionRequest.ConnectionType,
                        resolvedInfoIds,
                        connectionRequest.Payload,
                        null,
                        request.SignatureBase64);
                    var connectionResult = await CreateConnectionInternalAsync(
                        library,
                        createRequest,
                        readKey,
                        ownerKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct);

                    connectionIds.Add(connectionResult.ConnectionId);
                }

                await dbContext.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);

                return Results.Ok(new CogitaCreateGroupResponse(groupType, infoIds, connectionIds));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to create cogita group.");
                return Results.Problem("Failed to create group.");
            }
        });
    }

    private static string? ResolveLabel(JsonElement payload, string infoType)
    {
        if (payload.ValueKind == JsonValueKind.Object)
        {
            if (payload.TryGetProperty("label", out var label) && label.ValueKind == JsonValueKind.String)
            {
                return label.GetString();
            }
            if (payload.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
            {
                return text.GetString();
            }
            if (payload.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
            {
                return name.GetString();
            }
            if (payload.TryGetProperty("title", out var title) && title.ValueKind == JsonValueKind.String)
            {
                return title.GetString();
            }
        }

        return infoType;
    }

    private static string? ResolveDescription(JsonElement payload, string infoType)
    {
        if (payload.ValueKind == JsonValueKind.Object)
        {
            if (payload.TryGetProperty("notes", out var notes) && notes.ValueKind == JsonValueKind.String)
            {
                return notes.GetString();
            }
            if (payload.TryGetProperty("description", out var description) && description.ValueKind == JsonValueKind.String)
            {
                return description.GetString();
            }
            if (payload.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
            {
                return text.GetString();
            }
        }

        return infoType;
    }

    private static JsonElement SanitizeComputedPayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return payload;
        }

        try
        {
            var node = JsonNode.Parse(payload.GetRawText()) as JsonObject;
            if (node is null)
            {
                return payload;
            }

            node.Remove("notes");
            node.Remove("promptTemplate");

            if (node["definition"] is JsonObject definition)
            {
                definition.Remove("notes");
                definition.Remove("promptTemplate");
            }

            return JsonSerializer.SerializeToElement(node);
        }
        catch
        {
            return payload;
        }
    }

    private static async Task<Dictionary<Guid, string>> ResolveInfoLabelsAsync(
        Guid libraryId,
        string infoType,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var lookup = await BuildInfoLookupAsync(libraryId, infoType, dbContext, ct);
        if (lookup.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var dataKeyIds = lookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
        var keyEntryById = await dbContext.Keys.AsNoTracking()
            .Where(x => dataKeyIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);

        var labels = new Dictionary<Guid, string>();
        foreach (var entry in lookup.Values)
        {
            if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
            {
                continue;
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                continue;
            }

            try
            {
                var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                var label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                labels[entry.InfoId] = label;
            }
            catch (CryptographicException)
            {
                continue;
            }
        }

        return labels;
    }

    private static async Task<Dictionary<Guid, string>> ResolveInfoLabelsAsync(
        Guid libraryId,
        string infoType,
        IReadOnlyCollection<Guid> infoIds,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (infoIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var lookup = await BuildInfoLookupAsync(libraryId, infoType, infoIds, dbContext, ct);
        if (lookup.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var dataKeyIds = lookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
        var keyEntryById = await dbContext.Keys.AsNoTracking()
            .Where(x => dataKeyIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);

        var labels = new Dictionary<Guid, string>();
        foreach (var entry in lookup.Values)
        {
            if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
            {
                continue;
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                continue;
            }

            try
            {
                var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                var label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                labels[entry.InfoId] = label;
            }
            catch (CryptographicException)
            {
                continue;
            }
        }

        return labels;
    }

    private static async Task<Dictionary<Guid, (Guid InfoId, string InfoType, Guid DataKeyId, byte[] EncryptedBlob)>> BuildInfoLookupAsync(
        Guid libraryId,
        string? infoType,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var infos = await dbContext.CogitaInfos.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && (infoType == null || x.InfoType == infoType))
            .ToListAsync(ct);

        var lookup = new Dictionary<Guid, (Guid, string, Guid, byte[])>();
        foreach (var info in infos)
        {
            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                continue;
            }
            lookup[info.Id] = (info.Id, info.InfoType, payload.Value.DataKeyId, payload.Value.EncryptedBlob);
        }

        return lookup;
    }

    private static async Task<Dictionary<Guid, (Guid InfoId, string InfoType, Guid DataKeyId, byte[] EncryptedBlob)>> BuildInfoLookupAsync(
        Guid libraryId,
        string? infoType,
        IReadOnlyCollection<Guid> infoIds,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (infoIds.Count == 0)
        {
            return new Dictionary<Guid, (Guid, string, Guid, byte[])>();
        }

        var infos = await dbContext.CogitaInfos.AsNoTracking()
            .Where(x => x.LibraryId == libraryId &&
                        (infoType == null || x.InfoType == infoType) &&
                        infoIds.Contains(x.Id))
            .ToListAsync(ct);

        var lookup = new Dictionary<Guid, (Guid, string, Guid, byte[])>();
        foreach (var info in infos)
        {
            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                continue;
            }
            lookup[info.Id] = (info.Id, info.InfoType, payload.Value.DataKeyId, payload.Value.EncryptedBlob);
        }

        return lookup;
    }

    private static async Task<(Guid DataKeyId, byte[] EncryptedBlob)?> LoadInfoPayloadAsync(
        CogitaInfo info,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        switch (info.InfoType)
        {
            case "language":
                {
                    var row = await dbContext.CogitaLanguages.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "word":
                {
                    var row = await dbContext.CogitaWords.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "sentence":
                {
                    var row = await dbContext.CogitaSentences.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "topic":
                {
                    var row = await dbContext.CogitaTopics.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "collection":
                {
                    var row = await dbContext.CogitaCollections.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "person":
                {
                    var row = await dbContext.CogitaPersons.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "address":
                {
                    var row = await dbContext.CogitaAddresses.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "email":
                {
                    var row = await dbContext.CogitaEmails.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "phone":
                {
                    var row = await dbContext.CogitaPhones.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "book":
                {
                    var row = await dbContext.CogitaBooks.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "media":
                {
                    var row = await dbContext.CogitaMedia.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "geo":
                {
                    var row = await dbContext.CogitaGeoFeatures.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "music_piece":
                {
                    var row = await dbContext.CogitaMusicPieces.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "music_fragment":
                {
                    var row = await dbContext.CogitaMusicFragments.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "computed":
                {
                    var row = await dbContext.CogitaComputedInfos.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            default:
                return null;
        }
    }

    private static void AddInfoPayload(
        string infoType,
        Guid infoId,
        Guid dataKeyId,
        byte[] encrypted,
        DateTimeOffset now,
        RecreatioDbContext dbContext)
    {
        switch (infoType)
        {
            case "language":
                dbContext.CogitaLanguages.Add(new CogitaLanguage { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "word":
                dbContext.CogitaWords.Add(new CogitaWord { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "sentence":
                dbContext.CogitaSentences.Add(new CogitaSentence { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "topic":
                dbContext.CogitaTopics.Add(new CogitaTopic { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "collection":
                dbContext.CogitaCollections.Add(new CogitaCollection { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "person":
                dbContext.CogitaPersons.Add(new CogitaPerson { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "address":
                dbContext.CogitaAddresses.Add(new CogitaAddress { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "email":
                dbContext.CogitaEmails.Add(new CogitaEmail { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "phone":
                dbContext.CogitaPhones.Add(new CogitaPhone { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "book":
                dbContext.CogitaBooks.Add(new CogitaBook { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "media":
                dbContext.CogitaMedia.Add(new CogitaMedia { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "geo":
                dbContext.CogitaGeoFeatures.Add(new CogitaGeoFeature { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "music_piece":
                dbContext.CogitaMusicPieces.Add(new CogitaMusicPiece { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "music_fragment":
                dbContext.CogitaMusicFragments.Add(new CogitaMusicFragment { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "computed":
                dbContext.CogitaComputedInfos.Add(new CogitaComputedInfo { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
        }
    }

    private static bool UpdateInfoPayload(
        string infoType,
        Guid infoId,
        Guid dataKeyId,
        byte[] encrypted,
        DateTimeOffset now,
        RecreatioDbContext dbContext)
    {
        switch (infoType)
        {
            case "language":
                {
                    var row = dbContext.CogitaLanguages.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "word":
                {
                    var row = dbContext.CogitaWords.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "sentence":
                {
                    var row = dbContext.CogitaSentences.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "topic":
                {
                    var row = dbContext.CogitaTopics.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "collection":
                {
                    var row = dbContext.CogitaCollections.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "person":
                {
                    var row = dbContext.CogitaPersons.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "address":
                {
                    var row = dbContext.CogitaAddresses.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "email":
                {
                    var row = dbContext.CogitaEmails.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "phone":
                {
                    var row = dbContext.CogitaPhones.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "book":
                {
                    var row = dbContext.CogitaBooks.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "media":
                {
                    var row = dbContext.CogitaMedia.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "geo":
                {
                    var row = dbContext.CogitaGeoFeatures.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "music_piece":
                {
                    var row = dbContext.CogitaMusicPieces.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "music_fragment":
                {
                    var row = dbContext.CogitaMusicFragments.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "computed":
                {
                    var row = dbContext.CogitaComputedInfos.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            default:
                return false;
        }
    }

    private static string NormalizeLabel(string? label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return string.Empty;
        }

        var lower = label.Trim().ToLowerInvariant();
        var builder = new StringBuilder(lower.Length);
        var lastWasSpace = false;
        foreach (var ch in lower)
        {
            if (char.IsWhiteSpace(ch))
            {
                if (!lastWasSpace)
                {
                    builder.Append(' ');
                    lastWasSpace = true;
                }
                continue;
            }

            lastWasSpace = false;
            builder.Append(ch);
        }

        var normalized = builder.ToString();
        return normalized.Length > 256 ? normalized[..256] : normalized;
    }

    private static byte[] HashLabel(string normalized)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
    }

    private static async Task UpsertInfoSearchIndexAsync(
        Guid libraryId,
        Guid infoId,
        string infoType,
        JsonElement payload,
        DateTimeOffset now,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var label = ResolveLabel(payload, infoType) ?? infoType;
        var normalized = NormalizeLabel(label);
        var hash = HashLabel(normalized);

        var existing = await dbContext.CogitaInfoSearchIndexes
            .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.InfoId == infoId, ct);
        if (existing is null)
        {
            dbContext.CogitaInfoSearchIndexes.Add(new CogitaInfoSearchIndex
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                InfoId = infoId,
                InfoType = infoType,
                Label = label,
                LabelNormalized = normalized,
                LabelHash = hash,
                UpdatedUtc = now
            });
            return;
        }

        existing.InfoType = infoType;
        existing.Label = label;
        existing.LabelNormalized = normalized;
        existing.LabelHash = hash;
        existing.UpdatedUtc = now;
    }

    private static async Task EnsureInfoSearchIndexAsync(
        Guid libraryId,
        string? infoType,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var infoIds = await dbContext.CogitaInfos.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && (infoType == null || x.InfoType == infoType))
            .Select(x => x.Id)
            .ToListAsync(ct);

        if (infoIds.Count == 0)
        {
            return;
        }

        var indexedInfoIds = await dbContext.CogitaInfoSearchIndexes.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && (infoType == null || x.InfoType == infoType))
            .Select(x => x.InfoId)
            .ToListAsync(ct);

        var missingIds = infoIds.Except(indexedInfoIds).ToList();
        if (missingIds.Count == 0)
        {
            return;
        }

        var lookup = await BuildInfoLookupAsync(libraryId, infoType, missingIds, dbContext, ct);
        if (lookup.Count == 0)
        {
            return;
        }

        var dataKeyIds = lookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
        var keyEntryById = await dbContext.Keys.AsNoTracking()
            .Where(x => dataKeyIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);

        var now = DateTimeOffset.UtcNow;
        var inserts = new List<CogitaInfoSearchIndex>();

        foreach (var entry in lookup.Values)
        {
            if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
            {
                continue;
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                continue;
            }

            try
            {
                var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                var label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                var normalized = NormalizeLabel(label);
                inserts.Add(new CogitaInfoSearchIndex
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    InfoId = entry.InfoId,
                    InfoType = entry.InfoType,
                    Label = label,
                    LabelNormalized = normalized,
                    LabelHash = HashLabel(normalized),
                    UpdatedUtc = now
                });
            }
            catch (CryptographicException)
            {
                continue;
            }
            catch (JsonException)
            {
                continue;
            }
        }

        if (inserts.Count > 0)
        {
            dbContext.CogitaInfoSearchIndexes.AddRange(inserts);
            await dbContext.SaveChangesAsync(ct);
        }
    }

    private static async Task<(Guid DataKeyId, byte[] DataKey)> ResolveDataKeyAsync(
        Guid roleId,
        Guid? dataKeyId,
        string metadata,
        byte[] readKey,
        byte[] ownerKey,
        Guid userId,
        IKeyRingService keyRingService,
        IRoleCryptoService roleCryptoService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct,
        bool saveChanges = true)
    {
        if (dataKeyId.HasValue)
        {
            var entry = await dbContext.Keys.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == dataKeyId.Value && x.OwnerRoleId == roleId && x.KeyType == KeyType.DataKey, ct);
            if (entry is null)
            {
                throw new InvalidOperationException("DataKeyId not found.");
            }

            var dataKey = keyRingService.DecryptDataKey(entry, readKey);
            return (dataKeyId.Value, dataKey);
        }

        var newKeyId = Guid.NewGuid();
        var newKey = RandomNumberGenerator.GetBytes(32);
        var encryptedDataKey = keyRingService.EncryptDataKey(readKey, newKey, newKeyId);
        var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, ownerKey, ct);
        var keyLedger = await ledgerService.AppendKeyAsync(
            "CogitaDataKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { roleId, dataKeyId = newKeyId, metadata }),
            ct,
            signingContext);

        dbContext.Keys.Add(new KeyEntry
        {
            Id = newKeyId,
            KeyType = KeyType.DataKey,
            OwnerRoleId = roleId,
            Version = 1,
            EncryptedKeyBlob = encryptedDataKey,
            ScopeType = "cogita",
            ScopeSubtype = metadata,
            LedgerRefId = keyLedger.Id,
            CreatedUtc = DateTimeOffset.UtcNow
        });

        if (saveChanges)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        return (newKeyId, newKey);
    }

    private static async Task<CogitaCreateInfoResponse> CreateInfoInternalAsync(
        CogitaLibrary library,
        CogitaCreateInfoRequest request,
        byte[] readKey,
        byte[] ownerKey,
        Guid userId,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        IRoleCryptoService roleCryptoService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct,
        bool saveChanges = true)
    {
        var infoType = request.InfoType.Trim().ToLowerInvariant();
        if (!SupportedInfoTypes.Contains(infoType))
        {
            throw new InvalidOperationException("InfoType is invalid.");
        }

        var now = DateTimeOffset.UtcNow;
        var infoId = Guid.NewGuid();
        var dataKeyResult = await ResolveDataKeyAsync(
            library.RoleId,
            request.DataKeyId,
            infoType,
            readKey,
            ownerKey,
            userId,
            keyRingService,
            roleCryptoService,
            ledgerService,
            dbContext,
            ct,
            saveChanges);

        var sanitizedPayload = infoType == "computed" ? SanitizeComputedPayload(request.Payload) : request.Payload;
        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(sanitizedPayload);
        var encrypted = encryptionService.Encrypt(dataKeyResult.DataKey, payloadBytes, infoId.ToByteArray());

        dbContext.CogitaInfos.Add(new CogitaInfo
        {
            Id = infoId,
            LibraryId = library.Id,
            InfoType = infoType,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        AddInfoPayload(infoType, infoId, dataKeyResult.DataKeyId, encrypted, now, dbContext);
        await UpsertInfoSearchIndexAsync(library.Id, infoId, infoType, sanitizedPayload, now, dbContext, ct);
        dbContext.KeyEntryBindings.Add(new KeyEntryBinding
        {
            Id = Guid.NewGuid(),
            KeyEntryId = dataKeyResult.DataKeyId,
            EntryId = infoId,
            EntryType = "cogita-info",
            EntrySubtype = infoType,
            CreatedUtc = now
        });

        if (saveChanges)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        return new CogitaCreateInfoResponse(infoId, infoType);
    }

    private static async Task<CogitaCreateConnectionResponse> CreateConnectionInternalAsync(
        CogitaLibrary library,
        CogitaCreateConnectionRequest request,
        byte[] readKey,
        byte[] ownerKey,
        Guid userId,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        IRoleCryptoService roleCryptoService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct,
        bool saveChanges = true)
    {
        var connectionType = request.ConnectionType.Trim().ToLowerInvariant();
        if (!SupportedConnectionTypes.Contains(connectionType))
        {
            throw new InvalidOperationException("ConnectionType is invalid.");
        }

        var now = DateTimeOffset.UtcNow;
        var connectionId = Guid.NewGuid();
        Guid? languageInfoId = null;
        Guid? wordInfoId = null;

        if (connectionType == "word-language")
        {
            var distinctIds = request.InfoIds.Distinct().ToList();
            if (distinctIds.Count != 2)
            {
                throw new InvalidOperationException("Word-language connections require exactly two infos.");
            }

            var infoTypes = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => distinctIds.Contains(x.Id))
                .Select(x => new { x.Id, x.InfoType })
                .ToListAsync(ct);
            if (infoTypes.Count != 2)
            {
                throw new InvalidOperationException("Word-language infos were not found.");
            }

            foreach (var info in infoTypes)
            {
                if (info.InfoType == "language")
                {
                    languageInfoId = info.Id;
                }
                else if (info.InfoType == "word")
                {
                    wordInfoId = info.Id;
                }
            }

            if (!languageInfoId.HasValue || !wordInfoId.HasValue)
            {
                throw new InvalidOperationException("Word-language connections require one language and one word.");
            }

            var exists = await dbContext.CogitaWordLanguages.AsNoTracking()
                .AnyAsync(x => x.LanguageInfoId == languageInfoId.Value && x.WordInfoId == wordInfoId.Value, ct);
            if (exists)
            {
                throw new InvalidOperationException("Word is already connected to this language.");
            }
        }
        var dataKeyResult = await ResolveDataKeyAsync(
            library.RoleId,
            request.DataKeyId,
            $"connection:{connectionType}",
            readKey,
            ownerKey,
            userId,
            keyRingService,
            roleCryptoService,
            ledgerService,
            dbContext,
            ct,
            saveChanges);

        var payload = request.Payload.HasValue
            ? JsonSerializer.SerializeToUtf8Bytes(request.Payload.Value)
            : JsonSerializer.SerializeToUtf8Bytes(new { infoIds = request.InfoIds });
        var encrypted = encryptionService.Encrypt(dataKeyResult.DataKey, payload, connectionId.ToByteArray());
        var typeHash = HMACSHA256.HashData(dataKeyResult.DataKey, JsonSerializer.SerializeToUtf8Bytes(connectionType));

        dbContext.CogitaConnections.Add(new CogitaConnection
        {
            Id = connectionId,
            LibraryId = library.Id,
            ConnectionType = connectionType,
            ConnectionTypeHash = typeHash,
            DataKeyId = dataKeyResult.DataKeyId,
            EncryptedBlob = encrypted,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.KeyEntryBindings.Add(new KeyEntryBinding
        {
            Id = Guid.NewGuid(),
            KeyEntryId = dataKeyResult.DataKeyId,
            EntryId = connectionId,
            EntryType = "cogita-connection",
            EntrySubtype = connectionType,
            CreatedUtc = now
        });

        if (saveChanges)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        if (connectionType == "word-language" && languageInfoId.HasValue && wordInfoId.HasValue)
        {
            dbContext.CogitaWordLanguages.Add(new CogitaWordLanguage
            {
                LanguageInfoId = languageInfoId.Value,
                WordInfoId = wordInfoId.Value,
                CreatedUtc = now
            });
            if (saveChanges)
            {
                await dbContext.SaveChangesAsync(ct);
            }
        }

        var sort = 0;
        foreach (var infoId in request.InfoIds.Distinct())
        {
            dbContext.CogitaConnectionItems.Add(new CogitaConnectionItem
            {
                Id = Guid.NewGuid(),
                ConnectionId = connectionId,
                InfoId = infoId,
                SortOrder = sort++
            });
        }

        if (saveChanges)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        return new CogitaCreateConnectionResponse(connectionId, connectionType);
    }

    private sealed record TranslationGraphItem(
        Guid ConnectionId,
        Guid WordAId,
        Guid WordBId,
        Guid LanguageAId,
        Guid LanguageBId,
        HashSet<Guid> TranslationTags,
        HashSet<Guid> WordATags,
        HashSet<Guid> WordBTags);

    private sealed record GraphDataset(HashSet<Guid> Connections, HashSet<Guid> Infos)
    {
        public static GraphDataset Empty => new(new HashSet<Guid>(), new HashSet<Guid>());
    }

    private sealed record GraphEvaluationResult(
        List<(string ItemType, Guid ItemId)> Items,
        int ConnectionCount,
        int InfoCount)
    {
        public int Total => ConnectionCount + InfoCount;
    }

    private sealed record ComputedGraphResult(
        string Prompt,
        string ExpectedAnswer,
        Dictionary<string, string> ExpectedAnswers,
        Dictionary<string, double> Values
    );

    private static async Task<GraphEvaluationResult> EvaluateCollectionGraphAsync(
        Guid libraryId,
        CogitaCollectionGraph graph,
        List<CogitaCollectionGraphNode> nodes,
        List<CogitaCollectionGraphEdge> edges,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (nodes.Count == 0)
        {
            return new GraphEvaluationResult(new List<(string, Guid)>(), 0, 0);
        }

        var nodeLookup = nodes
            .GroupBy(x => x.Id)
            .ToDictionary(group => group.Key, group => group.First());
        var incoming = edges.GroupBy(x => x.ToNodeId).ToDictionary(x => x.Key, x => x.Select(e => e.FromNodeId).ToList());

        var translationLookup = await LoadTranslationGraphItemsAsync(
            libraryId,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);

        var nodeParams = await LoadGraphNodeParamsAsync(
            nodes,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);

        var infoSources = await LoadInfoSourceNodesAsync(libraryId, nodeParams, nodes, dbContext, ct);
        var connectionSources = await LoadConnectionSourceNodesAsync(libraryId, nodeParams, nodes, dbContext, ct);
        var memo = new Dictionary<Guid, GraphDataset>();

        GraphDataset EvaluateNode(Guid nodeId)
        {
            if (memo.TryGetValue(nodeId, out var cached))
            {
                return cached;
            }

            if (!nodeLookup.TryGetValue(nodeId, out var node))
            {
                return GraphDataset.Empty;
            }

            var nodeType = node.NodeType.Trim().ToLowerInvariant();
            var inputs = incoming.TryGetValue(nodeId, out var sources)
                ? sources.Select(EvaluateNode).ToList()
                : new List<GraphDataset>();

            GraphDataset result;
            switch (nodeType)
            {
                case "source.translation":
                    result = new GraphDataset(translationLookup.Keys.ToHashSet(), new HashSet<Guid>());
                    break;
                case "source.info":
                    result = infoSources.TryGetValue(nodeId, out var infoSet)
                        ? new GraphDataset(new HashSet<Guid>(), infoSet)
                        : GraphDataset.Empty;
                    break;
                case "source.connection":
                    result = connectionSources.TryGetValue(nodeId, out var connSet)
                        ? new GraphDataset(connSet, new HashSet<Guid>())
                        : GraphDataset.Empty;
                    break;
                case "filter.tag":
                    result = ApplyTagFilter(inputs.FirstOrDefault(), nodeParams.GetValueOrDefault(nodeId), translationLookup);
                    break;
                case "filter.language":
                    result = ApplyLanguageFilter(inputs.FirstOrDefault(), nodeParams.GetValueOrDefault(nodeId), translationLookup);
                    break;
                case "logic.and":
                    result = IntersectDatasets(inputs);
                    break;
                case "logic.or":
                    result = UnionDatasets(inputs);
                    break;
                case "output.collection":
                    result = inputs.Count > 0 ? UnionDatasets(inputs) : GraphDataset.Empty;
                    break;
                default:
                    result = GraphDataset.Empty;
                    break;
            }

            memo[nodeId] = result;
            return result;
        }

        var outputIds = nodes
            .Where(n => n.NodeType.Trim().Equals("output.collection", StringComparison.OrdinalIgnoreCase))
            .Select(n => n.Id)
            .ToList();

        var outputDataset = outputIds.Count == 0
            ? GraphDataset.Empty
            : UnionDatasets(outputIds.Select(EvaluateNode));

        var items = outputDataset.Connections.Select(id => ("connection", id))
            .Concat(outputDataset.Infos.Select(id => ("info", id)))
            .ToList();
        return new GraphEvaluationResult(items, outputDataset.Connections.Count, outputDataset.Infos.Count);
    }

    private static CogitaComputedSampleResponse BuildComputedSample(JsonElement payload)
    {
        var values = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        var promptTemplate = string.Empty;
        ComputedGraphResult? graphResult = null;
        JsonElement? definition = null;
        if (payload.TryGetProperty("definition", out var definitionEl) && definitionEl.ValueKind == JsonValueKind.Object)
        {
            definition = definitionEl;
        }

        if (definition.HasValue)
        {
            if (definition.Value.TryGetProperty("graph", out var defGraph) && defGraph.ValueKind == JsonValueKind.Object)
            {
                graphResult = EvaluateComputedGraph(defGraph, promptTemplate);
            }
            else
            {
                graphResult = EvaluateComputedGraph(definition.Value, promptTemplate);
            }
        }
        else if (payload.TryGetProperty("graph", out var graphElement) && graphElement.ValueKind == JsonValueKind.Object)
        {
            graphResult = EvaluateComputedGraph(graphElement, promptTemplate);
        }

        if (graphResult is not null)
        {
            return new CogitaComputedSampleResponse(graphResult.Prompt, graphResult.ExpectedAnswer, graphResult.ExpectedAnswers, graphResult.Values);
        }

        var fallbackLabel = payload.TryGetProperty("label", out var labelEl) && labelEl.ValueKind == JsonValueKind.String
            ? labelEl.GetString() ?? "Computed"
            : "Computed";
        return new CogitaComputedSampleResponse(fallbackLabel, string.Empty, new Dictionary<string, string>(), values);
    }

    private static ComputedGraphResult EvaluateComputedGraph(JsonElement graphElement, string promptTemplate)
    {
        var nodes = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        var nodeNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var outputLabels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (graphElement.TryGetProperty("nodes", out var nodesElement) && nodesElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var node in nodesElement.EnumerateArray())
            {
                if (node.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String)
                {
                    var nodeId = idEl.GetString();
                    if (!string.IsNullOrWhiteSpace(nodeId))
                    {
                        nodes[nodeId] = node;
                        if (node.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
                        {
                            var name = nameEl.GetString();
                            if (!string.IsNullOrWhiteSpace(name))
                            {
                                nodeNames[nodeId] = name;
                            }
                        }
                        if (node.TryGetProperty("outputLabel", out var labelEl) && labelEl.ValueKind == JsonValueKind.String)
                        {
                            var label = labelEl.GetString();
                            if (!string.IsNullOrWhiteSpace(label))
                            {
                                outputLabels[nodeId] = label;
                            }
                        }
                    }
                }
            }
        }

        var outputIds = new List<string>();
        if (graphElement.TryGetProperty("outputs", out var outputsEl) && outputsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in outputsEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var id = item.GetString();
                    if (!string.IsNullOrWhiteSpace(id))
                    {
                        outputIds.Add(id);
                    }
                }
            }
        }
        if (outputIds.Count == 0)
        {
            var outputNodeId = graphElement.TryGetProperty("output", out var outputEl) && outputEl.ValueKind == JsonValueKind.String
                ? outputEl.GetString()
                : graphElement.TryGetProperty("outputNodeId", out var outputIdEl) && outputIdEl.ValueKind == JsonValueKind.String
                    ? outputIdEl.GetString()
                    : null;
            if (!string.IsNullOrWhiteSpace(outputNodeId))
            {
                outputIds.Add(outputNodeId!);
            }
        }
        if (outputIds.Count == 0)
        {
            foreach (var pair in nodes)
            {
                if (pair.Value.TryGetProperty("type", out var typeEl) &&
                    typeEl.ValueKind == JsonValueKind.String &&
                    typeEl.GetString()?.Equals("output", StringComparison.OrdinalIgnoreCase) == true)
                {
                    outputIds.Add(pair.Key);
                }
            }
        }

        var values = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        var valuesRaw = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        var visiting = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        double ToNumber(object? value)
        {
            if (value is null) return 0;
            if (value is double dbl) return dbl;
            if (value is float flt) return flt;
            if (value is int i) return i;
            if (value is long l) return l;
            if (value is string str && double.TryParse(str, out var parsed)) return parsed;
            return 0;
        }

        object EvaluateNode(string nodeId)
        {
            if (valuesRaw.TryGetValue(nodeId, out var cached))
            {
                return cached;
            }
            if (!nodes.TryGetValue(nodeId, out var node))
            {
                return 0.0;
            }
            if (!visiting.Add(nodeId))
            {
                return 0.0;
            }

            var nodeType = node.TryGetProperty("type", out var typeEl) && typeEl.ValueKind == JsonValueKind.String
                ? typeEl.GetString() ?? string.Empty
                : string.Empty;

            object result;
            if (nodeType.Equals("input.random", StringComparison.OrdinalIgnoreCase))
            {
                var min = node.TryGetProperty("min", out var minEl) && minEl.TryGetDouble(out var minVal) ? minVal : 0;
                var max = node.TryGetProperty("max", out var maxEl) && maxEl.TryGetDouble(out var maxVal) ? maxVal : min + 10;
                if (max < min)
                {
                    (min, max) = (max, min);
                }
                result = Math.Floor(Random.Shared.NextDouble() * (max - min + 1)) + min;
            }
            else if (nodeType.Equals("input.list", StringComparison.OrdinalIgnoreCase))
            {
                var entries = new List<string>();
                if (node.TryGetProperty("list", out var listEl) && listEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in listEl.EnumerateArray())
                    {
                        if (item.ValueKind == JsonValueKind.String)
                        {
                            var value = item.GetString();
                            if (!string.IsNullOrWhiteSpace(value))
                            {
                                entries.Add(value);
                            }
                        }
                    }
                }
                var inputsByHandle = GetNodeInputsByHandle(node);
                var indexIds = inputsByHandle.TryGetValue("index", out var handleList)
                    ? handleList
                    : GetNodeInputs(node);
                var indexValue = indexIds.Count > 0 ? ToNumber(EvaluateNode(indexIds[0])) : 0;
                var index = (int)Math.Round(indexValue, MidpointRounding.AwayFromZero);
                if (entries.Count == 0)
                {
                    result = index.ToString();
                }
                else
                {
                    var clamped = Math.Clamp(index, 0, entries.Count - 1);
                    result = entries[clamped];
                }
            }
            else if (nodeType.StartsWith("compute.", StringComparison.OrdinalIgnoreCase))
            {
                var inputsByHandle = GetNodeInputsByHandle(node);
                var allInputs = inputsByHandle.Count == 0
                    ? GetNodeInputs(node)
                    : inputsByHandle.SelectMany(pair => pair.Value).ToList();
                var inputValues = allInputs.Select(id => ToNumber(EvaluateNode(id))).ToList();
                List<object?> handleObjects(string handle)
                {
                    if (!inputsByHandle.TryGetValue(handle, out var list))
                    {
                        return new List<object?>();
                    }
                    return list.Select(id => EvaluateNode(id)).ToList();
                }
                List<double> handleValues(string handle)
                {
                    if (!inputsByHandle.TryGetValue(handle, out var list))
                    {
                        return new List<double>();
                    }
                    return list.Select(id => ToNumber(EvaluateNode(id))).ToList();
                }
                double ComputeDiv()
                {
                    var numList = handleValues("num");
                    var denList = handleValues("den");
                    var numerator = numList.FirstOrDefault();
                    var denominator = denList.Sum();
                    return Math.Abs(denominator) < double.Epsilon ? 0 : numerator / denominator;
                }
                double ComputePow()
                {
                    var baseVal = handleValues("base").FirstOrDefault();
                    var expVal = handleValues("exp").FirstOrDefault();
                    return Math.Pow(baseVal, expVal);
                }
                double ComputeExp()
                {
                    var baseVal = handleValues("base").FirstOrDefault();
                    var expVal = handleValues("exp").FirstOrDefault();
                    return Math.Pow(baseVal, expVal);
                }
                double ComputeLog()
                {
                    var value = Math.Max(handleValues("value").FirstOrDefault(), double.Epsilon);
                    var baseVal = handleValues("base").FirstOrDefault();
                    return Math.Abs(baseVal) < double.Epsilon ? Math.Log(value) : Math.Log(value, baseVal);
                }
                double ComputeMod()
                {
                    var a = handleValues("a").FirstOrDefault();
                    var b = handleValues("b").FirstOrDefault();
                    return Math.Abs(b) < double.Epsilon ? 0 : a % b;
                }
                string ComputeConcat()
                {
                    var ordered = new List<object?>();
                    var orderedHandles = new[] { "in1", "in2", "in3", "in4", "in5", "in6" };
                    foreach (var handle in orderedHandles)
                    {
                        if (inputsByHandle.TryGetValue(handle, out var ids))
                        {
                            ordered.AddRange(ids.Select(id => EvaluateNode(id)));
                        }
                    }
                    var list = ordered.Count > 0 ? ordered : handleObjects("in");
                    if (list.Count == 0)
                    {
                        list = allInputs.Select(id => EvaluateNode(id)).ToList();
                    }
                    var parts = list.Select(FormatAny).ToList();
                    return string.Concat(parts);
                }
                string ComputeTrim()
                {
                    var textValue = handleObjects("text").FirstOrDefault()
                        ?? handleObjects("in").FirstOrDefault()
                        ?? string.Empty;
                    var rawText = FormatAny(textValue);
                    var startTrim = (int)Math.Max(0, Math.Round(handleValues("start").FirstOrDefault()));
                    var endTrim = (int)Math.Max(0, Math.Round(handleValues("end").FirstOrDefault()));
                    if (startTrim + endTrim >= rawText.Length)
                    {
                        return string.Empty;
                    }
                    return rawText.Substring(startTrim, rawText.Length - endTrim);
                }
                var op = nodeType["compute.".Length..].ToLowerInvariant();
                result = op switch
                {
                    "add" => inputValues.Sum(),
                    "sub" => inputsByHandle.Count == 0
                        ? (inputValues.Count == 0 ? 0 : inputValues.Skip(1).Aggregate(inputValues.First(), (acc, val) => acc - val))
                        : handleValues("add").Sum() - handleValues("sub").Sum(),
                    "mul" => inputValues.Count == 0 ? 0 : inputValues.Aggregate(1.0, (acc, val) => acc * val),
                    "div" => inputsByHandle.Count == 0
                        ? (inputValues.Count == 0 ? 0 : inputValues.Skip(1).Aggregate(inputValues.First(), (acc, val) => val == 0 ? acc : acc / val))
                        : ComputeDiv(),
                    "pow" => inputsByHandle.Count == 0
                        ? (inputValues.Count < 2 ? (inputValues.Count == 1 ? inputValues[0] : 0) : Math.Pow(inputValues[0], inputValues[1]))
                        : ComputePow(),
                    "exp" => inputsByHandle.Count == 0
                        ? (inputValues.Count == 0 ? 0 : Math.Exp(inputValues[0]))
                        : ComputeExp(),
                    "log" => inputsByHandle.Count == 0
                        ? (inputValues.Count == 0 ? 0 : Math.Log(Math.Max(inputValues[0], double.Epsilon)))
                        : ComputeLog(),
                    "abs" => inputValues.Count == 0 ? 0 : Math.Abs(inputValues[0]),
                    "min" => inputValues.Count == 0 ? 0 : inputValues.Min(),
                    "max" => inputValues.Count == 0 ? 0 : inputValues.Max(),
                    "floor" => inputValues.Count == 0 ? 0 : Math.Floor(inputValues[0]),
                    "ceil" => inputValues.Count == 0 ? 0 : Math.Ceiling(inputValues[0]),
                    "round" => inputValues.Count == 0 ? 0 : Math.Round(inputValues[0]),
                    "mod" => inputsByHandle.Count == 0
                        ? (inputValues.Count < 2 ? 0 : (inputValues[1] == 0 ? 0 : inputValues[0] % inputValues[1]))
                        : ComputeMod(),
                    "concat" => ComputeConcat(),
                    "trim" => ComputeTrim(),
                    _ => 0.0
                };
            }
            else if (nodeType.Equals("output", StringComparison.OrdinalIgnoreCase))
            {
                var inputs = GetNodeInputs(node);
                result = inputs.Count > 0 ? EvaluateNode(inputs[0]) : 0.0;
            }
            else if (nodeType.Equals("input.const", StringComparison.OrdinalIgnoreCase))
            {
                result = node.TryGetProperty("value", out var valueEl) && valueEl.TryGetDouble(out var constVal) ? constVal : 0.0;
            }
            else
            {
                result = 0.0;
            }

            visiting.Remove(nodeId);
            valuesRaw[nodeId] = result;
            if (result is double dbl)
            {
                values[nodeId] = dbl;
            }
            else if (result is float flt)
            {
                values[nodeId] = flt;
            }
            else if (result is int i)
            {
                values[nodeId] = i;
            }
            else if (result is long l)
            {
                values[nodeId] = l;
            }
            else if (result is string str && double.TryParse(str, out var parsed))
            {
                values[nodeId] = parsed;
            }
            return result;
        }

        foreach (var outputId in outputIds)
        {
            if (!string.IsNullOrWhiteSpace(outputId))
            {
                EvaluateNode(outputId);
            }
        }
        foreach (var nodeId in nodes.Keys)
        {
            if (!string.IsNullOrWhiteSpace(nodeId))
            {
                EvaluateNode(nodeId);
            }
        }

        var prompt = promptTemplate;
        if (string.IsNullOrWhiteSpace(prompt))
        {
            prompt = outputIds.Count == 0 ? "Compute" : $"Compute {string.Join(", ", outputIds)}";
        }

        var outputSet = new HashSet<string>(
            outputIds.Where(id => !string.IsNullOrWhiteSpace(id))!,
            StringComparer.OrdinalIgnoreCase);
        var outputLabelMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var outputId in outputSet)
        {
            if (!nodes.TryGetValue(outputId, out var outputNode))
            {
                continue;
            }
            var inputsByHandle = GetNodeInputsByHandle(outputNode);
            var nameInputId = inputsByHandle.TryGetValue("name", out var nameList) ? nameList.FirstOrDefault() : null;
            var nameValue = !string.IsNullOrWhiteSpace(nameInputId) ? FormatAny(EvaluateNode(nameInputId)) : string.Empty;
            var fallback = outputLabels.TryGetValue(outputId, out var label) && !string.IsNullOrWhiteSpace(label)
                ? label
                : nodeNames.TryGetValue(outputId, out var name) && !string.IsNullOrWhiteSpace(name)
                    ? name
                    : outputId;
            outputLabelMap[outputId] = !string.IsNullOrWhiteSpace(nameValue) ? nameValue : fallback;
        }

        static string ReplacePlaceholder(string input, string key, string replacement)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return input;
            }
            var escaped = Regex.Escape(key);
            return Regex.Replace(
                input,
                $"\\{{\\s*{escaped}\\s*\\}}",
                replacement ?? string.Empty,
                RegexOptions.IgnoreCase);
        }

        foreach (var pair in valuesRaw)
        {
            var isOutput = outputSet.Contains(pair.Key);
            var outputLabel = outputLabelMap.TryGetValue(pair.Key, out var outputLabelValue)
                ? outputLabelValue
                : outputLabels.TryGetValue(pair.Key, out var staticLabel) && !string.IsNullOrWhiteSpace(staticLabel)
                    ? staticLabel
                    : nodeNames.TryGetValue(pair.Key, out var outputName) && !string.IsNullOrWhiteSpace(outputName)
                        ? outputName
                        : pair.Key;
            var replacement = isOutput ? outputLabel : FormatAny(pair.Value);

            prompt = ReplacePlaceholder(prompt, pair.Key, replacement);
            if (nodeNames.TryGetValue(pair.Key, out var name))
            {
                var nameReplacement = isOutput ? outputLabel : FormatAny(pair.Value);
                prompt = ReplacePlaceholder(prompt, name, nameReplacement);
            }
            if (outputLabels.TryGetValue(pair.Key, out var label))
            {
                prompt = ReplacePlaceholder(prompt, label, outputLabel);
            }
        }

        var expectedAnswers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var outputId in outputIds)
        {
            if (string.IsNullOrWhiteSpace(outputId)) continue;
            if (!valuesRaw.TryGetValue(outputId, out var outputValue)) continue;
            var key = outputLabelMap.TryGetValue(outputId, out var label)
                ? label
                : outputLabels.TryGetValue(outputId, out var staticLabel) && !string.IsNullOrWhiteSpace(staticLabel)
                    ? staticLabel
                    : nodeNames.TryGetValue(outputId, out var name) && !string.IsNullOrWhiteSpace(name)
                        ? name
                        : outputId;
            expectedAnswers[key] = FormatAny(outputValue);
        }

        var expected = outputIds.Count > 0 && valuesRaw.TryGetValue(outputIds[0], out var primaryValue)
            ? FormatAny(primaryValue)
            : string.Empty;

        return new ComputedGraphResult(prompt, expected, expectedAnswers, values);
    }

    private static List<string> GetNodeInputs(JsonElement node)
    {
        var inputs = new List<string>();
        if (node.TryGetProperty("inputs", out var inputsEl) && inputsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in inputsEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var value = item.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        inputs.Add(value);
                    }
                }
            }
        }
        else
        {
            if (node.TryGetProperty("left", out var leftEl) && leftEl.ValueKind == JsonValueKind.String)
            {
                var left = leftEl.GetString();
                if (!string.IsNullOrWhiteSpace(left)) inputs.Add(left);
            }
            if (node.TryGetProperty("right", out var rightEl) && rightEl.ValueKind == JsonValueKind.String)
            {
                var right = rightEl.GetString();
                if (!string.IsNullOrWhiteSpace(right)) inputs.Add(right);
            }
        }

        return inputs;
    }

    private static Dictionary<string, List<string>> GetNodeInputsByHandle(JsonElement node)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        if (node.TryGetProperty("inputsByHandle", out var inputsEl) && inputsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in inputsEl.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }
                var list = new List<string>();
                foreach (var item in prop.Value.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                    {
                        var value = item.GetString();
                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            list.Add(value);
                        }
                    }
                }
                result[prop.Name] = list;
            }
        }
        return result;
    }

    private static string FormatNumber(double value)
    {
        if (Math.Abs(value % 1) < 0.00001)
        {
            return ((int)Math.Round(value)).ToString();
        }
        return value.ToString("0.###");
    }

    private static string FormatAny(object? value)
    {
        if (value is null)
        {
            return string.Empty;
        }
        if (value is double dbl)
        {
            return FormatNumber(dbl);
        }
        if (value is float flt)
        {
            return FormatNumber(flt);
        }
        if (value is int i)
        {
            return i.ToString();
        }
        if (value is long l)
        {
            return l.ToString();
        }
        return value.ToString() ?? string.Empty;
    }

    private static GraphDataset UnionDatasets(IEnumerable<GraphDataset> datasets)
    {
        var connections = new HashSet<Guid>();
        var infos = new HashSet<Guid>();
        foreach (var dataset in datasets)
        {
            connections.UnionWith(dataset.Connections);
            infos.UnionWith(dataset.Infos);
        }
        return new GraphDataset(connections, infos);
    }

    private static GraphDataset IntersectDatasets(IEnumerable<GraphDataset> datasets)
    {
        var list = datasets.ToList();
        if (list.Count == 0)
        {
            return GraphDataset.Empty;
        }
        var connections = new HashSet<Guid>(list[0].Connections);
        var infos = new HashSet<Guid>(list[0].Infos);
        foreach (var dataset in list.Skip(1))
        {
            connections.IntersectWith(dataset.Connections);
            infos.IntersectWith(dataset.Infos);
        }
        return new GraphDataset(connections, infos);
    }

    private static GraphDataset ApplyTagFilter(
        GraphDataset? input,
        JsonElement? parameters,
        Dictionary<Guid, TranslationGraphItem> translationLookup)
    {
        if (input is null || parameters is null)
        {
            return GraphDataset.Empty;
        }

        if (!parameters.Value.TryGetProperty("tagId", out var tagProp) ||
            tagProp.ValueKind != JsonValueKind.String ||
            !Guid.TryParse(tagProp.GetString(), out var tagId))
        {
            return GraphDataset.Empty;
        }

        var scope = parameters.Value.TryGetProperty("scope", out var scopeProp) && scopeProp.ValueKind == JsonValueKind.String
            ? scopeProp.GetString()?.ToLowerInvariant()
            : "any";

        var filtered = input.Connections.Where(id =>
        {
            if (!translationLookup.TryGetValue(id, out var item))
            {
                return false;
            }
            return scope switch
            {
                "translation" => item.TranslationTags.Contains(tagId),
                "worda" => item.WordATags.Contains(tagId),
                "wordb" => item.WordBTags.Contains(tagId),
                _ => item.TranslationTags.Contains(tagId) || item.WordATags.Contains(tagId) || item.WordBTags.Contains(tagId)
            };
        }).ToHashSet();

        return new GraphDataset(filtered, new HashSet<Guid>());
    }

    private static GraphDataset ApplyLanguageFilter(
        GraphDataset? input,
        JsonElement? parameters,
        Dictionary<Guid, TranslationGraphItem> translationLookup)
    {
        if (input is null || parameters is null)
        {
            return GraphDataset.Empty;
        }

        if (!parameters.Value.TryGetProperty("languageId", out var langProp) ||
            langProp.ValueKind != JsonValueKind.String ||
            !Guid.TryParse(langProp.GetString(), out var languageId))
        {
            return GraphDataset.Empty;
        }

        var scope = parameters.Value.TryGetProperty("scope", out var scopeProp) && scopeProp.ValueKind == JsonValueKind.String
            ? scopeProp.GetString()?.ToLowerInvariant()
            : "any";

        var filtered = input.Connections.Where(id =>
        {
            if (!translationLookup.TryGetValue(id, out var item))
            {
                return false;
            }
            return scope switch
            {
                "worda" => item.LanguageAId == languageId,
                "wordb" => item.LanguageBId == languageId,
                _ => item.LanguageAId == languageId || item.LanguageBId == languageId
            };
        }).ToHashSet();

        return new GraphDataset(filtered, new HashSet<Guid>());
    }

    private static async Task<Dictionary<Guid, JsonElement?>> LoadGraphNodeParamsAsync(
        List<CogitaCollectionGraphNode> nodes,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (nodes.Count == 0)
        {
            return new Dictionary<Guid, JsonElement?>();
        }

        var keyEntries = await dbContext.Keys.AsNoTracking()
            .Where(x => nodes.Select(n => n.DataKeyId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);

        var result = new Dictionary<Guid, JsonElement?>();
        foreach (var node in nodes)
        {
            if (!keyEntries.TryGetValue(node.DataKeyId, out var keyEntry))
            {
                result[node.Id] = null;
                continue;
            }
            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                result[node.Id] = null;
                continue;
            }

            try
            {
                var plain = encryptionService.Decrypt(dataKey, node.EncryptedBlob, node.Id.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                if (doc.RootElement.TryGetProperty("params", out var param))
                {
                    result[node.Id] = param.Clone();
                }
                else
                {
                    result[node.Id] = doc.RootElement.Clone();
                }
            }
            catch (CryptographicException)
            {
                result[node.Id] = null;
            }
        }

        return result;
    }

    private static async Task<Dictionary<Guid, HashSet<Guid>>> LoadInfoSourceNodesAsync(
        Guid libraryId,
        Dictionary<Guid, JsonElement?> nodeParams,
        List<CogitaCollectionGraphNode> nodes,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var result = new Dictionary<Guid, HashSet<Guid>>();
        var infoNodeIds = nodes
            .Where(n => n.NodeType.Trim().Equals("source.info", StringComparison.OrdinalIgnoreCase))
            .Select(n => n.Id)
            .ToList();
        if (infoNodeIds.Count == 0)
        {
            return result;
        }

        foreach (var nodeId in infoNodeIds)
        {
            if (!nodeParams.TryGetValue(nodeId, out var parameters) || parameters is null)
            {
                result[nodeId] = new HashSet<Guid>();
                continue;
            }

            Guid? infoId = null;
            if (parameters.Value.TryGetProperty("infoId", out var infoIdProp) &&
                infoIdProp.ValueKind == JsonValueKind.String &&
                Guid.TryParse(infoIdProp.GetString(), out var parsedInfoId))
            {
                infoId = parsedInfoId;
            }

            string? infoType = null;
            if (parameters.Value.TryGetProperty("infoType", out var typeProp) && typeProp.ValueKind == JsonValueKind.String)
            {
                infoType = typeProp.GetString()?.Trim().ToLowerInvariant();
            }

            if (infoId.HasValue)
            {
                var exists = await dbContext.CogitaInfos.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == infoId.Value, ct);
                result[nodeId] = exists ? new HashSet<Guid> { infoId.Value } : new HashSet<Guid>();
                continue;
            }

            if (!string.IsNullOrWhiteSpace(infoType))
            {
                var ids = await dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.InfoType == infoType)
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                result[nodeId] = ids.ToHashSet();
            }
            else
            {
                result[nodeId] = new HashSet<Guid>();
            }
        }

        return result;
    }

    private static async Task<Dictionary<Guid, HashSet<Guid>>> LoadConnectionSourceNodesAsync(
        Guid libraryId,
        Dictionary<Guid, JsonElement?> nodeParams,
        List<CogitaCollectionGraphNode> nodes,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var result = new Dictionary<Guid, HashSet<Guid>>();
        var connectionNodeIds = nodes
            .Where(n => n.NodeType.Trim().Equals("source.connection", StringComparison.OrdinalIgnoreCase))
            .Select(n => n.Id)
            .ToList();
        if (connectionNodeIds.Count == 0)
        {
            return result;
        }

        foreach (var nodeId in connectionNodeIds)
        {
            if (!nodeParams.TryGetValue(nodeId, out var parameters) || parameters is null)
            {
                result[nodeId] = new HashSet<Guid>();
                continue;
            }

            Guid? connectionId = null;
            if (parameters.Value.TryGetProperty("connectionId", out var connIdProp) &&
                connIdProp.ValueKind == JsonValueKind.String &&
                Guid.TryParse(connIdProp.GetString(), out var parsedConnId))
            {
                connectionId = parsedConnId;
            }

            string? connectionType = null;
            if (parameters.Value.TryGetProperty("connectionType", out var typeProp) && typeProp.ValueKind == JsonValueKind.String)
            {
                connectionType = typeProp.GetString()?.Trim().ToLowerInvariant();
            }

            if (connectionId.HasValue)
            {
                var exists = await dbContext.CogitaConnections.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.Id == connectionId.Value, ct);
                result[nodeId] = exists ? new HashSet<Guid> { connectionId.Value } : new HashSet<Guid>();
                continue;
            }

            if (!string.IsNullOrWhiteSpace(connectionType))
            {
                var ids = await dbContext.CogitaConnections.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.ConnectionType == connectionType)
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                result[nodeId] = ids.ToHashSet();
            }
            else
            {
                result[nodeId] = new HashSet<Guid>();
            }
        }

        return result;
    }

    private static async Task<Dictionary<Guid, TranslationGraphItem>> LoadTranslationGraphItemsAsync(
        Guid libraryId,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var translations = await dbContext.CogitaConnections.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && x.ConnectionType == "translation")
            .Select(x => new { x.Id, x.DataKeyId, x.EncryptedBlob })
            .ToListAsync(ct);

        if (translations.Count == 0)
        {
            return new Dictionary<Guid, TranslationGraphItem>();
        }

        var translationIds = translations.Select(x => x.Id).ToList();
        var translationItems = await dbContext.CogitaConnectionItems.AsNoTracking()
            .Where(x => translationIds.Contains(x.ConnectionId))
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var itemsByConnection = translationItems
            .GroupBy(x => x.ConnectionId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.InfoId).ToList());

        var wordLanguageMap = await dbContext.CogitaWordLanguages.AsNoTracking()
            .GroupBy(x => x.WordInfoId)
            .ToDictionaryAsync(x => x.Key, x => x.First().LanguageInfoId, ct);

        var wordTopicConnections = await dbContext.CogitaConnections.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && x.ConnectionType == "word-topic")
            .Select(x => x.Id)
            .ToListAsync(ct);

        var wordTopicItems = await dbContext.CogitaConnectionItems.AsNoTracking()
            .Where(x => wordTopicConnections.Contains(x.ConnectionId))
            .ToListAsync(ct);

        var wordTopicGroups = wordTopicItems.GroupBy(x => x.ConnectionId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.InfoId).ToList());

        var topicIds = wordTopicGroups.Values.SelectMany(x => x).Distinct().ToList();
        var infoTypes = await dbContext.CogitaInfos.AsNoTracking()
            .Where(x => topicIds.Contains(x.Id))
            .Select(x => new { x.Id, x.InfoType })
            .ToListAsync(ct);
        var typeLookup = infoTypes.ToDictionary(x => x.Id, x => x.InfoType);

        var wordTags = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var group in wordTopicGroups.Values)
        {
            if (group.Count < 2)
            {
                continue;
            }
            Guid? wordId = null;
            Guid? topicId = null;
            foreach (var infoId in group)
            {
                if (typeLookup.TryGetValue(infoId, out var type))
                {
                    if (type == "word")
                    {
                        wordId = infoId;
                    }
                    else if (type == "topic")
                    {
                        topicId = infoId;
                    }
                }
            }
            if (wordId.HasValue && topicId.HasValue)
            {
                if (!wordTags.TryGetValue(wordId.Value, out var tags))
                {
                    tags = new HashSet<Guid>();
                    wordTags[wordId.Value] = tags;
                }
                tags.Add(topicId.Value);
            }
        }

        var keyEntries = await dbContext.Keys.AsNoTracking()
            .Where(x => translations.Select(t => t.DataKeyId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);

        var result = new Dictionary<Guid, TranslationGraphItem>();
        foreach (var translation in translations)
        {
            if (!itemsByConnection.TryGetValue(translation.Id, out var wordIds) || wordIds.Count < 2)
            {
                continue;
            }

            var wordA = wordIds[0];
            var wordB = wordIds[1];
            var langA = wordLanguageMap.TryGetValue(wordA, out var la) ? la : Guid.Empty;
            var langB = wordLanguageMap.TryGetValue(wordB, out var lb) ? lb : Guid.Empty;

            var translationTags = new HashSet<Guid>();
            if (keyEntries.TryGetValue(translation.DataKeyId, out var keyEntry))
            {
                try
                {
                    var dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                    var plain = encryptionService.Decrypt(dataKey, translation.EncryptedBlob, translation.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    if (doc.RootElement.TryGetProperty("tagIds", out var tagArray) && tagArray.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var element in tagArray.EnumerateArray())
                        {
                            if (element.ValueKind == JsonValueKind.String && Guid.TryParse(element.GetString(), out var tagId))
                            {
                                translationTags.Add(tagId);
                            }
                        }
                    }
                    if (doc.RootElement.TryGetProperty("levelId", out var levelProp) && levelProp.ValueKind == JsonValueKind.String &&
                        Guid.TryParse(levelProp.GetString(), out var levelGuid))
                    {
                        translationTags.Add(levelGuid);
                    }
                    if (doc.RootElement.TryGetProperty("topicId", out var topicProp) && topicProp.ValueKind == JsonValueKind.String &&
                        Guid.TryParse(topicProp.GetString(), out var topicGuid))
                    {
                        translationTags.Add(topicGuid);
                    }
                }
                catch (CryptographicException)
                {
                    // ignore tags if decrypt fails
                }
            }

            result[translation.Id] = new TranslationGraphItem(
                translation.Id,
                wordA,
                wordB,
                langA,
                langB,
                translationTags,
                wordTags.TryGetValue(wordA, out var aTags) ? new HashSet<Guid>(aTags) : new HashSet<Guid>(),
                wordTags.TryGetValue(wordB, out var bTags) ? new HashSet<Guid>(bTags) : new HashSet<Guid>());
        }

        return result;
    }

    private static async Task<List<CogitaCardSearchResponse>> BuildTranslationCardResponsesAsync(
        Guid libraryId,
        List<Guid> translationIds,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (translationIds.Count == 0)
        {
            return new List<CogitaCardSearchResponse>();
        }

        var items = await dbContext.CogitaConnectionItems.AsNoTracking()
            .Where(x => translationIds.Contains(x.ConnectionId))
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var itemsByConnection = items.GroupBy(x => x.ConnectionId)
            .ToDictionary(group => group.Key, group => group.Select(x => x.InfoId).ToList());

        var wordIds = itemsByConnection.Values.SelectMany(x => x).Distinct().ToList();
        var wordLabels = await ResolveInfoLabelsAsync(
            libraryId,
            "word",
            wordIds,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);
        var wordLanguageMap = new Dictionary<Guid, Guid>();
        if (wordIds.Count > 0)
        {
            var wordLanguageMapRows = await dbContext.CogitaWordLanguages.AsNoTracking()
                .Where(x => wordIds.Contains(x.WordInfoId))
                .ToListAsync(ct);
            foreach (var row in wordLanguageMapRows)
            {
                if (!wordLanguageMap.ContainsKey(row.WordInfoId))
                {
                    wordLanguageMap[row.WordInfoId] = row.LanguageInfoId;
                }
            }
        }
        var languageIds = wordLanguageMap.Values.Distinct().ToList();
        var languageLabels = await ResolveInfoLabelsAsync(
            libraryId,
            "language",
            languageIds,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);

        var responses = new List<CogitaCardSearchResponse>();
        foreach (var pair in itemsByConnection)
        {
            if (pair.Value.Count < 2)
            {
                continue;
            }

            var wordA = pair.Value[0];
            var wordB = pair.Value[1];
            var wordALabel = wordLabels.TryGetValue(wordA, out var w1) ? w1 : "Word";
            var wordBLabel = wordLabels.TryGetValue(wordB, out var w2) ? w2 : "Word";

            var langAId = wordLanguageMap.TryGetValue(wordA, out var langA) ? langA : Guid.Empty;
            var langBId = wordLanguageMap.TryGetValue(wordB, out var langB) ? langB : Guid.Empty;

            var langALabel = langAId != Guid.Empty && languageLabels.TryGetValue(langAId, out var l1)
                ? l1
                : "Language";
            var langBLabel = langBId != Guid.Empty && languageLabels.TryGetValue(langBId, out var l2)
                ? l2
                : "Language";

            var label = $"{wordALabel} ↔ {wordBLabel}";
            var description = $"{langALabel} ↔ {langBLabel}";

            responses.Add(new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation", "a-to-b"));
            responses.Add(new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation", "b-to-a"));
            responses.Add(new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null, "translation-match", null));
        }

        return responses;
    }

    private static async Task<List<CogitaCardSearchResponse>> BuildCollectionCardResponsesAsync(
        List<(string ItemType, Guid ItemId)> items,
        Guid libraryId,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (items.Count == 0)
        {
            return new List<CogitaCardSearchResponse>();
        }

        var infoItemIds = items.Where(x => x.ItemType == "info").Select(x => x.ItemId).ToList();
        var connectionItemIds = items.Where(x => x.ItemType == "connection").Select(x => x.ItemId).ToList();

        var infos = await dbContext.CogitaInfos.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && infoItemIds.Contains(x.Id))
            .ToListAsync(ct);

        var payloadLookup = new Dictionary<Guid, (Guid InfoId, string InfoType, Guid DataKeyId, byte[] EncryptedBlob)>();
        foreach (var info in infos)
        {
            var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payload is null)
            {
                continue;
            }
            payloadLookup[info.Id] = (info.Id, info.InfoType, payload.Value.DataKeyId, payload.Value.EncryptedBlob);
        }

        var dataKeyIds = payloadLookup.Values.Select(entry => entry.DataKeyId).Distinct().ToList();
        var keyEntryById = await dbContext.Keys.AsNoTracking()
            .Where(x => dataKeyIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);

        var wordInfoIds = payloadLookup.Values
            .Where(entry => entry.InfoType == "word")
            .Select(entry => entry.InfoId)
            .Distinct()
            .ToList();
        var wordLanguageMap = new Dictionary<Guid, Guid>();
        if (wordInfoIds.Count > 0)
        {
            var wordLanguageRows = await dbContext.CogitaWordLanguages.AsNoTracking()
                .Where(x => wordInfoIds.Contains(x.WordInfoId))
                .ToListAsync(ct);
            foreach (var row in wordLanguageRows)
            {
                if (!wordLanguageMap.ContainsKey(row.WordInfoId))
                {
                    wordLanguageMap[row.WordInfoId] = row.LanguageInfoId;
                }
            }
        }

        var languageIds = wordLanguageMap.Values.Distinct().ToList();
        var languageLabels = await ResolveInfoLabelsAsync(
            libraryId,
            "language",
            languageIds,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);

        var infoResponses = new Dictionary<Guid, CogitaCardSearchResponse>();

        foreach (var item in items)
        {
            if (item.ItemType != "info")
            {
                continue;
            }

            if (!payloadLookup.TryGetValue(item.ItemId, out var entry))
            {
                continue;
            }

            if (!keyEntryById.TryGetValue(entry.DataKeyId, out var keyEntry))
            {
                continue;
            }

            byte[] dataKey;
            try
            {
                dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
            }
            catch (CryptographicException)
            {
                continue;
            }

            string label;
            string description;
            try
            {
                var plain = encryptionService.Decrypt(dataKey, entry.EncryptedBlob, entry.InfoId.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                label = ResolveLabel(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                description = ResolveDescription(doc.RootElement, entry.InfoType) ?? entry.InfoType;
                if (entry.InfoType == "word" && wordLanguageMap.TryGetValue(entry.InfoId, out var languageInfoId))
                {
                    if (languageLabels.TryGetValue(languageInfoId, out var langLabel) && !string.IsNullOrWhiteSpace(langLabel))
                    {
                        description = $"Language: {langLabel}";
                    }
                }

                var checkType = entry.InfoType == "word"
                    ? "word-language"
                    : entry.InfoType == "computed"
                        ? "computed"
                    : "info";
                var direction = entry.InfoType == "word" ? "word-to-language" : null;
                infoResponses[entry.InfoId] = new CogitaCardSearchResponse(entry.InfoId, "info", label, description, entry.InfoType, checkType, direction);
                continue;
            }
            catch (CryptographicException)
            {
                continue;
            }
        }

        var connectionResponses = new Dictionary<Guid, List<CogitaCardSearchResponse>>();
        if (connectionItemIds.Count > 0)
        {
            var connections = await dbContext.CogitaConnections.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && connectionItemIds.Contains(x.Id))
                .ToListAsync(ct);

            var translationIds = connections
                .Where(x => x.ConnectionType == "translation")
                .Select(x => x.Id)
                .ToList();

            if (translationIds.Count > 0)
            {
                var translationResponses = await BuildTranslationCardResponsesAsync(
                    libraryId,
                    translationIds,
                    readKey,
                    keyRingService,
                    encryptionService,
                    dbContext,
                    ct);
                foreach (var response in translationResponses)
                {
                    if (!connectionResponses.TryGetValue(response.CardId, out var list))
                    {
                        list = new List<CogitaCardSearchResponse>();
                        connectionResponses[response.CardId] = list;
                    }
                    list.Add(response);
                }
            }

            foreach (var connection in connections)
            {
                if (connection.ConnectionType == "translation")
                {
                    continue;
                }

                connectionResponses[connection.Id] = new List<CogitaCardSearchResponse>
                {
                    new CogitaCardSearchResponse(
                        connection.Id,
                        "connection",
                        connection.ConnectionType,
                        "Connection",
                        null,
                        connection.ConnectionType,
                        null)
                };
            }
        }

        var orderedResponses = new List<CogitaCardSearchResponse>();
        foreach (var item in items)
        {
            if (item.ItemType == "info")
            {
                if (infoResponses.TryGetValue(item.ItemId, out var response))
                {
                    orderedResponses.Add(response);
                }
            }
            else if (item.ItemType == "connection")
            {
                if (connectionResponses.TryGetValue(item.ItemId, out var responseList))
                {
                    orderedResponses.AddRange(responseList);
                }
            }
        }

        return orderedResponses;
    }

    private static string GenerateNumericShareCode(int length)
    {
        if (length <= 0)
        {
            return string.Empty;
        }

        var digits = new char[length];
        for (var i = 0; i < length; i++)
        {
            digits[i] = '0';
        }

        var remaining = length;
        while (remaining > 0)
        {
            var bytes = RandomNumberGenerator.GetBytes(8);
            var value = BitConverter.ToUInt64(bytes, 0);
            while (remaining > 0 && value > 0)
            {
                var digit = (int)(value % 10);
                digits[remaining - 1] = (char)('0' + digit);
                value /= 10;
                remaining--;
            }
        }

        return new string(digits);
    }

    private static async Task<(CogitaRevisionShare Share, CogitaLibrary Library, byte[] LibraryReadKey)?> TryResolveRevisionShareAsync(
        string? code,
        string? key,
        RecreatioDbContext dbContext,
        IEncryptionService encryptionService,
        IMasterKeyService masterKeyService,
        IHashingService hashingService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        code = code.Trim();
        if (code.Length < 12 || code.Length > 32 || code.Any(ch => ch < '0' || ch > '9'))
        {
            return null;
        }

        var codeBytes = System.Text.Encoding.UTF8.GetBytes(code);
        var codeHash = hashingService.Hash(codeBytes);

        var share = await dbContext.CogitaRevisionShares.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PublicCodeHash == codeHash && x.RevokedUtc == null, ct);
        if (share is null)
        {
            return null;
        }

        var sharedView = await dbContext.SharedViews.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == share.SharedViewId && x.RevokedUtc == null, ct);
        if (sharedView is null)
        {
            return null;
        }

        var secretSource = string.IsNullOrWhiteSpace(key) ? code : key.Trim();
        var secretBytes = System.Text.Encoding.UTF8.GetBytes(secretSource);
        var secretHash = hashingService.Hash(secretBytes);
        if (sharedView.SharedViewSecretHash.Length == 0 ||
            secretHash.Length != sharedView.SharedViewSecretHash.Length ||
            !CryptographicOperations.FixedTimeEquals(secretHash, sharedView.SharedViewSecretHash))
        {
            return null;
        }

        var library = await dbContext.CogitaLibraries.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == share.LibraryId, ct);
        if (library is null)
        {
            return null;
        }

        var edge = await dbContext.RoleEdges.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ParentRoleId == sharedView.ViewRoleId && x.ChildRoleId == library.RoleId, ct);
        if (edge is null)
        {
            return null;
        }

        byte[] viewRoleReadKey;
        try
        {
            var sharedViewKey = masterKeyService.DeriveSharedViewKey(secretBytes, sharedView.Id);
            viewRoleReadKey = encryptionService.Decrypt(sharedViewKey, sharedView.EncViewRoleKey, sharedView.Id.ToByteArray());
        }
        catch (CryptographicException)
        {
            return null;
        }

        byte[] libraryReadKey;
        try
        {
            libraryReadKey = encryptionService.Decrypt(viewRoleReadKey, edge.EncryptedReadKeyCopy, library.RoleId.ToByteArray());
        }
        catch (CryptographicException)
        {
            return null;
        }

        return (share, library, libraryReadKey);
    }
}
