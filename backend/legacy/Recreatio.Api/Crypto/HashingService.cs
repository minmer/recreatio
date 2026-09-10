using System.Security.Cryptography;

namespace Recreatio.Api.Crypto;

public interface IHashingService
{
    byte[] Hash(byte[] input);
}

public sealed class HashingService : IHashingService
{
    public byte[] Hash(byte[] input)
    {
        return SHA256.HashData(input);
    }
}
