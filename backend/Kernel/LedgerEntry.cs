using System.Security.Cryptography;

namespace Kernel;

/// <summary>
/// 7.5 — Aufbau eines Ketteneintrags.
///
/// Die Kette beweist <b>Reihenfolge und Urheberschaft</b>. Den <b>Zeitpunkt</b>
/// beweist sie nur gegenueber unabhaengig mitgeschriebenen Kettenkoepfen (7.1) —
/// der Zeitstempel stammt vom Server und ist zunaechst eine Behauptung des
/// Betreibers. Wer die Kette in einem Verfahren verwendet, muss das wissen.
/// </summary>
public sealed record LedgerEntry
{
    public required Guid LedgerId { get; init; }
    public required long Sequence { get; init; }
    public required byte[] PreviousHash { get; init; }
    public required Guid EntryId { get; init; }
    public required CanonicalJson Payload { get; init; }
    public required Guid SubjectId { get; init; }
    public required Guid TenantId { get; init; }
    public required string ModuleId { get; init; }
    public required byte[] SignerKeyFingerprint { get; init; }
    public required int KeyVersion { get; init; }
    public required Guid TransactionId { get; init; }
    public required byte[] AccountCommitment { get; init; }
    public required DateTimeOffset Timestamp { get; init; }

    /// <summary>32 Nullen als Hexzeichenkette. Ein Pruefer erkennt den Kettenanfang
    /// daran und NICHT daran, dass ein Feld fehlt (22.6).</summary>
    public static readonly byte[] GenesisPreviousHash = new byte[32];

    /// <summary>
    /// 22.4 — Serialisiert wird ohne das Feld <c>signature</c>: man kann nicht
    /// signieren, was die Signatur bereits enthaelt. Feldnamen sind in der Kette
    /// durchgehend camelCase; die Tabelle in 7.5 nennt sie gross, weil sie dort
    /// Datenbankspalten meint.
    /// </summary>
    public CanonicalJson ToCanonicalValue() => CanonicalJson.O(
        ("accountCommitment",    CanonicalJson.Hex(AccountCommitment)),
        ("entryId",              CanonicalJson.G(EntryId)),
        ("keyVersion",           CanonicalJson.I(KeyVersion)),
        ("ledgerId",             CanonicalJson.G(LedgerId)),
        ("moduleId",             CanonicalJson.S(ModuleId)),
        ("payload",              Payload),
        ("previousHash",         CanonicalJson.Hex(PreviousHash)),
        ("sequence",             CanonicalJson.I(Sequence)),
        ("signerKeyFingerprint", CanonicalJson.Hex(SignerKeyFingerprint)),
        ("subjectId",            CanonicalJson.G(SubjectId)),
        ("tenantId",             CanonicalJson.G(TenantId)),
        ("timestamp",            CanonicalJson.T(Timestamp)),
        ("transactionId",        CanonicalJson.G(TransactionId)));

    public byte[] CanonicalBytes() => Canonical.SerializeToUtf8(ToCanonicalValue());

    /// <summary>Wird zum <c>PreviousHash</c> des naechsten Eintrags.</summary>
    public byte[] EntryHash() => SHA256.HashData(CanonicalBytes());

    /// <summary>
    /// RSA-4096-PSS, SHA-256, MGF1-SHA-256, Salzlaenge 32 (21.1).
    ///
    /// Signiert wird im Klienten. Der Server haelt den Bund nur verschluesselt
    /// (3.9) — er kann ausserhalb einer Anfrage des Nutzers nichts signieren, und
    /// genau darauf beruht die Zusage aus 7.2.
    /// </summary>
    public static byte[] Sign(RSA signPrivateKey, byte[] entryHash)
        => signPrivateKey.SignHash(entryHash, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);

    public static bool Verify(RSA signPublicKey, byte[] entryHash, byte[] signature)
        => signPublicKey.VerifyHash(entryHash, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);

    /// <summary>
    /// 3.4 — In der Kette steht nie die Account-ID, sondern eine gesaltete
    /// Verpflichtung. Stuende sie selbst dort, liefe sie ueber die Exportfunktion
    /// (7.4) aus und der ganze Schutz waere wirkungslos.
    /// </summary>
    public static byte[] CommitAccount(Guid accountId, ReadOnlySpan<byte> salt)
        => Crypto.Derive(accountId.ToByteArray(bigEndian: true),
                           Crypto.InfoAccountCommitment(Crypto.ToHex(salt)), 32);
}
