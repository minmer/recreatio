using System.Security.Cryptography;

namespace Rc.Kernel;

/// <summary>
/// Anhang E — ID-Format.
///
/// UUIDv7 (RFC 9562): 48 Bit Zeitstempel, danach Zufall. Zeitlich sortierbar,
/// damit ein Index dicht bleibt; zufaellig genug, dass niemand Bestandsgroessen
/// abzaehlen kann.
///
/// Die ID entsteht im Klienten, vor dem Absenden (23.2) — sie ist Teil des
/// signierten Inhalts, und der Server vergaebe sie eine Runde zu spaet. Diese
/// Klasse dient dem Server zum Erzeugen in Tests und Hintergrundvorgaengen und
/// vor allem zum <see cref="Parse"/> der vom Klienten gelieferten Form.
///
/// Der Heimatspeicher (11.1) steht NICHT in der ID, sondern in einer eigenen
/// Spalte <c>home_store</c>. Ein Praefix wuerde aus 16 Byte eine Zeichenkette
/// machen, den Index verderben und in jede URL mitwandern.
/// </summary>
public static class RcId
{
    /// <summary>Heimatspeicher der Hauptinstanz. Nebenspeicher bekommen &gt; 0 (11.1).</summary>
    public const short HomeStoreMain = 0;

    public static Guid NewId() => NewId(DateTimeOffset.UtcNow);

    public static Guid NewId(DateTimeOffset at)
    {
        Span<byte> b = stackalloc byte[16];

        var ms = at.ToUnixTimeMilliseconds();
        if (ms < 0) throw new ArgumentOutOfRangeException(nameof(at), "Zeitpunkt vor 1970.");

        // 48 Bit Zeitstempel, big-endian
        b[0] = (byte)(ms >> 40);
        b[1] = (byte)(ms >> 32);
        b[2] = (byte)(ms >> 24);
        b[3] = (byte)(ms >> 16);
        b[4] = (byte)(ms >> 8);
        b[5] = (byte)ms;

        RandomNumberGenerator.Fill(b[6..]);

        b[6] = (byte)(0x70 | (b[6] & 0x0F));   // Version 7
        b[8] = (byte)(0x80 | (b[8] & 0x3F));   // Variante 10

        // Big-endian, damit die Textform der RFC-Byte-Reihenfolge entspricht.
        return new Guid(b, bigEndian: true);
    }

    /// <summary>
    /// 23.4: Kleinbuchstaben mit Bindestrichen. Grossbuchstaben werden
    /// abgelehnt und NICHT stillschweigend umgewandelt — sonst entstehen zwei
    /// Schreibweisen derselben ID, und eine davon steht irgendwann in einer AAD.
    /// </summary>
    public static Guid Parse(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        if (text.Length != 36)
            throw new FormatException("ID muss 36 Zeichen lang sein (8-4-4-4-12).");
        foreach (var c in text)
        {
            if (c is >= 'A' and <= 'F')
                throw new FormatException("ID enthaelt Grossbuchstaben. Erwartet wird Kleinschreibung (23.4).");
        }
        return Guid.ParseExact(text, "D");
    }

    public static string ToText(Guid id) => id.ToString("D");

    /// <summary>Nur als Sortierhinweis brauchbar, nie als Nachweis (23.2).</summary>
    public static DateTimeOffset? TimestampHint(Guid id)
    {
        Span<byte> b = stackalloc byte[16];
        if (!id.TryWriteBytes(b, bigEndian: true, out _)) return null;
        if ((b[6] & 0xF0) != 0x70) return null;   // keine v7

        long ms = ((long)b[0] << 40) | ((long)b[1] << 32) | ((long)b[2] << 24)
                | ((long)b[3] << 16) | ((long)b[4] << 8) | b[5];
        return DateTimeOffset.FromUnixTimeMilliseconds(ms);
    }

    public static bool IsVersion7(Guid id)
    {
        Span<byte> b = stackalloc byte[16];
        return id.TryWriteBytes(b, bigEndian: true, out _)
            && (b[6] & 0xF0) == 0x70
            && (b[8] & 0xC0) == 0x80;
    }
}
