using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;

namespace Recreatio.Api.Security;

public interface IKeyRingService
{
    byte[] RequireMasterKey(HttpContext context, Guid userId, string sessionId);
    Task<RoleKeyRing> BuildRoleKeyRingAsync(HttpContext context, Guid userId, string sessionId, CancellationToken ct);
    byte[] DecryptDataKey(KeyEntry keyEntry, byte[] readKey);
    byte[] EncryptDataKey(byte[] readKey, byte[] dataKey, Guid dataKeyId);
    byte[] EncryptFieldValue(byte[] dataKey, string value, Guid roleId, string fieldType);
    string? TryDecryptFieldValue(byte[] dataKey, byte[] encryptedValue, Guid roleId, string fieldType);
}

public sealed class KeyRingService : IKeyRingService
{
    private static readonly Encoding Utf8 = Encoding.UTF8;
    private readonly RecreatioDbContext _dbContext;
    private readonly IEncryptionService _encryptionService;
    private readonly ISessionSecretCache _sessionSecretCache;
    private readonly IMasterKeyService _masterKeyService;
    private readonly ILogger<KeyRingService> _logger;

    public KeyRingService(
        RecreatioDbContext dbContext,
        IEncryptionService encryptionService,
        ISessionSecretCache sessionSecretCache,
        IMasterKeyService masterKeyService,
        ILogger<KeyRingService> logger)
    {
        _dbContext = dbContext;
        _encryptionService = encryptionService;
        _sessionSecretCache = sessionSecretCache;
        _masterKeyService = masterKeyService;
        _logger = logger;
    }

    public byte[] RequireMasterKey(HttpContext context, Guid userId, string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            throw new InvalidOperationException("Session ID missing.");
        }

        var secureMode = AuthClaims.IsSecureMode(context.User);
        if (!secureMode && _sessionSecretCache.TryGet(sessionId, out var secret))
        {
            return secret.MasterKey;
        }

        if (!AuthClaims.TryGetH3(context.User, out var h3))
        {
            throw new InvalidOperationException("H3 claim missing.");
        }

        var masterKey = _masterKeyService.DeriveMasterKey(h3, userId);
        if (!secureMode)
        {
            if (_sessionSecretCache.TryGet(sessionId, out var existing))
            {
                _sessionSecretCache.Set(sessionId, existing with { MasterKey = masterKey });
            }
            else
            {
                _sessionSecretCache.Set(sessionId, new SessionSecret(masterKey, null));
            }
        }

