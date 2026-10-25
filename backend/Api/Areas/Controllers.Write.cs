using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>0129 — anlegen, ändern, anschliessen, unterschreiben, beenden.</summary>
public static partial class Controllers
{
    public sealed record Fields(
        string? Name, string? Address, string? Email, string? Phone, string? DpoName, string? DpoContact, string? Authority);

    private sealed record Clean(
        string Name, string? Address, string? Email, string? Phone, string? DpoName, string? DpoContact, string? Authority);

    /// <summary>Geprüfte Felder — oder der Grund, warum nicht. <paramref name="complete"/>: Anschrift, E-Mail und Organ sind Pflicht.</summary>
    private static (Clean? Ok, string? Error) Check(Fields? f, bool complete)
    {
        static string? T(string? s) { var t = (s ?? string.Empty).Trim(); return t.Length == 0 ? null : t; }
        if (f is null) return (null, "Brakuje danych administratora.");

        var name = T(f.Name);
        if (name is null || name.Length > 200) return (null, "Podaj nazwę organizacji, która odpowiada za dane (do 200 znaków).");
        var address = T(f.Address);
        if (address is { Length: > 400 }) return (null, "Adres: najwyżej 400 znaków.");
        var email = T(f.Email);
        if (email is not null && (email.Length > 200 || !email.Contains('@') || email.Contains(' '))) return (null, "To nie wygląda na adres e-mail.");
        var phone = T(f.Phone);
        if (phone is { Length: > 40 }) return (null, "Telefon: najwyżej 40 znaków.");
        var dpoName = T(f.DpoName);
        if (dpoName is { Length: > 200 }) return (null, "Inspektor ochrony danych: najwyżej 200 znaków.");
        var dpoContact = T(f.DpoContact);
        if (dpoContact is { Length: > 400 }) return (null, "Kontakt do inspektora: najwyżej 400 znaków.");
        var authority = T(f.Authority);
        if (authority is not null && authority is not ("uodo" or "kiod")) return (null, "Organ: Prezes UODO albo Kościelny Inspektor Ochrony Danych.");

        if (complete && (address is null || email is null || authority is null))
            return (null, "Podaj adres, e-mail i organ, do którego można złożyć skargę.");

        return (new Clean(name, address, email, phone, dpoName, dpoContact, authority), null);
    }

    private static object DbValue(string? s) => s is null ? DBNull.Value : s;

