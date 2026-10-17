using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// WAS DAS TELEFON SENDEN SOLL (0116) — im Browser geschrieben (eine Antwort auf
/// eine archivierte SMS, oder eine Nachricht für später), gesendet vom Telefon,
/// das die Nummer der Rozmowa hat.
///
/// <para>
/// <b>Versiegelt</b> wie das Archiv: an wen, was, wann und von welcher eigenen
/// Nummer weiss nur, wer den Bereich liest. Der Dienst kennt nur den Lauf —
/// <c>waiting</c> → <c>taken</c> (ein Telefon hat übernommen und sendet zur Zeit)
/// → <c>sent</c> | <c>failed</c>; <c>cancelled</c>, solange nicht gesendet.
/// </para>
///
/// <para>
/// <b>Das Telefon erfährt davon</b> über den Wecker (FCM, <see cref="Push.Phone"/>)
/// und sonst beim Fragen im Takt (<c>/notify/digest</c> zählt, was wartet).
/// </para>
/// </summary>
public static partial class Phone
{
    private const int MaxOutboxSealed = 64 * 1024;
    private const int MaxOpenOutbox = 500;

    /// <summary>Wie lange Erledigtes noch in der Liste steht (der Browser zeigt „wysłano").</summary>
    private static readonly TimeSpan KeepDone = TimeSpan.FromDays(7);

    private static void MapOutbox(WebApplication app)
    {
        app.MapGet("/workspace/phone/{areaId:guid}/outbox", OutboxAsync);
        app.MapPost("/workspace/phone/{areaId:guid}/outbox", QueueAsync);
        app.MapPost("/workspace/phone/{areaId:guid}/outbox/{id:guid}/take", TakeAsync);
        app.MapPost("/workspace/phone/{areaId:guid}/outbox/{id:guid}/done", DoneAsync);
        app.MapPost("/workspace/phone/{areaId:guid}/outbox/{id:guid}/cancel", CancelAsync);
        app.MapPost("/workspace/phone/{areaId:guid}/outbox/{id:guid}/close", CloseAsync);
    }

    public sealed record QueueRequest(string? Id, int Epoch, string? Sealed);

    public sealed record TakeRequest(string? Device);

    public sealed record DoneRequest(bool Ok, string? Error);

    /// <summary>Eine versiegelte Nachricht für das Telefon — zwischen 48 Bytes und 64 KB.</summary>
    public static bool OutboxSealed(string? text, out byte[] bytes) =>
        Base64Url.TryDecode(text, out bytes) && bytes.Length is >= 48 and <= MaxOutboxSealed;

    /// <summary>Wie sich ein Telefon nennt („Pixel 8") — kurz, ohne Steuerzeichen; leer: keiner.</summary>
    public static string? DeviceName(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var clean = new string(text.Where(c => !char.IsControl(c)).ToArray()).Trim();
        return clean.Length == 0 ? null : clean.Length <= 80 ? clean : clean[..80];
    }

