using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Recreatio.Api.Contracts.Cogita;

namespace Recreatio.Api.Services.Cogita;

public interface IGameTokenService
{
    string GenerateCode(int length);
    byte[] HashToken(string? token);
    bool MatchesHash(string? token, byte[] hash);
    string IssueRealtimeToken(Guid sessionId, Guid? participantId, bool isHost, TimeSpan ttl);
    bool TryValidateRealtimeToken(string? token, out CogitaGameRealtimeTokenClaims? claims);
}

public sealed class GameTokenService : IGameTokenService
{
    private readonly byte[] signingKey;

    public GameTokenService(IConfiguration configuration)
    {
        var configured = configuration["GameRuntime:JwtSecret"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            signingKey = SHA256.HashData(Encoding.UTF8.GetBytes(configured.Trim()));
            return;
        }

        // Fallback for local/dev environments if secret is not configured.
        signingKey = RandomNumberGenerator.GetBytes(32);
    }

    public string GenerateCode(int length)
    {
        if (length <= 0)
        {
            return string.Empty;
        }

        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var chars = new char[length];
        var bytes = RandomNumberGenerator.GetBytes(length);
        for (var i = 0; i < length; i++)
        {
            chars[i] = alphabet[bytes[i] % alphabet.Length];
        }

        return new string(chars);
    }

    public byte[] HashToken(string? token)
    {
        var normalized = string.IsNullOrWhiteSpace(token) ? string.Empty : token.Trim();
        return SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
    }

    public bool MatchesHash(string? token, byte[] hash)
    {
        if (hash.Length == 0)
        {
            return false;
        }

        var actual = HashToken(token);
        return actual.Length == hash.Length && CryptographicOperations.FixedTimeEquals(actual, hash);
    }

    public string IssueRealtimeToken(Guid sessionId, Guid? participantId, bool isHost, TimeSpan ttl)
    {
        var now = DateTimeOffset.UtcNow;
        var exp = now.Add(ttl);

        var headerJson = JsonSerializer.Serialize(new { alg = "HS256", typ = "JWT" });
        var payloadJson = JsonSerializer.Serialize(new
        {
            sid = sessionId,
            pid = participantId,
            host = isHost,
            iat = now.ToUnixTimeSeconds(),
            exp = exp.ToUnixTimeSeconds()
        });

        var header = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));
        var payload = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));
        var unsigned = $"{header}.{payload}";
        var signature = ComputeHmac(unsigned);
        return $"{unsigned}.{signature}";
    }

    public bool TryValidateRealtimeToken(string? token, out CogitaGameRealtimeTokenClaims? claims)
    {
        claims = null;
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        var parts = token.Split('.', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3)
        {
            return false;
        }

        var unsigned = $"{parts[0]}.{parts[1]}";
        var expected = ComputeHmac(unsigned);
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(parts[2])))
        {
            return false;
        }

        try
        {
            var payloadBytes = Base64UrlDecode(parts[1]);
            using var document = JsonDocument.Parse(payloadBytes);
            var root = document.RootElement;

            if (!root.TryGetProperty("sid", out var sidNode) || !sidNode.TryGetGuid(out var sid))
            {
                return false;
            }

            Guid? pid = null;
            if (root.TryGetProperty("pid", out var pidNode) && pidNode.ValueKind == JsonValueKind.String && pidNode.TryGetGuid(out var parsedPid))
            {
                pid = parsedPid;
            }

            var isHost = root.TryGetProperty("host", out var hostNode) && hostNode.ValueKind == JsonValueKind.True;
            if (!root.TryGetProperty("exp", out var expNode) || expNode.ValueKind != JsonValueKind.Number)
            {
                return false;
            }

            var expUnix = expNode.GetInt64();
            var exp = DateTimeOffset.FromUnixTimeSeconds(expUnix);
            if (exp <= DateTimeOffset.UtcNow)
            {
                return false;
            }

            claims = new CogitaGameRealtimeTokenClaims(sid, pid, isHost, exp);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private string ComputeHmac(string value)
    {
        var bytes = HMACSHA256.HashData(signingKey, Encoding.UTF8.GetBytes(value));
        return Base64UrlEncode(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static byte[] Base64UrlDecode(string value)
    {
        var normalized = value.Replace('-', '+').Replace('_', '/');
        switch (normalized.Length % 4)
        {
            case 2:
                normalized += "==";
                break;
            case 3:
                normalized += "=";
                break;
        }
        return Convert.FromBase64String(normalized);
    }
}
