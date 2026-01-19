using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;

namespace Recreatio.Api.Services;

public interface IRoleQueryService
{
    Task<IReadOnlyList<RoleSearchResponse>> SearchAsync(string query, RoleKeyRing keyRing, CancellationToken ct);
    Task<IReadOnlyList<RoleResponse>> ListAsync(RoleKeyRing keyRing, CancellationToken ct);
    Task<RoleGraphResponse> BuildGraphAsync(Guid userId, RoleKeyRing keyRing, CancellationToken ct);
}

public sealed class RoleQueryService : IRoleQueryService
{
    private readonly RecreatioDbContext _dbContext;
    private readonly IRoleFieldQueryService _fieldQueryService;
    private readonly IRoleFieldValueService _fieldValueService;
    private readonly IEncryptionService _encryptionService;

    public RoleQueryService(
        RecreatioDbContext dbContext,
        IRoleFieldQueryService fieldQueryService,
        IRoleFieldValueService fieldValueService,
        IEncryptionService encryptionService)
    {
        _dbContext = dbContext;
        _fieldQueryService = fieldQueryService;
        _fieldValueService = fieldValueService;
        _encryptionService = encryptionService;
    }

    public async Task<IReadOnlyList<RoleSearchResponse>> SearchAsync(string query, RoleKeyRing keyRing, CancellationToken ct)
    {
        var normalized = query.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return Array.Empty<RoleSearchResponse>();
        }

        var nickFields = await _dbContext.RoleFields.AsNoTracking()
            .Where(x => x.FieldType == RoleFieldTypes.Nick)
            .ToListAsync(ct);
        if (nickFields.Count == 0)
        {
            return Array.Empty<RoleSearchResponse>();
        }

        var roleKindFields = await _dbContext.RoleFields.AsNoTracking()
            .Where(x => x.FieldType == RoleFieldTypes.RoleKind)
            .ToListAsync(ct);
        var allFields = nickFields.Concat(roleKindFields).ToList();

        var lookup = await _fieldQueryService.LoadAsync(allFields, keyRing, ct);
        var matches = new List<RoleSearchResponse>();

