using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Was am Bauplan einer Veranstaltung geaendert wird: umbenennen, umsortieren,
/// entfernen.
///
/// <b>Warum das bisher fehlte und warum es nicht klein ist.</b> Der Herausgeber
/// konnte nur ANLEGEN. Eine Seite, ein Teil, ein Feld — einmal da, fuer immer
/// da, und an der Stelle, an der sie entstanden. Wer sich vertippt hatte, baute
/// die Veranstaltung neu. Das sieht nach einer Luecke im Komfort aus und ist
/// eine im Vertrauen: wer nichts zuruecknehmen kann, traut sich nichts.
///
/// <b>Die Reihenfolge ist die ADRESSE.</b> <c>/event/recreatio/kal26/3</c> meint
/// den dritten Teil, nicht einen bestimmten. Umsortieren verschiebt also, wohin
/// ein verschickter Link fuehrt — und das steht in der Oberflaeche, nicht nur
/// hier. Es umzustellen, damit es „ordentlicher" aussieht, kostet die Links.
///
/// <b>Umsortiert wird in EINER Transaktion und mit vollstaendiger Liste.</b>
/// Nicht „schiebe dieses eine hoch": zwei Leute, die gleichzeitig schieben,
/// erzeugen sonst eine Reihenfolge, die keiner von beiden wollte. Die Liste
/// sagt, wie es NACHHER aussieht, und wer sie schickt, hat den Stand gesehen.
///
/// <b>Geloescht wird wirklich</b> — und die Kinder mit. Ein Teil, den man
/// „versteckt", ist bei der naechsten Auskunft nach personenbezogenen Daten
/// immer noch da, und jemand muss dann erklaeren, warum. `is_visible` gibt es
/// daneben und meint etwas anderes: noch nicht so weit.
/// </summary>
public static class RcEventEditing
{
    public static void MapRcEventEditing(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rc/events/{id:guid}/update", UpdateEventAsync)
            .Produces<RcEventUpdatedResponse>();

        app.MapPost("/rc/event-pages/{id:guid}/update", UpdatePageAsync)
            .Produces<RcEventPageUpdatedResponse>();
        app.MapPost("/rc/event-pages/{id:guid}/delete", DeletePageAsync)
            .Produces<RcEventDeletedResponse>();
        app.MapPost("/rc/events/{id:guid}/pages/reorder", ReorderPagesAsync)
            .Produces<RcEventReorderedResponse>();

        app.MapPost("/rc/event-parts/{id:guid}/delete", DeletePartAsync)
            .Produces<RcEventDeletedResponse>();
        app.MapPost("/rc/event-pages/{id:guid}/parts/reorder", ReorderPartsAsync)
            .Produces<RcEventReorderedResponse>();

        app.MapPost("/rc/event-fields/{id:guid}/update", UpdateFieldAsync)
            .Produces<RcEventFieldUpdatedResponse>();
        app.MapPost("/rc/event-fields/{id:guid}/delete", DeleteFieldAsync)
            .Produces<RcEventDeletedResponse>();
        app.MapPost("/rc/event-parts/{id:guid}/fields/reorder", ReorderFieldsAsync)
            .Produces<RcEventReorderedResponse>();
    }

    // -- Die Veranstaltung selbst ---------------------------------------------

    public sealed record UpdateEventRequest(
        string? Title, string? Summary, string? Category, string? Audience,
        string? PlacesJson, string? ThumbnailUrl, string? DateLabel,
        DateTimeOffset? StartsUtc, DateTimeOffset? EndsUtc, bool? IsPublic);

