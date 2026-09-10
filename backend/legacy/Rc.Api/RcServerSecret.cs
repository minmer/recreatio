using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Ein Geheimnis, das dem SERVER gehoert und keinem Nutzer.
///
/// Es verschluesselt nichts. Es dient dazu, Auskuenfte zu erzeugen, die echt
/// aussehen: vor allem das Scheinsalz fuer unbekannte Benutzernamen.
///
/// <b>Warum das noetig ist.</b> Vor der Anmeldung braucht der Browser das Salz,
/// um Argon2id zu rechnen. Gaebe der Server auf einen unbekannten Namen "kenne
/// ich nicht" zurueck, waere der Anmeldedialog ein Verzeichnis aller Konten —
/// und die sorgfaeltig einheitliche Fehlermeldung
/// <c>auth.credentials_invalid</c> waere umsonst.
///
/// Also bekommt jeder Name ein Salz. Fuer bekannte Konten das echte, fuer
/// unbekannte ein aus diesem Geheimnis abgeleitetes. Das Scheinsalz ist stabil:
/// derselbe Name ergibt immer dasselbe: ein Salz, das sich bei jeder Abfrage
/// aendert, verraet ebenso sicher, dass es erfunden ist.
/// </summary>
public sealed class RcServerSecret
{
    public const string ConfigKey = "Rc:ServerSecret";
    public const int MinimumBytes = 32;

    private readonly byte[] _secret;

    public RcServerSecret(IConfiguration config)
    {
        var raw = config[ConfigKey];
        if (string.IsNullOrWhiteSpace(raw))
            throw new InvalidOperationException($"{ConfigKey} fehlt.");

        if (!RcBase64Url.TryDecode(raw, out var bytes) || bytes.Length < MinimumBytes)
            throw new InvalidOperationException(
                $"{ConfigKey} muss Base64 mit mindestens {MinimumBytes} Byte sein.");

        _secret = bytes;
    }

    private RcServerSecret(byte[] secret) => _secret = secret;

    public static RcServerSecret ForTesting() => new(RandomNumberGenerator.GetBytes(MinimumBytes));

    /// <summary>
    /// Das Scheinsalz. Kleinschreibung, weil der Benutzername ohne Ruecksicht
    /// auf Gross- und Kleinschreibung eindeutig ist (CI-Sortierung in
    /// <c>rc_account</c>) — sonst haetten "Anna" und "anna" verschiedene
    /// Scheinsalze, waehrend sie bei einem echten Konto dasselbe haetten.
    /// </summary>
    public byte[] DecoySalt(string username) =>
        RcCrypto.Derive(_secret, RcCrypto.InfoDecoySalt(username.Trim().ToLowerInvariant()), RcPassword.SaltBytes);

    /// <summary>
    /// 3.4 — Das Salz einer Konto-Verpflichtung im Ketteneintrag. Abgeleitet
    /// statt gespeichert: der Export sieht eine Verpflichtung ohne Salz und
    /// kann sie keinem Konto zuordnen, der Betreiber kann sie auf Verlangen
    /// oeffnen. Ein zufaellig gewuerfeltes und weggeworfenes Salz waere kein
    /// Schutz, sondern ein Feld, das niemand mehr pruefen kann.
    /// </summary>
    public byte[] CommitmentSalt(Guid entryId) =>
        RcCrypto.Derive(_secret, RcCrypto.InfoCommitmentSalt(RcId.ToText(entryId)), 16);

    public static string Generate() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(MinimumBytes));
}
