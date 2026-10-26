using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Bausteine — die Dinge selbst, getrennt von ihrem Platz auf einer Seite.
///
/// <para>
/// <b>Ein Baustein gehoert in einen BEREICH, nicht auf eine Seite</b> (0036).
/// Die Seite zeigt ihn; sie besitzt ihn nicht. Deshalb steht derselbe Bogen auf
/// zwei Seiten als ZWEI Verwendungen EINES Bausteins da — mit einem Satz
/// Fragen und einem Satz Antworten. Vorher waeren es zwei Bausteine gewesen,
/// die nur gleich aussehen.
/// </para>
///
/// <para>
/// <b>Wer was darf, entscheidet der Bereich</b> — nicht die Adresse. Das ist
/// die Dreiachsenregel an der Stelle, an der sie zaehlt: ein Baustein traegt
/// Daten, Daten liegen unter Schluesseln, und Schluessel sind Bereiche.
/// </para>
///
/// <para>
/// <b>Ein Baustein OHNE Bereich ist kein Fehler.</b> Ein Text traegt nichts
/// Versiegeltes; sein Inhalt steht offen, weil er auf einem Aushang steht. Fuer
/// ihn entscheidet die Seite, auf der er liegt. Die Unterscheidung steht in der
/// Zeile und nicht in einer Bedingung, die jemand richtig schreiben muss.
/// </para>
/// </summary>
public static partial class Module
{
    public const int MaxName = 200;

    /// <summary>Dieselbe Grenze wie fuer die Einstellung einer Seite (<see cref="Page"/>).</summary>
    private const int MaxConfig = Page.MaxConfig;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/modules", ListAsync);
        app.MapPost("/workspace/module", CreateAsync);
        app.MapPost("/workspace/module/{id:guid}", UpdateAsync);
        app.MapDelete("/workspace/module/{id:guid}", RemoveAsync);

