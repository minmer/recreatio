using Kernel;
using Microsoft.Data.SqlClient;
namespace Api;
public static partial class Chat
{
    private const long MaxAttachment = 50 * 1024 * 1024;
    private static string AttachmentRoot(IConfiguration config) => Path.GetFullPath(config["Chat:AttachmentDirectory"] ?? Path.Combine(AppContext.BaseDirectory, "private-chat-files"));
    private static string AttachmentPath(IConfiguration config, Guid id) => Path.Combine(AttachmentRoot(config), id.ToString("N") + ".sealed");
    private static async Task UploadAsync(HttpContext ctx, Db db, IConfiguration config, Guid id)
    {
        var requestLimit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (requestLimit is { IsReadOnly: false }) requestLimit.MaxRequestBodySize = MaxAttachment;
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        var actor = await ActorAsync(ctx, db, c, id); if (actor is null) return;
        if (!actor.Writes) { await Fail(ctx, 403, "W tej rozmowie tylko czytasz."); return; }
        if (ctx.Request.ContentType != "application/octet-stream" || ctx.Request.ContentLength is not long size || size < 32 || size > MaxAttachment)
        { await Fail(ctx, 400, "Zaszyfrowany plik musi mieć najwyżej 50 MB."); return; }
        await using var tx = (SqlTransaction)await c.BeginTransactionAsync(ctx.RequestAborted);
        await using (var quota = new SqlCommand("SELECT COALESCE(SUM(byte_length), 0) FROM app.chat_attachment WITH (UPDLOCK, HOLDLOCK) WHERE uploaded_by = @p AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET());", c, tx))
        {
            quota.Parameters.AddWithValue("@p", actor.Principal);
            if ((long)(await quota.ExecuteScalarAsync(ctx.RequestAborted))! + size > 1024L * 1024 * 1024)
            { await Fail(ctx, 429, "Dzienny limit plików to 1 GB."); return; }
        }
        var attachment = Guid.NewGuid();
        Directory.CreateDirectory(AttachmentRoot(config));
        var path = AttachmentPath(config, attachment);
        try
        {
            await using (var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            {
                var buffer = new byte[81920]; long total = 0; int read;
                while ((read = await ctx.Request.Body.ReadAsync(buffer, ctx.RequestAborted)) > 0)
                {
                    total += read;
                    if (total > size) throw new BadHttpRequestException("Attachment too large", 413);
                    await file.WriteAsync(buffer.AsMemory(0, read), ctx.RequestAborted);
                }
                if (total != size) throw new BadHttpRequestException("Incomplete attachment", 400);
                await file.FlushAsync(ctx.RequestAborted);
            }
            await using var insert = new SqlCommand("INSERT INTO app.chat_attachment(id, chat_id, uploaded_by, byte_length, created_at) VALUES (@id, @chat, @p, @size, SYSDATETIMEOFFSET());", c, tx);
            insert.Parameters.AddWithValue("@id", attachment); insert.Parameters.AddWithValue("@chat", id);
            insert.Parameters.AddWithValue("@p", actor.Principal); insert.Parameters.AddWithValue("@size", size);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted); await tx.CommitAsync(ctx.RequestAborted);
        }
        catch { File.Delete(path); throw; }
        await ctx.Response.WriteAsJsonAsync(new { attachmentId = Ids.ToText(attachment) });
    }
    private static async Task DownloadAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid attachmentId)
    {
        await using var c = await db.OpenAsync(ctx.RequestAborted);
        if (await ActorAsync(ctx, db, c, id) is null) return;
        await using var cmd = new SqlCommand("SELECT byte_length FROM app.chat_attachment WHERE id = @id AND chat_id = @chat;", c);
        cmd.Parameters.AddWithValue("@id", attachmentId); cmd.Parameters.AddWithValue("@chat", id);
        var size = await cmd.ExecuteScalarAsync(ctx.RequestAborted);
        var path = AttachmentPath(config, attachmentId);
        if (size is null || !File.Exists(path)) { ctx.Response.StatusCode = 404; return; }
        ctx.Response.Headers.CacheControl = "no-store"; ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.ContentType = "application/octet-stream"; ctx.Response.ContentLength = (long)size;
        await ctx.Response.SendFileAsync(path, ctx.RequestAborted);
    }
}
