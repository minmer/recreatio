using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0132 — SCHEMATA UND PLÄNE EINES KALENDERS (<c>app.calendar_doc</c>).
///
/// <para>
/// <b>Versiegelt, und der Dienst öffnet sie nie.</b> Ein Schema liegt unter dem
/// Schlüssel des Bereichs, der die Termine SIEHT (wer einen Termin liest, muss
/// sein Schema lesen können); ein Plan unter dem des Kalenders selbst (ihn
/// braucht nur, wer dort schreibt). Andere Bereiche nimmt der Dienst nicht an.
/// </para>
///
/// <para>
/// <b>Wer zuletzt gelesen hat, schreibt.</b> Jede Fassung trägt eine Nummer; wer
/// eine ältere ändert, bekommt 409 und die aktuelle Nummer — eine fremde
/// Änderung wird nie still überschrieben.
/// </para>
/// </summary>
public static partial class Calendar
{
    public const int MaxDocBytes = 512 * 1024;

    public sealed record DocRequest(string? DocId, string? Kind, string? AreaId, int? Epoch, string? Sealed, int? Version);

    /// <summary>Die Schemata und Pläne eines Kalenders — die, deren Bereich der Leser lesen darf.</summary>
    private static async Task DocsAsync(HttpContext ctx, Db db, Guid id)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (await CalendarOfAsync(connection, id, ctx.RequestAborted) is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        /* Vor 0132 hat kein Kalender ein Schema — das ist eine Antwort, kein Fehler. */
        if (!await Schema.RecordsAsync(connection, ctx.RequestAborted))
        {
            await ctx.Response.WriteAsJsonAsync(new { docs = Array.Empty<object>() });
            return;
        }

        var rows = new List<(Guid Id, string Kind, Guid Area, int Epoch, byte[] Sealed, int Version, DateTimeOffset Updated)>();
        await using (var cmd = new SqlCommand("""
            SELECT id, kind, area_id, epoch, sealed, version, updated_at
            FROM app.calendar_doc WHERE calendar_id = @id ORDER BY created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetString(1), reader.GetGuid(2), reader.GetInt32(3),
                    (byte[])reader[4], reader.GetInt32(5), reader.GetDateTimeOffset(6)));
            }
        }

        var readable = new Dictionary<Guid, bool>();
        var docs = new List<object>();
        foreach (var row in rows)
        {
            if (!readable.TryGetValue(row.Area, out var may))
            {
                readable[row.Area] = may = await Area.MayAsync(connection, caller, row.Area, Capability.Read, ctx.RequestAborted);
            }
            if (!may) continue;

            docs.Add(new
            {
                docId = Ids.ToText(row.Id),
                kind = row.Kind,
                areaId = Ids.ToText(row.Area),
                epoch = row.Epoch,
                @sealed = Base64Url.Encode(row.Sealed),
                version = row.Version,
                updatedAt = row.Updated
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { docs });
    }

    /// <summary>Ein Schema oder einen Plan anlegen oder ändern — wer im Kalender schreibt.</summary>
    private static async Task SaveDocAsync(HttpContext ctx, Db db, Guid id, DocRequest body)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (!Guid.TryParse(body.DocId, out var docId) || kind is not ("scheme" or "plan")
            || !Guid.TryParse(body.AreaId, out var areaId) || body.Epoch is null or < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny dokument: kennung, rodzaj, obszar albo epoka.");
            return;
        }

        byte[] blob;
        try { blob = Base64Url.Decode(body.Sealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana treść.");
            return;
        }

        if (blob.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Pusty dokument nie jest zapieczętowany.");
            return;
        }

        if (blob.Length > MaxDocBytes)
        {
            await Fail(ctx, StatusCodes.Status413PayloadTooLarge, "Ten dokument jest za duży (najwyżej 512 KB).");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Schema.RecordsAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NeedsMigration);
            return;
        }

        Guid calendarArea;
        Guid? seeingArea;
        await using (var find = new SqlCommand("SELECT area_id, visibility_area_id FROM app.calendar WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
                return;
            }
            calendarArea = reader.GetGuid(0);
            seeingArea = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        if (!await Area.MayAsync(connection, caller, calendarArea, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma — albo nie możesz w nim pisać.");
            return;
        }

        if (areaId != calendarArea && areaId != seeingArea)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Schemat albo plan kalendarza pieczętuje się pod jego obszarem albo pod obszarem, który go widzi.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var self = Workspace.SelfOf(caller.Roles);

        (Guid Calendar, string Kind, int Version)? had = null;
        await using (var find = new SqlCommand("SELECT calendar_id, kind, version FROM app.calendar_doc WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", docId);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) had = (reader.GetGuid(0), reader.GetString(1), reader.GetInt32(2));
        }

        if (had is null)
        {
            if (body.Version is > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Tego dokumentu już nie ma — zapisz go jako nowy.");
                return;
            }

            await using var insert = new SqlCommand("""
                INSERT INTO app.calendar_doc
                    (id, calendar_id, kind, area_id, epoch, sealed, version, created_at, updated_at, updated_by_role_id)
                VALUES (@id, @cal, @kind, @area, @epoch, @blob, 1, @now, @now, @by);
                """, connection);
            insert.Parameters.AddWithValue("@id", docId);
            insert.Parameters.AddWithValue("@cal", id);
            insert.Parameters.AddWithValue("@kind", kind);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@epoch", body.Epoch.Value);
            insert.Parameters.Add("@blob", System.Data.SqlDbType.VarBinary, -1).Value = blob;
            insert.Parameters.AddWithValue("@now", now);
            insert.Parameters.AddWithValue("@by", self is null ? DBNull.Value : (object)self.Value.Id);

            try
            {
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten dokument właśnie powstał w innym oknie — wczytaj ponownie.");
                return;
            }

            await ctx.Response.WriteAsJsonAsync(new { docId = Ids.ToText(docId), version = 1 });
            return;
        }

        if (had.Value.Calendar != id || had.Value.Kind != kind)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten dokument należy do innego kalendarza albo jest innego rodzaju.");
            return;
        }

        if (body.Version != had.Value.Version)
        {
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new
            {
                error = "Ktoś inny zapisał to w międzyczasie — wczytaj ponownie.",
                version = had.Value.Version
            });
            return;
        }

        await using (var update = new SqlCommand("""
            UPDATE app.calendar_doc
               SET area_id = @area, epoch = @epoch, sealed = @blob, version = version + 1,
                   updated_at = @now, updated_by_role_id = @by
             WHERE id = @id AND version = @version;
            """, connection))
        {
            update.Parameters.AddWithValue("@id", docId);
            update.Parameters.AddWithValue("@area", areaId);
            update.Parameters.AddWithValue("@epoch", body.Epoch.Value);
            update.Parameters.Add("@blob", System.Data.SqlDbType.VarBinary, -1).Value = blob;
            update.Parameters.AddWithValue("@now", now);
            update.Parameters.AddWithValue("@by", self is null ? DBNull.Value : (object)self.Value.Id);
            update.Parameters.AddWithValue("@version", had.Value.Version);

            if (await update.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
            {
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new
                {
                    error = "Ktoś inny zapisał to w międzyczasie — wczytaj ponownie.",
                    version = had.Value.Version + 1
                });
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { docId = Ids.ToText(docId), version = had.Value.Version + 1 });
    }

    /// <summary>
    /// Ein Schema oder einen Plan löschen. Termine mit diesem Schema fallen auf
    /// das universelle zurück; ihre Werte bleiben stehen (ohne Schema zeigt der
    /// Browser sie mit ihrer offenen Beschriftung).
    /// </summary>
    private static async Task DeleteDocAsync(HttpContext ctx, Db db, Guid id)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Schema.RecordsAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NeedsMigration);
            return;
        }

        Guid? area = null;
        await using (var find = new SqlCommand("""
            SELECT c.area_id FROM app.calendar_doc d JOIN app.calendar c ON c.id = d.calendar_id WHERE d.id = @id;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is Guid found) area = found;
        }

        if (area is null || !await Area.MayAsync(connection, caller, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego dokumentu nie ma — albo nie możesz go usunąć.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using var drop = new SqlCommand("""
                UPDATE app.calendar_item SET scheme_id = NULL WHERE scheme_id = @id;
                DELETE FROM app.calendar_doc WHERE id = @id;
                """, connection, tx);
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { deleted = true });
    }
}
