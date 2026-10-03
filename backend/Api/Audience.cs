using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Die drei Zugänge (0080): Kanał, gemeinsam, einer mit einem.
/// </summary>
public enum AudienceMode
{
    /// <summary>Der Bereich schreibt, alle anderen lesen.</summary>
    Channel,

    /// <summary>Alle schreiben — der Bereich und seine Menschen gleich.</summary>
    Together,

    /// <summary>Der Bereich und EIN Mensch; die anderen Menschen sehen es nicht.</summary>
    One
}

/// <summary>
/// ODBIORCY (0080) — wer AUSSER den Mitgliedern eines Bereichs zu etwas gehört,
/// das der Bereich hält, und wie.
///
/// <para>
/// <b>Drei Zugänge, für alles, was ein Bereich hält</b> — zuerst die Rozmowa;
/// ein Kalender, eine Seite, ein Ordner können dieselben drei bekommen, ohne
/// dass sich hier etwas ändert außer einer Zeile in <see cref="Subjects"/>:
/// </para>
///
/// <code>
///   Channel    der Bereich schreibt (write/admin), alle anderen lesen
///   Together   alle schreiben, die im Bereich lesen, und seine Menschen
///   One        der Bereich und EIN Mensch (ein Platz) — sonst niemand
/// </code>
///
/// <para>
/// <b>Seine Menschen</b> sind die Plätze (Links ohne Konto) des Bereichs selbst
/// und jeder, der ein Formular ausgefüllt hat, das an dem Ding hängt
/// (<c>app.audience_form</c>) — nicht zurückgezogen, nicht ausgeblendet. Ein
/// Platz bekommt dabei nie den Schlüssel des Bereichs; jedes Ding gibt ihm nur
/// seinen eigenen, abgeleiteten.
/// </para>
///
/// <para>
/// <b>Einer mit einem</b> darf jeder Bereich sein, der mit dem Menschen zu tun
/// hat (<see cref="MayMeetAsync"/>) — etwa „Ksiądz" mit einem Kandidaten, ohne
/// dass alle mitlesen, die „Kandydaci" lesen.
/// </para>
/// </summary>
public static class Audience
{
    public static readonly string[] Readers = ["read", "write", "admin"];
    public static readonly string[] Writers = ["write", "admin"];

    /// <summary>Welche Stufen des Bereichs in diesem Zugang schreiben.</summary>
    public static string[] Speakers(AudienceMode mode) => mode == AudienceMode.Channel ? Writers : Readers;

    /// <summary>Ob ein Mensch mit Link schreibt — außer im Kanał überall.</summary>
    public static bool SeatWrites(AudienceMode mode) => mode != AudienceMode.Channel;

    /// <summary>
    /// WORAN FORMULARE HÄNGEN KÖNNEN — und wo dessen Bereich steht (SQL mit
    /// <c>@id</c>; keine Zeile: das Ding gibt es nicht, oder es nimmt keine).
    /// Ein neues Ding ist eine neue Zeile hier und in <c>ck_audience_kind</c>.
    /// </summary>
    private static readonly Dictionary<string, string> Subjects = new()
    {
        ["chat"] = "SELECT area_id FROM app.chat WHERE id = @id AND kind IN (N'area', N'channel')",

        /* 0081 — „Napisz do nas": sein Bereich sind die Rollen, die antworten; seine Formulare, wer anfangen darf (One). */
        ["module"] = "SELECT area_id FROM app.module WHERE id = @id AND kind = N'seat-ask' AND area_id IS NOT NULL"
    };

    /// <summary>
    /// Ein lebendiger Platz, der nicht mehr auf seine erste Bestätigung
    /// wartet — dieselbe Bedingung wie <c>Seat.LiveSeatAsync(gated: true)</c>,
    /// als SQL. Braucht <c>@now</c>.
    /// </summary>
    public static string LiveSeat(string a) =>
        $"{a}.revoked_at IS NULL AND {a}.status = N'active' AND ({a}.expires_at IS NULL OR {a}.expires_at > @now) "
        + $"AND ({a}.verify_hash IS NULL OR {a}.verified_at IS NOT NULL)";

    /// <summary>
    /// SEINE MENSCHEN — ob der Platz <paramref name="seat"/> (ein Alias auf
    /// app.access) zu den Menschen eines Dings gehört: als SQL über die
    /// Ausdrücke für dessen Kennung und Bereich. Ob der Platz lebt, fragt der
    /// Aufrufer (<see cref="LiveSeat"/>).
    /// </summary>
    public static string PeopleOf(string kind, string subjectId, string areaId, string seat = "s")
    {
        if (!Subjects.ContainsKey(kind)) throw new ArgumentException($"No audience for {kind}.", nameof(kind));
        return $"""
            ({seat}.area_id = {areaId} OR EXISTS (
                SELECT 1 FROM app.audience_form af
                JOIN app.registration ar ON ar.part_id = af.module_id
                WHERE af.subject_kind = N'{kind}' AND af.subject_id = {subjectId} AND ar.access_id = {seat}.id
                  AND ar.withdrawn_at IS NULL AND ar.is_hidden = 0))
            """;
    }

