using System.Text;
using Recreatio.Api.Crypto;
using Recreatio.Api.Options;
using Microsoft.Extensions.Options;

namespace Recreatio.Api.Security;

public interface IMasterKeyService
{
    byte[] DeriveMasterKey(byte[] h3, Guid userId);
    byte[] DeriveSharedViewKey(byte[] sharedViewSecret, Guid sharedViewId);
}

public sealed class MasterKeyService : IMasterKeyService
{
    private readonly IKdfService _kdfService;
    private readonly CryptoOptions _options;

    public MasterKeyService(IKdfService kdfService, IOptions<CryptoOptions> options)
    {
        _kdfService = kdfService;
        _options = options.Value;
    }

    public byte[] DeriveMasterKey(byte[] h3, Guid userId)
    {
        var serverSalt = Convert.FromBase64String(_options.ServerMasterSalt);
        var userBytes = userId.ToByteArray();
        var salt = new byte[serverSalt.Length + userBytes.Length];
        Buffer.BlockCopy(serverSalt, 0, salt, 0, serverSalt.Length);
        Buffer.BlockCopy(userBytes, 0, salt, serverSalt.Length, userBytes.Length);
        return _kdfService.DeriveKey(h3, salt, _options.MasterKeyIterations, _options.MasterKeyLengthBytes);
    }

    public byte[] DeriveSharedViewKey(byte[] sharedViewSecret, Guid sharedViewId)
    {
        var label = Encoding.UTF8.GetBytes("SharedView");
        var idBytes = sharedViewId.ToByteArray();
        var salt = new byte[label.Length + idBytes.Length];
        Buffer.BlockCopy(label, 0, salt, 0, label.Length);
        Buffer.BlockCopy(idBytes, 0, salt, label.Length, idBytes.Length);
        return _kdfService.DeriveKey(sharedViewSecret, salt, _options.SharedViewIterations, _options.SharedViewKeyLengthBytes);
    }
}
