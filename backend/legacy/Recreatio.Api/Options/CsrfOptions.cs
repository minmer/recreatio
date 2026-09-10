namespace Recreatio.Api.Options;

public sealed class CsrfOptions
{
    public string? CookieDomain { get; set; }
    public string? CookieSameSite { get; set; }
    public string? CookieSecurePolicy { get; set; }
}
