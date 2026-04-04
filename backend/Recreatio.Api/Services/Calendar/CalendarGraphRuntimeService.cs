using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Calendar;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Calendar;

namespace Recreatio.Api.Services;

public sealed record CalendarOccurrenceRuntime(
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    bool IsRecurringInstance,
    Guid? ExecutionId,
    string Source);

public interface ICalendarGraphRuntimeService
{
    Task<IReadOnlyList<CalendarGraphTemplateResponse>> GetTemplatesAsync(CancellationToken ct);
    Task<CalendarGraphResponse?> GetGraphAsync(Guid eventId, CancellationToken ct);
    Task<CalendarGraphResponse> UpsertGraphAsync(Guid eventId, CalendarGraphUpsertRequest request, Guid actorUserId, CancellationToken ct);
    Task<CalendarGraphExecutionResponse> ExecuteGraphAsync(Guid eventId, CalendarGraphExecutionTriggerRequest request, Guid actorUserId, CancellationToken ct);
    Task<IReadOnlyList<CalendarGraphExecutionResponse>> GetExecutionsAsync(Guid eventId, int take, CancellationToken ct);
    Task<IReadOnlyList<CalendarOccurrenceRuntime>> ExpandOccurrencesAsync(CalendarEvent item, DateTimeOffset fromUtc, DateTimeOffset toUtc, CancellationToken ct);
}

public sealed class CalendarGraphRuntimeService : ICalendarGraphRuntimeService
{
    private const int MaxOccurrencePerEvent = 512;

    private readonly RecreatioDbContext _dbContext;
    private readonly ILedgerService _ledgerService;

    public CalendarGraphRuntimeService(
        RecreatioDbContext dbContext,
        ILedgerService ledgerService)
    {
        _dbContext = dbContext;
        _ledgerService = ledgerService;
    }

    public Task<IReadOnlyList<CalendarGraphTemplateResponse>> GetTemplatesAsync(CancellationToken ct)
    {
        _ = ct;
        var templates = new List<CalendarGraphTemplateResponse>
        {
            BuildTemplateDaily(),
            BuildTemplateWeekly(),
            BuildTemplateMonthly(),
            BuildTemplateTaskRecreate(),
            BuildTemplateFollowupAppointment(),
            BuildTemplateChecklistFollowup()
        };

        return Task.FromResult<IReadOnlyList<CalendarGraphTemplateResponse>>(templates);
    }

    public async Task<CalendarGraphResponse?> GetGraphAsync(Guid eventId, CancellationToken ct)
    {
        var graph = await _dbContext.CalendarScheduleGraphs.AsNoTracking()
            .Where(entry => entry.EventId == eventId)
            .OrderByDescending(entry => entry.Version)
            .FirstOrDefaultAsync(ct);
        if (graph is null)
        {
            return null;
        }

        var nodes = await _dbContext.CalendarScheduleGraphNodes.AsNoTracking()
            .Where(entry => entry.GraphId == graph.Id)
            .OrderBy(entry => entry.NodeKey)
            .ToListAsync(ct);
        var edges = await _dbContext.CalendarScheduleGraphEdges.AsNoTracking()
            .Where(entry => entry.GraphId == graph.Id)
            .OrderBy(entry => entry.FromNodeId)
            .ThenBy(entry => entry.ToNodeId)
            .ToListAsync(ct);

        return ToGraphResponse(graph, nodes, edges);
    }

