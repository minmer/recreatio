using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Options;
using Recreatio.Api.Security;

namespace Recreatio.Api.Services;

public interface IAuthService
{
    Task<Guid> RegisterAsync(RegisterRequest request, CancellationToken ct);
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct);
    Task ChangePasswordAsync(Guid userId, PasswordChangeRequest request, CancellationToken ct);
    Task<SaltResponse> GetSaltAsync(string loginId, CancellationToken ct);
    Task<AvailabilityResponse> CheckAvailabilityAsync(string loginId, CancellationToken ct);
}

public sealed class AuthService : IAuthService
{
    private readonly RecreatioDbContext _dbContext;
    private readonly IHashingService _hashingService;
    private readonly IMasterKeyService _masterKeyService;
    private readonly IEncryptionService _encryptionService;
    private readonly IKeyRingService _keyRingService;
    private readonly ISessionSecretCache _sessionSecretCache;
    private readonly ILedgerService _ledgerService;
    private readonly AuthOptions _authOptions;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        RecreatioDbContext dbContext,
        IHashingService hashingService,
        IMasterKeyService masterKeyService,
        IEncryptionService encryptionService,
        IKeyRingService keyRingService,
        ISessionSecretCache sessionSecretCache,
        ILedgerService ledgerService,
        IOptions<AuthOptions> authOptions,
        ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _hashingService = hashingService;
        _masterKeyService = masterKeyService;
        _encryptionService = encryptionService;
        _keyRingService = keyRingService;
        _sessionSecretCache = sessionSecretCache;
        _ledgerService = ledgerService;
        _authOptions = authOptions.Value;
        _logger = logger;
    }

    public async Task<Guid> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var loginId = request.LoginId.Trim();
        if (!IsLoginIdValid(loginId))
        {
            throw new InvalidOperationException("LoginId is required.");
        }

        var existing = await _dbContext.UserAccounts.AsNoTracking()
            .AnyAsync(x => x.LoginId == loginId, ct);
        if (existing)
        {
            throw new InvalidOperationException("LoginId already exists.");
        }

        var userSalt = Convert.FromBase64String(request.UserSaltBase64);
        var h3 = Convert.FromBase64String(request.H3Base64);
        var storedH4 = _hashingService.Hash(h3);

        var userId = Guid.NewGuid();
        var masterKey = _masterKeyService.DeriveMasterKey(h3, userId);
        var masterRoleId = Guid.NewGuid();

        var roleReadKey = RandomNumberGenerator.GetBytes(32);
        var roleWriteKey = RandomNumberGenerator.GetBytes(32);
        var roleOwnerKey = RandomNumberGenerator.GetBytes(32);

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

        var encryptedRoleBlob = _encryptionService.Encrypt(roleOwnerKey, JsonSerializer.SerializeToUtf8Bytes(roleCrypto));
        var signingContext = new LedgerSigningContext(
            masterRoleId,
            Convert.FromBase64String(roleCrypto.PrivateSigningKeyBase64),
            roleCrypto.PrivateSigningKeyAlg);

        var now = DateTimeOffset.UtcNow;
        var masterRole = new Role
        {
            Id = masterRoleId,
            EncryptedRoleBlob = encryptedRoleBlob,
            PublicSigningKey = publicSigningKey,
            PublicSigningKeyAlg = "RSA-SHA256",
            PublicEncryptionKey = publicEncryptionKey,
            PublicEncryptionKeyAlg = "RSA-OAEP-SHA256",
            CreatedUtc = now,
            UpdatedUtc = now
        };

        var account = new UserAccount
        {
            Id = userId,
            LoginId = loginId,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim(),
            UserSalt = userSalt,
            StoredH4 = storedH4,
            State = _authOptions.RequireEmailConfirmation ? AccountState.PendingEmailConfirmation : AccountState.Active,
            FailedLoginCount = 0,
            MasterRoleId = masterRoleId,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        _dbContext.Roles.Add(masterRole);
        _dbContext.UserAccounts.Add(account);

        var roleKindFieldType = RoleFieldTypes.RoleKind;
        var roleKindValue = "MasterRole";
        var roleKindKeyId = Guid.NewGuid();
        var roleKindKey = RandomNumberGenerator.GetBytes(32);
        var encryptedRoleKindKey = _keyRingService.EncryptDataKey(roleReadKey, roleKindKey, roleKindKeyId);
        var encryptedRoleKindFieldType = _keyRingService.EncryptRoleFieldType(roleReadKey, roleKindFieldType, roleKindFieldId);
        var roleKindFieldTypeHash = HMACSHA256.HashData(roleReadKey, System.Text.Encoding.UTF8.GetBytes(roleKindFieldType));
        var readKeyLedger = await _ledgerService.AppendKeyAsync(
            "RoleReadKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { RoleId = masterRoleId }),
            ct,
            signingContext);
        var writeKeyLedger = await _ledgerService.AppendKeyAsync(
            "RoleWriteKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { RoleId = masterRoleId }),
            ct,
            signingContext);
        var ownerKeyLedger = await _ledgerService.AppendKeyAsync(
            "RoleOwnerKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { RoleId = masterRoleId }),
            ct,
            signingContext);
        var roleKindLedger = await _ledgerService.AppendKeyAsync(
            "RoleKindKeyCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new { RoleId = masterRoleId, FieldType = roleKindFieldType }),
            ct,
            signingContext);

        var roleKindFieldId = Guid.NewGuid();
        _dbContext.Keys.Add(new KeyEntry
        {
            Id = roleKindKeyId,
            KeyType = KeyType.DataKey,
            OwnerRoleId = masterRoleId,
            Version = 1,
            EncryptedKeyBlob = encryptedRoleKindKey,
            ScopeType = "role-field",
            ScopeSubtype = roleKindFieldType,
            BoundEntryId = roleKindFieldId,
            LedgerRefId = roleKindLedger.Id,
            CreatedUtc = now
        });
        _dbContext.KeyEntryBindings.Add(new KeyEntryBinding
        {
            Id = Guid.NewGuid(),
            KeyEntryId = roleKindKeyId,
            EntryId = roleKindFieldId,
            EntryType = "role-field",
            EntrySubtype = roleKindFieldType,
            CreatedUtc = now
        });

        _dbContext.Keys.Add(new KeyEntry
        {
            Id = Guid.NewGuid(),
            KeyType = KeyType.RoleReadKey,
            OwnerRoleId = masterRoleId,
            Version = 1,
            EncryptedKeyBlob = _encryptionService.Encrypt(masterKey, roleReadKey, masterRoleId.ToByteArray()),
            ScopeType = "role-key",
            ScopeSubtype = "read",
            LedgerRefId = readKeyLedger.Id,
            CreatedUtc = now
        });

        _dbContext.Keys.Add(new KeyEntry
        {
            Id = Guid.NewGuid(),
            KeyType = KeyType.RoleWriteKey,
            OwnerRoleId = masterRoleId,
            Version = 1,
            EncryptedKeyBlob = _encryptionService.Encrypt(masterKey, roleWriteKey, masterRoleId.ToByteArray()),
            ScopeType = "role-key",
            ScopeSubtype = "write",
            LedgerRefId = writeKeyLedger.Id,
            CreatedUtc = now
        });
        _dbContext.Keys.Add(new KeyEntry
        {
            Id = Guid.NewGuid(),
            KeyType = KeyType.RoleOwnerKey,
            OwnerRoleId = masterRoleId,
            Version = 1,
            EncryptedKeyBlob = _encryptionService.Encrypt(masterKey, roleOwnerKey, masterRoleId.ToByteArray()),
            ScopeType = "role-key",
            ScopeSubtype = "owner",
            LedgerRefId = ownerKeyLedger.Id,
            CreatedUtc = now
        });
 
        _dbContext.RoleFields.Add(new RoleField
        {
            Id = roleKindFieldId,
            RoleId = masterRoleId,
            FieldType = string.Empty,
            EncryptedFieldType = encryptedRoleKindFieldType,
            FieldTypeHash = roleKindFieldTypeHash,
            DataKeyId = roleKindKeyId,
            EncryptedValue = _keyRingService.EncryptFieldValue(roleKindKey, roleKindValue, masterRoleId, roleKindFieldType),
            CreatedUtc = now,
            UpdatedUtc = now
        });

        await _dbContext.SaveChangesAsync(ct);
        await _ledgerService.AppendAuthAsync("RegistrationCreated", userId.ToString(), JsonSerializer.Serialize(new { LoginId = loginId }), ct, signingContext);
        await _ledgerService.AppendKeyAsync(
            "MasterRoleCreated",
            userId.ToString(),
            JsonSerializer.Serialize(new
            {
                RoleId = masterRoleId,
                PublicSigningKeyHash = publicSigningKeyHash,
                PublicEncryptionKeyHash = publicEncryptionKeyHash,
                PublicSigningKeyAlg = masterRole.PublicSigningKeyAlg,
                PublicEncryptionKeyAlg = masterRole.PublicEncryptionKeyAlg
            }),
            ct,
            signingContext);

        return userId;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var loginId = request.LoginId.Trim();
        if (!IsLoginIdValid(loginId))
        {
            throw new InvalidOperationException("LoginId is required.");
        }

        var account = await _dbContext.UserAccounts
            .Include(x => x.MasterRole)
            .FirstOrDefaultAsync(x => x.LoginId == loginId, ct);
        if (account is null)
        {
            _logger.LogWarning("Login failed: account not found for {LoginId}.", loginId);
            await _ledgerService.AppendAuthAsync("LoginFailed", "unknown", JsonSerializer.Serialize(new { LoginId = loginId }), ct);
            throw new InvalidOperationException("Invalid credentials.");
        }

        if (account.State == AccountState.Locked && account.LockedUntilUtc <= DateTimeOffset.UtcNow)
        {
            account.State = AccountState.Active;
            account.LockedUntilUtc = null;
        }

        if (account.State != AccountState.Active)
        {
            _logger.LogWarning("Login rejected for {LoginId} due to state {State}.", loginId, account.State);
            await _ledgerService.AppendAuthAsync("LoginRejected", account.Id.ToString(), JsonSerializer.Serialize(new { account.State }), ct);
            throw new InvalidOperationException("Account not active.");
        }

        var h3 = Convert.FromBase64String(request.H3Base64);
        if (h3.Length != 32)
        {
            _logger.LogWarning("Login failed: H3 length {Length} for {LoginId}.", h3.Length, loginId);
            throw new InvalidOperationException("Invalid credentials.");
        }
        var h4 = _hashingService.Hash(h3);
        if (!CryptographicOperations.FixedTimeEquals(h4, account.StoredH4))
        {
            _logger.LogWarning("Login failed: H4 mismatch for {LoginId}.", loginId);
            account.FailedLoginCount += 1;
            if (account.FailedLoginCount >= _authOptions.MaxFailedLoginAttempts)
            {
                account.State = AccountState.Locked;
                account.LockedUntilUtc = DateTimeOffset.UtcNow.AddMinutes(_authOptions.LockoutMinutes);
                await _ledgerService.AppendAuthAsync("AccountLocked", account.Id.ToString(), JsonSerializer.Serialize(new { account.LockedUntilUtc }), ct);
            }

            await _dbContext.SaveChangesAsync(ct);
            await _ledgerService.AppendAuthAsync("LoginFailed", account.Id.ToString(), "{}", ct);
            throw new InvalidOperationException("Invalid credentials.");
        }

        account.FailedLoginCount = 0;
        account.UpdatedUtc = DateTimeOffset.UtcNow;

        var masterKey = _masterKeyService.DeriveMasterKey(h3, account.Id);
        if (account.MasterRole is null)
        {
            throw new InvalidOperationException("Master role missing.");
        }

        var ownerKeyEntry = await _dbContext.Keys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.OwnerRoleId == account.MasterRoleId && x.KeyType == KeyType.RoleOwnerKey, ct);
        if (ownerKeyEntry is null)
        {
            throw new InvalidOperationException("Role owner key missing.");
        }

        byte[] roleOwnerKey;
        try
        {
            roleOwnerKey = _encryptionService.Decrypt(masterKey, ownerKeyEntry.EncryptedKeyBlob, account.MasterRoleId.ToByteArray());
        }
        catch (CryptographicException)
        {
            throw new InvalidOperationException("Role owner key invalid.");
        }

        _ = _encryptionService.Decrypt(roleOwnerKey, account.MasterRole.EncryptedRoleBlob);
        var signingContext = LedgerSigning.TryCreate(account.MasterRole, roleOwnerKey, _encryptionService);

        var sessionId = CreateSessionId();
        var session = new Session
        {
            Id = Guid.NewGuid(),
            UserId = account.Id,
            SessionId = sessionId,
            IsSecureMode = request.SecureMode,
            CreatedUtc = DateTimeOffset.UtcNow,
            LastActivityUtc = DateTimeOffset.UtcNow,
            DeviceInfo = request.DeviceInfo,
            IsRevoked = false
        };

        _dbContext.Sessions.Add(session);
        await _dbContext.SaveChangesAsync(ct);

        if (!request.SecureMode)
        {
            _sessionSecretCache.Set(sessionId, new SessionSecret(masterKey, null));
        }

        await _ledgerService.AppendAuthAsync("LoginSuccess", account.Id.ToString(), JsonSerializer.Serialize(new { sessionId }), ct, signingContext);

        return new LoginResponse(account.Id, sessionId, request.SecureMode);
    }

    public async Task ChangePasswordAsync(Guid userId, PasswordChangeRequest request, CancellationToken ct)
    {
        var account = await _dbContext.UserAccounts
            .Include(x => x.MasterRole)
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (account is null)
        {
            throw new InvalidOperationException("Account not found.");
        }

        var h3Old = Convert.FromBase64String(request.H3OldBase64);
        var h4Old = _hashingService.Hash(h3Old);
        if (!CryptographicOperations.FixedTimeEquals(h4Old, account.StoredH4))
        {
            await _ledgerService.AppendAuthAsync("PasswordChangeFailed", account.Id.ToString(), "{}", ct);
            throw new InvalidOperationException("Invalid credentials.");
        }

        var h3New = Convert.FromBase64String(request.H3NewBase64);
        var newStoredH4 = _hashingService.Hash(h3New);

        var masterKeyOld = _masterKeyService.DeriveMasterKey(h3Old, account.Id);
        if (account.MasterRole is null)
        {
            throw new InvalidOperationException("Master role missing.");
        }

        var masterKeyNew = _masterKeyService.DeriveMasterKey(h3New, account.Id);

        LedgerSigningContext? signingContext = null;
        var ownerKeyEntry = await _dbContext.Keys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.OwnerRoleId == account.MasterRoleId && x.KeyType == KeyType.RoleOwnerKey, ct);
        if (ownerKeyEntry is not null)
        {
            try
            {
                var roleOwnerKey = _encryptionService.Decrypt(masterKeyOld, ownerKeyEntry.EncryptedKeyBlob, account.MasterRoleId.ToByteArray());
                signingContext = LedgerSigning.TryCreate(account.MasterRole, roleOwnerKey, _encryptionService);
            }
            catch (CryptographicException)
            {
                signingContext = null;
            }
        }

        var roleKeyEntries = await _dbContext.Keys
            .Where(x => x.OwnerRoleId == account.MasterRoleId && (x.KeyType == KeyType.RoleReadKey || x.KeyType == KeyType.RoleWriteKey || x.KeyType == KeyType.RoleOwnerKey))
            .ToListAsync(ct);
        foreach (var entry in roleKeyEntries)
        {
            var plain = _encryptionService.Decrypt(masterKeyOld, entry.EncryptedKeyBlob, account.MasterRoleId.ToByteArray());
            entry.EncryptedKeyBlob = _encryptionService.Encrypt(masterKeyNew, plain, account.MasterRoleId.ToByteArray());
        }

        var memberships = await _dbContext.Memberships
            .Where(x => x.UserId == account.Id)
            .ToListAsync(ct);
        foreach (var membership in memberships)
        {
            if (membership.EncryptedReadKeyCopy.Length > 0)
            {
                var readKey = _encryptionService.Decrypt(masterKeyOld, membership.EncryptedReadKeyCopy, membership.RoleId.ToByteArray());
                membership.EncryptedReadKeyCopy = _encryptionService.Encrypt(masterKeyNew, readKey, membership.RoleId.ToByteArray());
            }
            if (membership.EncryptedWriteKeyCopy is { Length: > 0 })
            {
                var writeKey = _encryptionService.Decrypt(masterKeyOld, membership.EncryptedWriteKeyCopy, membership.RoleId.ToByteArray());
                membership.EncryptedWriteKeyCopy = _encryptionService.Encrypt(masterKeyNew, writeKey, membership.RoleId.ToByteArray());
            }
            if (membership.EncryptedOwnerKeyCopy is { Length: > 0 })
            {
                var ownerKey = _encryptionService.Decrypt(masterKeyOld, membership.EncryptedOwnerKeyCopy, membership.RoleId.ToByteArray());
                membership.EncryptedOwnerKeyCopy = _encryptionService.Encrypt(masterKeyNew, ownerKey, membership.RoleId.ToByteArray());
            }
        }

        account.StoredH4 = newStoredH4;
        account.UpdatedUtc = DateTimeOffset.UtcNow;

        var sessions = await _dbContext.Sessions.Where(x => x.UserId == account.Id && !x.IsRevoked).ToListAsync(ct);
        foreach (var session in sessions)
        {
            session.IsRevoked = true;
            _sessionSecretCache.Remove(session.SessionId);
        }

        await _dbContext.SaveChangesAsync(ct);
        await _ledgerService.AppendAuthAsync("PasswordChanged", account.Id.ToString(), "{}", ct, signingContext);
        await _ledgerService.AppendKeyAsync("RoleKeysReEncrypted", account.Id.ToString(), JsonSerializer.Serialize(new { RoleId = account.MasterRoleId }), ct, signingContext);
    }

    public async Task<SaltResponse> GetSaltAsync(string loginId, CancellationToken ct)
    {
        var normalized = loginId.Trim();
        if (!IsLoginIdValid(normalized))
        {
            throw new InvalidOperationException("LoginId is required.");
        }

        var salt = await _dbContext.UserAccounts
            .Where(x => x.LoginId == normalized)
            .Select(x => x.UserSalt)
            .FirstOrDefaultAsync(ct);

        if (salt is null || salt.Length == 0)
        {
            throw new InvalidOperationException("LoginId not found.");
        }

        return new SaltResponse(Convert.ToBase64String(salt));
    }

    public async Task<AvailabilityResponse> CheckAvailabilityAsync(string loginId, CancellationToken ct)
    {
        var normalized = loginId.Trim();
        if (!IsLoginIdValid(normalized))
        {
            return new AvailabilityResponse(false);
        }

        var exists = await _dbContext.UserAccounts.AsNoTracking()
            .AnyAsync(x => x.LoginId == normalized, ct);
        return new AvailabilityResponse(!exists);
    }

    private static bool IsLoginIdValid(string loginId)
    {
        return !string.IsNullOrWhiteSpace(loginId) && loginId.Length <= 256;
    }

    private static string CreateSessionId()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Base64UrlEncode(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
