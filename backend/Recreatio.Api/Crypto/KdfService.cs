using System.Security.Cryptography;

namespace Recreatio.Api.Crypto;

public interface IKdfService
{
    byte[] DeriveKey(byte[] input, byte[] salt, int iterations, int lengthBytes);
}

public sealed class KdfService : IKdfService
{
    public byte[] DeriveKey(byte[] input, byte[] salt, int iterations, int lengthBytes)
    {
        using var deriveBytes = new Rfc2898DeriveBytes(input, salt, iterations, HashAlgorithmName.SHA256);
        return deriveBytes.GetBytes(lengthBytes);
    }
}
