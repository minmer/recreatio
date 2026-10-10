using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// LINKS MIT ZUGANG IM BROWSER (0073) — ohne Konto, wie die persönlichen Links
/// der Formulare.
///
/// <para>
/// Wer einen Link mit Zugang öffnet, landet an seinem ZIEL (<c>aim</c>), und
/// der Browser behält den Link — mehrere, sie addieren sich. Bei jeder Seite,
/// jedem Kalender schickt er die BEWEISE mit (<c>links=</c>): HKDF(T, proof),
/// nie das Geheimnis T selbst. Hier wird daraus die Linkrolle, solange der
/// Link gilt (nicht zurückgezogen, nicht abgelaufen, nicht verbraucht, die
/// Rolle nicht zurückgenommen) — und was die Rolle lesen darf, darf dieser
/// Browser lesen.
/// </para>
///
/// <para>
/// <b>Der Dienst öffnet trotzdem nichts.</b> Er gibt die Hüllen heraus, die
/// der Linkrolle gehören; aufmachen kann sie nur, wer T kennt (daraus der
/// Siegelschlüssel, daraus der Rollenschlüssel, daraus die Bereiche).
/// Schreiben bleibt beim Konto: dazu wird der Link einem Konto hinzugefügt.
/// </para>
/// </summary>
public static class HeldLinks
{
    /// <summary>So viele behält ein Browser (<c>linkKeep.ts</c>) — mehr wird nicht geprüft.</summary>
    public const int Max = 20;

    public sealed record Held(Guid InvitationId, Guid RoleId, byte[] Lookup);

    /// <summary>Die Beweise aus der Adresse: Base64URL, je 32 Bytes, durch Kommas.</summary>
    public static List<byte[]> Proofs(string? text) =>
        (text ?? string.Empty).Split(',')
            .Select(one => one.Trim())
            .Where(one => one.Length is > 0 and <= 64)
            .Distinct()
            .Select(one => Base64Url.TryDecode(one, out var bytes) && bytes.Length == 32 ? bytes : null)
            .Where(one => one is not null)
            .Take(Max)
            .ToList()!;

    /// <summary>Die Links, die gelten — zu jedem Beweis höchstens einer.</summary>
    public static async Task<List<Held>> ValidAsync(SqlConnection connection, IReadOnlyList<byte[]> proofs, CancellationToken ct)
    {
        if (proofs.Count == 0) return [];
        var lookups = proofs.Select(SHA256.HashData).ToList();
        var names = string.Join(", ", lookups.Select((_, i) => $"@t{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT i.id, i.role_id, i.token_sha256
            FROM app.invitation i
            JOIN app.role r ON r.id = i.role_id AND r.revoked_at IS NULL
            WHERE i.purpose = N'area-link' AND i.token_sha256 IN ({names})
              AND i.revoked_at IS NULL AND i.expires_at > @now AND i.used_count < i.max_uses;
            """, connection);
        for (var i = 0; i < lookups.Count; i++) cmd.Parameters.Add($"@t{i}", System.Data.SqlDbType.VarBinary, 32).Value = lookups[i];
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var held = new List<Held>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) held.Add(new Held(reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2]));
        return held;
    }

    /// <summary>
    /// Die Rollen zu den Beweisen in der Adresse — kurz, für die Leser von
    /// Seite und Kalender. 0091: die Linkrollen UND was sie halten — ein Link,
    /// der eine Rolle gibt, gibt, was die Rolle darf.
    /// </summary>
    public static async Task<List<Guid>> RolesAsync(SqlConnection connection, string? links, CancellationToken ct) =>
        (await RoleRowsAsync(connection, links, ct)).Select(r => r.Id).ToList();

    /// <summary>Wie <see cref="RolesAsync"/>, mit der Art jeder Rolle — für den Rufer.</summary>
    public static async Task<List<Workspace.RoleRow>> RoleRowsAsync(SqlConnection connection, string? links, CancellationToken ct)
    {
        var proofs = Proofs(links);
        if (proofs.Count == 0) return [];
        var held = (await ValidAsync(connection, proofs, ct)).Select(h => h.RoleId).Distinct().ToList();
        return await Workspace.ClosureAsync(connection, held, ct);
    }

    /// <summary>Die Bereiche, deren Schlüssel die Linkrollen halten — das, was sie lesen.</summary>
    public static async Task<List<Guid>> KeyedAreasAsync(SqlConnection connection, IReadOnlyList<Guid> roles, CancellationToken ct)
    {
        if (roles.Count == 0) return [];
        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT key_ref FROM app.key_grant
            WHERE key_kind = N'epoch' AND destroyed_at IS NULL AND role_id IN ({names});
            """, connection);
        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i]);
        var areas = new List<Guid>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        return areas;
    }

    /* -- Das Ziel ------------------------------------------------------------------------- */

    public const int MaxAim = 400;

    /// <summary>
    /// Das Ziel eines Links als Weg hinter <c>#/</c> — aus „parish/x", „#/parish/x"
    /// oder „https://recreatio.pl/#/parish/x?s=2". <c>null</c>: kein Ziel.
    /// <c>error</c>: was nicht stimmt.
    /// </summary>
    public static (string? Aim, string? Error) NormaliseAim(string? text)
    {
        var t = (text ?? string.Empty).Trim();
        if (t.Length == 0) return (null, null);

        var hash = t.IndexOf('#');
        if (t.Contains("://"))
        {
            if (!Uri.TryCreate(t, UriKind.Absolute, out var uri) || !IsOurHost(uri.Host))
                return (null, "Cel musi być adresem na recreatio.pl.");
            if (hash < 0) return (null, null);
        }
        if (hash >= 0) t = t[(hash + 1)..];
        t = t.TrimStart('/');

        if (t.Length == 0) return (null, null);
        if (t.Length > MaxAim) return (null, $"Cel: najwyżej {MaxAim} znaków.");
        if (t.Any(c => char.IsWhiteSpace(c) || c is '#' or '<' or '>' or '"' or '\\' or '`'))
            return (null, "W adresie celu są niedozwolone znaki.");
        if (t == "dolacz" || t.StartsWith("dolacz/", StringComparison.Ordinal)) return (null, null);
        return (t, null);
    }

    private static bool IsOurHost(string host) =>
        host.Equals("recreatio.pl", StringComparison.OrdinalIgnoreCase)
        || host.Equals("www.recreatio.pl", StringComparison.OrdinalIgnoreCase)
        || host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
        || host.Equals("127.0.0.1", StringComparison.Ordinal);
}
