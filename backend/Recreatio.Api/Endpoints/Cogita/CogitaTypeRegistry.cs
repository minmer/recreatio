using System.Linq;
using System.Text.Json;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaTypeRegistry
{
    public static readonly IReadOnlyList<string> ConnectionInfoTypes = new[]
    {
        "word-language",
        "citation-language",
        "language-sentence",
        "translation",
        "word-topic",
        "work-contributor",
        "work-medium",
        "orcid-link",
        "reference",
        "source-resource"
    };

    public static readonly IReadOnlyList<string> GroupInfoTypes = new[]
    {
        "vocab",
        "book"
    };

    private static readonly LinkFieldDisplayDescriptor CommonTopicsLink =
        new("topics", "Topics", ["topic"], false, true);

    private static readonly LinkFieldDisplayDescriptor CommonReferencesLink =
        new("references", "References", ["source"], false, true, KeepOnCreate: true);

    public sealed record RelationDescriptor(string RelationType, string Role, string TargetType);

    public sealed record FilterFieldDescriptor(string Key, string? Path = null, bool NormalizeDoi = false, bool NormalizeOrcid = false, bool ExpandObjectValues = false);

    public sealed record PayloadFieldDisplayDescriptor(
        string Key,
        string Label,
        string InputType = "text",
        bool Required = false,
        bool Searchable = true,
        bool KeepOnCreate = false);

    public sealed record LinkFieldDisplayDescriptor(
        string Key,
        string Label,
        IReadOnlyList<string> TargetTypes,
        bool Required = false,
        bool Multiple = false,
        bool KeepOnCreate = false);

    public sealed record InfoTypeDescriptor(
        string InfoType,
        string EntityKind,
        IReadOnlyList<string> SearchPaths,
        IReadOnlyList<FilterFieldDescriptor> FilterFields,
        IReadOnlyList<RelationDescriptor> Relations);

    public sealed record InfoTypeEditorDescriptor(
        string InfoType,
        IReadOnlyList<PayloadFieldDisplayDescriptor> PayloadFields,
        IReadOnlyList<LinkFieldDisplayDescriptor> LinkFields,
        bool AllowCommonTopics = true,
        bool AllowCommonReferences = true);

    public static readonly IReadOnlyDictionary<string, InfoTypeDescriptor> InfoTypes =
        new Dictionary<string, InfoTypeDescriptor>(StringComparer.Ordinal)
        {
            ["language"] = new("language", "single", ["label", "name", "code"], [], []),
            ["word"] = new("word", "single", ["label", "lemma", "text", "languageId"], [new("languageId")], [new("word-language", "language", "language")]),
            ["sentence"] = new("sentence", "single", ["label", "text", "languageId"], [new("languageId")], [new("language-sentence", "language", "language")]),
            ["topic"] = new("topic", "single", ["label", "name"], [], []),
            ["collection"] = new("collection", "complex", ["label", "name"], [], []),
            ["person"] = new("person", "single", ["label", "name"], [], []),
            ["institution"] = new("institution", "single", ["label", "name"], [], []),
            ["collective"] = new("collective", "single", ["label", "name"], [], []),
            ["orcid"] = new("orcid", "single", ["label", "orcid", "name"], [new("orcid", NormalizeOrcid: true)], []),
            ["address"] = new("address", "single", ["label", "name", "street", "city", "postalCode", "country"], [], []),
            ["email"] = new("email", "single", ["label", "name", "email", "address"], [], []),
            ["phone"] = new("phone", "single", ["label", "name", "phone", "number"], [], []),
            ["media"] = new("media", "single", ["label", "name", "url", "kind"], [], []),
            ["work"] = new(
                "work",
                "single",
                ["label", "title", "subtitle", "doi", "isbn", "issn", "languageId", "originalLanguageId"],
                [new("languageId"), new("originalLanguageId"), new("doi", NormalizeDoi: true)],
                []),
            ["geo"] = new("geo", "single", ["label", "name", "country", "region", "city", "coordinates"], [], []),
            ["music_piece"] = new("music_piece", "single", ["label", "title", "composer"], [], []),
            ["music_fragment"] = new("music_fragment", "single", ["label", "title", "text"], [], []),
            ["source"] = new(
                "source",
                "single",
                ["label", "title", "sourceKind", "locator"],
                [new("sourceKind"), new("locator", ExpandObjectValues: true)],
                [new("source-resource", "resource", "work")]),
            ["citation"] = new("citation", "single", ["label", "title", "text"], [new("text")], [new("citation-language", "language", "language"), new("reference", "source", "source")]),
            ["question"] = new("question", "single", ["definition"], [new("questionType", "definition.type"), new("questionText", "definition.question")], []),
            ["computed"] = new("computed", "complex", ["label", "title", "definition"], [], []),
            ["word-language"] = new("word-language", "complex", ["label", "leftWordId", "rightWordId", "languageId"], [], []),
            ["citation-language"] = new("citation-language", "complex", ["label", "citationId", "languageId"], [], []),
            ["language-sentence"] = new("language-sentence", "complex", ["label", "sentenceId", "languageId"], [], []),
            ["translation"] = new("translation", "complex", ["label", "leftWordId", "rightWordId", "direction"], [], []),
            ["word-topic"] = new("word-topic", "complex", ["label", "wordId", "topicId"], [], []),
            ["work-contributor"] = new("work-contributor", "complex", ["label", "workId", "contributorId", "role"], [], []),
            ["work-medium"] = new("work-medium", "complex", ["label", "workId", "mediaId"], [], []),
            ["orcid-link"] = new("orcid-link", "complex", ["label", "personId", "orcidId"], [], []),
            ["reference"] = new("reference", "complex", ["label", "fromInfoId", "sourceId", "locator"], [], []),
            ["source-resource"] = new("source-resource", "complex", ["label", "sourceId", "resourceId"], [], []),
            ["vocab"] = new("vocab", "complex", ["label", "direction", "languageAId", "languageBId"], [], []),
            ["book"] = new("book", "complex", ["label", "title", "isbn"], [], [])
        };

    public static readonly IReadOnlySet<string> SupportedInfoTypes = new HashSet<string>(InfoTypes.Keys, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> SupportedConnectionTypes = new HashSet<string>(ConnectionInfoTypes, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> ComputedBackedInfoTypes = new HashSet<string>(
        new[] { "computed", "question" }.Concat(ConnectionInfoTypes).Concat(GroupInfoTypes),
        StringComparer.Ordinal);

    public static readonly IReadOnlyDictionary<string, InfoTypeEditorDescriptor> EditorDescriptors =
        new Dictionary<string, InfoTypeEditorDescriptor>(StringComparer.Ordinal)
        {
            ["language"] = new("language",
                [new("label", "Name", "text", true), new("code", "Code")],
                []),
            ["word"] = new("word",
                [new("label", "Label", "text", true), new("lemma", "Lemma")],
                [new("languageId", "Language", ["language"], false, false, KeepOnCreate: true)]),
            ["sentence"] = new("sentence",
                [new("label", "Label"), new("text", "Text", "textarea", true)],
                [new("languageId", "Language", ["language"], false, false, KeepOnCreate: true)]),
            ["topic"] = new("topic",
                [new("label", "Topic", "text", true)],
                []),
            ["collection"] = new("collection",
                [new("label", "Name", "text", true)],
                []),
            ["person"] = new("person",
                [new("label", "Name", "text", true)],
                [new("orcidId", "ORCID", ["orcid"], false, false)]),
            ["institution"] = new("institution",
                [new("label", "Name", "text", true)],
                []),
            ["collective"] = new("collective",
                [new("label", "Name", "text", true)],
                []),
            ["orcid"] = new("orcid",
                [new("label", "ORCID", "text", true), new("orcid", "ORCID id")],
                []),
            ["address"] = new("address",
                [new("label", "Label", "text", true), new("street", "Street"), new("city", "City"), new("postalCode", "Postal code"), new("country", "Country")],
                []),
            ["email"] = new("email",
                [new("label", "Label", "text", true), new("email", "E-mail", "text", true)],
                []),
            ["phone"] = new("phone",
                [new("label", "Label", "text", true), new("number", "Phone number", "text", true)],
                []),
            ["media"] = new("media",
                [new("label", "Title", "text", true), new("mediaType", "Media type"), new("publisher", "Publisher"), new("publicationYear", "Publication year"), new("isbn", "ISBN")],
                []),
            ["work"] = new("work",
                [new("label", "Title", "text", true), new("subtitle", "Subtitle"), new("doi", "DOI")],
                [
                    new("languageId", "Language", ["language"], false, false, KeepOnCreate: true),
                    new("originalLanguageId", "Original language", ["language"], false, false, KeepOnCreate: true),
                    new("contributors", "Contributors", ["person", "institution", "collective"], false, true),
                    new("media", "Media", ["media"], false, true)
                ]),
            ["geo"] = new("geo",
                [new("label", "Name", "text", true), new("country", "Country"), new("region", "Region"), new("city", "City")],
                []),
            ["music_piece"] = new("music_piece",
                [new("label", "Title", "text", true), new("composer", "Composer")],
                []),
            ["music_fragment"] = new("music_fragment",
                [new("label", "Title", "text", true), new("text", "Text", "textarea", false)],
                []),
            ["source"] = new("source",
                [
                    new("label", "Label"),
                    new("sourceKind", "Source type", "text", true, true, KeepOnCreate: true),
                    new("locator", "Locator", "textarea")
                ],
                [new("resource", "Resource", ["work", "media"], false, false, KeepOnCreate: true)],
                AllowCommonReferences: false),
            ["citation"] = new("citation",
                [new("title", "Title"), new("text", "Citation text", "textarea", true)],
                [
                    new("languageId", "Language", ["language"], false, false, KeepOnCreate: true),
                    new("references", "References", ["source"], false, true, KeepOnCreate: true)
                ]),
            ["question"] = new("question",
                [new("definition", "Question definition JSON", "json", true)],
                []),
            ["computed"] = new("computed",
                [new("label", "Name", "text", true), new("definition", "Definition JSON", "json", true)],
                []),
            ["word-language"] = new("word-language",
                [new("label", "Label")],
                [new("words", "Words", ["word"], true, true), new("languageId", "Language", ["language"], false, false)]),
            ["citation-language"] = new("citation-language",
                [new("label", "Label")],
                [new("citationId", "Citation", ["citation"], true, false), new("languageId", "Language", ["language"], true, false)]),
            ["language-sentence"] = new("language-sentence",
                [new("label", "Label")],
                [new("sentenceId", "Sentence", ["sentence"], true, false), new("languageId", "Language", ["language"], true, false)]),
            ["translation"] = new("translation",
                [new("label", "Label"), new("direction", "Direction")],
                [new("words", "Words", ["word"], true, true)]),
            ["word-topic"] = new("word-topic",
                [new("label", "Label")],
                [new("wordId", "Word", ["word"], true, false), new("topicId", "Topic", ["topic"], true, false)]),
            ["work-contributor"] = new("work-contributor",
                [new("label", "Label"), new("role", "Role")],
                [new("workId", "Work", ["work"], true, false), new("contributorId", "Contributor", ["person", "institution", "collective"], true, false)]),
            ["work-medium"] = new("work-medium",
                [new("label", "Label")],
                [new("workId", "Work", ["work"], true, false), new("mediaId", "Media", ["media"], true, false)]),
            ["orcid-link"] = new("orcid-link",
                [new("label", "Label")],
                [new("personId", "Person", ["person"], true, false), new("orcidId", "ORCID", ["orcid"], true, false)]),
            ["reference"] = new("reference",
                [new("label", "Label"), new("locator", "Locator")],
                [new("fromInfoId", "From info", SupportedInfoTypes.ToArray(), true, false), new("sourceId", "Source", ["source"], true, false)]),
            ["source-resource"] = new("source-resource",
                [new("label", "Label")],
                [new("sourceId", "Source", ["source"], true, false), new("resourceId", "Resource", ["work", "media"], true, false)]),
            ["vocab"] = new("vocab",
                [new("label", "Label"), new("direction", "Direction")],
                [new("translations", "Translations", ["translation"], false, true)]),
            ["book"] = new("book",
                [new("label", "Title", "text", true), new("isbn", "ISBN")],
                [new("works", "Works", ["work"], false, true)])
        };

    public static string InferEntityKind(string infoType)
    {
        return InfoTypes.TryGetValue(infoType, out var descriptor) ? descriptor.EntityKind : "single";
    }

    public static InfoTypeEditorDescriptor? GetEditorDescriptor(string infoType)
    {
        if (!EditorDescriptors.TryGetValue(infoType, out var descriptor))
        {
            return null;
        }

        var links = descriptor.LinkFields.ToList();
        if (descriptor.AllowCommonTopics &&
            !links.Any(x => x.Key.Equals(CommonTopicsLink.Key, StringComparison.OrdinalIgnoreCase)))
        {
            links.Add(CommonTopicsLink);
        }
        if (descriptor.AllowCommonReferences &&
            !ConnectionInfoTypes.Contains(infoType) &&
            !GroupInfoTypes.Contains(infoType) &&
            !links.Any(x => x.Key.Equals(CommonReferencesLink.Key, StringComparison.OrdinalIgnoreCase)))
        {
            links.Add(CommonReferencesLink);
        }

        return new InfoTypeEditorDescriptor(
            descriptor.InfoType,
            descriptor.PayloadFields,
            links,
            descriptor.AllowCommonTopics,
            descriptor.AllowCommonReferences);
    }

    public static List<(string Key, string Value)> BuildInfoFilterTokens(string infoType, JsonElement payload)
    {
        var tokens = new List<(string Key, string Value)>();
        var unique = new HashSet<string>(StringComparer.Ordinal);

        AddToken(tokens, unique, "entityType", infoType);
        AddToken(tokens, unique, "infoType", infoType);

        if (payload.ValueKind != JsonValueKind.Object)
        {
            return tokens;
        }

        if (InfoTypes.TryGetValue(infoType, out var descriptor))
        {
            foreach (var filter in descriptor.FilterFields)
            {
                var path = string.IsNullOrWhiteSpace(filter.Path) ? filter.Key : filter.Path!;
                foreach (var value in ReadPathValues(payload, path, filter.ExpandObjectValues))
                {
                    var normalized = value;
                    if (filter.NormalizeDoi)
                    {
                        normalized = NormalizeDoi(value);
                    }
                    if (filter.NormalizeOrcid)
                    {
                        normalized = NormalizeOrcid(value);
                    }
                    AddToken(tokens, unique, filter.Key, normalized);
                }
            }
        }

        AppendRecursiveTokens(tokens, unique, payload, null, 0, 4, 192);
        return tokens;
    }

    private static IEnumerable<string> ReadPathValues(JsonElement root, string path, bool expandObjectValues)
    {
        var parts = path.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var current = root;
        foreach (var part in parts)
        {
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(part, out current))
            {
                yield break;
            }
        }

        foreach (var value in ReadElementValues(current, expandObjectValues))
        {
            yield return value;
        }
    }

    private static IEnumerable<string> ReadElementValues(JsonElement element, bool expandObjectValues)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                {
                    var text = element.GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        yield return text!;
                    }
                    yield break;
                }
            case JsonValueKind.Number:
            case JsonValueKind.True:
            case JsonValueKind.False:
                yield return element.ToString();
                yield break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    foreach (var value in ReadElementValues(item, expandObjectValues))
                    {
                        yield return value;
                    }
                }
                yield break;
            case JsonValueKind.Object:
                if (!expandObjectValues)
                {
                    yield break;
                }
                foreach (var prop in element.EnumerateObject())
                {
                    foreach (var value in ReadElementValues(prop.Value, true))
                    {
                        yield return value;
                    }
                }
                yield break;
            default:
                yield break;
        }
    }

    private static void AppendRecursiveTokens(
        List<(string Key, string Value)> tokens,
        HashSet<string> unique,
        JsonElement element,
        string? prefix,
        int depth,
        int maxDepth,
        int maxTokens)
    {
        if (tokens.Count >= maxTokens || depth > maxDepth)
        {
            return;
        }

        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in element.EnumerateObject())
            {
                if (tokens.Count >= maxTokens)
                {
                    return;
                }

                var key = string.IsNullOrWhiteSpace(prefix) ? prop.Name : $"{prefix}.{prop.Name}";
                if (IsScalar(prop.Value))
                {
                    var text = prop.Value.ToString();
                    AddToken(tokens, unique, prop.Name, text);
                    AddToken(tokens, unique, key, text);
                    continue;
                }

                AppendRecursiveTokens(tokens, unique, prop.Value, key, depth + 1, maxDepth, maxTokens);
            }
            return;
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            var index = 0;
            foreach (var item in element.EnumerateArray())
            {
                if (tokens.Count >= maxTokens || index > 24)
                {
                    return;
                }

                if (IsScalar(item))
                {
                    AddToken(tokens, unique, prefix ?? "value", item.ToString());
                }
                else
                {
                    AppendRecursiveTokens(tokens, unique, item, prefix, depth + 1, maxDepth, maxTokens);
                }

                index++;
            }
        }
    }

    private static bool IsScalar(JsonElement element)
    {
        return element.ValueKind is JsonValueKind.String or JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False;
    }

    private static void AddToken(List<(string Key, string Value)> tokens, HashSet<string> unique, string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        var normalizedKey = key.Trim();
        var normalizedValue = value.Trim();
        if (normalizedKey.Length > 96)
        {
            normalizedKey = normalizedKey[..96];
        }
        if (normalizedValue.Length > 256)
        {
            normalizedValue = normalizedValue[..256];
        }

        var marker = $"{normalizedKey}\u001F{normalizedValue}";
        if (unique.Add(marker))
        {
            tokens.Add((normalizedKey, normalizedValue));
        }
    }

    private static string NormalizeDoi(string doi)
    {
        var trimmed = doi.Trim();
        if (trimmed.StartsWith("https://doi.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["https://doi.org/".Length..];
        }
        else if (trimmed.StartsWith("http://doi.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["http://doi.org/".Length..];
        }
        else if (trimmed.StartsWith("doi:", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["doi:".Length..];
        }

        return trimmed.Trim().ToLowerInvariant();
    }

    private static string NormalizeOrcid(string orcid)
    {
        var trimmed = orcid.Trim();
        if (trimmed.StartsWith("https://orcid.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["https://orcid.org/".Length..];
        }
        else if (trimmed.StartsWith("http://orcid.org/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["http://orcid.org/".Length..];
        }
        else if (trimmed.StartsWith("orcid:", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["orcid:".Length..];
        }

        trimmed = trimmed.Replace(" ", string.Empty).Replace("-", string.Empty).ToUpperInvariant();
        if (trimmed.Length == 16)
        {
            return $"{trimmed[..4]}-{trimmed.Substring(4, 4)}-{trimmed.Substring(8, 4)}-{trimmed.Substring(12, 4)}";
        }

        return trimmed;
    }
}
