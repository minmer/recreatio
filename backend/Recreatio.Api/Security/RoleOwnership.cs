using Recreatio.Api.Data;

namespace Recreatio.Api.Security;

public static class RoleOwnership
{
    public static async Task<HashSet<Guid>> GetOwnedRoleIdsAsync(
        IEnumerable<Guid> ownerRoots,
        IReadOnlyCollection<Guid> accessibleRoleIds,
        RecreatioDbContext dbContext,
        CancellationToken ct)
    {
        var owned = new HashSet<Guid>();
        if (accessibleRoleIds.Count == 0)
        {
            return owned;
        }
        foreach (var rootId in ownerRoots)
        {
            if (accessibleRoleIds.Contains(rootId))
            {
                owned.Add(rootId);
            }
        }

        return owned;
    }
}
