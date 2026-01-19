using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints;

public static class AccountRoleVerificationEndpoints
{
    public static void MapAccountRoleVerificationEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/roles/{roleId:guid}/verify", async (
            Guid roleId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            ILedgerVerificationService ledgerVerificationService,
            ILogger<AccountRoleVerificationEndpoints> logger,
            CancellationToken ct) =>
        {
            try
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

                if (!keyRing.TryGetReadKey(roleId, out _))
                {
                    return Results.Forbid();
                }

                var authEntries = await dbContext.AuthLedger.AsNoTracking()
                    .OrderBy(entry => entry.TimestampUtc)
                    .ThenBy(entry => entry.Id)
                    .ToListAsync(ct);
                var keyEntries = await dbContext.KeyLedger.AsNoTracking()
                    .OrderBy(entry => entry.TimestampUtc)
                    .ThenBy(entry => entry.Id)
                    .ToListAsync(ct);
                var businessEntries = await dbContext.BusinessLedger.AsNoTracking()
                    .OrderBy(entry => entry.TimestampUtc)
                    .ThenBy(entry => entry.Id)
                    .ToListAsync(ct);

                var response = new RoleLedgerVerificationResponse(
                    roleId,
                    new List<LedgerVerificationSummary>
                    {
                        await ledgerVerificationService.VerifyLedgerAsync("Auth", authEntries.Select(LedgerEntrySnapshot.From).ToList(), roleId, ct),
                        await ledgerVerificationService.VerifyLedgerAsync("Key", keyEntries.Select(LedgerEntrySnapshot.From).ToList(), roleId, ct),
                        await ledgerVerificationService.VerifyLedgerAsync("Business", businessEntries.Select(LedgerEntrySnapshot.From).ToList(), roleId, ct)
                    });

                return Results.Ok(response);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to verify ledgers for role {RoleId}.", roleId);
                return Results.Problem("Failed to verify ledgers.");
            }
        });
    }
}
