using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
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

    public RoleQueryService(
        RecreatioDbContext dbContext,
        IRoleFieldQueryService fieldQueryService,
        IRoleFieldValueService fieldValueService)
    {
        _dbContext = dbContext;
        _fieldQueryService = fieldQueryService;
        _fieldValueService = fieldValueService;
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

        foreach (var field in fields)
        {
            if (RoleFieldTypes.IsSystemField(field.FieldType))
            {
                continue;
            }

            valuesByRole.TryGetValue(field.RoleId, out var fieldValues);
            string? value = null;
            if (fieldValues is not null && fieldValues.TryGetValue(field.FieldType, out var resolved))
            {
                value = resolved;
            }
            var dataNodeId = $"data:{field.Id:N}";
            nodes.Add(new RoleGraphNode(
                dataNodeId,
                field.FieldType,
                "data",
                field.FieldType,
                value,
                field.RoleId,
                field.FieldType,
                field.DataKeyId,
                false,
                false));
            edges.Add(new RoleGraphEdge(
                $"{field.RoleId:N}:{field.Id:N}:data",
                $"role:{field.RoleId:N}",
                dataNodeId,
                "Data"));
        }

        var recoveryPlans = await _dbContext.RoleRecoveryPlans.AsNoTracking()
            .Where(plan => roleIdSet.Contains(plan.TargetRoleId) && plan.ActivatedUtc == null)
            .ToListAsync(ct);
        if (recoveryPlans.Count > 0)
        {
            var planIds = recoveryPlans.Select(plan => plan.Id).ToList();
            var planShares = await _dbContext.RoleRecoveryPlanShares.AsNoTracking()
                .Where(share => planIds.Contains(share.PlanId))
                .ToListAsync(ct);
            foreach (var plan in recoveryPlans)
            {
                var recoveryNodeId = $"recovery-plan:{plan.Id:N}";
                nodes.Add(new RoleGraphNode(
                    recoveryNodeId,
                    "Recovery key",
                    "recovery_plan",
                    "Draft",
                    null,
                    plan.TargetRoleId,
                    null,
                    null,
                    ownerRoleIds.Contains(plan.TargetRoleId),
                    false));
                edges.Add(new RoleGraphEdge(
                    $"role:{plan.TargetRoleId:N}:{recoveryNodeId}:recovery-owner",
                    $"role:{plan.TargetRoleId:N}",
                    recoveryNodeId,
                    "RecoveryOwner"));

                foreach (var share in planShares.Where(x => x.PlanId == plan.Id))
                {
                    if (!roleIdSet.Contains(share.SharedWithRoleId))
                    {
                        continue;
                    }
                    edges.Add(new RoleGraphEdge(
                        $"{recoveryNodeId}:role:{share.SharedWithRoleId:N}:recovery-access",
                        recoveryNodeId,
                        $"role:{share.SharedWithRoleId:N}",
                        "RecoveryAccess"));
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
                false,
                false));
            edges.Add(new RoleGraphEdge(
                $"role:{targetRoleId:N}:{recoveryNodeId}:recovery-owner",
                $"role:{targetRoleId:N}",
                recoveryNodeId,
                "RecoveryOwner"));

            foreach (var share in recoveryShares.Where(x => x.TargetRoleId == targetRoleId))
            {
                if (!roleIdSet.Contains(share.SharedWithRoleId))
                {
                    continue;
                }
                edges.Add(new RoleGraphEdge(
                    $"{recoveryNodeId}:role:{share.SharedWithRoleId:N}:recovery-access",
                    recoveryNodeId,
                    $"role:{share.SharedWithRoleId:N}",
                    "RecoveryAccess"));
            }
        }

        var roleEdges = await _dbContext.RoleEdges.AsNoTracking().ToListAsync(ct);
        edges.AddRange(roleEdges
            .Where(edge => roleIdSet.Contains(edge.ParentRoleId) && roleIdSet.Contains(edge.ChildRoleId))
            .Select(edge => new RoleGraphEdge(
                $"{edge.ParentRoleId:N}:{edge.ChildRoleId:N}:{edge.RelationshipType}",
                $"role:{edge.ParentRoleId:N}",
                $"role:{edge.ChildRoleId:N}",
                RoleRelationships.Normalize(edge.RelationshipType))));

        if (account is not null)
        {
            edges.AddRange(membershipEdges
                .Where(edge => roleIdSet.Contains(edge.RoleId))
                .Select(edge => new RoleGraphEdge(
                    $"{account.MasterRoleId:N}:{edge.RoleId:N}:{edge.RelationshipType}",
                    $"role:{account.MasterRoleId:N}",
                    $"role:{edge.RoleId:N}",
                    RoleRelationships.Normalize(edge.RelationshipType))));
        }

        return new RoleGraphResponse(nodes, edges);
    }
}
