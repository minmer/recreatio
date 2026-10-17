using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Der Link: einen Platz öffnen, mit seinen Rollen, Vorlagen, Einsendungen und Zuteilungen; an ein Konto binden; meine Plätze.</summary>
public static partial class Seat
{
    /* -- Der Link ----------------------------------------------------------- */

    /// <summary>
    /// Was der Link oeffnet — OHNE Konto.
    ///
    /// <para>
    /// Der Dienst rechnet den Abdruck des mitgegebenen Geheimnisses und sucht
    /// danach. Den SCHLUESSEL bekommt er dabei nicht: der steht hinter der
    /// Raute und bleibt im Browser. Was hier hinausgeht, ist die Huelle.
    /// </para>
    ///
    /// <para>
    /// <b>Ein abgelaufener oder zurueckgezogener Platz antwortet wie einer, den
    /// es nicht gibt.</b> Der Unterschied waere eine Auskunft darueber, welche
    /// Links es einmal gab.
    /// </para>
    /// </summary>
    private static async Task OpenAsync(HttpContext ctx, Db db, string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * Gezaehlt wird beim Oeffnen, und zwar in derselben Anweisung: eine
         * zweite waere eine zweite Runde und koennte ausbleiben.
         */
        await using var cmd = new SqlCommand("""
            UPDATE app.access
               SET view_count = view_count + 1
            OUTPUT inserted.id, inserted.area_id, inserted.seat_key_sealed, inserted.epoch,
                   inserted.expires_at,
                   inserted.verify_hash, inserted.verified_at, inserted.verify_fields,
                   inserted.verify_failures, inserted.invitation_id,
                   inserted.own_name_sealed, inserted.name_sealed, inserted.name_epoch
             WHERE token_sha256 = @token
               AND revoked_at IS NULL
               AND status = N'active'
               AND (expires_at IS NULL OR expires_at > @now);
            """, connection);

        cmd.Parameters.AddWithValue("@token", SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token.Trim())));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        /*
         * Der Leser wird GESCHLOSSEN, bevor die Zuteilungen geholt werden. Ein
         * zweiter Befehl ueber dieselbe Verbindung, waehrend er offen ist,
         * weist SQL Server ohne MARS ab — und von aussen saehe es aus wie ein
         * Platz ohne Gemeinsames.
         */
        Guid seatId, areaId;
        byte[] seatKeySealed;
        int epoch;
        byte[]? ownName, named;
        int? namedEpoch;
        DateTimeOffset? expiresAt;
        bool asksFirst;
        string? verifyFieldsText;
        int failures;
        Guid? invitationId;

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
                return;
            }

            seatId = reader.GetGuid(0);
            areaId = reader.GetGuid(1);
            seatKeySealed = (byte[])reader[2];
            epoch = reader.GetInt32(3);
            expiresAt = reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4);

            asksFirst = !reader.IsDBNull(5) && reader.IsDBNull(6);
            verifyFieldsText = reader.IsDBNull(7) ? null : reader.GetString(7);
            failures = reader.GetInt32(8);
            invitationId = reader.IsDBNull(9) ? null : reader.GetGuid(9);

            /* 0097 — wie er heisst: unter seinem Platzschlüssel (seine Kopie) und unter dem des Bereichs. */
            ownName = reader.IsDBNull(10) ? null : (byte[])reader[10];
            named = reader.IsDBNull(11) ? null : (byte[])reader[11];
            namedEpoch = Names.Int(reader, 12);
        }

        /* 0095 — die Person eines Links: durch welchen Link sie da ist (sein Name steht in Klammern hinter ihrem). */
        var via = invitationId is Guid link ? await LinkLabelAsync(connection, link, ctx.RequestAborted) : null;

        /*
         * ERST BESTAETIGEN, DANN OEFFNEN (0046). Solange der Link beim ersten
         * Oeffnen fragt und niemand richtig geantwortet hat, geht hier NICHTS
         * hinaus, was etwas aufschliesst: kein Platzschluessel, keine
         * Einsendung. Nur die Fragen — ihre Beschriftung liegt
         * unter dem offenen Schluessel des Formulars.
         */
        if (asksFirst)
        {
            await ctx.Response.WriteAsJsonAsync(new
            {
                seatId = Ids.ToText(seatId),
                verify = new
                {
                    fields = await VerifyQuestionsAsync(connection, verifyFieldsText, ctx.RequestAborted),
                    attemptsLeft = Math.Max(0, MaxVerifyFailures - failures)
                }
            });
            return;
        }

        /*
         * Was dieser Platz AUSSERDEM aufschliesst — der Klassenschluessel.
         * Versiegelt unter dem Platzschluessel: der Dienst reicht ihn durch,
         * ohne ihn zu kennen.
         */
        var bySeat = await GrantsAsync(connection, [seatId], ctx.RequestAborted);

        /*
         * WAS ER SELBST EINGESANDT HAT (0027). Der Wertschluessel liegt ein
         * zweites Mal da, versiegelt unter dem Platzschluessel — der Dienst
         * reicht ihn durch, ohne ihn zu kennen, wie alles andere hier auch.
         *
         * Ohne das waere das Portal eines Firmlings leer: seine Angaben liegen
         * unter dem Annahmeschluessel, und der gehoert dem Amt.
         */
        var submitted = await SubmittedAsync(connection, seatId, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seatId),
            areaId = Ids.ToText(areaId),

            // Die Huelle des Platzschluessels. Der Oeffner steckt im Link.
            seatKeySealed = Base64Url.Encode(seatKeySealed),
            epoch,

            /* 0097 — wie er heisst, versiegelt: seine Kopie und die der Kanzlei. */
            ownNameSealed = ownName is null ? null : Base64Url.Encode(ownName),
            nameSealed = named is null ? null : Base64Url.Encode(named),
            nameEpoch = namedEpoch,
            via,
            expiresAt,

            grants = bySeat.TryGetValue(seatId, out var list) ? list : [],
            submitted,

            /* 0047 — was dieser Mensch noch tun muss: Erweiterungen, die er ausfüllt, und Schritte. */
            forms = await Form.SeatFormsAsync(connection, seatId, ctx.RequestAborted),

            /* 0091 — die Rollen, zu denen er gehört (die seines Formulars): ihr Schlüssel unter dem Platzschlüssel, und der Weg zu ihren Bereichen. */
            roles = await SeatRolesAsync(connection, seatId, ctx.RequestAborted)
        });
    }

    /// <summary>
    /// 0091 — WAS SEINE ROLLEN AUFSCHLIESSEN. Je Rolle, deren Schlüssel schon
    /// unter dem Platzschlüssel liegt, die Hülle; dazu der Weg von dort zu
    /// ihren Bereichen (<see cref="RoleBundle"/>). Wartet eine noch auf ihren
    /// Schlüssel, steht sie mit <c>keySealed = null</c> da — der Platz gehört
    /// schon dazu, nur lesen kann er noch nicht.
    /// </summary>
    internal static async Task<object> SeatRolesAsync(SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        var held = new List<object>();
        var opened = new List<Guid>();
        await using (var cmd = new SqlCommand($"""
            SELECT ar.role_id, ar.key_sealed FROM app.access_role ar
            JOIN app.access s ON s.id = ar.access_id
            JOIN app.role r ON r.id = ar.role_id AND r.revoked_at IS NULL
            WHERE ar.access_id = @seat AND {Form.LiveMember};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@seat", seatId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var role = reader.GetGuid(0);
                var key = reader.IsDBNull(1) ? null : (byte[])reader[1];
                if (key is not null) opened.Add(role);
                held.Add(new { roleId = Ids.ToText(role), keySealed = key is null ? null : Base64Url.Encode(key) });
            }
        }

        return new { held, bundle = opened.Count == 0 ? null : await RoleBundle.BuildAsync(connection, opened, ct) };
    }

    /// <summary>
    /// Was ueber DIESEN Platz eingesandt wurde — Frage und Antwort, beide
    /// versiegelt.
    ///
    /// <para>
    /// <b>Die Beschriftung geht mit.</b> Ohne sie stuenden im Portal Werte ohne
    /// Fragen — „Kowalski", „2011-04-03" — und niemand wuesste, wonach gefragt
    /// worden war. Sie liegt unter dem EPOCHENSCHLUESSEL des Bereichs, den ein
    /// oeffentliches Formular ohnehin veroeffentlicht haben muss; sonst haette
    /// der Einsendende das Formular gar nicht lesen koennen.
    /// </para>
    ///
    /// <para>
    /// <b>Ohne <c>seat_key_sealed</c> bleibt eine Zeile weg.</b> Das ist eine
    /// Einsendung, die ueber einen anderen Weg kam — sie gehoert dem Amt, nicht
    /// diesem Platz. Sie hier als „verschlossen" zu zeigen hiesse, ihre
    /// Existenz zu verraten.
    /// </para>
    /// </summary>
    private static async Task<List<object>> SubmittedAsync(
        SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        var out_ = new List<object>();

        await using var cmd = new SqlCommand("""
            SELECT f.id, f.kind, f.position, f.area_id, f.epoch, f.label_sealed,
                   v.value_sealed, v.seat_key_sealed, r.submitted_at, r.id,
                   c.verified_at, c.origin,
                   r.part_id,
                   r.confirmed_at AS registration_confirmed,
                   COALESCE(f.label_area_id, f.area_id), COALESCE(f.label_epoch, f.epoch),
                   f.options_sealed,
                   /* 0086 — seine Antwort auf eine vom Formular genommene Frage sieht er, aendern kann er sie nicht. */
                   CASE WHEN f.removed_at IS NULL THEN f.self_edit ELSE CAST(0 AS bit) END
            FROM app.registration r
            JOIN app.registration_value v ON v.registration_id = r.id
            JOIN app.slug_field f         ON f.id = v.field_id
            /*
                DIE BESTAETIGUNG DIESER STELLE, falls es eine gibt (0030/0031).
                Mit TOP 1, weil ein SMS-Link und eine Selbstbestaetigung
                nacheinander stehen koennen; die JUENGSTE gilt.
            */
            OUTER APPLY (
                SELECT TOP 1 k.verified_at, k.origin
                FROM app.value_check k
                WHERE k.registration_id = r.id AND k.field_id = f.id
                  AND k.verified_at IS NOT NULL
                ORDER BY k.verified_at DESC
            ) c
            WHERE r.access_id = @seat AND v.seat_key_sealed IS NOT NULL
            ORDER BY r.submitted_at, f.position;
            """, connection);

        cmd.Parameters.AddWithValue("@seat", seatId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            out_.Add(new
            {
                fieldId = Ids.ToText(reader.GetGuid(0)),
                kind = reader.GetString(1),
                position = reader.GetInt32(2),
                areaId = Ids.ToText(reader.GetGuid(3)),
                epoch = reader.GetInt32(4),
                labelSealed = Base64Url.Encode((byte[])reader[5]),
                valueSealed = Base64Url.Encode((byte[])reader[6]),
                valueKeySealed = Base64Url.Encode((byte[])reader[7]),
                submittedAt = reader.GetDateTimeOffset(8),

                /* Damit eine Berichtigung sagen kann, WELCHE Einsendung sie meint. */
                registrationId = Ids.ToText(reader.GetGuid(9)),

                /*
                 * OB DIESE ANGABE BESTAETIGT IST — und auf welchem Weg.
                 * Der Mensch soll in seinem Portal sehen, was die Kanzlei sieht;
                 * sonst drueckt er auf einen Knopf, der laengst nichts mehr tut.
                 */
                verifiedAt = reader.IsDBNull(10) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(10),
                verifiedWay = reader.IsDBNull(11) ? null : reader.GetString(11),

                /*
                 * AUS WELCHEM FORMULAR (0041: der Baustein). Ein Platz kann
                 * Einsendungen aus mehreren tragen, und der Baustein, der sie
                 * im Portal zeigt, nennt EINES davon.
                 */
                formId = Ids.ToText(reader.GetGuid(12)),

                /* Hat er die GANZE Einsendung bestaetigt (0046)? */
                confirmedAt = reader.IsDBNull(13) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(13),

                /*
                 * UNTER WELCHEM SCHLUESSEL DIE FRAGE LIEGT (0042) — dem des
                 * Formulars, nicht dem der Antworten. Vorher ging nur
                 * `areaId` mit, und die Beschriftung blieb zu, sobald die
                 * Antworten in einem nicht jawnen Bereich lagen.
                 */
                labelAreaId = Ids.ToText(reader.GetGuid(14)),
                labelEpoch = reader.GetInt32(15),

                /* Die Auswahl — damit eine Berichtigung dieselbe Liste zeigt wie das Formular. */
                optionsSealed = reader.IsDBNull(16) ? null : Base64Url.Encode((byte[])reader[16]),

                /* Darf er sie selbst berichtigen (0044)? Der Dienst prueft es ohnehin. */
                selfEdit = reader.GetBoolean(17)
            });
        }

        return out_;
    }

    /// <summary>
    /// Die gemeinsamen Schluessel je Platz — mit dem, was sie aufschliessen.
    ///
    /// <para>
    /// Der Kalender steht dabei, weil der Schluessel allein nichts nuetzt: ohne
    /// die Kennung wuesste ein Schueler ohne Konto nicht, WAS er damit oeffnen
    /// kann, und muesste danach fragen — was er ohne Konto nicht kann.
    /// </para>
    /// </summary>
    private static async Task<Dictionary<Guid, List<object>>> GrantsAsync(
        SqlConnection connection, IReadOnlyList<Guid> seatIds, CancellationToken ct)
    {
        var map = new Dictionary<Guid, List<object>>();
        if (seatIds.Count == 0) return map;

        var rows = new List<(Guid Seat, Guid Area, string Name, int Epoch, byte[] Blob)>();
        var names = string.Join(", ", seatIds.Select((_, i) => $"@s{i}"));

        await using (var cmd = new SqlCommand(
            $"SELECT g.access_id, g.area_id, a.name, g.epoch, g.sealed_blob "
            + $"FROM app.access_grant g JOIN app.area a ON a.id = g.area_id "
            + $"WHERE g.access_id IN ({names});", connection))
        {
            for (var i = 0; i < seatIds.Count; i++) cmd.Parameters.AddWithValue($"@s{i}", seatIds[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetInt32(3), (byte[])reader[4]));
            }
        }

        if (rows.Count == 0) return map;

        /* Die Kalender der aufgeschlossenen Bereiche — der Leser ist zu. */
        var calendars = new Dictionary<Guid, List<object>>();
        var areaIds = rows.Select(r => r.Area).Distinct().ToList();
        var areaNames = string.Join(", ", areaIds.Select((_, i) => $"@a{i}"));

        await using (var cmd = new SqlCommand(
            $"SELECT area_id, id, title, time_zone FROM app.calendar WHERE area_id IN ({areaNames});",
            connection))
        {
            for (var i = 0; i < areaIds.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areaIds[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var area = reader.GetGuid(0);
                if (!calendars.TryGetValue(area, out var list)) calendars[area] = list = [];

                list.Add(new
                {
                    calendarId = Ids.ToText(reader.GetGuid(1)),
                    title = reader.GetString(2),
                    timeZone = reader.GetString(3)
                });
            }
        }

        foreach (var row in rows)
        {
            if (!map.TryGetValue(row.Seat, out var list)) map[row.Seat] = list = [];

            list.Add(new
            {
                areaId = Ids.ToText(row.Area),
                areaName = row.Name,
                epoch = row.Epoch,
                @sealed = Base64Url.Encode(row.Blob),
                calendars = calendars.TryGetValue(row.Area, out var found) ? found : []
            });
        }

        return map;
    }

    public sealed record BindRequest(string RoleId, string SeatKeySealed);

    /// <summary>
    /// Den Platz an eine Person binden.
    ///
    /// <para>
    /// <b>Der Browser verpackt den Platzschluessel fuer die Rolle</b> — er hat
    /// ihn gerade aus dem Link geoeffnet. Der Dienst bekommt nur die fertige
    /// Huelle; er koennte sie nicht herstellen, denn er hat den Schluessel nie.
    /// </para>
    ///
    /// <para>
    /// <b>Welche Person, wird gefragt und nicht geraten.</b> Ein Elternteil mit
    /// zwei Kindern oeffnet zwei Links; ohne diese Frage landeten beide bei
    /// derselben Person — und weil die Angaben trotzdem aufgingen, faende es
    /// niemand heraus.
    /// </para>
    /// </summary>
    private static async Task BindAsync(HttpContext ctx, Db db, string token, BindRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
            return;
        }

        if (!Blob(body.SeatKeySealed, out var wrapped) || wrapped.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany klucz miejsca.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        // Dem Konto wird nichts gegeben (0040) — nur Personen und Rollen darunter.
        if (Workspace.IsAccount(mine, roleId))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
            return;
        }

        Guid seatId;
        await using (var find = new SqlCommand("""
            SELECT id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now)
              AND (verify_hash IS NULL OR verified_at IS NOT NULL);
            """, connection))
        {
            find.Parameters.AddWithValue("@token",
                SHA256.HashData(System.Text.Encoding.UTF8.GetBytes((token ?? string.Empty).Trim())));
            find.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
                return;
            }
            seatId = found;
        }

        await using var upsert = new SqlCommand("""
            UPDATE app.access_holder
               SET seat_key_sealed = @blob, until = NULL
             WHERE access_id = @seat AND role_id = @role;

            IF @@ROWCOUNT = 0
                INSERT INTO app.access_holder (access_id, role_id, added_by_role_id, since, seat_key_sealed)
                VALUES (@seat, @role, @role, @now, @blob);
            """, connection);

        upsert.Parameters.AddWithValue("@seat", seatId);
        upsert.Parameters.AddWithValue("@role", roleId);
        upsert.Parameters.AddWithValue("@blob", wrapped);
        upsert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await upsert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seatId),
            roleId = Ids.ToText(roleId),
            bound = true
        });
    }

    /* -- Meine Plaetze ------------------------------------------------------ */

    /// <summary>
    /// Die Plaetze, die eine meiner Rollen haelt — ohne Link.
    ///
    /// <para>
    /// Mit der Huelle des Platzschluessels unter der jeweiligen Rolle: erst
    /// damit ist das Binden mehr als ein Eintrag in einer Liste.
    /// </para>
    /// </summary>
    private static async Task MineAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { seats = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT a.id, a.area_id, ar.name,
                   h.role_id, h.seat_key_sealed, a.epoch,
                   a.status, a.expires_at,
                   a.own_name_sealed
            FROM app.access_holder h
            JOIN app.access a  ON a.id = h.access_id
            JOIN app.area   ar ON ar.id = a.area_id
            WHERE h.until IS NULL
              AND h.seat_key_sealed IS NOT NULL
              AND h.role_id IN ({names})
            ORDER BY a.created_at DESC;
            """, connection);

        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        /* Erst sammeln, dann den Leser schliessen — siehe `OpenAsync`. */
        var rows = new List<(Guid Seat, Guid Area, string AreaName, Guid Role,
            byte[] KeySealed, int Epoch, string Status, DateTimeOffset? Until, byte[]? OwnName)>();

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetGuid(3), (byte[])reader[4], reader.GetInt32(5),
                    reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7),
                    reader.IsDBNull(8) ? null : (byte[])reader[8]));
            }
        }

        var bySeat = await GrantsAsync(connection, rows.Select(r => r.Seat).ToList(), ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            seats = rows.Select(r => new
            {
                seatId = Ids.ToText(r.Seat),
                areaId = Ids.ToText(r.Area),
                areaName = r.AreaName,
                /* 0097 — sein Name: seine Kopie, unter dem Platzschlüssel (den diese Rolle öffnet). */
                ownNameSealed = r.OwnName is null ? null : Base64Url.Encode(r.OwnName),
                roleId = Ids.ToText(r.Role),

                // Unter dem OEFFENTLICHEN Schluessel dieser Rolle verpackt.
                seatKeySealed = Base64Url.Encode(r.KeySealed),
                epoch = r.Epoch,

                status = r.Status,
                expiresAt = r.Until,

                grants = bySeat.TryGetValue(r.Seat, out var list) ? list : []
            })
        });
    }
}
