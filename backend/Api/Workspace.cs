using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Der Arbeitsplatz — was DIESER Mensch hier hat.
///
/// <para>
/// Eine Adresse für alle Kacheln, nicht vier. Der Arbeitsplatz zeigt sie
/// nebeneinander; vier Abfragen hiessen vier Ladezustände auf einem Bild, und
/// drei davon sähen nach Fehlern aus, solange die vierte läuft.
/// </para>
///
/// <para>
/// <b>Kalender und Gespräche stehen hier NICHT.</b> Sie hängen an Bereichen,
/// und Bereiche gibt es erst, wenn ein Körper existiert. Eine Null zu liefern,
/// wo noch keine Quelle steht, wäre eine Zahl, der man später nicht ansieht,
/// dass sie nie gerechnet wurde — die Kacheln sagen es stattdessen selbst.
/// </para>
/// </summary>
public static class Workspace
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace", SummaryAsync);
    }

    /// <summary>Eine Rolle, wie der Arbeitsplatz sie zeigt.</summary>
    public readonly record struct RoleRow(Guid Id, string Kind, bool IsPersonal);

    private static async Task SummaryAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var roles = await RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var pages = await PagesOfAsync(connection, roles, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            roles = roles.Select(r => new { id = Ids.ToText(r.Id), kind = r.Kind, isPersonal = r.IsPersonal }),
            pages = pages.Select(p => new
            {
                path = p.Path,
                roleId = Ids.ToText(p.RoleId),
                claimedAt = p.ClaimedAt,

                // Ein zweiter Weg hierher — oder keiner. Die Oberfläche zeigt
                // beides an derselben Zeile, sonst müsste sie zweimal fragen.
                aliasOf = p.AliasOf,
                host = p.Host,

                /*
                 * WESSEN Seite das ist (0026). `null` heisst oeffentlich — und
                 * das gehoert in dieselbe Zeile wie Alias und Domain: der Baum
                 * zeigt alle drei nebeneinander, sonst muesste er zweimal
                 * fragen und zweimal zeichnen.
                 */
                internalForRoleId = p.InternalFor is null ? null : Ids.ToText(p.InternalFor.Value)
            })
        });
    }

    /// <summary>
    /// Die Rollen eines Kontos: die persönliche, und was von ihr aus im
    /// Rollengraphen hängt.
    ///
    /// <para>
    /// Erreichbarkeit im Graphen IST Schlüsselerreichbarkeit (Kernel:
    /// RoleKeys). Diese Liste ist deshalb keine Bequemlichkeit für die
    /// Oberfläche, sondern die Antwort auf „was darf dieser Mensch auf eine
    /// Adresse setzen".
    /// </para>
    /// </summary>
    public static async Task<List<RoleRow>> RolesOfAsync(
        SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT r.id, r.kind, CAST(1 AS bit) AS is_personal
            FROM app.account a
            JOIN app.role r ON r.id = a.person_role_id
            WHERE a.id = @account AND r.revoked_at IS NULL

            UNION ALL

            SELECT r.id, r.kind, CAST(0 AS bit)
            FROM app.account a
            JOIN app.role_edge e ON e.from_role_id = a.person_role_id AND e.revoked_at IS NULL
            JOIN app.role r      ON r.id = e.to_role_id AND r.revoked_at IS NULL
            WHERE a.id = @account;
            """, connection);

        cmd.Parameters.AddWithValue("@account", accountId);

        var roles = new List<RoleRow>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            roles.Add(new RoleRow(reader.GetGuid(0), reader.GetString(1), reader.GetBoolean(2)));
        }

        return roles;
    }

    /// <summary>Die Adressen, die diese Rollen führen.</summary>
    private static async Task<List<(string Path, Guid RoleId, DateTimeOffset ClaimedAt,
        string? AliasOf, string? Host, Guid? InternalFor)>> PagesOfAsync(
        SqlConnection connection, List<RoleRow> roles, CancellationToken ct)
    {
        var pages = new List<(string, Guid, DateTimeOffset, string?, string?, Guid?)>();

        // Ohne Rollen gibt es nichts zu fragen. Ein `IN ()` ohne Werte wäre
        // ausserdem kein gültiges SQL.
        if (roles.Count == 0) return pages;

        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand(
            $"SELECT path, claimed_by_role_id, claimed_at, alias_of, host, internal_for_role_id "
            + $"FROM app.slug WHERE claimed_by_role_id IN ({names}) ORDER BY path;", connection);

        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i].Id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            pages.Add((reader.GetString(0), reader.GetGuid(1), reader.GetDateTimeOffset(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetGuid(5)));
        }

        return pages;
    }
}