    public async Task<CalendarGraphResponse> UpsertGraphAsync(Guid eventId, CalendarGraphUpsertRequest request, Guid actorUserId, CancellationToken ct)
    {
        var item = await _dbContext.CalendarEvents.AsNoTracking()
            .FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
        if (item is null)
        {
            throw new InvalidOperationException("Calendar item does not exist.");
        }

        var status = NormalizeGraphStatus(request.Status);
        if (status is null)
        {
            throw new InvalidOperationException("Graph status is invalid.");
        }

        var templateKey = NormalizeTemplateKey(request.TemplateKey);
        if (templateKey is null)
        {
            throw new InvalidOperationException("TemplateKey is invalid.");
        }

        var now = DateTimeOffset.UtcNow;
        var graph = await _dbContext.CalendarScheduleGraphs
            .Where(entry => entry.EventId == eventId)
            .OrderByDescending(entry => entry.Version)
            .FirstOrDefaultAsync(ct);

        if (graph is null)
        {
            graph = new CalendarScheduleGraph
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                TemplateKey = templateKey,
                TemplateConfigJson = NormalizeJsonOrDefault(request.TemplateConfigJson),
                Status = status,
                Version = 1,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            _dbContext.CalendarScheduleGraphs.Add(graph);
        }
        else
        {
            graph.TemplateKey = templateKey;
            graph.TemplateConfigJson = NormalizeJsonOrDefault(request.TemplateConfigJson);
            graph.Status = status;
            graph.Version += 1;
            graph.UpdatedUtc = now;
        }

        await _dbContext.SaveChangesAsync(ct);

        var existingNodes = await _dbContext.CalendarScheduleGraphNodes
            .Where(entry => entry.GraphId == graph.Id)
            .ToListAsync(ct);
        if (existingNodes.Count > 0)
        {
            _dbContext.CalendarScheduleGraphNodes.RemoveRange(existingNodes);
        }

        var existingEdges = await _dbContext.CalendarScheduleGraphEdges
            .Where(entry => entry.GraphId == graph.Id)
            .ToListAsync(ct);
        if (existingEdges.Count > 0)
        {
            _dbContext.CalendarScheduleGraphEdges.RemoveRange(existingEdges);
        }

        var requestNodes = request.Nodes ?? Array.Empty<CalendarGraphNodeRequest>();
        var sourceNodeIds = new HashSet<Guid>();
        var nodeIdMap = new Dictionary<Guid, Guid>();
        var nodeIndex = 0;
        foreach (var node in requestNodes)
        {
            var nodeType = NormalizeNodeType(node.NodeType);
            if (nodeType is null)
            {
                throw new InvalidOperationException("One or more graph nodes has invalid type.");
            }

            var sourceNodeId = node.NodeId is { } nodeIdValue && nodeIdValue != Guid.Empty
                ? nodeIdValue
                : Guid.NewGuid();
            if (!sourceNodeIds.Add(sourceNodeId))
            {
                throw new InvalidOperationException("Graph node ids must be unique.");
            }

            var storageNodeId = Guid.NewGuid();
            nodeIdMap[sourceNodeId] = storageNodeId;

            var nodeKey = string.IsNullOrWhiteSpace(node.NodeKey)
                ? $"node-{nodeIndex + 1}"
                : node.NodeKey.Trim();
            if (nodeKey.Length > 128)
            {
                throw new InvalidOperationException("Graph node key is too long.");
            }

            _dbContext.CalendarScheduleGraphNodes.Add(new CalendarScheduleGraphNode
            {
                Id = storageNodeId,
                GraphId = graph.Id,
                NodeType = nodeType,
                NodeKey = nodeKey,
                ConfigJson = NormalizeJsonOrDefault(node.ConfigJson),
                PositionX = node.PositionX,
                PositionY = node.PositionY
            });
            nodeIndex++;
        }

        var requestEdges = request.Edges ?? Array.Empty<CalendarGraphEdgeRequest>();
        foreach (var edge in requestEdges)
        {
            if (edge.FromNodeId == Guid.Empty || edge.ToNodeId == Guid.Empty)
            {
                throw new InvalidOperationException("Graph edge references an empty node id.");
            }

            if (!nodeIdMap.ContainsKey(edge.FromNodeId) || !nodeIdMap.ContainsKey(edge.ToNodeId))
            {
                throw new InvalidOperationException("Graph edge references unknown node id.");
            }

            _dbContext.CalendarScheduleGraphEdges.Add(new CalendarScheduleGraphEdge
            {
                Id = Guid.NewGuid(),
                GraphId = graph.Id,
                FromNodeId = nodeIdMap[edge.FromNodeId],
                FromPort = NormalizeNullable(edge.FromPort, 64),
                ToNodeId = nodeIdMap[edge.ToNodeId],
                ToPort = NormalizeNullable(edge.ToPort, 64),
                EdgeType = NormalizeNullable(edge.EdgeType, 64),
                ConditionJson = NormalizeJsonNullable(edge.ConditionJson)
            });
        }

        await _dbContext.SaveChangesAsync(ct);

        await _ledgerService.AppendBusinessAsync(
            "CalendarGraphUpserted",
            actorUserId.ToString(),
            JsonSerializer.Serialize(new { eventId, graphId = graph.Id, graph.Version, graph.TemplateKey, graph.Status }),
            ct);

        var nodes = await _dbContext.CalendarScheduleGraphNodes.AsNoTracking()
            .Where(entry => entry.GraphId == graph.Id)
            .OrderBy(entry => entry.NodeKey)
            .ToListAsync(ct);
        var edges = await _dbContext.CalendarScheduleGraphEdges.AsNoTracking()
            .Where(entry => entry.GraphId == graph.Id)
            .OrderBy(entry => entry.FromNodeId)
            .ThenBy(entry => entry.ToNodeId)
            .ToListAsync(ct);

        return ToGraphResponse(graph, nodes, edges);
    }

