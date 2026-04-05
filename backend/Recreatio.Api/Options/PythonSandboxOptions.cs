namespace Recreatio.Api.Options;

public sealed class PythonSandboxOptions
{
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public bool AllowPublicStoryboard { get; set; }
    public int DefaultCaseCount { get; set; } = 5;
    public int MaxCaseCount { get; set; } = 20;
    public int RequestTimeoutMs { get; set; } = 10000;
}
