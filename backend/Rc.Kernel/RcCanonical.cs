using System.Globalization;
using System.Text;

namespace Rc.Kernel;

/// <summary>
/// Anhang D — Wert eines Ketteneintrags.
///
/// Absichtlich ein eigener Typ und nicht System.Text.Json: 22.3 verbietet
/// Gleitkommazahlen, und ein Typ, der sie gar nicht erst aufnehmen kann, ist die
/// verlaesslichere Durchsetzung als eine Pruefung beim Serialisieren.
/// </summary>
public abstract record RcJson
{
    public sealed record Str(string Value) : RcJson;
    public sealed record Int(long Value) : RcJson;
    public sealed record Bool(bool Value) : RcJson;
    public sealed record Null : RcJson;
    public sealed record Arr(IReadOnlyList<RcJson> Items) : RcJson;
    public sealed record Obj(IReadOnlyDictionary<string, RcJson> Fields) : RcJson;

    public static RcJson S(string v) => new Str(v);
    public static RcJson I(long v) => new Int(v);
    public static RcJson B(bool v) => new Bool(v);
    public static RcJson Nil => new Null();
    public static RcJson G(Guid v) => new Str(RcId.ToText(v));
    public static RcJson Hex(ReadOnlySpan<byte> v) => new Str(RcCrypto.ToHex(v));

    /// <summary>UTC, Sekundengenauigkeit, Zulu-Form. Ohne feste Form waeren zwei
    /// gleichwertige Zeitpunkte zwei verschiedene Hashes.</summary>
    public static RcJson T(DateTimeOffset v) =>
        new Str(v.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture));

    public static RcJson A(params RcJson[] items) => new Arr(items);
    public static RcJson O(params (string Key, RcJson Value)[] fields)
        => new Obj(fields.ToDictionary(f => f.Key, f => f.Value));
}

/// <summary>
/// Anhang D — Kanonische Serialisierung nach RFC 8785 (JCS), beschraenkt auf
/// Ganzzahlen.
///
/// Dies ist die haerteste Einbahntuer des Vorhabens: Sobald der erste Eintrag
/// geschrieben ist, macht jede Aenderung hier JEDE bestehende Signatur ungueltig.
/// Eine Aenderung an dieser Datei ist niemals eine Verbesserung, sondern immer
/// eine neue Kette.
/// </summary>
public static class RcCanonical
{
    /// <summary>2^53-1 — darueber wird als Zeichenkette gefuehrt (22.3).</summary>
    public const long MaxSafeInteger = 9007199254740991L;

    public static string Serialize(RcJson value)
    {
        var sb = new StringBuilder(512);
        Write(sb, value);
        return sb.ToString();
    }

    /// <summary>UTF-8, ohne Byte Order Mark (22.2).</summary>
    public static byte[] SerializeToUtf8(RcJson value)
        => new UTF8Encoding(encoderShouldEmitUTF8Identifier: false).GetBytes(Serialize(value));

    public static byte[] Hash(RcJson value)
        => System.Security.Cryptography.SHA256.HashData(SerializeToUtf8(value));

    private static void Write(StringBuilder sb, RcJson v)
    {
        switch (v)
        {
            case RcJson.Null:
                sb.Append("null");
                break;

            case RcJson.Bool b:
                sb.Append(b.Value ? "true" : "false");
                break;

            case RcJson.Int i:
                if (i.Value > MaxSafeInteger || i.Value < -MaxSafeInteger)
                    throw new InvalidOperationException(
                        $"Ganzzahl {i.Value} liegt ausserhalb des sicheren Bereichs. Groessere Zahlen sind Zeichenketten (22.3).");
                sb.Append(i.Value.ToString(CultureInfo.InvariantCulture));
                break;

            case RcJson.Str s:
                WriteString(sb, s.Value);
                break;

            case RcJson.Arr a:
                sb.Append('[');
                for (var k = 0; k < a.Items.Count; k++)
                {
                    if (k > 0) sb.Append(',');
                    Write(sb, a.Items[k]);
                }
                sb.Append(']');
                break;

            case RcJson.Obj o:
                sb.Append('{');
                // 22.2: aufsteigend nach UTF-16-Codeeinheiten. CompareOrdinal
                // vergleicht genau so — nicht nach UTF-8-Bytes und nicht nach
                // Sprachregeln.
                var keys = o.Fields.Keys.ToArray();
                Array.Sort(keys, string.CompareOrdinal);
                for (var k = 0; k < keys.Length; k++)
                {
                    if (k > 0) sb.Append(',');
                    WriteString(sb, keys[k]);
                    sb.Append(':');
                    Write(sb, o.Fields[keys[k]]);
                }
                sb.Append('}');
                break;

            default:
                throw new InvalidOperationException($"Unbekannter Werttyp {v.GetType().Name}.");
        }
    }

    /// <summary>
    /// 22.2 — Minimale Maskierung: nur " \ und Steuerzeichen. Nicht-ASCII bleibt
    /// unmaskiert und steht als UTF-8. Das ist der haeufigste Umsetzungsfehler
    /// (siehe TV-8).
    /// </summary>
    private static void WriteString(StringBuilder sb, string s)
    {
        sb.Append('"');
        foreach (var c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20)
                        sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    else
                        sb.Append(c);
                    break;
            }
        }
        sb.Append('"');
    }
}
