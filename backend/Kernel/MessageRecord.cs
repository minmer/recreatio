using System.Security.Cryptography;

namespace Kernel;

/// <summary>
/// 9.6 — Eine Nachrichtenfassung, so wie sie unterschrieben wird.
///
/// <b>Warum jede Fassung eine eigene Unterschrift traegt.</b> Bearbeiten
/// erzeugt eine neue Zeile in <c>rc_message_version</c>, nicht ein UPDATE.
/// Ohne Unterschrift je Fassung waere die Versionsgeschichte eine Liste von
/// Behauptungen des Betreibers: er koennte eine Fassung einfuegen, die nie
/// geschrieben wurde, und niemand koennte es zeigen.
///
/// <b>Was unterschrieben wird — und was nicht.</b> Der HASH des Geheimtextes,
/// nicht der Klartext. Das hat einen praktischen Grund: die Unterschrift
/// entsteht auf dem Server waehrend einer entsperrten Anfrage, und sie soll
/// spaeter pruefbar sein, ohne den Inhalt zu oeffnen. Wer die Kette prueft,
/// muss den Text nicht lesen duerfen — und genau das ist bei einem Betreiber,
/// der nicht mitlesen darf, die Bedingung dafuer, dass die Pruefung ueberhaupt
/// stattfinden kann.
/// </summary>
public sealed record MessageVersionRecord
{
    public required Guid Id { get; init; }
    public required Guid MessageId { get; init; }
    public required int Version { get; init; }
    public required Guid AuthorRoleId { get; init; }

    /// <summary>SHA-256 ueber die versiegelte Huelle, nicht ueber den Klartext.</summary>
    public required byte[] BodyHash { get; init; }

    public required DateTimeOffset CreatedUtc { get; init; }

    public CanonicalJson ToCanonicalValue() => CanonicalJson.O(
        ("authorRoleId", CanonicalJson.S(Ids.ToText(AuthorRoleId))),
        ("bodyHash", CanonicalJson.S(Crypto.ToHex(BodyHash))),
        ("createdAt", CanonicalJson.I(CreatedUtc.ToUnixTimeSeconds())),
        ("id", CanonicalJson.S(Ids.ToText(Id))),
        ("messageId", CanonicalJson.S(Ids.ToText(MessageId))),
        ("version", CanonicalJson.I(Version)));

    public byte[] Hash() => SHA256.HashData(Canonical.SerializeToUtf8(ToCanonicalValue()));

    public byte[] Sign(RSA authorSignKey) => LedgerEntry.Sign(authorSignKey, Hash());

    public bool Verify(RSA authorSignPublicKey, byte[] signature) =>
        LedgerEntry.Verify(authorSignPublicKey, Hash(), signature);

    /// <summary>
    /// 9.6.7 — Ein Zitat verweist auf den Hash der ZITIERTEN Fassung und wandert
    /// nicht mit. Wird das Original spaeter bearbeitet, zeigt das Zitat weiter
    /// auf das, was tatsaechlich dastand — sonst koennte jemand eine Aussage
    /// nachtraeglich aendern und das Zitat gleich mit.
    /// </summary>
    public static byte[] QuoteHash(ReadOnlySpan<byte> sealedBody) => SHA256.HashData(sealedBody);
}
