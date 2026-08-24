using System.Security.Cryptography;

namespace Rc.Kernel;

/// <summary>
/// 8.2 — Shamirs Geheimnisteilung ueber GF(2^8).
///
/// <b>Das Problem, das sie loest.</b> Der Wurzelschluessel liegt nur unter dem
/// Passwort seines Besitzers. Vergisst er es, ist alles fort — nicht
/// „gesperrt", sondern fort. Eine Kopie beim Betreiber waere die Loesung und
/// zugleich das Ende der ganzen Zusage: wer eine Kopie hat, kann mitlesen.
///
/// Die Teilung gibt einen dritten Weg: der Schluessel wird in <c>n</c> Stuecke
/// zerlegt, von denen <c>t</c> genuegen, um ihn wieder zusammenzusetzen — und
/// <c>t-1</c> Stuecke verraten <b>mathematisch nichts</b>. Nicht „wenig",
/// nichts: jeder mögliche Schluessel bleibt gleich wahrscheinlich.
///
/// <code>
///   t = 2, n = 3        Anteil A ─┐
///                       Anteil B ─┼─ zwei genuegen
///                       Anteil C ─┘
///
///   Ein Anteil allein:  jeder Schluessel bleibt gleich wahrscheinlich.
/// </code>
///
/// <b>Warum das so ist.</b> Ein Anteil ist ein Punkt auf einer Kurve vom Grad
/// <c>t-1</c>. Durch einen Punkt gehen unendlich viele Geraden; erst zwei
/// legen eine fest. Das Geheimnis ist der Wert der Kurve an der Stelle 0.
///
/// <b>Die Rechnung laeuft in GF(2^8)</b>, demselben Koerper wie AES — Bytes
/// bleiben Bytes, es gibt kein Ueberlaufen und keine Rundung.
/// </summary>
public static class RcShamir
{
    /// <summary>
    /// Das Reduktionspolynom von AES (x^8 + x^4 + x^3 + x + 1). Kein
    /// Geschmack, sondern die verbreitetste Wahl — wer die Anteile spaeter mit
    /// einem anderen Werkzeug zusammensetzen will, hat damit die besten
    /// Aussichten.
    /// </summary>
    private const int Polynomial = 0x11b;

    private static readonly byte[] Exp = new byte[512];
    private static readonly byte[] Log = new byte[256];

    /// <summary>
    /// Der Erzeuger ist <b>3</b>, nicht 2.
    ///
    /// Das ist keine Feinheit: mit dem Reduktionspolynom 0x11b hat die 2 die
    /// Ordnung 51 und durchlaeuft nur ein Fuenftel des Koerpers. Die Tabellen
    /// waeren dann luecken haft, und — das ist das Tueckische — Teilen und
    /// Zusammensetzen liefen trotzdem durch, nur mit falschem Ergebnis. Die
    /// Pruefreihe hat es gefunden; ohne sie waere es eine Wiederherstellung
    /// gewesen, die den Schluessel nicht wiederherstellt.
    /// </summary>
    private const int Generator = 3;

    static RcShamir()
    {
        var x = 1;
        for (var i = 0; i < 255; i++)
        {
            Exp[i] = (byte)x;
            Log[x] = (byte)i;

            // x * 3 in GF(2^8) ist (x << 1) reduziert, XOR x.
            var doubled = x << 1;
            if ((doubled & 0x100) != 0) doubled ^= Polynomial;
            x = doubled ^ x;
        }

        // Der Schwanz erspart beim Multiplizieren das Modulo.
        for (var i = 255; i < 512; i++) Exp[i] = Exp[i - 255];
    }

    /// <summary>
    /// Dass die Tabellen wirklich den ganzen Koerper durchlaufen, laesst sich
    /// pruefen — und wird es (Pruefreihe 8.2). Mit einem falschen Erzeuger
    /// stuenden hier Luecken.
    /// </summary>
    internal static bool TablesAreComplete() =>
        Enumerable.Range(1, 255).All(v => Exp[Log[(byte)v]] == v)
        && Enumerable.Range(0, 255).Select(i => Exp[i]).Distinct().Count() == 255;

    /// <summary>Ein Anteil: die Stelle und der Wert der Kurve dort.</summary>
    public readonly record struct Share(byte X, byte[] Y);

