using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRoleFieldEndpoints
{
    public static void MapAccountRoleFieldEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/roles/{roleId:guid}/fields", async (
            Guid roleId,
            UpdateRoleFieldRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            RoleKeyRing keyRing;
            try
            {
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetReadKey(roleId, out var readKey) || !keyRing.TryGetWriteKey(roleId, out var writeKey))
            {
                return Results.Forbid();
            }

            var fieldType = request.FieldType.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(fieldType))
            {
                return Results.BadRequest(new { error = "FieldType is required." });
            }

            var plainValue = request.PlainValue?.Trim();
            if (string.IsNullOrWhiteSpace(plainValue))
            {
                return Results.BadRequest(new { error = "PlainValue is required." });
            }

            var existing = await dbContext.RoleFields
                .FirstOrDefaultAsync(x => x.RoleId == roleId && x.FieldType == fieldType, ct);

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);
            var now = DateTimeOffset.UtcNow;
            if (existing is null)
            {
                var dataKeyId = Guid.NewGuid();
                var dataKey = RandomNumberGenerator.GetBytes(32);
                var encryptedDataKey = keyRingService.EncryptDataKey(readKey, dataKey, dataKeyId);
                var keyLedger = await ledgerService.AppendKeyAsync(
                    "RoleFieldKeyCreated",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, fieldType, dataKeyId, signature = request.SignatureBase64 }),
                    ct,
                    signingContext);

                dbContext.Keys.Add(new KeyEntry
                {
                    Id = dataKeyId,
                    KeyType = KeyType.DataKey,
                    OwnerRoleId = roleId,
                    Version = 1,
                    EncryptedKeyBlob = encryptedDataKey,
                    MetadataJson = JsonSerializer.Serialize(new { fieldType }),
                    LedgerRefId = keyLedger.Id,
                    CreatedUtc = now
                });

                existing = new RoleField
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    FieldType = fieldType,
                    DataKeyId = dataKeyId,
                    EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.RoleFields.Add(existing);
            }
            else
            {
                var keyEntry = await dbContext.Keys.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == existing.DataKeyId && x.KeyType == KeyType.DataKey, ct);
                if (keyEntry is null)
                {
                    return Results.BadRequest(new { error = "DataKey missing for field." });
                }

                var dataKey = keyRingService.DecryptDataKey(keyEntry, readKey);
                existing.EncryptedValue = keyRingService.EncryptFieldValue(dataKey, plainValue, roleId, fieldType);
                existing.UpdatedUtc = now;
            }

            await ledgerService.AppendBusinessAsync(
                "RoleFieldUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, fieldType, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new RoleFieldResponse(
                existing.Id,
                existing.FieldType,
                plainValue,
                existing.DataKeyId
            ));
        });

        group.MapDelete("/roles/{roleId:guid}/fields/{fieldId:guid}", async (
            Guid roleId,
            Guid fieldId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IRoleCryptoService roleCryptoService,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            RoleKeyRing keyRing;
            try
            {
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.TryGetWriteKey(roleId, out var writeKey))
            {
                return Results.Forbid();
            }

            var field = await dbContext.RoleFields
                .FirstOrDefaultAsync(x => x.Id == fieldId && x.RoleId == roleId, ct);
            if (field is null)
            {
                return Results.NotFound();
            }

            if (RoleFieldTypes.IsSystemField(field.FieldType))
            {
                return Results.BadRequest(new { error = "System fields cannot be deleted." });
            }

            var dataKey = await dbContext.Keys
                .FirstOrDefaultAsync(x => x.Id == field.DataKeyId && x.KeyType == KeyType.DataKey && x.OwnerRoleId == roleId, ct);

            dbContext.RoleFields.Remove(field);
            await dbContext.SaveChangesAsync(ct);

            if (dataKey is not null)
            {
                dbContext.Keys.Remove(dataKey);
            }
            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);

            await ledgerService.AppendBusinessAsync(
                "RoleFieldDeleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, fieldId, fieldType = field.FieldType }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
