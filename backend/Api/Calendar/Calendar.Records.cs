using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0132 — EINTRÄGE AN EINEM VORKOMMEN (<c>app.occurrence_record</c>).
///
/// <para>
/// <b>Eine Liste je Schema</b>: Intentionen an einer Messe (<c>intencje</c>),
/// Anmeldungen an einem Treffen, Dienste … Was eine Liste erlaubt (allein
/// oder zusammen, wie viele, wer darf), steht in ihrer Regel im versiegelten
/// Schema und läuft im Browser. Der Dienst prüft, was er prüfen kann: wer
/// schreibt, dass das Vorkommen stattfindet, dass ein Mensch an einem Vorkommen
/// höchstens EINEN einzelnen Eintrag je Liste hat.
/// </para>
///
/// <para>
/// <b>Von aussen</b> (wer die Termine sieht, aber im Kalender nicht schreibt —
/// Mitglieder, Linkhalter): ein Eintrag wartet immer auf die Kanzlei, nennt
/// höchstens die eigene Person und trägt nur offene Felder.
/// </para>
///
/// <para>
/// <b>Die Intentionen sind hierher gezogen</b> (Liste <c>intencje</c>, dieselben
/// Kennungen). Was ein alter Dienst nach der Migration noch in
/// <c>app.mass_intention</c> schrieb, holt der erste Zugriff je Prozess nach;
/// wird ein Eintrag gelöscht, geht sein Zwilling dort mit — sonst stünde er
/// beim nächsten Nachholen wieder auf.
/// </para>
/// </summary>
public static partial class Calendar
{
    internal const string NeedsMigration = "Najpierw trzeba zastosować migrację 0132 (schematy terminów).";
    internal const string NotInPlan = "Tego terminu nie ma w planie w tym dniu — albo jest odwołany.";

    /// <summary>Die Liste der Intentionen — „Msze i nabożeństwa" liest sie.</summary>
    public const string IntentionList = "intencje";

    /// <summary>Was zählt (angenommen, gefeiert) — und was ein Vorkommen festhält (dazu: wartet).</summary>
    internal const string LiveStatuses = "(N'accepted', N'celebrated')";
    internal const string HoldingStatuses = "(N'accepted', N'celebrated', N'waiting')";

    public static readonly string[] RecordStatuses = ["waiting", "accepted", "declined", "cancelled", "celebrated"];

    /* -- Bereit, und nachgeholt ------------------------------------------------------- */

    private static volatile bool caughtUp;
    private static readonly SemaphoreSlim CatchUpGate = new(1, 1);

    /// <summary>
    /// 0132 angewandt? Und — einmal je Prozess — nachgeholt, was ein alter Dienst
    /// nach der Migration noch in <c>app.mass_intention</c> schrieb. Vor einer
    /// Transaktion zu rufen, nicht in ihr.
    /// </summary>
    internal static async Task<bool> RecordsReadyAsync(SqlConnection connection, CancellationToken ct)
    {
        if (!await Schema.RecordsAsync(connection, ct)) return false;
        if (caughtUp) return true;

        await CatchUpGate.WaitAsync(ct);
        try
        {
            if (!caughtUp)
            {
                try { await CatchUpAsync(connection, ct); }
                catch (SqlException e)
                {
                    /* Nachholen darf den Dienst nicht anhalten — was nicht ging, steht im Protokoll. */
                    Console.Error.WriteLine($"0132 catch-up: {e.Number} {e.Message}");
                }
                caughtUp = true;
            }
        }
        finally
        {
            CatchUpGate.Release();
        }

        return true;
    }

