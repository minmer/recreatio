using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Messintentionen — und der Aushang ueber ALLE Kalender hinweg.
///
/// <para>
/// <b>Diese Datei legt keine Messe mehr an.</b> Eine Messe IST ein
/// Kalendereintrag mit <c>kind = 'mass'</c>; angelegt wird sie ueber
/// <c>POST /workspace/calendar/{id}/item</c> wie eine Scholaprobe auch. Der
/// Altbestand sagt es so: „Msza to wpis kalendarza. Nie ma osobnej tabeli mszy
/// i nie powinno jej byc." 0018 wich davon ab, weil es keinen Kalender gab —
/// jetzt gibt es einen, und die Abweichung faellt mit 0020 fort.
/// </para>
///
/// <para>
/// Was hier bleibt, ist das, was NUR die Messe hat: die Intention. Sie haengt
/// am VORKOMMEN <c>(item_id, occurrence_at)</c> und nicht an der Reihe — am
/// Dienstag wird eine andere gelesen als am Mittwoch.
/// </para>
///
/// <para>
/// <b>Der Text steht im Klartext, Geber und Gabe nicht.</b> Eine Intention wird
/// in der Kirche vorgelesen und haengt im Schaukasten; sie zu versiegeln hiesse,
/// das Modul gegen seinen Zweck zu bauen. Wer sie gegeben hat und was er gegeben
/// hat, steht auf keinem Zettel an der Tuer — das liegt in
/// <c>app.mass_intention_field</c>, je Feld unter SEINEM Bereich.
/// </para>
///
/// <para>
/// <b>Der Aushang ist oeffentlich</b> und geht ueber alle Kalender: wer den
/// Messplan sucht, soll sich dafuer nicht anmelden muessen — und wir sollen
/// nicht erfahren, dass er geschaut hat. Sichtbar ist, was unter einem Bereich
/// mit offengelegter Epoche liegt; alles andere faellt gar nicht erst an.
/// </para>
/// </summary>
public static class Mass
{
    public const int MaxText = 400;

    /// <summary>Die Felder einer Intention, die versiegelt liegen duerfen — wie 0020.</summary>
    private static readonly string[] SealableFields = ["giver", "offering"];

    public static void Map(WebApplication app)
    {
        // Der Aushang — ohne Konto, ueber alle offengelegten Kalender.
        app.MapGet("/masses", PlanAsync);

        // Dasselbe mit Konto: mehr Bereiche, dazu Stand und Zelebrant.
        app.MapGet("/workspace/masses", OfficeAsync);

        app.MapPost("/workspace/mass/{id:guid}/intention", AddIntentionAsync);
        app.MapPost("/workspace/intention/{id:guid}", UpdateIntentionAsync);
    }

    /* -- Der Aushang --------------------------------------------------------- */

    private static Task PlanAsync(HttpContext ctx, Db db, string? calendar, string? from, string? to) =>
        ShowAsync(ctx, db, calendar, from, to, null);

