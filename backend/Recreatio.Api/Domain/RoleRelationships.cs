namespace Recreatio.Api.Domain;

public static class RoleRelationships
{
    public const string Owner = "Owner";
    public const string Write = "Write";
    public const string Read = "Read";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Owner,
        Write,
        Read
    };

    private static readonly IReadOnlyDictionary<string, string> Aliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["AdminOf"] = Owner
        };

    public static IEnumerable<string> Allowed => All;

    public static bool IsAllowed(string relationshipType)
    {
        if (string.IsNullOrWhiteSpace(relationshipType))
        {
            return false;
        }

        return All.Any(type => string.Equals(type, relationshipType, StringComparison.OrdinalIgnoreCase))
            || Aliases.ContainsKey(relationshipType.Trim());
    }

    public static string Normalize(string relationshipType)
    {
        var trimmed = relationshipType.Trim();
        if (Aliases.TryGetValue(trimmed, out var alias))
        {
            return alias;
        }
        foreach (var type in All)
        {
            if (string.Equals(type, trimmed, StringComparison.OrdinalIgnoreCase))
            {
                return type;
            }
        }
        return trimmed;
    }

    public static bool AllowsWrite(string relationshipType)
    {
        return string.Equals(relationshipType, Owner, StringComparison.OrdinalIgnoreCase)
            || string.Equals(relationshipType, Write, StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsOwner(string relationshipType)
    {
        return string.Equals(Normalize(relationshipType), Owner, StringComparison.OrdinalIgnoreCase);
    }
}
