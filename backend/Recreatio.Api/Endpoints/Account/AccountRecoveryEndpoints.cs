using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Domain;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRecoveryEndpoints
{
    public static void MapAccountRecoveryEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/roles/{roleId:guid}/recovery/activate", async (
            Guid roleId,
            RecoveryActivateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            IAsymmetricEncryptionService asymmetricEncryptionService,
            IEncryptionService encryptionService,
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

            if (!keyRing.TryGetWriteKey(roleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(roleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            if (request.SharedWithRoleIds is null || request.SharedWithRoleIds.Count == 0)
            {
                return Results.BadRequest(new { error = "At least one SharedWithRoleId is required." });
            }

            var ownerRoleIds = keyRing.OwnerKeys.Keys.ToHashSet();
            if (!ownerRoleIds.Contains(roleId))
            {
                return Results.Forbid();
            }

            var shareRoleIds = request.SharedWithRoleIds
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();
            if (shareRoleIds.Count == 0)
            {
                return Results.BadRequest(new { error = "No recovery shares provided." });
            }
            var shareRoles = await dbContext.Roles.AsNoTracking()
                .Where(role => shareRoleIds.Contains(role.Id))
                .ToListAsync(ct);
            if (shareRoles.Count != shareRoleIds.Count)
            {
                return Results.BadRequest(new { error = "Shared roles not found." });
            }

            var now = DateTimeOffset.UtcNow;
            var recoveryKey = RandomNumberGenerator.GetBytes(32);
            var serverPart = recoveryKey.ToArray();

            var existingShares = await dbContext.RoleRecoveryShares
                .Where(x => x.TargetRoleId == roleId && x.RevokedUtc == null)
                .ToListAsync(ct);
            foreach (var share in existingShares)
            {
                share.RevokedUtc = now;
            }

            foreach (var shareRole in shareRoles)
            {
                var sharePart = RandomNumberGenerator.GetBytes(32);
                for (var i = 0; i < serverPart.Length; i++)
                {
                    serverPart[i] ^= sharePart[i];
                }

                if (shareRole.PublicEncryptionKey is null || string.IsNullOrWhiteSpace(shareRole.PublicEncryptionKeyAlg))
                {
                    return Results.BadRequest(new { error = "Shared role has no public encryption key." });
                }

                var encryptedShare = asymmetricEncryptionService.EncryptWithPublicKey(
                    shareRole.PublicEncryptionKey,
                    shareRole.PublicEncryptionKeyAlg,
                    sharePart);

                dbContext.RoleRecoveryShares.Add(new RoleRecoveryShare
                {
                    Id = Guid.NewGuid(),
                    TargetRoleId = roleId,
                    SharedWithRoleId = shareRole.Id,
                    EncryptedShareBlob = encryptedShare,
                    CreatedUtc = now
                });
            }

            var existingKeys = await dbContext.RoleRecoveryKeys
                .Where(x => x.TargetRoleId == roleId && x.RevokedUtc == null)
                .ToListAsync(ct);
            foreach (var key in existingKeys)
            {
                key.RevokedUtc = now;
            }

            dbContext.RoleRecoveryKeys.Add(new RoleRecoveryKey
            {
                Id = Guid.NewGuid(),
                TargetRoleId = roleId,
                EncryptedServerShare = encryptionService.Encrypt(writeKey, serverPart, roleId.ToByteArray()),
                CreatedUtc = now
            });

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, ownerKey, ct);
            await ledgerService.AppendKeyAsync(
                "RecoveryKeyActivated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, sharedWithRoleIds = shareRoleIds, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        });

        group.MapPost("/roles/{roleId:guid}/recovery/shares", (Guid roleId) =>
        {
            return Results.BadRequest(new { error = "Use /account/roles/{roleId}/recovery/activate to create recovery keys." });
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request", async (Guid roleId, RecoveryRequestCreate request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IEncryptionService encryptionService, IRoleCryptoService roleCryptoService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetWriteKey(roleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(roleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var activeShares = await dbContext.RoleRecoveryShares.AsNoTracking()
                .Where(x => x.TargetRoleId == roleId && x.RevokedUtc == null)
                .CountAsync(ct);

            if (activeShares == 0)
            {
                return Results.BadRequest(new { error = "No recovery shares exist." });
            }

            var now = DateTimeOffset.UtcNow;
            var recovery = new RoleRecoveryRequest
            {
                Id = Guid.NewGuid(),
                TargetRoleId = roleId,
                InitiatorRoleId = request.InitiatorRoleId,
                Status = "Pending",
                RequiredApprovals = activeShares,
                CreatedUtc = now
            };

            dbContext.RoleRecoveryRequests.Add(recovery);
            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, ownerKey, ct);

            await ledgerService.AppendAuthAsync(
                "RecoveryRequestCreated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId = recovery.Id, requiredApprovals = activeShares, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request/{requestId:guid}/approve", async (Guid roleId, Guid requestId, RecoveryApproveRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IEncryptionService encryptionService, IRoleCryptoService roleCryptoService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetWriteKey(request.ApproverRoleId, out var approverWriteKey) ||
                !keyRing.TryGetOwnerKey(request.ApproverRoleId, out var approverOwnerKey))
            {
                return Results.Forbid();
            }

            var recovery = await dbContext.RoleRecoveryRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.TargetRoleId == roleId, ct);
            if (recovery is null)
            {
                return Results.NotFound();
            }

            if (recovery.CanceledUtc is not null || recovery.CompletedUtc is not null)
            {
                return Results.BadRequest(new { error = "Recovery request is not active." });
            }

            var shareExists = await dbContext.RoleRecoveryShares.AsNoTracking()
                .AnyAsync(x => x.TargetRoleId == roleId && x.SharedWithRoleId == request.ApproverRoleId && x.RevokedUtc == null, ct);
            if (!shareExists)
            {
                return Results.Forbid();
            }

            var existing = await dbContext.RoleRecoveryApprovals
                .FirstOrDefaultAsync(x => x.RequestId == requestId && x.ApproverRoleId == request.ApproverRoleId, ct);
            if (existing is not null)
            {
                return Results.Conflict(new { error = "Already approved." });
            }

            dbContext.RoleRecoveryApprovals.Add(new RoleRecoveryApproval
            {
                Id = Guid.NewGuid(),
                RequestId = requestId,
                ApproverRoleId = request.ApproverRoleId,
                EncryptedApprovalBlob = Convert.FromBase64String(request.EncryptedApprovalBase64),
                CreatedUtc = DateTimeOffset.UtcNow
            });

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(request.ApproverRoleId, approverOwnerKey, ct);

            await ledgerService.AppendAuthAsync(
                "RecoveryApprovalAdded",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId, approverRoleId = request.ApproverRoleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            var approvals = await dbContext.RoleRecoveryApprovals.CountAsync(x => x.RequestId == requestId, ct);
            if (approvals >= recovery.RequiredApprovals && recovery.Status != "Ready")
            {
                recovery.Status = "Ready";
                await ledgerService.AppendAuthAsync(
                    "RecoveryRequestReady",
                    userId.ToString(),
                    JsonSerializer.Serialize(new { roleId, requestId }),
                    ct,
                    signingContext);
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request/{requestId:guid}/cancel", async (Guid roleId, Guid requestId, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IEncryptionService encryptionService, IRoleCryptoService roleCryptoService, ILedgerService ledgerService, CancellationToken ct) =>
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

            if (!keyRing.TryGetWriteKey(roleId, out var writeKey) ||
                !keyRing.TryGetOwnerKey(roleId, out var ownerKey))
            {
                return Results.Forbid();
            }

            var recovery = await dbContext.RoleRecoveryRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.TargetRoleId == roleId, ct);
            if (recovery is null)
            {
                return Results.NotFound();
            }

            if (recovery.CanceledUtc is not null || recovery.CompletedUtc is not null)
            {
                return Results.BadRequest(new { error = "Recovery request is not active." });
            }

            recovery.Status = "Canceled";
            recovery.CanceledUtc = DateTimeOffset.UtcNow;

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, ownerKey, ct);

            await ledgerService.AppendAuthAsync(
                "RecoveryRequestCanceled",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });

        group.MapPost("/roles/{roleId:guid}/recovery/request/{requestId:guid}/complete", async (Guid roleId, Guid requestId, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IEncryptionService encryptionService, IRoleCryptoService roleCryptoService, ILedgerService ledgerService, CancellationToken ct) =>
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

            var recovery = await dbContext.RoleRecoveryRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.TargetRoleId == roleId, ct);
            if (recovery is null)
            {
                return Results.NotFound();
            }

            if (recovery.CanceledUtc is not null || recovery.CompletedUtc is not null)
            {
                return Results.BadRequest(new { error = "Recovery request is not active." });
            }

            if (recovery.Status != "Ready")
            {
                return Results.BadRequest(new { error = "Recovery request is not ready." });
            }

            recovery.Status = "Completed";
            recovery.CompletedUtc = DateTimeOffset.UtcNow;

            var shares = await dbContext.RoleRecoveryShares
                .Where(x => x.TargetRoleId == roleId && x.RevokedUtc == null)
                .ToListAsync(ct);

            foreach (var share in shares)
            {
                share.RevokedUtc = DateTimeOffset.UtcNow;
            }

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, ownerKey, ct);

            await ledgerService.AppendAuthAsync(
                "RecoveryRequestCompleted",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, requestId }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new RecoveryRequestResponse(recovery.Id, recovery.Status, recovery.RequiredApprovals));
        });
    }
}
