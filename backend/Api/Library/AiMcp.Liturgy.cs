using System.ComponentModel;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kernel;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

public sealed partial class AiMcpTools
{
    public sealed record LiturgyExportResult(string CollectionId, string Name, string SnapshotId, string? SnapshotMadeAt,
        bool SnapshotCurrent, string? ChangedAt, int Total, int Offset, int? NextOffset, bool Complete, JsonObject Document, string Note);

    private static string? CanonicalId(JsonElement value) => value.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String ? id.GetString() : null;

    /// <summary>Exact canonical data, separate from searchable text projections. No silent clipping.</summary>
    public static LiturgyExportResult LiturgyExport(AiAccess.Snapshot collection, int offset, int limit, string? snapshotId)
    {
        if (collection.Part != "liturgy") throw new McpException("wrong_collection: choose a collection with part liturgy from list_collections.");
        var resources = collection.Items.Where(i => i.Kind.StartsWith("lit_", StringComparison.Ordinal) && i.Kind != "lit_import").ToList();
        if (resources.Any(i => i.Canonical.ValueKind != JsonValueKind.Object || CanonicalId(i.Canonical) is null))
            throw new McpException("snapshot_needs_refresh: this older snapshot has no exact canonical export. Open the liturgical collection in the updated app with write access and refresh its AI snapshot; do not reconstruct canonical data from search projections.");
        resources = resources.OrderBy(i => CanonicalId(i.Canonical), StringComparer.Ordinal).ToList();
        if (resources.Select(i => CanonicalId(i.Canonical)).Distinct(StringComparer.Ordinal).Count() != resources.Count)
            throw new McpException("invalid_snapshot: duplicate canonical IDs; inspect and correct the collection in the app.");
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            Ids.ToText(collection.LibraryId) + "\n" + string.Join("\n", resources.Select(i => i.Canonical.GetRawText()))))).ToLowerInvariant();
        if (offset < 0 || offset > resources.Count) throw new McpException("invalid_offset: offset must be between 0 and total.");
        if ((offset > 0 && snapshotId is null) || snapshotId is not null && !string.Equals(snapshotId, fingerprint, StringComparison.Ordinal))
            throw new McpException("snapshot_changed: restart from offset 0 and pass the returned snapshotId on every following page.");
        var entities = new JsonArray();
        var chars = 0;
        foreach (var item in resources.Skip(offset).Take(Math.Clamp(limit, 1, 500)))
        {
            var text = item.Canonical.GetRawText();
            if (entities.Count > 0 && chars + text.Length > 80000) break;
            entities.Add(JsonNode.Parse(text)); chars += text.Length;
        }
        int? next = offset + entities.Count < resources.Count ? offset + entities.Count : null;
        var document = new JsonObject { ["format"] = "recreatio.liturgy", ["schema_version"] = "1.1", ["mode"] = "update", ["entities"] = entities };
        return new(Ids.ToText(collection.LibraryId), collection.Name, fingerprint, collection.MadeAt, collection.Current, collection.ChangedAt,
            resources.Count, offset, next, offset == 0 && next is null, document,
            (collection.Current ? "" : "STALE SNAPSHOT: the collection changed after this snapshot. Refresh it before preparing revisions. ") +
            "Exact stored canonical entities, including complete structured texts, passages, templates, assignments, observances, rules and profiles. Nothing is clipped inside an entity. " +
            "Read nextOffset with snapshotId until null and concatenate Document.entities to obtain the whole collection. Complete means this response alone contains the entire collection. " +
            "Derived search text and internal encryption/import fields are excluded. Built-in defaults are separate: get_import_format liturgy-defaults. " +
            "To polish: preserve IDs, supply provenance, increase revision on changed full entities or use operations with expected_revision. Omitted entities are kept; removal is explicit. " +
            "The MCP connection reads; the resulting JSON is applied in Library → Liturgia → Import / export after the change preview. See get_import_format liturgy and liturgy-schema.");
    }

    [McpServerTool(Name = "get_liturgy_library", Title = "Biblioteka liturgiczna jako JSON", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Read a whole authorized liturgical Library collection as exact importable JSON, not excerpts or search projections: canonical works, editions, FULL structured texts, passage ranges, templates, observances, assignments, rules and calendar profiles with their revisions. Use this before bulk corrections/removals or polishing actual data. Follow nextOffset until null, passing snapshotId to prevent mixing different snapshots; combine Document.entities across pages. No entity is truncated. SnapshotCurrent reports whether the snapshot is current. Full import/edit/remove semantics: get_import_format liturgy; machine schema: liturgy-schema; built-in defaults: liturgy-defaults. This tool does not write: prepare JSON for the app's reviewed import.")]
    public static async Task<LiturgyExportResult> GetLiturgyLibrary(IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Exact collection UUID from list_collections; its part must be liturgy.")] string collection,
        [Description("Zero-based offset; continue with nextOffset until null.")] int offset = 0,
        [Description("Maximum whole entities per response, 1–500. The byte budget may return fewer, with nextOffset.")] int limit = 200,
        [Description("SnapshotId from the first response, required on every subsequent page.")] string? snapshotId = null,
        CancellationToken cancellationToken = default)
    {
        using var opened = await OpenAsync(http, db, config, cancellationToken);
        var part = opened.Parts.FirstOrDefault(p => string.Equals(Ids.ToText(p.LibraryId), collection, StringComparison.OrdinalIgnoreCase))
            ?? throw new McpException("not_found: this collection is not readable through this access, or its snapshot is not ready. See list_collections.");
        return LiturgyExport(part, offset, limit, snapshotId);
    }
}
