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
    private readonly IGameRuleEngineService ruleEngine;
    private readonly IGameRealtimeService realtimeService;

    public CogitaGameHub(
        IGameTokenService tokenService,
        RecreatioDbContext dbContext,
        IGameSessionService gameSessionService,
        IGameRuleEngineService ruleEngine,
        IGameRealtimeService realtimeService)
    {
        this.tokenService = tokenService;
        this.dbContext = dbContext;
        this.gameSessionService = gameSessionService;
        this.ruleEngine = ruleEngine;
        this.realtimeService = realtimeService;
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

    public async Task HeartbeatSession(Guid sessionId, string realtimeToken, long? sinceSeq)
    {
        if (!tokenService.TryValidateRealtimeToken(realtimeToken, out var claims) || claims is null)
        {
            throw new HubException("Invalid realtime token.");
        }

        if (claims.SessionId != sessionId)
        {
            throw new HubException("Realtime token does not match session.");
        }

        var session = await dbContext.CogitaGameSessions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sessionId, Context.ConnectionAborted);
        if (session is null)
        {
            throw new HubException("Session not found.");
        }

        var baselineSeqNo = await dbContext.CogitaGameEventLogs.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .MaxAsync(x => (long?)x.SeqNo, Context.ConnectionAborted) ?? 0;

        var scheduledRuns = await ruleEngine.EvaluateScheduledTriggersAsync(session, Context.ConnectionAborted);
        if (scheduledRuns > 0)
        {
            var deltaEvents = await dbContext.CogitaGameEventLogs.AsNoTracking()
                .Where(x => x.SessionId == session.Id && x.SeqNo > baselineSeqNo)
                .OrderBy(x => x.SeqNo)
                .ToListAsync(Context.ConnectionAborted);

            foreach (var item in deltaEvents.Where(x => !string.Equals(x.EventType, "LocationPing", StringComparison.Ordinal)))
            {
                await realtimeService.PublishEventAsync(
                    session.Id,
                    new Contracts.Cogita.CogitaGameEventResponse(
                        item.Id,
                        item.SeqNo,
                        item.EventType,
                        item.CorrelationId,
                        item.ActorParticipantId,
                        ParsePayload(item.PayloadJson),
                        item.CreatedUtc),
                    Context.ConnectionAborted);
            }

            var refreshedSession = await dbContext.CogitaGameSessions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == session.Id, Context.ConnectionAborted) ?? session;
            var snapshot = await gameSessionService.BuildStateAsync(
                refreshedSession,
                sinceSeq,
                hostRealtimeToken: null,
                participantRealtimeToken: null,
                Context.ConnectionAborted);

            await realtimeService.PublishScoreboardAsync(refreshedSession.Id, snapshot.Scoreboard, snapshot.Version, Context.ConnectionAborted);
            await realtimeService.PublishSnapshotAsync(refreshedSession.Id, snapshot, Context.ConnectionAborted);
            await Clients.Caller.SendAsync("Ack", new
            {
                heartbeat = true,
                sessionId,
                scheduledRuns,
                lastSeqNo = snapshot.LastSeqNo,
                serverUtc = DateTimeOffset.UtcNow
            }, Context.ConnectionAborted);
            return;
        }

        await Clients.Caller.SendAsync("Ack", new
        {
            heartbeat = true,
            sessionId,
            scheduledRuns = 0,
            serverUtc = DateTimeOffset.UtcNow
        }, Context.ConnectionAborted);
    }

    private static System.Text.Json.JsonElement ParsePayload(string payloadJson)
    {
        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(payloadJson);
            return document.RootElement.Clone();
        }
        catch
        {
            using var fallback = System.Text.Json.JsonDocument.Parse("{}");
            return fallback.RootElement.Clone();
        }
    }
}
