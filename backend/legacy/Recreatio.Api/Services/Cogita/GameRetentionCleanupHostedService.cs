using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Recreatio.Api.Services.Cogita;

public sealed class GameRetentionCleanupHostedService : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<GameRetentionCleanupHostedService> logger;

    public GameRetentionCleanupHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<GameRetentionCleanupHostedService> logger)
    {
        this.scopeFactory = scopeFactory;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var sessionService = scope.ServiceProvider.GetRequiredService<IGameSessionService>();
                var removed = await sessionService.CleanupLocationRetentionAsync(stoppingToken);
                if (removed > 0)
                {
                    logger.LogInformation("Cogita game retention cleanup removed {RemovedRows} rows.", removed);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Cogita game retention cleanup failed.");
            }

            try
            {
                await Task.Delay(CleanupInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
