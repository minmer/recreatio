using System.Text.Json;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0133 — EIN BEREICH MIT EINER ART: Wydarzenie, Grupa, Parafia / organizacja, Kurs.
///
/// <para>
/// Der Bereich bleibt, was er ist — Schlüssel, Menschen, Rozmowy, Formulare. Das Profil
/// fügt hinzu, was die Art braucht: die <b>Wizytówka</b> (Titel und Vorspann, im Browser
/// versiegelt unter dem Schlüssel des Bereichs, in dem sie veröffentlicht ist — ein
/// jawner Bereich: jeder liest sie; sonst nur, wer dort liest), ein Bild, die Hauptseite,
/// eine Seite für die Zeit danach, den Haupttermin, und wohin neue Stücke standardmässig
/// veröffentlicht werden.
/// </para>
///
/// <para>
/// <b>Veröffentlichen in einen anderen Bereich darf nur, wer beide führt</b> (admin auf
/// dem Bereich des Profils UND auf dem Ziel). Die Daten bleiben im Bereich des Profils;
/// für sie steht dessen Administrator danych gerade.
/// </para>
///
/// <para>
/// <b>Archiv:</b> nach dem Ende des Haupttermins (Art <c>auto</c>) schliesst
/// <see cref="ProfileSweep"/> die Formulare des Bereichs und merkt sie sich; „Przywróć"
/// öffnet genau diese wieder. Die Seite „po wydarzeniu" zeigt sich erst danach.
/// </para>
/// </summary>
public static class Profiles
{
    /* 0134 — dazu Szkoła und Klasa. */
    public static readonly string[] Kinds = ["event", "group", "organisation", "course", "school", "class"];
    private const int MaxCard = 16 * 1024;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/area/{id:guid}/profile", GetAsync);
        /* 0134 — die Bereiche darin mit ihrer Art (die Klassen einer Schule). */
        app.MapGet("/workspace/area/{id:guid}/children", ChildrenAsync);
        app.MapPost("/workspace/area/{id:guid}/profile", SetAsync);
        app.MapPost("/workspace/area/{id:guid}/archive", ArchiveAsync);
        app.MapGet("/workspace/area/{id:guid}/import-keys", KeysAsync);
        app.MapPost("/workspace/area/{id:guid}/import-keys", SetKeysAsync);

