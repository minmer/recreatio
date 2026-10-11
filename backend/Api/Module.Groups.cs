using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// GRUPY FORMULARZY (0096) — ein Ordner: Formulare und Unterformulare unter
/// einem Namen, in einer Reihenfolge. In der Liste stehen sie beieinander, auf
/// der Karte in einem Kasten. Für den Menschen, der ausfüllt, ändert sich nichts.
///
/// <para>
/// <b>Wer sie sieht:</b> wer sie angelegt hat, und jeder, der eines ihrer
/// Formulare sieht. <b>Wer sie ändert</b> (umbenennen, ordnen, auflösen): wer
/// sie angelegt hat, und wer eines ihrer Formulare pflegt. Ein Formular in eine
/// Gruppe legen darf, wer das Formular pflegt und die Gruppe sieht
/// (<see cref="UpdateAsync"/>).
/// </para>
/// </summary>
public static partial class Module
{
    private static void MapGroups(WebApplication app)
    {
        app.MapPost("/workspace/form-groups", CreateGroupAsync);
        app.MapPost("/workspace/form-group/{id:guid}", UpdateGroupAsync);
        app.MapDelete("/workspace/form-group/{id:guid}", RemoveGroupAsync);
    }

    public sealed record GroupCreateRequest(string? GroupId, string? Name);

    public sealed record GroupUpdateRequest(string? Name, IReadOnlyList<string>? Order);

    /// <summary>Der Name einer Gruppe: ohne Steuerzeichen und doppelte Leerzeichen, 1 bis 200 Zeichen. <c>null</c>: unbrauchbar.</summary>
    public static string? GroupName(string? text)
    {
        var clean = string.Join(' ', new string((text ?? string.Empty).Where(c => !char.IsControl(c)).ToArray())
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return clean.Length is 0 or > MaxName ? null : clean;
    }

    /// <summary>Ein Baustein, den eine meiner Rollen sieht — als SQL über <paramref name="m"/> (app.module). Braucht <c>@now</c>.</summary>
    internal static string Visible(string m, string names) => $"""
        (EXISTS (SELECT 1 FROM app.certificate c
                  WHERE c.scope_kind = N'area' AND c.scope_id = {m}.area_id
                    AND c.revoked_at IS NULL AND c.expires_at > @now
                    AND c.subject_role_id IN ({names}))
         OR EXISTS (SELECT 1 FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id
                     WHERE p.module_id = {m}.id AND s.claimed_by_role_id IN ({names})))
        """;

    /// <summary>Ein Baustein, den eine meiner Rollen pflegt (schreibt im Bereich, oder führt seine Seite).</summary>
    private static string Tended(string m, string names) => $"""
        (EXISTS (SELECT 1 FROM app.certificate c
                  WHERE c.scope_kind = N'area' AND c.scope_id = {m}.area_id
                    AND c.revoked_at IS NULL AND c.expires_at > @now
                    AND c.capability IN (N'write', N'admin')
                    AND c.subject_role_id IN ({names}))
         OR EXISTS (SELECT 1 FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id
                     WHERE p.module_id = {m}.id AND s.claimed_by_role_id IN ({names})))
        """;

    private static void Roles(SqlCommand cmd, IReadOnlyList<Workspace.RoleRow> mine)
    {
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);
    }

    private static string NamesOf(IReadOnlyList<Workspace.RoleRow> mine) => string.Join(", ", mine.Select((_, i) => $"@r{i}"));

