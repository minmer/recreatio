using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE BIBLIOTHEK (0064) — Werke, Personen, Zitate, Themen und die eigenen
/// Texte (Predigten, Kapitel, Artikel) als EIN Bestand, auf den alles andere
/// zeigt: die Seite, die eine Predigt samt Quellen zeigt, die Sammlung von
/// Zitaten, das Ordnen eines Buches — und später Cogita.
///
/// <para>
/// <b>Der Dienst liest keinen Eintrag.</b> Jeder liegt als EINE Hülle unter
/// dem Schlüssel des Bereichs, dem die Bibliothek gehört. Gesucht, verwiesen
/// und formatiert wird im Browser, der die ganze Bibliothek offen hält; der
/// Dienst gleicht nur ab (<c>updated_at</c>) und verhindert, dass ein alter
/// Stand einen neueren überschreibt (<c>version</c>).
/// </para>
///
/// <para>
/// <b>Öffentlich ist nur, was ausdrücklich hinausgestellt wird</b> — als offene
/// Fassung daneben, die der Browser aus den öffentlichen Feldern der Art baut.
/// Mit einem Text gehen die Quellen hinaus, die er nennt. Eine öffentliche
/// Seite holt einen Text samt diesen Quellen in einer Anfrage
/// (<see cref="PublishedOneAsync"/>).
/// </para>
/// </summary>
public static class Library
{
    private const int MaxName = 4096;
    private const long MaxSealed = 4L * 1024 * 1024;
    private const int MaxSummary = 16_000;
    private const int MaxPublic = 2 * 1024 * 1024;
    private const int MaxKey = 120;
    private const int MaxSort = 64;
    private const int MaxEntries = 50_000;
    private const int MaxBatch = 1000;
    private const int MaxRefs = 500;

    /// <summary>So viele Quellen bekommt ein Text höchstens mit — und so tief geht die Kette (Zitat → Werk → Autor).</summary>
    private const int MaxClosure = 600;
    private const int ClosureDepth = 4;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/libraries", ListAsync);
        app.MapPost("/workspace/libraries", CreateAsync);
        app.MapPost("/workspace/library/{id:guid}", RenameAsync);
        app.MapDelete("/workspace/library/{id:guid}", DeleteAsync);

        app.MapGet("/workspace/library/{id:guid}/entries", EntriesAsync);
        app.MapPut("/workspace/library/{id:guid}/entry/{entryId:guid}", SaveAsync);
        app.MapDelete("/workspace/library/{id:guid}/entry/{entryId:guid}", RemoveAsync);
        app.MapPost("/workspace/library/{id:guid}/publish", PublishAsync);

