using System.Security.Cryptography;

namespace Kernel;

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
public sealed record CertificateRecord
{
    public required Guid Id { get; init; }
    public required Guid SubjectRoleId { get; init; }
    public required ScopeKind ScopeKind { get; init; }
    public required Guid ScopeId { get; init; }
    public required Capability Capability { get; init; }
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
    public CanonicalJson ToCanonicalValue() => CanonicalJson.O(
        ("capability", CanonicalJson.S(Capabilities.ToText(Capability))),
        ("expiresAt", CanonicalJson.I(ExpiresUtc.ToUnixTimeSeconds())),
        ("id", CanonicalJson.S(Ids.ToText(Id))),
        ("issuedAt", CanonicalJson.I(IssuedUtc.ToUnixTimeSeconds())),
        ("issuedByRoleId", CanonicalJson.S(Ids.ToText(IssuedByRoleId))),
        ("scopeId", CanonicalJson.S(Ids.ToText(ScopeId))),
        ("scopeKind", CanonicalJson.S(Capabilities.ScopeText(ScopeKind))),
        ("subjectRoleId", CanonicalJson.S(Ids.ToText(SubjectRoleId))));

    public byte[] Hash() => SHA256.HashData(Canonical.SerializeToUtf8(ToCanonicalValue()));

    public byte[] Sign(RSA issuerSignKey) => LedgerEntry.Sign(issuerSignKey, Hash());

    public bool Verify(RSA issuerSignPublicKey, byte[] signature) =>
        LedgerEntry.Verify(issuerSignPublicKey, Hash(), signature);

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
public sealed record RoleEdgeRecord
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

    public CanonicalJson ToCanonicalValue()
    {
        if ((FromRoleId is null) == (FromAccountId is null))
            throw new InvalidOperationException("Genau eine Herkunft: Rolle ODER Konto.");

        if (FromAccountId is not null && FromAccountCommitment is null)
            throw new InvalidOperationException("Kontoherkunft verlangt eine Verpflichtung (3.4).");

        return CanonicalJson.O(
            ("createdAt", CanonicalJson.I(CreatedUtc.ToUnixTimeSeconds())),
            ("edgeKind", CanonicalJson.S(EdgeKind)),
            ("expiresAt", ExpiresUtc is null ? CanonicalJson.Nil : CanonicalJson.I(ExpiresUtc.Value.ToUnixTimeSeconds())),
            ("fromAccountCommitment",
                FromAccountCommitment is null ? CanonicalJson.Nil : CanonicalJson.S(Crypto.ToHex(FromAccountCommitment))),
            ("fromRoleId", FromRoleId is null ? CanonicalJson.Nil : CanonicalJson.S(Ids.ToText(FromRoleId.Value))),
            ("id", CanonicalJson.S(Ids.ToText(Id))),
            ("signerRoleId", CanonicalJson.S(Ids.ToText(SignerRoleId))),
            ("toRoleId", CanonicalJson.S(Ids.ToText(ToRoleId))));
    }

    public byte[] Hash() => SHA256.HashData(Canonical.SerializeToUtf8(ToCanonicalValue()));

    public byte[] Sign(RSA signerKey) => LedgerEntry.Sign(signerKey, Hash());

    public bool Verify(RSA signerPublicKey, byte[] signature) =>
        LedgerEntry.Verify(signerPublicKey, Hash(), signature);
}
