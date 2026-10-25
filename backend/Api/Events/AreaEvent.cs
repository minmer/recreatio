using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0131 — EIN BEREICH ALS WYDARZENIE.
///
/// <para>
/// Die Marke zeigt auf Hauptseite und Haupttermin und hält sonst nichts: Titel, Vorspann und
/// Bild stehen auf der Seite, Datum, Ort und Programm im Termin, Menschen, Formulare und
/// Rozmowy im Bereich, wer für die Daten geradesteht in dessen Datensatz. Listen zeigen
/// Wydarzenia nach einer Regel („die Wydarzenia dieser Bereiche und darunter") und auf
/// Bitte (<c>event_listing</c>); den Katalog <c>recreatio.pl/events</c> gibt der Betreiber
/// frei, Karte für Karte, und eine Änderung an der Karte nimmt die Freigabe zurück.
/// </para>
///
/// <para>
/// Hinaus gehen nur öffentliche Wydarzenia: die Hauptseite an keinen Bereich gebunden und
/// nicht versiegelt, der Termin für jeden sichtbar, nichts davon nach einer Meldung gesperrt.
/// </para>
/// </summary>
public static class AreaEvent
{
    /// <summary>Die Adresse des Katalogs — die eigene Veröffentlichung des Betreibers.</summary>
    internal const string CataloguePath = "events";

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/area/{id:guid}/event", GetAsync);
        app.MapPost("/workspace/area/{id:guid}/event", SetAsync);
        app.MapGet("/workspace/event/{id:guid}/listings", ListingsAsync);
        app.MapPost("/workspace/event/{id:guid}/listing", AskAsync);
        app.MapPost("/workspace/listing/{areaId:guid}/{moduleId:guid}", DecideAsync);

