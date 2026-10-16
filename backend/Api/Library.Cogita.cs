using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0109 — WAS COGITA AN DER BIBLIOTHEK BRAUCHT (COGITA.md §2, §8).
///
/// <para>
/// <b>Fassungen</b> [N9]: jedes Speichern lässt die vorige Hülle stehen
/// (<see cref="SaveAsync"/>); hier werden sie gelistet und einzeln geholt.
/// Wiederhergestellt wird im Browser — er öffnet die alte Hülle und speichert
/// sie als neue Fassung. Der Dienst liest keine davon.
/// </para>
///
/// <para>
/// <b>Dateien</b> [G10]: Erzählton, Bilder, Filme einer Bibliothek, versiegelt
/// unter dem Schlüssel ihres Bereichs wie jeder Eintrag. Sie liegen als Dateien
/// neben der Datenbank (<c>Cogita:FileDirectory</c>), ein Ordner je Bibliothek.
/// Ein öffentlicher Kurs hat keinen Schlüssel: wer einen Ablauf veröffentlicht,
/// stellt die Dateien, die er zeigt, ausdrücklich OFFEN daneben.
/// </para>
///
/// <para>
/// <b>Lesen ohne Konto</b>: über die Links dieses Browsers (der Rufer) oder
/// über einen Platz, dessen Rollen den Bereich lesen — ein Firmling lernt mit
/// seinem Link, ohne Konto.
/// </para>
/// </summary>
public static partial class Library
{
    private const long MaxFile = 50L * 1024 * 1024;
    private const long LibraryQuota = 2L * 1024 * 1024 * 1024;
    private const int MaxVersionsListed = 200;

    /// <summary>Was offen hinausgehen darf — und nur so, wie es hier steht.</summary>
    private static readonly HashSet<string> PublicTypes = new(StringComparer.Ordinal)
    {
        "image/png", "image/jpeg", "image/webp", "image/gif",
        "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4",
        "video/mp4", "video/webm",
        "application/pdf"
    };

    private static void MapCogita(WebApplication app)
    {
        app.MapGet("/workspace/library/{id:guid}/entry/{entryId:guid}/versions", VersionsAsync);
        app.MapGet("/workspace/library/{id:guid}/entry/{entryId:guid}/version/{version:int}", VersionAsync);

        app.MapGet("/workspace/library/{id:guid}/files", FilesAsync);
        app.MapPut("/workspace/library/{id:guid}/file/{fileId:guid}", UploadAsync);
        app.MapGet("/workspace/library/{id:guid}/file/{fileId:guid}", DownloadAsync);
        app.MapDelete("/workspace/library/{id:guid}/file/{fileId:guid}", DropFileAsync);
        app.MapPut("/workspace/library/{id:guid}/file/{fileId:guid}/public", PublishFileAsync);
        app.MapDelete("/workspace/library/{id:guid}/file/{fileId:guid}/public", UnpublishFileAsync);

        /* Ohne Konto: die offene Fassung einer Datei, die ein veröffentlichter Kurs zeigt. */
        app.MapGet("/library/{id:guid}/file/{fileId:guid}", PublicFileAsync);

        /* Ein Platz liest die Bibliothek eines Bereichs, den seine Rollen lesen. */
        app.MapGet("/seat/{token}/library/{id:guid}/entries", SeatEntriesAsync);
        app.MapGet("/seat/{token}/library/{id:guid}/file/{fileId:guid}", SeatFileAsync);
    }

    /* -- Wer liest -------------------------------------------------------------------------- */

