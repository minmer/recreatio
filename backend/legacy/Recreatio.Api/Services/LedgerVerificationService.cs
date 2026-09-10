using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;

namespace Recreatio.Api.Services;

public sealed record LedgerEntrySnapshot(
    DateTimeOffset TimestampUtc,
    string EventType,
    string Actor,
    string PayloadJson,
    byte[] PreviousHash,
    byte[] Hash,
    Guid? SignerRoleId,
    byte[]? Signature,
    string? SignatureAlg)
{
    public static LedgerEntrySnapshot From(AuthLedgerEntry entry) =>
        new(entry.TimestampUtc, entry.EventType, entry.Actor, entry.PayloadJson, entry.PreviousHash, entry.Hash, entry.SignerRoleId, entry.Signature, entry.SignatureAlg);

    public static LedgerEntrySnapshot From(KeyLedgerEntry entry) =>
        new(entry.TimestampUtc, entry.EventType, entry.Actor, entry.PayloadJson, entry.PreviousHash, entry.Hash, entry.SignerRoleId, entry.Signature, entry.SignatureAlg);

    public static LedgerEntrySnapshot From(BusinessLedgerEntry entry) =>
        new(entry.TimestampUtc, entry.EventType, entry.Actor, entry.PayloadJson, entry.PreviousHash, entry.Hash, entry.SignerRoleId, entry.Signature, entry.SignatureAlg);
}

public interface ILedgerVerificationService
{
    Task<LedgerVerificationSummary> VerifyLedgerAsync(string ledgerName, List<LedgerEntrySnapshot> entries, Guid roleId, CancellationToken ct);
}

public sealed class LedgerVerificationService : ILedgerVerificationService
{
    private readonly RecreatioDbContext _dbContext;
    private readonly IAsymmetricSigningService _signingService;

    public LedgerVerificationService(RecreatioDbContext dbContext, IAsymmetricSigningService signingService)
    {
        _dbContext = dbContext;
        _signingService = signingService;
    }

    public async Task<LedgerVerificationSummary> VerifyLedgerAsync(string ledgerName, List<LedgerEntrySnapshot> entries, Guid roleId, CancellationToken ct)
    {
        if (entries.Count == 0)
        {
            return new LedgerVerificationSummary(ledgerName, 0, 0, 0, 0, 0, 0, 0, 0);
        }

        var signerRoleIds = entries
            .Where(entry => entry.SignerRoleId.HasValue)
            .Select(entry => entry.SignerRoleId!.Value)
            .Distinct()
            .ToList();

        var roles = await _dbContext.Roles.AsNoTracking()
            .Where(role => signerRoleIds.Contains(role.Id))
            .Select(role => new
            {
                role.Id,
                role.PublicSigningKey,
                role.PublicSigningKeyAlg
            })
            .ToListAsync(ct);

        var signerKeys = roles
            .Where(role => role.PublicSigningKey is not null && !string.IsNullOrWhiteSpace(role.PublicSigningKeyAlg))
            .ToDictionary(role => role.Id, role => new { Key = role.PublicSigningKey!, Alg = role.PublicSigningKeyAlg! });

        var previousHash = Array.Empty<byte>();
        var hashMismatches = 0;
        var previousHashMismatches = 0;
        var signaturesVerified = 0;
        var signaturesMissing = 0;
        var signaturesInvalid = 0;
        var roleSignedEntries = 0;
        var roleInvalidSignatures = 0;

        foreach (var entry in entries)
        {
            var hash = LedgerHashing.ComputeHash(previousHash, entry.TimestampUtc, entry.EventType, entry.Actor, entry.PayloadJson, entry.SignerRoleId, entry.SignatureAlg);
            if (!hash.SequenceEqual(entry.Hash))
            {
                hashMismatches++;
            }
            if (!previousHash.SequenceEqual(entry.PreviousHash))
            {
                previousHashMismatches++;
            }
            previousHash = entry.Hash;

            if (entry.SignerRoleId.HasValue)
            {
                if (!signerKeys.TryGetValue(entry.SignerRoleId.Value, out var signer))
                {
                    signaturesMissing++;
                    continue;
                }

                if (entry.Signature is null || entry.Signature.Length == 0)
                {
                    signaturesMissing++;
                    continue;
                }

                var ok = _signingService.Verify(signer.Key, signer.Alg, entry.Hash, entry.Signature);
                if (ok)
                {
                    signaturesVerified++;
                }
                else
                {
                    signaturesInvalid++;
                }

                if (entry.SignerRoleId.Value == roleId)
                {
                    roleSignedEntries++;
                    if (!ok)
                    {
                        roleInvalidSignatures++;
                    }
                }
            }
        }

        return new LedgerVerificationSummary(
            ledgerName,
            entries.Count,
            hashMismatches,
            previousHashMismatches,
            signaturesVerified,
            signaturesMissing,
            signaturesInvalid,
            roleSignedEntries,
            roleInvalidSignatures);
    }
}