    public async Task<CalendarGraphExecutionResponse> ExecuteGraphAsync(Guid eventId, CalendarGraphExecutionTriggerRequest request, Guid actorUserId, CancellationToken ct)
    {
        var item = await _dbContext.CalendarEvents
            .FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
        if (item is null)
        {
            throw new InvalidOperationException("Calendar item does not exist.");
        }

        var graph = await _dbContext.CalendarScheduleGraphs
            .Where(entry => entry.EventId == eventId && entry.Status == "active")
            .OrderByDescending(entry => entry.Version)
            .FirstOrDefaultAsync(ct);
        if (graph is null)
        {
            throw new InvalidOperationException("No active graph attached to this item.");
        }

        var triggerType = NormalizeTriggerType(request.TriggerType) ?? "manual";
        var completionAction = NormalizeCompletionAction(request.CompletionAction);
        var idempotencyKey = BuildIdempotencyKey(request.IdempotencyKey, eventId, triggerType, completionAction);

        var existing = await _dbContext.CalendarGraphExecutions.AsNoTracking()
            .FirstOrDefaultAsync(entry => entry.GraphId == graph.Id && entry.IdempotencyKey == idempotencyKey, ct);
        if (existing is not null)
        {
            return ToExecutionResponse(existing);
        }

        var now = DateTimeOffset.UtcNow;
        var execution = new CalendarGraphExecution
        {
            Id = Guid.NewGuid(),
            GraphId = graph.Id,
            EventId = item.Id,
            IdempotencyKey = idempotencyKey,
            TriggerType = triggerType,
            Status = "running",
            TriggerPayloadJson = NormalizeJsonNullable(request.TriggerPayloadJson),
            ResultPayloadJson = null,
            CreatedUtc = now,
            StartedUtc = now,
            FinishedUtc = null
        };

        _dbContext.CalendarGraphExecutions.Add(execution);
        await _dbContext.SaveChangesAsync(ct);

        var createdItems = new List<Guid>();
        string status;
        string resultJson;
        try
        {
            var nodes = await _dbContext.CalendarScheduleGraphNodes.AsNoTracking()
                .Where(entry => entry.GraphId == graph.Id)
                .ToListAsync(ct);
            var edges = await _dbContext.CalendarScheduleGraphEdges.AsNoTracking()
                .Where(entry => entry.GraphId == graph.Id)
                .ToListAsync(ct);
            var scopeRoleIds = await _dbContext.CalendarEventRoleScopes.AsNoTracking()
                .Where(entry => entry.EventId == item.Id && entry.RevokedUtc == null)
                .Select(entry => entry.RoleId)
                .ToListAsync(ct);

            var creationPlan = BuildCreationPlan(item, graph, nodes, edges, triggerType, completionAction);
            foreach (var action in creationPlan)
            {
                var created = await CreateDerivedItemAsync(item, scopeRoleIds, action, actorUserId, ct);
                createdItems.Add(created.Id);
            }

            status = "completed";
            resultJson = JsonSerializer.Serialize(new
            {
                createdItemIds = createdItems,
                createdCount = createdItems.Count,
                template = graph.TemplateKey,
                triggerType,
                completionAction
            });
        }
        catch (Exception ex)
        {
            status = "failed";
            resultJson = JsonSerializer.Serialize(new
            {
                createdItemIds = createdItems,
                createdCount = createdItems.Count,
                error = ex.Message
            });
        }

        var finished = DateTimeOffset.UtcNow;
        execution.Status = status;
        execution.ResultPayloadJson = resultJson;
        execution.FinishedUtc = finished;
        await _dbContext.SaveChangesAsync(ct);

        await _ledgerService.AppendBusinessAsync(
            "CalendarGraphExecuted",
            actorUserId.ToString(),
            JsonSerializer.Serialize(new
            {
                eventId = item.Id,
                graphId = graph.Id,
                executionId = execution.Id,
                execution.IdempotencyKey,
                execution.TriggerType,
                execution.Status,
                createdItemIds = createdItems
            }),
            ct);

        return ToExecutionResponse(execution);
    }

    public async Task<IReadOnlyList<CalendarGraphExecutionResponse>> GetExecutionsAsync(Guid eventId, int take, CancellationToken ct)
    {
        var normalizedTake = Math.Clamp(take <= 0 ? 30 : take, 1, 200);
        var executions = await _dbContext.CalendarGraphExecutions.AsNoTracking()
            .Where(entry => entry.EventId == eventId)
            .OrderByDescending(entry => entry.CreatedUtc)
            .Take(normalizedTake)
            .ToListAsync(ct);

        return executions.Select(ToExecutionResponse).ToList();
    }

