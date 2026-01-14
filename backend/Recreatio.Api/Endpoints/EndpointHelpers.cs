using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Recreatio.Api.Security;

namespace Recreatio.Api.Endpoints;

public static class EndpointHelpers
{
    public static bool TryGetUserId(HttpContext context, out Guid userId) =>
        AuthClaims.TryGetUserId(context.User, out userId);

    public static bool TryGetSessionId(HttpContext context, out string sessionId) =>
        AuthClaims.TryGetSessionId(context.User, out sessionId);

    public static async Task SignInAsync(HttpContext context, Guid userId, string sessionId, bool secureMode, string h3Base64)
    {
        var claims = new[]
        {
            new Claim(AuthClaims.UserId, userId.ToString()),
            new Claim(AuthClaims.SessionId, sessionId),
            new Claim(AuthClaims.SecureMode, secureMode.ToString()),
            new Claim(AuthClaims.H3, h3Base64)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(60)
            });
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
}
