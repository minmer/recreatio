using Microsoft.EntityFrameworkCore;
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

        var ownerEdges = await dbContext.RoleEdges.AsNoTracking()
            .Where(edge => edge.RelationshipType == "Owner")
            .ToListAsync(ct);

        var edgesByParent = ownerEdges
            .GroupBy(edge => edge.ParentRoleId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var queue = new Queue<Guid>(owned);
        while (queue.Count > 0)
        {
            var parentRoleId = queue.Dequeue();
            if (!edgesByParent.TryGetValue(parentRoleId, out var edges))
            {
                continue;
            }

            foreach (var edge in edges)
            {
                if (!accessibleRoleIds.Contains(edge.ChildRoleId))
                {
                    continue;
                }

                if (owned.Add(edge.ChildRoleId))
                {
                    queue.Enqueue(edge.ChildRoleId);
                }
            }
        }

        return owned;
    }
}
