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

        var areasOf = new Dictionary<string, List<string>>();
        var subjectOf = new Dictionary<string, string>();
        if (pages.Count > 0)
        {
            var names = string.Join(", ", pages.Select((_, i) => $"@p{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT s.path, w.area_id FROM app.slug_area w
                JOIN app.slug s ON s.id = w.slug_id
                WHERE s.path IN ({names});
                """, connection);
            for (var i = 0; i < pages.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", pages[i].Item1);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var path = reader.GetString(0);
                if (!areasOf.TryGetValue(path, out var list)) areasOf[path] = list = [];
                list.Add(Ids.ToText(reader.GetGuid(1)));
            }
        }

        /* 0082 — wovon eine Seite handelt („Wybór na stronie"): fuer die Karte der Abhaengigkeiten (Seite → Formular). */
        if (pages.Count > 0)
        {
            var names = string.Join(", ", pages.Select((_, i) => $"@p{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT path, page_subject FROM app.slug
                WHERE path IN ({names}) AND page_subject IS NOT NULL;
                """, connection);
            for (var i = 0; i < pages.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", pages[i].Item1);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) subjectOf[reader.GetString(0)] = reader.GetString(1);
        }

        var open = await OpenPagesAsync(connection, roles, pages.Select(p => p.Path).ToHashSet(StringComparer.Ordinal), ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            roles = roles.Select(r => new { id = Ids.ToText(r.Id), kind = r.Kind, isPersonal = r.IsPersonal, depth = r.Depth }),

            /*
             * 0106 — DIE SEITEN, AUF DENEN DIESES KONTO ARBEITET, ohne sie zu
             * führen: ein Animator öffnet die Seite seiner Gruppe, ein Kandydat
             * seine — vorbereitet von jemand anderem. Damit steht der Warsztat
             * für sie nicht leer da („Nie prowadzisz żadnej strony").
             */
            open = open.Select(o => new { path = o.Path, title = o.Title, why = o.Why, edit = o.Edit }),
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
                internalForRoleId = p.InternalFor is null ? null : Ids.ToText(p.InternalFor.Value),

                /* 0106 — der Titel der Seite, wenn sie schon einen hat. */
                title = p.Title,

                /* Nur mit Zugang (0051): an welche Bereiche die Seite gebunden ist — leer: oeffentlich. */
                accessAreaIds = areasOf.TryGetValue(p.Path, out var bound) ? bound : [],

                /* 0082 — „Wybór na stronie" (JSON, im Browser gelesen) — oder null. */
                subject = subjectOf.TryGetValue(p.Path, out var subject) ? subject : null
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

    /// <summary>
    /// 0091 — WAS DIESE ROLLEN ERREICHEN: sie selbst und alles, was sie halten
    /// (nur <c>holds</c>, wie bei <see cref="RolesOfAsync"/>). Für die Rollen,
    /// die kein Konto als Wurzel haben: Links mit Zugang, die eine Rolle geben,
    /// und Rollen eines Platzes. <c>depth</c> 1 für die Ausgangsrollen — sie sind
    /// nie die eigene Person.
    /// </summary>
    public static async Task<List<RoleRow>> ClosureAsync(
        SqlConnection connection, IReadOnlyCollection<Guid> start, CancellationToken ct)
    {
        var roles = new List<RoleRow>();
        if (start.Count == 0) return roles;

        var names = string.Join(", ", start.Select((_, i) => $"@s{i}"));
        await using var cmd = new SqlCommand($"""
            WITH held (id, depth) AS (
                SELECT r.id, 1 FROM app.role r WHERE r.id IN ({names}) AND r.revoked_at IS NULL

                UNION ALL

                SELECT e.to_role_id, h.depth + 1
                FROM held h
                JOIN app.role_edge e ON e.from_role_id = h.id AND e.revoked_at IS NULL
                                    AND e.edge_kind = N'holds'
                JOIN app.role r      ON r.id = e.to_role_id AND r.revoked_at IS NULL
                WHERE h.depth <= {RoleGraph.MaxDepth}
            )
            SELECT r.id, r.kind, MIN(h.depth) AS depth
            FROM held h
            JOIN app.role r ON r.id = h.id
            GROUP BY r.id, r.kind, r.created_at
            ORDER BY MIN(h.depth), r.created_at
            OPTION (MAXRECURSION {RoleGraph.MaxDepth + 2});
            """, connection);
        var i = 0;
        foreach (var id in start) cmd.Parameters.AddWithValue($"@s{i++}", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) roles.Add(new RoleRow(reader.GetGuid(0), reader.GetString(1), false, reader.GetInt32(2)));
        return roles;
    }

    /// <summary>
    /// 0106 — SEITEN, DIE DIESES KONTO ÖFFNET, ABER NICHT FÜHRT — je mit dem Grund:
    /// <list type="bullet">
    ///   <item><c>area</c>: nur mit Zugang, an einen Bereich gebunden, den eine meiner Rollen liest (die Seite der Animatoren);</item>
    ///   <item><c>editor</c>: ein Zertifikat auf die Adresse (bearbeiten, ohne sie zu führen);</item>
    ///   <item><c>seat</c>: die Seite eines Platzes, den eine meiner Personen hält (der Kandydat, der seinen Link an sein Konto gebunden hat).</item>
    /// </list>
    /// Die eigenen (<paramref name="own"/>) und Zweitnamen fallen heraus.
    /// </summary>
    private static async Task<List<(string Path, string? Title, string Why, bool Edit)>> OpenPagesAsync(
        SqlConnection connection, List<RoleRow> roles, HashSet<string> own, CancellationToken ct)
    {
        var found = new List<(string Path, string? Title, string Why, bool Edit)>();
        if (roles.Count == 0) return found;

        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            WITH hits (path, title, why, edit, rank) AS (
                SELECT s.path, p.title, N'editor', CAST(1 AS bit), 0
                FROM app.certificate c
                JOIN app.slug s ON s.id = c.scope_id
                LEFT JOIN app.slug_page p ON p.slug_id = s.id
                WHERE s.alias_of IS NULL AND c.scope_kind = N'slug' AND c.subject_role_id IN ({names})
                  AND c.revoked_at IS NULL AND c.expires_at > @now AND c.capability IN (N'write', N'admin')
                UNION ALL
                SELECT s.path, p.title, N'area', CAST(0 AS bit), 1
                FROM app.slug_area w
                JOIN app.slug s ON s.id = w.slug_id
                LEFT JOIN app.slug_page p ON p.slug_id = s.id
                WHERE s.alias_of IS NULL AND w.area_id IN (SELECT scope_id FROM app.certificate
                                    WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now
                                      AND capability IN (N'read', N'write', N'admin') AND subject_role_id IN ({names}))
                UNION ALL
                SELECT s.path, p.title, N'seat', CAST(0 AS bit), 2
                FROM app.access_slug x
                JOIN app.access a ON a.id = x.access_id AND a.revoked_at IS NULL AND a.status = N'active'
                JOIN app.slug s ON s.id = x.slug_id
                LEFT JOIN app.slug_page p ON p.slug_id = s.id
                WHERE s.alias_of IS NULL AND x.access_id IN (
                    SELECT h.access_id FROM app.access_holder h WHERE h.role_id IN ({names}) AND (h.until IS NULL OR h.until > @now)
                    UNION
                    SELECT r.access_id FROM app.registration r
                     WHERE r.role_id IN ({names}) AND r.access_id IS NOT NULL AND r.withdrawn_at IS NULL)
            )
            SELECT h.path, MAX(h.title), (SELECT TOP 1 x.why FROM hits x WHERE x.path = h.path ORDER BY x.rank),
                   CAST(MAX(CAST(h.edit AS int)) AS bit), MIN(h.rank)
            FROM hits h
            GROUP BY h.path
            ORDER BY MIN(h.rank), h.path;
            """, connection);
        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i].Id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var path = reader.GetString(0);
            if (own.Contains(path)) continue;
            found.Add((path, reader.IsDBNull(1) ? null : reader.GetString(1), reader.GetString(2), reader.GetBoolean(3)));
        }
        return found;
    }

    /// <summary>Die Adressen, die diese Rollen führen.</summary>
    private static async Task<List<(string Path, Guid RoleId, DateTimeOffset ClaimedAt,
        string? AliasOf, string? Host, Guid? InternalFor, string? Title)>> PagesOfAsync(
        SqlConnection connection, List<RoleRow> roles, CancellationToken ct)
    {
        var pages = new List<(string, Guid, DateTimeOffset, string?, string?, Guid?, string?)>();

        // Ohne Rollen gibt es nichts zu fragen. Ein `IN ()` ohne Werte wäre
        // ausserdem kein gültiges SQL.
        if (roles.Count == 0) return pages;

        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));

        /* 0106 — mit dem Titel der Seite (`slug_page`), für „Twoje strony". */
        await using var cmd = new SqlCommand(
            $"SELECT s.path, s.claimed_by_role_id, s.claimed_at, s.alias_of, s.host, s.internal_for_role_id, p.title "
            + $"FROM app.slug s LEFT JOIN app.slug_page p ON p.slug_id = s.id WHERE s.claimed_by_role_id IN ({names}) ORDER BY s.path;", connection);

        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i].Id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            pages.Add((reader.GetString(0), reader.GetGuid(1), reader.GetDateTimeOffset(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetGuid(5),
                reader.IsDBNull(6) ? null : reader.GetString(6)));
        }

        return pages;
    }
}
