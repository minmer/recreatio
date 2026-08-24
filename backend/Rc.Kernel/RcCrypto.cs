using System.Security.Cryptography;
using System.Text;

namespace Rc.Kernel;

/// <summary>Anhang C 21.3 — Verfahrenskennung im Klartext-Kopf.</summary>
public enum RcAlg : byte
{
    AesGcm256 = 0x01,
    RsaOaep4096 = 0x02
}

/// <summary>
/// Anhang C — Kryptografische Konstruktion.
///
/// Client und Server muessen hier bitgenau uebereinstimmen. Die Testvektoren aus
/// 21.9 liegen als ausfuehrbare Pruefaelle in Rc.Kernel.Tests; sie sind
/// unabhaengig nachgerechnet worden, bevor diese Klasse entstand.
/// </summary>
public static class RcCrypto
{
    public const int KeySize = 32;
    public const int NonceSize = 12;
    public const int TagSize = 16;
    public const int HeaderSize = 20;
    public const byte FormatVersion = 0x01;

    private static readonly byte[] Magic = [0x52, 0x43];              // "RC"
    private static readonly byte[] ExtractSalt = new byte[32];        // 32 x 0x00 (21.7)

    // ---- Info-Zeichenketten (21.7). Diese Liste ist abschliessend. --------------
    // Zwei Ableitungen mit derselben Info aus demselben Schluessel ergeben
    // denselben Schluessel, und das ist fast nie beabsichtigt.

    public static string InfoRoleRead(Guid roleId) => $"recreatio:v1:role-read:{RcId.ToText(roleId)}";
    public static string InfoKeyId => "recreatio:v1:keyid";
    public static string InfoSharedView(Guid viewId) => $"recreatio:v1:shared-view:{RcId.ToText(viewId)}";
    public static string InfoCacheUnwrap(string sessionId) => $"recreatio:v1:cache-unwrap:{sessionId}";
    public static string InfoAccountCommitment(string saltHex) => $"recreatio:v1:account-commitment:{saltHex}";

    /// <summary>
    /// Das Scheinsalz fuer einen unbekannten Benutzernamen. Es gehoert in diese
    /// abschliessende Liste und nicht an die Aufrufstelle: sonst waere es die
    /// erste frei gewaehlte Info-Zeichenkette, und die zweite kaeme bestimmt.
    /// </summary>
    public static string InfoDecoySalt(string usernameLower) => $"recreatio:v1:decoy-salt:{usernameLower}";

    /// <summary>
    /// 3.12 — Der Transportschluessel einer Einladung, abgeleitet aus dem
    /// Token-Geheimnis. Er ist der Grund, warum eine Einladung mit dem LINK
    /// reist und nicht mit der Datenbank: das Geheimnis steht nirgends
    /// gespeichert, also kann der Betreiber die Huelle nicht oeffnen.
    /// </summary>
    public static string InfoInvitation(string tokenSecret) => $"recreatio:v1:invitation:{tokenSecret}";

    /// <summary>
    /// 3.4 — Das Salz einer Konto-Verpflichtung im Ketteneintrag.
    ///
    /// Es wird aus dem Servergeheimnis und der Eintragskennung ABGELEITET und
    /// nicht gespeichert. Damit gilt beides zugleich:
    ///
    ///   • Wer einen Export bekommt (7.4), sieht eine Verpflichtung, die er
    ///     keinem Konto zuordnen kann — auch nicht durch Durchprobieren, weil
    ///     ihm das Salz fehlt.
    ///   • Der Betreiber kann sie auf Verlangen oeffnen. Er kennt das Konto
    ///     ohnehin; die Verpflichtung schuetzt vor dem Export, nicht vor ihm.
    ///
    /// Ein zufaelliges, weggeworfenes Salz waere kein Schutz, sondern Rauschen:
    /// die Verpflichtung liesse sich dann von NIEMANDEM mehr einloesen, und ein
    /// Feld, das niemand pruefen kann, kann man auch weglassen.
    /// </summary>
    public static string InfoCommitmentSalt(string entryIdText) =>
        $"recreatio:v1:commitment-salt:{entryIdText}";

    // ---- Ableitung ------------------------------------------------------------

