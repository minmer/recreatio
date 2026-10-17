using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Die Prüfung eines Links beim ersten Öffnen (0046) und ihre Bestätigung.</summary>
public static partial class Form
{
    public sealed record ArmRequest(string FieldId, string TokenSha256, int? Days);

    /// <summary>
    /// Eine Bestaetigung scharfstellen — die Kanzlei verschickt sie selbst.
    ///
    /// <para>
    /// <b>Der Dienst erfaehrt die Nummer nicht.</b> Er bekommt den ABDRUCK
    /// eines Geheimnisses und die Stelle, um die es geht: diese Einsendung,
    /// dieses Feld. Welche Nummer dort steht, weiss er so wenig wie vorher.
    /// </para>
    ///
    /// <para>
    /// <b>Eine offene Bestaetigung ersetzt die vorige.</b> Wer den Link zweimal
    /// verschickt, hat nicht zwei Bestaetigungen offen, sondern eine neue — und
    /// die alte soll dann nicht mehr gelten.
    /// </para>
    /// </summary>
    private static async Task ArmCheckAsync(HttpContext ctx, Db db, Guid id, ArmRequest body)
    {
        if (!Guid.TryParse(body.FieldId, out var fieldId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung pola.");
            return;
        }

        var hash = Optional(body.TokenSha256);
        if (hash is null || hash.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk linku musi mieć 32 bajty.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        var now = DateTimeOffset.UtcNow;
        var until = now.AddDays(body.Days is > 0 and <= 90 ? body.Days.Value : 14);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            /* Die vorige, noch offene, faellt weg — siehe oben. */
            await using (var drop = new SqlCommand("""
                DELETE FROM app.value_check
                 WHERE registration_id = @reg AND field_id = @field AND verified_at IS NULL;
                """, connection, tx))
            {
                drop.Parameters.AddWithValue("@reg", id);
                drop.Parameters.AddWithValue("@field", fieldId);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using var insert = new SqlCommand("""
                INSERT INTO app.value_check
                    (id, registration_id, field_id, token_sha256, sent_at, expires_at)
                VALUES (@id, @reg, @field, @token, @now, @until);
                """, connection, tx);

            insert.Parameters.AddWithValue("@id", Ids.NewId());
            insert.Parameters.AddWithValue("@reg", id);
            insert.Parameters.AddWithValue("@field", fieldId);
            insert.Parameters.AddBlob("@token", hash);
            insert.Parameters.AddWithValue("@now", now);
            insert.Parameters.AddWithValue("@until", until);

            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten link już istnieje.");
            return;
        }
        /*
         * EINE BESTAETIGUNG OHNE FRAGE KANN ES NICHT GEBEN — `value_check`
         * zeigt auf `slug_field`, und das ist richtig so: bestaetigt wird eine
         * STELLE, und eine Stelle, die es nicht mehr gibt, ist keine.
         *
         * Wer sein Formular neu gebaut hat, traegt aber Antworten, die auf die
         * Fragen von GESTERN zeigen: lesbar, und trotzdem nicht zu bestaetigen.
         * Der Fremdschluessel faengt das ab — ohne diesen Zweig endete es als
         * 500, im Browser ein Abbruch ohne Grund, der wie ein CORS-Fehler
         * aussieht.
         */
        catch (SqlException e) when (e.Number == 547)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Tego pytania już nie ma — najpierw przepisz odpowiedź na dzisiejsze pytanie.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(id),
            fieldId = Ids.ToText(fieldId),
            expiresAt = until
        });
    }

    /// <summary>
    /// Den Link einloesen — ohne Konto, ohne Platz.
    ///
    /// <para>
    /// <b>Der Link IST der Beweis.</b> Wer ihn hat, war unter der Nummer
    /// erreichbar, an die er geschickt wurde. Der Dienst weiss weiterhin nicht,
    /// welche Nummer das war — er setzt nur einen Zeitstempel an die Stelle.
    /// </para>
    ///
    /// <para>
    /// <b>Zweimal klicken bestaetigt nicht zweimal</b>, und es ist auch kein
    /// Fehler: wer auf denselben Link noch einmal tippt, soll dasselbe sehen
    /// wie beim ersten Mal und nicht eine Absage.
    /// </para>
    /// </summary>
    private static async Task VerifyAsync(HttpContext ctx, Db db, string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego linku nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(token.Trim()));

        DateTimeOffset? already;
        DateTimeOffset until;

        await using (var find = new SqlCommand(
            "SELECT verified_at, expires_at FROM app.value_check WHERE token_sha256 = @t;", connection))
        {
            find.Parameters.AddBlob("@t", hash);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego linku nie ma.");
                return;
            }

            already = reader.IsDBNull(0) ? null : reader.GetDateTimeOffset(0);
            until = reader.GetDateTimeOffset(1);
        }

        if (already is not null)
        {
            await ctx.Response.WriteAsJsonAsync(new { verified = true, at = already, again = true });
            return;
        }

        if (until <= DateTimeOffset.UtcNow)
        {
            await Fail(ctx, StatusCodes.Status410Gone,
                "Ten link już wygasł. Poproś kancelarię o nowy.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using (var mark = new SqlCommand("""
            UPDATE app.value_check SET verified_at = @now
             WHERE token_sha256 = @t AND verified_at IS NULL;
            """, connection))
        {
            mark.Parameters.AddWithValue("@now", now);
            mark.Parameters.AddBlob("@t", hash);

            await mark.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { verified = true, at = now, again = false });
    }

    public sealed record LinkCheckRequest(IReadOnlyList<string>? FieldIds);

    /// <summary>
    /// WELCHE ANGABEN beim ersten Oeffnen eines Links bestaetigt werden (0046).
    ///
    /// <para>
    /// Eine Liste fuer das ganze Formular — die genannten Fragen an, alle
    /// anderen aus. Keine: der Link fragt nichts. Gilt fuer Links, die AB JETZT
    /// entstehen (Anmeldung, neuer Link der Kanzlei); ein schon verschickter
    /// traegt, womit er entstand.
    /// </para>
    /// </summary>
    private static async Task LinkCheckAsync(HttpContext ctx, Db db, Guid id, LinkCheckRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var wanted = new HashSet<Guid>();
        foreach (var one in body.FieldIds ?? [])
        {
            if (!Guid.TryParse(one, out var fieldId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne pytanie.");
                return;
            }
            wanted.Add(fieldId);
        }

        if (wanted.Count > 10)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Najwyżej 10 pytań — link ma się otwierać, nie egzaminować.");
            return;
        }

        var fields = await ReadFieldsAsync(connection, sheet.ModuleId, ctx.RequestAborted);
        if (!wanted.All(w => fields.Any(f => f.Id == w)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Tego pytania nie ma w tym formularzu.");
            return;
        }

        foreach (var f in fields)
        {
            await using var cmd = new SqlCommand(
                "UPDATE app.slug_field SET link_check = @on WHERE id = @id;", connection);
            cmd.Parameters.AddWithValue("@on", wanted.Contains(f.Id));
            cmd.Parameters.AddWithValue("@id", f.Id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(sheet.ModuleId),
            fieldIds = wanted.Select(Ids.ToText)
        });
    }
}
