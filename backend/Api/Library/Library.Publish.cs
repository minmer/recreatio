using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Einträge veröffentlichen und öffentlich lesen — die Liste und ein einzelner.</summary>
public static partial class Library
{
    /* -- Veröffentlichen --------------------------------------------------------------------- */

    public sealed record PublicEntry(
        string? EntryId, string? As, string? Key, string? Sort, string? Summary, string? Json, List<string>? Refs);

    public sealed record PublishRequest(List<PublicEntry>? Publish, List<string>? Unpublish);

    /// <summary>Was an einer offenen Fassung nicht stimmt — oder <c>null</c>.</summary>
    public static string? Check(PublicEntry one)
    {
        if (!Guid.TryParse(one.EntryId, out _)) return "Nieczytelna kennung wpisu.";
        if (!IsPublishedAs(one.As)) return "Wpis jest publikowany sam albo razem z tekstem (explicit / implicit).";
        if (string.IsNullOrWhiteSpace(one.Json) || one.Json.Length > MaxPublic) return "Publiczna wersja wpisu: najwyżej 2 MB.";
        if ((one.Summary?.Length ?? 0) > MaxSummary) return $"Skrót wpisu: najwyżej {MaxSummary} znaków.";
        if ((one.Key?.Length ?? 0) > MaxKey) return $"Klucz cytowania: najwyżej {MaxKey} znaków.";
        if ((one.Sort?.Length ?? 0) > MaxSort) return $"Klucz porządku: najwyżej {MaxSort} znaków.";
        if ((one.Refs?.Count ?? 0) > MaxRefs) return $"Najwyżej {MaxRefs} odwołań z jednego wpisu.";
        if (one.Refs is not null && one.Refs.Any(r => !Guid.TryParse(r, out _))) return "Nieczytelne odwołanie.";
        return null;
    }

