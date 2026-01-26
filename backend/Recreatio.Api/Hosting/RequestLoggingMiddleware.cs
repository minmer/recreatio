using System.Text;

namespace Recreatio.Api.Hosting;

public sealed class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        var captureBody = path.StartsWith("/account", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/roles", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/auth", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/cogita", StringComparison.OrdinalIgnoreCase);

        string? requestBody = null;
        if (captureBody && (HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPut(context.Request.Method) || HttpMethods.IsPatch(context.Request.Method) || HttpMethods.IsDelete(context.Request.Method)))
        {
            context.Request.EnableBuffering();
            using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true))
            {
                requestBody = await reader.ReadToEndAsync();
                if (requestBody.Length > 2000)
                {
                    requestBody = requestBody[..2000];
                }
                context.Request.Body.Position = 0;
            }
        }

        if (!captureBody)
        {
            await _next(context);
            LogStatus(context, null);
            return;
        }

        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        await _next(context);

        buffer.Position = 0;
        string? bodyText = null;
        if (context.Response.StatusCode is >= 400 and < 500)
        {
            using var reader = new StreamReader(buffer, Encoding.UTF8, leaveOpen: true);
            bodyText = await reader.ReadToEndAsync();
            if (bodyText.Length > 2000)
            {
                bodyText = bodyText[..2000];
            }
        }

        buffer.Position = 0;
        await buffer.CopyToAsync(originalBody);
        context.Response.Body = originalBody;

        LogStatus(context, bodyText, requestBody);
    }

    private void LogStatus(HttpContext context, string? bodyText, string? requestBody = null)
    {
        if (context.Response.StatusCode is < 400 or >= 500)
        {
            return;
        }

        if (!string.IsNullOrWhiteSpace(bodyText))
        {
            _logger.LogWarning(
                "HTTP {Method} {Path} -> {StatusCode}. Body: {Body}",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                bodyText);
            return;
        }

        if (!string.IsNullOrWhiteSpace(requestBody))
        {
            _logger.LogWarning(
                "HTTP {Method} {Path} -> {StatusCode}. RequestBody: {Body}",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                requestBody);
            return;
        }

        _logger.LogWarning(
            "HTTP {Method} {Path} -> {StatusCode}",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode);
    }
}