    public async Task<IReadOnlyList<CalendarOccurrenceRuntime>> ExpandOccurrencesAsync(CalendarEvent item, DateTimeOffset fromUtc, DateTimeOffset toUtc, CancellationToken ct)
    {
        var graph = await _dbContext.CalendarScheduleGraphs.AsNoTracking()
            .Where(entry => entry.EventId == item.Id && entry.Status == "active")
            .OrderByDescending(entry => entry.Version)
            .FirstOrDefaultAsync(ct);

        if (graph is not null)
        {
            var template = NormalizeTemplateKey(graph.TemplateKey);
            if (template is "daily" or "weekly" or "monthly")
            {
                return ExpandByGraphTemplate(item, graph, fromUtc, toUtc)
                    .Select(entry => new CalendarOccurrenceRuntime(entry.StartUtc, entry.EndUtc, entry.IsRecurringInstance, null, "graph-template"))
                    .ToList();
            }
        }

        return ExpandByLegacyRecurrence(item, fromUtc, toUtc)
            .Select(entry => new CalendarOccurrenceRuntime(entry.StartUtc, entry.EndUtc, entry.IsRecurringInstance, null, "event"))
            .ToList();
    }

    private async Task<CalendarEvent> CreateDerivedItemAsync(
        CalendarEvent source,
        IReadOnlyList<Guid> sourceScopeRoleIds,
        CalendarItemCreationAction action,
        Guid actorUserId,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var created = new CalendarEvent
        {
            Id = Guid.NewGuid(),
            CalendarId = source.CalendarId,
            OwnerRoleId = source.OwnerRoleId,
            TitlePublic = action.Title,
            SummaryPublic = action.Summary,
            LocationPublic = source.LocationPublic,
            Visibility = source.Visibility,
            Status = action.Status,
            ItemType = action.ItemType,
            StartUtc = action.StartUtc,
            EndUtc = action.EndUtc,
            AllDay = source.AllDay,
            TimeZoneId = source.TimeZoneId,
            RecurrenceType = "none",
            RecurrenceInterval = 1,
            RecurrenceByWeekday = null,
            RecurrenceUntilUtc = null,
            RecurrenceCount = null,
            RecurrenceRule = null,
            TaskState = action.TaskState,
            CompletedUtc = null,
            TaskProgressPercent = action.TaskProgressPercent,
            RequiresCompletionProof = source.RequiresCompletionProof,
            CompletionProofDataItemId = null,
            AssigneeRoleId = source.AssigneeRoleId,
            ProtectedDataItemId = null,
            LinkedModule = source.LinkedModule,
            LinkedEntityType = source.LinkedEntityType,
            LinkedEntityId = source.LinkedEntityId,
            SourceFieldStart = source.SourceFieldStart,
            SourceFieldEnd = source.SourceFieldEnd,
            ConflictScopeMode = source.ConflictScopeMode,
            CreatedByUserId = actorUserId,
            UpdatedByUserId = actorUserId,
            CreatedUtc = now,
            UpdatedUtc = now,
            CancelledUtc = null,
            IsArchived = false
        };

        _dbContext.CalendarEvents.Add(created);
        foreach (var roleId in sourceScopeRoleIds.Distinct())
        {
            _dbContext.CalendarEventRoleScopes.Add(new CalendarEventRoleScope
            {
                Id = Guid.NewGuid(),
                EventId = created.Id,
                RoleId = roleId,
                ScopeType = roleId == created.OwnerRoleId ? "owner" : "participant",
                CreatedUtc = now,
                RevokedUtc = null
            });
        }

        await _dbContext.SaveChangesAsync(ct);
        return created;
    }

    private static List<CalendarItemCreationAction> BuildCreationPlan(
        CalendarEvent source,
        CalendarScheduleGraph graph,
        IReadOnlyList<CalendarScheduleGraphNode> nodes,
        IReadOnlyList<CalendarScheduleGraphEdge> edges,
        string triggerType,
        string? completionAction)
    {
        var actions = new List<CalendarItemCreationAction>();

        BuildTemplateActions(source, graph, triggerType, completionAction, actions);
        BuildNodeActions(source, nodes, edges, actions);

        return actions;
    }