    /// <summary>Die Bibliothek, wenn dieser Rufer (Konto oder Links) dort lesen darf — sonst schon die Antwort.</summary>
    private static async Task<(Guid AreaId, int CurrentEpoch)?> ReadableAsync(
        HttpContext ctx, SqlConnection connection, Caller caller, Guid id)
    {
        var library = await LibraryAsync(connection, id, ctx.RequestAborted);
        if (library is null || !await Area.MayAsync(connection, caller, library.Value.AreaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return null;
        }
        return library;
    }

    /// <summary>Liest dieser Platz den Bereich — über eine Freigabe (0035) oder die Rollen seines Formulars (0091)?</summary>
    internal static async Task<bool> SeatReadsAsync(SqlConnection connection, Guid seatId, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM app.access_grant WHERE access_id = @seat AND area_id = @area)
                          OR EXISTS (SELECT 1 FROM app.access_role_area WHERE access_id = @seat AND area_id = @area)
                        THEN 1 ELSE 0 END;
            """, connection);
        cmd.Parameters.AddWithValue("@seat", seatId);
        cmd.Parameters.AddWithValue("@area", areaId);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0) == 1;
    }

    private static async Task<(Guid AreaId, int CurrentEpoch)?> SeatLibraryAsync(
        HttpContext ctx, SqlConnection connection, string token, Guid id)
    {
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        var library = seat is null ? null : await LibraryAsync(connection, id, ctx.RequestAborted);
        if (seat is null || library is null || !await SeatReadsAsync(connection, seat.Value.Id, library.Value.AreaId, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return null;
        }
        return library;
    }

    /// <summary>Der Abgleich für einen Platz — dieselbe Antwort wie für ein Konto (<see cref="EntriesAsync"/>).</summary>
    private static async Task SeatEntriesAsync(HttpContext ctx, Db db, string token, Guid id, string? since)
    {
        if (!SinceOf(since, out var from)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await SeatLibraryAsync(ctx, connection, token, id) is null) return;
        await WriteEntriesAsync(ctx, connection, id, from);
    }

    /* -- Fassungen ---------------------------------------------------------------------------- */

    private static async Task<bool> EntryOfAsync(SqlConnection connection, Guid id, Guid entryId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT 1 FROM app.library_entry WHERE id = @entry AND library_id = @library;", connection);
        cmd.Parameters.AddWithValue("@entry", entryId);
        cmd.Parameters.AddWithValue("@library", id);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>Die früheren Fassungen eines Eintrags, die jüngste zuerst — ohne Hülle (die holt <see cref="VersionAsync"/>).</summary>
    private static async Task VersionsAsync(HttpContext ctx, Db db, Guid id, Guid entryId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (await ReadableAsync(ctx, connection, caller, id) is null) return;
        if (!await EntryOfAsync(connection, id, entryId, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        var versions = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT TOP ({MaxVersionsListed}) version, kind, epoch, written_at, written_by_account_id, DATALENGTH(sealed)
            FROM app.library_entry_version WHERE entry_id = @entry ORDER BY version DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@entry", entryId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var by = reader.IsDBNull(4) ? (Guid?)null : reader.GetGuid(4);
                versions.Add(new
                {
                    version = reader.GetInt32(0),
                    kind = reader.GetString(1),
                    epoch = reader.GetInt32(2),
                    writtenAt = reader.GetDateTimeOffset(3),
                    /* Wer — nur, ob man es selbst war: die Namen der anderen kennt der Dienst nicht. */
                    byMe = by is not null && by == caller.AccountId,
                    size = Convert.ToInt64(reader.GetValue(5))
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { entryId = Ids.ToText(entryId), versions });
    }

    private static async Task VersionAsync(HttpContext ctx, Db db, Guid id, Guid entryId, int version)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (await ReadableAsync(ctx, connection, caller, id) is null) return;
        if (!await EntryOfAsync(connection, id, entryId, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma.");
            return;
        }

        await using var cmd = new SqlCommand(
            "SELECT kind, epoch, sealed, written_at FROM app.library_entry_version WHERE entry_id = @entry AND version = @version;", connection);
        cmd.Parameters.AddWithValue("@entry", entryId);
        cmd.Parameters.AddWithValue("@version", version);
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wersji nie ma.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            entryId = Ids.ToText(entryId),
            version,
            kind = reader.GetString(0),
            epoch = reader.GetInt32(1),
            @sealed = Base64Url.Encode((byte[])reader[2]),
            writtenAt = reader.GetDateTimeOffset(3)
        });
    }

    /* -- Dateien -------------------------------------------------------------------------------- */

    private static string FileRoot(IConfiguration config) =>
        Path.GetFullPath(config["Cogita:FileDirectory"] ?? Path.Combine(AppContext.BaseDirectory, "private-cogita-files"));

    private static string FileFolder(IConfiguration config, Guid libraryId) => Path.Combine(FileRoot(config), libraryId.ToString("N"));

    private static string SealedPath(IConfiguration config, Guid libraryId, Guid fileId) =>
        Path.Combine(FileFolder(config, libraryId), fileId.ToString("N") + ".sealed");

    private static string PublicPath(IConfiguration config, Guid libraryId, Guid fileId) =>
        Path.Combine(FileFolder(config, libraryId), fileId.ToString("N") + ".public");

    /// <summary>Der Ordner einer gelöschten Bibliothek — nach dem Commit; was liegen bleibt, ist versiegelt und ohne Zeile.</summary>
    internal static void DropFiles(IConfiguration config, Guid libraryId)
    {
        try
        {
            var folder = FileFolder(config, libraryId);
            if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static void DropFile(IConfiguration config, Guid libraryId, Guid fileId)
    {
        foreach (var path in new[] { SealedPath(config, libraryId, fileId), PublicPath(config, libraryId, fileId) })
        {
            try { File.Delete(path); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }

    private static async Task FilesAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (await ReadableAsync(ctx, connection, caller, id) is null) return;

        var files = new List<object>();
        long total = 0;
        await using (var cmd = new SqlCommand("""
            SELECT id, epoch, size, created_at, public_size, public_type, public_at
            FROM app.library_file WHERE library_id = @library ORDER BY created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@library", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                total += reader.GetInt32(2);
                files.Add(new
                {
                    fileId = Ids.ToText(reader.GetGuid(0)),
                    epoch = reader.GetInt32(1),
                    size = reader.GetInt32(2),
                    createdAt = reader.GetDateTimeOffset(3),
                    publicSize = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4),
                    publicType = reader.IsDBNull(5) ? null : reader.GetString(5),
                    publicAt = reader.IsDBNull(6) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(6)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { files, total, quota = LibraryQuota });
    }

