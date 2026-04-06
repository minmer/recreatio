using System.Text;
using System.Text.Json;
using System.ComponentModel;
using System.Diagnostics;
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
    private const int MinTimeoutMs = 1000;
    private const int MaxTimeoutMs = 120000;

    private const string BuiltInRunnerScript = """
import copy
import json
import math
import sys


def _result(passed, status, cases_executed, failing_input_json=None, user_output_json=None, error_message=None):
    response = {
        "passed": bool(passed),
        "status": str(status),
        "casesExecuted": int(cases_executed),
        "failingInputJson": failing_input_json,
        "userOutputJson": user_output_json,
        "errorMessage": error_message,
    }
    sys.stdout.write(json.dumps(response, ensure_ascii=False))
    sys.stdout.flush()
    raise SystemExit(0)


def _safe_json(value):
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return json.dumps(repr(value), ensure_ascii=False)


def _truncate_utf8(text, max_bytes):
    if text is None:
        return None
    if not isinstance(text, str):
        text = str(text)
    if max_bytes is None or max_bytes <= 0:
        return text
    raw = text.encode("utf-8", errors="replace")
    if len(raw) <= max_bytes:
        return text
    clipped = raw[: max(0, max_bytes - 3)].decode("utf-8", errors="ignore")
    return clipped + "..."


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _deep_equal(left, right, tolerance):
    if _is_number(left) and _is_number(right):
        left_f = float(left)
        right_f = float(right)
        if math.isnan(left_f) and math.isnan(right_f):
            return True
        return abs(left_f - right_f) <= tolerance

    if isinstance(left, (list, tuple)) and isinstance(right, (list, tuple)):
        if len(left) != len(right):
            return False
        for l_item, r_item in zip(left, right):
            if not _deep_equal(l_item, r_item, tolerance):
                return False
        return True

    if isinstance(left, dict) and isinstance(right, dict):
        if set(left.keys()) != set(right.keys()):
            return False
        for key in left.keys():
            if not _deep_equal(left[key], right[key], tolerance):
                return False
        return True

    return left == right


def _format_error(ex):
    return f"{ex.__class__.__name__}: {ex}"


def _lookup_function(scope, name):
    fn = scope.get(name)
    return fn if callable(fn) else None


def main():
    payload_text = sys.stdin.read()
    payload = json.loads(payload_text or "{}")

    create_input_source = payload.get("createInputSource") or ""
    reference_source = payload.get("referenceSource") or ""
    submission_source = payload.get("submissionSource") or ""
    entrypoint = payload.get("entrypoint") or "transform"
    seeds = payload.get("seeds") or []
    tolerance = float(payload.get("numericTolerance") or 1e-9)
    output_limit = int(payload.get("outputLimitBytes") or 65536)

    scope = {}
    try:
        exec(create_input_source, scope, scope)
    except Exception as ex:
        _result(False, "sandbox_error", 0, None, None, _truncate_utf8("create_input source failed: " + _format_error(ex), output_limit))

    try:
        exec(reference_source, scope, scope)
    except Exception as ex:
        _result(False, "sandbox_error", 0, None, None, _truncate_utf8("reference source failed: " + _format_error(ex), output_limit))

    try:
        exec(submission_source, scope, scope)
    except SyntaxError as ex:
        _result(False, "invalid_submission", 0, None, None, _truncate_utf8(_format_error(ex), output_limit))
    except Exception as ex:
        _result(False, "invalid_submission", 0, None, None, _truncate_utf8(_format_error(ex), output_limit))

    create_input = _lookup_function(scope, "create_input")
    reference = _lookup_function(scope, "reference")
    transform = _lookup_function(scope, entrypoint)

    if create_input is None:
        _result(False, "sandbox_error", 0, None, None, "Function create_input(seed) is missing.")
    if reference is None:
        _result(False, "sandbox_error", 0, None, None, "Function reference(x) is missing.")
    if transform is None:
        _result(False, "invalid_submission", 0, None, None, f"Function {entrypoint}(x) is missing.")

    for index, seed in enumerate(seeds):
        cases_executed = index + 1
        try:
            case_input = create_input(seed)
        except Exception as ex:
            _result(False, "sandbox_error", index, None, None, _truncate_utf8("create_input failed: " + _format_error(ex), output_limit))

        failing_input_json = _truncate_utf8(_safe_json(case_input), output_limit)

        try:
            expected_output = reference(copy.deepcopy(case_input))
        except Exception as ex:
            _result(False, "sandbox_error", index, failing_input_json, None, _truncate_utf8("reference failed: " + _format_error(ex), output_limit))

        try:
            user_output = transform(copy.deepcopy(case_input))
        except Exception as ex:
            _result(False, "runtime_error", cases_executed, failing_input_json, None, _truncate_utf8(_format_error(ex), output_limit))

        user_output_json = _truncate_utf8(_safe_json(user_output), output_limit)
        if not _deep_equal(expected_output, user_output, tolerance):
            _result(False, "wrong_output", cases_executed, failing_input_json, user_output_json, None)

    _result(True, "passed", len(seeds), None, None, None)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as ex:
        _result(False, "sandbox_error", 0, None, None, _format_error(ex))
""";

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
        if (options.Enabled && !string.IsNullOrWhiteSpace(baseUrl))
        {
            return await EvaluateViaHttpAsync(request, baseUrl, ct);
        }

        if (options.BuiltInEnabled)
        {
            return await EvaluateBuiltInAsync(request, ct);
        }

        if (options.Enabled && string.IsNullOrWhiteSpace(baseUrl))
        {
            return new PythonSandboxExecutionResponse(false, "runner_unavailable", 0, null, null, "Sandbox base URL is not configured.");
        }

        return new PythonSandboxExecutionResponse(false, "runner_unavailable", 0, null, null, "Python sandbox runner is disabled.");
    }

    private async Task<PythonSandboxExecutionResponse> EvaluateViaHttpAsync(
        PythonSandboxExecutionRequest request,
        string baseUrl,
        CancellationToken ct)
    {
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

        var timeoutMs = Math.Clamp(options.RequestTimeoutMs, MinTimeoutMs, MaxTimeoutMs);
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

    private async Task<PythonSandboxExecutionResponse> EvaluateBuiltInAsync(PythonSandboxExecutionRequest request, CancellationToken ct)
    {
        var pythonCommand = ResolveBuiltInPythonCommand(options.BuiltInPythonCommand);
        var timeoutMs = ResolveBuiltInTimeoutMs(options.RequestTimeoutMs, request.WallTimeLimitMs);

        var tempDirectory = Path.Combine(Path.GetTempPath(), $"recreatio-python-runner-{Guid.NewGuid():N}");
        var scriptPath = Path.Combine(tempDirectory, "runner.py");
        try
        {
            Directory.CreateDirectory(tempDirectory);
            await File.WriteAllTextAsync(scriptPath, BuiltInRunnerScript, Encoding.UTF8, ct);
        }
        catch (Exception ex)
        {
            return new PythonSandboxExecutionResponse(false, "runner_unavailable", 0, null, null, $"Unable to prepare python runner: {ex.Message}");
        }

        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = pythonCommand,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            process.StartInfo.ArgumentList.Add(scriptPath);

            try
            {
                if (!process.Start())
                {
                    return new PythonSandboxExecutionResponse(false, "runner_unavailable", 0, null, null, $"Unable to start python process: {pythonCommand}");
                }
            }
            catch (Win32Exception ex)
            {
                return new PythonSandboxExecutionResponse(
                    false,
                    "runner_unavailable",
                    0,
                    null,
                    null,
                    $"Python interpreter '{pythonCommand}' is not available. Install Python 3 or set PythonSandbox:BuiltInPythonCommand. {ex.Message}");
            }
            catch (Exception ex)
            {
                return new PythonSandboxExecutionResponse(false, "runner_unavailable", 0, null, null, ex.Message);
            }

            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();

            try
            {
                var requestBody = JsonSerializer.Serialize(request, JsonOptions);
                await process.StandardInput.WriteAsync(requestBody.AsMemory(), ct);
                await process.StandardInput.FlushAsync();
                process.StandardInput.Close();
            }
            catch (Exception ex)
            {
                TryKillProcess(process);
                return new PythonSandboxExecutionResponse(false, "sandbox_error", 0, null, null, $"Failed to send request to python runner: {ex.Message}");
            }

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(timeoutMs);

            try
            {
                await process.WaitForExitAsync(timeoutCts.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                TryKillProcess(process);
                return new PythonSandboxExecutionResponse(false, "timeout", 0, null, null, "Built-in python runner timed out.");
            }

            var stdout = (await stdoutTask).Trim();
            var stderr = (await stderrTask).Trim();

            if (string.IsNullOrWhiteSpace(stdout))
            {
                var message = string.IsNullOrWhiteSpace(stderr)
                    ? "Built-in python runner returned empty output."
                    : TruncateMessage(stderr, request.OutputLimitBytes);
                return new PythonSandboxExecutionResponse(false, "sandbox_error", 0, null, null, message);
            }

            try
            {
                return ParseSandboxResponseBody(stdout);
            }
            catch (JsonException ex)
            {
                var details = string.IsNullOrWhiteSpace(stderr)
                    ? ex.Message
                    : $"{ex.Message} | stderr: {TruncateMessage(stderr, request.OutputLimitBytes)}";
                return new PythonSandboxExecutionResponse(false, "sandbox_error", 0, null, null, $"Invalid built-in python response JSON: {details}");
            }
        }
        finally
        {
            try
            {
                if (Directory.Exists(tempDirectory))
                {
                    Directory.Delete(tempDirectory, true);
                }
            }
            catch
            {
                // no-op; temp cleanup should never fail request handling
            }
        }
    }

    private static string ResolveBuiltInPythonCommand(string? configuredCommand)
    {
        var command = (configuredCommand ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(command) ? "python3" : command;
    }

    private static int ResolveBuiltInTimeoutMs(int configuredTimeoutMs, int requestWallLimitMs)
    {
        var configTimeout = Math.Clamp(configuredTimeoutMs, MinTimeoutMs, MaxTimeoutMs);
        if (requestWallLimitMs <= 0)
        {
            return configTimeout;
        }

        var wallTimeout = Math.Clamp(requestWallLimitMs + 1000, MinTimeoutMs, MaxTimeoutMs);
        return Math.Min(configTimeout, wallTimeout);
    }

    private static void TryKillProcess(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // ignore process kill failures
        }
    }

    private static string TruncateMessage(string value, int maxBytes)
    {
        var effectiveLimit = maxBytes > 0 ? Math.Min(maxBytes, 8192) : 8192;
        var raw = Encoding.UTF8.GetBytes(value);
        if (raw.Length <= effectiveLimit)
        {
            return value;
        }

        var clipped = Encoding.UTF8.GetString(raw, 0, Math.Max(0, effectiveLimit - 3));
        return $"{clipped}...";
    }

    private static PythonSandboxExecutionResponse ParseSandboxResponseBody(string body)
    {
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
