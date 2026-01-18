using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Security;

namespace Recreatio.Api.Services;

public interface IRoleCryptoService
{
    RoleCryptoMaterial? TryReadRoleCryptoMaterial(Role role, byte[] writeKey);
    Task<LedgerSigningContext?> TryGetSigningContextAsync(Guid roleId, byte[] writeKey, CancellationToken ct);
}

public sealed class RoleCryptoService : IRoleCryptoService
{
    private readonly RecreatioDbContext _dbContext;
    private readonly IEncryptionService _encryptionService;

    public RoleCryptoService(RecreatioDbContext dbContext, IEncryptionService encryptionService)
    {
        _dbContext = dbContext;
        _encryptionService = encryptionService;
    }

    public RoleCryptoMaterial? TryReadRoleCryptoMaterial(Role role, byte[] writeKey)
    {
        if (role.EncryptedRoleBlob.Length == 0)
        {
            return null;
        }

        try
        {
            var json = _encryptionService.Decrypt(writeKey, role.EncryptedRoleBlob);
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

    public async Task<LedgerSigningContext?> TryGetSigningContextAsync(Guid roleId, byte[] writeKey, CancellationToken ct)
    {
        var role = await _dbContext.Roles.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == roleId, ct);
        if (role is null)
        {
            return null;
        }

        return LedgerSigning.TryCreate(role, writeKey, _encryptionService);
    }
}
