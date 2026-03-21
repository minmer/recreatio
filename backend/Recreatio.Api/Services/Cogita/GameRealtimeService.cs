using Microsoft.AspNetCore.SignalR;
using Recreatio.Api.Contracts.Cogita;
using Recreatio.Api.Endpoints.Cogita;

namespace Recreatio.Api.Services.Cogita;

public interface IGameRealtimeService
{
    Task PublishSnapshotAsync(Guid sessionId, CogitaGameSessionStateResponse snapshot, CancellationToken ct);
    Task PublishEventAsync(Guid sessionId, CogitaGameEventResponse gameEvent, CancellationToken ct);
    Task PublishScoreboardAsync(Guid sessionId, List<CogitaGameScoreRowResponse> rows, int version, CancellationToken ct);
    Task PublishPhaseChangedAsync(Guid sessionId, string phase, int roundIndex, string status, CancellationToken ct);
}

public sealed class GameRealtimeService : IGameRealtimeService
{
    private readonly IHubContext<CogitaGameHub> hubContext;

    public GameRealtimeService(IHubContext<CogitaGameHub> hubContext)
    {
        this.hubContext = hubContext;
    }

    public Task PublishSnapshotAsync(Guid sessionId, CogitaGameSessionStateResponse snapshot, CancellationToken ct)
    {
        return hubContext.Clients.Group(CogitaGameHub.SessionGroup(sessionId)).SendAsync("GameSnapshot", snapshot, ct);
    }

    public Task PublishEventAsync(Guid sessionId, CogitaGameEventResponse gameEvent, CancellationToken ct)
    {
        return hubContext.Clients.Group(CogitaGameHub.SessionGroup(sessionId)).SendAsync("GameEventDelta", gameEvent, ct);
    }

    public Task PublishScoreboardAsync(Guid sessionId, List<CogitaGameScoreRowResponse> rows, int version, CancellationToken ct)
    {
        return hubContext.Clients.Group(CogitaGameHub.SessionGroup(sessionId)).SendAsync("ScoreboardDelta", new { version, rows }, ct);
    }

    public Task PublishPhaseChangedAsync(Guid sessionId, string phase, int roundIndex, string status, CancellationToken ct)
    {
        return hubContext.Clients.Group(CogitaGameHub.SessionGroup(sessionId))
            .SendAsync("PhaseChanged", new
            {
                sessionId,
                phase,
                roundIndex,
                status,
                changedUtc = DateTimeOffset.UtcNow
            }, ct);
    }
}