    /// <summary>Den Leib der Anfrage als Datei ablegen — genau <paramref name="size"/> Bytes, sonst nichts.</summary>
    private static async Task CopyBodyAsync(HttpContext ctx, string path, long size)
    {
        await using var file = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
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

    private static void AllowBody(HttpContext ctx)
    {
        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaxFile;
    }

    /// <summary>
    /// EINE DATEI HINAUFLADEN — versiegelt im Browser, die Kennung von dort
    /// (die AAD nennt sie). Wer schreiben darf; höchstens 50 MB je Datei und
    /// 2 GB je Bibliothek.
    /// </summary>
    private static async Task UploadAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid fileId, int? epoch)
    {
        AllowBody(ctx);
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (ctx.Request.ContentType != "application/octet-stream" || ctx.Request.ContentLength is not long size || size < 32 || size > MaxFile)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zaszyfrowany plik musi mieć najwyżej 50 MB.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write);
        if (library is null) return;

        if (epoch is not int e || e < 1 || e > library.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        await using (var quota = new SqlCommand("""
            SELECT COALESCE(SUM(CAST(size AS bigint)), 0) FROM app.library_file WITH (UPDLOCK, HOLDLOCK) WHERE library_id = @library;
            SELECT COUNT(*) FROM app.library_file WHERE id = @id;
            """, connection, tx))
        {
            quota.Parameters.AddWithValue("@library", id);
            quota.Parameters.AddWithValue("@id", fileId);
            await using var reader = await quota.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            var used = reader.GetInt64(0);
            await reader.NextResultAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            var exists = reader.GetInt32(0) > 0;
            if (exists) { await reader.CloseAsync(); await Fail(ctx, StatusCodes.Status409Conflict, "Ten plik już jest."); return; }
            if (used + size > LibraryQuota) { await reader.CloseAsync(); await Fail(ctx, StatusCodes.Status429TooManyRequests, "Biblioteka ma już 2 GB plików."); return; }
        }

        Directory.CreateDirectory(FileFolder(config, id));
        var path = SealedPath(config, id, fileId);
        try
        {
            await CopyBodyAsync(ctx, path, size);
            await using var insert = new SqlCommand("""
                INSERT INTO app.library_file (id, library_id, epoch, size, created_at) VALUES (@id, @library, @epoch, @size, SYSDATETIMEOFFSET());
                """, connection, tx);
            insert.Parameters.AddWithValue("@id", fileId);
            insert.Parameters.AddWithValue("@library", id);
            insert.Parameters.AddWithValue("@epoch", e);
            insert.Parameters.AddWithValue("@size", (int)size);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            try { File.Delete(path); } catch (IOException) { }
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { fileId = Ids.ToText(fileId), epoch = e, size });
    }

