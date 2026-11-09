using Microsoft.Data.SqlClient;
using Kernel;

namespace Api;

public static partial class Library
{
    /// <summary>Revision envelopes for an editor of the current collection. Old private revisions are never public.</summary>
    private static async Task HistoryAsync(HttpContext ctx, Db db, Guid id, Guid entryId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;
        await using var cmd = new SqlCommand("""
            SELECT TOP (100) h.version, h.kind, h.epoch, h.sealed, h.written_at
            FROM app.library_entry_version h
            JOIN app.library_entry e ON e.id = h.entry_id
            WHERE e.library_id = @library AND e.id = @entry AND e.deleted_at IS NULL
            ORDER BY h.version DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@library", id);
        cmd.Parameters.AddWithValue("@entry", entryId);
        var entries = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            var at = reader.GetDateTimeOffset(4);
            entries.Add(new { entryId = Ids.ToText(entryId), version = reader.GetInt32(0), kind = reader.GetString(1), epoch = reader.GetInt32(2),
                @sealed = Base64Url.Encode((byte[])reader[3]), createdAt = at, updatedAt = at, deletedAt = (string?)null, publishedAt = (string?)null, publishedAs = (string?)null });
        }
        await ctx.Response.WriteAsJsonAsync(new { entries });
    }
}
