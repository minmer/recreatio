using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Angaben berichtigen — durch den Menschen (0044) und die Selbstprüfung; den Link neu binden oder zurückziehen.</summary>
public static partial class Seat
{
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

    public sealed record SelfCheckRequest(string RegistrationId, string FieldId);

    /// <summary>
    /// „To mój numer" — der Mensch bestaetigt seine eigene Angabe (0031).
    ///
    /// <para>
    /// <b>Das ist nicht dasselbe wie der Link aus der SMS</b>, und es steht
    /// deshalb mit <c>origin = 'self'</c> in der Zeile. Wer hier drueckt, sagt:
    /// diese Angabe stimmt noch. Wer auf einen Link tippt, den die Kanzlei an
    /// die Nummer geschickt hat, zeigt ausserdem, dass unter DIESER Nummer
    /// jemand erreichbar war. Das zweite ist mehr, und die Liste der Kanzlei
    /// muss beides auseinanderhalten koennen.
    /// </para>
    ///
    /// <para>
    /// <b>Eine staerkere Bestaetigung wird nicht ueberschrieben.</b> Wer nach
    /// einem geklickten SMS-Link im Portal noch einmal drueckt, macht daraus
    /// keine schwaechere Auskunft — die bestehende bleibt, und die Antwort
    /// sagt, dass es sie schon gab.
    /// </para>
    ///
    /// <para>
    /// <b>Der Dienst erfaehrt die Nummer auch hier nicht.</b> Bestaetigt wird
    /// eine STELLE: diese Einsendung, dieses Feld. Was dort steht, liegt
    /// versiegelt und bleibt es.
    /// </para>
    /// </summary>
    private static async Task SelfCheckAsync(
        HttpContext ctx, Db db, string token, SelfCheckRequest body)
    {
        if (string.IsNullOrWhiteSpace(token)
            || !Guid.TryParse(body.RegistrationId, out var registrationId)
            || !Guid.TryParse(body.FieldId, out var fieldId))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego zgłoszenia nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * DREI FRAGEN IN EINER ABFRAGE: gibt es den Platz, haengt diese
         * Einsendung daran, und steht dort ueberhaupt ein Wert an dieser
         * Stelle. Getrennt gestellt liessen sie dazwischen Raum fuer die
         * Frage, wessen Einsendung das eigentlich ist.
         */
        await using (var cmd = new SqlCommand("""
            SELECT TOP 1 1
            FROM app.access a
            JOIN app.registration r       ON r.access_id = a.id
            JOIN app.registration_value v ON v.registration_id = r.id
            WHERE a.token_sha256 = @token
              AND a.revoked_at IS NULL AND a.status = N'active'
              AND (a.expires_at IS NULL OR a.expires_at > @now)
              AND (a.verify_hash IS NULL OR a.verified_at IS NOT NULL)
              AND r.id = @reg AND v.field_id = @field;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@token",
                SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token.Trim())));
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@reg", registrationId);
            cmd.Parameters.AddWithValue("@field", fieldId);

            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is null)
            {
                await Fail(ctx, StatusCodes.Status404NotFound,
                    "Tej odpowiedzi tu nie ma.");
                return;
            }
        }

        /* Steht schon eine Bestaetigung? Dann bleibt sie, wie sie ist. */
        string? standing = null;
        DateTimeOffset? since = null;

        await using (var seen = new SqlCommand("""
            SELECT TOP 1 origin, verified_at
            FROM app.value_check
            WHERE registration_id = @reg AND field_id = @field AND verified_at IS NOT NULL
            ORDER BY verified_at DESC;
            """, connection))
        {
            seen.Parameters.AddWithValue("@reg", registrationId);
            seen.Parameters.AddWithValue("@field", fieldId);

            await using var reader = await seen.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                standing = reader.GetString(0);
                since = reader.GetDateTimeOffset(1);
            }
        }

        if (standing is not null)
        {
            await ctx.Response.WriteAsJsonAsync(new
            {
                verified = true, again = true, origin = standing, at = since
            });
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            /*
             * Ein offener SMS-Link wird gegenstandslos: die Frage, die er
             * stellen sollte, ist beantwortet. Ihn liegen zu lassen hiesse, dass
             * ein Klick auf einen alten Link spaeter eine zweite Bestaetigung
             * derselben Stelle erzeugt.
             */
            await using (var drop = new SqlCommand("""
                DELETE FROM app.value_check
                 WHERE registration_id = @reg AND field_id = @field AND verified_at IS NULL;
                """, connection, tx))
            {
                drop.Parameters.AddWithValue("@reg", registrationId);
                drop.Parameters.AddWithValue("@field", fieldId);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using var insert = new SqlCommand("""
                INSERT INTO app.value_check
                    (id, registration_id, field_id, token_sha256, sent_at, expires_at,
                     verified_at, origin)
                VALUES (@id, @reg, @field, NULL, @now, @now, @now, 'self');
                """, connection, tx);

            insert.Parameters.AddWithValue("@id", Ids.NewId());
            insert.Parameters.AddWithValue("@reg", registrationId);
            insert.Parameters.AddWithValue("@field", fieldId);
            insert.Parameters.AddWithValue("@now", now);

            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            verified = true, again = false, origin = "self", at = now
        });
    }

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
              AND (a.verify_hash IS NULL OR a.verified_at IS NOT NULL)
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

        /*
         * WAS BERICHTIGT WERDEN DARF (0044) — gefragt wird die FRAGE, nicht
         * die Seite. Was das Portal zeigt, war bisher nur eine Bitte an den
         * Browser: der Dienst nahm jede Berichtigung an, auch fuer eine Frage,
         * die die Kanzlei festgelegt hatte — und sogar fuer eine Frage aus
         * einem ANDEREN Formular, solange es sie gab.
         */
        var askable = new Dictionary<Guid, bool>();

        await using (var ask = new SqlCommand("""
            SELECT f.id,
                   /* 0086 — eine vom Formular genommene Frage wird nicht mehr berichtigt. */
                   CASE WHEN f.removed_at IS NULL THEN f.self_edit ELSE CAST(0 AS bit) END
            FROM app.registration r
            JOIN app.slug_field f ON f.part_id = r.part_id
            WHERE r.id = @reg;
            """, connection))
        {
            ask.Parameters.AddWithValue("@reg", registrationId);

            await using var reader = await ask.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) askable[reader.GetGuid(0)] = reader.GetBoolean(1);
        }

        foreach (var (fieldId, _, _, _) in parsed)
        {
            if (!askable.TryGetValue(fieldId, out var mayEdit))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "To pytanie nie należy do tego zgłoszenia.");
                return;
            }

            if (!mayEdit)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden,
                    "Tej odpowiedzi nie można poprawić samodzielnie — zmienić ją może kancelaria.");
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

    public sealed record RelinkRequest(
        string TokenSha256, string SeatKeySealed,

        /* 0046 — der neue Link unter dem Platzschluessel, und was er beim ersten Oeffnen fragt. */
        string? LinkSealed = null, string? VerifySha256 = null, IReadOnlyList<string>? VerifyFields = null);

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
        /*
         * EIN NEUER LINK FRAGT NEU (0046). Wer ihn bekommt, muss beim ersten
         * Oeffnen zeigen, dass er gemeint ist — mit den Angaben, die das
         * Formular jetzt dafuer nennt. Die Kanzlei hat den Abdruck aus den
         * Antworten gerechnet, die sie gerade offen vor sich hat.
         */
        Blob(body.LinkSealed, out var linkSealed);
        Blob(body.VerifySha256, out var verifyHash);
        var verifyFields = Form.VerifyFieldsText(body.VerifyFields);
        var asks = verifyHash.Length == 32 && verifyFields is not null;

        await using var cmd = new SqlCommand("""
            UPDATE app.access
               SET token_sha256 = @token, seat_key_sealed = @forLink, view_count = 0,
                   link_sealed = @linkSealed,
                   verify_hash = @verifyHash, verify_fields = @verifyFields,
                   verified_at = NULL, verify_failures = 0
             WHERE id = @id AND revoked_at IS NULL AND status = N'active';
            """, connection);

        cmd.Parameters.AddWithValue("@token", tokenHash);
        cmd.Parameters.AddBlob("@forLink", forLink);
        cmd.Parameters.AddBlob("@linkSealed", linkSealed.Length == 0 ? null : linkSealed);
        cmd.Parameters.AddBlob("@verifyHash", asks ? verifyHash : null);
        cmd.Parameters.AddWithValue("@verifyFields", asks ? verifyFields! : DBNull.Value);
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
}
