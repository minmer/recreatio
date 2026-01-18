using System.Security.Cryptography;
using Recreatio.Api.Data;
using Recreatio.Api.Security;

namespace Recreatio.Api.Services;

public interface IRoleFieldValueService
{
    string? TryGetPlainValue(
        RoleField field,
        RoleKeyRing keyRing,
        IReadOnlyDictionary<Guid, KeyEntry> keyEntryById);
}

public sealed class RoleFieldValueService : IRoleFieldValueService
{
    private readonly IKeyRingService _keyRingService;

    public RoleFieldValueService(IKeyRingService keyRingService)
    {
        _keyRingService = keyRingService;
    }

    public string? TryGetPlainValue(
        RoleField field,
        RoleKeyRing keyRing,
        IReadOnlyDictionary<Guid, KeyEntry> keyEntryById)
    {
        if (!keyRing.TryGetReadKey(field.RoleId, out var readKey))
        {
            return null;
        }

        if (!keyEntryById.TryGetValue(field.DataKeyId, out var keyEntry) || keyEntry.KeyType != KeyType.DataKey)
        {
            return null;
        }

        byte[] dataKey;
        try
        {
            dataKey = _keyRingService.DecryptDataKey(keyEntry, readKey);
        }
        catch (CryptographicException)
        {
            return null;
        }

        return _keyRingService.TryDecryptFieldValue(dataKey, field.EncryptedValue, field.RoleId, field.FieldType);
    }
}
