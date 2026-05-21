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
        var fieldValues = await db.CgFieldValues.AsNoTracking()
            .Where(fv => fv.EntityId == entity.Id)
            .OrderBy(fv => fv.SortOrder)
            .ToListAsync(ct);

        // Compute outputs per node: nodeKey → handleName → string[]
        var outputs = new Dictionary<string, Dictionary<string, List<string>>>();

        // Pass 1: field nodes
        foreach (var node in nodes.Where(n => n.NodeType == "field"))
        {
            var cfg = ParseConfig<FieldNodeConfig>(node.ConfigJson);
            if (cfg is null) continue;

            var vals = fieldValues
                .Where(fv => fv.FieldDefId == cfg.FieldDefId && fv.EncryptedValue != null)
                .Select(fv => DecryptValue(fv.EncryptedValue!))
                .ToList();

            outputs[node.NodeKey] = new() { ["value"] = vals };
        }

        // Pass 2: distractor nodes
        foreach (var node in nodes.Where(n => n.NodeType == "distractor"))
        {
            var cfg = ParseConfig<DistractorNodeConfig>(node.ConfigJson);
            if (cfg is null) continue;

            var count = Math.Max(1, cfg.Count);
            var otherIds = await db.CgEntities.AsNoTracking()
                .Where(e => e.TypeDefId == entity.TypeDefId && e.Id != entity.Id)
                .Select(e => e.Id)
                .ToListAsync(ct);

            // Shuffle deterministically by hashing entityId + fieldDefId for reproducibility
            // For now use a simple random selection
            var shuffled = otherIds.OrderBy(_ => Guid.NewGuid()).Take(count * 2).ToList();

            var distractorValues = await db.CgFieldValues.AsNoTracking()
                .Where(fv => shuffled.Contains(fv.EntityId) && fv.FieldDefId == cfg.FieldDefId
                             && fv.EncryptedValue != null && fv.SortOrder == 0)
                .ToListAsync(ct);

            var distractors = shuffled
                .Select(id => distractorValues.FirstOrDefault(fv => fv.EntityId == id))
                .Where(fv => fv?.EncryptedValue != null)
                .Select(fv => DecryptValue(fv!.EncryptedValue!))
                .Take(count)
                .ToList();

            outputs[node.NodeKey] = new() { ["distractor"] = distractors };
        }

        // Pass 3: mask nodes
        foreach (var node in nodes.Where(n => n.NodeType == "mask"))
        {
            var textInput = CollectInputs(node.NodeKey, "text", edges, outputs);
            if (textInput.Count == 0) continue;

            var cfg = ParseConfig<MaskNodeConfig>(node.ConfigJson);
            var text = textInput[0];
            var masked = ApplyMask(text, cfg?.Strategy ?? "suffix", cfg?.KeepPct ?? 30);

            outputs[node.NodeKey] = new()
            {
                ["masked"] = new List<string> { masked },
                ["full"] = new List<string> { text }
            };
        }

        // Pass 4: propagate to prompt and answer nodes
        var stimulus = new List<CgQuizStimulus>();
        foreach (var node in nodes.Where(n => n.NodeType == "prompt"))
        {
            var cfg = ParseConfig<PromptNodeConfig>(node.ConfigJson);
            var content = CollectInputs(node.NodeKey, "content", edges, outputs);
            if (content.Count > 0)
                stimulus.Add(new CgQuizStimulus(cfg?.Label ?? "Prompt", content));
        }

        foreach (var node in nodes.Where(n => n.NodeType.StartsWith("answer-")))
        {
            var expected = CollectInputs(node.NodeKey, "expected", edges, outputs);
            var distractors = CollectInputs(node.NodeKey, "distractor", edges, outputs);
            var items = CollectInputs(node.NodeKey, "items", edges, outputs);

            if (node.NodeType == "answer-order")
                expected = items;

            var answerType = node.NodeType switch
            {
                "answer-text" => "text",
                "answer-select" => "select",
                "answer-order" => "order",
                "answer-bool" => "bool",
                _ => "text"
            };

            return new CgQuizQuestion(
                graph.Id, graph.Name,
                entity.Id,
                stimulus,
                answerType,
                node.ConfigJson,
                expected,
                distractors
            );
        }

        return null;
    }

    private static List<string> CollectInputs(
        string nodeKey,
        string targetHandle,
        IReadOnlyList<CgTemplateEdge> edges,
        Dictionary<string, Dictionary<string, List<string>>> outputs)
    {
        var result = new List<string>();
        foreach (var edge in edges.Where(e => e.TargetKey == nodeKey
            && (e.TargetHandle ?? "content") == targetHandle))
        {
            if (outputs.TryGetValue(edge.SourceKey, out var sourceOut))
            {
                var handle = edge.SourceHandle ?? "value";
                if (sourceOut.TryGetValue(handle, out var vals))
                    result.AddRange(vals);
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
}
