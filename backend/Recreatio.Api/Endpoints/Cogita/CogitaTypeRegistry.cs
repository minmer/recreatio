using System.Text.Json;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaTypeRegistry
{
    public sealed record RelationDescriptor(string RelationType, string Role, string TargetType);

    public sealed record FilterFieldDescriptor(string Key, string? Path = null, bool NormalizeDoi = false, bool NormalizeOrcid = false, bool ExpandObjectValues = false);

    public sealed record PayloadFieldDisplayDescriptor(
        string Key,
        string Label,
        string InputType = "text",
        bool Required = false,
        bool Searchable = true);

    public sealed record LinkFieldDisplayDescriptor(
        string Key,
        string Label,
        IReadOnlyList<string> TargetTypes,
        bool Required = false,
        bool Multiple = false);

    public sealed record InfoTypeDescriptor(
        string InfoType,
        string EntityKind,
        IReadOnlyList<string> SearchPaths,
        IReadOnlyList<FilterFieldDescriptor> FilterFields,
        IReadOnlyList<RelationDescriptor> Relations);

    public sealed record InfoTypeEditorDescriptor(
        string InfoType,
        IReadOnlyList<PayloadFieldDisplayDescriptor> PayloadFields,
        IReadOnlyList<LinkFieldDisplayDescriptor> LinkFields);

    public static readonly IReadOnlyDictionary<string, InfoTypeDescriptor> InfoTypes =
        new Dictionary<string, InfoTypeDescriptor>(StringComparer.Ordinal)
        {
            ["language"] = new("language", "single", ["label", "name", "code", "notes"], [], []),
            ["word"] = new("word", "single", ["label", "lemma", "text", "notes", "languageId"], [new("languageId")], [new("word-language", "language", "language")]),
            ["sentence"] = new("sentence", "single", ["label", "text", "notes", "languageId"], [new("languageId")], [new("language-sentence", "language", "language")]),
            ["topic"] = new("topic", "single", ["label", "name", "notes"], [], []),
            ["collection"] = new("collection", "complex", ["label", "name", "notes"], [], []),
            ["person"] = new("person", "single", ["label", "name", "notes"], [], []),
            ["institution"] = new("institution", "single", ["label", "name", "notes"], [], []),
            ["collective"] = new("collective", "single", ["label", "name", "notes"], [], []),
            ["orcid"] = new("orcid", "single", ["label", "orcid", "name", "notes"], [new("orcid", NormalizeOrcid: true)], []),
            ["address"] = new("address", "single", ["label", "name", "street", "city", "postalCode", "country", "notes"], [], []),
            ["email"] = new("email", "single", ["label", "name", "email", "address", "notes"], [], []),
            ["phone"] = new("phone", "single", ["label", "name", "phone", "number", "notes"], [], []),
            ["media"] = new("media", "single", ["label", "name", "url", "kind", "notes"], [], []),
            ["work"] = new(
                "work",
                "single",
                ["label", "title", "subtitle", "doi", "isbn", "issn", "notes", "languageId", "originalLanguageId"],
                [new("languageId"), new("originalLanguageId"), new("doi", NormalizeDoi: true)],
                []),
            ["geo"] = new("geo", "single", ["label", "name", "country", "region", "city", "coordinates", "notes"], [], []),
            ["music_piece"] = new("music_piece", "single", ["label", "title", "composer", "notes"], [], []),
            ["music_fragment"] = new("music_fragment", "single", ["label", "title", "text", "notes"], [], []),
            ["source"] = new(
                "source",
                "single",
                ["label", "title", "sourceKind", "locator", "notes"],
                [new("sourceKind"), new("locator", ExpandObjectValues: true)],
                [new("source-resource", "resource", "work")]),
            ["quote"] = new("quote", "single", ["label", "title", "text", "notes"], [new("text")], [new("quote-language", "language", "language"), new("reference", "source", "source")]),
            ["computed"] = new("computed", "complex", ["label", "title", "definition", "notes"], [], [])
        };

    public static readonly IReadOnlySet<string> SupportedInfoTypes = new HashSet<string>(InfoTypes.Keys, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> SupportedConnectionTypes = new HashSet<string>(StringComparer.Ordinal)
    {
        "word-language",
        "quote-language",
        "language-sentence",
        "translation",
        "word-topic",
        "work-contributor",
        "work-medium",
        "orcid-link",
        "reference",
        "source-resource"
    };

    public static readonly IReadOnlySet<string> SupportedGroupTypes = new HashSet<string>(StringComparer.Ordinal)
    {
        "vocab",
        "citation",
        "book"
    };

    public static readonly IReadOnlyDictionary<string, InfoTypeEditorDescriptor> EditorDescriptors =
        new Dictionary<string, InfoTypeEditorDescriptor>(StringComparer.Ordinal)
        {
            ["language"] = new("language",
                [new("label", "Name", "text", true), new("code", "Code"), new("notes", "Notes", "textarea", false, false)],
                []),
            ["word"] = new("word",
                [new("label", "Label", "text", true), new("lemma", "Lemma"), new("notes", "Notes", "textarea", false, false)],
                [new("languageId", "Language", ["language"], false, false)]),
            ["sentence"] = new("sentence",
                [new("label", "Label"), new("text", "Text", "textarea", true), new("notes", "Notes", "textarea", false, false)],
                [new("languageId", "Language", ["language"], false, false)]),
            ["topic"] = new("topic",
                [new("label", "Topic", "text", true), new("notes", "Notes", "textarea", false, false)],
                []),
            ["collection"] = new("collection",
                [new("label", "Name", "text", true), new("notes", "Notes", "textarea", false, false)],
                []),
            ["person"] = new("person",
                [new("label", "Name", "text", true), new("notes", "Notes", "textarea", false, false)],
                [new("orcidId", "ORCID", ["orcid"], false, false)]),
            ["institution"] = new("institution",
                [new("label", "Name", "text", true), new("notes", "Notes", "textarea", false, false)],
                []),
            ["collective"] = new("collective",
                [new("label", "Name", "text", true), new("notes", "Notes", "textarea", false, false)],
                []),
            ["orcid"] = new("orcid",
                [new("label", "ORCID", "text", true), new("orcid", "ORCID id"), new("notes", "Notes", "textarea", false, false)],
                []),
            ["address"] = new("address",
                [new("label", "Label", "text", true), new("street", "Street"), new("city", "City"), new("postalCode", "Postal code"), new("country", "Country"), new("notes", "Notes", "textarea", false, false)],
                []),
            ["email"] = new("email",
                [new("label", "Label", "text", true), new("email", "E-mail", "text", true), new("notes", "Notes", "textarea", false, false)],
                []),
            ["phone"] = new("phone",
                [new("label", "Label", "text", true), new("number", "Phone number", "text", true), new("notes", "Notes", "textarea", false, false)],
                []),
            ["media"] = new("media",
                [new("label", "Title", "text", true), new("mediaType", "Media type"), new("publisher", "Publisher"), new("publicationYear", "Publication year"), new("isbn", "ISBN"), new("notes", "Notes", "textarea", false, false)],
                []),
            ["work"] = new("work",
                [new("label", "Title", "text", true), new("subtitle", "Subtitle"), new("doi", "DOI"), new("notes", "Notes", "textarea", false, false)],
                [
                    new("languageId", "Language", ["language"], false, false),
                    new("originalLanguageId", "Original language", ["language"], false, false),
                    new("contributors", "Contributors", ["person", "institution", "collective"], false, true),
                    new("media", "Media", ["media"], false, true)
                ]),
            ["geo"] = new("geo",
                [new("label", "Name", "text", true), new("country", "Country"), new("region", "Region"), new("city", "City"), new("notes", "Notes", "textarea", false, false)],
                []),
            ["music_piece"] = new("music_piece",
                [new("label", "Title", "text", true), new("composer", "Composer"), new("notes", "Notes", "textarea", false, false)],
                []),
            ["music_fragment"] = new("music_fragment",
                [new("label", "Title", "text", true), new("text", "Text", "textarea", false), new("notes", "Notes", "textarea", false, false)],
                []),
            ["source"] = new("source",
                [new("label", "Label"), new("sourceKind", "Source type", "text", true), new("locator", "Locator", "textarea"), new("notes", "Notes", "textarea", false, false)],
                [new("resource", "Resource", ["work", "media"], false, false)]),
            ["quote"] = new("quote",
                [new("title", "Title"), new("text", "Quote text", "textarea", true), new("notes", "Notes", "textarea", false, false)],
                [
                    new("languageId", "Language", ["language"], false, false),
                    new("sources", "Sources", ["source"], false, true)
                ]),
            ["computed"] = new("computed",
                [new("label", "Name", "text", true), new("definition", "Definition JSON", "json", true), new("notes", "Notes", "textarea", false, false)],
                [])
        };

    public static string InferEntityKind(string infoType)
    {
        return InfoTypes.TryGetValue(infoType, out var descriptor) ? descriptor.EntityKind : "single";
    }

    public static InfoTypeEditorDescriptor? GetEditorDescriptor(string infoType)
    {
        return EditorDescriptors.TryGetValue(infoType, out var descriptor) ? descriptor : null;
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
