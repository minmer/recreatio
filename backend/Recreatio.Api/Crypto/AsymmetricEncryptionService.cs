using System.Security.Cryptography;

namespace Recreatio.Api.Crypto;

public interface IAsymmetricEncryptionService
{
    byte[] EncryptWithPublicKey(byte[] publicKey, string alg, byte[] plaintext);
    byte[] DecryptWithPrivateKey(byte[] privateKey, string alg, byte[] ciphertext);
}

public sealed class AsymmetricEncryptionService : IAsymmetricEncryptionService
{
    public byte[] EncryptWithPublicKey(byte[] publicKey, string alg, byte[] plaintext)
    {
        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(publicKey, out _);
        return alg switch
        {
            "RSA-OAEP-SHA256" => rsa.Encrypt(plaintext, RSAEncryptionPadding.OaepSHA256),
            _ => throw new InvalidOperationException($"Unsupported encryption algorithm '{alg}'.")
        };
    }

    public byte[] DecryptWithPrivateKey(byte[] privateKey, string alg, byte[] ciphertext)
    {
        using var rsa = RSA.Create();
        rsa.ImportPkcs8PrivateKey(privateKey, out _);
        return alg switch
        {
            "RSA-OAEP-SHA256" => rsa.Decrypt(ciphertext, RSAEncryptionPadding.OaepSHA256),
            _ => throw new InvalidOperationException($"Unsupported encryption algorithm '{alg}'.")
        };
    }
}