    public static byte[] Derive(ReadOnlySpan<byte> ikm, string info, int length)
    {
        var output = new byte[length];
        HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, output, ExtractSalt, Encoding.UTF8.GetBytes(info));
        return output;
    }

    /// <summary>21.6 — RoleReadKey aus dem Wurzelschluessel.</summary>
    public static byte[] DeriveRoleReadKey(ReadOnlySpan<byte> masterKey, Guid roleId)
        => Derive(masterKey, InfoRoleRead(roleId), KeySize);

    /// <summary>
    /// 21.5 — Sagt, welcher Schluessel eine Huelle oeffnet, ohne ihn zu verraten.
    /// Abgeleitet statt schlicht gehasht, damit dieselbe Zeichenfolge nirgends
    /// sonst im System eine zweite Bedeutung bekommt.
    /// </summary>
    public static byte[] KeyId(ReadOnlySpan<byte> symmetricKey)
        => Derive(symmetricKey, InfoKeyId, 16);

    /// <summary>21.5 — Fuer asymmetrische Schluessel: erste 16 Byte von SHA-256(SPKI DER).
    /// Derselbe Wert wie der SignerKeyFingerprint in 7.5.</summary>
    public static byte[] KeyIdFromPublicKey(ReadOnlySpan<byte> spkiDer)
        => SHA256.HashData(spkiDer).AsSpan(0, 16).ToArray();

    // ---- Kopf (21.3) ----------------------------------------------------------

    public static byte[] BuildHeader(RcAlg alg, ReadOnlySpan<byte> keyId)
    {
        if (keyId.Length != 16) throw new ArgumentException("KeyId muss 16 Byte lang sein.", nameof(keyId));
        var h = new byte[HeaderSize];
        h[0] = Magic[0];
        h[1] = Magic[1];
        h[2] = FormatVersion;
        h[3] = (byte)alg;
        keyId.CopyTo(h.AsSpan(4));
        return h;
    }

    /// <summary>
    /// 21.4 — Der Kopf ist mitauthentifiziert. Ohne das koennte ein Angreifer die
    /// AlgId veraendern und einen Klienten auf ein schwaecheres Verfahren locken.
    /// Der Kopf ist lesbar, aber nicht veraenderbar.
    /// </summary>
    private static byte[] FullAad(ReadOnlySpan<byte> header, RcAad aad)
    {
        var tail = aad.ToUtf8();
        var buf = new byte[header.Length + tail.Length];
        header.CopyTo(buf);
        tail.CopyTo(buf.AsSpan(header.Length));
        return buf;
    }

    // ---- Versiegeln und Oeffnen ----------------------------------------------

    /// <summary>
    /// 21.2 — Der Nonce kommt aus dem Zufallsgenerator des Betriebssystems.
    /// Kein Zaehler, kein Zeitstempel. Ein Nonce wird niemals mit demselben
    /// Schluessel zweimal benutzt: bei AES-GCM ist das der Verlust der
    /// Vertraulichkeit BEIDER Nachrichten.
    /// </summary>
    public static byte[] Seal(ReadOnlySpan<byte> key, RcAad aad, ReadOnlySpan<byte> plaintext)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        return SealWithNonce(key, aad, plaintext, nonce);
    }

    public static byte[] Seal(ReadOnlySpan<byte> key, RcAad aad, string plaintext)
        => Seal(key, aad, Encoding.UTF8.GetBytes(plaintext));

    /// <summary>Nur fuer Testvektoren. Produktivcode nutzt <see cref="Seal(ReadOnlySpan{byte}, RcAad, ReadOnlySpan{byte})"/>.</summary>
    internal static byte[] SealWithNonce(ReadOnlySpan<byte> key, RcAad aad, ReadOnlySpan<byte> plaintext, ReadOnlySpan<byte> nonce)
    {
        if (key.Length != KeySize) throw new ArgumentException("Schluessel muss 32 Byte lang sein.", nameof(key));
        if (nonce.Length != NonceSize) throw new ArgumentException("Nonce muss 12 Byte lang sein.", nameof(nonce));

        var header = BuildHeader(RcAlg.AesGcm256, KeyId(key));
        var fullAad = FullAad(header, aad);

        var blob = new byte[HeaderSize + NonceSize + plaintext.Length + TagSize];
        header.CopyTo(blob.AsSpan(0));
        nonce.CopyTo(blob.AsSpan(HeaderSize));

        var ct = blob.AsSpan(HeaderSize + NonceSize, plaintext.Length);
        var tag = blob.AsSpan(HeaderSize + NonceSize + plaintext.Length, TagSize);

        using var gcm = new AesGcm(key, TagSize);
        gcm.Encrypt(nonce, plaintext, ct, tag, fullAad);
        return blob;
    }

    /// <summary>
    /// Wirft <see cref="RcDecryptException"/>, wenn die AAD nicht passt — das ist
    /// der Zweck der Konvention und nach 15.9 ein Sicherheitsereignis, das
    /// gezaehlt werden MUSS.
    /// </summary>
    public static byte[] Open(ReadOnlySpan<byte> key, RcAad aad, ReadOnlySpan<byte> blob)
    {
        if (key.Length != KeySize) throw new ArgumentException("Schluessel muss 32 Byte lang sein.", nameof(key));

        var header = ReadHeader(blob);
        if (header.Alg != RcAlg.AesGcm256)
            throw new RcDecryptException(RcDecryptError.UnknownAlgorithm, $"AlgId 0x{(byte)header.Alg:x2} ist hier nicht erwartet.");
        if (blob.Length < HeaderSize + NonceSize + TagSize)
            throw new RcDecryptException(RcDecryptError.Malformed, $"Huelle zu kurz: {blob.Length} Byte.");

        var fullAad = FullAad(blob[..HeaderSize], aad);
        var nonce = blob.Slice(HeaderSize, NonceSize);
        var ctLen = blob.Length - HeaderSize - NonceSize - TagSize;
        var ct = blob.Slice(HeaderSize + NonceSize, ctLen);
        var tag = blob.Slice(HeaderSize + NonceSize + ctLen, TagSize);

        var pt = new byte[ctLen];
        try
        {
            using var gcm = new AesGcm(key, TagSize);
            gcm.Decrypt(nonce, ct, tag, pt, fullAad);
        }
        catch (CryptographicException)
        {
            // Kein Klartext im Protokoll (15.9). Die AAD selbst ist unverschluesselt
            // und darf mitgegeben werden — sie ist genau die Angabe, die bei der
            // Eingrenzung hilft.
            throw new RcDecryptException(RcDecryptError.AadMismatch,
                $"Integritaetspruefung fehlgeschlagen fuer AAD '{aad.Text}'.");
        }
        return pt;
    }

    public static string OpenText(ReadOnlySpan<byte> key, RcAad aad, ReadOnlySpan<byte> blob)
        => Encoding.UTF8.GetString(Open(key, aad, blob));

    // ---- Kopf lesen -----------------------------------------------------------

    public readonly record struct RcHeader(byte Version, RcAlg Alg, byte[] KeyId);

    /// <summary>
    /// 21.3: Magic und FormatVersion werden geprueft, BEVOR irgendetwas anderes
    /// geschieht. Eine unbekannte AlgId ist ein Fehler, kein Anlass zum Raten.
    /// </summary>
    public static RcHeader ReadHeader(ReadOnlySpan<byte> blob)
    {
        if (blob.Length < HeaderSize)
            throw new RcDecryptException(RcDecryptError.Malformed, "Huelle kuerzer als der Kopf.");
        if (blob[0] != Magic[0] || blob[1] != Magic[1])
            throw new RcDecryptException(RcDecryptError.Malformed, "Kein Recreatio-Blob (Magic fehlt).");
        if (blob[2] != FormatVersion)
            throw new RcDecryptException(RcDecryptError.UnknownFormat, $"Formatversion {blob[2]} ist unbekannt.");

        var alg = (RcAlg)blob[3];
        if (alg is not (RcAlg.AesGcm256 or RcAlg.RsaOaep4096))
            throw new RcDecryptException(RcDecryptError.UnknownAlgorithm, $"AlgId 0x{blob[3]:x2} ist unbekannt.");

        return new RcHeader(blob[2], alg, blob.Slice(4, 16).ToArray());
    }

    // ---- Asymmetrisches Verpacken (21.3 / 21.4) --------------------------------

    /// <summary>
    /// 21.6 — Bereichsschluessel werden gewrappt, nicht abgeleitet. Nur so kann ein
    /// Administrator jemanden aufnehmen, ohne dessen Geheimnisse zu kennen: er
    /// braucht allein den oeffentlichen Verpackungsschluessel der neuen Rolle.
    ///
    /// RSA-OAEP kennt keine AAD, wohl aber ein Label (21.4):
    /// Label = SHA-256( Kopf || AAD-Zeichenkette ).
    /// </summary>
    public static byte[] WrapKey(RSA wrapPublicKey, RcAad aad, ReadOnlySpan<byte> keyToWrap)
    {
        var keyId = KeyIdFromPublicKey(wrapPublicKey.ExportSubjectPublicKeyInfo());
        var header = BuildHeader(RcAlg.RsaOaep4096, keyId);
        var label = SHA256.HashData(FullAad(header, aad));

        // ABWEICHUNG zu Anhang C 21.4, gemeldet als BEFUND 34:
        // .NET bietet ueber RSAEncryptionPadding keinen Zugriff auf den
        // OAEP-Label-Parameter. Das Label wird deshalb dem Klartext
        // vorangestellt und beim Auspacken in fester Zeit geprueft. Die Bindung
        // an die AAD ist damit gleichwertig — OAEP schuetzt die Integritaet der
        // gesamten Nutzlast —, und die Groessenzusage aus 21.3 bleibt gewahrt:
        // 32 Byte Label + 32 Byte Schluessel liegen weit unter den 446 Byte,
        // die RSA-4096 mit OAEP-SHA256 fasst, der Geheimtext bleibt 512 Byte.
        var payload = new byte[label.Length + keyToWrap.Length];
        label.CopyTo(payload.AsSpan(0));
        keyToWrap.CopyTo(payload.AsSpan(label.Length));
        var ct = wrapPublicKey.Encrypt(payload, RSAEncryptionPadding.CreateOaep(HashAlgorithmName.SHA256));

        var blob = new byte[HeaderSize + ct.Length];
        header.CopyTo(blob.AsSpan(0));
        ct.CopyTo(blob.AsSpan(HeaderSize));
        return blob;
    }

    public static byte[] UnwrapKey(RSA wrapPrivateKey, RcAad aad, ReadOnlySpan<byte> blob)
    {
        var header = ReadHeader(blob);
        if (header.Alg != RcAlg.RsaOaep4096)
            throw new RcDecryptException(RcDecryptError.UnknownAlgorithm, "Erwartet wurde eine RSA-verpackte Huelle.");

        byte[] payload;
        try
        {
            payload = wrapPrivateKey.Decrypt(blob[HeaderSize..].ToArray(),
                RSAEncryptionPadding.CreateOaep(HashAlgorithmName.SHA256));
        }
        catch (CryptographicException)
        {
            throw new RcDecryptException(RcDecryptError.WrongKey, "Verpackung liess sich nicht oeffnen.");
        }

        var expected = SHA256.HashData(FullAad(blob[..HeaderSize], aad));
        if (payload.Length < expected.Length ||
            !CryptographicOperations.FixedTimeEquals(payload.AsSpan(0, expected.Length), expected))
        {
            throw new RcDecryptException(RcDecryptError.AadMismatch,
                $"Label passt nicht zur AAD '{aad.Text}'.");
        }
        return payload[expected.Length..];
    }

    // ---- Kleinkram ------------------------------------------------------------

    public static byte[] NewSymmetricKey() => RandomNumberGenerator.GetBytes(KeySize);

    public static string ToHex(ReadOnlySpan<byte> b) => Convert.ToHexString(b).ToLowerInvariant();

    public static byte[] FromHex(string hex) => Convert.FromHexString(hex);
}

