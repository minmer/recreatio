using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Belegung — Haus, Zimmer, Pfarrsaal.
///
/// <b>Die Regel des Moduls:</b> die ZEIT liegt im Klartext, alles andere nicht.
/// Wer fragt, erfaehrt, ob der Juli frei ist — nicht, wer im Juli kommt. Das
/// ist kein Verlust an Schutz, sondern die Grenze, die das Modul benutzbar
/// macht: freie Zeitraeume finden geht sonst nicht, ohne alles herunterzuladen.
///
/// <b>Warum das kein Kalender ist.</b> Ein Kalendereintrag beantwortet „wann
/// ist dieser MENSCH belegt", die Belegung „ist diese SACHE frei". Vor allem
/// ist die Vorgabe umgekehrt: beim Kalender privat, hier oeffentlich. Ein Haus,
/// dessen freie Zeitraeume niemand sehen darf, laesst sich nicht vermieten.
///
/// <b>Die Anfrage geht den Weg von aussen</b> (<see cref="RcRegistrations"/>),
/// nicht den des Kandidatenformulars. Dort fuellt ein angemeldetes Mitglied
/// mit eigenem Epochenschluessel aus; eine Gruppe, die nach dem Juli fragt,
/// haelt keinen. Sie versiegelt im Browser gegen den oeffentlichen
/// Annahmeschluessel, und der Dienst legt ab, was er selbst nicht oeffnen kann.
/// </summary>
public static class RcResource
{
    public static void MapRcResource(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rc/resources", CreateAsync).Produces<RcResourceCreatedResponse>();
        app.MapGet("/rc/resources", ListAsync).Produces<RcResourcesResponse>();

        // OHNE Konto. Eine Gruppe muss den Juli pruefen koennen, ohne sich
        // anzumelden — und ohne dass wir erfahren, dass sie geschaut hat.
        app.MapGet("/rc/resources/{slug}", ViewAsync).Produces<RcResourceView>();
        app.MapGet("/rc/resources/{slug}/free-busy", FreeBusyAsync).Produces<RcFreeBusyResponse>();
        app.MapPost("/rc/resources/{slug}/enquiries", SendEnquiryAsync).Produces<RcEnquirySentResponse>();

        app.MapGet("/rc/resources/{id:guid}/enquiries", EnquiriesAsync).Produces<RcEnquiriesResponse>();
        app.MapPost("/rc/resources/{id:guid}/holds", AddHoldAsync).Produces<RcHoldCreatedResponse>();
        app.MapPost("/rc/holds/{id:guid}/confirm", ConfirmHoldAsync).Produces<RcHoldConfirmedResponse>();
    }

    public const string StateHeld = "held";
    public const string StateConfirmed = "confirmed";

    /// <summary>Wie lange eine Vormerkung gilt, wenn niemand etwas anderes sagt.</summary>
    private static readonly TimeSpan DefaultHold = TimeSpan.FromDays(14);

    // -- AAD ------------------------------------------------------------------

    internal static RcAad IntakeAad(Guid resourceId) =>
        RcAad.Create("resource", "resource", resourceId, RcField.EnquiryIntakeKey, 1);

    /// <summary>
    /// Der Platz des VERPACKTEN Sitzungsschluessels — an der ANFRAGE, nicht am
    /// Haus. Beide Seiten muessen hier dasselbe bilden; genau an dieser Stelle
    /// ist es bei den Veranstaltungen einmal auseinandergelaufen, und der
    /// gemeinsame Testvektor konnte es nicht finden (er prueft das Format,
    /// nicht die Verabredung darueber, welcher Platz gemeint ist).
    /// </summary>
    private static RcAad WrapAad(Guid enquiryId) =>
        RcAad.Create("resource", "enquiry", enquiryId, RcField.EnquiryIntakeKey, 1);

