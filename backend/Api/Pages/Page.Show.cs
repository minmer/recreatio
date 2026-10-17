using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Eine Seite zeigen — und wer sie sehen darf.</summary>
public static partial class Page
{
    /* -- Zeigen ------------------------------------------------------------- */

    private static async Task ShowAsync(HttpContext ctx, Db db, string? path, string? seat, string? seats, string? links)
    {
        var wanted = Slug.Normalise(path);

        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma strony.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await WritePageAsync(ctx, db, connection, wanted, Tokens(seat, seats), links);
    }

    /// <summary>
    /// Die Links, die dieser Browser fuer das Haus haelt — der eine (`seat`,
    /// wie bisher) und die uebrigen (`seats`, durch Kommas). Hoechstens zwanzig:
    /// mehr haelt kein Mensch, und mehr zu pruefen waere Arbeit fuer nichts.
    /// </summary>
    private static List<string> Tokens(string? seat, string? seats) =>
        new[] { seat }.Concat((seats ?? string.Empty).Split(','))
            .Select(one => (one ?? string.Empty).Trim())
            .Where(one => one.Length is > 0 and <= 200)
            .Distinct()
            .Take(20)
            .ToList();

    /// <summary>
    /// Welche Seite ein eigener Name zeigt.
    ///
    /// <para>
    /// Der Browser fragt das, sobald er unter einem anderen Namen als
    /// recreatio.pl geladen wurde: er kennt seinen Ort, aber nicht, welche
    /// Adresse dort gemeint ist. Was er nennt, ist ungeprüft — und das macht
    /// nichts: ein Name ist ein Schlüssel zum Nachschlagen, kein Recht. Was
    /// dabei herauskommt, ist ohnehin öffentlich.
    /// </para>
    /// </summary>
    private static async Task SiteAsync(HttpContext ctx, Db db, string? host, string? path, string? seat, string? seats, string? links)
    {
        var name = (host ?? string.Empty).Trim().ToLowerInvariant();

        // Der Browser nennt bei einem abweichenden Port „name:5173". Der Port
        // gehört nicht zum Namen.
        var colon = name.IndexOf(':');
        if (colon >= 0) name = name[..colon];

        if (!Slug.IsHostName(name))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ta domena nie prowadzi do żadnej strony.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        string root;
        await using (var find = new SqlCommand(
            "SELECT path, alias_of FROM app.slug WHERE host = @host;", connection))
        {
            find.Parameters.AddWithValue("@host", name);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);

            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Ta domena nie prowadzi do żadnej strony.");
                return;
            }