        /* Ohne Konto — das ist der Zweck: wer die Predigt liest, sieht ihre Quellen. */
        app.MapGet("/library/{id:guid}/published", PublishedListAsync);
        app.MapGet("/library/{id:guid}/published/{entryId:guid}", PublishedOneAsync);
    }

    /* -- Prüfen, was hereinkommt ---------------------------------------------------------- */

    /// <summary>Eine Art ist ein Wort aus Kleinbuchstaben — wie in <c>ck_library_entry_kind</c>.</summary>
    public static bool IsKind(string? kind) =>
        kind is { Length: >= 2 and <= 32 } && kind.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '-');

    public static bool IsPublishedAs(string? value) => value is "explicit" or "implicit";

    private static async Task<(Guid AreaId, int CurrentEpoch)?> LibraryAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT l.area_id, a.current_epoch FROM app.library l JOIN app.area a ON a.id = l.area_id WHERE l.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetGuid(0), reader.GetInt32(1)) : null;
    }

    /// <summary>Die Bibliothek, wenn dieses Konto dort darf, was es will — sonst schon die Antwort.</summary>
    private static async Task<(Guid AreaId, int CurrentEpoch)?> AllowedAsync(
        HttpContext ctx, SqlConnection connection, Guid accountId, Guid id, Capability needed)
    {
        var library = await LibraryAsync(connection, id, ctx.RequestAborted);
        if (library is null || !await Area.MayAsync(connection, accountId, library.Value.AreaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return null;
        }

        if (needed != Capability.Read && !await Area.MayAsync(connection, accountId, library.Value.AreaId, needed, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W tej bibliotece możesz tylko czytać.");
            return null;
        }

        return library;
    }

    /* -- Die Bibliotheken ------------------------------------------------------------------ */

    public sealed record LibraryRequest(string? LibraryId, string? AreaId, int Epoch, string? NameSealed);

    /// <summary>Die Bibliotheken der Bereiche, deren Schlüssel ich halte — mit dem, was ich dort darf.</summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var held = await Agenda.HeldAreasAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var rows = new List<(Guid Id, Guid AreaId, int Epoch, byte[] Name, DateTimeOffset Created, DateTimeOffset Updated, int Entries, int Published)>();

        if (held.Count > 0)
        {
            var names = string.Join(", ", held.Select((_, i) => $"@h{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT l.id, l.area_id, l.epoch, l.name_sealed, l.created_at,
                       COALESCE((SELECT MAX(e.updated_at) FROM app.library_entry e WHERE e.library_id = l.id), l.updated_at),
                       (SELECT COUNT(*) FROM app.library_entry e WHERE e.library_id = l.id AND e.deleted_at IS NULL),
                       (SELECT COUNT(*) FROM app.library_entry e WHERE e.library_id = l.id AND e.published_at IS NOT NULL)
                FROM app.library l
                WHERE l.area_id IN ({names})
                ORDER BY l.created_at;
                """, connection);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetInt32(2), (byte[])reader[3],
                    reader.GetDateTimeOffset(4), reader.GetDateTimeOffset(5), reader.GetInt32(6), reader.GetInt32(7)));
            }
        }

        /* Wo ich schreiben darf — je Bereich einmal gefragt, nicht je Bibliothek. */
        var writes = new Dictionary<Guid, bool>();
        foreach (var area in rows.Select(r => r.AreaId).Distinct())
        {
            writes[area] = await Area.MayAsync(connection, who.Value.AccountId, area, Capability.Write, ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            libraries = rows.Select(r => new
            {
                libraryId = Ids.ToText(r.Id),
                areaId = Ids.ToText(r.AreaId),
                epoch = r.Epoch,
                nameSealed = Base64Url.Encode(r.Name),
                createdAt = r.Created,
                updatedAt = r.Updated,
                entries = r.Entries,
                published = r.Published,
                writes = writes[r.AreaId]
            })
        });
    }

    private static async Task<int?> CurrentEpochAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) as int?;
    }

    private static byte[]? ParseName(string? sealedName, out string error)
    {
        error = string.Empty;
        if (!Base64Url.TryDecode(sealedName, out var name) || name.Length is 0 or > MaxName)
        {
            error = "Biblioteka potrzebuje nazwy.";
            return null;
        }
        return name;
    }

    /// <summary>Eine Bibliothek anlegen — die Kennung kommt aus dem Browser: die AAD ihres Namens nennt sie.</summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, LibraryRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.LibraryId, out var id) || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Biblioteka musi przyjść z własną kennung i obszarem.");
            return;
        }

        var name = ParseName(body.NameSealed, out var error);
        if (name is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W tym obszarze nie możesz zakładać bibliotek.");
            return;
        }

        var current = await CurrentEpochAsync(connection, areaId, ctx.RequestAborted);
        if (current is null || body.Epoch < 1 || body.Epoch > current)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        await using var insert = new SqlCommand("""
            INSERT INTO app.library (id, area_id, epoch, name_sealed, created_at, updated_at)
            VALUES (@id, @area, @epoch, @name, @now, @now);
            """, connection);
        insert.Parameters.AddWithValue("@id", id);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@epoch", body.Epoch);
        insert.Parameters.AddBlob("@name", name);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta biblioteka już jest.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { libraryId = Ids.ToText(id) });
    }

    private static async Task RenameAsync(HttpContext ctx, Db db, Guid id, LibraryRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var name = ParseName(body.NameSealed, out var error);
        if (name is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write);
        if (library is null) return;

        if (body.Epoch < 1 || body.Epoch > library.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        await using var update = new SqlCommand(
            "UPDATE app.library SET epoch = @epoch, name_sealed = @name, updated_at = @now WHERE id = @id;", connection);
        update.Parameters.AddWithValue("@id", id);
        update.Parameters.AddWithValue("@epoch", body.Epoch);
        update.Parameters.AddBlob("@name", name);
        update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { libraryId = Ids.ToText(id) });
    }

    /// <summary>
    /// Eine Bibliothek GANZ löschen — mit allem, was darin steht, auch dem
    /// Veröffentlichten. Seiten, die einen ihrer Texte zeigten, sagen danach,
    /// dass er nicht mehr da ist.
    /// </summary>
    private static async Task DeleteAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        await using (var drop = new SqlCommand("""
            DELETE FROM app.library_public_ref
             WHERE entry_id IN (SELECT id FROM app.library_entry WHERE library_id = @id)
                OR ref_id   IN (SELECT id FROM app.library_entry WHERE library_id = @id);
            DELETE FROM app.library_entry WHERE library_id = @id;
            DELETE FROM app.library WHERE id = @id;
            """, connection, tx))
        {
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { libraryId = Ids.ToText(id), deleted = true });
    }

    /* -- Die Einträge ------------------------------------------------------------------------ */

    /// <summary>
    /// ABGLEICH: alles (ohne <c>since</c>) oder was sich seitdem geändert hat —
    /// dann auch die Grabsteine. <c>now</c> wird VOR dem Lesen genommen; der
    /// Browser fragt beim nächsten Mal ab diesem Stand, und zwei Sekunden
    /// Überlappung fangen ab, was gleichzeitig geschrieben wurde.
    /// </summary>
    private static async Task EntriesAsync(HttpContext ctx, Db db, Guid id, string? since)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        DateTimeOffset? from = null;
        if (!string.IsNullOrWhiteSpace(since))
        {
            if (!DateTimeOffset.TryParse(since, out var parsed))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan.");
                return;
            }
            from = parsed.AddSeconds(-2);
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Read) is null) return;

        var now = DateTimeOffset.UtcNow;
        await using var cmd = new SqlCommand($"""
            SELECT id, kind, epoch, sealed, version, created_at, updated_at, deleted_at, published_at, published_as
            FROM app.library_entry
            WHERE library_id = @id AND {(from is null ? "deleted_at IS NULL" : "updated_at >= @since")}
            ORDER BY updated_at;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);

        var entries = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                entries.Add(new
                {
                    entryId = Ids.ToText(reader.GetGuid(0)),
                    kind = reader.GetString(1),
                    epoch = reader.GetInt32(2),
                    @sealed = reader.IsDBNull(3) ? null : Base64Url.Encode((byte[])reader[3]),
                    version = reader.GetInt32(4),
                    createdAt = reader.GetDateTimeOffset(5),
                    updatedAt = reader.GetDateTimeOffset(6),
                    deletedAt = reader.IsDBNull(7) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(7),
                    publishedAt = reader.IsDBNull(8) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(8),
                    publishedAs = reader.IsDBNull(9) ? null : reader.GetString(9)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { now, entries });
    }

    /// <summary><c>Version</c>: der Stand, auf dem der Browser geändert hat — 0 für einen neuen Eintrag.</summary>
    public sealed record EntryRequest(string? Kind, int Epoch, string? Sealed, int Version);

    /// <summary>
    /// Einen Eintrag speichern. Ist er inzwischen von jemand anderem geändert
    /// worden, kommt 409 mit dem Stand, der jetzt gilt — der Browser holt ihn
    /// und zeigt, was sich unterscheidet, statt still zu überschreiben.
    /// </summary>
    private static async Task SaveAsync(HttpContext ctx, Db db, Guid id, Guid entryId, EntryRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!IsKind(body.Kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany rodzaj wpisu.");
            return;
        }

        if (!Base64Url.TryDecode(body.Sealed, out var sealedBytes) || sealedBytes.Length is < 48 or > (int)MaxSealed)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zapieczętowany wpis musi mieć najwyżej 4 MB.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write);
        if (library is null) return;

        if (body.Epoch < 1 || body.Epoch > library.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        (Guid Library, int Version)? had = null;
        await using (var read = new SqlCommand(
            "SELECT library_id, version FROM app.library_entry WITH (UPDLOCK, HOLDLOCK) WHERE id = @id;", connection, tx))
        {
            read.Parameters.AddWithValue("@id", entryId);
            await using var reader = await read.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) had = (reader.GetGuid(0), reader.GetInt32(1));
        }

        if (had is not null && had.Value.Library != id)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten wpis należy do innej biblioteki.");
            return;
        }

        if ((had?.Version ?? 0) != body.Version)
        {
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new
            {
                error = "Ktoś zmienił ten wpis w międzyczasie — wczytaj nowszą wersję.",
                verdict = "stale",
                version = had?.Version ?? 0
            });
            return;
        }

        if (had is null)
        {
            await using var count = new SqlCommand(
                "SELECT COUNT(*) FROM app.library_entry WHERE library_id = @library;", connection, tx);
            count.Parameters.AddWithValue("@library", id);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! >= MaxEntries)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Biblioteka ma już {MaxEntries} wpisów.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        await using (var save = new SqlCommand(had is null
            ? """
              INSERT INTO app.library_entry (id, library_id, kind, epoch, sealed, version, created_at, updated_at)
              VALUES (@id, @library, @kind, @epoch, @sealed, 1, @now, @now);
              """
            : """
              UPDATE app.library_entry
                 SET kind = @kind, epoch = @epoch, sealed = @sealed, version = version + 1,
                     updated_at = @now, deleted_at = NULL
               WHERE id = @id;
              """, connection, tx))
        {
            save.Parameters.AddWithValue("@id", entryId);
            save.Parameters.AddWithValue("@library", id);
            save.Parameters.AddWithValue("@kind", body.Kind!);
            save.Parameters.AddWithValue("@epoch", body.Epoch);
            save.Parameters.AddBlob("@sealed", sealedBytes);
            save.Parameters.AddWithValue("@now", now);
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { entryId = Ids.ToText(entryId), version = (had?.Version ?? 0) + 1, updatedAt = now });
    }

    /// <summary>
    /// Löschen: der Eintrag wird zum Grabstein — ohne Hülle und ohne offene
    /// Fassung —, damit andere Browser beim Abgleich davon erfahren.
    /// </summary>
    private static async Task RemoveAsync(HttpContext ctx, Db db, Guid id, Guid entryId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        int changed;
        await using (var drop = new SqlCommand("""
            DELETE FROM app.library_public_ref WHERE entry_id = @entry OR ref_id = @entry;
            UPDATE app.library_entry
               SET sealed = NULL, deleted_at = @now, updated_at = @now, version = version + 1,
                   published_at = NULL, published_as = NULL, public_key = NULL, public_sort = NULL,
                   public_summary = NULL, public_json = NULL
             WHERE id = @entry AND library_id = @library AND deleted_at IS NULL;
            """, connection, tx))
        {
            drop.Parameters.AddWithValue("@entry", entryId);
            drop.Parameters.AddWithValue("@library", id);
            drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            changed = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { entryId = Ids.ToText(entryId), deleted = changed > 0 });
    }

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

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
