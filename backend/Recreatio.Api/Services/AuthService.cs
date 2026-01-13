using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
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
    private readonly ISessionSecretCache _sessionSecretCache;
    private readonly ILedgerService _ledgerService;
    private readonly AuthOptions _authOptions;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        RecreatioDbContext dbContext,
        IHashingService hashingService,
        IMasterKeyService masterKeyService,
        IEncryptionService encryptionService,
        ISessionSecretCache sessionSecretCache,
        ILedgerService ledgerService,
        IOptions<AuthOptions> authOptions,
        ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _hashingService = hashingService;
        _masterKeyService = masterKeyService;
        _encryptionService = encryptionService;
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

        var masterRolePayload = new
        {
            DisplayName = request.DisplayName,
            CreatedUtc = DateTimeOffset.UtcNow
        };

        var encryptedRoleBlob = _encryptionService.Encrypt(masterKey, JsonSerializer.SerializeToUtf8Bytes(masterRolePayload));

        var now = DateTimeOffset.UtcNow;
        var masterRole = new Role
        {
            Id = masterRoleId,
            RoleType = "MasterRole",
            EncryptedRoleBlob = encryptedRoleBlob,
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

        await _dbContext.SaveChangesAsync(ct);
        await _ledgerService.AppendAuthAsync("RegistrationCreated", userId.ToString(), JsonSerializer.Serialize(new { LoginId = loginId }), ct);
        await _ledgerService.AppendKeyAsync("MasterRoleCreated", userId.ToString(), JsonSerializer.Serialize(new { RoleId = masterRoleId }), ct);

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

        _ = _encryptionService.Decrypt(masterKey, account.MasterRole.EncryptedRoleBlob);

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
            _sessionSecretCache.Set(sessionId, new SessionSecret(masterKey));
        }

        await _ledgerService.AppendAuthAsync("LoginSuccess", account.Id.ToString(), JsonSerializer.Serialize(new { sessionId }), ct);

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

        var masterRoleBlob = _encryptionService.Decrypt(masterKeyOld, account.MasterRole.EncryptedRoleBlob);

        var masterKeyNew = _masterKeyService.DeriveMasterKey(h3New, account.Id);
        var reEncrypted = _encryptionService.Encrypt(masterKeyNew, masterRoleBlob);

        if (account.MasterRole is not null)
        {
            account.MasterRole.EncryptedRoleBlob = reEncrypted;
            account.MasterRole.UpdatedUtc = DateTimeOffset.UtcNow;
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
        await _ledgerService.AppendAuthAsync("PasswordChanged", account.Id.ToString(), "{}", ct);
        await _ledgerService.AppendKeyAsync("MasterRoleReEncrypted", account.Id.ToString(), JsonSerializer.Serialize(new { RoleId = account.MasterRoleId }), ct);
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
