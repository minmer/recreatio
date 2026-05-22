using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Cg;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cg;

namespace Recreatio.Api.Endpoints.Cg;

public static class CgTemplateEndpoints
{
    private static string DecryptValue(string cipher) =>
        Encoding.UTF8.GetString(Convert.FromBase64String(cipher));

    public static void MapCgTemplateEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/cg");

        // ── List templates for a type ─────────────────────────────────────────

        group.MapGet("/libraries/{libId:long}/types/{typeId:long}/templates",
            async (long libId, long typeId, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
            {
                if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                    return Results.Unauthorized();

                if (!await OwnedLibrary(libId, typeId, userId, db, ct))
                    return Results.NotFound();

                var graphs = await db.CgTemplateGraphs
                    .AsNoTracking()
                    .Where(g => g.TypeDefId == typeId)
                    .OrderBy(g => g.Name)
                    .ToListAsync(ct);

                var graphIds = graphs.Select(g => g.Id).ToList();
                var nodeCounts = await db.CgTemplateNodes
                    .AsNoTracking()
                    .Where(n => graphIds.Contains(n.GraphId))
                    .GroupBy(n => n.GraphId)
                    .Select(g => new { GraphId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.GraphId, x => x.Count, ct);

                return Results.Ok(graphs.Select(g => new CgTemplateListItem(
                    g.Id, g.Name,
                    nodeCounts.GetValueOrDefault(g.Id),
                    new DateTimeOffset(g.CreatedUtc, TimeSpan.Zero),
                    new DateTimeOffset(g.UpdatedUtc, TimeSpan.Zero)
                )));
            });

        // ── Create empty template ─────────────────────────────────────────────

        group.MapPost("/libraries/{libId:long}/types/{typeId:long}/templates",
            async (long libId, long typeId, CgTemplateCreateRequest req, HttpContext ctx,
                RecreatioDbContext db, CancellationToken ct) =>
            {
                if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                    return Results.Unauthorized();

                if (!await OwnedLibrary(libId, typeId, userId, db, ct))
                    return Results.NotFound();

                var name = req.Name?.Trim() ?? "";
                if (name.Length == 0)
                    return Results.BadRequest(new { error = "Name is required." });
                if (name.Length > 200)
                    return Results.BadRequest(new { error = "Name must be 200 characters or fewer." });

                var now = DateTime.UtcNow;
                var graph = new CgTemplateGraph
                {
                    TypeDefId = typeId,
                    Name = name,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                db.CgTemplateGraphs.Add(graph);
                await db.SaveChangesAsync(ct);

                return Results.Ok(new CgTemplateListItem(
                    graph.Id, graph.Name, 0,
                    new DateTimeOffset(graph.CreatedUtc, TimeSpan.Zero),
                    new DateTimeOffset(graph.UpdatedUtc, TimeSpan.Zero)
                ));
            });

        // ── Get template graph ────────────────────────────────────────────────

        group.MapGet("/libraries/{libId:long}/types/{typeId:long}/templates/{graphId:long}",
            async (long libId, long typeId, long graphId, HttpContext ctx,
                RecreatioDbContext db, CancellationToken ct) =>
            {
                if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                    return Results.Unauthorized();

                if (!await OwnedLibrary(libId, typeId, userId, db, ct))
                    return Results.NotFound();

                var graph = await db.CgTemplateGraphs.AsNoTracking()
                    .FirstOrDefaultAsync(g => g.Id == graphId && g.TypeDefId == typeId, ct);
                if (graph is null)
                    return Results.NotFound();

                var nodes = await db.CgTemplateNodes.AsNoTracking()
                    .Where(n => n.GraphId == graphId)
                    .ToListAsync(ct);

                var edges = await db.CgTemplateEdges.AsNoTracking()
                    .Where(e => e.GraphId == graphId)
                    .ToListAsync(ct);

                return Results.Ok(new CgTemplateGraphResponse(
                    graph.Id, graph.Name,
                    nodes.Select(n => new CgTemplateNodeResponse(
                        n.Id, n.NodeKey, n.NodeType, n.ConfigJson, n.PositionX, n.PositionY
                    )).ToList(),
                    edges.Select(e => new CgTemplateEdgeResponse(
                        e.Id, e.EdgeKey, e.SourceKey, e.TargetKey, e.SourceHandle, e.TargetHandle
                    )).ToList(),
                    new DateTimeOffset(graph.CreatedUtc, TimeSpan.Zero),
                    new DateTimeOffset(graph.UpdatedUtc, TimeSpan.Zero)
                ));
            });

        // ── Save template graph (full replace) ────────────────────────────────

        group.MapPut("/libraries/{libId:long}/types/{typeId:long}/templates/{graphId:long}",
            async (long libId, long typeId, long graphId, CgTemplateSaveRequest req,
                HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
            {
                if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                    return Results.Unauthorized();

                if (!await OwnedLibrary(libId, typeId, userId, db, ct))
                    return Results.NotFound();

                var graph = await db.CgTemplateGraphs
                    .FirstOrDefaultAsync(g => g.Id == graphId && g.TypeDefId == typeId, ct);
                if (graph is null)
                    return Results.NotFound();

                var name = req.Name?.Trim() ?? "";
                if (name.Length == 0)
                    return Results.BadRequest(new { error = "Name is required." });

                graph.Name = name;
                graph.UpdatedUtc = DateTime.UtcNow;

                // Replace nodes
                var oldNodes = await db.CgTemplateNodes
                    .Where(n => n.GraphId == graphId)
                    .ToListAsync(ct);
                db.CgTemplateNodes.RemoveRange(oldNodes);

                foreach (var item in req.Nodes)
                {
                    db.CgTemplateNodes.Add(new CgTemplateNode
                    {
                        GraphId = graphId,
                        NodeKey = item.NodeKey,
                        NodeType = item.NodeType,
                        ConfigJson = item.ConfigJson ?? "{}",
                        PositionX = item.PositionX,
                        PositionY = item.PositionY
                    });
                }

                // Replace edges
                var oldEdges = await db.CgTemplateEdges
                    .Where(e => e.GraphId == graphId)
                    .ToListAsync(ct);
                db.CgTemplateEdges.RemoveRange(oldEdges);

                foreach (var item in req.Edges)
                {
                    db.CgTemplateEdges.Add(new CgTemplateEdge
                    {
                        GraphId = graphId,
                        EdgeKey = item.EdgeKey,
                        SourceKey = item.SourceKey,
                        TargetKey = item.TargetKey,
                        SourceHandle = item.SourceHandle,
                        TargetHandle = item.TargetHandle
                    });
                }

                await db.SaveChangesAsync(ct);
                return Results.NoContent();
            });

        // ── Delete template ───────────────────────────────────────────────────

        group.MapDelete("/libraries/{libId:long}/types/{typeId:long}/templates/{graphId:long}",
            async (long libId, long typeId, long graphId, HttpContext ctx,
                RecreatioDbContext db, CancellationToken ct) =>
            {
                if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                    return Results.Unauthorized();

                if (!await OwnedLibrary(libId, typeId, userId, db, ct))
                    return Results.NotFound();

                var graph = await db.CgTemplateGraphs
                    .FirstOrDefaultAsync(g => g.Id == graphId && g.TypeDefId == typeId, ct);
                if (graph is null)
                    return Results.NotFound();

                var nodes = await db.CgTemplateNodes.Where(n => n.GraphId == graphId).ToListAsync(ct);
                var edges = await db.CgTemplateEdges.Where(e => e.GraphId == graphId).ToListAsync(ct);
                db.CgTemplateNodes.RemoveRange(nodes);
                db.CgTemplateEdges.RemoveRange(edges);
                db.CgTemplateGraphs.Remove(graph);
                await db.SaveChangesAsync(ct);

                return Results.NoContent();
            });

        // ── Generate quiz question from template + entity ─────────────────────

        group.MapPost("/libraries/{libId:long}/types/{typeId:long}/templates/{graphId:long}/quiz",
            async (long libId, long typeId, long graphId, CgQuizRequest req,
                HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
            {
                if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                    return Results.Unauthorized();

                if (!await OwnedLibrary(libId, typeId, userId, db, ct))
                    return Results.NotFound();

                var graph = await db.CgTemplateGraphs.AsNoTracking()
                    .FirstOrDefaultAsync(g => g.Id == graphId && g.TypeDefId == typeId, ct);
                if (graph is null)
                    return Results.NotFound();

                var entity = await db.CgEntities.AsNoTracking()
                    .FirstOrDefaultAsync(e => e.Id == req.EntityId && e.TypeDefId == typeId, ct);
                if (entity is null)
                    return Results.NotFound();

                var nodes = await db.CgTemplateNodes.AsNoTracking()
                    .Where(n => n.GraphId == graphId)
                    .ToListAsync(ct);
                var edges = await db.CgTemplateEdges.AsNoTracking()
                    .Where(e => e.GraphId == graphId)
                    .ToListAsync(ct);

                var question = await GenerateQuizQuestion(graph, nodes, edges, entity, db, ct);
                if (question is null)
                    return Results.BadRequest(new { error = "Template is incomplete — no answer node found." });

                return Results.Ok(question);
            });
    }

    // ── Quiz generation ───────────────────────────────────────────────────────

    private static async Task<CgQuizQuestion?> GenerateQuizQuestion(
        CgTemplateGraph graph,
        IReadOnlyList<CgTemplateNode> nodes,
        IReadOnlyList<CgTemplateEdge> edges,
        CgEntity entity,
        RecreatioDbContext db,
        CancellationToken ct)
    {
        var warnings = new List<string>();

        var fieldValues = await db.CgFieldValues.AsNoTracking()
            .Where(fv => fv.EntityId == entity.Id)
            .OrderBy(fv => fv.SortOrder)
            .ToListAsync(ct);

        // Compute outputs per node: nodeKey → handleName → string[]
        // Process nodes in topological order so every node sees its upstream outputs.
        var outputs = new Dictionary<string, Dictionary<string, List<string>>>();
        var nodeByKey = nodes.ToDictionary(n => n.NodeKey);

        foreach (var nodeKey in TopologicalSort(nodes, edges))
        {
            if (!nodeByKey.TryGetValue(nodeKey, out var node)) continue;

            switch (node.NodeType)
            {
                case "field":
                {
                    var cfg = ParseConfig<FieldNodeConfig>(node.ConfigJson);
                    if (cfg is null || cfg.FieldDefId == 0)
                    {
                        warnings.Add($"Field node '{node.NodeKey}' has no field selected — configure it in the config panel.");
                        break;
                    }
                    List<string> vals;
                    if (cfg.InputType == "reference")
                    {
                        vals = fieldValues
                            .Where(fv => fv.FieldDefId == cfg.FieldDefId && fv.RefEntityId.HasValue)
                            .OrderBy(fv => fv.SortOrder)
                            .Select(fv => fv.RefEntityId!.Value.ToString())
                            .ToList();
                        if (vals.Count == 0)
                            warnings.Add($"Field '{cfg.FieldLabel}': no referenced entities — connect this to an Entity Field node.");
                    }
                    else
                    {
                        vals = fieldValues
                            .Where(fv => fv.FieldDefId == cfg.FieldDefId && fv.EncryptedValue != null)
                            .OrderBy(fv => fv.SortOrder)
                            .Select(fv => DecryptValue(fv.EncryptedValue!))
                            .ToList();
                        if (vals.Count == 0)
                            warnings.Add($"Field '{cfg.FieldLabel}' produced no values — entity has no data for this field.");
                    }
                    outputs[node.NodeKey] = new() { ["value"] = vals };
                    break;
                }

                case "entity-field":
                {
                    var cfg = ParseConfig<EntityFieldNodeConfig>(node.ConfigJson);
                    if (cfg is null || cfg.TargetTypeDefId == 0)
                    {
                        warnings.Add($"Entity Field node has no type selected — configure it in the config panel.");
                        break;
                    }
                    var entityIdStrings = CollectInputs(node.NodeKey, "in", edges, outputs);
                    if (entityIdStrings.Count == 0)
                    {
                        var inboundEdges = edges.Where(e => e.TargetKey == node.NodeKey
                            && (e.TargetHandle == null || e.TargetHandle == "in")).ToList();
                        var hasAmbiguousEdge = inboundEdges.Any(e =>
                            e.SourceHandle == null
                            && outputs.TryGetValue(e.SourceKey, out var src)
                            && src.Count > 0
                            && !src.ContainsKey("value"));
                        warnings.Add(hasAmbiguousEdge
                            ? $"Entity Field node '{cfg.TargetTypeName}': the connecting edge has no source handle recorded — delete and re-draw it starting exactly from the coloured handle dot (e.g. 'chosen' or 'rest') on the source node."
                            : $"Entity Field node '{cfg.TargetTypeName}': no entity IDs on input — connect a reference-type Field node to its 'in' handle.");
                        break;
                    }
                    var entityIds = entityIdStrings
                        .Select(s => long.TryParse(s, out var id) ? id : 0L)
                        .Where(id => id > 0).Distinct().ToList();
                    if (cfg.TargetFieldDefId == 0)
                    {
                        var firstField = await db.CgFieldDefs.AsNoTracking()
                            .Where(f => f.TypeDefId == cfg.TargetTypeDefId)
                            .OrderBy(f => f.SortOrder)
                            .FirstOrDefaultAsync(ct);
                        if (firstField is null)
                        {
                            warnings.Add($"Entity Field node: type '{cfg.TargetTypeName}' has no fields.");
                            break;
                        }
                        cfg = cfg with { TargetFieldDefId = firstField.Id, TargetFieldLabel = firstField.Label };
                    }
                    var subValues = await db.CgFieldValues.AsNoTracking()
                        .Where(v => entityIds.Contains(v.EntityId)
                                 && v.FieldDefId == cfg.TargetFieldDefId
                                 && v.EncryptedValue != null)
                        .OrderBy(v => v.EntityId).ThenBy(v => v.SortOrder)
                        .ToListAsync(ct);
                    var resolvedVals = entityIds
                        .SelectMany(id => subValues.Where(v => v.EntityId == id)
                            .Select(v => DecryptValue(v.EncryptedValue!)))
                        .ToList();
                    if (resolvedVals.Count == 0)
                        warnings.Add($"Entity Field node '{cfg.TargetTypeName}.{cfg.TargetFieldLabel}': entities have no value for this field.");
                    outputs[node.NodeKey] = new() { ["value"] = resolvedVals };
                    break;
                }

                case "distractor":
                {
                    var cfg = ParseConfig<DistractorNodeConfig>(node.ConfigJson);
                    if (cfg is null || cfg.FieldDefId == 0) break;
                    var count = Math.Max(1, cfg.Count);
                    var otherIds = await db.CgEntities.AsNoTracking()
                        .Where(e => e.TypeDefId == entity.TypeDefId && e.Id != entity.Id)
                        .Select(e => e.Id).ToListAsync(ct);
                    var shuffled = otherIds.OrderBy(_ => Guid.NewGuid()).Take(count * 2).ToList();
                    var distractorFvs = await db.CgFieldValues.AsNoTracking()
                        .Where(fv => shuffled.Contains(fv.EntityId)
                                  && fv.FieldDefId == cfg.FieldDefId
                                  && fv.SortOrder == 0)
                        .ToListAsync(ct);
                    List<string> distractors;
                    if (distractorFvs.Any(fv => fv.RefEntityId.HasValue))
                    {
                        var refIds = shuffled
                            .Select(id => distractorFvs.FirstOrDefault(fv => fv.EntityId == id)?.RefEntityId)
                            .Where(r => r.HasValue).Select(r => r!.Value).Take(count).ToList();
                        var refEntities = await db.CgEntities.AsNoTracking()
                            .Where(e => refIds.Contains(e.Id))
                            .Select(e => new { e.Id, e.TypeDefId }).ToListAsync(ct);
                        var refTypeIds = refEntities.Select(e => e.TypeDefId).Distinct().ToList();
                        var firstFields = await db.CgFieldDefs.AsNoTracking()
                            .Where(f => refTypeIds.Contains(f.TypeDefId))
                            .OrderBy(f => f.SortOrder).ToListAsync(ct);
                        var firstFieldByType = firstFields.GroupBy(f => f.TypeDefId)
                            .ToDictionary(g => g.Key, g => g.First());
                        var firstFieldIds = firstFieldByType.Values.Select(f => f.Id).ToHashSet();
                        var refFieldValues = await db.CgFieldValues.AsNoTracking()
                            .Where(v => refIds.Contains(v.EntityId)
                                     && firstFieldIds.Contains(v.FieldDefId)
                                     && v.EncryptedValue != null)
                            .ToListAsync(ct);
                        var displayByRef = refFieldValues.GroupBy(v => v.EntityId)
                            .ToDictionary(g => g.Key,
                                g => DecryptValue(g.OrderBy(v => v.SortOrder).First().EncryptedValue!));
                        distractors = refIds
                            .Select(id => displayByRef.TryGetValue(id, out var d) ? d : null)
                            .Where(d => d is not null).Select(d => d!).ToList();
                    }
                    else
                    {
                        distractors = shuffled
                            .Select(id => distractorFvs.FirstOrDefault(fv => fv.EntityId == id))
                            .Where(fv => fv?.EncryptedValue != null)
                            .Select(fv => DecryptValue(fv!.EncryptedValue!))
                            .Take(count).ToList();
                    }
                    outputs[node.NodeKey] = new() { ["distractor"] = distractors };
                    break;
                }

                case "pick":
                {
                    var items = CollectInputs(node.NodeKey, "items", edges, outputs);
                    if (items.Count == 0)
                    {
                        warnings.Add($"Pick node has no input — connect a Field node's output to its 'items' handle. Make sure the field is 'multiple'.");
                        break;
                    }
                    if (items.Count == 1)
                    {
                        warnings.Add($"Pick node received only 1 value ('{items[0]}') — it needs ≥2 values to hide one and show the rest. Use a 'multiple' field or add more values to the entity.");
                        break;
                    }
                    var cfg = ParseConfig<PickNodeConfig>(node.ConfigJson);
                    var pos = cfg?.Position ?? "random";
                    var idx = pos switch
                    {
                        "first" => 0,
                        "last"  => items.Count - 1,
                        _       => Random.Shared.Next(items.Count)
                    };
                    outputs[node.NodeKey] = new()
                    {
                        ["chosen"] = new List<string> { items[idx] },
                        ["rest"]   = items.Where((_, i) => i != idx).ToList()
                    };
                    break;
                }

                case "mask":
                {
                    var textInput = CollectInputs(node.NodeKey, "text", edges, outputs);
                    if (textInput.Count == 0) break;
                    var cfg = ParseConfig<MaskNodeConfig>(node.ConfigJson);
                    var text = textInput[0];
                    var masked = ApplyMask(text, cfg?.Strategy ?? "suffix", cfg?.KeepPct ?? 30);
                    outputs[node.NodeKey] = new()
                    {
                        ["masked"] = new List<string> { masked },
                        ["full"]   = new List<string> { text }
                    };
                    break;
                }

                case "text-concat":
                {
                    var cfg = ParseConfig<TextConcatNodeConfig>(node.ConfigJson);
                    if (cfg is null) break;
                    var template = cfg.Template ?? string.Empty;
                    var sep = cfg.ArraySeparator ?? ", ";
                    var count = Math.Max(1, cfg.InputCount);
                    for (var i = 0; i < count; i++)
                    {
                        var vals = CollectInputs(node.NodeKey, i.ToString(), edges, outputs);
                        template = template.Replace($"{{{i}}}", string.Join(sep, vals));
                    }
                    outputs[node.NodeKey] = new() { ["value"] = [template] };
                    break;
                }
            }
        }

        var stimulus = new List<CgQuizStimulus>();
        foreach (var node in nodes.Where(n => n.NodeType == "prompt"))
        {
            var cfg = ParseConfig<PromptNodeConfig>(node.ConfigJson);
            var content = CollectInputs(node.NodeKey, "content", edges, outputs);
            if (content.Count > 0)
                stimulus.Add(new CgQuizStimulus(cfg?.Label ?? "Prompt", content));
            else
                warnings.Add($"Prompt node '{cfg?.Label ?? node.NodeKey}' received no content — check that its incoming edge's source node produced output.");
        }

        foreach (var node in nodes.Where(n => n.NodeType.StartsWith("answer-")))
        {
            var expected    = CollectInputs(node.NodeKey, "expected",   edges, outputs);
            var distractors = CollectInputs(node.NodeKey, "distractor", edges, outputs);
            var items       = CollectInputs(node.NodeKey, "items",      edges, outputs);

            if (node.NodeType == "answer-order")
                expected = items;

            var answerType = node.NodeType switch
            {
                "answer-text"   => "text",
                "answer-select" => "select",
                "answer-order"  => "order",
                "answer-bool"   => "bool",
                _ => "text"
            };

            return new CgQuizQuestion(
                graph.Id, graph.Name,
                entity.Id,
                stimulus,
                answerType,
                node.ConfigJson,
                expected,
                distractors,
                warnings
            );
        }

        return null;
    }

    private static List<string> TopologicalSort(
        IReadOnlyList<CgTemplateNode> nodes,
        IReadOnlyList<CgTemplateEdge> edges)
    {
        var allKeys = nodes.Select(n => n.NodeKey).ToHashSet();
        var inDegree = nodes.ToDictionary(n => n.NodeKey, _ => 0);
        var adjacency = nodes.ToDictionary(n => n.NodeKey, _ => new List<string>());

        foreach (var edge in edges.Where(e => allKeys.Contains(e.SourceKey) && allKeys.Contains(e.TargetKey)))
        {
            adjacency[edge.SourceKey].Add(edge.TargetKey);
            inDegree[edge.TargetKey]++;
        }

        var queue = new Queue<string>(nodes.Where(n => inDegree[n.NodeKey] == 0).Select(n => n.NodeKey));
        var result = new List<string>(nodes.Count);

        while (queue.Count > 0)
        {
            var key = queue.Dequeue();
            result.Add(key);
            foreach (var next in adjacency[key])
            {
                if (--inDegree[next] == 0)
                    queue.Enqueue(next);
            }
        }

        // Append any nodes not reached (disconnected or in a cycle) so they still get processed.
        var resultSet = result.ToHashSet();
        foreach (var n in nodes.Where(n => !resultSet.Contains(n.NodeKey)))
            result.Add(n.NodeKey);

        return result;
    }

    private static List<string> CollectInputs(
        string nodeKey,
        string targetHandle,
        IReadOnlyList<CgTemplateEdge> edges,
        Dictionary<string, Dictionary<string, List<string>>> outputs)
    {
        var result = new List<string>();
        foreach (var edge in edges.Where(e => e.TargetKey == nodeKey))
        {
            var edgeTarget = edge.TargetHandle;
            // Skip if an explicit target handle is set but doesn't match what we want.
            // A null target handle is treated as a wildcard (ReactFlow may omit the handle
            // ID for single-handle nodes even when the handle has an explicit id prop).
            if (edgeTarget != null && edgeTarget != targetHandle) continue;

            if (outputs.TryGetValue(edge.SourceKey, out var sourceOut))
            {
                if (edge.SourceHandle != null)
                {
                    // Named source handle — look it up directly.
                    if (sourceOut.TryGetValue(edge.SourceHandle, out var vals))
                        result.AddRange(vals);
                }
                else
                {
                    // No source handle recorded. Try "value" first (single-output convention).
                    // If the source has no "value" key but exactly one output, use that one as
                    // an unambiguous fallback.  Multiple outputs with no "value" → skip
                    // (the edge is ambiguous and the user must re-draw it from the handle dot).
                    if (sourceOut.TryGetValue("value", out var vVals))
                        result.AddRange(vVals);
                    else if (sourceOut.Count == 1)
                        result.AddRange(sourceOut.Values.First());
                }
            }
        }
        return result;
    }

    private static string ApplyMask(string text, string strategy, int keepPct)
    {
        if (string.IsNullOrEmpty(text)) return text;
        var keep = Math.Max(1, (int)(text.Length * keepPct / 100.0));
        return strategy switch
        {
            "prefix" => text[..keep] + new string('_', text.Length - keep),
            "suffix" => new string('_', text.Length - keep) + text[^keep..],
            _ => text[..keep] + "…"
        };
    }

    private static T? ParseConfig<T>(string json) where T : class
    {
        try { return JsonSerializer.Deserialize<T>(json, JsonOptions); }
        catch { return null; }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    // ── Ownership helper ──────────────────────────────────────────────────────

    private static async Task<bool> OwnedLibrary(
        long libId, long typeId, Guid userId,
        RecreatioDbContext db, CancellationToken ct)
    {
        var lib = await db.CgLibraries.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == libId && l.OwnerAccountId == userId, ct);
        if (lib is null) return false;

        var type = await db.CgTypeDefs.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == typeId && t.LibraryId == libId, ct);
        return type is not null;
    }

    // ── Config POCOs ──────────────────────────────────────────────────────────

    private sealed class FieldNodeConfig
    {
        public long FieldDefId { get; set; }
        public string FieldLabel { get; set; } = string.Empty;
        public string InputType { get; set; } = "text";
        public bool Multiple { get; set; }
    }

    private sealed class DistractorNodeConfig
    {
        public int Count { get; set; } = 3;
        public long FieldDefId { get; set; }
    }

    private sealed class MaskNodeConfig
    {
        public string Strategy { get; set; } = "suffix";
        public int KeepPct { get; set; } = 30;
    }

    private sealed class PromptNodeConfig
    {
        public string Label { get; set; } = "Prompt";
    }

    private sealed class PickNodeConfig
    {
        // "random" | "first" | "last"
        public string Position { get; set; } = "random";
    }

    private sealed class TextConcatNodeConfig
    {
        public string Template { get; set; } = "{0}";
        public int InputCount { get; set; } = 1;
        public string ArraySeparator { get; set; } = ", ";
    }

    private sealed record EntityFieldNodeConfig(
        long TargetTypeDefId,
        string TargetTypeName,
        long TargetFieldDefId,
        string TargetFieldLabel
    );
}
