using System.Security.Cryptography;
using System.Text;

namespace Recreatio.Api.Services;

public static class LedgerHashing
{
    public static byte[] ComputeHash(
        byte[] previousHash,
        DateTimeOffset timestamp,
        string eventType,
        string actor,
        string payloadJson,
        Guid? signerRoleId,
        string? signatureAlg)
    {
        var signer = signerRoleId?.ToString("D") ?? string.Empty;
        var alg = signatureAlg ?? string.Empty;
        var payloadBytes = Encoding.UTF8.GetBytes($"{timestamp.ToUnixTimeMilliseconds()}|{eventType}|{actor}|{payloadJson}|{signer}|{alg}");
        var combined = new byte[previousHash.Length + payloadBytes.Length];
        Buffer.BlockCopy(previousHash, 0, combined, 0, previousHash.Length);
        Buffer.BlockCopy(payloadBytes, 0, combined, previousHash.Length, payloadBytes.Length);
        return SHA256.HashData(combined);
    }
}
