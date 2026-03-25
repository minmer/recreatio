using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using Recreatio.Api.Options;
using Recreatio.Api.Security;

namespace Recreatio.Api.Endpoints;

public static class EndpointHelpers
{
    public static bool TryGetUserId(HttpContext context, out Guid userId) =>
        AuthClaims.TryGetUserId(context.User, out userId);

    public static bool TryGetSessionId(HttpContext context, out string sessionId) =>
        AuthClaims.TryGetSessionId(context.User, out sessionId);

    public static async Task SignInAsync(HttpContext context, Guid userId, string sessionId, bool secureMode, bool rememberMe, string h3Base64)
    {
        var authOptions = context.RequestServices.GetRequiredService<IOptions<AuthOptions>>().Value;
        var now = DateTimeOffset.UtcNow;
        var expiresUtc = rememberMe
            ? now.AddDays(NormalizeRememberMeDays(authOptions.RememberMeDays))
            : now.AddMinutes(NormalizeSessionIdleMinutes(authOptions.SessionIdleMinutes));

        var claims = new[]
        {
            new Claim(AuthClaims.UserId, userId.ToString()),
            new Claim(AuthClaims.SessionId, sessionId),
            new Claim(AuthClaims.SecureMode, secureMode.ToString()),
            new Claim(AuthClaims.RememberMe, rememberMe.ToString()),
            new Claim(AuthClaims.H3, h3Base64)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = expiresUtc,
                AllowRefresh = true
            });
    }

    public static void InvalidateRoleKeyRing(ISessionSecretCache sessionSecretCache, string sessionId)
    {
        if (sessionSecretCache.TryGet(sessionId, out var secret))
        {
            sessionSecretCache.Set(sessionId, secret with { CachedRoleKeyRing = null });
        }
    }

    public static IResult MapAuthException(InvalidOperationException ex)
    {
        return ex.Message switch
        {
            "LoginId already exists." => Results.Conflict(new { error = ex.Message }),
            "Invalid credentials." => Results.Unauthorized(),
            "Account not active." => Results.StatusCode(StatusCodes.Status403Forbidden),
            "LoginId is required." => Results.BadRequest(new { error = ex.Message }),
            "Account not found." => Results.NotFound(),
            _ => Results.BadRequest(new { error = ex.Message })
        };
    }

    private static int NormalizeSessionIdleMinutes(int value) => Math.Clamp(value, 5, 24 * 60);

    private static int NormalizeRememberMeDays(int value) => Math.Clamp(value, 1, 365);
}
