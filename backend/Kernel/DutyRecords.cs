using System.Security.Cryptography;

namespace Kernel;

/// <summary>
/// 0129 — DIE ZUSAGE, FÜR DIE DATEN EINES BEREICHS GERADEZUSTEHEN.
///
/// <para>
/// Wer einen Datensatz eines Verantwortlichen (Administrator danych) für einen
/// Bereich gelten lässt, gibt eine Erklärung im Namen einer Organisation ab.
/// Ohne Unterschrift wäre das eine Zeile, die herstellt, wer die Datenbank hält
/// — und jede Pfarrei könnte für jede Gruppe verantwortlich gemacht werden.
/// Unterschrieben wird im Browser mit dem Signierschlüssel einer Rolle, die den
/// Heimatbereich des Datensatzes führt (<c>admin</c>); der Dienst prüft nur.
/// </para>
///
/// <para>
/// <c>kind</c> steht mit in den Bytes: dieselben Rollenschlüssel unterschreiben
/// auch Zertifikate und Kanten, und eine Unterschrift soll nie als die eines
/// anderen Satzes gelesen werden können.
/// </para>
/// </summary>
public sealed record ControllerAttachmentRecord
{
    public const string Kind = "controller-attachment";

    public required Guid AttachmentId { get; init; }
    public required Guid ControllerId { get; init; }
    public required Guid AreaId { get; init; }
    public required Guid HomeAreaId { get; init; }
    public required Guid SignerRoleId { get; init; }
    public required DateTimeOffset SignedUtc { get; init; }

    public CanonicalJson ToCanonicalValue() => CanonicalJson.O(
        ("areaId", CanonicalJson.S(Ids.ToText(AreaId))),
        ("attachmentId", CanonicalJson.S(Ids.ToText(AttachmentId))),
        ("controllerId", CanonicalJson.S(Ids.ToText(ControllerId))),
        ("homeAreaId", CanonicalJson.S(Ids.ToText(HomeAreaId))),
        ("kind", CanonicalJson.S(Kind)),
        ("signedAt", CanonicalJson.I(SignedUtc.ToUnixTimeSeconds())),
        ("signerRoleId", CanonicalJson.S(Ids.ToText(SignerRoleId))));

    public byte[] Hash() => SHA256.HashData(Canonical.SerializeToUtf8(ToCanonicalValue()));

    public bool Verify(RSA signerPublicKey, byte[] signature) => LedgerEntry.Verify(signerPublicKey, Hash(), signature);
}

/// <summary>
/// 0130 — EIN SCHRITT DES BETREIBERS AN EINER GEMELDETEN SACHE, IN DER KETTE.
///
/// <para>
/// Der Betreiber kann nichts löschen, was niemand gemeldet hat: jeder Schritt
/// nennt seine Meldung, und der Dienst nimmt ihn nur mit dem Entscheidungs-
/// geheimnis dieser Meldung an (das nur der Browser des Betreibers aus der
/// versiegelten Meldung holt). Jeder Schritt ist im Browser des Betreibers
/// unterschrieben und hängt am Hash des vorigen — wer eine Zeile verschwinden
/// lässt oder umschreibt, bricht die Kette sichtbar.
/// </para>
///
/// <para>
/// <c>previousHash</c> ist der SHA-256 der kanonischen Bytes des vorigen
/// Eintrags; der erste hängt an 32 Nullen.
/// </para>
/// </summary>
public sealed record TakedownEntryRecord
{
    public const string Kind = "takedown";

    public required long Sequence { get; init; }
    public required byte[] PreviousHash { get; init; }
    public required Guid EntryId { get; init; }
    public required Guid ReportId { get; init; }
    public required string ItemKind { get; init; }
    public required Guid ItemId { get; init; }
    public DateTimeOffset? ItemAt { get; init; }
    public required string Action { get; init; }
    public required Guid SignerRoleId { get; init; }
    public required DateTimeOffset SignedUtc { get; init; }

    public static readonly byte[] Genesis = new byte[32];

    public CanonicalJson ToCanonicalValue() => CanonicalJson.O(
        ("action", CanonicalJson.S(Action)),
        ("entryId", CanonicalJson.S(Ids.ToText(EntryId))),
        ("itemAt", ItemAt is null ? CanonicalJson.Nil : CanonicalJson.I(ItemAt.Value.ToUnixTimeSeconds())),
        ("itemId", CanonicalJson.S(Ids.ToText(ItemId))),
        ("itemKind", CanonicalJson.S(ItemKind)),
        ("kind", CanonicalJson.S(Kind)),
        ("previousHash", CanonicalJson.Hex(PreviousHash)),
        ("reportId", CanonicalJson.S(Ids.ToText(ReportId))),
        ("sequence", CanonicalJson.I(Sequence)),
        ("signedAt", CanonicalJson.I(SignedUtc.ToUnixTimeSeconds())),
        ("signerRoleId", CanonicalJson.S(Ids.ToText(SignerRoleId))));

    public byte[] CanonicalBytes() => Canonical.SerializeToUtf8(ToCanonicalValue());

    /// <summary>Wird zum <c>previousHash</c> des nächsten Eintrags.</summary>
    public byte[] EntryHash() => SHA256.HashData(CanonicalBytes());

    public bool Verify(RSA signerPublicKey, byte[] signature) => LedgerEntry.Verify(signerPublicKey, EntryHash(), signature);
}
