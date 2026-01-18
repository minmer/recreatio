namespace Recreatio.Api.Domain;

public static class RoleRelationships
{
    public const string Owner = "Owner";
    public const string AdminOf = "AdminOf";
    public const string Write = "Write";
    public const string Read = "Read";
    public const string MemberOf = "MemberOf";
    public const string DelegatedTo = "DelegatedTo";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Owner,
        AdminOf,
        Write,
        Read,
        MemberOf,
        DelegatedTo
    };

    public static bool IsAllowed(string relationshipType)
    {
        return All.Any(type => string.Equals(type, relationshipType, StringComparison.OrdinalIgnoreCase));
    }

    public static string Normalize(string relationshipType)
    {
        var trimmed = relationshipType.Trim();
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
            || string.Equals(relationshipType, AdminOf, StringComparison.OrdinalIgnoreCase)
            || string.Equals(relationshipType, Write, StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsOwner(string relationshipType)
    {
        return string.Equals(relationshipType, Owner, StringComparison.OrdinalIgnoreCase);
    }
}