        app.MapGet("/events", ListAsync);
        app.MapGet("/event/{id:guid}", OneAsync);
    }

    /* -- Die Marke ------------------------------------------------------------------ */

    private sealed record Mark(Guid Area, Guid? Slug, string? Path, Guid? Item, string? Kind, Guid? Image, DateTimeOffset Created);

    private static async Task<Mark?> MarkAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT e.area_id, e.slug_id, s.path, e.item_id, e.kind, p.image_id, e.created_at
            FROM app.area_event e
            LEFT JOIN app.slug s ON s.id = e.slug_id
            LEFT JOIN app.slug_page p ON p.slug_id = e.slug_id
            WHERE e.area_id = @area;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new Mark(reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetGuid(3), reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetGuid(5), reader.GetDateTimeOffset(6));
    }

    private static object? MarkJson(Mark? m) => m is null ? null : new
    {
        areaId = Ids.ToText(m.Area),
        slugId = m.Slug is null ? null : Ids.ToText(m.Slug.Value),
        path = m.Path,
        itemId = m.Item is null ? null : Ids.ToText(m.Item.Value),
        kind = m.Kind,
        imageId = m.Image is null ? null : Ids.ToText(m.Image.Value),
        createdAt = m.Created
    };

    private static async Task GetAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }
        var mark = await MarkAsync(connection, id, ctx.RequestAborted);
        var controller = await Controllers.OfAreaAsync(connection, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            mark = MarkJson(mark),
            /* Was noch fehlt, damit Zapisy ruszą: wer geradesteht, ob der Bereich jawny ist. */
            controller = Controllers.Json(controller),
            @public = await PublicAreaAsync(connection, id, ctx.RequestAborted)
        });
    }

    public sealed record SetRequest(string? Path, string? ItemId, string? Kind, string? ImageId, bool? Off);

    /// <summary>
    /// Einen Bereich als Wydarzenie markieren (oder die Marke abnehmen). Wer ihn führt, und —
    /// für die Hauptseite — wer die Seite führt. Der Haupttermin liegt in einem Kalender des
    /// Bereichs und wiederholt sich nicht.
    /// </summary>
    private static async Task SetAsync(HttpContext ctx, Db db, Guid id, SetRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var admins = await Controllers.AdminRolesAsync(connection, mine, id, ctx.RequestAborted);
        if (admins.Count == 0) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma."); return; }

        if (body.Off == true)
        {
            await using var off = new SqlCommand("DELETE FROM app.area_event WHERE area_id = @area;", connection);
            off.Parameters.AddWithValue("@area", id);
            await off.ExecuteNonQueryAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), mark = (object?)null });
            return;
        }

        Guid? slug = null;
        if (!string.IsNullOrWhiteSpace(body.Path))
        {
            var path = Slug.Normalise(body.Path);
            await using (var cmd = new SqlCommand("SELECT id FROM app.slug WHERE path = @path AND alias_of IS NULL;", connection))
            {
                cmd.Parameters.AddWithValue("@path", path);
                slug = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
            }
            if (slug is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej strony nie ma."); return; }
            if (!(await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted)).MayWrite)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Stroną wydarzenia może być tylko strona, którą prowadzisz.");
                return;
            }
        }

        Guid? item = null;
        if (!string.IsNullOrWhiteSpace(body.ItemId))
        {
            if (!Guid.TryParse(body.ItemId, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin."); return; }
            await using var cmd = new SqlCommand("""
                SELECT i.repeat_kind FROM app.calendar_item i JOIN app.calendar c ON c.id = i.calendar_id
                WHERE i.id = @item AND c.area_id = @area;
                """, connection);
            cmd.Parameters.AddWithValue("@item", parsed);
            cmd.Parameters.AddWithValue("@area", id);
            var repeat = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as string;
            if (repeat is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Ten termin nie leży w kalendarzu tego obszaru."); return; }
            if (repeat != "none") { await Fail(ctx, StatusCodes.Status409Conflict, "Głównym terminem wydarzenia jest jeden termin, bez powtórzeń."); return; }
            item = parsed;
        }

        var kind = (body.Kind ?? "").Trim();
        if (kind.Length > 40) { await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: najwyżej 40 znaków."); return; }

        Guid? image = null;
        if (!string.IsNullOrWhiteSpace(body.ImageId))
        {
            if (slug is null || !Guid.TryParse(body.ImageId, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Zdjęcie wybiera się spośród plików strony wydarzenia."); return; }
            await using var cmd = new SqlCommand("SELECT 1 FROM app.page_image WHERE id = @id AND slug_id = @slug;", connection);
            cmd.Parameters.AddWithValue("@id", parsed);
            cmd.Parameters.AddWithValue("@slug", slug.Value);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Tego pliku nie ma na stronie wydarzenia."); return; }
            image = parsed;
        }

        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            await using (var cmd = new SqlCommand("""
                UPDATE app.area_event SET slug_id = @slug, item_id = @item, kind = @kind WHERE area_id = @area;
                IF @@ROWCOUNT = 0
                    INSERT INTO app.area_event (area_id, slug_id, item_id, kind, created_at, created_by_role_id)
                    VALUES (@area, @slug, @item, @kind, @now, @role);
                UPDATE app.slug_page SET image_id = @image WHERE slug_id = @slug AND @slug IS NOT NULL AND (@image IS NOT NULL OR @clear = 1);
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@area", id);
                cmd.Parameters.AddWithValue("@slug", slug is null ? DBNull.Value : slug.Value);
                cmd.Parameters.AddWithValue("@item", item is null ? DBNull.Value : item.Value);
                cmd.Parameters.AddWithValue("@kind", kind.Length == 0 ? DBNull.Value : kind);
                cmd.Parameters.AddWithValue("@image", image is null ? DBNull.Value : image.Value);
                cmd.Parameters.AddWithValue("@clear", body.ImageId == "" ? 1 : 0);
                cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                cmd.Parameters.AddWithValue("@role", admins[0].RoleId);
                try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
                catch (SqlException e) when (e.Number is 2601 or 2627)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "Ta strona jest już stroną innego wydarzenia.");
                    return;
                }
            }
            await tx.CommitAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), mark = MarkJson(await MarkAsync(connection, id, ctx.RequestAborted)) });
    }

    /* -- Karten ----------------------------------------------------------------------- */

    private static async Task<bool> PublicAreaAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM app.area a WHERE a.id = @area AND a.public_level <> N'none'
                AND EXISTS (SELECT 1 FROM app.area_epoch e WHERE e.area_id = a.id AND e.key_public IS NOT NULL)) THEN 1 ELSE 0 END;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        return (int)(await cmd.ExecuteScalarAsync(ct))! == 1;
    }

    /// <summary>
    /// Die Wydarzenia, wie eine Karte sie zeigt — nur mit öffentlicher, unversiegelter, ungesperrter Hauptseite.
    /// Der Haupttermin steht nur darauf, wenn er für jeden sichtbar und nicht gesperrt ist; sonst zeigt die Karte
    /// die Seite ohne Datum (ein Datum eines nicht öffentlichen Termins ginge sonst hinaus).
    /// </summary>
    private const string CardsSql = """
        SELECT e.area_id, e.kind, a.name, s.path, p.title, p.lead, p.image_id, p.updated_at,
               i.id, i.starts_at, i.ends_at, i.all_day, i.status, i.updated_at,
               (SELECT TOP 1 pa.name FROM app.area pa WHERE pa.id = a.parent_area_id) AS organiser
        FROM app.area_event e
        JOIN app.area a ON a.id = e.area_id
        JOIN app.slug s ON s.id = e.slug_id
        JOIN app.slug_page p ON p.slug_id = s.id
        LEFT JOIN app.calendar_item i ON i.id = e.item_id
             AND EXISTS (SELECT 1 FROM app.area va WHERE va.id = i.visibility_area_id AND va.public_level <> N'none'
                          AND EXISTS (SELECT 1 FROM app.area_epoch ve WHERE ve.area_id = va.id AND ve.key_public IS NOT NULL))
             AND NOT EXISTS (SELECT 1 FROM app.takedown ti WHERE ti.item_kind = N'item' AND ti.item_id = i.id AND ti.item_at IS NULL)
        WHERE NOT EXISTS (SELECT 1 FROM app.slug_area sa WHERE sa.slug_id = s.id)
          AND s.page_seal IS NULL
          AND NOT EXISTS (SELECT 1 FROM app.takedown t WHERE t.item_at IS NULL
                           AND ((t.item_kind = N'page' AND t.item_id = s.id) OR (t.item_kind = N'event' AND t.item_id = e.area_id)))
        """;

    private sealed record Card(
        Guid Area, string? Kind, string AreaName, string Path, string? Title, string? Lead, Guid? Image, DateTimeOffset? PageAt,
        Guid? Item, DateTimeOffset? Starts, DateTimeOffset? Ends, bool AllDay, string? Status, DateTimeOffset? ItemAt, string? Organiser);

    private static Card ReadCard(SqlDataReader r) => new(
        r.GetGuid(0), r.IsDBNull(1) ? null : r.GetString(1), r.GetString(2), r.GetString(3),
        r.IsDBNull(4) ? null : r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5), r.IsDBNull(6) ? null : r.GetGuid(6),
        r.IsDBNull(7) ? null : r.GetDateTimeOffset(7),
        r.IsDBNull(8) ? null : r.GetGuid(8), r.IsDBNull(9) ? null : r.GetDateTimeOffset(9), r.IsDBNull(10) ? null : r.GetDateTimeOffset(10),
        !r.IsDBNull(11) && r.GetBoolean(11), r.IsDBNull(12) ? null : r.GetString(12), r.IsDBNull(13) ? null : r.GetDateTimeOffset(13),
        r.IsDBNull(14) ? null : r.GetString(14));

    /// <summary>Die versiegelten Felder (Titel, Ort) der Haupttermine — geöffnet wird mit veröffentlichten Schlüsseln, im Browser.</summary>
    private static async Task<Dictionary<Guid, List<object>>> FieldsAsync(SqlConnection connection, IEnumerable<Guid> items, CancellationToken ct)
    {
        var map = new Dictionary<Guid, List<object>>();
        var list = items.Distinct().ToList();
        if (list.Count == 0) return map;
        var names = string.Join(", ", list.Select((_, i) => $"@i{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT item_id, field, area_id, epoch, sealed_blob FROM app.calendar_field
            WHERE item_id IN ({names}) AND field IN (N'title', N'location');
            """, connection);
        for (var i = 0; i < list.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", list[i]);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var item = reader.GetGuid(0);
            if (!map.TryGetValue(item, out var fields)) map[item] = fields = [];
            fields.Add(new { field = reader.GetString(1), areaId = Ids.ToText(reader.GetGuid(2)), epoch = reader.GetInt32(3), @sealed = Base64Url.Encode((byte[])reader[4]) });
        }
        return map;
    }

    /// <summary>
    /// „Zapisy otwarte" — nur, wenn ein Formular des Wydarzenia wirklich annimmt: offen, für
    /// alle, mit Fragen, auf einer öffentlichen Seite, ungesperrt, in einem jawnen Bereich, und
    /// jemand steht für die Daten gerade.
    /// </summary>
    private static async Task<List<Guid>> OpenFormsAsync(SqlConnection connection, Guid area, CancellationToken ct)
    {
        var forms = new List<Guid>();
        if (!await PublicAreaAsync(connection, area, ct)) return forms;
        if (await Controllers.OfAreaAsync(connection, area, ct) is null) return forms;
        await using var cmd = new SqlCommand("""
            SELECT m.id FROM app.module m
            WHERE m.area_id = @area AND m.kind = N'form' AND m.closed_at IS NULL AND m.audience = N'public'
              AND EXISTS (SELECT 1 FROM app.slug_field f WHERE f.part_id = m.id AND f.removed_at IS NULL)
              AND EXISTS (SELECT 1 FROM app.slug_part sp JOIN app.slug s ON s.id = sp.slug_id
                          WHERE sp.module_id = m.id AND s.page_seal IS NULL
                            AND NOT EXISTS (SELECT 1 FROM app.slug_area sa WHERE sa.slug_id = s.id))
              AND NOT EXISTS (SELECT 1 FROM app.takedown t WHERE t.item_kind = N'form' AND t.item_id = m.id)
            ORDER BY m.created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@area", area);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) forms.Add(reader.GetGuid(0));
        return forms;
    }

    private static object CardJson(Card c, List<object>? fields, bool open, string via) => new
    {
        areaId = Ids.ToText(c.Area),
        kind = c.Kind,
        name = c.AreaName,
        organiser = c.Organiser,
        page = new { path = c.Path, title = c.Title, lead = c.Lead, imageId = c.Image is null ? null : Ids.ToText(c.Image.Value) },
        item = c.Item is null ? null : new
        {
            id = Ids.ToText(c.Item.Value), startsAt = c.Starts, endsAt = c.Ends, allDay = c.AllDay, status = c.Status,
            fields = fields ?? []
        },
        open,
        via
    };

    /// <summary>
    /// Der Fingerabdruck einer Karte: was der Betreiber gesehen hat, als er sie freigab. Ändert
    /// sich etwas davon, ist die Freigabe dahin.
    /// </summary>
    private static async Task<byte[]> PrintAsync(SqlConnection connection, Card c, CancellationToken ct, SqlTransaction? tx = null)
    {
        var text = new StringBuilder();
        text.Append(c.AreaName).Append('\n').Append(c.Organiser).Append('\n').Append(c.Path).Append('\n')
            .Append(c.Title).Append('\n').Append(c.Lead).Append('\n').Append(c.Image).Append('\n')
            .Append(c.Starts?.ToUnixTimeSeconds()).Append('\n').Append(c.Ends?.ToUnixTimeSeconds()).Append('\n').Append(c.Status).Append('\n');
        if (c.Item is not null)
        {
            await using var cmd = new SqlCommand(
                "SELECT field, epoch, sealed_blob FROM app.calendar_field WHERE item_id = @item AND field IN (N'title', N'location') ORDER BY field;",
                connection, tx);
            cmd.Parameters.AddWithValue("@item", c.Item.Value);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                text.Append(reader.GetString(0)).Append(':').Append(reader.GetInt32(1)).Append(':').Append(Convert.ToHexString((byte[])reader[2])).Append('\n');
        }
        return SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString()));
    }

    private static async Task<bool> IsCatalogueAsync(SqlConnection connection, Guid module, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand("""
            SELECT TOP 1 1 FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id
            WHERE p.module_id = @module AND (s.path = @catalogue OR s.path LIKE @below);
            """, connection, tx);
        cmd.Parameters.AddWithValue("@module", module);
        cmd.Parameters.AddWithValue("@catalogue", CataloguePath);
        cmd.Parameters.AddWithValue("@below", CataloguePath + "/%");
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>
    /// Die Liste: Wydarzenia dieser Bereiche (und darunter), dazu die, die in dieser Liste
    /// stehen dürfen (<c>module</c>) — im Katalog nur freigegebene Karten in dem Stand, den der
    /// Betreiber gesehen hat. Ohne Konto.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var q = ctx.Request.Query;
        var sources = q["areas"].ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => Guid.TryParse(s, out var g) ? g : (Guid?)null).Where(g => g is not null).Select(g => g!.Value).Distinct().Take(20).ToList();
        var deep = q["deep"].ToString() != "0";
        var kind = q["kind"].ToString().Trim();
        var when = q["when"].ToString() is "past" or "all" ? q["when"].ToString() : "coming";
        var limit = int.TryParse(q["limit"].ToString(), out var l) ? Math.Clamp(l, 1, 200) : 50;
        Guid? module = Guid.TryParse(q["module"].ToString(), out var m) ? m : null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var catalogue = module is not null && await IsCatalogueAsync(connection, module.Value, ctx.RequestAborted);

        var cards = new List<(Card Card, string Via, byte[]? Print)>();

        if (sources.Count > 0 && !catalogue)
        {
            var names = string.Join(", ", sources.Select((_, i) => $"@s{i}"));
            var tree = deep ? $"""
                WITH tree AS (
                    SELECT a.id, 0 AS depth FROM app.area a WHERE a.id IN ({names})
                    UNION ALL
                    SELECT c.id, t.depth + 1 FROM app.area c JOIN tree t ON c.parent_area_id = t.id WHERE t.depth < 32
                )
                """ : $"WITH tree AS (SELECT a.id, 0 AS depth FROM app.area a WHERE a.id IN ({names}))";
            await using var cmd = new SqlCommand($"""
                {tree}
                {CardsSql}
                  AND e.area_id IN (SELECT id FROM tree)
                OPTION (MAXRECURSION 40);
                """, connection);
            for (var i = 0; i < sources.Count; i++) cmd.Parameters.AddWithValue($"@s{i}", sources[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) cards.Add((ReadCard(reader), "rule", null));
        }

        if (module is not null)
        {
            await using var cmd = new SqlCommand($"""
                {CardsSql}
                  AND EXISTS (SELECT 1 FROM app.event_listing x WHERE x.area_id = e.area_id AND x.module_id = @module AND x.state = N'shown');
                SELECT area_id, approved_print FROM app.event_listing WHERE module_id = @module AND state = N'shown';
                """, connection);
            cmd.Parameters.AddWithValue("@module", module.Value);
            var listed = new List<Card>();
            var prints = new Dictionary<Guid, byte[]?>();
            await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
            {
                while (await reader.ReadAsync(ctx.RequestAborted)) listed.Add(ReadCard(reader));
                await reader.NextResultAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) prints[reader.GetGuid(0)] = reader.IsDBNull(1) ? null : (byte[])reader[1];
            }
            foreach (var card in listed)
            {
                if (cards.Any(c => c.Card.Area == card.Area)) continue;
                if (catalogue)
                {
                    /* Der Katalog: nur in dem Stand, den der Betreiber freigegeben hat. */
                    var approved = prints.GetValueOrDefault(card.Area);
                    var current = await PrintAsync(connection, card, ctx.RequestAborted);
                    if (approved is null || !approved.SequenceEqual(current)) continue;
                }
                cards.Add((card, "request", null));
            }
        }

        var now = DateTimeOffset.UtcNow;
        var chosen = cards
            .Where(c => kind.Length == 0 || string.Equals(c.Card.Kind, kind, StringComparison.OrdinalIgnoreCase))
            .Where(c => when switch
            {
                "past" => c.Card.Ends is { } e && e < now,
                "coming" => c.Card.Ends is null ? c.Card.Starts is null : c.Card.Ends.Value >= now,
                _ => true
            })
            .OrderBy(c => when == "past" ? -(c.Card.Starts?.ToUnixTimeSeconds() ?? 0) : c.Card.Starts?.ToUnixTimeSeconds() ?? long.MaxValue)
            .Take(limit)
            .ToList();

        var fields = await FieldsAsync(connection, chosen.Where(c => c.Card.Item is not null).Select(c => c.Card.Item!.Value), ctx.RequestAborted);
        var output = new List<object>();
        foreach (var (card, via, _) in chosen)
            output.Add(CardJson(card, card.Item is null ? null : fields.GetValueOrDefault(card.Item.Value),
                (await OpenFormsAsync(connection, card.Area, ctx.RequestAborted)).Count > 0, via));

        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new { events = output, catalogue });
    }

    /// <summary>Ein Wydarzenie — für den Baustein „Wydarzenie" (auch auf der Seite eines anderen): die Karte und seine offenen Formulare.</summary>
    private static async Task OneAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        Card? card = null;
        await using (var cmd = new SqlCommand($"{CardsSql} AND e.area_id = @area;", connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) card = ReadCard(reader);
        }
        if (card is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wydarzenia nie ma albo nie jest publiczne."); return; }

        var fields = card.Item is null ? null : (await FieldsAsync(connection, [card.Item.Value], ctx.RequestAborted)).GetValueOrDefault(card.Item.Value);
        var forms = await OpenFormsAsync(connection, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new
        {
            @event = CardJson(card, fields, forms.Count > 0, "rule"),
            forms = forms.Select(Ids.ToText).ToList(),
            controller = Controllers.Json(await Controllers.OfAreaAsync(connection, id, ctx.RequestAborted))
        });
    }

    /* -- In fremden Listen ---------------------------------------------------------- */

    private static async Task<bool> TendsAsync(SqlConnection connection, Guid account, Guid module, CancellationToken ct, SqlTransaction? tx = null)
    {
        Guid? area;
        await using (var cmd = new SqlCommand("SELECT area_id FROM app.module WHERE id = @id;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", module);
            area = await cmd.ExecuteScalarAsync(ct) as Guid?;
        }
        if (area is not null) return await Area.MayAsync(connection, account, area.Value, Capability.Write, ct);

        var mine = await Workspace.RolesOfAsync(connection, account, ct);
        if (mine.Count == 0) return false;
        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var check = new SqlCommand($"""
            SELECT TOP 1 1 FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id
            WHERE p.module_id = @id AND s.claimed_by_role_id IN ({names});
            """, connection, tx);
        check.Parameters.AddWithValue("@id", module);
        for (var i = 0; i < mine.Count; i++) check.Parameters.AddWithValue($"@r{i}", mine[i].Id);
        return await check.ExecuteScalarAsync(ct) is not null;
    }

    private static async Task ListingsAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }
        var list = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT x.module_id, x.state, x.asked_at, x.decided_at,
                   (SELECT TOP 1 s.path FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id WHERE p.module_id = x.module_id ORDER BY s.path)
            FROM app.event_listing x WHERE x.area_id = @area ORDER BY x.asked_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                list.Add(new
                {
                    moduleId = Ids.ToText(reader.GetGuid(0)), state = reader.GetString(1), askedAt = reader.GetDateTimeOffset(2),
                    decidedAt = reader.IsDBNull(3) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(3),
                    path = reader.IsDBNull(4) ? null : reader.GetString(4)
                });
        }
        await ctx.Response.WriteAsJsonAsync(new { listings = list });
    }

    public sealed record AskRequest(string? ModuleId, string? Path);

    /// <summary>
    /// „Pokaż też na…": das Wydarzenie bittet, in einer Liste zu stehen (genannt durch ihren
    /// Baustein oder die Adresse ihrer Seite). Wer die Liste selbst pflegt, nimmt gleich an —
    /// ausser im Katalog, dort entscheidet immer der Betreiber.
    /// </summary>
    private static async Task AskAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, AskRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var admins = await Controllers.AdminRolesAsync(connection, mine, id, ctx.RequestAborted);
        if (admins.Count == 0 || await MarkAsync(connection, id, ctx.RequestAborted) is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "To nie jest wydarzenie, które prowadzisz.");
            return;
        }

        Guid? module = Guid.TryParse(body.ModuleId, out var m) ? m : null;
        if (module is null && !string.IsNullOrWhiteSpace(body.Path))
        {
            await using var cmd = new SqlCommand("""
                SELECT TOP 1 p.module_id FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id
                LEFT JOIN app.module mm ON mm.id = p.module_id
                WHERE s.path = @path AND COALESCE(mm.kind, p.kind) = N'events' AND p.module_id IS NOT NULL ORDER BY p.position;
                """, connection);
            cmd.Parameters.AddWithValue("@path", Slug.Normalise(body.Path));
            module = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
        }
        if (module is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Na tej stronie nie ma listy wydarzeń."); return; }

        await using (var check = new SqlCommand("SELECT kind FROM app.module WHERE id = @id;", connection))
        {
            check.Parameters.AddWithValue("@id", module.Value);
            if (await check.ExecuteScalarAsync(ctx.RequestAborted) as string != "events")
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "To nie jest lista wydarzeń.");
                return;
            }
        }

        var catalogue = await IsCatalogueAsync(connection, module.Value, ctx.RequestAborted);
        var direct = !catalogue && await TendsAsync(connection, who.Value.AccountId, module.Value, ctx.RequestAborted);

        await using (var cmd = new SqlCommand("""
            IF EXISTS (SELECT 1 FROM app.event_listing WHERE area_id = @area AND module_id = @module)
                UPDATE app.event_listing SET state = @state, asked_by_role_id = @role, asked_at = @now,
                       decided_by_role_id = @decider, decided_at = @decidedAt, approved_print = NULL
                 WHERE area_id = @area AND module_id = @module;
            ELSE
                INSERT INTO app.event_listing (area_id, module_id, state, asked_by_role_id, asked_at, decided_by_role_id, decided_at)
                VALUES (@area, @module, @state, @role, @now, @decider, @decidedAt);
            """, connection))
        {
            var now = DateTimeOffset.UtcNow;
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@module", module.Value);
            cmd.Parameters.AddWithValue("@state", direct ? "shown" : "asked");
            cmd.Parameters.AddWithValue("@role", admins[0].RoleId);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@decider", direct ? admins[0].RoleId : DBNull.Value);
            cmd.Parameters.AddWithValue("@decidedAt", direct ? now : DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), moduleId = Ids.ToText(module.Value), state = direct ? "shown" : "asked", catalogue });
    }

    public sealed record DecideRequest(bool Accept, bool NoPersonalData);

    /// <summary>
    /// Über eine Bitte entscheidet, wer die Liste pflegt; im Katalog der Betreiber, der dabei
    /// bestätigt, dass die Karte keine Daten über einzelne Menschen trägt — die Freigabe gilt
    /// für genau diesen Stand der Karte.
    /// </summary>
    private static async Task DecideAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId, Guid moduleId, DecideRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var catalogue = await IsCatalogueAsync(connection, moduleId, ctx.RequestAborted);
        Guid decider;
        if (catalogue)
        {
            if (await Reports.AsOperatorAsync(ctx, db, connection, config) is not { } op) return;
            if (body.Accept && !body.NoPersonalData)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Potwierdź, że na karcie nie ma danych osobowych.");
                return;
            }
            decider = op;
        }
        else
        {
            if (!await TendsAsync(connection, who.Value.AccountId, moduleId, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "O tej liście decyduje ten, kto ją prowadzi.");
                return;
            }
            decider = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted))[0].Id;
        }

        byte[]? print = null;
        if (catalogue && body.Accept)
        {
            Card? card = null;
            await using (var cmd = new SqlCommand($"{CardsSql} AND e.area_id = @area;", connection))
            {
                cmd.Parameters.AddWithValue("@area", areaId);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted)) card = ReadCard(reader);
            }
            if (card is null) { await Fail(ctx, StatusCodes.Status409Conflict, "To wydarzenie nie jest publiczne — nie ma czego pokazać."); return; }
            print = await PrintAsync(connection, card, ctx.RequestAborted);
        }

        await using var update = new SqlCommand("""
            UPDATE app.event_listing SET state = @state, decided_by_role_id = @role, decided_at = @now, approved_print = @print
            WHERE area_id = @area AND module_id = @module;
            """, connection);
        update.Parameters.AddWithValue("@state", body.Accept ? "shown" : "refused");
        update.Parameters.AddWithValue("@role", decider);
        update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        update.Parameters.AddWithValue("@print", print is null ? DBNull.Value : print);
        update.Parameters.AddWithValue("@area", areaId);
        update.Parameters.AddWithValue("@module", moduleId);
        if (await update.ExecuteNonQueryAsync(ctx.RequestAborted) == 0) { await Fail(ctx, StatusCodes.Status404NotFound, "Tej prośby nie ma."); return; }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(areaId), moduleId = Ids.ToText(moduleId), state = body.Accept ? "shown" : "refused" });
    }

    /// <summary>Für die Glocke: Bitten, über die dieses Konto entscheidet (Listen, die es pflegt; der Katalog, wenn es der Betreiber ist).</summary>
    internal static async Task<List<object>> WaitingAsync(SqlConnection connection, Guid account, bool isOperator, CancellationToken ct)
    {
        var rows = new List<(Guid Area, Guid Module, string Name, string? Path)>();
        await using (var cmd = new SqlCommand("""
            SELECT TOP 50 x.area_id, x.module_id, a.name,
                   (SELECT TOP 1 s.path FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id WHERE p.module_id = x.module_id ORDER BY s.path)
            FROM app.event_listing x JOIN app.area a ON a.id = x.area_id
            WHERE x.state = N'asked' ORDER BY x.asked_at;
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetString(3)));
        }

        var list = new List<object>();
        foreach (var r in rows)
        {
            var catalogue = await IsCatalogueAsync(connection, r.Module, ct);
            if (catalogue ? !isOperator : !await TendsAsync(connection, account, r.Module, ct)) continue;
            list.Add(new { areaId = Ids.ToText(r.Area), moduleId = Ids.ToText(r.Module), name = r.Name, path = r.Path, catalogue });
        }
        return list;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
