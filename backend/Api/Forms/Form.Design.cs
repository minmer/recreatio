using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Aufbau und Logik eines Formulars (0043).</summary>
public static partial class Form
{
    /* -- Aufbau und Logik (0043) ---------------------------------------------- */

    /// <summary>Wie gross das Dokument werden darf — genug für ein sehr langes Formular.</summary>
    private const int MaxDesign = 512 * 1024;

    /// <summary>Das versiegelte Dokument eines Formulars, so wie es hinausgeht — oder <c>null</c>.</summary>
    private static async Task<object?> DesignAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT area_id, epoch, sealed, updated_at FROM app.form_design WHERE module_id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", moduleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new
        {
            areaId = Ids.ToText(reader.GetGuid(0)),
            epoch = reader.GetInt32(1),
            @sealed = Base64Url.Encode((byte[])reader[2]),
            updatedAt = reader.GetDateTimeOffset(3)
        };
    }

    /// <summary><c>Sealed</c> leer: das Dokument faellt weg, und das Formular ist wieder eine Liste.</summary>
    public sealed record DesignRequest(string? AreaId, int Epoch, string? Sealed);

    /// <summary>
    /// Den Aufbau und die Logik ablegen.
    ///
    /// <para>
    /// <b>Unter dem Schluessel des Formularbereichs</b> und keinem anderen —
    /// sonst laege die Logik woanders als die Fragen, auf die sie sich bezieht,
    /// und ein Besucher koennte die eine lesen und die andere nicht. Ohne
    /// Formularbereich gibt es deshalb keinen Aufbau.
    /// </para>
    ///
    /// <para>
    /// <b>Der Dienst prueft nichts daran.</b> Er kann es nicht lesen — und muss
    /// es auch nicht: er kann ohnehin keine Antwort lesen, also auch keine
    /// Bedingung auswerten. Das tut der Browser.
    /// </para>
    /// </summary>
    private static async Task SaveDesignAsync(HttpContext ctx, Db db, Guid id, DesignRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        id = sheet.ModuleId;

        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        if (string.IsNullOrWhiteSpace(body.Sealed))
        {
            await using var drop = new SqlCommand("DELETE FROM app.form_design WHERE module_id = @id;", connection);
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { partId = Ids.ToText(id), design = (object?)null });
            return;
        }

        if (sheet.AreaId is not Guid own)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Formularz nie ma własnego obszaru — układ i logikę pieczętuje się jego kluczem.");
            return;
        }

        /* 0133 — oder unter dem Bereich, in dem die Fragen veröffentlicht sind: der Aufbau geht mit ihnen. */
        if (!Guid.TryParse(body.AreaId, out var areaId) || (areaId != own && areaId != sheet.LabelAreaId) || body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Układ pieczętuje się kluczem obszaru formularza.");
            return;
        }

        byte[] sealedBytes;
        try { sealedBytes = Base64Url.Decode(body.Sealed); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany układ.");
            return;
        }

        if (sealedBytes.Length > MaxDesign)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Układ formularza: najwyżej {MaxDesign / 1024} KB.");
            return;
        }

        await using (var save = new SqlCommand("""
            UPDATE app.form_design SET area_id = @area, epoch = @epoch, sealed = @sealed, updated_at = @now
             WHERE module_id = @id;
            IF @@ROWCOUNT = 0
                INSERT INTO app.form_design (module_id, area_id, epoch, sealed, updated_at)
                VALUES (@id, @area, @epoch, @sealed, @now);
            """, connection))
        {
            save.Parameters.AddWithValue("@id", id);
            save.Parameters.AddWithValue("@area", areaId);
            save.Parameters.AddWithValue("@epoch", body.Epoch);
            save.Parameters.AddWithValue("@sealed", sealedBytes);
            save.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(id),
            design = await DesignAsync(connection, id, ctx.RequestAborted)
        });
    }
}
