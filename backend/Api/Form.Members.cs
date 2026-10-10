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

    public sealed record MemberRoleRequest(string? RoleId);

    public sealed record MemberKeysRequest(List<MemberKey>? Keys);

    public sealed record MemberKey(string? SeatId, string? KeySealed);

    /// <summary>Beim Einsenden: der Platz gehört zur Rolle des Formulars, wenn es eine hat (der Schlüssel folgt).</summary>
    internal static async Task JoinMemberRoleAsync(SqlConnection connection, SqlTransaction tx, Guid moduleId, Guid seatId, DateTimeOffset now, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.access_role (access_id, role_id, module_id, granted_at)
            SELECT @seat, m.member_role_id, m.id, @now
            FROM app.module m JOIN app.role r ON r.id = m.member_role_id AND r.revoked_at IS NULL
            WHERE m.id = @module
              AND NOT EXISTS (SELECT 1 FROM app.access_role x WHERE x.access_id = @seat AND x.role_id = m.member_role_id);
            """, connection, tx);
        cmd.Parameters.AddWithValue("@seat", seatId);
        cmd.Parameters.AddWithValue("@module", moduleId);
        cmd.Parameters.AddWithValue("@now", now);
        await cmd.ExecuteNonQueryAsync(ct);
    }

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

    private static async Task<Guid?> MemberRoleOfAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT member_role_id FROM app.module WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", moduleId);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
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

        var role = await MemberRoleOfAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var now = DateTimeOffset.UtcNow;

        /* Wie viele Menschen das Formular hat (mit Link), wie viele zur Rolle gehören, wie viele schon den Schlüssel haben. */
        int seats, members = 0, sealedCount = 0;
        await using (var cmd = new SqlCommand("""
            SELECT COUNT(DISTINCT g.access_id) FROM app.registration g JOIN app.access s ON s.id = g.access_id
            WHERE g.part_id = @module AND g.withdrawn_at IS NULL AND g.is_hidden = 0 AND s.revoked_at IS NULL;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
            seats = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        var waiting = new List<object>();
        if (role is not null)
        {
            await using (var cmd = new SqlCommand($"""
                SELECT COUNT(*), SUM(CASE WHEN ar.key_sealed IS NULL THEN 0 ELSE 1 END)
                FROM app.access_role ar JOIN app.access s ON s.id = ar.access_id
                WHERE ar.role_id = @role
                  AND EXISTS (SELECT 1 FROM app.registration g WHERE g.access_id = ar.access_id AND g.part_id = @module
                               AND g.withdrawn_at IS NULL AND g.is_hidden = 0)
                  AND {LiveMember};
                """, connection))
            {
                cmd.Parameters.AddWithValue("@role", role.Value);
                cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted))
                {
                    members = reader.GetInt32(0);
                    sealedCount = reader.IsDBNull(1) ? 0 : reader.GetInt32(1);
                }
            }

            /* Wer noch wartet — mit dem, was die Kanzlei braucht, um seinen Platzschlüssel zu öffnen (wie `Seat.ListAsync`). */
            if (mine.Count > 0 && mine.Contains(role.Value))
            {
                var names = string.Join(", ", mine.Select((_, i) => $"@m{i}"));
                await using var cmd = new SqlCommand($"""
                    SELECT TOP {MaxKeysAtOnce} s.id, s.area_id, s.epoch, s.origin, s.seat_key_for_intake, s.seat_key_for_area, s.recipient_name
                    FROM app.access_role ar JOIN app.access s ON s.id = ar.access_id
                    WHERE ar.role_id = @role AND ar.key_sealed IS NULL
                      AND EXISTS (SELECT 1 FROM app.registration g WHERE g.access_id = ar.access_id AND g.part_id = @module
                                   AND g.withdrawn_at IS NULL AND g.is_hidden = 0)
                      AND {LiveMember} AND {OpensSeat(names)}
                    ORDER BY ar.granted_at;
                    """, connection);
                cmd.Parameters.AddWithValue("@role", role.Value);
                cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
                cmd.Parameters.AddWithValue("@now", now);
                for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@m{i}", mine[i]);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    waiting.Add(new
                    {
                        seatId = Ids.ToText(reader.GetGuid(0)),
                        areaId = Ids.ToText(reader.GetGuid(1)),
                        epoch = reader.GetInt32(2),
                        origin = reader.GetString(3),
                        seatKeyForIntake = reader.IsDBNull(4) ? null : Base64Url.Encode((byte[])reader[4]),
                        seatKeyForArea = reader.IsDBNull(5) ? null : Base64Url.Encode((byte[])reader[5]),
                        recipientName = reader.IsDBNull(6) ? null : reader.GetString(6)
                    });
                }
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            moduleId = Ids.ToText(sheet.ModuleId),
            roleId = role is null ? null : Ids.ToText(role.Value),

            /* Hält dieses Konto die Rolle — nur dann kann es ihren Schlüssel weitergeben. */
            holdsRole = role is not null && mine.Contains(role.Value),
            areas = role is null ? new List<object>() : await Roles.AreasOfRoleAsync(connection, role.Value, ctx.RequestAborted),
            seats,
            members,
            @sealed = sealedCount,
            waiting
        });
    }

    /// <summary>
    /// Die Rolle des Formulars setzen (oder mit <c>null</c> lösen). Nur eine, die
    /// dieses Konto erreicht — sonst gäbe ein Formular Zugang, den sein Führer
    /// selbst nicht hat; und keine Person, kein Konto, keine Linkrolle.
    /// Wer schon dazugehört, bleibt dabei: die Rolle gilt für neue Einsendungen,
    /// die übrigen nimmt „Przenieś" mit.
    /// </summary>
    private static async Task MemberRoleAsync(HttpContext ctx, Db db, Guid id, MemberRoleRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        Guid? role = null;
        if (!string.IsNullOrWhiteSpace(body.RoleId))
        {
            if (!Guid.TryParse(body.RoleId, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola."); return; }
            role = parsed;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        if (role is not null)
        {
            var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
            var found = mine.FirstOrDefault(r => r.Id == role.Value);
            if (found.Id != role.Value || found.Kind is not ("role" or "group"))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Formularz może dawać tylko rolę albo grupę, którą masz.");
                return;
            }

            await using var link = new SqlCommand("SELECT COUNT(*) FROM app.invitation WHERE role_id = @role AND purpose = N'area-link';", connection);
            link.Parameters.AddWithValue("@role", role.Value);
            if ((int)(await link.ExecuteScalarAsync(ctx.RequestAborted))! > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "To jest rola linku — wybierz rolę grupy, którą link daje.");
                return;
            }
        }

        await using (var cmd = new SqlCommand("UPDATE app.module SET member_role_id = @role WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", sheet.ModuleId);
            cmd.Parameters.AddWithValue("@role", (object?)role ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { moduleId = Ids.ToText(sheet.ModuleId), roleId = role is null ? null : Ids.ToText(role.Value) });
    }

    /// <summary>
    /// „PRZENIEŚ OBECNE ZGŁOSZENIA" — wer das Formular schon eingesandt hat (mit
    /// Link, nicht zurückgezogen, nicht ausgeblendet), gehört ab jetzt auch zur
    /// Rolle. Was er vorher hatte (der Bereich seines Platzes, die Rozmowy am
    /// Formular), bleibt; die Rolle kommt dazu. Den Schlüssel gibt danach der
    /// Browser eines Mitglieds weiter (<see cref="MemberKeysAsync"/>).
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

        var role = await MemberRoleOfAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        if (role is null) { await Fail(ctx, StatusCodes.Status409Conflict, "Najpierw wybierz rolę uczestników."); return; }

        await using var cmd = new SqlCommand("""
            INSERT INTO app.access_role (access_id, role_id, module_id, granted_at)
            SELECT DISTINCT g.access_id, @role, @module, @now
            FROM app.registration g JOIN app.access s ON s.id = g.access_id
            WHERE g.part_id = @module AND g.withdrawn_at IS NULL AND g.is_hidden = 0 AND s.revoked_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM app.access_role x WHERE x.access_id = g.access_id AND x.role_id = @role);
            """, connection);
        cmd.Parameters.AddWithValue("@role", role.Value);
        cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        var added = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { moduleId = Ids.ToText(sheet.ModuleId), roleId = Ids.ToText(role.Value), added });
    }

    /// <summary>
    /// DEN SCHLÜSSEL DER ROLLE ABGEBEN — je Platz versiegelt unter seinem
    /// Platzschlüssel, im Browser eines Mitglieds. Der Dienst prüft nur, dass
    /// dieses Konto die Rolle hält und das Formular sieht, und legt die Hülle
    /// ab; was darin liegt, sieht er nicht. Eine schon abgegebene bleibt.
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

        var parsed = new List<(Guid Seat, byte[] Blob)>();
        foreach (var one in keys)
        {
            if (!Guid.TryParse(one.SeatId, out var seat) || !Base64Url.TryDecode(one.KeySealed, out var blob) || blob.Length is < 40 or > 512)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz miejsca.");
                return;
            }
            parsed.Add((seat, blob));
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayOfficeAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var role = await MemberRoleOfAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (role is null || !mine.Any(r => r.Id == role.Value))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Klucz roli może przekazać tylko ten, kto ją ma.");
            return;
        }

        var by = mine.Where(r => r.Kind == "person").Select(r => (Guid?)r.Id).FirstOrDefault();
        var now = DateTimeOffset.UtcNow;
        var done = 0;
        foreach (var (seat, blob) in parsed)
        {
            await using var cmd = new SqlCommand("""
                UPDATE app.access_role SET key_sealed = @blob, sealed_at = @now, sealed_by_role_id = @by
                WHERE access_id = @seat AND role_id = @role AND key_sealed IS NULL
                  AND EXISTS (SELECT 1 FROM app.registration g WHERE g.access_id = @seat AND g.part_id = @module);
                """, connection);
            cmd.Parameters.AddWithValue("@seat", seat);
            cmd.Parameters.AddWithValue("@role", role.Value);
            cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@by", (object?)by ?? DBNull.Value);
            cmd.Parameters.AddBlob("@blob", blob);
            done += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { moduleId = Ids.ToText(sheet.ModuleId), sealedCount = done });
    }
}
