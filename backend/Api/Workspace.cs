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

    /// <summary>
    /// Eine Rolle, wie der Arbeitsplatz sie zeigt.
    ///
    /// <para>
    /// <c>IsPersonal</c> ist das KONTO (0040) — die Wurzel, deren Schluessel
    /// abgeleitet wird. <c>Depth</c> ist der kuerzeste Weg von dort: 1 heisst
    /// „haelt das Konto selbst", und das sind nur Personen.
    /// </para>
    /// </summary>
    public readonly record struct RoleRow(Guid Id, string Kind, bool IsPersonal, int Depth);

    /// <summary>
    /// Was gesagt wird, wenn jemand dem Konto etwas geben will. Eine Stelle,
    /// damit es ueberall dasselbe heisst.
    /// </summary>
    public const string AccountTakesNothing =
        "Konto samo niczego nie trzyma — wybierz osobę albo rolę pod nim.";

    /// <summary>
    /// Ist diese Rolle MEINE und darf sie etwas bekommen? Alles Meine ausser
    /// dem Konto (0040).
    /// </summary>
    public static bool IsAccount(IEnumerable<RoleRow> mine, Guid roleId) =>
        mine.Any(r => r.Id == roleId && r.IsPersonal);

    /// <summary>
    /// Ist diese Rolle IRGENDEIN Konto — auch ein fremdes?
    ///
    /// <para>
    /// Gebraucht, wo der Empfaenger nicht meiner sein muss: ein Zertifikat
    /// fuer einen anderen Menschen. Gefragt wird am Zeiger des Kontos und
    /// nicht an <c>kind</c> — der Zeiger ist, was die Rolle zum Konto macht.
    /// </para>
    /// </summary>
    public static async Task<bool> IsAnyAccountAsync(
        SqlConnection connection, SqlTransaction? tx, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT 1 FROM app.account WHERE person_role_id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>
    /// Die Person, als die dieses Konto handelt, wo niemand gewaehlt wird —
    /// die aelteste, die das Konto selbst haelt.
    /// </summary>
    public static RoleRow? SelfOf(IEnumerable<RoleRow> mine) =>
        mine.Where(r => r.Depth == 1 && r.Kind == "person").Select(r => (RoleRow?)r).FirstOrDefault();

    private static async Task SummaryAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var roles = await RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var pages = await PagesOfAsync(connection, roles, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            roles = roles.Select(r => new { id = Ids.ToText(r.Id), kind = r.Kind, isPersonal = r.IsPersonal, depth = r.Depth }),
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
    /// Die Rollen eines Kontos: das Konto selbst, und alles, was von ihm aus
    /// im Rollengraphen GEFUEHRT wird — ueber beliebig viele Stufen.
    ///
    /// <para>
    /// Erreichbarkeit im Graphen IST Schlüsselerreichbarkeit (Kernel:
    /// RoleKeys). Diese Liste ist deshalb keine Bequemlichkeit für die
    /// Oberfläche, sondern die Antwort auf „was darf dieser Mensch auf eine
    /// Adresse setzen".
    /// </para>
    ///
    /// <para>
    /// <b>Frueher nur eine Stufe tief.</b> Das reichte, solange alles direkt
    /// am Konto hing. Seit das Konto nur Personen haelt (0040), haengt jedes
    /// Amt mindestens zwei Stufen tiefer — `Konto → Anna → Sekretariat` —, und
    /// eine Stufe haette das Sekretariat stumm aus allem herausgenommen, was
    /// Anna tun darf. Der Rollengraph (`Roles.ListAsync`) rechnete schon immer
    /// ueber alle Stufen; jetzt rechnen beide dasselbe.
    /// </para>
    /// </summary>
    public static async Task<List<RoleRow>> RolesOfAsync(
        SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"""
            WITH held (id, depth) AS (
                SELECT r.id, 0
                FROM app.account a
                JOIN app.role r ON r.id = a.person_role_id
                WHERE a.id = @account AND r.revoked_at IS NULL

                UNION ALL

                SELECT e.to_role_id, h.depth + 1
                FROM held h
                /*
                    NUR `holds` (0032). Eine Lese- oder Schreibkante macht eine
                    Rolle sichtbar, nicht verfuegbar — liefe sie hier mit,
                    brachte eine Lesekante saemtliche Rechte dieser Rolle mit,
                    und das waere das Gegenteil dessen, was sie heisst.
                */
                JOIN app.role_edge e ON e.from_role_id = h.id AND e.revoked_at IS NULL
                                    AND e.edge_kind = N'holds'
                JOIN app.role r      ON r.id = e.to_role_id AND r.revoked_at IS NULL
                WHERE h.depth < {RoleGraph.MaxDepth}
            )
            SELECT r.id, r.kind, MIN(h.depth) AS depth
            FROM held h
            JOIN app.role r ON r.id = h.id
            GROUP BY r.id, r.kind, r.created_at
            ORDER BY MIN(h.depth), r.created_at
            OPTION (MAXRECURSION {RoleGraph.MaxDepth + 1});
            """, connection);

        cmd.Parameters.AddWithValue("@account", accountId);

        var roles = new List<RoleRow>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var depth = reader.GetInt32(2);
            roles.Add(new RoleRow(reader.GetGuid(0), reader.GetString(1), depth == 0, depth));
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