public enum RcDecryptError
{
    /// <summary>Die Person kam spaeter dazu — Normalfall, wird nicht protokolliert (15.9).</summary>
    MissingEpoch,
    MissingKey,
    AadMismatch,
    Malformed,
    UnknownFormat,
    UnknownAlgorithm,
    WrongKey
}

/// <summary>
/// 15.9 — Vier unterscheidbare Ursachen. Ein einziges "decrypt_failed" reicht
/// nicht: der Betreiber, der die Inhalte nicht lesen darf, haette sonst kein
/// Mittel zur Eingrenzung.
/// </summary>
public sealed class RcDecryptException(RcDecryptError error, string message) : Exception(message)
{
    public RcDecryptError Error { get; } = error;

    /// <summary>Fehlerkennung nach 15.7, hierarchisch: &lt;bereich&gt;.&lt;fall&gt;.</summary>
    public string Code => Error switch
    {
        RcDecryptError.MissingEpoch     => "crypto.missing_epoch",
        RcDecryptError.MissingKey       => "crypto.missing_key",
        RcDecryptError.AadMismatch      => "crypto.aad_mismatch",
        RcDecryptError.Malformed        => "crypto.malformed",
        RcDecryptError.UnknownFormat    => "crypto.unknown_format",
        RcDecryptError.UnknownAlgorithm => "crypto.unknown_algorithm",
        RcDecryptError.WrongKey         => "crypto.wrong_key",
        _ => "crypto.failed"
    };
}