    private static void BuildTemplateActions(
        CalendarEvent source,
        CalendarScheduleGraph graph,
        string triggerType,
        string? completionAction,
        List<CalendarItemCreationAction> actions)
    {
        var template = NormalizeTemplateKey(graph.TemplateKey);
        if (template is null)
        {
            return;
        }

        var config = ParseConfig(graph.TemplateConfigJson);
        var baseDuration = source.EndUtc > source.StartUtc ? source.EndUtc - source.StartUtc : TimeSpan.FromHours(1);

        switch (template)
        {
            case "daily":
            {
                var interval = GetInt(config, "interval", 1, 1, 365);
                var nextStart = source.StartUtc.AddDays(interval);
                actions.Add(new CalendarItemCreationAction(source.ItemType, source.TitlePublic, source.SummaryPublic, nextStart, nextStart + baseDuration, "planned", source.TaskState, source.TaskProgressPercent));
                break;
            }
            case "weekly":
            {
                var interval = GetInt(config, "interval", 1, 1, 52);
                var nextStart = source.StartUtc.AddDays(interval * 7);
                actions.Add(new CalendarItemCreationAction(source.ItemType, source.TitlePublic, source.SummaryPublic, nextStart, nextStart + baseDuration, "planned", source.TaskState, source.TaskProgressPercent));
                break;
            }
            case "monthly":
            {
                var interval = GetInt(config, "interval", 1, 1, 24);
                var nextStart = source.StartUtc.AddMonths(interval);
                actions.Add(new CalendarItemCreationAction(source.ItemType, source.TitlePublic, source.SummaryPublic, nextStart, nextStart + baseDuration, "planned", source.TaskState, source.TaskProgressPercent));
                break;
            }
            case "task_recreate_after_completion":
            {
                if (source.ItemType != "task")
                {
                    break;
                }

                if (completionAction != "run_graph" && triggerType != "completion")
                {
                    break;
                }

                var daysAfter = GetInt(config, "daysAfter", 14, 1, 3650);
                var start = (source.CompletedUtc ?? DateTimeOffset.UtcNow).AddDays(daysAfter);
                var end = start + baseDuration;
                actions.Add(new CalendarItemCreationAction("task", source.TitlePublic, source.SummaryPublic, start, end, "planned", "todo", 0));
                break;
            }
            case "follow_up_appointment_after_completion":
            {
                if (completionAction != "run_graph" && triggerType != "completion")
                {
                    break;
                }

                var daysAfter = GetInt(config, "daysAfter", 1, 0, 3650);
                var durationMinutes = GetInt(config, "durationMinutes", 60, 5, 60 * 24);
                var start = (source.CompletedUtc ?? DateTimeOffset.UtcNow).AddDays(daysAfter);
                actions.Add(new CalendarItemCreationAction("appointment", $"Follow-up: {source.TitlePublic}", source.SummaryPublic, start, start.AddMinutes(durationMinutes), "planned", null, null));
                break;
            }
            case "chained_checklist_followup_task":
            {
                if (completionAction != "run_graph" && triggerType != "completion")
                {
                    break;
                }

                var daysAfter = GetInt(config, "daysAfter", 1, 0, 3650);
                var start = (source.CompletedUtc ?? DateTimeOffset.UtcNow).AddDays(daysAfter);
                actions.Add(new CalendarItemCreationAction("task", $"Checklist: {source.TitlePublic}", source.SummaryPublic, start, start.AddHours(1), "planned", "todo", 0));
                break;
            }
        }
    }

    private static void BuildNodeActions(
        CalendarEvent source,
        IReadOnlyList<CalendarScheduleGraphNode> nodes,
        IReadOnlyList<CalendarScheduleGraphEdge> edges,
        List<CalendarItemCreationAction> actions)
    {
        if (nodes.Count == 0)
        {
            return;
        }

        var nodesById = nodes.ToDictionary(entry => entry.Id, entry => entry);
        var outgoing = edges
            .GroupBy(entry => entry.FromNodeId)
            .ToDictionary(grouping => grouping.Key, grouping => grouping.Select(edge => edge.ToNodeId).ToList());

        var queue = new Queue<(Guid NodeId, TimeSpan Delay, int Depth)>();
        foreach (var startNode in nodes.Where(node => node.NodeType == "trigger"))
        {
            queue.Enqueue((startNode.Id, TimeSpan.Zero, 0));
        }

        if (queue.Count == 0)
        {
            queue.Enqueue((nodes[0].Id, TimeSpan.Zero, 0));
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (current.Depth > 48)
            {
                continue;
            }

            if (!nodesById.TryGetValue(current.NodeId, out var node))
            {
                continue;
            }

            var delay = current.Delay;
            var nodeConfig = ParseConfig(node.ConfigJson);
            switch (node.NodeType)
            {
                case "delay":
                {
                    var days = GetInt(nodeConfig, "days", 0, 0, 3650);
                    var weeks = GetInt(nodeConfig, "weeks", 0, 0, 520);
                    var hours = GetInt(nodeConfig, "hours", 0, 0, 24 * 3650);
                    delay += TimeSpan.FromDays(days + (weeks * 7)) + TimeSpan.FromHours(hours);
                    break;
                }
                case "create_task":
                {
                    var title = GetString(nodeConfig, "title") ?? $"Task: {source.TitlePublic}";
                    var summary = GetString(nodeConfig, "summary") ?? source.SummaryPublic;
                    var durationMinutes = GetInt(nodeConfig, "durationMinutes", 60, 5, 60 * 24);
                    var start = source.EndUtc + delay;
                    var end = start.AddMinutes(durationMinutes);
                    var key = $"task:{title}:{start:O}:{end:O}";
                    if (seen.Add(key))
                    {
                        actions.Add(new CalendarItemCreationAction("task", title, summary, start, end, "planned", "todo", 0));
                    }
                    break;
                }
                case "create_appointment":
                {
                    var title = GetString(nodeConfig, "title") ?? $"Appointment: {source.TitlePublic}";
                    var summary = GetString(nodeConfig, "summary") ?? source.SummaryPublic;
                    var durationMinutes = GetInt(nodeConfig, "durationMinutes", 60, 5, 60 * 24);
                    var start = source.EndUtc + delay;
                    var end = start.AddMinutes(durationMinutes);
                    var key = $"appointment:{title}:{start:O}:{end:O}";
                    if (seen.Add(key))
                    {
                        actions.Add(new CalendarItemCreationAction("appointment", title, summary, start, end, "planned", null, null));
                    }
                    break;
                }
            }

            if (!outgoing.TryGetValue(current.NodeId, out var nextNodeIds))
            {
                continue;
            }

            foreach (var nextNodeId in nextNodeIds)
            {
                queue.Enqueue((nextNodeId, delay, current.Depth + 1));
            }
        }
    }

