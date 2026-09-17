using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Der individuelle Zugang — ein PLATZ in einem Bereich.
///
/// <para>
/// Vier Faelle, ein Gebilde: der Firmkandidat ohne Konto, der Teilnehmer, der
/// sich vom offenen Netz anmeldet, der Schueler in einer Klasse — und der
/// Schueler, dem der Lehrer etwas auf seine eigene Seite schreibt. Die ersten
/// drei schreiben herein, der letzte liest heraus. Dieselbe Zeile traegt beides.
/// </para>
///
/// <code>
///   personal_note_sealed   unter dem PLATZSCHLUESSEL   — beide lesen
///   internal_note_sealed   unter dem EPOCHENSCHLUESSEL — nur die Kanzlei
/// </code>
///
/// <para>
/// <b>Jeder Platz hat seinen eigenen Schluessel</b>, und er liegt dreifach
/// verpackt: unter dem Schluessel aus dem Link, unter dem Epochenschluessel des
/// Bereichs, und — sobald jemand den Platz an sein Konto bindet — unter dem
/// oeffentlichen Schluessel seiner Rolle.
/// </para>
///
/// <para>
/// Das ist der Unterschied zu 0005, wo der Link den EPOCHENSCHLUESSEL trug:
/// damit haette jeder Schueler jeden anderen Platz geoeffnet. 0023 nennt den
/// Befund; hier steht die Folge.
/// </para>
///
/// <para>
/// <b>Der Dienst oeffnet nichts.</b> Er nimmt Huellen entgegen, gibt sie
/// heraus, und kennt vom Link nur dessen SHA-256.
/// </para>
/// </summary>
public static class Seat
{
    public const int MaxName = 200;

    /// <summary>Ein Platz ohne Ablaufdatum ist einer, der in fuenf Jahren noch aufgeht.</summary>
    private static readonly TimeSpan DefaultLife = TimeSpan.FromDays(365);

    public static void Map(WebApplication app)
    {
        // Die Kanzlei.
        app.MapPost("/workspace/area/{id:guid}/seat", IssueAsync);
        app.MapGet("/workspace/area/{id:guid}/seats", ListAsync);
        app.MapPost("/workspace/seat/{id:guid}/note", NoteAsync);
        app.MapPost("/workspace/seat/{id:guid}/revoke", RevokeAsync);
        app.MapPost("/workspace/seat/{id:guid}/relink", RelinkAsync);

        // Meine eigenen Plaetze — ueber das Konto, ohne Link.
        app.MapGet("/workspace/seats", MineAsync);

        /*
         * Der Link. OHNE Konto — das ist der ganze Zweck: ein Vierzehnjaehriger
         * hat keines, und ein Teilnehmer soll sich fuer eine Anmeldung keines
         * anlegen muessen.
         */
        app.MapGet("/seat/{token}", OpenAsync);
        app.MapPost("/seat/{token}/bind", BindAsync);

        /*
         * SEINE EIGENE EINSENDUNG BERICHTIGEN — ohne Konto, mit dem Link.
         *
         * Wer sich selbst angemeldet hat, hat sich vertippt oder ist umgezogen.
         * Ihn dafuer in die Kanzlei zu schicken hiesse: die Angabe gehoert dem
         * Amt. Sie gehoert ihm.
         */
        app.MapPost("/seat/{token}/submission", ReviseAsync);
    }

    /* -- Ausstellen --------------------------------------------------------- */

    /// <summary>
    /// Ein Schluessel, den dieser Platz AUSSERDEM aufschliesst — versiegelt
    /// unter dem Platzschluessel.
    ///
    /// <para>
    /// Der Fall ist die Klasse: das Gemeinsame liegt in einem eigenen Bereich,
    /// und jeder Platz traegt dessen Schluessel. Die Notizen des Lehrers liegen
    /// im ANDEREN Bereich und bleiben damit zu.
    /// </para>
    /// </summary>
    public sealed record GrantIn(string AreaId, int Epoch, string Sealed);

    public sealed record IssueRequest(
        string SeatId,
        string TokenSha256,
        string SeatKeySealed,
        string SeatKeyForArea,
        int Epoch,
        string OwnerRoleId,
        string? RecipientName,
        string? PersonalNoteSealed,
        string? InternalNoteSealed,
        IReadOnlyList<string>? SlugIds,
        IReadOnlyList<GrantIn>? Grants,
        int? Days);

