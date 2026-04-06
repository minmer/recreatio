using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cogita;

namespace Recreatio.Api.Services.Cogita;

public interface IGameRuleEngineService
{
    Task EvaluateEventAsync(CogitaGameSession session, CogitaGameEventLog gameEvent, CancellationToken ct);
    Task<int> EvaluateScheduledTriggersAsync(CogitaGameSession session, CancellationToken ct);
}

public sealed class GameRuleEngineService : IGameRuleEngineService
{
    private readonly RecreatioDbContext dbContext;
    private readonly IGameSessionService gameSessionService;

    public GameRuleEngineService(
        RecreatioDbContext dbContext,
        IGameSessionService gameSessionService)
    {
        this.dbContext = dbContext;
        this.gameSessionService = gameSessionService;
    }

    public async Task EvaluateEventAsync(CogitaGameSession session, CogitaGameEventLog gameEvent, CancellationToken ct)
    {
        if (!string.Equals(gameEvent.EventType, "ZoneEnter", StringComparison.Ordinal) &&
            !string.Equals(gameEvent.EventType, "AnswerSubmitted", StringComparison.Ordinal) &&
            !string.Equals(gameEvent.EventType, "InteractionCompleted", StringComparison.Ordinal))
        {
            return;
        }

        using var payloadDoc = JsonDocument.Parse(gameEvent.PayloadJson);
        var payload = payloadDoc.RootElement;

        var publishedGraphId = await dbContext.CogitaGameActionGraphs.AsNoTracking()
            .Where(x => x.GameId == session.GameId && x.Status == "published")
            .OrderByDescending(x => x.Version)
            .Select(x => x.Id)
            .FirstOrDefaultAsync(ct);
        if (publishedGraphId == Guid.Empty)
        {
            return;
        }

        var nodes = await dbContext.CogitaGameActionNodes.AsNoTracking()
            .Where(x => x.GraphId == publishedGraphId)
            .ToListAsync(ct);

        foreach (var node in nodes)
        {
            if (string.Equals(node.NodeType, "trigger.onEnterZone", StringComparison.Ordinal))
            {
                await HandleOnEnterZoneAsync(session, node, payload, gameEvent, ct);
                continue;
            }

            if (string.Equals(node.NodeType, "trigger.onNGroupPresence", StringComparison.Ordinal))
            {
                await HandleOnNGroupPresenceAsync(session, node, payload, gameEvent, ct);
            }
        }
    }