    /// <summary>
    /// DARF DIESER BEREICH MIT DIESEM MENSCHEN ALLEIN SPRECHEN (<see cref="AudienceMode.One"/>)?
    /// Ja, wenn er mit ihm zu tun hat: der Bereich seines Platzes, der eines
    /// Formulars, das er ausgefüllt hat, einer, in den dessen Fragen schreiben
    /// — oder einer darüber. Und nur, solange sein Link lebt.
    /// </summary>
    public static async Task<bool> MayMeetAsync(SqlConnection connection, Guid seatId, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"""
            WITH near AS (
                SELECT s.area_id AS id FROM app.access s WHERE s.id = @seat
                UNION
                SELECT m.area_id FROM app.registration g JOIN app.module m ON m.id = g.part_id
                 WHERE g.access_id = @seat AND g.withdrawn_at IS NULL AND m.area_id IS NOT NULL
                UNION
                SELECT f.area_id FROM app.registration g JOIN app.slug_field f ON f.part_id = g.part_id
                 WHERE g.access_id = @seat AND g.withdrawn_at IS NULL
            ),
            up AS (
                SELECT id FROM near
                UNION ALL
                SELECT a.parent_area_id FROM app.area a JOIN up ON a.id = up.id WHERE a.parent_area_id IS NOT NULL
            )
            SELECT 1 FROM app.access s
            WHERE s.id = @seat AND {LiveSeat("s")} AND @area IN (SELECT id FROM up);
            """, connection);
        cmd.Parameters.AddWithValue("@seat", seatId);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>Ein Formular an einem Ding: wie es heisst, wem es gehört, wie viele Menschen mit Link dadurch dabei sind.</summary>
    public sealed record Form(Guid ModuleId, string Name, Guid? AreaId, string? AreaName, int People);

    /// <summary>Die Formulare je Ding — und wie viele lebende Links gerade dazugehören.</summary>
    public static async Task<Dictionary<Guid, List<Form>>> FormsAsync(
        SqlConnection connection, string kind, IReadOnlyList<Guid> subjects, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<Form>>();
        if (subjects.Count == 0) return out_;

        var names = string.Join(", ", subjects.Select((_, i) => $"@s{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT f.subject_id, f.module_id, m.name, m.area_id, a.name,
                   (SELECT COUNT(DISTINCT g.access_id) FROM app.registration g
                     JOIN app.access s ON s.id = g.access_id
                     WHERE g.part_id = f.module_id AND g.withdrawn_at IS NULL AND g.is_hidden = 0
                       AND {LiveSeat("s")}) AS people
            FROM app.audience_form f
            JOIN app.module m ON m.id = f.module_id
            LEFT JOIN app.area a ON a.id = m.area_id
            WHERE f.subject_kind = @kind AND f.subject_id IN ({names})
            ORDER BY m.name;
            """, connection);
        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < subjects.Count; i++) cmd.Parameters.AddWithValue($"@s{i}", subjects[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var subject = reader.GetGuid(0);
            if (!out_.TryGetValue(subject, out var list)) out_[subject] = list = [];
            list.Add(new Form(reader.GetGuid(1), reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetGuid(3), reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetInt32(5)));
        }

        return out_;
    }

    /// <summary>Für eine Antwort: die Formulare EINES Dings.</summary>
    public static async Task<List<object>> FormsOfAsync(SqlConnection connection, string kind, Guid subject, CancellationToken ct) =>
        ((await FormsAsync(connection, kind, [subject], ct)).TryGetValue(subject, out var found) ? found : [])
            .Select(x => (object)new
            {
                moduleId = Ids.ToText(x.ModuleId),
                name = x.Name,
                areaId = x.AreaId is null ? null : Ids.ToText(x.AreaId.Value),
                areaName = x.AreaName,
                people = x.People
            }).ToList();

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/audience/{kind}/{id:guid}/forms", ListAsync);
        app.MapPost("/workspace/audience/{kind}/{id:guid}/forms", LinkAsync);
    }

    /// <summary>Der Bereich eines Dings — oder null: das Ding gibt es nicht, oder es nimmt keine Formulare.</summary>
    private static async Task<Guid?> AreaOfAsync(SqlConnection connection, string kind, Guid id, CancellationToken ct)
    {
        if (!Subjects.TryGetValue(kind, out var areaOf)) return null;
        await using var cmd = new SqlCommand(areaOf, connection);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    /// <summary>Die Formulare eines Dings — für wen dessen Bereich liest.</summary>
    private static async Task ListAsync(HttpContext ctx, Db db, string kind, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfAsync(connection, kind, id, ctx.RequestAborted);
        if (areaId is null || !await Area.MayAsync(connection, who.Value.AccountId, areaId.Value, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego tu nie ma.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { kind, id = Ids.ToText(id), forms = await FormsOfAsync(connection, kind, id, ctx.RequestAborted) });
    }

    public sealed record LinkRequest(string ModuleId, bool Linked, string? ByRoleId = null);

    /// <summary>
    /// EIN FORMULAR AN EIN DING HÄNGEN — oder wieder ab. Wer es ausgefüllt hat,
    /// gehört dann zu dessen Menschen.
    ///
    /// <para>
    /// <b>Zwei Seiten müssen einverstanden sein.</b> Wer im Bereich des Dings
    /// schreibt — und wer das Formular sieht: wer seinen Bereich oder einen der
    /// Bereiche seiner Fragen lesen darf. Sonst holte sich jeder, der irgendwo
    /// schreibt, die Menschen eines fremden Formulars. Abhängen darf, wer im
    /// Bereich schreibt.
    /// </para>
    /// </summary>
    private static async Task LinkAsync(HttpContext ctx, Db db, string kind, Guid id, LinkRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Subjects.ContainsKey(kind) || !Guid.TryParse(body.ModuleId, out var moduleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfAsync(connection, kind, id, ctx.RequestAborted);

        /* Die Rollen dieses Kontos, die im Bereich schreiben — eine davon hängt an. */
        var leading = new List<Guid>();
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (areaId is not null && mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT DISTINCT subject_role_id FROM app.certificate
                WHERE scope_kind = N'area' AND scope_id = @area AND revoked_at IS NULL AND expires_at > @now
                  AND capability IN (N'write', N'admin') AND subject_role_id IN ({names});
                """, connection);
            cmd.Parameters.AddWithValue("@area", areaId.Value);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) leading.Add(reader.GetGuid(0));
        }

