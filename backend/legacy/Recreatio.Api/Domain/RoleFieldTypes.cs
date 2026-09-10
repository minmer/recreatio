namespace Recreatio.Api.Domain;

public static class RoleFieldTypes
{
    public const string Nick = "nick";
    public const string RoleKind = "role_kind";

    public static bool IsSystemField(string fieldType)
    {
        return string.Equals(fieldType, Nick, StringComparison.OrdinalIgnoreCase)
            || string.Equals(fieldType, RoleKind, StringComparison.OrdinalIgnoreCase);
    }
}
