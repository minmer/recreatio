using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;
using Recreatio.Api.Services.Cogita;

namespace Recreatio.Api.Endpoints.Cogita;

public sealed class CogitaGameHub : Hub
{
    private readonly IGameTokenService tokenService;
    private readonly RecreatioDbContext dbContext;
    private readonly IGameSessionService gameSessionService;

    public CogitaGameHub(
        IGameTokenService tokenService,
        RecreatioDbContext dbContext,
        IGameSessionService gameSessionService)
    {
        this.tokenService = tokenService;
        this.dbContext = dbContext;
        this.gameSessionService = gameSessionService;
    }

    public static string SessionGroup(Guid sessionId) => $"session:{sessionId:D}";

    public async Task Subscribe(Guid sessionId, string realtimeToken, long? lastSeqNo)
    {
        if (!tokenService.TryValidateRealtimeToken(realtimeToken, out var claims) || claims is null)
        {
            throw new HubException("Invalid realtime token.");
        }

        if (claims.SessionId != sessionId)
        {
            throw new HubException("Realtime token does not match session.");
        }

        var session = await dbContext.CogitaGameSessions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == sessionId);
        if (session is null)
        {
            throw new HubException("Session not found.");
        }

        if (!claims.IsHost && claims.ParticipantId.HasValue)
        {
            var participantExists = await dbContext.CogitaGameParticipants.AsNoTracking()
                .AnyAsync(x => x.SessionId == sessionId && x.Id == claims.ParticipantId.Value);
            if (!participantExists)
            {
                throw new HubException("Participant not found.");
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, SessionGroup(sessionId));

        var replayState = await gameSessionService.BuildStateAsync(
            session,
            lastSeqNo,
            hostRealtimeToken: null,
            participantRealtimeToken: null,
            Context.ConnectionAborted);
        await Clients.Caller.SendAsync("GameSnapshot", replayState, Context.ConnectionAborted);

        await Clients.Caller.SendAsync("Ack", new
        {
            sessionId,
            lastSeqNo = replayState.LastSeqNo,
            replayed = replayState.Events.Count,
            subscribedUtc = DateTimeOffset.UtcNow
        });
    }

    public Task Ack(long seqNo)
    {
        return Clients.Caller.SendAsync("Ack", new { seqNo, serverUtc = DateTimeOffset.UtcNow });
    }

    public Task Heartbeat()
    {
        return Clients.Caller.SendAsync("Ack", new { heartbeat = true, serverUtc = DateTimeOffset.UtcNow });
    }
}
