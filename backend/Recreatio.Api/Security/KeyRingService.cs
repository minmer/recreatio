using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;

namespace Recreatio.Api.Security;

public interface IKeyRingService
{
    byte[] RequireMasterKey(HttpContext context, Guid userId, string sessionId);
    Task<RoleKeyRing> BuildRoleKeyRingAsync(HttpContext context, Guid userId, string sessionId, CancellationToken ct);
    byte[] DecryptDataKey(KeyEntry keyEntry, byte[] roleKey);
    byte[] EncryptDataKey(byte[] roleKey, byte[] dataKey, Guid dataKeyId);
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

    public KeyRingService(
        RecreatioDbContext dbContext,
        IEncryptionService encryptionService,
        ISessionSecretCache sessionSecretCache,
        IMasterKeyService masterKeyService)
    {
        _dbContext = dbContext;
        _encryptionService = encryptionService;
        _sessionSecretCache = sessionSecretCache;
        _masterKeyService = masterKeyService;
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
        var roleKeys = new Dictionary<Guid, byte[]>();
        var account = await _dbContext.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (account is not null)
        {
            roleKeys[account.MasterRoleId] = masterKey;
        }

        var memberships = await _dbContext.Memberships.AsNoTracking()
            .Where(x => x.UserId == userId)
            .ToListAsync(ct);

        foreach (var membership in memberships)
        {
            if (membership.EncryptedRoleKeyCopy.Length == 0)
            {
                continue;
            }

            try
            {
                var roleKey = _encryptionService.Decrypt(masterKey, membership.EncryptedRoleKeyCopy, membership.RoleId.ToByteArray());
                roleKeys[membership.RoleId] = roleKey;
            }
            catch (CryptographicException)
            {
                continue;
            }
        }

        if (roleKeys.Count == 0)
        {
            return new RoleKeyRing(roleKeys);
        }

        var edges = await _dbContext.RoleEdges.AsNoTracking().ToListAsync(ct);
        var edgesByParent = edges.GroupBy(edge => edge.ParentRoleId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var queue = new Queue<Guid>(roleKeys.Keys);
        while (queue.Count > 0)
        {
            var parentRoleId = queue.Dequeue();
            if (!edgesByParent.TryGetValue(parentRoleId, out var childEdges))
            {
                continue;
            }

            var parentKey = roleKeys[parentRoleId];
            foreach (var edge in childEdges)
            {
                if (roleKeys.ContainsKey(edge.ChildRoleId))
                {
                    continue;
                }

                if (edge.EncryptedRoleKeyCopy.Length == 0)
                {
                    continue;
                }

                try
                {
                    var childKey = _encryptionService.Decrypt(parentKey, edge.EncryptedRoleKeyCopy, edge.ChildRoleId.ToByteArray());
                    roleKeys[edge.ChildRoleId] = childKey;
                    queue.Enqueue(edge.ChildRoleId);
                }
                catch (CryptographicException)
                {
                    continue;
                }
            }
        }

        var ring = new RoleKeyRing(roleKeys);
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

    public byte[] DecryptDataKey(KeyEntry keyEntry, byte[] roleKey)
    {
        return _encryptionService.Decrypt(roleKey, keyEntry.EncryptedKeyBlob, keyEntry.Id.ToByteArray());
    }

    public byte[] EncryptDataKey(byte[] roleKey, byte[] dataKey, Guid dataKeyId)
    {
        return _encryptionService.Encrypt(roleKey, dataKey, dataKeyId.ToByteArray());
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
}
