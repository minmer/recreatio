using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Cg;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cg;

namespace Recreatio.Api.Endpoints.Cg;

public static class CgEndpoints
{
    private static readonly HashSet<string> ValidInputTypes =
        new(["text", "number", "date", "reference"], StringComparer.Ordinal);

    // ── Crypto helpers (placeholder — replace with AES + user session key) ──

    private static string EncryptValue(string plain) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(plain));

    private static string DecryptValue(string cipher) =>
        Encoding.UTF8.GetString(Convert.FromBase64String(cipher));

    // Lexicographic float: encodes first 6 chars into [0,1) preserving order.
    // Placeholder for order-preserving shift with user-derived private offset.
    private static double ComputeSearchFloat(string normalized)
    {
        const double CharRange = 65536.0;
        const int MaxChars = 6;
        double result = 0.0;
        double scale = 1.0 / CharRange;
        foreach (var ch in normalized.Take(MaxChars))
        {
            result += ch * scale;
            scale /= CharRange;
        }
        return result;
    }

    private static (double Min, double Max) SearchFloatRange(string prefix)
    {
        if (string.IsNullOrEmpty(prefix)) return (0.0, 1.0);
        double min = ComputeSearchFloat(prefix);
        const double CharRange = 65536.0;
        double rangeUnit = Math.Pow(1.0 / CharRange, Math.Min(prefix.Length, 6));
        return (min, min + rangeUnit);
    }

    // Placeholder for HMAC-based reference hash with user key.
    private static byte[] ComputeSearchHash(long libId, long fieldDefId, long refEntityId)
    {
        var input = $"{libId}:{fieldDefId}:{refEntityId}";
        return SHA256.HashData(Encoding.UTF8.GetBytes(input));
    }

    private static string NormalizeSearch(string value) =>
        value.Trim().ToLowerInvariant();

    public static void MapCgEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/cg");

        // ── Libraries ──────────────────────────────────────────────────────────

        group.MapGet("/libraries", async (HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var libs = await db.CgLibraries
                .AsNoTracking()
                .Where(x => x.OwnerAccountId == userId)
                .OrderBy(x => x.Name)
                .Select(x => new CgLibraryResponse(x.Id, x.Name,
                    new DateTimeOffset(x.CreatedUtc, TimeSpan.Zero),
                    new DateTimeOffset(x.UpdatedUtc, TimeSpan.Zero)))
                .ToListAsync(ct);

            return Results.Ok(libs);
        });

        group.MapPost("/libraries", async (CgLibraryCreateRequest req, HttpContext ctx,
            RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var name = req.Name?.Trim() ?? "";
            if (name.Length == 0)
                return Results.BadRequest(new { error = "Name is required." });
            if (name.Length > 200)
                return Results.BadRequest(new { error = "Name must be 200 characters or fewer." });

            var now = DateTime.UtcNow;
            var lib = new CgLibrary
            {
                OwnerAccountId = userId,
                Name = name,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.CgLibraries.Add(lib);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new CgLibraryResponse(lib.Id, lib.Name,
                new DateTimeOffset(lib.CreatedUtc, TimeSpan.Zero),
                new DateTimeOffset(lib.UpdatedUtc, TimeSpan.Zero)));
        });

        group.MapPut("/libraries/{libId:long}", async (long libId, CgLibraryRenameRequest req,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var name = req.Name?.Trim() ?? "";
            if (name.Length == 0)
                return Results.BadRequest(new { error = "Name is required." });
            if (name.Length > 200)
                return Results.BadRequest(new { error = "Name must be 200 characters or fewer." });

            lib.Name = name;
            lib.UpdatedUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new CgLibraryResponse(lib.Id, lib.Name,
                new DateTimeOffset(lib.CreatedUtc, TimeSpan.Zero),
                new DateTimeOffset(lib.UpdatedUtc, TimeSpan.Zero)));
        });

        group.MapDelete("/libraries/{libId:long}", async (long libId, HttpContext ctx,
            RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var typeIds = await db.CgTypeDefs
                .Where(x => x.LibraryId == libId)
                .Select(x => x.Id)
                .ToListAsync(ct);

            if (typeIds.Count > 0)
            {
                var fieldIds = await db.CgFieldDefs
                    .Where(x => typeIds.Contains(x.TypeDefId))
                    .Select(x => x.Id)
                    .ToListAsync(ct);

                if (fieldIds.Count > 0)
                    await db.CgFieldDefTargets
                        .Where(x => fieldIds.Contains(x.FieldDefId))
                        .ExecuteDeleteAsync(ct);

                await db.CgFieldDefs.Where(x => typeIds.Contains(x.TypeDefId)).ExecuteDeleteAsync(ct);
                await db.CgTypeDefs.Where(x => x.LibraryId == libId).ExecuteDeleteAsync(ct);
            }

            db.CgLibraries.Remove(lib);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ── Types ──────────────────────────────────────────────────────────────

        group.MapGet("/libraries/{libId:long}/types", async (long libId, HttpContext ctx,
            RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var types = await db.CgTypeDefs
                .AsNoTracking()
                .Where(x => x.LibraryId == libId)
                .OrderBy(x => x.Name)
                .ToListAsync(ct);

            var typeIds = types.Select(t => t.Id).ToList();
            var fieldCounts = await db.CgFieldDefs
                .AsNoTracking()
                .Where(x => typeIds.Contains(x.TypeDefId))
                .GroupBy(x => x.TypeDefId)
                .Select(g => new { TypeDefId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var countMap = fieldCounts.ToDictionary(x => x.TypeDefId, x => x.Count);

            var result = types.Select(t => new CgTypeDefResponse(
                t.Id, t.Name,
                countMap.GetValueOrDefault(t.Id, 0),
                new DateTimeOffset(t.CreatedUtc, TimeSpan.Zero),
                new DateTimeOffset(t.UpdatedUtc, TimeSpan.Zero)
            )).ToList();

            return Results.Ok(result);
        });

        group.MapPost("/libraries/{libId:long}/types", async (long libId, CgTypeDefCreateRequest req,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var name = req.Name?.Trim() ?? "";
            if (name.Length == 0)
                return Results.BadRequest(new { error = "Name is required." });
            if (name.Length > 200)
                return Results.BadRequest(new { error = "Name must be 200 characters or fewer." });

            var exists = await db.CgTypeDefs.AnyAsync(
                x => x.LibraryId == libId && x.Name == name, ct);
            if (exists)
                return Results.Conflict(new { error = "A type with this name already exists in this library." });

            var now = DateTime.UtcNow;
            var type = new CgTypeDef
            {
                LibraryId = libId,
                Name = name,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.CgTypeDefs.Add(type);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new CgTypeDefResponse(type.Id, type.Name, 0,
                new DateTimeOffset(type.CreatedUtc, TimeSpan.Zero),
                new DateTimeOffset(type.UpdatedUtc, TimeSpan.Zero)));
        });

        group.MapGet("/libraries/{libId:long}/types/{typeId:long}", async (long libId, long typeId,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var type = await db.CgTypeDefs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == typeId && x.LibraryId == libId, ct);
            if (type is null)
                return Results.NotFound();

            var fields = await db.CgFieldDefs.AsNoTracking()
                .Where(x => x.TypeDefId == typeId)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

            var fieldIds = fields.Select(f => f.Id).ToList();
            var targets = await db.CgFieldDefTargets.AsNoTracking()
                .Where(x => fieldIds.Contains(x.FieldDefId))
                .ToListAsync(ct);

            var targetMap = targets
                .GroupBy(x => x.FieldDefId)
                .ToDictionary(g => g.Key, g => g.Select(t => t.TargetTypeDefId).ToList());

            var fieldResponses = fields.Select(f => new CgFieldDefResponse(
                f.Id, f.Label, f.SortOrder, f.InputType, f.Multiple, f.IsOrdered,
                targetMap.GetValueOrDefault(f.Id, [])
            )).ToList();

            return Results.Ok(new CgTypeDefDetailResponse(
                type.Id, type.Name, fieldResponses,
                new DateTimeOffset(type.CreatedUtc, TimeSpan.Zero),
                new DateTimeOffset(type.UpdatedUtc, TimeSpan.Zero)
            ));
        });

        group.MapPut("/libraries/{libId:long}/types/{typeId:long}", async (long libId, long typeId,
            CgTypeDefRenameRequest req, HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var type = await db.CgTypeDefs
                .FirstOrDefaultAsync(x => x.Id == typeId && x.LibraryId == libId, ct);
            if (type is null)
                return Results.NotFound();

            var name = req.Name?.Trim() ?? "";
            if (name.Length == 0)
                return Results.BadRequest(new { error = "Name is required." });
            if (name.Length > 200)
                return Results.BadRequest(new { error = "Name must be 200 characters or fewer." });

            var conflict = await db.CgTypeDefs.AnyAsync(
                x => x.LibraryId == libId && x.Name == name && x.Id != typeId, ct);
            if (conflict)
                return Results.Conflict(new { error = "A type with this name already exists in this library." });

            type.Name = name;
            type.UpdatedUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            return Results.NoContent();
        });

        group.MapDelete("/libraries/{libId:long}/types/{typeId:long}", async (long libId, long typeId,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct,
            bool force = false) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var type = await db.CgTypeDefs
                .FirstOrDefaultAsync(x => x.Id == typeId && x.LibraryId == libId, ct);
            if (type is null)
                return Results.NotFound();

            // Check if any field in this library references this type as a target.
            var refs = await (
                from t in db.CgFieldDefTargets
                join f in db.CgFieldDefs on t.FieldDefId equals f.Id
                join td in db.CgTypeDefs on f.TypeDefId equals td.Id
                where t.TargetTypeDefId == typeId && td.LibraryId == libId && td.Id != typeId
                select new CgTypeDeleteConflictEntry(f.Id, f.Label, td.Id, td.Name)
            ).ToListAsync(ct);

            if (refs.Count > 0 && !force)
                return Results.Conflict(new CgTypeDeleteConflictResponse(refs));

            // Cascade: remove targets pointing to this type from other fields.
            await db.CgFieldDefTargets
                .Where(x => x.TargetTypeDefId == typeId)
                .ExecuteDeleteAsync(ct);

            // Remove this type's own fields and their targets.
            var ownFieldIds = await db.CgFieldDefs
                .Where(x => x.TypeDefId == typeId)
                .Select(x => x.Id)
                .ToListAsync(ct);

            if (ownFieldIds.Count > 0)
            {
                await db.CgFieldDefTargets
                    .Where(x => ownFieldIds.Contains(x.FieldDefId))
                    .ExecuteDeleteAsync(ct);
                await db.CgFieldDefs.Where(x => x.TypeDefId == typeId).ExecuteDeleteAsync(ct);
            }

            db.CgTypeDefs.Remove(type);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ── Fields ─────────────────────────────────────────────────────────────

        group.MapPut("/libraries/{libId:long}/types/{typeId:long}/fields", async (
            long libId, long typeId, CgFieldsSaveRequest req,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId))
                return Results.Unauthorized();

            var lib = await db.CgLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId)
                return Results.NotFound();

            var type = await db.CgTypeDefs
                .FirstOrDefaultAsync(x => x.Id == typeId && x.LibraryId == libId, ct);
            if (type is null)
                return Results.NotFound();

            // Validate input.
            var items = req.Fields ?? [];
            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                if (string.IsNullOrWhiteSpace(item.Label))
                    return Results.BadRequest(new { error = $"Field at position {i + 1} has no label." });
                if (!ValidInputTypes.Contains(item.InputType))
                    return Results.BadRequest(new { error = $"Invalid inputType '{item.InputType}' at position {i + 1}." });

                // Validate target type IDs belong to this library.
                if (item.InputType == "reference" && item.TargetTypeDefIds?.Count > 0)
                {
                    var validIds = await db.CgTypeDefs
                        .Where(x => item.TargetTypeDefIds.Contains(x.Id) && x.LibraryId == libId)
                        .Select(x => x.Id)
                        .ToListAsync(ct);
                    var invalidId = item.TargetTypeDefIds.FirstOrDefault(id => !validIds.Contains(id));
                    if (invalidId != 0)
                        return Results.BadRequest(new { error = $"Target type {invalidId} does not belong to this library." });
                }
            }

            var now = DateTime.UtcNow;
            var existingFields = await db.CgFieldDefs
                .Where(x => x.TypeDefId == typeId)
                .ToListAsync(ct);

            var existingIds = existingFields.Select(f => f.Id).ToHashSet();
            var incomingIds = items.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();

            // Delete fields not in the incoming list.
            var toDelete = existingFields.Where(f => !incomingIds.Contains(f.Id)).ToList();
            if (toDelete.Count > 0)
            {
                var deleteIds = toDelete.Select(f => f.Id).ToList();
                await db.CgFieldDefTargets.Where(x => deleteIds.Contains(x.FieldDefId)).ExecuteDeleteAsync(ct);
                db.CgFieldDefs.RemoveRange(toDelete);
            }

            var savedFields = new List<CgFieldDef>();

            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                CgFieldDef field;

                if (item.Id.HasValue && existingIds.Contains(item.Id.Value))
                {
                    field = existingFields.First(f => f.Id == item.Id.Value);
                    field.Label = item.Label.Trim();
                    field.SortOrder = i;
                    field.InputType = item.InputType;
                    field.Multiple = item.Multiple;
                    field.IsOrdered = item.IsOrdered;
                    field.UpdatedUtc = now;
                }
                else
                {
                    field = new CgFieldDef
                    {
                        TypeDefId = typeId,
                        Label = item.Label.Trim(),
                        SortOrder = i,
                        InputType = item.InputType,
                        Multiple = item.Multiple,
                        IsOrdered = item.IsOrdered,
                        CreatedUtc = now,
                        UpdatedUtc = now
                    };
                    db.CgFieldDefs.Add(field);
                }

                savedFields.Add(field);
            }

            await db.SaveChangesAsync(ct);

            // Rebuild targets for all saved fields.
            var savedFieldIds = savedFields.Where(f => f.Id > 0).Select(f => f.Id).ToList();
            await db.CgFieldDefTargets
                .Where(x => savedFieldIds.Contains(x.FieldDefId))
                .ExecuteDeleteAsync(ct);

            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                var field = savedFields[i];
                if (item.InputType != "reference" || item.TargetTypeDefIds is null)
                    continue;
                foreach (var targetId in item.TargetTypeDefIds)
                {
                    db.CgFieldDefTargets.Add(new CgFieldDefTarget
                    {
                        FieldDefId = field.Id,
                        TargetTypeDefId = targetId
                    });
                }
            }

            type.UpdatedUtc = now;
            await db.SaveChangesAsync(ct);

            // Return the updated type detail.
            var targets = await db.CgFieldDefTargets.AsNoTracking()
                .Where(x => savedFields.Select(f => f.Id).Contains(x.FieldDefId))
                .ToListAsync(ct);
            var targetMap = targets
                .GroupBy(x => x.FieldDefId)
                .ToDictionary(g => g.Key, g => g.Select(t => t.TargetTypeDefId).ToList());

            var fieldResponses = savedFields.Select(f => new CgFieldDefResponse(
                f.Id, f.Label, f.SortOrder, f.InputType, f.Multiple, f.IsOrdered,
                targetMap.GetValueOrDefault(f.Id, [])
            )).ToList();

            return Results.Ok(new CgTypeDefDetailResponse(
                type.Id, type.Name, fieldResponses,
                new DateTimeOffset(type.CreatedUtc, TimeSpan.Zero),
                new DateTimeOffset(type.UpdatedUtc, TimeSpan.Zero)
            ));
        });

        // ── Entities ───────────────────────────────────────────────────────────

        // GET /libraries/{libId}/types/{typeId}/entities?skip=0&limit=50
        group.MapGet("/libraries/{libId:long}/types/{typeId:long}/entities", async (
            long libId, long typeId,
            int skip, int limit,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId) return Results.NotFound();

            limit = Math.Clamp(limit == 0 ? 50 : limit, 1, 200);

            var entities = await db.CgEntities.AsNoTracking()
                .Where(e => e.LibraryId == libId && e.TypeDefId == typeId)
                .OrderByDescending(e => e.UpdatedUtc)
                .Skip(skip).Take(limit)
                .ToListAsync(ct);

            if (entities.Count == 0) return Results.Ok(Array.Empty<CgEntityListItem>());

            // Get first non-reference FieldDef for this type (display value).
            var firstField = await db.CgFieldDefs.AsNoTracking()
                .Where(f => f.TypeDefId == typeId && f.InputType != "reference")
                .OrderBy(f => f.SortOrder)
                .FirstOrDefaultAsync(ct);

            var entityIds = entities.Select(e => e.Id).ToList();
            var displayValues = new Dictionary<long, string>();

            if (firstField is not null)
            {
                var firstValues = await db.CgFieldValues.AsNoTracking()
                    .Where(v => entityIds.Contains(v.EntityId) && v.FieldDefId == firstField.Id)
                    .GroupBy(v => v.EntityId)
                    .Select(g => new { EntityId = g.Key, Value = g.OrderBy(v => v.SortOrder).First() })
                    .ToListAsync(ct);

                foreach (var fv in firstValues)
                    if (fv.Value.EncryptedValue is not null)
                        displayValues[fv.EntityId] = DecryptValue(fv.Value.EncryptedValue);
            }

            var items = entities.Select(e => new CgEntityListItem(
                e.Id,
                displayValues.GetValueOrDefault(e.Id, ""),
                new DateTimeOffset(e.CreatedUtc, TimeSpan.Zero),
                new DateTimeOffset(e.UpdatedUtc, TimeSpan.Zero)
            )).ToList();

            return Results.Ok(items);
        });

        // POST /libraries/{libId}/types/{typeId}/entities
        group.MapPost("/libraries/{libId:long}/types/{typeId:long}/entities", async (
            long libId, long typeId, CgEntitySaveRequest req,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId) return Results.NotFound();

            var typeDef = await db.CgTypeDefs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == typeId && x.LibraryId == libId, ct);
            if (typeDef is null) return Results.NotFound();

            var fieldDefs = await db.CgFieldDefs.AsNoTracking()
                .Where(f => f.TypeDefId == typeId)
                .ToListAsync(ct);
            var fieldDefMap = fieldDefs.ToDictionary(f => f.Id);

            var now = DateTime.UtcNow;
            var entity = new CgEntity { LibraryId = libId, TypeDefId = typeId, CreatedUtc = now, UpdatedUtc = now };
            db.CgEntities.Add(entity);
            await db.SaveChangesAsync(ct);

            foreach (var v in req.Values ?? [])
            {
                if (!fieldDefMap.TryGetValue(v.FieldDefId, out var fd)) continue;
                var fv = new CgFieldValue
                {
                    EntityId = entity.Id,
                    FieldDefId = v.FieldDefId,
                    SortOrder = v.SortOrder
                };
                if (fd.InputType == "reference")
                {
                    fv.RefEntityId = v.RefEntityId;
                    if (v.RefEntityId.HasValue)
                        fv.SearchHash = ComputeSearchHash(libId, v.FieldDefId, v.RefEntityId.Value);
                }
                else if (!string.IsNullOrEmpty(v.PlainValue))
                {
                    var normalized = NormalizeSearch(v.PlainValue);
                    fv.EncryptedValue = EncryptValue(v.PlainValue);
                    fv.SearchFloat = ComputeSearchFloat(normalized);
                }
                db.CgFieldValues.Add(fv);
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(await BuildEntityDetail(entity.Id, libId, db, ct));
        });

        // GET /libraries/{libId}/entities/{entityId}
        group.MapGet("/libraries/{libId:long}/entities/{entityId:long}", async (
            long libId, long entityId,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId) return Results.NotFound();

            var entity = await db.CgEntities.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == entityId && e.LibraryId == libId, ct);
            if (entity is null) return Results.NotFound();

            return Results.Ok(await BuildEntityDetail(entityId, libId, db, ct));
        });

        // PUT /libraries/{libId}/entities/{entityId}
        group.MapPut("/libraries/{libId:long}/entities/{entityId:long}", async (
            long libId, long entityId, CgEntitySaveRequest req,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId) return Results.NotFound();

            var entity = await db.CgEntities
                .FirstOrDefaultAsync(e => e.Id == entityId && e.LibraryId == libId, ct);
            if (entity is null) return Results.NotFound();

            var fieldDefs = await db.CgFieldDefs.AsNoTracking()
                .Where(f => f.TypeDefId == entity.TypeDefId)
                .ToListAsync(ct);
            var fieldDefMap = fieldDefs.ToDictionary(f => f.Id);

            // Replace all field values.
            await db.CgFieldValues.Where(v => v.EntityId == entityId).ExecuteDeleteAsync(ct);

            var now = DateTime.UtcNow;
            entity.UpdatedUtc = now;

            foreach (var v in req.Values ?? [])
            {
                if (!fieldDefMap.TryGetValue(v.FieldDefId, out var fd)) continue;
                var fv = new CgFieldValue
                {
                    EntityId = entityId,
                    FieldDefId = v.FieldDefId,
                    SortOrder = v.SortOrder
                };
                if (fd.InputType == "reference")
                {
                    fv.RefEntityId = v.RefEntityId;
                    if (v.RefEntityId.HasValue)
                        fv.SearchHash = ComputeSearchHash(libId, v.FieldDefId, v.RefEntityId.Value);
                }
                else if (!string.IsNullOrEmpty(v.PlainValue))
                {
                    var normalized = NormalizeSearch(v.PlainValue);
                    fv.EncryptedValue = EncryptValue(v.PlainValue);
                    fv.SearchFloat = ComputeSearchFloat(normalized);
                }
                db.CgFieldValues.Add(fv);
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(await BuildEntityDetail(entityId, libId, db, ct));
        });

        // DELETE /libraries/{libId}/entities/{entityId}
        group.MapDelete("/libraries/{libId:long}/entities/{entityId:long}", async (
            long libId, long entityId,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId) return Results.NotFound();

            var entity = await db.CgEntities
                .FirstOrDefaultAsync(e => e.Id == entityId && e.LibraryId == libId, ct);
            if (entity is null) return Results.NotFound();

            await db.CgFieldValues.Where(v => v.EntityId == entityId).ExecuteDeleteAsync(ct);
            db.CgEntities.Remove(entity);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // GET /libraries/{libId}/entities/search?term=...&typeIds=1,2,3&limit=20
        group.MapGet("/libraries/{libId:long}/entities/search", async (
            long libId, string term, string? typeIds, int limit,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId) return Results.NotFound();

            var normalized = NormalizeSearch(term ?? "");
            if (string.IsNullOrEmpty(normalized)) return Results.Ok(Array.Empty<CgEntitySearchItem>());

            limit = Math.Clamp(limit == 0 ? 20 : limit, 1, 50);

            // Parse optional type filter.
            var typeIdFilter = typeIds?
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => long.TryParse(s, out var id) ? id : 0L)
                .Where(id => id > 0)
                .ToHashSet();

            // Find first non-reference FieldDef per relevant type.
            var allTypeDefs = await db.CgTypeDefs.AsNoTracking()
                .Where(t => t.LibraryId == libId)
                .ToListAsync(ct);

            var relevantTypeIds = typeIdFilter?.Count > 0
                ? allTypeDefs.Where(t => typeIdFilter.Contains(t.Id)).Select(t => t.Id).ToList()
                : allTypeDefs.Select(t => t.Id).ToList();

            var typeDefMap = allTypeDefs.ToDictionary(t => t.Id);

            var allFieldDefs = await db.CgFieldDefs.AsNoTracking()
                .Where(f => relevantTypeIds.Contains(f.TypeDefId) && f.InputType != "reference")
                .OrderBy(f => f.SortOrder)
                .ToListAsync(ct);

            var firstFieldIds = allFieldDefs
                .GroupBy(f => f.TypeDefId)
                .Select(g => g.First().Id)
                .ToHashSet();

            if (firstFieldIds.Count == 0) return Results.Ok(Array.Empty<CgEntitySearchItem>());

            var (minFloat, maxFloat) = SearchFloatRange(normalized);

            // Phase 1: range query on SearchFloat.
            var candidates = await db.CgFieldValues.AsNoTracking()
                .Where(v => firstFieldIds.Contains(v.FieldDefId)
                         && v.SearchFloat >= minFloat
                         && v.SearchFloat < maxFloat)
                .Take(limit * 5)
                .ToListAsync(ct);

            var candidateEntityIds = candidates.Select(v => v.EntityId).Distinct().ToList();

            var entities = await db.CgEntities.AsNoTracking()
                .Where(e => candidateEntityIds.Contains(e.Id) && e.LibraryId == libId)
                .ToDictionaryAsync(e => e.Id, ct);

            // Phase 2: decrypt and verify.
            var results = new List<CgEntitySearchItem>();
            foreach (var v in candidates)
            {
                if (results.Count >= limit) break;
                if (!entities.TryGetValue(v.EntityId, out var entity)) continue;
                if (v.EncryptedValue is null) continue;

                var plain = DecryptValue(v.EncryptedValue);
                if (!plain.ToLowerInvariant().Contains(normalized)) continue;

                if (!typeDefMap.TryGetValue(entity.TypeDefId, out var typeDef)) continue;

                results.Add(new CgEntitySearchItem(entity.Id, plain, entity.TypeDefId, typeDef.Name));
            }

            return Results.Ok(results);
        });

        // POST /libraries/{libId}/entities/resolve  — batch display value lookup
        group.MapPost("/libraries/{libId:long}/entities/resolve", async (
            long libId, CgEntityResolveRequest req,
            HttpContext ctx, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(ctx, out var userId)) return Results.Unauthorized();
            var lib = await db.CgLibraries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == libId, ct);
            if (lib is null || lib.OwnerAccountId != userId) return Results.NotFound();

            var ids = (req.EntityIds ?? []).Distinct().Take(200).ToList();
            if (ids.Count == 0) return Results.Ok(Array.Empty<CgEntitySearchItem>());

            var entities = await db.CgEntities.AsNoTracking()
                .Where(e => ids.Contains(e.Id) && e.LibraryId == libId)
                .ToListAsync(ct);

            var typeIds = entities.Select(e => e.TypeDefId).Distinct().ToList();
            var typeDefs = await db.CgTypeDefs.AsNoTracking()
                .Where(t => typeIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, ct);

            // First non-reference field per type.
            var fieldDefs = await db.CgFieldDefs.AsNoTracking()
                .Where(f => typeIds.Contains(f.TypeDefId) && f.InputType != "reference")
                .OrderBy(f => f.SortOrder)
                .ToListAsync(ct);
            var firstFieldByType = fieldDefs
                .GroupBy(f => f.TypeDefId)
                .ToDictionary(g => g.Key, g => g.First().Id);

            var fieldValueMap = firstFieldByType.Values.Distinct().ToList();
            var entityIds = entities.Select(e => e.Id).ToList();

            var firstValues = await db.CgFieldValues.AsNoTracking()
                .Where(v => entityIds.Contains(v.EntityId) && fieldValueMap.Contains(v.FieldDefId))
                .GroupBy(v => v.EntityId)
                .Select(g => new { EntityId = g.Key, Value = g.OrderBy(v => v.SortOrder).First() })
                .ToListAsync(ct);

            var displayMap = firstValues
                .Where(x => x.Value.EncryptedValue is not null)
                .ToDictionary(x => x.EntityId, x => DecryptValue(x.Value.EncryptedValue!));

            var result = entities
                .Where(e => typeDefs.ContainsKey(e.TypeDefId))
                .Select(e => new CgEntitySearchItem(
                    e.Id,
                    displayMap.GetValueOrDefault(e.Id, ""),
                    e.TypeDefId,
                    typeDefs[e.TypeDefId].Name
                ))
                .ToList();

            return Results.Ok(result);
        });
    }

    // ── Shared helper ──────────────────────────────────────────────────────────

    private static async Task<CgEntityDetailResponse> BuildEntityDetail(
        long entityId, long libId, RecreatioDbContext db, CancellationToken ct)
    {
        var entity = await db.CgEntities.AsNoTracking()
            .FirstAsync(e => e.Id == entityId, ct);

        var typeDef = await db.CgTypeDefs.AsNoTracking()
            .FirstAsync(t => t.Id == entity.TypeDefId, ct);

        var fieldDefs = await db.CgFieldDefs.AsNoTracking()
            .Where(f => f.TypeDefId == entity.TypeDefId)
            .OrderBy(f => f.SortOrder)
            .ToListAsync(ct);

        var targets = await db.CgFieldDefTargets.AsNoTracking()
            .Where(t => fieldDefs.Select(f => f.Id).Contains(t.FieldDefId))
            .ToListAsync(ct);

        var values = await db.CgFieldValues.AsNoTracking()
            .Where(v => v.EntityId == entityId)
            .ToListAsync(ct);

        // Resolve display values for all referenced entities.
        var refEntityIds = values.Where(v => v.RefEntityId.HasValue)
            .Select(v => v.RefEntityId!.Value).Distinct().ToList();

        var refEntities = refEntityIds.Count > 0
            ? await db.CgEntities.AsNoTracking()
                .Where(e => refEntityIds.Contains(e.Id))
                .ToListAsync(ct)
            : [];

        var refTypeIds = refEntities.Select(e => e.TypeDefId).Distinct().ToList();
        var refTypeDefs = refTypeIds.Count > 0
            ? await db.CgTypeDefs.AsNoTracking()
                .Where(t => refTypeIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, ct)
            : new Dictionary<long, CgTypeDef>();

        var refFieldDefs = refTypeIds.Count > 0
            ? await db.CgFieldDefs.AsNoTracking()
                .Where(f => refTypeIds.Contains(f.TypeDefId) && f.InputType != "reference")
                .OrderBy(f => f.SortOrder)
                .ToListAsync(ct)
            : [];

        var refFirstFieldByType = refFieldDefs
            .GroupBy(f => f.TypeDefId)
            .ToDictionary(g => g.Key, g => g.First().Id);

        var refFirstValues = refEntityIds.Count > 0
            ? await db.CgFieldValues.AsNoTracking()
                .Where(v => refEntityIds.Contains(v.EntityId)
                         && refFirstFieldByType.Values.Contains(v.FieldDefId))
                .ToListAsync(ct)
            : [];

        var refDisplayMap = new Dictionary<long, (string Display, long TypeDefId)>();
        foreach (var re in refEntities)
        {
            if (!refFirstFieldByType.TryGetValue(re.TypeDefId, out var firstFieldId)) continue;
            var fv = refFirstValues.Where(v => v.EntityId == re.Id && v.FieldDefId == firstFieldId)
                .OrderBy(v => v.SortOrder).FirstOrDefault();
            var display = fv?.EncryptedValue is not null ? DecryptValue(fv.EncryptedValue) : "";
            refDisplayMap[re.Id] = (display, re.TypeDefId);
        }

        var valuesByField = values.GroupBy(v => v.FieldDefId)
            .ToDictionary(g => g.Key, g => g.OrderBy(v => v.SortOrder).ToList());

        var fieldResponses = fieldDefs.Select(fd =>
        {
            var fieldValues = valuesByField.GetValueOrDefault(fd.Id, []);
            var valueResponses = fieldValues.Select(v =>
            {
                string? plainValue = null;
                string? refDisplay = null;
                long? refTypeDefId = null;
                string? refTypeName = null;

                if (fd.InputType == "reference" && v.RefEntityId.HasValue)
                {
                    if (refDisplayMap.TryGetValue(v.RefEntityId.Value, out var rd))
                    {
                        refDisplay = rd.Display;
                        refTypeDefId = rd.TypeDefId;
                        refTypeDefs.TryGetValue(rd.TypeDefId, out var rdt);
                        refTypeName = rdt?.Name;
                    }
                }
                else if (v.EncryptedValue is not null)
                {
                    plainValue = DecryptValue(v.EncryptedValue);
                }

                return new CgEntityValueResponse(
                    v.Id, v.SortOrder, plainValue,
                    v.RefEntityId, refDisplay, refTypeDefId, refTypeName);
            }).ToList();

            return new CgEntityFieldResponse(
                fd.Id, fd.Label, fd.InputType, fd.Multiple, fd.IsOrdered, valueResponses);
        }).ToList();

        return new CgEntityDetailResponse(
            entity.Id, entity.TypeDefId, typeDef.Name, fieldResponses,
            new DateTimeOffset(entity.CreatedUtc, TimeSpan.Zero),
            new DateTimeOffset(entity.UpdatedUtc, TimeSpan.Zero));
    }
}
