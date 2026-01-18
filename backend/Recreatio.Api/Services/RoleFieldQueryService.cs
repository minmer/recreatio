using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;
using Recreatio.Api.Security;

namespace Recreatio.Api.Services;

public sealed record RoleFieldLookup(
    Dictionary<Guid, KeyEntry> KeyEntryById,
    Dictionary<Guid, Dictionary<string, string>> ValuesByRole);

public interface IRoleFieldQueryService
{
    Task<RoleFieldLookup> LoadAsync(IReadOnlyCollection<RoleField> fields, RoleKeyRing keyRing, CancellationToken ct);
}

public sealed class RoleFieldQueryService : IRoleFieldQueryService
{
    private readonly RecreatioDbContext _dbContext;
    private readonly IRoleFieldValueService _fieldValueService;

    public RoleFieldQueryService(RecreatioDbContext dbContext, IRoleFieldValueService fieldValueService)
    {
        _dbContext = dbContext;
        _fieldValueService = fieldValueService;
    }

    public async Task<RoleFieldLookup> LoadAsync(IReadOnlyCollection<RoleField> fields, RoleKeyRing keyRing, CancellationToken ct)
    {
        var keyEntryById = new Dictionary<Guid, KeyEntry>();
        var valuesByRole = new Dictionary<Guid, Dictionary<string, string>>();

        if (fields.Count == 0)
        {
            return new RoleFieldLookup(keyEntryById, valuesByRole);
        }

        var dataKeyIds = fields.Select(x => x.DataKeyId).Distinct().ToHashSet();
        if (dataKeyIds.Count == 0)
        {
            return new RoleFieldLookup(keyEntryById, valuesByRole);
        }

        var keyEntries = await _dbContext.Keys.AsNoTracking()
            .Where(key => dataKeyIds.Contains(key.Id))
            .ToListAsync(ct);
        keyEntryById = keyEntries.ToDictionary(x => x.Id, x => x);

        foreach (var field in fields)
        {
            var plain = _fieldValueService.TryGetPlainValue(field, keyRing, keyEntryById);
            if (string.IsNullOrWhiteSpace(plain))
            {
                continue;
            }

            if (!valuesByRole.TryGetValue(field.RoleId, out var fieldValues))
            {
                fieldValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                valuesByRole[field.RoleId] = fieldValues;
            }

            fieldValues[field.FieldType] = plain;
        }

        return new RoleFieldLookup(keyEntryById, valuesByRole);
    }
}
