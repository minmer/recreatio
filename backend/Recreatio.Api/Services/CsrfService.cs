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
        AppendPartitionedAttribute(context);
        return token;
    }

    private static void AppendPartitionedAttribute(HttpContext context)
    {
        if (!context.Response.Headers.TryGetValue("Set-Cookie", out var values))
        {
            return;
        }

        var updated = new List<string>(values.Count);
        var changed = false;

        foreach (var header in values)
        {
            if (IsTargetCookie(header) && !header.Contains("Partitioned", StringComparison.OrdinalIgnoreCase))
            {
                updated.Add($"{header}; Partitioned");
                changed = true;
                continue;
            }

            updated.Add(header);
        }

        if (changed)
        {
            context.Response.Headers["Set-Cookie"] = updated.ToArray();
        }
    }

    private static bool IsTargetCookie(string header)
    {
        var trimmed = header.AsSpan().TrimStart();
        return trimmed.StartsWith(CookieName.AsSpan(), StringComparison.OrdinalIgnoreCase)
            && trimmed.Length > CookieName.Length
            && trimmed[CookieName.Length] == '=';
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