    private static async Task OfficeAsync(HttpContext ctx, Db db, string? calendar, string? from, string? to)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await ShowAsync(ctx, db, calendar, from, to, who.Value.AccountId);
    }

    private sealed record Row(
        Guid Id, Guid CalendarId, string CalendarTitle, string AreaName, string Zone,
        string Kind, string? TitlePublic, DateTimeOffset StartsAt, DateTimeOffset EndsAt,
        string Status, string RepeatKind, int RepeatEvery,
        int? Weekdays, DateTimeOffset? Until, int? Count);

    private sealed record Service(
        Row Item, DateTimeOffset OccurrenceAt, DateTimeOffset StartsAt, DateTimeOffset EndsAt);

    /// <summary>
    /// Der Messplan.
    ///
    /// <para>
    /// <b>Ueber alle Kalender, mit der Angabe WO.</b> Ein Mensch, der eine Messe
    /// sucht, sucht eine Messe — nicht den Kalender, in dem sie gefuehrt wird.
    /// Deshalb steht bei jedem Vorkommen, aus welchem Kalender und aus welchem
    /// Bereich es stammt.
    /// </para>
    ///
    /// <para>
    /// Ohne <paramref name="calendar"/> wird ueber alle lesbaren gesammelt; mit
    /// ihm bleibt es bei einem — das ist der Fall des Moduls auf einer Seite.
    /// </para>
    /// </summary>
    private static async Task ShowAsync(
        HttpContext ctx, Db db, string? calendar, string? from, string? to, Guid? accountId)
    {
        if (!Calendar.Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        Guid? only = null;
        if (!string.IsNullOrWhiteSpace(calendar))
        {
            if (!Guid.TryParse(calendar, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung kalendarza.");
                return;
            }
            only = wanted;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * Dieselbe Frage wie im Kalender, und ausdruecklich dieselbe Antwort:
         * welche Bereiche kann dieser Leser oeffnen. Eine zweite Fassung davon
         * waere eine zweite Meinung darueber, was oeffentlich ist.
         */
        var readable = await Calendar.ReadableAreasAsync(connection, accountId, ctx.RequestAborted);

        if (readable.Count == 0)
        {
            await Empty(ctx, since, till);
            return;
        }

        var rows = new List<Row>();
        var areaNames = string.Join(", ", readable.Select((_, i) => $"@a{i}"));

        await using (var cmd = new SqlCommand($"""
            SELECT i.id, i.calendar_id, c.title, a.name, c.time_zone,
                   i.kind, i.title_public, i.starts_at, i.ends_at, i.status,
                   i.repeat_kind, i.repeat_every, i.repeat_weekdays, i.repeat_until, i.repeat_count
            FROM app.calendar_item i
            JOIN app.calendar c ON c.id = i.calendar_id
            JOIN app.area a     ON a.id = c.area_id
            WHERE i.kind IN (N'mass', N'confession')
              AND i.starts_at <= @to
              AND (i.repeat_kind = N'none' OR i.repeat_until IS NULL OR i.repeat_until >= @from)
              AND i.visibility_area_id IN ({areaNames})
              {(only is null ? "" : "AND i.calendar_id = @only")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@from", since);
            cmd.Parameters.AddWithValue("@to", till);
            if (only is not null) cmd.Parameters.AddWithValue("@only", only.Value);
            for (var i = 0; i < readable.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", readable[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add(new Row(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
                    reader.GetString(4), reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.GetDateTimeOffset(7), reader.GetDateTimeOffset(8), reader.GetString(9),
                    reader.GetString(10), reader.GetInt32(11),
                    reader.IsDBNull(12) ? null : reader.GetByte(12),
                    reader.IsDBNull(13) ? null : reader.GetDateTimeOffset(13),
                    reader.IsDBNull(14) ? null : reader.GetInt32(14)));
            }
        }

        if (rows.Count == 0)
        {
            await Empty(ctx, since, till);
            return;
        }

        var itemIds = rows.Select(r => r.Id).ToList();
        var exceptions = await ExceptionsAsync(connection, itemIds, ctx.RequestAborted);
        var intentions = await IntentionsAsync(
            connection, itemIds, since, till, accountId is not null, ctx.RequestAborted);

        var services = new List<Service>();

        foreach (var row in rows)
        {
            var zone = Zones.Of(row.Zone);
            var span = row.EndsAt - row.StartsAt;

            foreach (var at in Calendar.Occurrences(
                row.StartsAt, row.RepeatKind, row.RepeatEvery, row.Weekdays,
                row.Until, row.Count, since, till, zone))
            {
                var starts = at;

                if (exceptions.TryGetValue((row.Id, at), out var exception))
                {
                    if (exception.Cancelled) continue;
                    if (exception.MovedTo is not null) starts = exception.MovedTo.Value;
                }

                if (starts < since || starts > till) continue;

                services.Add(new Service(row, at, starts, starts + span));
            }
        }

        services.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));

        await ctx.Response.WriteAsJsonAsync(new
        {
            fromUtc = since,
            toUtc = till,

            masses = services.Select(s => new
            {
                itemId = Ids.ToText(s.Item.Id),
                kind = s.Item.Kind,

                // Der Name des Vorkommens — die Adresse der Intentionen.
                occurrenceAt = s.OccurrenceAt,
                startsAt = s.StartsAt,
                endsAt = s.EndsAt,
                status = s.Item.Status,
                title = s.Item.TitlePublic,

                // WO sie ist. Ohne das ist ein Sammelplan eine Liste von Uhrzeiten.
                calendarId = Ids.ToText(s.Item.CalendarId),
                calendarTitle = s.Item.CalendarTitle,
                areaName = s.Item.AreaName,
                timeZone = s.Item.Zone,

                /*
                 * Am Schaukasten steht auch die ART. Wer eine Intention gibt, hat
                 * ein Recht zu wissen, ob sie allein oder mit anderen zusammen
                 * gelesen wird. Der Priester steht dort NICHT — wer zelebriert,
                 * ist eine Frage der Dienstordnung, und die haengt nicht aus.
                 *
                 * Nachgeschlagen wird am URSPRUENGLICHEN Beginn, nicht am
                 * verschobenen: sonst verloere eine verlegte Messe ihre
                 * Intentionen genau dann, wenn sie verlegt wird.
                 */
                intentions = intentions
                    .Where(i => i.ItemId == s.Item.Id && i.At == s.OccurrenceAt)
                    .OrderBy(i => i.Ordinal)
                    .Select(i => Told(i, accountId is not null))
            })
        });
    }

    /// <summary>
    /// Was von einer Intention hinausgeht.
    ///
    /// <para>
    /// Am Aushang: Reihenfolge, Text, Art. In der Kanzlei zusaetzlich Kennung,
    /// Stand, Zelebrant — und die versiegelten Felder, wie sie liegen. Geoeffnet
    /// wird hier nichts.
    /// </para>
    /// </summary>
    private static object Told(Held i, bool office) => office
        ? (object)new
        {
            intentionId = Ids.ToText(i.Id),
            ordinal = i.Ordinal,
            text = i.Text,
            kind = i.Kind,
            status = i.Status,
            celebrantRoleId = i.Celebrant is null ? null : Ids.ToText(i.Celebrant.Value),
            fields = i.Fields.Select(f => new
            {
                field = f.Field,
                areaId = Ids.ToText(f.AreaId),
                epoch = f.Epoch,
                @sealed = Base64Url.Encode(f.Blob)
            })
        }
        : new { ordinal = i.Ordinal, text = i.Text, kind = i.Kind };

    private static Task Empty(HttpContext ctx, DateTimeOffset since, DateTimeOffset till) =>
        ctx.Response.WriteAsJsonAsync(new
        {
            fromUtc = since,
            toUtc = till,
            masses = Array.Empty<object>()
        });

    /* -- Intentionen --------------------------------------------------------- */

    public sealed record IntentionRequest(
        string OccurrenceAt, string Text, string? Kind, int? Ordinal,
        IReadOnlyList<Calendar.SealedField>? Fields);

    private static async Task AddIntentionAsync(HttpContext ctx, Db db, Guid id, IntentionRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var text = (body.Text ?? string.Empty).Trim();
        var kind = (body.Kind ?? "single").Trim().ToLowerInvariant();

        if (text == "")
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Intencja bez treści nie zostanie odczytana.");
            return;
        }

        if (kind is not ("single" or "collective"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: pojedyncza albo zbiorowa.");
            return;
        }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin mszy.");
            return;
        }

        if (!Sealed(body.Fields, out var sealedFields, out var complaint))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, complaint);
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var item = await ItemAsync(connection, id, ctx.RequestAborted);
        if (item is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej mszy nie ma.");
            return;
        }

        /*
         * Die Beichte hat keine Intentionen — nicht „meistens nicht", sondern
         * gar nicht: es gibt nichts vorzulesen. Hier abgewiesen und nicht in der
         * Oberflaeche versteckt, weil sonst der erste andere Weg hinein (ein
         * Skript, ein zweites Bild) sie doch anlegte.
         */
        if (item.Value.Kind != "mass")
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Tylko msza ma intencje.");
            return;
        }

        if (!await Area.MayAsync(connection, who.Value.AccountId, item.Value.AreaId,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej mszy nie ma.");
            return;
        }

        if (!await MayAllAsync(connection, who.Value.AccountId, sealedFields, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
            return;
        }

        /*
         * Die Reihenfolge ergibt sich nicht aus der Anlegezeit: wer nachtraegt,
         * will nicht zwangslaeufig ans Ende. Ohne Angabe hinten anstellen.
         */
        var ordinal = body.Ordinal;
        if (ordinal is null)
        {
            await using var next = new SqlCommand("""
                SELECT ISNULL(MAX(ordinal), -1) + 1 FROM app.mass_intention
                WHERE item_id = @item AND occurrence_at = @at;
                """, connection);

            next.Parameters.AddWithValue("@item", id);
            next.Parameters.AddWithValue("@at", at);
            ordinal = (int)(await next.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var intentionId = Ids.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.mass_intention
                    (id, item_id, occurrence_at, ordinal, text_public, kind,
                     created_by_role_id, created_at, updated_at)
                VALUES (@id, @item, @at, @ord, @text, @kind, @role, @now, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", intentionId);
                insert.Parameters.AddWithValue("@item", id);
                insert.Parameters.AddWithValue("@at", at);
                insert.Parameters.AddWithValue("@ord", ordinal.Value);
                insert.Parameters.AddWithValue("@text", text[..Math.Min(text.Length, MaxText)]);
                insert.Parameters.AddWithValue("@kind", kind);
                insert.Parameters.AddWithValue("@role",
                    mine.Count == 0 ? DBNull.Value : mine[0].Id);
                insert.Parameters.AddWithValue("@now", now);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await WriteFieldsAsync(connection, tx, intentionId, sealedFields, now, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            intentionId = Ids.ToText(intentionId),
            ordinal = ordinal.Value,
            fields = sealedFields.Count
        });
    }

    public sealed record UpdateRequest(
        string? Text, string? Status, int? Ordinal, string? Kind, string? CelebrantRoleId,
        IReadOnlyList<Calendar.SealedField>? Fields);

    private static async Task UpdateIntentionAsync(HttpContext ctx, Db db, Guid id, UpdateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var text = body.Text?.Trim();
        var status = body.Status?.Trim().ToLowerInvariant();
        var kind = body.Kind?.Trim().ToLowerInvariant();

        if (text is not null && text == "")
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Intencja bez treści nie zostanie odczytana.");
            return;
        }

        if (status is not null and not ("accepted" or "cancelled" or "celebrated"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Stan: przyjęta, wycofana albo odprawiona.");
            return;
        }

        if (kind is not null and not ("single" or "collective"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: pojedyncza albo zbiorowa.");
            return;
        }

        Guid? celebrant = null;
        if (!string.IsNullOrWhiteSpace(body.CelebrantRoleId))
        {
            if (!Guid.TryParse(body.CelebrantRoleId, out var found))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
                return;
            }
            celebrant = found;
        }

        if (!Sealed(body.Fields, out var sealedFields, out var complaint))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, complaint);
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid itemId;
        await using (var find = new SqlCommand(
            "SELECT item_id FROM app.mass_intention WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
                return;
            }
            itemId = found;
        }

        var item = await ItemAsync(connection, itemId, ctx.RequestAborted);
        if (item is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
            return;
        }

        if (!await Area.MayAsync(connection, who.Value.AccountId, item.Value.AreaId,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
            return;
        }

        if (!await MayAllAsync(connection, who.Value.AccountId, sealedFields, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            /*
             * Nur was genannt wurde. `ISNULL(@x, spalte)` laesst eine Angabe, die
             * nicht mitkam, unberuehrt — sonst loeschte ein Aufruf, der bloss den
             * Stand aendern wollte, nebenbei den Text.
             */
            await using (var update = new SqlCommand("""
                UPDATE app.mass_intention
                SET text_public       = ISNULL(@text, text_public),
                    status            = ISNULL(@status, status),
                    kind              = ISNULL(@kind, kind),
                    ordinal           = ISNULL(@ord, ordinal),
                    celebrant_role_id = ISNULL(@celebrant, celebrant_role_id),
                    updated_at        = @now
                WHERE id = @id;
                """, connection, tx))
            {
                update.Parameters.AddWithValue("@text", text is null
                    ? DBNull.Value
                    : text[..Math.Min(text.Length, MaxText)]);
                update.Parameters.AddWithValue("@status", (object?)status ?? DBNull.Value);
                update.Parameters.AddWithValue("@kind", (object?)kind ?? DBNull.Value);
                update.Parameters.AddWithValue("@ord", (object?)body.Ordinal ?? DBNull.Value);
                update.Parameters.AddWithValue("@celebrant", (object?)celebrant ?? DBNull.Value);
                update.Parameters.AddWithValue("@now", now);
                update.Parameters.AddWithValue("@id", id);

                await update.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await WriteFieldsAsync(connection, tx, id, sealedFields, now, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { intentionId = Ids.ToText(id), updated = true });
    }

    /* -- Gemeinsames --------------------------------------------------------- */

    private sealed record Sealing(string Field, Guid AreaId, int Epoch, byte[] Blob);

    /// <summary>Die versiegelten Felder pruefen, wie sie hereinkommen.</summary>
    private static bool Sealed(
        IReadOnlyList<Calendar.SealedField>? given, out List<Sealing> found, out string complaint)
    {
        found = [];
        complaint = string.Empty;

        foreach (var one in given ?? [])
        {
            var name = (one.Field ?? string.Empty).Trim().ToLowerInvariant();

            if (!SealableFields.Contains(name))
            {
                complaint = "Zapieczętować można ofiarodawcę albo ofiarę.";
                return false;
            }

            if (!Guid.TryParse(one.AreaId, out var area) || one.Epoch < 1)
            {
                complaint = "Nieczytelny obszar albo epoka pola.";
                return false;
            }

            byte[] blob;
            try { blob = Base64Url.Decode(one.Sealed ?? string.Empty); }
            catch (FormatException)
            {
                complaint = "Nieczytelna zapieczętowana treść.";
                return false;
            }

            if (blob.Length == 0)
            {
                complaint = "Puste pole nie jest zapieczętowane.";
                return false;
            }

            found.Add(new Sealing(name, area, one.Epoch, blob));
        }

        if (found.Select(f => f.Field).Distinct().Count() != found.Count)
        {
            complaint = "To samo pole dwa razy.";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Darf man unter JEDEN genannten Bereich schreiben?
    ///
    /// <para>
    /// Ohne diese Runde liesse sich eine Huelle unter einen fremden Bereich
    /// haengen: sie stuende dort, niemand koennte sie oeffnen, und der Fremde
    /// faende sie in seiner Epoche wieder, ohne je davon gehoert zu haben.
    /// </para>
    /// </summary>
    private static async Task<bool> MayAllAsync(
        SqlConnection connection, Guid accountId, List<Sealing> fields, CancellationToken ct)
    {
        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (!await Area.MayAsync(connection, accountId, areaId, Capability.Write, ct)) return false;
        }

        return true;
    }

    /// <summary>
    /// Die versiegelten Felder ablegen — ersetzend, nicht haeufend.
    ///
    /// <para>
    /// Ein zweiter Aufruf zu demselben Feld ersetzt den ersten: der Browser
    /// schickt eine Gabe, die er neu versiegelt hat, und nicht eine zweite Gabe.
    /// </para>
    /// </summary>
    private static async Task WriteFieldsAsync(
        SqlConnection connection, SqlTransaction tx, Guid intentionId,
        List<Sealing> fields, DateTimeOffset now, CancellationToken ct)
    {
        foreach (var (field, areaId, epoch, blob) in fields)
        {
            await using var upsert = new SqlCommand("""
                UPDATE app.mass_intention_field
                   SET area_id = @area, epoch = @epoch, sealed_blob = @blob, updated_at = @now
                 WHERE intention_id = @intention AND field = @field;

                IF @@ROWCOUNT = 0
                    INSERT INTO app.mass_intention_field
                        (intention_id, field, area_id, epoch, sealed_blob, updated_at)
                    VALUES (@intention, @field, @area, @epoch, @blob, @now);
                """, connection, tx);

            upsert.Parameters.AddWithValue("@intention", intentionId);
            upsert.Parameters.AddWithValue("@field", field);
            upsert.Parameters.AddWithValue("@area", areaId);
            upsert.Parameters.AddWithValue("@epoch", epoch);
            upsert.Parameters.AddWithValue("@blob", blob);
            upsert.Parameters.AddWithValue("@now", now);

            await upsert.ExecuteNonQueryAsync(ct);
        }
    }

    /// <summary>Der Kalendereintrag hinter einer Messe: welcher Bereich, welche Art.</summary>
    private static async Task<(Guid AreaId, string Kind)?> ItemAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id, i.kind
            FROM app.calendar_item i
            JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", itemId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return (reader.GetGuid(0), reader.GetString(1));
    }

    private static async Task<Dictionary<(Guid, DateTimeOffset), (bool Cancelled, DateTimeOffset? MovedTo)>>
        ExceptionsAsync(SqlConnection connection, List<Guid> itemIds, CancellationToken ct)
    {
        var map = new Dictionary<(Guid, DateTimeOffset), (bool, DateTimeOffset?)>();
        if (itemIds.Count == 0) return map;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));

        await using var cmd = new SqlCommand(
            $"SELECT item_id, original_start, cancelled, moved_to FROM app.calendar_exception "
            + $"WHERE item_id IN ({names});", connection);

        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            map[(reader.GetGuid(0), reader.GetDateTimeOffset(1))] =
                (reader.GetBoolean(2), reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3));
        }

        return map;
    }

    private sealed record Held(
        Guid Id, Guid ItemId, DateTimeOffset At, int Ordinal, string Text,
        string Kind, string Status, Guid? Celebrant, List<Sealing> Fields);

    /// <summary>
    /// Die Intentionen im Fenster.
    ///
    /// <para>
    /// In ZWEI Abfragen und nicht einer je Messe: ein Wochenplan mit zwanzig
    /// Messen waere sonst einundzwanzig Runden zur Datenbank, und das sieht man
    /// dem Aushang an.
    /// </para>
    /// </summary>
    private static async Task<List<Held>> IntentionsAsync(
        SqlConnection connection, List<Guid> itemIds, DateTimeOffset from, DateTimeOffset to,
        bool withCancelled, CancellationToken ct)
    {
        var held = new List<Held>();
        if (itemIds.Count == 0) return held;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));

        await using (var cmd = new SqlCommand($"""
            SELECT n.id, n.item_id, n.occurrence_at, n.ordinal, n.text_public,
                   n.kind, n.status, n.celebrant_role_id
            FROM app.mass_intention n
            WHERE n.item_id IN ({names})
              AND n.occurrence_at BETWEEN @from AND @to
              {(withCancelled ? "" : "AND n.status <> N'cancelled'")}
            ORDER BY n.occurrence_at, n.ordinal;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@from", from);
            cmd.Parameters.AddWithValue("@to", to);
            for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                held.Add(new Held(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetDateTimeOffset(2),
                    reader.GetInt32(3), reader.GetString(4), reader.GetString(5), reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetGuid(7),
                    []));
            }
        }

        if (held.Count == 0) return held;

        /*
         * Geber und Gabe. Sie gehen NUR in die Kanzlei hinaus — am Aushang
         * werden sie nicht einmal geholt.
         */
        if (!withCancelled) return held;

        var byId = held.ToDictionary(h => h.Id);
        var ids = string.Join(", ", held.Select((_, i) => $"@n{i}"));

        await using (var cmd = new SqlCommand(
            $"SELECT intention_id, field, area_id, epoch, sealed_blob FROM app.mass_intention_field "
            + $"WHERE intention_id IN ({ids}) ORDER BY intention_id, field;", connection))
        {
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@n{i}", held[i].Id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (byId.TryGetValue(reader.GetGuid(0), out var one))
                {
                    one.Fields.Add(new Sealing(
                        reader.GetString(1), reader.GetGuid(2), reader.GetInt32(3), (byte[])reader[4]));
                }
            }
        }

        return held;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