    private static IEnumerable<(DateTimeOffset StartUtc, DateTimeOffset EndUtc, bool IsRecurringInstance)> ExpandByGraphTemplate(
        CalendarEvent item,
        CalendarScheduleGraph graph,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc)
    {
        var config = ParseConfig(graph.TemplateConfigJson);
        var interval = GetInt(config, "interval", 1, 1, 365);
        var frequency = NormalizeTemplateKey(graph.TemplateKey) switch
        {
            "weekly" => TimeSpan.FromDays(interval * 7),
            "monthly" => TimeSpan.FromDays(interval * 30),
            _ => TimeSpan.FromDays(interval)
        };

        var duration = item.EndUtc > item.StartUtc ? item.EndUtc - item.StartUtc : TimeSpan.FromHours(1);
        var current = item.StartUtc;
        var emitted = 0;
        while (emitted < MaxOccurrencePerEvent)
        {
            var end = current + duration;
            if (current < toUtc && end > fromUtc)
            {
                yield return (current, end, current != item.StartUtc);
            }

            if (current > toUtc)
            {
                break;
            }

            current = NormalizeTemplateKey(graph.TemplateKey) == "monthly"
                ? current.AddMonths(interval)
                : current.Add(frequency);
            emitted++;
        }
    }

    private static IEnumerable<(DateTimeOffset StartUtc, DateTimeOffset EndUtc, bool IsRecurringInstance)> ExpandByLegacyRecurrence(
        CalendarEvent item,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc)
    {
        if (item.RecurrenceType == "none" || item.RecurrenceType == "custom")
        {
            if (item.StartUtc < toUtc && item.EndUtc > fromUtc)
            {
                yield return (item.StartUtc, item.EndUtc, false);
            }

            yield break;
        }

        var duration = item.EndUtc > item.StartUtc ? item.EndUtc - item.StartUtc : TimeSpan.FromHours(1);
        var maxCount = item.RecurrenceCount is > 0 ? Math.Min(item.RecurrenceCount.Value, MaxOccurrencePerEvent) : MaxOccurrencePerEvent;
        var generated = 0;
        var currentStart = item.StartUtc;
        while (generated < maxCount)
        {
            if (item.RecurrenceUntilUtc is not null && currentStart > item.RecurrenceUntilUtc.Value)
            {
                break;
            }

            var currentEnd = currentStart + duration;
            if (currentStart < toUtc && currentEnd > fromUtc)
            {
                yield return (currentStart, currentEnd, generated > 0);
            }

            if (currentStart > toUtc)
            {
                break;
            }

            currentStart = item.RecurrenceType switch
            {
                "daily" => currentStart.AddDays(Math.Max(1, item.RecurrenceInterval)),
                "weekly" => currentStart.AddDays(Math.Max(1, item.RecurrenceInterval) * 7),
                "monthly" => currentStart.AddMonths(Math.Max(1, item.RecurrenceInterval)),
                _ => currentStart.AddDays(Math.Max(1, item.RecurrenceInterval))
            };
            generated++;
        }
    }

    private static CalendarGraphResponse ToGraphResponse(
        CalendarScheduleGraph graph,
        IReadOnlyList<CalendarScheduleGraphNode> nodes,
        IReadOnlyList<CalendarScheduleGraphEdge> edges)
    {
        return new CalendarGraphResponse(
            graph.Id,
            graph.EventId,
            graph.TemplateKey,
            graph.TemplateConfigJson,
            graph.Status,
            graph.Version,
            graph.CreatedUtc,
            graph.UpdatedUtc,
            nodes.Select(ToNodeResponse).ToList(),
            edges.Select(ToEdgeResponse).ToList());
    }

    private static CalendarGraphNodeResponse ToNodeResponse(CalendarScheduleGraphNode node)
    {
        return new CalendarGraphNodeResponse(node.Id, node.NodeType, node.NodeKey, node.ConfigJson, node.PositionX, node.PositionY);
    }

