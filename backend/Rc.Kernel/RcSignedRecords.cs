using System.Security.Cryptography;

namespace Rc.Kernel;

/// <summary>
/// 3.5 — Ein Zertifikat, so wie es unterschrieben wird.
///
/// <b>Warum ein Zertifikat ueberhaupt eine Unterschrift traegt.</b> Die
/// Berechtigungspruefung liest aus <c>rc_certificate</c>, und diese Tabelle
/// liegt beim Betreiber. Ohne Unterschrift waere „darf lesen" eine Zeile, die
/// sich mit einem UPDATE herstellen laesst — und die ganze Rechtekette waere
/// eine Hoeflichkeitsvereinbarung mit dem Datenbankadministrator.
///
/// Mit Unterschrift ist sie nachpruefbar: wer behauptet, etwas zu duerfen, kann
/// zeigen, WER es ihm erlaubt hat, und diese Unterschrift kann der Betreiber
/// nicht herstellen, weil der private Signierschluessel der ausstellenden Rolle
/// nur waehrend einer Anfrage ihres Halters offen liegt (3.9).
///
/// <b>Die Grenze.</b> Die laufende Pruefung verlaesst sich auf die Zeile, nicht
/// auf die Unterschrift — sonst kostete jede Anzeige RSA-Pruefungen. Die
/// Unterschrift ist das Mittel der nachtraeglichen Pruefung, nicht der
/// Zugangskontrolle in Echtzeit. Wer das verwechselt, haelt die Zeile fuer
/// sicherer, als sie ist.
/// </summary>
public sealed record RcCertificateRecord
{
    public required Guid Id { get; init; }
    public required Guid SubjectRoleId { get; init; }
    public required RcScopeKind ScopeKind { get; init; }
    public required Guid ScopeId { get; init; }
    public required RcCapability Capability { get; init; }
    public required Guid IssuedByRoleId { get; init; }
    public required DateTimeOffset IssuedUtc { get; init; }

    /// <summary>E-07 — Lebenszeit ist Pflicht. Ein Zertifikat ohne Ablauf ist eine Zusage auf immer.</summary>
    public required DateTimeOffset ExpiresUtc { get; init; }

    /// <summary>
    /// 22.4 — Ohne das Feld <c>signature</c>: man kann nicht signieren, was die
    /// Signatur bereits enthaelt. Zeitpunkte als Sekunden seit der Epoche, weil
    /// Anhang D keine Gleitkommazahlen zulaesst und Zeichenketten fuer Zeiten
    /// drei Schreibweisen haetten.
    /// </summary>
    public RcJson ToCanonicalValue() => RcJson.O(
        ("capability", RcJson.S(RcCapabilities.ToText(Capability))),
        ("expiresAt", RcJson.I(ExpiresUtc.ToUnixTimeSeconds())),
        ("id", RcJson.S(RcId.ToText(Id))),
        ("issuedAt", RcJson.I(IssuedUtc.ToUnixTimeSeconds())),
        ("issuedByRoleId", RcJson.S(RcId.ToText(IssuedByRoleId))),
        ("scopeId", RcJson.S(RcId.ToText(ScopeId))),
        ("scopeKind", RcJson.S(RcCapabilities.ScopeText(ScopeKind))),
        ("subjectRoleId", RcJson.S(RcId.ToText(SubjectRoleId))));

    public byte[] Hash() => SHA256.HashData(RcCanonical.SerializeToUtf8(ToCanonicalValue()));

    public byte[] Sign(RSA issuerSignKey) => RcLedgerEntry.Sign(issuerSignKey, Hash());

    public bool Verify(RSA issuerSignPublicKey, byte[] signature) =>
        RcLedgerEntry.Verify(issuerSignPublicKey, Hash(), signature);

    public bool IsLive(DateTimeOffset now) => ExpiresUtc > now && IssuedUtc <= now;
}

/// <summary>
/// 3.1 — Eine Kante im Rollengraphen, so wie sie unterschrieben wird.
///
/// Dieselbe Ueberlegung wie beim Zertifikat: ohne Unterschrift waere „gehoert
/// dazu" ein INSERT. Die Kante nennt ausserdem ihren Unterzeichner getrennt vom
/// Ausgangspunkt — wer jemanden aufnimmt, ist nicht notwendig der, in den er
/// aufgenommen wird.
/// </summary>
public sealed record RcRoleEdgeRecord
{
    public required Guid Id { get; init; }

    /// <summary>Genau eines von beiden. Der Kernel prueft das; die Tabelle auch.</summary>
    public Guid? FromRoleId { get; init; }
    public Guid? FromAccountId { get; init; }

    public required Guid ToRoleId { get; init; }

    /// <summary>
    /// 3.1 — <c>holds | inherits | supervises</c>. Der Kernel INTERPRETIERT das
    /// nicht. Eine Fallunterscheidung nach dieser Zeichenkette im Kernel-Code
    /// waere ein Befund; die Bedeutung liegt im Modul.
    /// </summary>
    public required string EdgeKind { get; init; }

    public required Guid SignerRoleId { get; init; }
    public required DateTimeOffset CreatedUtc { get; init; }
    public DateTimeOffset? ExpiresUtc { get; init; }

    /// <summary>
    /// 3.4 — Steht ein Konto am Anfang, geht seine Kennung NICHT in die
    /// Unterschrift ein, sondern eine gesaltete Verpflichtung. Sonst liefe die
    /// Kennung ueber die Exportfunktion aus, und die Trennung von Konto und
    /// Rolle waere aufgehoben.
    /// </summary>
    public byte[]? FromAccountCommitment { get; init; }

    public RcJson ToCanonicalValue()
    {
        if ((FromRoleId is null) == (FromAccountId is null))
            throw new InvalidOperationException("Genau eine Herkunft: Rolle ODER Konto.");

        if (FromAccountId is not null && FromAccountCommitment is null)
            throw new InvalidOperationException("Kontoherkunft verlangt eine Verpflichtung (3.4).");

        return RcJson.O(
            ("createdAt", RcJson.I(CreatedUtc.ToUnixTimeSeconds())),
            ("edgeKind", RcJson.S(EdgeKind)),
            ("expiresAt", ExpiresUtc is null ? RcJson.Nil : RcJson.I(ExpiresUtc.Value.ToUnixTimeSeconds())),
            ("fromAccountCommitment",
                FromAccountCommitment is null ? RcJson.Nil : RcJson.S(RcCrypto.ToHex(FromAccountCommitment))),
            ("fromRoleId", FromRoleId is null ? RcJson.Nil : RcJson.S(RcId.ToText(FromRoleId.Value))),
            ("id", RcJson.S(RcId.ToText(Id))),
            ("signerRoleId", RcJson.S(RcId.ToText(SignerRoleId))),
            ("toRoleId", RcJson.S(RcId.ToText(ToRoleId))));
    }

    public byte[] Hash() => SHA256.HashData(RcCanonical.SerializeToUtf8(ToCanonicalValue()));

    public byte[] Sign(RSA signerKey) => RcLedgerEntry.Sign(signerKey, Hash());

    public bool Verify(RSA signerPublicKey, byte[] signature) =>
        RcLedgerEntry.Verify(signerPublicKey, Hash(), signature);
}
