using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Messen und Intentionen.
///
/// <b>Dies ist kein zweiter Kalender.</b> Eine Messe IST ein Kalendereintrag —
/// mit Zeit, Wiederholung und Ausnahmen, die der Kalender laengst kann. „Werktags
/// 18 Uhr" ist EIN Eintrag; die einzelne Messe am Dienstag ist eines seiner
/// Vorkommen. Genau das meint „ein Gesamtplan, der in kleinere Teile zerfaellt":
/// die Reihe ist der Plan, das Vorkommen der Teil, und jeder Teil laesst sich
/// fuer sich verschieben, absagen oder anders betiteln.
///
/// Hier steht deshalb nur das, was der Kalender NICHT kann: die Intentionen.
///
/// <b>Die Intention haengt am VORKOMMEN, nicht an der Reihe.</b> Am Dienstag
/// wird eine andere gelesen als am Mittwoch. Adressiert wird sie darum wie die
/// Ausnahmen des Kalenders — <c>(item_id, occurrence_at)</c>, wobei
/// <c>occurrence_at</c> der URSPRUENGLICHE Beginn ist, auch wenn das Vorkommen
/// verschoben wurde. Eine verschobene Messe verliert ihre Intentionen sonst in
/// dem Augenblick, in dem jemand sie um eine Stunde vorzieht.
///
/// <b>Der Text ist offen, der Geber nicht.</b> Eine Intention wird vorgelesen
/// und gedruckt — sie zu verschluesseln hiesse, das Modul gegen seinen Zweck zu
/// bauen. Wer sie gegeben und was er gegeben hat, steht dagegen auf keinem
/// Aushang. Dieselbe Trennung wie <c>title_public</c> zu <c>title_sealed</c> im
/// Kalender, und aus demselben Grund.
/// </summary>
public static class RcMass
{
    /// <summary>Der Eintragstyp, der eine Messe von einem Termin unterscheidet.</summary>
    public const string ItemType = "mass";

    public static readonly string[] Statuses = ["accepted", "cancelled", "celebrated"];

    /// <summary>
    /// EINZELN oder ZUSAMMENGELEGT — und das ist kein Etikett.
    ///
    /// <b>single</b>: mehrere Intentionen in einer Messe sind moeglich, aber
    /// dann liest JEDER PRIESTER seine eigene. Zwei einzelne heissen also:
    /// zwei Priester konzelebrieren.
    ///
    /// <b>collective</b>: EIN Priester liest mehrere zusammen.
    ///
    /// Wer beides als „mehrere Intentionen" fuehrt, kann die Frage „brauche ich
    /// noch jemanden" nicht mehr beantworten — und das ist die Frage, wegen der
    /// die Unterscheidung ueberhaupt besteht.
    /// </summary>
    public const string Single = "single";
    public const string Collective = "collective";

    public static readonly string[] Kinds = [Single, Collective];

    public static void MapRcMass(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/calendar-items/{id:guid}/occurrences/{at}/intentions", ListAsync)
            .Produces<RcIntentionsResponse>();

        app.MapPost("/rc/calendar-items/{id:guid}/occurrences/{at}/intentions", AddAsync)
            .Produces<RcIntentionCreatedResponse>();

        app.MapPost("/rc/mass-intentions/{id:guid}", UpdateAsync)
            .Produces<RcIntentionUpdatedResponse>();

        /*
         * OHNE Konto. Der Messplan haengt am Schaukasten; wer ihn im Netz sucht,
         * soll sich dafuer nicht anmelden muessen — und wir sollen nicht
         * erfahren, dass er geschaut hat.
         */
        app.MapGet("/rc/public/parishes/{slug}/masses", PublicAsync)
            .Produces<RcPublicMassesResponse>();
    }

    private static RcAad GiverAad(Guid intentionId) =>
        RcAad.Create("mass", "intention", intentionId, RcField.MassIntentionGiver, 1);

    private static RcAad OfferingAad(Guid intentionId) =>
        RcAad.Create("mass", "intention", intentionId, RcField.MassIntentionOffering, 1);

