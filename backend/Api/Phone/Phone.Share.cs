using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// PLIKI PRZEZ LINK (0117) — ein Zdjęcie in voller Grösse, ein Film, ein PDF:
/// statt einer MMS, die der Betreiber auf ein paar hundert KB drückt, geht eine
/// SMS mit einem Link hinaus (<c>https://recreatio.pl/#/plik/&lt;geheimnis&gt;</c>).
///
/// <para>
/// <b>Der Dienst liest nichts davon.</b> Versiegelt wird im Browser des
/// Absenders. Aus dem Geheimnis des Links folgen die Kennung (die der Dienst
/// sieht) und der Schlüssel (den er nie sieht) — mit verschiedenen Etiketten.
/// Das Geheimnis steht hinter der Raute: keine statische Seite, kein Dienst
/// bekommt es zu sehen. Wer den Link hat, liest — wie bei einer MMS auch.
/// </para>
///
/// <para>
/// <b>Mit Ablauf</b> (1 bis 400 Tage): danach 410, und die Datei ist fort.
/// Zurückziehen darf, wer im Bereich schreibt, der ihn teilt (DELETE). Holen
/// darf jeder, der die Kennung nennt — ohne Konto; gezählt wird, wie oft.
/// </para>
/// </summary>
public static partial class Phone
{
    /// <summary>So gross darf die Datei selbst sein; die Hülle bekommt 64 KB für ihren Kopf dazu.</summary>
    private const long MaxShareFile = 25L * 1024 * 1024;

    private const long MaxShareSealed = MaxShareFile + 64 * 1024;

    /// <summary>So viel darf ein Bereich an einem Tag teilen, und so viel zugleich bereithalten.</summary>
    private const long MaxSharesPerDay = 1L * 1024 * 1024 * 1024;

    private const long MaxSharesHeld = 2L * 1024 * 1024 * 1024;

    private const int MaxShareLabel = 4000;
    private const int MaxShareDays = 400;
    private const int DefaultShareDays = 30;

    private const string ShareLabelHeader = "X-Share-Label";

