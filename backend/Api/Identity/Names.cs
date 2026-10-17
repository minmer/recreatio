using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// NAMEN LIEGEN NIE OFFEN (0097) — der Name eines Formulars, einer Gruppe von
/// Formularen und eines Menschen kommt versiegelt herein und geht versiegelt
/// hinaus. Der Dienst prüft nur, ob die Hülle eine Hülle ist und ob es die
/// Epoche gibt, unter der sie liegen soll.
///
/// <code>
///   Formular, Gruppe   unter dem Schlüssel ihres Bereichs (auch einem offenen)
///   Mensch am Platz    unter dem Schlüssel seines Bereichs — NIE einem offenen —
///                      und unter dem Platzschlüssel (er selbst)
///   Termin             unter dem Bereichsschlüssel, für die Annahme, für den Gastgeber
/// </code>
///
/// <para>
/// <b>Was schon offen dasteht</b>, versiegelt der Browser dessen, der den
/// Schlüssel hat (<see cref="UnsealedAsync"/> → <see cref="SealAsync"/>), und in
/// derselben Anweisung verschwindet der Klartext.
/// </para>
/// </summary>
public static class Names
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/names/unsealed", UnsealedAsync);
        app.MapPost("/workspace/names/seal", SealAsync);
    }

    /// <summary>Kopf (20) + Nonce (12) + Tag (16) + mindestens ein Byte.</summary>
    private const int MinSealed = 49;

    /// <summary>Ein Name von 200 Zeichen, UTF-8, versiegelt — und für den Gastgeber noch ein P-256-Punkt davor.</summary>
    public const int MaxSealed = 1024;

    /// <summary>Eine Hülle aus Base64URL — oder <c>null</c>: keine, zu kurz, zu lang, unlesbar.</summary>
    public static byte[]? Blob(string? text, int min = MinSealed, int max = MaxSealed)
    {
        if (string.IsNullOrWhiteSpace(text) || !Base64Url.TryDecode(text.Trim(), out var bytes)) return null;
        return bytes.Length >= min && bytes.Length <= max ? bytes : null;
    }

    /// <summary>
    /// Ein versiegelter Name mit seiner Epoche — beides oder keins.
    /// <c>Missing</c>: nichts mitgegeben. <c>Error</c>: etwas mitgegeben, das keine Hülle ist.
    /// </summary>
    public static (byte[]? Sealed, int Epoch, string? Error) Read(string? sealedText, int? epoch)
    {
        if (string.IsNullOrWhiteSpace(sealedText) && epoch is null) return (null, 0, null);
        var blob = Blob(sealedText);
        if (blob is null || epoch is null or < 1) return (null, 0, "Nieczytelna zapieczętowana nazwa.");
        return (blob, epoch.Value, null);
    }

    /// <summary>
    /// Gibt es diese Epoche des Bereichs — und, für den Namen eines Menschen, ist
    /// sie NICHT veröffentlicht? Unter einem offenen Schlüssel zu versiegeln hiesse,
    /// den Namen offen hinzulegen. <c>null</c>: in Ordnung; sonst der Grund.
    /// </summary>
    public static async Task<string?> EpochProblemAsync(
        SqlConnection connection, SqlTransaction? tx, Guid areaId, int epoch, bool person, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT CAST(CASE WHEN key_public IS NULL THEN 0 ELSE 1 END AS bit) FROM app.area_epoch WHERE area_id = @area AND epoch = @epoch;",
            connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@epoch", epoch);

        return await cmd.ExecuteScalarAsync(ct) switch
        {
            null or DBNull => "Tej epoki obszaru nie ma — odśwież i spróbuj jeszcze raz.",
            true when person => "Imię i nazwisko nie może leżeć pod jawnym kluczem obszaru.",
            _ => null
        };
    }

    /// <summary>Eine Hülle aus der Spalte <paramref name="i"/> als Base64URL — oder <c>null</c>.</summary>
    public static string? B64(SqlDataReader reader, int i) => reader.IsDBNull(i) ? null : Base64Url.Encode((byte[])reader[i]);

    public static int? Int(SqlDataReader reader, int i) => reader.IsDBNull(i) ? null : reader.GetInt32(i);

    public static string? Text(SqlDataReader reader, int i)
    {
        if (reader.IsDBNull(i)) return null;
        var text = reader.GetString(i).Trim();
        return text.Length == 0 ? null : text;
    }

    /* ======================================================================
       WAS NOCH OFFEN DASTEHT
       ====================================================================== */

    /// <summary>
    /// Was dieses Konto versiegeln kann: Formulare in Bereichen, in denen es
    /// schreibt; Plätze in Bereichen, in denen es schreibt (mit den Hüllen des
    /// Platzschlüssels, damit auch die eigene Kopie entsteht); Termine in
    /// Bereichen, in denen es schreibt.
    /// </summary>
    private static async Task UnsealedAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { forms = Array.Empty<object>(), seats = Array.Empty<object>(), claims = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        var writable = $"""
            SELECT scope_id FROM app.certificate
            WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now
              AND capability IN (N'write', N'admin') AND subject_role_id IN ({names})
            """;

        void Roles(SqlCommand cmd)
        {
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);
        }

        var forms = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT TOP 2000 m.id, m.area_id, m.name
            FROM app.module m
            WHERE m.kind = N'form' AND m.name_sealed IS NULL AND m.area_id IS NOT NULL
              AND m.name IS NOT NULL AND LTRIM(RTRIM(m.name)) <> N''
              AND m.area_id IN ({writable});
            """, connection))
        {
            Roles(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                forms.Add(new { moduleId = Ids.ToText(reader.GetGuid(0)), areaId = Ids.ToText(reader.GetGuid(1)), name = reader.GetString(2).Trim() });
        }

        var seats = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT TOP 5000 a.id, a.area_id, a.recipient_name, a.epoch, a.seat_key_for_area, a.seat_key_for_intake, a.origin,
                   CAST(CASE WHEN a.own_name_sealed IS NULL THEN 0 ELSE 1 END AS bit)
            FROM app.access a
            WHERE a.recipient_name IS NOT NULL
              AND a.area_id IN ({writable});
            """, connection))
        {
            Roles(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                seats.Add(new
                {
                    seatId = Ids.ToText(reader.GetGuid(0)),
                    areaId = Ids.ToText(reader.GetGuid(1)),
                    name = reader.GetString(2).Trim(),
                    epoch = reader.GetInt32(3),
                    seatKeyForArea = B64(reader, 4),
                    seatKeyForIntake = B64(reader, 5),
                    origin = reader.GetString(6),
                    hasOwn = reader.GetBoolean(7)
                });
            }
        }

        var claims = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT TOP 2000 c.id, r.area_id, c.holder_name
            FROM app.claim c JOIN app.resource r ON r.id = c.resource_id
            WHERE c.holder_name IS NOT NULL
              AND r.area_id IN ({writable});
            """, connection))
        {
            Roles(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                claims.Add(new { claimId = Ids.ToText(reader.GetGuid(0)), areaId = Ids.ToText(reader.GetGuid(1)), name = reader.GetString(2).Trim() });
        }

        await ctx.Response.WriteAsJsonAsync(new { forms, seats, claims });
    }

    /* ======================================================================
       VERSIEGELN — und den Klartext löschen
       ====================================================================== */

    public sealed record FormName(string ModuleId, string NameSealed, int NameEpoch);

    public sealed record SeatSealed(string SeatId, string? NameSealed, int? NameEpoch, string? OwnNameSealed);

    public sealed record ClaimName(string ClaimId, string NameSealed, int NameEpoch);

    public sealed record SealRequest(
        IReadOnlyList<FormName>? Forms, IReadOnlyList<SeatSealed>? Seats, IReadOnlyList<ClaimName>? Claims);

    /// <summary>
    /// Was der Browser versiegelt hat, an seinen Platz — und der Klartext weg,
    /// in derselben Anweisung. Was nicht passt (fremder Bereich, keine Hülle,
    /// unbekannte Epoche), wird übergangen und gezählt, nicht abgelehnt: der Rest
    /// soll trotzdem zugehen.
    /// </summary>
    private static async Task SealAsync(HttpContext ctx, Db db, SealRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var total = (body.Forms?.Count ?? 0) + (body.Seats?.Count ?? 0) + (body.Claims?.Count ?? 0);
        if (total > 5000)
        {
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            await ctx.Response.WriteAsJsonAsync(new { error = "Za dużo naraz." });
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var writes = new Dictionary<Guid, bool>();

        async Task<bool> MayWriteAsync(Guid areaId)
        {
            if (!writes.TryGetValue(areaId, out var may))
            {
                may = await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted);
                writes[areaId] = may;
            }
            return may;
        }

        int forms = 0, seats = 0, claims = 0, skipped = 0;

        foreach (var one in body.Forms ?? [])
        {
            var blob = Blob(one.NameSealed);
            if (blob is null || !Guid.TryParse(one.ModuleId, out var id)) { skipped++; continue; }

            await using var look = new SqlCommand("SELECT area_id FROM app.module WHERE id = @id AND kind = N'form';", connection);
            look.Parameters.AddWithValue("@id", id);
            if (await look.ExecuteScalarAsync(ctx.RequestAborted) is not Guid area
                || !await MayWriteAsync(area)
                || await EpochProblemAsync(connection, null, area, one.NameEpoch, person: false, ctx.RequestAborted) is not null)
            {
                skipped++;
                continue;
            }

            await using var cmd = new SqlCommand("""
                UPDATE app.module SET name_sealed = @sealed, name_epoch = @epoch, name = NULL
                 WHERE id = @id AND kind = N'form' AND area_id = @area;
                """, connection);
            cmd.Parameters.AddBlob("@sealed", blob);
            cmd.Parameters.AddWithValue("@epoch", one.NameEpoch);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@area", area);
            forms += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        foreach (var one in body.Seats ?? [])
        {
            if (!Guid.TryParse(one.SeatId, out var id)) { skipped++; continue; }
            var (named, epoch, error) = Read(one.NameSealed, one.NameEpoch);
            var own = string.IsNullOrWhiteSpace(one.OwnNameSealed) ? null : Blob(one.OwnNameSealed);
            if (error is not null || (named is null && own is null) || (!string.IsNullOrWhiteSpace(one.OwnNameSealed) && own is null))
            {
                skipped++;
                continue;
            }

            var area = await Seat.AreaOfAsync(connection, id, ctx.RequestAborted);
            if (area is null || !await MayWriteAsync(area.Value)
                || (named is not null && await EpochProblemAsync(connection, null, area.Value, epoch, person: true, ctx.RequestAborted) is not null))
            {
                skipped++;
                continue;
            }

            /*
             * Der Klartext geht, sobald eine Kopie steht, die die Kanzlei öffnen
             * kann: die unter dem Bereichsschlüssel — oder, in einem jawny Bereich
             * (dort darf kein Name liegen), die eigene unter dem Platzschlüssel, an
             * den die Kanzlei über ihre Annahme kommt.
             */
            await using var cmd = new SqlCommand("""
                UPDATE app.access
                   SET name_sealed     = COALESCE(@sealed, name_sealed),
                       name_epoch      = CASE WHEN @sealed IS NULL THEN name_epoch ELSE @epoch END,
                       own_name_sealed = COALESCE(@own, own_name_sealed),
                       recipient_name  = CASE WHEN COALESCE(@sealed, name_sealed, @own, own_name_sealed) IS NULL THEN recipient_name ELSE NULL END
                 WHERE id = @id;
                """, connection);
            cmd.Parameters.AddBlob("@sealed", named);
            cmd.Parameters.AddWithValue("@epoch", named is null ? DBNull.Value : epoch);
            cmd.Parameters.AddBlob("@own", own);
            cmd.Parameters.AddWithValue("@id", id);
            seats += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        foreach (var one in body.Claims ?? [])
        {
            var blob = Blob(one.NameSealed);
            if (blob is null || !Guid.TryParse(one.ClaimId, out var id)) { skipped++; continue; }

            await using var look = new SqlCommand(
                "SELECT r.area_id FROM app.claim c JOIN app.resource r ON r.id = c.resource_id WHERE c.id = @id;", connection);
            look.Parameters.AddWithValue("@id", id);
            if (await look.ExecuteScalarAsync(ctx.RequestAborted) is not Guid area
                || !await MayWriteAsync(area)
                || await EpochProblemAsync(connection, null, area, one.NameEpoch, person: true, ctx.RequestAborted) is not null)
            {
                skipped++;
                continue;
            }

            await using var cmd = new SqlCommand("""
                UPDATE app.claim
                   SET holder_name_sealed = @sealed, holder_name_epoch = @epoch, holder_name_wrapped = NULL, holder_name = NULL
                 WHERE id = @id;
                """, connection);
            cmd.Parameters.AddBlob("@sealed", blob);
            cmd.Parameters.AddWithValue("@epoch", one.NameEpoch);
            cmd.Parameters.AddWithValue("@id", id);
            claims += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { forms, seats, claims, skipped });
    }
}
