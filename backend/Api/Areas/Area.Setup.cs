using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0137 — DIE EINRICHTUNG EINER WSPÓLNOTA (<c>frontend/src/app/communities/</c>): je Bereich ein
/// versiegeltes Dokument, die vorigen Fassungen zum Rückgängigmachen, und das Umhängen eines
/// Bereichs unter einen anderen.
///
/// <para>
/// <b>Der Dienst liest das Dokument nie.</b> Es liegt unter dem Epochenschlüssel des Bereichs;
/// lesen darf, wer den Bereich liest — auch ein Link ohne Konto (<see cref="Callers"/>), denn wer
/// seinen persönlichen Link öffnet, soll sehen, wo er ist und in welcher Rolle. Schreiben darf,
/// wer den Bereich führt (admin).
/// </para>
/// </summary>
public static partial class Area
{
    public sealed record SetupRequest(int Epoch, string? Sealed, int? Version, string? RoleId);
    public sealed record ParentRequest(string? ParentAreaId);

    /// <summary>So viele vorige Fassungen bleiben je Bereich.</summary>
    private const int SetupHistoryKeep = 20;

    /// <summary>Ein Dokument ist klein (die Struktur, keine Inhalte) — 2 MB genügen für Hunderte Einheiten und Personen.</summary>
    private const int SetupMaxBytes = 2 * 1024 * 1024;

    internal static void MapSetup(WebApplication app)
    {
        app.MapGet("/workspace/area/{id:guid}/setup", SetupAsync);
        app.MapPost("/workspace/area/{id:guid}/setup", SetSetupAsync);
        app.MapGet("/workspace/area/{id:guid}/setup/history", SetupHistoryAsync);
        app.MapPost("/workspace/area/{id:guid}/parent", SetParentAsync);
    }

    private static async Task<bool> SetupTablesAsync(SqlConnection connection, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT CASE WHEN OBJECT_ID('app.area_setup_history') IS NULL THEN 0 ELSE 1 END;", connection);
        return (int)(await cmd.ExecuteScalarAsync(ct))! == 1;
    }

    private const string NoSetupTables = "Migracja 0137 (wspólnoty) nie jest jeszcze zastosowana na serwerze.";

