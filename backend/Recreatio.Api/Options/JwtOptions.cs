namespace Recreatio.Api.Options;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "Recreatio";
    public string Audience { get; set; } = "RecreatioClients";
    public string SigningKey { get; set; } = string.Empty;
    public int ExpiryMinutes { get; set; } = 60;
}
