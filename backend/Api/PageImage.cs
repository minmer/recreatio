using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// BILDER EINER SEITE (0062) — vor allem die Hintergründe der Slajdy.
///
/// <para>
/// <b>Öffentlich wie die Seite.</b> Ein Hintergrund wird jedem gezeigt, der
/// die Seite öffnet, auch ohne Konto; versiegelt wäre er für niemanden lesbar,
/// der keinen Schlüssel hat. Die Kennung ist zufällig und nirgends aufgelistet
/// — wer sie nicht kennt, findet das Bild nicht —, aber geheim ist ein Bild
/// hier nicht, und so steht es auch im Editor.
/// </para>
///
/// <para>
/// <b>Hochladen darf, wer die Seite schreibt</b> (<see cref="Access"/>) — und
/// nur Bilder: der Typ steht in einer festen Liste, und die ersten Bytes
/// müssen dazu passen. Ausgeliefert wird mit genau diesem Typ und
/// <c>nosniff</c>, damit aus einem „Bild" nie eine Seite wird.
/// </para>
/// </summary>
public static class PageImage
{
    private const int MaxBytes = 8 * 1024 * 1024;

    private static readonly string[] Types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/page-image/{*path}", UploadAsync);
        app.MapGet("/workspace/page-images/{*path}", ListAsync);
        app.MapDelete("/workspace/page-image-file/{id:guid}", DeleteAsync);
        app.MapGet("/page-image/{id:guid}", ServeAsync);
    }

    private static string Root(IConfiguration config) =>
        Path.GetFullPath(config["Page:ImageDirectory"] ?? Path.Combine(AppContext.BaseDirectory, "public-page-files"));

    private static string FileOf(IConfiguration config, Guid id) => Path.Combine(Root(config), id.ToString("N") + ".img");

    /// <summary>Passen die ersten Bytes zum genannten Typ? Sonst ist es kein Bild dieser Art.</summary>
    private static bool Looks(string type, ReadOnlySpan<byte> head) => type switch
    {
        "image/jpeg" => head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF,
        "image/png" => head.Length >= 8 && head[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        "image/gif" => head.Length >= 4 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8',
        "image/webp" => head.Length >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                        && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P',
        "image/avif" => head.Length >= 12 && head[4] == 'f' && head[5] == 't' && head[6] == 'y' && head[7] == 'p'
                        && head[8] == 'a' && head[9] == 'v' && head[10] == 'i',
        _ => false
    };

    /// <summary>Wer auf dieser Adresse schreiben darf — dieselbe Frage wie beim Titel.</summary>
    private static async Task<(Guid SlugId, Guid Role)?> WriterAsync(
        HttpContext ctx, Db db, SqlConnection connection, string path)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted)) { await Fail(ctx, 400, "To nie jest adres."); return null; }

        Guid slugId;
        await using (var cmd = new SqlCommand("SELECT id FROM app.slug WHERE path = @path AND alias_of IS NULL;", connection))
        {
            cmd.Parameters.AddWithValue("@path", wanted);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, 404, "Tego adresu nie ma w rejestrze.");
                return null;
            }
            slugId = found;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (!grip.MayWrite || grip.OwnerRoleId is null)
        {
            await Fail(ctx, 403, "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return null;
        }

        return (slugId, grip.ViaRoleId ?? grip.OwnerRoleId.Value);
    }

    private static async Task UploadAsync(HttpContext ctx, Db db, IConfiguration config, string path, string? name)
    {
        var type = (ctx.Request.ContentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        if (!Types.Contains(type))
        {
            await Fail(ctx, 400, "Tylko obrazy: JPEG, PNG, WebP, GIF albo AVIF.");
            return;
        }

        if (ctx.Request.ContentLength is not long size || size < 16 || size > MaxBytes)
        {
            await Fail(ctx, 400, "Obraz może mieć najwyżej 8 MB.");
            return;
        }

        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaxBytes;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var writer = await WriterAsync(ctx, db, connection, path);
        if (writer is null) return;

        using var buffer = new MemoryStream();
        await ctx.Request.Body.CopyToAsync(buffer, ctx.RequestAborted);
        var bytes = buffer.ToArray();

        if (bytes.Length != size || !Looks(type, bytes.AsSpan(0, Math.Min(16, bytes.Length))))
        {
            await Fail(ctx, 400, "To nie jest obraz tego rodzaju.");
            return;
        }

        var id = Ids.NewId();
        Directory.CreateDirectory(Root(config));
        var file = FileOf(config, id);
        await File.WriteAllBytesAsync(file, bytes, ctx.RequestAborted);

        try
        {
            await using var insert = new SqlCommand("""
                INSERT INTO app.page_image (id, slug_id, content_type, byte_length, name, created_at, created_by_role_id)
                VALUES (@id, @slug, @type, @size, @name, @now, @role);
                """, connection);
            insert.Parameters.AddWithValue("@id", id);
            insert.Parameters.AddWithValue("@slug", writer.Value.SlugId);
            insert.Parameters.AddWithValue("@type", type);
            insert.Parameters.AddWithValue("@size", bytes.Length);
            insert.Parameters.AddWithValue("@name", (object?)Trimmed(name) ?? DBNull.Value);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            insert.Parameters.AddWithValue("@role", writer.Value.Role);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch
        {
            File.Delete(file);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), contentType = type, size = bytes.Length });
    }

    private static string? Trimmed(string? name)
    {
        var said = (name ?? string.Empty).Trim();
        return said.Length == 0 ? null : said.Length > 200 ? said[..200] : said;
    }

    /// <summary>Die Bilder dieser Adresse — für die Auswahl im Editor, neueste zuerst.</summary>
    private static async Task ListAsync(HttpContext ctx, Db db, string path)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var writer = await WriterAsync(ctx, db, connection, path);
        if (writer is null) return;

        await using var cmd = new SqlCommand("""
            SELECT id, content_type, byte_length, name, created_at
            FROM app.page_image WHERE slug_id = @slug ORDER BY created_at DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@slug", writer.Value.SlugId);

        var images = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            images.Add(new
            {
                id = Ids.ToText(reader.GetGuid(0)),
                contentType = reader.GetString(1),
                size = reader.GetInt32(2),
                name = reader.IsDBNull(3) ? null : reader.GetString(3),
                createdAt = reader.GetDateTimeOffset(4)
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { images });
    }

    private static async Task DeleteAsync(HttpContext ctx, Db db, IConfiguration config, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        string? path;
        await using (var cmd = new SqlCommand(
            "SELECT s.path FROM app.page_image i JOIN app.slug s ON s.id = i.slug_id WHERE i.id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            path = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as string;
        }

        if (path is null) { await Fail(ctx, 404, "Takiego obrazu nie ma."); return; }
        if (await WriterAsync(ctx, db, connection, path) is null) return;

        await using (var drop = new SqlCommand("DELETE FROM app.page_image WHERE id = @id;", connection))
        {
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        try { File.Delete(FileOf(config, id)); } catch (IOException) { }

        await ctx.Response.WriteAsJsonAsync(new { deleted = true });
    }

    /// <summary>Ausliefern — ohne Konto, lange zwischenspeicherbar: ein Bild ändert sich nie, es wird ersetzt.</summary>
    private static async Task ServeAsync(HttpContext ctx, Db db, IConfiguration config, Guid id)
    {
        string type;
        await using (var connection = await db.OpenAsync(ctx.RequestAborted))
        await using (var cmd = new SqlCommand("SELECT content_type FROM app.page_image WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not string found) { ctx.Response.StatusCode = 404; return; }
            type = found;
        }

        var file = FileOf(config, id);
        if (!File.Exists(file)) { ctx.Response.StatusCode = 404; return; }

        ctx.Response.ContentType = type;
        ctx.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.Headers["Cross-Origin-Resource-Policy"] = "cross-origin";
        await ctx.Response.SendFileAsync(file, ctx.RequestAborted);
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
