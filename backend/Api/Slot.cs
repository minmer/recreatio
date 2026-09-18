using System.Security.Cryptography;
using System.Text;

using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Termine, die man sich nehmen kann (0029).
///
/// <para>
/// <b>Kein zweiter Kalender.</b> Ein Termin ist ein Kalendereintrag wie jeder
/// andere; buchbar wird EIN VORKOMMEN davon, indem die Kanzlei eine Zeile in
/// <c>app.item_slot</c> setzt. Damit steht die Firmung in demselben Kalender
/// wie die Messen, und wer wissen will, was am Samstag los ist, sieht an einer
/// Stelle nach.
/// </para>
///
/// <para>
/// <b>Die Regel ist die des Altbestands</b>
/// (<c>EvaluateConfirmationMeetingJoinStatus</c>), und sie steht hier genau
/// einmal — in <see cref="JudgeAsync"/>. Zwei Stellen, die entscheiden, ob
/// jemand auf einen Termin darf, waeren zwei Gelegenheiten, es verschieden zu
/// tun.
/// </para>
///
/// <para>
/// <b>Wer fragt, ist ein PLATZ.</b> Ein Firmling hat kein Konto; sein Link ist
/// der Ausweis (0022). Wer ein Konto hat, kommt mit seiner Rolle — beide Wege
/// enden in derselben Buchung.
/// </para>
/// </summary>
public static class Slot
{
    /// <summary>Drei Tage, wie im Altbestand — <c>ConfirmationMeetingInviteHostHours</c>.</summary>
    public const int InviteHours = 72;

    /// <summary>Sechs Zeichen, wie im Altbestand: er wird abgetippt, nicht kopiert.</summary>
    private const int CodeLength = 6;

    /* Ohne 0, O, 1, I, L — auf Papier und per SMS sind sie dasselbe Zeichen. */
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static void Map(WebApplication app)
    {
        /* -- Die Kanzlei ---------------------------------------------------- */

        app.MapPost("/workspace/item/{id:guid}/slot", OpenAsync);
        app.MapPost("/workspace/item/{id:guid}/slot/close", CloseAsync);
        app.MapGet("/workspace/calendar/{id:guid}/slots", OfficeAsync);

        /* -- Ohne Konto, mit dem Link --------------------------------------- */

        app.MapGet("/slots", PublicAsync);
        app.MapPost("/slots/book", BookAsync);
        app.MapPost("/slots/release", ReleaseAsync);
        app.MapPost("/slots/ask", AskAsync);
        app.MapPost("/slots/decide", DecideAsync);
    }

    /* == Die Kanzlei: einen Termin zur Buchung freigeben ==================== */

    public sealed record OpenRequest(string OccurrenceAt, int Capacity);

