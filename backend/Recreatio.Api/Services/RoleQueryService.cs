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
    private readonly IKeyRingService _keyRingService;

    public RoleQueryService(
        RecreatioDbContext dbContext,
        IRoleFieldQueryService fieldQueryService,
        IRoleFieldValueService fieldValueService,
        IEncryptionService encryptionService,
        IKeyRingService keyRingService)
    {
        _dbContext = dbContext;
        _fieldQueryService = fieldQueryService;
        _fieldValueService = fieldValueService;
        _encryptionService = encryptionService;
        _keyRingService = keyRingService;
    }

    public async Task<IReadOnlyList<RoleSearchResponse>> SearchAsync(string query, RoleKeyRing keyRing, CancellationToken ct)
    {
        var normalized = query.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return Array.Empty<RoleSearchResponse>();
        }

        var allFields = await _dbContext.RoleFields.AsNoTracking()
            .ToListAsync(ct);
        if (allFields.Count == 0)
        {
            return Array.Empty<RoleSearchResponse>();
        }

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
                group => group.Select(field =>
                {
                    var plainValue = _fieldValueService.TryGetPlainValue(field, keyRing, lookup.KeyEntryById);
                    return new RoleFieldResponse(
                        field.Id,
                        field.FieldType,
                        plainValue,
                        field.DataKeyId
                    );
                }).ToList()
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

        var roleIdSet = roleIds.ToHashSet();
        var roles = await _dbContext.Roles.AsNoTracking()
            .Where(role => roleIdSet.Contains(role.Id))
            .ToListAsync(ct);

        var fields = await _dbContext.RoleFields.AsNoTracking()
            .Where(field => roleIdSet.Contains(field.RoleId))
            .ToListAsync(ct);

        var lookup = await _fieldQueryService.LoadAsync(fields, keyRing, ct);
        var valuesByRole = lookup.ValuesByRole;

        var nodes = new List<RoleGraphNode>();
        var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();
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

            foreach (var item in dataItems)
            {
                var itemGrants = grantsByItem.TryGetValue(item.Id, out var list) ? list : new List<DataKeyGrant>();
                var canOwner = itemGrants.Any(grant => grant.PermissionType == RoleRelationships.Owner);
                var canWrite = itemGrants.Any(grant => RoleRelationships.AllowsWrite(grant.PermissionType));

                string? itemName = null;
                string itemType = "data";
                if (keyRing.TryGetReadKey(item.OwnerRoleId, out var ownerReadKey))
                {
                    itemName = _keyRingService.TryDecryptDataItemMeta(ownerReadKey, item.EncryptedItemName, item.Id, "item-name");
                    var resolvedType = _keyRingService.TryDecryptDataItemMeta(ownerReadKey, item.EncryptedItemType, item.Id, "item-type");
                    if (!string.IsNullOrWhiteSpace(resolvedType))
                    {
                        itemType = resolvedType;
                    }
                }

                string? value = null;
                if (item.EncryptedValue is not null && !string.IsNullOrWhiteSpace(itemName))
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
                            var aad = System.Text.Encoding.UTF8.GetBytes($"{item.Id:D}:{itemName}");
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

                var normalizedType = itemType.Trim().ToLowerInvariant();
                var nodeType = normalizedType == "key" || item.EncryptedValue is null ? "key" : "data";
                var dataNodeId = $"{nodeType}:{item.Id:N}";
                var label = string.IsNullOrWhiteSpace(itemName) ? $"Data {item.Id.ToString()[..8]}" : itemName;
                nodes.Add(new RoleGraphNode(
                    dataNodeId,
                    label,
                    nodeType,
                    normalizedType,
                    value,
                    item.OwnerRoleId,
                    itemName,
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
            .Select(edge =>
            {
                var relationship = RoleRelationships.Read;
                if (keyRing.TryGetReadKey(edge.ParentRoleId, out var parentReadKey))
                {
                    var decrypted = _keyRingService.TryDecryptRoleRelationshipType(parentReadKey, edge.EncryptedRelationshipType, edge.Id);
                    if (!string.IsNullOrWhiteSpace(decrypted))
                    {
                        relationship = RoleRelationships.Normalize(decrypted);
                    }
                }

                var permission = ResolveVisiblePermission(edge.ParentRoleId, relationship, keyRing);
                return new RoleGraphEdge(
                    $"{edge.ParentRoleId:N}:{edge.ChildRoleId:N}:{permission}",
                    $"role:{edge.ParentRoleId:N}",
                    $"role:{edge.ChildRoleId:N}",
                    permission);
            }));

        var account = await _dbContext.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        var membershipEdges = account is null
            ? new List<Membership>()
            : await _dbContext.Memberships.AsNoTracking()
                .Where(edge => edge.UserId == userId)
                .ToListAsync(ct);

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

        if (normalized == RoleRelationships.Owner)
        {
            if (keyRing.TryGetOwnerKey(roleId, out _))
            {
                return RoleRelationships.Owner;
            }
        }

        if (keyRing.TryGetWriteKey(roleId, out _))
        {
            return normalized == RoleRelationships.Owner ? RoleRelationships.Write : normalized;
        }

        return RoleRelationships.Read;
    }
}