    private static async Task<(int Size, int Epoch, int? PublicSize, string? PublicType)?> FileRowAsync(
        SqlConnection connection, Guid id, Guid fileId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT size, epoch, public_size, public_type FROM app.library_file WHERE id = @id AND library_id = @library;", connection);
        cmd.Parameters.AddWithValue("@id", fileId);
        cmd.Parameters.AddWithValue("@library", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return (reader.GetInt32(0), reader.GetInt32(1), reader.IsDBNull(2) ? null : reader.GetInt32(2), reader.IsDBNull(3) ? null : reader.GetString(3));
    }

    private static async Task SendSealedAsync(HttpContext ctx, SqlConnection connection, IConfiguration config, Guid id, Guid fileId)
    {
        var row = await FileRowAsync(connection, id, fileId, ctx.RequestAborted);
        var path = SealedPath(config, id, fileId);
        if (row is null || !File.Exists(path)) { ctx.Response.StatusCode = StatusCodes.Status404NotFound; return; }
        ctx.Response.Headers.CacheControl = "private, max-age=86400";
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.Headers["X-Epoch"] = row.Value.Epoch.ToString(System.Globalization.CultureInfo.InvariantCulture);
        ctx.Response.ContentType = "application/octet-stream";
        ctx.Response.ContentLength = row.Value.Size;
        await ctx.Response.SendFileAsync(path, ctx.RequestAborted);
    }

    private static async Task DownloadAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid fileId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (await ReadableAsync(ctx, connection, caller, id) is null) return;
        await SendSealedAsync(ctx, connection, config, id, fileId);
    }

    private static async Task SeatFileAsync(HttpContext ctx, Db db, IConfiguration config, string token, Guid id, Guid fileId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await SeatLibraryAsync(ctx, connection, token, id) is null) return;
        await SendSealedAsync(ctx, connection, config, id, fileId);
    }

    private static async Task DropFileAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid fileId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;

        await using var drop = new SqlCommand("DELETE FROM app.library_file WHERE id = @id AND library_id = @library;", connection);
        drop.Parameters.AddWithValue("@id", fileId);
        drop.Parameters.AddWithValue("@library", id);
        var gone = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        if (gone > 0) DropFile(config, id, fileId);
        await ctx.Response.WriteAsJsonAsync(new { fileId = Ids.ToText(fileId), deleted = gone > 0 });
    }

    /// <summary>
    /// DIE OFFENE FASSUNG einer Datei — der Browser hat sie geöffnet und schickt
    /// sie unverschlüsselt, weil ein veröffentlichter Kurs sie zeigt. Nur in den
    /// Arten, die hier stehen (<see cref="PublicTypes"/>).
    /// </summary>
    private static async Task PublishFileAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid fileId, string? type)
    {
        AllowBody(ctx);
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (type is null || !PublicTypes.Contains(type))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Publicznie można pokazać obraz, dźwięk, film albo PDF.");
            return;
        }
        if (ctx.Request.ContentLength is not long size || size < 1 || size > MaxFile)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Plik musi mieć najwyżej 50 MB.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;
        if (await FileRowAsync(connection, id, fileId, ctx.RequestAborted) is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego pliku nie ma.");
            return;
        }

        var path = PublicPath(config, id, fileId);
        var temp = path + ".part";
        try
        {
            await CopyBodyAsync(ctx, temp, size);
            File.Move(temp, path, overwrite: true);
        }
        catch
        {
            try { File.Delete(temp); } catch (IOException) { }
            throw;
        }

        await using var update = new SqlCommand("""
            UPDATE app.library_file SET public_size = @size, public_type = @type, public_at = SYSDATETIMEOFFSET()
            WHERE id = @id AND library_id = @library;
            """, connection);
        update.Parameters.AddWithValue("@size", (int)size);
        update.Parameters.AddWithValue("@type", type);
        update.Parameters.AddWithValue("@id", fileId);
        update.Parameters.AddWithValue("@library", id);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { fileId = Ids.ToText(fileId), publicType = type, publicSize = size });
    }

    private static async Task UnpublishFileAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid fileId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;

        await using var update = new SqlCommand("""
            UPDATE app.library_file SET public_size = NULL, public_type = NULL, public_at = NULL
            WHERE id = @id AND library_id = @library;
            """, connection);
        update.Parameters.AddWithValue("@id", fileId);
        update.Parameters.AddWithValue("@library", id);
        var changed = await update.ExecuteNonQueryAsync(ctx.RequestAborted);
        try { File.Delete(PublicPath(config, id, fileId)); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        await ctx.Response.WriteAsJsonAsync(new { fileId = Ids.ToText(fileId), unpublished = changed > 0 });
    }

    private static async Task PublicFileAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid fileId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await FileRowAsync(connection, id, fileId, ctx.RequestAborted);
        var path = PublicPath(config, id, fileId);
        if (row?.PublicType is not string type || row.Value.PublicSize is not int size || !File.Exists(path))
        {
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }
        ctx.Response.Headers.CacheControl = "public, max-age=3600";
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.Headers.ContentSecurityPolicy = "sandbox; default-src 'none'";
        ctx.Response.ContentType = type;
        ctx.Response.ContentLength = size;
        await ctx.Response.SendFileAsync(path, ctx.RequestAborted);
    }
}
