using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0133 — WER DIE MENSCHEN EINES BEREICHS SIND, für einen Baustein, der nur ihnen gehört
/// (auf der Seite „po wydarzeniu" etwa: die Fotos nur für die Teilnehmer).
///
/// <para>
/// Drei Wege, dieselben wie für eine Seite nur mit Zugang (<c>SeenByAsync</c>), aber für
/// EINEN Bereich: ein eigener Platz (der Link aus dem Formular — ein Mensch ohne Konto mit
/// seinem individuellen Schlüssel), ein Link mit Zugang in diesem Browser, oder ein Konto,
/// dessen Rollen den Bereich lesen.
/// </para>
/// </summary>
public static partial class Page
{
    internal static async Task<bool> SeesAreaAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid area, IReadOnlyList<string> tokens, string? links)
    {
        foreach (var token in tokens)
        {
            await using var cmd = new SqlCommand("""
                SELECT TOP 1 1
                FROM app.access a
                WHERE a.token_sha256 = @token
                  AND a.revoked_at IS NULL AND a.status = N'active'
                  AND (a.expires_at IS NULL OR a.expires_at > @now)
                  AND (a.verify_hash IS NULL OR a.verified_at IS NOT NULL)
                  AND (a.area_id = @area
                       OR EXISTS (SELECT 1 FROM app.access_grant g WHERE g.access_id = a.id AND g.area_id = @area)
                       OR EXISTS (SELECT 1 FROM app.access_role_area rx WHERE rx.access_id = a.id AND rx.area_id = @area));
                """, connection);
            cmd.Parameters.AddWithValue("@token", System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@area", area);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null) return true;
        }

        var linkRoles = await HeldLinks.RolesAsync(connection, links, ctx.RequestAborted);
        if (linkRoles.Count > 0)
        {
            var names = string.Join(", ", linkRoles.Select((_, i) => $"@l{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT TOP 1 1 FROM app.certificate c
                WHERE c.scope_kind = N'area' AND c.scope_id = @area AND c.revoked_at IS NULL AND c.expires_at > @now
                  AND c.capability IN (N'read', N'write', N'admin') AND c.subject_role_id IN ({names});
                """, connection);
            for (var i = 0; i < linkRoles.Count; i++) cmd.Parameters.AddWithValue($"@l{i}", linkRoles[i]);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@area", area);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null) return true;
        }

        return await Auth.WhoAsync(ctx, db) is { } who
            && await Area.MayAsync(connection, who.AccountId, area, Kernel.Capability.Read, ctx.RequestAborted);
    }
}