        if (areaId is null || leading.Count == 0)
        {
            // „Gibt es nicht" und „darfst du nicht" sehen gleich aus.
            await Fail(ctx, StatusCodes.Status404NotFound, "Formularze dołącza ktoś, kto pisze w obszarze tej rzeczy.");
            return;
        }

        if (!body.Linked)
        {
            await using var drop = new SqlCommand(
                "DELETE FROM app.audience_form WHERE subject_kind = @kind AND subject_id = @id AND module_id = @module;", connection);
            drop.Parameters.AddWithValue("@kind", kind);
            drop.Parameters.AddWithValue("@id", id);
            drop.Parameters.AddWithValue("@module", moduleId);
            var gone = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { kind, id = Ids.ToText(id), moduleId = Ids.ToText(moduleId), linked = false, changed = gone > 0 });
            return;
        }

        /* Das Formular — und die Bereiche, aus denen man es sieht. */
        var areas = new List<Guid>();
        string? moduleKind = null;
        await using (var cmd = new SqlCommand("""
            SELECT m.kind, m.area_id FROM app.module m WHERE m.id = @module;
            SELECT DISTINCT f.area_id FROM app.slug_field f WHERE f.part_id = @module;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@module", moduleId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                moduleKind = reader.GetString(0);
                if (!reader.IsDBNull(1)) areas.Add(reader.GetGuid(1));
            }
            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) areas.Add(reader.GetGuid(0));
        }

        var sees = false;
        foreach (var area in areas.Distinct())
        {
            if (await Area.MayAsync(connection, who.Value.AccountId, area, Capability.Read, ctx.RequestAborted)) { sees = true; break; }
        }

        if (moduleKind != "form" || !sees)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego formularza nie widzisz.");
            return;
        }

        var by = Guid.TryParse(body.ByRoleId, out var wanted) && leading.Contains(wanted) ? wanted : leading[0];
        await using (var add = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM app.audience_form WHERE subject_kind = @kind AND subject_id = @id AND module_id = @module)
                INSERT INTO app.audience_form (subject_kind, subject_id, module_id, added_by_role_id, added_at)
                VALUES (@kind, @id, @module, @by, @now);
            """, connection))
        {
            add.Parameters.AddWithValue("@kind", kind);
            add.Parameters.AddWithValue("@id", id);
            add.Parameters.AddWithValue("@module", moduleId);
            add.Parameters.AddWithValue("@by", by);
            add.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try
            {
                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Ein zweites Fenster war schneller — dran ist es so oder so.
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { kind, id = Ids.ToText(id), moduleId = Ids.ToText(moduleId), linked = true, changed = true });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