    private static void MapShares(WebApplication app)
    {
        app.MapPut("/workspace/phone/{areaId:guid}/share/{id:guid}", ShareAsync)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaxShareSealed));
        app.MapGet("/workspace/phone/{areaId:guid}/shares", SharesAsync);
        app.MapDelete("/workspace/phone/{areaId:guid}/share/{id:guid}", UnshareAsync);

        /* Ohne Konto — der Link ist der Ausweis, und lesen kann ihn nur, wer das Geheimnis hat. */
        app.MapGet("/share/{id:guid}/info", ShareInfoAsync);
        app.MapGet("/share/{id:guid}", SharedAsync);
    }

    /// <summary>Wie lange ein Link gilt: 1 bis 400 Tage, ohne Angabe 30 — sonst <c>null</c>.</summary>
    public static int? ShareDays(int? days) => days is null ? DefaultShareDays : days is >= 1 and <= MaxShareDays ? days : null;

    /// <summary>Das versiegelte Etikett für den Absender (Name, Art, Geheimnis, an wen): 48 Bytes bis 4000.</summary>
    public static bool ShareLabel(string? text, out byte[] bytes) =>
        Base64Url.TryDecode(text, out bytes) && bytes.Length is >= 48 and <= MaxShareLabel;

    private static string SharePath(IConfiguration config, Guid areaId, Guid id) =>
        Path.Combine(FileFolder(config, areaId), "share-" + id.ToString("N") + ".sealed");

    private static void DropShareFile(IConfiguration config, Guid areaId, Guid id)
    {
        try { File.Delete(SharePath(config, areaId, id)); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    /// <summary>
    /// EINEN LINK ANLEGEN — die Hülle als Körper, das versiegelte Etikett im Kopf
    /// <c>X-Share-Label</c>, die Epoche des Etiketts und die Tage in der Adresse.
    /// Dieselbe Kennung zweimal ist „schon da": ein Abbruch darf wiederholt werden.
    /// </summary>
    private static async Task ShareAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId, Guid id, int? epoch, int? days)
    {
        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaxShareSealed;

        if (ctx.Request.ContentType != "application/octet-stream" || ctx.Request.ContentLength is not long size || size < 32 || size > MaxShareSealed)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Plik przez link może mieć najwyżej 25 MB.");
            return;
        }
        if (ShareDays(days) is not int keep)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Link może być ważny od 1 do {MaxShareDays} dni.");
            return;
        }
        if (!ShareLabel(ctx.Request.Headers[ShareLabelHeader].ToString(), out var label))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brak zapieczętowanego opisu pliku.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Write);
        if (allowed is null) return;
        if (epoch is not int e || e < 1 || e > allowed.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        var expires = DateTimeOffset.UtcNow.AddDays(keep);
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            await using (var check = new SqlCommand("""
                SELECT area_id, expires_at FROM app.phone_share WHERE id = @id;
                SELECT COALESCE(SUM(byte_length), 0) FROM app.phone_share WITH (UPDLOCK, HOLDLOCK)
                 WHERE area_id = @area AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET());
                SELECT COALESCE(SUM(byte_length), 0) FROM app.phone_share
                 WHERE area_id = @area AND deleted_at IS NULL AND expires_at > SYSDATETIMEOFFSET();
                """, connection, tx))
            {
                check.Parameters.AddWithValue("@id", id);
                check.Parameters.AddWithValue("@area", areaId);
                await using var reader = await check.ExecuteReaderAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted))
                {
                    var owner = reader.GetGuid(0);
                    var until = reader.GetDateTimeOffset(1);
                    await reader.CloseAsync();
                    if (owner != areaId) { await Fail(ctx, StatusCodes.Status409Conflict, "Ten link należy do innego obszaru."); return; }
                    await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), size, expiresAt = until, stored = false });
                    return;
                }
                await reader.NextResultAsync(ctx.RequestAborted);
                var today = await reader.ReadAsync(ctx.RequestAborted) ? reader.GetInt64(0) : 0;
                await reader.NextResultAsync(ctx.RequestAborted);
                var held = await reader.ReadAsync(ctx.RequestAborted) ? reader.GetInt64(0) : 0;
                await reader.CloseAsync();
                if (today + size > MaxSharesPerDay)
                {
                    await Fail(ctx, StatusCodes.Status429TooManyRequests, "Dzienny limit plików przez link to 1 GB — reszta jutro.");
                    return;
                }
                if (held + size > MaxSharesHeld)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "Udostępnione pliki zajmują już 2 GB — usuń niepotrzebne linki (SMS → Pliki przez link).");
                    return;
                }
            }

            Directory.CreateDirectory(FileFolder(config, areaId));
            var path = SharePath(config, areaId, id);
            try
            {
                await using (var file = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
                {
                    var buffer = new byte[81920];
                    long total = 0;
                    int read;
                    while ((read = await ctx.Request.Body.ReadAsync(buffer, ctx.RequestAborted)) > 0)
                    {
                        total += read;
                        if (total > size) throw new BadHttpRequestException("File too large", 413);
                        await file.WriteAsync(buffer.AsMemory(0, read), ctx.RequestAborted);
                    }
                    if (total != size) throw new BadHttpRequestException("Incomplete file", 400);
                    await file.FlushAsync(ctx.RequestAborted);
                }

                await using var insert = new SqlCommand("""
                    INSERT INTO app.phone_share (id, area_id, epoch, label, byte_length, created_at, expires_at)
                    VALUES (@id, @area, @epoch, @label, @size, SYSDATETIMEOFFSET(), @expires);
                    """, connection, tx);
                insert.Parameters.AddWithValue("@id", id);
                insert.Parameters.AddWithValue("@area", areaId);
                insert.Parameters.AddWithValue("@epoch", e);
                insert.Parameters.Add("@label", System.Data.SqlDbType.VarBinary, MaxShareLabel).Value = label;
                insert.Parameters.AddWithValue("@size", size);
                insert.Parameters.AddWithValue("@expires", expires);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
                await tx.CommitAsync(ctx.RequestAborted);
            }
            catch
            {
                try { File.Delete(path); } catch (IOException) { }
                throw;
            }
        }

        await SweepSharesAsync(config, connection, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), size, expiresAt = expires, stored = true });
    }

    /// <summary>Die Links eines Bereichs, die noch gelten — neueste zuerst, mit ihrem versiegelten Etikett.</summary>
    private static async Task SharesAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;
        await SweepSharesAsync(config, connection, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT id, epoch, label, byte_length, created_at, expires_at, downloads, last_download_at
            FROM app.phone_share
            WHERE area_id = @area AND deleted_at IS NULL AND expires_at > SYSDATETIMEOFFSET()
            ORDER BY created_at DESC, id;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);

        var shares = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                shares.Add(new
                {
                    id = Ids.ToText(reader.GetGuid(0)),
                    epoch = reader.GetInt32(1),
                    label = Base64Url.Encode((byte[])reader[2]),
                    size = reader.GetInt64(3),
                    createdAt = reader.GetDateTimeOffset(4),
                    expiresAt = reader.GetDateTimeOffset(5),
                    downloads = reader.GetInt32(6),
                    lastDownloadAt = reader.IsDBNull(7) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(7)
                });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { shares });
    }

    /// <summary>Zurückziehen: die Datei ist sofort fort, der Link sagt danach „nie ma".</summary>
    private static async Task UnshareAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;

        int changed;
        await using (var cmd = new SqlCommand("""
            UPDATE app.phone_share SET deleted_at = SYSDATETIMEOFFSET() WHERE id = @id AND area_id = @area AND deleted_at IS NULL;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@area", areaId);
            changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        DropShareFile(config, areaId, id);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), deleted = changed > 0 });
    }

    /// <summary>Was ein Link noch ist — für die Seite, bevor sie die Datei holt.</summary>
    private static async Task ShareInfoAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await ShareRowAsync(connection, id, ctx.RequestAborted);
        if (await ShareGoneAsync(ctx, row)) return;
        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), size = row!.Value.Size, createdAt = row.Value.Created, expiresAt = row.Value.Expires });
    }

    /// <summary>DIE HÜLLE — ohne Konto. Öffnen kann sie nur, wer den Link hat.</summary>
    private static async Task SharedAsync(HttpContext ctx, Db db, IConfiguration config, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await ShareRowAsync(connection, id, ctx.RequestAborted);
        if (await ShareGoneAsync(ctx, row)) return;

        var path = SharePath(config, row!.Value.Area, id);
        if (!File.Exists(path))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego pliku już nie ma.");
            return;
        }

        await using (var count = new SqlCommand("""
            UPDATE app.phone_share SET downloads = downloads + 1, last_download_at = SYSDATETIMEOFFSET() WHERE id = @id;
            """, connection))
        {
            count.Parameters.AddWithValue("@id", id);
            await count.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        ctx.Response.Headers.CacheControl = "no-store";
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.ContentType = "application/octet-stream";
        ctx.Response.ContentLength = row.Value.Size;
        await ctx.Response.SendFileAsync(path, ctx.RequestAborted);
    }

    private static async Task<(Guid Area, long Size, DateTimeOffset Created, DateTimeOffset Expires, bool Deleted)?> ShareRowAsync(
        SqlConnection connection, Guid id, CancellationToken token)
    {
        await using var cmd = new SqlCommand("""
            SELECT area_id, byte_length, created_at, expires_at, CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END
            FROM app.phone_share WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(token);
        if (!await reader.ReadAsync(token)) return null;
        return (reader.GetGuid(0), reader.GetInt64(1), reader.GetDateTimeOffset(2), reader.GetDateTimeOffset(3), reader.GetInt32(4) == 1);
    }

    /// <summary>Abgelaufen: 410 (auch wenn schon fortgeräumt); zurückgezogen oder unbekannt: 404.</summary>
    private static async Task<bool> ShareGoneAsync(HttpContext ctx, (Guid Area, long Size, DateTimeOffset Created, DateTimeOffset Expires, bool Deleted)? row)
    {
        if (row is { } r && r.Expires <= DateTimeOffset.UtcNow)
        {
            await Fail(ctx, StatusCodes.Status410Gone, "Ten link wygasł.");
            return true;
        }
        if (row is null || row.Value.Deleted)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego pliku nie ma — został usunięty albo link jest niepełny.");
            return true;
        }
        return false;
    }

    /// <summary>Abgelaufene fortschaffen — ein paar je Aufruf, damit keiner lange wartet.</summary>
    private static async Task SweepSharesAsync(IConfiguration config, SqlConnection connection, CancellationToken token)
    {
        var gone = new List<(Guid Id, Guid Area)>();
        await using (var cmd = new SqlCommand("""
            UPDATE TOP (50) app.phone_share SET deleted_at = SYSDATETIMEOFFSET()
            OUTPUT inserted.id, inserted.area_id
            WHERE deleted_at IS NULL AND expires_at <= SYSDATETIMEOFFSET();
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token)) gone.Add((reader.GetGuid(0), reader.GetGuid(1)));
        }
        foreach (var (id, area) in gone) DropShareFile(config, area, id);
    }
}