    private static async Task InsertVersionAsync(
        SqlConnection connection, SqlTransaction tx, Guid controllerId, int version, Clean c, Guid role, DateTimeOffset now,
        bool confirmed, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.data_controller_version
                (controller_id, version, name, address, email, phone, dpo_name, dpo_contact, authority,
                 written_at, written_by_role_id, authority_confirmed_at)
            VALUES (@id, @v, @name, @address, @email, @phone, @dpoName, @dpoContact, @authority, @now, @role, @confirmed);
            UPDATE app.data_controller SET current_version = @v WHERE id = @id;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@id", controllerId);
        cmd.Parameters.AddWithValue("@v", version);
        cmd.Parameters.AddWithValue("@name", c.Name);
        cmd.Parameters.AddWithValue("@address", DbValue(c.Address));
        cmd.Parameters.AddWithValue("@email", DbValue(c.Email));
        cmd.Parameters.AddWithValue("@phone", DbValue(c.Phone));
        cmd.Parameters.AddWithValue("@dpoName", DbValue(c.DpoName));
        cmd.Parameters.AddWithValue("@dpoContact", DbValue(c.DpoContact));
        cmd.Parameters.AddWithValue("@authority", DbValue(c.Authority));
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@role", role);
        cmd.Parameters.AddWithValue("@confirmed", confirmed ? now : DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Lässt einen Anschluss gelten: der bisherige des Bereichs endet (ersetzt), dieser beginnt jetzt.</summary>
    private static async Task MakeLiveAsync(
        SqlConnection connection, SqlTransaction tx, Guid attachmentId, Guid areaId, Guid byRole, DateTimeOffset now, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            UPDATE app.controller_attachment
               SET state = N'ended', ended_at = @now, ended_reason = N'replaced', ended_by_role_id = @role
             WHERE area_id = @area AND state = N'live' AND id <> @id;
            UPDATE app.controller_attachment SET state = N'live', live_from = @now WHERE id = @id;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@id", attachmentId);
        cmd.Parameters.AddWithValue("@role", byRole);
        cmd.Parameters.AddWithValue("@now", now);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private sealed record Record(Guid Id, Guid Home, bool Closed, int Version);

    private static async Task<Record?> RecordAsync(SqlConnection connection, Guid id, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, home_area_id, CASE WHEN closed_at IS NULL THEN 0 ELSE 1 END, current_version FROM app.data_controller WHERE id = @id;",
            connection, tx);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? new Record(reader.GetGuid(0), reader.GetGuid(1), reader.GetInt32(2) == 1, reader.GetInt32(3)) : null;
    }

    private static async Task<List<Guid>> MineAsync(SqlConnection connection, Guid account, CancellationToken ct) =>
        (await Workspace.RolesOfAsync(connection, account, ct)).Select(r => r.Id).ToList();

    /* -- Die Einstellungen eines Bereichs --------------------------------------------- */

    /// <summary>
    /// Was für den Bereich gilt (eigen oder ererbt), seine offenen Bitten, und — für die,
    /// die ihn führen — die Datensätze mit Heimat hier, wer sie nutzt und wer darum bittet.
    /// <c>?at=</c>: was zu einem vergangenen Zeitpunkt galt.
    /// </summary>
    private static async Task AreaGetAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        DateTimeOffset? at = DateTimeOffset.TryParse(ctx.Request.Query["at"].ToString(), out var asked) ? asked : null;
        var info = await OfAreaAsync(connection, id, ctx.RequestAborted, at);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var adminRoles = await AdminRolesAsync(connection, mine, id, ctx.RequestAborted);
        var admin = adminRoles.Count > 0;

        /* Der eigene gültige Anschluss und die offenen Bitten dieses Bereichs. */
        object? own = null;
        var waiting = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT x.id, x.controller_id, x.state, x.live_from, x.asked_at, v.name, d.home_area_id, x.signed_at
            FROM app.controller_attachment x
            JOIN app.data_controller d ON d.id = x.controller_id
            JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
            WHERE x.area_id = @area AND x.state IN (N'live', N'asked', N'offered');
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var row = new
                {
                    attachmentId = Ids.ToText(reader.GetGuid(0)),
                    controllerId = Ids.ToText(reader.GetGuid(1)),
                    state = reader.GetString(2),
                    liveFrom = reader.IsDBNull(3) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(3),
                    askedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),
                    name = reader.GetString(5),
                    homeAreaId = Ids.ToText(reader.GetGuid(6)),
                    signed = !reader.IsDBNull(7)
                };
                if (row.state == "live") own = row; else waiting.Add(row);
            }
        }

        /* Was hier zu Hause ist — nur für die, die den Bereich führen. */
        var home = new List<object>();
        if (admin)
        {
            var records = new List<(Guid Id, int Version, bool Closed, string Name, string? Address, string? Email, string? Phone,
                string? DpoName, string? DpoContact, string? Authority, bool Confirmed, bool Terms)>();
            await using (var cmd = new SqlCommand("""
                SELECT d.id, d.current_version, CASE WHEN d.closed_at IS NULL THEN 0 ELSE 1 END,
                       v.name, v.address, v.email, v.phone, v.dpo_name, v.dpo_contact, v.authority,
                       CASE WHEN v.authority_confirmed_at IS NULL THEN 0 ELSE 1 END,
                       CASE WHEN EXISTS (SELECT 1 FROM app.controller_terms t WHERE t.controller_id = d.id AND t.terms_version = @terms) THEN 1 ELSE 0 END
                FROM app.data_controller d
                JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
                WHERE d.home_area_id = @area
                ORDER BY d.closed_at, d.created_at;
                """, connection))
            {
                cmd.Parameters.AddWithValue("@area", id);
                cmd.Parameters.AddWithValue("@terms", TermsVersion);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    string? T(int i) => reader.IsDBNull(i) ? null : reader.GetString(i);
                    records.Add((reader.GetGuid(0), reader.GetInt32(1), reader.GetInt32(2) == 1, reader.GetString(3), T(4), T(5), T(6),
                        T(7), T(8), T(9), reader.GetInt32(10) == 1, reader.GetInt32(11) == 1));
                }
            }

            foreach (var r in records)
            {
                var uses = new List<object>();
                await using (var cmd = new SqlCommand("""
                    SELECT x.id, x.area_id, a.name, x.state, x.live_from, x.asked_at
                    FROM app.controller_attachment x LEFT JOIN app.area a ON a.id = x.area_id
                    WHERE x.controller_id = @id AND x.state IN (N'live', N'asked', N'offered')
                    ORDER BY x.state, a.name;
                    """, connection))
                {
                    cmd.Parameters.AddWithValue("@id", r.Id);
                    await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                    while (await reader.ReadAsync(ctx.RequestAborted))
                        uses.Add(new
                        {
                            attachmentId = Ids.ToText(reader.GetGuid(0)),
                            areaId = Ids.ToText(reader.GetGuid(1)),
                            areaName = reader.IsDBNull(2) ? null : reader.GetString(2),
                            state = reader.GetString(3),
                            liveFrom = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),
                            askedAt = reader.IsDBNull(5) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(5)
                        });
                }
                home.Add(new
                {
                    id = Ids.ToText(r.Id), version = r.Version, closed = r.Closed,
                    name = r.Name, address = r.Address, email = r.Email, phone = r.Phone,
                    dpo = r.DpoName is null && r.DpoContact is null ? null : new { name = r.DpoName, contact = r.DpoContact },
                    authority = r.Authority, confirmed = r.Confirmed, terms = r.Terms, uses
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            at,
            controller = Json(info, info is null ? null : await AreaNameAsync(connection, info.FromAreaId, ctx.RequestAborted)),
            own, waiting, home, admin,
            signerRoleId = admin ? Ids.ToText(adminRoles[0].RoleId) : null,
            /* Alle Rollen, die hier unterschreiben dürfen — der Browser nimmt die erste, deren Signierschlüssel er hält. */
            signerRoleIds = adminRoles.Select(r => Ids.ToText(r.RoleId)).ToList(),
            termsVersion = TermsVersion
        });
    }

    public sealed record AreaRequest(
        string? ControllerId, string? AttachmentId, SignedAttachment? Signed, bool? Inherit,
        string? Name, string? Address, string? Email);

    /// <summary>
    /// Einen Datensatz für diesen Bereich erbitten — oder, wer auch seine Heimat führt,
    /// gleich mit Unterschrift gelten lassen; <c>inherit</c>: den eigenen Anschluss
    /// beenden. Der alte Rumpf <c>{ name, address, email }</c> (Browser und App von
    /// gestern) schreibt nur noch eine neue Fassung des Datensatzes, der hier zu Hause
    /// ist und hier gilt — einen neuen legt nur an, wer bestätigt und die Bedingungen annimmt.
    /// </summary>
    private static async Task AreaPostAsync(HttpContext ctx, Db db, Guid id, AreaRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var areaAdmin = await AdminRolesAsync(connection, mine, id, ctx.RequestAborted);
        if (areaAdmin.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }
        var me = areaAdmin[0].RoleId;
        var now = DateTimeOffset.UtcNow;

        /* -- Dziedzicz z obszaru wyżej ----------------------------------------------- */
        if (body.Inherit == true)
        {
            await using var cmd = new SqlCommand("""
                UPDATE app.controller_attachment
                   SET state = N'ended', ended_at = @now, ended_reason = N'left', ended_by_role_id = @role
                 WHERE area_id = @area AND state = N'live';
                """, connection);
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@role", me);
            cmd.Parameters.AddWithValue("@now", now);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), state = "inherit" });
            return;
        }

        /* -- Der alte Rumpf ------------------------------------------------------------- */
        if (body.ControllerId is null)
        {
            var (clean, error) = Check(new Fields(body.Name, body.Address, body.Email, null, null, null, null), complete: false);
            if (clean is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error!); return; }

            await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
            Guid? controllerId = null;
            await using (var cmd = new SqlCommand("""
                SELECT d.id FROM app.controller_attachment x JOIN app.data_controller d ON d.id = x.controller_id
                WHERE x.area_id = @area AND x.state = N'live' AND d.home_area_id = @area AND d.closed_at IS NULL;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@area", id);
                controllerId = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
            }

            if (controllerId is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Zaktualizuj aplikację, aby wpisać administratora danych.");
                return;
            }

            /* Was der alte Browser nicht kennt (Telefon, Inspektor, Organ), bleibt aus der letzten Fassung. */
            Clean merged = clean;
            int version;
            await using (var cmd = new SqlCommand("""
                SELECT TOP 1 version, phone, dpo_name, dpo_contact, authority FROM app.data_controller_version
                WHERE controller_id = @id ORDER BY version DESC;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", controllerId.Value);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                await reader.ReadAsync(ctx.RequestAborted);
                version = reader.GetInt32(0);
                string? T(int i) => reader.IsDBNull(i) ? null : reader.GetString(i);
                merged = clean with { Phone = T(1), DpoName = T(2), DpoContact = T(3), Authority = T(4) };
            }

            await InsertVersionAsync(connection, tx, controllerId.Value, version + 1, merged, me, now, confirmed: false, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), name = merged.Name });
            return;
        }

        /* -- Einen Datensatz erbitten oder gleich gelten lassen --------------------------- */
        if (!Guid.TryParse(body.ControllerId, out var wanted) || !Guid.TryParse(body.AttachmentId, out var attachmentId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brakuje administratora albo identyfikatora prośby.");
            return;
        }

        var record = await RecordAsync(connection, wanted, ctx.RequestAborted);
        if (record is null || record.Closed)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego administratora danych nie ma albo jest zamknięty.");
            return;
        }

        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            var signed = body.Signed is null ? null
                : await SignedByAsync(connection, tx, mine, body.Signed, attachmentId, wanted, id, record.Home, ctx.RequestAborted);
            if (body.Signed is not null && signed is null)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Podpis się nie zgadza albo nie prowadzisz obszaru, z którego pochodzi ten administrator.");
                return;
            }

            /* Eine offene Bitte desselben Bereichs ersetzt die vorige. */
            await using (var cmd = new SqlCommand("""
                UPDATE app.controller_attachment SET state = N'cancelled', decided_at = @now, decided_by_role_id = @role
                 WHERE area_id = @area AND state = N'asked';
                INSERT INTO app.controller_attachment (id, area_id, controller_id, state, asked_by_role_id, asked_at,
                    signed_by_role_id, signed_at, signature, certificate_id, accepted_by_role_id, accepted_at)
                VALUES (@id, @area, @controller, N'asked', @role, @now, @signer, @signedAt, @signature, @certificate, @accepted, @acceptedAt);
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", attachmentId);
                cmd.Parameters.AddWithValue("@area", id);
                cmd.Parameters.AddWithValue("@controller", wanted);
                cmd.Parameters.AddWithValue("@role", me);
                cmd.Parameters.AddWithValue("@now", now);
                cmd.Parameters.AddWithValue("@signer", signed is null ? DBNull.Value : signed.Value.Role);
                cmd.Parameters.AddWithValue("@signedAt", signed is null ? DBNull.Value : signed.Value.At);
                cmd.Parameters.AddWithValue("@signature", signed is null ? DBNull.Value : signed.Value.Signature);
                cmd.Parameters.AddWithValue("@certificate", signed is null ? DBNull.Value : signed.Value.Certificate);
                cmd.Parameters.AddWithValue("@accepted", signed is null ? DBNull.Value : me);
                cmd.Parameters.AddWithValue("@acceptedAt", signed is null ? DBNull.Value : now);
                try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
                catch (SqlException e) when (e.Number is 2601 or 2627)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "Ta prośba już jest.");
                    return;
                }
            }

            if (signed is not null) await MakeLiveAsync(connection, tx, attachmentId, id, me, now, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), attachmentId = Ids.ToText(attachmentId), state = body.Signed is null ? "asked" : "live" });
    }

    /* -- Zur Auswahl ---------------------------------------------------------------- */

    /// <summary>
    /// Was dieses Konto wählen kann: Datensätze mit Heimat in einem seiner Bereiche, und
    /// die, die in den Ketten seiner Bereiche gelten. Geschlossene nicht.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Count == 0) { await ctx.Response.WriteAsJsonAsync(new { records = Array.Empty<object>() }); return; }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            WITH mine_areas AS (
                SELECT DISTINCT scope_id AS id FROM app.certificate
                WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now AND subject_role_id IN ({names})
            ),
            admin_areas AS (
                SELECT DISTINCT scope_id AS id FROM app.certificate
                WHERE scope_kind = N'area' AND capability = N'admin' AND revoked_at IS NULL AND expires_at > @now
                  AND subject_role_id IN ({names})
            ),
            chain AS (
                SELECT m.id, 0 AS depth FROM mine_areas m
                UNION ALL
                SELECT a.parent_area_id, c.depth + 1 FROM chain c JOIN app.area a ON a.id = c.id
                 WHERE a.parent_area_id IS NOT NULL AND c.depth < 16
            ),
            seen AS (
                SELECT d.id FROM app.data_controller d WHERE d.home_area_id IN (SELECT id FROM mine_areas)
                UNION
                SELECT x.controller_id FROM app.controller_attachment x WHERE x.state = N'live' AND x.area_id IN (SELECT id FROM chain)
            )
            SELECT d.id, d.home_area_id, a.name, v.name, v.address, v.email, v.authority,
                   (SELECT COUNT(*) FROM app.controller_attachment x WHERE x.controller_id = d.id AND x.state = N'live'),
                   CASE WHEN d.home_area_id IN (SELECT id FROM admin_areas) THEN 1 ELSE 0 END
            FROM app.data_controller d
            JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
            LEFT JOIN app.area a ON a.id = d.home_area_id
            WHERE d.closed_at IS NULL AND d.id IN (SELECT id FROM seen)
            ORDER BY v.name
            OPTION (MAXRECURSION 20);
            """, connection);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);

        var records = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                string? T(int i) => reader.IsDBNull(i) ? null : reader.GetString(i);
                records.Add(new
                {
                    id = Ids.ToText(reader.GetGuid(0)),
                    homeAreaId = Ids.ToText(reader.GetGuid(1)),
                    homeAreaName = T(2),
                    name = reader.GetString(3),
                    address = T(4), email = T(5), authority = T(6),
                    usedIn = reader.GetInt32(7),
                    homeAdmin = reader.GetInt32(8) == 1
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { records });
    }

    /* -- Anlegen -------------------------------------------------------------------- */

    public sealed record CreateRequest(
        string? Id, string? HomeAreaId, Fields? Fields, bool AuthorityConfirmed, string? TermsVersion,
        string? AttachmentId, SignedAttachment? Signed);

    /// <summary>
    /// Ein neuer Datensatz, zu Hause in einem Bereich, den der Anlegende führt — mit der
    /// Bestätigung, für die Organisation handeln zu dürfen, und der Annahme der
    /// Bedingungen; er gilt sofort für seine Heimat (die Zusage unterschreibt er selbst).
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.Id, out var id) || !Guid.TryParse(body.HomeAreaId, out var home) || !Guid.TryParse(body.AttachmentId, out var attachmentId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brakuje identyfikatorów.");
            return;
        }
        var (clean, error) = Check(body.Fields, complete: true);
        if (clean is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error!); return; }
        if (!body.AuthorityConfirmed)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Potwierdź, że możesz działać w imieniu tej organizacji.");
            return;
        }
        if (body.TermsVersion != TermsVersion)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zaakceptuj warunki powierzenia przetwarzania danych.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        var signed = await SignedByAsync(connection, tx, mine, body.Signed, attachmentId, id, home, home, ctx.RequestAborted);
        if (signed is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Administratora wpisuje ten, kto prowadzi obszar — i podpisuje to swoją rolą.");
            return;
        }

        await using (var cmd = new SqlCommand("""
            INSERT INTO app.data_controller (id, home_area_id, current_version, created_at, created_by_role_id)
            VALUES (@id, @home, 1, @now, @role);
            INSERT INTO app.controller_terms (controller_id, terms_version, accepted_by_role_id, accepted_at)
            VALUES (@id, @terms, @role, @now);
            INSERT INTO app.controller_attachment (id, area_id, controller_id, state, asked_by_role_id, asked_at,
                signed_by_role_id, signed_at, signature, certificate_id, accepted_by_role_id, accepted_at, live_from)
            VALUES (@attachment, @home, @id, N'asked', @role, @now, @role, @signedAt, @signature, @certificate, @role, @now, @now);
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@home", home);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@role", signed.Value.Role);
            cmd.Parameters.AddWithValue("@terms", TermsVersion);
            cmd.Parameters.AddWithValue("@attachment", attachmentId);
            cmd.Parameters.AddWithValue("@signedAt", signed.Value.At);
            cmd.Parameters.AddWithValue("@signature", signed.Value.Signature);
            cmd.Parameters.AddWithValue("@certificate", signed.Value.Certificate);
            try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Taki administrator już jest.");
                return;
            }
        }

        await InsertVersionAsync(connection, tx, id, 1, clean, signed.Value.Role, now, confirmed: true, ctx.RequestAborted);
        await MakeLiveAsync(connection, tx, attachmentId, home, signed.Value.Role, now, ctx.RequestAborted);
        await tx.CommitAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), attachmentId = Ids.ToText(attachmentId) });
    }

    /* -- Ändern, schliessen, Bedingungen -------------------------------------------- */

    public sealed record VersionRequest(Fields? Fields, bool AuthorityConfirmed);

    private static async Task<(Record Record, Guid Role)?> HomeAdminAsync(HttpContext ctx, Db db, SqlConnection connection, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        var record = await RecordAsync(connection, id, ctx.RequestAborted);
        if (record is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego administratora danych."); return null; }

        var admin = await AdminRolesAsync(connection, await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted), record.Home, ctx.RequestAborted);
        if (admin.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Zmienia go ten, kto prowadzi obszar, w którym jest wpisany.");
            return null;
        }
        return (record, admin[0].RoleId);
    }

    /// <summary>Eine neue Fassung. Ändert sich der Name, ist es womöglich eine andere Organisation: dann wird neu bestätigt.</summary>
    private static async Task VersionAsync(HttpContext ctx, Db db, Guid id, VersionRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await HomeAdminAsync(ctx, db, connection, id) is not { } grip) return;
        if (grip.Record.Closed) { await Fail(ctx, StatusCodes.Status409Conflict, "Ten administrator jest zamknięty — zostaje tylko jako historia."); return; }

        var (clean, error) = Check(body.Fields, complete: true);
        if (clean is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error!); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        string oldName;
        bool wasConfirmed;
        await using (var cmd = new SqlCommand(
            "SELECT name, CASE WHEN authority_confirmed_at IS NULL THEN 0 ELSE 1 END FROM app.data_controller_version WHERE controller_id = @id AND version = @v;",
            connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@v", grip.Record.Version);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            oldName = reader.GetString(0);
            wasConfirmed = reader.GetInt32(1) == 1;
        }

        var renamed = !string.Equals(oldName.Trim(), clean.Name, StringComparison.Ordinal);
        if (renamed && !body.AuthorityConfirmed)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zmieniasz nazwę — potwierdź, że możesz działać w imieniu tej organizacji.");
            return;
        }

        await InsertVersionAsync(connection, tx, id, grip.Record.Version + 1, clean, grip.Role, DateTimeOffset.UtcNow,
            confirmed: body.AuthorityConfirmed || (!renamed && wasConfirmed), ctx.RequestAborted);
        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), version = grip.Record.Version + 1 });
    }

    /// <summary>Schliessen: keine neuen Anschlüsse, die bestehenden enden; lesbar bleibt er als Geschichte.</summary>
    private static async Task CloseAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await HomeAdminAsync(ctx, db, connection, id) is not { } grip) return;

        await using var cmd = new SqlCommand("""
            UPDATE app.controller_attachment
               SET state = N'ended', ended_at = @now, ended_reason = N'closed', ended_by_role_id = @role
             WHERE controller_id = @id AND state = N'live';
            UPDATE app.controller_attachment SET state = N'cancelled', decided_at = @now, decided_by_role_id = @role
             WHERE controller_id = @id AND state IN (N'asked', N'offered');
            UPDATE app.data_controller SET closed_at = @now, closed_reason = N'closed', closed_by_role_id = @role
             WHERE id = @id AND closed_at IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@role", grip.Role);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), closed = true });
    }

    public sealed record TermsRequest(string? TermsVersion, bool AuthorityConfirmed);

    /// <summary>Die Bedingungen annehmen (und, für einen gewanderten Datensatz, die Befugnis bestätigen).</summary>
    private static async Task TermsAsync(HttpContext ctx, Db db, Guid id, TermsRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await HomeAdminAsync(ctx, db, connection, id) is not { } grip) return;
        if (body.TermsVersion != TermsVersion)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zaakceptuj aktualne warunki powierzenia.");
            return;
        }

        await using var cmd = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM app.controller_terms WHERE controller_id = @id AND terms_version = @terms)
                INSERT INTO app.controller_terms (controller_id, terms_version, accepted_by_role_id, accepted_at)
                VALUES (@id, @terms, @role, @now);
            IF @confirm = 1
                UPDATE app.data_controller_version SET authority_confirmed_at = @now
                 WHERE controller_id = @id AND version = @v AND authority_confirmed_at IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@terms", TermsVersion);
        cmd.Parameters.AddWithValue("@role", grip.Role);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@confirm", body.AuthorityConfirmed ? 1 : 0);
        cmd.Parameters.AddWithValue("@v", grip.Record.Version);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), termsVersion = TermsVersion });
    }

    /* -- Anbieten, entscheiden, beenden -------------------------------------------- */

    public sealed record OfferRequest(string? AreaId, string? AttachmentId, SignedAttachment? Signed, bool? Accept);

    /// <summary>Die Heimat bietet ihren Datensatz einem Bereich an — schon unterschrieben; wer auch ihn führt, nimmt gleich an.</summary>
    private static async Task OfferAsync(HttpContext ctx, Db db, Guid id, OfferRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!Guid.TryParse(body.AreaId, out var area) || !Guid.TryParse(body.AttachmentId, out var attachmentId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brakuje obszaru.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var record = await RecordAsync(connection, id, ctx.RequestAborted);
        if (record is null || record.Closed) { await Fail(ctx, StatusCodes.Status404NotFound, "Tego administratora danych nie ma albo jest zamknięty."); return; }
        if (await AreaNameAsync(connection, area, ctx.RequestAborted) is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma."); return; }

        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        var signed = await SignedByAsync(connection, tx, mine, body.Signed, attachmentId, id, area, record.Home, ctx.RequestAborted);
        if (signed is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Proponuje ten, kto prowadzi obszar, w którym administrator jest wpisany — i podpisuje to swoją rolą.");
            return;
        }

        var areaAdmin = body.Accept == true ? await AdminRolesAsync(connection, mine, area, ctx.RequestAborted, tx) : new List<(Guid RoleId, Guid CertificateId)>();

        await using (var cmd = new SqlCommand("""
            INSERT INTO app.controller_attachment (id, area_id, controller_id, state, signed_by_role_id, signed_at, signature,
                certificate_id, accepted_by_role_id, accepted_at)
            VALUES (@id, @area, @controller, N'offered', @signer, @signedAt, @signature, @certificate, @accepted, @acceptedAt);
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", attachmentId);
            cmd.Parameters.AddWithValue("@area", area);
            cmd.Parameters.AddWithValue("@controller", id);
            cmd.Parameters.AddWithValue("@signer", signed.Value.Role);
            cmd.Parameters.AddWithValue("@signedAt", signed.Value.At);
            cmd.Parameters.AddWithValue("@signature", signed.Value.Signature);
            cmd.Parameters.AddWithValue("@certificate", signed.Value.Certificate);
            cmd.Parameters.AddWithValue("@accepted", areaAdmin.Count > 0 ? areaAdmin[0].RoleId : DBNull.Value);
            cmd.Parameters.AddWithValue("@acceptedAt", areaAdmin.Count > 0 ? now : DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        if (areaAdmin.Count > 0) await MakeLiveAsync(connection, tx, attachmentId, area, areaAdmin[0].RoleId, now, ctx.RequestAborted);
        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { attachmentId = Ids.ToText(attachmentId), state = areaAdmin.Count > 0 ? "live" : "offered" });
    }

    public sealed record DecideRequest(bool Accept, SignedAttachment? Signed);

    private sealed record Pending(Guid Id, Guid Area, Guid Controller, Guid Home, string State, bool Closed);

    private static async Task<Pending?> PendingAsync(SqlConnection connection, Guid id, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand("""
            SELECT x.id, x.area_id, x.controller_id, d.home_area_id, x.state, CASE WHEN d.closed_at IS NULL THEN 0 ELSE 1 END
            FROM app.controller_attachment x JOIN app.data_controller d ON d.id = x.controller_id WHERE x.id = @id;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new Pending(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetGuid(3), reader.GetString(4), reader.GetInt32(5) == 1)
            : null;
    }

    /// <summary>
    /// Über eine Bitte entscheidet die Heimat (sie unterschreibt oder lehnt ab), über ein
    /// Angebot der Bereich (er nimmt an oder lehnt ab).
    /// </summary>
    private static async Task DecideAsync(HttpContext ctx, Db db, Guid id, DecideRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        var pending = await PendingAsync(connection, id, ctx.RequestAborted, tx);
        if (pending is null || pending.State is not ("asked" or "offered"))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tej prośby już nie ma.");
            return;
        }
        if (pending.Closed && body.Accept) { await Fail(ctx, StatusCodes.Status409Conflict, "Ten administrator jest zamknięty."); return; }

        var decidingArea = pending.State == "asked" ? pending.Home : pending.Area;
        var deciders = await AdminRolesAsync(connection, mine, decidingArea, ctx.RequestAborted, tx);
        if (deciders.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, pending.State == "asked"
                ? "O prośbie decyduje ten, kto prowadzi obszar, w którym administrator jest wpisany."
                : "O propozycji decyduje ten, kto prowadzi obszar.");
            return;
        }
        var me = deciders[0].RoleId;

        if (!body.Accept)
        {
            await using var refuse = new SqlCommand(
                "UPDATE app.controller_attachment SET state = N'refused', decided_at = @now, decided_by_role_id = @role WHERE id = @id;",
                connection, tx);
            refuse.Parameters.AddWithValue("@id", id);
            refuse.Parameters.AddWithValue("@now", now);
            refuse.Parameters.AddWithValue("@role", me);
            await refuse.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { attachmentId = Ids.ToText(id), state = "refused" });
            return;
        }

        if (pending.State == "asked")
        {
            var signed = await SignedByAsync(connection, tx, mine, body.Signed, id, pending.Controller, pending.Area, pending.Home, ctx.RequestAborted);
            if (signed is null)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Podpis się nie zgadza.");
                return;
            }
            await using var sign = new SqlCommand("""
                UPDATE app.controller_attachment
                   SET signed_by_role_id = @role, signed_at = @signedAt, signature = @signature, certificate_id = @certificate,
                       decided_by_role_id = @role, decided_at = @now
                 WHERE id = @id;
                """, connection, tx);
            sign.Parameters.AddWithValue("@id", id);
            sign.Parameters.AddWithValue("@role", signed.Value.Role);
            sign.Parameters.AddWithValue("@signedAt", signed.Value.At);
            sign.Parameters.AddWithValue("@signature", signed.Value.Signature);
            sign.Parameters.AddWithValue("@certificate", signed.Value.Certificate);
            sign.Parameters.AddWithValue("@now", now);
            await sign.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        else
        {
            await using var accept = new SqlCommand(
                "UPDATE app.controller_attachment SET accepted_by_role_id = @role, accepted_at = @now, decided_by_role_id = @role, decided_at = @now WHERE id = @id;", connection, tx);
            accept.Parameters.AddWithValue("@id", id);
            accept.Parameters.AddWithValue("@role", me);
            accept.Parameters.AddWithValue("@now", now);
            await accept.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await MakeLiveAsync(connection, tx, id, pending.Area, me, now, ctx.RequestAborted);
        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { attachmentId = Ids.ToText(id), state = "live" });
    }

    /// <summary>
    /// Ein gültiger Anschluss endet: die Heimat zieht ihre Zusage zurück, oder der Bereich
    /// verlässt ihn. Eine offene Bitte oder ein offenes Angebot nimmt zurück, wer es gab.
    /// </summary>
    private static async Task EndAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var pending = await PendingAsync(connection, id, ctx.RequestAborted);
        if (pending is null || pending.State is "refused" or "cancelled" or "ended")
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego już nie ma.");
            return;
        }

        var areaAdmin = await AdminRolesAsync(connection, mine, pending.Area, ctx.RequestAborted);
        var homeAdmin = await AdminRolesAsync(connection, mine, pending.Home, ctx.RequestAborted);

        string sql;
        Guid role;
        if (pending.State == "live" && (areaAdmin.Count > 0 || homeAdmin.Count > 0))
        {
            var leaving = areaAdmin.Count > 0;
            role = leaving ? areaAdmin[0].RoleId : homeAdmin[0].RoleId;
            sql = $"UPDATE app.controller_attachment SET state = N'ended', ended_at = @now, ended_reason = N'{(leaving ? "left" : "withdrawn")}', ended_by_role_id = @role WHERE id = @id;";
        }
        else if ((pending.State == "asked" && areaAdmin.Count > 0) || (pending.State == "offered" && homeAdmin.Count > 0))
        {
            role = pending.State == "asked" ? areaAdmin[0].RoleId : homeAdmin[0].RoleId;
            sql = "UPDATE app.controller_attachment SET state = N'cancelled', decided_at = @now, decided_by_role_id = @role WHERE id = @id;";
        }
        else
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Nie prowadzisz żadnego z tych obszarów.");
            return;
        }

        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@role", role);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { attachmentId = Ids.ToText(id), ended = true });
    }

    /* -- Wer für eine Seite geradesteht ------------------------------------------------ */

    public sealed record PageRequest(string? Path, string? AreaId);

    /// <summary>
    /// Ein Bereich steht für eine Seite (und die Seiten darunter) gerade. Setzen darf es,
    /// wer die Seite führt UND den Bereich führt — sonst machte jeder jede Organisation
    /// für seine Seite verantwortlich. Der Bereich muss einen Datensatz haben.
    /// </summary>
    private static async Task PageSetAsync(HttpContext ctx, Db db, PageRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Slug.Normalise(body.Path);
        if (!Slug.IsWellFormed(path) && path != string.Empty)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite) { await Fail(ctx, StatusCodes.Status403Forbidden, "Tej strony nie prowadzisz."); return; }

        Guid? area = null;
        if (!string.IsNullOrWhiteSpace(body.AreaId))
        {
            if (!Guid.TryParse(body.AreaId, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar."); return; }
            if (!await Area.MayAsync(connection, who.Value.AccountId, parsed, Capability.Admin, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Wskazać można obszar, który prowadzisz.");
                return;
            }
            if (await OfAreaAsync(connection, parsed, ctx.RequestAborted) is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten obszar nie ma administratora danych — wpisz go najpierw w jego ustawieniach.");
                return;
            }
            area = parsed;
        }

        await using var cmd = new SqlCommand("UPDATE app.slug SET controller_area_id = @area WHERE path = @path;", connection);
        cmd.Parameters.AddWithValue("@area", area is null ? DBNull.Value : area.Value);
        cmd.Parameters.AddWithValue("@path", path);
        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        var (info, from, fromPath) = await OfPageAsync(connection, path, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new
        {
            path,
            responsible = info is null ? null : new { areaId = Ids.ToText(from!.Value), fromPath, controller = Json(info) }
        });
    }
}