    /// <summary>
    /// Einen Platz ausstellen.
    ///
    /// <para>
    /// <b>Die Kennung entsteht im Browser</b>, wie beim Bereich: die AAD des
    /// Platzschluessels nennt den Platz, also muss er existieren, bevor der
    /// Schluessel verpackt werden kann.
    /// </para>
    ///
    /// <para>
    /// <b>Der Dienst sieht den Link nie.</b> Er bekommt dessen SHA-256; das
    /// Geheimnis selbst bleibt im Browser des Ausstellenden, bis es verschickt
    /// ist. Geht es dabei verloren, ist der Platz verloren — und genau deshalb
    /// steht das Zurueckziehen daneben.
    /// </para>
    /// </summary>
    private static async Task IssueAsync(HttpContext ctx, Db db, Guid id, IssueRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.SeatId, out var seatId) || !Guid.TryParse(body.OwnerRoleId, out var ownerRoleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Epoka zaczyna się od 1.");
            return;
        }

        if (!Blob(body.TokenSha256, out var tokenHash) || tokenHash.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk linku musi mieć 32 bajty.");
            return;
        }

        if (!Blob(body.SeatKeySealed, out var forLink) || forLink.Length == 0
            || !Blob(body.SeatKeyForArea, out var forArea) || forArea.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany klucz miejsca.");
            return;
        }

        var personal = Optional(body.PersonalNoteSealed);
        var internalNote = Optional(body.InternalNoteSealed);

        var slugIds = new List<Guid>();
        foreach (var raw in body.SlugIds ?? [])
        {
            if (!Guid.TryParse(raw, out var slugId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung adresu.");
                return;
            }
            slugIds.Add(slugId);
        }

        var grants = new List<(Guid Area, int Epoch, byte[] Blob)>();
        foreach (var one in body.Grants ?? [])
        {
            if (!Guid.TryParse(one.AreaId, out var grantArea) || one.Epoch < 1
                || !Blob(one.Sealed, out var grantBlob) || grantBlob.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz wspólny.");
                return;
            }

            grants.Add((grantArea, one.Epoch, grantBlob));
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == ownerRoleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var until = now + (body.Days is > 0 ? TimeSpan.FromDays(Math.Min(body.Days.Value, 3650)) : DefaultLife);
        var name = (body.RecipientName ?? string.Empty).Trim();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.access
                    (id, area_id, token_sha256, seat_key_sealed, seat_key_for_area, epoch,
                     recipient_name, personal_note_sealed, internal_note_sealed,
                     created_by_role_id, created_at, expires_at)
                VALUES (@id, @area, @token, @forLink, @forArea, @epoch,
                        @name, @personal, @internal, @by, @now, @until);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", seatId);
                insert.Parameters.AddWithValue("@area", id);
                insert.Parameters.AddWithValue("@token", tokenHash);
                insert.Parameters.AddWithValue("@forLink", forLink);
                insert.Parameters.AddWithValue("@forArea", forArea);
                insert.Parameters.AddWithValue("@epoch", body.Epoch);
                insert.Parameters.AddWithValue("@name",
                    name == "" ? DBNull.Value : name[..Math.Min(name.Length, MaxName)]);
                insert.Parameters.AddBlob("@personal", personal);
                insert.Parameters.AddBlob("@internal", internalNote);
                insert.Parameters.AddWithValue("@by", ownerRoleId);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@until", until);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var slugId in slugIds.Distinct())
            {
                await using var open = new SqlCommand(
                    "INSERT INTO app.access_slug (access_id, slug_id) VALUES (@a, @s);", connection, tx);

                open.Parameters.AddWithValue("@a", seatId);
                open.Parameters.AddWithValue("@s", slugId);
                await open.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            /*
             * Die gemeinsamen Schluessel — in DERSELBEN Transaktion. Ein Platz,
             * der ohne sie entstuende, waere einer, auf dem das Gemeinsame
             * fehlt, und niemand saehe warum.
             */
            foreach (var (grantArea, grantEpoch, grantBlob) in grants)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.access_grant (access_id, area_id, epoch, sealed_blob, created_at)
                    VALUES (@a, @area, @epoch, @blob, @now);
                    """, connection, tx);

                add.Parameters.AddWithValue("@a", seatId);
                add.Parameters.AddWithValue("@area", grantArea);
                add.Parameters.AddWithValue("@epoch", grantEpoch);
                add.Parameters.AddWithValue("@blob", grantBlob);
                add.Parameters.AddWithValue("@now", now);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Takie miejsce już istnieje.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seatId),
            areaId = Ids.ToText(id),
            recipientName = name == "" ? null : name,
            expiresAt = until
        });
    }

    /* -- Die Kanzleisicht --------------------------------------------------- */

    /// <summary>
    /// Die Plaetze eines Bereichs.
    ///
    /// <para>
    /// Mit beiden Huellen: die Kanzlei braucht <c>seat_key_for_area</c>, um den
    /// Platzschluessel zu oeffnen, und den Epochenschluessel fuer die interne
    /// Notiz. Beides geht versiegelt hinaus — geoeffnet wird im Browser.
    /// </para>
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        /*
         * BEIDE Wege der Kanzlei stehen hier (0027), und genau EINER ist je
         * Zeile gefuellt:
         *
         *   seat_key_for_area     das Amt hat den Platz ausgestellt
         *   seat_key_for_intake   jemand hat sich selbst angemeldet
         *
         * `origin` sagt welcher, damit die Oberflaeche nicht aus „welche Spalte
         * ist leer" darauf schliessen muss.
         */
        await using var cmd = new SqlCommand("""
            SELECT a.id, a.recipient_name, a.seat_key_for_area, a.epoch,
                   a.personal_note_sealed, a.internal_note_sealed,
                   a.status, a.view_count, a.created_at, a.expires_at, a.revoked_at,
                   (SELECT COUNT(*) FROM app.access_holder h
                     WHERE h.access_id = a.id AND h.until IS NULL) AS holders,
                   a.seat_key_for_intake, a.origin,

                   /*
                    * Wohin der Platz gehoert — damit ein neu ausgestellter Link
                    * sich liest wie die Adresse, unter der der Mensch ihn
                    * erwartet, und nicht als loses `#/seat/…`.
                    */
                   (SELECT TOP 1 s.path FROM app.access_slug g
                     JOIN app.slug s ON s.id = g.slug_id
                    WHERE g.access_id = a.id ORDER BY LEN(s.path)) AS under_path
            FROM app.access a
            WHERE a.area_id = @area
            ORDER BY a.created_at DESC;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);

        var seats = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            seats.Add(new
            {
                seatId = Ids.ToText(reader.GetGuid(0)),
                recipientName = reader.IsDBNull(1) ? null : reader.GetString(1),
                seatKeyForArea = reader.IsDBNull(2) ? null : Base64Url.Encode((byte[])reader[2]),
                seatKeyForIntake = reader.IsDBNull(12) ? null : Base64Url.Encode((byte[])reader[12]),
                origin = reader.GetString(13),
                under = reader.IsDBNull(14) ? null : reader.GetString(14),
                epoch = reader.GetInt32(3),
                personalNoteSealed = reader.IsDBNull(4) ? null : Base64Url.Encode((byte[])reader[4]),
                internalNoteSealed = reader.IsDBNull(5) ? null : Base64Url.Encode((byte[])reader[5]),
                status = reader.GetString(6),
                viewCount = reader.GetInt32(7),
                createdAt = reader.GetDateTimeOffset(8),
                expiresAt = reader.IsDBNull(9) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(9),
                revokedAt = reader.IsDBNull(10) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(10),
                holders = reader.GetInt32(11)
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), seats });
    }

