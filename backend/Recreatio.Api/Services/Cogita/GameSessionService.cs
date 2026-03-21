using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Recreatio.Api.Contracts.Cogita;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cogita;

namespace Recreatio.Api.Services.Cogita;

public interface IGameSessionService
{
    Task<CogitaGameEventLog> AppendEventAsync(
        Guid sessionId,
        string eventType,
        object payload,
        Guid? actorParticipantId,
        Guid correlationId,
        Guid? causationId,
        CancellationToken ct);

    Task<CogitaGameSessionStateResponse> BuildStateAsync(
        CogitaGameSession session,
        long? sinceSeq,
        string? hostRealtimeToken,
        string? participantRealtimeToken,
        CancellationToken ct);

    Task RecomputeScoreboardAsync(Guid sessionId, CancellationToken ct);

    string ComputeStateHash(CogitaGameSessionStateResponse state);

    Task<int> CleanupLocationRetentionAsync(CancellationToken ct);
}

public sealed class GameSessionService : IGameSessionService
{
    private readonly RecreatioDbContext dbContext;

    public GameSessionService(RecreatioDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<CogitaGameEventLog> AppendEventAsync(
        Guid sessionId,
        string eventType,
        object payload,
        Guid? actorParticipantId,
        Guid correlationId,
        Guid? causationId,
        CancellationToken ct)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var now = DateTimeOffset.UtcNow;
            var lastSeq = await dbContext.CogitaGameEventLogs.AsNoTracking()
                .Where(x => x.SessionId == sessionId)
                .MaxAsync(x => (long?)x.SeqNo, ct) ?? 0;

            var entity = new CogitaGameEventLog
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                SeqNo = lastSeq + 1,
                EventType = eventType,
                CorrelationId = correlationId == Guid.Empty ? Guid.NewGuid() : correlationId,
                CausationId = causationId,
                ActorParticipantId = actorParticipantId,
                PayloadJson = JsonSerializer.Serialize(payload),
                CreatedUtc = now
            };

            dbContext.CogitaGameEventLogs.Add(entity);

            var session = await dbContext.CogitaGameSessions.FirstOrDefaultAsync(x => x.Id == sessionId, ct);
            if (session is not null)
            {
                session.UpdatedUtc = now;
                session.Version += 1;
            }

