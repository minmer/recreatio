using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DAS ARCHIV DER SMS (0114) — Stapel archivierter Nachrichten, versiegelt.
///
/// <para>
/// <b>Nur angehängt.</b> Ein Telefon schickt, was seit dem letzten Mal dazukam,
/// als einen Stapel; geändert wird nichts (ein Archiv vergisst nicht, was auf
/// dem Telefon gelöscht wurde). Wer denselben Stapel zweimal schickt (ein
/// Abbruch unterwegs), bekommt „schon da" statt einer Doppelung.
/// </para>
///
/// <para>
/// <b>Die Abdrücke.</b> Neben jeder Hülle liegen offen 16 Bytes je Nachricht —
/// ein Abdruck aus einem Schlüssel, den nur der Bereich kennt. Ein Telefon, das
/// neu archiviert (neu installiert, ein zweites Gerät), holt sie und schickt
/// nur, was fehlt. Lesen kann der Dienst daran nichts.
/// </para>
///
/// <para>
/// <b>Nach Gesprächen (0115).</b> Ein Stapel hält die Nachrichten EINES
/// Gesprächs; daneben eine kleine versiegelte Übersicht (`summary`). Die Liste
/// der Gespräche entsteht aus den Übersichten, ein Gespräch lädt nur seine
/// Stapel. Viele kleine Stapel eines Gesprächs legt ein Telefon zusammen
/// (neuer Stapel, die alten fort — `DELETE`).
/// </para>
/// </summary>
public static partial class Phone
{
    private const int MaxBatchSealed = 4 * 1024 * 1024;
    private const int MaxBatchMessages = 5000;
    private const int MaxBatchRead = 40;
    private const int MaxSummarySealed = 8000;
    private const int MaxArchiveQuery = 400;

    /// <summary>So viel Archiv bekommt ein Bereich höchstens — die Datenbank ist klein bemessen.</summary>
    private const long MaxArchiveBytes = 100L * 1024 * 1024;

    private static void MapSms(WebApplication app)
    {
        app.MapGet("/workspace/phone/{areaId:guid}/sms", ArchiveAsync);
        app.MapGet("/workspace/phone/{areaId:guid}/sms/batches", BatchesAsync);
        app.MapPost("/workspace/phone/{areaId:guid}/sms/batch", StoreBatchAsync);
        app.MapDelete("/workspace/phone/{areaId:guid}/sms/batch/{id:guid}", DropBatchAsync);
        app.MapPost("/workspace/phone/archives", ArchivesAsync);
    }

    /// <summary><c>Summary</c>: die versiegelte Übersicht des Stapels (0115) — fakultativ.</summary>
    public sealed record BatchRequest(string? BatchId, int Epoch, string? Sealed, string? Keys, int Count, string? Summary = null);

    public sealed record ArchivesRequest(IReadOnlyList<string>? Areas);

    /// <summary>Die Übersicht eines Stapels gelesen: keine (null, leer) oder eine Hülle von 48 Bytes bis 8000.</summary>
    public static bool SummaryOf(string? text, out byte[]? bytes)
    {
        bytes = null;
        if (string.IsNullOrEmpty(text)) return true;
        if (!Base64Url.TryDecode(text, out var read) || read.Length is < 48 or > MaxSummarySealed) return false;
        bytes = read;
        return true;
    }

    /// <summary>Passt ein Stapel? Die Abdrücke müssen genau 16 Bytes je Nachricht haben.</summary>
    public static string? BatchProblem(int count, int sealedLength, int keysLength) =>
        count is < 1 or > MaxBatchMessages ? $"Od 1 do {MaxBatchMessages} wiadomości w jednej paczce."
        : sealedLength is < 48 or > MaxBatchSealed ? "Zapieczętowana paczka musi mieć najwyżej 4 MB."
        : keysLength != 16 * count ? "Odciski nie pasują do liczby wiadomości."
        : null;

