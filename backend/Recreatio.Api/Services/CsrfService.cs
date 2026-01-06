using System.Security.Cryptography;

namespace Recreatio.Api.Services;

public interface ICsrfService
{
    string IssueToken(HttpContext context);
    bool Validate(HttpContext context);
}

public sealed class CsrfService : ICsrfService
{
    private const string CookieName = "XSRF-TOKEN";
    private const string HeaderName = "X-XSRF-TOKEN";

    public string IssueToken(HttpContext context)
    {
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes);
        context.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/"
        });
        return token;
    }

    public bool Validate(HttpContext context)
    {
        if (!context.Request.Cookies.TryGetValue(CookieName, out var cookieToken))
        {
            return false;
        }

        if (!context.Request.Headers.TryGetValue(HeaderName, out var headerToken))
        {
            return false;
        }

        return string.Equals(cookieToken, headerToken.ToString(), StringComparison.Ordinal);
    }
}
