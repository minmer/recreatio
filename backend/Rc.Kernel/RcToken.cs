using System.Security.Cryptography;
using System.Text;

namespace Rc.Kernel;

/// <summary>
/// 10.3.1 — Tokens sind eine Kategorie, kein Einzelfall.
///
/// Es MUSS genau einen Token-Baustein auf der Plattform geben: Erzeugung,
/// Hashen, Vergleich in fester Zeit, Ablauf, Widerruf. Kein Modul erzeugt
/// eigene Tokens.
///
/// Der Altbestand hatte sechs verschiedene Verfahren nebeneinander. Hortus
/// machte es richtig (nur SHA-256 gespeichert, gleiche Antwort für falschen
/// Schluessel und unbekannte Nummer); <c>EventAccessLink</c> legte seinen Token
/// im Klartext in die Datenbank. Ein Datenbankabzug lieferte damit jedem
/// Teilnehmer seinen Zugang frei Haus.
///
/// Dieser Baustein macht den falschen Weg unmoeglich: Der Klartext existiert
/// genau einmal, im Rueckgabewert von <see cref="Create"/>, und wird nie
/// gespeichert.
/// </summary>
public static class RcToken
{
    /// <summary>18 Byte aus dem CSPRNG. Base64URL-kodiert 24 Zeichen — kurz
    /// genug für eine SMS, weit jenseits des Erratbaren.</summary>
    public const int SecretBytes = 18;

    /// <summary>
    /// 10.4 — Zwischen dem Klick auf den <c>sms:</c>-Link und dem tatsaechlichen
    /// Absenden koennen Stunden liegen: der Nutzer wird unterbrochen, legt das
    /// Telefon weg, sendet abends. Eine knappe Gueltigkeit liefe in der Praxis
    /// regelmaessig ins Leere.
    /// </summary>
    public static readonly TimeSpan MinimumSmsLifetime = TimeSpan.FromDays(7);

    /// <summary>
    /// Der Klartext verlaesst diese Methode genau einmal. Gespeichert wird
    /// ausschliesslich <see cref="RcTokenRecord.Hash"/>.
    /// </summary>
    public static (string Secret, RcTokenRecord Record) Create(
        RcTokenPurpose purpose,
        Guid subjectId,
        DateTimeOffset now,
        TimeSpan lifetime,
        string? label = null)
    {
        if (lifetime <= TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(lifetime), "Ein Token ohne Lebenszeit ist ein dauerhafter Zugang.");

        if (purpose == RcTokenPurpose.SmsAccessLink && lifetime < MinimumSmsLifetime)
            throw new ArgumentOutOfRangeException(nameof(lifetime),
                $"Ueber SMS verschickte Zugangslinks gelten mindestens {MinimumSmsLifetime.TotalDays} Tage (10.4).");

        var secret = NewSecret();
        var record = new RcTokenRecord
        {
            Id = RcId.NewId(now),
            Purpose = purpose,
            SubjectId = subjectId,
            Hash = HashSecret(secret),
            CreatedUtc = now,
            ExpiresUtc = now + lifetime,
            Label = label
        };
        return (secret, record);
    }

    /// <summary>
    /// SHA-256 über die Base64URL-Form. Kein Salz und keine langsame Ableitung:
    /// das Geheimnis hat 144 Bit aus dem CSPRNG, da gibt es nichts zu erraten
    /// und nichts vorzuberechnen. Eine langsame Ableitung wuerde hier nur jede
    /// Anfrage verteuern.
    /// </summary>
    /// <summary>
    /// Ein neues Geheimnis — nur die Zeichenkette, ohne Eintrag.
    ///
    /// <b>Wofuer es das getrennt gibt.</b> Nicht jedes Geheimnis gehoert in
    /// <c>rc_token</c>. Der Portallink eines Firmkandidaten zum Beispiel haengt
    /// an seiner eigenen Zeile: jene Tabelle ist fuer Einladungen, die jemand
    /// AUSSTELLT, und verlangt eine ausstellende Rolle — bei einer
    /// Selbstanmeldung gibt es keine.
    ///
    /// Gewuerfelt wird trotzdem HIER und nirgends sonst. Zwei Stellen, die
    /// Geheimnisse erzeugen, sind zwei Stellen, an denen sich Laenge oder
    /// Kodierung aendern koennen — und nur eine davon merkt es.
    /// </summary>
    public static string NewSecret() => ToBase64Url(RandomNumberGenerator.GetBytes(SecretBytes));

