namespace Api;

/// <summary>Handle endpoint failures inside CORS so browsers can read the error response.</summary>
public sealed class ApiErrorMiddleware(RequestDelegate next, ILogger<ApiErrorMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            // Log the route template, never a seat token, query string, or request body.
            var route = (context.GetEndpoint() as Microsoft.AspNetCore.Routing.RouteEndpoint)?.RoutePattern.RawText;
            logger.LogError(exception, "API request failed. TraceId: {TraceId}; endpoint: {Endpoint}",
                context.TraceIdentifier, route ?? "unknown");

            // Do not Clear(): that would also remove CORS headers and callbacks.
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentLength = null;
            context.Response.Headers.CacheControl = "no-store";
            await context.Response.WriteAsJsonAsync(new
            {
                error = $"Błąd usługi. Spróbuj ponownie. Kod zgłoszenia: {context.TraceIdentifier}",
                traceId = context.TraceIdentifier
            }, context.RequestAborted);
        }
    }
}
