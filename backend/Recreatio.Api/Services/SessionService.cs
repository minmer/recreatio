using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;
using Recreatio.Api.Security;

namespace Recreatio.Api.Services;

public interface ISessionService
{
    Task<Session> RequireSessionAsync(Guid userId, string sessionId, CancellationToken ct);
    Task LogoutAsync(Guid userId, string sessionId, CancellationToken ct, LedgerSigningContext? signingContext = null);
    Task<Session> SetSecureModeAsync(Guid userId, string sessionId, bool secureMode, CancellationToken ct, LedgerSigningContext? signingContext = null);
}

public sealed class SessionService : ISessionService
{
    private readonly RecreatioDbContext _dbContext;
    private readonly ISessionSecretCache _sessionSecretCache;
    private readonly ILedgerService _ledgerService;

    public SessionService(RecreatioDbContext dbContext, ISessionSecretCache sessionSecretCache, ILedgerService ledgerService)
    {
        _dbContext = dbContext;
        _sessionSecretCache = sessionSecretCache;
        _ledgerService = ledgerService;
    }

    public async Task<Session> RequireSessionAsync(Guid userId, string sessionId, CancellationToken ct)
    {
        var session = await _dbContext.Sessions.FirstOrDefaultAsync(
            x => x.UserId == userId && x.SessionId == sessionId && !x.IsRevoked, ct);

        if (session is null)
        {
            throw new InvalidOperationException("Session not found.");
        }

        session.LastActivityUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(ct);
        return session;
    }

    public async Task LogoutAsync(Guid userId, string sessionId, CancellationToken ct, LedgerSigningContext? signingContext = null)
    {
        var session = await _dbContext.Sessions.FirstOrDefaultAsync(
            x => x.UserId == userId && x.SessionId == sessionId && !x.IsRevoked, ct);

        if (session is null)
        {
            return;
        }

        session.IsRevoked = true;
        session.LastActivityUtc = DateTimeOffset.UtcNow;
        _sessionSecretCache.Remove(session.SessionId);
        await _dbContext.SaveChangesAsync(ct);
        await _ledgerService.AppendAuthAsync("Logout", userId.ToString(), JsonSerializer.Serialize(new { sessionId }), ct, signingContext);
    }

    public async Task<Session> SetSecureModeAsync(Guid userId, string sessionId, bool secureMode, CancellationToken ct, LedgerSigningContext? signingContext = null)
    {
        var session = await RequireSessionAsync(userId, sessionId, ct);
        if (session.IsSecureMode == secureMode)
        {
            return session;
        }

        session.IsSecureMode = secureMode;
        session.LastActivityUtc = DateTimeOffset.UtcNow;
        if (secureMode)
        {
            _sessionSecretCache.Remove(session.SessionId);
        }

        await _dbContext.SaveChangesAsync(ct);
        await _ledgerService.AppendAuthAsync(
            "SessionModeChanged",
            userId.ToString(),
            JsonSerializer.Serialize(new { sessionId, secureMode }),
            ct,
            signingContext);

        return session;
    }
}
