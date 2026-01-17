using System.Security.Cryptography;

namespace Recreatio.Api.Crypto;

public interface IAsymmetricSigningService
{
    byte[] Sign(byte[] privateKey, string alg, byte[] payload);
    bool Verify(byte[] publicKey, string alg, byte[] payload, byte[] signature);
}

public sealed class AsymmetricSigningService : IAsymmetricSigningService
{
    public byte[] Sign(byte[] privateKey, string alg, byte[] payload)
    {
        using var rsa = RSA.Create();
        rsa.ImportPkcs8PrivateKey(privateKey, out _);
        return alg switch
        {
            "RSA-SHA256" => rsa.SignData(payload, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1),
            _ => throw new InvalidOperationException($"Unsupported signature algorithm '{alg}'.")
        };
    }

    public bool Verify(byte[] publicKey, string alg, byte[] payload, byte[] signature)
    {
        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(publicKey, out _);
        return alg switch
        {
            "RSA-SHA256" => rsa.VerifyData(payload, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1),
            _ => throw new InvalidOperationException($"Unsupported signature algorithm '{alg}'.")
        };
    }
}
