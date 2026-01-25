using System.Security.Cryptography;
using System.Text.Json;
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
        "person",
        "address",
        "email",
        "phone",
        "book",
        "media",
        "geo",
        "music_piece",
        "music_fragment"
    };

    private static readonly string[] SupportedConnectionTypes =
    {
        "word-language",
        "language-sentence",
        "translation"
    };

    private static readonly string[] SupportedGroupTypes = { "vocab" };

    public static void MapCogitaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/cogita").RequireAuthorization();

        group.MapGet("/libraries", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleFieldValueService fieldValueService,
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
                .Where(x => roleIds.Contains(x.RoleId) && x.FieldType == RoleFieldTypes.Nick)
                .ToListAsync(ct);
            var keyIds = roleFields.Select(x => x.DataKeyId).Distinct().ToList();
            var keyEntries = await dbContext.Keys.AsNoTracking()
                .Where(x => keyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

            var libraryResponses = libraries.Select(library =>
            {
                var nameField = roleFields.FirstOrDefault(field => field.RoleId == library.RoleId);
                var name = nameField is null
                    ? "Cogita Library"
                    : fieldValueService.TryGetPlainValue(nameField, keyRing, keyEntries) ?? "Cogita Library";
                return new CogitaLibraryResponse(library.Id, library.RoleId, name, library.CreatedUtc);
            }).ToList();

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
                !keyRing.TryGetWriteKey(account.MasterRoleId, out var parentWriteKey))
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

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(account.MasterRoleId, parentWriteKey, ct);

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

            var fieldRequests = new List<(string FieldType, string Value)>
            {
                (RoleFieldTypes.Nick, name),
                (RoleFieldTypes.RoleKind, "CogitaLibrary")
            };

            foreach (var field in fieldRequests)
            {
                var dataKeyId = Guid.NewGuid();
                var dataKey = RandomNumberGenerator.GetBytes(32);
                var encryptedDataKey = keyRingService.EncryptDataKey(readKey, dataKey, dataKeyId);
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
                    MetadataJson = JsonSerializer.Serialize(new { fieldType = field.FieldType }),
                    LedgerRefId = keyLedger.Id,
                    CreatedUtc = now
                });
                dbContext.RoleFields.Add(new RoleField
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    FieldType = field.FieldType,
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

            dbContext.RoleEdges.Add(new RoleEdge
            {
                Id = Guid.NewGuid(),
                ParentRoleId = account.MasterRoleId,
                ChildRoleId = roleId,
                RelationshipType = RoleRelationships.Owner,
                EncryptedReadKeyCopy = encryptedReadKeyCopy,
                EncryptedWriteKeyCopy = encryptedWriteKeyCopy,
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
            var totalGroups = await dbContext.CogitaGroups.AsNoTracking().CountAsync(x => x.LibraryId == libraryId, ct);
            var totalLanguages = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "language", ct);
            var totalWords = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "word", ct);
            var totalSentences = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "sentence", ct);
            var totalTopics = await dbContext.CogitaInfos.AsNoTracking().CountAsync(x => x.LibraryId == libraryId && x.InfoType == "topic", ct);

            return Results.Ok(new CogitaLibraryStatsResponse(
                totalInfos,
                totalConnections,
                totalGroups,
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

            var lookup = await BuildInfoLookupAsync(libraryId, infoType, dbContext, ct);
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
                    dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
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
                !keyRing.TryGetWriteKey(library.RoleId, out var writeKey))
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
                    writeKey,
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

            var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(request.Payload);
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
                !keyRing.TryGetWriteKey(library.RoleId, out var writeKey))
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
            (Guid DataKeyId, byte[] DataKey) dataKeyResult;
            try
            {
                dataKeyResult = await ResolveDataKeyAsync(
                    library.RoleId,
                    request.DataKeyId,
                    $"connection:{connectionType}",
                    readKey,
                    writeKey,
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

        group.MapPost("/libraries/{libraryId:guid}/groups", async (
            Guid libraryId,
            CogitaCreateGroupRequest request,
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
                !keyRing.TryGetWriteKey(library.RoleId, out var writeKey))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
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
                CogitaCreateInfoResponse infoResult;
                try
                {
                    infoResult = await CreateInfoInternalAsync(
                        library,
                        createRequest,
                        readKey,
                        writeKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct);
                }
                catch (InvalidOperationException ex)
                {
                    return Results.BadRequest(new { error = ex.Message });
                }

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
                CogitaCreateConnectionResponse connectionResult;
                try
                {
                    connectionResult = await CreateConnectionInternalAsync(
                        library,
                        createRequest,
                        readKey,
                        writeKey,
                        userId,
                        keyRingService,
                        encryptionService,
                        roleCryptoService,
                        ledgerService,
                        dbContext,
                        ct);
                }
                catch (InvalidOperationException ex)
                {
                    return Results.BadRequest(new { error = ex.Message });
                }

                connectionIds.Add(connectionResult.ConnectionId);
            }

            var groupId = Guid.NewGuid();
            var dataKeyResult = await ResolveDataKeyAsync(
                library.RoleId,
                null,
                $"group:{groupType}",
                readKey,
                writeKey,
                userId,
                keyRingService,
                roleCryptoService,
                ledgerService,
                dbContext,
                ct);

            var payloadBytes = request.Payload.HasValue
                ? JsonSerializer.SerializeToUtf8Bytes(request.Payload.Value)
                : JsonSerializer.SerializeToUtf8Bytes(new { infoIds, connectionIds });
            var encrypted = encryptionService.Encrypt(dataKeyResult.DataKey, payloadBytes, groupId.ToByteArray());

            dbContext.CogitaGroups.Add(new CogitaGroup
            {
                Id = groupId,
                LibraryId = libraryId,
                GroupType = groupType,
                DataKeyId = dataKeyResult.DataKeyId,
                EncryptedBlob = encrypted,
                CreatedUtc = now,
                UpdatedUtc = now
            });

            var sort = 0;
            foreach (var infoId in infoIds)
            {
                dbContext.CogitaGroupItems.Add(new CogitaGroupItem
                {
                    Id = Guid.NewGuid(),
                    GroupId = groupId,
                    InfoId = infoId,
                    SortOrder = sort++
                });
            }

            foreach (var connectionId in connectionIds)
            {
                dbContext.CogitaGroupConnections.Add(new CogitaGroupConnection
                {
                    Id = Guid.NewGuid(),
                    GroupId = groupId,
                    ConnectionId = connectionId
                });
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCreateGroupResponse(groupId, groupType));
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
            default:\n                return null;\n        }
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
        }
    }

    private static async Task<(Guid DataKeyId, byte[] DataKey)> ResolveDataKeyAsync(
        Guid roleId,
        Guid? dataKeyId,
        string metadata,
        byte[] readKey,
        byte[] writeKey,
        Guid userId,
        IKeyRingService keyRingService,
        IRoleCryptoService roleCryptoService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
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
        var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);
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
            MetadataJson = JsonSerializer.Serialize(new { metadata }),
            LedgerRefId = keyLedger.Id,
            CreatedUtc = DateTimeOffset.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        return (newKeyId, newKey);
    }

    private static async Task<CogitaCreateInfoResponse> CreateInfoInternalAsync(
        CogitaLibrary library,
        CogitaCreateInfoRequest request,
        byte[] readKey,
        byte[] writeKey,
        Guid userId,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        IRoleCryptoService roleCryptoService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
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
            writeKey,
            userId,
            keyRingService,
            roleCryptoService,
            ledgerService,
            dbContext,
            ct);

        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(request.Payload);
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

        await dbContext.SaveChangesAsync(ct);

        return new CogitaCreateInfoResponse(infoId, infoType);
    }

    private static async Task<CogitaCreateConnectionResponse> CreateConnectionInternalAsync(
        CogitaLibrary library,
        CogitaCreateConnectionRequest request,
        byte[] readKey,
        byte[] writeKey,
        Guid userId,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        IRoleCryptoService roleCryptoService,
        ILedgerService ledgerService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var connectionType = request.ConnectionType.Trim().ToLowerInvariant();
        if (!SupportedConnectionTypes.Contains(connectionType))
        {
            throw new InvalidOperationException("ConnectionType is invalid.");
        }

        var now = DateTimeOffset.UtcNow;
        var connectionId = Guid.NewGuid();
        var dataKeyResult = await ResolveDataKeyAsync(
            library.RoleId,
            request.DataKeyId,
            $"connection:{connectionType}",
            readKey,
            writeKey,
            userId,
            keyRingService,
            roleCryptoService,
            ledgerService,
            dbContext,
            ct);

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

        await dbContext.SaveChangesAsync(ct);

        return new CogitaCreateConnectionResponse(connectionId, connectionType);
    }
}
