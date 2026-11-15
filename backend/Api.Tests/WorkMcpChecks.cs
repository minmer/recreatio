using System.Text.Json;
using Api;

/// <summary>
/// 2026-11-15 — DAS WERK ÜBER MCP: aus einer Abschrift mit <c>works</c> (so wie <c>workBrief.ts</c> sie schreibt) liest
/// der Dienst Odprawa, Kontext eines Knotens und Befunde — nur gefiltert, nie neu gerechnet.
/// </summary>
internal static class WorkMcpChecks
{
    public static void Run(Action<bool, string> check)
    {
        using var doc = JsonDocument.Parse("""
            { "v": 1, "library": "01a16af6-5a94-718f-b8b5-abdb3ab69300", "name": "Skryptorium", "entries": [],
              "works": [ {
                "v": 1, "project": "p-1", "key": "ksiazka", "title": "Rzeka", "projectType": "book", "description": "", "lang": "pl",
                "levels": [], "dimensions": [ { "key": "audience", "name": "Odbiorcy", "ordered": false, "values": [ { "key": "adults", "name": "Dorośli" }, { "key": "youth", "name": "Młodzież" } ] } ],
                "roles": [], "bases": [], "fromOutline": false,
                "rules": [ { "id": "r-all", "scope": "rulebook", "rule": "Piszemy w czasie przeszłym.", "why": "Opowieść.", "weight": "must" },
                           { "id": "r-youth", "scope": "project", "rule": "Krótkie zdania.", "why": "Młodzież.", "weight": "should", "dimension": "audience", "value": "youth" } ],
                "templates": [],
                "nodes": [
                  { "id": "n1", "order": 1, "depth": 0, "title": "Dzieciństwo", "synopsis": "Anna nad rzeką.", "role": "new", "words": 0, "marks": [ { "entity": "e-anna", "role": "intro", "where": "node" }, { "entity": "e-term", "role": "intro", "where": "node" } ] },
                  { "id": "n2", "order": 2, "depth": 0, "title": "Przymierze", "split": "audience", "role": "new", "words": 0, "marks": [ { "entity": "e-term", "role": "def", "where": "node" } ] },
                  { "id": "n2a", "parent": "n2", "order": 1, "depth": 1, "title": "Dla dorosłych", "variant": "adults", "words": 0, "marks": [] },
                  { "id": "n2y", "parent": "n2", "order": 2, "depth": 1, "title": "Dla młodzieży", "variant": "youth", "synopsis": "Prościej.", "words": 0, "marks": [ { "entity": "e-term", "role": "use", "where": "node" } ] },
                  { "id": "n3", "order": 3, "depth": 0, "title": "Dorosłość", "words": 0, "marks": [] }
                ],
                "knowledge": [ { "id": "e-anna", "label": "Anna", "kind": "Osoba", "phases": [ { "id": "ph-child", "label": "Anna — dziecko", "until": "n1", "description": "Mała, ciekawska." } ] },
                               { "id": "e-term", "label": "przymierze", "kind": "Termin" } ],
                "paths": [ {
                  "key": "youth", "name": "Młodzież", "choose": { "audience": "youth" },
                  "order": [ "n1", "n2", "n2y", "n3" ], "numbers": [ "1", "2", "2.1", "3" ],
                  "firstIntro": { "e-anna": "n1", "e-term": "n1" },
                  "findings": [ { "id": "f1", "code": "lengthOff", "weight": "should", "path": "youth", "node": "n2y", "message": "za krótko", "why": "rytm", "fix": "rozwiń" },
                                { "id": "f2", "code": "noPurpose", "weight": "info", "path": "youth", "node": "n3", "message": "bez celu", "why": "-", "fix": "-" } ],
                  "rulesEverywhere": [ "r-all", "r-youth" ],
                  "context": { "n1": { "phases": [ "ph-child" ], "deliver": [ "e-anna", "e-term" ] } }
                } ]
              } ] }
            """);
        var snap = AiAccess.ReadSnapshot(Guid.Parse("01a16af6-5a94-718f-b8b5-abdb3ab69300"), "writing", doc.RootElement)!;
        var work = AiMcpTools.FindWork([snap], "Rzeka");
        check(AiMcpTools.FindWork([snap], null).Brief["project"]?.GetValue<string>() == "p-1" && AiMcpTools.FindWork([snap], "ksiazka") is not null,
            "work MCP: a work is found by title, key or alone");

        var ctx = AiMcpTools.ContextOf(work, "2.1", "youth", null);
        check(ctx.NodeId == "n2y" && ctx.OnPath && ctx.Position == 2 && ctx.Number == "2.1"
            && ctx.Chain.Count == 1 && ctx.Chain[0]?["id"]?.GetValue<string>() == "n2"
            && ctx.Previous?["id"]?.GetValue<string>() == "n2" && ctx.Next?["id"]?.GetValue<string>() == "n3",
            "work MCP: a node by its number on the path, with its chain and the nodes before and after");
        check(ctx.Introduced.Count == 2 && ctx.Introduced.Any(i => i?["label"]?.GetValue<string>() == "przymierze" && i?["defined"]?.GetValue<bool>() == true),
            "work MCP: what is introduced before the node (and whether it is defined)");
        check(ctx.Cells.Count == 1 && ctx.Cells[0]?["id"]?.GetValue<string>() == "n2a" && ctx.Cells[0]?["value"]?.GetValue<string>() == "adults",
            "work MCP: the neighbouring cell for the other audience");
        check(ctx.Rules.Count == 2 && ctx.Rules.Any(r => r?["why"]?.GetValue<string>() == "Młodzież.") && ctx.Findings.Count == 1,
            "work MCP: rules in scope with their reasons, findings at the node");

        var first = AiMcpTools.ContextOf(work, "n1", null, null);
        check(first.Introduced.Count == 0 && first.Deliver.Count == 2 && first.Phases.Count == 1 && first.Phases[0]?["description"]?.GetValue<string>() == "Mała, ciekawska.",
            "work MCP: at the first node nothing is introduced yet; it must deliver two; the phase valid here is expanded");

        var off = AiMcpTools.ContextOf(work, "n2a", "youth", null);
        check(!off.OnPath && off.Position is null && off.Note.Contains("does not lie on path"), "work MCP: a version for others is shown without a place on the path");

        var checks = AiMcpTools.ChecksOf(work, null, null);
        var atNode = AiMcpTools.ChecksOf(work, "youth", "Dorosłość");
        check(checks.Paths.Count == 1 && checks.Paths[0].Should == 1 && checks.Paths[0].Info == 1
            && atNode.Paths[0].Findings.Count == 1 && atNode.Paths[0].Findings[0]?["id"]?.GetValue<string>() == "f2",
            "work MCP: the findings exactly as stored, counted and filtered by node");
        check(AiMcp.Instructions.Contains("get_work_context") && AiMcp.Instructions.Contains("guide-work"), "work MCP: the instructions name the work tools and the guide");
    }
}
