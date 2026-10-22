using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE ROLLE DER MENSCHEN EINES FORMULARS (0091).
///
/// <para>
/// <b>Eine Rolle sagt, wozu sie Zugang gibt</b> — ihre Bereiche, ihre
/// Rozmowy, ihre Kalender. Das Formular sagt nur noch, WELCHE Rolle seine
/// Menschen bekommen („Uczestnicy Rocket 2026"). Wer die Gruppe anders
/// zuschneiden will, ändert die Rolle, nicht jedes Formular und nicht jeden
/// Link.
/// </para>
///
/// <code>
///   POST /workspace/part/{id}/members/role     die Rolle setzen (nur eine, die ich halte)
///   GET  /workspace/part/{id}/members          Stand: wer dazugehört, wer noch auf den Schlüssel wartet
///   POST /workspace/part/{id}/members/enroll   die schon Eingesandten dazunehmen („Przenieś obecne zgłoszenia")
///   POST /workspace/part/{id}/members/keys     den Schlüssel der Rolle unter Platzschlüsseln abgeben
/// </code>
///
/// <para>
/// <b>Der Platz hält die Rolle, er ist keine</b> (0024: keine zwei RSA-Paare je
/// Mensch). Gehört er dazu, zählen für ihn die Bereiche der Rolle
/// (<c>app.access_role_area</c>) — sofort. Den Schlüssel der Rolle versiegelt
/// der Browser eines Mitglieds, das auch den Platzschlüssel öffnen kann (die
/// Kanzlei), unter dem Platzschlüssel; die Glocke sagt jedem solchen Browser,
/// wo jemand wartet (<c>roles.waiting</c>), und er tut es ohne Klick.
/// </para>
/// </summary>
public static partial class Form
{
    private const int MaxKeysAtOnce = 500;

    private static void MapMembers(WebApplication app)
    {
        app.MapGet("/workspace/part/{id:guid}/members", MembersAsync);
        app.MapPost("/workspace/part/{id:guid}/members/role", MemberRoleAsync);
        app.MapPost("/workspace/part/{id:guid}/members/enroll", EnrollAsync);
        app.MapPost("/workspace/part/{id:guid}/members/keys", MemberKeysAsync);
    }

    /// <summary>
    /// 0120 — die Rollen des Formulars, in ihrer Reihenfolge. <c>RoleId</c> ist
    /// die Form der Browser von vorher (eine Rolle, <c>null</c>: keine); wer
    /// <c>RoleIds</c> schickt, setzt die ganze Liste.
    /// </summary>
    public sealed record MemberRoleRequest(string? RoleId, List<string>? RoleIds = null);

    public sealed record MemberKeysRequest(List<MemberKey>? Keys);

    /// <summary>Ohne <c>RoleId</c>: die erste Rolle des Formulars (so schickten es die Browser bis 0120).</summary>
    public sealed record MemberKey(string? SeatId, string? KeySealed, string? RoleId = null);

    /// <summary>Wie viele Rollen ein Formular geben kann — mehr ist keine Gruppe mehr, sondern ein Versehen.</summary>
    private const int MaxMemberRoles = 12;