    private static CalendarGraphEdgeResponse ToEdgeResponse(CalendarScheduleGraphEdge edge)
    {
        return new CalendarGraphEdgeResponse(edge.Id, edge.FromNodeId, edge.FromPort, edge.ToNodeId, edge.ToPort, edge.EdgeType, edge.ConditionJson);
    }

    private static CalendarGraphExecutionResponse ToExecutionResponse(CalendarGraphExecution execution)
    {
        return new CalendarGraphExecutionResponse(
            execution.Id,
            execution.GraphId,
            execution.EventId,
            execution.IdempotencyKey,
            execution.TriggerType,
            execution.Status,
            execution.TriggerPayloadJson,
            execution.ResultPayloadJson,
            execution.CreatedUtc,
            execution.StartedUtc,
            execution.FinishedUtc);
    }

    private static string BuildIdempotencyKey(string? requestIdempotencyKey, Guid eventId, string triggerType, string? completionAction)
    {
        if (!string.IsNullOrWhiteSpace(requestIdempotencyKey))
        {
            var provided = requestIdempotencyKey.Trim();
            if (provided.Length > 128)
            {
                return provided[..128];
            }

            return provided;
        }

        return $"{eventId:N}:{triggerType}:{completionAction ?? "none"}:{DateTimeOffset.UtcNow:yyyyMMddHHmm}";
    }

    private static Dictionary<string, JsonElement> ParseConfig(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            }

            var map = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            foreach (var property in doc.RootElement.EnumerateObject())
            {
                map[property.Name] = property.Value.Clone();
            }

