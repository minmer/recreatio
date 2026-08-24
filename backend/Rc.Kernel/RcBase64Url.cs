namespace Rc.Kernel;

/// <summary>
/// Base64URL ohne Fuellzeichen (RFC 4648 §5).
///
/// Es gab davon bereits drei handgeschriebene Fassungen im Bestand — im Token,
/// in der Sitzungspruefung, im Browser. Drei Fassungen einer Kodierung sind
/// drei Gelegenheiten, sie unterschiedlich falsch zu machen; und wenn Kopf und
/// Datenbank sich um ein Fuellzeichen unterscheiden, sieht das aus wie ein
/// falsches Passwort.
/// </summary>
public static class RcBase64Url
{
    public static string Encode(ReadOnlySpan<byte> bytes) =>
        Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    public static bool TryDecode(string? text, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(text)) return false;

        var padded = text.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');

        try
        {
            bytes = Convert.FromBase64String(padded);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    /// <summary>Auch gewoehnliches Base64 wird angenommen — die Umkehrung ist eindeutig.</summary>
    public static byte[] Decode(string text) =>
        TryDecode(text, out var bytes) ? bytes : throw new FormatException("Kein gueltiges Base64URL.");
}
