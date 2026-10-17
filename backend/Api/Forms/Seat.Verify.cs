using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Der erste Besuch eines Links: Prüffragen (0046) und die Bestätigung der eigenen Angaben.</summary>
public static partial class Seat
{
    /* ======================================================================
       0046 — BESTAETIGEN, ALLES BESTAETIGEN, NEUER LINK
       ====================================================================== */

    /// <summary>Nach so vielen Fehlversuchen ist der Link zu; die Kanzlei stellt einen neuen aus.</summary>
    private const int MaxVerifyFailures = 10;

    /// <summary>
    /// Die Fragen, die beim ersten Oeffnen zu beantworten sind — ihre
    /// Beschriftung, versiegelt unter dem Schluessel des Formulars.
    /// </summary>
    private static async Task<List<object>> VerifyQuestionsAsync(
        SqlConnection connection, string? fieldsText, CancellationToken ct)
    {
        var ids = (fieldsText ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(one => Guid.TryParse(one, out var g) ? g : (Guid?)null)
            .Where(g => g is not null).Select(g => g!.Value).ToList();

        var out_ = new List<object>();
        if (ids.Count == 0) return out_;

        var names = string.Join(", ", ids.Select((_, i) => $"@f{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT id, kind, label_sealed, COALESCE(label_area_id, area_id), COALESCE(label_epoch, epoch)
            FROM app.slug_field WHERE id IN ({names});
            """, connection);

        for (var i = 0; i < ids.Count; i++) cmd.Parameters.AddWithValue($"@f{i}", ids[i]);

        var found = new Dictionary<Guid, object>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            found[reader.GetGuid(0)] = new
            {
                fieldId = Ids.ToText(reader.GetGuid(0)),
                kind = reader.GetString(1),
                labelSealed = Base64Url.Encode((byte[])reader[2]),
                labelAreaId = Ids.ToText(reader.GetGuid(3)),
                labelEpoch = reader.GetInt32(4)
            };
        }

        /* In der Reihenfolge, in der der Abdruck gerechnet wurde. */
        foreach (var id in ids) if (found.TryGetValue(id, out var one)) out_.Add(one);
        return out_;
    }

    public sealed record VerifyRequest(string? Proof);

    /// <summary>
    /// DIE ANTWORT BEIM ERSTEN OEFFNEN.
    ///
    /// <para>
    /// Der Browser rechnet aus dem, was der Mensch eintippt, denselben
    /// langsamen Abdruck wie bei der Anmeldung; der Dienst vergleicht. Richtig:
    /// der Link fragt nie wieder. Falsch: ein Versuch weniger — nach zehn ist
    /// Schluss, und auch die richtige Antwort oeffnet nichts mehr.
    /// </para>
    /// </summary>
    private static async Task VerifyAsync(HttpContext ctx, Db db, string token, VerifyRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await LiveSeatAsync(connection, token, gated: false, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        Guid seatId = seat.Value.Id;
        byte[]? hash;
        DateTimeOffset? verifiedAt;
        int failures;

        await using (var read = new SqlCommand(
            "SELECT verify_hash, verified_at, verify_failures FROM app.access WHERE id = @id;", connection))
        {
            read.Parameters.AddWithValue("@id", seatId);
            await using var reader = await read.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            hash = reader.IsDBNull(0) ? null : (byte[])reader[0];
            verifiedAt = reader.IsDBNull(1) ? null : reader.GetDateTimeOffset(1);
            failures = reader.GetInt32(2);
        }

        if (hash is null || verifiedAt is not null)
        {
            await ctx.Response.WriteAsJsonAsync(new { verified = true });
            return;
        }

        if (failures >= MaxVerifyFailures)
        {
            await Fail(ctx, StatusCodes.Status423Locked,
                "Za dużo nieudanych prób — ten link jest zablokowany. Poproś kancelarię o nowy.");
            return;
        }

        Blob(body.Proof, out var proof);
        /* Gespeichert ist der Abdruck des Nachweises, nicht der Nachweis — wie beim Token. */
        var right = proof.Length == 32 && CryptographicOperations.FixedTimeEquals(SHA256.HashData(proof), hash);

        await using (var mark = new SqlCommand(right
            ? "UPDATE app.access SET verified_at = @now, verify_failures = 0 WHERE id = @id;"
            : "UPDATE app.access SET verify_failures = verify_failures + 1 WHERE id = @id;", connection))
        {
            mark.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            mark.Parameters.AddWithValue("@id", seatId);
            await mark.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        if (!right)
        {
            var left = MaxVerifyFailures - failures - 1;
            await Fail(ctx, StatusCodes.Status403Forbidden, left > 0
                ? $"Te dane się nie zgadzają ze zgłoszeniem. Zostało prób: {left}."
                : "Te dane się nie zgadzają — to była ostatnia próba. Poproś kancelarię o nowy link.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { verified = true });
    }

    public sealed record ConfirmRequest(string RegistrationId);

    /// <summary>
    /// „WSZYSTKO SIĘ ZGADZA" — die ganze Einsendung auf einmal bestaetigt.
    ///
    /// <para>
    /// Nicht jede Nummer fuer sich: der Mensch sieht, was er angegeben hat —
    /// Namen, Kontakte, alles — und sagt einmal, dass es stimmt. Die Kanzlei
    /// sieht es an der Zeile.
    /// </para>
    /// </summary>
    private static async Task ConfirmAsync(HttpContext ctx, Db db, string token, ConfirmRequest body)
    {
        if (!Guid.TryParse(body.RegistrationId, out var registrationId))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego zgłoszenia nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.registration SET confirmed_at = @now
             WHERE id = @reg AND access_id = @seat;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@reg", registrationId);
        cmd.Parameters.AddWithValue("@seat", seat.Value.Id);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego zgłoszenia nie ma.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { registrationId = Ids.ToText(registrationId), confirmed = true });
    }
}
