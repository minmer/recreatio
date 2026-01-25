using Recreatio.Api.Endpoints;
using Recreatio.Api.Endpoints.Cogita;

namespace Recreatio.Api.Hosting;

public static class ApplicationBuilderExtensions
{
    public static WebApplication UseRecreatioPipeline(this WebApplication app)
    {
        app.UseSwagger();
        app.UseSwaggerUI();

        app.UseHttpsRedirection();
        app.UseCors("RecreatioWeb");
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        app.UseMiddleware<RequestLoggingMiddleware>();

        app.MapHealthEndpoints();
        app.MapAuthEndpoints();
        app.MapAccountEndpoints();
        app.MapRoleEndpoints();
        app.MapCogitaEndpoints();

        return app;
    }
}
