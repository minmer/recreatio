using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Security;
using Recreatio.Api.Services;
using Recreatio.Api.Services.Events;

namespace Recreatio.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/auth");

        group.MapGet("/csrf", (ICsrfService csrfService, HttpContext context) =>
        {
            var token = csrfService.IssueToken(context);
            return Results.Ok(new { token });
        });

        group.MapPost("/register", async (RegisterRequest request, IAuthService authService, ICsrfService csrfService, HttpContext context, CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = await authService.RegisterAsync(request, ct);
                return Results.Ok(new { userId });
            }
            catch (InvalidOperationException ex)
            {
                return EndpointHelpers.MapAuthException(ex);
            }
        }).RequireRateLimiting("auth");

        group.MapGet("/salt", async (string loginId, IAuthService authService, CancellationToken ct) =>
        {
            var response = await authService.GetSaltAsync(loginId, ct);
            return Results.Ok(response);
        }).RequireRateLimiting("auth");

        group.MapGet("/availability", async (string loginId, IAuthService authService, CancellationToken ct) =>
        {
            var response = await authService.CheckAvailabilityAsync(loginId, ct);
            return Results.Ok(response);
        }).RequireRateLimiting("auth");

        group.MapPost("/login", async (LoginRequest request, IAuthService authService, ICsrfService csrfService, HttpContext context, RecreatioDbContext dbContext, GalleryPhotoOffload offload, CancellationToken ct) =>
        {
            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            try
            {
                var response = await authService.LoginAsync(request, ct);
                await EndpointHelpers.SignInAsync(context, response.UserId, response.SessionId, response.SecureMode, request.RememberMe, request.H3Base64);
                csrfService.IssueToken(context);

                /*
                 * THE ONE-OFF MOVE OF THE GALLERY OUT OF THE DATABASE.
                 *
                 * 61 MB of photographs are in `events.EventGalleryPhotos.Data`,
                 * in a data file that is 0.2 MB short of a hard 250 MB ceiling.
                 * When that ceiling is reached every write fails, not just
                 * uploads. This is what empties it.
                 *
                 * It runs on the administrator's sign-in because that is when
                 * the person who would want to know about it is present — and
                 * because it ENDS: once the last photograph has moved, the
                 * check below is a single indexed count that finds nothing.
                 *
                 * It does NOT run inside this request. `RequestRun` returns at
                 * once and the work happens behind it; 61 MB of copying is not
                 * something to make somebody wait for, least of all the one
                 * person who can fix anything that goes wrong.
                 *
                 * Nothing here can fail the login: the check is wrapped, and a
                 * maintenance job is never a reason to refuse a session.
                 */
                try
                {
                    if (await GalleryOffloadTrigger.ShouldRunForAsync(dbContext, response.UserId, ct))
                    {
                        offload.RequestRun();
                    }
                }
                catch (Exception)
                {
                    // Deliberately swallowed. Logged inside the service when it
                    // actually runs; here it must not touch the response.
                }

                return Results.Ok(new { response.UserId, response.SessionId, response.SecureMode });
            }
            catch (InvalidOperationException ex)
            {
                return EndpointHelpers.MapAuthException(ex);
            }
        }).RequireRateLimiting("auth");

        group.MapPost("/password-change", async (PasswordChangeRequest request, IAuthService authService, ICsrfService csrfService, HttpContext context, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            try
            {
                await authService.ChangePasswordAsync(userId, request, ct);
                var h3Base64 = request.H3NewBase64;
                if (EndpointHelpers.TryGetSessionId(context, out var sessionId))
                {
                    var secureMode = AuthClaims.IsSecureMode(context.User);
                    var rememberMe = AuthClaims.IsRememberMe(context.User);
                    await EndpointHelpers.SignInAsync(context, userId, sessionId, secureMode, rememberMe, h3Base64);
                }
                return Results.Ok();
            }
            catch (InvalidOperationException ex)
            {
                return EndpointHelpers.MapAuthException(ex);
            }
        }).RequireAuthorization();

        group.MapPost("/logout", async (HttpContext context, ISessionService sessionService, ICsrfService csrfService, RecreatioDbContext dbContext, IKeyRingService keyRingService, IEncryptionService encryptionService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) || !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var signingContext = await TryGetSigningContextAsync(context, userId, sessionId, dbContext, keyRingService, encryptionService, ct);
            await sessionService.LogoutAsync(userId, sessionId, ct, signingContext);
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok();
        }).RequireAuthorization();

        group.MapPost("/session/mode", async (SessionModeRequest request, HttpContext context, ISessionService sessionService, ICsrfService csrfService, RecreatioDbContext dbContext, IKeyRingService keyRingService, IEncryptionService encryptionService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) || !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (!csrfService.Validate(context))
            {
                return Results.Forbid();
            }

            var signingContext = await TryGetSigningContextAsync(context, userId, sessionId, dbContext, keyRingService, encryptionService, ct);
            var session = await sessionService.SetSecureModeAsync(userId, sessionId, request.SecureMode, ct, signingContext);
            var h3Base64 = AuthClaims.GetH3Base64(context.User);
            if (!string.IsNullOrWhiteSpace(h3Base64))
            {
                var rememberMe = AuthClaims.IsRememberMe(context.User);
                await EndpointHelpers.SignInAsync(context, userId, session.SessionId, session.IsSecureMode, rememberMe, h3Base64);
            }
            return Results.Ok(new { session.SessionId, session.IsSecureMode });
        }).RequireAuthorization();

        group.MapGet("/me", async (HttpContext context, ISessionService sessionService, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId) || !EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            var session = await sessionService.RequireSessionAsync(userId, sessionId, ct);
            return Results.Ok(new { UserId = userId, session.SessionId, session.IsSecureMode });
        }).RequireAuthorization();
    }

    private static async Task<LedgerSigningContext?> TryGetSigningContextAsync(
        HttpContext context,
        Guid userId,
        string sessionId,
        RecreatioDbContext dbContext,
        IKeyRingService keyRingService,
        IEncryptionService encryptionService,
        CancellationToken ct)
    {
        var account = await dbContext.UserAccounts
            .Include(x => x.MasterRole)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (account?.MasterRole is null)
        {
            return null;
        }

        RoleKeyRing keyRing;
        try
        {
            keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
        }
        catch (InvalidOperationException)
        {
            return null;
        }

        if (!keyRing.TryGetOwnerKey(account.MasterRoleId, out var ownerKey))
        {
            return null;
        }

        return LedgerSigning.TryCreate(account.MasterRole, ownerKey, encryptionService);
    }
}
