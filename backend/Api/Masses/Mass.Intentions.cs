using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Intentionen eintragen, ändern und löschen.</summary>
public static partial class Mass
{
    /* -- Intentionen --------------------------------------------------------- */

    public sealed record IntentionRequest(
        string OccurrenceAt, string Text, string? Kind, int? Ordinal,
        IReadOnlyList<Calendar.SealedField>? Fields);

    private static async Task AddIntentionAsync(HttpContext ctx, Db db, Guid id, IntentionRequest body)
    {
        /* 0079 — ein Konto, oder die Links mit Zugang in diesem Browser (`Caller`) — wie im Kalender. */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var text = (body.Text ?? string.Empty).Trim();
        var kind = (body.Kind ?? "single").Trim().ToLowerInvariant();

        if (text == "")
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Intencja bez treści nie zostanie odczytana.");
            return;
        }

        if (kind is not ("single" or "collective"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: pojedyncza albo zbiorowa.");
            return;
        }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin mszy.");
            return;
        }

        if (!Sealed(body.Fields, out var sealedFields, out var complaint))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, complaint);
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var item = await ItemAsync(connection, id, ctx.RequestAborted);
        if (item is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej mszy nie ma.");
            return;
        }

        /*
         * Die Beichte hat keine Intentionen — nicht „meistens nicht", sondern
         * gar nicht: es gibt nichts vorzulesen. Hier abgewiesen und nicht in der
         * Oberflaeche versteckt, weil sonst der erste andere Weg hinein (ein
         * Skript, ein zweites Bild) sie doch anlegte.
         */
        if (item.Value.Kind != "mass")
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Tylko msza ma intencje.");
            return;
        }

        /*
         * 0079 — NUR AN EINE MESSE, DIE STATTFINDET. Vorher nahm der Dienst
         * jeden Zeitpunkt an; eine Intention an einer Uhrzeit, zu der es keine
         * Messe gibt, stünde in keinem Plan — angenommen und nie gelesen.
         */
        if (!await TakesPlaceAsync(connection, id, at, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Tej mszy nie ma w planie w tym dniu — albo jest odwołana.");
            return;
        }

        if (!await Area.MayAsync(connection, caller, item.Value.AreaId,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej mszy nie ma.");
            return;
        }

        if (!await MayAllAsync(connection, caller, sealedFields, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
            return;
        }

        /*
         * Die Reihenfolge ergibt sich nicht aus der Anlegezeit: wer nachtraegt,
         * will nicht zwangslaeufig ans Ende. Ohne Angabe hinten anstellen.
         */
        var ordinal = body.Ordinal;
        if (ordinal is null)
        {
            await using var next = new SqlCommand("""
                SELECT ISNULL(MAX(ordinal), -1) + 1 FROM app.mass_intention
                WHERE item_id = @item AND occurrence_at = @at;
                """, connection);

            next.Parameters.AddWithValue("@item", id);
            next.Parameters.AddWithValue("@at", at);
            ordinal = (int)(await next.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
        }

        var mine = caller.Roles;
        var intentionId = Ids.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.mass_intention
                    (id, item_id, occurrence_at, ordinal, text_public, kind,
                     created_by_role_id, created_at, updated_at)
                VALUES (@id, @item, @at, @ord, @text, @kind, @role, @now, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", intentionId);
                insert.Parameters.AddWithValue("@item", id);
                insert.Parameters.AddWithValue("@at", at);
                insert.Parameters.AddWithValue("@ord", ordinal.Value);
                insert.Parameters.AddWithValue("@text", text[..Math.Min(text.Length, MaxText)]);
                insert.Parameters.AddWithValue("@kind", kind);
                /*
                 * WER ES EINGETRAGEN HAT: die eigene Person, nicht das Konto
                 * (0040). `mine[0]` war das Konto — die erste Zeile der Liste.
                 */
                insert.Parameters.AddWithValue("@role",
                    Workspace.SelfOf(mine) is { } self ? self.Id : (object)DBNull.Value);
                insert.Parameters.AddWithValue("@now", now);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await WriteFieldsAsync(connection, tx, intentionId, sealedFields, now, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            intentionId = Ids.ToText(intentionId),
            ordinal = ordinal.Value,
            fields = sealedFields.Count
        });
    }

    /// <param name="CelebrantRoleId">Fehlt: bleibt. Leer (""): niemand mehr (0079). Sonst diese Rolle.</param>
    /// <param name="ItemId">0079 — an eine andere Messe verlegen: diese, an diesem Vorkommen (<c>OccurrenceAt</c>).</param>
    public sealed record UpdateRequest(
        string? Text, string? Status, int? Ordinal, string? Kind, string? CelebrantRoleId,
        IReadOnlyList<Calendar.SealedField>? Fields, string? ItemId = null, string? OccurrenceAt = null);

    private static async Task UpdateIntentionAsync(HttpContext ctx, Db db, Guid id, UpdateRequest body)
    {
        /* 0079 — ein Konto, oder die Links mit Zugang in diesem Browser (`Caller`) — wie im Kalender. */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var text = body.Text?.Trim();
        var status = body.Status?.Trim().ToLowerInvariant();
        var kind = body.Kind?.Trim().ToLowerInvariant();

        if (text is not null && text == "")
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Intencja bez treści nie zostanie odczytana.");
            return;
        }

        if (status is not null and not ("accepted" or "cancelled" or "celebrated"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Stan: przyjęta, wycofana albo odprawiona.");
            return;
        }

        if (kind is not null and not ("single" or "collective"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: pojedyncza albo zbiorowa.");
            return;
        }

        Guid? celebrant = null;
        var clearCelebrant = body.CelebrantRoleId is not null && body.CelebrantRoleId.Trim() == "";
        if (!string.IsNullOrWhiteSpace(body.CelebrantRoleId))
        {
            if (!Guid.TryParse(body.CelebrantRoleId, out var found))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
                return;
            }
            celebrant = found;
        }

        if (!Sealed(body.Fields, out var sealedFields, out var complaint))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, complaint);
            return;
        }

        /* 0079 — verlegen: an welche Messe, an welches Vorkommen. */
        Guid? moveTo = null;
        DateTimeOffset? moveAt = null;
        if (body.ItemId is not null || body.OccurrenceAt is not null)
        {
            if (!Guid.TryParse(body.ItemId, out var target)
                || !DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var targetAt))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna msza, na którą przenieść.");
                return;
            }
            moveTo = target;
            moveAt = targetAt;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid itemId;
        await using (var find = new SqlCommand(
            "SELECT item_id FROM app.mass_intention WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
                return;
            }
            itemId = found;
        }

        var item = await ItemAsync(connection, itemId, ctx.RequestAborted);
        if (item is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
            return;
        }

        if (!await Area.MayAsync(connection, caller, item.Value.AreaId,
                Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
            return;
        }

        if (!await MayAllAsync(connection, caller, sealedFields, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
            return;
        }

        /*
         * 0079 — AN EINE ANDERE MESSE. Dieselben Regeln wie beim Annehmen: eine
         * Messe (keine Beichte), in einem Bereich, in dem man schreibt, an einem
         * Tag, an dem sie stattfindet. Hinten angestellt, wenn keine Stelle
         * genannt ist. Geber und Gabe gehen mit — ihre Hülle nennt die
         * Intention, nicht die Messe.
         */
        int? appendAt = null;
        if (moveTo is not null)
        {
            var target = await ItemAsync(connection, moveTo.Value, ctx.RequestAborted);
            if (target is null || target.Value.Kind != "mass"
                || !await Area.MayAsync(connection, caller, target.Value.AreaId, Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej mszy nie ma — albo nie możesz w niej pisać.");
                return;
            }

            if (!await TakesPlaceAsync(connection, moveTo.Value, moveAt!.Value, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Tej mszy nie ma w planie w tym dniu — albo jest odwołana.");
                return;
            }

            if (body.Ordinal is null)
            {
                await using var next = new SqlCommand("""
                    SELECT ISNULL(MAX(ordinal), -1) + 1 FROM app.mass_intention
                    WHERE item_id = @item AND occurrence_at = @at AND id <> @id;
                    """, connection);
                next.Parameters.AddWithValue("@item", moveTo.Value);
                next.Parameters.AddWithValue("@at", moveAt.Value);
                next.Parameters.AddWithValue("@id", id);
                appendAt = (int)(await next.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
            }
        }

        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            /*
             * Nur was genannt wurde. `ISNULL(@x, spalte)` laesst eine Angabe, die
             * nicht mitkam, unberuehrt — sonst loeschte ein Aufruf, der bloss den
             * Stand aendern wollte, nebenbei den Text.
             */
            await using (var update = new SqlCommand("""
                UPDATE app.mass_intention
                SET text_public       = ISNULL(@text, text_public),
                    status            = ISNULL(@status, status),
                    kind              = ISNULL(@kind, kind),
                    ordinal           = ISNULL(@ord, ordinal),
                    celebrant_role_id = CASE WHEN @clear = 1 THEN NULL ELSE ISNULL(@celebrant, celebrant_role_id) END,
                    item_id           = ISNULL(@moveTo, item_id),
                    occurrence_at     = ISNULL(@moveAt, occurrence_at),
                    updated_at        = @now
                WHERE id = @id;
                """, connection, tx))
            {
                update.Parameters.AddWithValue("@text", text is null
                    ? DBNull.Value
                    : text[..Math.Min(text.Length, MaxText)]);
                update.Parameters.AddWithValue("@status", (object?)status ?? DBNull.Value);
                update.Parameters.AddWithValue("@kind", (object?)kind ?? DBNull.Value);
                update.Parameters.AddWithValue("@ord", (object?)body.Ordinal ?? (object?)appendAt ?? DBNull.Value);
                update.Parameters.AddWithValue("@clear", clearCelebrant);
                update.Parameters.AddWithValue("@moveTo", (object?)moveTo ?? DBNull.Value);
                update.Parameters.AddWithValue("@moveAt", (object?)moveAt ?? DBNull.Value);
                update.Parameters.AddWithValue("@celebrant", (object?)celebrant ?? DBNull.Value);
                update.Parameters.AddWithValue("@now", now);
                update.Parameters.AddWithValue("@id", id);

                await update.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await WriteFieldsAsync(connection, tx, id, sealedFields, now, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten kapłan ma już pojedynczą intencję na tej mszy — dwie pojedyncze to dwóch kapłanów.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { intentionId = Ids.ToText(id), updated = true });
    }

    /// <summary>
    /// EINE INTENTION LÖSCHEN (0079) — ein Tippfehler, eine doppelt eingetragene.
    /// Eine gefeierte bleibt: sie ist die Auskunft, dass die Messe gelesen
    /// wurde. War das ein Irrtum, wird erst ihr Stand zurückgesetzt.
    /// </summary>
    private static async Task DeleteIntentionAsync(HttpContext ctx, Db db, Guid id)
    {
        /* 0079 — ein Konto, oder die Links mit Zugang in diesem Browser (`Caller`) — wie im Kalender. */
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid itemId;
        string status;
        await using (var find = new SqlCommand("SELECT item_id, status FROM app.mass_intention WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
                return;
            }
            itemId = reader.GetGuid(0);
            status = reader.GetString(1);
        }

        var item = await ItemAsync(connection, itemId, ctx.RequestAborted);
        if (item is null || !await Area.MayAsync(connection, caller, item.Value.AreaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej intencji nie ma.");
            return;
        }

        if (status == "celebrated")
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Odprawionej intencji się nie usuwa — jeśli to pomyłka, zmień najpierw jej stan.");
            return;
        }

        await using var drop = new SqlCommand("""
            DELETE FROM app.mass_intention_field WHERE intention_id = @id;
            DELETE FROM app.mass_intention WHERE id = @id;
            """, connection);
        drop.Parameters.AddWithValue("@id", id);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { intentionId = Ids.ToText(id), deleted = true });
    }
}
