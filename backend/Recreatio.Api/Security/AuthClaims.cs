using System.Security.Claims;

namespace Recreatio.Api.Security;

public static class AuthClaims
{
    public const string UserId = "sub";
    public const string SessionId = "sid";
    public const string SecureMode = "sm";
    public const string H3 = "h3";

    public static bool TryGetUserId(ClaimsPrincipal principal, out Guid userId)
    {
        var value = principal.FindFirst(UserId)?.Value
            ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(value, out userId);
    }

    public static bool TryGetSessionId(ClaimsPrincipal principal, out string sessionId)
    {
        sessionId = principal.FindFirst(SessionId)?.Value ?? string.Empty;
        return !string.IsNullOrWhiteSpace(sessionId);
    }

    public static bool TryGetH3(ClaimsPrincipal principal, out byte[] h3)
    {
        h3 = Array.Empty<byte>();
        var base64 = principal.FindFirst(H3)?.Value;
        if (string.IsNullOrWhiteSpace(base64))
        {
            return false;
        }

        try
        {
            h3 = Convert.FromBase64String(base64);
            return h3.Length > 0;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public static string? GetH3Base64(ClaimsPrincipal principal) => principal.FindFirst(H3)?.Value;

    public static bool IsSecureMode(ClaimsPrincipal principal)
    {
        var value = principal.FindFirst(SecureMode)?.Value;
        return bool.TryParse(value, out var secureMode) && secureMode;
    }
}