    /// <summary>Die Gruppen, die ich sehe — für die Liste der Bausteine.</summary>
    internal static async Task<List<object>> GroupsOfAsync(SqlConnection connection, IReadOnlyList<Workspace.RoleRow> mine, CancellationToken ct)
    {
        var groups = new List<object>();
        if (mine.Count == 0) return groups;
        var names = NamesOf(mine);

        await using var cmd = new SqlCommand($"""
            SELECT g.id, g.name, g.created_at,
                   CAST(CASE WHEN g.created_by_role_id IN ({names}) THEN 1 ELSE 0 END AS bit) AS mine,
                   CAST(CASE WHEN g.created_by_role_id IN ({names})
                               OR EXISTS (SELECT 1 FROM app.module m WHERE m.form_group_id = g.id AND {Tended("m", names)})
                             THEN 1 ELSE 0 END AS bit) AS manages
            FROM app.form_group g
            WHERE g.created_by_role_id IN ({names})
               OR EXISTS (SELECT 1 FROM app.module m WHERE m.form_group_id = g.id AND {Visible("m", names)})
            ORDER BY g.name, g.created_at;
            """, connection);
        Roles(cmd, mine);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            groups.Add(new
            {
                groupId = Ids.ToText(reader.GetGuid(0)),
                name = reader.GetString(1),
                createdAt = reader.GetDateTimeOffset(2),
                mine = reader.GetBoolean(3),
                /* Darf ich sie umbenennen, ordnen, auflösen? */
                manages = reader.GetBoolean(4)
            });
        }
        return groups;
    }

    /// <summary>Sehe ich diese Gruppe — und darf ich sie ändern?</summary>
    private static async Task<(bool Sees, bool Manages)> GroupAccessAsync(
        SqlConnection connection, Guid groupId, IReadOnlyList<Workspace.RoleRow> mine, CancellationToken ct)
    {
        if (mine.Count == 0) return (false, false);
        var names = NamesOf(mine);

        await using var cmd = new SqlCommand($"""
            SELECT CAST(CASE WHEN g.created_by_role_id IN ({names})
                               OR EXISTS (SELECT 1 FROM app.module m WHERE m.form_group_id = g.id AND {Visible("m", names)})
                             THEN 1 ELSE 0 END AS bit),
                   CAST(CASE WHEN g.created_by_role_id IN ({names})
                               OR EXISTS (SELECT 1 FROM app.module m WHERE m.form_group_id = g.id AND {Tended("m", names)})
                             THEN 1 ELSE 0 END AS bit)
            FROM app.form_group g WHERE g.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", groupId);
        Roles(cmd, mine);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetBoolean(0), reader.GetBoolean(1)) : (false, false);
    }

    /// <summary>Eine neue Gruppe — leer; Formulare kommen über das Formular hinein.</summary>
    private static async Task CreateGroupAsync(HttpContext ctx, Db db, GroupCreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var name = GroupName(body.Name);
        if (name is null || !Guid.TryParse(body.GroupId, out var id))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Nazwa grupy: od 1 do {MaxName} znaków.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var by = mine.Where(r => r.Kind == "person").Select(r => (Guid?)r.Id).FirstOrDefault()
            ?? mine.Select(r => (Guid?)r.Id).FirstOrDefault();
        if (by is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Najpierw załóż osobę — grupę zakłada osoba.");
            return;
        }

        try
        {
            await using var cmd = new SqlCommand(
                "INSERT INTO app.form_group (id, name, created_by_role_id, created_at) VALUES (@id, @name, @by, @now);", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@name", name);
            cmd.Parameters.AddWithValue("@by", by.Value);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Taka grupa już jest.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { groupId = Ids.ToText(id), name });
    }

    /// <summary>Umbenennen, und die Reihenfolge ihrer Formulare (die genannten zuerst, in dieser Folge).</summary>
    private static async Task UpdateGroupAsync(HttpContext ctx, Db db, Guid id, GroupUpdateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var access = await GroupAccessAsync(connection, id, mine, ctx.RequestAborted);
        if (!access.Sees)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej grupy nie ma.");
            return;
        }
        if (!access.Manages)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tę grupę zmienia ten, kto ją założył, albo kto prowadzi jej formularze.");
            return;
        }

        string? name = null;
        if (body.Name is not null)
        {
            name = GroupName(body.Name);
            if (name is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nazwa grupy: od 1 do {MaxName} znaków.");
                return;
            }
        }

        var order = new List<Guid>();
        foreach (var one in body.Order ?? [])
        {
            if (!Guid.TryParse(one, out var moduleId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kolejność.");
                return;
            }
            if (!order.Contains(moduleId)) order.Add(moduleId);
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        if (name is not null)
        {
            await using var rename = new SqlCommand("UPDATE app.form_group SET name = @name WHERE id = @id;", connection, tx);
            rename.Parameters.AddWithValue("@name", name);
            rename.Parameters.AddWithValue("@id", id);
            await rename.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        for (var i = 0; i < order.Count; i++)
        {
            await using var place = new SqlCommand(
                "UPDATE app.module SET group_position = @pos WHERE id = @m AND form_group_id = @id;", connection, tx);
            place.Parameters.AddWithValue("@pos", i);
            place.Parameters.AddWithValue("@m", order[i]);
            place.Parameters.AddWithValue("@id", id);
            await place.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { groupId = Ids.ToText(id), saved = true });
    }

    /// <summary>Die Gruppe auflösen — ihre Formulare bleiben, nur lose.</summary>
    private static async Task RemoveGroupAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var access = await GroupAccessAsync(connection, id, mine, ctx.RequestAborted);
        if (!access.Sees)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej grupy nie ma.");
            return;
        }
        if (!access.Manages)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tę grupę usuwa ten, kto ją założył, albo kto prowadzi jej formularze.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.module SET form_group_id = NULL, group_position = NULL WHERE form_group_id = @id;
            DELETE FROM app.form_group WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { groupId = Ids.ToText(id), removed = true });
    }

    /// <summary>
    /// Ein Formular in eine Gruppe legen (ans Ende) — oder aus ihr nehmen. Der
    /// Aufrufer hat geprüft, dass ich das Formular pflege.
    /// </summary>
    private static async Task<(int Status, string? Error)> PlaceInGroupAsync(
        SqlConnection connection, SqlTransaction tx, Row row, Guid? groupId, IReadOnlyList<Workspace.RoleRow> mine, CancellationToken ct)
    {
        if (groupId is null)
        {
            await using var clear = new SqlCommand(
                "UPDATE app.module SET form_group_id = NULL, group_position = NULL WHERE id = @id;", connection, tx);
            clear.Parameters.AddWithValue("@id", row.Id);
            await clear.ExecuteNonQueryAsync(ct);
            return (200, null);
        }

        if (row.Kind != "form") return (409, "Do grupy formularzy trafiają tylko formularze.");

        await using var cmd = new SqlCommand("""
            UPDATE app.module
               SET group_position = CASE WHEN form_group_id = @g THEN group_position
                                         ELSE (SELECT COALESCE(MAX(x.group_position), -1) + 1 FROM app.module x WHERE x.form_group_id = @g) END,
                   form_group_id = @g
             WHERE id = @id;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@g", groupId.Value);
        cmd.Parameters.AddWithValue("@id", row.Id);
        await cmd.ExecuteNonQueryAsync(ct);
        return (200, null);
    }
}