    public async Task<int> EvaluateScheduledTriggersAsync(CogitaGameSession session, CancellationToken ct)
    {
        if (!ShouldRunScheduledTriggers(session))
        {
            return 0;
        }

        var publishedGraphId = await dbContext.CogitaGameActionGraphs.AsNoTracking()
            .Where(x => x.GameId == session.GameId && x.Status == "published")
            .OrderByDescending(x => x.Version)
            .Select(x => x.Id)
            .FirstOrDefaultAsync(ct);
        if (publishedGraphId == Guid.Empty)
        {
            return 0;
        }

        var timerNodes = await dbContext.CogitaGameActionNodes.AsNoTracking()
            .Where(x => x.GraphId == publishedGraphId && x.NodeType == "trigger.everySec")
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        if (timerNodes.Count == 0)
        {
            return 0;
        }

        var now = DateTimeOffset.UtcNow;
        var createdRuns = 0;

        foreach (var node in timerNodes)
        {
            using var configDoc = JsonDocument.Parse(node.ConfigJson);
            var config = configDoc.RootElement;

            var intervalSec = Math.Clamp(GetInt(config, "everySec", GetInt(config, "intervalSec", 30)), 1, 86400);
            var executionMode = NormalizeExecutionMode(GetString(config, "executionMode"));
            var maxBurst = Math.Clamp(GetInt(config, "maxBurst", 8), 1, 60);

            if (!await PassesScheduledValueConditionAsync(session, config, ct))
            {
                continue;
            }

            var triggerKey = $"{node.Id:D}:every-sec";
            var triggerState = await dbContext.CogitaGameTriggerStates
                .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.TriggerKey == triggerKey && x.ScopeType == "session" && x.ScopeId == null, ct);
            if (triggerState is null)
            {
                triggerState = new CogitaGameTriggerState
                {
                    Id = Guid.NewGuid(),
                    SessionId = session.Id,
                    TriggerKey = triggerKey,
                    ScopeType = "session",
                    ScopeId = null,
                    Status = "idle",
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaGameTriggerStates.Add(triggerState);
            }

            var baseTime = triggerState.LastFiredUtc ?? session.StartedUtc ?? session.CreatedUtc;
            var elapsedSec = (now - baseTime).TotalSeconds;
            if (elapsedSec < intervalSec)
            {
                triggerState.Status = executionMode;
                triggerState.UpdatedUtc = now;
                continue;
            }

            var dueByElapsed = Math.Max(1, (int)Math.Floor(elapsedSec / intervalSec));
            var runsToExecute = executionMode == "serial"
                ? 1
                : Math.Min(dueByElapsed, maxBurst);
            var valueKey = GetString(config, "valueKey");
            var delta = GetDecimal(config, "delta", 0m);
            var scopeType = NormalizeScope(GetString(config, "scope"));
            var configuredScopeId = TryGetGuid(config, "scopeId", out var parsedScopeId) ? parsedScopeId : (Guid?)null;
            var normalizedScopeId = NormalizeTriggerScopeId(scopeType, configuredScopeId);

            var lastSeq = triggerState.LastEvaluatedSeq;
            for (var runIndex = 0; runIndex < runsToExecute; runIndex++)
            {
                var scheduledForUtc = baseTime.AddSeconds(intervalSec * (runIndex + 1));
                var tickEvent = await gameSessionService.AppendEventAsync(
                    session.Id,
                    "TimerTriggered",
                    new
                    {
                        triggerNodeId = node.Id,
                        nodeType = node.NodeType,
                        everySec = intervalSec,
                        executionMode,
                        scheduledForUtc
                    },
                    null,
                    Guid.NewGuid(),
                    null,
                    ct);

                lastSeq = Math.Max(lastSeq, tickEvent.SeqNo);
                createdRuns += 1;

                if (string.IsNullOrWhiteSpace(valueKey) || delta == 0m)
                {
                    continue;
                }

                if (scopeType != "session" && !normalizedScopeId.HasValue)
                {
                    continue;
                }

                await ApplyValueMutationAsync(
                    session,
                    tickEvent,
                    scopeType,
                    normalizedScopeId,
                    valueKey,
                    delta,
                    $"everySec.{executionMode}",
                    ct);
            }

            triggerState.Status = executionMode;
            triggerState.FiredCount += runsToExecute;
            triggerState.LastEvaluatedSeq = lastSeq;
            triggerState.LastFiredUtc = baseTime.AddSeconds(intervalSec * runsToExecute);
            triggerState.CooldownUntilUtc = triggerState.LastFiredUtc?.AddSeconds(intervalSec);
            triggerState.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(ct);
        return createdRuns;
    }

    private async Task HandleOnEnterZoneAsync(
        CogitaGameSession session,
        CogitaGameActionNode node,
        JsonElement eventPayload,
        CogitaGameEventLog sourceEvent,
        CancellationToken ct)
    {
        if (!TryGetString(eventPayload, "zoneKey", out var zoneKeyFromEvent))
        {
            return;
        }

        using var configDoc = JsonDocument.Parse(node.ConfigJson);
        var config = configDoc.RootElement;

        var expectedZoneKey = GetString(config, "zoneKey");
        if (!string.IsNullOrWhiteSpace(expectedZoneKey) &&
            !string.Equals(expectedZoneKey, zoneKeyFromEvent, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var cooldownSec = GetInt(config, "cooldownSec", 15);
        var scopeType = NormalizeScope(GetString(config, "scope"));
        var scopeId = ResolveScopeId(scopeType, eventPayload);
        if (scopeType != "session" && !scopeId.HasValue)
        {
            return;
        }

        if (!await PassesValueConditionAsync(session, config, eventPayload, ct))
        {
            return;
        }

        var triggerKey = $"{node.Id:D}:enter:{scopeType}:{scopeId?.ToString("D") ?? "-"}";
        if (!await TryAcquireTriggerAsync(session.Id, triggerKey, scopeType, scopeId, cooldownSec, sourceEvent.SeqNo, ct))
        {
            return;
        }

        var valueKey = GetString(config, "valueKey");
        var delta = GetDecimal(config, "delta", 0m);
        if (string.IsNullOrWhiteSpace(valueKey) || delta == 0m)
        {
            return;
        }

        await ApplyValueMutationAsync(session, sourceEvent, scopeType, scopeId, valueKey, delta, "onEnterZone", ct);
    }

    private async Task HandleOnNGroupPresenceAsync(
        CogitaGameSession session,
        CogitaGameActionNode node,
        JsonElement eventPayload,
        CogitaGameEventLog sourceEvent,
        CancellationToken ct)
    {
        if (!TryGetString(eventPayload, "zoneKey", out var zoneKeyFromEvent))
        {
            return;
        }

        using var configDoc = JsonDocument.Parse(node.ConfigJson);
        var config = configDoc.RootElement;

        var expectedZoneKey = GetString(config, "zoneKey");
        if (!string.IsNullOrWhiteSpace(expectedZoneKey) &&
            !string.Equals(expectedZoneKey, zoneKeyFromEvent, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var threshold = Math.Max(1, GetInt(config, "n", 2));
        var windowSec = Math.Max(5, GetInt(config, "windowSec", 60));
        var mode = GetString(config, "mode")?.Trim().ToLowerInvariant() == "competitive"
            ? "competitive"
            : "cooperative";
        var valueKey = GetString(config, "valueKey");
        var delta = GetDecimal(config, "delta", 0m);
        if (string.IsNullOrWhiteSpace(valueKey) || delta == 0m)
        {
            return;
        }

        var zone = await dbContext.CogitaGameZones.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.ZoneKey == zoneKeyFromEvent, ct);
        if (zone is null)
        {
            return;
        }

        var cutoff = DateTimeOffset.UtcNow.AddSeconds(-windowSec);
        var presence = await dbContext.CogitaGamePresenceStates.AsNoTracking()
            .Where(x => x.SessionId == session.Id && x.ZoneId == zone.Id && x.PresenceState == "inside" && x.EnteredUtc != null && x.EnteredUtc >= cutoff)
            .Join(dbContext.CogitaGameParticipants.AsNoTracking(),
                p => p.ParticipantId,
                participant => participant.Id,
                (p, participant) => new { participant.GroupId, p.EnteredUtc })
            .Where(x => x.GroupId != null)
            .ToListAsync(ct);

        var distinctGroupIds = presence
            .Select(x => x.GroupId!.Value)
            .Distinct()
            .ToList();

        if (distinctGroupIds.Count < threshold)
        {
            return;
        }

        if (!await PassesValueConditionAsync(session, config, eventPayload, ct))
        {
            return;
        }

        var triggerKey = $"{node.Id:D}:n-group:{zone.Id:D}";
        if (!await TryAcquireTriggerAsync(session.Id, triggerKey, "session", null, windowSec, sourceEvent.SeqNo, ct))
        {
            return;
        }

        if (mode == "competitive")
        {
            var winnerGroupId = presence
                .Where(x => x.GroupId.HasValue)
                .OrderBy(x => x.EnteredUtc)
                .Select(x => x.GroupId!.Value)
                .FirstOrDefault();

            if (winnerGroupId != Guid.Empty)
            {
                await ApplyValueMutationAsync(session, sourceEvent, "group", winnerGroupId, valueKey, delta, "onNGroupPresence.competitive", ct);
            }
            return;
        }

        foreach (var groupId in distinctGroupIds)
        {
            await ApplyValueMutationAsync(session, sourceEvent, "group", groupId, valueKey, delta, "onNGroupPresence.cooperative", ct);
        }
    }

    private async Task ApplyValueMutationAsync(
        CogitaGameSession session,
        CogitaGameEventLog sourceEvent,
        string scopeType,
        Guid? scopeId,
        string valueKey,
        decimal delta,
        string reason,
        CancellationToken ct)
    {
        var value = await dbContext.CogitaGameValues.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GameId == session.GameId && x.ValueKey == valueKey, ct);
        if (value is null)
        {
            return;
        }

        if (scopeType != "session" && !scopeId.HasValue)
        {
            return;
        }

        var current = await dbContext.CogitaGameValueLedger.AsNoTracking()
            .Where(x => x.SessionId == session.Id && x.ValueId == value.Id && x.ScopeType == scopeType && x.ScopeId == scopeId)
            .OrderByDescending(x => x.CreatedUtc)
            .Select(x => (decimal?)x.AbsoluteAfter)
            .FirstOrDefaultAsync(ct) ?? 0m;

        var next = current + delta;
        dbContext.CogitaGameValueLedger.Add(new CogitaGameValueLedger
        {
            Id = Guid.NewGuid(),
            SessionId = session.Id,
            ValueId = value.Id,
            ScopeType = scopeType,
            ScopeId = scopeId,
            Delta = delta,
            AbsoluteAfter = next,
            ReasonEventId = sourceEvent.Id,
            CreatedUtc = DateTimeOffset.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        await gameSessionService.AppendEventAsync(
            session.Id,
            "ValueChanged",
            new
            {
                valueKey,
                delta,
                absoluteAfter = next,
                scopeType,
                scopeId,
                reason
            },
            sourceEvent.ActorParticipantId,
            sourceEvent.CorrelationId,
            sourceEvent.Id,
            ct);

        await gameSessionService.RecomputeScoreboardAsync(session.Id, ct);
    }

    private async Task<bool> TryAcquireTriggerAsync(
        Guid sessionId,
        string triggerKey,
        string scopeType,
        Guid? scopeId,
        int cooldownSec,
        long sourceSeq,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var normalizedScopeId = NormalizeTriggerScopeId(scopeType, scopeId);
        var state = await dbContext.CogitaGameTriggerStates
            .FirstOrDefaultAsync(x => x.SessionId == sessionId && x.TriggerKey == triggerKey && x.ScopeType == scopeType && x.ScopeId == normalizedScopeId, ct);

        if (state is not null && state.CooldownUntilUtc.HasValue && state.CooldownUntilUtc.Value > now)
        {
            return false;
        }

        if (state is null)
        {
            state = new CogitaGameTriggerState
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                TriggerKey = triggerKey,
                ScopeType = scopeType,
                ScopeId = normalizedScopeId,
                CreatedUtc = now
            };
            dbContext.CogitaGameTriggerStates.Add(state);
        }

        state.Status = "fired";
        state.FiredCount += 1;
        state.LastEvaluatedSeq = sourceSeq;
        state.LastFiredUtc = now;
        state.CooldownUntilUtc = now.AddSeconds(cooldownSec);
        state.UpdatedUtc = now;

        await dbContext.SaveChangesAsync(ct);
        return true;
    }

    private async Task<bool> PassesValueConditionAsync(
        CogitaGameSession session,
        JsonElement config,
        JsonElement eventPayload,
        CancellationToken ct)
    {
        var valueKey = GetString(config, "compareValueKey");
        if (string.IsNullOrWhiteSpace(valueKey))
        {
            return true;
        }

        if (!TryGetComparisonThreshold(config, out var compareAgainst))
        {
            return false;
        }

        var compareScope = NormalizeScope(GetString(config, "compareScope"));
        var compareScopeId = ResolveScopeId(compareScope, eventPayload);
        if (compareScope != "session" && !compareScopeId.HasValue)
        {
            return false;
        }

        var value = await dbContext.CogitaGameValues.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GameId == session.GameId && x.ValueKey == valueKey, ct);
        if (value is null)
        {
            return false;
        }

        var current = await dbContext.CogitaGameValueLedger.AsNoTracking()
            .Where(x =>
                x.SessionId == session.Id &&
                x.ValueId == value.Id &&
                x.ScopeType == compareScope &&
                x.ScopeId == compareScopeId)
            .OrderByDescending(x => x.CreatedUtc)
            .Select(x => (decimal?)x.AbsoluteAfter)
            .FirstOrDefaultAsync(ct) ?? 0m;

        var compareOperator = NormalizeComparisonOperator(GetString(config, "compareOperator"));
        return compareOperator switch
        {
            "gt" => current > compareAgainst,
            "gte" => current >= compareAgainst,
            "lt" => current < compareAgainst,
            "lte" => current <= compareAgainst,
            "eq" => current == compareAgainst,
            "neq" => current != compareAgainst,
            _ => current >= compareAgainst
        };
    }

    private async Task<bool> PassesScheduledValueConditionAsync(
        CogitaGameSession session,
        JsonElement config,
        CancellationToken ct)
    {
        var valueKey = GetString(config, "compareValueKey");
        if (string.IsNullOrWhiteSpace(valueKey))
        {
            return true;
        }

        var compareScope = NormalizeScope(GetString(config, "compareScope"));
        if (compareScope != "session")
        {
            return false;
        }

        if (!TryGetComparisonThreshold(config, out var compareAgainst))
        {
            return false;
        }

        var value = await dbContext.CogitaGameValues.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GameId == session.GameId && x.ValueKey == valueKey, ct);
        if (value is null)
        {
            return false;
        }

        var current = await dbContext.CogitaGameValueLedger.AsNoTracking()
            .Where(x =>
                x.SessionId == session.Id &&
                x.ValueId == value.Id &&
                x.ScopeType == "session" &&
                x.ScopeId == null)
            .OrderByDescending(x => x.CreatedUtc)
            .Select(x => (decimal?)x.AbsoluteAfter)
            .FirstOrDefaultAsync(ct) ?? 0m;

        var compareOperator = NormalizeComparisonOperator(GetString(config, "compareOperator"));
        return compareOperator switch
        {
            "gt" => current > compareAgainst,
            "gte" => current >= compareAgainst,
            "lt" => current < compareAgainst,
            "lte" => current <= compareAgainst,
            "eq" => current == compareAgainst,
            "neq" => current != compareAgainst,
            _ => current >= compareAgainst
        };
    }

    private static Guid? ResolveScopeId(string scopeType, JsonElement eventPayload)
    {
        if (scopeType == "session")
        {
            return null;
        }

        if (scopeType == "group" && TryGetGuid(eventPayload, "groupId", out var groupId))
        {
            return groupId;
        }

        if (scopeType == "participant" && TryGetGuid(eventPayload, "participantId", out var participantId))
        {
            return participantId;
        }

        return null;
    }

    private static Guid? NormalizeTriggerScopeId(string scopeType, Guid? scopeId)
    {
        return scopeType == "session" ? null : scopeId;
    }

    private static string NormalizeScope(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "group" || normalized == "participant")
        {
            return normalized;
        }

        return "session";
    }

    private static string NormalizeExecutionMode(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "stack" => "stack",
            "parallel" => "simultaneous",
            "simultaneous" => "simultaneous",
            _ => "serial"
        };
    }

