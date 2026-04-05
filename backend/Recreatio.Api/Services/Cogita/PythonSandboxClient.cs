using System.Text;
using System.Text.Json;
using System.Globalization;
using Microsoft.Extensions.Options;
using Recreatio.Api.Options;

namespace Recreatio.Api.Services.Cogita;

public sealed record PythonSandboxExecutionRequest(
    string CreateInputSource,
    string ReferenceSource,
    string SubmissionSource,
    string Entrypoint,
    List<long> Seeds,
    double NumericTolerance,
    int CpuTimeLimitMs,
    int WallTimeLimitMs,
    int MemoryLimitMb,
    int OutputLimitBytes
);

public sealed record PythonSandboxExecutionResponse(
    bool Passed,
    string Status,
    int CasesExecuted,
    string? FailingInputJson,
    string? UserOutputJson,
    string? ErrorMessage
);

public interface IPythonSandboxClient
{
    Task<PythonSandboxExecutionResponse> EvaluateAsync(PythonSandboxExecutionRequest request, CancellationToken ct);
}

public sealed class PythonSandboxClient : IPythonSandboxClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient httpClient;
    private readonly PythonSandboxOptions options;

    public PythonSandboxClient(
        HttpClient httpClient,
        IOptions<PythonSandboxOptions> options)
    {
        this.httpClient = httpClient;
        this.options = options.Value;
    }

    public async Task<PythonSandboxExecutionResponse> EvaluateAsync(PythonSandboxExecutionRequest request, CancellationToken ct)
    {
        var baseUrl = (options.BaseUrl ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return new PythonSandboxExecutionResponse(false, "runner_unavailable", 0, null, null, "Sandbox base URL is not configured.");
        }

        var url = $"{baseUrl.TrimEnd('/')}/evaluate";
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(request, JsonOptions), Encoding.UTF8, "application/json")
        };

        var apiKey = (options.ApiKey ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            httpRequest.Headers.TryAddWithoutValidation("X-Api-Key", apiKey);
            httpRequest.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");
        }

        var timeoutMs = Math.Clamp(options.RequestTimeoutMs, 1000, 120000);
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(timeoutMs);

        try
        {
            using var response = await httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);
            var body = await response.Content.ReadAsStringAsync(timeoutCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                return new PythonSandboxExecutionResponse(
                    false,
                    "sandbox_error",
                    0,
                    null,
                    null,
                    string.IsNullOrWhiteSpace(body)
                        ? $"Sandbox HTTP {(int)response.StatusCode}."
                        : body);
            }

            if (string.IsNullOrWhiteSpace(body))
            {
                return new PythonSandboxExecutionResponse(false, "sandbox_error", 0, null, null, "Sandbox returned an empty response.");
            }

            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var status = TryReadString(root, "status")?.Trim().ToLowerInvariant();
            var passedFromStatus = string.Equals(status, "passed", StringComparison.OrdinalIgnoreCase);
            var passed = TryReadBool(root, "passed") ?? passedFromStatus;
            var casesExecuted = TryReadInt(root, "casesExecuted") ?? 0;
            var failingInputJson = TryReadString(root, "failingInputJson");
            var userOutputJson = TryReadString(root, "userOutputJson");
            var errorMessage = TryReadString(root, "errorMessage");

            return new PythonSandboxExecutionResponse(
                passed,
                string.IsNullOrWhiteSpace(status) ? (passed ? "passed" : "sandbox_error") : status!,
                Math.Max(0, casesExecuted),
                failingInputJson,
                userOutputJson,
                errorMessage);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return new PythonSandboxExecutionResponse(false, "timeout", 0, null, null, "Sandbox request timed out.");
        }
        catch (HttpRequestException ex)
        {
            return new PythonSandboxExecutionResponse(false, "runner_unavailable", 0, null, null, ex.Message);
        }
        catch (JsonException ex)
        {
            return new PythonSandboxExecutionResponse(false, "sandbox_error", 0, null, null, $"Invalid sandbox JSON response: {ex.Message}");
        }
    }

    private static string? TryReadString(JsonElement root, string key)
    {
        return root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static bool? TryReadBool(JsonElement root, string key)
    {
        if (!root.TryGetProperty(key, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsed) => parsed,
            _ => null
        };
    }

    private static int? TryReadInt(JsonElement root, string key)
    {
        if (!root.TryGetProperty(key, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var parsed))
        {
            return parsed;
        }

        if (value.ValueKind == JsonValueKind.String &&
            int.TryParse(value.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed))
        {
            return parsed;
        }

        return null;
    }
}
