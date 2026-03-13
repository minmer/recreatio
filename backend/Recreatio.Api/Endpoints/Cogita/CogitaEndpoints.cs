using System.Security.Cryptography;
using System.Data;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Cogita;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cogita;
using Recreatio.Api.Data.Cogita.Core;
using Recreatio.Api.Domain;
using Recreatio.Api.Domain.Cogita;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaEndpoints
{
    private const string CogitaRevisionShareSchemaError =
        "Database schema for Cogita revision shares is outdated. Apply backend/Recreatio.Api/Sql/patch_cogita_revision_shares_runtime_compat.sql on the API database.";
    private const string CogitaStoryboardShareSchemaError =
        "Database schema for Cogita storyboard shares is outdated. Apply backend/Recreatio.Api/Sql/schema.sql on the API database.";

    private static readonly HashSet<string> SupportedInfoTypes = new(CogitaTypeRegistry.SupportedInfoTypes, StringComparer.Ordinal);

    private static readonly HashSet<string> SupportedConnectionTypes = new(CogitaTypeRegistry.SupportedConnectionTypes, StringComparer.Ordinal);

    private static readonly HashSet<string> SupportedCreationProjectTypes = new(
        new[] { "storyboard", "text" },
        StringComparer.Ordinal);

    private static readonly string[] SupportedCollectionGraphNodeTypes =
    {
        "source.translation",
        "source.info.all",
        "filter.tag",
        "filter.language",
        "logic.and",
        "logic.or",
        "output.collection"
    };

    private static string NormalizeCreationProjectType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "storyboards" => "storyboard",
            "texts" => "text",
            _ => normalized
        };
    }

    private static JsonElement? ParseOptionalJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            return document.RootElement.Clone();
        }
        catch
        {
            return null;
        }
    }

    private static IResult RedirectCogitaAlias(HttpContext context, string path)
    {
        var query = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : string.Empty;
        return Results.Redirect($"{path}{query}", permanent: false, preserveMethod: true);
    }

    public static void MapCogitaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/cogita").RequireAuthorization();

        // Legacy naming aliases to keep deprecated infos/checkcards paths compatible.
        group.MapMethods("/libraries/{libraryId:guid}/infos", new[] { "GET", "POST" }, (
            Guid libraryId,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/libraries/{libraryId:D}/notions"));
        group.MapMethods("/libraries/{libraryId:guid}/infos/{infoId:guid}", new[] { "GET", "PUT", "DELETE" }, (
            Guid libraryId,
            Guid infoId,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/libraries/{libraryId:D}/notions/{infoId:D}"));
        group.MapGet("/libraries/{libraryId:guid}/infos/{infoId:guid}/collections", (
            Guid libraryId,
            Guid infoId,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/libraries/{libraryId:D}/notions/{infoId:D}/collections"));
        group.MapGet("/libraries/{libraryId:guid}/infos/{infoId:guid}/approaches/{approachKey}", (
            Guid libraryId,
            Guid infoId,
            string approachKey,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/libraries/{libraryId:D}/notions/{infoId:D}/approaches/{Uri.EscapeDataString(approachKey)}"));
        group.MapGet("/libraries/{libraryId:guid}/infos/{infoId:guid}/checkcards", (
            Guid libraryId,
            Guid infoId,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/libraries/{libraryId:D}/notions/{infoId:D}/cards"));
        group.MapGet("/libraries/{libraryId:guid}/infos/{infoId:guid}/checkcards/dependencies", (
            Guid libraryId,
            Guid infoId,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/libraries/{libraryId:D}/notions/{infoId:D}/cards/dependencies"));
        group.MapGet("/public/revision/{code}/infos", (
            string code,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/public/revision/{Uri.EscapeDataString(code)}/notions"))
            .AllowAnonymous();
        group.MapGet("/public/revision/{code}/infos/{infoId:guid}", (
            string code,
            Guid infoId,
            HttpContext context) =>
            RedirectCogitaAlias(context, $"/cogita/public/revision/{Uri.EscapeDataString(code)}/notions/{infoId:D}"))
            .AllowAnonymous();

        group.MapGet("/dashboard/preferences", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var existing = await dbContext.CogitaDashboardPreferences.AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId == userId, ct);

            if (existing is null)
            {
                var now = DateTimeOffset.UtcNow;
                return Results.Ok(new CogitaDashboardPreferencesResponse(
                    "v1",
                    "{}",
                    now,
                    now));
            }

            return Results.Ok(new CogitaDashboardPreferencesResponse(
                string.IsNullOrWhiteSpace(existing.LayoutVersion) ? "v1" : existing.LayoutVersion,
                string.IsNullOrWhiteSpace(existing.PreferencesJson) ? "{}" : existing.PreferencesJson,
                existing.CreatedUtc,
                existing.UpdatedUtc));
        });

        group.MapPost("/dashboard/preferences", async (
            CogitaDashboardPreferencesRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var normalizedJson = string.IsNullOrWhiteSpace(request.PreferencesJson)
                ? "{}"
                : request.PreferencesJson.Trim();
            if (normalizedJson.Length > 256_000)
            {
                return Results.BadRequest(new { error = "Preferences payload is too large." });
            }

            try
            {
                using var _ = JsonDocument.Parse(normalizedJson);
            }
            catch
            {
                return Results.BadRequest(new { error = "PreferencesJson must be valid JSON." });
            }

            var normalizedLayoutVersion = string.IsNullOrWhiteSpace(request.LayoutVersion)
                ? "v1"
                : request.LayoutVersion.Trim();
            if (normalizedLayoutVersion.Length > 64)
            {
                normalizedLayoutVersion = normalizedLayoutVersion[..64];
            }

            var now = DateTimeOffset.UtcNow;
            var existing = await dbContext.CogitaDashboardPreferences
                .FirstOrDefaultAsync(x => x.UserId == userId, ct);
            if (existing is null)
            {
                existing = new CogitaDashboardPreference
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    LayoutVersion = normalizedLayoutVersion,
                    PreferencesJson = normalizedJson,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaDashboardPreferences.Add(existing);
            }
            else
            {
                existing.LayoutVersion = normalizedLayoutVersion;
                existing.PreferencesJson = normalizedJson;
                existing.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaDashboardPreferencesResponse(
                existing.LayoutVersion,
                existing.PreferencesJson,
                existing.CreatedUtc,
                existing.UpdatedUtc));
        });

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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey))
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

        group.MapGet("/libraries/{libraryId:guid}/creation-projects", async (
            Guid libraryId,
            string? projectType,
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

            var hasRead = keyRing.TryGetReadKey(library.RoleId, out _);
            var hasWrite = keyRing.TryGetWriteKey(library.RoleId, out _);
            if (!hasRead && !hasWrite)
            {
                return Results.Forbid();
            }

            string? normalizedType = null;
            if (!string.IsNullOrWhiteSpace(projectType))
            {
                normalizedType = NormalizeCreationProjectType(projectType);
                if (!SupportedCreationProjectTypes.Contains(normalizedType))
                {
                    return Results.BadRequest(new { error = "Unsupported project type." });
                }
            }

            var query = dbContext.CogitaCreationProjects.AsNoTracking()
                .Where(x => x.LibraryId == libraryId);
            if (!string.IsNullOrWhiteSpace(normalizedType))
            {
                query = query.Where(x => x.ProjectType == normalizedType);
            }

            var rows = await query
                .OrderByDescending(x => x.UpdatedUtc)
                .ThenByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var response = rows.Select(row => new CogitaCreationProjectResponse(
                row.Id,
                row.ProjectType,
                row.Name,
                ParseOptionalJson(row.ContentJson),
                row.CreatedUtc,
                row.UpdatedUtc))
                .ToList();

            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/creation-projects", async (
            Guid libraryId,
            CogitaCreationProjectCreateRequest request,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var normalizedType = NormalizeCreationProjectType(request.ProjectType);
            if (!SupportedCreationProjectTypes.Contains(normalizedType))
            {
                return Results.BadRequest(new { error = "Unsupported project type." });
            }

            var name = string.IsNullOrWhiteSpace(request.Name) ? normalizedType : request.Name.Trim();
            if (name.Length > 256)
            {
                name = name[..256];
            }

            var now = DateTimeOffset.UtcNow;
            var row = new CogitaCreationProject
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                ProjectType = normalizedType,
                Name = name,
                ContentJson = request.Content.HasValue ? request.Content.Value.GetRawText() : null,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.CogitaCreationProjects.Add(row);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCreationProjectResponse(
                row.Id,
                row.ProjectType,
                row.Name,
                ParseOptionalJson(row.ContentJson),
                row.CreatedUtc,
                row.UpdatedUtc));
        });

        group.MapPut("/libraries/{libraryId:guid}/creation-projects/{projectId:guid}", async (
            Guid libraryId,
            Guid projectId,
            CogitaCreationProjectUpdateRequest request,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var row = await dbContext.CogitaCreationProjects
                .FirstOrDefaultAsync(x => x.Id == projectId && x.LibraryId == libraryId, ct);
            if (row is null)
            {
                return Results.NotFound();
            }

            var name = string.IsNullOrWhiteSpace(request.Name) ? row.Name : request.Name.Trim();
            if (name.Length > 256)
            {
                name = name[..256];
            }

            row.Name = name;
            row.ContentJson = request.Content.HasValue ? request.Content.Value.GetRawText() : null;
            row.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCreationProjectResponse(
                row.Id,
                row.ProjectType,
                row.Name,
                ParseOptionalJson(row.ContentJson),
                row.CreatedUtc,
                row.UpdatedUtc));
        });

        group.MapDelete("/libraries/{libraryId:guid}/creation-projects/{projectId:guid}", async (
            Guid libraryId,
            Guid projectId,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var row = await dbContext.CogitaCreationProjects
                .FirstOrDefaultAsync(x => x.Id == projectId && x.LibraryId == libraryId, ct);
            if (row is null)
            {
                return Results.NotFound();
            }

            if (row.ProjectType == "storyboard" &&
                await HasCogitaStoryboardShareRuntimeSchemaAsync(dbContext, ct))
            {
                var hasActiveShares = await dbContext.CogitaStoryboardShares.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.ProjectId == projectId && x.RevokedUtc == null, ct);
                if (hasActiveShares)
                {
                    return Results.BadRequest(new { error = "Cannot delete storyboard with active shared links.", blockers = new[] { "storyboard-shares" } });
                }
            }

            dbContext.CogitaCreationProjects.Remove(row);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        group.MapPost("/libraries/{libraryId:guid}/storyboard-shares", async (
            Guid libraryId,
            CogitaStoryboardShareCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IEncryptionService encryptionService,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (!await HasCogitaStoryboardShareRuntimeSchemaAsync(dbContext, ct))
            {
                return Results.BadRequest(new { error = CogitaStoryboardShareSchemaError });
            }

            var projectId = request.ProjectId;
            if (projectId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "ProjectId is invalid." });
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var project = await dbContext.CogitaCreationProjects.AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == projectId &&
                    x.LibraryId == libraryId &&
                    x.ProjectType == "storyboard", ct);
            if (project is null)
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

            if (!keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            string shareCode;
            byte[] shareCodeBytes;
            byte[] secretHash;
            var attempts = 0;
            while (true)
            {
                shareCode = GenerateNumericShareCode(18);
                shareCodeBytes = Encoding.UTF8.GetBytes(shareCode);
                secretHash = hashingService.Hash(shareCodeBytes);
                var exists = await dbContext.CogitaStoryboardShares.AsNoTracking()
                    .AnyAsync(x => x.PublicCodeHash == secretHash, ct);
                attempts++;
                if (!exists || attempts >= 5)
                {
                    break;
                }
            }

            if (attempts >= 5)
            {
                return Results.Problem("Unable to generate a unique storyboard share code.");
            }

            var now = DateTimeOffset.UtcNow;

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

            var previousActiveShare = await dbContext.CogitaStoryboardShares
                .FirstOrDefaultAsync(x =>
                    x.LibraryId == libraryId &&
                    x.ProjectId == projectId &&
                    x.RevokedUtc == null, ct);
            if (previousActiveShare is not null)
            {
                previousActiveShare.RevokedUtc = now;
                await dbContext.SaveChangesAsync(ct);
            }

            var shareId = Guid.NewGuid();
            var encShareCode = encryptionService.Encrypt(ownerKey, shareCodeBytes, shareId.ToByteArray());
            dbContext.CogitaStoryboardShares.Add(new CogitaStoryboardShare
            {
                Id = shareId,
                LibraryId = libraryId,
                ProjectId = projectId,
                OwnerRoleId = library.RoleId,
                PublicCodeHash = secretHash,
                EncShareCode = encShareCode,
                CreatedUtc = now,
                RevokedUtc = null
            });

            await dbContext.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Results.Ok(new CogitaStoryboardShareCreateResponse(
                shareId,
                projectId,
                project.Name,
                shareCode,
                now
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/storyboard-shares", async (
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

            if (!await HasCogitaStoryboardShareRuntimeSchemaAsync(dbContext, ct))
            {
                return Results.BadRequest(new { error = CogitaStoryboardShareSchemaError });
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

            if (!keyRing.TryGetOwnerKey(library.RoleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var shares = await dbContext.CogitaStoryboardShares.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .OrderByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);
            if (shares.Count == 0)
            {
                return Results.Ok(new List<CogitaStoryboardShareResponse>());
            }

            var projectIds = shares.Select(x => x.ProjectId).Distinct().ToList();
            var projects = await dbContext.CogitaCreationProjects.AsNoTracking()
                .Where(x =>
                    x.LibraryId == libraryId &&
                    x.ProjectType == "storyboard" &&
                    projectIds.Contains(x.Id))
                .ToListAsync(ct);
            var projectLookup = projects.ToDictionary(x => x.Id, x => x);

            var response = new List<CogitaStoryboardShareResponse>();
            foreach (var share in shares)
            {
                var shareCode = string.Empty;
                if (share.EncShareCode.Length > 0)
                {
                    try
                    {
                        var plain = encryptionService.Decrypt(ownerKey, share.EncShareCode, share.Id.ToByteArray());
                        shareCode = Encoding.UTF8.GetString(plain);
                    }
                    catch (CryptographicException)
                    {
                        shareCode = string.Empty;
                    }
                }

                var projectName = projectLookup.TryGetValue(share.ProjectId, out var projectItem)
                    ? projectItem.Name
                    : "Storyboard";

                response.Add(new CogitaStoryboardShareResponse(
                    share.Id,
                    share.ProjectId,
                    projectName,
                    shareCode,
                    share.CreatedUtc,
                    share.RevokedUtc
                ));
            }

            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/storyboard-shares/{shareId:guid}/revoke", async (
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

            if (!await HasCogitaStoryboardShareRuntimeSchemaAsync(dbContext, ct))
            {
                return Results.BadRequest(new { error = CogitaStoryboardShareSchemaError });
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

            var share = await dbContext.CogitaStoryboardShares
                .FirstOrDefaultAsync(x => x.Id == shareId && x.LibraryId == libraryId, ct);
            if (share is null)
            {
                return Results.NotFound();
            }

            if (share.RevokedUtc is not null)
            {
                return Results.Ok();
            }

            share.RevokedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapGet("/libraries/{libraryId:guid}/info-types/specification", async (
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

            var hasRead = keyRing.TryGetReadKey(library.RoleId, out _);
            var hasWrite = keyRing.TryGetWriteKey(library.RoleId, out _);
            if (!hasRead && !hasWrite)
            {
                return Results.Forbid();
            }

            var specs = SupportedInfoTypes
                .OrderBy(x => x)
                .Select(infoType =>
                {
                    var descriptor = CogitaTypeRegistry.GetEditorDescriptor(infoType);
                    var payloadFields = descriptor?.PayloadFields
                        .Select(field => new CogitaInfoPayloadFieldSpecResponse(
                            field.Key,
                            field.Label,
                            field.InputType,
                            field.Required,
                            field.Searchable,
                            field.KeepOnCreate))
                        .ToList() ?? new List<CogitaInfoPayloadFieldSpecResponse>();
                    var linkFields = descriptor?.LinkFields
                        .Select(field => new CogitaInfoLinkFieldSpecResponse(
                            field.Key,
                            field.Label,
                            field.TargetTypes.ToList(),
                            field.Required,
                            field.Multiple,
                            field.KeepOnCreate))
                        .ToList() ?? new List<CogitaInfoLinkFieldSpecResponse>();
                    return new CogitaInfoTypeSpecResponse(
                        infoType,
                        CogitaTypeRegistry.InferEntityKind(infoType),
                        payloadFields,
                        linkFields);
                })
                .ToList();

            return Results.Ok(specs);
        });

        group.MapGet("/libraries/{libraryId:guid}/approaches/specification", async (
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

            var specs = CogitaApproachRegistry.Approaches.Values
                .OrderBy(x => x.Category)
                .ThenBy(x => x.Label)
                .Select(x => new CogitaInfoApproachSpecResponse(
                    x.ApproachKey,
                    x.Label,
                    x.Category,
                    x.SourceInfoTypes.ToList()))
                .ToList();

            return Results.Ok(specs);
        });

        group.MapGet("/libraries/{libraryId:guid}/notions", async (
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

        group.MapGet("/libraries/{libraryId:guid}/entities/search", async (
            Guid libraryId,
            string? type,
            string? query,
            string? filters,
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

            var entityType = string.IsNullOrWhiteSpace(type) ? null : type.Trim().ToLowerInvariant();
            var loweredQuery = query?.Trim().ToLowerInvariant();
            var pageSize = Math.Clamp(limit ?? 80, 1, 200);
            var parsedFilters = ParseSearchFilters(filters);

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

            await EnsureEntitySearchDocumentsAsync(
                libraryId,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);

            var searchQuery = dbContext.CogitaEntitySearchDocuments.AsNoTracking()
                .Where(x => x.LibraryId == libraryId);

            if (!string.IsNullOrWhiteSpace(entityType))
            {
                searchQuery = searchQuery.Where(x => x.EntityType == entityType);
            }

            if (!string.IsNullOrWhiteSpace(loweredQuery))
            {
                searchQuery = searchQuery.Where(x =>
                    x.TitleNormalized.Contains(loweredQuery) ||
                    x.SearchTextNormalized.Contains(loweredQuery));
            }

            foreach (var pair in parsedFilters)
            {
                var token = $";{NormalizeFilterToken(pair.Key)}={NormalizeFilterToken(pair.Value)};";
                searchQuery = searchQuery.Where(x => x.FilterTextNormalized.Contains(token));
            }

            var responses = await searchQuery
                .OrderBy(x => x.TitleNormalized)
                .ThenBy(x => x.EntityType)
                .Take(pageSize)
                .Select(x => new CogitaEntitySearchResponse(
                    x.SourceId,
                    x.EntityKind,
                    x.EntityType,
                    x.Title,
                    x.Summary,
                    x.InfoId,
                    x.ConnectionId))
                .ToListAsync(ct);

            return Results.Ok(responses);
        });

        group.MapGet("/libraries/{libraryId:guid}/notions/{infoId:guid}", async (
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

            var linksJson = await LoadInfoLinksAsJsonAsync(libraryId, info.Id, info.InfoType, dbContext, ct);
            return Results.Ok(new CogitaInfoDetailResponse(info.Id, info.InfoType, payloadJson, linksJson));
        });

        group.MapGet("/libraries/{libraryId:guid}/notions/{infoId:guid}/collections", async (
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

            var infoExists = await dbContext.CogitaInfos.AsNoTracking()
                .AnyAsync(x => x.Id == infoId && x.LibraryId == libraryId, ct);
            if (!infoExists)
            {
                return Results.NotFound();
            }

            var collectionIds = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => x.ItemType == "info" && x.ItemId == infoId)
                .Select(x => x.CollectionInfoId)
                .Distinct()
                .ToListAsync(ct);

            if (collectionIds.Count == 0)
            {
                return Results.Ok(new List<CogitaCollectionSummaryResponse>());
            }

            var itemCounts = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => collectionIds.Contains(x.CollectionInfoId))
                .GroupBy(x => x.CollectionInfoId)
                .Select(g => new { CollectionId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CollectionId, x => x.Count, ct);

            var collectionInfos = await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.InfoType == "collection" && collectionIds.Contains(x.Id))
                .OrderBy(x => x.CreatedUtc)
                .ThenBy(x => x.Id)
                .ToListAsync(ct);

            var payloads = await dbContext.CogitaCollections.AsNoTracking()
                .Where(x => collectionIds.Contains(x.InfoId))
                .ToListAsync(ct);
            var payloadByInfoId = payloads.ToDictionary(x => x.InfoId, x => x);

            var dataKeyIds = payloads.Select(x => x.DataKeyId).Distinct().ToList();
            var keyEntryById = dataKeyIds.Count == 0
                ? new Dictionary<Guid, KeyEntry>()
                : await dbContext.Keys.AsNoTracking()
                    .Where(x => dataKeyIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, ct);

            var responses = new List<CogitaCollectionSummaryResponse>();
            foreach (var info in collectionInfos)
            {
                if (!payloadByInfoId.TryGetValue(info.Id, out var payload))
                {
                    continue;
                }
                if (!keyEntryById.TryGetValue(payload.DataKeyId, out var keyEntry))
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
                    var plain = encryptionService.Decrypt(dataKey, payload.EncryptedBlob, info.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    label = ResolveLabel(doc.RootElement, "collection") ?? "Collection";
                    description = ResolveDescription(doc.RootElement, "collection") ?? string.Empty;
                }
                catch (CryptographicException)
                {
                    continue;
                }

                responses.Add(new CogitaCollectionSummaryResponse(
                    info.Id,
                    label,
                    string.IsNullOrWhiteSpace(description) ? null : description,
                    itemCounts.TryGetValue(info.Id, out var count) ? count : 0,
                    info.CreatedUtc));
            }

            responses = responses.OrderBy(x => x.Name).ToList();

            return Results.Ok(responses);
        });

        group.MapGet("/libraries/{libraryId:guid}/notions/{infoId:guid}/approaches/{approachKey}", async (
            Guid libraryId,
            Guid infoId,
            string approachKey,
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

            var approach = CogitaApproachRegistry.Get(approachKey.Trim());
            if (approach is null)
            {
                return Results.NotFound();
            }

            if (!approach.SourceInfoTypes.Contains(info.InfoType, StringComparer.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = $"Approach '{approach.ApproachKey}' is not valid for info type '{info.InfoType}'." });
            }

            var projection = await BuildInfoApproachProjectionAsync(
                libraryId,
                info,
                approach.ApproachKey,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);
            if (projection is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new CogitaInfoApproachProjectionResponse(approach.ApproachKey, info.Id, info.InfoType, projection.Value));
        });

        group.MapGet("/libraries/{libraryId:guid}/notions/{infoId:guid}/cards", async (
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

            var cards = await BuildEffectiveInfoCheckcardsAsync(
                libraryId,
                info,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);

            return Results.Ok(new CogitaCardSearchBundleResponse(cards.Count, cards.Count, null, cards));
        });

        group.MapGet("/libraries/{libraryId:guid}/notions/{infoId:guid}/cards/dependencies", async (
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

            var dependencies = await BuildEffectiveInfoCheckcardDependenciesAsync(
                libraryId,
                info,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);

            var response = dependencies
                .Select(x => new CogitaItemDependencyResponse(
                    x.ParentItemType,
                    x.ParentItemId,
                    x.ParentCheckType,
                    x.ParentDirection,
                    x.ChildItemType,
                    x.ChildItemId,
                    x.ChildCheckType,
                    x.ChildDirection))
                .ToList();
            return Results.Ok(new CogitaItemDependencyBundleResponse(response));
        });

        group.MapPut("/libraries/{libraryId:guid}/notions/{infoId:guid}", async (
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

            var sanitizedPayload = SanitizePayloadForInfoType(info.InfoType, request.Payload);
            var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(sanitizedPayload);
            var encrypted = encryptionService.Encrypt(dataKey, payloadBytes, info.Id.ToByteArray());

            var updated = UpdateInfoPayload(info.InfoType, info.Id, dataKeyId, encrypted, now, dbContext);
            if (!updated)
            {
                return Results.NotFound();
            }

            try
            {
                await UpsertInfoLinksAsync(
                    libraryId,
                    info.Id,
                    info.InfoType,
                    request.Links,
                    now,
                    dbContext,
                    ct);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }

            info.UpdatedUtc = now;
            await UpsertInfoSearchIndexAsync(libraryId, info.Id, info.InfoType, sanitizedPayload, now, dbContext, ct);

            try
            {
                await dbContext.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsMissingInfoLinksSchema(ex))
            {
                return Results.BadRequest(new
                {
                    error = "Database schema for Cogita links is outdated. Apply backend/Recreatio.Api/Sql/schema.sql (CogitaKnowledgeLinkSingles/CogitaKnowledgeLinkMultis)."
                });
            }

            return Results.Ok(new CogitaUpdateInfoResponse(info.Id, info.InfoType));
        });

        group.MapDelete("/libraries/{libraryId:guid}/notions/{infoId:guid}", async (
            Guid libraryId,
            Guid infoId,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var info = await dbContext.CogitaInfos
                .FirstOrDefaultAsync(x => x.Id == infoId && x.LibraryId == libraryId, ct);
            if (info is null)
            {
                return Results.NotFound();
            }

            var blockers = new List<string>();
            var usedByCollections = await dbContext.CogitaCollectionItems.AsNoTracking()
                .AnyAsync(x => x.ItemType == "info" && x.ItemId == infoId, ct);
            if (usedByCollections)
            {
                blockers.Add("collection-items");
            }

            var usedByConnections = await dbContext.CogitaConnectionItems.AsNoTracking()
                .AnyAsync(x => x.InfoId == infoId, ct);
            if (usedByConnections)
            {
                blockers.Add("connections");
            }

            var usedAsLinkTarget = await dbContext.CogitaKnowledgeLinkSinglesCore.AsNoTracking()
                .AnyAsync(x => x.LibraryId == libraryId && x.TargetItemId == infoId, ct)
                || await dbContext.CogitaKnowledgeLinkMultisCore.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.TargetItemId == infoId, ct);
            if (!usedAsLinkTarget)
            {
                // Compatibility check for datasets not migrated to knowledge-link tables yet.
                usedAsLinkTarget = await dbContext.CogitaInfoLinkSingles.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.TargetInfoId == infoId, ct)
                    || await dbContext.CogitaInfoLinkMultis.AsNoTracking()
                        .AnyAsync(x => x.LibraryId == libraryId && x.TargetInfoId == infoId, ct);
            }
            if (usedAsLinkTarget)
            {
                blockers.Add("knowledge-links");
            }

            var usedByWordLanguage = await dbContext.CogitaWordLanguages.AsNoTracking()
                .AnyAsync(x => x.LanguageInfoId == infoId || x.WordInfoId == infoId, ct);
            if (usedByWordLanguage)
            {
                blockers.Add("word-language");
            }

            if (info.InfoType == "collection")
            {
                var hasRevisions = await dbContext.CogitaRevisions.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.CollectionId == infoId, ct);
                if (hasRevisions)
                {
                    blockers.Add("revisions");
                }

                var hasLiveSessions = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                    .AnyAsync(x => x.LibraryId == libraryId && x.CollectionId == infoId, ct);
                if (hasLiveSessions)
                {
                    blockers.Add("live-sessions");
                }

                var hasCollectionDependencies = await dbContext.CogitaCollectionDependencies.AsNoTracking()
                    .AnyAsync(x => x.ParentCollectionInfoId == infoId || x.ChildCollectionInfoId == infoId, ct);
                if (hasCollectionDependencies)
                {
                    blockers.Add("collection-dependencies");
                }
            }

            if (blockers.Count > 0)
            {
                return Results.Conflict(new
                {
                    error = $"Cannot delete info. Remove references first ({string.Join(", ", blockers)})."
                });
            }

            var ownSingles = await dbContext.CogitaKnowledgeLinkSinglesCore
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == infoId)
                .ToListAsync(ct);
            var ownMultis = await dbContext.CogitaKnowledgeLinkMultisCore
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == infoId)
                .ToListAsync(ct);
            if (ownSingles.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkSinglesCore.RemoveRange(ownSingles);
            }
            if (ownMultis.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkMultisCore.RemoveRange(ownMultis);
            }

            var ownReferenceFields = await dbContext.CogitaReferenceCryptoFields
                .Where(x => x.LibraryId == libraryId && x.OwnerEntity == "knowledge-item" && x.OwnerId == infoId)
                .ToListAsync(ct);
            if (ownReferenceFields.Count > 0)
            {
                dbContext.CogitaReferenceCryptoFields.RemoveRange(ownReferenceFields);
            }

            var legacyOwnSingles = await dbContext.CogitaInfoLinkSingles
                .Where(x => x.LibraryId == libraryId && x.InfoId == infoId)
                .ToListAsync(ct);
            var legacyOwnMultis = await dbContext.CogitaInfoLinkMultis
                .Where(x => x.LibraryId == libraryId && x.InfoId == infoId)
                .ToListAsync(ct);
            if (legacyOwnSingles.Count > 0)
            {
                dbContext.CogitaInfoLinkSingles.RemoveRange(legacyOwnSingles);
            }
            if (legacyOwnMultis.Count > 0)
            {
                dbContext.CogitaInfoLinkMultis.RemoveRange(legacyOwnMultis);
            }

            var searchIndexRows = await dbContext.CogitaInfoSearchIndexes
                .Where(x => x.LibraryId == libraryId && x.InfoId == infoId)
                .ToListAsync(ct);
            if (searchIndexRows.Count > 0)
            {
                dbContext.CogitaInfoSearchIndexes.RemoveRange(searchIndexRows);
            }

            var itemDependencies = await dbContext.CogitaItemDependencies
                .Where(x => x.LibraryId == libraryId &&
                            ((x.ParentItemType == "info" && x.ParentItemId == infoId) ||
                             (x.ChildItemType == "info" && x.ChildItemId == infoId) ||
                             (x.ParentItemType == "collection" && x.ParentItemId == infoId) ||
                             (x.ChildItemType == "collection" && x.ChildItemId == infoId)))
                .ToListAsync(ct);
            if (itemDependencies.Count > 0)
            {
                dbContext.CogitaItemDependencies.RemoveRange(itemDependencies);
            }

            var reviewOutcomes = await dbContext.CogitaReviewOutcomes
                .Where(x => x.LibraryId == libraryId && x.ItemType == "info" && x.ItemId == infoId)
                .ToListAsync(ct);
            if (reviewOutcomes.Count > 0)
            {
                dbContext.CogitaReviewOutcomes.RemoveRange(reviewOutcomes);
            }
            var reviewEvents = await dbContext.CogitaReviewEvents
                .Where(x => x.LibraryId == libraryId && x.ItemType == "info" && x.ItemId == infoId)
                .ToListAsync(ct);
            if (reviewEvents.Count > 0)
            {
                dbContext.CogitaReviewEvents.RemoveRange(reviewEvents);
            }
            var statisticEvents = await dbContext.CogitaStatisticEvents
                .Where(x => x.LibraryId == libraryId && x.ItemType == "info" && x.ItemId == infoId)
                .ToListAsync(ct);
            if (statisticEvents.Count > 0)
            {
                dbContext.CogitaStatisticEvents.RemoveRange(statisticEvents);
            }

            if (!RemoveInfoPayload(info.InfoType, info.Id, dbContext))
            {
                return Results.NotFound();
            }

            dbContext.CogitaInfos.Remove(info);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { deleted = true });
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

        group.MapPut("/libraries/{libraryId:guid}/collections/{collectionId:guid}", async (
            Guid libraryId,
            Guid collectionId,
            CogitaCollectionUpdateRequest request,
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

            var name = request.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Collection name is required." });
            }

            var library = await dbContext.CogitaLibraries
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var info = await dbContext.CogitaInfos
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var readKey) ||
                !keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var payloadRow = await LoadInfoPayloadAsync(info, dbContext, ct);
            if (payloadRow is null)
            {
                return Results.NotFound();
            }

            var keyEntry = await dbContext.Keys.FirstOrDefaultAsync(x => x.Id == payloadRow.Value.DataKeyId, ct);
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

            var sanitizedPayload = SanitizePayloadForInfoType(
                "collection",
                JsonSerializer.SerializeToElement(new
                {
                    label = name,
                    notes = request.Notes ?? string.Empty
                }));
            var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(sanitizedPayload);
            var now = DateTimeOffset.UtcNow;
            var encrypted = encryptionService.Encrypt(dataKey, payloadBytes, info.Id.ToByteArray());

            var updated = UpdateInfoPayload("collection", info.Id, payloadRow.Value.DataKeyId, encrypted, now, dbContext);
            if (!updated)
            {
                return Results.NotFound();
            }

            info.UpdatedUtc = now;
            await UpsertInfoSearchIndexAsync(libraryId, info.Id, "collection", sanitizedPayload, now, dbContext, ct);
            await dbContext.SaveChangesAsync(ct);

            var itemCount = await dbContext.CogitaCollectionItems.AsNoTracking()
                .CountAsync(x => x.CollectionInfoId == info.Id, ct);

            var notes = request.Notes?.Trim();
            return Results.Ok(new CogitaCollectionDetailResponse(
                info.Id,
                name,
                string.IsNullOrWhiteSpace(notes) ? null : notes,
                itemCount,
                info.CreatedUtc));
        });

        group.MapDelete("/libraries/{libraryId:guid}/collections/{collectionId:guid}", async (
            Guid libraryId,
            Guid collectionId,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var info = await dbContext.CogitaInfos
                .FirstOrDefaultAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (info is null)
            {
                return Results.NotFound();
            }

            var blockers = new List<string>();
            var hasRevisions = await dbContext.CogitaRevisions.AsNoTracking()
                .AnyAsync(x => x.LibraryId == libraryId && x.CollectionId == collectionId, ct);
            if (hasRevisions)
            {
                blockers.Add("revisions");
            }

            var hasLiveSessions = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .AnyAsync(x => x.LibraryId == libraryId && x.CollectionId == collectionId, ct);
            if (hasLiveSessions)
            {
                blockers.Add("live-sessions");
            }

            var hasParentDeps = await dbContext.CogitaCollectionDependencies.AsNoTracking()
                .AnyAsync(x => x.ParentCollectionInfoId == collectionId || x.ChildCollectionInfoId == collectionId, ct);
            if (hasParentDeps)
            {
                blockers.Add("collection-dependencies");
            }

            if (blockers.Count > 0)
            {
                return Results.Conflict(new
                {
                    error = $"Cannot delete collection. Remove references first ({string.Join(", ", blockers)})."
                });
            }

            var collectionItems = await dbContext.CogitaCollectionItems
                .Where(x => x.CollectionInfoId == collectionId)
                .ToListAsync(ct);
            if (collectionItems.Count > 0)
            {
                dbContext.CogitaCollectionItems.RemoveRange(collectionItems);
            }

            var graph = await dbContext.CogitaCollectionGraphs
                .FirstOrDefaultAsync(x => x.CollectionInfoId == collectionId, ct);
            if (graph is not null)
            {
                var nodes = await dbContext.CogitaCollectionGraphNodes
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                var edges = await dbContext.CogitaCollectionGraphEdges
                    .Where(x => x.GraphId == graph.Id)
                    .ToListAsync(ct);
                if (edges.Count > 0)
                {
                    dbContext.CogitaCollectionGraphEdges.RemoveRange(edges);
                }
                if (nodes.Count > 0)
                {
                    dbContext.CogitaCollectionGraphNodes.RemoveRange(nodes);
                }
                dbContext.CogitaCollectionGraphs.Remove(graph);
            }

            var ownSingles = await dbContext.CogitaKnowledgeLinkSinglesCore
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == collectionId)
                .ToListAsync(ct);
            var ownMultis = await dbContext.CogitaKnowledgeLinkMultisCore
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == collectionId)
                .ToListAsync(ct);
            var incomingSingles = await dbContext.CogitaKnowledgeLinkSinglesCore
                .Where(x => x.LibraryId == libraryId && x.TargetItemId == collectionId)
                .ToListAsync(ct);
            var incomingMultis = await dbContext.CogitaKnowledgeLinkMultisCore
                .Where(x => x.LibraryId == libraryId && x.TargetItemId == collectionId)
                .ToListAsync(ct);
            if (ownSingles.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkSinglesCore.RemoveRange(ownSingles);
            }
            if (ownMultis.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkMultisCore.RemoveRange(ownMultis);
            }
            if (incomingSingles.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkSinglesCore.RemoveRange(incomingSingles);
            }
            if (incomingMultis.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkMultisCore.RemoveRange(incomingMultis);
            }

            var ownReferenceFields = await dbContext.CogitaReferenceCryptoFields
                .Where(x => x.LibraryId == libraryId && x.OwnerEntity == "knowledge-item" && x.OwnerId == collectionId)
                .ToListAsync(ct);
            if (ownReferenceFields.Count > 0)
            {
                dbContext.CogitaReferenceCryptoFields.RemoveRange(ownReferenceFields);
            }

            var legacyOwnSingles = await dbContext.CogitaInfoLinkSingles
                .Where(x => x.LibraryId == libraryId && x.InfoId == collectionId)
                .ToListAsync(ct);
            var legacyOwnMultis = await dbContext.CogitaInfoLinkMultis
                .Where(x => x.LibraryId == libraryId && x.InfoId == collectionId)
                .ToListAsync(ct);
            var legacyIncomingSingles = await dbContext.CogitaInfoLinkSingles
                .Where(x => x.LibraryId == libraryId && x.TargetInfoId == collectionId)
                .ToListAsync(ct);
            var legacyIncomingMultis = await dbContext.CogitaInfoLinkMultis
                .Where(x => x.LibraryId == libraryId && x.TargetInfoId == collectionId)
                .ToListAsync(ct);
            if (legacyOwnSingles.Count > 0)
            {
                dbContext.CogitaInfoLinkSingles.RemoveRange(legacyOwnSingles);
            }
            if (legacyOwnMultis.Count > 0)
            {
                dbContext.CogitaInfoLinkMultis.RemoveRange(legacyOwnMultis);
            }
            if (legacyIncomingSingles.Count > 0)
            {
                dbContext.CogitaInfoLinkSingles.RemoveRange(legacyIncomingSingles);
            }
            if (legacyIncomingMultis.Count > 0)
            {
                dbContext.CogitaInfoLinkMultis.RemoveRange(legacyIncomingMultis);
            }

            var searchIndexRows = await dbContext.CogitaInfoSearchIndexes
                .Where(x => x.LibraryId == libraryId && x.InfoId == collectionId)
                .ToListAsync(ct);
            if (searchIndexRows.Count > 0)
            {
                dbContext.CogitaInfoSearchIndexes.RemoveRange(searchIndexRows);
            }

            var itemDependencies = await dbContext.CogitaItemDependencies
                .Where(x => x.LibraryId == libraryId &&
                            ((x.ParentItemType == "collection" && x.ParentItemId == collectionId) ||
                             (x.ChildItemType == "collection" && x.ChildItemId == collectionId)))
                .ToListAsync(ct);
            if (itemDependencies.Count > 0)
            {
                dbContext.CogitaItemDependencies.RemoveRange(itemDependencies);
            }

            var reviewOutcomes = await dbContext.CogitaReviewOutcomes
                .Where(x => x.LibraryId == libraryId && x.ItemType == "collection" && x.ItemId == collectionId)
                .ToListAsync(ct);
            if (reviewOutcomes.Count > 0)
            {
                dbContext.CogitaReviewOutcomes.RemoveRange(reviewOutcomes);
            }
            var reviewEvents = await dbContext.CogitaReviewEvents
                .Where(x => x.LibraryId == libraryId && x.ItemType == "collection" && x.ItemId == collectionId)
                .ToListAsync(ct);
            if (reviewEvents.Count > 0)
            {
                dbContext.CogitaReviewEvents.RemoveRange(reviewEvents);
            }
            var statisticEvents = await dbContext.CogitaStatisticEvents
                .Where(x => x.LibraryId == libraryId && x.ItemType == "collection" && x.ItemId == collectionId)
                .ToListAsync(ct);
            if (statisticEvents.Count > 0)
            {
                dbContext.CogitaStatisticEvents.RemoveRange(statisticEvents);
            }

            if (!RemoveInfoPayload("collection", collectionId, dbContext))
            {
                return Results.NotFound();
            }

            dbContext.CogitaInfos.Remove(info);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { deleted = true });
        });

        group.MapGet("/libraries/{libraryId:guid}/revisions", async (
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

            var revisions = await dbContext.CogitaRevisions.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .OrderBy(x => x.Name)
                .ThenBy(x => x.CreatedUtc)
                .ToListAsync(ct);

            var response = new List<CogitaRevisionResponse>(revisions.Count);
            foreach (var revision in revisions)
            {
                JsonElement? settings = null;
                if (!string.IsNullOrWhiteSpace(revision.RevisionSettingsJson))
                {
                    using var doc = JsonDocument.Parse(revision.RevisionSettingsJson);
                    settings = doc.RootElement.Clone();
                }
                response.Add(new CogitaRevisionResponse(
                    revision.Id,
                    revision.CollectionId,
                    revision.Name,
                    revision.RevisionType,
                    settings,
                    revision.Mode,
                    revision.CheckMode,
                    revision.CardLimit,
                    revision.CreatedUtc,
                    revision.UpdatedUtc
                ));
            }

            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/revisions", async (
            Guid libraryId,
            CogitaRevisionCreateRequest request,
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

            var library = await dbContext.CogitaLibraries
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var targetCollectionId = request.CollectionId;
            if (!targetCollectionId.HasValue)
            {
                return Results.BadRequest(new { error = "Collection is required." });
            }

            var collectionExists = await dbContext.CogitaInfos.AsNoTracking()
                .AnyAsync(x => x.Id == targetCollectionId.Value && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (!collectionExists)
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

            var name = request.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Revision name is required." });
            }

            var mode = string.IsNullOrWhiteSpace(request.Mode) ? "random" : request.Mode.Trim().ToLowerInvariant();
            var check = string.IsNullOrWhiteSpace(request.Check) ? "exact" : request.Check.Trim().ToLowerInvariant();
            var limit = Math.Clamp(request.Limit, 1, 500);
            var revisionType = string.IsNullOrWhiteSpace(request.RevisionType)
                ? mode
                : request.RevisionType.Trim().ToLowerInvariant();
            var revisionSettingsJson = request.RevisionSettings.HasValue ? request.RevisionSettings.Value.GetRawText() : null;

            var now = DateTimeOffset.UtcNow;
            var entity = new CogitaRevision
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                CollectionId = targetCollectionId.Value,
                Name = name,
                RevisionType = revisionType,
                RevisionSettingsJson = revisionSettingsJson,
                Mode = mode,
                CheckMode = check,
                CardLimit = limit,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.CogitaRevisions.Add(entity);
            await dbContext.SaveChangesAsync(ct);

            JsonElement? settings = null;
            if (!string.IsNullOrWhiteSpace(revisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(revisionSettingsJson);
                settings = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaRevisionResponse(
                entity.Id,
                entity.CollectionId,
                entity.Name,
                entity.RevisionType,
                settings,
                entity.Mode,
                entity.CheckMode,
                entity.CardLimit,
                entity.CreatedUtc,
                entity.UpdatedUtc
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/revisions/{revisionId:guid}", async (
            Guid libraryId,
            Guid revisionId,
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

            var revision = await dbContext.CogitaRevisions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }

            JsonElement? settings = null;
            if (!string.IsNullOrWhiteSpace(revision.RevisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(revision.RevisionSettingsJson);
                settings = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaRevisionResponse(
                revision.Id,
                revision.CollectionId,
                revision.Name,
                revision.RevisionType,
                settings,
                revision.Mode,
                revision.CheckMode,
                revision.CardLimit,
                revision.CreatedUtc,
                revision.UpdatedUtc
            ));
        });

        group.MapPost("/libraries/{libraryId:guid}/revisions/{revisionId:guid}", async (
            Guid libraryId,
            Guid revisionId,
            CogitaRevisionUpdateRequest request,
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

            var library = await dbContext.CogitaLibraries
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var entity = await dbContext.CogitaRevisions
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId, ct);
            if (entity is null)
            {
                return Results.NotFound();
            }

            var targetCollectionId = request.CollectionId ?? entity.CollectionId;
            if (targetCollectionId != entity.CollectionId)
            {
                var targetCollectionExists = await dbContext.CogitaInfos.AsNoTracking()
                    .AnyAsync(x => x.Id == targetCollectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
                if (!targetCollectionExists)
                {
                    return Results.BadRequest(new { error = "Target collection was not found in this library." });
                }
            }

            var name = request.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Revision name is required." });
            }

            entity.Name = name;
            entity.Mode = string.IsNullOrWhiteSpace(request.Mode) ? "random" : request.Mode.Trim().ToLowerInvariant();
            entity.CheckMode = string.IsNullOrWhiteSpace(request.Check) ? "exact" : request.Check.Trim().ToLowerInvariant();
            entity.CardLimit = Math.Clamp(request.Limit, 1, 500);
            entity.RevisionType = string.IsNullOrWhiteSpace(request.RevisionType)
                ? entity.Mode
                : request.RevisionType.Trim().ToLowerInvariant();
            entity.RevisionSettingsJson = request.RevisionSettings.HasValue ? request.RevisionSettings.Value.GetRawText() : null;
            entity.CollectionId = targetCollectionId;
            entity.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);

            JsonElement? settings = null;
            if (!string.IsNullOrWhiteSpace(entity.RevisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(entity.RevisionSettingsJson);
                settings = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaRevisionResponse(
                entity.Id,
                entity.CollectionId,
                entity.Name,
                entity.RevisionType,
                settings,
                entity.Mode,
                entity.CheckMode,
                entity.CardLimit,
                entity.CreatedUtc,
                entity.UpdatedUtc
            ));
        });

        group.MapDelete("/libraries/{libraryId:guid}/revisions/{revisionId:guid}", async (
            Guid libraryId,
            Guid revisionId,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var revision = await dbContext.CogitaRevisions
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }

            var blockers = new List<string>();
            var hasLiveSessions = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .AnyAsync(x => x.LibraryId == libraryId && x.RevisionId == revisionId, ct);
            if (hasLiveSessions)
            {
                blockers.Add("live-sessions");
            }
            var hasShares = await dbContext.CogitaRevisionShares.AsNoTracking()
                .AnyAsync(x => x.LibraryId == libraryId && x.RevisionId == revisionId, ct);
            if (hasShares)
            {
                blockers.Add("revision-shares");
            }

            if (blockers.Count > 0)
            {
                return Results.Conflict(new
                {
                    error = $"Cannot delete revision. Remove references first ({string.Join(", ", blockers)})."
                });
            }

            dbContext.CogitaRevisions.Remove(revision);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        group.MapGet("/libraries/{libraryId:guid}/collections/{collectionId:guid}/revisions", async (
            Guid libraryId,
            Guid collectionId,
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

            var collectionExists = await dbContext.CogitaInfos.AsNoTracking()
                .AnyAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (!collectionExists)
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

            var revisions = await dbContext.CogitaRevisions.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.CollectionId == collectionId)
                .OrderBy(x => x.Name)
                .ThenByDescending(x => x.CreatedUtc)
                .Select(x => new
                {
                    x.Id,
                    x.CollectionId,
                    x.Name,
                    x.RevisionType,
                    x.RevisionSettingsJson,
                    x.Mode,
                    x.CheckMode,
                    x.CardLimit,
                    x.CreatedUtc,
                    x.UpdatedUtc
                })
                .ToListAsync(ct);

            var response = new List<CogitaRevisionResponse>(revisions.Count);
            foreach (var revision in revisions)
            {
                JsonElement? settings = null;
                if (!string.IsNullOrWhiteSpace(revision.RevisionSettingsJson))
                {
                    using var doc = JsonDocument.Parse(revision.RevisionSettingsJson);
                    settings = doc.RootElement.Clone();
                }

                response.Add(new CogitaRevisionResponse(
                    revision.Id,
                    revision.CollectionId,
                    revision.Name,
                    revision.RevisionType,
                    settings,
                    revision.Mode,
                    revision.CheckMode,
                    revision.CardLimit,
                    revision.CreatedUtc,
                    revision.UpdatedUtc
                ));
            }

            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/collections/{collectionId:guid}/revisions", async (
            Guid libraryId,
            Guid collectionId,
            CogitaRevisionCreateRequest request,
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

            var library = await dbContext.CogitaLibraries
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var collectionExists = await dbContext.CogitaInfos.AsNoTracking()
                .AnyAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (!collectionExists)
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

            var name = request.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Revision name is required." });
            }

            var mode = string.IsNullOrWhiteSpace(request.Mode) ? "random" : request.Mode.Trim().ToLowerInvariant();
            var check = string.IsNullOrWhiteSpace(request.Check) ? "exact" : request.Check.Trim().ToLowerInvariant();
            var limit = Math.Clamp(request.Limit, 1, 500);
            var revisionType = string.IsNullOrWhiteSpace(request.RevisionType)
                ? mode
                : request.RevisionType.Trim().ToLowerInvariant();
            var revisionSettingsJson = request.RevisionSettings.HasValue ? request.RevisionSettings.Value.GetRawText() : null;

            var now = DateTimeOffset.UtcNow;
            var entity = new CogitaRevision
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                CollectionId = collectionId,
                Name = name,
                RevisionType = revisionType,
                RevisionSettingsJson = revisionSettingsJson,
                Mode = mode,
                CheckMode = check,
                CardLimit = limit,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.CogitaRevisions.Add(entity);
            await dbContext.SaveChangesAsync(ct);

            JsonElement? settings = null;
            if (!string.IsNullOrWhiteSpace(revisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(revisionSettingsJson);
                settings = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaRevisionResponse(
                entity.Id,
                entity.CollectionId,
                entity.Name,
                entity.RevisionType,
                settings,
                entity.Mode,
                entity.CheckMode,
                entity.CardLimit,
                entity.CreatedUtc,
                entity.UpdatedUtc
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/collections/{collectionId:guid}/revisions/{revisionId:guid}", async (
            Guid libraryId,
            Guid collectionId,
            Guid revisionId,
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

            var revision = await dbContext.CogitaRevisions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId && x.CollectionId == collectionId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }

            JsonElement? settings = null;
            if (!string.IsNullOrWhiteSpace(revision.RevisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(revision.RevisionSettingsJson);
                settings = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaRevisionResponse(
                revision.Id,
                revision.CollectionId,
                revision.Name,
                revision.RevisionType,
                settings,
                revision.Mode,
                revision.CheckMode,
                revision.CardLimit,
                revision.CreatedUtc,
                revision.UpdatedUtc
            ));
        });

        group.MapPost("/libraries/{libraryId:guid}/collections/{collectionId:guid}/revisions/{revisionId:guid}", async (
            Guid libraryId,
            Guid collectionId,
            Guid revisionId,
            CogitaRevisionUpdateRequest request,
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

            var library = await dbContext.CogitaLibraries
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var entity = await dbContext.CogitaRevisions
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId && x.CollectionId == collectionId, ct);
            if (entity is null)
            {
                return Results.NotFound();
            }

            var targetCollectionId = request.CollectionId ?? entity.CollectionId;
            if (targetCollectionId != entity.CollectionId)
            {
                var targetCollectionExists = await dbContext.CogitaInfos.AsNoTracking()
                    .AnyAsync(x => x.Id == targetCollectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
                if (!targetCollectionExists)
                {
                    return Results.BadRequest(new { error = "Target collection was not found in this library." });
                }
            }

            var name = request.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Revision name is required." });
            }

            entity.Name = name;
            entity.Mode = string.IsNullOrWhiteSpace(request.Mode) ? "random" : request.Mode.Trim().ToLowerInvariant();
            entity.CheckMode = string.IsNullOrWhiteSpace(request.Check) ? "exact" : request.Check.Trim().ToLowerInvariant();
            entity.CardLimit = Math.Clamp(request.Limit, 1, 500);
            entity.RevisionType = string.IsNullOrWhiteSpace(request.RevisionType)
                ? entity.Mode
                : request.RevisionType.Trim().ToLowerInvariant();
            entity.RevisionSettingsJson = request.RevisionSettings.HasValue ? request.RevisionSettings.Value.GetRawText() : null;
            entity.CollectionId = targetCollectionId;
            entity.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);

            JsonElement? settings = null;
            if (!string.IsNullOrWhiteSpace(entity.RevisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(entity.RevisionSettingsJson);
                settings = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaRevisionResponse(
                entity.Id,
                entity.CollectionId,
                entity.Name,
                entity.RevisionType,
                settings,
                entity.Mode,
                entity.CheckMode,
                entity.CardLimit,
                entity.CreatedUtc,
                entity.UpdatedUtc
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
            dbContext.CogitaItemDependencies.Add(new CogitaItemDependency
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                ParentItemType = "collection",
                ParentItemId = request.ParentCollectionId,
                ParentCheckType = null,
                ParentDirection = null,
                ChildItemType = "collection",
                ChildItemId = request.ChildCollectionId,
                ChildCheckType = null,
                ChildDirection = null,
                LinkHash = BuildDependencyLinkHash(
                    libraryId,
                    "collection",
                    request.ParentCollectionId,
                    null,
                    null,
                    "collection",
                    request.ChildCollectionId,
                    null,
                    null),
                CreatedUtc = DateTimeOffset.UtcNow
            });
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaCollectionDependencyResponse(request.ParentCollectionId, request.ChildCollectionId));
        });

        group.MapDelete("/libraries/{libraryId:guid}/collections/{collectionId:guid}/dependencies/{parentCollectionId:guid}/{childCollectionId:guid}", async (
            Guid libraryId,
            Guid collectionId,
            Guid parentCollectionId,
            Guid childCollectionId,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            if (collectionId != parentCollectionId && collectionId != childCollectionId)
            {
                return Results.BadRequest(new { error = "CollectionId must match parent or child." });
            }

            var collectionIds = new[] { parentCollectionId, childCollectionId };
            var collectionsInLibrary = await dbContext.CogitaInfos.AsNoTracking()
                .CountAsync(x => x.LibraryId == libraryId && x.InfoType == "collection" && collectionIds.Contains(x.Id), ct);
            if (collectionsInLibrary != 2)
            {
                return Results.NotFound();
            }

            var relation = await dbContext.CogitaCollectionDependencies
                .FirstOrDefaultAsync(x => x.ParentCollectionInfoId == parentCollectionId && x.ChildCollectionInfoId == childCollectionId, ct);
            if (relation is null)
            {
                return Results.NotFound();
            }

            dbContext.CogitaCollectionDependencies.Remove(relation);

            var dependencyRows = await dbContext.CogitaItemDependencies
                .Where(x => x.LibraryId == libraryId &&
                            x.GraphId == null &&
                            x.ParentItemType == "collection" &&
                            x.ParentItemId == parentCollectionId &&
                            x.ChildItemType == "collection" &&
                            x.ChildItemId == childCollectionId)
                .ToListAsync(ct);
            if (dependencyRows.Count > 0)
            {
                dbContext.CogitaItemDependencies.RemoveRange(dependencyRows);
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        group.MapGet("/libraries/{libraryId:guid}/dependencies/items", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out _) ||
                !EndpointHelpers.TryGetSessionId(context, out _))
            {
                return Results.Unauthorized();
            }

            var exists = await dbContext.CogitaLibraries.AsNoTracking()
                .AnyAsync(x => x.Id == libraryId, ct);
            if (!exists)
            {
                return Results.NotFound();
            }

            var activeGraphId = await ResolveActiveDependencyGraphIdAsync(libraryId, dbContext, ct);
            var deps = await dbContext.CogitaItemDependencies.AsNoTracking()
                .Where(x => x.LibraryId == libraryId &&
                            (x.GraphId == null || (activeGraphId.HasValue && x.GraphId == activeGraphId.Value)))
                .ToListAsync(ct);
            var response = deps
                .Select(x => new CogitaItemDependencyResponse(
                    x.ParentItemType,
                    x.ParentItemId,
                    x.ParentCheckType,
                    x.ParentDirection,
                    x.ChildItemType,
                    x.ChildItemId,
                    x.ChildCheckType,
                    x.ChildDirection))
                .ToList();

            return Results.Ok(new CogitaItemDependencyBundleResponse(response));
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
                    string? roleKind = lookup.ValuesByRole.TryGetValue(roleId, out var valuesByRole) &&
                                       valuesByRole.TryGetValue(RoleFieldTypes.RoleKind, out var kind)
                        ? kind
                        : null;
                    var label = lookup.ValuesByRole.TryGetValue(roleId, out var values) &&
                                values.TryGetValue(RoleFieldTypes.Nick, out var nick)
                        ? nick
                        : $"Role {roleId:N}";
                    return new CogitaReviewerResponse(roleId, label, roleKind);
                })
                .Where(x => string.Equals(x.RoleKind?.Trim(), "person", StringComparison.OrdinalIgnoreCase))
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
            if (!keyRing.ReadKeys.ContainsKey(reviewerRoleId))
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
            var temporalEntries = outcomes
                .Select(x => new TemporalKnownessEntry(x.Correct ? 1d : 0d, x.CreatedUtc))
                .ToList();
            var knownessSummary = ComputeKnownessSummary(temporalEntries, DateTimeOffset.UtcNow);
            var score = knownessSummary.Score;
            var lastReviewed = knownessSummary.LastReviewedUtc;

            return Results.Ok(new CogitaReviewSummaryResponse(
                normalizedType,
                itemId,
                total,
                correct,
                lastReviewed,
                score
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/statistics", async (
            Guid libraryId,
            string? scopeType,
            Guid? scopeId,
            Guid? personRoleId,
            Guid? participantId,
            bool? persistentOnly,
            int? limit,
            DateTimeOffset? fromUtc,
            DateTimeOffset? toUtc,
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

            if (!keyRing.TryGetReadKey(library.RoleId, out var libraryReadKey))
            {
                return Results.Forbid();
            }

            var normalizedScopeType = string.IsNullOrWhiteSpace(scopeType)
                ? "library"
                : scopeType.Trim().ToLowerInvariant();
            if (normalizedScopeType is not ("library" or "info" or "connection" or "collection" or "revision" or "live-session"))
            {
                return Results.BadRequest(new { error = "Invalid scopeType." });
            }
            if (normalizedScopeType != "library" && scopeId is null)
            {
                return Results.BadRequest(new { error = "scopeId is required for this scopeType." });
            }

            var maxLimit = Math.Clamp(limit ?? 1200, 50, 5000);
            var readableRoleIds = keyRing.ReadKeys.Keys.ToHashSet();
            if (personRoleId.HasValue &&
                personRoleId.Value != Guid.Empty &&
                !readableRoleIds.Contains(personRoleId.Value))
            {
                return Results.Forbid();
            }

            var query = dbContext.CogitaStatisticEvents.AsNoTracking()
                .Where(x => x.LibraryId == libraryId);
            query = query.Where(x => !x.PersonRoleId.HasValue || readableRoleIds.Contains(x.PersonRoleId.Value));

            if (normalizedScopeType != "live-session")
            {
                query = query.Where(x => x.IsPersistent);
            }
            if (persistentOnly == true)
            {
                query = query.Where(x => x.IsPersistent);
            }
            if (personRoleId.HasValue && personRoleId.Value != Guid.Empty)
            {
                query = query.Where(x => x.PersonRoleId == personRoleId.Value);
            }
            if (participantId.HasValue && participantId.Value != Guid.Empty)
            {
                query = query.Where(x => x.ParticipantId == participantId.Value);
            }
            if (fromUtc.HasValue)
            {
                query = query.Where(x => x.CreatedUtc >= fromUtc.Value);
            }
            if (toUtc.HasValue)
            {
                query = query.Where(x => x.CreatedUtc <= toUtc.Value);
            }

            if (normalizedScopeType == "info" || normalizedScopeType == "connection")
            {
                var targetId = scopeId!.Value;
                var exists = normalizedScopeType == "info"
                    ? await dbContext.CogitaInfos.AsNoTracking().AnyAsync(x => x.LibraryId == libraryId && x.Id == targetId, ct)
                    : await dbContext.CogitaConnections.AsNoTracking().AnyAsync(x => x.LibraryId == libraryId && x.Id == targetId, ct);
                if (!exists)
                {
                    return Results.NotFound();
                }
                query = query.Where(x => x.ItemType == normalizedScopeType && x.ItemId == targetId);
            }
            else if (normalizedScopeType == "live-session")
            {
                var targetSessionId = scopeId!.Value;
                var sessionExists = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                    .AnyAsync(x => x.Id == targetSessionId && x.LibraryId == libraryId, ct);
                if (!sessionExists)
                {
                    return Results.NotFound();
                }
                var canManageSession = keyRing.WriteKeys.ContainsKey(library.RoleId);
                var isSessionParticipant = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                    .AnyAsync(x => x.SessionId == targetSessionId && x.UserId == userId, ct);
                if (!canManageSession && !isSessionParticipant)
                {
                    return Results.Forbid();
                }
                query = query.Where(x => x.SessionId == targetSessionId);
            }
            else if (normalizedScopeType == "collection")
            {
                var collectionId = scopeId!.Value;
                var collectionExists = await dbContext.CogitaInfos.AsNoTracking()
                    .AnyAsync(x => x.Id == collectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
                if (!collectionExists)
                {
                    return Results.NotFound();
                }

                var items = await dbContext.CogitaCollectionItems.AsNoTracking()
                    .Where(x => x.CollectionInfoId == collectionId)
                    .Select(x => new { x.ItemType, x.ItemId })
                    .ToListAsync(ct);
                var collectionInfoIds = items.Where(x => x.ItemType == "info").Select(x => x.ItemId).Distinct().ToList();
                var collectionConnectionIds = items.Where(x => x.ItemType == "connection").Select(x => x.ItemId).Distinct().ToList();
                var collectionSessionIds = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.CollectionId == collectionId)
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                query = query.Where(x =>
                    (x.ItemType == "info" && x.ItemId.HasValue && collectionInfoIds.Contains(x.ItemId.Value)) ||
                    (x.ItemType == "connection" && x.ItemId.HasValue && collectionConnectionIds.Contains(x.ItemId.Value)) ||
                    (x.SessionId.HasValue && collectionSessionIds.Contains(x.SessionId.Value)));
            }
            else if (normalizedScopeType == "revision")
            {
                var revisionId = scopeId!.Value;
                var revision = await dbContext.CogitaRevisions.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId, ct);
                if (revision is null)
                {
                    return Results.NotFound();
                }

                var items = await dbContext.CogitaCollectionItems.AsNoTracking()
                    .Where(x => x.CollectionInfoId == revision.CollectionId)
                    .Select(x => new { x.ItemType, x.ItemId })
                    .ToListAsync(ct);
                var revisionInfoIds = items.Where(x => x.ItemType == "info").Select(x => x.ItemId).Distinct().ToList();
                var revisionConnectionIds = items.Where(x => x.ItemType == "connection").Select(x => x.ItemId).Distinct().ToList();
                var revisionSessionIds = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.RevisionId == revisionId)
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                query = query.Where(x =>
                    (x.ItemType == "info" && x.ItemId.HasValue && revisionInfoIds.Contains(x.ItemId.Value)) ||
                    (x.ItemType == "connection" && x.ItemId.HasValue && revisionConnectionIds.Contains(x.ItemId.Value)) ||
                    (x.SessionId.HasValue && revisionSessionIds.Contains(x.SessionId.Value)));
            }

            var events = await query
                .OrderByDescending(x => x.CreatedUtc)
                .Take(maxLimit)
                .ToListAsync(ct);
            events = events
                .OrderBy(x => x.CreatedUtc)
                .ThenBy(x => x.Id)
                .ToList();

            LiveComputedScoreState? liveComputedScores = null;
            if (string.Equals(normalizedScopeType, "live-session", StringComparison.OrdinalIgnoreCase) && scopeId.HasValue)
            {
                liveComputedScores = await ComputeLiveSessionScoresOnTheFlyAsync(scopeId.Value, dbContext, ct);
            }

            if (events.Count == 0)
            {
                return Results.Ok(new CogitaStatisticsResponse(
                    normalizedScopeType,
                    scopeId,
                    0,
                    0,
                    0,
                    0d,
                    0,
                    new List<CogitaStatisticsParticipantSummaryResponse>(),
                    new List<CogitaStatisticsTimelinePointResponse>(),
                    new List<CogitaStatisticsKnownessItemResponse>(),
                    new List<CogitaStatisticsKnownessItemResponse>()));
            }

            static bool IsAnswerEvent(CogitaStatisticEvent statisticEvent)
            {
                return statisticEvent.Correctness.HasValue || statisticEvent.IsCorrect.HasValue;
            }

            var effectiveDurationMsByEventId = new Dictionary<Guid, int?>(events.Count);
            var answerEventsByParticipant = events
                .Where(IsAnswerEvent)
                .GroupBy(ResolveStatisticsParticipantRef, x => x, (participant, participantEvents) => new
                {
                    ParticipantKey = participant.Key,
                    Events = participantEvents
                        .OrderBy(x => x.CreatedUtc)
                        .ThenBy(x => x.Id)
                        .ToList()
                })
                .ToList();
            foreach (var participantBucket in answerEventsByParticipant)
            {
                for (var i = 0; i < participantBucket.Events.Count; i += 1)
                {
                    var currentEvent = participantBucket.Events[i];
                    int? effectiveDurationMs = null;
                    if (currentEvent.DurationMs.HasValue && currentEvent.DurationMs.Value >= 0)
                    {
                        effectiveDurationMs = currentEvent.DurationMs.Value;
                    }
                    else if (i + 1 < participantBucket.Events.Count)
                    {
                        var nextEvent = participantBucket.Events[i + 1];
                        var deltaMs = (int)Math.Round((nextEvent.CreatedUtc - currentEvent.CreatedUtc).TotalMilliseconds);
                        if (deltaMs >= 0)
                        {
                            effectiveDurationMs = deltaMs;
                        }
                    }

                    effectiveDurationMsByEventId[currentEvent.Id] = effectiveDurationMs;
                }
            }

            var participantStates = new Dictionary<string, StatisticsParticipantState>(StringComparer.Ordinal);
            var timeline = new List<CogitaStatisticsTimelinePointResponse>(events.Count);
            var liveRunningPointsByParticipant = new Dictionary<Guid, int>();
            var liveCountedRounds = new HashSet<(Guid ParticipantId, int RoundIndex)>();
            var nowUtc = DateTimeOffset.UtcNow;
            var index = 0;
            foreach (var statisticEvent in events)
            {
                index += 1;
                var participantRef = ResolveStatisticsParticipantRef(statisticEvent);
                if (!participantStates.TryGetValue(participantRef.Key, out var state))
                {
                    state = new StatisticsParticipantState(participantRef);
                    participantStates[participantRef.Key] = state;
                }

                state.EventCount += 1;
                state.LastActivityUtc = statisticEvent.CreatedUtc;

                double? eventCorrectness = null;
                if (statisticEvent.Correctness.HasValue)
                {
                    eventCorrectness = Math.Clamp(statisticEvent.Correctness.Value, 0d, 1d);
                }
                else if (statisticEvent.IsCorrect.HasValue)
                {
                    eventCorrectness = statisticEvent.IsCorrect.Value ? 1d : 0d;
                }

                var parsedScorePayload = ParseStatisticScorePayload(
                    statisticEvent.PayloadJson,
                    eventCorrectness.HasValue && eventCorrectness.Value >= 0.5d);
                var payloadPointsAwarded = parsedScorePayload?.TotalPoints;
                var isLiveSource = statisticEvent.SourceType.StartsWith("live-session", StringComparison.OrdinalIgnoreCase);

                if (liveComputedScores is null)
                {
                    if (payloadPointsAwarded.HasValue)
                    {
                        state.TotalPoints += payloadPointsAwarded.Value;
                    }
                    else if (!isLiveSource && statisticEvent.PointsAwarded.HasValue)
                    {
                        state.TotalPoints += statisticEvent.PointsAwarded.Value;
                    }
                }

                if (eventCorrectness.HasValue)
                {
                    var effectiveDurationMs = effectiveDurationMsByEventId.TryGetValue(statisticEvent.Id, out var derivedDurationMs)
                        ? derivedDurationMs
                        : (statisticEvent.DurationMs.HasValue && statisticEvent.DurationMs.Value >= 0 ? statisticEvent.DurationMs : null);
                    state.AnswerCount += 1;
                    state.CorrectnessSum += eventCorrectness.Value;
                    if (eventCorrectness.Value >= 0.5d)
                    {
                        state.CorrectCount += 1;
                        if (liveComputedScores is not null &&
                            participantRef.ParticipantId.HasValue &&
                            statisticEvent.RoundIndex.HasValue &&
                            liveComputedScores.DetailByRoundParticipant.TryGetValue(
                                (statisticEvent.RoundIndex.Value, participantRef.ParticipantId.Value),
                                out var computedDetail))
                        {
                            state.CorrectAnswerPointsSum += computedDetail.Points;
                            state.BasePointsSum += computedDetail.BasePoints;
                            state.FirstBonusPointsSum += computedDetail.FirstBonusPoints;
                            state.SpeedBonusPointsSum += computedDetail.SpeedBonusPoints;
                            state.StreakBonusPointsSum += computedDetail.StreakBonusPoints;
                        }
                        else if (parsedScorePayload.HasValue)
                        {
                            var scoreBreakdown = parsedScorePayload.Value;
                            state.CorrectAnswerPointsSum += scoreBreakdown.TotalPoints;
                            state.BasePointsSum += scoreBreakdown.BasePoints;
                            state.FirstBonusPointsSum += scoreBreakdown.FirstBonusPoints;
                            state.SpeedBonusPointsSum += scoreBreakdown.SpeedBonusPoints;
                            state.StreakBonusPointsSum += scoreBreakdown.StreakBonusPoints;
                        }
                        else if (!isLiveSource && statisticEvent.PointsAwarded.HasValue)
                        {
                            state.CorrectAnswerPointsSum += statisticEvent.PointsAwarded.Value;
                        }
                    }
                    state.KnownessEntries.Add(new TemporalKnownessEntry(eventCorrectness.Value, statisticEvent.CreatedUtc));
                    if (effectiveDurationMs.HasValue && effectiveDurationMs.Value >= 0)
                    {
                        state.DurationSumMs += effectiveDurationMs.Value;
                        state.DurationCount += 1;
                    }
                }

                var knowness = state.KnownessEntries.Count == 0
                    ? 0d
                    : ComputeKnownessSummary(state.KnownessEntries, statisticEvent.CreatedUtc).Score;
                var timelinePointsAwarded = payloadPointsAwarded ?? (isLiveSource ? null : statisticEvent.PointsAwarded);
                var timelineRunningPoints = state.TotalPoints;
                if (liveComputedScores is not null &&
                    participantRef.ParticipantId.HasValue &&
                    statisticEvent.RoundIndex.HasValue &&
                    liveComputedScores.DetailByRoundParticipant.TryGetValue(
                        (statisticEvent.RoundIndex.Value, participantRef.ParticipantId.Value),
                        out var timelineDetail))
                {
                    timelinePointsAwarded = timelineDetail.Points;
                    var timelineParticipantId = participantRef.ParticipantId.Value;
                    if (!liveRunningPointsByParticipant.ContainsKey(timelineParticipantId))
                    {
                        liveRunningPointsByParticipant[timelineParticipantId] = 0;
                    }
                    if (eventCorrectness.HasValue && liveCountedRounds.Add((timelineParticipantId, statisticEvent.RoundIndex.Value)))
                    {
                        liveRunningPointsByParticipant[timelineParticipantId] += timelineDetail.Points;
                    }
                    timelineRunningPoints = liveRunningPointsByParticipant[timelineParticipantId];
                }

                timeline.Add(new CogitaStatisticsTimelinePointResponse(
                    index,
                    statisticEvent.CreatedUtc,
                    participantRef.Key,
                    participantRef.Kind,
                    participantRef.PersonRoleId,
                    participantRef.ParticipantId,
                    participantRef.Label,
                    statisticEvent.EventType,
                    statisticEvent.RoundIndex,
                    statisticEvent.IsCorrect,
                    eventCorrectness,
                    timelinePointsAwarded,
                    effectiveDurationMsByEventId.TryGetValue(statisticEvent.Id, out var timelineDurationMs)
                        ? timelineDurationMs
                        : (statisticEvent.DurationMs.HasValue && statisticEvent.DurationMs.Value >= 0 ? statisticEvent.DurationMs : null),
                    timelineRunningPoints,
                    knowness
                ));
            }

            var participants = participantStates.Values
                .Where(x => x.Participant.Kind != "system")
                .Select(x =>
                {
                    var knowness = x.KnownessEntries.Count == 0
                        ? 0d
                        : ComputeKnownessSummary(x.KnownessEntries, nowUtc).Score;
                    var avgCorrectness = x.AnswerCount == 0 ? 0d : Math.Round(x.CorrectnessSum / x.AnswerCount * 100d, 2);
                    var avgDurationMs = x.DurationCount == 0 ? (double?)null : Math.Round(x.DurationSumMs / x.DurationCount, 2);
                    if (liveComputedScores is not null && x.Participant.ParticipantId.HasValue)
                    {
                        x.TotalPoints = liveComputedScores.TotalsByParticipant.TryGetValue(x.Participant.ParticipantId.Value, out var computedTotal)
                            ? computedTotal
                            : x.TotalPoints;
                    }
                    var avgPointsPerCorrectAnswer = x.CorrectCount == 0 ? 0d : Math.Round(x.CorrectAnswerPointsSum / x.CorrectCount, 2);
                    var avgBasePointsPerCorrectAnswer = x.CorrectCount == 0 ? 0d : Math.Round(x.BasePointsSum / x.CorrectCount, 2);
                    var avgFirstBonusPointsPerCorrectAnswer = x.CorrectCount == 0 ? 0d : Math.Round(x.FirstBonusPointsSum / x.CorrectCount, 2);
                    var avgSpeedBonusPointsPerCorrectAnswer = x.CorrectCount == 0 ? 0d : Math.Round(x.SpeedBonusPointsSum / x.CorrectCount, 2);
                    var avgStreakBonusPointsPerCorrectAnswer = x.CorrectCount == 0 ? 0d : Math.Round(x.StreakBonusPointsSum / x.CorrectCount, 2);
                    return new CogitaStatisticsParticipantSummaryResponse(
                        x.Participant.Key,
                        x.Participant.Kind,
                        x.Participant.PersonRoleId,
                        x.Participant.ParticipantId,
                        x.Participant.Label,
                        x.EventCount,
                        x.AnswerCount,
                        x.CorrectCount,
                        avgCorrectness,
                        x.TotalPoints,
                        x.LastActivityUtc,
                        knowness,
                        avgDurationMs,
                        avgPointsPerCorrectAnswer,
                        avgBasePointsPerCorrectAnswer,
                        avgFirstBonusPointsPerCorrectAnswer,
                        avgSpeedBonusPointsPerCorrectAnswer,
                        avgStreakBonusPointsPerCorrectAnswer
                    );
                })
                .OrderByDescending(x => x.KnownessScore)
                .ThenByDescending(x => x.TotalPoints)
                .ThenBy(x => x.Label, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var answerEvents = timeline.Where(x => x.Correctness.HasValue).ToList();
            var totalAnswers = answerEvents.Count;
            var totalCorrectAnswers = answerEvents.Count(x => (x.Correctness ?? 0d) >= 0.5d);
            var averageCorrectness = totalAnswers == 0
                ? 0d
                : Math.Round(answerEvents.Average(x => (x.Correctness ?? 0d) * 100d), 2);
            var totalPoints = participantStates.Values.Sum(x => x.TotalPoints);

            var scoredInfoGroups = events
                .Where(x => string.Equals(x.ItemType, "info", StringComparison.OrdinalIgnoreCase) &&
                            x.ItemId.HasValue &&
                            (x.Correctness.HasValue || x.IsCorrect.HasValue))
                .GroupBy(x => x.ItemId!.Value)
                .ToList();

            var infoIds = scoredInfoGroups.Select(x => x.Key).Distinct().ToList();
            var infoTypeById = infoIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && infoIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.InfoType })
                    .ToDictionaryAsync(x => x.Id, x => x.InfoType, ct);

            var wordInfoIds = infoTypeById
                .Where(x => x.Value is "word" or "translation")
                .Select(x => x.Key)
                .ToHashSet();
            var candidateInfoIds = wordInfoIds.Count > 0
                ? wordInfoIds
                : infoTypeById.Keys.ToHashSet();

            var labelsByInfoId = new Dictionary<Guid, string>();
            var groupedByInfoType = candidateInfoIds
                .Where(infoTypeById.ContainsKey)
                .GroupBy(id => infoTypeById[id], StringComparer.Ordinal)
                .ToList();
            foreach (var typeGroup in groupedByInfoType)
            {
                var labels = await ResolveInfoLabelsAsync(
                    libraryId,
                    typeGroup.Key,
                    typeGroup.ToList(),
                    libraryReadKey,
                    keyRingService,
                    encryptionService,
                    dbContext,
                    ct);
                foreach (var pair in labels)
                {
                    labelsByInfoId[pair.Key] = pair.Value;
                }
            }

            var knownessItems = scoredInfoGroups
                .Where(group => candidateInfoIds.Contains(group.Key) && infoTypeById.ContainsKey(group.Key))
                .Select(group =>
                {
                    var entries = group
                        .Select(statisticEvent =>
                        {
                            double? correctness = null;
                            if (statisticEvent.Correctness.HasValue)
                            {
                                correctness = Math.Clamp(statisticEvent.Correctness.Value, 0d, 1d);
                            }
                            else if (statisticEvent.IsCorrect.HasValue)
                            {
                                correctness = statisticEvent.IsCorrect.Value ? 1d : 0d;
                            }
                            return correctness.HasValue
                                ? new TemporalKnownessEntry(correctness.Value, statisticEvent.CreatedUtc)
                                : (TemporalKnownessEntry?)null;
                        })
                        .Where(x => x.HasValue)
                        .Select(x => x!.Value)
                        .OrderBy(x => x.CreatedUtc)
                        .ToList();
                    if (entries.Count == 0)
                    {
                        return null;
                    }

                    var infoId = group.Key;
                    var infoType = infoTypeById[infoId];
                    var knownessSummary = ComputeKnownessSummary(entries, nowUtc);
                    var answerCount = entries.Count;
                    var correctCount = entries.Count(x => x.Correctness >= 0.5d);
                    var averageCorrectness = answerCount == 0
                        ? 0d
                        : Math.Round(entries.Average(x => x.Correctness) * 100d, 2);
                    var resolvedLabel = labelsByInfoId.TryGetValue(infoId, out var label) && !string.IsNullOrWhiteSpace(label)
                        ? label
                        : infoType;

                    return new CogitaStatisticsKnownessItemResponse(
                        infoId,
                        infoType,
                        resolvedLabel,
                        answerCount,
                        correctCount,
                        averageCorrectness,
                        knownessSummary.Score
                    );
                })
                .Where(x => x is not null)
                .Select(x => x!)
                .ToList();

            var bestKnownWords = knownessItems
                .OrderByDescending(x => x.KnownessScore)
                .ThenByDescending(x => x.AverageCorrectness)
                .ThenByDescending(x => x.AnswerCount)
                .ThenBy(x => x.Label, StringComparer.OrdinalIgnoreCase)
                .Take(12)
                .ToList();
            var worstKnownWords = knownessItems
                .OrderBy(x => x.KnownessScore)
                .ThenBy(x => x.AverageCorrectness)
                .ThenByDescending(x => x.AnswerCount)
                .ThenBy(x => x.Label, StringComparer.OrdinalIgnoreCase)
                .Take(12)
                .ToList();

            return Results.Ok(new CogitaStatisticsResponse(
                normalizedScopeType,
                scopeId,
                events.Count,
                totalAnswers,
                totalCorrectAnswers,
                averageCorrectness,
                totalPoints,
                participants,
                timeline,
                bestKnownWords,
                worstKnownWords
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
                    request.DurationMs,
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
            var normalizedDurationMs = request.DurationMs.HasValue
                ? Math.Max(0, request.DurationMs.Value)
                : (int?)null;

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
                DurationMs = normalizedDurationMs,
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

            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                ScopeType = itemType,
                ScopeId = request.ItemId,
                SourceType = "review",
                SessionId = null,
                PersonRoleId = reviewerRoleId,
                ParticipantId = null,
                ParticipantLabel = null,
                ItemType = itemType,
                ItemId = request.ItemId,
                CheckType = request.CheckType?.Trim().ToLowerInvariant(),
                Direction = string.IsNullOrWhiteSpace(request.Direction) ? null : request.Direction.Trim().ToLowerInvariant(),
                EventType = "review_outcome_saved",
                RoundIndex = null,
                CardKey = null,
                IsCorrect = request.Correct,
                Correctness = ResolveCorrectnessValue(request.MaskBase64, request.Correct),
                PointsAwarded = null,
                DurationMs = normalizedDurationMs,
                IsPersistent = true,
                PayloadJson = null,
                CreatedUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(ct);

            try
            {
                var coreClientSequence = request.ClientSequence switch
                {
                    > int.MaxValue => int.MaxValue,
                    < int.MinValue => int.MinValue,
                    _ => (int)request.ClientSequence
                };
                _ = await CogitaCoreRuntimeEndpoints.SyncLegacyReviewOutcomesToCoreAsync(
                    dbContext,
                    libraryId,
                    library.RoleId,
                    reviewerRoleId,
                    new[] { reviewerRoleId },
                    new[]
                    {
                        new CogitaCoreRuntimeEndpoints.LegacyReviewOutcomeSyncItem(
                            itemType,
                            request.ItemId,
                            request.CheckType,
                            request.Direction,
                            request.RevisionType,
                            request.EvalType,
                            request.Correct,
                            request.ClientId,
                            coreClientSequence,
                            normalizedDurationMs,
                            reviewerRoleId)
                    },
                    ct);
            }
            catch
            {
                // Keep legacy endpoint behavior even if core mirror sync is temporarily unavailable.
            }

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

            foreach (var outcome in request.Outcomes.Where(x => x.ItemType.Trim().ToLowerInvariant() == "info"))
            {
                var validCheckcard = await IsValidEffectiveInfoCheckcardIdentityAsync(
                    libraryId,
                    outcome.ItemId,
                    outcome.CheckType,
                    outcome.Direction,
                    personReadKey,
                    keyRingService,
                    encryptionService,
                    dbContext,
                    ct);
                if (!validCheckcard)
                {
                    return Results.BadRequest(new { error = $"Invalid checkcard identity for info '{outcome.ItemId}'." });
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
            var coreSyncOutcomes = new List<CogitaCoreRuntimeEndpoints.LegacyReviewOutcomeSyncItem>();
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
                        outcome.DurationMs,
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
                var normalizedDurationMs = outcome.DurationMs.HasValue
                    ? Math.Max(0, outcome.DurationMs.Value)
                    : (int?)null;

                var createdUtc = DateTimeOffset.UtcNow;
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
                    DurationMs = normalizedDurationMs,
                    PayloadHash = payloadHash,
                    DataKeyId = dataKeyId,
                    EncryptedBlob = encrypted,
                    CreatedUtc = createdUtc
                });

                dbContext.KeyEntryBindings.Add(new KeyEntryBinding
                {
                    Id = Guid.NewGuid(),
                    KeyEntryId = dataKeyId,
                    EntryId = outcomeId,
                    EntryType = "cogita-review-outcome",
                    EntrySubtype = outcome.RevisionType ?? string.Empty,
                    CreatedUtc = createdUtc
                });

                dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    ScopeType = normalizedType,
                    ScopeId = outcome.ItemId,
                    SourceType = "review",
                    SessionId = null,
                    PersonRoleId = reviewerRoleId,
                    ParticipantId = null,
                    ParticipantLabel = null,
                    ItemType = normalizedType,
                    ItemId = outcome.ItemId,
                    CheckType = outcome.CheckType?.Trim().ToLowerInvariant(),
                    Direction = string.IsNullOrWhiteSpace(outcome.Direction) ? null : outcome.Direction.Trim().ToLowerInvariant(),
                    EventType = "review_outcome_saved",
                    RoundIndex = null,
                    CardKey = null,
                    IsCorrect = outcome.Correct,
                    Correctness = ResolveCorrectnessValue(outcome.MaskBase64, outcome.Correct),
                    PointsAwarded = null,
                    DurationMs = normalizedDurationMs,
                    IsPersistent = true,
                    PayloadJson = null,
                    CreatedUtc = createdUtc
                });

                coreSyncOutcomes.Add(new CogitaCoreRuntimeEndpoints.LegacyReviewOutcomeSyncItem(
                    normalizedType,
                    outcome.ItemId,
                    outcome.CheckType,
                    outcome.Direction,
                    outcome.RevisionType,
                    outcome.EvalType,
                    outcome.Correct,
                    outcome.ClientId,
                    outcome.ClientSequence switch
                    {
                        > int.MaxValue => int.MaxValue,
                        < int.MinValue => int.MinValue,
                        _ => (int)outcome.ClientSequence
                    },
                    normalizedDurationMs,
                    reviewerRoleId));

                stored += 1;
            }

            if (stored > 0)
            {
                await dbContext.SaveChangesAsync(ct);
                try
                {
                    _ = await CogitaCoreRuntimeEndpoints.SyncLegacyReviewOutcomesToCoreAsync(
                        dbContext,
                        libraryId,
                        library.RoleId,
                        reviewerRoleId,
                        new[] { reviewerRoleId },
                        coreSyncOutcomes,
                        ct);
                }
                catch
                {
                    // Keep legacy endpoint behavior even if core mirror sync is temporarily unavailable.
                }
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

            if (!await HasCogitaRevisionShareRuntimeSchemaAsync(dbContext, ct))
            {
                return Results.BadRequest(new { error = CogitaRevisionShareSchemaError });
            }

            var revisionId = request.RevisionId;
            if (revisionId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "RevisionId is invalid." });
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var revision = await dbContext.CogitaRevisions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }

            var collectionId = revision.CollectionId;
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

            var mode = string.IsNullOrWhiteSpace(revision.Mode) ? "random" : revision.Mode.Trim().ToLowerInvariant();
            var checkMode = string.IsNullOrWhiteSpace(revision.CheckMode) ? "exact" : revision.CheckMode.Trim().ToLowerInvariant();
            var limit = Math.Clamp(revision.CardLimit, 1, 200);
            var revisionType = string.IsNullOrWhiteSpace(revision.RevisionType)
                ? null
                : revision.RevisionType.Trim().ToLowerInvariant();
            var revisionSettingsJson = revision.RevisionSettingsJson;

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

            // Enforce one active shared link per revision.
            var previousActiveShare = await dbContext.CogitaRevisionShares
                .FirstOrDefaultAsync(x =>
                    x.LibraryId == libraryId &&
                    x.RevisionId == revision.Id &&
                    x.RevokedUtc == null, ct);
            if (previousActiveShare is not null)
            {
                previousActiveShare.RevokedUtc = now;
                var previousSharedView = await dbContext.SharedViews
                    .FirstOrDefaultAsync(x => x.Id == previousActiveShare.SharedViewId, ct);
                if (previousSharedView is not null)
                {
                    previousSharedView.RevokedUtc = now;
                }
                await dbContext.SaveChangesAsync(ct);
            }

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
                RevisionId = revision.Id,
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

            var collectionName = "Collection";
            var collectionPayload = await LoadInfoPayloadAsync(collectionInfo, dbContext, ct);
            if (collectionPayload is not null)
            {
                var keyEntry = await dbContext.Keys.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == collectionPayload.Value.DataKeyId, ct);
                if (keyEntry is not null)
                {
                    try
                    {
                        var dataKey = keyRingService.DecryptDataKey(keyEntry, libraryReadKey);
                        var plain = encryptionService.Decrypt(dataKey, collectionPayload.Value.EncryptedBlob, collectionInfo.Id.ToByteArray());
                        using var doc = JsonDocument.Parse(plain);
                        collectionName = ResolveLabel(doc.RootElement, collectionInfo.InfoType) ?? collectionName;
                    }
                    catch (CryptographicException)
                    {
                        // fallback label
                    }
                }
            }

            return Results.Ok(new CogitaRevisionShareCreateResponse(
                shareId,
                revision.Id,
                revision.Name,
                collectionId,
                collectionName,
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

            if (!await HasCogitaRevisionShareRuntimeSchemaAsync(dbContext, ct))
            {
                return Results.BadRequest(new { error = CogitaRevisionShareSchemaError });
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
            var revisionIds = shares.Select(x => x.RevisionId).Distinct().ToList();
            var revisions = await dbContext.CogitaRevisions.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && revisionIds.Contains(x.Id))
                .ToListAsync(ct);
            var revisionLookup = revisions.ToDictionary(x => x.Id, x => x);

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

                var revision = revisionLookup.TryGetValue(share.RevisionId, out var revisionItem) ? revisionItem : null;
                var revisionName = revision?.Name ?? "Revision";
                var revisionType = revision?.RevisionType ?? share.RevisionType;
                var mode = revision?.Mode ?? share.Mode;
                var checkMode = revision?.CheckMode ?? share.CheckMode;
                var cardLimit = revision?.CardLimit ?? share.CardLimit;
                var revisionSettingsRaw = revision?.RevisionSettingsJson ?? share.RevisionSettingsJson;
                JsonElement? revisionSettingsElement = null;
                if (!string.IsNullOrWhiteSpace(revisionSettingsRaw))
                {
                    using var doc = JsonDocument.Parse(revisionSettingsRaw);
                    revisionSettingsElement = doc.RootElement.Clone();
                }

                response.Add(new CogitaRevisionShareResponse(
                    share.Id,
                    share.RevisionId,
                    revisionName,
                    share.CollectionId,
                    collectionName,
                    shareCode,
                    revisionType,
                    revisionSettingsElement,
                    mode,
                    checkMode,
                    cardLimit,
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

            if (!await HasCogitaRevisionShareRuntimeSchemaAsync(dbContext, ct))
            {
                return Results.BadRequest(new { error = CogitaRevisionShareSchemaError });
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

        group.MapPost("/libraries/{libraryId:guid}/revisions/{revisionId:guid}/live-sessions", async (
            Guid libraryId,
            Guid revisionId,
            CogitaLiveRevisionSessionCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var revision = await dbContext.CogitaRevisions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }
            var targetCollectionId = request.CollectionId ?? revision.CollectionId;
            var collectionExists = await dbContext.CogitaInfos.AsNoTracking()
                .AnyAsync(x => x.Id == targetCollectionId && x.LibraryId == libraryId && x.InfoType == "collection", ct);
            if (!collectionExists)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var code = GenerateAlphaNumericCode(8);
            var hostSecret = GenerateAlphaNumericCode(24);
            var encryptedPublicCode = EncryptLiveSessionPublicCode(code, dataProtectionProvider);
            var entity = new CogitaLiveRevisionSession
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RevisionId = revision.Id,
                CollectionId = targetCollectionId,
                HostRoleId = library.RoleId,
                PublicCodeHash = HashToken(code),
                HostSecretHash = HashToken(hostSecret),
                Status = "lobby",
                CurrentRoundIndex = 0,
                RevealVersion = 0,
                CurrentPromptJson = null,
                CurrentRevealJson = null,
                SessionMetaJson = BuildLiveSessionMetaJson(
                    request.Title,
                    revision.Name,
                    request.SessionMode,
                    request.HostViewMode,
                    request.ParticipantViewMode,
                    request.SessionSettings.HasValue ? request.SessionSettings.Value.GetRawText() : null,
                    encryptedPublicCode),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.CogitaLiveRevisionSessions.Add(entity);
            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                ScopeType = "live-session",
                ScopeId = entity.Id,
                SourceType = "live-session",
                SessionId = entity.Id,
                ItemType = null,
                ItemId = null,
                EventType = "live_session_created",
                IsPersistent = false,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    revisionId = revision.Id,
                    collectionId = targetCollectionId,
                    request.SessionMode,
                    request.Title
                }),
                CreatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(
                entity,
                code,
                hostSecret,
                dataProtectionProvider,
                dbContext,
                ct);
            return Results.Ok(response);
        });

        group.MapPut("/libraries/{libraryId:guid}/revisions/{revisionId:guid}/live-sessions/{sessionId:guid}", async (
            Guid libraryId,
            Guid revisionId,
            Guid sessionId,
            CogitaLiveRevisionSessionUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var revision = await dbContext.CogitaRevisions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == revisionId && x.LibraryId == libraryId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }

            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId && x.RevisionId == revisionId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var currentMeta = ParseLiveSessionMeta(session.SessionMetaJson);
            var settingsJson = request.SessionSettings.HasValue
                ? request.SessionSettings.Value.GetRawText()
                : currentMeta.SessionSettings?.GetRawText();

            session.SessionMetaJson = BuildLiveSessionMetaJson(
                request.Title ?? currentMeta.Title,
                revision.Name,
                request.SessionMode ?? currentMeta.SessionMode,
                request.HostViewMode ?? currentMeta.HostViewMode,
                request.ParticipantViewMode ?? currentMeta.ParticipantViewMode,
                settingsJson,
                currentMeta.EncryptedPublicCode);
            session.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);

            var updatedMeta = ParseLiveSessionMeta(session.SessionMetaJson);
            var participantCount = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                .CountAsync(x => x.SessionId == session.Id, ct);

            return Results.Ok(new CogitaLiveRevisionSessionListItemResponse(
                session.Id,
                session.LibraryId,
                session.RevisionId,
                session.CollectionId,
                updatedMeta.SessionMode,
                updatedMeta.HostViewMode,
                updatedMeta.ParticipantViewMode,
                session.Status,
                session.CurrentRoundIndex,
                session.UpdatedUtc,
                updatedMeta.Title,
                participantCount
            ));
        });

        group.MapGet("/libraries/{libraryId:guid}/live-sessions", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var items = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.Status != "closed")
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(200)
                .Select(x => new
                {
                    x.Id,
                    x.LibraryId,
                    x.RevisionId,
                    x.CollectionId,
                    x.Status,
                    x.CurrentRoundIndex,
                    x.UpdatedUtc,
                    x.SessionMetaJson
                })
                .ToListAsync(ct);

            var sessionIds = items.Select(x => x.Id).ToList();
            var participantCounts = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                .Where(x => sessionIds.Contains(x.SessionId))
                .GroupBy(x => x.SessionId)
                .Select(x => new { SessionId = x.Key, Count = x.Count() })
                .ToListAsync(ct);
            var participantCountBySession = participantCounts.ToDictionary(x => x.SessionId, x => x.Count);

            var response = items.Select(x =>
            {
                var meta = ParseLiveSessionMeta(x.SessionMetaJson);
                return new CogitaLiveRevisionSessionListItemResponse(
                    x.Id,
                    x.LibraryId,
                    x.RevisionId,
                    x.CollectionId,
                    meta.SessionMode,
                    meta.HostViewMode,
                    meta.ParticipantViewMode,
                    x.Status,
                    x.CurrentRoundIndex,
                    x.UpdatedUtc,
                    meta.Title,
                    participantCountBySession.TryGetValue(x.Id, out var count) ? count : 0
                );
            }).ToList();

            return Results.Ok(response);
        });

        group.MapGet("/libraries/{libraryId:guid}/revisions/{revisionId:guid}/live-sessions", async (
            Guid libraryId,
            Guid revisionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetReadKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var items = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.RevisionId == revisionId && x.Status != "closed")
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(200)
                .Select(x => new
                {
                    x.Id,
                    x.LibraryId,
                    x.RevisionId,
                    x.CollectionId,
                    x.Status,
                    x.CurrentRoundIndex,
                    x.UpdatedUtc,
                    x.SessionMetaJson
                })
                .ToListAsync(ct);

            var sessionIds = items.Select(x => x.Id).ToList();
            var participantCounts = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                .Where(x => sessionIds.Contains(x.SessionId))
                .GroupBy(x => x.SessionId)
                .Select(x => new { SessionId = x.Key, Count = x.Count() })
                .ToListAsync(ct);
            var participantCountBySession = participantCounts.ToDictionary(x => x.SessionId, x => x.Count);

            var response = items.Select(x =>
            {
                var meta = ParseLiveSessionMeta(x.SessionMetaJson);
                return new CogitaLiveRevisionSessionListItemResponse(
                    x.Id,
                    x.LibraryId,
                    x.RevisionId,
                    x.CollectionId,
                    meta.SessionMode,
                    meta.HostViewMode,
                    meta.ParticipantViewMode,
                    x.Status,
                    x.CurrentRoundIndex,
                    x.UpdatedUtc,
                    meta.Title,
                    participantCountBySession.TryGetValue(x.Id, out var count) ? count : 0
                );
            }).ToList();

            return Results.Ok(response);
        });

        group.MapGet("/libraries/{libraryId:guid}/live-sessions/participating", async (
            Guid libraryId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetReadKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var participantRows = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                .Where(x => x.UserId == userId)
                .ToListAsync(ct);
            if (participantRows.Count == 0)
            {
                return Results.Ok(new List<CogitaLiveRevisionParticipantSessionListItemResponse>());
            }

            var participantBySession = participantRows
                .GroupBy(x => x.SessionId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(p => p.UpdatedUtc).First());
            var sessionIds = participantBySession.Keys.ToList();
            var participantIds = participantBySession.Values.Select(x => x.Id).ToList();
            var sessions = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && sessionIds.Contains(x.Id) && x.Status != "closed")
                .OrderByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);

            var participantCounts = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                .Where(x => sessionIds.Contains(x.SessionId))
                .GroupBy(x => x.SessionId)
                .Select(x => new { SessionId = x.Key, Count = x.Count() })
                .ToListAsync(ct);
            var participantCountBySession = participantCounts.ToDictionary(x => x.SessionId, x => x.Count);
            var startedParticipantIds = participantIds.Count == 0
                ? new HashSet<Guid>()
                : (await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                    .Where(x => participantIds.Contains(x.ParticipantId))
                    .Select(x => x.ParticipantId)
                    .Distinct()
                    .ToListAsync(ct))
                .ToHashSet();
            var scoreByParticipant = participantIds.Count == 0
                ? new Dictionary<Guid, int>()
                : new Dictionary<Guid, int>();
            if (participantIds.Count > 0)
            {
                foreach (var sessionId in sessionIds)
                {
                    var computed = await ComputeLiveSessionScoresOnTheFlyAsync(sessionId, dbContext, ct);
                    if (!participantBySession.TryGetValue(sessionId, out var participantRow))
                    {
                        continue;
                    }
                    scoreByParticipant[participantRow.Id] = computed.TotalsByParticipant.TryGetValue(participantRow.Id, out var score)
                        ? score
                        : 0;
                }
            }

            var response = sessions.Select(session =>
            {
                var participant = participantBySession[session.Id];
                var meta = ParseLiveSessionMeta(session.SessionMetaJson);
                var participantStatus = startedParticipantIds.Contains(participant.Id) ? "started" : "not_started";
                return new CogitaLiveRevisionParticipantSessionListItemResponse(
                    session.Id,
                    session.LibraryId,
                    session.RevisionId,
                    session.CollectionId,
                    meta.SessionMode,
                    meta.HostViewMode,
                    meta.ParticipantViewMode,
                    session.Status,
                    session.CurrentRoundIndex,
                    session.UpdatedUtc,
                    meta.Title,
                    participantCountBySession.TryGetValue(session.Id, out var count) ? count : 0,
                    scoreByParticipant.TryGetValue(participant.Id, out var participantScore) ? participantScore : 0,
                    participant.IsConnected,
                    participantStatus
                );
            }).ToList();

            return Results.Ok(response);
        });

        group.MapDelete("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}", async (
            Guid libraryId,
            Guid sessionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var liveSession = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (liveSession is null)
            {
                return Results.NotFound();
            }

            var participants = await dbContext.CogitaLiveRevisionParticipants
                .Where(x => x.SessionId == liveSession.Id)
                .ToListAsync(ct);
            var participantIds = participants.Select(x => x.Id).ToList();
            var answers = participantIds.Count == 0
                ? new List<CogitaLiveRevisionAnswer>()
                : await dbContext.CogitaLiveRevisionAnswers
                    .Where(x => x.SessionId == liveSession.Id && participantIds.Contains(x.ParticipantId))
                    .ToListAsync(ct);
            var reloginRequests = await dbContext.CogitaLiveRevisionReloginRequests
                .Where(x => x.SessionId == liveSession.Id)
                .ToListAsync(ct);
            var statisticsEvents = await dbContext.CogitaStatisticEvents
                .Where(x => x.SessionId == liveSession.Id)
                .ToListAsync(ct);

            if (answers.Count > 0)
            {
                dbContext.CogitaLiveRevisionAnswers.RemoveRange(answers);
            }
            if (reloginRequests.Count > 0)
            {
                dbContext.CogitaLiveRevisionReloginRequests.RemoveRange(reloginRequests);
            }
            if (participants.Count > 0)
            {
                dbContext.CogitaLiveRevisionParticipants.RemoveRange(participants);
            }
            if (statisticsEvents.Count > 0)
            {
                dbContext.CogitaStatisticEvents.RemoveRange(statisticsEvents);
            }

            dbContext.CogitaLiveRevisionSessions.Remove(liveSession);
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        group.MapPost("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/attach", async (
            Guid libraryId,
            Guid sessionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var hostSecret = GenerateAlphaNumericCode(24);
            var meta = ParseLiveSessionMeta(session.SessionMetaJson);
            var code = TryDecryptLiveSessionPublicCode(meta.EncryptedPublicCode, dataProtectionProvider);
            if (string.IsNullOrWhiteSpace(code))
            {
                code = GenerateAlphaNumericCode(8);
                session.PublicCodeHash = HashToken(code);
                session.SessionMetaJson = UpsertLiveSessionMetaEncryptedPublicCode(
                    session.SessionMetaJson,
                    EncryptLiveSessionPublicCode(code, dataProtectionProvider));
            }
            session.HostSecretHash = HashToken(hostSecret);
            session.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(session, code, hostSecret, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapGet("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}", async (
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetReadKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var stateHash = await ComputeLiveSessionStateHashAsync(session, null, null, dbContext, ct);
            SetLiveStateHashHeaders(context, stateHash);
            if (RequestMatchesLiveStateHash(context, stateHash))
            {
                return Results.StatusCode(StatusCodes.Status304NotModified);
            }

            var response = await BuildLiveRevisionHostSessionResponseAsync(session, null, hostSecret, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/state", async (
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            CogitaLiveRevisionHostStateUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var status = string.IsNullOrWhiteSpace(request.Status) ? session.Status : request.Status.Trim().ToLowerInvariant();
            if (status is not ("lobby" or "running" or "revealed" or "finished" or "closed"))
            {
                return Results.BadRequest(new { error = "Invalid status." });
            }

            var requestedRoundIndex = Math.Max(0, request.CurrentRoundIndex);
            var requestedRevealVersion = Math.Max(0, request.RevealVersion);
            var isStaleTransition =
                requestedRoundIndex < session.CurrentRoundIndex ||
                (requestedRoundIndex == session.CurrentRoundIndex && requestedRevealVersion < session.RevealVersion) ||
                (requestedRoundIndex == session.CurrentRoundIndex &&
                 requestedRevealVersion == session.RevealVersion &&
                 GetLiveSessionStatusRank(status) < GetLiveSessionStatusRank(session.Status));
            if (isStaleTransition)
            {
                var staleResponse = await BuildLiveRevisionHostSessionResponseAsync(session, null, null, dataProtectionProvider, dbContext, ct);
                return Results.Ok(staleResponse);
            }

            var now = DateTimeOffset.UtcNow;
            var previousStatus = session.Status;
            var previousRoundIndex = session.CurrentRoundIndex;
            var previousRevealVersion = session.RevealVersion;
            var previousPromptJson = session.CurrentPromptJson;
            var previousRevealJson = session.CurrentRevealJson;
            session.Status = status;
            session.CurrentRoundIndex = requestedRoundIndex;
            session.RevealVersion = requestedRevealVersion;
            session.CurrentPromptJson = request.CurrentPrompt.HasValue ? request.CurrentPrompt.Value.GetRawText() : null;
            session.CurrentRevealJson = request.CurrentReveal.HasValue ? request.CurrentReveal.Value.GetRawText() : null;
            session.UpdatedUtc = now;
            if (status == "running" && session.StartedUtc is null)
            {
                session.StartedUtc = now;
            }
            if (status == "finished")
            {
                session.FinishedUtc ??= now;
            }
            if (status == "closed")
            {
                session.FinishedUtc ??= now;
            }

            if (!string.Equals(previousStatus, status, StringComparison.Ordinal))
            {
                dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    ScopeType = "live-session",
                    ScopeId = session.Id,
                    SourceType = "live-session",
                    SessionId = session.Id,
                    EventType = "live_session_status_changed",
                    RoundIndex = requestedRoundIndex,
                    IsPersistent = false,
                    PayloadJson = JsonSerializer.Serialize(new
                    {
                        from = previousStatus,
                        to = status,
                        previousRoundIndex,
                        previousRevealVersion
                    }),
                    CreatedUtc = now
                });
            }

            var promptChanged =
                !string.Equals(previousPromptJson, session.CurrentPromptJson, StringComparison.Ordinal) &&
                !string.IsNullOrWhiteSpace(session.CurrentPromptJson);
            if (promptChanged)
            {
                var (itemType, itemId, checkType, direction, cardKey) = ResolveCardIdentityFromPromptJson(session.CurrentPromptJson);
                dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    ScopeType = "live-session",
                    ScopeId = session.Id,
                    SourceType = "live-session",
                    SessionId = session.Id,
                    ItemType = itemType,
                    ItemId = itemId,
                    CheckType = checkType,
                    Direction = direction,
                    EventType = "live_round_published",
                    RoundIndex = requestedRoundIndex,
                    CardKey = cardKey,
                    IsPersistent = false,
                    PayloadJson = session.CurrentPromptJson,
                    CreatedUtc = now
                });
            }

            var isNewReveal = requestedRevealVersion > previousRevealVersion;
            if (isNewReveal &&
                !string.Equals(previousRevealJson, session.CurrentRevealJson, StringComparison.Ordinal) &&
                !string.IsNullOrWhiteSpace(session.CurrentRevealJson))
            {
                dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    ScopeType = "live-session",
                    ScopeId = session.Id,
                    SourceType = "live-session",
                    SessionId = session.Id,
                    EventType = "live_round_revealed",
                    RoundIndex = requestedRoundIndex,
                    IsPersistent = false,
                    PayloadJson = session.CurrentRevealJson,
                    CreatedUtc = now
                });
            }

            await dbContext.SaveChangesAsync(ct);
            var response = await BuildLiveRevisionHostSessionResponseAsync(session, null, hostSecret, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/close", async (
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            session.Status = "closed";
            session.UpdatedUtc = now;
            session.FinishedUtc ??= now;
            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                ScopeType = "live-session",
                ScopeId = session.Id,
                SourceType = "live-session",
                SessionId = session.Id,
                EventType = "live_session_closed",
                IsPersistent = false,
                CreatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(session, null, null, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/reset", async (
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var participants = await dbContext.CogitaLiveRevisionParticipants
                .Where(x => x.SessionId == session.Id)
                .ToListAsync(ct);
            var participantIds = participants.Select(x => x.Id).ToList();
            var answers = participantIds.Count == 0
                ? new List<CogitaLiveRevisionAnswer>()
                : await dbContext.CogitaLiveRevisionAnswers
                    .Where(x => x.SessionId == session.Id && participantIds.Contains(x.ParticipantId))
                    .ToListAsync(ct);
            var reloginRequests = await dbContext.CogitaLiveRevisionReloginRequests
                .Where(x => x.SessionId == session.Id)
                .ToListAsync(ct);
            var statisticsEvents = await dbContext.CogitaStatisticEvents
                .Where(x => x.SessionId == session.Id)
                .ToListAsync(ct);

            dbContext.CogitaLiveRevisionAnswers.RemoveRange(answers);
            dbContext.CogitaLiveRevisionReloginRequests.RemoveRange(reloginRequests);
            dbContext.CogitaLiveRevisionParticipants.RemoveRange(participants);
            dbContext.CogitaStatisticEvents.RemoveRange(statisticsEvents);

            var now = DateTimeOffset.UtcNow;
            session.Status = "lobby";
            session.CurrentRoundIndex = 0;
            session.RevealVersion = 0;
            session.CurrentPromptJson = null;
            session.CurrentRevealJson = null;
            session.StartedUtc = null;
            session.FinishedUtc = null;
            session.UpdatedUtc = now;

            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(session, null, hostSecret, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/score", async (
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            CogitaLiveRevisionRevealScoreRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var liveSession = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (liveSession is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, liveSession.HostSecretHash))
            {
                return Results.Forbid();
            }

            if (liveSession.Status == "revealed" && !string.IsNullOrWhiteSpace(liveSession.CurrentRevealJson))
            {
                try
                {
                    var revealNode = JsonNode.Parse(liveSession.CurrentRevealJson) as JsonObject;
                    if (revealNode?["roundScoring"] is JsonObject)
                    {
                        var alreadyScoredResponse = await BuildLiveRevisionHostSessionResponseAsync(liveSession, null, null, dataProtectionProvider, dbContext, ct);
                        return Results.Ok(alreadyScoredResponse);
                    }
                }
                catch (JsonException)
                {
                    // Ignore malformed reveal payload and continue scoring path.
                }
            }

            var scoreItems = (request.Scores ?? new List<CogitaLiveRevisionParticipantScoreDeltaRequest>())
                .Where(x => x.ParticipantId != Guid.Empty)
                .GroupBy(x => x.ParticipantId)
                .Select(group => group.Last())
                .ToList();

            if (scoreItems.Count == 0)
            {
                var emptyResponse = await BuildLiveRevisionHostSessionResponseAsync(liveSession, null, null, dataProtectionProvider, dbContext, ct);
                return Results.Ok(emptyResponse);
            }

            var participantIds = scoreItems.Select(x => x.ParticipantId).Distinct().ToList();
            var participants = await dbContext.CogitaLiveRevisionParticipants
                .Where(x => x.SessionId == sessionId && participantIds.Contains(x.Id))
                .ToListAsync(ct);
            var participantById = participants.ToDictionary(x => x.Id);
            var userIds = participants
                .Where(x => x.UserId.HasValue && x.UserId.Value != Guid.Empty)
                .Select(x => x.UserId!.Value)
                .Distinct()
                .ToList();
            var personRoleByUser = userIds.Count == 0
                ? new Dictionary<Guid, Guid>()
                : await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => userIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.MasterRoleId })
                    .ToDictionaryAsync(x => x.Id, x => x.MasterRoleId, ct);

            var roundIndex = liveSession.CurrentRoundIndex;
            var answers = await dbContext.CogitaLiveRevisionAnswers
                .Where(x => x.SessionId == sessionId && x.RoundIndex == roundIndex && participantIds.Contains(x.ParticipantId))
                .ToListAsync(ct);
            var alreadyScoredRound = answers.Any(x => x.IsCorrect.HasValue);
            if (alreadyScoredRound)
            {
                var alreadyScoredResponse = await BuildLiveRevisionHostSessionResponseAsync(liveSession, null, null, dataProtectionProvider, dbContext, ct);
                return Results.Ok(alreadyScoredResponse);
            }
            var answersByParticipant = answers
                .GroupBy(x => x.ParticipantId)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .OrderByDescending(x => x.SubmittedUtc)
                        .ThenByDescending(x => x.UpdatedUtc)
                        .First());
            var scoringRules = ParseLiveSessionScoringRules(ParseLiveSessionMeta(liveSession.SessionMetaJson).SessionSettings);
            var roundScoringByParticipant = new Dictionary<Guid, JsonObject>();
            if (!string.IsNullOrWhiteSpace(liveSession.CurrentRevealJson))
            {
                try
                {
                    var revealRoot = JsonNode.Parse(liveSession.CurrentRevealJson) as JsonObject;
                    if (revealRoot?["roundScoring"] is JsonObject roundScoringNode)
                    {
                        foreach (var pair in roundScoringNode)
                        {
                            if (Guid.TryParse(pair.Key, out var parsedParticipantId) && pair.Value is JsonObject participantScoringNode)
                            {
                                roundScoringByParticipant[parsedParticipantId] = participantScoringNode;
                            }
                        }
                    }
                }
                catch
                {
                    // Keep fallback behaviour without score breakdown payload.
                }
            }

            var priorAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                .Where(x =>
                    x.SessionId == sessionId &&
                    x.RoundIndex < roundIndex &&
                    participantIds.Contains(x.ParticipantId) &&
                    x.IsCorrect.HasValue)
                .OrderByDescending(x => x.RoundIndex)
                .ThenByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);
            var previousStreakByParticipant = priorAnswers
                .GroupBy(x => x.ParticipantId)
                .ToDictionary(
                    group => group.Key,
                    group =>
                    {
                        var streak = 0;
                        foreach (var previous in group)
                        {
                            if (previous.IsCorrect == true)
                            {
                                streak += 1;
                            }
                            else
                            {
                                break;
                            }
                        }
                        return streak;
                    });
            var previousWrongStreakByParticipant = priorAnswers
                .GroupBy(x => x.ParticipantId)
                .ToDictionary(
                    group => group.Key,
                    group =>
                    {
                        var streak = 0;
                        foreach (var previous in group)
                        {
                            if (previous.IsCorrect == false)
                            {
                                streak += 1;
                            }
                            else
                            {
                                break;
                            }
                        }
                        return streak;
                    });
            var firstCorrectParticipantId = scoreItems
                .Where(x => x.IsCorrect == true)
                .Select(x => answersByParticipant.TryGetValue(x.ParticipantId, out var answer) ? answer : null)
                .Where(x => x is not null)
                .OrderBy(x => x!.SubmittedUtc)
                .ThenBy(x => x!.UpdatedUtc)
                .Select(x => x!.ParticipantId)
                .FirstOrDefault();
            var firstAnsweredParticipantId = scoreItems
                .Select(x => answersByParticipant.TryGetValue(x.ParticipantId, out var answer) ? answer : null)
                .Where(x => x is not null)
                .OrderBy(x => x!.SubmittedUtc)
                .ThenBy(x => x!.UpdatedUtc)
                .Select(x => x!.ParticipantId)
                .FirstOrDefault();
            var firstWrongParticipantId = scoreItems
                .Where(x => x.IsCorrect == false)
                .Select(x => answersByParticipant.TryGetValue(x.ParticipantId, out var answer) ? answer : null)
                .Where(x => x is not null)
                .OrderBy(x => x!.SubmittedUtc)
                .ThenBy(x => x!.UpdatedUtc)
                .Select(x => x!.ParticipantId)
                .FirstOrDefault();
            var firstAnsweredUtc = answersByParticipant.Values
                .OrderBy(x => x.SubmittedUtc)
                .ThenBy(x => x.UpdatedUtc)
                .Select(x => x.SubmittedUtc)
                .FirstOrDefault();
            var roundStartUtc = ResolvePromptStartUtc(liveSession.CurrentPromptJson) ?? firstAnsweredUtc;
            var speedTimerStartUtc = string.Equals(scoringRules.BonusTimerStartMode, "first_answer", StringComparison.Ordinal)
                ? firstAnsweredUtc
                : roundStartUtc;
            var speedTimerEndUtc = speedTimerStartUtc.AddSeconds(Math.Max(1, Math.Min(600, scoringRules.BonusTimerSeconds)));

            var now = DateTimeOffset.UtcNow;
            var roundPointsSum = 0;
            foreach (var delta in scoreItems)
            {
                if (!participantById.TryGetValue(delta.ParticipantId, out var participant))
                {
                    continue;
                }

                participant.UpdatedUtc = now;

                if (answersByParticipant.TryGetValue(delta.ParticipantId, out var answer))
                {
                    answer.IsCorrect = delta.IsCorrect;
                    answer.UpdatedUtc = now;
                    if (!roundScoringByParticipant.TryGetValue(delta.ParticipantId, out var participantScoringNode))
                    {
                        var synthesizedScoringNode = new JsonObject
                        {
                            ["isCorrect"] = delta.IsCorrect == true,
                            ["points"] = 0
                        };
                        var synthesizedFactors = new JsonArray();
                        var basePoints = 0;
                        var firstBonusPoints = 0;
                        var speedPoints = 0;
                        var streakPoints = 0;
                        var wrongPenaltyPoints = 0;
                        var firstWrongPenaltyPoints = 0;
                        var wrongStreakPenaltyPoints = 0;
                        var streakCount = 0;
                        var wrongStreakCount = 0;
                        var firstBonusApplies = scoringRules.FirstCorrectBonus > 0 &&
                            (
                                (string.Equals(scoringRules.FirstBonusMode, "first_answer", StringComparison.Ordinal) && firstAnsweredParticipantId != Guid.Empty && delta.ParticipantId == firstAnsweredParticipantId) ||
                                (string.Equals(scoringRules.FirstBonusMode, "first_correct", StringComparison.Ordinal) && firstCorrectParticipantId != Guid.Empty && delta.ParticipantId == firstCorrectParticipantId)
                            );
                        if (firstBonusApplies)
                        {
                            firstBonusPoints = Math.Max(0, Math.Min(500000, scoringRules.FirstCorrectBonus));
                            if (firstBonusPoints > 0)
                            {
                                synthesizedFactors.Add(JsonValue.Create("first"));
                            }
                        }
                        if (delta.IsCorrect == true)
                        {
                            basePoints = Math.Max(0, Math.Min(500000, scoringRules.BaseCorrect));
                            if (basePoints > 0)
                            {
                                synthesizedFactors.Add(JsonValue.Create("base"));
                            }

                            var previousStreak = previousStreakByParticipant.TryGetValue(delta.ParticipantId, out var resolvedStreak)
                                ? resolvedStreak
                                : 0;
                            streakCount = previousStreak + 1;
                            streakPoints = ComputeAsyncStreakBonus(
                                scoringRules.StreakGrowth,
                                scoringRules.StreakBaseBonus,
                                streakCount,
                                scoringRules.StreakLimit);
                            if (streakPoints > 0)
                            {
                                synthesizedFactors.Add(JsonValue.Create("streak"));
                            }

                            if (scoringRules.BonusTimerEnabled &&
                                scoringRules.SpeedBonusEnabled &&
                                scoringRules.SpeedBonusMaxPoints > 0 &&
                                answer.UpdatedUtc <= speedTimerEndUtc)
                            {
                                var denominator = Math.Max(1d, (speedTimerEndUtc - speedTimerStartUtc).TotalMilliseconds);
                                var ratio = Math.Max(0d, Math.Min(1d, (speedTimerEndUtc - answer.UpdatedUtc).TotalMilliseconds / denominator));
                                var scaled = scoringRules.SpeedBonusGrowth switch
                                {
                                    "exponential" => ratio * ratio,
                                    "limited" => Math.Min(1d, ratio * 1.6d),
                                    _ => ratio
                                };
                                speedPoints = Math.Max(0, Math.Min(500000, (int)Math.Round(scoringRules.SpeedBonusMaxPoints * scaled)));
                                if (speedPoints > 0)
                                {
                                    synthesizedFactors.Add(JsonValue.Create("speed"));
                                }
                            }
                        }
                        else
                        {
                            wrongPenaltyPoints = Math.Max(0, Math.Min(500000, scoringRules.WrongAnswerPenalty));
                            if (wrongPenaltyPoints > 0)
                            {
                                synthesizedFactors.Add(JsonValue.Create("wrong"));
                            }
                            var firstWrongPenaltyApplies =
                                (string.Equals(scoringRules.FirstWrongPenaltyMode, "first_overall_answer", StringComparison.Ordinal) &&
                                 firstAnsweredParticipantId != Guid.Empty &&
                                 delta.ParticipantId == firstAnsweredParticipantId) ||
                                (string.Equals(scoringRules.FirstWrongPenaltyMode, "first_wrong", StringComparison.Ordinal) &&
                                 firstWrongParticipantId != Guid.Empty &&
                                 delta.ParticipantId == firstWrongParticipantId);
                            if (firstWrongPenaltyApplies)
                            {
                                firstWrongPenaltyPoints = Math.Max(0, Math.Min(500000, scoringRules.FirstWrongPenalty));
                                if (firstWrongPenaltyPoints > 0)
                                {
                                    synthesizedFactors.Add(JsonValue.Create("first-wrong"));
                                }
                            }
                            var previousWrong = previousWrongStreakByParticipant.TryGetValue(delta.ParticipantId, out var resolvedWrong)
                                ? resolvedWrong
                                : 0;
                            wrongStreakCount = previousWrong + 1;
                            wrongStreakPenaltyPoints = ComputeAsyncStreakBonus(
                                scoringRules.WrongStreakGrowth,
                                scoringRules.WrongStreakBasePenalty,
                                wrongStreakCount,
                                scoringRules.WrongStreakLimit);
                            if (wrongStreakPenaltyPoints > 0)
                            {
                                synthesizedFactors.Add(JsonValue.Create("wrong-streak"));
                            }
                        }
                        var synthesizedPoints = delta.IsCorrect == true
                            ? Math.Max(0, Math.Min(500000, basePoints + firstBonusPoints + speedPoints + streakPoints))
                            : -Math.Max(0, Math.Min(500000, wrongPenaltyPoints + firstWrongPenaltyPoints + wrongStreakPenaltyPoints));

                        synthesizedScoringNode["points"] = synthesizedPoints;
                        synthesizedScoringNode["factors"] = synthesizedFactors;
                        synthesizedScoringNode["basePoints"] = basePoints;
                        synthesizedScoringNode["firstBonusPoints"] = firstBonusPoints;
                        synthesizedScoringNode["speedPoints"] = speedPoints;
                        synthesizedScoringNode["streakPoints"] = streakPoints;
                        synthesizedScoringNode["wrongPenaltyPoints"] = wrongPenaltyPoints;
                        synthesizedScoringNode["firstWrongPenaltyPoints"] = firstWrongPenaltyPoints;
                        synthesizedScoringNode["wrongStreakPenaltyPoints"] = wrongStreakPenaltyPoints;
                        synthesizedScoringNode["streak"] = streakCount;
                        synthesizedScoringNode["wrongStreak"] = wrongStreakCount;
                        synthesizedScoringNode["answerDurationSeconds"] = Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalSeconds));
                        participantScoringNode = synthesizedScoringNode;
                        roundScoringByParticipant[delta.ParticipantId] = synthesizedScoringNode;
                    }
                    static int ReadScoringInt(JsonObject root, string key)
                    {
                        if (root[key] is JsonValue value)
                        {
                            if (value.TryGetValue<int>(out var intValue)) return intValue;
                            if (value.TryGetValue<double>(out var doubleValue)) return (int)Math.Round(doubleValue);
                        }
                        return 0;
                    }
                    var computedPoints = delta.IsCorrect == true
                        ? Math.Max(0, Math.Min(500000,
                            Math.Max(0, ReadScoringInt(participantScoringNode, "basePoints")) +
                            Math.Max(0, ReadScoringInt(participantScoringNode, "firstBonusPoints")) +
                            Math.Max(0, ReadScoringInt(participantScoringNode, "speedPoints")) +
                            Math.Max(0, ReadScoringInt(participantScoringNode, "streakPoints"))))
                        : -Math.Max(0, Math.Min(500000,
                            Math.Max(0, ReadScoringInt(participantScoringNode, "wrongPenaltyPoints")) +
                            Math.Max(0, ReadScoringInt(participantScoringNode, "firstWrongPenaltyPoints")) +
                            Math.Max(0, ReadScoringInt(participantScoringNode, "wrongStreakPenaltyPoints"))));
                    participantScoringNode["points"] = computedPoints;
                    roundPointsSum += computedPoints;
                    var payloadJson = BuildLiveScoreBreakdownPayload(
                        participantScoringNode,
                        scoringRules,
                        delta.IsCorrect);

                    var (itemType, itemId, checkType, direction) = ParseCardIdentityFromCardKey(answer.CardKey);
                    dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                    {
                        Id = Guid.NewGuid(),
                        LibraryId = liveSession.LibraryId,
                        ScopeType = "live-session",
                        ScopeId = liveSession.Id,
                        SourceType = "live-session",
                        SessionId = liveSession.Id,
                        PersonRoleId = null,
                        ParticipantId = participant.Id,
                        ParticipantLabel = null,
                        ItemType = itemType,
                        ItemId = itemId,
                        CheckType = checkType,
                        Direction = direction,
                        EventType = "live_answer_scored",
                        RoundIndex = roundIndex,
                        CardKey = answer.CardKey,
                        IsCorrect = delta.IsCorrect,
                        Correctness = delta.IsCorrect.HasValue ? (delta.IsCorrect.Value ? 1d : 0d) : null,
                        PointsAwarded = null,
                        DurationMs = (int?)Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalMilliseconds)),
                        IsPersistent = false,
                        PayloadJson = payloadJson,
                        CreatedUtc = now
                    });

                    if (participant.UserId.HasValue &&
                        participant.UserId.Value != Guid.Empty &&
                        personRoleByUser.TryGetValue(participant.UserId.Value, out var personRoleId) &&
                        !string.IsNullOrWhiteSpace(itemType) &&
                        itemId.HasValue)
                    {
                        dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                        {
                            Id = Guid.NewGuid(),
                            LibraryId = liveSession.LibraryId,
                            ScopeType = itemType!,
                            ScopeId = itemId.Value,
                            SourceType = "live-session-person",
                            SessionId = liveSession.Id,
                            PersonRoleId = personRoleId,
                            ParticipantId = participant.Id,
                            ParticipantLabel = null,
                            ItemType = itemType,
                            ItemId = itemId,
                            CheckType = checkType,
                            Direction = direction,
                            EventType = "live_answer_scored_personal",
                            RoundIndex = roundIndex,
                            CardKey = answer.CardKey,
                            IsCorrect = delta.IsCorrect,
                            Correctness = delta.IsCorrect.HasValue ? (delta.IsCorrect.Value ? 1d : 0d) : null,
                            PointsAwarded = null,
                            DurationMs = (int?)Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalMilliseconds)),
                            IsPersistent = true,
                            PayloadJson = payloadJson,
                            CreatedUtc = now
                        });
                    }
                }
            }

            var knownessSampleSize = scoreItems.Count;
            var knownessCorrectCount = scoreItems.Count(x => x.IsCorrect == true);
            var knownessAveragePercent = knownessSampleSize > 0
                ? Math.Round((double)knownessCorrectCount / knownessSampleSize * 100d, 2)
                : 0d;

            try
            {
                var promptNode = !string.IsNullOrWhiteSpace(liveSession.CurrentPromptJson)
                    ? JsonNode.Parse(liveSession.CurrentPromptJson) as JsonObject
                    : null;
                var revealNode = !string.IsNullOrWhiteSpace(liveSession.CurrentRevealJson)
                    ? JsonNode.Parse(liveSession.CurrentRevealJson) as JsonObject
                    : new JsonObject();

                revealNode ??= new JsonObject();
                revealNode["knownessAveragePercent"] = knownessAveragePercent;
                revealNode["knownessCorrectCount"] = knownessCorrectCount;
                revealNode["knownessSampleSize"] = knownessSampleSize;
                revealNode["roundScored"] = true;
                revealNode["roundScoredRoundIndex"] = roundIndex;

                var cardKey = promptNode?["cardKey"]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(cardKey))
                {
                    var knownessByCardKey = new JsonObject();
                    var sourceKnownessByCardKey = revealNode["knownessByCardKey"] as JsonObject
                        ?? promptNode?["knownessByCardKey"] as JsonObject;
                    if (sourceKnownessByCardKey is not null)
                    {
                        foreach (var pair in sourceKnownessByCardKey)
                        {
                            knownessByCardKey[pair.Key] = pair.Value is null
                                ? null
                                : JsonNode.Parse(pair.Value.ToJsonString());
                        }
                    }
                    knownessByCardKey[cardKey] = knownessAveragePercent;
                    revealNode["knownessByCardKey"] = knownessByCardKey;
                }

                liveSession.CurrentRevealJson = revealNode.ToJsonString();
            }
            catch (Exception)
            {
                // Keep score processing resilient even if prompt/reveal payload is malformed.
            }

            liveSession.UpdatedUtc = now;
            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
            {
                Id = Guid.NewGuid(),
                LibraryId = liveSession.LibraryId,
                ScopeType = "live-session",
                ScopeId = liveSession.Id,
                SourceType = "live-session",
                SessionId = liveSession.Id,
                EventType = "live_round_scored",
                RoundIndex = roundIndex,
                IsCorrect = null,
                Correctness = knownessSampleSize > 0 ? knownessCorrectCount / (double)knownessSampleSize : null,
                PointsAwarded = null,
                IsPersistent = false,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    knownessSampleSize,
                    knownessCorrectCount,
                    knownessAveragePercent
                }),
                CreatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(liveSession, null, null, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/relogin-requests/{requestId:guid}/approve", async (
            Guid libraryId,
            Guid sessionId,
            Guid requestId,
            string hostSecret,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var liveSession = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (liveSession is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, liveSession.HostSecretHash))
            {
                return Results.Forbid();
            }

            var reloginRequest = await dbContext.CogitaLiveRevisionReloginRequests
                .FirstOrDefaultAsync(x => x.Id == requestId && x.SessionId == sessionId, ct);
            if (reloginRequest is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            reloginRequest.Status = "approved";
            reloginRequest.ApprovedUtc = now;
            reloginRequest.UpdatedUtc = now;
            liveSession.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(liveSession, null, null, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapPost("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/participants", async (
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            CogitaLiveRevisionHostParticipantCreateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var liveSession = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (liveSession is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, liveSession.HostSecretHash))
            {
                return Results.Forbid();
            }

            var name = NormalizeLiveParticipantName(request.Name);
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Name is required." });
            }
            var nameHash = HashToken(name);

            var exists = (await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                    .Where(x => x.SessionId == liveSession.Id)
                    .Select(x => new { x.DisplayName, x.DisplayNameHash })
                    .ToListAsync(ct))
                .Any(x => MatchesStoredLiveName(x.DisplayName, x.DisplayNameHash, name, nameHash));
            if (exists)
            {
                return Results.Conflict(new { error = "Name already used in this live session." });
            }

            var now = DateTimeOffset.UtcNow;
            var participantToken = GenerateAlphaNumericCode(24);
            var participant = new CogitaLiveRevisionParticipant
            {
                Id = Guid.NewGuid(),
                SessionId = liveSession.Id,
                DisplayName = "[encrypted]",
                DisplayNameHash = nameHash,
                DisplayNameCipher = ProtectLiveSessionScopedText(name, dataProtectionProvider, liveSession.Id, "participant-name"),
                UserId = null,
                JoinTokenHash = HashToken(participantToken),
                Score = 0,
                IsConnected = false,
                JoinedUtc = now,
                UpdatedUtc = now
            };

            dbContext.CogitaLiveRevisionParticipants.Add(participant);
            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
            {
                Id = Guid.NewGuid(),
                LibraryId = liveSession.LibraryId,
                ScopeType = "live-session",
                ScopeId = liveSession.Id,
                SourceType = "live-session",
                SessionId = liveSession.Id,
                ParticipantId = participant.Id,
                ParticipantLabel = null,
                EventType = "live_participant_created_by_host",
                IsPersistent = false,
                CreatedUtc = now
            });
            liveSession.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(liveSession, null, null, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapDelete("/libraries/{libraryId:guid}/live-sessions/{sessionId:guid}/host/participants/{participantId:guid}", async (
            Guid libraryId,
            Guid sessionId,
            Guid participantId,
            string hostSecret,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IDataProtectionProvider dataProtectionProvider,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) ||
                !EndpointHelpers.TryGetSessionId(context, out var sessionToken))
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
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionToken, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var liveSession = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (liveSession is null)
            {
                return Results.NotFound();
            }

            if (!MatchesTokenHash(hostSecret, liveSession.HostSecretHash))
            {
                return Results.Forbid();
            }

            var participant = await dbContext.CogitaLiveRevisionParticipants
                .FirstOrDefaultAsync(x => x.Id == participantId && x.SessionId == liveSession.Id, ct);
            if (participant is null)
            {
                return Results.NotFound();
            }

            var answers = await dbContext.CogitaLiveRevisionAnswers
                .Where(x => x.SessionId == liveSession.Id && x.ParticipantId == participantId)
                .ToListAsync(ct);
            var reloginRequestCandidates = await dbContext.CogitaLiveRevisionReloginRequests
                .Where(x => x.SessionId == liveSession.Id)
                .ToListAsync(ct);
            var reloginRequests = reloginRequestCandidates
                .Where(x => MatchesStoredLiveName(
                    x.DisplayName,
                    x.DisplayNameHash,
                    participant.DisplayName,
                    participant.DisplayNameHash))
                .ToList();
            var participantStatistics = await dbContext.CogitaStatisticEvents
                .Where(x => x.SessionId == liveSession.Id && x.ParticipantId == participantId)
                .ToListAsync(ct);

            dbContext.CogitaLiveRevisionAnswers.RemoveRange(answers);
            dbContext.CogitaLiveRevisionReloginRequests.RemoveRange(reloginRequests);
            dbContext.CogitaStatisticEvents.RemoveRange(participantStatistics);
            dbContext.CogitaLiveRevisionParticipants.Remove(participant);
            liveSession.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            var response = await BuildLiveRevisionHostSessionResponseAsync(liveSession, null, null, dataProtectionProvider, dbContext, ct);
            return Results.Ok(response);
        });

        group.MapPost("/public/live-revision/{code}/join", async (
            string code,
            CogitaLiveRevisionJoinRequest request,
            HttpContext context,
            IDataProtectionProvider dataProtectionProvider,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }
            if (session.Status == "closed" || session.Status == "finished")
            {
                return Results.BadRequest(new { error = "Live session is not accepting new participants." });
            }

            var name = NormalizeLiveParticipantName(request.Name);
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Name is required." });
            }
            var nameHash = HashToken(name);

            var existingParticipant = (await dbContext.CogitaLiveRevisionParticipants
                    .Where(x => x.SessionId == session.Id)
                    .ToListAsync(ct))
                .FirstOrDefault(x => MatchesStoredLiveName(x.DisplayName, x.DisplayNameHash, name, nameHash));
            if (existingParticipant is not null)
            {
                if (!request.UseExistingName)
                {
                    return Results.Conflict(new
                    {
                        error = "Name is already used in this live session.",
                        code = "name_already_used",
                        participantName = name
                    });
                }

                var nowApproved = DateTimeOffset.UtcNow;
                var reloginParticipantToken = GenerateAlphaNumericCode(24);
                existingParticipant.JoinTokenHash = HashToken(reloginParticipantToken);
                existingParticipant.IsConnected = true;
                existingParticipant.UserId = EndpointHelpers.TryGetUserId(context, out var reloginUserId) ? reloginUserId : existingParticipant.UserId;
                existingParticipant.UpdatedUtc = nowApproved;
                existingParticipant.DisplayNameHash = nameHash;
                existingParticipant.DisplayNameCipher = ProtectLiveSessionScopedText(name, dataProtectionProvider, session.Id, "participant-name");
                existingParticipant.DisplayName = "[encrypted]";

                var sessionMeta = ParseLiveSessionMeta(session.SessionMetaJson);
                if (string.Equals(sessionMeta.SessionMode, "asynchronous", StringComparison.Ordinal) &&
                    string.Equals(session.Status, "running", StringComparison.Ordinal))
                {
                    var rounds = ParseLiveAsyncRoundBundle(session.CurrentPromptJson);
                    if (rounds.Count > 0)
                    {
                        var revisionMode = ParseLiveAsyncRevisionMode(session.CurrentPromptJson);
                        var (considerDependencies, dependencyThreshold) = ParseLiveAsyncDependencyOptions(session.CurrentPromptJson);
                        var dependencyEdges = considerDependencies
                            ? await BuildLiveAsyncDependencyEdgesAsync(session.LibraryId, rounds, dbContext, ct)
                            : new List<LiveAsyncDependencyEdge>();
                        var flowRules = ParseLiveSessionFlowRules(sessionMeta.SessionSettings);
                        var participantAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                            .Where(x => x.SessionId == session.Id && x.ParticipantId == existingParticipant.Id)
                            .OrderBy(x => x.RoundIndex)
                            .ThenByDescending(x => x.UpdatedUtc)
                            .ToListAsync(ct);
                        var timerEvents = await LoadLiveAsyncTimerEventsAsync(session.Id, existingParticipant.Id, dbContext, ct);
                        var reconnectState = BuildLiveAsyncParticipantState(
                            rounds,
                            participantAnswers,
                            existingParticipant.Id,
                            revisionMode,
                            dependencyEdges,
                            considerDependencies,
                            dependencyThreshold,
                            timerEvents,
                            existingParticipant.JoinedUtc,
                            session.StartedUtc,
                            flowRules,
                            nowApproved);
                        if (reconnectState.TimerPaused &&
                            !string.Equals(reconnectState.Phase, "finished", StringComparison.Ordinal))
                        {
                            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                            {
                                Id = Guid.NewGuid(),
                                LibraryId = session.LibraryId,
                                ScopeType = "live-session",
                                ScopeId = session.Id,
                                SourceType = "live-session",
                                SessionId = session.Id,
                                ParticipantId = existingParticipant.Id,
                                ParticipantLabel = null,
                                EventType = "live_async_timer_resumed",
                                RoundIndex = reconnectState.RoundIndex,
                                IsPersistent = false,
                                PayloadJson = JsonSerializer.Serialize(new Dictionary<string, object?> { ["source"] = "reconnect" }),
                                CreatedUtc = nowApproved
                            });
                        }
                    }
                }

                session.UpdatedUtc = nowApproved;
                dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                {
                    Id = Guid.NewGuid(),
                    LibraryId = session.LibraryId,
                    ScopeType = "live-session",
                    ScopeId = session.Id,
                    SourceType = "live-session",
                    SessionId = session.Id,
                    ParticipantId = existingParticipant.Id,
                    ParticipantLabel = null,
                    EventType = "live_participant_rejoined",
                    IsPersistent = false,
                    CreatedUtc = nowApproved
                });
                await dbContext.SaveChangesAsync(ct);

                return Results.Ok(new CogitaLiveRevisionJoinResponse(session.Id, existingParticipant.Id, reloginParticipantToken, name));
            }

            var now = DateTimeOffset.UtcNow;
            var participantToken = GenerateAlphaNumericCode(24);
            var participant = new CogitaLiveRevisionParticipant
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                DisplayName = "[encrypted]",
                DisplayNameHash = nameHash,
                DisplayNameCipher = ProtectLiveSessionScopedText(name, dataProtectionProvider, session.Id, "participant-name"),
                UserId = EndpointHelpers.TryGetUserId(context, out var userId) ? userId : null,
                JoinTokenHash = HashToken(participantToken),
                Score = 0,
                IsConnected = true,
                JoinedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaLiveRevisionParticipants.Add(participant);
            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
            {
                Id = Guid.NewGuid(),
                LibraryId = session.LibraryId,
                ScopeType = "live-session",
                ScopeId = session.Id,
                SourceType = "live-session",
                SessionId = session.Id,
                ParticipantId = participant.Id,
                ParticipantLabel = null,
                EventType = "live_participant_joined",
                IsPersistent = false,
                CreatedUtc = now
            });
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaLiveRevisionJoinResponse(session.Id, participant.Id, participantToken, name));
        }).AllowAnonymous();

        group.MapPost("/public/live-revision/{code}/relogin-request", async (
            string code,
            CogitaLiveRevisionReloginRequestCreateRequest request,
            IDataProtectionProvider dataProtectionProvider,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }
            if (session.Status == "closed" || session.Status == "finished")
            {
                return Results.BadRequest(new { error = "Live session is not accepting relogin requests." });
            }

            var name = NormalizeLiveParticipantName(request.Name);
            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest(new { error = "Name is required." });
            }
            var nameHash = HashToken(name);

            var participantExists = (await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                    .Where(x => x.SessionId == session.Id)
                    .Select(x => new { x.DisplayName, x.DisplayNameHash })
                    .ToListAsync(ct))
                .Any(x => MatchesStoredLiveName(x.DisplayName, x.DisplayNameHash, name, nameHash));
            if (!participantExists)
            {
                return Results.NotFound(new { error = "Participant not found." });
            }

            var reloginRequest = (await dbContext.CogitaLiveRevisionReloginRequests
                    .Where(x => x.SessionId == session.Id && (x.Status == "pending" || x.Status == "approved"))
                    .OrderByDescending(x => x.RequestedUtc)
                    .ToListAsync(ct))
                .FirstOrDefault(x => MatchesStoredLiveName(x.DisplayName, x.DisplayNameHash, name, nameHash));

            if (reloginRequest is null)
            {
                var now = DateTimeOffset.UtcNow;
                reloginRequest = new CogitaLiveRevisionReloginRequest
                {
                    Id = Guid.NewGuid(),
                    SessionId = session.Id,
                    DisplayName = "[encrypted]",
                    DisplayNameHash = nameHash,
                    DisplayNameCipher = ProtectLiveSessionScopedText(name, dataProtectionProvider, session.Id, "relogin-name"),
                    Status = "pending",
                    RequestedUtc = now,
                    UpdatedUtc = now,
                    ApprovedUtc = null
                };
                dbContext.CogitaLiveRevisionReloginRequests.Add(reloginRequest);
                session.UpdatedUtc = now;
                await dbContext.SaveChangesAsync(ct);
            }
            else if (reloginRequest.DisplayNameHash is null || string.IsNullOrWhiteSpace(reloginRequest.DisplayNameCipher))
            {
                reloginRequest.DisplayNameHash = nameHash;
                reloginRequest.DisplayNameCipher = ProtectLiveSessionScopedText(name, dataProtectionProvider, session.Id, "relogin-name");
                reloginRequest.DisplayName = "[encrypted]";
                reloginRequest.UpdatedUtc = DateTimeOffset.UtcNow;
                session.UpdatedUtc = reloginRequest.UpdatedUtc;
                await dbContext.SaveChangesAsync(ct);
            }

            return Results.Ok(new CogitaLiveRevisionReloginRequestCreateResponse(
                session.Id,
                reloginRequest.Id,
                reloginRequest.Status,
                name
            ));
        }).AllowAnonymous();

        group.MapGet("/public/live-revision/{code}/relogin-request/{requestId:guid}", async (
            string code,
            Guid requestId,
            IDataProtectionProvider dataProtectionProvider,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var session = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var reloginRequest = await dbContext.CogitaLiveRevisionReloginRequests.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == requestId && x.SessionId == session.Id, ct);
            if (reloginRequest is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new CogitaLiveRevisionReloginRequestResponse(
                reloginRequest.Id,
                ResolveLiveReloginDisplayName(reloginRequest, dataProtectionProvider, session.Id),
                reloginRequest.Status,
                reloginRequest.RequestedUtc,
                reloginRequest.ApprovedUtc
            ));
        }).AllowAnonymous();

        group.MapGet("/public/live-revision/{code}/state", async (
            string code,
            string? participantToken,
            HttpContext context,
            IDataProtectionProvider dataProtectionProvider,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }
            var meta = ParseLiveSessionMeta(session.SessionMetaJson);
            var isAsyncSession = string.Equals(meta.SessionMode, "asynchronous", StringComparison.Ordinal);

            var answerSubmitted = false;
            Guid? participantId = null;
            string? participantName = null;
            string? participantTokenIssued = null;
            CogitaLiveRevisionParticipant? participant = null;
            if (!string.IsNullOrWhiteSpace(participantToken))
            {
                participant = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.JoinTokenHash == HashToken(participantToken), ct);
                if (participant is not null)
                {
                    participantId = participant.Id;
                    participantName = ResolveLiveParticipantDisplayName(participant, dataProtectionProvider, session.Id);
                }
            }

            var stateHash = await ComputeLiveSessionStateHashAsync(session, participantId, participantToken, dbContext, ct);
            SetLiveStateHashHeaders(context, stateHash);
            if (RequestMatchesLiveStateHash(context, stateHash))
            {
                return Results.StatusCode(StatusCodes.Status304NotModified);
            }

            var scoreboard = await BuildLiveRevisionScoreboardAsync(session.Id, dataProtectionProvider, dbContext, ct);
            var scoreHistory = await BuildLiveRevisionScoreHistoryAsync(session.Id, dataProtectionProvider, dbContext, ct);
            var correctnessHistory = await BuildLiveRevisionCorrectnessHistoryAsync(session.Id, dataProtectionProvider, dbContext, ct);

            if (isAsyncSession)
            {
                var effectiveStatus = session.Status;
                var effectiveRoundIndex = session.CurrentRoundIndex;
                JsonElement? currentPrompt = null;
                JsonElement? currentReveal = null;
                var now = DateTimeOffset.UtcNow;
                var flowRules = ParseLiveSessionFlowRules(meta.SessionSettings);
                if (participant is not null)
                {
                    var rounds = ParseLiveAsyncRoundBundle(session.CurrentPromptJson);
                    var revisionMode = ParseLiveAsyncRevisionMode(session.CurrentPromptJson);
                    var (considerDependencies, dependencyThreshold) = ParseLiveAsyncDependencyOptions(session.CurrentPromptJson);
                    var dependencyEdges = considerDependencies
                        ? await BuildLiveAsyncDependencyEdgesAsync(session.LibraryId, rounds, dbContext, ct)
                        : new List<LiveAsyncDependencyEdge>();
                    var participantAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                        .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id)
                        .OrderBy(x => x.RoundIndex)
                        .ThenByDescending(x => x.UpdatedUtc)
                        .ToListAsync(ct);
                    var timerEvents = await LoadLiveAsyncTimerEventsAsync(session.Id, participant.Id, dbContext, ct);
                    var asyncState = BuildLiveAsyncParticipantState(
                        rounds,
                        participantAnswers,
                        participant.Id,
                        revisionMode,
                        dependencyEdges,
                        considerDependencies,
                        dependencyThreshold,
                        timerEvents,
                        participant.JoinedUtc,
                        session.StartedUtc,
                        flowRules,
                        now);

                    if (asyncState.TimerPaused &&
                        string.Equals(asyncState.TimerPauseSource, "leave", StringComparison.Ordinal) &&
                        !string.Equals(asyncState.Phase, "finished", StringComparison.Ordinal) &&
                        !participant.IsConnected)
                    {
                        var trackedParticipant = await dbContext.CogitaLiveRevisionParticipants
                            .FirstOrDefaultAsync(x => x.Id == participant.Id && x.SessionId == session.Id, ct);
                        if (trackedParticipant is not null)
                        {
                            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                            {
                                Id = Guid.NewGuid(),
                                LibraryId = session.LibraryId,
                                ScopeType = "live-session",
                                ScopeId = session.Id,
                                SourceType = "live-session",
                                SessionId = session.Id,
                                ParticipantId = trackedParticipant.Id,
                                ParticipantLabel = null,
                                EventType = "live_async_timer_resumed",
                                RoundIndex = asyncState.RoundIndex,
                                IsPersistent = false,
                                PayloadJson = JsonSerializer.Serialize(new Dictionary<string, object?> { ["source"] = "return" }),
                                CreatedUtc = now
                            });
                            trackedParticipant.IsConnected = true;
                            trackedParticipant.UpdatedUtc = now;
                            session.UpdatedUtc = now;
                            await dbContext.SaveChangesAsync(ct);

                            timerEvents = await LoadLiveAsyncTimerEventsAsync(session.Id, participant.Id, dbContext, ct);
                            asyncState = BuildLiveAsyncParticipantState(
                                rounds,
                                participantAnswers,
                                participant.Id,
                                revisionMode,
                                dependencyEdges,
                                considerDependencies,
                                dependencyThreshold,
                                timerEvents,
                                participant.JoinedUtc,
                                session.StartedUtc,
                                flowRules,
                                now);
                        }
                    }

                    if (flowRules.SessionTimerEnabled &&
                        asyncState.SessionElapsedSeconds >= flowRules.SessionTimerSeconds)
                    {
                        var changed = await MarkLiveAsyncUnansweredRoundsAsync(
                            session.Id,
                            session.LibraryId,
                            participant.Id,
                            rounds,
                            now,
                            dbContext,
                            ct);
                        if (changed)
                        {
                            participantAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                                .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id)
                                .OrderBy(x => x.RoundIndex)
                                .ThenByDescending(x => x.UpdatedUtc)
                                .ToListAsync(ct);
                            asyncState = BuildLiveAsyncParticipantState(
                                rounds,
                                participantAnswers,
                                participant.Id,
                                revisionMode,
                                dependencyEdges,
                                considerDependencies,
                                dependencyThreshold,
                                timerEvents,
                                participant.JoinedUtc,
                                session.StartedUtc,
                                flowRules,
                                now);
                        }
                    }
                    effectiveRoundIndex = Math.Max(0, Math.Min(asyncState.RoundIndex, rounds.Count));

                    if (!string.Equals(asyncState.Phase, "finished", StringComparison.Ordinal) &&
                        effectiveRoundIndex < rounds.Count)
                    {
                        var currentRound = rounds[effectiveRoundIndex];
                        var promptNode = CloneJsonObject(currentRound.Prompt);
                        var isRevealPhase = string.Equals(asyncState.Phase, "reveal", StringComparison.Ordinal);
                        var sessionElapsedSeconds = Math.Max(0d, asyncState.SessionElapsedSeconds);
                        var sessionTimerRemainingSeconds = flowRules.SessionTimerEnabled
                            ? Math.Max(0d, flowRules.SessionTimerSeconds - sessionElapsedSeconds)
                            : 0d;
                        var sessionTimerStartedUtc = now.AddSeconds(-sessionElapsedSeconds);
                        var sessionTimerEndsUtc = flowRules.SessionTimerEnabled
                            ? now.AddSeconds(sessionTimerRemainingSeconds)
                            : (DateTimeOffset?)null;
                        var roundElapsedSeconds = Math.Max(0d, asyncState.RoundElapsedSeconds);
                        var roundTimerStartedUtc = now.AddSeconds(-roundElapsedSeconds);
                        var roundTimerEndsUtc = asyncState.RoundEndsUtc;
                        promptNode["roundIndex"] = effectiveRoundIndex;
                        promptNode["cardKey"] = currentRound.CardKey;
                        promptNode["sessionTimerEnabled"] = flowRules.SessionTimerEnabled;
                        promptNode["sessionTimerSeconds"] = flowRules.SessionTimerSeconds;
                        promptNode["sessionTimerStartedUtc"] = sessionTimerStartedUtc.ToString("O", CultureInfo.InvariantCulture);
                        promptNode["sessionTimerEndsUtc"] = sessionTimerEndsUtc?.ToString("O", CultureInfo.InvariantCulture);
                        promptNode["roundTimerEnabled"] = flowRules.RoundTimerEnabled;
                        promptNode["roundTimerSeconds"] = flowRules.RoundTimerSeconds;
                        promptNode["roundTimerStartedUtc"] = roundTimerStartedUtc.ToString("O", CultureInfo.InvariantCulture);
                        promptNode["roundTimerEndsUtc"] = roundTimerEndsUtc?.ToString("O", CultureInfo.InvariantCulture);
                        promptNode["nextQuestionMode"] = flowRules.NextQuestionMode;
                        promptNode["nextQuestionSeconds"] = flowRules.NextQuestionSeconds;
                        promptNode["autoNextStartedUtc"] = asyncState.RevealStartedUtc?.ToString("O", CultureInfo.InvariantCulture);
                        promptNode["autoNextEndsUtc"] = asyncState.AutoNextEndsUtc?.ToString("O", CultureInfo.InvariantCulture);
                        promptNode["timerPaused"] = asyncState.TimerPaused;
                        promptNode["timerPauseSource"] = asyncState.TimerPauseSource;
                        promptNode["timerPauseStartedUtc"] = asyncState.TimerPauseStartedUtc?.ToString("O", CultureInfo.InvariantCulture);
                        promptNode["phase"] = asyncState.Phase;
                        currentPrompt = JsonNodeToJsonElement(promptNode);
                        answerSubmitted = asyncState.Answer is not null && asyncState.Answer.IsCorrect.HasValue;

                        if (isRevealPhase)
                        {
                            var revealNode = CloneJsonObject(currentRound.Reveal);
                            revealNode["roundIndex"] = effectiveRoundIndex;
                            revealNode["cardKey"] = currentRound.CardKey;
                            await AppendLiveRoundAnswerDistributionAsync(
                                session.Id,
                                effectiveRoundIndex,
                                currentRound.CardKey,
                                currentRound.Prompt,
                                revealNode,
                                dataProtectionProvider,
                                dbContext,
                                ct);
                            if (asyncState.Answer is not null && participantId.HasValue)
                            {
                                var computedScores = await ComputeLiveSessionScoresOnTheFlyAsync(session.Id, dbContext, ct);
                                var participantAnswer = ParseJsonNullable(
                                    UnprotectLiveSessionScopedJson(asyncState.Answer.AnswerJson, dataProtectionProvider, session.Id));
                                if (participantAnswer.HasValue)
                                {
                                    revealNode["participantAnswer"] = JsonNode.Parse(participantAnswer.Value.GetRawText());
                                }
                                var hasDetail = computedScores.DetailByRoundParticipant.TryGetValue(
                                    (effectiveRoundIndex, participantId.Value),
                                    out var detail);
                                var awardedPoints = hasDetail ? detail.Points : 0;
                                var answerDurationSeconds = Math.Max(
                                    0,
                                    (int)Math.Round((asyncState.Answer.UpdatedUtc - asyncState.RoundStartedUtc).TotalSeconds));
                                var participantScoring = BuildLiveRoundScoringNode(
                                    asyncState.Answer.IsCorrect == true,
                                    awardedPoints,
                                    answerDurationSeconds,
                                    hasDetail ? detail : null);
                                revealNode["roundScoring"] = new JsonObject
                                {
                                    [participantId.Value.ToString("D")] = participantScoring
                                };
                            }
                            currentReveal = JsonNodeToJsonElement(revealNode);
                        }
                    }
                    else if (string.Equals(session.Status, "running", StringComparison.Ordinal) ||
                             string.Equals(asyncState.Phase, "finished", StringComparison.Ordinal))
                    {
                        effectiveStatus = "finished";
                    }
                }

                return Results.Ok(new CogitaLiveRevisionPublicStateResponse(
                    session.Id,
                    meta.SessionMode,
                    meta.Title,
                    meta.ParticipantViewMode,
                    meta.SessionSettings,
                    effectiveStatus,
                    effectiveRoundIndex,
                    session.RevealVersion,
                    currentPrompt,
                    currentReveal,
                    scoreboard,
                    scoreHistory,
                    correctnessHistory,
                    answerSubmitted,
                    participantId,
                    participantName,
                    participantTokenIssued
                ));
            }

            if (participant is not null)
            {
                answerSubmitted = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                    .AnyAsync(x => x.SessionId == session.Id && x.ParticipantId == participant.Id && x.RoundIndex == session.CurrentRoundIndex, ct);
            }

            JsonElement? currentRevealPayload = ParseJsonNullable(session.CurrentRevealJson);
            var currentPromptPayload = ParseJsonNullable(session.CurrentPromptJson);
            JsonObject? syncRevealNode = null;
            if (currentRevealPayload.HasValue)
            {
                try
                {
                    syncRevealNode = JsonNode.Parse(currentRevealPayload.Value.GetRawText()) as JsonObject;
                    var promptNode = currentPromptPayload.HasValue
                        ? (JsonNode.Parse(currentPromptPayload.Value.GetRawText()) as JsonObject)
                        : null;
                    if (syncRevealNode is not null && promptNode is not null)
                    {
                        await AppendLiveRoundAnswerDistributionAsync(
                            session.Id,
                            session.CurrentRoundIndex,
                            promptNode["cardKey"]?.GetValue<string>()?.Trim(),
                            promptNode,
                            syncRevealNode,
                            dataProtectionProvider,
                            dbContext,
                            ct);
                        currentRevealPayload = JsonNodeToJsonElement(syncRevealNode);
                    }
                }
                catch
                {
                    syncRevealNode = null;
                }
            }
            if (participant is not null && currentRevealPayload.HasValue)
            {
                var computedScores = await ComputeLiveSessionScoresOnTheFlyAsync(session.Id, dbContext, ct);
                var answer = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                    .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id && x.RoundIndex == session.CurrentRoundIndex)
                    .OrderByDescending(x => x.UpdatedUtc)
                    .FirstOrDefaultAsync(ct);
                if (answer is not null)
                {
                    var awardedPoints = computedScores.DetailByRoundParticipant.TryGetValue((session.CurrentRoundIndex, participant.Id), out var detail)
                        ? detail.Points
                        : 0;
                    try
                    {
                        var revealNode = syncRevealNode ?? (JsonNode.Parse(currentRevealPayload.Value.GetRawText()) as JsonObject);
                        if (revealNode is not null)
                        {
                            var participantAnswer = ParseJsonNullable(
                                UnprotectLiveSessionScopedJson(answer.AnswerJson, dataProtectionProvider, session.Id));
                            if (participantAnswer.HasValue)
                            {
                                revealNode["participantAnswer"] = JsonNode.Parse(participantAnswer.Value.GetRawText());
                            }
                            if (answer.IsCorrect.HasValue || awardedPoints != 0)
                            {
                                var scoring = revealNode["roundScoring"] as JsonObject ?? new JsonObject();
                                var hasDetail = computedScores.DetailByRoundParticipant.TryGetValue(
                                    (session.CurrentRoundIndex, participant.Id),
                                    out var participantRoundDetail);
                                scoring[participant.Id.ToString("D")] = BuildLiveRoundScoringNode(
                                    answer.IsCorrect == true,
                                    awardedPoints,
                                    Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalSeconds)),
                                    hasDetail ? participantRoundDetail : null);
                                revealNode["roundScoring"] = scoring;
                            }
                            currentRevealPayload = JsonNodeToJsonElement(revealNode);
                        }
                    }
                    catch
                    {
                        // Keep original reveal payload on parse failures.
                    }
                }
            }

            return Results.Ok(new CogitaLiveRevisionPublicStateResponse(
                session.Id,
                meta.SessionMode,
                meta.Title,
                meta.ParticipantViewMode,
                meta.SessionSettings,
                session.Status,
                session.CurrentRoundIndex,
                session.RevealVersion,
                ParseJsonNullable(session.CurrentPromptJson),
                currentRevealPayload,
                scoreboard,
                scoreHistory,
                correctnessHistory,
                answerSubmitted,
                participantId,
                participantName,
                participantTokenIssued
            ));
        }).AllowAnonymous();

        group.MapGet("/public/live-revision/{code}/review", async (
            string code,
            string? participantToken,
            IDataProtectionProvider dataProtectionProvider,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var session = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var meta = ParseLiveSessionMeta(session.SessionMetaJson);
            var isAsyncSession = string.Equals(meta.SessionMode, "asynchronous", StringComparison.Ordinal);
            CogitaLiveRevisionParticipant? participant = null;
            if (!string.IsNullOrWhiteSpace(participantToken))
            {
                participant = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.JoinTokenHash == HashToken(participantToken), ct);
            }

            var canReadReview =
                string.Equals(session.Status, "finished", StringComparison.Ordinal) ||
                string.Equals(session.Status, "closed", StringComparison.Ordinal);
            if (!canReadReview &&
                isAsyncSession &&
                participant is not null)
            {
                var rounds = ParseLiveAsyncRoundBundle(session.CurrentPromptJson);
                if (rounds.Count > 0)
                {
                    var revisionMode = ParseLiveAsyncRevisionMode(session.CurrentPromptJson);
                    var (considerDependencies, dependencyThreshold) = ParseLiveAsyncDependencyOptions(session.CurrentPromptJson);
                    var dependencyEdges = considerDependencies
                        ? await BuildLiveAsyncDependencyEdgesAsync(session.LibraryId, rounds, dbContext, ct)
                        : new List<LiveAsyncDependencyEdge>();
                    var flowRules = ParseLiveSessionFlowRules(meta.SessionSettings);
                    var participantAnswersForPhase = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                        .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id)
                        .OrderBy(x => x.RoundIndex)
                        .ThenByDescending(x => x.UpdatedUtc)
                        .ToListAsync(ct);
                    var timerEvents = await LoadLiveAsyncTimerEventsAsync(session.Id, participant.Id, dbContext, ct);
                    var asyncState = BuildLiveAsyncParticipantState(
                        rounds,
                        participantAnswersForPhase,
                        participant.Id,
                        revisionMode,
                        dependencyEdges,
                        considerDependencies,
                        dependencyThreshold,
                        timerEvents,
                        participant.JoinedUtc,
                        session.StartedUtc,
                        flowRules,
                        DateTimeOffset.UtcNow);
                    canReadReview = string.Equals(asyncState.Phase, "finished", StringComparison.Ordinal);
                }
            }
            if (!canReadReview)
            {
                return Results.Ok(new List<CogitaLiveRevisionReviewRoundResponse>());
            }

            var asyncRounds = isAsyncSession
                ? ParseLiveAsyncRoundBundle(session.CurrentPromptJson)
                : new List<LiveAsyncRoundPayload>();
            var syncRounds = new List<LiveSyncRoundPayload>();
            if (!isAsyncSession)
            {
                var roundEvents = await dbContext.CogitaStatisticEvents.AsNoTracking()
                    .Where(x =>
                        x.SessionId == session.Id &&
                        x.RoundIndex.HasValue &&
                        (x.EventType == "live_round_published" || x.EventType == "live_round_revealed"))
                    .OrderBy(x => x.CreatedUtc)
                    .ToListAsync(ct);
                syncRounds = BuildLiveSyncRoundBundle(roundEvents, session.CurrentPromptJson, session.CurrentRevealJson, session.CurrentRoundIndex);
            }

            var inferredRoundMeta = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                .Where(x => x.SessionId == session.Id)
                .GroupBy(x => x.RoundIndex)
                .Select(group => new
                {
                    RoundIndex = group.Key,
                    CardKey = group
                        .OrderByDescending(x => x.UpdatedUtc)
                        .Select(x => x.CardKey)
                        .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))
                })
                .OrderBy(x => x.RoundIndex)
                .ToListAsync(ct);

            if (!isAsyncSession && inferredRoundMeta.Count > 0)
            {
                var existingRoundIndexes = syncRounds.Select(x => x.RoundIndex).ToHashSet();
                foreach (var inferred in inferredRoundMeta)
                {
                    if (existingRoundIndexes.Contains(inferred.RoundIndex))
                    {
                        continue;
                    }

                    var fallbackCardKey = string.IsNullOrWhiteSpace(inferred.CardKey)
                        ? $"round-{Math.Max(0, inferred.RoundIndex)}"
                        : inferred.CardKey.Trim();
                    var fallbackTitle = $"Round {Math.Max(0, inferred.RoundIndex) + 1}";
                    var fallbackPrompt = new JsonObject
                    {
                        ["kind"] = "text",
                        ["title"] = fallbackTitle,
                        ["prompt"] = fallbackCardKey,
                        ["cardKey"] = fallbackCardKey,
                        ["cardLabel"] = "reconstructed"
                    };
                    var fallbackReveal = new JsonObject
                    {
                        ["kind"] = "text",
                        ["expected"] = "",
                        ["title"] = fallbackTitle,
                        ["cardKey"] = fallbackCardKey,
                        ["reconstructed"] = true
                    };
                    syncRounds.Add(new LiveSyncRoundPayload(
                        Math.Max(0, inferred.RoundIndex),
                        fallbackCardKey,
                        CloneJsonObject(fallbackPrompt),
                        CloneJsonObject(fallbackReveal)));
                }
            }

            var answerByRound = new Dictionary<int, CogitaLiveRevisionAnswer>();
            if (participant is not null)
            {
                var answers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                    .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id)
                    .OrderByDescending(x => x.UpdatedUtc)
                    .ToListAsync(ct);
                answerByRound = answers
                    .GroupBy(x => x.RoundIndex)
                    .ToDictionary(x => x.Key, x => x.First());
            }

            var totalRounds = isAsyncSession ? asyncRounds.Count : syncRounds.Count;
            if (totalRounds == 0)
            {
                if (inferredRoundMeta.Count == 0)
                {
                    return Results.Ok(new List<CogitaLiveRevisionReviewRoundResponse>());
                }

                var fallbackRounds = inferredRoundMeta
                    .Select(inferred =>
                    {
                        var fallbackCardKey = string.IsNullOrWhiteSpace(inferred.CardKey)
                            ? $"round-{Math.Max(0, inferred.RoundIndex)}"
                            : inferred.CardKey.Trim();
                        var fallbackTitle = $"Round {Math.Max(0, inferred.RoundIndex) + 1}";
                        var promptNode = new JsonObject
                        {
                            ["kind"] = "text",
                            ["title"] = fallbackTitle,
                            ["prompt"] = fallbackCardKey,
                            ["cardKey"] = fallbackCardKey,
                            ["cardLabel"] = "reconstructed"
                        };
                        var revealNode = new JsonObject
                        {
                            ["kind"] = "text",
                            ["expected"] = "",
                            ["title"] = fallbackTitle,
                            ["cardKey"] = fallbackCardKey,
                            ["reconstructed"] = true
                        };
                        return new LiveSyncRoundPayload(
                            Math.Max(0, inferred.RoundIndex),
                            fallbackCardKey,
                            promptNode,
                            revealNode);
                    })
                    .OrderBy(x => x.RoundIndex)
                    .ToList();

                var fallbackResponse = new List<CogitaLiveRevisionReviewRoundResponse>(fallbackRounds.Count);
                var computedFallbackScores = await ComputeLiveSessionScoresOnTheFlyAsync(session.Id, dbContext, ct);
                foreach (var round in fallbackRounds)
                {
                    answerByRound.TryGetValue(round.RoundIndex, out var answer);
                    var participantAnswer = answer is null
                        ? null
                        : ParseJsonNullable(UnprotectLiveSessionScopedJson(answer.AnswerJson, dataProtectionProvider, session.Id));
                    var revealNode = CloneJsonObject(round.Reveal);
                    await AppendLiveRoundAnswerDistributionAsync(
                        session.Id,
                        round.RoundIndex,
                        round.CardKey,
                        round.Prompt,
                        revealNode,
                        dataProtectionProvider,
                        dbContext,
                        ct);
                    fallbackResponse.Add(new CogitaLiveRevisionReviewRoundResponse(
                        round.RoundIndex,
                        round.CardKey,
                        JsonNodeToJsonElement(round.Prompt) ?? default,
                        JsonNodeToJsonElement(revealNode) ?? default,
                        participantAnswer,
                        answer?.IsCorrect,
                        participant is not null &&
                        computedFallbackScores.DetailByRoundParticipant.TryGetValue((round.RoundIndex, participant.Id), out var fallbackDetail)
                            ? fallbackDetail.Points
                            : 0
                    ));
                }

                return Results.Ok(fallbackResponse);
            }

            var computedScores = await ComputeLiveSessionScoresOnTheFlyAsync(session.Id, dbContext, ct);
            var response = new List<CogitaLiveRevisionReviewRoundResponse>(totalRounds);

            if (isAsyncSession)
            {
                foreach (var round in asyncRounds.OrderBy(x => x.RoundIndex))
                {
                    var roundCardKey = string.IsNullOrWhiteSpace(round.CardKey)
                        ? $"round-{round.RoundIndex}"
                        : round.CardKey.Trim();
                    answerByRound.TryGetValue(round.RoundIndex, out var answer);
                    var participantAnswer = answer is null
                        ? null
                        : ParseJsonNullable(UnprotectLiveSessionScopedJson(answer.AnswerJson, dataProtectionProvider, session.Id));
                    var revealNode = CloneJsonObject(round.Reveal);
                    await AppendLiveRoundAnswerDistributionAsync(
                        session.Id,
                        round.RoundIndex,
                        roundCardKey,
                        round.Prompt,
                        revealNode,
                        dataProtectionProvider,
                        dbContext,
                        ct);
                    if (answer is not null && participant is not null)
                    {
                        var hasDetail = computedScores.DetailByRoundParticipant.TryGetValue((round.RoundIndex, participant.Id), out var detail);
                        var awardedPoints = hasDetail ? detail.Points : 0;
                        var roundScoring = revealNode["roundScoring"] as JsonObject ?? new JsonObject();
                        roundScoring[participant.Id.ToString("D")] = BuildLiveRoundScoringNode(
                            answer.IsCorrect == true,
                            awardedPoints,
                            Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalSeconds)),
                            hasDetail ? detail : null);
                        revealNode["roundScoring"] = roundScoring;
                    }
                    response.Add(new CogitaLiveRevisionReviewRoundResponse(
                        round.RoundIndex,
                        roundCardKey,
                        JsonNodeToJsonElement(round.Prompt) ?? default,
                        JsonNodeToJsonElement(revealNode) ?? default,
                        participantAnswer,
                        answer?.IsCorrect,
                        participant is not null &&
                        computedScores.DetailByRoundParticipant.TryGetValue((round.RoundIndex, participant.Id), out var reviewDetail)
                            ? reviewDetail.Points
                            : 0
                    ));
                }
            }
            else
            {
                foreach (var round in syncRounds.OrderBy(x => x.RoundIndex))
                {
                    var roundCardKey = string.IsNullOrWhiteSpace(round.CardKey)
                        ? $"round-{round.RoundIndex}"
                        : round.CardKey.Trim();
                    answerByRound.TryGetValue(round.RoundIndex, out var answer);
                    var participantAnswer = answer is null
                        ? null
                        : ParseJsonNullable(UnprotectLiveSessionScopedJson(answer.AnswerJson, dataProtectionProvider, session.Id));
                    var revealNode = CloneJsonObject(round.Reveal);
                    await AppendLiveRoundAnswerDistributionAsync(
                        session.Id,
                        round.RoundIndex,
                        roundCardKey,
                        round.Prompt,
                        revealNode,
                        dataProtectionProvider,
                        dbContext,
                        ct);
                    if (answer is not null && participant is not null)
                    {
                        var hasDetail = computedScores.DetailByRoundParticipant.TryGetValue((round.RoundIndex, participant.Id), out var detail);
                        var awardedPoints = hasDetail ? detail.Points : 0;
                        var roundScoring = revealNode["roundScoring"] as JsonObject ?? new JsonObject();
                        roundScoring[participant.Id.ToString("D")] = BuildLiveRoundScoringNode(
                            answer.IsCorrect == true,
                            awardedPoints,
                            Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalSeconds)),
                            hasDetail ? detail : null);
                        revealNode["roundScoring"] = roundScoring;
                    }
                    response.Add(new CogitaLiveRevisionReviewRoundResponse(
                        round.RoundIndex,
                        roundCardKey,
                        JsonNodeToJsonElement(round.Prompt) ?? default,
                        JsonNodeToJsonElement(revealNode) ?? default,
                        participantAnswer,
                        answer?.IsCorrect,
                        participant is not null &&
                        computedScores.DetailByRoundParticipant.TryGetValue((round.RoundIndex, participant.Id), out var reviewDetail)
                            ? reviewDetail.Points
                            : 0
                    ));
                }
            }

            return Results.Ok(response);
        }).AllowAnonymous();

        group.MapPost("/public/live-revision/{code}/answer", async (
            string code,
            CogitaLiveRevisionAnswerSubmitRequest request,
            IDataProtectionProvider dataProtectionProvider,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }
            if (session.Status != "running")
            {
                return Results.BadRequest(new { error = "Live session is not accepting answers." });
            }

            var participant = await dbContext.CogitaLiveRevisionParticipants
                .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.JoinTokenHash == HashToken(request.ParticipantToken), ct);
            if (participant is null)
            {
                return Results.Forbid();
            }

            var meta = ParseLiveSessionMeta(session.SessionMetaJson);
            var isAsyncSession = string.Equals(meta.SessionMode, "asynchronous", StringComparison.Ordinal);
            var now = DateTimeOffset.UtcNow;
            var roundIndex = session.CurrentRoundIndex;
            string? currentPromptCardKey;
            DateTimeOffset? asyncRoundStartedUtc = null;
            if (isAsyncSession)
            {
                var rounds = ParseLiveAsyncRoundBundle(session.CurrentPromptJson);
                var revisionMode = ParseLiveAsyncRevisionMode(session.CurrentPromptJson);
                var (considerDependencies, dependencyThreshold) = ParseLiveAsyncDependencyOptions(session.CurrentPromptJson);
                if (rounds.Count == 0)
                {
                    return Results.BadRequest(new { error = "Live session has no prepared rounds." });
                }
                var dependencyEdges = considerDependencies
                    ? await BuildLiveAsyncDependencyEdgesAsync(session.LibraryId, rounds, dbContext, ct)
                    : new List<LiveAsyncDependencyEdge>();

                var flowRules = ParseLiveSessionFlowRules(meta.SessionSettings);
                var participantAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                    .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id)
                    .OrderBy(x => x.RoundIndex)
                    .ThenByDescending(x => x.UpdatedUtc)
                    .ToListAsync(ct);
                var timerEvents = await LoadLiveAsyncTimerEventsAsync(session.Id, participant.Id, dbContext, ct);
                var asyncState = BuildLiveAsyncParticipantState(
                    rounds,
                    participantAnswers,
                    participant.Id,
                    revisionMode,
                    dependencyEdges,
                    considerDependencies,
                    dependencyThreshold,
                    timerEvents,
                    participant.JoinedUtc,
                    session.StartedUtc,
                    flowRules,
                    now);
                roundIndex = Math.Max(0, Math.Min(asyncState.RoundIndex, rounds.Count));
                if (roundIndex >= rounds.Count)
                {
                    return Results.BadRequest(new { error = "Participant completed this live session." });
                }

                if (request.RoundIndex != roundIndex)
                {
                    return Results.BadRequest(new { error = "Round index does not match participant progression." });
                }

                if (string.Equals(asyncState.Phase, "reveal", StringComparison.Ordinal))
                {
                    if (request.Answer.HasValue)
                    {
                        return Results.BadRequest(new { error = "Round answer already submitted." });
                    }

                    var acknowledgedAnswer = await dbContext.CogitaLiveRevisionAnswers
                        .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.ParticipantId == participant.Id && x.RoundIndex == roundIndex, ct);
                    if (acknowledgedAnswer is not null &&
                        acknowledgedAnswer.UpdatedUtc <= acknowledgedAnswer.SubmittedUtc)
                    {
                        acknowledgedAnswer.UpdatedUtc = now > acknowledgedAnswer.SubmittedUtc
                            ? now
                            : acknowledgedAnswer.SubmittedUtc.AddMilliseconds(1);
                    }

                    participant.IsConnected = true;
                    participant.UpdatedUtc = now;
                    session.UpdatedUtc = now;
                    await dbContext.SaveChangesAsync(ct);
                    return Results.Ok();
                }

                if (flowRules.SessionTimerEnabled &&
                    asyncState.SessionElapsedSeconds >= flowRules.SessionTimerSeconds)
                {
                    await MarkLiveAsyncUnansweredRoundsAsync(
                        session.Id,
                        session.LibraryId,
                        participant.Id,
                        rounds,
                        now,
                        dbContext,
                        ct);
                    return Results.BadRequest(new { error = "Live session timer expired." });
                }

                currentPromptCardKey = rounds[roundIndex].CardKey;
                asyncRoundStartedUtc = asyncState.RoundStartedUtc;
            }
            else
            {
                if (request.RoundIndex != session.CurrentRoundIndex)
                {
                    return Results.BadRequest(new { error = "Round index does not match current live round." });
                }
                currentPromptCardKey = ResolveCardIdentityFromPromptJson(session.CurrentPromptJson).CardKey;
            }

            var normalizedCardKey = string.IsNullOrWhiteSpace(currentPromptCardKey)
                ? (string.IsNullOrWhiteSpace(request.CardKey) ? null : request.CardKey.Trim())
                : currentPromptCardKey;
            if (!string.IsNullOrWhiteSpace(currentPromptCardKey) &&
                !string.IsNullOrWhiteSpace(request.CardKey) &&
                !string.Equals(request.CardKey.Trim(), currentPromptCardKey, StringComparison.Ordinal))
            {
                return Results.BadRequest(new { error = "Card key does not match current live prompt." });
            }
            var answerNode = request.Answer.HasValue
                ? JsonNode.Parse(request.Answer.Value.GetRawText())
                : null;
            var protectedAnswerJson = request.Answer.HasValue
                ? ProtectLiveSessionScopedJson(request.Answer.Value.GetRawText(), dataProtectionProvider, session.Id)
                : null;
            var answer = await dbContext.CogitaLiveRevisionAnswers
                .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.ParticipantId == participant.Id && x.RoundIndex == roundIndex, ct);
            if (answer is null)
            {
                answer = new CogitaLiveRevisionAnswer
                {
                    Id = Guid.NewGuid(),
                    SessionId = session.Id,
                    ParticipantId = participant.Id,
                    RoundIndex = roundIndex,
                    CardKey = normalizedCardKey,
                    AnswerJson = protectedAnswerJson,
                    IsCorrect = null,
                    SubmittedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaLiveRevisionAnswers.Add(answer);
            }
            else
            {
                if (isAsyncSession && answer.IsCorrect.HasValue)
                {
                    participant.IsConnected = true;
                    participant.UpdatedUtc = now;
                    session.UpdatedUtc = now;
                    await dbContext.SaveChangesAsync(ct);
                    return Results.Ok();
                }
                answer.CardKey = normalizedCardKey ?? answer.CardKey;
                answer.AnswerJson = protectedAnswerJson ?? answer.AnswerJson;
                answer.UpdatedUtc = now;
            }
            participant.IsConnected = true;
            participant.UpdatedUtc = now;
            string? scorePayloadJson = null;
            var computedPoints = 0;

            if (isAsyncSession)
            {
                var rounds = ParseLiveAsyncRoundBundle(session.CurrentPromptJson);
                if (roundIndex < 0 || roundIndex >= rounds.Count)
                {
                    return Results.BadRequest(new { error = "Unable to resolve async round." });
                }
                var currentRound = rounds[roundIndex];

                if (!EvaluateLiveAsyncAnswer(currentRound, answerNode, out var isCorrect, out _))
                {
                    return Results.BadRequest(new { error = "Unsupported prompt type for async scoring." });
                }

                var rules = ParseLiveSessionScoringRules(meta.SessionSettings);
                var participantHistory = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                    .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id && x.RoundIndex < roundIndex)
                    .OrderByDescending(x => x.RoundIndex)
                    .ThenByDescending(x => x.UpdatedUtc)
                    .ToListAsync(ct);
                var roundPeerAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                    .Where(x => x.SessionId == session.Id && x.RoundIndex == roundIndex && x.ParticipantId != participant.Id && x.IsCorrect.HasValue)
                    .OrderBy(x => x.SubmittedUtc)
                    .ThenBy(x => x.UpdatedUtc)
                    .ToListAsync(ct);
                var streakBefore = 0;
                foreach (var historyEntry in participantHistory)
                {
                    if (historyEntry.IsCorrect == true)
                    {
                        streakBefore += 1;
                        continue;
                    }
                    break;
                }
                var wrongStreakBefore = 0;
                foreach (var historyEntry in participantHistory)
                {
                    if (historyEntry.IsCorrect == false)
                    {
                        wrongStreakBefore += 1;
                        continue;
                    }
                    break;
                }

                var firstOverallParticipantId = roundPeerAnswers.FirstOrDefault()?.ParticipantId;
                var firstCorrectParticipantId = roundPeerAnswers.FirstOrDefault(x => x.IsCorrect == true)?.ParticipantId;
                var firstWrongParticipantId = roundPeerAnswers.FirstOrDefault(x => x.IsCorrect == false)?.ParticipantId;
                var isCurrentFirstOverall = firstOverallParticipantId is null;
                var isCurrentFirstCorrect = firstCorrectParticipantId is null && isCorrect;
                var isCurrentFirstWrong = firstWrongParticipantId is null && !isCorrect;

                var points = 0;
                var scoredBasePoints = 0;
                var scoredFirstBonusPoints = 0;
                var scoredSpeedPoints = 0;
                var scoredStreakPoints = 0;
                var scoredWrongPenaltyPoints = 0;
                var scoredFirstWrongPenaltyPoints = 0;
                var scoredWrongStreakPenaltyPoints = 0;
                var scoredWrongStreakCount = 0;
                var firstBonusApplies = rules.FirstCorrectBonus > 0 &&
                    (
                        (string.Equals(rules.FirstBonusMode, "first_answer", StringComparison.Ordinal) && isCurrentFirstOverall) ||
                        (string.Equals(rules.FirstBonusMode, "first_correct", StringComparison.Ordinal) && isCurrentFirstCorrect)
                    );
                if (firstBonusApplies)
                {
                    scoredFirstBonusPoints = Math.Max(0, Math.Min(500000, rules.FirstCorrectBonus));
                    points += scoredFirstBonusPoints;
                }
                if (isCorrect)
                {
                    var basePoints = Math.Max(0, Math.Min(500000, rules.BaseCorrect));
                    if (basePoints > 0)
                    {
                        points += basePoints;
                        scoredBasePoints = basePoints;
                    }

                    if (rules.BonusTimerEnabled &&
                        rules.SpeedBonusEnabled &&
                        rules.SpeedBonusMaxPoints > 0)
                    {
                        DateTimeOffset speedTimerStartUtc;
                        if (string.Equals(rules.BonusTimerStartMode, "first_answer", StringComparison.Ordinal))
                        {
                            speedTimerStartUtc = now;
                        }
                        else
                        {
                            var previousRoundAnswer = participantHistory.FirstOrDefault();
                            if (previousRoundAnswer is not null)
                            {
                                speedTimerStartUtc = previousRoundAnswer.UpdatedUtc;
                            }
                            else if (session.StartedUtc.HasValue)
                            {
                                speedTimerStartUtc = session.StartedUtc.Value;
                            }
                            else
                            {
                                speedTimerStartUtc = participant.JoinedUtc;
                            }
                        }

                        var speedTimerEndUtc = speedTimerStartUtc.AddSeconds(Math.Max(1, Math.Min(600, rules.BonusTimerSeconds)));
                        if (now <= speedTimerEndUtc)
                        {
                            var denominator = Math.Max(1d, (speedTimerEndUtc - speedTimerStartUtc).TotalMilliseconds);
                            var ratio = Math.Max(0d, Math.Min(1d, (speedTimerEndUtc - now).TotalMilliseconds / denominator));
                            var scaled = rules.SpeedBonusGrowth switch
                            {
                                "exponential" => ratio * ratio,
                                "limited" => Math.Min(1d, ratio * 1.6d),
                                _ => ratio
                            };
                            var speedPoints = (int)Math.Round(Math.Max(0, Math.Min(500000, rules.SpeedBonusMaxPoints * scaled)));
                            if (speedPoints > 0)
                            {
                                points += speedPoints;
                                scoredSpeedPoints += speedPoints;
                            }
                        }
                    }

                    var nextStreak = streakBefore + 1;
                    var streakPoints = ComputeAsyncStreakBonus(rules.StreakGrowth, rules.StreakBaseBonus, nextStreak, rules.StreakLimit);
                    if (streakPoints > 0)
                    {
                        points += streakPoints;
                        scoredStreakPoints += streakPoints;
                    }
                }
                else
                {
                    var wrongPenalty = Math.Max(0, Math.Min(500000, rules.WrongAnswerPenalty));
                    var firstWrongPenaltyApplies =
                        (string.Equals(rules.FirstWrongPenaltyMode, "first_overall_answer", StringComparison.Ordinal) && isCurrentFirstOverall) ||
                        (string.Equals(rules.FirstWrongPenaltyMode, "first_wrong", StringComparison.Ordinal) && isCurrentFirstWrong);
                    var firstWrongPenalty = firstWrongPenaltyApplies
                        ? Math.Max(0, Math.Min(500000, rules.FirstWrongPenalty))
                        : 0;
                    var wrongStreakCount = wrongStreakBefore + 1;
                    var wrongStreakPenalty = ComputeAsyncStreakBonus(
                        rules.WrongStreakGrowth,
                        rules.WrongStreakBasePenalty,
                        wrongStreakCount,
                        rules.WrongStreakLimit);
                    scoredWrongPenaltyPoints = wrongPenalty;
                    scoredFirstWrongPenaltyPoints = firstWrongPenalty;
                    scoredWrongStreakPenaltyPoints = wrongStreakPenalty;
                    scoredWrongStreakCount = wrongStreakCount;
                    points -= wrongPenalty + firstWrongPenalty + wrongStreakPenalty;
                }

                answer.IsCorrect = isCorrect;
                computedPoints = Math.Max(-500000, Math.Min(500000, points));
                answer.UpdatedUtc = now;
                participant.UpdatedUtc = now;
                session.UpdatedUtc = now;
                scorePayloadJson = JsonSerializer.Serialize(new
                {
                    basePoints = scoredBasePoints,
                    firstBonusPoints = scoredFirstBonusPoints,
                    speedPoints = scoredSpeedPoints,
                    streakPoints = scoredStreakPoints,
                    wrongPenaltyPoints = scoredWrongPenaltyPoints,
                    firstWrongPenaltyPoints = scoredFirstWrongPenaltyPoints,
                    wrongStreakPenaltyPoints = scoredWrongStreakPenaltyPoints,
                    wrongStreak = scoredWrongStreakCount
                });
            }

            var (itemType, itemId, checkType, direction) = ParseCardIdentityFromCardKey(answer.CardKey);
            var promptStartUtc = isAsyncSession
                ? asyncRoundStartedUtc
                : ResolvePromptStartUtc(session.CurrentPromptJson);
            var durationMs = promptStartUtc.HasValue
                ? (int?)Math.Max(0, (int)Math.Round((now - promptStartUtc.Value).TotalMilliseconds))
                : null;
            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
            {
                Id = Guid.NewGuid(),
                LibraryId = session.LibraryId,
                ScopeType = "live-session",
                ScopeId = session.Id,
                SourceType = "live-session",
                SessionId = session.Id,
                PersonRoleId = null,
                ParticipantId = participant.Id,
                ParticipantLabel = null,
                ItemType = itemType,
                ItemId = itemId,
                CheckType = checkType,
                Direction = direction,
                EventType = "live_answer_submitted",
                RoundIndex = roundIndex,
                CardKey = answer.CardKey,
                IsCorrect = isAsyncSession ? answer.IsCorrect : null,
                Correctness = isAsyncSession && answer.IsCorrect.HasValue ? (answer.IsCorrect.Value ? 1d : 0d) : null,
                PointsAwarded = null,
                DurationMs = durationMs,
                IsPersistent = false,
                PayloadJson = isAsyncSession ? scorePayloadJson : null,
                CreatedUtc = now
            });

            if (participant.UserId.HasValue &&
                participant.UserId.Value != Guid.Empty &&
                !string.IsNullOrWhiteSpace(itemType) &&
                itemId.HasValue)
            {
                var personRoleId = await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == participant.UserId.Value)
                    .Select(x => x.MasterRoleId)
                    .FirstOrDefaultAsync(ct);

                if (personRoleId != Guid.Empty)
                {
                    dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                    {
                        Id = Guid.NewGuid(),
                        LibraryId = session.LibraryId,
                        ScopeType = itemType!,
                        ScopeId = itemId.Value,
                        SourceType = "live-session-person",
                        SessionId = session.Id,
                        PersonRoleId = personRoleId,
                        ParticipantId = participant.Id,
                        ParticipantLabel = null,
                        ItemType = itemType,
                        ItemId = itemId,
                        CheckType = checkType,
                        Direction = direction,
                        EventType = "live_answer_submitted_personal",
                        RoundIndex = roundIndex,
                        CardKey = answer.CardKey,
                        IsCorrect = isAsyncSession ? answer.IsCorrect : null,
                        Correctness = isAsyncSession && answer.IsCorrect.HasValue ? (answer.IsCorrect.Value ? 1d : 0d) : null,
                        PointsAwarded = null,
                        DurationMs = durationMs,
                        IsPersistent = true,
                        PayloadJson = isAsyncSession ? scorePayloadJson : null,
                        CreatedUtc = now
                    });
                }
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        }).AllowAnonymous();

        group.MapPost("/public/live-revision/{code}/timer", async (
            string code,
            CogitaLiveRevisionTimerControlRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.ParticipantToken))
            {
                return Results.BadRequest(new { error = "Participant token is required." });
            }

            var action = request.Action?.Trim().ToLowerInvariant();
            if (action is not ("pause" or "resume"))
            {
                return Results.BadRequest(new { error = "Unsupported timer action." });
            }

            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (session.Status != "running")
            {
                return Results.BadRequest(new { error = "Live session is not accepting timer control." });
            }

            var participant = await dbContext.CogitaLiveRevisionParticipants
                .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.JoinTokenHash == HashToken(request.ParticipantToken), ct);
            if (participant is null)
            {
                return Results.Forbid();
            }

            var meta = ParseLiveSessionMeta(session.SessionMetaJson);
            if (!string.Equals(meta.SessionMode, "asynchronous", StringComparison.Ordinal))
            {
                return Results.BadRequest(new { error = "Timer control is available only in asynchronous sessions." });
            }

            var now = DateTimeOffset.UtcNow;
            var rounds = ParseLiveAsyncRoundBundle(session.CurrentPromptJson);
            var revisionMode = ParseLiveAsyncRevisionMode(session.CurrentPromptJson);
            var (considerDependencies, dependencyThreshold) = ParseLiveAsyncDependencyOptions(session.CurrentPromptJson);
            if (rounds.Count == 0)
            {
                return Results.BadRequest(new { error = "Live session has no prepared rounds." });
            }
            var dependencyEdges = considerDependencies
                ? await BuildLiveAsyncDependencyEdgesAsync(session.LibraryId, rounds, dbContext, ct)
                : new List<LiveAsyncDependencyEdge>();

            var flowRules = ParseLiveSessionFlowRules(meta.SessionSettings);
            var participantAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id)
                .OrderBy(x => x.RoundIndex)
                .ThenByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);
            var timerEvents = await LoadLiveAsyncTimerEventsAsync(session.Id, participant.Id, dbContext, ct);
            var asyncState = BuildLiveAsyncParticipantState(
                rounds,
                participantAnswers,
                participant.Id,
                revisionMode,
                dependencyEdges,
                considerDependencies,
                dependencyThreshold,
                timerEvents,
                participant.JoinedUtc,
                session.StartedUtc,
                flowRules,
                now);
            if (string.Equals(asyncState.Phase, "finished", StringComparison.Ordinal))
            {
                return Results.BadRequest(new { error = "Participant already finished this live session." });
            }

            var activeRoundIndex = Math.Max(0, Math.Min(asyncState.RoundIndex, rounds.Count - 1));
            if (request.RoundIndex.HasValue && request.RoundIndex.Value != activeRoundIndex)
            {
                return Results.BadRequest(new { error = "Round index does not match participant progression." });
            }

            var isCurrentlyPaused = asyncState.TimerPaused;
            var targetPaused = string.Equals(action, "pause", StringComparison.Ordinal);
            var source = request.Source?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(source))
            {
                source = "manual";
            }

            if (isCurrentlyPaused != targetPaused)
            {
                var payloadJson = JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["source"] = source
                });
                dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                {
                    Id = Guid.NewGuid(),
                    LibraryId = session.LibraryId,
                    ScopeType = "live-session",
                    ScopeId = session.Id,
                    SourceType = "live-session",
                    SessionId = session.Id,
                    PersonRoleId = null,
                    ParticipantId = participant.Id,
                    ParticipantLabel = null,
                    ItemType = null,
                    ItemId = null,
                    CheckType = null,
                    Direction = null,
                    EventType = targetPaused ? "live_async_timer_paused" : "live_async_timer_resumed",
                    RoundIndex = activeRoundIndex,
                    CardKey = null,
                    IsCorrect = null,
                    Correctness = null,
                    PointsAwarded = null,
                    DurationMs = null,
                    IsPersistent = false,
                    PayloadJson = payloadJson,
                    CreatedUtc = now
                });
            }

            participant.IsConnected = true;
            participant.UpdatedUtc = now;
            session.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { paused = targetPaused, roundIndex = activeRoundIndex, phase = asyncState.Phase });
        }).AllowAnonymous();

        group.MapPost("/public/live-revision/{code}/leave", async (
            string code,
            CogitaLiveRevisionLeaveRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.ParticipantToken))
            {
                return Results.BadRequest(new { error = "Participant token is required." });
            }

            var session = await dbContext.CogitaLiveRevisionSessions
                .FirstOrDefaultAsync(x => x.PublicCodeHash == HashToken(code), ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var participant = await dbContext.CogitaLiveRevisionParticipants
                .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.JoinTokenHash == HashToken(request.ParticipantToken), ct);
            if (participant is null)
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var paused = false;
            var roundIndex = request.RoundIndex.GetValueOrDefault(0);
            var phase = "lobby";
            var meta = ParseLiveSessionMeta(session.SessionMetaJson);
            if (string.Equals(meta.SessionMode, "asynchronous", StringComparison.Ordinal) &&
                string.Equals(session.Status, "running", StringComparison.Ordinal))
            {
                var rounds = ParseLiveAsyncRoundBundle(session.CurrentPromptJson);
                if (rounds.Count > 0)
                {
                    var revisionMode = ParseLiveAsyncRevisionMode(session.CurrentPromptJson);
                    var (considerDependencies, dependencyThreshold) = ParseLiveAsyncDependencyOptions(session.CurrentPromptJson);
                    var dependencyEdges = considerDependencies
                        ? await BuildLiveAsyncDependencyEdgesAsync(session.LibraryId, rounds, dbContext, ct)
                        : new List<LiveAsyncDependencyEdge>();
                    var flowRules = ParseLiveSessionFlowRules(meta.SessionSettings);
                    var participantAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                        .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id)
                        .OrderBy(x => x.RoundIndex)
                        .ThenByDescending(x => x.UpdatedUtc)
                        .ToListAsync(ct);
                    var timerEvents = await LoadLiveAsyncTimerEventsAsync(session.Id, participant.Id, dbContext, ct);
                    var asyncState = BuildLiveAsyncParticipantState(
                        rounds,
                        participantAnswers,
                        participant.Id,
                        revisionMode,
                        dependencyEdges,
                        considerDependencies,
                        dependencyThreshold,
                        timerEvents,
                        participant.JoinedUtc,
                        session.StartedUtc,
                        flowRules,
                        now);
                    phase = asyncState.Phase;
                    if (!string.Equals(asyncState.Phase, "finished", StringComparison.Ordinal))
                    {
                        roundIndex = asyncState.RoundIndex;
                        if (!asyncState.TimerPaused)
                        {
                            dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
                            {
                                Id = Guid.NewGuid(),
                                LibraryId = session.LibraryId,
                                ScopeType = "live-session",
                                ScopeId = session.Id,
                                SourceType = "live-session",
                                SessionId = session.Id,
                                ParticipantId = participant.Id,
                                ParticipantLabel = null,
                                EventType = "live_async_timer_paused",
                                RoundIndex = roundIndex,
                                IsPersistent = false,
                                PayloadJson = JsonSerializer.Serialize(new Dictionary<string, object?> { ["source"] = "leave" }),
                                CreatedUtc = now
                            });
                            paused = true;
                        }
                        else
                        {
                            paused = true;
                        }
                    }
                }
            }

            participant.IsConnected = false;
            participant.UpdatedUtc = now;
            session.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { left = true, paused, roundIndex, phase });
        }).AllowAnonymous();

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
            var revision = await dbContext.CogitaRevisions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == share.RevisionId && x.LibraryId == share.LibraryId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == revision.CollectionId && x.LibraryId == share.LibraryId && x.InfoType == "collection", ct);
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
            if (!string.IsNullOrWhiteSpace(revision.RevisionSettingsJson))
            {
                using var doc = JsonDocument.Parse(revision.RevisionSettingsJson);
                revisionSettingsElement = doc.RootElement.Clone();
            }

            return Results.Ok(new CogitaPublicRevisionShareResponse(
                share.Id,
                revision.Id,
                revision.Name,
                share.LibraryId,
                revision.CollectionId,
                collectionName,
                libraryName,
                revision.RevisionType,
                revisionSettingsElement,
                revision.Mode,
                revision.CheckMode,
                revision.CardLimit
            ));
        }).AllowAnonymous();

        group.MapGet("/public/storyboard/{code}", async (
            string code,
            RecreatioDbContext dbContext,
            IHashingService hashingService,
            CancellationToken ct) =>
        {
            if (!await HasCogitaStoryboardShareRuntimeSchemaAsync(dbContext, ct))
            {
                return Results.BadRequest(new { error = CogitaStoryboardShareSchemaError });
            }

            if (string.IsNullOrWhiteSpace(code))
            {
                return Results.NotFound();
            }

            code = code.Trim();
            if (code.Length < 6 || code.Length > 128)
            {
                return Results.NotFound();
            }

            var codeHash = hashingService.Hash(Encoding.UTF8.GetBytes(code));
            var share = await dbContext.CogitaStoryboardShares.AsNoTracking()
                .FirstOrDefaultAsync(x => x.PublicCodeHash == codeHash && x.RevokedUtc == null, ct);
            if (share is null)
            {
                return Results.NotFound();
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == share.LibraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            var project = await dbContext.CogitaCreationProjects.AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == share.ProjectId &&
                    x.LibraryId == share.LibraryId &&
                    x.ProjectType == "storyboard", ct);
            if (project is null)
            {
                return Results.NotFound();
            }

            var libraryName = "Cogita Library";

            return Results.Ok(new CogitaPublicStoryboardShareResponse(
                share.Id,
                project.Id,
                project.Name,
                library.Id,
                libraryName,
                ParseOptionalJson(project.ContentJson),
                share.CreatedUtc
            ));
        }).AllowAnonymous();

        group.MapGet("/public/revision/{code}/notions", async (
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

        group.MapGet("/public/revision/{code}/notions/{infoId:guid}", async (
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

            var linksJson = await LoadInfoLinksAsJsonAsync(share.LibraryId, info.Id, info.InfoType, dbContext, ct);
            return Results.Ok(new CogitaInfoDetailResponse(info.Id, info.InfoType, payloadJson, linksJson));
        }).AllowAnonymous();

        group.MapGet("/public/revision/{code}/dependencies", async (
            string code,
            string? key,
            RecreatioDbContext dbContext,
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

            var (share, _, _) = shareContext.Value;
            var activeGraphId = await ResolveActiveDependencyGraphIdAsync(share.LibraryId, dbContext, ct);
            var deps = await dbContext.CogitaItemDependencies.AsNoTracking()
                .Where(x => x.LibraryId == share.LibraryId &&
                            (x.GraphId == null || (activeGraphId.HasValue && x.GraphId == activeGraphId.Value)))
                .ToListAsync(ct);
            var response = deps
                .Select(x => new CogitaItemDependencyResponse(
                    x.ParentItemType,
                    x.ParentItemId,
                    x.ParentCheckType,
                    x.ParentDirection,
                    x.ChildItemType,
                    x.ChildItemId,
                    x.ChildCheckType,
                    x.ChildDirection))
                .ToList();

            return Results.Ok(new CogitaItemDependencyBundleResponse(response));
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
            var revision = await dbContext.CogitaRevisions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == share.RevisionId && x.LibraryId == share.LibraryId, ct);
            if (revision is null)
            {
                return Results.NotFound();
            }
            var collectionId = revision.CollectionId;

            var collectionInfo = await dbContext.CogitaInfos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == collectionId && x.LibraryId == share.LibraryId && x.InfoType == "collection", ct);
            if (collectionInfo is null)
            {
                return Results.NotFound();
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
                var quoteCountGraph = infoMeta.Count(x => x.InfoType == "citation");

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
                        graphResult.Total + translationCountGraph * 2 + quoteCountGraph,
                        pageSize,
                        nextCursor,
                        graphResponses));
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
            var quoteCount = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => x.CollectionInfoId == collectionId && x.ItemType == "info")
                .Join(dbContext.CogitaInfos.AsNoTracking(),
                    item => item.ItemId,
                    info => info.Id,
                    (item, info) => new { info.InfoType })
                .CountAsync(x => x.InfoType == "citation", ct);
            var totalCards = total + translationCount * 2 + quoteCount;

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

        group.MapGet("/libraries/{libraryId:guid}/dependency-graphs", async (
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

            var graphs = await dbContext.CogitaDependencyGraphs.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .OrderByDescending(x => x.IsActive)
                .ThenByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);
            if (graphs.Count == 0)
            {
                return Results.Ok(new CogitaDependencyGraphListResponse(new List<CogitaDependencyGraphSummaryResponse>()));
            }

            var graphIds = graphs.Select(x => x.Id).ToList();
            var nodeCounts = await dbContext.CogitaDependencyGraphNodes.AsNoTracking()
                .Where(x => graphIds.Contains(x.GraphId))
                .GroupBy(x => x.GraphId)
                .Select(g => new { GraphId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.GraphId, x => x.Count, ct);

            var response = graphs.Select(graph => new CogitaDependencyGraphSummaryResponse(
                graph.Id,
                string.IsNullOrWhiteSpace(graph.Name) ? "Dependency graph" : graph.Name,
                graph.IsActive,
                graph.UpdatedUtc,
                nodeCounts.TryGetValue(graph.Id, out var count) ? count : 0)).ToList();
            return Results.Ok(new CogitaDependencyGraphListResponse(response));
        });

        group.MapPost("/libraries/{libraryId:guid}/dependency-graphs", async (
            Guid libraryId,
            CogitaDependencyGraphCreateRequest request,
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

            var now = DateTimeOffset.UtcNow;
            (Guid DataKeyId, byte[] DataKey) keyResult;
            try
            {
                keyResult = await ResolveDataKeyAsync(
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
            }
            catch (InvalidOperationException)
            {
                return Results.BadRequest(new { error = "DataKeyId is invalid." });
            }

            var shouldActivate = !await dbContext.CogitaDependencyGraphs.AsNoTracking()
                .AnyAsync(x => x.LibraryId == libraryId && x.IsActive, ct);
            if (shouldActivate)
            {
                var existing = await dbContext.CogitaDependencyGraphs
                    .Where(x => x.LibraryId == libraryId && x.IsActive)
                    .ToListAsync(ct);
                foreach (var activeGraph in existing)
                {
                    activeGraph.IsActive = false;
                }
            }

            var graphName = string.IsNullOrWhiteSpace(request.Name) ? "Dependency graph" : request.Name.Trim();
            if (graphName.Length > 200)
            {
                graphName = graphName[..200];
            }
            var graphId = Guid.NewGuid();
            var graph = new CogitaDependencyGraph
            {
                Id = graphId,
                LibraryId = libraryId,
                Name = graphName,
                IsActive = shouldActivate,
                DataKeyId = keyResult.DataKeyId,
                EncryptedBlob = encryptionService.Encrypt(
                    keyResult.DataKey,
                    JsonSerializer.SerializeToUtf8Bytes(new { version = 1 }),
                    libraryId.ToByteArray()),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaDependencyGraphs.Add(graph);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaDependencyGraphSummaryResponse(
                graph.Id,
                graph.Name,
                graph.IsActive,
                graph.UpdatedUtc,
                0));
        });

        group.MapPut("/libraries/{libraryId:guid}/dependency-graphs/{graphId:guid}", async (
            Guid libraryId,
            Guid graphId,
            CogitaDependencyGraphUpdateRequest request,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaDependencyGraphs
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Id == graphId, ct);
            if (graph is null)
            {
                return Results.NotFound();
            }

            var graphName = string.IsNullOrWhiteSpace(request.Name) ? "Dependency graph" : request.Name.Trim();
            if (graphName.Length > 200)
            {
                graphName = graphName[..200];
            }

            graph.Name = graphName;
            graph.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            var nodeCount = await dbContext.CogitaDependencyGraphNodes.AsNoTracking()
                .CountAsync(x => x.GraphId == graph.Id, ct);

            return Results.Ok(new CogitaDependencyGraphSummaryResponse(
                graph.Id,
                graph.Name,
                graph.IsActive,
                graph.UpdatedUtc,
                nodeCount));
        });

        group.MapPost("/libraries/{libraryId:guid}/dependency-graphs/{graphId:guid}/activate", async (
            Guid libraryId,
            Guid graphId,
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

            var graphs = await dbContext.CogitaDependencyGraphs
                .Where(x => x.LibraryId == libraryId)
                .ToListAsync(ct);
            var target = graphs.FirstOrDefault(x => x.Id == graphId);
            if (target is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            foreach (var graph in graphs)
            {
                graph.IsActive = graph.Id == graphId;
                if (graph.Id == graphId)
                {
                    graph.UpdatedUtc = now;
                }
            }
            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapDelete("/libraries/{libraryId:guid}/dependency-graphs/{graphId:guid}", async (
            Guid libraryId,
            Guid graphId,
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

            if (!keyRing.TryGetWriteKey(library.RoleId, out _))
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaDependencyGraphs
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Id == graphId, ct);
            if (graph is null)
            {
                return Results.NotFound();
            }

            var nodes = await dbContext.CogitaDependencyGraphNodes
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);
            var edges = await dbContext.CogitaDependencyGraphEdges
                .Where(x => x.GraphId == graph.Id)
                .ToListAsync(ct);
            var dependencies = await dbContext.CogitaItemDependencies
                .Where(x => x.LibraryId == libraryId && x.GraphId == graph.Id)
                .ToListAsync(ct);

            if (dependencies.Count > 0)
            {
                dbContext.CogitaItemDependencies.RemoveRange(dependencies);
            }
            if (edges.Count > 0)
            {
                dbContext.CogitaDependencyGraphEdges.RemoveRange(edges);
            }
            if (nodes.Count > 0)
            {
                dbContext.CogitaDependencyGraphNodes.RemoveRange(nodes);
            }

            dbContext.CogitaDependencyGraphs.Remove(graph);

            if (graph.IsActive)
            {
                var fallback = await dbContext.CogitaDependencyGraphs
                    .Where(x => x.LibraryId == libraryId && x.Id != graph.Id)
                    .OrderByDescending(x => x.UpdatedUtc)
                    .FirstOrDefaultAsync(ct);
                if (fallback is not null)
                {
                    fallback.IsActive = true;
                    fallback.UpdatedUtc = DateTimeOffset.UtcNow;
                }
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        group.MapGet("/libraries/{libraryId:guid}/dependency-graph", async (
            Guid libraryId,
            Guid? graphId,
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

            var graph = graphId.HasValue
                ? await dbContext.CogitaDependencyGraphs.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Id == graphId.Value, ct)
                : await dbContext.CogitaDependencyGraphs.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId)
                    .OrderByDescending(x => x.IsActive)
                    .ThenByDescending(x => x.UpdatedUtc)
                    .FirstOrDefaultAsync(ct);

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
            Guid? graphId,
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

            CogitaDependencyGraph? graph;
            if (graphId.HasValue)
            {
                graph = await dbContext.CogitaDependencyGraphs.FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Id == graphId.Value, ct);
                if (graph is null)
                {
                    return Results.NotFound();
                }
            }
            else
            {
                graph = await dbContext.CogitaDependencyGraphs
                    .Where(x => x.LibraryId == libraryId)
                    .OrderByDescending(x => x.IsActive)
                    .ThenByDescending(x => x.UpdatedUtc)
                    .FirstOrDefaultAsync(ct);
            }
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
                    Name = "Dependency graph",
                    IsActive = true,
                    DataKeyId = dataKeyId,
                    EncryptedBlob = encryptionService.Encrypt(dataKey, JsonSerializer.SerializeToUtf8Bytes(new { version = 1 }), libraryId.ToByteArray()),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaDependencyGraphs.Add(graph);
                var currentlyActive = await dbContext.CogitaDependencyGraphs
                    .Where(x => x.LibraryId == libraryId && x.IsActive)
                    .ToListAsync(ct);
                foreach (var active in currentlyActive)
                {
                    active.IsActive = false;
                }
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

            var nodePayloadById = request.Nodes
                .Where(node => node.NodeId.HasValue)
                .ToDictionary(node => node.NodeId!.Value, node => node.Payload);
            var dependencies = new List<CogitaItemDependency>();
            foreach (var edge in request.Edges)
            {
                if (!nodePayloadById.TryGetValue(edge.FromNodeId, out var fromPayload) ||
                    !nodePayloadById.TryGetValue(edge.ToNodeId, out var toPayload))
                {
                    continue;
                }
                if (!fromPayload.TryGetProperty("itemType", out var fromTypeEl) ||
                    !toPayload.TryGetProperty("itemType", out var toTypeEl) ||
                    fromTypeEl.ValueKind != JsonValueKind.String ||
                    toTypeEl.ValueKind != JsonValueKind.String)
                {
                    continue;
                }
                if (!fromPayload.TryGetProperty("itemId", out var fromIdEl) ||
                    !toPayload.TryGetProperty("itemId", out var toIdEl) ||
                    fromIdEl.ValueKind != JsonValueKind.String ||
                    toIdEl.ValueKind != JsonValueKind.String ||
                    !Guid.TryParse(fromIdEl.GetString(), out var fromId) ||
                    !Guid.TryParse(toIdEl.GetString(), out var toId))
                {
                    continue;
                }
                var parentType = fromTypeEl.GetString() ?? "info";
                var childType = toTypeEl.GetString() ?? "info";
                string? parentCheckType = null;
                if (fromPayload.TryGetProperty("checkType", out var fromCheckTypeEl) && fromCheckTypeEl.ValueKind == JsonValueKind.String)
                {
                    var value = fromCheckTypeEl.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        parentCheckType = value.ToLowerInvariant();
                    }
                }
                string? parentDirection = null;
                if (fromPayload.TryGetProperty("direction", out var fromDirectionEl) && fromDirectionEl.ValueKind == JsonValueKind.String)
                {
                    var value = fromDirectionEl.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        parentDirection = value.ToLowerInvariant();
                    }
                }
                string? childCheckType = null;
                if (toPayload.TryGetProperty("checkType", out var toCheckTypeEl) && toCheckTypeEl.ValueKind == JsonValueKind.String)
                {
                    var value = toCheckTypeEl.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        childCheckType = value.ToLowerInvariant();
                    }
                }
                string? childDirection = null;
                if (toPayload.TryGetProperty("direction", out var toDirectionEl) && toDirectionEl.ValueKind == JsonValueKind.String)
                {
                    var value = toDirectionEl.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        childDirection = value.ToLowerInvariant();
                    }
                }
                dependencies.Add(new CogitaItemDependency
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    GraphId = graph.Id,
                    ParentItemType = parentType,
                    ParentItemId = fromId,
                    ParentCheckType = parentCheckType,
                    ParentDirection = parentDirection,
                    ChildItemType = childType,
                    ChildItemId = toId,
                    ChildCheckType = childCheckType,
                    ChildDirection = childDirection,
                    LinkHash = BuildDependencyLinkHash(
                        libraryId,
                        parentType,
                        fromId,
                        parentCheckType,
                        parentDirection,
                        childType,
                        toId,
                        childCheckType,
                        childDirection),
                    CreatedUtc = now
                });
            }

            var existingDeps = await dbContext.CogitaItemDependencies
                .Where(x => x.LibraryId == libraryId && x.GraphId == graph.Id)
                .ToListAsync(ct);
            dbContext.CogitaItemDependencies.RemoveRange(existingDeps);
            if (dependencies.Count > 0)
            {
                dbContext.CogitaItemDependencies.AddRange(dependencies);
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaDependencyGraphResponse(graph.Id, responseNodes, responseEdges));
        });

        group.MapPost("/libraries/{libraryId:guid}/dependency-graph/preview", async (
            Guid libraryId,
            Guid? graphId,
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

            var graph = graphId.HasValue
                ? await dbContext.CogitaDependencyGraphs.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Id == graphId.Value, ct)
                : await dbContext.CogitaDependencyGraphs.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId)
                    .OrderByDescending(x => x.IsActive)
                    .ThenByDescending(x => x.UpdatedUtc)
                    .FirstOrDefaultAsync(ct);
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
            var infoIds = new HashSet<Guid>();
            foreach (var node in nodes)
            {
                try
                {
                    var plain = encryptionService.Decrypt(dataKey, node.EncryptedBlob, node.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    if (doc.RootElement.TryGetProperty("itemType", out var typeEl) && typeEl.ValueKind == JsonValueKind.String &&
                        doc.RootElement.TryGetProperty("itemId", out var idEl) && idEl.ValueKind == JsonValueKind.String &&
                        Guid.TryParse(idEl.GetString(), out var itemId))
                    {
                        var itemType = typeEl.GetString() ?? "info";
                        if (itemType == "collection")
                        {
                            collectionIds.Add(itemId);
                        }
                        else
                        {
                            infoIds.Add(itemId);
                        }
                    }
                }
                catch (CryptographicException)
                {
                    continue;
                }
            }

            return Results.Ok(new CogitaDependencyGraphPreviewResponse(collectionIds.Count + infoIds.Count, collectionIds.Concat(infoIds).ToList()));
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

                    var infoResponsesGraph = new Dictionary<Guid, List<CogitaCardSearchResponse>>();
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
                            infoResponsesGraph[entry.InfoId] = BuildInfoCardResponses(entry.InfoId, entry.InfoType, label, description, doc.RootElement.Clone());
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
                                orderedResponsesGraph.AddRange(response);
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
                        graphResult.Total + translationCountGraph * 2 + infoMeta.Count(x => x.InfoType == "citation"),
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
            var quoteCount = await dbContext.CogitaCollectionItems.AsNoTracking()
                .Where(x => x.CollectionInfoId == collectionId && x.ItemType == "info")
                .Join(dbContext.CogitaInfos.AsNoTracking(),
                    item => item.ItemId,
                    info => info.Id,
                    (item, info) => new { info.InfoType })
                .CountAsync(x => x.InfoType == "citation", ct);
            var totalCards = total + translationCount * 2 + quoteCount;

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

            var infoResponses = new Dictionary<Guid, List<CogitaCardSearchResponse>>();

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

                        infoResponses[entry.InfoId] = BuildInfoCardResponses(entry.InfoId, entry.InfoType, label, description, doc.RootElement.Clone());
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
                        orderedResponses.AddRange(response);
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
                    try
                    {
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
                    }
                    catch (InvalidOperationException)
                    {
                        continue;
                    }
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
                    if (connectionType == "word-language" && mappedIds.Distinct().Count() != 2)
                    {
                        continue;
                    }

                    connectionKeyMap.TryGetValue(connectionType, out var connectionKeyId);
                    try
                    {
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
                    }
                    catch (InvalidOperationException)
                    {
                        continue;
                    }
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
                    processedInfos++;
                    try
                    {
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
                    }
                    catch (InvalidOperationException)
                    {
                        continue;
                    }
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
                    if (connectionType == "word-language" && mappedIds.Distinct().Count() != 2)
                    {
                        processedConnections++;
                        continue;
                    }

                    connectionKeyMap.TryGetValue(connectionType, out var connectionKeyId);
                    processedConnections++;
                    try
                    {
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
                    }
                    catch (InvalidOperationException)
                    {
                        continue;
                    }
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

        group.MapPost("/libraries/{libraryId:guid}/notions", async (
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

            var sanitizedPayload = SanitizePayloadForInfoType(infoType, request.Payload);
            var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(sanitizedPayload);
            var encrypted = encryptionService.Encrypt(dataKeyResult.DataKey, payloadBytes, infoId.ToByteArray());

            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

            dbContext.CogitaInfos.Add(new CogitaInfo
            {
                Id = infoId,
                LibraryId = libraryId,
                InfoType = infoType,
                CreatedUtc = now,
                UpdatedUtc = now
            });

            AddInfoPayload(infoType, infoId, dataKeyResult.DataKeyId, encrypted, now, dbContext);

            try
            {
                await dbContext.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (LooksLikeUnsupportedInfoTypeSchema(ex, infoType))
            {
                return Results.BadRequest(new
                {
                    error = $"Database schema does not support info type '{infoType}' yet. Apply backend/Recreatio.Api/Sql/schema.sql on the API database."
                });
            }

            await UpsertInfoSearchIndexAsync(libraryId, infoId, infoType, sanitizedPayload, now, dbContext, ct);

            try
            {
                await UpsertInfoLinksAsync(
                    libraryId,
                    infoId,
                    infoType,
                    request.Links,
                    now,
                    dbContext,
                    ct);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }

            try
            {
                await dbContext.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsMissingInfoLinksSchema(ex))
            {
                return Results.BadRequest(new
                {
                    error = "Database schema for Cogita links is outdated. Apply backend/Recreatio.Api/Sql/schema.sql (CogitaKnowledgeLinkSingles/CogitaKnowledgeLinkMultis)."
                });
            }
            catch (DbUpdateException ex) when (LooksLikeUnsupportedInfoTypeSchema(ex, infoType))
            {
                return Results.BadRequest(new
                {
                    error = $"Database schema does not support info type '{infoType}' yet. Apply backend/Recreatio.Api/Sql/schema.sql on the API database."
                });
            }

            await transaction.CommitAsync(ct);

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
            var reviewEvents = await dbContext.CogitaReviewEvents
                .Where(x => x.LibraryId == libraryId && x.ItemType == "connection" && x.ItemId == connectionId)
                .ToListAsync(ct);
            if (reviewEvents.Count > 0)
            {
                dbContext.CogitaReviewEvents.RemoveRange(reviewEvents);
            }
            var statisticEvents = await dbContext.CogitaStatisticEvents
                .Where(x => x.LibraryId == libraryId && x.ItemType == "connection" && x.ItemId == connectionId)
                .ToListAsync(ct);
            if (statisticEvents.Count > 0)
            {
                dbContext.CogitaStatisticEvents.RemoveRange(statisticEvents);
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

    }

    private static string? ResolveLabel(JsonElement payload, string infoType)
    {
        if (payload.ValueKind == JsonValueKind.Object)
        {
            if (payload.TryGetProperty("definition", out var definition) &&
                definition.ValueKind == JsonValueKind.Object)
            {
                if (definition.TryGetProperty("title", out var nestedTitle) &&
                    nestedTitle.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(nestedTitle.GetString()))
                {
                    return nestedTitle.GetString();
                }
                if (definition.TryGetProperty("question", out var nestedQuestion) &&
                    nestedQuestion.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(nestedQuestion.GetString()))
                {
                    return nestedQuestion.GetString();
                }
            }
            if ((infoType == "citation") &&
                payload.TryGetProperty("title", out var quoteTitle) &&
                quoteTitle.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(quoteTitle.GetString()))
            {
                return quoteTitle.GetString();
            }
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
            if (payload.TryGetProperty("definition", out var definition) &&
                definition.ValueKind == JsonValueKind.Object)
            {
                if (definition.TryGetProperty("question", out var nestedQuestion) &&
                    nestedQuestion.ValueKind == JsonValueKind.String)
                {
                    return nestedQuestion.GetString();
                }
                if (definition.TryGetProperty("kind", out var nestedKind) &&
                    nestedKind.ValueKind == JsonValueKind.String)
                {
                    return nestedKind.GetString();
                }
            }
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

    private static JsonElement SanitizePayloadForInfoType(string infoType, JsonElement payload)
    {
        if (infoType == "computed")
        {
            return SanitizeComputedPayload(payload);
        }

        if (payload.ValueKind != JsonValueKind.Object)
        {
            return payload;
        }

        if (infoType == "work" || infoType == "orcid")
        {
            var node = JsonNode.Parse(payload.GetRawText()) as JsonObject;
            if (node is null)
            {
                return payload;
            }

            if (infoType == "work")
            {
                var doiValue = node["doi"]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(doiValue))
                {
                    node["doi"] = NormalizeDoi(doiValue);
                }
            }

            if (infoType == "orcid")
            {
                var orcidValue = node["orcid"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(orcidValue))
                {
                    orcidValue = node["label"]?.GetValue<string>();
                }

                if (!string.IsNullOrWhiteSpace(orcidValue))
                {
                    var normalized = NormalizeOrcid(orcidValue);
                    if (node.ContainsKey("orcid"))
                    {
                        node["orcid"] = normalized;
                    }
                    if (node.ContainsKey("label"))
                    {
                        node["label"] = normalized;
                    }
                }
            }

            return JsonSerializer.Deserialize<JsonElement>(node.ToJsonString());
        }

        return payload;
    }

    private static string NormalizeDoi(string doi)
    {
        var trimmed = doi.Trim();
        if (trimmed.StartsWith("https://doi.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["https://doi.org/".Length..];
        }
        else if (trimmed.StartsWith("http://doi.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["http://doi.org/".Length..];
        }
        else if (trimmed.StartsWith("doi:", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["doi:".Length..];
        }

        trimmed = trimmed.Trim();
        return trimmed.ToLowerInvariant();
    }

    private static string NormalizeOrcid(string orcid)
    {
        var trimmed = orcid.Trim();
        if (trimmed.StartsWith("https://orcid.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["https://orcid.org/".Length..];
        }
        else if (trimmed.StartsWith("http://orcid.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["http://orcid.org/".Length..];
        }
        else if (trimmed.StartsWith("orcid:", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["orcid:".Length..];
        }

        trimmed = trimmed.Replace(" ", string.Empty).Replace("-", string.Empty).ToUpperInvariant();
        if (trimmed.Length == 16)
        {
            return $"{trimmed[..4]}-{trimmed.Substring(4, 4)}-{trimmed.Substring(8, 4)}-{trimmed.Substring(12, 4)}";
        }

        return trimmed;
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
        if (CogitaTypeRegistry.ComputedBackedInfoTypes.Contains(info.InfoType))
        {
            var computedRow = await dbContext.CogitaComputedInfos.AsNoTracking()
                .Where(x => x.InfoId == info.Id)
                .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                .FirstOrDefaultAsync(ct);
            return computedRow is null ? null : (computedRow.DataKeyId, computedRow.EncryptedBlob);
        }

        switch (info.InfoType)
        {
            case "question":
                {
                    var row = await dbContext.CogitaQuestions.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
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
            case "institution":
                {
                    var row = await dbContext.CogitaInstitutions.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "collective":
                {
                    var row = await dbContext.CogitaCollectives.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "orcid":
                {
                    var row = await dbContext.CogitaOrcids.AsNoTracking()
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
            case "media":
                {
                    var row = await dbContext.CogitaMedia.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "work":
                {
                    var row = await dbContext.CogitaWorks.AsNoTracking()
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
            case "source":
                {
                    var row = await dbContext.CogitaSources.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            case "citation":
                {
                    var row = await dbContext.CogitaQuotes.AsNoTracking()
                        .Where(x => x.InfoId == info.Id)
                        .Select(x => new { x.DataKeyId, x.EncryptedBlob })
                        .FirstOrDefaultAsync(ct);
                    return row is null ? null : (row.DataKeyId, row.EncryptedBlob);
                }
            default:
                return null;
        }
    }

    private static Dictionary<string, List<Guid>> ParseInfoLinks(JsonElement? linksElement)
    {
        var result = new Dictionary<string, List<Guid>>(StringComparer.OrdinalIgnoreCase);
        if (!linksElement.HasValue)
        {
            return result;
        }

        var root = linksElement.Value;
        if (root.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return result;
        }

        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("Links must be an object.");
        }

        foreach (var property in root.EnumerateObject())
        {
            var key = property.Name.Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var values = new List<Guid>();
            if (property.Value.ValueKind == JsonValueKind.String)
            {
                if (Guid.TryParse(property.Value.GetString(), out var id))
                {
                    values.Add(id);
                }
                else
                {
                    throw new InvalidOperationException($"Link '{key}' has an invalid GUID value.");
                }
            }
            else if (property.Value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in property.Value.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.String || !Guid.TryParse(item.GetString(), out var id))
                    {
                        throw new InvalidOperationException($"Link '{key}' contains an invalid GUID.");
                    }
                    values.Add(id);
                }
            }
            else if (property.Value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined)
            {
                throw new InvalidOperationException($"Link '{key}' must be null, GUID string or array of GUID strings.");
            }

            result[key] = values.Distinct().ToList();
        }

        return result;
    }

    private static async Task UpsertInfoLinksAsync(
        Guid libraryId,
        Guid infoId,
        string infoType,
        JsonElement? linksElement,
        DateTimeOffset now,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (linksElement is null || linksElement.Value.ValueKind is JsonValueKind.Undefined)
        {
            return;
        }

        var editorDescriptor = CogitaTypeRegistry.GetEditorDescriptor(infoType);
        var fieldSpecs = editorDescriptor?.LinkFields ?? Array.Empty<CogitaTypeRegistry.LinkFieldDisplayDescriptor>();
        var fieldByKey = fieldSpecs.ToDictionary(x => x.Key, x => x, StringComparer.OrdinalIgnoreCase);
        var parsed = ParseInfoLinks(linksElement);

        foreach (var key in parsed.Keys)
        {
            if (!fieldByKey.ContainsKey(key))
            {
                throw new InvalidOperationException($"Link field '{key}' is not supported for info type '{infoType}'.");
            }
        }

        var allTargetIds = parsed.Values.SelectMany(x => x).Distinct().ToList();
        var targetTypes = allTargetIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && allTargetIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.InfoType, ct);

        foreach (var field in fieldSpecs)
        {
            parsed.TryGetValue(field.Key, out var values);
            values ??= new List<Guid>();

            if (!field.Multiple && values.Count > 1)
            {
                throw new InvalidOperationException($"Link field '{field.Key}' accepts only one value.");
            }
            if (field.Required && values.Count == 0)
            {
                throw new InvalidOperationException($"Link field '{field.Key}' is required.");
            }

            foreach (var targetId in values)
            {
                if (!targetTypes.TryGetValue(targetId, out var targetType))
                {
                    throw new InvalidOperationException($"Linked target '{targetId}' is not part of the selected library.");
                }
                if (!field.TargetTypes.Contains(targetType, StringComparer.Ordinal))
                {
                    throw new InvalidOperationException($"Linked target '{targetId}' has invalid type '{targetType}' for field '{field.Key}'.");
                }
            }
        }

        try
        {
            var existingSingles = await dbContext.CogitaKnowledgeLinkSinglesCore
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == infoId)
                .ToListAsync(ct);
            if (existingSingles.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkSinglesCore.RemoveRange(existingSingles);
            }

            var existingMultis = await dbContext.CogitaKnowledgeLinkMultisCore
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == infoId)
                .ToListAsync(ct);
            if (existingMultis.Count > 0)
            {
                dbContext.CogitaKnowledgeLinkMultisCore.RemoveRange(existingMultis);
            }

            var existingReferenceFields = await dbContext.CogitaReferenceCryptoFields
                .Where(x => x.LibraryId == libraryId && x.OwnerEntity == "knowledge-item" && x.OwnerId == infoId)
                .ToListAsync(ct);
            if (existingReferenceFields.Count > 0)
            {
                dbContext.CogitaReferenceCryptoFields.RemoveRange(existingReferenceFields);
            }

            foreach (var field in fieldSpecs)
            {
                parsed.TryGetValue(field.Key, out var values);
                values ??= new List<Guid>();
                if (values.Count == 0)
                {
                    continue;
                }

                if (field.Multiple)
                {
                    for (var i = 0; i < values.Count; i++)
                    {
                        dbContext.CogitaKnowledgeLinkMultisCore.Add(new CogitaKnowledgeLinkMultiCore
                        {
                            Id = Guid.NewGuid(),
                            LibraryId = libraryId,
                            SourceItemId = infoId,
                            FieldKey = field.Key,
                            TargetItemId = values[i],
                            SortOrder = i,
                            CreatedUtc = now,
                            UpdatedUtc = now
                        });
                    }
                }
                else
                {
                    dbContext.CogitaKnowledgeLinkSinglesCore.Add(new CogitaKnowledgeLinkSingleCore
                    {
                        Id = Guid.NewGuid(),
                        LibraryId = libraryId,
                        SourceItemId = infoId,
                        FieldKey = field.Key,
                        TargetItemId = values[0],
                        IsRequired = field.Required,
                        CreatedUtc = now,
                        UpdatedUtc = now
                    });
                }

                var normalizedFieldKey = field.Key.Trim().ToLowerInvariant();
                var normalizedValue = values.Count == 1
                    ? values[0].ToString("D")
                    : string.Join(",", values.Select(x => x.ToString("D")));
                var scopedHashInput = $"{libraryId:D}:{normalizedFieldKey}:{normalizedValue}";
                dbContext.CogitaReferenceCryptoFields.Add(new CogitaReferenceCryptoField
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    OwnerEntity = "knowledge-item",
                    OwnerId = infoId,
                    FieldKey = normalizedFieldKey,
                    PolicyVersion = "v1",
                    ValueCipher = Convert.ToBase64String(Encoding.UTF8.GetBytes(normalizedValue)),
                    DeterministicHash = SHA256.HashData(Encoding.UTF8.GetBytes(scopedHashInput)),
                    SignatureBase64 = null,
                    Signer = null,
                    SignatureVersion = null,
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
            }
        }
        catch (Exception ex) when (IsMissingInfoLinksSchema(ex))
        {
            // Keep create/update flow operational on environments that have not yet applied link-table schema.
            return;
        }

    }

    private static async Task<JsonElement> LoadInfoLinksAsJsonAsync(
        Guid libraryId,
        Guid infoId,
        string infoType,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var editorDescriptor = CogitaTypeRegistry.GetEditorDescriptor(infoType);
        var fieldSpecs = editorDescriptor?.LinkFields ?? Array.Empty<CogitaTypeRegistry.LinkFieldDisplayDescriptor>();
        if (fieldSpecs.Count == 0)
        {
            return JsonSerializer.SerializeToElement(new Dictionary<string, object?>());
        }

        try
        {
            var singles = await dbContext.CogitaKnowledgeLinkSinglesCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == infoId)
                .Select(x => new { x.FieldKey, TargetItemId = x.TargetItemId })
                .ToListAsync(ct);
            var multis = await dbContext.CogitaKnowledgeLinkMultisCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.SourceItemId == infoId)
                .OrderBy(x => x.SortOrder)
                .Select(x => new { x.FieldKey, TargetItemId = x.TargetItemId })
                .ToListAsync(ct);

            if (singles.Count == 0 && multis.Count == 0)
            {
                // Compatibility fallback for older datasets that still store links in legacy tables.
                singles = await dbContext.CogitaInfoLinkSingles.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.InfoId == infoId)
                    .Select(x => new { x.FieldKey, TargetItemId = x.TargetInfoId })
                    .ToListAsync(ct);
                multis = await dbContext.CogitaInfoLinkMultis.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.InfoId == infoId)
                    .OrderBy(x => x.SortOrder)
                    .Select(x => new { x.FieldKey, TargetItemId = x.TargetInfoId })
                    .ToListAsync(ct);
            }

            var root = new JsonObject();
            foreach (var field in fieldSpecs)
            {
                if (field.Multiple)
                {
                    var values = multis
                        .Where(x => x.FieldKey.Equals(field.Key, StringComparison.OrdinalIgnoreCase))
                        .Select(x => x.TargetItemId.ToString())
                        .ToList();
                    var array = new JsonArray();
                    foreach (var value in values)
                    {
                        array.Add(value);
                    }
                    root[field.Key] = array;
                }
                else
                {
                    var value = singles
                        .FirstOrDefault(x => x.FieldKey.Equals(field.Key, StringComparison.OrdinalIgnoreCase))
                        ?.TargetItemId;
                    root[field.Key] = value?.ToString();
                }
            }

            return JsonSerializer.SerializeToElement(root);
        }
        catch (Exception ex) when (IsMissingInfoLinksSchema(ex))
        {
            return JsonSerializer.SerializeToElement(new Dictionary<string, object?>());
        }
    }

    private static bool IsMissingInfoLinksSchema(Exception ex)
    {
        var text = ex.ToString();
        return text.Contains("CogitaInfoLinkSingles", StringComparison.OrdinalIgnoreCase) ||
               text.Contains("CogitaInfoLinkMultis", StringComparison.OrdinalIgnoreCase) ||
               text.Contains("CogitaKnowledgeLinkSingles", StringComparison.OrdinalIgnoreCase) ||
               text.Contains("CogitaKnowledgeLinkMultis", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record InfoSnapshot(
        Guid InfoId,
        string InfoType,
        JsonElement Payload,
        JsonElement Links,
        string Label);

    private sealed record EffectiveCheckcardDependency(
        string ParentItemType,
        Guid ParentItemId,
        string? ParentCheckType,
        string? ParentDirection,
        string ChildItemType,
        Guid ChildItemId,
        string? ChildCheckType,
        string? ChildDirection);

    private static async Task<List<CogitaCardSearchResponse>> BuildEffectiveInfoCheckcardsAsync(
        Guid libraryId,
        CogitaInfo info,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var snapshot = await LoadInfoSnapshotAsync(
            libraryId,
            info,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);
        if (snapshot is null)
        {
            return new List<CogitaCardSearchResponse>();
        }

        var description = ResolveDescription(snapshot.Payload, snapshot.InfoType) ?? snapshot.InfoType;
        var cards = info.InfoType.Equals("citation", StringComparison.OrdinalIgnoreCase)
            ? new List<CogitaCardSearchResponse>()
            : BuildInfoCardResponses(info.Id, info.InfoType, snapshot.Label, description, snapshot.Payload);
        if (!info.InfoType.Equals("translation", StringComparison.OrdinalIgnoreCase))
        {
            if (info.InfoType.Equals("citation", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var fragmentId in BuildCitationFragmentIds(snapshot.Payload))
                {
                    cards.Add(new CogitaCardSearchResponse(
                        info.Id,
                        "info",
                        snapshot.Label,
                        description,
                        "citation",
                        "quote-fragment",
                        fragmentId));
                }
            }
            else if (info.InfoType.Equals("question", StringComparison.OrdinalIgnoreCase))
            {
                var questionType = TryGetQuestionDefinitionType(snapshot.Payload) ?? "question";
                cards = new List<CogitaCardSearchResponse>
                {
                    new(info.Id, "info", snapshot.Label, description, "question", $"question-{questionType}", null, snapshot.Payload)
                };
            }

            return cards;
        }

        var vocabProjection = await BuildInfoApproachProjectionAsync(
            libraryId,
            info,
            "vocab-card",
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);

        string vocabLabel = snapshot.Label;
        string vocabDescription = "Vocabulary";
        if (vocabProjection.HasValue &&
            vocabProjection.Value.ValueKind == JsonValueKind.Object &&
            vocabProjection.Value.TryGetProperty("words", out var wordsNode) &&
            wordsNode.ValueKind == JsonValueKind.Array)
        {
            var words = wordsNode.EnumerateArray().ToList();
            if (words.Count >= 2)
            {
                var aLabel = words[0].TryGetProperty("label", out var aProp) && aProp.ValueKind == JsonValueKind.String ? aProp.GetString() : "Word";
                var bLabel = words[1].TryGetProperty("label", out var bProp) && bProp.ValueKind == JsonValueKind.String ? bProp.GetString() : "Word";
                vocabLabel = $"{aLabel ?? "Word"} ↔ {bLabel ?? "Word"}";

                var langALabel = TryReadNestedLabel(words[0], "language") ?? "Language";
                var langBLabel = TryReadNestedLabel(words[1], "language") ?? "Language";
                vocabDescription = $"{langALabel} ↔ {langBLabel}";
            }
        }

        cards.Add(new CogitaCardSearchResponse(info.Id, "vocab", vocabLabel, vocabDescription, "translation", "translation", "a-to-b"));
        cards.Add(new CogitaCardSearchResponse(info.Id, "vocab", vocabLabel, vocabDescription, "translation", "translation", "b-to-a"));
        cards.Add(new CogitaCardSearchResponse(info.Id, "vocab", vocabLabel, vocabDescription, "translation", "translation-match", null));
        return cards;
    }

    private static async Task<List<EffectiveCheckcardDependency>> BuildEffectiveInfoCheckcardDependenciesAsync(
        Guid libraryId,
        CogitaInfo info,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var activeGraphId = await ResolveActiveDependencyGraphIdAsync(libraryId, dbContext, ct);
        var stored = await dbContext.CogitaItemDependencies.AsNoTracking()
            .Where(x => x.LibraryId == libraryId &&
                (x.GraphId == null || (activeGraphId.HasValue && x.GraphId == activeGraphId.Value)) &&
                ((x.ParentItemType == "info" && x.ParentItemId == info.Id) ||
                 (x.ChildItemType == "info" && x.ChildItemId == info.Id)))
            .ToListAsync(ct);

        var result = new List<EffectiveCheckcardDependency>(stored.Count + 8);
        var seen = new HashSet<string>(StringComparer.Ordinal);

        static string Key(EffectiveCheckcardDependency x) =>
            string.Join("|",
                x.ParentItemType,
                x.ParentItemId.ToString("D"),
                x.ParentCheckType ?? "",
                x.ParentDirection ?? "",
                x.ChildItemType,
                x.ChildItemId.ToString("D"),
                x.ChildCheckType ?? "",
                x.ChildDirection ?? "");

        void Add(EffectiveCheckcardDependency dependency)
        {
            if (seen.Add(Key(dependency)))
            {
                result.Add(dependency);
            }
        }

        foreach (var row in stored)
        {
            Add(new EffectiveCheckcardDependency(
                row.ParentItemType,
                row.ParentItemId,
                row.ParentCheckType,
                row.ParentDirection,
                row.ChildItemType,
                row.ChildItemId,
                row.ChildCheckType,
                row.ChildDirection));
        }

        if (info.InfoType.Equals("translation", StringComparison.OrdinalIgnoreCase))
        {
            Add(new EffectiveCheckcardDependency(
                "info", info.Id, "translation", "a-to-b",
                "info", info.Id, "translation-match", null));
            Add(new EffectiveCheckcardDependency(
                "info", info.Id, "translation", "b-to-a",
                "info", info.Id, "translation-match", null));
        }

        if (info.InfoType.Equals("citation", StringComparison.OrdinalIgnoreCase))
        {
            var snapshot = await LoadInfoSnapshotAsync(
                libraryId,
                info,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);
            if (snapshot is not null)
            {
                foreach (var (parentId, childId) in BuildCitationFragmentDependencies(snapshot.Payload))
                {
                    Add(new EffectiveCheckcardDependency(
                        "info", info.Id, "quote-fragment", childId,
                        "info", info.Id, "quote-fragment", parentId));
                }
            }
        }

        return result;
    }

    private static string? TryReadNestedLabel(JsonElement root, string property)
    {
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty(property, out var node) ||
            node.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (node.TryGetProperty("label", out var label) && label.ValueKind == JsonValueKind.String)
        {
            return label.GetString();
        }
        return null;
    }

    private sealed record CitationFragmentNode(string Id, int Start, int End, int Depth, string? ParentId, string? LeftId, string? RightId);

    private static IEnumerable<string> BuildCitationFragmentIds(JsonElement payload)
    {
        foreach (var node in BuildCitationFragmentTree(payload).Values.OrderBy(x => int.Parse(x.Id, CultureInfo.InvariantCulture)))
        {
            yield return node.Id;
        }
    }

    private static IEnumerable<(string ParentId, string ChildId)> BuildCitationFragmentDependencies(JsonElement payload)
    {
        foreach (var node in BuildCitationFragmentTree(payload).Values)
        {
            if (!string.IsNullOrWhiteSpace(node.LeftId))
            {
                yield return (node.Id, node.LeftId!);
            }

            if (!string.IsNullOrWhiteSpace(node.RightId))
            {
                yield return (node.Id, node.RightId!);
            }
        }
    }

    private static string? TryGetQuestionDefinitionType(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty("definition", out var definition) ||
            definition.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (definition.TryGetProperty("type", out var typeNode) &&
            typeNode.ValueKind == JsonValueKind.String)
        {
            var raw = typeNode.GetString();
            if (!string.IsNullOrWhiteSpace(raw))
            {
                return raw!.Trim().ToLowerInvariant();
            }
        }

        if (definition.TryGetProperty("kind", out var kindNode) &&
            kindNode.ValueKind == JsonValueKind.String)
        {
            var raw = kindNode.GetString();
            if (!string.IsNullOrWhiteSpace(raw))
            {
                var normalized = raw!.Trim().ToLowerInvariant();
                return normalized switch
                {
                    "multi_select" or "single_select" => "selection",
                    "boolean" => "truefalse",
                    "order" => "ordering",
                    _ => normalized
                };
            }
        }

        return null;
    }

    private static Dictionary<string, CitationFragmentNode> BuildCitationFragmentTree(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty("text", out var textNode) ||
            textNode.ValueKind != JsonValueKind.String)
        {
            return new Dictionary<string, CitationFragmentNode>(StringComparer.Ordinal);
        }

        var text = textNode.GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            return new Dictionary<string, CitationFragmentNode>(StringComparer.Ordinal);
        }

        return BuildCitationFragmentTree(text!);
    }

    private static Dictionary<string, CitationFragmentNode> BuildCitationFragmentTree(string text, int minLen = 7, int maxLen = 13)
    {
        minLen = Math.Max(1, minLen);
        maxLen = Math.Max(minLen, maxLen);

        var nodes = new Dictionary<string, CitationFragmentNode>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(text))
        {
            return nodes;
        }

        CitationFragmentNode BuildNode(int start, int end, int depth, int index, string? parentId)
        {
            var id = index.ToString(CultureInfo.InvariantCulture);
            var leftId = (string?)null;
            var rightId = (string?)null;
            var length = end - start;
            if (length > maxLen)
            {
                var splitIndex = FindCitationSplitIndex(text, start, end, minLen);
                if (splitIndex.HasValue && splitIndex.Value > start && splitIndex.Value < end)
                {
                    var left = BuildNode(start, splitIndex.Value, depth + 1, index * 2 + 1, id);
                    var right = BuildNode(splitIndex.Value, end, depth + 1, index * 2 + 2, id);
                    leftId = left.Id;
                    rightId = right.Id;
                }
            }

            var node = new CitationFragmentNode(id, start, end, depth, parentId, leftId, rightId);
            nodes[id] = node;
            return node;
        }

        BuildNode(0, text.Length, 0, 0, null);
        return nodes;
    }

    private static int? FindCitationSplitIndex(string text, int start, int end, int minLen)
    {
        var length = end - start;
        var minIndex = start + minLen;
        var maxIndex = end - minLen;
        if (length <= minLen * 2 || maxIndex <= minIndex)
        {
            return null;
        }

        var target = (start + end) / 2;
        var whitespaceBoundary = FindCitationBestBoundary(text, minIndex, maxIndex, target, minScore: 3);
        if (whitespaceBoundary.HasValue && IsCitationWordBoundary(text, whitespaceBoundary.Value))
        {
            return whitespaceBoundary;
        }

        var wordBoundary = FindCitationBestBoundary(text, minIndex, maxIndex, target, minScore: 2);
        if (wordBoundary.HasValue && IsCitationWordBoundary(text, wordBoundary.Value))
        {
            return wordBoundary;
        }

        var punctuationBoundary = FindCitationBestBoundary(text, minIndex, maxIndex, target, minScore: 1);
        if (punctuationBoundary.HasValue && IsCitationWordBoundary(text, punctuationBoundary.Value))
        {
            return punctuationBoundary;
        }

        return null;
    }

    private static int? FindCitationBestBoundary(string text, int minIndex, int maxIndex, int target, int minScore)
    {
        var maxOffset = Math.Max(target - minIndex, maxIndex - target);
        for (var offset = 0; offset <= maxOffset; offset++)
        {
            var left = target - offset;
            if (left >= minIndex && left <= maxIndex && CitationBoundaryScore(text, left) >= minScore)
            {
                return left;
            }

            var right = target + offset;
            if (right >= minIndex && right <= maxIndex && CitationBoundaryScore(text, right) >= minScore)
            {
                return right;
            }
        }

        return null;
    }

    private static int CitationBoundaryScore(string text, int splitIndex)
    {
        var left = splitIndex > 0 ? text[splitIndex - 1] : '\0';
        var right = splitIndex < text.Length ? text[splitIndex] : '\0';
        if (left == '\0' || right == '\0')
        {
            return 0;
        }

        var leftWhitespace = char.IsWhiteSpace(left);
        var rightWhitespace = char.IsWhiteSpace(right);
        if (leftWhitespace || rightWhitespace)
        {
            return 3;
        }

        var leftWord = char.IsLetterOrDigit(left);
        var rightWord = char.IsLetterOrDigit(right);
        if (leftWord != rightWord)
        {
            return 2;
        }

        if (!leftWord && !rightWord)
        {
            return 1;
        }

        return 0;
    }

    private static bool IsCitationWordBoundary(string text, int splitIndex)
    {
        var left = splitIndex > 0 ? text[splitIndex - 1] : '\0';
        var right = splitIndex < text.Length ? text[splitIndex] : '\0';
        if (left == '\0' || right == '\0')
        {
            return true;
        }

        return char.IsLetterOrDigit(left) != char.IsLetterOrDigit(right);
    }

    private static async Task<bool> IsValidEffectiveInfoCheckcardIdentityAsync(
        Guid libraryId,
        Guid infoId,
        string? checkType,
        string? direction,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var info = await dbContext.CogitaInfos.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == infoId && x.LibraryId == libraryId, ct);
        if (info is null)
        {
            return false;
        }

        var normalizedCheckType = string.IsNullOrWhiteSpace(checkType) ? "info" : checkType.Trim().ToLowerInvariant();
        var normalizedDirection = string.IsNullOrWhiteSpace(direction) ? null : direction.Trim().ToLowerInvariant();

        var cards = await BuildEffectiveInfoCheckcardsAsync(
            libraryId,
            info,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);

        return cards.Any(card =>
            card.CardId == infoId &&
            string.Equals(card.CheckType ?? "info", normalizedCheckType, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(card.Direction ?? null, normalizedDirection, StringComparison.OrdinalIgnoreCase));
    }

    private static async Task<JsonElement?> BuildInfoApproachProjectionAsync(
        Guid libraryId,
        CogitaInfo sourceInfo,
        string approachKey,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var source = await LoadInfoSnapshotAsync(
            libraryId,
            sourceInfo,
            readKey,
            keyRingService,
            encryptionService,
            dbContext,
            ct);
        if (source is null)
        {
            return null;
        }

        if (approachKey.Equals("citation-view", StringComparison.OrdinalIgnoreCase))
        {
            var root = new JsonObject
            {
                ["kind"] = "citation",
                ["sourceInfoId"] = source.InfoId.ToString(),
                ["sourceInfoType"] = source.InfoType,
                ["label"] = source.Label
            };
            root["payload"] = JsonNode.Parse(source.Payload.GetRawText());
            root["links"] = JsonNode.Parse(source.Links.GetRawText());
            return JsonSerializer.SerializeToElement(root);
        }

        if (!approachKey.Equals("vocab-card", StringComparison.OrdinalIgnoreCase))
        {
            return JsonSerializer.SerializeToElement(new
            {
                kind = "raw",
                sourceInfoId = source.InfoId,
                sourceInfoType = source.InfoType,
                payload = source.Payload,
                links = source.Links
            });
        }

        var translationLinks = ParseInfoLinks(source.Links);
        var wordIds = translationLinks.TryGetValue("words", out var words) ? words.Take(2).ToList() : new List<Guid>();
        var translationTopicIds = translationLinks.TryGetValue("topics", out var translationTopics) ? translationTopics : new List<Guid>();
        var translationReferenceIds = translationLinks.TryGetValue("references", out var referenceIds) ? referenceIds : new List<Guid>();

        var relatedIds = wordIds
            .Concat(translationTopicIds)
            .Concat(translationReferenceIds)
            .Distinct()
            .ToList();
        var relatedInfos = relatedIds.Count == 0
            ? new Dictionary<Guid, CogitaInfo>()
            : await dbContext.CogitaInfos.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && relatedIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

        var snapshots = new Dictionary<Guid, InfoSnapshot>();
        foreach (var relatedId in relatedIds)
        {
            if (!relatedInfos.TryGetValue(relatedId, out var relatedInfo))
            {
                continue;
            }

            var snapshot = await LoadInfoSnapshotAsync(
                libraryId,
                relatedInfo,
                readKey,
                keyRingService,
                encryptionService,
                dbContext,
                ct);
            if (snapshot is not null)
            {
                snapshots[relatedId] = snapshot;
            }
        }

        var wordsArray = new JsonArray();
        foreach (var wordId in wordIds)
        {
            if (!snapshots.TryGetValue(wordId, out var word))
            {
                wordsArray.Add(new JsonObject { ["infoId"] = wordId.ToString(), ["missing"] = true });
                continue;
            }

            var wordLinks = ParseInfoLinks(word.Links);
            var languageId = wordLinks.TryGetValue("languageId", out var languageLinkValues) ? languageLinkValues.FirstOrDefault() : Guid.Empty;
            var wordTopicLinkIds = wordLinks.TryGetValue("topics", out var wordTopicLinkValues) ? wordTopicLinkValues : new List<Guid>();

            JsonNode? languageNode = null;
            if (languageId != Guid.Empty)
            {
                snapshots.TryGetValue(languageId, out var languageSnapshot);
                if (languageSnapshot is null)
                {
                    var languageInfo = await dbContext.CogitaInfos.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == languageId && x.LibraryId == libraryId, ct);
                    if (languageInfo is not null)
                    {
                        languageSnapshot = await LoadInfoSnapshotAsync(
                            libraryId,
                            languageInfo,
                            readKey,
                            keyRingService,
                            encryptionService,
                            dbContext,
                            ct);
                        if (languageSnapshot is not null)
                        {
                            snapshots[languageId] = languageSnapshot;
                        }
                    }
                }

                if (snapshots.TryGetValue(languageId, out var lang))
                {
                    languageNode = BuildCompactInfoNode(lang);
                }
            }

            var wordTopicsNode = new JsonArray();
            foreach (var topicId in wordTopicLinkIds)
            {
                snapshots.TryGetValue(topicId, out var topic);
                if (topic is null)
                {
                    var topicInfo = await dbContext.CogitaInfos.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == topicId && x.LibraryId == libraryId, ct);
                    if (topicInfo is not null)
                    {
                        topic = await LoadInfoSnapshotAsync(
                            libraryId,
                            topicInfo,
                            readKey,
                            keyRingService,
                            encryptionService,
                            dbContext,
                            ct);
                        if (topic is not null)
                        {
                            snapshots[topicId] = topic;
                        }
                    }
                }
                if (topic is not null)
                {
                    wordTopicsNode.Add(BuildCompactInfoNode(topic));
                }
            }

            wordsArray.Add(new JsonObject
            {
                ["infoId"] = word.InfoId.ToString(),
                ["infoType"] = word.InfoType,
                ["label"] = word.Label,
                ["payload"] = JsonNode.Parse(word.Payload.GetRawText()),
                ["language"] = languageNode,
                ["topics"] = wordTopicsNode
            });
        }

        var translationTopicsNode = new JsonArray();
        foreach (var topicId in translationTopicIds)
        {
            if (snapshots.TryGetValue(topicId, out var topic))
            {
                translationTopicsNode.Add(BuildCompactInfoNode(topic));
            }
        }

        var referencesNode = new JsonArray();
        foreach (var referenceId in translationReferenceIds)
        {
            if (snapshots.TryGetValue(referenceId, out var reference))
            {
                referencesNode.Add(BuildCompactInfoNode(reference));
            }
        }

        var vocabRoot = new JsonObject
        {
            ["kind"] = "vocab-card",
            ["sourceInfoId"] = source.InfoId.ToString(),
            ["sourceInfoType"] = source.InfoType,
            ["translation"] = new JsonObject
            {
                ["infoId"] = source.InfoId.ToString(),
                ["label"] = source.Label,
                ["payload"] = JsonNode.Parse(source.Payload.GetRawText()),
                ["links"] = JsonNode.Parse(source.Links.GetRawText())
            },
            ["words"] = wordsArray,
            ["translationTopics"] = translationTopicsNode,
            ["references"] = referencesNode
        };

        return JsonSerializer.SerializeToElement(vocabRoot);
    }

    private static JsonObject BuildCompactInfoNode(InfoSnapshot snapshot)
    {
        return new JsonObject
        {
            ["infoId"] = snapshot.InfoId.ToString(),
            ["infoType"] = snapshot.InfoType,
            ["label"] = snapshot.Label,
            ["payload"] = JsonNode.Parse(snapshot.Payload.GetRawText())
        };
    }

    private static async Task<InfoSnapshot?> LoadInfoSnapshotAsync(
        Guid libraryId,
        CogitaInfo info,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (info.LibraryId != libraryId)
        {
            return null;
        }

        var payload = await LoadInfoPayloadAsync(info, dbContext, ct);
        if (payload is null)
        {
            return null;
        }

        var keyEntry = await dbContext.Keys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == payload.Value.DataKeyId, ct);
        if (keyEntry is null)
        {
            return null;
        }

        byte[] dataKey;
        try
        {
            dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
        }
        catch (CryptographicException)
        {
            return null;
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
            return null;
        }
        catch (JsonException)
        {
            return null;
        }

        var linksJson = await LoadInfoLinksAsJsonAsync(libraryId, info.Id, info.InfoType, dbContext, ct);
        var label = ResolveLabel(payloadJson, info.InfoType) ?? info.InfoType;
        return new InfoSnapshot(info.Id, info.InfoType, payloadJson, linksJson, label);
    }

    private static bool LooksLikeUnsupportedInfoTypeSchema(Exception ex, string infoType)
    {
        var text = ex.ToString();
        if (string.IsNullOrWhiteSpace(infoType))
        {
            return false;
        }

        var mentionsType = text.Contains(infoType, StringComparison.OrdinalIgnoreCase);
        var mentionsCogitaInfoTables =
            text.Contains("CogitaInfos", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("CogitaInfoSearchIndexes", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("CogitaEntitySearchDocuments", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("CogitaNotions", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("CogitaKnowledgeTypeSpecs", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("CogitaCheckcardDefinitions", StringComparison.OrdinalIgnoreCase);
        var looksLikeConstraint =
            text.Contains("CHECK constraint", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("constraint", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("invalid", StringComparison.OrdinalIgnoreCase);

        return mentionsType && mentionsCogitaInfoTables && looksLikeConstraint;
    }

    private static void AddInfoPayload(
        string infoType,
        Guid infoId,
        Guid dataKeyId,
        byte[] encrypted,
        DateTimeOffset now,
        RecreatioDbContext dbContext)
    {
        if (CogitaTypeRegistry.ComputedBackedInfoTypes.Contains(infoType))
        {
            dbContext.CogitaComputedInfos.Add(new CogitaComputedInfo
            {
                InfoId = infoId,
                DataKeyId = dataKeyId,
                EncryptedBlob = encrypted,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            return;
        }

        switch (infoType)
        {
            case "question":
                dbContext.CogitaQuestions.Add(new CogitaQuestion { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
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
            case "institution":
                dbContext.CogitaInstitutions.Add(new CogitaInstitution { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "collective":
                dbContext.CogitaCollectives.Add(new CogitaCollective { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "orcid":
                dbContext.CogitaOrcids.Add(new CogitaOrcid { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
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
            case "media":
                dbContext.CogitaMedia.Add(new CogitaMedia { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "work":
                dbContext.CogitaWorks.Add(new CogitaWork { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
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
            case "source":
                dbContext.CogitaSources.Add(new CogitaSource { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
                break;
            case "citation":
                dbContext.CogitaQuotes.Add(new CogitaQuote { InfoId = infoId, DataKeyId = dataKeyId, EncryptedBlob = encrypted, CreatedUtc = now, UpdatedUtc = now });
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
        if (CogitaTypeRegistry.ComputedBackedInfoTypes.Contains(infoType))
        {
            var computedRow = dbContext.CogitaComputedInfos.FirstOrDefault(x => x.InfoId == infoId);
            if (computedRow is null)
            {
                return false;
            }

            computedRow.DataKeyId = dataKeyId;
            computedRow.EncryptedBlob = encrypted;
            computedRow.UpdatedUtc = now;
            return true;
        }

        switch (infoType)
        {
            case "question":
                {
                    var row = dbContext.CogitaQuestions.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
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
            case "institution":
                {
                    var row = dbContext.CogitaInstitutions.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "collective":
                {
                    var row = dbContext.CogitaCollectives.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "orcid":
                {
                    var row = dbContext.CogitaOrcids.FirstOrDefault(x => x.InfoId == infoId);
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
            case "media":
                {
                    var row = dbContext.CogitaMedia.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "work":
                {
                    var row = dbContext.CogitaWorks.FirstOrDefault(x => x.InfoId == infoId);
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
            case "source":
                {
                    var row = dbContext.CogitaSources.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    row.DataKeyId = dataKeyId;
                    row.EncryptedBlob = encrypted;
                    row.UpdatedUtc = now;
                    return true;
                }
            case "citation":
                {
                    var row = dbContext.CogitaQuotes.FirstOrDefault(x => x.InfoId == infoId);
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

    private static bool RemoveInfoPayload(
        string infoType,
        Guid infoId,
        RecreatioDbContext dbContext)
    {
        if (CogitaTypeRegistry.ComputedBackedInfoTypes.Contains(infoType))
        {
            var computedRow = dbContext.CogitaComputedInfos.FirstOrDefault(x => x.InfoId == infoId);
            if (computedRow is null)
            {
                return false;
            }

            dbContext.CogitaComputedInfos.Remove(computedRow);
            return true;
        }

        switch (infoType)
        {
            case "question":
                {
                    var row = dbContext.CogitaQuestions.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaQuestions.Remove(row);
                    return true;
                }
            case "language":
                {
                    var row = dbContext.CogitaLanguages.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaLanguages.Remove(row);
                    return true;
                }
            case "word":
                {
                    var row = dbContext.CogitaWords.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaWords.Remove(row);
                    return true;
                }
            case "sentence":
                {
                    var row = dbContext.CogitaSentences.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaSentences.Remove(row);
                    return true;
                }
            case "topic":
                {
                    var row = dbContext.CogitaTopics.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaTopics.Remove(row);
                    return true;
                }
            case "collection":
                {
                    var row = dbContext.CogitaCollections.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaCollections.Remove(row);
                    return true;
                }
            case "person":
                {
                    var row = dbContext.CogitaPersons.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaPersons.Remove(row);
                    return true;
                }
            case "institution":
                {
                    var row = dbContext.CogitaInstitutions.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaInstitutions.Remove(row);
                    return true;
                }
            case "collective":
                {
                    var row = dbContext.CogitaCollectives.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaCollectives.Remove(row);
                    return true;
                }
            case "orcid":
                {
                    var row = dbContext.CogitaOrcids.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaOrcids.Remove(row);
                    return true;
                }
            case "address":
                {
                    var row = dbContext.CogitaAddresses.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaAddresses.Remove(row);
                    return true;
                }
            case "email":
                {
                    var row = dbContext.CogitaEmails.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaEmails.Remove(row);
                    return true;
                }
            case "phone":
                {
                    var row = dbContext.CogitaPhones.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaPhones.Remove(row);
                    return true;
                }
            case "media":
                {
                    var row = dbContext.CogitaMedia.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaMedia.Remove(row);
                    return true;
                }
            case "work":
                {
                    var row = dbContext.CogitaWorks.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaWorks.Remove(row);
                    return true;
                }
            case "geo":
                {
                    var row = dbContext.CogitaGeoFeatures.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaGeoFeatures.Remove(row);
                    return true;
                }
            case "music_piece":
                {
                    var row = dbContext.CogitaMusicPieces.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaMusicPieces.Remove(row);
                    return true;
                }
            case "music_fragment":
                {
                    var row = dbContext.CogitaMusicFragments.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaMusicFragments.Remove(row);
                    return true;
                }
            case "source":
                {
                    var row = dbContext.CogitaSources.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaSources.Remove(row);
                    return true;
                }
            case "citation":
                {
                    var row = dbContext.CogitaQuotes.FirstOrDefault(x => x.InfoId == infoId);
                    if (row is null) return false;
                    dbContext.CogitaQuotes.Remove(row);
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

    private static Dictionary<string, string> ParseSearchFilters(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var value = prop.Value.GetString()?.Trim();
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                map[prop.Name.Trim()] = value;
            }

            return map;
        }
        catch
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private static string NormalizeFilterToken(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return value.Trim().ToLowerInvariant()
            .Replace(';', ' ')
            .Replace('=', ' ')
            .Replace('\n', ' ')
            .Replace('\r', ' ');
    }

    private static async Task<Guid?> ResolveActiveDependencyGraphIdAsync(
        Guid libraryId,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var graph = await dbContext.CogitaDependencyGraphs.AsNoTracking()
            .Where(x => x.LibraryId == libraryId)
            .OrderByDescending(x => x.IsActive)
            .ThenByDescending(x => x.UpdatedUtc)
            .Select(x => new { x.Id })
            .FirstOrDefaultAsync(ct);
        return graph?.Id;
    }

    private static byte[] BuildDependencyLinkHash(
        Guid libraryId,
        string parentItemType,
        Guid parentItemId,
        string? parentCheckType,
        string? parentDirection,
        string childItemType,
        Guid childItemId,
        string? childCheckType,
        string? childDirection)
    {
        static string NormalizePart(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().ToLowerInvariant();
        }

        var raw = string.Join("|",
            libraryId.ToString("D").ToLowerInvariant(),
            NormalizePart(parentItemType),
            parentItemId.ToString("D").ToLowerInvariant(),
            NormalizePart(parentCheckType),
            NormalizePart(parentDirection),
            NormalizePart(childItemType),
            childItemId.ToString("D").ToLowerInvariant(),
            NormalizePart(childCheckType),
            NormalizePart(childDirection));

        return SHA256.HashData(Encoding.UTF8.GetBytes(raw));
    }

    private static string NormalizeSearchText(string? value, int maxLength = 4096)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var lower = value.Trim().ToLowerInvariant();
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
            if (builder.Length >= maxLength)
            {
                break;
            }
        }

        return builder.ToString();
    }

    private static string InferEntityKindForInfoType(string infoType)
    {
        return CogitaTypeRegistry.InferEntityKind(infoType);
    }

    private static IEnumerable<string> CollectPayloadStrings(JsonElement payload)
    {
        if (payload.ValueKind == JsonValueKind.String)
        {
            var value = payload.GetString();
            if (!string.IsNullOrWhiteSpace(value))
            {
                yield return value!;
            }
            yield break;
        }

        if (payload.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in payload.EnumerateArray())
            {
                foreach (var text in CollectPayloadStrings(item))
                {
                    yield return text;
                }
            }
            yield break;
        }

        if (payload.ValueKind != JsonValueKind.Object)
        {
            yield break;
        }

        foreach (var prop in payload.EnumerateObject())
        {
            foreach (var text in CollectPayloadStrings(prop.Value))
            {
                yield return text;
            }
        }
    }

    private static List<(string Key, string Value)> BuildPayloadFilterTokens(string infoType, JsonElement payload)
    {
        return CogitaTypeRegistry.BuildInfoFilterTokens(infoType, payload);
    }

    private static string BuildFilterText(IEnumerable<(string Key, string Value)> tokens)
    {
        var builder = new StringBuilder();
        var unique = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (key, value) in tokens)
        {
            var normalizedKey = NormalizeFilterToken(key);
            var normalizedValue = NormalizeFilterToken(value);
            if (string.IsNullOrWhiteSpace(normalizedKey) || string.IsNullOrWhiteSpace(normalizedValue))
            {
                continue;
            }

            var token = $";{normalizedKey}={normalizedValue};";
            if (!unique.Add(token))
            {
                continue;
            }

            builder.Append(token);
        }

        return builder.ToString();
    }

    private static async Task EnsureEntitySearchDocumentsAsync(
        Guid libraryId,
        byte[] readKey,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var infos = await dbContext.CogitaInfos.AsNoTracking()
            .Where(x => x.LibraryId == libraryId)
            .Select(x => new { x.Id, x.InfoType, x.UpdatedUtc })
            .ToListAsync(ct);
        var connections = await dbContext.CogitaConnections.AsNoTracking()
            .Where(x => x.LibraryId == libraryId)
            .Select(x => new { x.Id, x.ConnectionType, x.DataKeyId, x.EncryptedBlob, x.UpdatedUtc })
            .ToListAsync(ct);

        var existing = await dbContext.CogitaEntitySearchDocuments.AsNoTracking()
            .Where(x => x.LibraryId == libraryId)
            .Select(x => new { x.SourceKind, x.SourceId, x.SourceUpdatedUtc, x.FilterTextNormalized })
            .ToListAsync(ct);

        var expectedCount = infos.Count + connections.Count;
        var needsRebuild = existing.Count != expectedCount;

        if (!needsRebuild)
        {
            if (existing.Any(x => string.IsNullOrWhiteSpace(x.FilterTextNormalized) || !x.FilterTextNormalized.Contains(";sourcekind=")))
            {
                needsRebuild = true;
            }
        }

        if (!needsRebuild)
        {
            var existingMap = existing.ToDictionary(x => $"{x.SourceKind}:{x.SourceId}", x => x.SourceUpdatedUtc);
            foreach (var info in infos)
            {
                var key = $"info:{info.Id}";
                if (!existingMap.TryGetValue(key, out var indexedUtc) || indexedUtc != info.UpdatedUtc)
                {
                    needsRebuild = true;
                    break;
                }
            }

            if (!needsRebuild)
            {
                foreach (var connection in connections)
                {
                    var key = $"connection:{connection.Id}";
                    if (!existingMap.TryGetValue(key, out var indexedUtc) || indexedUtc != connection.UpdatedUtc)
                    {
                        needsRebuild = true;
                        break;
                    }
                }
            }
        }

        if (!needsRebuild)
        {
            return;
        }

        var infoLookup = await BuildInfoLookupAsync(libraryId, null, dbContext, ct);
        var infoDataKeyIds = infoLookup.Values.Select(x => x.DataKeyId).Distinct().ToList();
        var infoKeyMap = await dbContext.Keys.AsNoTracking()
            .Where(x => infoDataKeyIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);

        var infoTitles = new Dictionary<Guid, string>();
        var infoTypes = infos.ToDictionary(x => x.Id, x => x.InfoType);
        var infoPayloads = new Dictionary<Guid, JsonElement>();
        var infoSummaries = new Dictionary<Guid, string>();

        foreach (var info in infos)
        {
            if (!infoLookup.TryGetValue(info.Id, out var payloadRow))
            {
                continue;
            }

            if (!infoKeyMap.TryGetValue(payloadRow.DataKeyId, out var keyEntry))
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
                var plain = encryptionService.Decrypt(dataKey, payloadRow.EncryptedBlob, info.Id.ToByteArray());
                using var doc = JsonDocument.Parse(plain);
                var root = doc.RootElement.Clone();
                var title = ResolveLabel(root, info.InfoType) ?? info.InfoType;
                var summary = ResolveDescription(root, info.InfoType) ?? string.Empty;
                infoTitles[info.Id] = title;
                infoSummaries[info.Id] = summary;
                infoPayloads[info.Id] = root;
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

        var connectionIds = connections.Select(x => x.Id).ToList();
        var connectionItems = connectionIds.Count == 0
            ? new List<CogitaConnectionItem>()
            : await dbContext.CogitaConnectionItems.AsNoTracking()
                .Where(x => connectionIds.Contains(x.ConnectionId))
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);
        var itemsByConnection = connectionItems
            .GroupBy(x => x.ConnectionId)
            .ToDictionary(group => group.Key, group => group.Select(x => x.InfoId).ToList());

        var connectionsByInfo = connectionItems
            .GroupBy(x => x.InfoId)
            .ToDictionary(group => group.Key, group => group.Select(x => x.ConnectionId).Distinct().ToList());

        var infoIds = infos.Select(x => x.Id).ToList();
        var singleLinks = new List<(Guid SourceItemId, string FieldKey, Guid TargetItemId)>();
        var multiLinks = new List<(Guid SourceItemId, string FieldKey, Guid TargetItemId)>();
        if (infoIds.Count > 0)
        {
            var singleLinkRows = await dbContext.CogitaKnowledgeLinkSinglesCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && infoIds.Contains(x.SourceItemId))
                .Select(x => new { x.SourceItemId, x.FieldKey, x.TargetItemId })
                .ToListAsync(ct);
            singleLinks = singleLinkRows
                .Select(x => (SourceItemId: x.SourceItemId, FieldKey: x.FieldKey, TargetItemId: x.TargetItemId))
                .ToList();

            var multiLinkRows = await dbContext.CogitaKnowledgeLinkMultisCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && infoIds.Contains(x.SourceItemId))
                .OrderBy(x => x.SortOrder)
                .Select(x => new { x.SourceItemId, x.FieldKey, x.TargetItemId })
                .ToListAsync(ct);
            multiLinks = multiLinkRows
                .Select(x => (SourceItemId: x.SourceItemId, FieldKey: x.FieldKey, TargetItemId: x.TargetItemId))
                .ToList();
        }
        if (singleLinks.Count == 0 && multiLinks.Count == 0)
        {
            // Compatibility fallback for data not migrated to knowledge-link tables yet.
            if (infoIds.Count == 0)
            {
                singleLinks = new List<(Guid SourceItemId, string FieldKey, Guid TargetItemId)>();
                multiLinks = new List<(Guid SourceItemId, string FieldKey, Guid TargetItemId)>();
            }
            else
            {
                var legacySingleRows = await dbContext.CogitaInfoLinkSingles.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && infoIds.Contains(x.InfoId))
                    .Select(x => new { SourceItemId = x.InfoId, x.FieldKey, TargetItemId = x.TargetInfoId })
                    .ToListAsync(ct);
                singleLinks = legacySingleRows
                    .Select(x => (x.SourceItemId, x.FieldKey, x.TargetItemId))
                    .ToList();

                var legacyMultiRows = await dbContext.CogitaInfoLinkMultis.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && infoIds.Contains(x.InfoId))
                    .OrderBy(x => x.SortOrder)
                    .Select(x => new { SourceItemId = x.InfoId, x.FieldKey, TargetItemId = x.TargetInfoId })
                    .ToListAsync(ct);
                multiLinks = legacyMultiRows
                    .Select(x => (x.SourceItemId, x.FieldKey, x.TargetItemId))
                    .ToList();
            }
        }
        var linksByInfo = singleLinks
            .Concat(multiLinks)
            .GroupBy(x => x.SourceItemId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var wordIds = connectionItems
            .Select(x => x.InfoId)
            .Where(id => infoTypes.TryGetValue(id, out var infoType) && infoType == "word")
            .Distinct()
            .ToList();
        var wordLanguageMap = wordIds.Count == 0
            ? new Dictionary<Guid, Guid>()
            : await dbContext.CogitaWordLanguages.AsNoTracking()
                .Where(x => wordIds.Contains(x.WordInfoId))
                .GroupBy(x => x.WordInfoId)
                .ToDictionaryAsync(group => group.Key, group => group.Select(x => x.LanguageInfoId).First(), ct);

        var connectionKeyIds = connections.Select(x => x.DataKeyId).Distinct().ToList();
        var connectionKeyMap = connectionKeyIds.Count == 0
            ? new Dictionary<Guid, KeyEntry>()
            : await dbContext.Keys.AsNoTracking()
                .Where(x => connectionKeyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

        var documents = new List<CogitaEntitySearchDocument>(expectedCount);
        var now = DateTimeOffset.UtcNow;

        foreach (var info in infos)
        {
            infoTitles.TryGetValue(info.Id, out var title);
            infoSummaries.TryGetValue(info.Id, out var summary);
            infoPayloads.TryGetValue(info.Id, out var payload);

            title ??= info.InfoType;
            summary ??= string.Empty;

            var filterTokens = payload.ValueKind == JsonValueKind.Undefined
                ? new List<(string Key, string Value)> { ("entityType", info.InfoType) }
                : BuildPayloadFilterTokens(info.InfoType, payload);
            filterTokens.Add(("sourceKind", "info"));

            var relationTexts = new List<string>();
            if (connectionsByInfo.TryGetValue(info.Id, out var relatedConnectionIds))
            {
                foreach (var connectionId in relatedConnectionIds)
                {
                    var connection = connections.FirstOrDefault(x => x.Id == connectionId);
                    if (connection is null)
                    {
                        continue;
                    }

                    filterTokens.Add(("relationType", connection.ConnectionType));

                    if (!itemsByConnection.TryGetValue(connection.Id, out var connectionInfoIds))
                    {
                        continue;
                    }

                    foreach (var relatedInfoId in connectionInfoIds)
                    {
                        if (relatedInfoId == info.Id)
                        {
                            continue;
                        }

                        filterTokens.Add(("relatedInfoId", relatedInfoId.ToString()));
                        if (infoTypes.TryGetValue(relatedInfoId, out var relatedType))
                        {
                            filterTokens.Add(("relatedInfoType", relatedType));
                            if (relatedType == "language")
                            {
                                filterTokens.Add(("languageId", relatedInfoId.ToString()));
                            }
                        }

                        if (infoTitles.TryGetValue(relatedInfoId, out var relatedLabel))
                        {
                            relationTexts.Add(relatedLabel);
                        }
                    }
                }
            }

            if (linksByInfo.TryGetValue(info.Id, out var linkedEntries))
            {
                foreach (var linked in linkedEntries)
                {
                    filterTokens.Add(("linkField", linked.FieldKey));
                    filterTokens.Add(($"link.{linked.FieldKey}", linked.TargetItemId.ToString()));
                    filterTokens.Add(("relatedInfoId", linked.TargetItemId.ToString()));
                    if (infoTypes.TryGetValue(linked.TargetItemId, out var relatedType))
                    {
                        filterTokens.Add(("relatedInfoType", relatedType));
                        filterTokens.Add(("linkTargetType", relatedType));
                        if (relatedType == "language")
                        {
                            filterTokens.Add(("languageId", linked.TargetItemId.ToString()));
                        }
                    }
                    if (infoTitles.TryGetValue(linked.TargetItemId, out var relatedLabel))
                    {
                        relationTexts.Add(relatedLabel);
                    }
                }
            }

            var payloadText = payload.ValueKind == JsonValueKind.Undefined
                ? string.Empty
                : string.Join(' ', CollectPayloadStrings(payload));
            var searchText = NormalizeSearchText($"{title} {summary} {payloadText} {string.Join(' ', relationTexts)}");

            documents.Add(new CogitaEntitySearchDocument
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                SourceKind = "info",
                SourceId = info.Id,
                EntityKind = InferEntityKindForInfoType(info.InfoType),
                EntityType = info.InfoType,
                InfoId = info.Id,
                ConnectionId = null,
                Title = title,
                TitleNormalized = NormalizeLabel(title),
                Summary = summary,
                SearchTextNormalized = searchText,
                FilterTextNormalized = BuildFilterText(filterTokens),
                SourceUpdatedUtc = info.UpdatedUtc,
                UpdatedUtc = now
            });
        }

        foreach (var connection in connections)
        {
            var itemIds = itemsByConnection.TryGetValue(connection.Id, out var list) ? list : new List<Guid>();
            var itemLabels = itemIds
                .Select(id => infoTitles.TryGetValue(id, out var label) ? label : null)
                .Where(label => !string.IsNullOrWhiteSpace(label))
                .Select(label => label!)
                .ToList();
            var title = itemLabels.Count > 0 ? string.Join(" ↔ ", itemLabels) : connection.ConnectionType;

            var payloadText = string.Empty;
            if (connectionKeyMap.TryGetValue(connection.DataKeyId, out var keyEntry))
            {
                try
                {
                    var dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                    var plain = encryptionService.Decrypt(dataKey, connection.EncryptedBlob, connection.Id.ToByteArray());
                    using var doc = JsonDocument.Parse(plain);
                    payloadText = string.Join(' ', CollectPayloadStrings(doc.RootElement));
                }
                catch
                {
                    payloadText = string.Empty;
                }
            }

            var filterTokens = new List<(string Key, string Value)>
            {
                ("entityType", connection.ConnectionType),
                ("connectionType", connection.ConnectionType),
                ("sourceKind", "connection")
            };
            foreach (var itemId in itemIds)
            {
                filterTokens.Add(("infoId", itemId.ToString()));
                if (infoTypes.TryGetValue(itemId, out var itemType))
                {
                    filterTokens.Add(("infoType", itemType));
                    if (itemType == "language")
                    {
                        filterTokens.Add(("languageId", itemId.ToString()));
                    }
                }
            }

            if (connection.ConnectionType == "translation")
            {
                var translationWordIds = itemIds.Where(id => infoTypes.TryGetValue(id, out var itemType) && itemType == "word").Take(2).ToList();
                if (translationWordIds.Count > 0 && wordLanguageMap.TryGetValue(translationWordIds[0], out var languageAId))
                {
                    filterTokens.Add(("languageAId", languageAId.ToString()));
                    filterTokens.Add(("languageId", languageAId.ToString()));
                }
                if (translationWordIds.Count > 1 && wordLanguageMap.TryGetValue(translationWordIds[1], out var languageBId))
                {
                    filterTokens.Add(("languageBId", languageBId.ToString()));
                    filterTokens.Add(("languageId", languageBId.ToString()));
                }
            }

            if (connection.ConnectionType == "reference")
            {
                var sourceInfoId = itemIds.FirstOrDefault(id => infoTypes.TryGetValue(id, out var itemType) && itemType == "source");
                if (sourceInfoId != Guid.Empty && infoPayloads.TryGetValue(sourceInfoId, out var sourcePayload))
                {
                    if (sourcePayload.ValueKind == JsonValueKind.Object &&
                        sourcePayload.TryGetProperty("sourceKind", out var sourceKind) &&
                        sourceKind.ValueKind == JsonValueKind.String &&
                        !string.IsNullOrWhiteSpace(sourceKind.GetString()))
                    {
                        filterTokens.Add(("referenceType", sourceKind.GetString()!));
                    }
                }
            }

            documents.Add(new CogitaEntitySearchDocument
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                SourceKind = "connection",
                SourceId = connection.Id,
                EntityKind = "connection",
                EntityType = connection.ConnectionType,
                InfoId = null,
                ConnectionId = connection.Id,
                Title = title,
                TitleNormalized = NormalizeLabel(title),
                Summary = connection.ConnectionType,
                SearchTextNormalized = NormalizeSearchText($"{title} {connection.ConnectionType} {payloadText} {string.Join(' ', itemLabels)}"),
                FilterTextNormalized = BuildFilterText(filterTokens),
                SourceUpdatedUtc = connection.UpdatedUtc,
                UpdatedUtc = now
            });
        }

        var existingRows = await dbContext.CogitaEntitySearchDocuments
            .Where(x => x.LibraryId == libraryId)
            .ToListAsync(ct);
        if (existingRows.Count > 0)
        {
            dbContext.CogitaEntitySearchDocuments.RemoveRange(existingRows);
        }
        if (documents.Count > 0)
        {
            dbContext.CogitaEntitySearchDocuments.AddRange(documents);
        }
        await dbContext.SaveChangesAsync(ct);
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

        var sanitizedPayload = SanitizePayloadForInfoType(infoType, request.Payload);
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
        await UpsertInfoLinksAsync(
            library.Id,
            infoId,
            infoType,
            request.Links,
            now,
            dbContext,
            ct);
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
                case "source.info.all":
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
                    return list.Select(id => (object?)EvaluateNode(id)).ToList();
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
                        list = allInputs.Select(id => (object?)EvaluateNode(id)).ToList();
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
            .Where(n =>
                n.NodeType.Trim().Equals("source.info", StringComparison.OrdinalIgnoreCase) ||
                n.NodeType.Trim().Equals("source.info.all", StringComparison.OrdinalIgnoreCase))
            .Select(n => n.Id)
            .ToList();
        if (infoNodeIds.Count == 0)
        {
            return result;
        }

        foreach (var nodeId in infoNodeIds)
        {
            var node = nodes.FirstOrDefault(n => n.Id == nodeId);
            var nodeType = node?.NodeType.Trim().ToLowerInvariant();
            if (nodeType == "source.info.all")
            {
                var allInfoIds = await dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId)
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                result[nodeId] = allInfoIds.ToHashSet();
                continue;
            }

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
                var query = dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId);
                if (!infoType.Equals("all", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(x => x.InfoType == infoType);
                }
                var ids = await query
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                result[nodeId] = ids.ToHashSet();
            }
            else
            {
                var ids = await dbContext.CogitaInfos.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId)
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                result[nodeId] = ids.ToHashSet();
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

        var infoResponses = new Dictionary<Guid, List<CogitaCardSearchResponse>>();

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

                infoResponses[entry.InfoId] = BuildInfoCardResponses(entry.InfoId, entry.InfoType, label, description, doc.RootElement.Clone());
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
                    orderedResponses.AddRange(response);
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

    private static List<CogitaCardSearchResponse> BuildInfoCardResponses(
        Guid infoId,
        string infoType,
        string label,
        string description,
        JsonElement? payload = null)
    {
        if (string.Equals(infoType, "word", StringComparison.OrdinalIgnoreCase))
        {
            return new List<CogitaCardSearchResponse>
            {
                new CogitaCardSearchResponse(infoId, "info", label, description, infoType, "word-language", "word-to-language")
            };
        }

        if (string.Equals(infoType, "citation", StringComparison.OrdinalIgnoreCase))
        {
            return new List<CogitaCardSearchResponse>
            {
                new CogitaCardSearchResponse(infoId, "info", label, description, infoType, "info", "forward"),
                new CogitaCardSearchResponse(infoId, "info", label, description, infoType, "info", "reverse")
            };
        }

        if (string.Equals(infoType, "computed", StringComparison.OrdinalIgnoreCase))
        {
            return new List<CogitaCardSearchResponse>
            {
                new CogitaCardSearchResponse(infoId, "info", label, description, infoType, "computed", null)
            };
        }

        if (string.Equals(infoType, "question", StringComparison.OrdinalIgnoreCase))
        {
            return new List<CogitaCardSearchResponse>
            {
                new CogitaCardSearchResponse(infoId, "info", label, description, infoType, "question", null, payload)
            };
        }

        // No generic fallback card: infos without explicit checkcard definitions are ignored by revisions.
        return new List<CogitaCardSearchResponse>();
    }

    private static byte[] HashToken(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
        return SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
    }

    private static async Task<string> ComputeLiveSessionStateHashAsync(
        CogitaLiveRevisionSession session,
        Guid? participantId,
        string? participantToken,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var participantAggregate = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                MaxUpdatedUtc = g.Max(x => (DateTimeOffset?)x.UpdatedUtc)
            })
            .FirstOrDefaultAsync(ct);

        var answerAggregate = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                MaxUpdatedUtc = g.Max(x => (DateTimeOffset?)x.UpdatedUtc)
            })
            .FirstOrDefaultAsync(ct);

        var participantAnswerAggregate = participantId.HasValue
            ? await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
                .Where(x => x.SessionId == session.Id && x.ParticipantId == participantId.Value)
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    Count = g.Count(),
                    MaxUpdatedUtc = g.Max(x => (DateTimeOffset?)x.UpdatedUtc)
                })
                .FirstOrDefaultAsync(ct)
            : null;

        var reloginAggregate = await dbContext.CogitaLiveRevisionReloginRequests.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                MaxUpdatedUtc = g.Max(x => (DateTimeOffset?)x.UpdatedUtc)
            })
            .FirstOrDefaultAsync(ct);

        var eventMaxUtc = await dbContext.CogitaStatisticEvents.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .MaxAsync(x => (DateTimeOffset?)x.CreatedUtc, ct);

        var tokenHash = string.IsNullOrWhiteSpace(participantToken)
            ? "-"
            : Convert.ToHexString(HashToken(participantToken));
        var promptHash = string.IsNullOrWhiteSpace(session.CurrentPromptJson)
            ? "-"
            : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(session.CurrentPromptJson)));
        var revealHash = string.IsNullOrWhiteSpace(session.CurrentRevealJson)
            ? "-"
            : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(session.CurrentRevealJson)));

        var fingerprint = string.Join("|",
            session.Id.ToString("D"),
            session.Status,
            session.CurrentRoundIndex.ToString(CultureInfo.InvariantCulture),
            session.RevealVersion.ToString(CultureInfo.InvariantCulture),
            session.UpdatedUtc.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture),
            session.StartedUtc?.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture) ?? "-",
            session.FinishedUtc?.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture) ?? "-",
            participantAggregate?.Count.ToString(CultureInfo.InvariantCulture) ?? "0",
            participantAggregate?.MaxUpdatedUtc?.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture) ?? "-",
            answerAggregate?.Count.ToString(CultureInfo.InvariantCulture) ?? "0",
            answerAggregate?.MaxUpdatedUtc?.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture) ?? "-",
            participantId?.ToString("D") ?? "-",
            participantAnswerAggregate?.Count.ToString(CultureInfo.InvariantCulture) ?? "0",
            participantAnswerAggregate?.MaxUpdatedUtc?.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture) ?? "-",
            reloginAggregate?.Count.ToString(CultureInfo.InvariantCulture) ?? "0",
            reloginAggregate?.MaxUpdatedUtc?.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture) ?? "-",
            eventMaxUtc?.UtcDateTime.Ticks.ToString(CultureInfo.InvariantCulture) ?? "-",
            promptHash,
            revealHash,
            tokenHash);

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(fingerprint)));
    }

    private static bool RequestMatchesLiveStateHash(HttpContext context, string stateHash)
    {
        var ifNoneMatch = context.Request.Headers.IfNoneMatch.ToString();
        if (string.IsNullOrWhiteSpace(ifNoneMatch))
        {
            return false;
        }

        foreach (var token in ifNoneMatch.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (token == "*")
            {
                return true;
            }

            var normalized = token;
            if (normalized.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized[2..].Trim();
            }

            if (normalized.Length >= 2 && normalized[0] == '"' && normalized[^1] == '"')
            {
                normalized = normalized[1..^1];
            }

            if (string.Equals(normalized, stateHash, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static void SetLiveStateHashHeaders(HttpContext context, string stateHash)
    {
        context.Response.Headers.ETag = $"\"{stateHash}\"";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.Headers["X-Cogita-State-Hash"] = stateHash;
    }

    private static bool MatchesTokenHash(string? value, byte[] hash)
    {
        if (hash.Length == 0)
        {
            return false;
        }

        var actual = HashToken(value);
        return actual.Length == hash.Length && CryptographicOperations.FixedTimeEquals(actual, hash);
    }

    private static bool MatchesStoredLiveName(string? storedName, byte[]? storedNameHash, string? requestedName, byte[]? requestedNameHash)
    {
        if (storedNameHash is { Length: > 0 } && requestedNameHash is { Length: > 0 })
        {
            return storedNameHash.Length == requestedNameHash.Length &&
                   CryptographicOperations.FixedTimeEquals(storedNameHash, requestedNameHash);
        }

        if (string.IsNullOrWhiteSpace(storedName) || string.IsNullOrWhiteSpace(requestedName))
        {
            return false;
        }

        return string.Equals(storedName.Trim(), requestedName.Trim(), StringComparison.Ordinal);
    }

    private static string GenerateAlphaNumericCode(int length)
    {
        if (length <= 0)
        {
            return string.Empty;
        }

        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var chars = new char[length];
        var bytes = RandomNumberGenerator.GetBytes(length);
        for (var i = 0; i < length; i++)
        {
            chars[i] = alphabet[bytes[i] % alphabet.Length];
        }
        return new string(chars);
    }

    private static string BuildLiveSessionMetaJson(
        string? title,
        string revisionName,
        string? sessionMode,
        string? hostViewMode,
        string? participantViewMode,
        string? sessionSettingsJson,
        string? encryptedPublicCode)
    {
        var cleanTitle = string.IsNullOrWhiteSpace(title) ? null : title.Trim();
        var cleanSessionMode = NormalizeLiveSessionMode(sessionMode);
        var cleanHostViewMode = string.IsNullOrWhiteSpace(hostViewMode) ? "panel" : hostViewMode.Trim().ToLowerInvariant();
        var cleanParticipantViewMode = string.IsNullOrWhiteSpace(participantViewMode) ? "question" : participantViewMode.Trim().ToLowerInvariant();

        object? sessionSettings = null;
        if (!string.IsNullOrWhiteSpace(sessionSettingsJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(sessionSettingsJson);
                sessionSettings = doc.RootElement.Clone();
            }
            catch (JsonException)
            {
                sessionSettings = null;
            }
        }

        return JsonSerializer.Serialize(new
        {
            title = cleanTitle,
            revisionName,
            sessionMode = cleanSessionMode,
            hostViewMode = cleanHostViewMode,
            participantViewMode = cleanParticipantViewMode,
            sessionSettings,
            encryptedPublicCode = string.IsNullOrWhiteSpace(encryptedPublicCode) ? null : encryptedPublicCode
        });
    }

    private static (string? Title, string SessionMode, string? HostViewMode, string? ParticipantViewMode, JsonElement? SessionSettings, string? EncryptedPublicCode) ParseLiveSessionMeta(string? sessionMetaJson)
    {
        if (string.IsNullOrWhiteSpace(sessionMetaJson))
        {
            return (null, "simultaneous", "panel", "question", null, null);
        }

        try
        {
            using var doc = JsonDocument.Parse(sessionMetaJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return (null, "simultaneous", "panel", "question", null, null);
            }

            string? title = null;
            if (doc.RootElement.TryGetProperty("title", out var titleElement) && titleElement.ValueKind == JsonValueKind.String)
            {
                var parsed = titleElement.GetString();
                title = string.IsNullOrWhiteSpace(parsed) ? null : parsed.Trim();
            }

            var sessionMode = "simultaneous";
            if (doc.RootElement.TryGetProperty("sessionMode", out var sessionModeElement) && sessionModeElement.ValueKind == JsonValueKind.String)
            {
                sessionMode = NormalizeLiveSessionMode(sessionModeElement.GetString());
            }

            string? hostViewMode = "panel";
            if (doc.RootElement.TryGetProperty("hostViewMode", out var hostViewModeElement) && hostViewModeElement.ValueKind == JsonValueKind.String)
            {
                hostViewMode = string.IsNullOrWhiteSpace(hostViewModeElement.GetString()) ? "panel" : hostViewModeElement.GetString()?.Trim().ToLowerInvariant();
            }

            string? participantViewMode = "question";
            if (doc.RootElement.TryGetProperty("participantViewMode", out var participantViewModeElement) && participantViewModeElement.ValueKind == JsonValueKind.String)
            {
                participantViewMode = string.IsNullOrWhiteSpace(participantViewModeElement.GetString()) ? "question" : participantViewModeElement.GetString()?.Trim().ToLowerInvariant();
            }

            JsonElement? sessionSettings = null;
            if (doc.RootElement.TryGetProperty("sessionSettings", out var sessionSettingsElement))
            {
                sessionSettings = sessionSettingsElement.Clone();
            }

            string? encryptedPublicCode = null;
            if (doc.RootElement.TryGetProperty("encryptedPublicCode", out var encryptedPublicCodeElement) &&
                encryptedPublicCodeElement.ValueKind == JsonValueKind.String)
            {
                var parsed = encryptedPublicCodeElement.GetString();
                encryptedPublicCode = string.IsNullOrWhiteSpace(parsed) ? null : parsed.Trim();
            }

            return (title, sessionMode, hostViewMode, participantViewMode, sessionSettings, encryptedPublicCode);
        }
        catch (JsonException)
        {
            return (null, "simultaneous", "panel", "question", null, null);
        }
    }

    private static string EncryptLiveSessionPublicCode(string code, IDataProtectionProvider dataProtectionProvider)
    {
        var protector = dataProtectionProvider.CreateProtector("Cogita.LiveSession.PublicCode.v1");
        return protector.Protect(code);
    }

    private static string? TryDecryptLiveSessionPublicCode(string? encryptedPublicCode, IDataProtectionProvider dataProtectionProvider)
    {
        if (string.IsNullOrWhiteSpace(encryptedPublicCode))
        {
            return null;
        }

        try
        {
            var protector = dataProtectionProvider.CreateProtector("Cogita.LiveSession.PublicCode.v1");
            var code = protector.Unprotect(encryptedPublicCode);
            if (string.IsNullOrWhiteSpace(code))
            {
                return null;
            }

            return code.Trim();
        }
        catch
        {
            return null;
        }
    }

    private static string UpsertLiveSessionMetaEncryptedPublicCode(string? sessionMetaJson, string encryptedPublicCode)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(sessionMetaJson))
            {
                var node = JsonNode.Parse(sessionMetaJson);
                if (node is JsonObject obj)
                {
                    obj["encryptedPublicCode"] = encryptedPublicCode;
                    return obj.ToJsonString();
                }
            }
        }
        catch
        {
            // ignore malformed meta and create minimal object below
        }

        return JsonSerializer.Serialize(new { encryptedPublicCode });
    }

    private static string NormalizeLiveSessionMode(string? raw)
    {
        var value = string.IsNullOrWhiteSpace(raw) ? "simultaneous" : raw.Trim().ToLowerInvariant();
        return value is "asynchronous" or "simultaneous" ? value : "simultaneous";
    }

    private static string? NormalizeLiveParticipantName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var value = raw.Trim();
        if (value.Length > 120)
        {
            value = value[..120];
        }

        return value;
    }

    private static JsonElement? ParseJsonNullable(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private sealed record LiveAsyncRoundPayload(int RoundIndex, string CardKey, JsonObject Prompt, JsonObject Reveal);
    private sealed record LiveSyncRoundPayload(int RoundIndex, string CardKey, JsonObject Prompt, JsonObject Reveal);
    private sealed record LiveAsyncDependencyEdge(int ParentRoundIndex, int ChildRoundIndex);

    private sealed record LiveSessionScoringRules(
        int BaseCorrect,
        string FirstBonusMode,
        int FirstCorrectBonus,
        int WrongAnswerPenalty,
        string FirstWrongPenaltyMode,
        int FirstWrongPenalty,
        int StreakBaseBonus,
        string StreakGrowth,
        int StreakLimit,
        int WrongStreakBasePenalty,
        string WrongStreakGrowth,
        int WrongStreakLimit,
        bool BonusTimerEnabled,
        int BonusTimerSeconds,
        string BonusTimerStartMode,
        bool SpeedBonusEnabled,
        int SpeedBonusMaxPoints,
        string SpeedBonusGrowth);

    private sealed record LiveSessionFlowRules(
        bool RoundTimerEnabled,
        int RoundTimerSeconds,
        string NextQuestionMode,
        int NextQuestionSeconds,
        bool SessionTimerEnabled,
        int SessionTimerSeconds);

    private sealed record LiveAsyncParticipantState(
        int RoundIndex,
        string Phase,
        DateTimeOffset SessionStartedUtc,
        DateTimeOffset RoundStartedUtc,
        DateTimeOffset? RoundEndsUtc,
        DateTimeOffset? RevealStartedUtc,
        DateTimeOffset? AutoNextEndsUtc,
        double SessionElapsedSeconds,
        double RoundElapsedSeconds,
        CogitaLiveRevisionAnswer? Answer,
        bool TimerPaused,
        string? TimerPauseSource,
        DateTimeOffset? TimerPauseStartedUtc);

    private sealed record LiveAsyncTimerControlEvent(
        DateTimeOffset CreatedUtc,
        string Action,
        int? RoundIndex,
        string? Source);

    private static List<LiveAsyncRoundPayload> ParseLiveAsyncRoundBundle(string? promptJson)
    {
        if (string.IsNullOrWhiteSpace(promptJson))
        {
            return new List<LiveAsyncRoundPayload>();
        }

        try
        {
            var root = JsonNode.Parse(promptJson) as JsonObject;
            if (root is null)
            {
                return new List<LiveAsyncRoundPayload>();
            }

            var kind = root["kind"]?.GetValue<string>()?.Trim().ToLowerInvariant();
            if (!string.Equals(kind, "async-session", StringComparison.Ordinal))
            {
                return new List<LiveAsyncRoundPayload>();
            }

            var roundsNode = root["rounds"] as JsonArray;
            if (roundsNode is null || roundsNode.Count == 0)
            {
                return new List<LiveAsyncRoundPayload>();
            }

            var rounds = new List<LiveAsyncRoundPayload>();
            for (var index = 0; index < roundsNode.Count; index++)
            {
                var roundNode = roundsNode[index] as JsonObject;
                if (roundNode is null)
                {
                    continue;
                }

                var cardKey = roundNode["cardKey"]?.GetValue<string>()?.Trim();
                var prompt = roundNode["prompt"] as JsonObject;
                var reveal = roundNode["reveal"] as JsonObject;
                if (string.IsNullOrWhiteSpace(cardKey) || prompt is null || reveal is null)
                {
                    continue;
                }

                var roundIndex = index;
                if (roundNode["roundIndex"] is JsonValue roundIndexValue &&
                    roundIndexValue.TryGetValue<int>(out var parsedRoundIndex))
                {
                    roundIndex = parsedRoundIndex;
                }
                rounds.Add(new LiveAsyncRoundPayload(
                    Math.Max(0, roundIndex),
                    cardKey,
                    CloneJsonObject(prompt),
                    CloneJsonObject(reveal)));
            }

            var ordered = rounds
                .OrderBy(x => x.RoundIndex)
                .ThenBy(x => x.CardKey, StringComparer.Ordinal)
                .ToList();

            // Normalize round indexes to a strict 0..N-1 sequence for resilience against malformed payloads.
            for (var i = 0; i < ordered.Count; i++)
            {
                if (ordered[i].RoundIndex != i)
                {
                    ordered[i] = ordered[i] with { RoundIndex = i };
                }
            }

            return ordered;
        }
        catch
        {
            return new List<LiveAsyncRoundPayload>();
        }
    }

    private static string ParseLiveAsyncRevisionMode(string? promptJson)
    {
        if (string.IsNullOrWhiteSpace(promptJson))
        {
            return "random";
        }

        try
        {
            var root = JsonNode.Parse(promptJson) as JsonObject;
            var mode = root?["revisionMode"]?.GetValue<string>()?.Trim().ToLowerInvariant();
            return string.IsNullOrWhiteSpace(mode) ? "random" : mode;
        }
        catch
        {
            return "random";
        }
    }

    private static (bool ConsiderDependencies, int DependencyThreshold) ParseLiveAsyncDependencyOptions(string? promptJson)
    {
        var considerDependencies = true;
        var dependencyThreshold = 80;
        if (string.IsNullOrWhiteSpace(promptJson))
        {
            return (considerDependencies, dependencyThreshold);
        }

        try
        {
            var root = JsonNode.Parse(promptJson) as JsonObject;
            var settings = root?["revisionSettings"] as JsonObject;
            if (settings is null)
            {
                return (considerDependencies, dependencyThreshold);
            }

            if (settings["considerDependencies"] is JsonValue considerValue)
            {
                if (considerValue.TryGetValue<bool>(out var boolValue))
                {
                    considerDependencies = boolValue;
                }
                else if (considerValue.TryGetValue<string>(out var stringValue))
                {
                    var normalized = stringValue.Trim().ToLowerInvariant();
                    considerDependencies = normalized is not ("off" or "false" or "0" or "no");
                }
            }

            if (settings["dependencyThreshold"] is JsonValue thresholdValue)
            {
                if (thresholdValue.TryGetValue<int>(out var intValue))
                {
                    dependencyThreshold = intValue;
                }
                else if (thresholdValue.TryGetValue<double>(out var doubleValue))
                {
                    dependencyThreshold = (int)Math.Round(doubleValue);
                }
                else if (thresholdValue.TryGetValue<string>(out var stringValue) &&
                         int.TryParse(stringValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
                {
                    dependencyThreshold = parsed;
                }
            }
        }
        catch
        {
            // Keep defaults on malformed payload.
        }

        dependencyThreshold = Math.Max(0, Math.Min(100, dependencyThreshold));
        return (considerDependencies, dependencyThreshold);
    }

    private static string? NormalizeDependencyToken(string? value)
    {
        var trimmed = value?.Trim().ToLowerInvariant();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static bool MatchesRoundDependencyIdentity(
        (string? ItemType, Guid? ItemId, string? CheckType, string? Direction) identity,
        string itemType,
        Guid itemId,
        string? checkType,
        string? direction)
    {
        if (!identity.ItemId.HasValue || identity.ItemId.Value != itemId)
        {
            return false;
        }

        var targetType = NormalizeDependencyToken(itemType);
        var cardType = NormalizeDependencyToken(identity.ItemType);
        if (targetType is not null && targetType != cardType)
        {
            return false;
        }

        var targetCheckType = NormalizeDependencyToken(checkType);
        var targetDirection = NormalizeDependencyToken(direction);
        var cardCheckType = NormalizeDependencyToken(identity.CheckType);
        var cardDirection = NormalizeDependencyToken(identity.Direction);
        if (targetCheckType is not null && targetCheckType != cardCheckType)
        {
            return false;
        }
        if (targetDirection is not null && targetDirection != cardDirection)
        {
            return false;
        }

        return true;
    }

    private static async Task<List<LiveAsyncDependencyEdge>> BuildLiveAsyncDependencyEdgesAsync(
        Guid libraryId,
        List<LiveAsyncRoundPayload> rounds,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (rounds.Count == 0)
        {
            return new List<LiveAsyncDependencyEdge>();
        }

        var roundIdentities = rounds
            .Select((round, index) => new
            {
                Index = index,
                Identity = ParseCardIdentityFromCardKey(round.CardKey)
            })
            .Where(x => x.Identity.ItemId.HasValue && !string.IsNullOrWhiteSpace(x.Identity.ItemType))
            .ToList();
        if (roundIdentities.Count == 0)
        {
            return new List<LiveAsyncDependencyEdge>();
        }

        var activeGraphId = await ResolveActiveDependencyGraphIdAsync(libraryId, dbContext, ct);
        var dependencies = await dbContext.CogitaItemDependencies.AsNoTracking()
            .Where(x => x.LibraryId == libraryId &&
                        (x.GraphId == null || (activeGraphId.HasValue && x.GraphId == activeGraphId.Value)))
            .ToListAsync(ct);
        if (dependencies.Count == 0)
        {
            return new List<LiveAsyncDependencyEdge>();
        }

        var result = new List<LiveAsyncDependencyEdge>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var dependency in dependencies)
        {
            var parentIndexes = roundIdentities
                .Where(x => MatchesRoundDependencyIdentity(
                    x.Identity,
                    dependency.ParentItemType,
                    dependency.ParentItemId,
                    dependency.ParentCheckType,
                    dependency.ParentDirection))
                .Select(x => x.Index)
                .Distinct()
                .ToList();
            if (parentIndexes.Count == 0)
            {
                continue;
            }

            var childIndexes = roundIdentities
                .Where(x => MatchesRoundDependencyIdentity(
                    x.Identity,
                    dependency.ChildItemType,
                    dependency.ChildItemId,
                    dependency.ChildCheckType,
                    dependency.ChildDirection))
                .Select(x => x.Index)
                .Distinct()
                .ToList();
            if (childIndexes.Count == 0)
            {
                continue;
            }

            foreach (var parentIndex in parentIndexes)
            {
                foreach (var childIndex in childIndexes)
                {
                    if (parentIndex == childIndex)
                    {
                        continue;
                    }

                    var key = $"{parentIndex}:{childIndex}";
                    if (!seen.Add(key))
                    {
                        continue;
                    }

                    result.Add(new LiveAsyncDependencyEdge(parentIndex, childIndex));
                }
            }
        }

        return result;
    }

    private static JsonObject? ParseJsonObjectSafe(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            return JsonNode.Parse(raw) as JsonObject;
        }
        catch
        {
            return null;
        }
    }

    private static List<LiveSyncRoundPayload> BuildLiveSyncRoundBundle(
        List<CogitaStatisticEvent> roundEvents,
        string? currentPromptJson,
        string? currentRevealJson,
        int currentRoundIndex)
    {
        var orderedEvents = roundEvents
            .OrderBy(x => x.CreatedUtc)
            .ThenBy(x => x.Id)
            .ToList();
        var publishedEvents = orderedEvents
            .Where(x => string.Equals(x.EventType, "live_round_published", StringComparison.Ordinal))
            .ToList();
        var revealedEvents = orderedEvents
            .Where(x => string.Equals(x.EventType, "live_round_revealed", StringComparison.Ordinal))
            .ToList();

        var usedRevealIds = new HashSet<Guid>();
        var result = new List<LiveSyncRoundPayload>(publishedEvents.Count + 1);

        for (var sequenceIndex = 0; sequenceIndex < publishedEvents.Count; sequenceIndex++)
        {
            var publishEvent = publishedEvents[sequenceIndex];
            var promptNode = ParseJsonObjectSafe(publishEvent.PayloadJson);
            if (promptNode is null)
            {
                continue;
            }

            var roundIndex = publishEvent.RoundIndex.HasValue
                ? Math.Max(0, publishEvent.RoundIndex.Value)
                : sequenceIndex;

            var cardKey = promptNode["cardKey"]?.GetValue<string>()?.Trim();
            if (string.IsNullOrWhiteSpace(cardKey) && !string.IsNullOrWhiteSpace(publishEvent.CardKey))
            {
                cardKey = publishEvent.CardKey.Trim();
                promptNode["cardKey"] = cardKey;
            }
            cardKey ??= $"round-{roundIndex}";

            var nextPublishCreatedUtc = sequenceIndex + 1 < publishedEvents.Count
                ? publishedEvents[sequenceIndex + 1].CreatedUtc
                : DateTimeOffset.MaxValue;

            // Match reveal by chronological round window to support non-monotonic round indexes.
            CogitaStatisticEvent? matchedRevealEvent = revealedEvents
                .FirstOrDefault(x =>
                    !usedRevealIds.Contains(x.Id) &&
                    x.CreatedUtc >= publishEvent.CreatedUtc &&
                    x.CreatedUtc < nextPublishCreatedUtc);

            matchedRevealEvent ??= revealedEvents
                .FirstOrDefault(x =>
                    !usedRevealIds.Contains(x.Id) &&
                    x.CreatedUtc >= publishEvent.CreatedUtc);

            JsonObject revealNode;
            if (matchedRevealEvent is not null)
            {
                usedRevealIds.Add(matchedRevealEvent.Id);
                revealNode = ParseJsonObjectSafe(matchedRevealEvent.PayloadJson) ?? new JsonObject();
            }
            else
            {
                revealNode = new JsonObject();
            }

            revealNode["cardKey"] = cardKey;
            if (revealNode["kind"] is null && promptNode["kind"] is not null)
            {
                revealNode["kind"] = JsonNode.Parse(promptNode["kind"]!.ToJsonString());
            }
            if (revealNode["expected"] is null)
            {
                revealNode["expected"] = promptNode["expected"] is not null
                    ? JsonNode.Parse(promptNode["expected"]!.ToJsonString())
                    : JsonValue.Create(string.Empty);
            }

            result.Add(new LiveSyncRoundPayload(
                roundIndex,
                cardKey,
                CloneJsonObject(promptNode),
                CloneJsonObject(revealNode)));
        }

        // Fallback only when no published rounds were reconstructed.
        if (result.Count == 0)
        {
            var currentPromptNode = ParseJsonObjectSafe(currentPromptJson);
            if (currentPromptNode is not null)
            {
                var currentCardKey = currentPromptNode["cardKey"]?.GetValue<string>()?.Trim();
                currentCardKey ??= $"round-{Math.Max(0, currentRoundIndex)}";
                var currentRevealNode = ParseJsonObjectSafe(currentRevealJson) ?? new JsonObject();
                currentRevealNode["cardKey"] = currentCardKey;
                if (currentRevealNode["kind"] is null && currentPromptNode["kind"] is not null)
                {
                    currentRevealNode["kind"] = JsonNode.Parse(currentPromptNode["kind"]!.ToJsonString());
                }
                if (currentRevealNode["expected"] is null)
                {
                    currentRevealNode["expected"] = currentPromptNode["expected"] is not null
                        ? JsonNode.Parse(currentPromptNode["expected"]!.ToJsonString())
                        : JsonValue.Create(string.Empty);
                }
                result.Add(new LiveSyncRoundPayload(
                    Math.Max(0, currentRoundIndex),
                    currentCardKey,
                    CloneJsonObject(currentPromptNode),
                    CloneJsonObject(currentRevealNode)));
            }
        }

        return result;
    }

    private static JsonObject CloneJsonObject(JsonObject source)
    {
        return (JsonNode.Parse(source.ToJsonString()) as JsonObject) ?? new JsonObject();
    }

    private static JsonElement? JsonNodeToJsonElement(JsonNode? node)
    {
        if (node is null)
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(node.ToJsonString());
            return doc.RootElement.Clone();
        }
        catch
        {
            return null;
        }
    }

    private static async Task<List<LiveAsyncTimerControlEvent>> LoadLiveAsyncTimerEventsAsync(
        Guid sessionId,
        Guid participantId,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var events = await dbContext.CogitaStatisticEvents.AsNoTracking()
            .Where(x =>
                x.SessionId == sessionId &&
                x.ParticipantId == participantId &&
                (x.EventType == "live_async_timer_paused" || x.EventType == "live_async_timer_resumed"))
            .OrderBy(x => x.CreatedUtc)
            .Select(x => new LiveAsyncTimerControlEvent(
                x.CreatedUtc,
                x.EventType == "live_async_timer_paused" ? "pause" : "resume",
                x.RoundIndex,
                ExtractLiveTimerEventSource(x.PayloadJson)))
            .ToListAsync(ct);
        return events;
    }

    private static string? ExtractLiveTimerEventSource(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            if (document.RootElement.ValueKind == JsonValueKind.Object &&
                document.RootElement.TryGetProperty("source", out var sourceElement) &&
                sourceElement.ValueKind == JsonValueKind.String)
            {
                var source = sourceElement.GetString()?.Trim().ToLowerInvariant();
                return string.IsNullOrWhiteSpace(source) ? null : source;
            }
        }
        catch
        {
            // Ignore malformed payload.
        }

        return null;
    }

    private static LiveSessionScoringRules ParseLiveSessionScoringRules(JsonElement? sessionSettings)
    {
        var defaults = new LiveSessionScoringRules(
            BaseCorrect: 1000,
            FirstBonusMode: "first_answer",
            FirstCorrectBonus: 500,
            WrongAnswerPenalty: 0,
            FirstWrongPenaltyMode: "first_overall_answer",
            FirstWrongPenalty: 0,
            StreakBaseBonus: 1000,
            StreakGrowth: "limited",
            StreakLimit: 5,
            WrongStreakBasePenalty: 0,
            WrongStreakGrowth: "limited",
            WrongStreakLimit: 5,
            BonusTimerEnabled: true,
            BonusTimerSeconds: 10,
            BonusTimerStartMode: "first_answer",
            SpeedBonusEnabled: true,
            SpeedBonusMaxPoints: 500,
            SpeedBonusGrowth: "exponential");
        if (sessionSettings is null)
        {
            return defaults;
        }

        JsonElement root = sessionSettings.Value;
        JsonElement liveRulesRoot = root;
        if (root.ValueKind == JsonValueKind.Object &&
            root.TryGetProperty("liveRules", out var nestedLiveRules) &&
            nestedLiveRules.ValueKind == JsonValueKind.Object)
        {
            liveRulesRoot = nestedLiveRules;
        }

        if (liveRulesRoot.ValueKind != JsonValueKind.Object)
        {
            return defaults;
        }

        static int ReadInt(JsonElement element, string propertyName, int fallback, int min, int max)
        {
            if (element.TryGetProperty(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var parsed))
                {
                    return Math.Max(min, Math.Min(max, parsed));
                }
                if (value.ValueKind == JsonValueKind.String &&
                    int.TryParse(value.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedFromString))
                {
                    return Math.Max(min, Math.Min(max, parsedFromString));
                }
            }
            return fallback;
        }

        static bool ReadBool(JsonElement element, string propertyName, bool fallback)
        {
            if (element.TryGetProperty(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False)
                {
                    return value.GetBoolean();
                }
                if (value.ValueKind == JsonValueKind.String &&
                    bool.TryParse(value.GetString(), out var parsed))
                {
                    return parsed;
                }
            }
            return fallback;
        }

        static string ReadString(JsonElement element, string propertyName, string fallback, string[] allowed)
        {
            if (element.TryGetProperty(propertyName, out var value) &&
                value.ValueKind == JsonValueKind.String)
            {
                var candidate = value.GetString()?.Trim().ToLowerInvariant();
                if (!string.IsNullOrWhiteSpace(candidate) &&
                    allowed.Any(option => string.Equals(option, candidate, StringComparison.Ordinal)))
                {
                    return candidate;
                }
            }
            return fallback;
        }

        var scoringRoot = liveRulesRoot.TryGetProperty("scoring", out var scoringElement) && scoringElement.ValueKind == JsonValueKind.Object
            ? scoringElement
            : default;
        var bonusTimerRoot = liveRulesRoot.TryGetProperty("bonusTimer", out var bonusTimerElement) && bonusTimerElement.ValueKind == JsonValueKind.Object
            ? bonusTimerElement
            : default;
        var speedBonusRoot = liveRulesRoot.TryGetProperty("speedBonus", out var speedBonusElement) && speedBonusElement.ValueKind == JsonValueKind.Object
            ? speedBonusElement
            : default;

        var baseCorrect = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "baseCorrect", defaults.BaseCorrect, 0, 500000)
            : defaults.BaseCorrect;
        var firstBonusMode = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadString(scoringRoot, "firstBonusMode", defaults.FirstBonusMode, new[] { "first_answer", "first_correct" })
            : defaults.FirstBonusMode;
        var firstCorrectBonus = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "firstCorrectBonus", defaults.FirstCorrectBonus, 0, 500000)
            : defaults.FirstCorrectBonus;
        var wrongAnswerPenalty = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "wrongAnswerPenalty", defaults.WrongAnswerPenalty, 0, 500000)
            : defaults.WrongAnswerPenalty;
        var firstWrongPenaltyMode = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadString(scoringRoot, "firstWrongPenaltyMode", defaults.FirstWrongPenaltyMode, new[] { "first_overall_answer", "first_wrong" })
            : defaults.FirstWrongPenaltyMode;
        var firstWrongPenalty = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "firstWrongPenalty", defaults.FirstWrongPenalty, 0, 500000)
            : defaults.FirstWrongPenalty;
        var streakBaseBonus = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "streakBaseBonus", defaults.StreakBaseBonus, 0, 500000)
            : defaults.StreakBaseBonus;
        var streakLimit = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "streakLimit", defaults.StreakLimit, 1, 200)
            : defaults.StreakLimit;
        var streakGrowth = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadString(scoringRoot, "streakGrowth", defaults.StreakGrowth, new[] { "linear", "exponential", "limited" })
            : defaults.StreakGrowth;
        var wrongStreakBasePenalty = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "wrongStreakBasePenalty", defaults.WrongStreakBasePenalty, 0, 500000)
            : defaults.WrongStreakBasePenalty;
        var wrongStreakGrowth = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadString(scoringRoot, "wrongStreakGrowth", defaults.WrongStreakGrowth, new[] { "linear", "exponential", "limited" })
            : defaults.WrongStreakGrowth;
        var wrongStreakLimit = scoringRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(scoringRoot, "wrongStreakLimit", defaults.WrongStreakLimit, 1, 200)
            : defaults.WrongStreakLimit;

        var bonusTimerEnabled = bonusTimerRoot.ValueKind == JsonValueKind.Object
            ? ReadBool(bonusTimerRoot, "enabled", defaults.BonusTimerEnabled)
            : defaults.BonusTimerEnabled;
        var bonusTimerSeconds = bonusTimerRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(bonusTimerRoot, "seconds", defaults.BonusTimerSeconds, 1, 600)
            : defaults.BonusTimerSeconds;
        var bonusTimerStartMode = bonusTimerRoot.ValueKind == JsonValueKind.Object
            ? ReadString(bonusTimerRoot, "startMode", defaults.BonusTimerStartMode, new[] { "round_start", "first_answer" })
            : defaults.BonusTimerStartMode;

        var speedBonusEnabled = speedBonusRoot.ValueKind == JsonValueKind.Object
            ? ReadBool(speedBonusRoot, "enabled", defaults.SpeedBonusEnabled)
            : defaults.SpeedBonusEnabled;
        var speedBonusMaxPoints = speedBonusRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(speedBonusRoot, "maxPoints", defaults.SpeedBonusMaxPoints, 0, 500000)
            : defaults.SpeedBonusMaxPoints;
        var speedBonusGrowth = speedBonusRoot.ValueKind == JsonValueKind.Object
            ? ReadString(speedBonusRoot, "growth", defaults.SpeedBonusGrowth, new[] { "linear", "exponential", "limited" })
            : defaults.SpeedBonusGrowth;

        return new LiveSessionScoringRules(
            baseCorrect,
            firstBonusMode,
            firstCorrectBonus,
            wrongAnswerPenalty,
            firstWrongPenaltyMode,
            firstWrongPenalty,
            streakBaseBonus,
            streakGrowth,
            streakLimit,
            wrongStreakBasePenalty,
            wrongStreakGrowth,
            wrongStreakLimit,
            bonusTimerEnabled,
            bonusTimerSeconds,
            bonusTimerStartMode,
            speedBonusEnabled,
            speedBonusMaxPoints,
            speedBonusGrowth);
    }

    private static LiveSessionFlowRules ParseLiveSessionFlowRules(JsonElement? sessionSettings)
    {
        var defaults = new LiveSessionFlowRules(
            RoundTimerEnabled: false,
            RoundTimerSeconds: 60,
            NextQuestionMode: "manual",
            NextQuestionSeconds: 6,
            SessionTimerEnabled: false,
            SessionTimerSeconds: 1800);

        if (sessionSettings is null)
        {
            return defaults;
        }

        JsonElement root = sessionSettings.Value;
        JsonElement liveRulesRoot = root;
        if (root.ValueKind == JsonValueKind.Object &&
            root.TryGetProperty("liveRules", out var nestedLiveRules) &&
            nestedLiveRules.ValueKind == JsonValueKind.Object)
        {
            liveRulesRoot = nestedLiveRules;
        }

        if (liveRulesRoot.ValueKind != JsonValueKind.Object)
        {
            return defaults;
        }

        static bool ReadBool(JsonElement element, string propertyName, bool fallback)
        {
            if (element.TryGetProperty(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False)
                {
                    return value.GetBoolean();
                }
                if (value.ValueKind == JsonValueKind.String &&
                    bool.TryParse(value.GetString(), out var parsed))
                {
                    return parsed;
                }
            }
            return fallback;
        }

        static int ReadInt(JsonElement element, string propertyName, int fallback, int min, int max)
        {
            if (element.TryGetProperty(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var parsed))
                {
                    return Math.Max(min, Math.Min(max, parsed));
                }
                if (value.ValueKind == JsonValueKind.String &&
                    int.TryParse(value.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedFromString))
                {
                    return Math.Max(min, Math.Min(max, parsedFromString));
                }
            }
            return fallback;
        }

        var roundTimerRoot = liveRulesRoot.TryGetProperty("roundTimer", out var roundTimerElement) && roundTimerElement.ValueKind == JsonValueKind.Object
            ? roundTimerElement
            : default;
        var nextQuestionRoot = liveRulesRoot.TryGetProperty("nextQuestion", out var nextQuestionElement) && nextQuestionElement.ValueKind == JsonValueKind.Object
            ? nextQuestionElement
            : default;
        var sessionTimerRoot = liveRulesRoot.TryGetProperty("sessionTimer", out var sessionTimerElement) && sessionTimerElement.ValueKind == JsonValueKind.Object
            ? sessionTimerElement
            : default;

        var roundTimerEnabled = roundTimerRoot.ValueKind == JsonValueKind.Object
            ? ReadBool(roundTimerRoot, "enabled", defaults.RoundTimerEnabled)
            : defaults.RoundTimerEnabled;
        var roundTimerSeconds = roundTimerRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(roundTimerRoot, "seconds", defaults.RoundTimerSeconds, 3, 7200)
            : defaults.RoundTimerSeconds;
        var nextQuestionMode = nextQuestionRoot.ValueKind == JsonValueKind.Object &&
                               nextQuestionRoot.TryGetProperty("mode", out var modeElement) &&
                               modeElement.ValueKind == JsonValueKind.String &&
                               string.Equals(modeElement.GetString(), "timer", StringComparison.OrdinalIgnoreCase)
            ? "timer"
            : "manual";
        var nextQuestionSeconds = nextQuestionRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(nextQuestionRoot, "seconds", defaults.NextQuestionSeconds, 1, 600)
            : defaults.NextQuestionSeconds;
        var sessionTimerEnabled = sessionTimerRoot.ValueKind == JsonValueKind.Object
            ? ReadBool(sessionTimerRoot, "enabled", defaults.SessionTimerEnabled)
            : defaults.SessionTimerEnabled;
        var sessionTimerSeconds = sessionTimerRoot.ValueKind == JsonValueKind.Object
            ? ReadInt(sessionTimerRoot, "seconds", defaults.SessionTimerSeconds, 10, 86400)
            : defaults.SessionTimerSeconds;

        return new LiveSessionFlowRules(
            roundTimerEnabled,
            roundTimerSeconds,
            nextQuestionMode,
            nextQuestionSeconds,
            sessionTimerEnabled,
            sessionTimerSeconds);
    }

    private static (bool IsPaused, DateTimeOffset? PauseStartedUtc, string? Source) ResolveLiveAsyncPauseState(
        int roundIndex,
        DateTimeOffset atUtc,
        IReadOnlyList<LiveAsyncTimerControlEvent> timerEvents)
    {
        var paused = false;
        DateTimeOffset? pauseStartedUtc = null;
        string? source = null;

        foreach (var timerEvent in timerEvents
                     .Where(x => x.RoundIndex == roundIndex && x.CreatedUtc <= atUtc)
                     .OrderBy(x => x.CreatedUtc))
        {
            if (string.Equals(timerEvent.Action, "pause", StringComparison.Ordinal))
            {
                paused = true;
                pauseStartedUtc = timerEvent.CreatedUtc;
                source = string.IsNullOrWhiteSpace(timerEvent.Source) ? "manual" : timerEvent.Source;
                continue;
            }

            paused = false;
            pauseStartedUtc = null;
            source = null;
        }

        return (paused, pauseStartedUtc, source);
    }

    private static LiveAsyncParticipantState BuildLiveAsyncParticipantState(
        List<LiveAsyncRoundPayload> rounds,
        List<CogitaLiveRevisionAnswer> participantAnswers,
        Guid participantId,
        string revisionMode,
        List<LiveAsyncDependencyEdge> dependencyEdges,
        bool dependenciesEnabled,
        int dependencyThreshold,
        List<LiveAsyncTimerControlEvent> timerEvents,
        DateTimeOffset participantJoinedUtc,
        DateTimeOffset? sessionStartedUtc,
        LiveSessionFlowRules flowRules,
        DateTimeOffset nowUtc)
    {
        static TimeSpan ComputePausedDurationForRoundSegment(
            int roundIndex,
            DateTimeOffset startUtc,
            DateTimeOffset endUtc,
            IReadOnlyList<LiveAsyncTimerControlEvent> events)
        {
            if (endUtc <= startUtc || events.Count == 0)
            {
                return TimeSpan.Zero;
            }

            var ordered = events
                .Where(x => x.RoundIndex == roundIndex)
                .OrderBy(x => x.CreatedUtc)
                .ToList();
            if (ordered.Count == 0)
            {
                return TimeSpan.Zero;
            }

            var paused = false;
            DateTimeOffset? pauseStartUtc = null;
            var pausedDuration = TimeSpan.Zero;

            foreach (var timerEvent in ordered)
            {
                if (timerEvent.CreatedUtc <= startUtc)
                {
                    if (string.Equals(timerEvent.Action, "pause", StringComparison.Ordinal))
                    {
                        paused = true;
                        pauseStartUtc = startUtc;
                    }
                    else if (string.Equals(timerEvent.Action, "resume", StringComparison.Ordinal))
                    {
                        paused = false;
                        pauseStartUtc = null;
                    }
                    continue;
                }

                if (timerEvent.CreatedUtc >= endUtc)
                {
                    break;
                }

                if (string.Equals(timerEvent.Action, "pause", StringComparison.Ordinal))
                {
                    if (!paused)
                    {
                        paused = true;
                        pauseStartUtc = timerEvent.CreatedUtc;
                    }
                    continue;
                }

                if (!paused || !pauseStartUtc.HasValue)
                {
                    continue;
                }

                pausedDuration += timerEvent.CreatedUtc - pauseStartUtc.Value;
                paused = false;
                pauseStartUtc = null;
            }

            if (paused && pauseStartUtc.HasValue)
            {
                pausedDuration += endUtc - pauseStartUtc.Value;
            }

            return pausedDuration < TimeSpan.Zero ? TimeSpan.Zero : pausedDuration;
        }

        static double ComputeActiveQuestionSeconds(
            int roundIndex,
            DateTimeOffset startUtc,
            DateTimeOffset endUtc,
            IReadOnlyList<LiveAsyncTimerControlEvent> timerEvents,
            LiveSessionFlowRules flowRules)
        {
            if (endUtc <= startUtc)
            {
                return 0d;
            }

            var paused = ComputePausedDurationForRoundSegment(roundIndex, startUtc, endUtc, timerEvents);
            var active = endUtc - startUtc - paused;
            var activeSeconds = Math.Max(0d, active.TotalSeconds);
            if (flowRules.RoundTimerEnabled)
            {
                activeSeconds = Math.Min(activeSeconds, flowRules.RoundTimerSeconds);
            }

            return activeSeconds;
        }

        static DateTimeOffset? ComputeSegmentCompletionUtc(
            int roundIndex,
            DateTimeOffset startUtc,
            double requiredActiveSeconds,
            IReadOnlyList<LiveAsyncTimerControlEvent> events,
            DateTimeOffset nowUtc)
        {
            if (requiredActiveSeconds <= 0d)
            {
                return startUtc;
            }

            if (nowUtc <= startUtc)
            {
                return null;
            }

            var ordered = events
                .Where(x => x.RoundIndex == roundIndex)
                .OrderBy(x => x.CreatedUtc)
                .ToList();

            var paused = false;
            foreach (var timerEvent in ordered)
            {
                if (timerEvent.CreatedUtc > startUtc)
                {
                    break;
                }

                if (string.Equals(timerEvent.Action, "pause", StringComparison.Ordinal))
                {
                    paused = true;
                }
                else if (string.Equals(timerEvent.Action, "resume", StringComparison.Ordinal))
                {
                    paused = false;
                }
            }

            var remainingSeconds = requiredActiveSeconds;
            var cursorUtc = startUtc;

            foreach (var timerEvent in ordered)
            {
                if (timerEvent.CreatedUtc <= startUtc)
                {
                    continue;
                }

                if (timerEvent.CreatedUtc > nowUtc)
                {
                    break;
                }

                if (!paused)
                {
                    var activeSegmentSeconds = Math.Max(0d, (timerEvent.CreatedUtc - cursorUtc).TotalSeconds);
                    if (activeSegmentSeconds >= remainingSeconds)
                    {
                        return cursorUtc.AddSeconds(remainingSeconds);
                    }

                    remainingSeconds -= activeSegmentSeconds;
                }

                if (string.Equals(timerEvent.Action, "pause", StringComparison.Ordinal))
                {
                    paused = true;
                }
                else if (string.Equals(timerEvent.Action, "resume", StringComparison.Ordinal))
                {
                    paused = false;
                }

                cursorUtc = timerEvent.CreatedUtc;
            }

            if (paused)
            {
                return null;
            }

            var tailActiveSeconds = Math.Max(0d, (nowUtc - cursorUtc).TotalSeconds);
            if (tailActiveSeconds >= remainingSeconds)
            {
                return cursorUtc.AddSeconds(remainingSeconds);
            }

            return null;
        }

        var sessionStartUtc = sessionStartedUtc.HasValue && sessionStartedUtc.Value > participantJoinedUtc
            ? sessionStartedUtc.Value
            : participantJoinedUtc;
        if (rounds.Count == 0)
        {
            return new LiveAsyncParticipantState(
                0,
                "finished",
                sessionStartUtc,
                sessionStartUtc,
                null,
                null,
                null,
                0d,
                0d,
                null,
                false,
                null,
                null);
        }

        var latestByRound = participantAnswers
            .GroupBy(x => x.RoundIndex)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.UpdatedUtc)
                    .ThenByDescending(item => item.SubmittedUtc)
                    .First());

        var answeredRoundIndexes = latestByRound.Values
            .Where(x => x.IsCorrect.HasValue)
            .OrderBy(x => x.UpdatedUtc)
            .ThenBy(x => x.SubmittedUtc)
            .Select(x => x.RoundIndex)
            .Distinct()
            .ToList();
        var answeredRoundIndexSet = answeredRoundIndexes.ToHashSet();
        var remainingRoundIndexes = Enumerable.Range(0, rounds.Count)
            .Where(index => !answeredRoundIndexSet.Contains(index))
            .ToList();
        var orderedRoundIndexes = new List<int>(rounds.Count);
        orderedRoundIndexes.AddRange(answeredRoundIndexes);
        var normalizedMode = CogitaRunSelectionCore.NormalizeMode(revisionMode);
        var normalizedDependencyThreshold = Math.Max(0, Math.Min(100, dependencyThreshold));
        var knownessByRound = latestByRound.ToDictionary(
            pair => pair.Key,
            pair => pair.Value.IsCorrect.HasValue
                ? (pair.Value.IsCorrect.Value ? 100d : 0d)
                : 0d);
        var orderedRemainingRoundIndexes = CogitaRunSelectionCore.OrderRemainingRoundIndexes(
            remainingRoundIndexes,
            participantId,
            normalizedMode,
            knownessByRound);
        if (dependenciesEnabled &&
            orderedRemainingRoundIndexes.Count > 0 &&
            dependencyEdges.Count > 0)
        {
            var parentRoundIndexesByChild = new Dictionary<int, HashSet<int>>();
            foreach (var dependencyEdge in dependencyEdges)
            {
                if (dependencyEdge.ParentRoundIndex < 0 || dependencyEdge.ParentRoundIndex >= rounds.Count)
                {
                    continue;
                }
                if (dependencyEdge.ChildRoundIndex < 0 || dependencyEdge.ChildRoundIndex >= rounds.Count)
                {
                    continue;
                }
                if (dependencyEdge.ParentRoundIndex == dependencyEdge.ChildRoundIndex)
                {
                    continue;
                }

                if (!parentRoundIndexesByChild.TryGetValue(dependencyEdge.ChildRoundIndex, out var parents))
                {
                    parents = new HashSet<int>();
                    parentRoundIndexesByChild[dependencyEdge.ChildRoundIndex] = parents;
                }
                parents.Add(dependencyEdge.ParentRoundIndex);
            }

            if (parentRoundIndexesByChild.Count > 0)
            {
                orderedRemainingRoundIndexes = orderedRemainingRoundIndexes
                    .Where(roundIndex =>
                    {
                        if (!parentRoundIndexesByChild.TryGetValue(roundIndex, out var parentRoundIndexes) ||
                            parentRoundIndexes.Count == 0)
                        {
                            return true;
                        }

                        var parentScoreSum = 0d;
                        foreach (var parentRoundIndex in parentRoundIndexes)
                        {
                            var parentScore = knownessByRound.TryGetValue(parentRoundIndex, out var knowness)
                                ? knowness
                                : 0d;
                            parentScoreSum += parentScore;
                        }

                        var parentAverage = parentScoreSum / parentRoundIndexes.Count;
                        return parentAverage >= normalizedDependencyThreshold;
                    })
                    .ToList();
            }
        }
        orderedRoundIndexes.AddRange(orderedRemainingRoundIndexes);

        var roundCursorUtc = sessionStartUtc;
        var sessionElapsedSeconds = 0d;
        for (var orderIndex = 0; orderIndex < orderedRoundIndexes.Count; orderIndex++)
        {
            var index = orderedRoundIndexes[orderIndex];
            if (!latestByRound.TryGetValue(index, out var answerRow) ||
                !answerRow.IsCorrect.HasValue)
            {
                var questionElapsedSeconds = ComputeActiveQuestionSeconds(index, roundCursorUtc, nowUtc, timerEvents, flowRules);
                var previewSessionElapsedSeconds = sessionElapsedSeconds + questionElapsedSeconds;
                if (flowRules.SessionTimerEnabled && previewSessionElapsedSeconds >= flowRules.SessionTimerSeconds)
                {
                    var pauseState = ResolveLiveAsyncPauseState(index, nowUtc, timerEvents);
                    return new LiveAsyncParticipantState(
                        index,
                        "finished",
                        sessionStartUtc,
                        roundCursorUtc,
                        flowRules.RoundTimerEnabled ? nowUtc : null,
                        null,
                        null,
                        flowRules.SessionTimerSeconds,
                        questionElapsedSeconds,
                        answerRow,
                        pauseState.IsPaused,
                        pauseState.Source,
                        pauseState.PauseStartedUtc);
                }

                var roundRemainingSeconds = flowRules.RoundTimerEnabled
                    ? Math.Max(0d, flowRules.RoundTimerSeconds - questionElapsedSeconds)
                    : 0d;
                var questionPauseState = ResolveLiveAsyncPauseState(index, nowUtc, timerEvents);
                return new LiveAsyncParticipantState(
                    index,
                    "question",
                    sessionStartUtc,
                    roundCursorUtc,
                    flowRules.RoundTimerEnabled ? nowUtc.AddSeconds(roundRemainingSeconds) : null,
                    null,
                    null,
                    previewSessionElapsedSeconds,
                    questionElapsedSeconds,
                    answerRow,
                    questionPauseState.IsPaused,
                    questionPauseState.Source,
                    questionPauseState.PauseStartedUtc);
            }

            var revealStartedUtc = answerRow.SubmittedUtc > roundCursorUtc ? answerRow.SubmittedUtc : roundCursorUtc;
            var questionElapsedAtSubmitSeconds = ComputeActiveQuestionSeconds(index, roundCursorUtc, revealStartedUtc, timerEvents, flowRules);
            sessionElapsedSeconds += questionElapsedAtSubmitSeconds;
            if (flowRules.SessionTimerEnabled && sessionElapsedSeconds >= flowRules.SessionTimerSeconds)
            {
                var pauseState = ResolveLiveAsyncPauseState(index, nowUtc, timerEvents);
                return new LiveAsyncParticipantState(
                    index,
                    "finished",
                    sessionStartUtc,
                    roundCursorUtc,
                    flowRules.RoundTimerEnabled ? revealStartedUtc : null,
                    revealStartedUtc,
                    null,
                    flowRules.SessionTimerSeconds,
                    questionElapsedAtSubmitSeconds,
                    answerRow,
                    pauseState.IsPaused,
                    pauseState.Source,
                    pauseState.PauseStartedUtc);
            }

            if (string.Equals(flowRules.NextQuestionMode, "timer", StringComparison.Ordinal))
            {
                var acknowledgedDuringReveal = answerRow.UpdatedUtc > answerRow.SubmittedUtc;
                if (acknowledgedDuringReveal)
                {
                    roundCursorUtc = answerRow.UpdatedUtc > revealStartedUtc ? answerRow.UpdatedUtc : revealStartedUtc;
                    continue;
                }

                var revealActiveSeconds = Math.Max(
                    0d,
                    (nowUtc - revealStartedUtc - ComputePausedDurationForRoundSegment(index, revealStartedUtc, nowUtc, timerEvents)).TotalSeconds);
                if (revealActiveSeconds < flowRules.NextQuestionSeconds)
                {
                    var revealRemainingSeconds = Math.Max(0d, flowRules.NextQuestionSeconds - revealActiveSeconds);
                    var autoNextEndsUtc = nowUtc.AddSeconds(revealRemainingSeconds);
                    var revealPauseState = ResolveLiveAsyncPauseState(index, nowUtc, timerEvents);
                    return new LiveAsyncParticipantState(
                        index,
                        "reveal",
                        sessionStartUtc,
                        roundCursorUtc,
                        flowRules.RoundTimerEnabled ? revealStartedUtc : null,
                        revealStartedUtc,
                        autoNextEndsUtc,
                        sessionElapsedSeconds,
                        questionElapsedAtSubmitSeconds,
                        answerRow,
                        revealPauseState.IsPaused,
                        revealPauseState.Source,
                        revealPauseState.PauseStartedUtc);
                }

                roundCursorUtc = ComputeSegmentCompletionUtc(
                        index,
                        revealStartedUtc,
                        flowRules.NextQuestionSeconds,
                        timerEvents,
                        nowUtc)
                    ?? nowUtc;
                continue;
            }

            var acknowledged = answerRow.UpdatedUtc > answerRow.SubmittedUtc;
            if (!acknowledged)
            {
                var revealPauseState = ResolveLiveAsyncPauseState(index, nowUtc, timerEvents);
                return new LiveAsyncParticipantState(
                    index,
                    "reveal",
                    sessionStartUtc,
                    roundCursorUtc,
                    flowRules.RoundTimerEnabled ? revealStartedUtc : null,
                    revealStartedUtc,
                    null,
                    sessionElapsedSeconds,
                    questionElapsedAtSubmitSeconds,
                    answerRow,
                    revealPauseState.IsPaused,
                    revealPauseState.Source,
                    revealPauseState.PauseStartedUtc);
            }

            roundCursorUtc = answerRow.UpdatedUtc > revealStartedUtc ? answerRow.UpdatedUtc : revealStartedUtc;
        }

        return new LiveAsyncParticipantState(
            orderedRoundIndexes.Count,
            "finished",
            sessionStartUtc,
            roundCursorUtc,
            null,
            null,
            null,
            sessionElapsedSeconds,
            0d,
            null,
            false,
            null,
            null);
    }

    private static async Task<bool> MarkLiveAsyncUnansweredRoundsAsync(
        Guid sessionId,
        Guid libraryId,
        Guid participantId,
        List<LiveAsyncRoundPayload> rounds,
        DateTimeOffset nowUtc,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        if (rounds.Count == 0)
        {
            return false;
        }

        var answers = await dbContext.CogitaLiveRevisionAnswers
            .Where(x => x.SessionId == sessionId && x.ParticipantId == participantId)
            .OrderBy(x => x.RoundIndex)
            .ThenByDescending(x => x.UpdatedUtc)
            .ToListAsync(ct);
        var latestByRound = answers
            .GroupBy(x => x.RoundIndex)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.UpdatedUtc)
                    .ThenByDescending(item => item.SubmittedUtc)
                    .First());

        var changed = false;
        for (var roundIndex = 0; roundIndex < rounds.Count; roundIndex++)
        {
            if (latestByRound.TryGetValue(roundIndex, out var existing))
            {
                if (existing.IsCorrect.HasValue)
                {
                    continue;
                }

                existing.IsCorrect = false;
                existing.UpdatedUtc = nowUtc > existing.SubmittedUtc
                    ? nowUtc
                    : existing.SubmittedUtc.AddMilliseconds(1);
                changed = true;
                continue;
            }

            dbContext.CogitaLiveRevisionAnswers.Add(new CogitaLiveRevisionAnswer
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                ParticipantId = participantId,
                RoundIndex = roundIndex,
                CardKey = rounds[roundIndex].CardKey,
                AnswerJson = null,
                IsCorrect = false,
                SubmittedUtc = nowUtc,
                UpdatedUtc = nowUtc
            });
            changed = true;
        }

        if (!changed)
        {
            return false;
        }

        dbContext.CogitaStatisticEvents.Add(new CogitaStatisticEvent
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            ScopeType = "live-session",
            ScopeId = sessionId,
            SourceType = "live-session",
            SessionId = sessionId,
            ParticipantId = participantId,
            EventType = "live_async_timer_expired_marked_unanswered",
            RoundIndex = rounds.Count - 1,
            IsPersistent = false,
            PayloadJson = null,
            CreatedUtc = nowUtc
        });

        await dbContext.SaveChangesAsync(ct);
        return true;
    }

    private static bool? ParseBooleanFromJsonNode(JsonNode? node)
    {
        if (node is JsonValue scalar)
        {
            if (scalar.TryGetValue<bool>(out var boolValue))
            {
                return boolValue;
            }
            if (scalar.TryGetValue<int>(out var intValue))
            {
                if (intValue == 1) return true;
                if (intValue == 0) return false;
            }
            if (scalar.TryGetValue<string>(out var stringValue))
            {
                var normalized = stringValue.Trim().ToLowerInvariant();
                if (normalized is "true" or "1") return true;
                if (normalized is "false" or "0") return false;
            }
        }
        return null;
    }

    private readonly record struct StatisticScorePayload(
        int TotalPoints,
        int BasePoints,
        int FirstBonusPoints,
        int SpeedBonusPoints,
        int StreakBonusPoints);

    private static JsonObject BuildLiveRoundScoringNode(
        bool isCorrect,
        int totalPoints,
        int answerDurationSeconds,
        LiveComputedScoreDetail? detail = null)
    {
        var basePoints = Math.Max(0, detail?.BasePoints ?? 0);
        var firstBonusPoints = Math.Max(0, detail?.FirstBonusPoints ?? 0);
        var speedPoints = Math.Max(0, detail?.SpeedBonusPoints ?? 0);
        var streakPoints = Math.Max(0, detail?.StreakBonusPoints ?? 0);
        var wrongPenaltyPoints = Math.Max(0, detail?.WrongPenaltyPoints ?? 0);
        var firstWrongPenaltyPoints = Math.Max(0, detail?.FirstWrongPenaltyPoints ?? 0);
        var wrongStreakPenaltyPoints = Math.Max(0, detail?.WrongStreakPenaltyPoints ?? 0);
        var streakCount = Math.Max(0, detail?.StreakCount ?? 0);
        var wrongStreakCount = Math.Max(0, detail?.WrongStreakCount ?? 0);

        if (!isCorrect)
        {
            basePoints = 0;
            firstBonusPoints = 0;
            speedPoints = 0;
            streakPoints = 0;
            streakCount = 0;
        }

        var factors = new JsonArray();
        if (basePoints > 0) factors.Add(JsonValue.Create("base"));
        if (firstBonusPoints > 0) factors.Add(JsonValue.Create("first"));
        if (speedPoints > 0) factors.Add(JsonValue.Create("speed"));
        if (streakPoints > 0) factors.Add(JsonValue.Create("streak"));
        if (wrongPenaltyPoints > 0) factors.Add(JsonValue.Create("wrong"));
        if (firstWrongPenaltyPoints > 0) factors.Add(JsonValue.Create("first-wrong"));
        if (wrongStreakPenaltyPoints > 0) factors.Add(JsonValue.Create("wrong-streak"));

        return new JsonObject
        {
            ["isCorrect"] = isCorrect,
            ["points"] = totalPoints,
            ["factors"] = factors,
            ["basePoints"] = basePoints,
            ["firstBonusPoints"] = firstBonusPoints,
            ["speedPoints"] = speedPoints,
            ["streakPoints"] = streakPoints,
            ["wrongPenaltyPoints"] = wrongPenaltyPoints,
            ["firstWrongPenaltyPoints"] = firstWrongPenaltyPoints,
            ["wrongStreakPenaltyPoints"] = wrongStreakPenaltyPoints,
            ["streak"] = streakCount,
            ["wrongStreak"] = wrongStreakCount,
            ["answerDurationSeconds"] = Math.Max(0, answerDurationSeconds)
        };
    }

    private static StatisticScorePayload? ParseStatisticScorePayload(string? payloadJson, bool isCorrect)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            var node = JsonNode.Parse(payloadJson) as JsonObject;
            if (node is null)
            {
                return null;
            }

            static int ReadInt(JsonObject root, string key)
            {
                if (root[key] is JsonValue value)
                {
                    if (value.TryGetValue<int>(out var intValue)) return intValue;
                    if (value.TryGetValue<double>(out var doubleValue)) return (int)Math.Round(doubleValue);
                }
                return 0;
            }

            var basePoints = Math.Max(0, ReadInt(node, "basePoints"));
            var firstBonusPoints = Math.Max(0, ReadInt(node, "firstBonusPoints"));
            var speedBonusPoints = Math.Max(0, ReadInt(node, "speedPoints"));
            var streakBonusPoints = Math.Max(0, ReadInt(node, "streakPoints"));
            var wrongPenaltyPoints = Math.Max(0, ReadInt(node, "wrongPenaltyPoints"));
            var firstWrongPenaltyPoints = Math.Max(0, ReadInt(node, "firstWrongPenaltyPoints"));
            var wrongStreakPenaltyPoints = Math.Max(0, ReadInt(node, "wrongStreakPenaltyPoints"));
            if (firstBonusPoints <= 0)
            {
                firstBonusPoints = Math.Max(0, ReadInt(node, "firstPoints"));
            }

            var totalPoints = isCorrect
                ? Math.Max(0, Math.Min(500000, basePoints + firstBonusPoints + speedBonusPoints + streakBonusPoints))
                : -Math.Max(0, Math.Min(500000, wrongPenaltyPoints + firstWrongPenaltyPoints + wrongStreakPenaltyPoints));
            return new StatisticScorePayload(totalPoints, basePoints, firstBonusPoints, speedBonusPoints, streakBonusPoints);
        }
        catch
        {
            return null;
        }
    }

    private static string? BuildLiveScoreBreakdownPayload(
        JsonObject? participantScoringNode,
        LiveSessionScoringRules scoringRules,
        bool? isCorrect)
    {
        static int ReadInt(JsonObject root, string key)
        {
            if (root[key] is JsonValue value)
            {
                if (value.TryGetValue<int>(out var intValue)) return intValue;
                if (value.TryGetValue<double>(out var doubleValue)) return (int)Math.Round(doubleValue);
            }
            return 0;
        }

        if (isCorrect != true)
        {
            return JsonSerializer.Serialize(new
            {
                basePoints = 0,
                firstBonusPoints = 0,
                speedPoints = 0,
                streakPoints = 0,
                wrongPenaltyPoints = Math.Max(0, ReadInt(participantScoringNode ?? new JsonObject(), "wrongPenaltyPoints")),
                firstWrongPenaltyPoints = Math.Max(0, ReadInt(participantScoringNode ?? new JsonObject(), "firstWrongPenaltyPoints")),
                wrongStreakPenaltyPoints = Math.Max(0, ReadInt(participantScoringNode ?? new JsonObject(), "wrongStreakPenaltyPoints"))
            });
        }

        var basePoints = Math.Max(0, scoringRules.BaseCorrect);
        var firstBonusPoints = 0;
        var speedPoints = 0;
        var streakPoints = 0;

        if (participantScoringNode is not null)
        {
            var factors = (participantScoringNode["factors"] as JsonArray)
                ?.Select(item => item?.GetValue<string>() ?? string.Empty)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToHashSet(StringComparer.OrdinalIgnoreCase)
                ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (factors.Contains("first"))
            {
                firstBonusPoints = Math.Max(0, scoringRules.FirstCorrectBonus);
            }
            speedPoints = Math.Max(0, ReadInt(participantScoringNode, "speedPoints"));
            streakPoints = Math.Max(0, ReadInt(participantScoringNode, "streakPoints"));
            var explicitBase = Math.Max(0, ReadInt(participantScoringNode, "basePoints"));
            if (explicitBase > 0)
            {
                basePoints = explicitBase;
            }
        }

        return JsonSerializer.Serialize(new
        {
            basePoints,
            firstBonusPoints,
            speedPoints,
            streakPoints,
            wrongPenaltyPoints = Math.Max(0, ReadInt(participantScoringNode ?? new JsonObject(), "wrongPenaltyPoints")),
            firstWrongPenaltyPoints = Math.Max(0, ReadInt(participantScoringNode ?? new JsonObject(), "firstWrongPenaltyPoints")),
            wrongStreakPenaltyPoints = Math.Max(0, ReadInt(participantScoringNode ?? new JsonObject(), "wrongStreakPenaltyPoints"))
        });
    }

    private static async Task AppendLiveRoundAnswerDistributionAsync(
        Guid sessionId,
        int roundIndex,
        string? cardKey,
        JsonObject promptNode,
        JsonObject revealNode,
        IDataProtectionProvider dataProtectionProvider,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var kind = promptNode["kind"]?.GetValue<string>()?.Trim().ToLowerInvariant()
                   ?? revealNode["kind"]?.GetValue<string>()?.Trim().ToLowerInvariant()
                   ?? string.Empty;
        if (kind is not ("selection" or "boolean"))
        {
            revealNode.Remove("answerDistribution");
            return;
        }

        var normalizedCardKey = string.IsNullOrWhiteSpace(cardKey) ? null : cardKey.Trim();
        var answerQuery = dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
            .Where(x => x.SessionId == sessionId);
        answerQuery = normalizedCardKey is null
            ? answerQuery.Where(x => x.RoundIndex == roundIndex)
            : answerQuery.Where(x => x.CardKey == normalizedCardKey);
        var answerRows = await answerQuery
            .OrderByDescending(x => x.UpdatedUtc)
            .ToListAsync(ct);
        if (answerRows.Count == 0)
        {
            revealNode.Remove("answerDistribution");
            return;
        }

        var latestByParticipant = answerRows
            .GroupBy(x => x.ParticipantId)
            .Select(group => group.First())
            .ToList();

        if (kind == "selection")
        {
            var optionsCount = promptNode["options"] is JsonArray optionsArray ? optionsArray.Count : 0;
            if (optionsCount <= 0 && revealNode["expected"] is JsonArray expectedArray)
            {
                var maxExpectedIndex = expectedArray
                    .Select(item =>
                    {
                        if (item is JsonValue value && value.TryGetValue<int>(out var parsed))
                        {
                            return (int?)parsed;
                        }
                        return null;
                    })
                    .Where(value => value.HasValue)
                    .Select(value => value!.Value)
                    .DefaultIfEmpty(-1)
                    .Max();
                optionsCount = maxExpectedIndex + 1;
            }
            if (optionsCount <= 0)
            {
                revealNode.Remove("answerDistribution");
                return;
            }

            var optionHits = new int[optionsCount];
            var totalAnswers = 0;
            foreach (var answerRow in latestByParticipant)
            {
                var rawAnswer = UnprotectLiveSessionScopedJson(answerRow.AnswerJson, dataProtectionProvider, sessionId);
                if (string.IsNullOrWhiteSpace(rawAnswer))
                {
                    continue;
                }

                JsonNode? parsedAnswer;
                try
                {
                    parsedAnswer = JsonNode.Parse(rawAnswer);
                }
                catch
                {
                    continue;
                }

                var selected = ParseIntListFromJsonNode(parsedAnswer)
                    .Distinct()
                    .Where(index => index >= 0 && index < optionsCount)
                    .ToList();
                if (selected.Count == 0)
                {
                    continue;
                }
                totalAnswers += 1;
                foreach (var optionIndex in selected)
                {
                    optionHits[optionIndex] += 1;
                }
            }

            if (totalAnswers == 0)
            {
                revealNode.Remove("answerDistribution");
                return;
            }

            var options = new JsonArray();
            for (var optionIndex = 0; optionIndex < optionsCount; optionIndex += 1)
            {
                var count = optionHits[optionIndex];
                var percent = Math.Round(count * 100d / totalAnswers, 1);
                options.Add(new JsonObject
                {
                    ["index"] = optionIndex,
                    ["count"] = count,
                    ["percent"] = percent
                });
            }

            revealNode["answerDistribution"] = new JsonObject
            {
                ["kind"] = "selection",
                ["totalAnswers"] = totalAnswers,
                ["options"] = options
            };
            return;
        }

        var trueCount = 0;
        var falseCount = 0;
        var booleanTotalAnswers = 0;
        foreach (var answerRow in latestByParticipant)
        {
            var rawAnswer = UnprotectLiveSessionScopedJson(answerRow.AnswerJson, dataProtectionProvider, sessionId);
            if (string.IsNullOrWhiteSpace(rawAnswer))
            {
                continue;
            }

            JsonNode? parsedAnswer;
            try
            {
                parsedAnswer = JsonNode.Parse(rawAnswer);
            }
            catch
            {
                continue;
            }

            var value = ParseBooleanFromJsonNode(parsedAnswer);
            if (!value.HasValue)
            {
                continue;
            }

            booleanTotalAnswers += 1;
            if (value.Value)
            {
                trueCount += 1;
            }
            else
            {
                falseCount += 1;
            }
        }

        if (booleanTotalAnswers == 0)
        {
            revealNode.Remove("answerDistribution");
            return;
        }

        revealNode["answerDistribution"] = new JsonObject
        {
            ["kind"] = "boolean",
            ["totalAnswers"] = booleanTotalAnswers,
            ["trueCount"] = trueCount,
            ["falseCount"] = falseCount,
            ["truePercent"] = Math.Round(trueCount * 100d / booleanTotalAnswers, 1),
            ["falsePercent"] = Math.Round(falseCount * 100d / booleanTotalAnswers, 1)
        };
    }

    private static List<int> ParseIntListFromJsonNode(JsonNode? node)
    {
        var values = new List<int>();
        if (node is null)
        {
            return values;
        }

        if (node is JsonObject obj)
        {
            static List<int> ParseFromField(JsonObject root, string key)
            {
                if (!root.TryGetPropertyValue(key, out var fieldNode) || fieldNode is null)
                {
                    return new List<int>();
                }
                return ParseIntListFromJsonNode(fieldNode);
            }

            var fromSelection = ParseFromField(obj, "selection");
            if (fromSelection.Count > 0)
            {
                return fromSelection;
            }

            var fromAnswer = ParseFromField(obj, "answer");
            if (fromAnswer.Count > 0)
            {
                return fromAnswer;
            }

            var fromSelected = ParseFromField(obj, "selected");
            if (fromSelected.Count > 0)
            {
                return fromSelected;
            }

            var fromValue = ParseFromField(obj, "value");
            if (fromValue.Count > 0)
            {
                return fromValue;
            }

            return values;
        }

        if (node is JsonValue scalar)
        {
            if (scalar.TryGetValue<int>(out var single))
            {
                values.Add(single);
            }
            return values;
        }

        if (node is not JsonArray array)
        {
            return values;
        }

        foreach (var entry in array)
        {
            if (entry is JsonValue value && value.TryGetValue<int>(out var parsed))
            {
                values.Add(parsed);
            }
        }
        return values;
    }

    private static List<string> ParseStringListFromJsonNode(JsonNode? node)
    {
        var values = new List<string>();
        if (node is not JsonArray array)
        {
            return values;
        }

        foreach (var entry in array)
        {
            if (entry is JsonValue value && value.TryGetValue<string>(out var parsed) && !string.IsNullOrWhiteSpace(parsed))
            {
                values.Add(parsed.Trim());
            }
        }
        return values;
    }

    private static List<string> ParseMatchingPathsFromJsonNode(JsonNode? node)
    {
        JsonNode? root = node;
        if (node is JsonObject asObj && asObj["paths"] is JsonNode nestedPaths)
        {
            root = nestedPaths;
        }

        if (root is not JsonArray rows)
        {
            return new List<string>();
        }

        var serializedPaths = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (row is not JsonArray rowArray)
            {
                continue;
            }

            var numbers = rowArray
                .Select(item =>
                {
                    if (item is JsonValue value && value.TryGetValue<int>(out var parsed))
                    {
                        return (int?)parsed;
                    }
                    return null;
                })
                .Where(item => item.HasValue)
                .Select(item => item!.Value)
                .ToList();
            if (numbers.Count == 0)
            {
                continue;
            }

            serializedPaths.Add(string.Join(",", numbers));
        }

        return serializedPaths.OrderBy(x => x, StringComparer.Ordinal).ToList();
    }

    private static string NormalizeLiveText(string input, bool ignorePunctuation)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        var normalized = input.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(char.ToLowerInvariant(ch));
                continue;
            }

            if (char.IsWhiteSpace(ch))
            {
                builder.Append(' ');
                continue;
            }

            if (!ignorePunctuation)
            {
                builder.Append(char.ToLowerInvariant(ch));
            }
        }

        return Regex.Replace(builder.ToString(), "\\s+", " ").Trim();
    }

    private static int ComputeLevenshteinDistance(string left, string right)
    {
        if (left == right)
        {
            return 0;
        }
        if (left.Length == 0)
        {
            return right.Length;
        }
        if (right.Length == 0)
        {
            return left.Length;
        }

        var previous = new int[right.Length + 1];
        var current = new int[right.Length + 1];
        for (var j = 0; j <= right.Length; j++)
        {
            previous[j] = j;
        }

        for (var i = 1; i <= left.Length; i++)
        {
            current[0] = i;
            for (var j = 1; j <= right.Length; j++)
            {
                var cost = left[i - 1] == right[j - 1] ? 0 : 1;
                current[j] = Math.Min(
                    Math.Min(current[j - 1] + 1, previous[j] + 1),
                    previous[j - 1] + cost);
            }

            (previous, current) = (current, previous);
        }

        return previous[right.Length];
    }

    private static bool EvaluateLiveAsyncAnswer(
        LiveAsyncRoundPayload round,
        JsonNode? answerNode,
        out bool isCorrect,
        out double correctness)
    {
        isCorrect = false;
        correctness = 0d;

        var kind = round.Prompt["kind"]?.GetValue<string>()?.Trim().ToLowerInvariant()
                   ?? round.Reveal["kind"]?.GetValue<string>()?.Trim().ToLowerInvariant()
                   ?? "text";
        var expectedNode = round.Reveal["expected"];

        if (kind == "selection")
        {
            var expected = ParseIntListFromJsonNode(expectedNode)
                .Distinct()
                .OrderBy(x => x)
                .ToList();
            var actual = ParseIntListFromJsonNode(answerNode)
                .Distinct()
                .OrderBy(x => x)
                .ToList();
            isCorrect = expected.SequenceEqual(actual);
            correctness = isCorrect ? 1d : 0d;
            return true;
        }

        if (kind == "boolean")
        {
            var expected = expectedNode is JsonValue expectedValue && expectedValue.TryGetValue<bool>(out var expectedBool)
                ? expectedBool
                : (bool?)null;
            var actual = answerNode is JsonValue answerValue && answerValue.TryGetValue<bool>(out var answerBool)
                ? answerBool
                : (bool?)null;
            isCorrect = expected.HasValue && actual.HasValue && expected.Value == actual.Value;
            correctness = isCorrect ? 1d : 0d;
            return true;
        }

        if (kind == "ordering")
        {
            var expected = ParseStringListFromJsonNode(expectedNode);
            var actual = ParseStringListFromJsonNode(answerNode);
            isCorrect = expected.Count > 0 &&
                        expected.Count == actual.Count &&
                        expected.Zip(actual, (left, right) => string.Equals(left, right, StringComparison.OrdinalIgnoreCase)).All(x => x);
            correctness = isCorrect ? 1d : 0d;
            return true;
        }

        if (kind == "matching")
        {
            var expectedPaths = ParseMatchingPathsFromJsonNode(expectedNode);
            var actualPaths = ParseMatchingPathsFromJsonNode(answerNode);
            isCorrect = expectedPaths.Count > 0 && expectedPaths.SequenceEqual(actualPaths);
            correctness = isCorrect ? 1d : 0d;
            return true;
        }

        var expectedText = expectedNode is JsonValue expectedScalar && expectedScalar.TryGetValue<string>(out var expectedString)
            ? expectedString
            : expectedNode?.ToJsonString()?.Trim('"');
        var actualText = answerNode is JsonValue answerScalar && answerScalar.TryGetValue<string>(out var answerString)
            ? answerString
            : answerNode?.ToJsonString()?.Trim('"');
        expectedText ??= string.Empty;
        actualText ??= string.Empty;

        var inputType = round.Prompt["inputType"]?.GetValue<string>()?.Trim().ToLowerInvariant() ?? "text";
        if (inputType == "number")
        {
            var expectedNumberOk = double.TryParse(expectedText, NumberStyles.Float, CultureInfo.InvariantCulture, out var expectedNumber);
            var actualNumberOk = double.TryParse(actualText, NumberStyles.Float, CultureInfo.InvariantCulture, out var actualNumber);
            isCorrect = expectedNumberOk && actualNumberOk && Math.Abs(expectedNumber - actualNumber) < 0.000001d;
            correctness = isCorrect ? 1d : 0d;
            return true;
        }

        if (inputType == "date")
        {
            var expectedDateOk = DateTime.TryParse(expectedText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var expectedDate);
            var actualDateOk = DateTime.TryParse(actualText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var actualDate);
            isCorrect = expectedDateOk && actualDateOk && expectedDate.Date == actualDate.Date;
            correctness = isCorrect ? 1d : 0d;
            return true;
        }

        var ignorePunctuation = kind is "citation-fragment" or "text";
        var normalizedExpected = NormalizeLiveText(expectedText, ignorePunctuation);
        var normalizedActual = NormalizeLiveText(actualText, ignorePunctuation);
        if (normalizedExpected.Length == 0 && normalizedActual.Length == 0)
        {
            isCorrect = true;
            correctness = 1d;
            return true;
        }
        if (normalizedExpected.Length == 0 || normalizedActual.Length == 0)
        {
            isCorrect = false;
            correctness = 0d;
            return true;
        }

        var distance = ComputeLevenshteinDistance(normalizedExpected, normalizedActual);
        var maxLength = Math.Max(normalizedExpected.Length, normalizedActual.Length);
        correctness = maxLength == 0 ? 1d : Math.Max(0d, 1d - (distance / (double)maxLength));
        var threshold = kind == "citation-fragment" ? 0.9d : 0.85d;
        isCorrect = correctness >= threshold;
        return true;
    }

    private static int ComputeAsyncStreakBonus(string growthMode, int streakBaseBonus, int streakCount, int streakLimit)
    {
        return CogitaRunScoringCore.ComputeStreakContribution(growthMode, streakBaseBonus, streakCount, streakLimit);
    }

    private readonly record struct LiveComputedScoreDetail(
        int Points,
        int BasePoints,
        int FirstBonusPoints,
        int SpeedBonusPoints,
        int StreakBonusPoints,
        int WrongPenaltyPoints,
        int FirstWrongPenaltyPoints,
        int WrongStreakPenaltyPoints,
        int StreakCount,
        int WrongStreakCount,
        int DurationMs,
        DateTimeOffset AnsweredUtc);

    private sealed class LiveComputedScoreState
    {
        public Dictionary<Guid, int> TotalsByParticipant { get; } = new();
        public Dictionary<(int RoundIndex, Guid ParticipantId), LiveComputedScoreDetail> DetailByRoundParticipant { get; } = new();
    }

    private static async Task<LiveComputedScoreState> ComputeLiveSessionScoresOnTheFlyAsync(
        Guid sessionId,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var result = new LiveComputedScoreState();
        var session = await dbContext.CogitaLiveRevisionSessions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sessionId, ct);
        if (session is null)
        {
            return result;
        }

        var meta = ParseLiveSessionMeta(session.SessionMetaJson);
        var scoringRules = ParseLiveSessionScoringRules(meta.SessionSettings);
        var isAsyncSession = string.Equals(meta.SessionMode, "asynchronous", StringComparison.Ordinal);

        var participants = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .Select(x => new { x.Id, x.JoinedUtc })
            .ToListAsync(ct);
        foreach (var participant in participants)
        {
            result.TotalsByParticipant[participant.Id] = 0;
        }

        var latestAnswers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.IsCorrect.HasValue)
            .OrderByDescending(x => x.UpdatedUtc)
            .ThenByDescending(x => x.SubmittedUtc)
            .ToListAsync(ct);
        latestAnswers = latestAnswers
            .GroupBy(x => new { x.RoundIndex, x.ParticipantId })
            .Select(group => group.First())
            .OrderBy(x => x.RoundIndex)
            .ThenBy(x => x.SubmittedUtc)
            .ThenBy(x => x.UpdatedUtc)
            .ToList();

        var roundPublished = await dbContext.CogitaStatisticEvents.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.EventType == "live_round_published" && x.RoundIndex.HasValue)
            .Select(x => new { RoundIndex = x.RoundIndex!.Value, x.CreatedUtc })
            .ToListAsync(ct);
        var roundStartByIndex = roundPublished
            .GroupBy(x => x.RoundIndex)
            .ToDictionary(group => group.Key, group => group.Min(x => x.CreatedUtc));

        var streakByParticipant = participants.ToDictionary(x => x.Id, _ => 0);
        var wrongStreakByParticipant = participants.ToDictionary(x => x.Id, _ => 0);

        if (isAsyncSession)
        {
            foreach (var roundGroup in latestAnswers.GroupBy(x => x.RoundIndex).OrderBy(x => x.Key))
            {
                var roundAnswers = roundGroup.OrderBy(x => x.SubmittedUtc).ThenBy(x => x.UpdatedUtc).ToList();
                if (roundAnswers.Count == 0)
                {
                    continue;
                }

                var firstAnswered = roundAnswers.FirstOrDefault();
                var firstAnsweredParticipantId = firstAnswered?.ParticipantId ?? Guid.Empty;
                var firstCorrectParticipantId = roundAnswers.FirstOrDefault(x => x.IsCorrect == true)?.ParticipantId ?? Guid.Empty;
                var firstWrongParticipantId = roundAnswers.FirstOrDefault(x => x.IsCorrect == false)?.ParticipantId ?? Guid.Empty;
                var hasFirstOverall = firstAnsweredParticipantId != Guid.Empty;
                var hasFirstCorrect = firstCorrectParticipantId != Guid.Empty;
                var hasFirstWrong = firstWrongParticipantId != Guid.Empty;
                var firstAnsweredUtc = firstAnswered?.SubmittedUtc ?? roundAnswers.Min(x => x.SubmittedUtc);
                var roundStartUtc = roundStartByIndex.TryGetValue(roundGroup.Key, out var publishedUtc)
                    ? publishedUtc
                    : firstAnsweredUtc;
                var speedTimerStartUtc = string.Equals(scoringRules.BonusTimerStartMode, "first_answer", StringComparison.Ordinal)
                    ? firstAnsweredUtc
                    : roundStartUtc;
                var speedTimerEndUtc = speedTimerStartUtc.AddSeconds(Math.Max(1, Math.Min(600, scoringRules.BonusTimerSeconds)));

                foreach (var answer in roundAnswers)
                {
                    var basePoints = 0;
                    var firstBonusPoints = 0;
                    var speedPoints = 0;
                    var streakPoints = 0;
                    var wrongPenaltyPoints = 0;
                    var firstWrongPenaltyPoints = 0;
                    var wrongStreakPenaltyPoints = 0;
                    var streakCount = 0;
                    var wrongStreakCount = 0;
                    var points = 0;
                    var isCorrect = answer.IsCorrect == true;
                    var durationMs = Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalMilliseconds));

                    var firstBonusApplies = scoringRules.FirstCorrectBonus > 0 &&
                        (
                            (string.Equals(scoringRules.FirstBonusMode, "first_answer", StringComparison.Ordinal) && hasFirstOverall && answer.ParticipantId == firstAnsweredParticipantId) ||
                            (string.Equals(scoringRules.FirstBonusMode, "first_correct", StringComparison.Ordinal) && isCorrect && hasFirstCorrect && answer.ParticipantId == firstCorrectParticipantId)
                        );
                    if (firstBonusApplies)
                    {
                        firstBonusPoints = Math.Max(0, Math.Min(500000, scoringRules.FirstCorrectBonus));
                        points += firstBonusPoints;
                    }

                    if (isCorrect)
                    {
                        basePoints = Math.Max(0, Math.Min(500000, scoringRules.BaseCorrect));
                        points += basePoints;

                        if (scoringRules.BonusTimerEnabled && scoringRules.SpeedBonusEnabled && scoringRules.SpeedBonusMaxPoints > 0)
                        {
                            if (answer.UpdatedUtc <= speedTimerEndUtc)
                            {
                                var denominator = Math.Max(1d, (speedTimerEndUtc - speedTimerStartUtc).TotalMilliseconds);
                                var ratio = Math.Max(0d, Math.Min(1d, (speedTimerEndUtc - answer.UpdatedUtc).TotalMilliseconds / denominator));
                                var scaled = scoringRules.SpeedBonusGrowth switch
                                {
                                    "exponential" => ratio * ratio,
                                    "limited" => Math.Min(1d, ratio * 1.6d),
                                    _ => ratio
                                };
                                speedPoints = Math.Max(0, Math.Min(500000, (int)Math.Round(scoringRules.SpeedBonusMaxPoints * scaled)));
                                points += speedPoints;
                            }
                        }

                        var previousStreak = streakByParticipant.TryGetValue(answer.ParticipantId, out var resolvedStreak) ? resolvedStreak : 0;
                        var nextStreak = previousStreak + 1;
                        streakPoints = ComputeAsyncStreakBonus(
                            scoringRules.StreakGrowth,
                            scoringRules.StreakBaseBonus,
                            nextStreak,
                            scoringRules.StreakLimit);
                        points += streakPoints;
                        streakByParticipant[answer.ParticipantId] = nextStreak;
                        wrongStreakByParticipant[answer.ParticipantId] = 0;
                        streakCount = nextStreak;
                    }
                    else
                    {
                        wrongPenaltyPoints = Math.Max(0, Math.Min(500000, scoringRules.WrongAnswerPenalty));
                        points -= wrongPenaltyPoints;

                        var firstWrongPenaltyApplies =
                            (string.Equals(scoringRules.FirstWrongPenaltyMode, "first_overall_answer", StringComparison.Ordinal) && hasFirstOverall && answer.ParticipantId == firstAnsweredParticipantId) ||
                            (string.Equals(scoringRules.FirstWrongPenaltyMode, "first_wrong", StringComparison.Ordinal) && hasFirstWrong && answer.ParticipantId == firstWrongParticipantId);
                        if (firstWrongPenaltyApplies)
                        {
                            firstWrongPenaltyPoints = Math.Max(0, Math.Min(500000, scoringRules.FirstWrongPenalty));
                            points -= firstWrongPenaltyPoints;
                        }

                        var previousWrong = wrongStreakByParticipant.TryGetValue(answer.ParticipantId, out var resolvedWrong) ? resolvedWrong : 0;
                        var nextWrong = previousWrong + 1;
                        wrongStreakPenaltyPoints = ComputeAsyncStreakBonus(
                            scoringRules.WrongStreakGrowth,
                            scoringRules.WrongStreakBasePenalty,
                            nextWrong,
                            scoringRules.WrongStreakLimit);
                        points -= wrongStreakPenaltyPoints;
                        wrongStreakByParticipant[answer.ParticipantId] = nextWrong;
                        streakByParticipant[answer.ParticipantId] = 0;
                        wrongStreakCount = nextWrong;
                    }

                    points = Math.Max(-500000, Math.Min(500000, points));
                    if (!result.TotalsByParticipant.ContainsKey(answer.ParticipantId))
                    {
                        result.TotalsByParticipant[answer.ParticipantId] = 0;
                    }
                    result.TotalsByParticipant[answer.ParticipantId] += points;
                    result.DetailByRoundParticipant[(answer.RoundIndex, answer.ParticipantId)] = new LiveComputedScoreDetail(
                        points,
                        basePoints,
                        firstBonusPoints,
                        speedPoints,
                        streakPoints,
                        wrongPenaltyPoints,
                        firstWrongPenaltyPoints,
                        wrongStreakPenaltyPoints,
                        streakCount,
                        wrongStreakCount,
                        durationMs,
                        answer.UpdatedUtc);
                }
            }

            return result;
        }

        foreach (var roundGroup in latestAnswers.GroupBy(x => x.RoundIndex).OrderBy(x => x.Key))
        {
            var roundAnswers = roundGroup.ToList();
            if (roundAnswers.Count == 0)
            {
                continue;
            }

            var firstAnsweredUtc = roundAnswers.Min(x => x.SubmittedUtc);
            var roundStartUtc = roundStartByIndex.TryGetValue(roundGroup.Key, out var publishedUtc)
                ? publishedUtc
                : firstAnsweredUtc;
            var speedTimerStartUtc = string.Equals(scoringRules.BonusTimerStartMode, "first_answer", StringComparison.Ordinal)
                ? firstAnsweredUtc
                : roundStartUtc;
            var speedTimerEndUtc = speedTimerStartUtc.AddSeconds(Math.Max(1, Math.Min(600, scoringRules.BonusTimerSeconds)));

            var firstCorrectParticipantId = roundAnswers
                .Where(x => x.IsCorrect == true)
                .OrderBy(x => x.SubmittedUtc)
                .ThenBy(x => x.UpdatedUtc)
                .Select(x => x.ParticipantId)
                .FirstOrDefault();
            var hasFirstCorrect = firstCorrectParticipantId != Guid.Empty;
            var firstAnsweredParticipantId = roundAnswers
                .OrderBy(x => x.SubmittedUtc)
                .ThenBy(x => x.UpdatedUtc)
                .Select(x => x.ParticipantId)
                .FirstOrDefault();
            var hasFirstOverall = firstAnsweredParticipantId != Guid.Empty;

            var firstWrongParticipantId = roundAnswers
                .Where(x => x.IsCorrect == false)
                .OrderBy(x => x.SubmittedUtc)
                .ThenBy(x => x.UpdatedUtc)
                .Select(x => x.ParticipantId)
                .FirstOrDefault();
            var hasFirstWrong = firstWrongParticipantId != Guid.Empty;

            foreach (var answer in roundAnswers)
            {
                var basePoints = 0;
                var firstBonusPoints = 0;
                var speedPoints = 0;
                var streakPoints = 0;
                var wrongPenaltyPoints = 0;
                var firstWrongPenaltyPoints = 0;
                var wrongStreakPenaltyPoints = 0;
                var points = 0;
                var isCorrect = answer.IsCorrect == true;
                var durationMs = Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalMilliseconds));
                var wrongStreakCount = 0;

                var firstBonusApplies = scoringRules.FirstCorrectBonus > 0 &&
                    (
                        (string.Equals(scoringRules.FirstBonusMode, "first_answer", StringComparison.Ordinal) && hasFirstOverall && answer.ParticipantId == firstAnsweredParticipantId) ||
                        (string.Equals(scoringRules.FirstBonusMode, "first_correct", StringComparison.Ordinal) && isCorrect && hasFirstCorrect && answer.ParticipantId == firstCorrectParticipantId)
                    );
                if (firstBonusApplies)
                {
                    firstBonusPoints = Math.Max(0, Math.Min(500000, scoringRules.FirstCorrectBonus));
                    points += firstBonusPoints;
                }

                if (isCorrect)
                {
                    basePoints = Math.Max(0, Math.Min(500000, scoringRules.BaseCorrect));
                    points += basePoints;

                    if (scoringRules.BonusTimerEnabled && scoringRules.SpeedBonusEnabled && scoringRules.SpeedBonusMaxPoints > 0)
                    {
                        if (answer.UpdatedUtc <= speedTimerEndUtc)
                        {
                            var denominator = Math.Max(1d, (speedTimerEndUtc - speedTimerStartUtc).TotalMilliseconds);
                            var ratio = Math.Max(0d, Math.Min(1d, (speedTimerEndUtc - answer.UpdatedUtc).TotalMilliseconds / denominator));
                            var scaled = scoringRules.SpeedBonusGrowth switch
                            {
                                "exponential" => ratio * ratio,
                                "limited" => Math.Min(1d, ratio * 1.6d),
                                _ => ratio
                            };
                            speedPoints = Math.Max(0, Math.Min(500000, (int)Math.Round(scoringRules.SpeedBonusMaxPoints * scaled)));
                            points += speedPoints;
                        }
                    }

                    var previousStreak = streakByParticipant.TryGetValue(answer.ParticipantId, out var currentStreak)
                        ? currentStreak
                        : 0;
                    var nextStreak = previousStreak + 1;
                    streakPoints = ComputeAsyncStreakBonus(
                        scoringRules.StreakGrowth,
                        scoringRules.StreakBaseBonus,
                        nextStreak,
                        scoringRules.StreakLimit);
                    points += streakPoints;
                    streakByParticipant[answer.ParticipantId] = nextStreak;
                    wrongStreakByParticipant[answer.ParticipantId] = 0;
                }
                else
                {
                    wrongPenaltyPoints = Math.Max(0, Math.Min(500000, scoringRules.WrongAnswerPenalty));
                    var firstWrongPenaltyApplies =
                        (string.Equals(scoringRules.FirstWrongPenaltyMode, "first_overall_answer", StringComparison.Ordinal) && hasFirstOverall && answer.ParticipantId == firstAnsweredParticipantId) ||
                        (string.Equals(scoringRules.FirstWrongPenaltyMode, "first_wrong", StringComparison.Ordinal) && hasFirstWrong && answer.ParticipantId == firstWrongParticipantId);
                    firstWrongPenaltyPoints = firstWrongPenaltyApplies
                        ? Math.Max(0, Math.Min(500000, scoringRules.FirstWrongPenalty))
                        : 0;
                    var previousWrongStreak = wrongStreakByParticipant.TryGetValue(answer.ParticipantId, out var resolvedWrongStreak)
                        ? resolvedWrongStreak
                        : 0;
                    wrongStreakCount = previousWrongStreak + 1;
                    wrongStreakPenaltyPoints = ComputeAsyncStreakBonus(
                        scoringRules.WrongStreakGrowth,
                        scoringRules.WrongStreakBasePenalty,
                        wrongStreakCount,
                        scoringRules.WrongStreakLimit);
                    points -= wrongPenaltyPoints + firstWrongPenaltyPoints + wrongStreakPenaltyPoints;
                    wrongStreakByParticipant[answer.ParticipantId] = wrongStreakCount;
                    streakByParticipant[answer.ParticipantId] = 0;
                }

                points = Math.Max(-500000, Math.Min(500000, points));
                if (!result.TotalsByParticipant.ContainsKey(answer.ParticipantId))
                {
                    result.TotalsByParticipant[answer.ParticipantId] = 0;
                }
                result.TotalsByParticipant[answer.ParticipantId] += points;
                result.DetailByRoundParticipant[(answer.RoundIndex, answer.ParticipantId)] = new LiveComputedScoreDetail(
                    points,
                    basePoints,
                    firstBonusPoints,
                    speedPoints,
                    streakPoints,
                    wrongPenaltyPoints,
                    firstWrongPenaltyPoints,
                    wrongStreakPenaltyPoints,
                    isCorrect ? (streakByParticipant.TryGetValue(answer.ParticipantId, out var resolvedStreak) ? resolvedStreak : 0) : 0,
                    wrongStreakCount,
                    durationMs,
                    answer.UpdatedUtc);
            }
        }

        return result;
    }

    private sealed class AsyncParticipantBonusAggregate
    {
        public int CorrectCount { get; set; }
        public double CorrectPointsSum { get; set; }
        public double BasePointsSum { get; set; }
        public double FirstBonusPointsSum { get; set; }
        public double SpeedBonusPointsSum { get; set; }
        public double StreakBonusPointsSum { get; set; }
    }

    private static async Task<Dictionary<Guid, AsyncParticipantBonusAggregate>> ComputeAsyncLiveBonusBreakdownByParticipantAsync(
        CogitaLiveRevisionSession session,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var result = new Dictionary<Guid, AsyncParticipantBonusAggregate>();
        var meta = ParseLiveSessionMeta(session.SessionMetaJson);
        if (!string.Equals(meta.SessionMode, "asynchronous", StringComparison.Ordinal))
        {
            return result;
        }

        var scoringRules = ParseLiveSessionScoringRules(meta.SessionSettings);
        var participants = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .ToListAsync(ct);
        if (participants.Count == 0)
        {
            return result;
        }

        var participantById = participants.ToDictionary(x => x.Id, x => x);
        var answers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .OrderBy(x => x.ParticipantId)
            .ThenBy(x => x.RoundIndex)
            .ThenBy(x => x.UpdatedUtc)
            .ToListAsync(ct);

        foreach (var group in answers.GroupBy(x => x.ParticipantId))
        {
            var aggregate = new AsyncParticipantBonusAggregate();
            var streak = 0;
            CogitaLiveRevisionAnswer? previousAnswer = null;

            foreach (var answer in group.OrderBy(x => x.RoundIndex).ThenBy(x => x.UpdatedUtc))
            {
                if (answer.IsCorrect != true)
                {
                    streak = 0;
                    previousAnswer = answer;
                    continue;
                }

                var basePoints = Math.Max(0, Math.Min(500000, scoringRules.BaseCorrect));
                var speedPoints = 0;

                if (scoringRules.BonusTimerEnabled &&
                    scoringRules.SpeedBonusEnabled &&
                    scoringRules.SpeedBonusMaxPoints > 0)
                {
                    DateTimeOffset speedTimerStartUtc;
                    if (string.Equals(scoringRules.BonusTimerStartMode, "first_answer", StringComparison.Ordinal))
                    {
                        speedTimerStartUtc = answer.UpdatedUtc;
                    }
                    else if (previousAnswer is not null)
                    {
                        speedTimerStartUtc = previousAnswer.UpdatedUtc;
                    }
                    else if (session.StartedUtc.HasValue)
                    {
                        speedTimerStartUtc = session.StartedUtc.Value;
                    }
                    else if (participantById.TryGetValue(answer.ParticipantId, out var participant))
                    {
                        speedTimerStartUtc = participant.JoinedUtc;
                    }
                    else
                    {
                        speedTimerStartUtc = answer.SubmittedUtc;
                    }

                    var speedTimerEndUtc = speedTimerStartUtc.AddSeconds(Math.Max(1, Math.Min(600, scoringRules.BonusTimerSeconds)));
                    if (answer.UpdatedUtc <= speedTimerEndUtc)
                    {
                        var denominator = Math.Max(1d, (speedTimerEndUtc - speedTimerStartUtc).TotalMilliseconds);
                        var ratio = Math.Max(0d, Math.Min(1d, (speedTimerEndUtc - answer.UpdatedUtc).TotalMilliseconds / denominator));
                        var scaled = scoringRules.SpeedBonusGrowth switch
                        {
                            "exponential" => ratio * ratio,
                            "limited" => Math.Min(1d, ratio * 1.6d),
                            _ => ratio
                        };
                        speedPoints = Math.Max(0, Math.Min(500000, (int)Math.Round(scoringRules.SpeedBonusMaxPoints * scaled)));
                    }
                }

                var nextStreak = streak + 1;
                var streakPoints = ComputeAsyncStreakBonus(
                    scoringRules.StreakGrowth,
                    scoringRules.StreakBaseBonus,
                    nextStreak,
                    scoringRules.StreakLimit);

                var pointsAwarded = Math.Max(0, basePoints + speedPoints + streakPoints);

                aggregate.CorrectCount += 1;
                aggregate.CorrectPointsSum += pointsAwarded;
                aggregate.BasePointsSum += basePoints;
                aggregate.FirstBonusPointsSum += 0;
                aggregate.SpeedBonusPointsSum += speedPoints;
                aggregate.StreakBonusPointsSum += streakPoints;

                streak = nextStreak;
                previousAnswer = answer;
            }

            result[group.Key] = aggregate;
        }

        return result;
    }

    private static string? ProtectLiveSessionScopedJson(string? plainJson, IDataProtectionProvider dataProtectionProvider, Guid sessionId)
    {
        if (string.IsNullOrWhiteSpace(plainJson))
        {
            return null;
        }

        var protector = dataProtectionProvider.CreateProtector("cogita", "live-session", "answer-json", sessionId.ToString("N"));
        return $"enc1:{protector.Protect(plainJson)}";
    }

    private static string? ProtectLiveSessionScopedText(
        string? plainText,
        IDataProtectionProvider dataProtectionProvider,
        Guid sessionId,
        string purpose)
    {
        if (string.IsNullOrWhiteSpace(plainText))
        {
            return null;
        }

        var protector = dataProtectionProvider.CreateProtector("cogita", "live-session", purpose, sessionId.ToString("N"));
        return $"enc1:{protector.Protect(plainText)}";
    }

    private static string? UnprotectLiveSessionScopedJson(string? storedValue, IDataProtectionProvider dataProtectionProvider, Guid sessionId)
    {
        if (string.IsNullOrWhiteSpace(storedValue))
        {
            return null;
        }

        if (!storedValue.StartsWith("enc1:", StringComparison.Ordinal))
        {
            return storedValue;
        }

        try
        {
            var protector = dataProtectionProvider.CreateProtector("cogita", "live-session", "answer-json", sessionId.ToString("N"));
            var cipher = storedValue["enc1:".Length..];
            return protector.Unprotect(cipher);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    private static string? UnprotectLiveSessionScopedText(
        string? storedValue,
        IDataProtectionProvider dataProtectionProvider,
        Guid sessionId,
        string purpose)
    {
        if (string.IsNullOrWhiteSpace(storedValue))
        {
            return null;
        }

        if (!storedValue.StartsWith("enc1:", StringComparison.Ordinal))
        {
            return storedValue;
        }

        try
        {
            var protector = dataProtectionProvider.CreateProtector("cogita", "live-session", purpose, sessionId.ToString("N"));
            var cipher = storedValue["enc1:".Length..];
            return protector.Unprotect(cipher);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    private static string ResolveLiveParticipantDisplayName(
        CogitaLiveRevisionParticipant participant,
        IDataProtectionProvider dataProtectionProvider,
        Guid sessionId)
    {
        var decrypted = UnprotectLiveSessionScopedText(participant.DisplayNameCipher, dataProtectionProvider, sessionId, "participant-name");
        if (!string.IsNullOrWhiteSpace(decrypted))
        {
            return decrypted.Trim();
        }

        if (!string.IsNullOrWhiteSpace(participant.DisplayName) &&
            !string.Equals(participant.DisplayName, "[encrypted]", StringComparison.OrdinalIgnoreCase))
        {
            return participant.DisplayName.Trim();
        }

        return participant.Id.ToString("N")[..8];
    }

    private static string ResolveLiveReloginDisplayName(
        CogitaLiveRevisionReloginRequest request,
        IDataProtectionProvider dataProtectionProvider,
        Guid sessionId)
    {
        var decrypted = UnprotectLiveSessionScopedText(request.DisplayNameCipher, dataProtectionProvider, sessionId, "relogin-name");
        if (!string.IsNullOrWhiteSpace(decrypted))
        {
            return decrypted.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.DisplayName) &&
            !string.Equals(request.DisplayName, "[encrypted]", StringComparison.OrdinalIgnoreCase))
        {
            return request.DisplayName.Trim();
        }

        return request.Id.ToString("N")[..8];
    }

    private static int GetLiveSessionStatusRank(string? status)
    {
        return status?.Trim().ToLowerInvariant() switch
        {
            "lobby" => 0,
            "running" => 1,
            "revealed" => 2,
            "finished" => 3,
            "closed" => 4,
            _ => 0
        };
    }

    private static (string? ItemType, Guid? ItemId, string? CheckType, string? Direction) ParseCardIdentityFromCardKey(string? cardKey)
    {
        if (string.IsNullOrWhiteSpace(cardKey))
        {
            return (null, null, null, null);
        }

        var colonParts = cardKey.Split(':');
        if (colonParts.Length >= 2 &&
            !string.IsNullOrWhiteSpace(colonParts[0]) &&
            Guid.TryParse(colonParts[1], out var colonItemId))
        {
            var itemType = colonParts[0].Trim().ToLowerInvariant();
            itemType = itemType switch
            {
                "vocab" => "connection",
                "connection" => "connection",
                "collection" => "collection",
                _ => "info"
            };

            var checkType = colonParts.Length > 2 && !string.IsNullOrWhiteSpace(colonParts[2])
                ? colonParts[2].Trim().ToLowerInvariant()
                : null;
            var direction = colonParts.Length > 3
                ? string.Join(":", colonParts.Skip(3)).Trim().ToLowerInvariant()
                : null;
            if (string.IsNullOrWhiteSpace(direction))
            {
                direction = null;
            }

            return (itemType, colonItemId, checkType, direction);
        }

        var legacyParts = cardKey.Split('|');
        if (legacyParts.Length == 0 || !Guid.TryParse(legacyParts[0], out var legacyItemId))
        {
            return (null, null, null, null);
        }

        var legacyCheckType = legacyParts.Length > 1 && !string.IsNullOrWhiteSpace(legacyParts[1])
            ? legacyParts[1].Trim().ToLowerInvariant()
            : null;
        var legacyDirection = legacyParts.Length > 2 && !string.IsNullOrWhiteSpace(legacyParts[2])
            ? legacyParts[2].Trim().ToLowerInvariant()
            : null;
        var legacyItemType = legacyCheckType == "connection" ? "connection" : "info";
        return (legacyItemType, legacyItemId, legacyCheckType, legacyDirection);
    }

    private static (string? ItemType, Guid? ItemId, string? CheckType, string? Direction, string? CardKey) ResolveCardIdentityFromPromptJson(string? promptJson)
    {
        if (string.IsNullOrWhiteSpace(promptJson))
        {
            return (null, null, null, null, null);
        }

        try
        {
            var node = JsonNode.Parse(promptJson) as JsonObject;
            var cardKey = node?["cardKey"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(cardKey))
            {
                return (null, null, null, null, null);
            }

            var (itemType, itemId, checkType, direction) = ParseCardIdentityFromCardKey(cardKey);
            return (itemType, itemId, checkType, direction, cardKey);
        }
        catch
        {
            return (null, null, null, null, null);
        }
    }

    private static DateTimeOffset? ResolvePromptStartUtc(string? promptJson)
    {
        if (string.IsNullOrWhiteSpace(promptJson))
        {
            return null;
        }

        try
        {
            var node = JsonNode.Parse(promptJson) as JsonObject;
            if (node is null)
            {
                return null;
            }

            var candidateFields = new[]
            {
                "roundTimerStartedUtc",
                "bonusTimerStartedUtc",
                "actionTimerStartedUtc",
                "publishedUtc",
                "createdUtc"
            };
            foreach (var field in candidateFields)
            {
                var raw = node[field]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(raw) && DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
                {
                    return parsed.ToUniversalTime();
                }
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    private static double ResolveCorrectnessValue(string? maskBase64, bool fallbackCorrect)
    {
        if (!string.IsNullOrWhiteSpace(maskBase64))
        {
            try
            {
                var bytes = Convert.FromBase64String(maskBase64);
                if (bytes.Length > 0)
                {
                    var sum = bytes.Sum(x => (double)x);
                    return Math.Clamp(sum / (bytes.Length * 255d), 0d, 1d);
                }
            }
            catch
            {
                // fall back to boolean correctness
            }
        }

        return fallbackCorrect ? 1d : 0d;
    }

    private readonly record struct TemporalKnownessEntry(double Correctness, DateTimeOffset CreatedUtc);

    private readonly record struct TemporalKnownessSummary(double Score, DateTimeOffset? LastReviewedUtc);

    private static TemporalKnownessSummary ComputeKnownessSummary(IEnumerable<TemporalKnownessEntry> rawEntries, DateTimeOffset nowUtc)
    {
        var summary = CogitaKnownessCore.ComputeSummary(
            rawEntries.Select(x => new KnownessEntry(x.Correctness, x.CreatedUtc)),
            nowUtc);
        return new TemporalKnownessSummary(summary.Score, summary.LastReviewedUtc);
    }

    private readonly record struct StatisticsParticipantRef(
        string Key,
        string Kind,
        Guid? PersonRoleId,
        Guid? ParticipantId,
        string Label);

    private sealed class StatisticsParticipantState
    {
        public StatisticsParticipantState(StatisticsParticipantRef participant)
        {
            Participant = participant;
        }

        public StatisticsParticipantRef Participant { get; }
        public int EventCount { get; set; }
        public int AnswerCount { get; set; }
        public int CorrectCount { get; set; }
        public double CorrectnessSum { get; set; }
        public double DurationSumMs { get; set; }
        public int DurationCount { get; set; }
        public double CorrectAnswerPointsSum { get; set; }
        public double BasePointsSum { get; set; }
        public double FirstBonusPointsSum { get; set; }
        public double SpeedBonusPointsSum { get; set; }
        public double StreakBonusPointsSum { get; set; }
        public int TotalPoints { get; set; }
        public DateTimeOffset? LastActivityUtc { get; set; }
        public List<TemporalKnownessEntry> KnownessEntries { get; } = new();
    }

    private static StatisticsParticipantRef ResolveStatisticsParticipantRef(CogitaStatisticEvent statisticEvent)
    {
        if (statisticEvent.PersonRoleId.HasValue && statisticEvent.PersonRoleId.Value != Guid.Empty)
        {
            var roleId = statisticEvent.PersonRoleId.Value;
            var label = !string.IsNullOrWhiteSpace(statisticEvent.ParticipantLabel)
                ? statisticEvent.ParticipantLabel!
                : $"Role {roleId.ToString("N")[..8]}";
            return new StatisticsParticipantRef($"person:{roleId:N}", "person", roleId, null, label);
        }

        if (statisticEvent.ParticipantId.HasValue && statisticEvent.ParticipantId.Value != Guid.Empty)
        {
            var participantId = statisticEvent.ParticipantId.Value;
            var label = !string.IsNullOrWhiteSpace(statisticEvent.ParticipantLabel)
                ? statisticEvent.ParticipantLabel!
                : $"Participant {participantId.ToString("N")[..8]}";
            return new StatisticsParticipantRef($"participant:{participantId:N}", "participant", null, participantId, label);
        }

        return new StatisticsParticipantRef("system", "system", null, null, "System");
    }

    private static async Task<List<CogitaLiveRevisionParticipantResponse>> BuildLiveRevisionParticipantsAsync(
        Guid sessionId,
        IDataProtectionProvider dataProtectionProvider,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var scoreByParticipant = await BuildLiveParticipantScoreMapAsync(sessionId, dbContext, ct);
        var participants = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .OrderBy(x => x.JoinedUtc)
            .ToListAsync(ct);

        return participants.Select(x => new CogitaLiveRevisionParticipantResponse(
            x.Id,
            ResolveLiveParticipantDisplayName(x, dataProtectionProvider, sessionId),
            scoreByParticipant.TryGetValue(x.Id, out var score) ? score : 0,
            x.IsConnected,
            x.JoinedUtc)).ToList();
    }

    private static async Task<List<CogitaLiveRevisionParticipantScoreResponse>> BuildLiveRevisionScoreboardAsync(
        Guid sessionId,
        IDataProtectionProvider dataProtectionProvider,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var scoreByParticipant = await BuildLiveParticipantScoreMapAsync(sessionId, dbContext, ct);
        var participants = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .OrderBy(x => x.JoinedUtc)
            .ToListAsync(ct);

        return participants
            .Select(x => new CogitaLiveRevisionParticipantScoreResponse(
                x.Id,
                ResolveLiveParticipantDisplayName(x, dataProtectionProvider, sessionId),
                scoreByParticipant.TryGetValue(x.Id, out var score) ? score : 0))
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static async Task<Dictionary<Guid, int>> BuildLiveParticipantScoreMapAsync(
        Guid sessionId,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var computed = await ComputeLiveSessionScoresOnTheFlyAsync(sessionId, dbContext, ct);
        return computed.TotalsByParticipant;
    }

    private static async Task<List<CogitaLiveRevisionScoreHistoryPointResponse>> BuildLiveRevisionScoreHistoryAsync(
        Guid sessionId,
        IDataProtectionProvider dataProtectionProvider,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var participants = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .OrderBy(x => x.JoinedUtc)
            .ToListAsync(ct);
        if (participants.Count == 0)
        {
            return new List<CogitaLiveRevisionScoreHistoryPointResponse>();
        }

        var publishedRoundRows = await dbContext.CogitaStatisticEvents.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.EventType == "live_round_published" && x.RoundIndex.HasValue)
            .OrderBy(x => x.CreatedUtc)
            .Select(x => new { RoundIndex = x.RoundIndex!.Value, x.CreatedUtc })
            .ToListAsync(ct);
        var firstPublishedUtcByRound = publishedRoundRows
            .GroupBy(x => x.RoundIndex)
            .ToDictionary(group => group.Key, group => group.Min(item => item.CreatedUtc));

        var answers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.IsCorrect != null)
            .OrderBy(x => x.RoundIndex)
            .ThenBy(x => x.SubmittedUtc)
            .ToListAsync(ct);
        answers = answers
            .GroupBy(x => new { x.RoundIndex, x.ParticipantId })
            .Select(group => group
                .OrderByDescending(item => item.UpdatedUtc)
                .ThenByDescending(item => item.SubmittedUtc)
                .First())
            .OrderBy(x => x.RoundIndex)
            .ThenBy(x => x.SubmittedUtc)
            .ToList();
        var allRoundIndexes = publishedRoundRows
            .Select(x => x.RoundIndex)
            .Concat(answers.Select(x => x.RoundIndex))
            .Distinct()
            .OrderBy(x => x)
            .ToList();
        if (allRoundIndexes.Count == 0)
        {
            return new List<CogitaLiveRevisionScoreHistoryPointResponse>();
        }
        var computed = await ComputeLiveSessionScoresOnTheFlyAsync(sessionId, dbContext, ct);

        var scoreByParticipant = participants.ToDictionary(x => x.Id, _ => 0);
        var snapshots = new List<CogitaLiveRevisionScoreHistoryPointResponse>();
        var answerByRoundParticipant = answers.ToDictionary(x => (x.RoundIndex, x.ParticipantId), x => x);
        foreach (var roundIndex in allRoundIndexes)
        {
            DateTimeOffset? roundRecordedUtc = null;
            foreach (var participant in participants)
            {
                if (!answerByRoundParticipant.TryGetValue((roundIndex, participant.Id), out var answer))
                {
                    continue;
                }
                scoreByParticipant[participant.Id] += computed.DetailByRoundParticipant.TryGetValue((answer.RoundIndex, answer.ParticipantId), out var detail)
                    ? detail.Points
                    : 0;
                var answerRecordedUtc = answer.UpdatedUtc > answer.SubmittedUtc ? answer.UpdatedUtc : answer.SubmittedUtc;
                roundRecordedUtc = roundRecordedUtc.HasValue
                    ? (roundRecordedUtc.Value > answerRecordedUtc ? roundRecordedUtc.Value : answerRecordedUtc)
                    : answerRecordedUtc;
            }

            var roundScores = participants
                .Select(x => new CogitaLiveRevisionParticipantScoreResponse(
                    x.Id,
                    ResolveLiveParticipantDisplayName(x, dataProtectionProvider, sessionId),
                    scoreByParticipant.TryGetValue(x.Id, out var score) ? score : 0))
                .ToList();

            var recordedUtc = roundRecordedUtc ??
                (firstPublishedUtcByRound.TryGetValue(roundIndex, out var publishedUtc) ? publishedUtc : DateTimeOffset.UtcNow);
            snapshots.Add(new CogitaLiveRevisionScoreHistoryPointResponse(
                roundIndex,
                recordedUtc,
                roundScores));
        }

        return snapshots;
    }

    private static async Task<List<CogitaLiveRevisionCorrectnessHistoryPointResponse>> BuildLiveRevisionCorrectnessHistoryAsync(
        Guid sessionId,
        IDataProtectionProvider dataProtectionProvider,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var participants = await dbContext.CogitaLiveRevisionParticipants.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .ToListAsync(ct);
        if (participants.Count == 0)
        {
            return new List<CogitaLiveRevisionCorrectnessHistoryPointResponse>();
        }

        var participantNameById = participants.ToDictionary(
            x => x.Id,
            x => ResolveLiveParticipantDisplayName(x, dataProtectionProvider, sessionId));
        var publishedRoundRows = await dbContext.CogitaStatisticEvents.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.EventType == "live_round_published" && x.RoundIndex.HasValue)
            .OrderBy(x => x.CreatedUtc)
            .Select(x => new { RoundIndex = x.RoundIndex!.Value, x.CreatedUtc })
            .ToListAsync(ct);
        var firstPublishedUtcByRound = publishedRoundRows
            .GroupBy(x => x.RoundIndex)
            .ToDictionary(group => group.Key, group => group.Min(item => item.CreatedUtc));

        var answers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .OrderBy(x => x.RoundIndex)
            .ThenBy(x => x.SubmittedUtc)
            .ToListAsync(ct);
        answers = answers
            .GroupBy(x => new { x.RoundIndex, x.ParticipantId })
            .Select(group => group
                .OrderByDescending(item => item.UpdatedUtc)
                .ThenByDescending(item => item.SubmittedUtc)
                .First())
            .OrderBy(x => x.RoundIndex)
            .ThenBy(x => x.SubmittedUtc)
            .ToList();
        var allRoundIndexes = publishedRoundRows
            .Select(x => x.RoundIndex)
            .Concat(answers.Select(x => x.RoundIndex))
            .Distinct()
            .OrderBy(x => x)
            .ToList();
        if (allRoundIndexes.Count == 0)
        {
            return new List<CogitaLiveRevisionCorrectnessHistoryPointResponse>();
        }

        var computed = await ComputeLiveSessionScoresOnTheFlyAsync(sessionId, dbContext, ct);
        var answerByRoundParticipant = answers.ToDictionary(x => (x.RoundIndex, x.ParticipantId), x => x);

        var snapshots = new List<CogitaLiveRevisionCorrectnessHistoryPointResponse>();
        foreach (var roundIndex in allRoundIndexes)
        {
            DateTimeOffset? roundRecordedUtc = null;
            var entries = participants
                .Select(participant =>
                {
                    if (!answerByRoundParticipant.TryGetValue((roundIndex, participant.Id), out var answer))
                    {
                        var missingSubmittedUtc = firstPublishedUtcByRound.TryGetValue(roundIndex, out var publishedUtc)
                            ? publishedUtc
                            : DateTimeOffset.UtcNow;
                        return new CogitaLiveRevisionCorrectnessEntryResponse(
                            participant.Id,
                            participantNameById.TryGetValue(participant.Id, out var missingName)
                                ? missingName
                                : participant.Id.ToString("N")[..8],
                            false,
                            0,
                            missingSubmittedUtc,
                            null,
                            0,
                            0,
                            0,
                            0);
                    }

                    var key = (answer.RoundIndex, answer.ParticipantId);
                    var fallbackDurationMs = Math.Max(0, (int)Math.Round((answer.UpdatedUtc - answer.SubmittedUtc).TotalMilliseconds));
                    var hasDetail = computed.DetailByRoundParticipant.TryGetValue(key, out var detail);
                    var answerRecordedUtc = answer.UpdatedUtc > answer.SubmittedUtc ? answer.UpdatedUtc : answer.SubmittedUtc;
                    roundRecordedUtc = roundRecordedUtc.HasValue
                        ? (roundRecordedUtc.Value > answerRecordedUtc ? roundRecordedUtc.Value : answerRecordedUtc)
                        : answerRecordedUtc;
                    return new CogitaLiveRevisionCorrectnessEntryResponse(
                        answer.ParticipantId,
                        participantNameById.TryGetValue(answer.ParticipantId, out var participantName)
                            ? participantName
                            : answer.ParticipantId.ToString("N")[..8],
                        answer.IsCorrect,
                        hasDetail ? detail.Points : 0,
                        answer.SubmittedUtc,
                        hasDetail ? detail.DurationMs : fallbackDurationMs,
                        hasDetail ? detail.BasePoints : 0,
                        hasDetail ? detail.FirstBonusPoints : 0,
                        hasDetail ? detail.SpeedBonusPoints : 0,
                        hasDetail ? detail.StreakBonusPoints : 0);
                })
                .ToList();

            snapshots.Add(new CogitaLiveRevisionCorrectnessHistoryPointResponse(
                roundIndex,
                roundRecordedUtc ??
                    (firstPublishedUtcByRound.TryGetValue(roundIndex, out var publishedUtc) ? publishedUtc : DateTimeOffset.UtcNow),
                entries));
        }

        return snapshots;
    }

    private static async Task<List<CogitaLiveRevisionReloginRequestResponse>> BuildLiveRevisionPendingReloginRequestsAsync(
        Guid sessionId,
        IDataProtectionProvider dataProtectionProvider,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var requests = await dbContext.CogitaLiveRevisionReloginRequests.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.Status == "pending")
            .OrderBy(x => x.RequestedUtc)
            .ToListAsync(ct);

        return requests.Select(x => new CogitaLiveRevisionReloginRequestResponse(
            x.Id,
            ResolveLiveReloginDisplayName(x, dataProtectionProvider, sessionId),
            x.Status,
            x.RequestedUtc,
            x.ApprovedUtc)).ToList();
    }

    private static async Task<CogitaLiveRevisionSessionResponse> BuildLiveRevisionHostSessionResponseAsync(
        CogitaLiveRevisionSession session,
        string? code,
        string? hostSecret,
        IDataProtectionProvider dataProtectionProvider,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var meta = ParseLiveSessionMeta(session.SessionMetaJson);
        var computedScores = await ComputeLiveSessionScoresOnTheFlyAsync(session.Id, dbContext, ct);
        var resolvedCode = code ?? TryDecryptLiveSessionPublicCode(meta.EncryptedPublicCode, dataProtectionProvider) ?? string.Empty;
        var participants = await BuildLiveRevisionParticipantsAsync(session.Id, dataProtectionProvider, dbContext, ct);
        var scoreboard = participants
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.JoinedUtc)
            .Select(x => new CogitaLiveRevisionParticipantScoreResponse(x.ParticipantId, x.DisplayName, x.Score))
            .ToList();
        var answers = await dbContext.CogitaLiveRevisionAnswers.AsNoTracking()
            .Where(x => x.SessionId == session.Id && x.RoundIndex == session.CurrentRoundIndex)
            .OrderBy(x => x.SubmittedUtc)
            .ToListAsync(ct);
        var currentRoundAnswers = answers.Select(x => new CogitaLiveRevisionAnswerResponse(
            x.ParticipantId,
            x.RoundIndex,
            x.CardKey,
            ParseJsonNullable(UnprotectLiveSessionScopedJson(x.AnswerJson, dataProtectionProvider, session.Id)),
            x.IsCorrect,
            computedScores.DetailByRoundParticipant.TryGetValue((x.RoundIndex, x.ParticipantId), out var detail) ? detail.Points : 0,
            x.SubmittedUtc)).ToList();
        var pendingReloginRequests = await BuildLiveRevisionPendingReloginRequestsAsync(session.Id, dataProtectionProvider, dbContext, ct);
        JsonElement? currentPrompt = ParseJsonNullable(session.CurrentPromptJson);
        JsonElement? currentReveal = ParseJsonNullable(session.CurrentRevealJson);
        if (currentPrompt.HasValue && currentReveal.HasValue)
        {
            try
            {
                var promptNode = JsonNode.Parse(currentPrompt.Value.GetRawText()) as JsonObject;
                var revealNode = JsonNode.Parse(currentReveal.Value.GetRawText()) as JsonObject;
                if (promptNode is not null && revealNode is not null)
                {
                    await AppendLiveRoundAnswerDistributionAsync(
                        session.Id,
                        session.CurrentRoundIndex,
                        promptNode["cardKey"]?.GetValue<string>()?.Trim(),
                        promptNode,
                        revealNode,
                        dataProtectionProvider,
                        dbContext,
                        ct);
                    currentReveal = JsonNodeToJsonElement(revealNode);
                }
            }
            catch
            {
                // Keep original payload on parse failures.
            }
        }

        return new CogitaLiveRevisionSessionResponse(
            session.Id,
            resolvedCode,
            hostSecret ?? string.Empty,
            session.LibraryId,
            session.RevisionId,
            session.CollectionId,
            meta.SessionMode,
            meta.HostViewMode,
            meta.ParticipantViewMode,
            meta.SessionSettings,
            session.Status,
            session.CurrentRoundIndex,
            session.RevealVersion,
            currentPrompt,
            currentReveal,
            participants,
            scoreboard,
            currentRoundAnswers,
            pendingReloginRequests
        );
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

        if (!await HasCogitaRevisionShareRuntimeSchemaAsync(dbContext, ct))
        {
            return null;
        }

        code = code.Trim();
        if (code.Length < 6 || code.Length > 128)
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

    private static async Task<bool> HasCogitaRevisionShareRuntimeSchemaAsync(
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        const string sql = @"
            SELECT CASE WHEN
                OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'LibraryId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'RevisionId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'CollectionId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'OwnerRoleId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'SharedViewId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'PublicCodeHash') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'EncShareCode') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'Mode') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'CheckMode') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'CardLimit') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'CreatedUtc') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaRevisionShares', 'RevokedUtc') IS NOT NULL
            THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END;";

        try
        {
            var connection = dbContext.Database.GetDbConnection();
            var shouldClose = connection.State != ConnectionState.Open;
            if (shouldClose)
            {
                await connection.OpenAsync(ct);
            }

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = sql;
                var scalar = await command.ExecuteScalarAsync(ct);
                return scalar is bool value && value;
            }
            finally
            {
                if (shouldClose)
                {
                    await connection.CloseAsync();
                }
            }
        }
        catch
        {
            return false;
        }
    }

    private static async Task<bool> HasCogitaStoryboardShareRuntimeSchemaAsync(
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        const string sql = @"
            SELECT CASE WHEN
                OBJECT_ID(N'dbo.CogitaStoryboardShares', N'U') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaStoryboardShares', 'LibraryId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaStoryboardShares', 'ProjectId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaStoryboardShares', 'OwnerRoleId') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaStoryboardShares', 'PublicCodeHash') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaStoryboardShares', 'EncShareCode') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaStoryboardShares', 'CreatedUtc') IS NOT NULL AND
                COL_LENGTH('dbo.CogitaStoryboardShares', 'RevokedUtc') IS NOT NULL
            THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END;";

        try
        {
            var connection = dbContext.Database.GetDbConnection();
            var shouldClose = connection.State != ConnectionState.Open;
            if (shouldClose)
            {
                await connection.OpenAsync(ct);
            }

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = sql;
                var scalar = await command.ExecuteScalarAsync(ct);
                return scalar is bool value && value;
            }
            finally
            {
                if (shouldClose)
                {
                    await connection.CloseAsync();
                }
            }
        }
        catch
        {
            return false;
        }
    }
}
