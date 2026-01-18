using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRecoveryEndpoints
{
    public static void MapAccountRecoveryEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/roles/{roleId:guid}/recovery/shares", async (Guid roleId, RecoveryShareRequest request, HttpContext context, RecreatioDbContext dbContext, IKeyRingService keyRingService, IEncryptionService encryptionService, IRoleCryptoService roleCryptoService, ILedgerService ledgerService, CancellationToken ct) =>
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

            var share = await dbContext.RoleRecoveryShares
                .FirstOrDefaultAsync(x => x.TargetRoleId == roleId && x.SharedWithRoleId == request.SharedWithRoleId, ct);

            var now = DateTimeOffset.UtcNow;
            if (share is null)
            {
                share = new RoleRecoveryShare
                {
                    Id = Guid.NewGuid(),
                    TargetRoleId = roleId,
                    SharedWithRoleId = request.SharedWithRoleId,
                    EncryptedShareBlob = Convert.FromBase64String(request.EncryptedShareBase64),
                    CreatedUtc = now
                };
                dbContext.RoleRecoveryShares.Add(share);
            }
            else
            {
                share.EncryptedShareBlob = Convert.FromBase64String(request.EncryptedShareBase64);
                share.RevokedUtc = null;
            }

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);

            await ledgerService.AppendKeyAsync(
                "RecoveryShareUpdated",
                userId.ToString(),
                JsonSerializer.Serialize(new { roleId, sharedWithRoleId = request.SharedWithRoleId, signature = request.SignatureBase64 }),
                ct,
                signingContext);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
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

            if (!keyRing.TryGetWriteKey(roleId, out var writeKey))
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
            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);

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

            if (!keyRing.TryGetWriteKey(request.ApproverRoleId, out var approverWriteKey))
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

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(request.ApproverRoleId, approverWriteKey, ct);

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

            recovery.Status = "Canceled";
            recovery.CanceledUtc = DateTimeOffset.UtcNow;

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);

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

            var signingContext = await roleCryptoService.TryGetSigningContextAsync(roleId, writeKey, ct);

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