            /*
             * Zeigt der Name auf einen Alias, ist die WURZEL sein Ziel: dort
             * liegt der Inhalt, und dort hängen die lokalen Routen. Ein Alias
             * hat keinen eigenen Unterbau.
             */
            root = reader.IsDBNull(1) ? reader.GetString(0) : reader.GetString(1);
        }

        /*
         * DIE UNTERROUTEN SIND LOKAL. Unter cogita.pl heisst `cogita/kursy`
         * schlicht `#/kursy`.
         *
         * Sonst müsste jeder Verweis auf der Seite wissen, unter welchem Namen
         * sie gerade ausgeliefert wird — derselbe Link wäre auf recreatio.pl
         * richtig und auf cogita.pl falsch, und eine Seite, die unter zwei Namen
         * steht, hätte zwei Sorten Links, von denen immer eine bricht.
         */
        var local = Slug.Normalise(path);

        if (local != Slug.Home && !Slug.IsWellFormed(local))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
            return;
        }

        var wanted =
            local == Slug.Home ? root
            : root == Slug.Home ? local
            : $"{root}/{local}";

        if (wanted.Length > Slug.MaxPathLength)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
            return;
        }

        await WritePageAsync(ctx, db, connection, wanted, Tokens(seat, seats), links);
    }

    /// <summary>
    /// Die Seite einer Adresse hinausschreiben — die eine Stelle, die das tut.
    ///
    /// <para>
    /// Sie wird von zwei Seiten gerufen: vom Pfad her und vom Namen her. Zwei
    /// Fassungen hiessen zwei Meinungen darüber, wann ein Alias gilt und was
    /// „noch nichts veröffentlicht" bedeutet.
    /// </para>
    /// </summary>
    /// <summary>
    /// WER HIER HINEINDARF — je Link und je Person, nicht bloss ja oder nein.
    ///
    /// <para>
    /// Die Seite fragt nicht nur „darf dieser Browser", sondern auch „fuer
    /// WEN darf er hier handeln". Ein Link einer anderen Seite desselben
    /// Hauses (ein alter Link aus einem anderen Formular) oder eine eigene
    /// Person ohne Zugang soll hier keinen Termin nehmen und nichts eintragen —
    /// die Seite sagt dann, dass es Zugang braucht.
    /// </para>
    ///
    /// <para>
    /// <b>Gebunden an BEREICHE</b> (0051, Wunsch der Kanzlei): Zugang hat ein
    /// Link, dessen Platz in einem der Bereiche der Seite liegt (oder der an
    /// genau diese Seite gehaengt ist), eine Person, die einen dieser Bereiche
    /// lesen darf, und wer die Seite fuehrt. Die alte Rollenbindung (0026)
    /// gilt daneben weiter, solange eine Seite sie noch traegt.
    /// </para>
    /// </summary>
    private sealed record Seen(List<string> Seats, List<string> Roles, bool Manages, bool SignedIn, List<string> Links)
    {
        public bool Any => Seats.Count > 0 || Roles.Count > 0 || Manages || Links.Count > 0;
    }

    private static async Task<Seen> SeenByAsync(
        HttpContext ctx, Db db, SqlConnection connection,
        Guid? internalFor, Guid slugId, Guid askedId, string path, IReadOnlyList<string> tokens, string? links)
    {
        /*
         * 1. JE LINK — schon bestaetigt, und: sein Platz liegt in einem der
         * Bereiche der Seite, oder er haengt an genau dieser Seite.
         */
        var seats = new List<string>();

        foreach (var token in tokens)
        {
            await using var cmd = new SqlCommand("""
                SELECT TOP 1 1
                FROM app.access a
                WHERE a.token_sha256 = @token
                  AND a.revoked_at IS NULL AND a.status = N'active'
                  AND (a.expires_at IS NULL OR a.expires_at > @now)
                  AND (a.verify_hash IS NULL OR a.verified_at IS NOT NULL)
                  AND (EXISTS (SELECT 1 FROM app.access_slug g
                                WHERE g.access_id = a.id AND g.slug_id IN (@slug, @asked))
                       OR a.area_id IN (SELECT w.area_id FROM app.slug_area w WHERE w.slug_id = @slug)
                       /* 0091 — oder seine Rolle (die seines Formulars) liest einen der Bereiche der Seite. */
                       OR EXISTS (SELECT 1 FROM app.access_role_area rx JOIN app.slug_area w ON w.area_id = rx.area_id
                                   WHERE rx.access_id = a.id AND w.slug_id = @slug));
                """, connection);

            cmd.Parameters.AddWithValue("@token",
                System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@slug", slugId);
            cmd.Parameters.AddWithValue("@asked", askedId);

            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null) seats.Add(token);
        }

        /*
         * 1b. JE LINK MIT ZUGANG (0073), den dieser Browser hält — ohne Konto:
         * hat seine Linkrolle ein Zertifikat auf einen der Bereiche der Seite?
         */
        var heldLinks = new List<string>();
        var linkRoles = await HeldLinks.RolesAsync(connection, links, ctx.RequestAborted);
        if (linkRoles.Count > 0)
        {
            var names = string.Join(", ", linkRoles.Select((_, i) => $"@l{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT DISTINCT c.subject_role_id FROM app.certificate c
                WHERE c.scope_kind = N'area' AND c.revoked_at IS NULL AND c.expires_at > @now
                  AND c.capability IN (N'read', N'write', N'admin')
                  AND c.subject_role_id IN ({names})
                  AND c.scope_id IN (SELECT w.area_id FROM app.slug_area w WHERE w.slug_id = @slug);
                """, connection);
            for (var i = 0; i < linkRoles.Count; i++) cmd.Parameters.AddWithValue($"@l{i}", linkRoles[i]);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@slug", slugId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) heldLinks.Add(Ids.ToText(reader.GetGuid(0)));
        }

        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) return new Seen(seats, [], false, false, heldLinks);

        /* 2. WER DIE SEITE FUEHRT — er sieht sie, auch ohne Person mit Zugang. */
        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);

        /*
         * 3. JE EIGENE PERSON: darf eine ihrer Rollen (im Rollengraphen, nur
         * ueber „holds") einen der Bereiche der Seite lesen — ein Zertifikat
         * read, write oder admin? Haelt sie die alte Rolle der Seite? Oder
         * einen Link dafuer, den sie sich zugeordnet hat („Przypisz do siebie")?
         */
        var persons = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted))
            .Where(r => r.Kind == "person").Select(r => r.Id).ToList();

        var roles = new List<string>();

        if (persons.Count > 0)
        {
            var names = string.Join(", ", persons.Select((_, i) => $"@p{i}"));

            await using var cmd = new SqlCommand($"""
                WITH reach (start, id, depth) AS (
                    SELECT r.id, r.id, 0 FROM app.role r WHERE r.id IN ({names})
                    UNION ALL
                    SELECT h.start, e.to_role_id, h.depth + 1
                    FROM reach h
                    JOIN app.role_edge e ON e.from_role_id = h.id AND e.revoked_at IS NULL
                                        AND e.edge_kind = N'holds'
                    JOIN app.role x      ON x.id = e.to_role_id AND x.revoked_at IS NULL
                    WHERE h.depth < {RoleGraph.MaxDepth}
                )
                SELECT DISTINCT start FROM reach WHERE @internal IS NOT NULL AND id = @internal
                UNION
                SELECT DISTINCT h.start
                FROM reach h
                JOIN app.certificate c ON c.subject_role_id = h.id
                WHERE c.scope_kind = N'area' AND c.revoked_at IS NULL AND c.expires_at > @now
                  AND c.capability IN (N'read', N'write', N'admin')
                  AND c.scope_id IN (SELECT w.area_id FROM app.slug_area w WHERE w.slug_id = @slug)
                UNION
                SELECT DISTINCT h.role_id
                FROM app.access_holder h
                JOIN app.access a ON a.id = h.access_id
                WHERE h.until IS NULL AND h.role_id IN ({names})
                  AND a.revoked_at IS NULL AND a.status = N'active'
                  AND (EXISTS (SELECT 1 FROM app.access_slug g
                                WHERE g.access_id = a.id AND g.slug_id IN (@slug, @asked))
                       OR a.area_id IN (SELECT w.area_id FROM app.slug_area w WHERE w.slug_id = @slug)
                       OR EXISTS (SELECT 1 FROM app.access_role_area rx JOIN app.slug_area w ON w.area_id = rx.area_id
                                   WHERE rx.access_id = a.id AND w.slug_id = @slug))
                OPTION (MAXRECURSION {RoleGraph.MaxDepth + 1});
                """, connection);

            for (var i = 0; i < persons.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", persons[i]);
            cmd.Parameters.Add("@internal", System.Data.SqlDbType.UniqueIdentifier).Value =
                (object?)internalFor ?? DBNull.Value;
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@slug", slugId);
            cmd.Parameters.AddWithValue("@asked", askedId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) roles.Add(Ids.ToText(reader.GetGuid(0)));
        }

        return new Seen(seats, roles, grip.MayWrite, true, heldLinks);
    }
}
