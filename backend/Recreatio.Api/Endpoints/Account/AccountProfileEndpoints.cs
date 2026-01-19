using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;

namespace Recreatio.Api.Endpoints;

public static class AccountProfileEndpoints
{
    public static void MapAccountProfileEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/profile", async (HttpContext context, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new ProfileResponse(account.LoginId, account.DisplayName));
        });

        group.MapPost("/profile", async (ProfileUpdateRequest request, HttpContext context, RecreatioDbContext dbContext, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var account = await dbContext.UserAccounts.FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            var displayName = request.DisplayName?.Trim();
            if (displayName is { Length: > 128 })
            {
                return Results.BadRequest(new { error = "DisplayName too long." });
            }

            account.DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName;
            account.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new ProfileResponse(account.LoginId, account.DisplayName));
        });
    }
}
