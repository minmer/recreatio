using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace Rc.Kernel;

/// <summary>
/// 3.15 und 21.8 — Passwort, Anmeldenachweis, Entsperrmaterial.
///
/// <b>Der Ablauf, und warum er so aussieht</b>
///
/// <code>
///   Browser                                  Server
///   -------                                  ------
///   Passwort
///     │ Argon2id(password_salt)   ← EIN teurer Lauf, auf dem Telefon
///     ▼
///   PasswordKey ──── X-Rc-Unlock ────────►  Argon2id(login_salt)
///     │                                       │
///     │                                       ▼
///     │                                    Vergleich mit login_verifier
///     │                                       │
///     │                                       ▼
///     │                                    MasterKey = Open(PasswordKey, …)
///     │                                       │
///     └── bleibt im sessionStorage            └── Bund versiegeln, Klartext weg
/// </code>
///
/// <b>BEFUND 35, hier behoben.</b> 21.8 laesst den Verifier aus demselben
/// Passwort mit einem zweiten Salz entstehen. Woertlich umgesetzt kostet eine
/// Anmeldung damit ZWEI Argon2id-Laeufe zu je 64 MiB — im Browser, auf dem
/// Telefon, bei jedem Neustart.
///
/// Hier ist der Verifier stattdessen eine Ableitung <i>des PasswordKey</i> mit
/// eigenem Salz, gerechnet auf dem Server. Das hat zwei Wirkungen:
///
///   • Der Browser zahlt einen Lauf statt zwei.
///   • Ein Angreifer mit der Datenbank zahlt ZWEI Laeufe je Rateversuch, weil
///     er erst PasswordKey und daraus den Verifier bilden muss. Die woertliche
///     Fassung kostet ihn nur einen — er greift schlicht die guenstigere der
///     beiden unabhaengigen Ableitungen an.
///
/// Der Zweck aus 3.15 bleibt gewahrt: Der Verifier entsteht ueber eine eigene
/// langsame Ableitung mit eigenem Salz und ist NICHT der Schluessel, mit dem
/// der MasterKey verpackt ist. Wer die Datenbank besitzt, kann mit dem Verifier
/// nichts oeffnen.
///
/// Die Abweichung von der woertlichen Fassung des 21.8 ist als Befund gemeldet.
/// </summary>
public static class RcPassword
{
    /// <summary>21.1 — m = 64 MiB, t = 3, p = 1, Ausgabe 32 Byte.</summary>
    public const int MemoryKiB = 64 * 1024;
    public const int Iterations = 3;
    public const int Parallelism = 1;
    public const int OutputBytes = 32;
    public const int SaltBytes = 16;

    /// <summary>
    /// Laeuft im BROWSER (hash-wasm), hier nur fuer Pruefreihe und
    /// Erstinbetriebnahme. Das Passwort verlaesst das Geraet nie.
    /// </summary>
    public static byte[] DerivePasswordKey(string password, ReadOnlySpan<byte> passwordSalt) =>
        Argon2(Encoding.UTF8.GetBytes(password), passwordSalt);

    /// <summary>
    /// Laeuft auf dem SERVER. Eingabe ist der PasswordKey, nicht das Passwort —
    /// der Server sieht das Passwort nie.
    /// </summary>
    public static byte[] DeriveLoginVerifier(ReadOnlySpan<byte> passwordKey, ReadOnlySpan<byte> loginSalt) =>
        Argon2(passwordKey.ToArray(), loginSalt);

    /// <summary>
    /// Vergleich in fester Zeit. Ein Vergleich, der beim ersten abweichenden
    /// Byte abbricht, verraet ueber die Laufzeit, wie weit man gekommen ist.
    /// </summary>
    public static bool VerifyLogin(ReadOnlySpan<byte> passwordKey, ReadOnlySpan<byte> loginSalt, byte[] storedVerifier) =>
        CryptographicOperations.FixedTimeEquals(DeriveLoginVerifier(passwordKey, loginSalt), storedVerifier);

