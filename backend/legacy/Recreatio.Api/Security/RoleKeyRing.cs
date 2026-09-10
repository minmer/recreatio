namespace Recreatio.Api.Security;

public sealed record RoleKeyRing(
    Dictionary<Guid, byte[]> ReadKeys,
    Dictionary<Guid, byte[]> WriteKeys,
    Dictionary<Guid, byte[]> OwnerKeys)
{
    public bool TryGetReadKey(Guid roleId, out byte[] key) => ReadKeys.TryGetValue(roleId, out key!);

    public bool TryGetWriteKey(Guid roleId, out byte[] key) => WriteKeys.TryGetValue(roleId, out key!);

    public bool TryGetOwnerKey(Guid roleId, out byte[] key) => OwnerKeys.TryGetValue(roleId, out key!);
}
