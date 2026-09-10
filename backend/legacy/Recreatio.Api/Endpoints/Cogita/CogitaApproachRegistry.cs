using System.Text.Json.Nodes;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaApproachRegistry
{
    public sealed record ApproachDescriptor(
        string ApproachKey,
        string Label,
        string Category,
        IReadOnlyList<string> SourceInfoTypes);

    public static readonly IReadOnlyDictionary<string, ApproachDescriptor> Approaches =
        new Dictionary<string, ApproachDescriptor>(StringComparer.Ordinal)
        {
            ["citation-view"] = new(
                "citation-view",
                "Citation",
                "info-view",
                new[] { "citation" }),
            ["vocab-card"] = new(
                "vocab-card",
                "Vocab card",
                "card-view",
                new[] { "translation" })
        };

    public static IReadOnlyList<ApproachDescriptor> GetForInfoType(string infoType)
    {
        return Approaches.Values
            .Where(x => x.SourceInfoTypes.Contains(infoType, StringComparer.OrdinalIgnoreCase))
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Label)
            .ToList();
    }

    public static ApproachDescriptor? Get(string approachKey)
    {
        return Approaches.TryGetValue(approachKey, out var descriptor) ? descriptor : null;
    }
}
