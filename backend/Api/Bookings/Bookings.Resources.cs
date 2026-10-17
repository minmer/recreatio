using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Zasoby anlegen, ändern und auflisten.</summary>
public static partial class Bookings
{
    /* ======================================================================
       DIE KANZLEI: DINGE
       ====================================================================== */

    /// <summary>Die Dinge in Bereichen, die ich lesen darf.</summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var rows = new List<ResourceRow>();

        await using (var cmd = new SqlCommand(
            $"SELECT {ResourceColumns} FROM app.resource ORDER BY name;", connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) rows.Add(ReadResource(reader));
        }

        var readable = new Dictionary<Guid, bool>();
        var shown = new List<object>();

        foreach (var row in rows)
        {
            if (!readable.TryGetValue(row.AreaId, out var may))
            {
                may = await Area.MayAsync(connection, who.Value.AccountId, row.AreaId,
                    Capability.Read, ctx.RequestAborted);
                readable[row.AreaId] = may;
            }

            if (!may) continue;

            shown.Add(await Shape(connection, row, ctx.RequestAborted));
        }

        await ctx.Response.WriteAsJsonAsync(new { resources = shown });
    }

    private static async Task<object> Shape(SqlConnection connection, ResourceRow row, CancellationToken ct)
    {
        int pending;

        await using (var cmd = new SqlCommand("""
            SELECT COUNT(*) FROM app.claim
            WHERE resource_id = @r AND status = N'pending' AND awaits = N'office';
            """, connection))
        {
            cmd.Parameters.AddWithValue("@r", row.Id);
            pending = (int)(await cmd.ExecuteScalarAsync(ct))!;
        }

        return new
        {
            resourceId = Ids.ToText(row.Id),
            areaId = Ids.ToText(row.AreaId),
            parentId = row.ParentId is null ? null : Ids.ToText(row.ParentId.Value),
            calendarId = row.CalendarId is null ? null : Ids.ToText(row.CalendarId.Value),
            name = row.Name,
            kind = row.Kind,
            mode = row.Mode,
            byNight = row.ByNight,
            checkInMin = row.CheckInMin,
            checkOutMin = row.CheckOutMin,
            capacity = row.Capacity,
            bufferBefore = row.BufferBefore,
            bufferAfter = row.BufferAfter,
            approval = row.Approval,
            inviteHours = row.InviteHours,
            leadDays = row.LeadDays,
            perPerson = row.PerPerson,
            minPersons = row.MinPersons,
            reserveAreaId = row.ReserveAreaId is null ? null : Ids.ToText(row.ReserveAreaId.Value),
            bookableDefault = row.BookableDefault,

            /* Was auf ein Ja der Kanzlei wartet — die Zahl, die zuerst zaehlt. */
            pending
        };
    }

    public sealed record ResourceBody(
        string? ResourceId, string? AreaId, string? ParentId, string? CalendarId,
        string? Name, string? Kind, string? Mode, bool? ByNight, int? CheckInMin, int? CheckOutMin,
        int? Capacity, int? BufferBefore, int? BufferAfter, string? Approval,
        int? InviteHours, int? LeadDays, int? PerPerson = null, int? MinPersons = null,

        /* 0058 — "" löscht: dann darf wieder jeder, der den Termin findet. */
        string? ReserveAreaId = null, bool? BookableDefault = null);

    private static async Task CreateAsync(HttpContext ctx, Db db, ResourceBody body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ResourceId, out var id) || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zasób albo obszar.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var draft = new ResourceRow(id, areaId, null, null, "", "other", "offered", false,
            960, 600, 1, 0, 0, "none", 0, 0, 0, 2);

        var (row, error) = await Merge(connection, draft, body, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error!);
            return;
        }

        await using (var cmd = new SqlCommand("""
            INSERT INTO app.resource
                (id, area_id, parent_id, calendar_id, name, kind, mode, by_night, check_in_min,
                 check_out_min, capacity, buffer_before, buffer_after, approval, invite_hours,
                 lead_days, per_person, min_persons, reserve_area_id, bookable_default, created_at, updated_at)
            VALUES
                (@id, @area, @parent, @cal, @name, @kind, @mode, @night, @in, @out,
                 @cap, @bb, @ba, @appr, @inv, @lead, @pp, @min, @reserve, @bookable, @now, @now);
            """, connection))
        {
            Bind(cmd, row);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Taki zasób już jest.");
                return;
            }
            catch (SqlException e) when (e.Number == 547)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Tak się nie da — sprawdź tryb, kalendarz i liczby.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(await Shape(connection, row, ctx.RequestAborted));
    }

    private static async Task UpdateAsync(HttpContext ctx, Db db, Guid id, ResourceBody body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ResourceAsync(connection, id, ctx.RequestAborted);
        if (found is null
            || !await Area.MayAsync(connection, who.Value.AccountId, found.AreaId,
                   Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zasobu nie ma.");
            return;
        }

        var (row, error) = await Merge(connection, found, body, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error!);
            return;
        }

        await using (var cmd = new SqlCommand("""
            UPDATE app.resource
               SET parent_id = @parent, calendar_id = @cal, name = @name, kind = @kind,
                   mode = @mode, by_night = @night, check_in_min = @in, check_out_min = @out,
                   capacity = @cap, buffer_before = @bb, buffer_after = @ba, approval = @appr,
                   invite_hours = @inv, lead_days = @lead, per_person = @pp, min_persons = @min,
                   reserve_area_id = @reserve, bookable_default = @bookable, updated_at = @now
             WHERE id = @id;
            """, connection))
        {
            Bind(cmd, row);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
            catch (SqlException e) when (e.Number == 547)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Tak się nie da — sprawdź tryb, kalendarz i liczby.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(await Shape(connection, row, ctx.RequestAborted));
    }

    /// <summary>
    /// Was hereinkommt, ueber das, was dasteht — und gepruefter, als die
    /// Datenbank es koennte.
    ///
    /// <para>
    /// <b>Vater und Kalender muessen im SELBEN Bereich liegen.</b> Sonst haengte
    /// jemand sein Zimmer unter ein fremdes Haus, oder boete Termine aus einem
    /// Kalender an, den er nicht fuehrt — und ein Fremdschluessel merkte das
    /// nicht, weil es die Zeile ja gibt.
    /// </para>
    /// </summary>
    private static async Task<(ResourceRow? Row, string? Error)> Merge(
        SqlConnection connection, ResourceRow was, ResourceBody body, CancellationToken ct)
    {
        var name = (body.Name ?? was.Name).Trim();
        if (name.Length is 0 or > MaxName) return (null, $"Nazwa: od 1 do {MaxName} znaków.");

        var kind = (body.Kind ?? was.Kind).Trim().ToLowerInvariant();
        if (Array.IndexOf(Kinds, kind) < 0) return (null, "Rodzaj: person, room, house, place albo other.");

        var mode = (body.Mode ?? was.Mode).Trim().ToLowerInvariant();
        if (mode is not ("offered" or "open")) return (null, "Tryb: offered albo open.");

        var approval = (body.Approval ?? was.Approval).Trim().ToLowerInvariant();
        if (approval is not ("none" or "office")) return (null, "Zatwierdzanie: none albo office.");

        var parent = was.ParentId;
        if (body.ParentId is not null)
        {
            if (body.ParentId == "") parent = null;
            else if (!Guid.TryParse(body.ParentId, out var p)) return (null, "Nieczytelny zasób nadrzędny.");
            else
            {
                if (p == was.Id) return (null, "Zasób nie może leżeć sam w sobie.");

                var up = await ResourceAsync(connection, p, ct);
                if (up is null || up.AreaId != was.AreaId)
                    return (null, "Zasób nadrzędny musi być w tym samym obszarze.");

                parent = p;
            }
        }

        var calendar = was.CalendarId;
        if (body.CalendarId is not null)
        {
            if (body.CalendarId == "") calendar = null;
            else if (!Guid.TryParse(body.CalendarId, out var c)) return (null, "Nieczytelny kalendarz.");
            else
            {
                await using var cmd = new SqlCommand(
                    "SELECT area_id FROM app.calendar WHERE id = @c;", connection);
                cmd.Parameters.AddWithValue("@c", c);

                if (await cmd.ExecuteScalarAsync(ct) is not Guid area || area != was.AreaId)
                    return (null, "Kalendarz musi należeć do tego samego obszaru.");

                calendar = c;
            }
        }

        if (mode == "offered" && calendar is null)
            return (null, "Kto podaje terminy, potrzebuje kalendarza, w którym one stoją.");

        var audience = was.ReserveAreaId;
        if (body.ReserveAreaId is not null)
        {
            if (body.ReserveAreaId == "") audience = null;
            else if (!Guid.TryParse(body.ReserveAreaId, out var a)) return (null, "Nieczytelna grupa, która może rezerwować.");
            else
            {
                await using var cmd = new SqlCommand("SELECT COUNT(*) FROM app.area WHERE id = @a;", connection);
                cmd.Parameters.AddWithValue("@a", a);
                if ((int)(await cmd.ExecuteScalarAsync(ct))! == 0) return (null, "Takiej grupy nie ma.");
                audience = a;
            }
        }

        int pick(int? given, int before) => given ?? before;

        /*
         * DIE ZAHLEN, mit Worten statt mit einem Fremdschluessel-Fehler: wer im
         * Kalender „0 osób na termin" eintippt, soll lesen, was falsch ist.
         */
        if (pick(body.Capacity, was.Capacity) < 1) return (null, "Na termin musi móc przyjść co najmniej jedna osoba.");
        if (pick(body.PerPerson, was.PerPerson) is < 0 or > 1000) return (null, "Terminów na osobę: od 0 (bez limitu) do 1000.");
        if (pick(body.InviteHours, was.InviteHours) is < 0 or > 24 * 60) return (null, "Czas gospodarza: od 0 do 1440 godzin.");
        if (pick(body.MinPersons, was.MinPersons) is < 1 or > 1000) return (null, "Minimum osób: od 1 do 1000.");

        return (was with
        {
            ParentId = parent,
            CalendarId = calendar,
            Name = name,
            Kind = kind,
            Mode = mode,
            ByNight = body.ByNight ?? was.ByNight,
            CheckInMin = pick(body.CheckInMin, was.CheckInMin),
            CheckOutMin = pick(body.CheckOutMin, was.CheckOutMin),
            Capacity = pick(body.Capacity, was.Capacity),
            BufferBefore = pick(body.BufferBefore, was.BufferBefore),
            BufferAfter = pick(body.BufferAfter, was.BufferAfter),
            Approval = approval,
            InviteHours = pick(body.InviteHours, was.InviteHours),
            LeadDays = pick(body.LeadDays, was.LeadDays),
            PerPerson = pick(body.PerPerson, was.PerPerson),
            MinPersons = pick(body.MinPersons, was.MinPersons),
            ReserveAreaId = audience,
            BookableDefault = body.BookableDefault ?? was.BookableDefault
        }, null);
    }

    private static void Bind(SqlCommand cmd, ResourceRow row)
    {
        cmd.Parameters.AddWithValue("@id", row.Id);
        cmd.Parameters.AddWithValue("@area", row.AreaId);
        cmd.Parameters.AddWithValue("@parent", (object?)row.ParentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@cal", (object?)row.CalendarId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@name", row.Name);
        cmd.Parameters.AddWithValue("@kind", row.Kind);
        cmd.Parameters.AddWithValue("@mode", row.Mode);
        cmd.Parameters.AddWithValue("@night", row.ByNight);
        cmd.Parameters.AddWithValue("@in", row.CheckInMin);
        cmd.Parameters.AddWithValue("@out", row.CheckOutMin);
        cmd.Parameters.AddWithValue("@cap", row.Capacity);
        cmd.Parameters.AddWithValue("@bb", row.BufferBefore);
        cmd.Parameters.AddWithValue("@ba", row.BufferAfter);
        cmd.Parameters.AddWithValue("@appr", row.Approval);
        cmd.Parameters.AddWithValue("@inv", row.InviteHours);
        cmd.Parameters.AddWithValue("@lead", row.LeadDays);
        cmd.Parameters.AddWithValue("@pp", row.PerPerson);
        cmd.Parameters.AddWithValue("@min", row.MinPersons);
        cmd.Parameters.AddWithValue("@reserve", (object?)row.ReserveAreaId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@bookable", row.BookableDefault);
    }
}