    private static bool ShouldRunScheduledTriggers(CogitaGameSession session)
    {
        if (string.Equals(session.Status, "finished", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var phase = (session.Phase ?? string.Empty).Trim().ToLowerInvariant();
        return phase is "active_round" or "reveal" or "transition";
    }

    private static string? GetString(JsonElement root, string property)
    {
        if (!root.TryGetProperty(property, out var node) || node.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return node.GetString();
    }

    private static bool TryGetString(JsonElement root, string property, out string value)
    {
        value = string.Empty;
        if (!root.TryGetProperty(property, out var node) || node.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        var raw = node.GetString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        value = raw.Trim();
        return true;
    }

    private static bool TryGetGuid(JsonElement root, string property, out Guid value)
    {
        value = Guid.Empty;
        if (!root.TryGetProperty(property, out var node) || node.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        return Guid.TryParse(node.GetString(), out value);
    }

    private static string NormalizeComparisonOperator(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "gt" or "gte" or "lt" or "lte" or "eq" or "neq" => normalized,
            _ => "gte"
        };
    }

    private static bool TryGetComparisonThreshold(JsonElement root, out decimal threshold)
    {
        threshold = 0m;
        JsonElement node;
        if (root.TryGetProperty("compareAgainst", out var againstNode) && againstNode.ValueKind == JsonValueKind.Number)
        {
            node = againstNode;
        }
        else if (root.TryGetProperty("compareThreshold", out var thresholdNode) && thresholdNode.ValueKind == JsonValueKind.Number)
        {
            node = thresholdNode;
        }
        else
        {
            return false;
        }

        if (node.TryGetDecimal(out var parsedDecimal))
        {
            threshold = parsedDecimal;
            return true;
        }

        if (node.TryGetDouble(out var parsedDouble))
        {
            threshold = Convert.ToDecimal(parsedDouble);
            return true;
        }

        return false;
    }

    private static int GetInt(JsonElement root, string property, int fallback)
    {
        if (!root.TryGetProperty(property, out var node) || node.ValueKind != JsonValueKind.Number)
        {
            return fallback;
        }

        return node.TryGetInt32(out var parsed) ? parsed : fallback;
    }

    private static decimal GetDecimal(JsonElement root, string property, decimal fallback)
    {
        if (!root.TryGetProperty(property, out var node) || node.ValueKind != JsonValueKind.Number)
        {
            return fallback;
        }

        if (node.TryGetDecimal(out var parsedDecimal))
        {
            return parsedDecimal;
        }

        if (node.TryGetDouble(out var parsedDouble))
        {
            return Convert.ToDecimal(parsedDouble);
        }

        return fallback;
    }
}
