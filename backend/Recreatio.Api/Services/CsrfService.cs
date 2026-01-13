using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Recreatio.Api.Options;

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
    private readonly CsrfOptions _options;

    public CsrfService(IOptions<CsrfOptions> options)
    {
        _options = options.Value;
    }

    public string IssueToken(HttpContext context)
    {
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes);
        context.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Domain = string.IsNullOrWhiteSpace(_options.CookieDomain) ? null : _options.CookieDomain
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
