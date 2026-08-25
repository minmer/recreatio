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
        return Rfc2898DeriveBytes.Pbkdf2(
            input,
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            lengthBytes);
    }
}
