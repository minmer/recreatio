using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Was der Mensch selbst an seinem Platz tut: Aufgaben, Anwesenheit, Schritte, Namen, Notizen.</summary>
public static partial class Seat
{
    public sealed record OwnStepRequest(string RegistrationId, string StepId, bool Done);

    /// <summary>
    /// „ZROBIONE" — ein Schritt, den der Mensch selbst abhakt (0047). Nur einer,
    /// der dafuer angelegt ist, und nur an einer Einsendung seines Platzes.
    /// </summary>
    /// <summary>
    /// 0098 — was der Mensch zu einer Aufgabe sagt (przyjmuję, pomijam, odmawiam)
    /// und an welchen Tagen er sie getan hat — über seinen Link.
    /// </summary>
    private static async Task OwnTaskAsync(HttpContext ctx, Db db, string token, Form.TaskRequest body)
    {
        if (!Guid.TryParse(body.RegistrationId, out var registrationId) || !Guid.TryParse(body.StepId, out var stepId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zadanie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var done = await Form.SetTaskAsync(connection, stepId, registrationId, body.Answer, body.Days, byPerson: true,
            seatId: seat.Value.Id, ctx.RequestAborted);

        if (done is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To zadanie nie jest Twoje.");
            return;
        }
        if (done.Value.Error is { } error)
        {
            await Fail(ctx, done.Value.Status, error);
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { stepId = Ids.ToText(stepId), saved = true });
    }

    /// <summary>0099 — was der Mensch zu einem Termin sagt, welche Funktion er nimmt, und ob er da war — über seinen Link.</summary>
    private static async Task OwnPresenceAsync(HttpContext ctx, Db db, string token, Form.PresenceRequest body)
    {
        if (!Guid.TryParse(body.RegistrationId, out var registrationId) || !Guid.TryParse(body.StepId, out var stepId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zadanie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var done = await Form.SetPresenceAsync(connection, stepId, registrationId, body, byPerson: true,
            seatId: seat.Value.Id, ctx.RequestAborted);

        if (done is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To zadanie nie jest Twoje.");
            return;
        }
        if (done.Value.Error is { } error)
        {
            await Fail(ctx, done.Value.Status, error);
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { stepId = Ids.ToText(stepId), saved = true });
    }

    private static async Task OwnStepAsync(HttpContext ctx, Db db, string token, OwnStepRequest body)
    {
        if (!Guid.TryParse(body.RegistrationId, out var registrationId) || !Guid.TryParse(body.StepId, out var stepId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny krok.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var done = await Form.SetMarkAsync(connection, stepId, registrationId, body.Done, byPerson: true,
            personOnly: true, seatId: seat.Value.Id, ctx.RequestAborted);

        if (done is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego kroku nie odhaczasz sam.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { stepId = Ids.ToText(stepId), doneAt = done.Value.At });
    }

    public sealed record RotateRequest(string TokenSha256, string SeatKeySealed, string? LinkSealed);

    /// <summary>
    /// EIN NEUER LINK, WEIL SICH DIE ANGABEN GEAENDERT HABEN.
    ///
    /// <para>
    /// Wer seine Angaben aendert — vor allem eine Nummer —, bekommt einen
    /// neuen Link, und der alte hoert auf zu gelten. Er ist vielleicht an eine
    /// Nummer gegangen, die nicht mehr stimmt; wer ihn dort findet, soll damit
    /// nicht mehr hineinkommen.
    /// </para>
    ///
    /// <para>
    /// <b>Der Mensch tut es selbst</b>, mit dem alten Link als Ausweis: er
    /// haelt den Platzschluessel und versiegelt ihn unter dem neuen Linkgeheimnis
    /// — wie die Kanzlei beim neuen Link, nur ohne sie. Bestaetigt bleibt er;
    /// er hat es eben gezeigt.
    /// </para>
    /// </summary>
    private static async Task RotateAsync(HttpContext ctx, Db db, string token, RotateRequest body)
    {
        if (!Blob(body.TokenSha256, out var tokenHash) || tokenHash.Length != 32
            || !Blob(body.SeatKeySealed, out var forLink) || forLink.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny nowy link.");
            return;
        }

        Blob(body.LinkSealed, out var linkSealed);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.access
               SET token_sha256 = @token, seat_key_sealed = @forLink,
                   link_sealed = COALESCE(@linkSealed, link_sealed), view_count = 0
             WHERE id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@token", tokenHash);
        cmd.Parameters.AddBlob("@forLink", forLink);
        cmd.Parameters.AddBlob("@linkSealed", linkSealed.Length == 0 ? null : linkSealed);
        cmd.Parameters.AddWithValue("@id", seat.Value.Id);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { seatId = Ids.ToText(seat.Value.Id), rotated = true });
    }

    /// <summary>0095 — wie der Link heisst, durch den eine Person da ist; ohne Namen: „Link".</summary>
    internal static async Task<string> LinkLabelAsync(SqlConnection connection, Guid invitationId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT label FROM app.invitation WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", invitationId);
        return await cmd.ExecuteScalarAsync(ct) is string label && label.Trim() != string.Empty ? label.Trim() : "Link";
    }

    /// <summary>
    /// Der Platz hinter einem Token — lebendig, und mit <paramref name="gated"/>
    /// nur, wenn er nicht mehr auf seine erste Bestaetigung wartet.
    /// </summary>
    internal static async Task<(Guid Id, Guid AreaId)?> LiveSeatAsync(
        SqlConnection connection, string token, bool gated, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        await using var cmd = new SqlCommand($"""
            SELECT id, area_id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now)
              {(gated ? "AND (verify_hash IS NULL OR verified_at IS NOT NULL)" : "")};
            """, connection);

        cmd.Parameters.AddWithValue("@token", SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token.Trim())));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetGuid(0), reader.GetGuid(1)) : null;
    }

    /// <summary>0097 — der Name, versiegelt: für die Kanzlei (Bereichsschlüssel) und, wo der Browser ihn hat, für den Menschen selbst (Platzschlüssel).</summary>
    public sealed record SeatName(string SeatId, string? NameSealed, int? NameEpoch, string? OwnNameSealed = null);

    public sealed record NamesRequest(IReadOnlyList<SeatName>? Names);

    /// <summary>
    /// DER VOLLE NAME AM PLATZ — Imię i nazwisko, wo er bekannt ist.
    ///
    /// <para>
    /// <b>Warum es das braucht.</b> Am Platz steht der Name, unter dem die
    /// Kanzlei ihn zuordnet — bei getrennten Feldern anfangs nur ein Teil davon
    /// („Węglowski"). Die Kanzlei hat die vollen Antworten, sobald sie die
    /// Einsendungen aufmacht; von dort kommt hier der volle Name.
    /// </para>
    ///
    /// <para>
    /// <b>Nur ERGÄNZT, nie überschrieben.</b> Ein Name, den jemand von Hand
    /// gesetzt hat („Janek, brat Oli"), bleibt; ersetzt wird nur ein leerer
    /// oder einer, der im neuen enthalten ist — „Węglowski" wird „Jan
    /// Węglowski", aber nichts anderes. 0097: das entscheidet der Browser, der
    /// beide lesen kann; der Dienst sieht keinen Namen und nimmt nur die Hüllen.
    /// </para>
    /// </summary>
    private static async Task NamesAsync(HttpContext ctx, Db db, NamesRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var names = body.Names ?? [];
        if (names.Count > 5000)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za dużo naraz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mayWrite = new Dictionary<Guid, bool>();
        var updated = 0;

        foreach (var one in names)
        {
            if (!Guid.TryParse(one.SeatId, out var seatId)) continue;

            var (named, epoch, error) = Names.Read(one.NameSealed, one.NameEpoch);
            var own = Names.Blob(one.OwnNameSealed);

            /* In einem jawny Bereich gibt es keine Kopie unter seinem Schlüssel — dann genügt die eigene (die Kanzlei kommt über die Annahme an sie). */
            if (error is not null || (named is null && own is null)) continue;

            var area = await AreaOfAsync(connection, seatId, ctx.RequestAborted);
            if (area is null) continue;

            if (!mayWrite.TryGetValue(area.Value, out var may))
            {
                may = await Area.MayAsync(connection, who.Value.AccountId, area.Value, Capability.Write, ctx.RequestAborted);
                mayWrite[area.Value] = may;
            }

            if (!may || (named is not null && await Names.EpochProblemAsync(connection, null, area.Value, epoch, person: true, ctx.RequestAborted) is not null)) continue;

            await using var cmd = new SqlCommand("""
                UPDATE app.access
                   SET name_sealed = COALESCE(@named, name_sealed),
                       name_epoch = CASE WHEN @named IS NULL THEN name_epoch ELSE @epoch END,
                       own_name_sealed = COALESCE(@own, own_name_sealed)
                 WHERE id = @id;
                """, connection);

            cmd.Parameters.AddBlob("@named", named);
            cmd.Parameters.AddWithValue("@epoch", named is null ? DBNull.Value : epoch);
            cmd.Parameters.AddBlob("@own", own);
            cmd.Parameters.AddWithValue("@id", seatId);
            updated += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { updated });
    }
}