    /// <summary>
    /// WAS DA IST: die Stapel (ohne Inhalt), wie viele Nachrichten, wie viel
    /// Platz — und alle Abdrücke, damit ein Telefon nichts doppelt schickt.
    /// </summary>
    private static async Task ArchiveAsync(HttpContext ctx, Db db, Guid areaId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;

        await using var cmd = new SqlCommand("""
            SELECT id, message_count, DATALENGTH(sealed), created_at, message_keys, summary, epoch
            FROM app.phone_sms_batch WHERE area_id = @area ORDER BY created_at, id;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);

        var batches = new List<object>();
        using var keys = new MemoryStream();
        long messages = 0, bytes = 0;
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var count = reader.GetInt32(1);
                var size = Convert.ToInt64(reader.GetValue(2));
                messages += count;
                bytes += size;
                batches.Add(new
                {
                    batchId = Ids.ToText(reader.GetGuid(0)),
                    count,
                    size,
                    createdAt = reader.GetDateTimeOffset(3),
                    summary = reader.IsDBNull(5) ? null : Base64Url.Encode((byte[])reader[5]),
                    epoch = reader.GetInt32(6)
                });
                var printed = (byte[])reader[4];
                keys.Write(printed, 0, printed.Length);
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            batches,
            messages,
            bytes,
            limit = MaxArchiveBytes,
            keys = Base64Url.Encode(keys.ToArray())
        });
    }

    /// <summary>Einige Stapel samt Hülle — höchstens 40 auf einmal (`ids=a,b,c`).</summary>
    private static async Task BatchesAsync(HttpContext ctx, Db db, Guid areaId, string? ids)
    {
        var wanted = new List<Guid>();
        foreach (var part in (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!IdOf(part, out var id)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny identyfikator."); return; }
            if (!wanted.Contains(id)) wanted.Add(id);
        }
        if (wanted.Count is < 1 or > MaxBatchRead)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od 1 do {MaxBatchRead} paczek naraz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;

        var names = string.Join(", ", wanted.Select((_, i) => $"@b{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT id, epoch, sealed, message_count, created_at FROM app.phone_sms_batch
            WHERE area_id = @area AND id IN ({names});
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        for (var i = 0; i < wanted.Count; i++) cmd.Parameters.AddWithValue($"@b{i}", wanted[i]);

        var batches = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                batches.Add(new
                {
                    batchId = Ids.ToText(reader.GetGuid(0)),
                    epoch = reader.GetInt32(1),
                    @sealed = Base64Url.Encode((byte[])reader[2]),
                    count = reader.GetInt32(3),
                    createdAt = reader.GetDateTimeOffset(4)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { batches });
    }

    /// <summary>Einen Stapel ablegen — einmal; ein zweites Mal mit derselben Kennung ist „schon da".</summary>
    private static async Task StoreBatchAsync(HttpContext ctx, Db db, Guid areaId, BatchRequest body)
    {
        if (!IdOf(body.BatchId, out var id)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny identyfikator."); return; }
        if (!Base64Url.TryDecode(body.Sealed, out var sealedBytes) || !Base64Url.TryDecode(body.Keys, out var keyBytes))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna paczka.");
            return;
        }
        var problem = BatchProblem(body.Count, sealedBytes.Length, keyBytes.Length);
        if (problem is not null) { await Fail(ctx, StatusCodes.Status400BadRequest, problem); return; }
        if (!SummaryOf(body.Summary, out var summaryBytes)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny opis paczki."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Write);
        if (allowed is null) return;
        if (body.Epoch < 1 || body.Epoch > allowed.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        await using (var had = new SqlCommand("""
            SELECT area_id FROM app.phone_sms_batch WITH (UPDLOCK, HOLDLOCK) WHERE id = @id;
            SELECT COALESCE(SUM(CAST(DATALENGTH(sealed) AS bigint)), 0) FROM app.phone_sms_batch WITH (UPDLOCK, HOLDLOCK) WHERE area_id = @area;
            """, connection, tx))
        {
            had.Parameters.AddWithValue("@id", id);
            had.Parameters.AddWithValue("@area", areaId);
            await using var reader = await had.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                var owner = reader.GetGuid(0);
                await reader.DisposeAsync();
                if (owner != areaId) { await Fail(ctx, StatusCodes.Status409Conflict, "Ta paczka należy do innego obszaru."); return; }
                await ctx.Response.WriteAsJsonAsync(new { batchId = Ids.ToText(id), stored = false });
                return;
            }
            await reader.NextResultAsync(ctx.RequestAborted);
            var used = await reader.ReadAsync(ctx.RequestAborted) ? Convert.ToInt64(reader.GetValue(0)) : 0;
            if (used + sealedBytes.Length > MaxArchiveBytes)
            {
                await reader.DisposeAsync();
                ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
                await ctx.Response.WriteAsJsonAsync(new { error = "Archiwum SMS tego obszaru jest pełne (100 MB).", verdict = "full" });
                return;
            }
        }

        await using (var insert = new SqlCommand("""
            INSERT INTO app.phone_sms_batch (id, area_id, epoch, sealed, message_keys, message_count, created_at, summary)
            VALUES (@id, @area, @epoch, @sealed, @keys, @count, SYSDATETIMEOFFSET(), @summary);
            """, connection, tx))
        {
            insert.Parameters.AddWithValue("@id", id);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@epoch", body.Epoch);
            insert.Parameters.AddBlob("@sealed", sealedBytes);
            insert.Parameters.AddBlob("@keys", keyBytes);
            insert.Parameters.AddWithValue("@count", body.Count);
            insert.Parameters.AddBlob("@summary", summaryBytes);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { batchId = Ids.ToText(id), stored = true });
    }

    /// <summary>Einen Stapel entfernen — beim Zusammenlegen kleiner Stapel zu einem.</summary>
    private static async Task DropBatchAsync(HttpContext ctx, Db db, Guid areaId, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;

        await using var cmd = new SqlCommand("DELETE FROM app.phone_sms_batch WHERE id = @id AND area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@area", areaId);
        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { batchId = Ids.ToText(id), deleted = changed > 0 });
    }

    /// <summary>
    /// WELCHE ARCHIVE ICH LESE — unter den genannten Bereichen die, die ein Archiv
    /// haben und die ich lesen darf, mit Zahlen. Der Browser nennt die Bereiche,
    /// die er kennt (höchstens 400); so muss er nicht jeden einzeln fragen.
    /// </summary>
    private static async Task ArchivesAsync(HttpContext ctx, Db db, ArchivesRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = new List<Guid>();
        foreach (var text in body.Areas ?? [])
        {
            if (!IdOf(text, out var id)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny identyfikator."); return; }
            if (!wanted.Contains(id)) wanted.Add(id);
        }
        if (wanted.Count > MaxArchiveQuery) { await Fail(ctx, StatusCodes.Status400BadRequest, $"Najwyżej {MaxArchiveQuery} obszarów naraz."); return; }

        var archives = new List<object>();
        if (wanted.Count > 0)
        {
            await using var connection = await db.OpenAsync(ctx.RequestAborted);
            var counts = new List<(Guid Area, int Batches, long Messages, long Bytes, DateTimeOffset Last)>();
            var names = string.Join(", ", wanted.Select((_, i) => $"@a{i}"));
            await using (var cmd = new SqlCommand($"""
                SELECT area_id, COUNT(*), SUM(CAST(message_count AS bigint)), SUM(CAST(DATALENGTH(sealed) AS bigint)), MAX(created_at)
                FROM app.phone_sms_batch WHERE area_id IN ({names}) GROUP BY area_id;
                """, connection))
            {
                for (var i = 0; i < wanted.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", wanted[i]);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    counts.Add((reader.GetGuid(0), reader.GetInt32(1), Convert.ToInt64(reader.GetValue(2)), Convert.ToInt64(reader.GetValue(3)), reader.GetDateTimeOffset(4)));
                }
            }
            foreach (var one in counts)
            {
                if (!await Area.MayAsync(connection, who.Value.AccountId, one.Area, Capability.Read, ctx.RequestAborted)) continue;
                archives.Add(new { areaId = Ids.ToText(one.Area), batches = one.Batches, messages = one.Messages, bytes = one.Bytes, lastAt = one.Last });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { archives, limit = MaxArchiveBytes });
    }
}
