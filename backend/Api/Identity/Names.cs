using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// NAMEN LIEGEN NIE OFFEN (0097) — der Name eines Formulars, einer Gruppe von
/// Formularen und eines Menschen kommt versiegelt herein und geht versiegelt
/// hinaus. Der Dienst prüft nur, ob die Hülle eine Hülle ist und ob es die
/// Epoche gibt, unter der sie liegen soll.
///
/// <code>
///   Formular, Gruppe   unter dem Schlüssel ihres Bereichs (auch einem offenen)
///   Mensch am Platz    unter dem Schlüssel seines Bereichs — NIE einem offenen —
///                      und unter dem Platzschlüssel (er selbst)
///   Termin             unter dem Bereichsschlüssel, für die Annahme, für den Gastgeber
/// </code>
/// </summary>
public static class Names
{
    /// <summary>Kopf (20) + Nonce (12) + Tag (16) + mindestens ein Byte.</summary>
    private const int MinSealed = 49;

    /// <summary>Ein Name von 200 Zeichen, UTF-8, versiegelt — und für den Gastgeber noch ein P-256-Punkt davor.</summary>
    public const int MaxSealed = 1024;

    /// <summary>Eine Hülle aus Base64URL — oder <c>null</c>: keine, zu kurz, zu lang, unlesbar.</summary>
    public static byte[]? Blob(string? text, int min = MinSealed, int max = MaxSealed)
    {
        if (string.IsNullOrWhiteSpace(text) || !Base64Url.TryDecode(text.Trim(), out var bytes)) return null;
        return bytes.Length >= min && bytes.Length <= max ? bytes : null;
    }

    /// <summary>
    /// Ein versiegelter Name mit seiner Epoche — beides oder keins.
    /// <c>Missing</c>: nichts mitgegeben. <c>Error</c>: etwas mitgegeben, das keine Hülle ist.
    /// </summary>
    public static (byte[]? Sealed, int Epoch, string? Error) Read(string? sealedText, int? epoch)
    {
        if (string.IsNullOrWhiteSpace(sealedText) && epoch is null) return (null, 0, null);
        var blob = Blob(sealedText);
        if (blob is null || epoch is null or < 1) return (null, 0, "Nieczytelna zapieczętowana nazwa.");
        return (blob, epoch.Value, null);
    }

    /// <summary>
    /// Gibt es diese Epoche des Bereichs — und, für den Namen eines Menschen, ist
    /// sie NICHT veröffentlicht? Unter einem offenen Schlüssel zu versiegeln hiesse,
    /// den Namen offen hinzulegen. <c>null</c>: in Ordnung; sonst der Grund.
    /// </summary>
    public static async Task<string?> EpochProblemAsync(
        SqlConnection connection, SqlTransaction? tx, Guid areaId, int epoch, bool person, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT CAST(CASE WHEN key_public IS NULL THEN 0 ELSE 1 END AS bit) FROM app.area_epoch WHERE area_id = @area AND epoch = @epoch;",
            connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@epoch", epoch);

        return await cmd.ExecuteScalarAsync(ct) switch
        {
            null or DBNull => "Tej epoki obszaru nie ma — odśwież i spróbuj jeszcze raz.",
            true when person => "Imię i nazwisko nie może leżeć pod jawnym kluczem obszaru.",
            _ => null
        };
    }

    /// <summary>Eine Hülle aus der Spalte <paramref name="i"/> als Base64URL — oder <c>null</c>.</summary>
    public static string? B64(SqlDataReader reader, int i) => reader.IsDBNull(i) ? null : Base64Url.Encode((byte[])reader[i]);

    public static int? Int(SqlDataReader reader, int i) => reader.IsDBNull(i) ? null : reader.GetInt32(i);

    public static string? Text(SqlDataReader reader, int i)
    {
        if (reader.IsDBNull(i)) return null;
        var text = reader.GetString(i).Trim();
        return text.Length == 0 ? null : text;
    }
}