    /// <summary>
    /// Ein Geheimnis in <paramref name="total"/> Anteile zerlegen, von denen
    /// <paramref name="threshold"/> genuegen.
    ///
    /// <c>threshold</c> muss mindestens 2 sein — das erzwingt auch die
    /// Datenbank (<c>ck_rc_recovery_share_threshold</c>). Ein Schwellwert von 1
    /// waere keine Teilung, sondern eine Kopie: ein einzelner Buerge koennte
    /// allein an den Schluessel, und genau das soll das Verfahren verhindern.
    /// </summary>
    public static Share[] Split(ReadOnlySpan<byte> secret, int total, int threshold)
    {
        if (secret.Length == 0) throw new ArgumentException("Nichts zu teilen.", nameof(secret));
        if (threshold < 2) throw new ArgumentOutOfRangeException(nameof(threshold),
            "Ein Schwellwert von 1 waere eine Kopie, keine Teilung.");
        if (total < threshold) throw new ArgumentOutOfRangeException(nameof(total),
            "Es muessen mindestens so viele Anteile entstehen, wie zum Oeffnen noetig sind.");
        if (total > 255) throw new ArgumentOutOfRangeException(nameof(total),
            "In GF(2^8) gibt es nur 255 verschiedene Stellen.");

        var shares = new Share[total];
        for (var i = 0; i < total; i++) shares[i] = new Share((byte)(i + 1), new byte[secret.Length]);

        // Je Byte eine eigene Kurve. Der Wert an der Stelle 0 ist das
        // Geheimnisbyte; die uebrigen Koeffizienten sind zufaellig.
        Span<byte> coefficients = stackalloc byte[threshold];

        for (var position = 0; position < secret.Length; position++)
        {
            coefficients[0] = secret[position];
            RandomNumberGenerator.Fill(coefficients[1..]);

            for (var i = 0; i < total; i++)
                shares[i].Y[position] = Evaluate(coefficients, shares[i].X);
        }

        CryptographicOperations.ZeroMemory(coefficients);
        return shares;
    }

    /// <summary>
    /// Aus genuegend Anteilen das Geheimnis zurueckrechnen (Lagrange an der
    /// Stelle 0).
    ///
    /// <b>Diese Methode kann nicht pruefen, ob genug Anteile da sind.</b> Mit
    /// zu wenigen liefert sie ein Ergebnis — ein falsches, und zwar ohne
    /// Anzeichen. Das liegt am Verfahren und nicht an der Umsetzung: eben weil
    /// zu wenige Anteile nichts verraten, sieht das Falsche aus wie das
    /// Richtige. Wer sicher sein will, prueft das Ergebnis gegen etwas, das er
    /// unabhaengig kennt.
    /// </summary>
    public static byte[] Combine(IReadOnlyList<Share> shares)
    {
        if (shares.Count < 2) throw new ArgumentException("Mindestens zwei Anteile.", nameof(shares));

        var length = shares[0].Y.Length;
        if (shares.Any(s => s.Y.Length != length))
            throw new ArgumentException("Die Anteile gehoeren nicht zusammen.", nameof(shares));

        if (shares.Select(s => s.X).Distinct().Count() != shares.Count)
            throw new ArgumentException("Zwei Anteile von derselben Stelle.", nameof(shares));

        if (shares.Any(s => s.X == 0))
            throw new ArgumentException("Die Stelle 0 ist das Geheimnis selbst.", nameof(shares));

        var secret = new byte[length];
        for (var position = 0; position < length; position++)
        {
            byte sum = 0;
            for (var i = 0; i < shares.Count; i++)
            {
                // Lagrange-Gewicht: Produkt aller x_j / (x_j - x_i), j != i.
                // In GF(2^8) ist Subtraktion dasselbe wie XOR.
                byte weight = 1;
                for (var j = 0; j < shares.Count; j++)
                {
                    if (i == j) continue;
                    weight = Multiply(weight, Divide(shares[j].X, (byte)(shares[i].X ^ shares[j].X)));
                }
                sum ^= Multiply(shares[i].Y[position], weight);
            }
            secret[position] = sum;
        }
        return secret;
    }

    // -- GF(2^8) --------------------------------------------------------------

    private static byte Evaluate(ReadOnlySpan<byte> coefficients, byte x)
    {
        // Horner, von hinten nach vorn.
        byte result = 0;
        for (var i = coefficients.Length - 1; i >= 0; i--)
            result = (byte)(Multiply(result, x) ^ coefficients[i]);
        return result;
    }

    private static byte Multiply(byte a, byte b) =>
        a == 0 || b == 0 ? (byte)0 : Exp[Log[a] + Log[b]];

    private static byte Divide(byte a, byte b)
    {
        if (b == 0) throw new DivideByZeroException("In GF(2^8) gibt es keine Division durch 0.");
        return a == 0 ? (byte)0 : Exp[Log[a] - Log[b] + 255];
    }
}
