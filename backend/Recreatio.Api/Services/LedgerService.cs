using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;

namespace Recreatio.Api.Services;

public interface ILedgerService
{
    Task<AuthLedgerEntry> AppendAuthAsync(string eventType, string actor, string payloadJson, CancellationToken ct);
    Task<KeyLedgerEntry> AppendKeyAsync(string eventType, string actor, string payloadJson, CancellationToken ct);
    Task<BusinessLedgerEntry> AppendBusinessAsync(string eventType, string actor, string payloadJson, CancellationToken ct);
}

public sealed class LedgerService : ILedgerService
{
    private readonly RecreatioDbContext _dbContext;

    public LedgerService(RecreatioDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<AuthLedgerEntry> AppendAuthAsync(string eventType, string actor, string payloadJson, CancellationToken ct)
    {
        return AppendAsync<AuthLedgerEntry>(_dbContext.AuthLedger, eventType, actor, payloadJson, ct);
    }

    public Task<KeyLedgerEntry> AppendKeyAsync(string eventType, string actor, string payloadJson, CancellationToken ct)
    {
        return AppendAsync<KeyLedgerEntry>(_dbContext.KeyLedger, eventType, actor, payloadJson, ct);
    }

    public Task<BusinessLedgerEntry> AppendBusinessAsync(string eventType, string actor, string payloadJson, CancellationToken ct)
    {
        return AppendAsync<BusinessLedgerEntry>(_dbContext.BusinessLedger, eventType, actor, payloadJson, ct);
    }

    private async Task<TLedger> AppendAsync<TLedger>(DbSet<TLedger> ledger, string eventType, string actor, string payloadJson, CancellationToken ct)
        where TLedger : class, new()
    {
        var previous = await ledger.OrderByDescending(x => EF.Property<DateTimeOffset>(x, "TimestampUtc"))
            .FirstOrDefaultAsync(ct);

        var previousHash = previous is null
            ? Array.Empty<byte>()
            : (byte[])(previous.GetType().GetProperty("Hash")?.GetValue(previous) ?? Array.Empty<byte>());

        var entry = new TLedger();
        entry.GetType().GetProperty("Id")?.SetValue(entry, Guid.NewGuid());
        entry.GetType().GetProperty("TimestampUtc")?.SetValue(entry, DateTimeOffset.UtcNow);
        entry.GetType().GetProperty("EventType")?.SetValue(entry, eventType);
        entry.GetType().GetProperty("Actor")?.SetValue(entry, actor);
        entry.GetType().GetProperty("PayloadJson")?.SetValue(entry, payloadJson);
        entry.GetType().GetProperty("PreviousHash")?.SetValue(entry, previousHash);
        entry.GetType().GetProperty("Hash")?.SetValue(entry, ComputeHash(previousHash, eventType, actor, payloadJson));

        ledger.Add(entry);
        await _dbContext.SaveChangesAsync(ct);
        return entry;
    }

    private static byte[] ComputeHash(byte[] previousHash, string eventType, string actor, string payloadJson)
    {
        var payloadBytes = Encoding.UTF8.GetBytes($"{eventType}|{actor}|{payloadJson}");
        var combined = new byte[previousHash.Length + payloadBytes.Length];
        Buffer.BlockCopy(previousHash, 0, combined, 0, previousHash.Length);
        Buffer.BlockCopy(payloadBytes, 0, combined, previousHash.Length, payloadBytes.Length);
        return SHA256.HashData(combined);
    }
}
