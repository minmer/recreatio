using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE BILDER AUS MMS (0114) — versiegelt im Browser des Telefons, als Dateien
/// neben der Datenbank (<c>Phone:FileDirectory</c>), ein Ordner je Bereich. In
/// der Datenbank steht nur, was zu ihnen gehört: Bereich, Epoche, Grösse.
/// </summary>
public static partial class Phone
{
    private const long MaxFile = 25L * 1024 * 1024;

    /// <summary>So viel darf ein Bereich an einem Tag hinaufladen — ein Archiv voller Filme füllt sonst die Platte.</summary>
    private const long MaxFilesPerDay = 2L * 1024 * 1024 * 1024;

    private static void MapFiles(WebApplication app)
    {
        app.MapPut("/workspace/phone/{areaId:guid}/file/{fileId:guid}", UploadAsync)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaxFile));
        app.MapGet("/workspace/phone/{areaId:guid}/file/{fileId:guid}", DownloadAsync);
    }

    private static string FileRoot(IConfiguration config) =>
        Path.GetFullPath(config["Phone:FileDirectory"] ?? Path.Combine(AppContext.BaseDirectory, "private-phone-files"));

    private static string FileFolder(IConfiguration config, Guid areaId) => Path.Combine(FileRoot(config), areaId.ToString("N"));

    private static string SealedPath(IConfiguration config, Guid areaId, Guid fileId) =>
        Path.Combine(FileFolder(config, areaId), fileId.ToString("N") + ".sealed");

    /// <summary>Der Ordner eines gelöschten Bereichs — nach dem Commit; was liegen bleibt, ist versiegelt und ohne Zeile.</summary>
    internal static void DropFiles(IConfiguration config, Guid areaId)
    {
        try
        {
            var folder = FileFolder(config, areaId);
            if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    /// <summary>
    /// EINE DATEI HINAUFLADEN — die Kennung kommt vom Telefon (die AAD nennt
    /// sie), die Epoche sagt, unter welchem Schlüssel sie liegt. Ein zweites
    /// Mal dieselbe Kennung ist „schon da", kein Fehler: ein Abbruch unterwegs
    /// darf wiederholt werden.
    /// </summary>
    private static async Task UploadAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId, Guid fileId, int? epoch)
    {
        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaxFile;

        if (ctx.Request.ContentType != "application/octet-stream" || ctx.Request.ContentLength is not long size || size < 32 || size > MaxFile)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zaszyfrowany plik musi mieć najwyżej 25 MB.");
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

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        await using (var quota = new SqlCommand("""
            SELECT area_id FROM app.phone_file WHERE id = @id;
            SELECT COALESCE(SUM(byte_length), 0) FROM app.phone_file WITH (UPDLOCK, HOLDLOCK)
             WHERE area_id = @area AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET());
            """, connection, tx))
        {
            quota.Parameters.AddWithValue("@id", fileId);
            quota.Parameters.AddWithValue("@area", areaId);
            await using var reader = await quota.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                var owner = reader.GetGuid(0);
                await reader.CloseAsync();
                if (owner != areaId) { await Fail(ctx, StatusCodes.Status409Conflict, "Ten plik należy do innego obszaru."); return; }
                await ctx.Response.WriteAsJsonAsync(new { fileId = Ids.ToText(fileId), epoch = e, size, stored = false });
                return;
            }
            await reader.NextResultAsync(ctx.RequestAborted);
            var used = await reader.ReadAsync(ctx.RequestAborted) ? reader.GetInt64(0) : 0;
            await reader.CloseAsync();
            if (used + size > MaxFilesPerDay)
            {
                await Fail(ctx, StatusCodes.Status429TooManyRequests, "Dzienny limit plików z telefonu to 2 GB — reszta jutro.");
                return;
            }
        }

        Directory.CreateDirectory(FileFolder(config, areaId));
        var path = SealedPath(config, areaId, fileId);
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
                INSERT INTO app.phone_file (id, area_id, epoch, byte_length, created_at) VALUES (@id, @area, @epoch, @size, SYSDATETIMEOFFSET());
                """, connection, tx);
            insert.Parameters.AddWithValue("@id", fileId);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@epoch", e);
            insert.Parameters.AddWithValue("@size", size);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            try { File.Delete(path); } catch (IOException) { }
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { fileId = Ids.ToText(fileId), epoch = e, size, stored = true });
    }

    private static async Task DownloadAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId, Guid fileId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;

        (long Size, int Epoch)? row = null;
        await using (var cmd = new SqlCommand("SELECT byte_length, epoch FROM app.phone_file WHERE id = @id AND area_id = @area;", connection))
        {
            cmd.Parameters.AddWithValue("@id", fileId);
            cmd.Parameters.AddWithValue("@area", areaId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) row = (reader.GetInt64(0), reader.GetInt32(1));
        }

        var path = SealedPath(config, areaId, fileId);
        if (row is null || !File.Exists(path)) { ctx.Response.StatusCode = StatusCodes.Status404NotFound; return; }
        ctx.Response.Headers.CacheControl = "private, max-age=86400";
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.Headers["X-Epoch"] = row.Value.Epoch.ToString(System.Globalization.CultureInfo.InvariantCulture);
        ctx.Response.ContentType = "application/octet-stream";
        ctx.Response.ContentLength = row.Value.Size;
        await ctx.Response.SendFileAsync(path, ctx.RequestAborted);
    }
}
