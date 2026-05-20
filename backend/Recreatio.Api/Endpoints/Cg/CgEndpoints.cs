using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Cg;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cg;

namespace Recreatio.Api.Endpoints.Cg;

public static class CgEndpoints
{
    private static readonly HashSet<string> ValidInputTypes =
        new(["text", "number", "date", "reference"], StringComparer.Ordinal);

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
    }
}