    /// <summary>
    /// Beim Einsenden: der Platz gehört zu den Rollen des Formulars (der
    /// Schlüssel jeder Rolle folgt aus dem Browser eines Mitglieds).
    /// </summary>
    internal static async Task JoinMemberRoleAsync(SqlConnection connection, SqlTransaction tx, Guid moduleId, Guid seatId, DateTimeOffset now, CancellationToken ct)
    {
        /* 0120 — die Liste in `module_role`; ohne die Migration die eine Rolle von 0091. */
        var source = await Schema.VirtualAreasAsync(connection, ct, tx)
            ? "SELECT mr.role_id FROM app.module_role mr WHERE mr.module_id = @module"
            : "SELECT m.member_role_id FROM app.module m WHERE m.id = @module AND m.member_role_id IS NOT NULL";

        await using var cmd = new SqlCommand($"""
            INSERT INTO app.access_role (access_id, role_id, module_id, granted_at)
            SELECT @seat, r.id, @module, @now
            FROM app.role r
            WHERE r.id IN ({source}) AND r.revoked_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM app.access_role x WHERE x.access_id = @seat AND x.role_id = r.id);
            """, connection, tx);
        cmd.Parameters.AddWithValue("@seat", seatId);
        cmd.Parameters.AddWithValue("@module", moduleId);
        cmd.Parameters.AddWithValue("@now", now);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// SQL: gehört die Rolle <paramref name="roleSql"/> zu den Rollen des Formulars
    /// <paramref name="moduleSql"/>? Ohne 0120 die eine Spalte von 0091.
    /// </summary>
    internal static async Task<string> IsMemberRoleAsync(SqlConnection connection, string moduleSql, string roleSql, CancellationToken ct) =>
        await Schema.VirtualAreasAsync(connection, ct)
            ? $"EXISTS (SELECT 1 FROM app.module_role mr WHERE mr.module_id = {moduleSql} AND mr.role_id = {roleSql})"
            : $"EXISTS (SELECT 1 FROM app.module mm WHERE mm.id = {moduleSql} AND mm.member_role_id = {roleSql})";

    /// <summary>
    /// Ob die Rollen <c>{roles}</c> den Platz <c>s</c> öffnen können — als SQL.
    /// Wer sich selbst angemeldet hat, liegt unter dem Annahmeschlüssel seines
    /// Bereichs (die Amtsrolle); wen das Amt ausgestellt hat, unter dessen Epoche.
    /// </summary>
    internal static string OpensSeat(string roles) => $"""
        ((s.origin = N'self' AND EXISTS (SELECT 1 FROM app.intake i WHERE i.area_id = s.area_id AND i.sealed_for_role_id IN ({roles})))
         OR (s.origin <> N'self' AND EXISTS (SELECT 1 FROM app.certificate ce
               WHERE ce.scope_kind = N'area' AND ce.scope_id = s.area_id AND ce.revoked_at IS NULL AND ce.expires_at > @now
                 AND ce.capability IN (N'read', N'write', N'admin') AND ce.subject_role_id IN ({roles}))))
        """;

    /// <summary>Eine Zeile von <c>access_role</c> (Alias <c>ar</c>), deren Platz (<c>s</c>) lebt und deren Einsendung (falls über ein Formular) auch.</summary>
    internal const string LiveMember = """
        s.revoked_at IS NULL
        AND (ar.module_id IS NULL OR EXISTS (SELECT 1 FROM app.registration g
              WHERE g.access_id = ar.access_id AND g.part_id = ar.module_id AND g.withdrawn_at IS NULL AND g.is_hidden = 0))
        """;

    /// <summary>Darf dieses Konto die Menschen des Formulars sehen — wie die Einsendungen (führt es, oder liest einen Bereich der Antworten)?</summary>
    private static async Task<bool> MayOfficeAsync(SqlConnection connection, Guid accountId, Sheet sheet, CancellationToken ct)
    {
        if (await MayWriteSheetAsync(connection, accountId, sheet, ct)) return true;
        foreach (var areaId in (await ReadFieldsAsync(connection, sheet.ModuleId, ct, withRemoved: true)).Select(f => f.AreaId).Distinct())
        {
            if (await Area.MayAsync(connection, accountId, areaId, Capability.Read, ct)) return true;
        }
        return false;
    }

    /// <summary>
    /// 0120 — die Rollen des Formulars in ihrer Reihenfolge; ohne die Migration
    /// die eine Rolle von 0091 (<c>member_role_id</c>).
    /// </summary>
    internal static async Task<List<Guid>> MemberRolesOfAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        var sql = await Schema.VirtualAreasAsync(connection, ct)
            ? "SELECT role_id FROM app.module_role WHERE module_id = @id ORDER BY position, created_at;"
            : "SELECT member_role_id FROM app.module WHERE id = @id AND member_role_id IS NOT NULL;";

        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@id", moduleId);

        var roles = new List<Guid>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) roles.Add(reader.GetGuid(0));
        return roles;
    }

    /// <summary>Der Stand EINER Rolle des Formulars: wer dazugehört, wer ihren Schlüssel hat, wer noch wartet.</summary>
    private sealed record MemberRoleState(
        string RoleId, bool HoldsRole, List<object> Areas, int Members, int Sealed, List<object> Waiting);

    private static async Task<MemberRoleState> MemberRoleStateAsync(
        SqlConnection connection, Guid moduleId, Guid role, List<Guid> mine, DateTimeOffset now, CancellationToken ct)
    {
        int members = 0, sealedCount = 0;
        await using (var cmd = new SqlCommand($"""
            SELECT COUNT(*), SUM(CASE WHEN ar.key_sealed IS NULL THEN 0 ELSE 1 END)
            FROM app.access_role ar JOIN app.access s ON s.id = ar.access_id
            WHERE ar.role_id = @role
              AND EXISTS (SELECT 1 FROM app.registration g WHERE g.access_id = ar.access_id AND g.part_id = @module
                           AND g.withdrawn_at IS NULL AND g.is_hidden = 0)
              AND {LiveMember};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@role", role);
            cmd.Parameters.AddWithValue("@module", moduleId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                members = reader.GetInt32(0);
                sealedCount = reader.IsDBNull(1) ? 0 : reader.GetInt32(1);
            }
        }

        /* Wer noch wartet — mit dem, was die Kanzlei braucht, um seinen Platzschlüssel zu öffnen (wie `Seat.ListAsync`). */
        var waiting = new List<object>();
        var holds = mine.Contains(role);
        if (holds)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@m{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT TOP {MaxKeysAtOnce} s.id, s.area_id, s.epoch, s.origin, s.seat_key_for_intake, s.seat_key_for_area,
                       s.name_sealed, s.name_epoch
                FROM app.access_role ar JOIN app.access s ON s.id = ar.access_id
                WHERE ar.role_id = @role AND ar.key_sealed IS NULL
                  AND EXISTS (SELECT 1 FROM app.registration g WHERE g.access_id = ar.access_id AND g.part_id = @module
                               AND g.withdrawn_at IS NULL AND g.is_hidden = 0)
                  AND {LiveMember} AND {OpensSeat(names)}
                ORDER BY ar.granted_at;
                """, connection);
            cmd.Parameters.AddWithValue("@role", role);
            cmd.Parameters.AddWithValue("@module", moduleId);
            cmd.Parameters.AddWithValue("@now", now);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@m{i}", mine[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                waiting.Add(new
                {
                    seatId = Ids.ToText(reader.GetGuid(0)),
                    areaId = Ids.ToText(reader.GetGuid(1)),
                    epoch = reader.GetInt32(2),
                    origin = reader.GetString(3),
                    seatKeyForIntake = reader.IsDBNull(4) ? null : Base64Url.Encode((byte[])reader[4]),
                    seatKeyForArea = reader.IsDBNull(5) ? null : Base64Url.Encode((byte[])reader[5]),
                    /* 0097 — der Name, versiegelt unter dem Schlüssel seines Bereichs. */
                    nameSealed = Names.B64(reader, 6),
                    nameEpoch = Names.Int(reader, 7)
                });
            }
        }

        return new MemberRoleState(Ids.ToText(role), holds, await Roles.AreasOfRoleAsync(connection, role, ct),
            members, sealedCount, waiting);
    }

    private static async Task MembersAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayOfficeAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var roles = await MemberRolesOfAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var now = DateTimeOffset.UtcNow;

        /* Wie viele Menschen das Formular hat (mit Link). */
        int seats;
        await using (var cmd = new SqlCommand("""
            SELECT COUNT(DISTINCT g.access_id) FROM app.registration g JOIN app.access s ON s.id = g.access_id
            WHERE g.part_id = @module AND g.withdrawn_at IS NULL AND g.is_hidden = 0 AND s.revoked_at IS NULL;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
            seats = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        var states = new List<MemberRoleState>();
        foreach (var role in roles)
        {
            states.Add(await MemberRoleStateAsync(connection, sheet.ModuleId, role, mine, now, ctx.RequestAborted));
        }

        /*
         * 0120 — `roles` je Rolle. Daneben, für die Browser von vorher, die erste
         * Rolle in den alten Feldern: sie kannten genau eine.
         */
        var first = states.FirstOrDefault();
        await ctx.Response.WriteAsJsonAsync(new
        {
            moduleId = Ids.ToText(sheet.ModuleId),
            roles = states,
            seats,
            roleId = first?.RoleId,
            holdsRole = first?.HoldsRole ?? false,
            areas = first?.Areas ?? new List<object>(),
            members = first?.Members ?? 0,
            @sealed = first?.Sealed ?? 0,
            waiting = first?.Waiting ?? new List<object>()
        });
    }

    /// <summary>
    /// Die Rollen des Formulars setzen — 0120 eine Liste, leer heisst: keine.
    /// Nur Rollen, die dieses Konto erreicht — sonst gäbe ein Formular Zugang,
    /// den sein Führer selbst nicht hat; und keine Person, kein Konto, keine
    /// Linkrolle. Wer schon dazugehört, bleibt dabei: die Rollen gelten für neue
    /// Einsendungen, die übrigen nimmt „Przenieś" mit.
    /// </summary>
    private static async Task MemberRoleAsync(HttpContext ctx, Db db, Guid id, MemberRoleRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        /* Die Liste — oder, wie vor 0120, eine Rolle (null: keine). */
        var asked = body.RoleIds ?? (string.IsNullOrWhiteSpace(body.RoleId) ? new List<string>() : [body.RoleId]);
        if (asked.Count > MaxMemberRoles)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Formularz daje najwyżej {MaxMemberRoles} ról.");
            return;
        }

        var roles = new List<Guid>();
        foreach (var text in asked)
        {
            if (!Guid.TryParse(text, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola."); return; }
            if (!roles.Contains(parsed)) roles.Add(parsed);
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        if (roles.Count > 0)
        {
            var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
            foreach (var role in roles)
            {
                var found = mine.FirstOrDefault(r => r.Id == role);
                if (found.Id != role || found.Kind is not ("role" or "group"))
                {
                    await Fail(ctx, StatusCodes.Status403Forbidden, "Formularz może dawać tylko role albo grupy, które masz.");
                    return;
                }

                await using var link = new SqlCommand("SELECT COUNT(*) FROM app.invitation WHERE role_id = @role AND purpose = N'area-link';", connection);
                link.Parameters.AddWithValue("@role", role);
                if ((int)(await link.ExecuteScalarAsync(ctx.RequestAborted))! > 0)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "To jest rola linku — wybierz rolę grupy, którą link daje.");
                    return;
                }
            }
        }

        var many = await Schema.VirtualAreasAsync(connection, ctx.RequestAborted);
        if (!many && roles.Count > 1)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Kilka ról naraz będzie można dać po migracji 0120.");
            return;
        }

        var by = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted))
            .Where(r => r.Kind == "person").Select(r => (Guid?)r.Id).FirstOrDefault();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            /* Die erste Rolle bleibt auch in der Spalte von 0091 — für alles, was sie noch liest. */
            await using (var cmd = new SqlCommand("UPDATE app.module SET member_role_id = @role WHERE id = @id;", connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", sheet.ModuleId);
                cmd.Parameters.AddWithValue("@role", roles.Count == 0 ? DBNull.Value : roles[0]);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (many)
            {
                await using (var clear = new SqlCommand("DELETE FROM app.module_role WHERE module_id = @id;", connection, tx))
                {
                    clear.Parameters.AddWithValue("@id", sheet.ModuleId);
                    await clear.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                for (var i = 0; i < roles.Count; i++)
                {
                    await using var add = new SqlCommand("""
                        INSERT INTO app.module_role (module_id, role_id, position, set_by_role_id, created_at)
                        VALUES (@id, @role, @position, @by, @now);
                        """, connection, tx);
                    add.Parameters.AddWithValue("@id", sheet.ModuleId);
                    add.Parameters.AddWithValue("@role", roles[i]);
                    add.Parameters.AddWithValue("@position", i);
                    add.Parameters.AddWithValue("@by", (object?)by ?? DBNull.Value);
                    add.Parameters.AddWithValue("@now", now);
                    await add.ExecuteNonQueryAsync(ctx.RequestAborted);
                }
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            moduleId = Ids.ToText(sheet.ModuleId),
            roleId = roles.Count == 0 ? null : Ids.ToText(roles[0]),
            roleIds = roles.Select(Ids.ToText).ToList()
        });
    }

    /// <summary>
    /// „PRZENIEŚ OBECNE ZGŁOSZENIA" — wer das Formular schon eingesandt hat (mit
    /// Link, nicht zurückgezogen, nicht ausgeblendet), gehört ab jetzt auch zu
    /// den Rollen des Formulars. Was er vorher hatte (der Bereich seines Platzes,
    /// die Rozmowy am Formular), bleibt; die Rollen kommen dazu. Den Schlüssel
    /// gibt danach der Browser eines Mitglieds weiter (<see cref="MemberKeysAsync"/>).
    /// </summary>
    private static async Task EnrollAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var roles = await MemberRolesOfAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        if (roles.Count == 0) { await Fail(ctx, StatusCodes.Status409Conflict, "Najpierw wybierz rolę uczestników."); return; }

        var added = 0;
        var now = DateTimeOffset.UtcNow;
        foreach (var role in roles)
        {
            await using var cmd = new SqlCommand("""
                INSERT INTO app.access_role (access_id, role_id, module_id, granted_at)
                SELECT DISTINCT g.access_id, @role, @module, @now
                FROM app.registration g JOIN app.access s ON s.id = g.access_id
                WHERE g.part_id = @module AND g.withdrawn_at IS NULL AND g.is_hidden = 0 AND s.revoked_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM app.access_role x WHERE x.access_id = g.access_id AND x.role_id = @role);
                """, connection);
            cmd.Parameters.AddWithValue("@role", role);
            cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
            cmd.Parameters.AddWithValue("@now", now);
            added += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            moduleId = Ids.ToText(sheet.ModuleId),
            roleId = Ids.ToText(roles[0]),
            roleIds = roles.Select(Ids.ToText).ToList(),
            added
        });
    }

    /// <summary>
    /// DEN SCHLÜSSEL EINER ROLLE ABGEBEN — je Platz versiegelt unter seinem
    /// Platzschlüssel, im Browser eines Mitglieds. Der Dienst prüft nur, dass
    /// dieses Konto die Rolle hält, dass sie eine Rolle des Formulars ist und
    /// dass es das Formular sieht, und legt die Hülle ab; was darin liegt, sieht
    /// er nicht. Eine schon abgegebene bleibt.
    /// </summary>
    private static async Task MemberKeysAsync(HttpContext ctx, Db db, Guid id, MemberKeysRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var keys = body.Keys ?? [];
        if (keys.Count is 0 or > MaxKeysAtOnce)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednego do {MaxKeysAtOnce} kluczy naraz.");
            return;
        }

        var parsed = new List<(Guid Seat, byte[] Blob, Guid? Role)>();
        foreach (var one in keys)
        {
            if (!Guid.TryParse(one.SeatId, out var seat) || !Base64Url.TryDecode(one.KeySealed, out var blob) || blob.Length is < 40 or > 512)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz miejsca.");
                return;
            }

            Guid? role = null;
            if (!string.IsNullOrWhiteSpace(one.RoleId))
            {
                if (!Guid.TryParse(one.RoleId, out var parsedRole)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola."); return; }
                role = parsedRole;
            }

            parsed.Add((seat, blob, role));
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayOfficeAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var roles = await MemberRolesOfAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);

        /* Ohne Angabe die erste Rolle — so schickten es die Browser bis 0120. */
        foreach (var one in parsed)
        {
            var role = one.Role ?? (roles.Count > 0 ? roles[0] : (Guid?)null);
            if (role is null || !roles.Contains(role.Value) || !mine.Any(r => r.Id == role.Value))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Klucz roli może przekazać tylko ten, kto ją ma.");
                return;
            }
        }

        var by = mine.Where(r => r.Kind == "person").Select(r => (Guid?)r.Id).FirstOrDefault();
        var now = DateTimeOffset.UtcNow;
        var done = 0;
        foreach (var (seat, blob, given) in parsed)
        {
            await using var cmd = new SqlCommand("""
                UPDATE app.access_role SET key_sealed = @blob, sealed_at = @now, sealed_by_role_id = @by
                WHERE access_id = @seat AND role_id = @role AND key_sealed IS NULL
                  AND EXISTS (SELECT 1 FROM app.registration g WHERE g.access_id = @seat AND g.part_id = @module);
                """, connection);
            cmd.Parameters.AddWithValue("@seat", seat);
            cmd.Parameters.AddWithValue("@role", given ?? roles[0]);
            cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@by", (object?)by ?? DBNull.Value);
            cmd.Parameters.AddBlob("@blob", blob);
            done += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { moduleId = Ids.ToText(sheet.ModuleId), sealedCount = done });
    }
}
