namespace Recreatio.Api.Security;

public sealed record RoleKeyRing(Dictionary<Guid, byte[]> RoleKeys)
{
    public bool TryGetRoleKey(Guid roleId, out byte[] key) => RoleKeys.TryGetValue(roleId, out key!);
}