            return map;
        }
        catch
        {
            return new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private static int GetInt(Dictionary<string, JsonElement> config, string key, int fallback, int min, int max)
    {
        if (!config.TryGetValue(key, out var value))
        {
            return fallback;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number))
        {
            return Math.Clamp(number, min, max);
        }

        if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsed))
        {
            return Math.Clamp(parsed, min, max);
        }

        return fallback;
    }

    private static string? GetString(Dictionary<string, JsonElement> config, string key)
    {
        if (!config.TryGetValue(key, out var value))
        {
            return null;
        }

        return value.ValueKind == JsonValueKind.String
            ? value.GetString()?.Trim()
            : null;
    }

    private static string? NormalizeTemplateKey(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "daily" => "daily",
            "weekly" => "weekly",
            "monthly" => "monthly",
            "task_recreate_after_completion" => "task_recreate_after_completion",
            "follow_up_appointment_after_completion" => "follow_up_appointment_after_completion",
            "chained_checklist_followup_task" => "chained_checklist_followup_task",
            _ => null
        };
    }

    private static string? NormalizeGraphStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "draft" => "draft",
            "active" => "active",
            "archived" => "archived",
            _ => null
        };
    }

    private static string? NormalizeNodeType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "trigger" => "trigger",
            "delay" => "delay",
            "create_task" => "create_task",
            "create_appointment" => "create_appointment",
            "condition" => "condition",
            "noop" => "noop",
            _ => null
        };
    }

    private static string? NormalizeTriggerType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "manual" => "manual",
            "completion" => "completion",
            "schedule" => "schedule",
            _ => null
        };
    }

    private static string? NormalizeCompletionAction(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "complete_only" => "complete_only",
            "run_graph" => "run_graph",
            _ => null
        };
    }

    private static string NormalizeJsonOrDefault(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return "{}";
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.GetRawText();
        }
        catch
        {
            return "{}";
        }
    }

    private static string? NormalizeJsonNullable(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.GetRawText();
        }
        catch
        {
            return null;
        }
    }

    private static string? NormalizeNullable(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : null;
    }

    private static CalendarGraphTemplateResponse BuildTemplateDaily()
    {
        var nodes = new List<CalendarGraphNodeResponse>
        {
            new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "trigger", "on_schedule", "{}", 0, 0),
            new(Guid.Parse("11111111-1111-1111-1111-111111111112"), "create_appointment", "create_next", "{\"titleMode\":\"same\"}", 260, 0)
        };
        var edges = new List<CalendarGraphEdgeResponse>
        {
            new(Guid.Parse("11111111-1111-1111-1111-111111111113"), nodes[0].NodeId, null, nodes[1].NodeId, null, "flow", null)
        };
        return new CalendarGraphTemplateResponse("daily", "Daily recurrence", "Creates the next occurrence every day.", "recurrence", "{\"interval\":1}", nodes, edges);
    }

    private static CalendarGraphTemplateResponse BuildTemplateWeekly()
    {
        var nodes = new List<CalendarGraphNodeResponse>
        {
            new(Guid.Parse("22222222-2222-2222-2222-222222222221"), "trigger", "on_schedule", "{}", 0, 0),
            new(Guid.Parse("22222222-2222-2222-2222-222222222222"), "create_appointment", "create_next", "{\"titleMode\":\"same\"}", 260, 0)
        };
        var edges = new List<CalendarGraphEdgeResponse>
        {
            new(Guid.Parse("22222222-2222-2222-2222-222222222223"), nodes[0].NodeId, null, nodes[1].NodeId, null, "flow", null)
        };
        return new CalendarGraphTemplateResponse("weekly", "Weekly recurrence", "Creates the next occurrence every week.", "recurrence", "{\"interval\":1}", nodes, edges);
    }

    private static CalendarGraphTemplateResponse BuildTemplateMonthly()
    {
        var nodes = new List<CalendarGraphNodeResponse>
        {
            new(Guid.Parse("33333333-3333-3333-3333-333333333331"), "trigger", "on_schedule", "{}", 0, 0),
            new(Guid.Parse("33333333-3333-3333-3333-333333333332"), "create_appointment", "create_next", "{\"titleMode\":\"same\"}", 260, 0)
        };
        var edges = new List<CalendarGraphEdgeResponse>
        {
            new(Guid.Parse("33333333-3333-3333-3333-333333333333"), nodes[0].NodeId, null, nodes[1].NodeId, null, "flow", null)
        };
        return new CalendarGraphTemplateResponse("monthly", "Monthly recurrence", "Creates the next occurrence every month.", "recurrence", "{\"interval\":1}", nodes, edges);
    }

    private static CalendarGraphTemplateResponse BuildTemplateTaskRecreate()
    {
        var nodes = new List<CalendarGraphNodeResponse>
        {
            new(Guid.Parse("44444444-4444-4444-4444-444444444441"), "trigger", "on_complete", "{}", 0, 0),
            new(Guid.Parse("44444444-4444-4444-4444-444444444442"), "delay", "wait", "{\"days\":14}", 220, 0),
            new(Guid.Parse("44444444-4444-4444-4444-444444444443"), "create_task", "recreate", "{\"title\":\"Recreated task\"}", 440, 0)
        };
        var edges = new List<CalendarGraphEdgeResponse>
        {
            new(Guid.Parse("44444444-4444-4444-4444-444444444444"), nodes[0].NodeId, null, nodes[1].NodeId, null, "flow", null),
            new(Guid.Parse("44444444-4444-4444-4444-444444444445"), nodes[1].NodeId, null, nodes[2].NodeId, null, "flow", null)
        };
        return new CalendarGraphTemplateResponse("task_recreate_after_completion", "Recreate task after completion", "Recreates the task after N days from completion.", "task", "{\"daysAfter\":14}", nodes, edges);
    }

    private static CalendarGraphTemplateResponse BuildTemplateFollowupAppointment()
    {
        var nodes = new List<CalendarGraphNodeResponse>
        {
            new(Guid.Parse("55555555-5555-5555-5555-555555555551"), "trigger", "on_complete", "{}", 0, 0),
            new(Guid.Parse("55555555-5555-5555-5555-555555555552"), "create_appointment", "follow_up", "{\"title\":\"Follow-up\",\"durationMinutes\":60}", 260, 0)
        };
        var edges = new List<CalendarGraphEdgeResponse>
        {
            new(Guid.Parse("55555555-5555-5555-5555-555555555553"), nodes[0].NodeId, null, nodes[1].NodeId, null, "flow", null)
        };
        return new CalendarGraphTemplateResponse("follow_up_appointment_after_completion", "Follow-up appointment", "Creates a follow-up appointment after completion.", "followup", "{\"daysAfter\":1,\"durationMinutes\":60}", nodes, edges);
    }

    private static CalendarGraphTemplateResponse BuildTemplateChecklistFollowup()
    {
        var nodes = new List<CalendarGraphNodeResponse>
        {
            new(Guid.Parse("66666666-6666-6666-6666-666666666661"), "trigger", "on_complete", "{}", 0, 0),
            new(Guid.Parse("66666666-6666-6666-6666-666666666662"), "create_task", "checklist", "{\"title\":\"Checklist follow-up\",\"durationMinutes\":30}", 260, 0)
        };
        var edges = new List<CalendarGraphEdgeResponse>
        {
            new(Guid.Parse("66666666-6666-6666-6666-666666666663"), nodes[0].NodeId, null, nodes[1].NodeId, null, "flow", null)
        };
        return new CalendarGraphTemplateResponse("chained_checklist_followup_task", "Checklist follow-up", "Creates a follow-up checklist task chain.", "task", "{\"daysAfter\":1}", nodes, edges);
    }

    private sealed record CalendarItemCreationAction(
        string ItemType,
        string Title,
        string? Summary,
        DateTimeOffset StartUtc,
        DateTimeOffset EndUtc,
        string Status,
        string? TaskState,
        int? TaskProgressPercent);
}