    /// <summary>
    /// Titel, Zeitraum und die Felder, nach denen der Katalog siebt.
    ///
    /// <b>Die Adresse steht nicht dabei.</b> Sie ist oeffentlich und bleibt:
    /// sie steht auf dem Plakat, in der Nachricht, an der Tuer. Sie hier
    /// nebenbei aenderbar zu machen hiesse, dass ein Tippfehler im Titel eine
    /// Gelegenheit wird, jeden dieser Verweise abzureissen.
    /// </summary>
    private static async Task UpdateEventAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, UpdateEventRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayWriteEventAsync(ctx, connection, permissions, session.AccountId, id)) return;

        var title = (body.Title ?? string.Empty).Trim();
        if (title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Titel fehlt oder ist zu lang.");
            return;
        }

        /*
         * Die Ortsliste ist JSON und kommt aus einem Feld. Kaputtes JSON hier
         * abzuweisen ist billiger, als es spaeter im Katalog zu bemerken — dort
         * faellt es als leerer Filter auf, und niemand weiss, warum.
         */
        var places = (body.PlacesJson ?? string.Empty).Trim();
        if (places.Length > 0 && !LooksLikeJsonArray(places))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Ortsliste ist keine Liste.");
            return;
        }

        await using var update = new SqlCommand("""
            UPDATE dbo.rc_event
               SET title = @title, summary = @summary, category = @category,
                   audience = @audience, places_json = @places,
                   thumbnail_url = @thumb, date_label = @dateLabel,
                   starts_at = @starts, ends_at = @ends,
                   is_public = @public
             WHERE id = @id;
            """, connection);

        update.Parameters.AddWithValue("@id", id);
        update.Parameters.AddWithValue("@title", title);
        Text(update, "@summary", body.Summary, 400);
        Text(update, "@category", body.Category, 80);
        Text(update, "@audience", body.Audience, 160);
        update.Parameters.Add("@places", System.Data.SqlDbType.NVarChar, -1).Value =
            places.Length == 0 ? DBNull.Value : places;
        Text(update, "@thumb", body.ThumbnailUrl, 600);
        Text(update, "@dateLabel", body.DateLabel, 120);
        update.Parameters.Add("@starts", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)body.StartsUtc ?? DBNull.Value;
        update.Parameters.Add("@ends", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)body.EndsUtc ?? DBNull.Value;
        update.Parameters.AddWithValue("@public", body.IsPublic ?? true);

        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventUpdatedResponse(RcId.ToText(id), true));
    }

    // -- Seiten ---------------------------------------------------------------

    public sealed record UpdatePageRequest(string? Title, string? MenuLabel, bool? IsVisible);

    private static async Task UpdatePageAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, UpdatePageRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await OwnerOfPageAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        var title = (body.Title ?? string.Empty).Trim();
        if (title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Titel fehlt oder ist zu lang.");
            return;
        }

        await using var update = new SqlCommand(
            "UPDATE dbo.rc_event_page SET title = @title, is_visible = @visible WHERE id = @id;",
            connection);

        update.Parameters.AddWithValue("@id", id);
        update.Parameters.AddWithValue("@title", title);
        update.Parameters.AddWithValue("@visible", body.IsVisible ?? true);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventPageUpdatedResponse(RcId.ToText(id), true));
    }

    /// <summary>
    /// Eine Seite entfernen — mit ihren Teilen, deren Feldern und allem, was an
    /// den Teilen haengt.
    ///
    /// <b>Warum nicht die Datenbank raeumen lassen.</b> Kaskadierendes Loeschen
    /// haette hier drei Wege durch dieselben Tabellen, und SQL Server weist
    /// mehrere Kaskadenpfade zurueck. Von Hand in der richtigen Reihenfolge ist
    /// laenger, aber es steht da, was verschwindet.
    ///
    /// <b>Anmeldungen halten die Seite fest.</b> Wer eine Seite mit
    /// eingegangenen Anmeldungen loescht, loescht die Anmeldungen — und das
    /// darf kein Nebeneffekt eines Aufraeumens sein. Deshalb weist der Dienst
    /// ab und nennt die Zahl; wer sie wirklich weghaben will, nimmt sie
    /// einzeln zurueck, und das ist dann eine Entscheidung.
    /// </summary>
    private static async Task DeletePageAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await OwnerOfPageAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        var held = await CountAsync(connection, """
            SELECT COUNT(*) FROM dbo.rc_event_registration r
            JOIN dbo.rc_event_part p ON p.id = r.part_id
            WHERE p.page_id = @id;
            """, id, ctx.RequestAborted);

        if (held > 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                $"An dieser Seite haengen {held} Anmeldungen. Sie muessen zuerst zurueckgenommen werden.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await DeletePartsOfPageAsync(connection, tx, id, ctx.RequestAborted);

            await using (var cmd = new SqlCommand(
                "DELETE FROM dbo.rc_event_page WHERE id = @id;", connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx, new RcEventDeletedResponse(RcId.ToText(id), true));
    }

    private static async Task ReorderPagesAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, RcReorderRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayWriteEventAsync(ctx, connection, permissions, session.AccountId, id)) return;

        await ReorderAsync(ctx, connection, "dbo.rc_event_page", "event_id", id, body);
    }

    // -- Teile ----------------------------------------------------------------

    private static async Task DeletePartAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        var held = await CountAsync(connection,
            "SELECT COUNT(*) FROM dbo.rc_event_registration WHERE part_id = @id;",
            id, ctx.RequestAborted);

        if (held > 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                $"An diesem Teil haengen {held} Anmeldungen. Sie muessen zuerst zurueckgenommen werden.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await DeleteOnePartAsync(connection, tx, id, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx, new RcEventDeletedResponse(RcId.ToText(id), true));
    }

    private static async Task ReorderPartsAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, RcReorderRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await OwnerOfPageAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        await ReorderAsync(ctx, connection, "dbo.rc_event_part", "page_id", id, body);
    }

    // -- Felder ---------------------------------------------------------------

    public sealed record UpdateFieldRequest(
        string? Label, string? HelpText, bool? IsRequired, bool? IsHalfWidth, string? OptionsJson);

    private static async Task UpdateFieldAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, UpdateFieldRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await OwnerOfFieldAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        var label = (body.Label ?? string.Empty).Trim();
        if (label.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Beschriftung fehlt oder ist zu lang.");
            return;
        }

        /*
         * 3.13 — JEDES FELD TRAEGT SEINE EIGENE BESCHRIFTUNG.
         *
         * Die Datenklasse steht NICHT hier: sie wird beim Anlegen entschieden
         * und bleibt. Sie nachtraeglich zu senken hiesse, schon eingegangene
         * Antworten rueckwirkend fuer weniger schutzbeduerftig zu erklaeren —
         * die Antworten aendern sich davon nicht.
         */
        await using var update = new SqlCommand("""
            UPDATE dbo.rc_event_part_field
               SET label = @label, help_text = @help,
                   is_required = @required, is_half_width = @half,
                   options_json = @options
             WHERE id = @id;
            """, connection);

        update.Parameters.AddWithValue("@id", id);
        update.Parameters.AddWithValue("@label", label);
        Text(update, "@help", body.HelpText, 400);
        update.Parameters.AddWithValue("@required", body.IsRequired ?? false);
        update.Parameters.AddWithValue("@half", body.IsHalfWidth ?? false);

        var options = (body.OptionsJson ?? string.Empty).Trim();
        update.Parameters.Add("@options", System.Data.SqlDbType.NVarChar, -1).Value =
            options.Length == 0 ? DBNull.Value : options;

        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventFieldUpdatedResponse(RcId.ToText(id), true));
    }

    /// <summary>
    /// Ein Feld entfernen.
    ///
    /// <b>Eingegangene Antworten halten es fest.</b> Ein Feld zu loeschen, auf
    /// das schon jemand geantwortet hat, laesst eine Antwort ohne Frage zurueck:
    /// versiegelter Text, zu dem niemand mehr sagen kann, wonach gefragt wurde.
    /// Das ist keine Datenhaltung, das ist ein Raetsel.
    /// </summary>
    private static async Task DeleteFieldAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await OwnerOfFieldAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        var answered = await CountAsync(connection,
            "SELECT COUNT(*) FROM dbo.rc_event_registration_value WHERE field_id = @id;",
            id, ctx.RequestAborted);

        if (answered > 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                $"Auf dieses Feld haben {answered} Leute geantwortet. Die Antworten blieben ohne Frage zurueck.");
            return;
        }

        await using (var cmd = new SqlCommand(
            "DELETE FROM dbo.rc_event_part_field WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventDeletedResponse(RcId.ToText(id), true));
    }

    private static async Task ReorderFieldsAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, RcReorderRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        await ReorderAsync(ctx, connection, "dbo.rc_event_part_field", "part_id", id, body);
    }

    // -- Gemeinsames ----------------------------------------------------------

    internal readonly record struct Owner(Guid AreaId, Guid EventId);

    internal static async Task<Owner?> OwnerOfPageAsync(
        SqlConnection connection, Guid pageId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT e.area_id, e.id FROM dbo.rc_event_page g
            JOIN dbo.rc_event e ON e.id = g.event_id
            WHERE g.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", pageId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new Owner(reader.GetGuid(0), reader.GetGuid(1))
            : null;
    }

    internal static async Task<Owner?> OwnerOfPartAsync(
        SqlConnection connection, Guid partId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT e.area_id, e.id FROM dbo.rc_event_part p
            JOIN dbo.rc_event_page g ON g.id = p.page_id
            JOIN dbo.rc_event e      ON e.id = g.event_id
            WHERE p.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", partId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new Owner(reader.GetGuid(0), reader.GetGuid(1))
            : null;
    }

    private static async Task<Owner?> OwnerOfFieldAsync(
        SqlConnection connection, Guid fieldId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT e.area_id, e.id FROM dbo.rc_event_part_field f
            JOIN dbo.rc_event_part p ON p.id = f.part_id
            JOIN dbo.rc_event_page g ON g.id = p.page_id
            JOIN dbo.rc_event e      ON e.id = g.event_id
            WHERE f.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", fieldId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new Owner(reader.GetGuid(0), reader.GetGuid(1))
            : null;
    }

    internal static async Task<bool> MayWriteAreaAsync(
        HttpContext ctx, RcPermissions permissions, Guid accountId, Guid areaId)
    {
        var may = await permissions.CheckAsync(accountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);

        if (may.Allowed) return true;

        await RcAreas.NotForYou(ctx);
        return false;
    }

    private static async Task<bool> MayWriteEventAsync(
        HttpContext ctx, SqlConnection connection, RcPermissions permissions,
        Guid accountId, Guid eventId)
    {
        await using var cmd = new SqlCommand(
            "SELECT area_id FROM dbo.rc_event WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", eventId);

        if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid areaId)
        {
            await RcAreas.NotForYou(ctx);
            return false;
        }

        return await MayWriteAreaAsync(ctx, permissions, accountId, areaId);
    }

    /// <summary>
    /// Die Reihenfolge neu setzen — vollstaendig, in EINER Transaktion.
    ///
    /// Die Liste bestimmt die neue Reihenfolge; jede Kennung, die nicht zum
    /// genannten Elternteil gehoert, wird stillschweigend uebergangen. Sie
    /// abzuweisen brachte nichts: der Aufrufer haette die Liste ohnehin frisch
    /// gelesen, und ein Fehler mitten in einer halb geschriebenen Reihenfolge
    /// waere schlimmer als ein uebergangener Eintrag.
    /// </summary>
    private static async Task ReorderAsync(
        HttpContext ctx, SqlConnection connection,
        string table, string parentColumn, Guid parentId, RcReorderRequest body)
    {
        var ids = new List<Guid>();
        foreach (var text in body.Ids ?? [])
        {
            if (Guid.TryParse(text, out var one) && !ids.Contains(one)) ids.Add(one);
        }

        if (ids.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Reihenfolge ist leer.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            for (var i = 0; i < ids.Count; i++)
            {
                await using var cmd = new SqlCommand(
                    $"UPDATE {table} SET sort_order = @order WHERE id = @id AND {parentColumn} = @parent;",
                    connection, tx);

                cmd.Parameters.AddWithValue("@order", i);
                cmd.Parameters.AddWithValue("@id", ids[i]);
                cmd.Parameters.AddWithValue("@parent", parentId);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { await tx.RollbackAsync(ctx.RequestAborted); throw; }

        await RcResults.WriteJsonAsync(ctx, new RcEventReorderedResponse(ids.Count));
    }

    /// <summary>Alle Teile einer Seite, samt allem, was an ihnen haengt.</summary>
    private static async Task DeletePartsOfPageAsync(
        SqlConnection connection, SqlTransaction tx, Guid pageId, CancellationToken ct)
    {
        var parts = new List<Guid>();
        await using (var cmd = new SqlCommand(
            "SELECT id FROM dbo.rc_event_part WHERE page_id = @id;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", pageId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) parts.Add(reader.GetGuid(0));
        }

        foreach (var part in parts) await DeleteOnePartAsync(connection, tx, part, ct);
    }

    /// <summary>
    /// Ein Teil mit allem daran — in der Reihenfolge, in der die
    /// Fremdschluessel es zulassen: erst die Kinder, dann er selbst.
    ///
    /// Die Bilder verlieren hier nur ihre Zeile; die DATEI bleibt auf der Platte
    /// und wird von <see cref="RcEventMedia"/> geraeumt. Sie hier zu loeschen
    /// hiesse, in einer Transaktion etwas anzufassen, das kein Zurueck kennt:
    /// bricht sie ab, sind die Zeilen wieder da und die Dateien fort.
    /// </summary>
    private static async Task DeleteOnePartAsync(
        SqlConnection connection, SqlTransaction tx, Guid partId, CancellationToken ct)
    {
        string[] steps =
        [
            "DELETE FROM dbo.rc_event_topic_message WHERE topic_id IN (SELECT id FROM dbo.rc_event_topic WHERE part_id = @id);",
            "DELETE FROM dbo.rc_event_topic WHERE part_id = @id;",
            "DELETE FROM dbo.rc_event_progress WHERE part_id = @id;",
            "DELETE FROM dbo.rc_event_card WHERE part_id = @id;",
            "DELETE FROM dbo.rc_event_roster WHERE part_id = @id;",
            "DELETE FROM dbo.rc_event_photo WHERE part_id = @id;",
            "DELETE FROM dbo.rc_event_part_field WHERE part_id = @id;",
            "DELETE FROM dbo.rc_event_part WHERE id = @id;"
        ];

        foreach (var sql in steps)
        {
            await using var cmd = new SqlCommand(sql, connection, tx);
            cmd.Parameters.AddWithValue("@id", partId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    private static async Task<int> CountAsync(
        SqlConnection connection, string sql, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(ct) is int n ? n : 0;
    }

    private static void Text(SqlCommand cmd, string name, string? value, int max)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length > max) trimmed = trimmed[..max];

        cmd.Parameters.Add(name, System.Data.SqlDbType.NVarChar, max).Value =
            trimmed.Length == 0 ? DBNull.Value : trimmed;
    }

    /*
     * Kein ISJSON: die Datenbank steht auf einer Vertraeglichkeitsstufe unter
     * 130, und dort gibt es die Funktion nicht. Die Pruefung ist grob und soll
     * es sein — sie faengt „Krakau, Wadowice" ab, nicht jede Feinheit.
     */
    private static bool LooksLikeJsonArray(string text) =>
        text.StartsWith('[') && text.EndsWith(']');
}
