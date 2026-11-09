using System.Text.Json;
using System.Text.Json.Nodes;
using Api;
using ModelContextProtocol;

internal static class LiturgyMcpChecks
{
    public static void Run(Action<bool, string> check)
    {
        var library = Guid.NewGuid();
        var entries = new JsonArray();
        for (var i = 0; i < 3; i++)
        {
            var canonical = new JsonObject {
                ["schema_version"] = "1.0", ["entity_type"] = "text_resource", ["id"] = $"test.text.{i}",
                ["title"] = $"Text {i}", ["revision"] = i + 1, ["status"] = "draft", ["edition_id"] = "test.edition",
                ["resource_type"] = "reading", ["language"] = "pl-PL",
                ["structured_content"] = new JsonArray(new JsonObject { ["type"] = "paragraph", ["text"] = i == 1 ? new string('x', 100000) : "Synthetic complete text" })
            };
            entries.Add(new JsonObject { ["id"] = Guid.NewGuid().ToString(), ["kind"] = "lit_text", ["title"] = $"Text {i}", ["data"] = new JsonObject { ["text"] = "DERIVED: not canonical" }, ["canonical"] = canonical });
        }
        var root = new JsonObject { ["v"] = 1, ["library"] = library.ToString(), ["name"] = "Liturgy", ["madeAt"] = "2026-11-09T12:00:00Z", ["entries"] = entries };
        using var document = JsonDocument.Parse(root.ToJsonString());
        var snapshot = AiAccess.ReadSnapshot(library, "liturgy", document.RootElement)!;
        check(AiAccess.PartLabel("liturgy") == "Liturgia", "MCP labels a liturgical collection as Liturgia");
        var first = AiMcpTools.LiturgyExport(snapshot, 0, 1, null);
        check(first.Total == 3 && first.NextOffset == 1 && !first.Complete && first.Document["schema_version"]!.GetValue<string>() == "1.1", "liturgy export reports a whole-collection total and an explicit continuation");
        var second = AiMcpTools.LiturgyExport(snapshot, 1, 1, first.SnapshotId);
        check(second.Document["entities"]![0]!["structured_content"]![0]!["text"]!.GetValue<string>().Length == 100000,
            "liturgy export never clips an oversized canonical text to a snippet");
        var last = AiMcpTools.LiturgyExport(snapshot, 2, 1, first.SnapshotId);
        check(last.NextOffset is null && !last.Complete, "the last page is not misrepresented as the whole collection");
        check(!first.Document.ToJsonString().Contains("DERIVED"), "canonical MCP export excludes reader projections");
        check(Fails(() => AiMcpTools.LiturgyExport(snapshot, 1, 1, null), "snapshot_changed"), "every continuation is pinned to the first snapshot");
        check(Fails(() => AiMcpTools.LiturgyExport(snapshot, 1, 1, "wrong"), "snapshot_changed"), "mixing snapshot versions is refused");
        check(Fails(() => AiMcpTools.LiturgyExport(snapshot, -1, 1, null), "invalid_offset"), "negative export offsets are rejected");
        snapshot.Current = false;
        check(AiMcpTools.LiturgyExport(snapshot, 0, 500, null).Note.StartsWith("STALE SNAPSHOT"), "liturgy export surfaces stale source data");
        var other = AiAccess.ReadSnapshot(library, "writing", document.RootElement)!;
        check(Fails(() => AiMcpTools.LiturgyExport(other, 0, 100, null), "wrong_collection"), "the tool cannot treat another collection kind as a liturgical library");
        var single = new JsonObject { ["v"] = 1, ["library"] = library.ToString(), ["entries"] = new JsonArray(entries[0]!.DeepClone()) };
        using var singleDoc = JsonDocument.Parse(single.ToJsonString());
        var singleSnapshot = AiAccess.ReadSnapshot(library, "liturgy", singleDoc.RootElement)!;
        check(AiMcpTools.LiturgyExport(singleSnapshot, 0, 200, null).Complete, "a complete export is explicitly marked only when all records fit");
        ((JsonObject)single["entries"]![0]!).Remove("canonical");
        using var oldDoc = JsonDocument.Parse(single.ToJsonString());
        check(Fails(() => AiMcpTools.LiturgyExport(AiAccess.ReadSnapshot(library, "liturgy", oldDoc.RootElement)!, 0, 200, null), "snapshot_needs_refresh"), "older snapshots require refresh instead of guessing an import from projections");
        foreach (var id in new[] { "liturgy", "liturgy-schema", "liturgy-defaults", "example-liturgy", "example-liturgy-maintenance" })
            check(ImportFormats.Find(id) is { Parts.Count: > 0 }, $"MCP catalog embeds the complete {id} format");
        var schema = ImportFormats.Find("liturgy-schema")!;
        using var schemaDoc = JsonDocument.Parse(string.Join("\n", schema.Parts));
        check(schemaDoc.RootElement.GetProperty("$schema").GetString()!.Contains("2020-12"), "all MCP schema parts reconstruct valid JSON Schema");
        var guide = string.Join("\n", ImportFormats.Find("liturgy")!.Parts);
        check(guide.Contains("expected_revision") && guide.Contains("reset_default") && guide.Contains("get_liturgy_library"), "MCP guide connects actual-data reading to revision-checked maintenance");
        check(AiMcp.Instructions.Contains("get_liturgy_library") && AiMcp.Instructions.Contains("liturgy-schema"), "MCP discovery directs assistants to the full liturgy model");
    }
    private static bool Fails(Action action, string code)
    {
        try { action(); return false; } catch (McpException e) { return e.Message.StartsWith(code + ":", StringComparison.Ordinal); }
    }
}