    private static RcAad FieldAad(Guid enquiryId, RcField field) =>
        RcAad.Create("resource", "enquiry", enquiryId, field, 1);

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreateResourceRequest(
        string AreaId, string Slug, string Title, string? TimeZone, int? Capacity, bool? IsPublic);

    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        CreateResourceRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.AreaId, out var areaId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Bereich fehlt.");
            return;
        }

        var slug = (body.Slug ?? "").Trim().ToLowerInvariant();
        if (slug.Length is < 2 or > 64 || !slug.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c == '-'))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Slug taugt nicht: Kleinbuchstaben, Ziffern und Bindestrich.");
            return;
        }

        var title = (body.Title ?? "").Trim();
        if (title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Titel fehlt oder ist zu lang.");
            return;
        }

        // Eine unbekannte Zeitzone faellt beim ANLEGEN auf, nicht erst beim
        // Rechnen — dieselbe Lehre wie beim Kalender.
        var zone = string.IsNullOrWhiteSpace(body.TimeZone) ? "Europe/Warsaw" : body.TimeZone.Trim();
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(zone); }
        catch (TimeZoneNotFoundException)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Zeitzone kennt der Dienst nicht.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var resourceId = RcId.NewId();

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            areaId, ctx.RequestAborted);

        if (keys.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Bereich.");
            return;
        }

        var epoch = keys.Keys.Max();

        using var intake = RSA.Create(4096);
        var intakePublic = intake.ExportSubjectPublicKeyInfo();
        var intakeSealed = RcCrypto.Seal(keys[epoch], IntakeAad(resourceId), intake.ExportPkcs8PrivateKey());

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_resource
                (id, area_id, slug, title, time_zone, capacity, is_public,
                 intake_public_key, intake_private_sealed, intake_epoch, created_at)
            VALUES (@id, @area, @slug, @title, @zone, @capacity, @public,
                    @intakePub, @intakeSealed, @intakeEpoch, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", resourceId);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@slug", slug);
        insert.Parameters.AddWithValue("@title", title);
        insert.Parameters.AddWithValue("@zone", zone);
        insert.Parameters.Add("@capacity", System.Data.SqlDbType.Int).Value =
            (object?)body.Capacity ?? DBNull.Value;
        insert.Parameters.AddWithValue("@public", body.IsPublic ?? true);
        insert.Parameters.AddWithValue("@intakePub", intakePublic);
        insert.Parameters.AddWithValue("@intakeSealed", intakeSealed);
        insert.Parameters.AddWithValue("@intakeEpoch", epoch);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diesen Slug gibt es schon.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcResourceCreatedResponse(
            RcId.ToText(resourceId), slug), StatusCodes.Status201Created);
    }

    // -- Lesen ----------------------------------------------------------------

    private sealed record Row(
        Guid Id, Guid AreaId, string Slug, string Title, string Zone,
        int? Capacity, bool IsPublic, byte[]? IntakePublic,
        // Die Stunde, zu der ein Tag fuer diese Sache wechselt (rc_0021).
        int ChangeoverHour);

    private static async Task<Row?> LoadAsync(
        SqlConnection connection, string slug, CancellationToken token)
    {
        await using var cmd = new SqlCommand("""
            SELECT id, area_id, slug, title, time_zone, capacity, is_public, intake_public_key, changeover_hour
            FROM dbo.rc_resource WHERE slug = @slug;
            """, connection);
        cmd.Parameters.AddWithValue("@slug", slug);

        await using var reader = await cmd.ExecuteReaderAsync(token);
        if (!await reader.ReadAsync(token)) return null;

        return new Row(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
            reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetInt32(5),
            reader.GetBoolean(6),
            reader.IsDBNull(7) ? null : (byte[])reader[7],
            reader.IsDBNull(8) ? 18 : reader.GetByte(8));
    }

    private static async Task<Row?> LoadByIdAsync(
        SqlConnection connection, Guid id, CancellationToken token)
    {
        await using var cmd = new SqlCommand("""
            SELECT id, area_id, slug, title, time_zone, capacity, is_public, intake_public_key, changeover_hour
            FROM dbo.rc_resource WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(token);
        if (!await reader.ReadAsync(token)) return null;

        return new Row(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
            reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetInt32(5),
            reader.GetBoolean(6),
            reader.IsDBNull(7) ? null : (byte[])reader[7],
            reader.IsDBNull(8) ? 18 : reader.GetByte(8));
    }

    private static async Task ViewAsync(HttpContext ctx, RcDb db, string slug)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await LoadAsync(connection, slug, ctx.RequestAborted);

        if (row is null || !row.IsPublic) { await RcAreas.NotForYou(ctx); return; }

        await RcResults.WriteJsonAsync(ctx, new RcResourceView(
            RcId.ToText(row.Id), row.Slug, row.Title, row.Zone, row.Capacity,
            row.IntakePublic is null ? null : RcBase64Url.Encode(row.IntakePublic)));
    }

    private static async Task ListAsync(HttpContext ctx, RcDb db)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT id, slug, title, time_zone, capacity
            FROM dbo.rc_resource WHERE is_public = 1 ORDER BY title;
            """, connection);

        var all = new List<RcResourceView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            all.Add(new RcResourceView(
                RcId.ToText(reader.GetGuid(0)), reader.GetString(1), reader.GetString(2),
                reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetInt32(4), null));
        }

        await RcResults.WriteJsonAsync(ctx, new RcResourcesResponse(all));
    }

    /// <summary>
    /// Frei und belegt. OHNE Konto, ohne Schluessel, ohne Sitzung.
    ///
    /// <b>Eine abgelaufene Vormerkung ist frei</b>, und zwar hier in der
    /// Abfrage. Ein Vormerk, der nur deshalb noch gilt, weil ein Aufraeumlauf
    /// gerade nicht laeuft, ist kein Vormerk.
    /// </summary>
    private static async Task FreeBusyAsync(
        HttpContext ctx, RcDb db, string slug, string? from, string? to)
    {
        if (!DateOnly.TryParse(from, out var fromDay) || !DateOnly.TryParse(to, out var toDay))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Anfang und Ende fehlen oder sind unlesbar.");
            return;
        }

        if (toDay < fromDay)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das Ende liegt vor dem Anfang.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await LoadAsync(connection, slug, ctx.RequestAborted);
        if (row is null || !row.IsPublic) { await RcAreas.NotForYou(ctx); return; }

        await using var cmd = new SqlCommand("""
            /*
                HALBOFFEN: [from_at, to_at).

                Vorher stand hier `from_date <= @to AND to_date >= @from` — an
                beiden Enden einschliessend. Wer am 5. um 18 Uhr abreiste,
                blockierte damit den, der am 5. um 18 Uhr anreiste: eine
                gueltige Buchung wurde abgewiesen, und niemand konnte sehen,
                warum.

                Dazu die Kalendereintraege, die diese Sache beanspruchen. Eine
                Messe belegt die Kirche, eine Gruppe den Saal — dieselbe Frage,
                also dieselbe Antwort. Abgesagtes zaehlt nicht mit.
            */
            SELECT from_at, to_at, state, N'hold' AS source
            FROM dbo.rc_resource_hold
            WHERE resource_id = @id
              AND from_at < @to AND to_at > @from
              AND (state = 'confirmed' OR expires_at > @now)

            UNION ALL

            SELECT i.starts_at, i.ends_at, N'confirmed', N'calendar'
            FROM dbo.rc_calendar_item i
            WHERE i.resource_id = @id
              AND i.starts_at < @to AND i.ends_at > @from
              AND i.status <> N'cancelled'
              AND i.repeat_kind = N'none'

            ORDER BY 1;
            """, connection);

        cmd.Parameters.AddWithValue("@id", row.Id);
        cmd.Parameters.Add("@from", System.Data.SqlDbType.DateTimeOffset).Value =
            new DateTimeOffset(fromDay.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        cmd.Parameters.Add("@to", System.Data.SqlDbType.DateTimeOffset).Value =
            new DateTimeOffset(toDay.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var periods = new List<RcBusyPeriodView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            var fromAt = reader.GetDateTimeOffset(0);
            var toAt = reader.GetDateTimeOffset(1);

            /*
             * Der Tag bleibt stehen, die Uhrzeit kommt dazu.
             *
             * Wer bisher nur die Tage gelesen hat, liest sie weiter — und wer
             * genauer hinsehen muss, weil eine Messe eine Stunde dauert und
             * kein Tag, findet daneben den Zeitpunkt. Die alten Felder
             * wegzunehmen haette jede Anzeige zerbrochen, die es schon gibt.
             */
            periods.Add(new RcBusyPeriodView(
                DateOnly.FromDateTime(fromAt.UtcDateTime).ToString("yyyy-MM-dd"),
                DateOnly.FromDateTime(toAt.UtcDateTime).ToString("yyyy-MM-dd"),
                reader.GetString(2),
                fromAt, toAt, reader.GetString(3)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcFreeBusyResponse(
            RcId.ToText(row.Id), row.Zone, periods));
    }

    /// <summary>
    /// Der Zeitpunkt, an dem ein Tag fuer diese Sache beginnt oder endet.
    ///
    /// In der Zone der Sache gerechnet und dann als Zeitpunkt festgehalten:
    /// 18 Uhr ist 18 Uhr vor Ort, im Sommer wie im Winter. Wer stattdessen eine
    /// feste Verschiebung nimmt, verschiebt jede Buchung zweimal im Jahr um
    /// eine Stunde — und merkt es an dem Tag, an dem eine Gruppe eine Stunde zu
    /// frueh vor der Tuer steht.
    /// </summary>
    private static DateTimeOffset Changeover(DateOnly day, int hour, string zoneName)
    {
        var local = day.ToDateTime(new TimeOnly(Math.Clamp(hour, 0, 23), 0));
        var zone = RcCalendar.TryZone(zoneName, out var found) && found is not null
            ? found
            : TimeZoneInfo.Utc;

        return new DateTimeOffset(local, zone.GetUtcOffset(local));
    }

    // -- Zeitraeume -----------------------------------------------------------

    public sealed record AddHoldRequest(string From, string To, string? State, int? HoldDays);

    private static async Task AddHoldAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AddHoldRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!DateOnly.TryParse(body.From, out var fromDay) || !DateOnly.TryParse(body.To, out var toDay)
            || toDay < fromDay)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Zeitraum fehlt oder laeuft rueckwaerts.");
            return;
        }

        var state = body.State ?? StateHeld;
        if (state is not (StateHeld or StateConfirmed))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diesen Zustand gibt es nicht.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await LoadByIdAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, row.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        /*
         * EIN TAG IST EINE UHRZEIT.
         *
         * „Vom 5. bis zum 8." heisst in einem Gaestehaus: ab dem 5. um 18 Uhr
         * bis zum 8. um 18 Uhr. Die Stunde steht an der Sache (changeover_hour),
         * weil nicht jedes Haus um 18 Uhr wechselt.
         *
         * Erst dadurch laesst sich eine Uebernachtung mit einer Messe in
         * derselben Rechnung fuehren — und erst dadurch stimmt die Rechnung:
         * vorher blockierte, wer am 5. abreiste, den, der am 5. anreiste.
         */
        var fromAt = Changeover(fromDay, row.ChangeoverHour, row.Zone);
        var toAt = Changeover(toDay, row.ChangeoverHour, row.Zone);

        if (toAt <= fromAt)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Ein Aufenthalt braucht mindestens eine Nacht.");
            return;
        }

        // Ein bereits BESTAETIGTER Zeitraum wird nicht zweimal vergeben. Eine
        // Vormerkung darf sich mit einer anderen ueberschneiden — genau dafuer
        // ist sie da: zwei Gruppen fragen, eine bekommt den Zuschlag.
        //
        // HALBOFFEN [from, to): Ankunft zur Wechselstunde stoesst nicht mit der
        // Abreise zur selben Stunde zusammen. Ein Kalendereintrag, der dieselbe
        // Sache beansprucht, zaehlt mit — die Kirche ist waehrend der Messe
        // belegt, ob das nun jemand gebucht hat oder nicht.
        await using var clash = new SqlCommand("""
            SELECT
                (SELECT COUNT(*) FROM dbo.rc_resource_hold
                 WHERE resource_id = @id AND state = 'confirmed'
                   AND from_at < @to AND to_at > @from)
              + (SELECT COUNT(*) FROM dbo.rc_calendar_item
                 WHERE resource_id = @id AND status <> N'cancelled'
                   AND repeat_kind = N'none'
                   AND starts_at < @to AND ends_at > @from);
            """, connection);

        clash.Parameters.AddWithValue("@id", id);
        clash.Parameters.Add("@from", System.Data.SqlDbType.DateTimeOffset).Value = fromAt;
        clash.Parameters.Add("@to", System.Data.SqlDbType.DateTimeOffset).Value = toAt;

        if ((int)(await clash.ExecuteScalarAsync(ctx.RequestAborted))! > 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Dieser Zeitraum ist bereits fest vergeben.");
            return;
        }

        var holdId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        DateTimeOffset? expires = state == StateHeld
            ? now + (body.HoldDays is > 0 ? TimeSpan.FromDays(body.HoldDays.Value) : DefaultHold)
            : null;

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_resource_hold
                (id, resource_id, from_date, to_date, from_at, to_at,
                 state, expires_at, created_at, updated_at)
            VALUES (@id, @resource, @fromDay, @toDay, @from, @to,
                    @state, @expires, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", holdId);
        insert.Parameters.AddWithValue("@resource", id);
        /*
         * Die Tage bleiben stehen, NEBEN den Zeitpunkten. Sie sind das, was ein
         * Mensch sagt und liest — „vom 5. bis zum 8." —, die Zeitpunkte das,
         * womit gerechnet wird. Nur die Zeitpunkte zu speichern hiesse, den Tag
         * bei jeder Anzeige aus einer Stunde zurueckzurechnen; nur die Tage,
         * dass die Rechnung wieder falsch wird.
         */
        insert.Parameters.Add("@fromDay", System.Data.SqlDbType.Date).Value = fromDay.ToDateTime(TimeOnly.MinValue);
        insert.Parameters.Add("@toDay", System.Data.SqlDbType.Date).Value = toDay.ToDateTime(TimeOnly.MinValue);
        insert.Parameters.Add("@from", System.Data.SqlDbType.DateTimeOffset).Value = fromAt;
        insert.Parameters.Add("@to", System.Data.SqlDbType.DateTimeOffset).Value = toAt;
        insert.Parameters.AddWithValue("@state", state);
        insert.Parameters.Add("@expires", System.Data.SqlDbType.DateTimeOffset).Value =
            (object?)expires ?? DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcHoldCreatedResponse(
            RcId.ToText(holdId), state, expires), StatusCodes.Status201Created);
    }

    private static async Task ConfirmHoldAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var load = new SqlCommand("""
            SELECT h.resource_id, r.area_id, h.state
            FROM dbo.rc_resource_hold h
            JOIN dbo.rc_resource r ON r.id = h.resource_id
            WHERE h.id = @id;
            """, connection);
        load.Parameters.AddWithValue("@id", id);

        Guid areaId;
        string current;
        await using (var reader = await load.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            areaId = reader.GetGuid(1);
            current = reader.GetString(2);
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        if (current == StateConfirmed)
        {
            // Kein Fehler. Wer zweimal bestaetigt, soll nicht erschrecken.
            await RcResults.WriteJsonAsync(ctx, new RcHoldConfirmedResponse(
                RcId.ToText(id), StateConfirmed));
            return;
        }

        await using var update = new SqlCommand("""
            UPDATE dbo.rc_resource_hold
               SET state = 'confirmed', expires_at = NULL, updated_at = @now
             WHERE id = @id;
            """, connection);

        update.Parameters.AddWithValue("@id", id);
        update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcHoldConfirmedResponse(
            RcId.ToText(id), StateConfirmed));
    }

    // -- Anfragen -------------------------------------------------------------

    /// <summary>
    /// Eine Anfrage von aussen. Die Felder kommen VERSIEGELT an — der Dienst
    /// sieht sie nie im Klartext.
    /// </summary>
    public sealed record SendEnquiryRequest(
        string EnquiryId,
        string From,
        string To,
        int? People,
        string SessionKeyWrapped,
        string GroupNameSealed,
        string? ContactPersonSealed,
        string ContactSealed,
        string? GroupKindSealed,
        string? NoteSealed);

    private static async Task SendEnquiryAsync(
        HttpContext ctx, RcDb db, string slug, SendEnquiryRequest body)
    {
        if (!Guid.TryParse(body.EnquiryId, out var enquiryId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Kennung der Anfrage fehlt.");
            return;
        }

        if (!DateOnly.TryParse(body.From, out var fromDay) || !DateOnly.TryParse(body.To, out var toDay)
            || toDay < fromDay)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Zeitraum fehlt oder laeuft rueckwaerts.");
            return;
        }

        if (!RcBase64Url.TryDecode(body.SessionKeyWrapped, out var wrapped)
            || !RcBase64Url.TryDecode(body.GroupNameSealed, out var groupName)
            || !RcBase64Url.TryDecode(body.ContactSealed, out var contact))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Anfrage ist unlesbar verpackt.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await LoadAsync(connection, slug, ctx.RequestAborted);

        if (row is null || !row.IsPublic || row.IntakePublic is null)
        {
            await RcAreas.NotForYou(ctx);
            return;
        }

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_enquiry
                (id, resource_id, from_date, to_date, people, session_key_wrapped,
                 group_name_sealed, contact_person_sealed, contact_sealed,
                 group_kind_sealed, note_sealed, state, received_at)
            VALUES (@id, @resource, @from, @to, @people, @wrapped,
                    @groupName, @person, @contact, @kind, @note, 'new', @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", enquiryId);
        insert.Parameters.AddWithValue("@resource", row.Id);
        insert.Parameters.Add("@from", System.Data.SqlDbType.Date).Value = fromDay.ToDateTime(TimeOnly.MinValue);
        insert.Parameters.Add("@to", System.Data.SqlDbType.Date).Value = toDay.ToDateTime(TimeOnly.MinValue);
        insert.Parameters.Add("@people", System.Data.SqlDbType.Int).Value =
            body.People is > 0 ? body.People.Value : DBNull.Value;
        insert.Parameters.AddWithValue("@wrapped", wrapped);
        insert.Parameters.AddWithValue("@groupName", groupName);
        insert.Parameters.AddWithValue("@contact", contact);
        Optional(insert, "@person", body.ContactPersonSealed);
        Optional(insert, "@kind", body.GroupKindSealed);
        Optional(insert, "@note", body.NoteSealed);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Dieselbe Kennung zweimal: der Browser hat die Anfrage wiederholt.
            // Das ist kein Fehler — sie ist schon da.
            await RcResults.WriteJsonAsync(ctx, new RcEnquirySentResponse(body.EnquiryId, true));
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcEnquirySentResponse(
            body.EnquiryId, true), StatusCodes.Status201Created);
    }

    private static void Optional(SqlCommand cmd, string name, string? base64)
    {
        var value = base64 is not null && RcBase64Url.TryDecode(base64, out var blob)
            ? (object)blob
            : DBNull.Value;
        cmd.Parameters.AddWithValue(name, value);
    }

    /// <summary>
    /// Die Anfragen, geoeffnet. Verlangt Lesezugriff auf den Bereich UND den
    /// Schluessel — der private Annahmeschluessel liegt unter dem
    /// Epochenschluessel des Bereichs.
    /// </summary>
    private static async Task EnquiriesAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await LoadByIdAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, row.AreaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            row.AreaId, ctx.RequestAborted);

        RSA? intake = null;
        try
        {
            intake = await OpenIntakeAsync(connection, id, keys, ctx.RequestAborted);

            await using var cmd = new SqlCommand("""
                SELECT id, from_date, to_date, people, state, received_at, session_key_wrapped,
                       group_name_sealed, contact_person_sealed, contact_sealed,
                       group_kind_sealed, note_sealed
                FROM dbo.rc_enquiry WHERE resource_id = @id ORDER BY received_at DESC;
                """, connection);
            cmd.Parameters.AddWithValue("@id", id);

            var all = new List<RcEnquiryView>();
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var enquiryId = reader.GetGuid(0);
                var from = DateOnly.FromDateTime(reader.GetDateTime(1)).ToString("yyyy-MM-dd");
                var to = DateOnly.FromDateTime(reader.GetDateTime(2)).ToString("yyyy-MM-dd");
                var people = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3);
                var state = reader.GetString(4);
                var received = reader.GetDateTimeOffset(5);

                // 15.9 — eine Anfrage, die sich nicht oeffnen laesst, bleibt in
                // der Liste. Sonst wartet jemand auf eine Antwort, von der
                // niemand weiss, dass sie aussteht.
                if (intake is null)
                {
                    all.Add(new RcEnquiryView(RcId.ToText(enquiryId), from, to, people, state,
                        received, null, null, null, null, null, "crypto.missing_epoch"));
                    continue;
                }

                byte[] key;
                try
                {
                    key = RcCrypto.UnwrapKey(intake, WrapAad(enquiryId), (byte[])reader[6]);
                }
                catch (RcDecryptException)
                {
                    all.Add(new RcEnquiryView(RcId.ToText(enquiryId), from, to, people, state,
                        received, null, null, null, null, null, "crypto.unwrap_failed"));
                    continue;
                }

                string? Field(int column, RcField field)
                {
                    if (reader.IsDBNull(column)) return null;
                    try
                    {
                        return Encoding.UTF8.GetString(
                            RcCrypto.Open(key, FieldAad(enquiryId, field), (byte[])reader[column]));
                    }
                    catch (RcDecryptException) { return null; }
                }

                all.Add(new RcEnquiryView(
                    RcId.ToText(enquiryId), from, to, people, state, received,
                    Field(7, RcField.EnquiryGroupName),
                    Field(8, RcField.EnquiryContactPerson),
                    Field(9, RcField.EnquiryContact),
                    Field(10, RcField.EnquiryGroupKind),
                    Field(11, RcField.EnquiryNote),
                    null));
            }

            await RcResults.WriteJsonAsync(ctx, new RcEnquiriesResponse(all));
        }
        finally
        {
            intake?.Dispose();
        }
    }

    private static async Task<RSA?> OpenIntakeAsync(
        SqlConnection connection, Guid resourceId,
        IReadOnlyDictionary<int, byte[]> keys, CancellationToken token)
    {
        await using var cmd = new SqlCommand("""
            SELECT intake_private_sealed, intake_epoch FROM dbo.rc_resource WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", resourceId);

        byte[] sealedKey;
        int epoch;

        await using (var reader = await cmd.ExecuteReaderAsync(token))
        {
            if (!await reader.ReadAsync(token) || reader.IsDBNull(0) || reader.IsDBNull(1)) return null;
            sealedKey = (byte[])reader[0];
            epoch = reader.GetInt32(1);
        }

        if (!keys.TryGetValue(epoch, out var epochKey)) return null;

        try
        {
            var pkcs8 = RcCrypto.Open(epochKey, IntakeAad(resourceId), sealedKey);
            var rsa = RSA.Create();
            rsa.ImportPkcs8PrivateKey(pkcs8, out _);
            return rsa;
        }
        catch (RcDecryptException)
        {
            return null;
        }
    }
}