        foreach (var (roleId, values) in lookup.ValuesByRole)
        {
            if (!values.TryGetValue(RoleFieldTypes.Nick, out var nick))
            {
                continue;
            }

            if (!nick.Equals(normalized, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var roleKind = values.TryGetValue(RoleFieldTypes.RoleKind, out var kind) ? kind : "Role";
            matches.Add(new RoleSearchResponse(roleId, roleKind, nick));
        }

        return matches;
    }

    public async Task<IReadOnlyList<RoleResponse>> ListAsync(RoleKeyRing keyRing, CancellationToken ct)
    {
        var roleIds = keyRing.ReadKeys.Keys.ToList();
        if (roleIds.Count == 0)
        {
            return Array.Empty<RoleResponse>();
        }

        var roles = await _dbContext.Roles.AsNoTracking()
            .Where(role => roleIds.Contains(role.Id))
            .ToListAsync(ct);

        var fields = await _dbContext.RoleFields.AsNoTracking()
            .Where(field => roleIds.Contains(field.RoleId))
            .ToListAsync(ct);

        var lookup = await _fieldQueryService.LoadAsync(fields, keyRing, ct);

        var fieldsByRole = fields
            .GroupBy(x => x.RoleId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(field => new RoleFieldResponse(
                    field.Id,
                    field.FieldType,
                    _fieldValueService.TryGetPlainValue(field, keyRing, lookup.KeyEntryById),
                    field.DataKeyId
                )).ToList()
            );

        return roles
            .Select(role => new RoleResponse(
                role.Id,
                role.PublicSigningKey is null ? null : Convert.ToBase64String(role.PublicSigningKey),
                role.PublicSigningKeyAlg,
                fieldsByRole.TryGetValue(role.Id, out var list) ? list : new List<RoleFieldResponse>()
            ))
            .ToList();
    }

    public async Task<RoleGraphResponse> BuildGraphAsync(Guid userId, RoleKeyRing keyRing, CancellationToken ct)
    {
        var roleIds = keyRing.ReadKeys.Keys.ToList();
        if (roleIds.Count == 0)
        {
            return new RoleGraphResponse(new List<RoleGraphNode>(), new List<RoleGraphEdge>());
        }

        var account = await _dbContext.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, ct);

        var roleIdSet = roleIds.ToHashSet();
        var roles = await _dbContext.Roles.AsNoTracking()
            .Where(role => roleIdSet.Contains(role.Id))
            .ToListAsync(ct);

        var fields = await _dbContext.RoleFields.AsNoTracking()
            .Where(field => roleIdSet.Contains(field.RoleId))
            .ToListAsync(ct);

        var lookup = await _fieldQueryService.LoadAsync(fields, keyRing, ct);
        var valuesByRole = lookup.ValuesByRole;

        var membershipEdges = account is null
            ? new List<Membership>()
            : await _dbContext.Memberships.AsNoTracking()
                .Where(x => x.UserId == userId)
                .ToListAsync(ct);
        var ownerRoots = new List<Guid>();
        if (account is not null)
        {
            ownerRoots.Add(account.MasterRoleId);
            ownerRoots.AddRange(membershipEdges
                .Where(edge => edge.RelationshipType == RoleRelationships.Owner)
                .Select(edge => edge.RoleId));
        }

        var nodes = new List<RoleGraphNode>();
        var ownerRoleIds = account is null
            ? new HashSet<Guid>()
            : await RoleOwnership.GetOwnedRoleIdsAsync(ownerRoots, roleIdSet, _dbContext, ct);
        var writeRoleIds = keyRing.WriteKeys.Keys.ToHashSet();
        foreach (var role in roles)
        {
            valuesByRole.TryGetValue(role.Id, out var fieldValues);
            var roleKind = fieldValues is not null && fieldValues.TryGetValue(RoleFieldTypes.RoleKind, out var kindValue)
                ? kindValue
                : "Role";
            var label = fieldValues is not null && fieldValues.TryGetValue(RoleFieldTypes.Nick, out var nickValue)
                ? nickValue
                : $"{roleKind} {role.Id.ToString()[..8]}";
            nodes.Add(new RoleGraphNode(
                $"role:{role.Id:N}",
                label,
                "role",
                roleKind,
                null,
                role.Id,
                null,
                null,
                ownerRoleIds.Contains(role.Id),
                writeRoleIds.Contains(role.Id)));
        }

        var edges = new List<RoleGraphEdge>();

        var dataGrants = await _dbContext.DataKeyGrants.AsNoTracking()
            .Where(grant => roleIdSet.Contains(grant.RoleId) && grant.RevokedUtc == null)
            .ToListAsync(ct);

        if (dataGrants.Count > 0)
        {
            var dataItemIds = dataGrants.Select(grant => grant.DataItemId).Distinct().ToList();
            var dataItems = await _dbContext.DataItems.AsNoTracking()
                .Where(item => dataItemIds.Contains(item.Id))
                .ToListAsync(ct);

            var grantsByItem = dataGrants.GroupBy(grant => grant.DataItemId)
                .ToDictionary(group => group.Key, group => group.ToList());

            static byte[] BuildDataItemAad(Guid dataItemId, string itemName)
            {
                return System.Text.Encoding.UTF8.GetBytes($"{dataItemId:D}:{itemName}");
            }

            foreach (var item in dataItems)
            {
                var itemGrants = grantsByItem.TryGetValue(item.Id, out var list) ? list : new List<DataKeyGrant>();
                var canOwner = itemGrants.Any(grant => grant.PermissionType == RoleRelationships.Owner);
                var canWrite = itemGrants.Any(grant => RoleRelationships.AllowsWrite(grant.PermissionType));

                string? value = null;
                if (item.EncryptedValue is not null)
                {
                    foreach (var grant in itemGrants)
                    {
                        if (!keyRing.TryGetReadKey(grant.RoleId, out var readKey))
                        {
                            continue;
                        }
                        try
                        {
                            var dataKey = _encryptionService.Decrypt(readKey, grant.EncryptedDataKeyBlob, item.Id.ToByteArray());
                            var aad = BuildDataItemAad(item.Id, item.ItemName);
                            var plaintext = _encryptionService.Decrypt(dataKey, item.EncryptedValue, aad);
                            value = System.Text.Encoding.UTF8.GetString(plaintext);
                            break;
                        }
                        catch
                        {
                            continue;
                        }
                    }
                }

                var nodeType = item.ItemType == "key" || item.EncryptedValue is null ? "key" : "data";
                var dataNodeId = $"{nodeType}:{item.Id:N}";
                nodes.Add(new RoleGraphNode(
                    dataNodeId,
                    item.ItemName,
                    nodeType,
                    item.ItemType,
                    value,
                    item.OwnerRoleId,
                    item.ItemName,
                    item.Id,
                    canOwner,
                    canWrite));

                foreach (var grant in itemGrants)
                {
                    if (!roleIdSet.Contains(grant.RoleId))
                    {
                        continue;
                    }
                    var permission = ResolveVisiblePermission(grant.RoleId, grant.PermissionType, keyRing);
                    edges.Add(new RoleGraphEdge(
                        $"{grant.RoleId:N}:{item.Id:N}:{permission}",
                        $"role:{grant.RoleId:N}",
                        dataNodeId,
                        permission));
                }
            }
        }

        var recoveryShares = await _dbContext.RoleRecoveryShares.AsNoTracking()
            .Where(share => roleIdSet.Contains(share.TargetRoleId) && share.RevokedUtc == null)
            .ToListAsync(ct);
        foreach (var targetRoleId in recoveryShares.Select(x => x.TargetRoleId).Distinct())
        {
            var recoveryNodeId = $"recovery:{targetRoleId:N}";
            nodes.Add(new RoleGraphNode(
                recoveryNodeId,
                "Recovery key",
                "recovery",
                "Active",
                null,
                targetRoleId,
                null,
                null,
                ownerRoleIds.Contains(targetRoleId),
                false));
            edges.Add(new RoleGraphEdge(
                $"{recoveryNodeId}:role:{targetRoleId:N}:Owner",
                recoveryNodeId,
                $"role:{targetRoleId:N}",
                RoleRelationships.Owner));

            foreach (var share in recoveryShares.Where(x => x.TargetRoleId == targetRoleId))
            {
                if (!roleIdSet.Contains(share.SharedWithRoleId))
                {
                    continue;
                }
                edges.Add(new RoleGraphEdge(
                    $"role:{share.SharedWithRoleId:N}:{recoveryNodeId}:Owner",
                    $"role:{share.SharedWithRoleId:N}",
                    recoveryNodeId,
                    RoleRelationships.Owner));
            }
        }

        var roleEdges = await _dbContext.RoleEdges.AsNoTracking().ToListAsync(ct);
        edges.AddRange(roleEdges
            .Where(edge => roleIdSet.Contains(edge.ParentRoleId) && roleIdSet.Contains(edge.ChildRoleId))
            .Select(edge => new RoleGraphEdge(
                $"{edge.ParentRoleId:N}:{edge.ChildRoleId:N}:{ResolveVisiblePermission(edge.ParentRoleId, edge.RelationshipType, keyRing)}",
                $"role:{edge.ParentRoleId:N}",
                $"role:{edge.ChildRoleId:N}",
                ResolveVisiblePermission(edge.ParentRoleId, edge.RelationshipType, keyRing))));

        if (account is not null)
        {
            edges.AddRange(membershipEdges
                .Where(edge => roleIdSet.Contains(edge.RoleId))
                .Select(edge => new RoleGraphEdge(
                    $"{account.MasterRoleId:N}:{edge.RoleId:N}:{ResolveVisiblePermission(account.MasterRoleId, edge.RelationshipType, keyRing)}",
                    $"role:{account.MasterRoleId:N}",
                    $"role:{edge.RoleId:N}",
                    ResolveVisiblePermission(account.MasterRoleId, edge.RelationshipType, keyRing))));
        }

        return new RoleGraphResponse(nodes, edges);
    }

    private static string ResolveVisiblePermission(Guid roleId, string relationshipType, RoleKeyRing keyRing)
    {
        var normalized = RoleRelationships.Normalize(relationshipType);
        if (normalized == RoleRelationships.Read)
        {
            return normalized;
        }

        if (keyRing.TryGetWriteKey(roleId, out _))
        {
            return normalized;
        }

        return RoleRelationships.Read;
    }
}
