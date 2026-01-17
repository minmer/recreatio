using System.Text.Json;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Services;

namespace Recreatio.Api.Security;

public static class LedgerSigning
{
    public static LedgerSigningContext? TryCreate(Role role, byte[] writeKey, IEncryptionService encryptionService)
    {
        if (role.EncryptedRoleBlob.Length == 0)
        {
            return null;
        }

        try
        {
            var json = encryptionService.Decrypt(writeKey, role.EncryptedRoleBlob);
            var crypto = JsonSerializer.Deserialize<RoleCryptoMaterial>(json);
            if (crypto is null || string.IsNullOrWhiteSpace(crypto.PrivateSigningKeyBase64))
            {
                return null;
            }

            return new LedgerSigningContext(
                role.Id,
                Convert.FromBase64String(crypto.PrivateSigningKeyBase64),
                crypto.PrivateSigningKeyAlg);
        }
        catch
        {
            return null;
        }
    }
}