    /// <summary>
    /// Der urspruengliche Beginn eines Vorkommens, aus der Adresse gelesen.
    ///
    /// Rund um die Uhr eindeutig nur, wenn er als Zeitpunkt MIT Zone gelesen
    /// wird. „2026-09-05T18:00:00Z" und „2026-09-05T20:00:00+02:00" sind
    /// derselbe Augenblick und muessen dieselbe Messe treffen — sonst haengen
    /// die Intentionen an einer Adresse, die die Oberflaeche beim naechsten
    /// Aufruf anders schreibt.
    /// </summary>
    private static bool TryOccurrence(string at, out DateTimeOffset when) =>
        DateTimeOffset.TryParse(at, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.RoundtripKind, out when);

    // -- Die Kanzlei sieht alles ----------------------------------------------

    public sealed record IntentionView(
        string IntentionId, int Ordinal, string Text, string Status,
        string? Giver, string? Offering, string? Unreadable,
        string Kind, string? CelebrantRoleId);

    public sealed record RcIntentionsResponse(
        string ItemId, DateTimeOffset OccurrenceUtc, IReadOnlyList<IntentionView> Intentions);

    public sealed record RcIntentionCreatedResponse(string IntentionId, int Ordinal);
    public sealed record RcIntentionUpdatedResponse(string IntentionId, bool Updated);

    public sealed record AddRequest(
        string? Text, string? Giver, string? Offering, int? Ordinal,
        string? Kind, string? CelebrantRoleId);

    public sealed record UpdateRequest(
        string? Text, string? Status, int? Ordinal,
        string? Kind, string? CelebrantRoleId);