    /// <summary>Was offen ist, und was in der letzten Woche erledigt wurde.</summary>
    private static async Task OutboxAsync(HttpContext ctx, Db db, Guid areaId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;

        await using var cmd = new SqlCommand("""
            SELECT id, epoch, sealed, state, device, error, created_at, taken_at, done_at, cancelled_at, closed_at
            FROM app.phone_outbox
            WHERE area_id = @area AND (state IN (N'waiting', N'taken') OR created_at > @since
                                       OR (state = N'cancelled' AND taken_at IS NOT NULL AND closed_at IS NULL))
            ORDER BY created_at, id;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@since", DateTimeOffset.UtcNow - KeepDone);

        var entries = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            static DateTimeOffset? At(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetDateTimeOffset(i);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                entries.Add(new
                {
                    id = Ids.ToText(reader.GetGuid(0)),
                    epoch = reader.GetInt32(1),
                    @sealed = Base64Url.Encode((byte[])reader[2]),
                    state = reader.GetString(3),
                    device = reader.IsDBNull(4) ? null : reader.GetString(4),
                    error = reader.IsDBNull(5) ? null : reader.GetString(5),
                    createdAt = reader.GetDateTimeOffset(6),
                    takenAt = At(reader, 7),
                    doneAt = At(reader, 8),
                    cancelledAt = At(reader, 9),
                    closedAt = At(reader, 10)
                });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { entries });
    }

    /// <summary>Eine Nachricht für das Telefon ablegen — und es wecken.</summary>
    private static async Task QueueAsync(HttpContext ctx, Db db, Push push, Guid areaId, QueueRequest body)
    {
        if (!IdOf(body.Id, out var id)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny identyfikator."); return; }
        if (!OutboxSealed(body.Sealed, out var sealedBytes)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Zapieczętowana wiadomość musi mieć najwyżej 64 KB."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Write);
        if (allowed is null) return;
        if (body.Epoch < 1 || body.Epoch > allowed.Value.CurrentEpoch) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru."); return; }

        await using (var count = new SqlCommand(
            "SELECT COUNT(*) FROM app.phone_outbox WHERE area_id = @area AND state IN (N'waiting', N'taken');", connection))
        {
            count.Parameters.AddWithValue("@area", areaId);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! >= MaxOpenOutbox)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Na telefon czeka już {MaxOpenOutbox} wiadomości.");
                return;
            }
        }

        await using (var insert = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM app.phone_outbox WHERE id = @id)
                INSERT INTO app.phone_outbox (id, area_id, epoch, sealed, state, created_at)
                VALUES (@id, @area, @epoch, @sealed, N'waiting', SYSDATETIMEOFFSET());
            """, connection))
        {
            insert.Parameters.AddWithValue("@id", id);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@epoch", body.Epoch);
            insert.Parameters.AddBlob("@sealed", sealedBytes);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        push.Phone(areaId);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), state = "waiting" });
    }

    /// <summary>Ein Telefon übernimmt — nur, wenn sie noch wartet (ein zweites bekommt 409).</summary>
    private static async Task TakeAsync(HttpContext ctx, Db db, Guid areaId, Guid id, TakeRequest body) =>
        await StepAsync(ctx, db, areaId, id, """
            UPDATE app.phone_outbox SET state = N'taken', device = @device, taken_at = @now
            WHERE id = @id AND area_id = @area AND state = N'waiting';
            """, c => c.Parameters.AddWithValue("@device", (object?)DeviceName(body.Device) ?? DBNull.Value));

    /// <summary>
    /// Gesendet (oder nicht). Auch nach einem Absagen, das zu spät kam: gesendet ist
    /// gesendet, und das soll im Browser stehen.
    /// </summary>
    private static async Task DoneAsync(HttpContext ctx, Db db, Guid areaId, Guid id, DoneRequest body) =>
        await StepAsync(ctx, db, areaId, id, """
            UPDATE app.phone_outbox SET state = @state, error = @error, done_at = @now, closed_at = @now
            WHERE id = @id AND area_id = @area AND state IN (N'waiting', N'taken', N'cancelled');
            """, c =>
            {
                c.Parameters.AddWithValue("@state", body.Ok ? "sent" : "failed");
                var error = body.Ok || string.IsNullOrWhiteSpace(body.Error) ? null : body.Error.Trim();
                c.Parameters.AddWithValue("@error", (object?)(error is null ? null : error.Length <= 200 ? error : error[..200]) ?? DBNull.Value);
            });

    /// <summary>Absagen, solange nicht gesendet; hatte ein Telefon sie schon, wird es geweckt.</summary>
    private static async Task CancelAsync(HttpContext ctx, Db db, Push push, Guid areaId, Guid id)
    {
        var taken = false;
        await StepAsync(ctx, db, areaId, id, """
            UPDATE app.phone_outbox SET state = N'cancelled', cancelled_at = @now
            OUTPUT CASE WHEN deleted.taken_at IS NULL THEN 0 ELSE 1 END
            WHERE id = @id AND area_id = @area AND state IN (N'waiting', N'taken');
            """, null, found => taken = found == 1);
        if (taken) push.Phone(areaId);
    }

    /// <summary>Das Telefon hat ein Absagen umgesetzt (die geplante Nachricht ist fort).</summary>
    private static async Task CloseAsync(HttpContext ctx, Db db, Guid areaId, Guid id) =>
        await StepAsync(ctx, db, areaId, id, """
            UPDATE app.phone_outbox SET closed_at = @now WHERE id = @id AND area_id = @area AND state = N'cancelled';
            """, null);

    /// <summary>Ein Schritt des Laufs: ändert sich nichts, kommt 409 mit dem Stand, der gilt.</summary>
    private static async Task StepAsync(HttpContext ctx, Db db, Guid areaId, Guid id, string sql,
        Action<SqlCommand>? fill, Action<int>? output = null)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;

        int changed;
        await using (var cmd = new SqlCommand(sql, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@area", areaId);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            fill?.Invoke(cmd);
            if (output is null)
            {
                changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            else
            {
                changed = 0;
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) { changed++; output(reader.GetInt32(0)); }
            }
        }

        string? state = null;
        await using (var now = new SqlCommand("SELECT state FROM app.phone_outbox WHERE id = @id AND area_id = @area;", connection))
        {
            now.Parameters.AddWithValue("@id", id);
            now.Parameters.AddWithValue("@area", areaId);
            state = await now.ExecuteScalarAsync(ctx.RequestAborted) as string;
        }
        if (state is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiej wiadomości."); return; }
        if (changed == 0)
        {
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new { error = "Ta wiadomość ma już inny stan.", verdict = state, id = Ids.ToText(id), state });
            return;
        }
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), state, changed = true });
    }
}