    /// <summary>
    /// Veröffentlichen und zurückziehen, in EINEM Gang: ein Text und die
    /// Quellen, die mit ihm hinausgehen, stehen entweder alle draussen oder
    /// keiner. Die offene Fassung baut der Browser — der Dienst prüft nur,
    /// dass sie zu dieser Bibliothek gehört.
    /// </summary>
    private static async Task PublishAsync(HttpContext ctx, Db db, Guid id, PublishRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var publish = body.Publish ?? [];
        var unpublish = body.Unpublish ?? [];
        if (publish.Count + unpublish.Count is 0 or > MaxBatch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednego do {MaxBatch} wpisów naraz.");
            return;
        }

        foreach (var one in publish)
        {
            var wrong = Check(one);
            if (wrong is not null) { await Fail(ctx, StatusCodes.Status400BadRequest, wrong); return; }
        }
        if (unpublish.Any(u => !Guid.TryParse(u, out _)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung wpisu.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;

        /*
         * 2026-10-22 — in einer BIBLIOTHEK entscheidet allein der Bereich, wer
         * liest (Library.Areas.cs). Hinausstellen geht dort nicht mehr; nur
         * Zurückziehen, damit die offenen Fassungen von früher verschwinden.
         */
        if (publish.Count > 0 && await KindOfLibraryAsync(connection, id, ctx.RequestAborted) == "books")
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "W bibliotece o widoczności decyduje obszar — przenieś wpis do obszaru publicznego.");
            return;
        }

        /* Alles, was genannt wird — auch als Verweis —, muss ein lebender Eintrag DIESER Bibliothek sein. */
        var named = publish.Select(p => Guid.Parse(p.EntryId!))
            .Concat(publish.SelectMany(p => (p.Refs ?? []).Select(Guid.Parse)))
            .Concat(unpublish.Select(Guid.Parse))
            .Distinct().ToList();

        var alive = new HashSet<Guid>();
        for (var at = 0; at < named.Count; at += 500)
        {
            var chunk = named.Skip(at).Take(500).ToList();
            var names = string.Join(", ", chunk.Select((_, i) => $"@e{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT id FROM app.library_entry WHERE library_id = @library AND deleted_at IS NULL AND id IN ({names});
                """, connection);
            cmd.Parameters.AddWithValue("@library", id);
            for (var i = 0; i < chunk.Count; i++) cmd.Parameters.AddWithValue($"@e{i}", chunk[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) alive.Add(reader.GetGuid(0));
        }

        if (named.Any(n => !alive.Contains(n)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Niektórych wpisów nie ma w tej bibliotece — wczytaj ją ponownie.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        foreach (var gone in unpublish.Select(Guid.Parse))
        {
            await using var drop = new SqlCommand("""
                DELETE FROM app.library_public_ref WHERE entry_id = @entry;
                UPDATE app.library_entry
                   SET published_at = NULL, published_as = NULL, public_key = NULL, public_sort = NULL,
                       public_summary = NULL, public_json = NULL, updated_at = @now
                 WHERE id = @entry AND library_id = @library;
                """, connection, tx);
            drop.Parameters.AddWithValue("@entry", gone);
            drop.Parameters.AddWithValue("@library", id);
            drop.Parameters.AddWithValue("@now", now);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        foreach (var one in publish)
        {
            var entry = Guid.Parse(one.EntryId!);
            await using (var save = new SqlCommand("""
                UPDATE app.library_entry
                   SET published_at = COALESCE(published_at, @now), published_as = @as,
                       public_key = @key, public_sort = @sort, public_summary = @summary, public_json = @json,
                       updated_at = @now
                 WHERE id = @entry AND library_id = @library;
                DELETE FROM app.library_public_ref WHERE entry_id = @entry;
                """, connection, tx))
            {
                save.Parameters.AddWithValue("@entry", entry);
                save.Parameters.AddWithValue("@library", id);
                save.Parameters.AddWithValue("@as", one.As!);
                save.Parameters.AddWithValue("@key", string.IsNullOrWhiteSpace(one.Key) ? DBNull.Value : one.Key.Trim());
                save.Parameters.AddWithValue("@sort", string.IsNullOrWhiteSpace(one.Sort) ? DBNull.Value : one.Sort.Trim());
                save.Parameters.AddWithValue("@summary", (object?)one.Summary ?? DBNull.Value);
                save.Parameters.AddWithValue("@json", one.Json!);
                save.Parameters.AddWithValue("@now", now);
                await save.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var target in (one.Refs ?? []).Select(Guid.Parse).Where(r => r != entry).Distinct())
            {
                await using var link = new SqlCommand(
                    "INSERT INTO app.library_public_ref (entry_id, ref_id) VALUES (@entry, @ref);", connection, tx);
                link.Parameters.AddWithValue("@entry", entry);
                link.Parameters.AddWithValue("@ref", target);
                await link.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { published = publish.Count, unpublished = unpublish.Count, at = now });
    }

    /* -- Öffentlich ------------------------------------------------------------------------ */

    /// <summary>
    /// Die Liste des Veröffentlichten — die Predigten einer Bibliothek, die
    /// Zitate einer Sammlung. Nur die Kurzfassung; den ganzen Text holt
    /// <see cref="PublishedOneAsync"/>.
    /// </summary>
    private static async Task PublishedListAsync(
        HttpContext ctx, Db db, Guid id, string? kind, string? @ref, string? q, string? order, bool? explicitOnly, int? take, int? skip)
    {
        if (kind is not null && !IsKind(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany rodzaj wpisu.");
            return;
        }

        Guid? refId = null;
        if (!string.IsNullOrWhiteSpace(@ref))
        {
            if (!Guid.TryParse(@ref, out var parsed)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne odwołanie."); return; }
            refId = parsed;
        }

        var limit = Math.Clamp(take ?? 50, 1, 200);
        var offset = Math.Max(0, skip ?? 0);
        var descending = order == "-sort";
        var search = string.IsNullOrWhiteSpace(q) ? null : q.Trim()[..Math.Min(q.Trim().Length, 100)];

        var where = $"""
            e.library_id = @id AND e.published_at IS NOT NULL
            {(kind is null ? "" : "AND e.kind = @kind")}
            {(refId is null ? "" : "AND EXISTS (SELECT 1 FROM app.library_public_ref r WHERE r.entry_id = e.id AND r.ref_id = @ref)")}
            {(explicitOnly == true ? "AND e.published_as = N'explicit'" : "")}
            {(search is null ? "" : "AND e.public_summary LIKE @q ESCAPE N'\\'")}
            """;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        int total;
        await using (var count = new SqlCommand($"SELECT COUNT(*) FROM app.library_entry e WHERE {where};", connection))
        {
            Bind(count);
            total = (int)(await count.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        var items = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT e.id, e.kind, e.public_key, e.public_sort, e.public_summary, e.published_at, e.published_as
            FROM app.library_entry e
            WHERE {where}
            ORDER BY {(descending ? "e.public_sort DESC" : "e.public_sort")}, e.published_at DESC, e.id
            OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY;
            """, connection))
        {
            Bind(cmd);
            cmd.Parameters.AddWithValue("@skip", offset);
            cmd.Parameters.AddWithValue("@take", limit);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                items.Add(new
                {
                    entryId = Ids.ToText(reader.GetGuid(0)),
                    kind = reader.GetString(1),
                    key = reader.IsDBNull(2) ? null : reader.GetString(2),
                    sort = reader.IsDBNull(3) ? null : reader.GetString(3),
                    summary = reader.IsDBNull(4) ? null : reader.GetString(4),
                    publishedAt = reader.GetDateTimeOffset(5),
                    publishedAs = reader.GetString(6)
                });
            }
        }

        ctx.Response.Headers.CacheControl = "no-cache";
        await ctx.Response.WriteAsJsonAsync(new { total, items });

        void Bind(SqlCommand cmd)
        {
            cmd.Parameters.AddWithValue("@id", id);
            if (kind is not null) cmd.Parameters.AddWithValue("@kind", kind);
            if (refId is not null) cmd.Parameters.AddWithValue("@ref", refId.Value);
            if (search is not null)
            {
                var escaped = search.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_").Replace("[", "\\[");
                cmd.Parameters.AddWithValue("@q", $"%{escaped}%");
            }
        }
    }

    /// <summary>
    /// Ein veröffentlichter Eintrag GANZ — und was er nennt, Stufe um Stufe
    /// (Text → Zitat → Werk → Autor), soweit es selbst veröffentlicht ist.
    /// </summary>
    private static async Task PublishedOneAsync(HttpContext ctx, Db db, Guid id, Guid entryId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = new Dictionary<Guid, object>();
        var frontier = new List<Guid> { entryId };
        object? root = null;

        for (var depth = 0; depth <= ClosureDepth && frontier.Count > 0 && found.Count < MaxClosure; depth++)
        {
            var batch = frontier.Where(f => !found.ContainsKey(f)).Distinct().Take(MaxClosure - found.Count).ToList();
            frontier = [];
            if (batch.Count == 0) break;

            var names = string.Join(", ", batch.Select((_, i) => $"@e{i}"));
            await using (var cmd = new SqlCommand($"""
                SELECT id, kind, public_key, public_sort, public_json, published_at, published_as
                FROM app.library_entry
                WHERE library_id = @library AND published_at IS NOT NULL AND id IN ({names});
                """, connection))
            {
                cmd.Parameters.AddWithValue("@library", id);
                for (var i = 0; i < batch.Count; i++) cmd.Parameters.AddWithValue($"@e{i}", batch[i]);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    var one = new
                    {
                        entryId = Ids.ToText(reader.GetGuid(0)),
                        kind = reader.GetString(1),
                        key = reader.IsDBNull(2) ? null : reader.GetString(2),
                        sort = reader.IsDBNull(3) ? null : reader.GetString(3),
                        json = reader.GetString(4),
                        publishedAt = reader.GetDateTimeOffset(5),
                        publishedAs = reader.GetString(6)
                    };
                    found[reader.GetGuid(0)] = one;
                    if (reader.GetGuid(0) == entryId) root = one;
                }
            }

            if (root is null)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego tekstu nie ma albo nie jest opublikowany.");
                return;
            }

            var reached = batch.Where(found.ContainsKey).ToList();
            if (reached.Count == 0) break;

            var from = string.Join(", ", reached.Select((_, i) => $"@f{i}"));
            await using var refs = new SqlCommand($"SELECT ref_id FROM app.library_public_ref WHERE entry_id IN ({from});", connection);
            for (var i = 0; i < reached.Count; i++) refs.Parameters.AddWithValue($"@f{i}", reached[i]);
            await using var refReader = await refs.ExecuteReaderAsync(ctx.RequestAborted);
            while (await refReader.ReadAsync(ctx.RequestAborted))
            {
                var target = refReader.GetGuid(0);
                if (!found.ContainsKey(target)) frontier.Add(target);
            }
        }

        ctx.Response.Headers.CacheControl = "no-cache";
        await ctx.Response.WriteAsJsonAsync(new
        {
            entry = root,
            refs = found.Where(f => f.Key != entryId).Select(f => f.Value)
        });
    }
}
