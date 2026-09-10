using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Recreatio.Api.Crypto;

namespace Recreatio.Api.Services.Chat;

public interface IChatCryptoService
{
    byte[] CreateConversationKey();
    byte[] ProtectConversationKey(byte[] key);
    byte[] UnprotectConversationKey(byte[] protectedKey);
    byte[] EncryptMessage(byte[] conversationKey, Guid conversationId, long sequence, int keyVersion, string text);
    string? TryDecryptMessage(byte[] conversationKey, Guid conversationId, long sequence, int keyVersion, byte[] ciphertext);
    byte[] HashPublicCode(string code);
    string CreatePublicCode();
}

public sealed class ChatCryptoService : IChatCryptoService
{
    private static readonly Encoding Utf8 = Encoding.UTF8;
    private readonly IEncryptionService _encryptionService;
    private readonly IDataProtector _protector;

    public ChatCryptoService(IEncryptionService encryptionService, IDataProtectionProvider dataProtectionProvider)
    {
        _encryptionService = encryptionService;
        _protector = dataProtectionProvider.CreateProtector("recreatio.chat.conversation-keys.v1");
    }

    public byte[] CreateConversationKey() => RandomNumberGenerator.GetBytes(32);

    public byte[] ProtectConversationKey(byte[] key) => _protector.Protect(key);

    public byte[] UnprotectConversationKey(byte[] protectedKey) => _protector.Unprotect(protectedKey);

    public byte[] EncryptMessage(byte[] conversationKey, Guid conversationId, long sequence, int keyVersion, string text)
    {
        var aad = Utf8.GetBytes($"{conversationId:D}:{sequence}:{keyVersion}");
        return _encryptionService.Encrypt(conversationKey, Utf8.GetBytes(text), aad);
    }

    public string? TryDecryptMessage(byte[] conversationKey, Guid conversationId, long sequence, int keyVersion, byte[] ciphertext)
    {
        var aad = Utf8.GetBytes($"{conversationId:D}:{sequence}:{keyVersion}");
        try
        {
            var plaintext = _encryptionService.Decrypt(conversationKey, ciphertext, aad);
            return Utf8.GetString(plaintext);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    public byte[] HashPublicCode(string code)
    {
        return SHA256.HashData(Utf8.GetBytes(code.Trim()));
    }

    public string CreatePublicCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(18);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