    /// <summary>
    /// EIN VORKOMMEN eines Eintrags buchbar machen — ein „Vorschlag".
    ///
    /// <para>
    /// <b>Warum je Vorkommen und nicht je Eintrag.</b> „Spotkanie, samstags
    /// 10:00" ist ein Eintrag mit vielen Vorkommen; angeboten wird der 14.
    /// November. Wer die ganze Reihe anbieten will, gibt jedes Vorkommen frei —
    /// das ist mehr Tipparbeit und dafuer nie eine Ueberraschung.
    /// </para>
    /// </summary>
    private static async Task OpenAsync(HttpContext ctx, Db db, Guid id, OpenRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        if (body.Capacity < 1 || body.Capacity > 50)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Miejsc: od 1 do 50.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (areaId is null || !await Area.MayAsync(connection, who.Value.AccountId, areaId.Value,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using var cmd = new SqlCommand("""
            MERGE app.item_slot AS target
            USING (SELECT @item AS item_id, @at AS occurrence_at) AS source
                ON target.item_id = source.item_id AND target.occurrence_at = source.occurrence_at
            WHEN MATCHED THEN UPDATE SET capacity = @cap, updated_at = @now
            WHEN NOT MATCHED THEN
                INSERT (item_id, occurrence_at, capacity, created_at, updated_at)
                VALUES (@item, @at, @cap, @now, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@item", id);
        cmd.Parameters.AddWithValue("@at", at);
        cmd.Parameters.AddWithValue("@cap", body.Capacity);
        cmd.Parameters.AddWithValue("@now", now);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            itemId = Ids.ToText(id),
            occurrenceAt = at,
            capacity = body.Capacity
        });
    }

    public sealed record CloseRequest(string OccurrenceAt);

    /// <summary>
    /// Einen Vorschlag zurueckziehen.
    ///
    /// <para>
    /// <b>Nur, solange niemand darauf sitzt.</b> Einen Termin wegzunehmen, den
    /// jemand sich genommen hat, waere eine Absage — und die gehoert gesagt und
    /// nicht stillschweigend getan. Wer wirklich absagen will, sagt den
    /// KALENDEREINTRAG ab; das sieht der Firmling in seinem Portal.
    /// </para>
    /// </summary>
    private static async Task CloseAsync(HttpContext ctx, Db db, Guid id, CloseRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (areaId is null || !await Area.MayAsync(connection, who.Value.AccountId, areaId.Value,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        if (await TakenAsync(connection, id, at, ctx.RequestAborted) > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ktoś już się na to zapisał — odwołaj wpis w kalendarzu, a nie samą możliwość zapisu.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            foreach (var table in new[] { "app.slot_request", "app.slot_booking", "app.item_slot" })
            {
                await using var cmd = new SqlCommand(
                    $"DELETE FROM {table} WHERE item_id = @item AND occurrence_at = @at;", connection, tx);

                cmd.Parameters.AddWithValue("@item", id);
                cmd.Parameters.AddWithValue("@at", at);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(id), closed = true });
    }

    /* == Was ein Mensch sieht =============================================== */

    /// <summary>
    /// Die Termine eines Bereichs, mit ihrem Zustand fuer DIESEN Menschen.
    ///
    /// <para>
    /// Der Platz kommt als <c>?seat=</c>, wie beim Kalender. Ohne ihn gibt es
    /// die Liste trotzdem — wer nicht angemeldet ist, soll sehen, was es gibt,
    /// bevor er sich anmeldet; er sieht nur nicht, welcher seiner ist.
    /// </para>
    /// </summary>
    private static async Task PublicAsync(HttpContext ctx, Db db, string? seat, string? calendar)
    {
        if (!Guid.TryParse(calendar, out var calendarId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Którego kalendarza?");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, seat, ctx.RequestAborted);
        var rows = await ListAsync(connection, calendarId, ctx.RequestAborted);

        var out_ = new List<object>();

        foreach (var row in rows)
        {
            var taken = await TakenAsync(connection, row.ItemId, row.At, ctx.RequestAborted);
            var mine = me is null
                ? false
                : await HasBookingAsync(connection, row.ItemId, row.At, me.Value, ctx.RequestAborted);

            var verdict = Judge(row, taken, mine, me, null, DateTimeOffset.UtcNow);

            out_.Add(new
            {
                itemId = Ids.ToText(row.ItemId),
                occurrenceAt = row.At,
                minutes = row.Minutes,
                titlePublic = row.TitlePublic,
                capacity = row.Capacity,
                taken,
                mine,

                /* Was dieser Mensch hier tun kann — ein Wort, keine Rechnung. */
                state = verdict.ToString().ToLowerInvariant(),

                /*
                 * Ob der Gastgeber noch einladen darf — und WER er ist, steht
                 * NICHT dabei: das waere eine Auskunft ueber einen anderen
                 * Menschen an jeden, der die Liste holt.
                 */
                inviteOpen = row.InviteUntil is not null && row.InviteUntil > DateTimeOffset.UtcNow,
                iAmHost = me is not null && row.HostAccessId == me.Value
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { calendarId = Ids.ToText(calendarId), slots = out_ });
    }

    /* == Die Regel ========================================================== */

    public enum Verdict
    {
        /// <summary>Frei — wer will, nimmt ihn.</summary>
        Open,

        /// <summary>Besetzt bis auf den letzten Platz, und der gehoert dem Gastgeber.</summary>
        InviteNeeded,

        /// <summary>Das Fenster ist zu und es sitzen schon zwei darauf.</summary>
        Locked,

        /// <summary>Voll.</summary>
        Full,

        /// <summary>Dieser Mensch sitzt schon darauf.</summary>
        Mine
    }

    /// <summary>
    /// Darf dieser Mensch auf diesen Termin? — die Regel des Altbestands,
    /// unveraendert und an genau einer Stelle.
    ///
    /// <code>
    ///   besetzt >= Plaetze                 Full
    ///   besetzt == 0                       Open        (und er wird Gastgeber)
    ///   Fenster offen (72 h):
    ///       Gastgeber oder richtiger Code  Open
    ///       sonst                          InviteNeeded
    ///   Fenster zu:
    ///       besetzt == 1                   Open        (faellt an alle zurueck)
    ///       sonst                          Locked
    /// </code>
    /// </summary>
    public static Verdict Judge(
        SlotRow row, int taken, bool alreadyMine, Guid? me, string? code, DateTimeOffset now)
    {
        if (alreadyMine) return Verdict.Mine;
        if (taken >= row.Capacity) return Verdict.Full;
        if (taken == 0) return Verdict.Open;

        var windowOpen = row.InviteUntil is not null && row.InviteUntil > now;

        if (windowOpen)
        {
            if (me is not null && row.HostAccessId == me) return Verdict.Open;

            if (code is not null && row.InviteSha256 is not null
                && CryptographicOperations.FixedTimeEquals(row.InviteSha256, HashCode_(code)))
            {
                return Verdict.Open;
            }

            return Verdict.InviteNeeded;
        }

        return taken == 1 ? Verdict.Open : Verdict.Locked;
    }

    /* == Buchen ============================================================= */

    public sealed record BookRequest(string ItemId, string OccurrenceAt, string? Seat, string? Code);

    /// <summary>
    /// Sich einen Termin nehmen.
    ///
    /// <para>
    /// <b>Wer als Erster kommt, wird Gastgeber</b> und bekommt einen Code, der
    /// 72 Stunden gilt. Er steht in der Antwort GENAU EINMAL — gespeichert ist
    /// nur sein SHA-256, wie bei jedem Geheimnis hier.
    /// </para>
    ///
    /// <para>
    /// <b>Die Zaehlung und das Einfuegen stehen in EINER Transaktion</b>, und
    /// darueber wacht ausserdem ein eindeutiger Index (0029). Zwei Menschen, die
    /// im selben Augenblick auf den letzten Platz greifen, lesen sonst beide
    /// „noch frei".
    /// </para>
    /// </summary>
    private static async Task BookAsync(HttpContext ctx, Db db, BookRequest body)
    {
        if (!Guid.TryParse(body.ItemId, out var itemId)
            || !DateTimeOffset.TryParse(body.OccurrenceAt, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, body.Seat, ctx.RequestAborted);
        if (me is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var row = await OneAsync(connection, itemId, at, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Na ten termin nie ma zapisów.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var taken = await TakenAsync(connection, itemId, at, ctx.RequestAborted);
        var mine = await HasBookingAsync(connection, itemId, at, me.Value, ctx.RequestAborted);

        var verdict = Judge(row.Value, taken, mine, me, body.Code, now);

        if (verdict is not Verdict.Open)
        {
            await Fail(ctx, verdict switch
            {
                Verdict.Mine => StatusCodes.Status409Conflict,
                Verdict.Full => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status403Forbidden
            }, verdict switch
            {
                Verdict.Mine => "Już jesteś zapisany na ten termin.",
                Verdict.Full => "Ten termin jest już pełny.",
                Verdict.InviteNeeded => "Ten termin trzyma teraz ktoś inny — potrzebny jest kod od niego.",
                _ => "Na ten termin nie da się już dopisać."
            });
            return;
        }

        /* Der Code entsteht nur, wenn dieser Mensch der Erste ist. */
        var code = taken == 0 ? NewCode() : null;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.slot_booking (id, item_id, occurrence_at, access_id, booked_at)
                VALUES (@id, @item, @at, @who, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", Ids.NewId());
                insert.Parameters.AddWithValue("@item", itemId);
                insert.Parameters.AddWithValue("@at", at);
                insert.Parameters.AddWithValue("@who", me.Value);
                insert.Parameters.AddWithValue("@now", now);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (code is not null)
            {
                await using var host = new SqlCommand("""
                    UPDATE app.item_slot
                       SET host_access_id = @who, invite_sha256 = @hash,
                           invite_until = @until, updated_at = @now
                     WHERE item_id = @item AND occurrence_at = @at;
                    """, connection, tx);

                host.Parameters.AddWithValue("@who", me.Value);
                host.Parameters.AddBlob("@hash", HashCode_(code));
                host.Parameters.AddWithValue("@until", now.AddHours(InviteHours));
                host.Parameters.AddWithValue("@now", now);
                host.Parameters.AddWithValue("@item", itemId);
                host.Parameters.AddWithValue("@at", at);

                await host.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Już jesteś zapisany na ten termin.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            itemId = Ids.ToText(itemId),
            occurrenceAt = at,
            booked = true,

            /*
             * DER CODE STEHT GENAU EINMAL HIER. Gespeichert ist nur sein
             * Abdruck; wer ihn verliert, gibt den Termin zurueck und nimmt ihn
             * neu — einen zweiten Weg zu bauen hiesse, ein Geheimnis
             * nachschlagbar zu machen.
             */
            inviteCode = code,
            inviteUntil = code is null ? (DateTimeOffset?)null : now.AddHours(InviteHours)
        });
    }

    public sealed record ReleaseRequest(string ItemId, string OccurrenceAt, string? Seat);

    /// <summary>
    /// Einen Termin zurueckgeben.
    ///
    /// <para>
    /// <b>Die Zeile bleibt stehen</b> (<c>released_at</c>), und wenn der
    /// Gastgeber geht, geht auch sein Fenster: der naechste, der zugreift, wird
    /// Gastgeber und bekommt einen neuen Code. Das Fenster einfach weiterlaufen
    /// zu lassen hiesse, dass ein Code gilt, dessen Besitzer nicht mehr dabei
    /// ist.
    /// </para>
    /// </summary>
    private static async Task ReleaseAsync(HttpContext ctx, Db db, ReleaseRequest body)
    {
        if (!Guid.TryParse(body.ItemId, out var itemId)
            || !DateTimeOffset.TryParse(body.OccurrenceAt, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, body.Seat, ctx.RequestAborted);
        if (me is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using (var cmd = new SqlCommand("""
            UPDATE app.slot_booking SET released_at = @now
             WHERE item_id = @item AND occurrence_at = @at
               AND access_id = @who AND released_at IS NULL;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@item", itemId);
            cmd.Parameters.AddWithValue("@at", at);
            cmd.Parameters.AddWithValue("@who", me.Value);

            if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Nie jesteś zapisany na ten termin.");
                return;
            }
        }

        /* War er der Gastgeber, ist das Fenster mit ihm gegangen. */
        await using (var cmd = new SqlCommand("""
            UPDATE app.item_slot
               SET host_access_id = NULL, invite_sha256 = NULL, invite_until = NULL, updated_at = @now
             WHERE item_id = @item AND occurrence_at = @at AND host_access_id = @who;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@item", itemId);
            cmd.Parameters.AddWithValue("@at", at);
            cmd.Parameters.AddWithValue("@who", me.Value);

            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(itemId), released = true });
    }

    /* == Fragen statt Code ================================================== */

    public sealed record AskRequest(string ItemId, string OccurrenceAt, string? Seat);

    /// <summary>
    /// Den Gastgeber um Mitnahme bitten — der zweite Weg des Altbestands.
    ///
    /// <para>
    /// Nicht jeder hat den Code, aber jeder kann fragen. Angenommen wird die
    /// Bitte, indem der Dienst dieselbe Buchung schreibt, die auch ein Code
    /// erzeugt haette — es gibt nur EINEN Weg auf einen Termin.
    /// </para>
    /// </summary>
    private static async Task AskAsync(HttpContext ctx, Db db, AskRequest body)
    {
        if (!Guid.TryParse(body.ItemId, out var itemId)
            || !DateTimeOffset.TryParse(body.OccurrenceAt, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, body.Seat, ctx.RequestAborted);
        if (me is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var row = await OneAsync(connection, itemId, at, ctx.RequestAborted);
        if (row is null || row.Value.HostAccessId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Na tym terminie nie ma jeszcze nikogo, kogo można prosić.");
            return;
        }

        if (row.Value.HostAccessId == me)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "To Twój termin — nie musisz się prosić.");
            return;
        }

        await using var cmd = new SqlCommand("""
            INSERT INTO app.slot_request
                (id, item_id, occurrence_at, asked_by_access_id, status, created_at)
            VALUES (@id, @item, @at, @who, N'pending', @now);
            """, connection);

        cmd.Parameters.AddWithValue("@id", Ids.NewId());
        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", at);
        cmd.Parameters.AddWithValue("@who", me.Value);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Już o to prosiłeś — czekasz na odpowiedź.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(itemId), asked = true });
    }

    public sealed record DecideRequest(string RequestId, bool Accept, string? Seat);

    /// <summary>
    /// Der Gastgeber antwortet.
    ///
    /// <para>
    /// <b>Ja heisst buchen.</b> Die Annahme schreibt dieselbe Zeile wie ein
    /// Code — und sie geht durch dieselbe Pruefung: waehrend der Antwort kann
    /// der Termin voll geworden sein, und dann ist die Antwort ein Nein, das
    /// niemand gemeint hat. Besser gesagt als stillschweigend gebucht.
    /// </para>
    /// </summary>
    private static async Task DecideAsync(HttpContext ctx, Db db, DecideRequest body)
    {
        if (!Guid.TryParse(body.RequestId, out var requestId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna prośba.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var me = await SeatOfAsync(connection, body.Seat, ctx.RequestAborted);
        if (me is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        Guid itemId, askedBy;
        DateTimeOffset at;

        await using (var find = new SqlCommand("""
            SELECT r.item_id, r.occurrence_at, r.asked_by_access_id
            FROM app.slot_request r
            JOIN app.item_slot s ON s.item_id = r.item_id AND s.occurrence_at = r.occurrence_at
            WHERE r.id = @id AND r.status = N'pending' AND s.host_access_id = @me;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", requestId);
            find.Parameters.AddWithValue("@me", me.Value);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                /* „Nicht deine" und „gibt es nicht" bekommen dieselbe Antwort. */
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej prośby nie ma.");
                return;
            }

            itemId = reader.GetGuid(0);
            at = reader.GetDateTimeOffset(1);
            askedBy = reader.GetGuid(2);
        }

        var now = DateTimeOffset.UtcNow;

        if (!body.Accept)
        {
            await Decided(connection, requestId, "declined", now, ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { requestId = Ids.ToText(requestId), accepted = false });
            return;
        }

        var row = await OneAsync(connection, itemId, at, ctx.RequestAborted);
        var taken = await TakenAsync(connection, itemId, at, ctx.RequestAborted);

        if (row is null || taken >= row.Value.Capacity)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Termin zdążył się zapełnić — nie da się już nikogo dopisać.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.slot_booking (id, item_id, occurrence_at, access_id, booked_at)
                VALUES (@id, @item, @at, @who, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", Ids.NewId());
                insert.Parameters.AddWithValue("@item", itemId);
                insert.Parameters.AddWithValue("@at", at);
                insert.Parameters.AddWithValue("@who", askedBy);
                insert.Parameters.AddWithValue("@now", now);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var mark = new SqlCommand("""
                UPDATE app.slot_request SET status = N'accepted', decided_at = @now WHERE id = @id;
                """, connection, tx))
            {
                mark.Parameters.AddWithValue("@now", now);
                mark.Parameters.AddWithValue("@id", requestId);
                await mark.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta osoba jest już zapisana.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { requestId = Ids.ToText(requestId), accepted = true });
    }

    /* == Die Kanzleisicht =================================================== */

    private static async Task OfficeAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfCalendarAsync(connection, id, ctx.RequestAborted);
        if (areaId is null || !await Area.MayAsync(connection, who.Value.AccountId, areaId.Value,
                Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego kalendarza nie ma.");
            return;
        }

        var rows = await ListAsync(connection, id, ctx.RequestAborted);
        var out_ = new List<object>();

        foreach (var row in rows)
        {
            out_.Add(new
            {
                itemId = Ids.ToText(row.ItemId),
                occurrenceAt = row.At,
                minutes = row.Minutes,
                titlePublic = row.TitlePublic,
                capacity = row.Capacity,
                taken = await TakenAsync(connection, row.ItemId, row.At, ctx.RequestAborted),

                /*
                 * WER darauf sitzt, steht hier als Name des Platzes — den hat
                 * die Kanzlei selbst vergeben (`recipient_name`), er ist nicht
                 * versiegelt und niemandes Geheimnis.
                 */
                who = await SittersAsync(connection, row.ItemId, row.At, ctx.RequestAborted),
                inviteUntil = row.InviteUntil
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { calendarId = Ids.ToText(id), slots = out_ });
    }

    /* == Das Kleingedruckte ================================================= */

    public readonly record struct SlotRow(
        Guid ItemId, DateTimeOffset At, int Capacity, Guid? HostAccessId,
        byte[]? InviteSha256, DateTimeOffset? InviteUntil, int Minutes, string? TitlePublic);

    private static async Task<List<SlotRow>> ListAsync(
        SqlConnection connection, Guid calendarId, CancellationToken ct)
    {
        var rows = new List<SlotRow>();

        await using var cmd = new SqlCommand("""
            SELECT s.item_id, s.occurrence_at, s.capacity, s.host_access_id,
                   s.invite_sha256, s.invite_until,
                   DATEDIFF(MINUTE, i.starts_at, i.ends_at), i.title_public
            FROM app.item_slot s
            JOIN app.calendar_item i ON i.id = s.item_id
            WHERE i.calendar_id = @cal
            ORDER BY s.occurrence_at;
            """, connection);

        cmd.Parameters.AddWithValue("@cal", calendarId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new SlotRow(
                reader.GetGuid(0), reader.GetDateTimeOffset(1), reader.GetInt32(2),
                reader.IsDBNull(3) ? null : reader.GetGuid(3),
                reader.IsDBNull(4) ? null : (byte[])reader[4],
                reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5),
                reader.GetInt32(6),
                reader.IsDBNull(7) ? null : reader.GetString(7)));
        }

        return rows;
    }

    private static async Task<SlotRow?> OneAsync(
        SqlConnection connection, Guid itemId, DateTimeOffset at, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT s.capacity, s.host_access_id, s.invite_sha256, s.invite_until,
                   DATEDIFF(MINUTE, i.starts_at, i.ends_at), i.title_public
            FROM app.item_slot s
            JOIN app.calendar_item i ON i.id = s.item_id
            WHERE s.item_id = @item AND s.occurrence_at = @at;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", at);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new SlotRow(itemId, at, reader.GetInt32(0),
            reader.IsDBNull(1) ? null : reader.GetGuid(1),
            reader.IsDBNull(2) ? null : (byte[])reader[2],
            reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3),
            reader.GetInt32(4),
            reader.IsDBNull(5) ? null : reader.GetString(5));
    }

    private static async Task<int> TakenAsync(
        SqlConnection connection, Guid itemId, DateTimeOffset at, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT COUNT(*) FROM app.slot_booking
            WHERE item_id = @item AND occurrence_at = @at AND released_at IS NULL;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", at);

        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0);
    }

    private static async Task<bool> HasBookingAsync(
        SqlConnection connection, Guid itemId, DateTimeOffset at, Guid seatId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT TOP 1 1 FROM app.slot_booking
            WHERE item_id = @item AND occurrence_at = @at
              AND access_id = @who AND released_at IS NULL;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", at);
        cmd.Parameters.AddWithValue("@who", seatId);

        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    private static async Task<List<string>> SittersAsync(
        SqlConnection connection, Guid itemId, DateTimeOffset at, CancellationToken ct)
    {
        var names = new List<string>();

        await using var cmd = new SqlCommand("""
            SELECT ISNULL(a.recipient_name, N'bez nazwy')
            FROM app.slot_booking b
            LEFT JOIN app.access a ON a.id = b.access_id
            WHERE b.item_id = @item AND b.occurrence_at = @at AND b.released_at IS NULL
            ORDER BY b.booked_at;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@at", at);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) names.Add(reader.GetString(0));

        return names;
    }

    /// <summary>Der Platz hinter einem Token — oder <c>null</c>.</summary>
    private static async Task<Guid?> SeatOfAsync(
        SqlConnection connection, string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        await using var cmd = new SqlCommand("""
            SELECT id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now);
            """, connection);

        cmd.Parameters.AddWithValue("@token", SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static async Task<Guid?> AreaOfItemAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id FROM app.calendar_item i
            JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @item;
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static async Task<Guid?> AreaOfCalendarAsync(
        SqlConnection connection, Guid calendarId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT area_id FROM app.calendar WHERE id = @id;", connection);

        cmd.Parameters.AddWithValue("@id", calendarId);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static async Task Decided(
        SqlConnection connection, Guid requestId, string status, DateTimeOffset now, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "UPDATE app.slot_request SET status = @s, decided_at = @now WHERE id = @id;", connection);

        cmd.Parameters.AddWithValue("@s", status);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@id", requestId);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Sechs Zeichen, die sich abtippen lassen.
    ///
    /// <para>
    /// Ohne 0, O, 1, I und L: auf einem Zettel und in einer SMS sind sie
    /// dasselbe Zeichen, und ein Code, den man dreimal falsch abschreibt, ist
    /// keiner.
    /// </para>
    /// </summary>
    private static string NewCode()
    {
        var chars = new char[CodeLength];

        for (var i = 0; i < CodeLength; i++)
        {
            chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        }

        return new string(chars);
    }

    /* Gross oder klein getippt ist derselbe Code — er wird abgeschrieben. */
    private static byte[] HashCode_(string code) =>
        SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim().ToUpperInvariant()));

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
