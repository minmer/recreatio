using Microsoft.AspNetCore.Authentication.Cookies;

namespace Recreatio.Api.Security;

public sealed class PartitionedCookieManager : ICookieManager
{
    private readonly ICookieManager _inner;

    public PartitionedCookieManager()
        : this(new ChunkingCookieManager())
    {
    }

    public PartitionedCookieManager(ICookieManager inner)
    {
        _inner = inner;
    }

    public string? GetRequestCookie(HttpContext context, string key)
    {
        return _inner.GetRequestCookie(context, key);
    }

    public void AppendResponseCookie(HttpContext context, string key, string value, CookieOptions options)
    {
        _inner.AppendResponseCookie(context, key, value, options);
        AppendPartitionedAttribute(context, key);
    }

    public void DeleteCookie(HttpContext context, string key, CookieOptions options)
    {
        _inner.DeleteCookie(context, key, options);
        AppendPartitionedAttribute(context, key);
    }

    private static void AppendPartitionedAttribute(HttpContext context, string key)
    {
        if (!context.Response.Headers.TryGetValue("Set-Cookie", out var values))
        {
            return;
        }

        var updated = new List<string>(values.Count);
        var changed = false;

        foreach (var header in values)
        {
            if (IsTargetCookie(header, key) && !header.Contains("Partitioned", StringComparison.OrdinalIgnoreCase))
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

    private static bool IsTargetCookie(string header, string key)
    {
        var trimmed = header.AsSpan().TrimStart();
        return trimmed.StartsWith(key.AsSpan(), StringComparison.OrdinalIgnoreCase)
            && trimmed.Length > key.Length
            && trimmed[key.Length] == '=';
    }
}
