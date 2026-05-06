using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;
using Recreatio.Api.Endpoints;

namespace Recreatio.Api.Endpoints.Cg;

public static class CgEndpoints
{
    public static void MapCgEndpoints(this WebApplication app)
    {
        MapCgGroup(app.MapGroup("/cg").RequireAuthorization());
    }

    private static void MapCgGroup(RouteGroupBuilder group)
    {
        // ── Libraries ───────────────────────────────────────────────────────────

        group.MapGet("/libraries", async (HttpContext context, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId)) return Results.Forbid();

            var libs = await db.CgLibraries
                .AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderByDescending(x => x.UpdatedUtc)
                .ToListAsync(ct);
            return Results.Ok(libs);
        });

        group.MapPost("/libraries", async (HttpContext context, RecreatioDbContext db, CreateLibraryRequest req, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId)) return Results.Forbid();

            var name = (req.Name ?? string.Empty).Trim();
            if (name.Length == 0) return Results.BadRequest(new { error = "name is required" });

            var template = req.Template?.Trim().ToLowerInvariant() ?? "custom";
            var allowed = new[] { "vocabulary", "phonebook", "lesson", "custom" };
            if (!Array.Exists(allowed, t => t == template)) template = "custom";

            var now = DateTimeOffset.UtcNow;
            var lib = new Data.Cg.CgLibrary
            {
                Id = Guid.NewGuid(),
                OwnerAccountId = userId,
                Name = name,
                Template = template,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.CgLibraries.Add(lib);

            await SeedTemplateAsync(db, lib, now, ct);
            await db.SaveChangesAsync(ct);
            return Results.Ok(lib);
        });

        group.MapGet("/libraries/{libId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId)) return Results.Forbid();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId && x.OwnerAccountId == userId, ct);
            if (lib is null) return Results.NotFound();

            var kinds = await db.CgNodeKinds.AsNoTracking().Where(x => x.LibraryId == libId).OrderBy(x => x.SortOrder).ToListAsync(ct);
            var kindIds = kinds.Select(k => k.Id).ToList();
            var fields = await db.CgFieldDefs.AsNoTracking().Where(x => kindIds.Contains(x.NodeKindId)).OrderBy(x => x.SortOrder).ToListAsync(ct);
            var nodeCount = await db.CgNodes.AsNoTracking().CountAsync(x => x.LibraryId == libId, ct);

            return Results.Ok(new { library = lib, nodeKinds = kinds, fieldDefs = fields, nodeCount });
        });

        group.MapPut("/libraries/{libId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, UpdateLibraryRequest req, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId)) return Results.Forbid();
            var lib = await db.CgLibraries.FirstOrDefaultAsync(x => x.Id == libId && x.OwnerAccountId == userId, ct);
            if (lib is null) return Results.NotFound();

            var name = (req.Name ?? string.Empty).Trim();
            if (name.Length > 0) lib.Name = name;
            lib.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(lib);
        });

        group.MapDelete("/libraries/{libId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId)) return Results.Forbid();
            var lib = await db.CgLibraries.FirstOrDefaultAsync(x => x.Id == libId && x.OwnerAccountId == userId, ct);
            if (lib is null) return Results.NotFound();

            db.CgLibraries.Remove(lib);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        // ── Node Kinds ───────────────────────────────────────────────────────────

        group.MapGet("/libraries/{libId:guid}/node-kinds", async (HttpContext context, RecreatioDbContext db, Guid libId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var kinds = await db.CgNodeKinds.AsNoTracking()
                .Where(x => x.LibraryId == libId)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);
            return Results.Ok(kinds);
        });

        group.MapPost("/libraries/{libId:guid}/node-kinds", async (HttpContext context, RecreatioDbContext db, Guid libId, UpsertNodeKindRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var name = (req.Name ?? string.Empty).Trim();
            if (name.Length == 0) return Results.BadRequest(new { error = "name is required" });

            var now = DateTimeOffset.UtcNow;
            var kind = new Data.Cg.CgNodeKind
            {
                Id = Guid.NewGuid(),
                LibraryId = libId,
                Name = name,
                IsSubentity = req.IsSubentity,
                SortOrder = req.SortOrder,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.CgNodeKinds.Add(kind);
            await db.SaveChangesAsync(ct);
            return Results.Ok(kind);
        });

        group.MapPut("/libraries/{libId:guid}/node-kinds/{kindId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid kindId, UpsertNodeKindRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var kind = await db.CgNodeKinds.FirstOrDefaultAsync(x => x.Id == kindId && x.LibraryId == libId, ct);
            if (kind is null) return Results.NotFound();

            var name = (req.Name ?? string.Empty).Trim();
            if (name.Length > 0) kind.Name = name;
            kind.IsSubentity = req.IsSubentity;
            kind.SortOrder = req.SortOrder;
            kind.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(kind);
        });

        group.MapDelete("/libraries/{libId:guid}/node-kinds/{kindId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid kindId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var kind = await db.CgNodeKinds.FirstOrDefaultAsync(x => x.Id == kindId && x.LibraryId == libId, ct);
            if (kind is null) return Results.NotFound();

            db.CgNodeKinds.Remove(kind);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        // ── Field Defs ───────────────────────────────────────────────────────────

        group.MapGet("/libraries/{libId:guid}/node-kinds/{kindId:guid}/field-defs", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid kindId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var defs = await db.CgFieldDefs.AsNoTracking()
                .Where(x => x.NodeKindId == kindId && x.LibraryId == libId)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);
            return Results.Ok(defs);
        });

        group.MapPost("/libraries/{libId:guid}/node-kinds/{kindId:guid}/field-defs", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid kindId, UpsertFieldDefRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var fieldName = (req.FieldName ?? string.Empty).Trim();
            if (fieldName.Length == 0) return Results.BadRequest(new { error = "fieldName is required" });

            var validTypes = new[] { "Text", "Number", "Date", "Boolean", "Media", "Ref" };
            var fieldType = req.FieldType?.Trim() ?? "Text";
            if (!Array.Exists(validTypes, t => t == fieldType)) fieldType = "Text";

            var def = new Data.Cg.CgFieldDef
            {
                Id = Guid.NewGuid(),
                NodeKindId = kindId,
                LibraryId = libId,
                FieldName = fieldName,
                FieldType = fieldType,
                RefNodeKindId = req.RefNodeKindId,
                IsMultiValue = req.IsMultiValue,
                IsRangeCapable = req.IsRangeCapable,
                SortOrder = req.SortOrder,
                CreatedUtc = DateTimeOffset.UtcNow
            };
            db.CgFieldDefs.Add(def);
            await db.SaveChangesAsync(ct);
            return Results.Ok(def);
        });

        group.MapPut("/libraries/{libId:guid}/node-kinds/{kindId:guid}/field-defs/{defId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid kindId, Guid defId, UpsertFieldDefRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var def = await db.CgFieldDefs.FirstOrDefaultAsync(x => x.Id == defId && x.NodeKindId == kindId, ct);
            if (def is null) return Results.NotFound();

            var fieldName = (req.FieldName ?? string.Empty).Trim();
            if (fieldName.Length > 0) def.FieldName = fieldName;
            def.SortOrder = req.SortOrder;
            def.IsMultiValue = req.IsMultiValue;
            def.IsRangeCapable = req.IsRangeCapable;
            await db.SaveChangesAsync(ct);
            return Results.Ok(def);
        });

        group.MapDelete("/libraries/{libId:guid}/node-kinds/{kindId:guid}/field-defs/{defId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid kindId, Guid defId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var def = await db.CgFieldDefs.FirstOrDefaultAsync(x => x.Id == defId && x.NodeKindId == kindId, ct);
            if (def is null) return Results.NotFound();

            db.CgFieldDefs.Remove(def);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        // ── Nodes ────────────────────────────────────────────────────────────────

        group.MapGet("/libraries/{libId:guid}/nodes", async (
            HttpContext context, RecreatioDbContext db, Guid libId,
            string? q, string? nodeType, Guid? kindId, int? limit, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var take = Math.Clamp(limit ?? 200, 1, 2000);
            var query = db.CgNodes.AsNoTracking().Where(x => x.LibraryId == libId);

            if (!string.IsNullOrWhiteSpace(nodeType)) query = query.Where(x => x.NodeType == nodeType);
            if (kindId.HasValue) query = query.Where(x => x.NodeKindId == kindId.Value);
            if (!string.IsNullOrWhiteSpace(q)) query = query.Where(x => x.Label != null && x.Label.Contains(q));

            var nodes = await query.OrderByDescending(x => x.UpdatedUtc).Take(take).ToListAsync(ct);
            return Results.Ok(nodes);
        });

        group.MapPost("/libraries/{libId:guid}/nodes", async (HttpContext context, RecreatioDbContext db, Guid libId, CreateNodeRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var now = DateTimeOffset.UtcNow;
            var node = new Data.Cg.CgNode
            {
                Id = Guid.NewGuid(),
                LibraryId = libId,
                NodeType = req.NodeType?.Trim() ?? "Entity",
                NodeKindId = req.NodeKindId,
                ParentNodeId = req.ParentNodeId,
                Label = req.Label?.Trim(),
                BodyJson = req.BodyJson,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.CgNodes.Add(node);
            await db.SaveChangesAsync(ct);
            return Results.Ok(node);
        });

        group.MapGet("/libraries/{libId:guid}/nodes/{nodeId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid nodeId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var node = await db.CgNodes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == nodeId && x.LibraryId == libId, ct);
            if (node is null) return Results.NotFound();

            var values = await db.CgFieldValues.AsNoTracking().Where(x => x.NodeId == nodeId).OrderBy(x => x.SortOrder).ToListAsync(ct);
            var outEdges = await db.CgEdges.AsNoTracking().Where(x => x.SourceNodeId == nodeId).ToListAsync(ct);
            var inEdges = await db.CgEdges.AsNoTracking().Where(x => x.TargetNodeId == nodeId).ToListAsync(ct);

            return Results.Ok(new { node, fieldValues = values, outEdges, inEdges });
        });

        group.MapPut("/libraries/{libId:guid}/nodes/{nodeId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid nodeId, UpdateNodeRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var node = await db.CgNodes.FirstOrDefaultAsync(x => x.Id == nodeId && x.LibraryId == libId, ct);
            if (node is null) return Results.NotFound();

            if (req.Label is not null) node.Label = req.Label.Trim();
            if (req.BodyJson is not null) node.BodyJson = req.BodyJson;
            node.UpdatedUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(node);
        });

        group.MapDelete("/libraries/{libId:guid}/nodes/{nodeId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid nodeId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var node = await db.CgNodes.FirstOrDefaultAsync(x => x.Id == nodeId && x.LibraryId == libId, ct);
            if (node is null) return Results.NotFound();

            db.CgNodes.Remove(node);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        // ── Field Values ─────────────────────────────────────────────────────────

        group.MapPost("/libraries/{libId:guid}/nodes/{nodeId:guid}/field-values", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid nodeId, UpsertFieldValueRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var node = await db.CgNodes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == nodeId && x.LibraryId == libId, ct);
            if (node is null) return Results.NotFound();

            var now = DateTimeOffset.UtcNow;

            // For single-value fields, upsert: delete existing then insert fresh.
            var existing = await db.CgFieldValues
                .Where(x => x.NodeId == nodeId && x.FieldDefId == req.FieldDefId && x.SortOrder == req.SortOrder)
                .FirstOrDefaultAsync(ct);

            if (existing is not null)
            {
                existing.TextValue = req.TextValue;
                existing.NumberValue = req.NumberValue;
                existing.DateValue = req.DateValue;
                existing.BoolValue = req.BoolValue;
                existing.RefNodeId = req.RefNodeId;
                existing.PvState = req.PvState;
                existing.PvNote = req.PvNote;
            }
            else
            {
                var fv = new Data.Cg.CgFieldValue
                {
                    Id = Guid.NewGuid(),
                    NodeId = nodeId,
                    FieldDefId = req.FieldDefId,
                    TextValue = req.TextValue,
                    NumberValue = req.NumberValue,
                    DateValue = req.DateValue,
                    BoolValue = req.BoolValue,
                    RefNodeId = req.RefNodeId,
                    PvState = req.PvState,
                    PvNote = req.PvNote,
                    SortOrder = req.SortOrder,
                    CreatedUtc = now
                };
                db.CgFieldValues.Add(fv);
            }

            await db.SaveChangesAsync(ct);

            var values = await db.CgFieldValues.AsNoTracking().Where(x => x.NodeId == nodeId).OrderBy(x => x.SortOrder).ToListAsync(ct);
            return Results.Ok(values);
        });

        group.MapDelete("/libraries/{libId:guid}/nodes/{nodeId:guid}/field-values/{valueId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid nodeId, Guid valueId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var fv = await db.CgFieldValues.FirstOrDefaultAsync(x => x.Id == valueId && x.NodeId == nodeId, ct);
            if (fv is null) return Results.NotFound();

            db.CgFieldValues.Remove(fv);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });

        // ── Edges ────────────────────────────────────────────────────────────────

        group.MapGet("/libraries/{libId:guid}/edges", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid? sourceNodeId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var query = db.CgEdges.AsNoTracking().Where(x => x.LibraryId == libId);
            if (sourceNodeId.HasValue) query = query.Where(x => x.SourceNodeId == sourceNodeId.Value);

            var edges = await query.OrderBy(x => x.SortOrder).Take(2000).ToListAsync(ct);
            return Results.Ok(edges);
        });

        group.MapPost("/libraries/{libId:guid}/edges", async (HttpContext context, RecreatioDbContext db, Guid libId, CreateEdgeRequest req, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var edge = new Data.Cg.CgEdge
            {
                Id = Guid.NewGuid(),
                LibraryId = libId,
                EdgeKindId = req.EdgeKindId,
                SourceNodeId = req.SourceNodeId,
                TargetNodeId = req.TargetNodeId,
                PvState = req.PvState,
                PvNote = req.PvNote,
                SortOrder = req.SortOrder,
                CreatedUtc = DateTimeOffset.UtcNow
            };
            db.CgEdges.Add(edge);
            await db.SaveChangesAsync(ct);
            return Results.Ok(edge);
        });

        group.MapDelete("/libraries/{libId:guid}/edges/{edgeId:guid}", async (HttpContext context, RecreatioDbContext db, Guid libId, Guid edgeId, CancellationToken ct) =>
        {
            if (!await HasAccessAsync(context, db, libId, ct)) return Results.Forbid();

            var edge = await db.CgEdges.FirstOrDefaultAsync(x => x.Id == edgeId && x.LibraryId == libId, ct);
            if (edge is null) return Results.NotFound();

            db.CgEdges.Remove(edge);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { deleted = true });
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private static async Task<bool> HasAccessAsync(HttpContext context, RecreatioDbContext db, Guid libId, CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId)) return false;
        return await db.CgLibraries.AsNoTracking().AnyAsync(x => x.Id == libId && x.OwnerAccountId == userId, ct);
    }

    private static Task SeedTemplateAsync(RecreatioDbContext db, Data.Cg.CgLibrary lib, DateTimeOffset now, CancellationToken ct)
    {
        var kindId = Guid.NewGuid();
        var kinds = new List<Data.Cg.CgNodeKind>();
        var defs = new List<Data.Cg.CgFieldDef>();

        switch (lib.Template)
        {
            case "vocabulary":
            {
                var kind = new Data.Cg.CgNodeKind { Id = kindId, LibraryId = lib.Id, Name = "WordPair", SortOrder = 0, CreatedUtc = now, UpdatedUtc = now };
                kinds.Add(kind);
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Source", FieldType = "Text", SortOrder = 0, CreatedUtc = now });
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Translation", FieldType = "Text", SortOrder = 1, CreatedUtc = now });
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Notes", FieldType = "Text", IsMultiValue = false, SortOrder = 2, CreatedUtc = now });
                break;
            }
            case "phonebook":
            {
                var kind = new Data.Cg.CgNodeKind { Id = kindId, LibraryId = lib.Id, Name = "Contact", SortOrder = 0, CreatedUtc = now, UpdatedUtc = now };
                kinds.Add(kind);
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Name", FieldType = "Text", SortOrder = 0, CreatedUtc = now });
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Phone", FieldType = "Text", IsMultiValue = true, SortOrder = 1, CreatedUtc = now });
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Email", FieldType = "Text", IsMultiValue = true, SortOrder = 2, CreatedUtc = now });
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Address", FieldType = "Text", SortOrder = 3, CreatedUtc = now });
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Notes", FieldType = "Text", SortOrder = 4, CreatedUtc = now });
                break;
            }
            case "lesson":
            {
                var conceptKind = new Data.Cg.CgNodeKind { Id = kindId, LibraryId = lib.Id, Name = "Concept", SortOrder = 0, CreatedUtc = now, UpdatedUtc = now };
                kinds.Add(conceptKind);
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Statement", FieldType = "Text", SortOrder = 0, CreatedUtc = now });
                defs.Add(new Data.Cg.CgFieldDef { Id = Guid.NewGuid(), NodeKindId = kindId, LibraryId = lib.Id, FieldName = "Example", FieldType = "Text", SortOrder = 1, CreatedUtc = now });
                break;
            }
        }

        if (kinds.Count > 0) db.CgNodeKinds.AddRange(kinds);
        if (defs.Count > 0) db.CgFieldDefs.AddRange(defs);
        return Task.CompletedTask;
    }

    // ── Request records ──────────────────────────────────────────────────────────

    public sealed record CreateLibraryRequest(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("template")] string? Template);

    public sealed record UpdateLibraryRequest(
        [property: JsonPropertyName("name")] string? Name);

    public sealed record UpsertNodeKindRequest(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("isSubentity")] bool IsSubentity,
        [property: JsonPropertyName("sortOrder")] int SortOrder);

    public sealed record UpsertFieldDefRequest(
        [property: JsonPropertyName("fieldName")] string? FieldName,
        [property: JsonPropertyName("fieldType")] string? FieldType,
        [property: JsonPropertyName("refNodeKindId")] Guid? RefNodeKindId,
        [property: JsonPropertyName("isMultiValue")] bool IsMultiValue,
        [property: JsonPropertyName("isRangeCapable")] bool IsRangeCapable,
        [property: JsonPropertyName("sortOrder")] int SortOrder);

    public sealed record CreateNodeRequest(
        [property: JsonPropertyName("nodeType")] string? NodeType,
        [property: JsonPropertyName("nodeKindId")] Guid? NodeKindId,
        [property: JsonPropertyName("parentNodeId")] Guid? ParentNodeId,
        [property: JsonPropertyName("label")] string? Label,
        [property: JsonPropertyName("bodyJson")] string? BodyJson);

    public sealed record UpdateNodeRequest(
        [property: JsonPropertyName("label")] string? Label,
        [property: JsonPropertyName("bodyJson")] string? BodyJson);

    public sealed record UpsertFieldValueRequest(
        [property: JsonPropertyName("fieldDefId")] Guid FieldDefId,
        [property: JsonPropertyName("textValue")] string? TextValue,
        [property: JsonPropertyName("numberValue")] double? NumberValue,
        [property: JsonPropertyName("dateValue")] string? DateValue,
        [property: JsonPropertyName("boolValue")] bool? BoolValue,
        [property: JsonPropertyName("refNodeId")] Guid? RefNodeId,
        [property: JsonPropertyName("pvState")] string? PvState,
        [property: JsonPropertyName("pvNote")] string? PvNote,
        [property: JsonPropertyName("sortOrder")] int SortOrder);

    public sealed record CreateEdgeRequest(
        [property: JsonPropertyName("edgeKindId")] Guid? EdgeKindId,
        [property: JsonPropertyName("sourceNodeId")] Guid SourceNodeId,
        [property: JsonPropertyName("targetNodeId")] Guid TargetNodeId,
        [property: JsonPropertyName("pvState")] string? PvState,
        [property: JsonPropertyName("pvNote")] string? PvNote,
        [property: JsonPropertyName("sortOrder")] int SortOrder);
}