    /// <summary>
    /// Kopiert, was in <c>mass_intention</c> nach der Migration neu oder neuer ist —
    /// mit denselben Kennungen, sodass die Hüllen von Ofiarodawca und Ofiara
    /// weiter aufgehen. Gelöscht wird dort nichts.
    /// </summary>
    internal static async Task CatchUpAsync(SqlConnection connection, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            IF OBJECT_ID(N'app.mass_intention', N'U') IS NOT NULL
            BEGIN
                DECLARE @since datetimeoffset(7) =
                    (SELECT TOP 1 applied_at FROM app.schema_version WHERE name = N'0132_appointment_schemes.sql');

                INSERT INTO app.occurrence_record
                    (id, item_id, occurrence_at, list_key, mode, ordinal, status, text_public, role_id,
                     origin, created_by_role_id, created_at, updated_at)
                SELECT n.id, n.item_id, n.occurrence_at, N'intencje', n.kind, n.ordinal, n.status, n.text_public, n.celebrant_role_id,
                       N'legacy', n.created_by_role_id, n.created_at, n.updated_at
                FROM app.mass_intention n
                WHERE NOT EXISTS (SELECT 1 FROM app.occurrence_record r WHERE r.id = n.id)
                  AND (@since IS NULL OR n.updated_at >= @since);

                UPDATE r
                   SET r.item_id = n.item_id, r.occurrence_at = n.occurrence_at, r.mode = n.kind, r.ordinal = n.ordinal,
                       r.status = n.status, r.text_public = n.text_public, r.role_id = n.celebrant_role_id,
                       r.updated_at = n.updated_at
                  FROM app.occurrence_record r
                  JOIN app.mass_intention n ON n.id = r.id
                 WHERE n.updated_at > r.updated_at AND (@since IS NULL OR n.updated_at >= @since);

                INSERT INTO app.occurrence_record_value (record_id, field_key, area_id, epoch, sealed, public_value, updated_at)
                SELECT f.intention_id, f.field, f.area_id, f.epoch, f.sealed_blob, NULL, f.updated_at
                FROM app.mass_intention_field f
                WHERE EXISTS (SELECT 1 FROM app.occurrence_record r WHERE r.id = f.intention_id)
                  AND NOT EXISTS (SELECT 1 FROM app.occurrence_record_value v
                                   WHERE v.record_id = f.intention_id AND v.field_key = f.field);

                UPDATE v
                   SET v.area_id = f.area_id, v.epoch = f.epoch, v.sealed = f.sealed_blob, v.public_value = NULL,
                       v.updated_at = f.updated_at
                  FROM app.occurrence_record_value v
                  JOIN app.mass_intention_field f ON f.intention_id = v.record_id AND f.field = v.field_key
                 WHERE f.updated_at > v.updated_at;
            END
            """, connection);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Einträge löschen — und ihre Zwillinge im Archiv <c>mass_intention</c>, damit
    /// das Nachholen sie nicht wieder hervorholt. <paramref name="where"/> wählt die
    /// Kennungen (ein SQL-Ausdruck über <c>app.occurrence_record</c>).
    /// </summary>
    internal static string DropRecordsSql(string where) => $"""
        DECLARE @gone_records TABLE (id uniqueidentifier PRIMARY KEY);
        INSERT INTO @gone_records (id) SELECT id FROM app.occurrence_record WHERE {where};
        DELETE FROM app.occurrence_record_value WHERE record_id IN (SELECT id FROM @gone_records);
        DELETE FROM app.occurrence_record WHERE id IN (SELECT id FROM @gone_records);
        IF OBJECT_ID(N'app.mass_intention', N'U') IS NOT NULL
        BEGIN
            DELETE FROM app.mass_intention_field WHERE intention_id IN (SELECT id FROM @gone_records);
            DELETE FROM app.mass_intention WHERE id IN (SELECT id FROM @gone_records);
        END
        """;

    /* -- Findet es statt? ------------------------------------------------------------------ */

    /// <summary>
    /// Findet dieser Termin an diesem Vorkommen statt — gehört der Zeitpunkt zur
    /// Reihe, und ist er nicht abgesagt? (Verlegt ist in Ordnung: die Adresse
    /// bleibt der ursprüngliche Beginn.)
    /// </summary>
    internal static async Task<bool> TakesPlaceAsync(SqlConnection connection, Guid itemId, DateTimeOffset at, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT i.starts_at, i.repeat_kind, i.repeat_every, i.repeat_weekdays, i.repeat_until, i.repeat_count, c.time_zone,
                   (SELECT TOP 1 x.cancelled FROM app.calendar_exception x WHERE x.item_id = i.id AND x.original_start = @at)
            FROM app.calendar_item i JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", itemId);
        cmd.Parameters.AddWithValue("@at", at);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return false;
        if (!reader.IsDBNull(7) && reader.GetBoolean(7)) return false;

        var found = Occurrences(
            reader.GetDateTimeOffset(0), reader.GetString(1), reader.GetInt32(2),
            reader.IsDBNull(3) ? null : reader.GetByte(3),
            reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4),
            reader.IsDBNull(5) ? null : reader.GetInt32(5),
            at.AddSeconds(-1), at.AddSeconds(1), Zones.Of(reader.GetString(6)));

        return found.Contains(at);
    }

    /* -- Wie ein neuer Eintrag steht ------------------------------------------------------ */

    /// <summary>
    /// Stand und Herkunft eines neuen Eintrags. Wer im Kalender schreibt, wählt
    /// (angenommen oder wartend; Kanzlei oder Regel); von aussen wartet er immer.
    /// </summary>
    public static (string Status, string Origin)? RecordStanding(bool writer, string? status, string? origin, out string error)
    {
        error = string.Empty;
        if (!writer) return ("waiting", "outside");

        var s = string.IsNullOrWhiteSpace(status) ? "accepted" : status.Trim().ToLowerInvariant();
        var o = string.IsNullOrWhiteSpace(origin) ? "office" : origin.Trim().ToLowerInvariant();

        if (s is not ("accepted" or "waiting"))
        {
            error = "Stan nowego wpisu: przyjęty albo czeka.";
            return null;
        }

        if (o is not ("office" or "rule"))
        {
            error = "Pochodzenie wpisu: kancelaria albo reguła.";
            return null;
        }

        return (s, o);
    }

    /* -- Zählen ------------------------------------------------------------------------------ */

    /// <summary>
    /// Wie viele Einträge je Liste an jedem Vorkommen hängen — angenommene oder
    /// gefeierte (<c>live</c>) und wartende. EINE Abfrage für das ganze Fenster.
    /// </summary>
    internal static async Task<Dictionary<(Guid, DateTimeOffset), Dictionary<string, (int Live, int Waiting)>>> RecordCountsAsync(
        SqlConnection connection, IReadOnlyList<Guid> itemIds, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var map = new Dictionary<(Guid, DateTimeOffset), Dictionary<string, (int, int)>>();
        if (itemIds.Count == 0 || !await Schema.RecordsAsync(connection, ct)) return map;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT item_id, occurrence_at, list_key,
                   SUM(CASE WHEN status IN {LiveStatuses} THEN 1 ELSE 0 END),
                   SUM(CASE WHEN status = N'waiting' THEN 1 ELSE 0 END)
            FROM app.occurrence_record
            WHERE item_id IN ({names}) AND occurrence_at BETWEEN @from AND @to
            GROUP BY item_id, occurrence_at, list_key;
            """, connection);
        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);
        cmd.Parameters.AddWithValue("@from", from);
        cmd.Parameters.AddWithValue("@to", to);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var key = (reader.GetGuid(0), reader.GetDateTimeOffset(1));
            if (!map.TryGetValue(key, out var lists)) map[key] = lists = [];
            var (live, waiting) = (reader.GetInt32(3), reader.GetInt32(4));
            if (live + waiting > 0) lists[reader.GetString(2)] = (live, waiting);
        }

        return map;
    }

    /// <summary>Die Zahlen eines Vorkommens, wie sie hinausgehen: <c>{ "intencje": { live, waiting } }</c>.</summary>
    internal static Dictionary<string, object> CountsAt(
        Dictionary<(Guid, DateTimeOffset), Dictionary<string, (int Live, int Waiting)>> map, Guid itemId, DateTimeOffset at) =>
        map.TryGetValue((itemId, at), out var lists)
            ? lists.ToDictionary(p => p.Key, p => (object)new { live = p.Value.Live, waiting = p.Value.Waiting })
            : [];

    /* -- Lesen ---------------------------------------------------------------------------------- */

    private sealed record RecordRow(
        Guid Id, Guid ItemId, DateTimeOffset At, string List, string? Mode, int Ordinal, string Status,
        string? Text, Guid? Role, string Origin, Guid? CreatedBy);

    private sealed record RecordValueRow(string Field, Guid? AreaId, int? Epoch, byte[]? Blob, string? Value);

    /// <summary>Die Einträge eines Termins im Fenster.</summary>
    private static async Task ItemRecordsAsync(HttpContext ctx, Db db, Guid id, string? from, string? to)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid visibility, calendarArea;
        await using (var find = new SqlCommand("""
            SELECT i.visibility_area_id, c.area_id FROM app.calendar_item i JOIN app.calendar c ON c.id = i.calendar_id WHERE i.id = @id;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma.");
                return;
            }
            visibility = reader.GetGuid(0);
            calendarArea = reader.GetGuid(1);
        }

        var writer = await Area.MayAsync(connection, caller, calendarArea, Capability.Write, ctx.RequestAborted);
        if (!writer && !await Area.MayAsync(connection, caller, visibility, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma.");
            return;
        }

        if (!await RecordsReadyAsync(connection, ctx.RequestAborted))
        {
            await ctx.Response.WriteAsJsonAsync(new { records = Array.Empty<object>() });
            return;
        }

        var rows = await RecordRowsAsync(connection, "r.item_id = @id", c => c.Parameters.AddWithValue("@id", id), since, till, null, ctx.RequestAborted);
        await WriteRecordsAsync(ctx, connection, caller, rows, _ => writer);
    }

    /// <summary>
    /// Die Einträge ALLER Termine eines Kalenders im Fenster — für die Regel einer
    /// Liste („wie viele zusammengelegte Intentionen in dieser Woche"). Was ein
    /// Leser nicht sehen darf, fehlt.
    /// </summary>
    private static async Task CalendarRecordsAsync(HttpContext ctx, Db db, Guid id, string? from, string? to, string? list)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Window(from, to, out var since, out var till))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zakres dat jest nieczytelny albo za długi.");
            return;
        }

        var wanted = string.IsNullOrWhiteSpace(list) ? null : list.Trim();
        if (wanted is not null && !ValidKey(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna lista.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid calendarArea;
        Guid? seeing;
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
            seeing = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var writer = await Area.MayAsync(connection, caller, calendarArea, Capability.Write, ctx.RequestAborted);
        if (!writer
            && !await Area.MayAsync(connection, caller, calendarArea, Capability.Read, ctx.RequestAborted)
            && !(seeing is not null && await Area.MayAsync(connection, caller, seeing.Value, Capability.Read, ctx.RequestAborted)))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        if (!await RecordsReadyAsync(connection, ctx.RequestAborted))
        {
            await ctx.Response.WriteAsJsonAsync(new { records = Array.Empty<object>() });
            return;
        }

        /* Was der Leser von den Terminen sieht — dieselbe Schranke wie die Agenda. */
        var readable = writer ? null : (await ReadableAreasAsync(connection, caller.AccountId, ctx.RequestAborted,
            linkRoles: caller.ByLinks ? caller.RoleIds : null)).ToHashSet();

        var rows = await RecordRowsAsync(connection, "i.calendar_id = @cal", c => c.Parameters.AddWithValue("@cal", id),
            since, till, wanted, ctx.RequestAborted, readable);
        await WriteRecordsAsync(ctx, connection, caller, rows, _ => writer);
    }

    private static async Task<List<RecordRow>> RecordRowsAsync(
        SqlConnection connection, string where, Action<SqlCommand> bind, DateTimeOffset since, DateTimeOffset till,
        string? list, CancellationToken ct, HashSet<Guid>? readable = null)
    {
        var rows = new List<RecordRow>();
        await using var cmd = new SqlCommand($"""
            SELECT r.id, r.item_id, r.occurrence_at, r.list_key, r.mode, r.ordinal, r.status, r.text_public, r.role_id,
                   r.origin, r.created_by_role_id, i.visibility_area_id
            FROM app.occurrence_record r
            JOIN app.calendar_item i ON i.id = r.item_id
            WHERE {where} AND r.occurrence_at BETWEEN @from AND @to {(list is null ? "" : "AND r.list_key = @list")}
            ORDER BY r.occurrence_at, r.list_key, r.ordinal, r.created_at;
            """, connection);
        bind(cmd);
        cmd.Parameters.AddWithValue("@from", since);
        cmd.Parameters.AddWithValue("@to", till);
        if (list is not null) cmd.Parameters.AddWithValue("@list", list);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (readable is not null && !readable.Contains(reader.GetGuid(11))) continue;
            rows.Add(new RecordRow(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetDateTimeOffset(2), reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetInt32(5), reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.IsDBNull(8) ? null : reader.GetGuid(8),
                reader.GetString(9),
                reader.IsDBNull(10) ? null : reader.GetGuid(10)));
        }

        return rows;
    }

    /// <summary>
    /// Was hinausgeht: wer im Kalender schreibt, sieht alles; ein Leser die
    /// angenommenen und gefeierten Einträge und seine eigenen — mit den offenen
    /// Feldern, versiegelte nur an seinen eigenen.
    /// </summary>
    private static async Task WriteRecordsAsync(
        HttpContext ctx, SqlConnection connection, Caller caller, List<RecordRow> rows, Func<RecordRow, bool> writerFor)
    {
        var mineIds = caller.RoleIds.ToHashSet();
        var shown = rows.Where(r => writerFor(r) || r.Status is "accepted" or "celebrated"
            || (r.CreatedBy is not null && mineIds.Contains(r.CreatedBy.Value))).ToList();

        var values = new Dictionary<Guid, List<RecordValueRow>>();
        if (shown.Count > 0)
        {
            foreach (var chunk in shown.Chunk(500))
            {
                var names = string.Join(", ", chunk.Select((_, i) => $"@r{i}"));
                await using var cmd = new SqlCommand($"""
                    SELECT record_id, field_key, area_id, epoch, sealed, public_value
                    FROM app.occurrence_record_value WHERE record_id IN ({names}) ORDER BY record_id, field_key;
                    """, connection);
                for (var i = 0; i < chunk.Length; i++) cmd.Parameters.AddWithValue($"@r{i}", chunk[i].Id);

                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    var record = reader.GetGuid(0);
                    if (!values.TryGetValue(record, out var list)) values[record] = list = [];
                    list.Add(new RecordValueRow(reader.GetString(1),
                        reader.IsDBNull(2) ? null : reader.GetGuid(2),
                        reader.IsDBNull(3) ? null : reader.GetInt32(3),
                        reader.IsDBNull(4) ? null : (byte[])reader[4],
                        reader.IsDBNull(5) ? null : reader.GetString(5)));
                }
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            records = shown.Select(r =>
            {
                var mine = r.CreatedBy is not null && mineIds.Contains(r.CreatedBy.Value);
                var full = writerFor(r) || mine;
                return new
                {
                    recordId = Ids.ToText(r.Id),
                    itemId = Ids.ToText(r.ItemId),
                    occurrenceAt = r.At,
                    listKey = r.List,
                    mode = r.Mode,
                    ordinal = r.Ordinal,
                    status = r.Status,
                    textPublic = r.Text,
                    roleId = r.Role is null ? null : Ids.ToText(r.Role.Value),
                    origin = r.Origin,
                    createdByRoleId = r.CreatedBy is null ? null : Ids.ToText(r.CreatedBy.Value),
                    mine,
                    values = values.TryGetValue(r.Id, out var list)
                        ? list.Where(v => full || v.Value is not null).Select(v => new
                        {
                            field = v.Field,
                            areaId = !full || v.AreaId is null ? null : Ids.ToText(v.AreaId.Value),
                            epoch = full ? v.Epoch : null,
                            @sealed = !full || v.Blob is null ? null : Base64Url.Encode(v.Blob),
                            value = v.Value
                        })
                        : []
                };
            })
        });
    }

    /* -- Anlegen ---------------------------------------------------------------------------------- */

    public sealed record RecordRequest(
        string? RecordId, string? OccurrenceAt, string? ListKey, string? Mode, int? Ordinal, string? Status,
        string? TextPublic, string? RoleId, string? Origin, IReadOnlyList<ValueIn>? Values);

    private static async Task AddRecordAsync(HttpContext ctx, Db db, Guid id, RecordRequest body)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RecordId, out var recordId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wpis musi przyjść z własną kennung.");
            return;
        }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        var list = (body.ListKey ?? string.Empty).Trim();
        if (!ValidKey(list))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna lista.");
            return;
        }

        var mode = string.IsNullOrWhiteSpace(body.Mode) ? null : body.Mode.Trim();
        if (mode is { Length: > 40 })
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za długi rodzaj wpisu.");
            return;
        }

        var text = string.IsNullOrWhiteSpace(body.TextPublic) ? null : body.TextPublic.Trim();
        if (text is { Length: > MaxValueText })
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za długi tekst wpisu.");
            return;
        }

        Guid? role = null;
        if (!string.IsNullOrWhiteSpace(body.RoleId))
        {
            if (!Guid.TryParse(body.RoleId, out var parsedRole))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung osoby.");
                return;
            }
            role = parsedRole;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid visibility, calendarArea;
        await using (var find = new SqlCommand("""
            SELECT i.visibility_area_id, c.area_id FROM app.calendar_item i JOIN app.calendar c ON c.id = i.calendar_id WHERE i.id = @id;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma.");
                return;
            }
            visibility = reader.GetGuid(0);
            calendarArea = reader.GetGuid(1);
        }

        var writer = await Area.MayAsync(connection, caller, calendarArea, Capability.Write, ctx.RequestAborted);
        if (!writer && !await Area.MayAsync(connection, caller, visibility, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma.");
            return;
        }

        if (!await RecordsReadyAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NeedsMigration);
            return;
        }

        var standing = RecordStanding(writer, body.Status, body.Origin, out var error);
        if (standing is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error);
            return;
        }

        if (!ParseValues(body.Values, MaxRecordValues, labels: false, sealedAllowed: writer, allowEmpty: false, out var values, out error))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error);
            return;
        }

        if (!writer && role is not null && !caller.Holds(role.Value))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Z zewnątrz można wpisać tylko siebie.");
            return;
        }

        if (!await MayAllValuesAsync(connection, caller, values, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
            return;
        }

        if (!await TakesPlaceAsync(connection, id, at, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, NotInPlan);
            return;
        }

        var ordinal = body.Ordinal;
        if (ordinal is null)
        {
            await using var next = new SqlCommand("""
                SELECT ISNULL(MAX(ordinal), -1) + 1 FROM app.occurrence_record
                WHERE item_id = @item AND occurrence_at = @at AND list_key = @list;
                """, connection);
            next.Parameters.AddWithValue("@item", id);
            next.Parameters.AddWithValue("@at", at);
            next.Parameters.AddWithValue("@list", list);
            ordinal = (int)(await next.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
        }

        var now = DateTimeOffset.UtcNow;
        var self = Workspace.SelfOf(caller.Roles);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.occurrence_record
                    (id, item_id, occurrence_at, list_key, mode, ordinal, status, text_public, role_id,
                     origin, created_by_role_id, created_at, updated_at)
                VALUES (@id, @item, @at, @list, @mode, @ord, @status, @text, @role, @origin, @by, @now, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", recordId);
                insert.Parameters.AddWithValue("@item", id);
                insert.Parameters.AddWithValue("@at", at);
                insert.Parameters.AddWithValue("@list", list);
                insert.Parameters.AddWithValue("@mode", (object?)mode ?? DBNull.Value);
                insert.Parameters.AddWithValue("@ord", Math.Clamp(ordinal.Value, 0, 100_000));
                insert.Parameters.AddWithValue("@status", standing.Value.Status);
                insert.Parameters.AddWithValue("@text", (object?)text ?? DBNull.Value);
                insert.Parameters.AddWithValue("@role", (object?)role ?? DBNull.Value);
                insert.Parameters.AddWithValue("@origin", standing.Value.Origin);
                /* Wer es eintrug: die Person (0040), sonst die Linkrolle. */
                insert.Parameters.AddWithValue("@by", self is not null ? (object)self.Value.Id
                    : caller.Roles.Count > 0 ? (object)caller.Roles[0].Id : DBNull.Value);
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await UpsertRecordValuesAsync(connection, tx, recordId, values, now, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, e.Message.Contains("uq_occurrence_record_single", StringComparison.Ordinal)
                ? "Ta osoba ma już pojedynczy wpis na tym terminie."
                : "Taki wpis już jest.");
            return;
        }
        catch (SqlException e) when (e.Number == 547)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej osoby.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            recordId = Ids.ToText(recordId),
            ordinal = Math.Clamp(ordinal.Value, 0, 100_000),
            status = standing.Value.Status
        });
    }

    /// <summary>Die Werte eines Eintrags: ersetzen, was genannt ist; ein Feld ohne Wert fällt fort.</summary>
    internal static async Task UpsertRecordValuesAsync(
        SqlConnection connection, SqlTransaction tx, Guid recordId, List<ValueRow> values, DateTimeOffset now, CancellationToken ct)
    {
        foreach (var v in values)
        {
            await using var cmd = new SqlCommand(v.Empty ? """
                DELETE FROM app.occurrence_record_value WHERE record_id = @record AND field_key = @field;
                """ : """
                UPDATE app.occurrence_record_value
                   SET area_id = @area, epoch = @epoch, sealed = @blob, public_value = @value, updated_at = @now
                 WHERE record_id = @record AND field_key = @field;

                IF @@ROWCOUNT = 0
                    INSERT INTO app.occurrence_record_value (record_id, field_key, area_id, epoch, sealed, public_value, updated_at)
                    VALUES (@record, @field, @area, @epoch, @blob, @value, @now);
                """, connection, tx);
            cmd.Parameters.AddWithValue("@record", recordId);
            cmd.Parameters.AddWithValue("@field", v.Field);
            if (!v.Empty)
            {
                cmd.Parameters.AddWithValue("@area", v.Blob is null ? DBNull.Value : (object)v.AreaId!.Value);
                cmd.Parameters.AddWithValue("@epoch", v.Blob is null ? DBNull.Value : (object)v.Epoch!.Value);
                cmd.Parameters.Add("@blob", System.Data.SqlDbType.VarBinary, -1).Value = (object?)v.Blob ?? DBNull.Value;
                cmd.Parameters.AddWithValue("@value", (object?)v.Value ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@now", now);
            }
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    /* -- Ändern -------------------------------------------------------------------------------------- */

    /// <param name="RoleId">Fehlt: bleibt; <c>""</c>: niemand mehr; sonst dieser Mensch.</param>
    /// <param name="TextPublic">Fehlt: bleibt; <c>""</c>: kein offener Text mehr.</param>
    /// <param name="ItemId">Zusammen mit <c>OccurrenceAt</c>: an ein anderes Vorkommen (eines anderen Termins) verlegen.</param>
    public sealed record RecordUpdate(
        string? Status, string? Mode, int? Ordinal, string? TextPublic, string? RoleId,
        IReadOnlyList<ValueIn>? Values, string? ItemId, string? OccurrenceAt);

    private static async Task UpdateRecordAsync(HttpContext ctx, Db db, Guid id, RecordUpdate body)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var status = string.IsNullOrWhiteSpace(body.Status) ? null : body.Status.Trim().ToLowerInvariant();
        if (status is not null && !RecordStatuses.Contains(status))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Stan wpisu: czeka, przyjęty, odrzucony, wycofany albo zakończony.");
            return;
        }

        var mode = body.Mode is null ? null : body.Mode.Trim();
        if (mode is { Length: > 40 })
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za długi rodzaj wpisu.");
            return;
        }

        var text = body.TextPublic?.Trim();
        if (text is { Length: > MaxValueText })
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za długi tekst wpisu.");
            return;
        }

        Guid? role = null;
        var clearRole = body.RoleId is not null && body.RoleId.Trim() == "";
        if (!string.IsNullOrWhiteSpace(body.RoleId))
        {
            if (!Guid.TryParse(body.RoleId, out var parsedRole))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung osoby.");
                return;
            }
            role = parsedRole;
        }

        if (!ParseValues(body.Values, MaxRecordValues, labels: false, sealedAllowed: true, allowEmpty: true, out var values, out var error))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error);
            return;
        }

        Guid? moveTo = null;
        DateTimeOffset? moveAt = null;
        if (body.ItemId is not null || body.OccurrenceAt is not null)
        {
            if (!Guid.TryParse(body.ItemId, out var target)
                || !DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var targetAt))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin, na który przenieść.");
                return;
            }
            moveTo = target;
            moveAt = targetAt;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await RecordsReadyAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NeedsMigration);
            return;
        }

        Guid itemId, calendarArea;
        string list;
        Guid? createdBy;
        await using (var find = new SqlCommand("""
            SELECT r.item_id, r.list_key, r.created_by_role_id, c.area_id
            FROM app.occurrence_record r
            JOIN app.calendar_item i ON i.id = r.item_id
            JOIN app.calendar c ON c.id = i.calendar_id
            WHERE r.id = @id;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
                return;
            }
            itemId = reader.GetGuid(0);
            list = reader.GetString(1);
            createdBy = reader.IsDBNull(2) ? null : reader.GetGuid(2);
            calendarArea = reader.GetGuid(3);
        }

        var writer = await Area.MayAsync(connection, caller, calendarArea, Capability.Write, ctx.RequestAborted);
        if (!writer)
        {
            /* Wer ihn eintrug, darf ihn zurückziehen — und nur das. */
            var own = createdBy is not null && caller.Holds(createdBy.Value);
            var onlyWithdraw = status == "cancelled" && mode is null && body.Ordinal is null && text is null
                && body.RoleId is null && values.Count == 0 && moveTo is null;
            if (!own || !onlyWithdraw)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma — albo nie możesz go zmieniać.");
                return;
            }
        }

        if (!await MayAllValuesAsync(connection, caller, values, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
            return;
        }

        int? appendAt = null;
        if (moveTo is not null)
        {
            var targetArea = await AreaOfItemAsync(connection, moveTo.Value, ctx.RequestAborted);
            if (targetArea is null || !await Area.MayAsync(connection, caller, targetArea.Value, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz w nim pisać.");
                return;
            }

            if (!await TakesPlaceAsync(connection, moveTo.Value, moveAt!.Value, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, NotInPlan);
                return;
            }

            if (body.Ordinal is null)
            {
                await using var next = new SqlCommand("""
                    SELECT ISNULL(MAX(ordinal), -1) + 1 FROM app.occurrence_record
                    WHERE item_id = @item AND occurrence_at = @at AND list_key = @list AND id <> @id;
                    """, connection);
                next.Parameters.AddWithValue("@item", moveTo.Value);
                next.Parameters.AddWithValue("@at", moveAt.Value);
                next.Parameters.AddWithValue("@list", list);
                next.Parameters.AddWithValue("@id", id);
                appendAt = (int)(await next.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
            }
        }

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var update = new SqlCommand("""
                UPDATE app.occurrence_record
                SET status        = ISNULL(@status, status),
                    mode          = CASE WHEN @clearMode = 1 THEN NULL ELSE ISNULL(@mode, mode) END,
                    ordinal       = ISNULL(@ord, ordinal),
                    text_public   = CASE WHEN @clearText = 1 THEN NULL ELSE ISNULL(@text, text_public) END,
                    role_id       = CASE WHEN @clearRole = 1 THEN NULL ELSE ISNULL(@role, role_id) END,
                    item_id       = ISNULL(@moveTo, item_id),
                    occurrence_at = ISNULL(@moveAt, occurrence_at),
                    updated_at    = @now
                WHERE id = @id;
                """, connection, tx))
            {
                update.Parameters.AddWithValue("@status", (object?)status ?? DBNull.Value);
                update.Parameters.AddWithValue("@clearMode", mode == "" ? 1 : 0);
                update.Parameters.AddWithValue("@mode", mode is null or "" ? DBNull.Value : mode);
                update.Parameters.AddWithValue("@ord", (object?)body.Ordinal ?? (object?)appendAt ?? DBNull.Value);
                update.Parameters.AddWithValue("@clearText", text == "" ? 1 : 0);
                update.Parameters.AddWithValue("@text", text is null or "" ? DBNull.Value : text);
                update.Parameters.AddWithValue("@clearRole", clearRole ? 1 : 0);
                update.Parameters.AddWithValue("@role", (object?)role ?? DBNull.Value);
                update.Parameters.AddWithValue("@moveTo", (object?)moveTo ?? DBNull.Value);
                update.Parameters.AddWithValue("@moveAt", (object?)moveAt ?? DBNull.Value);
                update.Parameters.AddWithValue("@now", now);
                update.Parameters.AddWithValue("@id", id);
                await update.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await UpsertRecordValuesAsync(connection, tx, id, values, now, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, list == IntentionList
                ? "Ten kapłan ma już pojedynczą intencję na tej mszy — dwie pojedyncze to dwóch kapłanów."
                : "Ta osoba ma już pojedynczy wpis na tym terminie.");
            return;
        }
        catch (SqlException e) when (e.Number == 547)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej osoby.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { recordId = Ids.ToText(id), updated = true });
    }

    /* -- Löschen ---------------------------------------------------------------------------------------- */

    /// <summary>
    /// Einen Eintrag löschen (ein Tippfehler, doppelt eingetragen). Ein
    /// gefeierter bleibt: er ist die Auskunft, dass es geschah — war das ein
    /// Irrtum, wird erst sein Stand zurückgesetzt.
    /// </summary>
    private static async Task DeleteRecordAsync(HttpContext ctx, Db db, Guid id)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await RecordsReadyAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NeedsMigration);
            return;
        }

        string status, list;
        Guid calendarArea;
        await using (var find = new SqlCommand("""
            SELECT r.status, r.list_key, c.area_id
            FROM app.occurrence_record r
            JOIN app.calendar_item i ON i.id = r.item_id
            JOIN app.calendar c ON c.id = i.calendar_id
            WHERE r.id = @id;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
                return;
            }
            status = reader.GetString(0);
            list = reader.GetString(1);
            calendarArea = reader.GetGuid(2);
        }

        if (!await Area.MayAsync(connection, caller, calendarArea, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma — albo nie możesz go usunąć.");
            return;
        }

        if (status == "celebrated")
        {
            await Fail(ctx, StatusCodes.Status409Conflict, list == IntentionList
                ? "Odprawionej intencji się nie usuwa — jeśli to pomyłka, zmień najpierw jej stan."
                : "Zakończonego wpisu się nie usuwa — jeśli to pomyłka, zmień najpierw jego stan.");
            return;
        }

        await using var drop = new SqlCommand(DropRecordsSql("id = @id"), connection);
        drop.Parameters.AddWithValue("@id", id);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { recordId = Ids.ToText(id), deleted = true });
    }
}
