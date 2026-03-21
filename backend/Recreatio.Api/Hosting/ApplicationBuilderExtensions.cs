using Recreatio.Api.Endpoints;
using Recreatio.Api.Endpoints.Cogita;
using Recreatio.Api.Endpoints.Edk;
using Recreatio.Api.Endpoints.Limanowa;
using Recreatio.Api.Endpoints.Pilgrimage;

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
        app.MapChatEndpoints();
        app.MapCogitaEndpoints();
        app.MapCogitaGameEndpoints();
        app.MapCogitaCoreEndpoints();
        app.MapParishEndpoints();
        app.MapPilgrimageEndpoints();
        app.MapEdkEndpoints();
        app.MapLimanowaEndpoints();

        return app;
    }
}