    /// <summary>
    /// 3.15 — Je Nutzer ein eigenes, zufaelliges Salz. Kein globales Haupt-Salz:
    /// dessen Rotation waere nicht beantwortbar, weil sie jeden Nutzer zur
    /// Neuableitung zwaenge, und ein Vorgang, der nicht im Hintergrund laufen
    /// kann, ist kein Wartungsvorgang. Die Frage wird nicht geloest, sondern
    /// gestrichen.
    /// </summary>
    public static byte[] NewSalt() => RandomNumberGenerator.GetBytes(SaltBytes);

    /// <summary>
    /// 3.9 — Das Oeffnungsstueck. Es IST der PasswordKey; der Schluesselbund
    /// wird damit versiegelt, gebunden an die Sitzungs-ID (21.7).
    ///
    /// Die Bindung an die Sitzung ist der Grund, warum ein abgefangenes
    /// Oeffnungsstueck in einer anderen Sitzung nichts nuetzt.
    /// </summary>
    public static byte[] OpeningPiece(ReadOnlySpan<byte> passwordKey) => passwordKey.ToArray();

    private static byte[] Argon2(byte[] input, ReadOnlySpan<byte> salt)
    {
        if (salt.Length < 8) throw new ArgumentException("Salz zu kurz.", nameof(salt));

        using var argon = new Argon2id(input)
        {
            Salt = salt.ToArray(),
            MemorySize = MemoryKiB,
            Iterations = Iterations,
            DegreeOfParallelism = Parallelism
        };
        return argon.GetBytes(OutputBytes);
    }
}

/// <summary>
/// Was beim Anlegen eines Kontos entsteht. Der Server bekommt den PasswordKey
/// zu sehen, das Passwort nie.
/// </summary>
public sealed record RcAccountSecrets
{
    public required byte[] PasswordSalt { get; init; }
    public required byte[] LoginSalt { get; init; }
    public required byte[] LoginVerifier { get; init; }

    /// <summary>AlgId 0x01 unter PasswordKey, AAD <c>kernel:account:&lt;id&gt;:masterkey:1</c>.</summary>
    public required byte[] MasterKeySealed { get; init; }

    /// <summary>
    /// 21.8 — Beim Passwortwechsel wird GENAU DIESE eine Huelle neu versiegelt.
    /// Nichts anderes aendert sich; das ist der handfeste Betriebsvorteil des
    /// Wurzelschluessels (E-269).
    /// </summary>
    public static RcAccountSecrets Create(Guid accountId, ReadOnlySpan<byte> passwordKey, ReadOnlySpan<byte> masterKey,
        ReadOnlySpan<byte> passwordSalt)
    {
        var loginSalt = RcPassword.NewSalt();
        var aad = RcAad.Create("kernel", "account", accountId, RcField.AccountMasterKey, 1);

        return new RcAccountSecrets
        {
            PasswordSalt = passwordSalt.ToArray(),
            LoginSalt = loginSalt,
            LoginVerifier = RcPassword.DeriveLoginVerifier(passwordKey, loginSalt),
            MasterKeySealed = RcCrypto.Seal(passwordKey, aad, masterKey)
        };
    }

    /// <summary>
    /// 21.8 — Der MasterKey ist ZUFAELLIG und wird nie abgeleitet. Nur so
    /// bleibt er beim Passwortwechsel derselbe, und nur deshalb muss genau eine
    /// Huelle neu versiegelt werden statt zwanzig.
    /// </summary>
    public byte[] UnsealMasterKey(Guid accountId, ReadOnlySpan<byte> passwordKey)
    {
        var aad = RcAad.Create("kernel", "account", accountId, RcField.AccountMasterKey, 1);
        return RcCrypto.Open(passwordKey, aad, MasterKeySealed);
    }

    public RcAccountSecrets WithNewPassword(Guid accountId, ReadOnlySpan<byte> oldPasswordKey,
        ReadOnlySpan<byte> newPasswordKey, ReadOnlySpan<byte> newPasswordSalt)
    {
        var masterKey = UnsealMasterKey(accountId, oldPasswordKey);
        try
        {
            return Create(accountId, newPasswordKey, masterKey, newPasswordSalt);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(masterKey);
        }
    }
}