    public sealed record NoteRequest(string? PersonalNoteSealed, string? InternalNoteSealed);

    /// <summary>
    /// Die Notizen setzen — der Fall des Lehrers.
    ///
    /// <para>
    /// Nur was genannt wurde. Ein Aufruf, der bloss die interne Notiz aendern
    /// will, darf die persoenliche nicht nebenbei loeschen.
    /// </para>
    /// </summary>
    private static async Task NoteAsync(HttpContext ctx, Db db, Guid id, NoteRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var area = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego miejsca nie ma.");
            return;
        }

        var personal = Optional(body.PersonalNoteSealed);
        var internalNote = Optional(body.InternalNoteSealed);

        if (personal is null && internalNote is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie podano żadnej notatki.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.access
               SET personal_note_sealed = ISNULL(@personal, personal_note_sealed),
                   internal_note_sealed = ISNULL(@internal, internal_note_sealed)
             WHERE id = @id;
            """, connection);

        cmd.Parameters.AddBlob("@personal", personal);
        cmd.Parameters.AddBlob("@internal", internalNote);
        cmd.Parameters.AddWithValue("@id", id);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { seatId = Ids.ToText(id), updated = true });
    }

    /// <summary>
    /// Den Link zurueckziehen.
    ///
    /// <para>
    /// <b>Die Halter bleiben.</b> Wer den Platz an sein Konto gebunden hat,
    /// kommt weiter heran — er haelt den Platzschluessel unter seinem
    /// Rollenschluessel. Zurueckgezogen wird der LINK, und das ist die Absicht:
    /// ein Zettel, der herumliegt, soll aufhoeren zu gelten, ohne dass der
    /// Mensch dahinter ausgesperrt wird.
    /// </para>
    /// </summary>
    public sealed record ReviseValue(string FieldId, string Sealed, string WrappedKey, string SeatKeySealed);

    public sealed record ReviseRequest(string RegistrationId, IReadOnlyList<ReviseValue> Values);

    /// <summary>
    /// Die eigene Einsendung berichtigen — mit dem Link, ohne Konto.
    ///
    /// <para>
    /// <b>Der Link ist der Ausweis.</b> Wer ihn hat, ist gemeint; derselbe
    /// Satz wie ueberall sonst am Platz. Geprueft wird deshalb nur, dass die
    /// Einsendung AN DIESEM Platz haengt — eine fremde laesst sich damit nicht
    /// anfassen.
    /// </para>
    ///
    /// <para>
    /// <b>Ersetzt wird, was mitkommt</b>, und zwar Feld fuer Feld. Was nicht
    /// genannt ist, bleibt stehen: ein Browser, der nur ein Feld schickt, soll
    /// nicht die uebrigen loeschen, bloss weil er sie nicht erwaehnt hat.
    /// </para>
    ///
    /// <para>
    /// <b>Der Dienst sieht auch hier nichts.</b> Er bekommt dieselben drei
    /// Huellen wie beim ersten Mal: den Wert, den Wertschluessel unter der
    /// oeffentlichen Annahmehaelfte, und denselben Wertschluessel unter dem
    /// Platzschluessel. Oeffnen kann er keine davon.
    /// </para>
    /// </summary>
    private static async Task ReviseAsync(HttpContext ctx, Db db, string token, ReviseRequest body)
    {
        if (string.IsNullOrWhiteSpace(token)
            || !Guid.TryParse(body.RegistrationId, out var registrationId))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego zgłoszenia nie ma.");
            return;
        }

        var values = body.Values ?? [];

        if (values.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie podano żadnej poprawki.");
            return;
        }

        var parsed = new List<(Guid Field, byte[] Sealed, byte[] Wrapped, byte[] ForSeat)>();

        foreach (var one in values)
        {
            if (!Guid.TryParse(one.FieldId, out var fieldId)
                || !Blob(one.Sealed, out var sealedValue) || sealedValue.Length == 0
                || !Blob(one.WrappedKey, out var wrapped) || wrapped.Length == 0
                || !Blob(one.SeatKeySealed, out var forSeat) || forSeat.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna poprawka.");
                return;
            }

            parsed.Add((fieldId, sealedValue, wrapped, forSeat));
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * EINE Abfrage fuer beides: gibt es den Platz, und haengt diese
         * Einsendung daran. Zwei hintereinander liessen dazwischen Raum fuer
         * die Frage „wessen Einsendung ist das eigentlich".
         */
        await using (var cmd = new SqlCommand("""
            SELECT TOP 1 1
            FROM app.access a
            JOIN app.registration r ON r.access_id = a.id
            WHERE a.token_sha256 = @token
              AND a.revoked_at IS NULL AND a.status = N'active'
              AND (a.expires_at IS NULL OR a.expires_at > @now)
              AND r.id = @reg;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@token",
                SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token.Trim())));
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@reg", registrationId);

            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is null)
            {
                // Dieselbe Antwort fuer „gibt es nicht" und „nicht deine".
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego zgłoszenia nie ma.");
                return;
            }
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            foreach (var (fieldId, sealedValue, wrapped, forSeat) in parsed)
            {
                /*
                 * Ersetzen heisst hier: die alte Zeile geht, die neue kommt.
                 * Ein UPDATE waere kuerzer und liefe ins Leere, wenn das Feld
                 * beim ersten Mal uebersprungen wurde — dann gibt es keine
                 * Zeile, die sich aendern liesse.
                 */
                await using (var drop = new SqlCommand("""
                    DELETE FROM app.registration_value
                     WHERE registration_id = @reg AND field_id = @field;
                    """, connection, tx))
                {
                    drop.Parameters.AddWithValue("@reg", registrationId);
                    drop.Parameters.AddWithValue("@field", fieldId);
                    await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await using var add = new SqlCommand("""
                    INSERT INTO app.registration_value
                        (registration_id, field_id, value_sealed, wrapped_key, seat_key_sealed)
                    VALUES (@reg, @field, @value, @wrapped, @seat);
                    """, connection, tx);

                add.Parameters.AddWithValue("@reg", registrationId);
                add.Parameters.AddWithValue("@field", fieldId);
                add.Parameters.AddBlob("@value", sealedValue);
                add.Parameters.AddBlob("@wrapped", wrapped);
                add.Parameters.AddBlob("@seat", forSeat);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new
            {
                registrationId = Ids.ToText(registrationId),
                revised = parsed.Count
            });
        }
        catch (SqlException e) when (e.Number == 547)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To pytanie już nie należy do tego formularza.");
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    public sealed record RelinkRequest(string TokenSha256, string SeatKeySealed);

    /// <summary>
    /// EINEN NEUEN LINK auf denselben Platz — zum Verschicken per SMS.
    ///
    /// <para>
    /// <b>Der alte ist nicht wiederzubekommen.</b> Gespeichert ist nur sein
    /// SHA-256; niemand kann ihn nachschlagen, auch der Betreiber nicht. Wer
    /// sich selbst angemeldet hat, hat ihn EINMAL gesehen — und wenn er ihn
    /// verloren hat, ist er fort.
    /// </para>
    ///
    /// <para>
    /// <b>Der PLATZSCHLUESSEL bleibt derselbe</b>, und daran haengt alles: die
    /// eigenen Angaben, die persoenliche Notiz, die gemeinsamen Schluessel
    /// liegen unter ihm. Neu ist nur die Huelle darum — derselbe Schluessel,
    /// unter einem neuen Linkgeheimnis versiegelt. Einen neuen Platz
    /// auszustellen waere kuerzer und falsch: die Antworten des Menschen
    /// blieben unter dem alten und waeren fuer ihn verloren.
    /// </para>
    ///
    /// <para>
    /// <b>Der alte Link stirbt dabei</b>, weil der Abdruck ersetzt wird. Das
    /// ist die Absicht: ein Link, den man neu ausstellt, wird neu ausgestellt,
    /// WEIL der alte nicht mehr gelten soll.
    /// </para>
    ///
    /// <para>
    /// Aufpacken kann die Kanzlei den Platzschluessel ohnehin — ueber die
    /// Epoche (ausgestellter Platz) oder ueber die Annahme (Selbstanmeldung,
    /// 0027). Der Dienst bekommt auch hier nur Huellen zu sehen.
    /// </para>
    /// </summary>
    private static async Task RelinkAsync(HttpContext ctx, Db db, Guid id, RelinkRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Blob(body.TokenSha256, out var tokenHash) || tokenHash.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk linku musi mieć 32 bajty.");
            return;
        }

        if (!Blob(body.SeatKeySealed, out var forLink) || forLink.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany klucz miejsca.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var area = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego miejsca nie ma.");
            return;
        }

        /*
         * Ein zurueckgezogener Platz bekommt keinen neuen Link. Sonst waere das
         * Zuruecknehmen eine Bitte statt einer Tatsache.
         */
        await using var cmd = new SqlCommand("""
            UPDATE app.access
               SET token_sha256 = @token, seat_key_sealed = @forLink, view_count = 0
             WHERE id = @id AND revoked_at IS NULL AND status = N'active';
            """, connection);

        cmd.Parameters.AddWithValue("@token", tokenHash);
        cmd.Parameters.AddBlob("@forLink", forLink);
        cmd.Parameters.AddWithValue("@id", id);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To miejsce jest wycofane — nowy link nic by nie otworzył.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { seatId = Ids.ToText(id), relinked = true });
    }

    private static async Task RevokeAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var area = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego miejsca nie ma.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE app.access SET status = N'revoked', revoked_at = @now WHERE id = @id AND revoked_at IS NULL;",
            connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { seatId = Ids.ToText(id), revoked = true });
    }

    /* -- Der Link ----------------------------------------------------------- */

    /// <summary>
    /// Was der Link oeffnet — OHNE Konto.
    ///
    /// <para>
    /// Der Dienst rechnet den Abdruck des mitgegebenen Geheimnisses und sucht
    /// danach. Den SCHLUESSEL bekommt er dabei nicht: der steht hinter der
    /// Raute und bleibt im Browser. Was hier hinausgeht, ist die Huelle.
    /// </para>
    ///
    /// <para>
    /// <b>Ein abgelaufener oder zurueckgezogener Platz antwortet wie einer, den
    /// es nicht gibt.</b> Der Unterschied waere eine Auskunft darueber, welche
    /// Links es einmal gab.
    /// </para>
    /// </summary>
    private static async Task OpenAsync(HttpContext ctx, Db db, string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * Gezaehlt wird beim Oeffnen, und zwar in derselben Anweisung: eine
         * zweite waere eine zweite Runde und koennte ausbleiben.
         */
        await using var cmd = new SqlCommand("""
            UPDATE app.access
               SET view_count = view_count + 1
            OUTPUT inserted.id, inserted.area_id, inserted.seat_key_sealed, inserted.epoch,
                   inserted.recipient_name, inserted.personal_note_sealed, inserted.expires_at
             WHERE token_sha256 = @token
               AND revoked_at IS NULL
               AND status = N'active'
               AND (expires_at IS NULL OR expires_at > @now);
            """, connection);

        cmd.Parameters.AddWithValue("@token", SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token.Trim())));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        /*
         * Der Leser wird GESCHLOSSEN, bevor die Zuteilungen geholt werden. Ein
         * zweiter Befehl ueber dieselbe Verbindung, waehrend er offen ist,
         * weist SQL Server ohne MARS ab — und von aussen saehe es aus wie ein
         * Platz ohne Gemeinsames.
         */
        Guid seatId, areaId;
        byte[] seatKeySealed;
        int epoch;
        string? recipientName;
        byte[]? personalNote;
        DateTimeOffset? expiresAt;

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
                return;
            }

            seatId = reader.GetGuid(0);
            areaId = reader.GetGuid(1);
            seatKeySealed = (byte[])reader[2];
            epoch = reader.GetInt32(3);
            recipientName = reader.IsDBNull(4) ? null : reader.GetString(4);
            personalNote = reader.IsDBNull(5) ? null : (byte[])reader[5];
            expiresAt = reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6);
        }

        /*
         * Was dieser Platz AUSSERDEM aufschliesst — der Klassenschluessel.
         * Versiegelt unter dem Platzschluessel: der Dienst reicht ihn durch,
         * ohne ihn zu kennen.
         */
        var bySeat = await GrantsAsync(connection, [seatId], ctx.RequestAborted);

        /*
         * WAS ER SELBST EINGESANDT HAT (0027). Der Wertschluessel liegt ein
         * zweites Mal da, versiegelt unter dem Platzschluessel — der Dienst
         * reicht ihn durch, ohne ihn zu kennen, wie alles andere hier auch.
         *
         * Ohne das waere das Portal eines Firmlings leer: seine Angaben liegen
         * unter dem Annahmeschluessel, und der gehoert dem Amt.
         */
        var submitted = await SubmittedAsync(connection, seatId, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seatId),
            areaId = Ids.ToText(areaId),

            // Die Huelle des Platzschluessels. Der Oeffner steckt im Link.
            seatKeySealed = Base64Url.Encode(seatKeySealed),
            epoch,

            recipientName,
            personalNoteSealed = personalNote is null ? null : Base64Url.Encode(personalNote),
            expiresAt,

            grants = bySeat.TryGetValue(seatId, out var list) ? list : [],
            submitted
        });
    }

    /// <summary>
    /// Was ueber DIESEN Platz eingesandt wurde — Frage und Antwort, beide
    /// versiegelt.
    ///
    /// <para>
    /// <b>Die Beschriftung geht mit.</b> Ohne sie stuenden im Portal Werte ohne
    /// Fragen — „Kowalski", „2011-04-03" — und niemand wuesste, wonach gefragt
    /// worden war. Sie liegt unter dem EPOCHENSCHLUESSEL des Bereichs, den ein
    /// oeffentliches Formular ohnehin veroeffentlicht haben muss; sonst haette
    /// der Einsendende das Formular gar nicht lesen koennen.
    /// </para>
    ///
    /// <para>
    /// <b>Ohne <c>seat_key_sealed</c> bleibt eine Zeile weg.</b> Das ist eine
    /// Einsendung, die ueber einen anderen Weg kam — sie gehoert dem Amt, nicht
    /// diesem Platz. Sie hier als „verschlossen" zu zeigen hiesse, ihre
    /// Existenz zu verraten.
    /// </para>
    /// </summary>
    private static async Task<List<object>> SubmittedAsync(
        SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        var out_ = new List<object>();

        await using var cmd = new SqlCommand("""
            SELECT f.id, f.kind, f.position, f.area_id, f.epoch, f.label_sealed,
                   v.value_sealed, v.seat_key_sealed, r.submitted_at, r.id
            FROM app.registration r
            JOIN app.registration_value v ON v.registration_id = r.id
            JOIN app.slug_field f         ON f.id = v.field_id
            WHERE r.access_id = @seat AND v.seat_key_sealed IS NOT NULL
            ORDER BY r.submitted_at, f.position;
            """, connection);

        cmd.Parameters.AddWithValue("@seat", seatId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            out_.Add(new
            {
                fieldId = Ids.ToText(reader.GetGuid(0)),
                kind = reader.GetString(1),
                position = reader.GetInt32(2),
                areaId = Ids.ToText(reader.GetGuid(3)),
                epoch = reader.GetInt32(4),
                labelSealed = Base64Url.Encode((byte[])reader[5]),
                valueSealed = Base64Url.Encode((byte[])reader[6]),
                valueKeySealed = Base64Url.Encode((byte[])reader[7]),
                submittedAt = reader.GetDateTimeOffset(8),

                /* Damit eine Berichtigung sagen kann, WELCHE Einsendung sie meint. */
                registrationId = Ids.ToText(reader.GetGuid(9))
            });
        }

        return out_;
    }

    /// <summary>
    /// Die gemeinsamen Schluessel je Platz — mit dem, was sie aufschliessen.
    ///
    /// <para>
    /// Der Kalender steht dabei, weil der Schluessel allein nichts nuetzt: ohne
    /// die Kennung wuesste ein Schueler ohne Konto nicht, WAS er damit oeffnen
    /// kann, und muesste danach fragen — was er ohne Konto nicht kann.
    /// </para>
    /// </summary>
    private static async Task<Dictionary<Guid, List<object>>> GrantsAsync(
        SqlConnection connection, IReadOnlyList<Guid> seatIds, CancellationToken ct)
    {
        var map = new Dictionary<Guid, List<object>>();
        if (seatIds.Count == 0) return map;

        var rows = new List<(Guid Seat, Guid Area, string Name, int Epoch, byte[] Blob)>();
        var names = string.Join(", ", seatIds.Select((_, i) => $"@s{i}"));

        await using (var cmd = new SqlCommand(
            $"SELECT g.access_id, g.area_id, a.name, g.epoch, g.sealed_blob "
            + $"FROM app.access_grant g JOIN app.area a ON a.id = g.area_id "
            + $"WHERE g.access_id IN ({names});", connection))
        {
            for (var i = 0; i < seatIds.Count; i++) cmd.Parameters.AddWithValue($"@s{i}", seatIds[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.GetInt32(3), (byte[])reader[4]));
            }
        }

        if (rows.Count == 0) return map;

        /* Die Kalender der aufgeschlossenen Bereiche — der Leser ist zu. */
        var calendars = new Dictionary<Guid, List<object>>();
        var areaIds = rows.Select(r => r.Area).Distinct().ToList();
        var areaNames = string.Join(", ", areaIds.Select((_, i) => $"@a{i}"));

        await using (var cmd = new SqlCommand(
            $"SELECT area_id, id, title, time_zone FROM app.calendar WHERE area_id IN ({areaNames});",
            connection))
        {
            for (var i = 0; i < areaIds.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areaIds[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var area = reader.GetGuid(0);
                if (!calendars.TryGetValue(area, out var list)) calendars[area] = list = [];

                list.Add(new
                {
                    calendarId = Ids.ToText(reader.GetGuid(1)),
                    title = reader.GetString(2),
                    timeZone = reader.GetString(3)
                });
            }
        }

        foreach (var row in rows)
        {
            if (!map.TryGetValue(row.Seat, out var list)) map[row.Seat] = list = [];

            list.Add(new
            {
                areaId = Ids.ToText(row.Area),
                areaName = row.Name,
                epoch = row.Epoch,
                @sealed = Base64Url.Encode(row.Blob),
                calendars = calendars.TryGetValue(row.Area, out var found) ? found : []
            });
        }

        return map;
    }

    public sealed record BindRequest(string RoleId, string SeatKeySealed);

    /// <summary>
    /// Den Platz an eine Person binden.
    ///
    /// <para>
    /// <b>Der Browser verpackt den Platzschluessel fuer die Rolle</b> — er hat
    /// ihn gerade aus dem Link geoeffnet. Der Dienst bekommt nur die fertige
    /// Huelle; er koennte sie nicht herstellen, denn er hat den Schluessel nie.
    /// </para>
    ///
    /// <para>
    /// <b>Welche Person, wird gefragt und nicht geraten.</b> Ein Elternteil mit
    /// zwei Kindern oeffnet zwei Links; ohne diese Frage landeten beide bei
    /// derselben Person — und weil die Angaben trotzdem aufgingen, faende es
    /// niemand heraus.
    /// </para>
    /// </summary>
    private static async Task BindAsync(HttpContext ctx, Db db, string token, BindRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
            return;
        }

        if (!Blob(body.SeatKeySealed, out var wrapped) || wrapped.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany klucz miejsca.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        Guid seatId;
        await using (var find = new SqlCommand("""
            SELECT id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now);
            """, connection))
        {
            find.Parameters.AddWithValue("@token",
                SHA256.HashData(System.Text.Encoding.UTF8.GetBytes((token ?? string.Empty).Trim())));
            find.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
                return;
            }
            seatId = found;
        }

        await using var upsert = new SqlCommand("""
            UPDATE app.access_holder
               SET seat_key_sealed = @blob, until = NULL
             WHERE access_id = @seat AND role_id = @role;

            IF @@ROWCOUNT = 0
                INSERT INTO app.access_holder (access_id, role_id, added_by_role_id, since, seat_key_sealed)
                VALUES (@seat, @role, @role, @now, @blob);
            """, connection);

        upsert.Parameters.AddWithValue("@seat", seatId);
        upsert.Parameters.AddWithValue("@role", roleId);
        upsert.Parameters.AddWithValue("@blob", wrapped);
        upsert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await upsert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seatId),
            roleId = Ids.ToText(roleId),
            bound = true
        });
    }

    /* -- Meine Plaetze ------------------------------------------------------ */

    /// <summary>
    /// Die Plaetze, die eine meiner Rollen haelt — ohne Link.
    ///
    /// <para>
    /// Mit der Huelle des Platzschluessels unter der jeweiligen Rolle: erst
    /// damit ist das Binden mehr als ein Eintrag in einer Liste.
    /// </para>
    /// </summary>
    private static async Task MineAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { seats = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT a.id, a.area_id, ar.name, a.recipient_name,
                   h.role_id, h.seat_key_sealed, a.epoch,
                   a.personal_note_sealed, a.status, a.expires_at
            FROM app.access_holder h
            JOIN app.access a  ON a.id = h.access_id
            JOIN app.area   ar ON ar.id = a.area_id
            WHERE h.until IS NULL
              AND h.seat_key_sealed IS NOT NULL
              AND h.role_id IN ({names})
            ORDER BY a.created_at DESC;
            """, connection);

        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        /* Erst sammeln, dann den Leser schliessen — siehe `OpenAsync`. */
        var rows = new List<(Guid Seat, Guid Area, string AreaName, string? Name, Guid Role,
            byte[] KeySealed, int Epoch, byte[]? Note, string Status, DateTimeOffset? Until)>();

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.GetGuid(4), (byte[])reader[5], reader.GetInt32(6),
                    reader.IsDBNull(7) ? null : (byte[])reader[7],
                    reader.GetString(8),
                    reader.IsDBNull(9) ? null : reader.GetDateTimeOffset(9)));
            }
        }

        var bySeat = await GrantsAsync(connection, rows.Select(r => r.Seat).ToList(), ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            seats = rows.Select(r => new
            {
                seatId = Ids.ToText(r.Seat),
                areaId = Ids.ToText(r.Area),
                areaName = r.AreaName,
                recipientName = r.Name,
                roleId = Ids.ToText(r.Role),

                // Unter dem OEFFENTLICHEN Schluessel dieser Rolle verpackt.
                seatKeySealed = Base64Url.Encode(r.KeySealed),
                epoch = r.Epoch,

                personalNoteSealed = r.Note is null ? null : Base64Url.Encode(r.Note),
                status = r.Status,
                expiresAt = r.Until,

                grants = bySeat.TryGetValue(r.Seat, out var list) ? list : []
            })
        });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    internal static async Task<Guid?> AreaOfAsync(SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM app.access WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", seatId);

        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    /// <summary>
    /// Ein fakultatives Base64URL-Feld — <c>null</c> heisst „nicht angegeben".
    ///
    /// Getrennt von <see cref="Blob"/> und nicht als zweite Ueberladung: zwei
    /// Methoden, die sich nur in der Nullbarkeit unterscheiden, laesst C# nicht
    /// zu — und ein Unterschied, den der Uebersetzer nicht sieht, ist auch fuer
    /// den Leser keiner.
    /// </summary>
    private static byte[]? Optional(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        try { return Base64Url.Decode(text); }
        catch (FormatException) { return null; }
    }

    private static bool Blob(string? text, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrWhiteSpace(text)) return false;

        try { bytes = Base64Url.Decode(text); return true; }
        catch (FormatException) { return false; }
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