    private static async Task ListAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, string at)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!TryOccurrence(at, out var when))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Das ist kein Zeitpunkt.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(
            connection, session.AccountId, held.MasterKey, areaId.Value, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT id, ordinal, text_public, status, epoch, giver_sealed, offering_sealed,
                   kind, celebrant_role_id
            FROM dbo.rc_mass_intention
            WHERE item_id = @item AND occurrence_at = @at
            ORDER BY ordinal, created_at;
            """, connection);

        cmd.Parameters.AddWithValue("@item", id);
        cmd.Parameters.Add("@at", System.Data.SqlDbType.DateTimeOffset).Value = when;

        var views = new List<IntentionView>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var intentionId = reader.GetGuid(0);
                var epoch = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4);

                string? giver = null, offering = null, unreadable = null;

                if (epoch is not null)
                {
                    if (!keys.TryGetValue(epoch.Value, out var key))
                    {
                        // 15.9 — Die Intention faellt NICHT aus der Liste. Was
                        // vorgelesen wird, steht ohnehin offen da; nur Geber und
                        // Gabe bleiben zu.
                        unreadable = RcErrorCodes.CryptoMissingEpoch;
                    }
                    else
                    {
                        giver = OpenOrNull(key, GiverAad(intentionId), reader, 5);
                        offering = OpenOrNull(key, OfferingAad(intentionId), reader, 6);
                    }
                }

                views.Add(new IntentionView(
                    RcId.ToText(intentionId), reader.GetInt32(1), reader.GetString(2),
                    reader.GetString(3), giver, offering, unreadable,
                    reader.GetString(7),
                    reader.IsDBNull(8) ? null : RcId.ToText(reader.GetGuid(8))));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcIntentionsResponse(
            RcId.ToText(id), when, views));
    }

    private static string? OpenOrNull(byte[] key, RcAad aad, SqlDataReader reader, int column)
    {
        if (reader.IsDBNull(column)) return null;
        try { return Encoding.UTF8.GetString(RcCrypto.Open(key, aad, (byte[])reader[column])); }
        catch (RcDecryptException) { return null; }
    }

    private static async Task AddAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, string at, AddRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!TryOccurrence(at, out var when))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Das ist kein Zeitpunkt.");
            return;
        }

        var text = (body.Text ?? string.Empty).Trim();
        if (text.Length == 0 || text.Length > 400)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Eine Intention ohne Text wird als Schweigen vorgelesen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var kind = (body.Kind ?? Single).Trim().ToLowerInvariant();
        if (!Kinds.Contains(kind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Eine Intention ist entweder einzeln oder zusammengelegt.");
            return;
        }

        Guid? celebrant = Guid.TryParse(body.CelebrantRoleId, out var who) ? who : null;

        var intentionId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        int? epoch = null;
        byte[]? giverSealed = null, offeringSealed = null;

        var giver = (body.Giver ?? string.Empty).Trim();
        var offering = (body.Offering ?? string.Empty).Trim();

        if (giver.Length > 0 || offering.Length > 0)
        {
            using var held = await masterKeys.OpenAsync(
                connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(
                connection, session.AccountId, held.MasterKey, areaId.Value, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.CryptoMissingEpoch,
                    "Ohne Schluessel liesse sich der Geber nicht wieder oeffnen.");
                return;
            }

            epoch = keys.Keys.Max();
            var key = keys[epoch.Value];

            if (giver.Length > 0)
                giverSealed = RcCrypto.Seal(key, GiverAad(intentionId), Encoding.UTF8.GetBytes(giver));

            if (offering.Length > 0)
                offeringSealed = RcCrypto.Seal(key, OfferingAad(intentionId),
                    Encoding.UTF8.GetBytes(offering));
        }

        /*
         * Ohne genannte Reihenfolge ans Ende. Nicht auf 0: dann stuende jede
         * neue Intention vorn, und das Vorlesen begaenne jedes Mal mit der
         * zuletzt angenommenen.
         */
        var ordinal = body.Ordinal ?? await NextOrdinalAsync(connection, id, when, ctx.RequestAborted);

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_mass_intention
                (id, item_id, occurrence_at, ordinal, text_public,
                 epoch, giver_sealed, offering_sealed, status,
                 kind, celebrant_role_id,
                 created_by_role_id, created_at, updated_at)
            VALUES (@id, @item, @at, @ord, @text,
                    @epoch, @giver, @offering, N'accepted',
                    @kind, @celebrant,
                    NULL, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", intentionId);
        insert.Parameters.AddWithValue("@item", id);
        insert.Parameters.Add("@at", System.Data.SqlDbType.DateTimeOffset).Value = when;
        insert.Parameters.AddWithValue("@ord", ordinal);
        insert.Parameters.AddWithValue("@text", text);
        insert.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = (object?)epoch ?? DBNull.Value;
        insert.Parameters.Add("@giver", System.Data.SqlDbType.VarBinary).Value =
            (object?)giverSealed ?? DBNull.Value;
        insert.Parameters.Add("@offering", System.Data.SqlDbType.VarBinary).Value =
            (object?)offeringSealed ?? DBNull.Value;
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.Add("@celebrant", System.Data.SqlDbType.UniqueIdentifier).Value =
            (object?)celebrant ?? DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        /*
         * ZWEI EINZELNE INTENTIONEN, DERSELBE PRIESTER — das gibt es nicht.
         *
         * Die Regel haelt die Datenbank (uq_rc_mass_intention_celebrant); hier
         * wird ihr Bruch in eine Antwort uebersetzt, die ein Mensch versteht.
         * Ohne das kaeme ein Schluesselverstoss als 500 zurueck, und in der
         * Kanzlei stuende „etwas ist schiefgegangen".
         */
        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                "Dieser Priester hat in dieser Messe schon eine eigene Intention. "
                + "Mehrere zusammen liest er als zusammengelegte.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcIntentionCreatedResponse(
            RcId.ToText(intentionId), ordinal));
    }

    private static async Task<int> NextOrdinalAsync(
        SqlConnection connection, Guid itemId, DateTimeOffset when, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT ISNULL(MAX(ordinal), -1) + 1 FROM dbo.rc_mass_intention
            WHERE item_id = @item AND occurrence_at = @at;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.Add("@at", System.Data.SqlDbType.DateTimeOffset).Value = when;

        return await cmd.ExecuteScalarAsync(ct) is int next ? next : 0;
    }

    private static async Task UpdateAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, UpdateRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var status = body.Status?.Trim().ToLowerInvariant();
        if (status is not null && !Statuses.Contains(status))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diesen Stand gibt es nicht.");
            return;
        }

        var kind = body.Kind?.Trim().ToLowerInvariant();
        if (kind is not null && !Kinds.Contains(kind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Eine Intention ist entweder einzeln oder zusammengelegt.");
            return;
        }

        var text = body.Text?.Trim();
        if (text is not null && (text.Length == 0 || text.Length > 400))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Eine Intention ohne Text wird als Schweigen vorgelesen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfIntentionAsync(connection, id, ctx.RequestAborted);
        if (areaId is null) { await NotFound(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId.Value,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        /*
         * COALESCE: was nicht genannt wird, bleibt stehen. Ein Aufruf, der nur
         * den Stand aendert, darf den Text nicht leeren — und genau das taete
         * ein Update, das alle Spalten schreibt.
         */
        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_mass_intention
            SET text_public = COALESCE(@text, text_public),
                status      = COALESCE(@status, status),
                ordinal     = COALESCE(@ord, ordinal),
                kind        = COALESCE(@kind, kind),
                celebrant_role_id = COALESCE(@celebrant, celebrant_role_id),
                updated_at  = @now
            WHERE id = @id;
            """, connection);

        cmd.Parameters.Add("@text", System.Data.SqlDbType.NVarChar, 400).Value =
            (object?)text ?? DBNull.Value;
        cmd.Parameters.Add("@status", System.Data.SqlDbType.NVarChar, 20).Value =
            (object?)status ?? DBNull.Value;
        cmd.Parameters.Add("@ord", System.Data.SqlDbType.Int).Value =
            (object?)body.Ordinal ?? DBNull.Value;
        cmd.Parameters.Add("@kind", System.Data.SqlDbType.NVarChar, 20).Value =
            (object?)kind ?? DBNull.Value;
        cmd.Parameters.Add("@celebrant", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.CelebrantRoleId, out var newWho) ? newWho : DBNull.Value;
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        int changed;
        try
        {
            changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                "Dieser Priester hat in dieser Messe schon eine eigene Intention.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcIntentionUpdatedResponse(
            RcId.ToText(id), changed > 0));
    }

    // -- Der Aushang ----------------------------------------------------------

    /// <summary>
    /// Am Schaukasten steht auch die ART.
    ///
    /// „Zbiorowa" gehoert dorthin, und zwar nicht als Kleingedrucktes: wer eine
    /// Intention gibt, hat ein Recht darauf zu wissen, ob sie allein oder mit
    /// anderen zusammen gelesen wird. Der Priester steht nicht dort — wer
    /// zelebriert, ist eine Frage der Dienstordnung und nicht des Aushangs.
    /// </summary>
    public sealed record PublicIntentionView(int Ordinal, string Text, string Kind);

    public sealed record PublicMassView(
        string ItemId, DateTimeOffset StartsUtc, DateTimeOffset EndsUtc,
        string? Title, string? Location, string Status,
        IReadOnlyList<PublicIntentionView> Intentions);

    public sealed record RcPublicMassesResponse(
        string Slug, string TimeZone, DateTimeOffset FromUtc, DateTimeOffset ToUtc,
        IReadOnlyList<PublicMassView> Masses);

    /// <summary>
    /// Der Messplan, wie er am Schaukasten haengt.
    ///
    /// <b>Nur was oeffentlich ist.</b> Gelesen werden ausschliesslich Eintraege
    /// vom Typ <c>mass</c> mit <c>visibility = 'public'</c>. Der Titel kommt aus
    /// <c>title_public</c> und NICHT aus dem versiegelten — den koennte dieser
    /// Weg gar nicht oeffnen, und genau das ist die Absicht.
    ///
    /// <b>Abgesagte Vorkommen fallen weg, zurueckgezogene Intentionen auch.</b>
    /// Ein Aushang, der eine abgesagte Messe zeigt, schickt Menschen vor eine
    /// verschlossene Kirche.
    /// </summary>
    private static async Task PublicAsync(
        HttpContext ctx, RcDb db, string slug, DateTimeOffset? from, DateTimeOffset? to)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * Ein Fenster, das nicht genannt wird, ist die kommende Woche — das ist
         * es, was am Schaukasten haengt. Und es ist begrenzt: eine Wiederholung
         * ohne Ende ueber zehn Jahre auszurechnen, weil jemand `to` vergessen
         * hat, ist eine Einladung, den Dienst zu beschaeftigen.
         */
        var start = from ?? DateTimeOffset.UtcNow.Date;
        var end = to ?? start.AddDays(8);
        if (end <= start) end = start.AddDays(8);
        if (end > start.AddDays(400)) end = start.AddDays(400);

        string? zoneName = null;
        var rows = new List<ItemRow>();

        await using (var cmd = new SqlCommand("""
            SELECT i.id, i.starts_at, i.ends_at, i.title_public, i.status,
                   i.repeat_kind, i.repeat_every, i.repeat_weekdays,
                   i.repeat_until, i.repeat_count, c.time_zone
            FROM dbo.rc_calendar_item i
            JOIN dbo.rc_calendar c ON c.id = i.calendar_id
            JOIN dbo.rc_parish p ON p.area_id = c.area_id
            WHERE p.slug = @slug
              AND i.item_type = @type
              AND i.visibility = N'public'
              AND i.status <> N'cancelled';
            """, connection))
        {
            cmd.Parameters.AddWithValue("@slug", slug);
            cmd.Parameters.AddWithValue("@type", ItemType);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                zoneName ??= reader.GetString(10);
                rows.Add(new ItemRow(
                    reader.GetGuid(0), reader.GetDateTimeOffset(1), reader.GetDateTimeOffset(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetString(4),
                    reader.GetString(5), reader.GetInt32(6),
                    reader.IsDBNull(7) ? (byte?)null : reader.GetByte(7),
                    reader.IsDBNull(8) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(8),
                    reader.IsDBNull(9) ? (int?)null : reader.GetInt32(9)));
            }
        }

        /*
         * Ohne Eintraege gibt es keine Zone zu lesen — und ohne Zone keine
         * Tagesgrenzen. Warschau ist hier kein Raten, sondern der einzige
         * Ort, an dem diese Pfarreien stehen; laege eine anderswo, haette
         * ihr Kalender eine Zone und diese Zeile liefe nie.
         */
        var zone = RcCalendar.TryZone(zoneName ?? "Europe/Warsaw", out var found) && found is not null
            ? found
            : TimeZoneInfo.Utc;
        var masses = new List<PublicMassView>();

        foreach (var row in rows)
        {
            var exceptions = await LoadExceptionsAsync(connection, row.Id, ctx.RequestAborted);
            var rule = new RcRecurrence.Rule(
                row.RepeatKind, row.RepeatEvery, row.RepeatWeekdays, row.RepeatUntil, row.RepeatCount);

            var occurrences = RcRecurrence.Expand(
                row.StartsAt, row.EndsAt, rule, zone, start, end, exceptions);

            foreach (var occurrence in occurrences)
            {
                var intentions = await PublicIntentionsAsync(
                    connection, row.Id, occurrence.OriginalStart, ctx.RequestAborted);

                masses.Add(new PublicMassView(
                    RcId.ToText(row.Id), occurrence.Start, occurrence.End,
                    row.TitlePublic, null, row.Status, intentions));
            }
        }

        masses.Sort((a, b) => a.StartsUtc.CompareTo(b.StartsUtc));

        await RcResults.WriteJsonAsync(ctx, new RcPublicMassesResponse(
            slug, zone.Id, start, end, masses));
    }

    private static async Task<IReadOnlyList<PublicIntentionView>> PublicIntentionsAsync(
        SqlConnection connection, Guid itemId, DateTimeOffset when, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT ordinal, text_public, kind FROM dbo.rc_mass_intention
            WHERE item_id = @item AND occurrence_at = @at AND status <> N'cancelled'
            ORDER BY ordinal, created_at;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.Add("@at", System.Data.SqlDbType.DateTimeOffset).Value = when;

        var found = new List<PublicIntentionView>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            found.Add(new PublicIntentionView(
                reader.GetInt32(0), reader.GetString(1), reader.GetString(2)));

        return found;
    }

    // -- Gemeinsames ----------------------------------------------------------

    private sealed record ItemRow(
        Guid Id, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string? TitlePublic, string Status,
        string RepeatKind, int RepeatEvery, byte? RepeatWeekdays,
        DateTimeOffset? RepeatUntil, int? RepeatCount);

    private static async Task<IReadOnlyList<RcRecurrence.Exception>> LoadExceptionsAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT occurrence_at, kind, new_starts_at, new_ends_at
            FROM dbo.rc_calendar_exception WHERE item_id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", itemId);

        var list = new List<RcRecurrence.Exception>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(new RcRecurrence.Exception(
                reader.GetDateTimeOffset(0), reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetDateTimeOffset(2),
                reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3)));
        }
        return list;
    }

    private static async Task<Guid?> AreaOfItemAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id FROM dbo.rc_calendar_item i
            JOIN dbo.rc_calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", itemId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static async Task<Guid?> AreaOfIntentionAsync(
        SqlConnection connection, Guid intentionId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id FROM dbo.rc_mass_intention m
            JOIN dbo.rc_calendar_item i ON i.id = m.item_id
            JOIN dbo.rc_calendar c ON c.id = i.calendar_id
            WHERE m.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", intentionId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static Task NotFound(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.NotFoundOrNoAccess, "Diese Messe gibt es nicht.");
}
