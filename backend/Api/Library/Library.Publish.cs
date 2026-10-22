using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-10-22 (Schritt 8) — DIE ALTEN OFFENEN FASSUNGEN ZURÜCKZIEHEN, nichts
/// mehr hinausstellen. Wer eine Bibliothek oder eine Baza wiedzy liest,
/// entscheidet allein ihr Bereich (<c>Library.Areas.cs</c>: <c>/open</c>);
/// „veröffentlichen" heisst jetzt, einen Eintrag in einen öffentlichen Bereich
/// zu tragen. Was früher draussen stand (<c>public_json</c> und die Spalten
/// daneben), räumen die Porządki weg, sobald sein Inhalt am neuen Platz steht;
/// die Spalten gehen mit einer späteren Migration.
/// </summary>
public static partial class Library
{
    /// <summary><c>Publish</c> bleibt nur, damit eine alte Anfrage verstanden (und abgelehnt) wird.</summary>
    public sealed record PublishRequest(List<System.Text.Json.JsonElement>? Publish, List<string>? Unpublish);

    /// <summary>Zurückziehen: die offenen Fassungen der genannten Einträge verschwinden. Hinausstellen wird abgelehnt.</summary>
    private static async Task PublishAsync(HttpContext ctx, Db db, Guid id, PublishRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if ((body.Publish?.Count ?? 0) > 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Publikowanie zastąpiła reguła obszaru — żeby wpis był publiczny, przenieś go do biblioteki albo bazy wiedzy w obszarze publicznym.");
            return;
        }
        var unpublish = body.Unpublish ?? [];
        if (unpublish.Count is 0 or > MaxBatch || unpublish.Any(u => !Guid.TryParse(u, out _)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednego do {MaxBatch} czytelnych kennung naraz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        var withdrawn = 0;
        foreach (var gone in unpublish.Select(Guid.Parse).Distinct())
        {
            await using var drop = new SqlCommand("""
                DELETE FROM app.library_public_ref WHERE entry_id = @entry;
                UPDATE app.library_entry
                   SET published_at = NULL, published_as = NULL, public_key = NULL, public_sort = NULL,
                       public_summary = NULL, public_json = NULL, updated_at = @now
                 WHERE id = @entry AND library_id = @library AND published_at IS NOT NULL;
                """, connection, tx);
            drop.Parameters.AddWithValue("@entry", gone);
            drop.Parameters.AddWithValue("@library", id);
            drop.Parameters.AddWithValue("@now", now);
            withdrawn += await drop.ExecuteNonQueryAsync(ctx.RequestAborted) > 0 ? 1 : 0;
        }
        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { published = 0, unpublished = withdrawn, at = now });
    }
}