            try
            {
                await dbContext.SaveChangesAsync(ct);
                return entity;
            }
            catch (DbUpdateException ex) when (IsUniqueSeqConflict(ex) && attempt < 4)
            {
                dbContext.Entry(entity).State = EntityState.Detached;
                if (session is not null)
                {
                    dbContext.Entry(session).State = EntityState.Unchanged;
                }
            }
        }

        throw new InvalidOperationException("Unable to append game event due to repeated sequence conflicts.");
    }

    public async Task<CogitaGameSessionStateResponse> BuildStateAsync(
        CogitaGameSession session,
        long? sinceSeq,
        string? hostRealtimeToken,
        string? participantRealtimeToken,
        CancellationToken ct)
    {
        var groups = await dbContext.CogitaGameSessionGroups.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .OrderBy(x => x.DisplayName)
            .Select(x => new CogitaGameSessionGroupResponse(x.Id, x.GroupKey, x.DisplayName, x.Capacity, x.IsActive))
            .ToListAsync(ct);

        var zonesRaw = await dbContext.CogitaGameZones.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .OrderBy(x => x.ZoneKey)
            .ToListAsync(ct);
        var zones = new List<CogitaGameZoneResponse>(zonesRaw.Count);
        foreach (var zone in zonesRaw)
        {
            JsonElement geometry;
            try
            {
                using var document = JsonDocument.Parse(zone.GeometryJson);
                geometry = document.RootElement.Clone();
            }
            catch
            {
                using var fallback = JsonDocument.Parse("{}");
                geometry = fallback.RootElement.Clone();
            }

            zones.Add(new CogitaGameZoneResponse(
                zone.Id,
                zone.ZoneKey,
                zone.TriggerRadiusM,
                geometry,
                zone.IsEnabled,
                zone.ActiveFromUtc,
                zone.ActiveToUtc));
        }

        var participants = await dbContext.CogitaGameParticipants.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .OrderBy(x => x.DisplayName)
            .Select(x => new CogitaGameSessionParticipantResponse(
                x.Id,
                x.GroupId,
                x.RoleType,
                x.DisplayName,
                x.IsConnected,
                x.SpoofRiskScore,
                x.LastSeenUtc))
            .ToListAsync(ct);

        var scoreRows = await dbContext.CogitaGameScoreboards.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .OrderBy(x => x.Rank)
            .ThenByDescending(x => x.Score)
            .Select(x => new CogitaGameScoreRowResponse(x.GroupId, x.ParticipantId, x.Score, x.Rank))
            .ToListAsync(ct);

        var eventQuery = dbContext.CogitaGameEventLogs.AsNoTracking().Where(x => x.SessionId == session.Id);
        if (sinceSeq.HasValue && sinceSeq.Value > 0)
        {
            eventQuery = eventQuery.Where(x => x.SeqNo > sinceSeq.Value);
        }

        var events = await eventQuery
            .OrderBy(x => x.SeqNo)
            .Take(500)
            .ToListAsync(ct);

        var eventResponses = new List<CogitaGameEventResponse>(events.Count);
        foreach (var item in events)
        {
            JsonElement payload;
            try
            {
                using var document = JsonDocument.Parse(item.PayloadJson);
                payload = document.RootElement.Clone();
            }
            catch
            {
                using var fallback = JsonDocument.Parse("{}");
                payload = fallback.RootElement.Clone();
            }

            eventResponses.Add(new CogitaGameEventResponse(
                item.Id,
                item.SeqNo,
                item.EventType,
                item.CorrelationId,
                item.ActorParticipantId,
                payload,
                item.CreatedUtc));
        }

        var lastSeqNo = await dbContext.CogitaGameEventLogs.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .MaxAsync(x => (long?)x.SeqNo, ct) ?? 0;

        return new CogitaGameSessionStateResponse(
            session.Id,
            session.LibraryId,
            session.GameId,
            session.Status,
            session.Phase,
            session.RoundIndex,
            session.Version,
            groups,
            zones,
            participants,
            scoreRows,
            eventResponses,
            hostRealtimeToken,
            participantRealtimeToken,
            lastSeqNo);
    }

    public async Task RecomputeScoreboardAsync(Guid sessionId, CancellationToken ct)
    {
        var participants = await dbContext.CogitaGameParticipants.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .Select(x => new { x.Id, x.GroupId })
            .ToListAsync(ct);

        var participantScores = await dbContext.CogitaGameValueLedger.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.ScopeType == "participant" && x.ScopeId != null)
            .GroupBy(x => x.ScopeId)
            .Select(g => new { ScopeId = g.Key, Score = g.Sum(x => x.Delta) })
            .ToListAsync(ct);

        var groupScoresDirect = await dbContext.CogitaGameValueLedger.AsNoTracking()
            .Where(x => x.SessionId == sessionId && x.ScopeType == "group" && x.ScopeId != null)
            .GroupBy(x => x.ScopeId)
            .Select(g => new { ScopeId = g.Key, Score = g.Sum(x => x.Delta) })
            .ToListAsync(ct);

        var groupScoreMap = new Dictionary<Guid, decimal>();
        foreach (var direct in groupScoresDirect)
        {
            if (!direct.ScopeId.HasValue) continue;
            groupScoreMap[direct.ScopeId.Value] = direct.Score;
        }

        foreach (var participant in participantScores)
        {
            if (!participant.ScopeId.HasValue) continue;
            var participantGroup = participants.FirstOrDefault(x => x.Id == participant.ScopeId.Value)?.GroupId;
            if (!participantGroup.HasValue) continue;
            groupScoreMap.TryGetValue(participantGroup.Value, out var current);
            groupScoreMap[participantGroup.Value] = current + participant.Score;
        }

        var rows = new List<CogitaGameScoreboard>();
        var now = DateTimeOffset.UtcNow;
        var version = (await dbContext.CogitaGameSessions.AsNoTracking()
            .Where(x => x.Id == sessionId)
            .Select(x => x.Version)
            .FirstOrDefaultAsync(ct)) + 1;

        rows.AddRange(participantScores
            .Where(x => x.ScopeId.HasValue)
            .Select(x => new CogitaGameScoreboard
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                GroupId = null,
                ParticipantId = x.ScopeId,
                Score = x.Score,
                Version = version,
                UpdatedUtc = now
            }));

        rows.AddRange(groupScoreMap.Select(x => new CogitaGameScoreboard
        {
            Id = Guid.NewGuid(),
            SessionId = sessionId,
            GroupId = x.Key,
            ParticipantId = null,
            Score = x.Value,
            Version = version,
            UpdatedUtc = now
        }));

        var ranked = rows.OrderByDescending(x => x.Score).ThenBy(x => x.ParticipantId).ThenBy(x => x.GroupId).ToList();
        for (var i = 0; i < ranked.Count; i++)
        {
            ranked[i].Rank = i + 1;
        }

        var existing = await dbContext.CogitaGameScoreboards.Where(x => x.SessionId == sessionId).ToListAsync(ct);
        if (existing.Count > 0)
        {
            dbContext.CogitaGameScoreboards.RemoveRange(existing);
        }

        if (ranked.Count > 0)
        {
            dbContext.CogitaGameScoreboards.AddRange(ranked);
        }

        var session = await dbContext.CogitaGameSessions.FirstOrDefaultAsync(x => x.Id == sessionId, ct);
        if (session is not null)
        {
            session.Version = version;
            session.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public string ComputeStateHash(CogitaGameSessionStateResponse state)
    {
        var fingerprint = string.Join("|",
            state.SessionId.ToString("D"),
            state.Version.ToString(CultureInfo.InvariantCulture),
            state.Phase,
            state.RoundIndex.ToString(CultureInfo.InvariantCulture),
            state.Status,
            state.Groups.Count.ToString(CultureInfo.InvariantCulture),
            state.Zones.Count.ToString(CultureInfo.InvariantCulture),
            state.Participants.Count.ToString(CultureInfo.InvariantCulture),
            state.Scoreboard.Count.ToString(CultureInfo.InvariantCulture),
            state.LastSeqNo.ToString(CultureInfo.InvariantCulture));

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(fingerprint)));
    }

    public async Task<int> CleanupLocationRetentionAsync(CancellationToken ct)
    {
        var preciseCutoff = DateTimeOffset.UtcNow.AddHours(-24);
        var coarseCutoff = DateTimeOffset.UtcNow.AddDays(-30);

        var oldPresence = await dbContext.CogitaGamePresenceStates
            .Where(x => x.LastPingUtc < preciseCutoff)
            .ToListAsync(ct);

        var oldAudit = await dbContext.CogitaGameLocationAudits
            .Where(x => x.CreatedUtc < coarseCutoff)
            .ToListAsync(ct);

        var removed = oldPresence.Count + oldAudit.Count;
        if (oldPresence.Count > 0)
        {
            dbContext.CogitaGamePresenceStates.RemoveRange(oldPresence);
        }

        if (oldAudit.Count > 0)
        {
            dbContext.CogitaGameLocationAudits.RemoveRange(oldAudit);
        }

        if (removed > 0)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        return removed;
    }

    private static bool IsUniqueSeqConflict(DbUpdateException exception)
    {
        if (exception.InnerException is not SqlException sqlException)
        {
            return false;
        }

        return sqlException.Number is 2601 or 2627;
    }
}