    public static byte[] HashSecret(string secret) => SHA256.HashData(Encoding.UTF8.GetBytes(secret.Trim()));

    /// <summary>
    /// 10.3 — Vergleich in fester Zeit. Ein Vergleich, der beim ersten
    /// abweichenden Byte abbricht, verraet ueber die Laufzeit, wie weit man
    /// gekommen ist.
    ///
    /// Gibt fuer abgelaufene, widerrufene und schlicht falsche Tokens dieselbe
    /// Antwort — nach dem Vorbild von Hortus: ein falscher Schluessel und eine
    /// unbekannte Nummer sind von aussen nicht zu unterscheiden.
    /// </summary>
    public static bool Verify(RcTokenRecord record, string presentedSecret, DateTimeOffset now)
    {
        var presented = HashSecret(presentedSecret);
        var matches = CryptographicOperations.FixedTimeEquals(record.Hash, presented);

        // Die Zustandspruefungen laufen bewusst NACH dem Vergleich und ohne
        // vorzeitigen Ausstieg, damit die Laufzeit nichts preisgibt.
        var live = record.RevokedUtc is null && record.ExpiresUtc > now;
        return matches & live;
    }

    private static string ToBase64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
}

/// <summary>
/// 10.3.1 — Die Anwendungsfaelle, die im Altbestand je ein eigenes Verfahren
/// hatten. Ein neuer Zweck braucht einen Eintrag hier, damit die Frage nach
/// Lebenszeit und Widerruf einmal gestellt wird.
/// </summary>
public enum RcTokenPurpose
{
    /// <summary>Zugang zu einer Veranstaltung ohne Konto.</summary>
    EventAccessLink,
    /// <summary>Ueber SMS verschickter Zugangslink — mindestens 7 Tage (10.4).</summary>
    SmsAccessLink,
    /// <summary>Bestaetigung einer Telefonnummer.</summary>
    PhoneVerification,
    /// <summary>Zugang zu einer Reservierung.</summary>
    ReservationView,
    /// <summary>Aufnahme in die Gastgeberrolle.</summary>
    HostInvitation,
    /// <summary>Geteilte Kalenderansicht (14.2).</summary>
    SharedCalendarView,
    /// <summary>Anteil der Wiederherstellung (Kapitel 8).</summary>
    RecoveryShare,
    /// <summary>Einladung in einen Bereich (3.12).</summary>
    AreaInvitation
}

public sealed record RcTokenRecord
{
    public required Guid Id { get; init; }
    public required RcTokenPurpose Purpose { get; init; }
    public required Guid SubjectId { get; init; }

    /// <summary>Nur der Hash. Der Klartext wird nie gespeichert (10.3).</summary>
    public required byte[] Hash { get; init; }

    public required DateTimeOffset CreatedUtc { get; init; }
    public required DateTimeOffset ExpiresUtc { get; init; }
    public DateTimeOffset? RevokedUtc { get; init; }
    public string? Label { get; init; }

    /// <summary>
    /// Nach dem Vorbild von <c>EventAccessLink</c>: Die erste Oeffnung zeigt,
    /// dass die Nummer die Person erreicht — der Token ist nur an eine Stelle
    /// gereist. Getrennt von <see cref="ViewCount"/> gefuehrt, weil Besuche zu
    /// zaehlen etwas anderes ist als zu wissen, dass er angekommen ist.
    ///
    /// Das Feld heisst NICHT "verifiziert": es belegt, dass der Link geoeffnet
    /// wurde, und sonst nichts (15.5 im Audit).
    /// </summary>
    public DateTimeOffset? FirstOpenedUtc { get; init; }

    public int ViewCount { get; init; }

    public bool IsLive(DateTimeOffset now) => RevokedUtc is null && ExpiresUtc > now;
}
