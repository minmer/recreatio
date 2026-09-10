using System.Security.Cryptography;

namespace Recreatio.Api.Crypto;

public interface IEncryptionService
{
    byte[] Encrypt(byte[] key, byte[] plaintext, byte[]? aad = null);
    byte[] Decrypt(byte[] key, byte[] ciphertext, byte[]? aad = null);
}

public sealed class EncryptionService : IEncryptionService
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public byte[] Encrypt(byte[] key, byte[] plaintext, byte[]? aad = null)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plaintext, ciphertext, tag, aad);

        var combined = new byte[NonceSize + ciphertext.Length + TagSize];
        Buffer.BlockCopy(nonce, 0, combined, 0, NonceSize);
        Buffer.BlockCopy(ciphertext, 0, combined, NonceSize, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, combined, NonceSize + ciphertext.Length, TagSize);
        return combined;
    }

    public byte[] Decrypt(byte[] key, byte[] ciphertext, byte[]? aad = null)
    {
        if (ciphertext.Length < NonceSize + TagSize)
        {
            throw new CryptographicException("Ciphertext too short.");
        }

        var nonce = new byte[NonceSize];
        Buffer.BlockCopy(ciphertext, 0, nonce, 0, NonceSize);

        var cipherLen = ciphertext.Length - NonceSize - TagSize;
        var cipher = new byte[cipherLen];
        Buffer.BlockCopy(ciphertext, NonceSize, cipher, 0, cipherLen);

        var tag = new byte[TagSize];
        Buffer.BlockCopy(ciphertext, NonceSize + cipherLen, tag, 0, TagSize);

        var plaintext = new byte[cipherLen];
        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, cipher, tag, plaintext, aad);
        return plaintext;
    }
}
