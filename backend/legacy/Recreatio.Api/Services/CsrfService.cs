using System.Security.Cryptography;
using Microsoft.Extensions.Hosting;
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
    private readonly bool _isDevelopment;

    public CsrfService(IOptions<CsrfOptions> options, IHostEnvironment environment)
    {
        _options = options.Value;
        _isDevelopment = environment.IsDevelopment();
    }

    public string IssueToken(HttpContext context)
    {
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes);
        var sameSite = ParseSameSite(_options.CookieSameSite, _isDevelopment ? SameSiteMode.None : SameSiteMode.Lax);
        var secure = ResolveSecurePolicy(context, _options.CookieSecurePolicy, _isDevelopment ? CookieSecurePolicy.None : CookieSecurePolicy.Always);
        context.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = sameSite,
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

    private static SameSiteMode ParseSameSite(string? value, SameSiteMode fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }

        return Enum.TryParse<SameSiteMode>(value, true, out var parsed) ? parsed : fallback;
    }

    private static bool ResolveSecurePolicy(HttpContext context, string? value, CookieSecurePolicy fallback)
    {
        var policy = fallback;
        if (!string.IsNullOrWhiteSpace(value) &&
            Enum.TryParse<CookieSecurePolicy>(value, true, out var parsed))
        {
            policy = parsed;
        }

        return policy switch
        {
            CookieSecurePolicy.Always => true,
            CookieSecurePolicy.None => false,
            _ => context.Request.IsHttps
        };
    }
}