        /* 0096 — Gruppen von Formularen (ein Ordner). */
        MapGroups(app);
    }

    /* -- Was ich sehe --------------------------------------------------------- */

    /// <summary>
    /// Die Bausteine, die mich etwas angehen.
    ///
    /// <para>
    /// Zwei Quellen, und beide sind noetig: was in einem Bereich liegt, den ich
    /// lese — und was auf einer Adresse steht, die ich fuehre. Ohne die zweite
    /// waeren die bereichslosen Bausteine (Texte) fuer niemanden sichtbar;
    /// ohne die erste saehe ich einen Bogen nicht, dessen Seite ein anderer
    /// fuehrt, obwohl seine Antworten in MEINEM Bereich landen.
    /// </para>
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { modules = Array.Empty<object>(), groups = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        /*
         * 0120 — die Rollen eines Formulars, durch Kommas, in ihrer Reihenfolge
         * (`FOR XML PATH`: dieser Server kennt `STRING_AGG` nicht). Vor der
         * Migration gibt es die Tabelle nicht — dann eben keine Liste, und die
         * eine Rolle von 0091 steht weiter in `memberRoleId`.
         */
        var memberRoles = await Schema.VirtualAreasAsync(connection, ctx.RequestAborted)
            ? """
              (SELECT CONVERT(nvarchar(36), mr.role_id) + N','
                 FROM app.module_role mr WHERE mr.module_id = m.id
                ORDER BY mr.position, mr.created_at
                  FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)')
              """
            : "CAST(NULL AS nvarchar(max))";

        /* 0081 — welche Formulare an einem Baustein hängen (Audience, „Napisz do nas"): wer dort schreiben darf. */
        var audience = new Dictionary<Guid, List<string>>();
        await using (var forms = new SqlCommand("""
            SELECT subject_id, module_id FROM app.audience_form WHERE subject_kind = N'module';
            """, connection))
        await using (var read = await forms.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await read.ReadAsync(ctx.RequestAborted))
            {
                var subject = read.GetGuid(0);
                if (!audience.TryGetValue(subject, out var list)) audience[subject] = list = [];
                list.Add(Ids.ToText(read.GetGuid(1)));
            }
        }

        await using var cmd = new SqlCommand($"""
            SELECT m.id, m.area_id, m.kind, m.name, m.config, m.created_at, m.for_kind,
                   a.name AS area_name,
                   m.closed_at,

                   /* Auf wie vielen Seiten er steht — „nirgends" ist eine Auskunft. */
                   (SELECT COUNT(*) FROM app.slug_part p WHERE p.module_id = m.id) AS used,

                   /*
                       UND AUF WELCHEN.

                       Die Zahl allein genuegte nicht. Wo ein Bogen steht,
                       entscheidet, welche Seite sein Portal tragen darf
                       (`Form.ReadSelfSeatAsync`: die Seite mit dem Bogen,
                       eine darueber, eine darunter). Die Oberflaeche las das
                       bisher aus dem WEG, ueber den jemand hereinkam — und
                       wer denselben Baustein ueber die Bausteinliste
                       aufschlug, bekam gar keine Auswahl.

                       Eine Zeichenkette mit Zeilenumbruechen und kein JSON:
                       es sind Pfade, sie enthalten keine Zeilenumbrueche
                       (`ck_slug_path`), und der Aufrufer trennt sie in einer
                       Zeile.
                   */
                   /*
                       `FOR XML PATH` und nicht `STRING_AGG`: dieser Server
                       kennt das zweite nicht. Ein Pfad besteht aus
                       Kleinbuchstaben, Ziffern, Strichen und Schraegstrichen
                       (`ck_slug_path`) — da gibt es nichts zu entschaerfen,
                       und `.value()` macht ohnehin rueckgaengig, was der
                       Umweg ueber XML verschluesselt hat.
                   */
                   (SELECT s.path + CHAR(10)
                      FROM app.slug_part p
                      JOIN app.slug s ON s.id = p.slug_id
                     WHERE p.module_id = m.id
                     ORDER BY s.path
                     FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)') AS pages,

                   /* Und wie viel er traegt: ein Bogen mit Antworten laesst sich
                      nicht mehr beliebig umbauen. */
                   (SELECT COUNT(*) FROM app.slug_field f WHERE f.part_id = m.id) AS fields,
                   (SELECT COUNT(*) FROM app.registration g WHERE g.part_id = m.id) AS entries,

                   /* 0047 — erweitert es ein anderes Formular, und wer füllt es aus? 0077 — wie oft? */
                   m.extends_id, m.audience, m.repeat_kind,

                   /* 0091 — die Rolle, die seine Menschen bekommen. */
                   m.member_role_id,

                   /* 0096 — in welcher Gruppe von Formularen, an welcher Stelle. */
                   m.form_group_id, m.group_position,

                   /* 0097 — der Name eines Formulars: versiegelt unter dem Schlüssel seines Bereichs. */
                   m.name_sealed, m.name_epoch,

                   /* 0120 — alle Rollen, die seine Menschen bekommen (Spalte 21: die Nummern davor bleiben). */
                   {memberRoles} AS member_roles,

                   /* 0133 — unter welchem Bereich die Fragen liegen, wenn nicht unter dem eigenen (Spalte 22). */
                   m.label_area_id
            FROM app.module m
            LEFT JOIN app.area a ON a.id = m.area_id
            WHERE
                /* im Bereich, den ich lese */
                EXISTS (SELECT 1 FROM app.certificate c
                         WHERE c.scope_kind = N'area' AND c.scope_id = m.area_id
                           AND c.revoked_at IS NULL AND c.expires_at > @now
                           AND c.subject_role_id IN ({names}))
                OR
                /* oder auf einer Adresse, die ich fuehre */
                EXISTS (SELECT 1 FROM app.slug_part p
                         JOIN app.slug s ON s.id = p.slug_id
                        WHERE p.module_id = m.id
                          AND s.claimed_by_role_id IN ({names}))
            ORDER BY m.kind, m.name, m.created_at;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var modules = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            modules.Add(new
            {
                moduleId = Ids.ToText(reader.GetGuid(0)),
                areaId = reader.IsDBNull(1) ? null : Ids.ToText(reader.GetGuid(1)),
                kind = reader.GetString(2),

                /* 0097 — offen nur bei Bausteinen, die kein Formular sind; der eines Formulars liegt versiegelt. */
                name = reader.IsDBNull(3) ? null : reader.GetString(3),
                nameSealed = Names.B64(reader, 19),
                nameEpoch = Names.Int(reader, 20),
                config = reader.IsDBNull(4) ? null : reader.GetString(4),
                createdAt = reader.GetDateTimeOffset(5),

                /* Wovon er handelt — daran haengt, woran ein Platz haengt (0038). */
                forKind = reader.GetString(6),
                areaName = reader.IsDBNull(7) ? null : reader.GetString(7),

                /* Das Formular als Ganzes (0042): geschlossen? Wer für die Daten steht, sagt sein Obszar (AreaController). */
                closed = !reader.IsDBNull(8),

                usedOnPages = reader.GetInt32(9),

                /* Leer heisst: nirgends. Kein `null` nach draussen — eine
                   leere Liste ist dieselbe Auskunft ohne Sonderfall. */
                pages = reader.IsDBNull(10)
                    ? Array.Empty<string>()
                    : reader.GetString(10).Split((char)10, StringSplitOptions.RemoveEmptyEntries),
                fields = reader.GetInt32(11),
                entries = reader.GetInt32(12),

                /* 0047 — die Erweiterung: wessen, und wer sie ausfüllt. */
                extendsId = reader.IsDBNull(13) ? null : Ids.ToText(reader.GetGuid(13)),
                audience = reader.GetString(14),

                /* 0077 — eine Erweiterung, die sich wiederholt: once, day, week, month, year. */
                repeat = reader.GetString(15),

                /* 0081 — die Formulare, deren Menschen an diesen Baustein schreiben dürfen. */
                formIds = audience.TryGetValue(reader.GetGuid(0), out var aud) ? aud : [],

                /* 0091 — die Rolle, die jeder bekommt, der es einsendet (null: keine). */
                memberRoleId = reader.IsDBNull(16) ? null : Ids.ToText(reader.GetGuid(16)),

                /* 0120 — alle Rollen; ohne die Migration die eine von 0091 als Liste. */
                memberRoleIds = MemberRoleList(reader.IsDBNull(21) ? null : reader.GetString(21),
                    reader.IsDBNull(16) ? null : reader.GetGuid(16)),

                /* 0096 — die Gruppe von Formularen (ein Ordner), und die Stelle darin. */
                groupId = reader.IsDBNull(17) ? null : Ids.ToText(reader.GetGuid(17)),
                groupPosition = reader.IsDBNull(18) ? (int?)null : reader.GetInt32(18),

                /* 0133 — der Bereich, unter dem die Fragen liegen (null: der eigene). */
                labelAreaId = reader.IsDBNull(22) ? null : Ids.ToText(reader.GetGuid(22))
            });
        }

        await reader.CloseAsync();
        await ctx.Response.WriteAsJsonAsync(new { modules, groups = await GroupsOfAsync(connection, mine, ctx.RequestAborted) });
    }

/* -- Gemeinsames --------------------------------------------------------- */

    /// <summary>
    /// 0120 — die Rollen eines Formulars aus der Liste, die SQL baut (Kennungen
    /// mit Komma dahinter, wie der Server sie schreibt: gross). Ohne Liste die
    /// eine Rolle von 0091, damit ein Browser nur EIN Feld lesen muss.
    /// </summary>
    public static List<string> MemberRoleList(string? list, Guid? single)
    {
        if (list is null) return single is null ? [] : [Ids.ToText(single.Value)];

        var roles = new List<string>();
        foreach (var part in list.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (Guid.TryParse(part, out var role) && !roles.Contains(Ids.ToText(role))) roles.Add(Ids.ToText(role));
        }
        return roles;
    }

    internal readonly record struct Row(
        Guid Id, Guid? AreaId, string Kind, string? Name, string ForKind,
        int Used, int Fields, int Entries, Guid? ExtendsId = null, string Audience = "public",
        string Repeat = Rounds.Once, bool HasSealedName = false);

    internal static async Task<Row?> ReadAsync(
        SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT m.id, m.area_id, m.kind, m.name, m.for_kind,
                   (SELECT COUNT(*) FROM app.slug_part p WHERE p.module_id = m.id),
                   (SELECT COUNT(*) FROM app.slug_field f WHERE f.part_id = m.id),
                   (SELECT COUNT(*) FROM app.registration g WHERE g.part_id = m.id),
                   m.extends_id, m.audience, m.repeat_kind,
                   CAST(CASE WHEN m.name_sealed IS NULL THEN 0 ELSE 1 END AS bit)
            FROM app.module m WHERE m.id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new Row(
            reader.GetGuid(0),
            reader.IsDBNull(1) ? null : reader.GetGuid(1),
            reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetString(4),
            reader.GetInt32(5), reader.GetInt32(6), reader.GetInt32(7),
            reader.IsDBNull(8) ? null : reader.GetGuid(8), reader.GetString(9), reader.GetString(10),
            reader.GetBoolean(11));
    }

    /// <summary>
    /// Wer einen Baustein pflegen darf.
    ///
    /// <para>
    /// <b>Mit Bereich entscheidet der Bereich</b> — dort liegen seine Daten.
    /// <b>Ohne Bereich entscheidet die Seite</b>, auf der er steht: ein Text
    /// gehoert dem Aushang, auf dem er haengt. Steht er nirgends und hat keinen
    /// Bereich, kann ihn niemand pflegen — das ist kein Zustand, der entsteht,
    /// ausser jemand nimmt ihn gerade von der letzten Seite.
    /// </para>
    /// </summary>
    private static async Task<bool> MayTendAsync(
        HttpContext ctx, Db db, SqlConnection connection, Row row, Guid accountId)
    {
        if (row.AreaId is not null)
        {
            return await Area.MayAsync(connection, accountId, row.AreaId.Value,
                Capability.Write, ctx.RequestAborted);
        }

        var mine = await Workspace.RolesOfAsync(connection, accountId, ctx.RequestAborted);
        if (mine.Count == 0) return false;

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT TOP 1 1 FROM app.slug_part p
            JOIN app.slug s ON s.id = p.slug_id
            WHERE p.module_id = @id AND s.claimed_by_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@id", row.Id);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        return await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