        /* Öffentlich: die Wizytówka eines Bereichs, wie eine Seite sie zeigt. */
        app.MapGet("/area/{id:guid}/profile", PublicAsync);
    }

    internal sealed record Profile(
        Guid Area, string Kind, Guid? PublishArea, Guid? CardArea, int? CardEpoch, byte[]? CardSealed,
        Guid? Image, string? Category, Guid? Slug, string? Path, Guid? AfterSlug, string? AfterPath,
        Guid? Item, DateTimeOffset? Starts, DateTimeOffset? Ends, bool AllDay, Guid? ItemVisibility,
        string ArchiveMode, DateTimeOffset? ArchivedAt, DateTimeOffset Created, string? ItemStatus = null,
        Guid? ItemCalendar = null, Guid? ItemOwner = null)
    {
        /// <summary>Vorbei: archiviert — oder der Haupttermin ist zu Ende.</summary>
        public bool Ended(DateTimeOffset now) => ArchivedAt is not null || (Ends is { } e && e < now);
    }

    private const string ProfileSql = """
        SELECT p.area_id, p.kind, p.publish_area_id, p.card_area_id, p.card_epoch, p.card_sealed,
               p.image_id, p.category, p.slug_id, s.path, p.after_slug_id, a.path,
               p.item_id, i.starts_at, i.ends_at, i.all_day, i.visibility_area_id,
               p.archive_mode, p.archived_at, p.created_at, i.status, i.calendar_id, i.owner_role_id
        FROM app.area_profile p
        LEFT JOIN app.slug s ON s.id = p.slug_id
        LEFT JOIN app.slug a ON a.id = p.after_slug_id
        LEFT JOIN app.calendar_item i ON i.id = p.item_id
        """;

    private static Profile Read(SqlDataReader r) => new(
        r.GetGuid(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetGuid(2), r.IsDBNull(3) ? null : r.GetGuid(3),
        r.IsDBNull(4) ? null : r.GetInt32(4), r.IsDBNull(5) ? null : (byte[])r[5],
        r.IsDBNull(6) ? null : r.GetGuid(6), r.IsDBNull(7) ? null : r.GetString(7),
        r.IsDBNull(8) ? null : r.GetGuid(8), r.IsDBNull(9) ? null : r.GetString(9),
        r.IsDBNull(10) ? null : r.GetGuid(10), r.IsDBNull(11) ? null : r.GetString(11),
        r.IsDBNull(12) ? null : r.GetGuid(12), r.IsDBNull(13) ? null : r.GetDateTimeOffset(13),
        r.IsDBNull(14) ? null : r.GetDateTimeOffset(14), !r.IsDBNull(15) && r.GetBoolean(15),
        r.IsDBNull(16) ? null : r.GetGuid(16), r.GetString(17), r.IsDBNull(18) ? null : r.GetDateTimeOffset(18),
        r.GetDateTimeOffset(19), r.IsDBNull(20) ? null : r.GetString(20),
        r.IsDBNull(21) ? null : r.GetGuid(21), r.IsDBNull(22) ? null : r.GetGuid(22));

    internal static async Task<Profile?> OfAsync(SqlConnection connection, Guid areaId, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand($"{ProfileSql} WHERE p.area_id = @area;", connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Read(reader) : null;
    }

    /// <summary>Das Profil, dessen Seite „po wydarzeniu" diese Seite ist — oder <c>null</c>.</summary>
    internal static async Task<Profile?> OfAfterPageAsync(SqlConnection connection, Guid slugId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"{ProfileSql} WHERE p.after_slug_id = @slug;", connection);
        cmd.Parameters.AddWithValue("@slug", slugId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Read(reader) : null;
    }

    /// <summary>Ist der Bereich jawny — sein Schlüssel offengelegt?</summary>
    internal static async Task<bool> PublicAreaAsync(SqlConnection connection, Guid areaId, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM app.area a WHERE a.id = @area AND a.public_level <> N'none'
                AND EXISTS (SELECT 1 FROM app.area_epoch e WHERE e.area_id = a.id AND e.key_public IS NOT NULL)) THEN 1 ELSE 0 END;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        return (int)(await cmd.ExecuteScalarAsync(ct))! == 1;
    }

    internal static object Json(Profile p, DateTimeOffset now) => new
    {
        kind = p.Kind,
        publishAreaId = p.PublishArea is null ? null : Ids.ToText(p.PublishArea.Value),
        card = p.CardSealed is null ? null : new { areaId = Ids.ToText(p.CardArea!.Value), epoch = p.CardEpoch, @sealed = Base64Url.Encode(p.CardSealed) },
        imageId = p.Image is null ? null : Ids.ToText(p.Image.Value),
        category = p.Category,
        main = p.Slug is null ? null : new { slugId = Ids.ToText(p.Slug.Value), path = p.Path },
        after = p.AfterSlug is null ? null : new { slugId = Ids.ToText(p.AfterSlug.Value), path = p.AfterPath },
        itemId = p.Item is null ? null : Ids.ToText(p.Item.Value),
        item = p.Item is null ? null : new
        {
            startsAt = p.Starts, endsAt = p.Ends, allDay = p.AllDay,
            visibilityAreaId = p.ItemVisibility is null ? null : Ids.ToText(p.ItemVisibility.Value),
            /* Damit ein Ändern Status, Kalender und Besitzer behält. */
            status = p.ItemStatus,
            calendarId = p.ItemCalendar is null ? null : Ids.ToText(p.ItemCalendar.Value),
            ownerRoleId = p.ItemOwner is null ? null : Ids.ToText(p.ItemOwner.Value)
        },
        archiveMode = p.ArchiveMode,
        archivedAt = p.ArchivedAt,
        ended = p.Ended(now),
        createdAt = p.Created
    };

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }

    private static async Task<List<Guid>> MineAsync(SqlConnection connection, Guid account, CancellationToken ct) =>
        (await Workspace.RolesOfAsync(connection, account, ct)).Select(r => r.Id).ToList();

    /* -- Lesen ------------------------------------------------------------------------- */

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

        var now = DateTimeOffset.UtcNow;
        var profile = await OfAsync(connection, id, ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var admin = (await Controllers.AdminRolesAsync(connection, mine, id, ctx.RequestAborted)).Count > 0;
        var publishTo = profile?.PublishArea ?? id;

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            profile = profile is null ? null : Json(profile, now),
            admin,
            controller = Controllers.Json(await Controllers.OfAreaAsync(connection, id, ctx.RequestAborted)),
            @public = await PublicAreaAsync(connection, id, ctx.RequestAborted),
            publishPublic = await PublicAreaAsync(connection, publishTo, ctx.RequestAborted),
            openForms = (await OpenFormsAsync(connection, id, ctx.RequestAborted)).Select(Ids.ToText).ToList()
        });
    }

    /// <summary>
    /// 0134 — DIE BEREICHE GLEICH DARIN, mit ihrer Art: die Klassen einer Schule. Nur die, die ich
    /// lese — von den anderen erfährt man nicht einmal, dass es sie gibt.
    /// </summary>
    private static async Task ChildrenAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var rows = new List<(Guid Id, string? Kind, DateTimeOffset? Archived)>();
        await using (var cmd = new SqlCommand("""
            SELECT a.id, p.kind, p.archived_at
            FROM app.area a
            LEFT JOIN app.area_profile p ON p.area_id = a.id
            WHERE a.parent_area_id = @area;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                rows.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetDateTimeOffset(2)));
        }

        var children = new List<object>();
        foreach (var row in rows)
        {
            if (!await Area.MayAsync(connection, who.Value.AccountId, row.Id, Capability.Read, ctx.RequestAborted)) continue;
            children.Add(new { areaId = Ids.ToText(row.Id), kind = row.Kind, archivedAt = row.Archived });
        }
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), children });
    }

    /* -- Schreiben --------------------------------------------------------------------- */

    public sealed record CardRequest(string? AreaId, int? Epoch, string? Sealed);

    /// <summary>
    /// Ein Profil anlegen oder ändern. Was fehlt (<c>null</c>), bleibt; <c>""</c> leert es.
    /// <c>off</c>: das Profil abnehmen — der Bereich bleibt, wie er ist.
    /// </summary>
    public sealed record SetRequest(
        string? Kind, string? PublishAreaId, CardRequest? Card, string? ImageId, string? Category,
        string? Path, string? AfterPath, string? ItemId, string? ArchiveMode, bool? Off);

    private static async Task SetAsync(HttpContext ctx, Db db, Guid id, SetRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var admins = await Controllers.AdminRolesAsync(connection, mine, id, ctx.RequestAborted);
        if (admins.Count == 0) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma albo go nie prowadzisz."); return; }

        if (body.Off == true)
        {
            await using var off = new SqlCommand("DELETE FROM app.area_profile WHERE area_id = @area;", connection);
            off.Parameters.AddWithValue("@area", id);
            await off.ExecuteNonQueryAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), profile = (object?)null });
            return;
        }

        var before = await OfAsync(connection, id, ctx.RequestAborted);
        var kind = (body.Kind ?? before?.Kind ?? "").Trim();
        if (!Kinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj obszaru: wydarzenie, grupa, parafia/organizacja, kurs, szkoła albo klasa.");
            return;
        }

        /* Wer in einen anderen Bereich veröffentlicht, führt beide. */
        async Task<(bool Ok, Guid? Area)> TargetAsync(string? text, Guid? was)
        {
            if (text is null) return (true, was);
            if (text.Trim() == "") return (true, null);
            if (!Guid.TryParse(text, out var area)) return (false, null);
            if (area == id) return (true, null);
            return ((await Controllers.AdminRolesAsync(connection, mine, area, ctx.RequestAborted)).Count > 0, area);
        }

        var (publishOk, publishArea) = await TargetAsync(body.PublishAreaId, before?.PublishArea);
        if (!publishOk)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Publikować w innym obszarze może tylko ten, kto prowadzi oba obszary.");
            return;
        }

        Guid? cardArea = before?.CardArea;
        int? cardEpoch = before?.CardEpoch;
        byte[]? cardSealed = before?.CardSealed;
        if (body.Card is not null)
        {
            if (string.IsNullOrWhiteSpace(body.Card.Sealed))
            {
                cardArea = null; cardEpoch = null; cardSealed = null;
            }
            else
            {
                if (!Guid.TryParse(body.Card.AreaId, out var area) || body.Card.Epoch is null or < 1)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar albo epoka wizytówki.");
                    return;
                }
                if (area != id && (await Controllers.AdminRolesAsync(connection, mine, area, ctx.RequestAborted)).Count == 0)
                {
                    await Fail(ctx, StatusCodes.Status403Forbidden, "Wizytówkę w innym obszarze publikuje tylko ten, kto prowadzi oba obszary.");
                    return;
                }
                try { cardSealed = Base64Url.Decode(body.Card.Sealed); }
                catch (FormatException) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna wizytówka."); return; }
                if (cardSealed.Length is 0 or > MaxCard) { await Fail(ctx, StatusCodes.Status400BadRequest, "Wizytówka jest pusta albo za długa."); return; }
                cardArea = area;
                cardEpoch = body.Card.Epoch;
            }
        }

        var category = body.Category is null ? before?.Category : body.Category.Trim();
        if (category is { Length: > 40 }) { await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj wydarzenia: najwyżej 40 znaków."); return; }
        if (category == "") category = null;

        /* Eine Seite, die ich führe. */
        async Task<(string? Error, Guid? Slug)> PageAsync(string? text, Guid? was)
        {
            if (text is null) return (null, was);
            if (text.Trim() == "") return (null, null);
            var path = Slug.Normalise(text);
            Guid? slug;
            await using (var cmd = new SqlCommand("SELECT id FROM app.slug WHERE path = @path AND alias_of IS NULL;", connection))
            {
                cmd.Parameters.AddWithValue("@path", path);
                slug = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
            }
            if (slug is null) return ("Takiej strony nie ma.", null);
            if (!(await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted)).MayWrite)
                return ("Wskazać można stronę, którą prowadzisz.", null);
            return (null, slug);
        }

        var (pageError, slugId) = await PageAsync(body.Path, before?.Slug);
        if (pageError is not null) { await Fail(ctx, StatusCodes.Status403Forbidden, pageError); return; }
        var (afterError, afterId) = await PageAsync(body.AfterPath, before?.AfterSlug);
        if (afterError is not null) { await Fail(ctx, StatusCodes.Status403Forbidden, afterError); return; }
        if (slugId is not null && slugId == afterId)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Strona po wydarzeniu musi być inną stroną niż główna.");
            return;
        }

        Guid? item = before?.Item;
        if (body.ItemId is not null)
        {
            if (body.ItemId.Trim() == "") item = null;
            else
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
                if (repeat != "none") { await Fail(ctx, StatusCodes.Status409Conflict, "Głównym terminem jest jeden termin, bez powtórzeń."); return; }
                item = parsed;
            }
        }

        Guid? image = before?.Image;
        if (body.ImageId is not null)
        {
            if (body.ImageId.Trim() == "") image = null;
            else
            {
                if (!Guid.TryParse(body.ImageId, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zdjęcie."); return; }
                string? owner;
                await using (var cmd = new SqlCommand(
                    "SELECT s.path FROM app.page_image i JOIN app.slug s ON s.id = i.slug_id WHERE i.id = @id;", connection))
                {
                    cmd.Parameters.AddWithValue("@id", parsed);
                    owner = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as string;
                }
                if (owner is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego pliku nie ma."); return; }
                if (!(await Access.OfAsync(connection, who.Value.AccountId, owner, ctx.RequestAborted)).MayWrite)
                {
                    await Fail(ctx, StatusCodes.Status403Forbidden, "Zdjęcie wybiera się spośród plików stron, które prowadzisz.");
                    return;
                }
                image = parsed;
            }
        }

        var archiveMode = body.ArchiveMode ?? before?.ArchiveMode ?? "auto";
        if (archiveMode is not ("auto" or "manual")) { await Fail(ctx, StatusCodes.Status400BadRequest, "Archiwum: auto albo manual."); return; }

        var now = DateTimeOffset.UtcNow;
        await using (var cmd = new SqlCommand("""
            UPDATE app.area_profile
               SET kind = @kind, publish_area_id = @publish, card_area_id = @cardArea, card_epoch = @cardEpoch, card_sealed = @card,
                   image_id = @image, category = @category, slug_id = @slug, after_slug_id = @after, item_id = @item,
                   archive_mode = @archive, updated_at = @now
             WHERE area_id = @area;
            IF @@ROWCOUNT = 0
                INSERT INTO app.area_profile (area_id, kind, publish_area_id, card_area_id, card_epoch, card_sealed, image_id, category,
                    slug_id, after_slug_id, item_id, archive_mode, created_at, created_by_role_id, updated_at)
                VALUES (@area, @kind, @publish, @cardArea, @cardEpoch, @card, @image, @category, @slug, @after, @item, @archive, @now, @role, @now);
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@kind", kind);
            cmd.Parameters.AddWithValue("@publish", (object?)publishArea ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@cardArea", (object?)cardArea ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@cardEpoch", (object?)cardEpoch ?? DBNull.Value);
            cmd.Parameters.AddBlob("@card", cardSealed);
            cmd.Parameters.AddWithValue("@image", (object?)image ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@category", (object?)category ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@slug", (object?)slugId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@after", (object?)afterId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@item", (object?)item ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@archive", archiveMode);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@role", admins[0].RoleId);
            try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ta strona jest już stroną innego obszaru (główną albo po wydarzeniu).");
                return;
            }
        }

        var after = await OfAsync(connection, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), profile = after is null ? null : Json(after, now) });
    }

    /* -- Archiv ------------------------------------------------------------------------ */

    public sealed record ArchiveRequest(bool Archived);

    private static async Task ArchiveAsync(HttpContext ctx, Db db, Guid id, ArchiveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await MineAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if ((await Controllers.AdminRolesAsync(connection, mine, id, ctx.RequestAborted)).Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma albo go nie prowadzisz.");
            return;
        }
        if (await OfAsync(connection, id, ctx.RequestAborted) is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Ten obszar nie ma profilu."); return; }

        var now = DateTimeOffset.UtcNow;
        if (body.Archived) await ArchiveNowAsync(connection, id, now, ctx.RequestAborted);
        else await ReopenAsync(connection, id, ctx.RequestAborted);
        var after = await OfAsync(connection, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), profile = after is null ? null : Json(after, now) });
    }

    /// <summary>Archivieren: die offenen Formulare des Bereichs schliessen und sich merken, welche es waren.</summary>
    internal static async Task ArchiveNowAsync(SqlConnection connection, Guid area, DateTimeOffset now, CancellationToken ct)
    {
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);

        /* Schon archiviert: nichts tun — sonst ginge verloren, welche Formulare „Przywróć" wieder öffnen soll. */
        await using (var already = new SqlCommand(
            "SELECT archived_at FROM app.area_profile WITH (UPDLOCK) WHERE area_id = @area;", connection, tx))
        {
            already.Parameters.AddWithValue("@area", area);
            if (await already.ExecuteScalarAsync(ct) is DateTimeOffset)
            {
                await tx.CommitAsync(ct);
                return;
            }
        }

        var closed = new List<string>();
        await using (var cmd = new SqlCommand(
            "SELECT id FROM app.module WITH (UPDLOCK) WHERE area_id = @area AND kind = N'form' AND closed_at IS NULL;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@area", area);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) closed.Add(Ids.ToText(reader.GetGuid(0)));
        }
        await using (var cmd = new SqlCommand("""
            UPDATE app.module SET closed_at = @now WHERE area_id = @area AND kind = N'form' AND closed_at IS NULL;
            UPDATE app.area_profile SET archived_at = COALESCE(archived_at, @now), archive_closed = @closed, updated_at = @now
             WHERE area_id = @area;
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@area", area);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@closed", JsonSerializer.Serialize(closed));
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }

    /// <summary>Wiederöffnen: wieder offen, was das Archivieren geschlossen hat; danach archiviert nur noch die Hand.</summary>
    private static async Task ReopenAsync(SqlConnection connection, Guid area, CancellationToken ct)
    {
        string? closed;
        await using (var cmd = new SqlCommand("SELECT archive_closed FROM app.area_profile WHERE area_id = @area;", connection))
        {
            cmd.Parameters.AddWithValue("@area", area);
            closed = await cmd.ExecuteScalarAsync(ct) as string;
        }
        var ids = new List<Guid>();
        try
        {
            foreach (var one in JsonSerializer.Deserialize<List<string>>(closed ?? "[]") ?? [])
                if (Guid.TryParse(one, out var g)) ids.Add(g);
        }
        catch (JsonException) { /* nichts zu öffnen */ }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        foreach (var module in ids)
        {
            await using var open = new SqlCommand("UPDATE app.module SET closed_at = NULL WHERE id = @id AND area_id = @area;", connection, tx);
            open.Parameters.AddWithValue("@id", module);
            open.Parameters.AddWithValue("@area", area);
            await open.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new SqlCommand("""
            UPDATE app.area_profile SET archived_at = NULL, archive_closed = NULL, archive_mode = N'manual', updated_at = SYSDATETIMEOFFSET()
             WHERE area_id = @area;
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@area", area);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }

    /// <summary>Was zu Ende ist und von selbst archiviert wird (für <see cref="ProfileSweep"/>).</summary>
    internal static async Task SweepAsync(SqlConnection connection, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var due = new List<Guid>();
        await using (var cmd = new SqlCommand("""
            SELECT p.area_id FROM app.area_profile p JOIN app.calendar_item i ON i.id = p.item_id
            WHERE p.archive_mode = N'auto' AND p.archived_at IS NULL AND i.ends_at < @now;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@now", now);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) due.Add(reader.GetGuid(0));
        }
        foreach (var area in due) await ArchiveNowAsync(connection, area, now, ct);
    }

    /* -- Was ein Import angelegt hat ---------------------------------------------------- */

    /* `question`: „formularz#pytanie" — die Kennung einer Frage im Dokument und die beim Dienst. */
    private static readonly string[] KeyKinds = ["page", "form", "appointment", "role", "chat", "link", "question"];

    private static async Task KeysAsync(HttpContext ctx, Db db, Guid id)
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
        await using (var cmd = new SqlCommand(
            "SELECT item_kind, item_key, ref_id, ref_text, updated_at FROM app.area_import_key WHERE area_id = @area ORDER BY item_kind, item_key;", connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                list.Add(new
                {
                    kind = reader.GetString(0), key = reader.GetString(1),
                    refId = reader.IsDBNull(2) ? null : Ids.ToText(reader.GetGuid(2)),
                    refText = reader.IsDBNull(3) ? null : reader.GetString(3),
                    updatedAt = reader.GetDateTimeOffset(4)
                });
        }
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), keys = list });
    }

    public sealed record KeyRow(string? Kind, string? Key, string? RefId, string? RefText, bool? Remove);
    public sealed record KeysRequest(List<KeyRow>? Keys);

    /// <summary>Merken (oder vergessen), was ein Import unter welchem Schlüssel angelegt hat — wer im Bereich schreibt.</summary>
    private static async Task SetKeysAsync(HttpContext ctx, Db db, Guid id, KeysRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        var rows = body.Keys ?? [];
        if (rows.Count is 0 or > 500) { await Fail(ctx, StatusCodes.Status400BadRequest, "Od 1 do 500 kluczy naraz."); return; }
        foreach (var row in rows)
        {
            if (!KeyKinds.Contains(row.Kind ?? "") || string.IsNullOrWhiteSpace(row.Key) || row.Key.Length > 120
                || (row.RefId is not null && !Guid.TryParse(row.RefId, out _)) || row.RefText is { Length: > 400 })
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz importu.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Importuje ten, kto pisze w tym obszarze.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        foreach (var row in rows)
        {
            await using var cmd = new SqlCommand(row.Remove == true
                ? "DELETE FROM app.area_import_key WHERE area_id = @area AND item_kind = @kind AND item_key = @key;"
                : """
                  UPDATE app.area_import_key SET ref_id = @ref, ref_text = @text, updated_at = @now
                   WHERE area_id = @area AND item_kind = @kind AND item_key = @key;
                  IF @@ROWCOUNT = 0
                      INSERT INTO app.area_import_key (area_id, item_kind, item_key, ref_id, ref_text, updated_at)
                      VALUES (@area, @kind, @key, @ref, @text, @now);
                  """, connection, tx);
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@kind", row.Kind!);
            cmd.Parameters.AddWithValue("@key", row.Key!.Trim());
            cmd.Parameters.AddWithValue("@ref", row.RefId is null ? DBNull.Value : Guid.Parse(row.RefId));
            cmd.Parameters.AddWithValue("@text", (object?)row.RefText ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), saved = rows.Count });
    }

    /* -- Öffentlich -------------------------------------------------------------------- */

    /// <summary>
    /// „Zapisy otwarte" — ein Formular des Bereichs nimmt wirklich an: offen, für alle, mit
    /// Fragen, deren Bereich jawny ist, auf einer öffentlichen Seite, ungesperrt, und jemand
    /// steht für die Daten gerade.
    /// </summary>
    internal static async Task<List<Guid>> OpenFormsAsync(SqlConnection connection, Guid area, CancellationToken ct)
    {
        var forms = new List<Guid>();
        if (await Controllers.OfAreaAsync(connection, area, ct) is null) return forms;
        await using var cmd = new SqlCommand("""
            SELECT m.id FROM app.module m
            WHERE m.area_id = @area AND m.kind = N'form' AND m.closed_at IS NULL AND m.audience = N'public'
              AND EXISTS (SELECT 1 FROM app.slug_field f WHERE f.part_id = m.id AND f.removed_at IS NULL)
              AND EXISTS (SELECT 1 FROM app.area qa WHERE qa.id = COALESCE(m.label_area_id, m.area_id) AND qa.public_level <> N'none'
                          AND EXISTS (SELECT 1 FROM app.area_epoch qe WHERE qe.area_id = qa.id AND qe.key_public IS NOT NULL))
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

    /// <summary>Eine öffentliche Seite: an keinen Bereich gebunden, nicht versiegelt.</summary>
    private static async Task<bool> PublicPageAsync(SqlConnection connection, Guid slug, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM app.slug s WHERE s.id = @slug AND s.page_seal IS NULL
                AND NOT EXISTS (SELECT 1 FROM app.slug_area sa WHERE sa.slug_id = s.id)) THEN 1 ELSE 0 END;
            """, connection);
        cmd.Parameters.AddWithValue("@slug", slug);
        return (int)(await cmd.ExecuteScalarAsync(ct))! == 1;
    }

    /// <summary>
    /// Die Wizytówka eines Bereichs, ohne Konto: versiegelt, wenn ihr Bereich jawny ist (dann
    /// öffnet sie jeder mit dem offengelegten Schlüssel) oder wer ruft dort liest.
    /// </summary>
    private static async Task PublicAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var profile = await OfAsync(connection, id, ctx.RequestAborted);
        if (profile is null || await Takedowns.IsBlockedAsync(connection, "event", id, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ten obszar nie ma wizytówki.");
            return;
        }

        var caller = await Callers.OfAsync(ctx, db, connection);
        async Task<bool> ReadsAsync(Guid? area) => area is { } a
            && (await PublicAreaAsync(connection, a, ctx.RequestAborted)
                || (caller is not null && await Area.MayAsync(connection, caller, a, Capability.Read, ctx.RequestAborted)));

        var now = DateTimeOffset.UtcNow;
        var cardVisible = await ReadsAsync(profile.CardArea);
        var itemVisible = await ReadsAsync(profile.ItemVisibility);
        var ended = profile.Ended(now);

        /* Die Seite danach geht erst hinaus, wenn es vorbei ist. */
        string? afterPath = ended ? profile.AfterPath : null;

        List<object> fields = [];
        if (itemVisible && profile.Item is not null)
        {
            await using var cmd = new SqlCommand(
                "SELECT field, area_id, epoch, sealed_blob FROM app.calendar_field WHERE item_id = @item AND field IN (N'title', N'location');", connection);
            cmd.Parameters.AddWithValue("@item", profile.Item.Value);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                fields.Add(new { field = reader.GetString(0), areaId = Ids.ToText(reader.GetGuid(1)), epoch = reader.GetInt32(2), @sealed = Base64Url.Encode((byte[])reader[3]) });
        }

        var forms = await OpenFormsAsync(connection, id, ctx.RequestAborted);

        /* Der Name des Bereichs nur, wo das Profil ohnehin zu sehen ist: Wizytówka lesbar, oder die Hauptseite öffentlich. */
        var named = cardVisible || (profile.Slug is { } main && await PublicPageAsync(connection, main, ctx.RequestAborted));
        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            kind = profile.Kind,
            category = profile.Category,
            name = named ? await Controllers.AreaNameAsync(connection, id, ctx.RequestAborted) : null,
            card = !cardVisible || profile.CardSealed is null ? null
                : new { areaId = Ids.ToText(profile.CardArea!.Value), epoch = profile.CardEpoch, @sealed = Base64Url.Encode(profile.CardSealed) },
            imageId = cardVisible && profile.Image is not null ? Ids.ToText(profile.Image.Value) : null,
            main = profile.Path is null ? null : new { path = profile.Path },
            after = afterPath is null ? null : new { path = afterPath },
            item = !itemVisible || profile.Item is null ? null : new
            {
                id = Ids.ToText(profile.Item.Value), startsAt = profile.Starts, endsAt = profile.Ends, allDay = profile.AllDay,
                status = profile.ItemStatus, fields
            },
            ended,
            archived = profile.ArchivedAt is not null,
            forms = forms.Select(Ids.ToText).ToList(),
            controller = Controllers.Json(await Controllers.OfAreaAsync(connection, id, ctx.RequestAborted))
        });
    }
}

/// <summary>Jede Stunde: was zu Ende ist und von selbst archiviert wird.</summary>
internal sealed class ProfileSweep(Db db, ILogger<ProfileSweep> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = await db.OpenAsync(stoppingToken);
                await Profiles.SweepAsync(connection, stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Profile sweep failed.");
            }
            try { await Task.Delay(TimeSpan.FromHours(1), stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }
}
