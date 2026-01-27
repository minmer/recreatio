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
        "collection",
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
        "translation",
        "word-topic"
    };

    private static readonly string[] SupportedGroupTypes = { "vocab" };

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

                var wordLanguageMap = await dbContext.CogitaWordLanguages.AsNoTracking()
                    .ToDictionaryAsync(x => x.WordInfoId, x => x.LanguageInfoId, ct);

                var languageLabels = await ResolveInfoLabelsAsync(
                    libraryId,
                    "language",
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
                    }
                    catch (CryptographicException)
                    {
                        continue;
                    }

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

                    responses.Add(new CogitaCardSearchResponse(entry.InfoId, "info", label, description, entry.InfoType));
                }
            }

            if (cardType == "vocab" || cardType == "any")
            {
                var connectionQuery = dbContext.CogitaConnections.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.ConnectionType == "translation");

                if (cardType == "vocab")
                {
                    translationTotal = await connectionQuery.CountAsync(ct);
                    total = translationTotal;
                }
                else if (cardType == "any")
                {
                    translationTotal = await connectionQuery.CountAsync(ct);
                    total = infoTotal + translationTotal;
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
                        total = translationTotal;
                    }

                    var items = await dbContext.CogitaConnectionItems.AsNoTracking()
                        .Where(x => translations.Select(t => t.Id).Contains(x.ConnectionId))
                        .OrderBy(x => x.SortOrder)
                        .ToListAsync(ct);

                    var itemsByConnection = items.GroupBy(x => x.ConnectionId)
                        .ToDictionary(group => group.Key, group => group.Select(x => x.InfoId).ToList());

                    var wordLabels = await ResolveInfoLabelsAsync(
                        libraryId,
                        "word",
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);
                    var languageLabels = await ResolveInfoLabelsAsync(
                        libraryId,
                        "language",
                        readKey,
                        keyRingService,
                        encryptionService,
                        dbContext,
                        ct);
                    var wordLanguageMap = await dbContext.CogitaWordLanguages.AsNoTracking()
                        .ToDictionaryAsync(x => x.WordInfoId, x => x.LanguageInfoId, ct);
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

                        var langALabel = langAId != Guid.Empty && languageLabels.TryGetValue(langAId, out var l1)
                            ? l1
                            : "Language";
                        var langBLabel = langBId != Guid.Empty && languageLabels.TryGetValue(langBId, out var l2)
                            ? l2
                            : "Language";

                        var label = $"{wordALabel} ↔ {wordBLabel}";
                        var description = $"{langALabel} ↔ {langBLabel}";

                        var matchText = $"{label} {description}".ToLowerInvariant();
                        if (!string.IsNullOrWhiteSpace(loweredQuery) && !matchText.Contains(loweredQuery))
                        {
                            continue;
                        }

                        responses.Add(new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null));
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

            var itemCount = await dbContext.CogitaCollectionItems.AsNoTracking()
                .CountAsync(x => x.CollectionInfoId == info.Id, ct);

            return Results.Ok(new CogitaCollectionDetailResponse(
                info.Id,
                label,
                string.IsNullOrWhiteSpace(description) ? null : description,
                itemCount,
                info.CreatedUtc
            ));
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

            var pageSize = Math.Clamp(limit ?? 40, 1, 100);
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

            var wordLanguageMap = await dbContext.CogitaWordLanguages.AsNoTracking()
                .ToDictionaryAsync(x => x.WordInfoId, x => x.LanguageInfoId, ct);

            var languageLabels = await ResolveInfoLabelsAsync(
                libraryId,
                "language",
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
                    }
                    catch (CryptographicException)
                    {
                        continue;
                    }

                    if (entry.InfoType == "word" && wordLanguageMap.TryGetValue(entry.InfoId, out var languageInfoId))
                    {
                        if (languageLabels.TryGetValue(languageInfoId, out var langLabel) && !string.IsNullOrWhiteSpace(langLabel))
                        {
                            description = $"Language: {langLabel}";
                        }
                    }

                    infoResponses[entry.InfoId] = new CogitaCardSearchResponse(entry.InfoId, "info", label, description, entry.InfoType);
                }
            }

            var connectionResponses = new Dictionary<Guid, CogitaCardSearchResponse>();
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

                    var wordLabels = await ResolveInfoLabelsAsync(
                        libraryId,
                        "word",
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

                        var langALabel = wordLanguageMap.TryGetValue(wordA, out var langA) && languageLabels.TryGetValue(langA, out var l1)
                            ? l1
                            : "Language";
                        var langBLabel = wordLanguageMap.TryGetValue(wordB, out var langB) && languageLabels.TryGetValue(langB, out var l2)
                            ? l2
                            : "Language";

                        var label = $"{wordALabel} ↔ {wordBLabel}";
                        var description = $"{langALabel} ↔ {langBLabel}";

                        connectionResponses[pair.Key] = new CogitaCardSearchResponse(pair.Key, "vocab", label, description, null);
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

                    connectionResponses[connection.Id] = new CogitaCardSearchResponse(
                        connection.Id,
                        "connection",
                        connection.ConnectionType,
                        "Connection",
                        null
                    );
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
                    if (connectionResponses.TryGetValue(item.ItemId, out var response))
                    {
                        orderedResponses.Add(response);
                    }
                }
            }

            return Results.Ok(new CogitaCardSearchBundleResponse(total, pageSize, nextCursor, orderedResponses));
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
            var exportInfos = new List<CogitaExportInfo>();
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
                    exportInfos.Add(new CogitaExportInfo(info.Id, info.InfoType, doc.RootElement.Clone()));
                }
                catch (CryptographicException)
                {
                    continue;
                }
            }

            var connections = await dbContext.CogitaConnections.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .ToListAsync(ct);
            var connectionItems = await dbContext.CogitaConnectionItems.AsNoTracking()
                .Where(x => connections.Select(c => c.Id).Contains(x.ConnectionId))
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);
            var connectionItemsLookup = connectionItems
                .GroupBy(x => x.ConnectionId)
                .ToDictionary(group => group.Key, group => group.Select(x => x.InfoId).ToList());
            var exportConnections = new List<CogitaExportConnection>();
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

                JsonElement? payload = null;
                try
                {
                    var plain = encryptionService.Decrypt(dataKey, connection.EncryptedBlob, connection.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    payload = doc.RootElement.Clone();
                }
                catch (CryptographicException)
                {
                    payload = null;
                }

                exportConnections.Add(new CogitaExportConnection(
                    connection.Id,
                    connection.ConnectionType,
                    connectionItemsLookup.TryGetValue(connection.Id, out var infoIds) ? infoIds : new List<Guid>(),
                    payload
                ));
            }

            var collectionItems = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => infos.Select(info => info.Id).Contains(x.CollectionInfoId))
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);
            var exportCollections = collectionItems
                .GroupBy(x => x.CollectionInfoId)
                .Select(group => new CogitaExportCollection(
                    group.Key,
                    group.Select(item => new CogitaExportCollectionItem(item.ItemType, item.ItemId, item.SortOrder)).ToList()
                ))
                .ToList();

            return Results.Ok(new CogitaLibraryExportResponse(1, exportInfos, exportConnections, exportCollections));
        });

        group.MapPost("/libraries/{libraryId:guid}/import", async (
            Guid libraryId,
            CogitaLibraryImportRequest request,
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

            var infoMap = new Dictionary<Guid, Guid>();
            var connectionMap = new Dictionary<Guid, Guid>();

            foreach (var info in request.Infos)
            {
                if (!SupportedInfoTypes.Contains(info.InfoType))
                {
                    continue;
                }
                var created = await CreateInfoInternalAsync(
                    library,
                    new CogitaCreateInfoRequest(info.InfoType, info.Payload, null, null),
                    readKey,
                    ownerKey,
                    userId,
                    keyRingService,
                    encryptionService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
                infoMap[info.InfoId] = created.InfoId;
            }

            foreach (var connection in request.Connections)
            {
                if (!SupportedConnectionTypes.Contains(connection.ConnectionType))
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
                var created = await CreateConnectionInternalAsync(
                    library,
                    new CogitaCreateConnectionRequest(connection.ConnectionType, mappedIds, connection.Payload, null, null),
                    readKey,
                    ownerKey,
                    userId,
                    keyRingService,
                    encryptionService,
                    roleCryptoService,
                    ledgerService,
                    dbContext,
                    ct);
                connectionMap[connection.ConnectionId] = created.ConnectionId;
            }

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
                }
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaLibraryImportResponse(
                infoMap.Count,
                connectionMap.Count,
                request.Collections.Count
            ));
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

        await dbContext.SaveChangesAsync(ct);

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
            ownerKey,
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
        dbContext.KeyEntryBindings.Add(new KeyEntryBinding
        {
            Id = Guid.NewGuid(),
            KeyEntryId = dataKeyResult.DataKeyId,
            EntryId = infoId,
            EntryType = "cogita-info",
            EntrySubtype = infoType,
            CreatedUtc = now
        });

        await dbContext.SaveChangesAsync(ct);

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
        CancellationToken ct)
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
        dbContext.KeyEntryBindings.Add(new KeyEntryBinding
        {
            Id = Guid.NewGuid(),
            KeyEntryId = dataKeyResult.DataKeyId,
            EntryId = connectionId,
            EntryType = "cogita-connection",
            EntrySubtype = connectionType,
            CreatedUtc = now
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
