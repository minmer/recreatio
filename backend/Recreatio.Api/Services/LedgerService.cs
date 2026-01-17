using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;

namespace Recreatio.Api.Services;

public sealed record LedgerSigningContext(
    Guid SignerRoleId,
    byte[] PrivateSigningKey,
    string SignatureAlg);

public interface ILedgerService
{
    Task<AuthLedgerEntry> AppendAuthAsync(string eventType, string actor, string payloadJson, CancellationToken ct, LedgerSigningContext? signingContext = null);
    Task<KeyLedgerEntry> AppendKeyAsync(string eventType, string actor, string payloadJson, CancellationToken ct, LedgerSigningContext? signingContext = null);
    Task<BusinessLedgerEntry> AppendBusinessAsync(string eventType, string actor, string payloadJson, CancellationToken ct, LedgerSigningContext? signingContext = null);
}

public sealed class LedgerService : ILedgerService
{
    private readonly RecreatioDbContext _dbContext;
    private readonly IAsymmetricSigningService _signingService;

    public LedgerService(RecreatioDbContext dbContext, IAsymmetricSigningService signingService)
    {
        _dbContext = dbContext;
        _signingService = signingService;
    }

    public Task<AuthLedgerEntry> AppendAuthAsync(string eventType, string actor, string payloadJson, CancellationToken ct, LedgerSigningContext? signingContext = null)
    {
        return AppendAsync<AuthLedgerEntry>(_dbContext.AuthLedger, eventType, actor, payloadJson, ct, signingContext);
    }

    public Task<KeyLedgerEntry> AppendKeyAsync(string eventType, string actor, string payloadJson, CancellationToken ct, LedgerSigningContext? signingContext = null)
    {
        return AppendAsync<KeyLedgerEntry>(_dbContext.KeyLedger, eventType, actor, payloadJson, ct, signingContext);
    }

    public Task<BusinessLedgerEntry> AppendBusinessAsync(string eventType, string actor, string payloadJson, CancellationToken ct, LedgerSigningContext? signingContext = null)
    {
        return AppendAsync<BusinessLedgerEntry>(_dbContext.BusinessLedger, eventType, actor, payloadJson, ct, signingContext);
    }

    private async Task<TLedger> AppendAsync<TLedger>(DbSet<TLedger> ledger, string eventType, string actor, string payloadJson, CancellationToken ct, LedgerSigningContext? signingContext)
        where TLedger : class, new()
    {
        var previous = await ledger.OrderByDescending(x => EF.Property<DateTimeOffset>(x, "TimestampUtc"))
            .FirstOrDefaultAsync(ct);

        var previousHash = previous is null
            ? Array.Empty<byte>()
            : (byte[])(previous.GetType().GetProperty("Hash")?.GetValue(previous) ?? Array.Empty<byte>());

        var entry = new TLedger();
        entry.GetType().GetProperty("Id")?.SetValue(entry, Guid.NewGuid());
        var timestamp = DateTimeOffset.UtcNow;
        entry.GetType().GetProperty("TimestampUtc")?.SetValue(entry, timestamp);
        entry.GetType().GetProperty("EventType")?.SetValue(entry, eventType);
        entry.GetType().GetProperty("Actor")?.SetValue(entry, actor);
        entry.GetType().GetProperty("PayloadJson")?.SetValue(entry, payloadJson);
        entry.GetType().GetProperty("PreviousHash")?.SetValue(entry, previousHash);
        var signerRoleId = signingContext?.SignerRoleId;
        var signatureAlg = signingContext?.SignatureAlg;
        if (signerRoleId is not null)
        {
            entry.GetType().GetProperty("SignerRoleId")?.SetValue(entry, signerRoleId);
        }
        if (!string.IsNullOrWhiteSpace(signatureAlg))
        {
            entry.GetType().GetProperty("SignatureAlg")?.SetValue(entry, signatureAlg);
        }
        var hash = LedgerHashing.ComputeHash(previousHash, timestamp, eventType, actor, payloadJson, signerRoleId, signatureAlg);
        entry.GetType().GetProperty("Hash")?.SetValue(entry, hash);

        if (signingContext is not null)
        {
            var signature = _signingService.Sign(signingContext.PrivateSigningKey, signingContext.SignatureAlg, hash);
            entry.GetType().GetProperty("Signature")?.SetValue(entry, signature);
        }

        ledger.Add(entry);
        await _dbContext.SaveChangesAsync(ct);
        return entry;
    }

}
