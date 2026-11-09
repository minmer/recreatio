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
        check(first.Total == 3 && first.NextOffset == 1 && !first.Complete && first.Document["format"]!.GetValue<string>() == "recreatio/liturgy" && first.Document["version"]!.GetValue<int>() == 1,
            "liturgy export is the app's import format, with a whole-collection total and an explicit continuation");
        var exported = (JsonObject)first.Document["entities"]![0]!;
        check(!exported.ContainsKey("schema_version") && !exported.ContainsKey("revision") && exported["id"]!.GetValue<string>() == "test.text.0",
            "exported entities leave out what the app counts, like the app's own export");
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
        foreach (var id in new[] { "liturgy", "example-liturgy" })
            check(ImportFormats.Find(id) is { Parts.Count: > 0 }, $"MCP catalog embeds the {id} format");
        using var example = JsonDocument.Parse(string.Join("\n", ImportFormats.Find("example-liturgy")!.Parts));
        check(example.RootElement.GetProperty("format").GetString() == "recreatio/liturgy", "the whole example is in the import format");
        var guide = string.Join("\n", ImportFormats.Find("liturgy")!.Parts);
        check(guide.Contains("\"remove\": true") && guide.Contains("get_liturgy_library") && guide.Contains("Jak aplikacja używa tych danych"),
            "MCP guide says how to change and remove, where the current data is and how the app uses it");
        check(AiMcp.Instructions.Contains("get_liturgy_library") && AiMcp.Instructions.Contains("get_import_format liturgy"), "MCP discovery directs assistants to the liturgy format and its data");
    }
    private static bool Fails(Action action, string code)
    {
        try { action(); return false; } catch (McpException e) { return e.Message.StartsWith(code + ":", StringComparison.Ordinal); }
    }
}