    /// <summary>Das Dokument eines Bereichs — <c>null</c>, wenn es keines gibt.</summary>
    private static async Task SetupAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!await MayAsync(connection, caller, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }
        if (!await SetupTablesAsync(connection, ctx.RequestAborted))
        {
            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), setup = (object?)null, missing = true });
            return;
        }

        await using var cmd = new SqlCommand(
            "SELECT epoch, sealed_blob, version, updated_at FROM app.area_setup WHERE area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@area", id);
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        object? setup = null;
        if (await reader.ReadAsync(ctx.RequestAborted))
        {
            setup = new
            {
                epoch = reader.GetInt32(0),
                @sealed = Base64Url.Encode((byte[])reader[1]),
                version = reader.GetInt32(2),
                updatedAt = reader.GetFieldValue<DateTimeOffset>(3)
            };
        }
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), setup });
    }

    /// <summary>
    /// Ein neues Dokument — nur, wenn <c>version</c> die jetzige ist (sonst 409: jemand war schneller).
    /// Die vorige Fassung geht in den Verlauf; <c>sealed</c> leer löscht das Dokument.
    /// </summary>
    private static async Task SetSetupAsync(HttpContext ctx, Db db, Guid id, SetupRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        byte[] blob = [];
        if (!string.IsNullOrEmpty(body.Sealed))
        {
            try { blob = Base64Url.Decode(body.Sealed); }
            catch (FormatException) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny dokument."); return; }
            if (blob.Length > SetupMaxBytes) { await Fail(ctx, StatusCodes.Status413PayloadTooLarge, "Dokument wspólnoty jest za duży (najwyżej 2 MB)."); return; }
        }
        if (body.Epoch < 1) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna epoka."); return; }
        Guid? roleId = null;
        if (body.RoleId is not null)
        {
            if (!Guid.TryParse(body.RoleId, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola."); return; }
            roleId = parsed;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ustawienia wspólnoty zmienia ten, kto prowadzi ten obszar.");
            return;
        }
        if (!await SetupTablesAsync(connection, ctx.RequestAborted)) { await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NoSetupTables); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        int? had = null;
        await using (var read = new SqlCommand(
            "SELECT version FROM app.area_setup WITH (UPDLOCK, HOLDLOCK) WHERE area_id = @area;", connection, tx))
        {
            read.Parameters.AddWithValue("@area", id);
            if (await read.ExecuteScalarAsync(ctx.RequestAborted) is int v) had = v;
        }
        if ((body.Version ?? 0) != (had ?? 0))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ktoś zmienił ustawienia wspólnoty w międzyczasie — odśwież i spróbuj jeszcze raz.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        if (had is not null)
        {
            /* Die vorige Fassung in den Verlauf — und nur die letzten zwanzig behalten. */
            await using var keep = new SqlCommand("""
                INSERT INTO app.area_setup_history (id, area_id, epoch, sealed_blob, version, created_at)
                SELECT @hid, area_id, epoch, sealed_blob, version, @now FROM app.area_setup WHERE area_id = @area;
                DELETE FROM app.area_setup_history
                 WHERE area_id = @area AND id NOT IN (
                     SELECT TOP (@keep) id FROM app.area_setup_history WHERE area_id = @area ORDER BY created_at DESC, version DESC);
                """, connection, tx);
            keep.Parameters.AddWithValue("@hid", Ids.NewId());
            keep.Parameters.AddWithValue("@area", id);
            keep.Parameters.AddWithValue("@now", now);
            keep.Parameters.AddWithValue("@keep", SetupHistoryKeep);
            await keep.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        var version = (had ?? 0) + 1;
        await using (var write = new SqlCommand(blob.Length == 0
            ? "DELETE FROM app.area_setup WHERE area_id = @area;"
            : """
              UPDATE app.area_setup SET epoch = @epoch, sealed_blob = @blob, version = @version, role_id = @role, updated_at = @now WHERE area_id = @area;
              IF @@ROWCOUNT = 0
                  INSERT INTO app.area_setup (area_id, epoch, sealed_blob, version, role_id, updated_at)
                  VALUES (@area, @epoch, @blob, @version, @role, @now);
              """, connection, tx))
        {
            write.Parameters.AddWithValue("@area", id);
            write.Parameters.AddWithValue("@epoch", body.Epoch);
            write.Parameters.AddWithValue("@blob", blob);
            write.Parameters.AddWithValue("@version", version);
            write.Parameters.AddWithValue("@role", (object?)roleId ?? DBNull.Value);
            write.Parameters.AddWithValue("@now", now);
            await write.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), version = blob.Length == 0 ? 0 : version, updatedAt = now });
    }

    /// <summary>Die vorigen Fassungen (neueste zuerst) — für den, der den Bereich führt.</summary>
    private static async Task SetupHistoryAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }
        if (!await SetupTablesAsync(connection, ctx.RequestAborted)) { await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), history = Array.Empty<object>() }); return; }
        await using var cmd = new SqlCommand("""
            SELECT id, epoch, sealed_blob, version, created_at FROM app.area_setup_history
             WHERE area_id = @area ORDER BY created_at DESC, version DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@area", id);
        var history = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            history.Add(new
            {
                id = Ids.ToText(reader.GetGuid(0)), epoch = reader.GetInt32(1), @sealed = Base64Url.Encode((byte[])reader[2]),
                version = reader.GetInt32(3), at = reader.GetFieldValue<DateTimeOffset>(4)
            });
        }
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), history });
    }

    /// <summary>
    /// UMHÄNGEN: ein Bereich kommt unter einen anderen (oder ganz nach aussen). Wer das tut, führt den
    /// Bereich UND den neuen Vater (wie beim Anlegen, 0035) — sonst hängte jeder seinen Bereich unter
    /// fremde Ordnung. Kein Kreis, kein privater Bereich; Rollen und Zugänge bleiben, wie sie sind.
    /// </summary>
    private static async Task SetParentAsync(HttpContext ctx, Db db, Guid id, ParentRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        Guid? parent = null;
        if (!string.IsNullOrEmpty(body.ParentAreaId))
        {
            if (!Guid.TryParse(body.ParentAreaId, out var p)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru nadrzędnego."); return; }
            parent = p;
        }
        if (parent == id) { await Fail(ctx, StatusCodes.Status409Conflict, "Obszar nie może leżeć w sobie."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!await MayAsync(connection, mine, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Przenosi ten, kto prowadzi ten obszar.");
            return;
        }
        if (await PersonalOwnerAsync(connection, id, ctx.RequestAborted) is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, PersonalStaysPersonal);
            return;
        }
        if (parent is { } target)
        {
            if (!await MayAsync(connection, mine, target, Capability.Admin, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nadrzędnego nie ma — przenosi ten, kto prowadzi oba.");
                return;
            }
            if (await PersonalOwnerAsync(connection, target, ctx.RequestAborted) is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, PersonalStaysPersonal);
                return;
            }
            /* Kein Kreis: der neue Vater liegt nicht in diesem Bereich. */
            await using var loop = new SqlCommand("""
                WITH up AS (
                    SELECT id, parent_area_id, 0 AS depth FROM app.area WHERE id = @target
                    UNION ALL
                    SELECT a.id, a.parent_area_id, up.depth + 1 FROM app.area a JOIN up ON a.id = up.parent_area_id WHERE up.depth < 64)
                SELECT COUNT(*) FROM up WHERE id = @area;
                """, connection);
            loop.Parameters.AddWithValue("@target", target);
            loop.Parameters.AddWithValue("@area", id);
            if ((int)(await loop.ExecuteScalarAsync(ctx.RequestAborted))! > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten obszar leży już w nowym miejscu (albo wyżej) — tak powstałoby koło.");
                return;
            }
        }

        await using var cmd = new SqlCommand("UPDATE app.area SET parent_area_id = @parent WHERE id = @area;", connection);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@parent", (object?)parent ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), parentAreaId = parent is null ? null : Ids.ToText(parent.Value) });
    }
}