        return masterKey;
    }

    public async Task<RoleKeyRing> BuildRoleKeyRingAsync(HttpContext context, Guid userId, string sessionId, CancellationToken ct)
    {
        var secureMode = AuthClaims.IsSecureMode(context.User);
        if (!secureMode && _sessionSecretCache.TryGet(sessionId, out var cached) && cached.CachedRoleKeyRing is not null)
        {
            return cached.CachedRoleKeyRing;
        }

        var masterKey = RequireMasterKey(context, userId, sessionId);
        var readKeys = new Dictionary<Guid, byte[]>();
        var writeKeys = new Dictionary<Guid, byte[]>();
        var account = await _dbContext.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (account is not null)
        {
            var rootKeyEntries = await _dbContext.Keys.AsNoTracking()
                .Where(key => key.OwnerRoleId == account.MasterRoleId
                    && (key.KeyType == KeyType.RoleReadKey || key.KeyType == KeyType.RoleWriteKey))
                .ToListAsync(ct);

            var readEntry = rootKeyEntries.FirstOrDefault(x => x.KeyType == KeyType.RoleReadKey);
            var writeEntry = rootKeyEntries.FirstOrDefault(x => x.KeyType == KeyType.RoleWriteKey);
            if (readEntry is not null)
            {
                readKeys[account.MasterRoleId] = _encryptionService.Decrypt(masterKey, readEntry.EncryptedKeyBlob, account.MasterRoleId.ToByteArray());
            }
            if (writeEntry is not null)
            {
                writeKeys[account.MasterRoleId] = _encryptionService.Decrypt(masterKey, writeEntry.EncryptedKeyBlob, account.MasterRoleId.ToByteArray());
            }
        }

        var memberships = await _dbContext.Memberships.AsNoTracking()
            .Where(x => x.UserId == userId)
            .ToListAsync(ct);

        foreach (var membership in memberships)
        {
            if (membership.EncryptedReadKeyCopy.Length > 0)
            {
                try
                {
                    var readKey = _encryptionService.Decrypt(masterKey, membership.EncryptedReadKeyCopy, membership.RoleId.ToByteArray());
                    readKeys[membership.RoleId] = readKey;
                }
                catch (CryptographicException)
                {
                    _logger.LogWarning("Failed to decrypt membership read key copy for role {RoleId}.", membership.RoleId);
                }
            }

            if (membership.EncryptedWriteKeyCopy is { Length: > 0 })
            {
                try
                {
                    var writeKey = _encryptionService.Decrypt(masterKey, membership.EncryptedWriteKeyCopy, membership.RoleId.ToByteArray());
                    writeKeys[membership.RoleId] = writeKey;
                }
                catch (CryptographicException)
                {
                    _logger.LogWarning("Failed to decrypt membership write key copy for role {RoleId}.", membership.RoleId);
                }
            }
        }

        if (readKeys.Count == 0)
        {
            return new RoleKeyRing(readKeys, writeKeys);
        }

        var edges = await _dbContext.RoleEdges.AsNoTracking().ToListAsync(ct);
        var edgesByParent = edges.GroupBy(edge => edge.ParentRoleId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var queue = new Queue<Guid>(readKeys.Keys);
        while (queue.Count > 0)
        {
            var parentRoleId = queue.Dequeue();
            if (!edgesByParent.TryGetValue(parentRoleId, out var childEdges))
            {
                continue;
            }

            var parentReadKey = readKeys[parentRoleId];
            foreach (var edge in childEdges)
            {
                if (readKeys.ContainsKey(edge.ChildRoleId))
                {
                    continue;
                }

                if (edge.EncryptedReadKeyCopy.Length == 0)
                {
                    continue;
                }

                try
                {
                    var childKey = _encryptionService.Decrypt(parentReadKey, edge.EncryptedReadKeyCopy, edge.ChildRoleId.ToByteArray());
                    readKeys[edge.ChildRoleId] = childKey;
                    queue.Enqueue(edge.ChildRoleId);
                }
                catch (CryptographicException)
                {
                    _logger.LogWarning("Failed to decrypt role edge read key copy from {ParentRoleId} to {ChildRoleId}.", parentRoleId, edge.ChildRoleId);
                    continue;
                }
            }
        }

        var writeQueue = new Queue<Guid>(writeKeys.Keys);
        while (writeQueue.Count > 0)
        {
            var parentRoleId = writeQueue.Dequeue();
            if (!edgesByParent.TryGetValue(parentRoleId, out var childEdges))
            {
                continue;
            }

            var parentWriteKey = writeKeys[parentRoleId];
            foreach (var edge in childEdges)
            {
                if (writeKeys.ContainsKey(edge.ChildRoleId))
                {
                    continue;
                }

                if (edge.EncryptedWriteKeyCopy is not { Length: > 0 })
                {
                    continue;
                }

                try
                {
                    var childKey = _encryptionService.Decrypt(parentWriteKey, edge.EncryptedWriteKeyCopy, edge.ChildRoleId.ToByteArray());
                    writeKeys[edge.ChildRoleId] = childKey;
                    writeQueue.Enqueue(edge.ChildRoleId);
                }
                catch (CryptographicException)
                {
                    _logger.LogWarning("Failed to decrypt role edge write key copy from {ParentRoleId} to {ChildRoleId}.", parentRoleId, edge.ChildRoleId);
                    continue;
                }
            }
        }

        var ring = new RoleKeyRing(readKeys, writeKeys);
        if (!secureMode)
        {
            if (_sessionSecretCache.TryGet(sessionId, out var existing))
            {
                _sessionSecretCache.Set(sessionId, existing with { CachedRoleKeyRing = ring });
            }
            else
            {
                _sessionSecretCache.Set(sessionId, new SessionSecret(masterKey, ring));
            }
        }

        return ring;
    }

    public byte[] DecryptDataKey(KeyEntry keyEntry, byte[] readKey)
    {
        return _encryptionService.Decrypt(readKey, keyEntry.EncryptedKeyBlob, keyEntry.Id.ToByteArray());
    }

    public byte[] EncryptDataKey(byte[] readKey, byte[] dataKey, Guid dataKeyId)
    {
        return _encryptionService.Encrypt(readKey, dataKey, dataKeyId.ToByteArray());
    }

    public byte[] EncryptFieldValue(byte[] dataKey, string value, Guid roleId, string fieldType)
    {
        var aad = Utf8.GetBytes($"{roleId:D}:{fieldType}");
        return _encryptionService.Encrypt(dataKey, Utf8.GetBytes(value), aad);
    }

    public string? TryDecryptFieldValue(byte[] dataKey, byte[] encryptedValue, Guid roleId, string fieldType)
    {
        var aad = Utf8.GetBytes($"{roleId:D}:{fieldType}");
        try
        {
            var plaintext = _encryptionService.Decrypt(dataKey, encryptedValue, aad);
            return Utf8.GetString(plaintext);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    public byte[] EncryptDataItemValue(byte[] dataKey, string value, Guid dataItemId, string itemName)
    {
        var aad = Utf8.GetBytes($"{dataItemId:D}:{itemName}");
        return _encryptionService.Encrypt(dataKey, Utf8.GetBytes(value), aad);
    }

    public string? TryDecryptDataItemValue(byte[] dataKey, byte[] encryptedValue, Guid dataItemId, string itemName)
    {
        var aad = Utf8.GetBytes($"{dataItemId:D}:{itemName}");
        try
        {
            var plaintext = _encryptionService.Decrypt(dataKey, encryptedValue, aad);
            return Utf8.GetString(plaintext);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
