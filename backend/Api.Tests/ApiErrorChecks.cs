using System.Net;
using System.Text.Json;
using Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

internal static class ApiErrorChecks
{
    public static async Task RunAsync(Action<bool, string> check)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = [] });
        builder.Logging.ClearProviders();
        builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:0");
        builder.Services.AddCors(options => options.AddPolicy("browser", policy =>
            policy.WithOrigins("https://recreatio.pl").AllowCredentials().AllowAnyHeader().AllowAnyMethod()));
        await using var app = builder.Build();
        app.UseCors("browser");
        app.UseMiddleware<ApiErrorMiddleware>();
        app.MapGet("/failure", (Func<IResult>)(() => throw new InvalidOperationException("private database detail")));
        app.MapGet("/ok", () => Results.Ok(new { ok = true }));
        await app.StartAsync();
        try
        {
            using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
            using var request = new HttpRequestMessage(HttpMethod.Get, "/failure");
            request.Headers.Add("Origin", "https://recreatio.pl");
            using var response = await client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            check(response.StatusCode == HttpStatusCode.InternalServerError, "exception returns HTTP 500");
            check(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins)
                && origins.Single() == "https://recreatio.pl", "allowed origin can read error response");
            check(response.Headers.TryGetValues("Access-Control-Allow-Credentials", out var credentials)
                && credentials.Single() == "true", "credentialed CORS survives exception");
            using var json = JsonDocument.Parse(body);
            check(!string.IsNullOrEmpty(json.RootElement.GetProperty("traceId").GetString()), "error includes diagnostic trace identifier");
            check(json.RootElement.TryGetProperty("error", out _), "error uses the frontend error contract");
            check(!body.Contains("private database detail") && !body.Contains("InvalidOperationException"), "exception details remain server-side");
            using var foreign = new HttpRequestMessage(HttpMethod.Get, "/failure");
            foreign.Headers.Add("Origin", "https://untrusted.invalid");
            using var denied = await client.SendAsync(foreign);
            check(!denied.Headers.Contains("Access-Control-Allow-Origin"), "error handling does not widen origin permissions");
            using var ok = await client.GetAsync("/ok");
            check(ok.StatusCode == HttpStatusCode.OK, "successful endpoints remain unchanged");
        }
        finally { await app.StopAsync(); }

        using var cancel = new CancellationTokenSource();
        cancel.Cancel();
        var context = new DefaultHttpContext { RequestAborted = cancel.Token };
        var middleware = new ApiErrorMiddleware(_ => Task.FromCanceled(cancel.Token), NullLogger<ApiErrorMiddleware>.Instance);
        var cancelled = false;
        try { await middleware.InvokeAsync(context); }
        catch (OperationCanceledException) { cancelled = true; }
        check(cancelled && context.Response.StatusCode != 500, "client cancellation is not converted to a server failure");
    }
}
