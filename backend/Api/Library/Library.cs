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
public static partial class Library
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

        /* 2026-10-22 — Sichtbarkeit allein durch den Bereich: öffentlich lesen, wo es liegt, umziehen (Library.Areas.cs). */
        MapAreas(app);

        /* 0109 — Fassungen, versiegelte Dateien, Lesen über einen Platz oder Link (Library.Cogita.cs). */
        MapCogita(app);
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

    /*
     * 0110 — `Kind`: `books` (die Bibliothek, Vorgabe) oder `knowledge` (eine
     * Baza wiedzy für Cogita) — zwei Strukturen nebeneinander, ein Speicher.
     */
    public sealed record LibraryRequest(string? LibraryId, string? AreaId, int Epoch, string? NameSealed, string? Kind = null);

    /// <summary>Was eine Bibliothek ist — `null`, wenn das Wort keines ist.</summary>
    public static string? LibraryKind(string? kind) => (kind ?? "").Trim() switch
    {
        "" or "books" => "books",
        "knowledge" => "knowledge",
        _ => null
    };

    /// <summary>Die Bibliotheken der Bereiche, deren Schlüssel ich halte — mit dem, was ich dort darf.</summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var held = await Agenda.HeldAreasAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var rows = new List<(Guid Id, Guid AreaId, int Epoch, byte[] Name, DateTimeOffset Created, DateTimeOffset Updated, int Entries, int Published, string Kind, DateTimeOffset? AreaRule)>();
        var hasRule = await HasAreaRuleAsync(connection, ctx.RequestAborted);

        if (held.Count > 0)
        {
            var names = string.Join(", ", held.Select((_, i) => $"@h{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT l.id, l.area_id, l.epoch, l.name_sealed, l.created_at,
                       COALESCE((SELECT MAX(e.updated_at) FROM app.library_entry e WHERE e.library_id = l.id), l.updated_at),
                       (SELECT COUNT(*) FROM app.library_entry e WHERE e.library_id = l.id AND e.deleted_at IS NULL),
                       (SELECT COUNT(*) FROM app.library_entry e WHERE e.library_id = l.id AND e.published_at IS NOT NULL),
                       l.kind, {(hasRule ? "l.area_rule_at" : "CAST(NULL AS datetimeoffset)")}
                FROM app.library l
                WHERE l.area_id IN ({names})
                ORDER BY l.created_at;
                """, connection);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetInt32(2), (byte[])reader[3],
                    reader.GetDateTimeOffset(4), reader.GetDateTimeOffset(5), reader.GetInt32(6), reader.GetInt32(7), reader.GetString(8),
                    reader.IsDBNull(9) ? null : reader.GetDateTimeOffset(9)));
            }
        }

        /* Wo ich schreiben darf — je Bereich einmal gefragt, nicht je Bibliothek. */
        var writes = new Dictionary<Guid, bool>();
        var open = new Dictionary<Guid, bool>();
        foreach (var area in rows.Select(r => r.AreaId).Distinct())
        {
            writes[area] = await Area.MayAsync(connection, who.Value.AccountId, area, Capability.Write, ctx.RequestAborted);
            open[area] = await AreaIsPublicAsync(connection, area, ctx.RequestAborted);
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
                kind = r.Kind,
                writes = writes[r.AreaId],
                /* 2026-10-22 — wer liest: der Bereich (offen oder nicht) und ob die Umstellung durchgesehen ist (0122). */
                areaPublic = open[r.AreaId],
                areaRuleAt = r.AreaRule
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

        var kind = LibraryKind(body.Kind);
        if (kind is null) { await Fail(ctx, StatusCodes.Status400BadRequest, "Biblioteka (books) albo baza wiedzy (knowledge)."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, kind == "knowledge" ? "W tym obszarze nie możesz zakładać baz wiedzy." : "W tym obszarze nie możesz zakładać bibliotek.");
            return;
        }

        /* 2026-10-22 — jeder Bereich hat SEINE Bibliothek: wer liest, entscheidet der Bereich, also gibt es je Bereich eine. */
        if (kind == "books")
        {
            await using var taken = new SqlCommand("SELECT COUNT(*) FROM app.library WHERE area_id = @area AND kind = N'books';", connection);
            taken.Parameters.AddWithValue("@area", areaId);
            if ((int)(await taken.ExecuteScalarAsync(ctx.RequestAborted))! > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten obszar ma już swoją bibliotekę.");
                return;
            }
        }

        var current = await CurrentEpochAsync(connection, areaId, ctx.RequestAborted);
        if (current is null || body.Epoch < 1 || body.Epoch > current)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        await using var insert = new SqlCommand("""
            INSERT INTO app.library (id, area_id, epoch, name_sealed, created_at, updated_at, kind)
            VALUES (@id, @area, @epoch, @name, @now, @now, @kind);
            """, connection);
        insert.Parameters.AddWithValue("@kind", kind);
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

        /* 2026-10-22 — eine neue Bibliothek kennt nur die Regel des Bereichs: nichts durchzusehen. */
        if (await HasAreaRuleAsync(connection, ctx.RequestAborted))
        {
            await using var rule = new SqlCommand("UPDATE app.library SET area_rule_at = @now WHERE id = @id;", connection);
            rule.Parameters.AddWithValue("@id", id);
            rule.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await rule.ExecuteNonQueryAsync(ctx.RequestAborted);
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
    private static async Task DeleteAsync(HttpContext ctx, Db db, IConfiguration config, Guid id)
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
            DELETE FROM app.library_entry_version WHERE entry_id IN (SELECT id FROM app.library_entry WHERE library_id = @id);
            DELETE FROM app.library_file WHERE library_id = @id;
            IF OBJECT_ID(N'app.library_moved', N'U') IS NOT NULL DELETE FROM app.library_moved WHERE from_library_id = @id;
            DELETE FROM app.learn_batch WHERE library_id = @id;
            DELETE FROM app.learn_due WHERE library_id = @id;
            UPDATE app.cogita_session SET library_id = NULL WHERE library_id = @id;
            DELETE FROM app.library_entry WHERE library_id = @id;
            DELETE FROM app.library WHERE id = @id;
            """, connection, tx))
        {
            drop.Parameters.AddWithValue("@id", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);

        /* 0109 — die versiegelten Dateien der Bibliothek liegen in ihrem eigenen Ordner. */
        DropFiles(config, id);

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
        if (!SinceOf(since, out var from))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* 0109 — lesen darf auch ein Link mit Zugang (der Rufer): wer einen Kurs liest, braucht kein Konto. */
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (await ReadableAsync(ctx, connection, caller, id) is null) return;

        await WriteEntriesAsync(ctx, connection, id, from);
    }

    /// <summary>`since` gelesen — zwei Sekunden früher, damit Gleichzeitiges nicht durchfällt; leer: alles.</summary>
    private static bool SinceOf(string? since, out DateTimeOffset? from)
    {
        from = null;
        if (string.IsNullOrWhiteSpace(since)) return true;
        if (!DateTimeOffset.TryParse(since, out var parsed)) return false;
        from = parsed.AddSeconds(-2);
        return true;
    }

    /// <summary>Die Einträge (oder was sich seit <paramref name="from"/> geändert hat) — für Konto, Link und Platz dieselbe Antwort.</summary>
    private static async Task WriteEntriesAsync(HttpContext ctx, SqlConnection connection, Guid id, DateTimeOffset? from)
    {
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

        /* 2026-10-22 — was seitdem in einen anderen Bereich zog, ist HIER fort: es kommt als gelöscht. */
        if (from is not null) await MovedAwayAsync(connection, id, from.Value, entries, ctx.RequestAborted);

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

        /*
         * 0109 — DIE FASSUNGEN [N9]: was jetzt überschrieben wird, bleibt als
         * Fassung stehen, mit dem Konto, das es geschrieben hatte. Wiederhergestellt
         * wird im Browser — er öffnet die alte Hülle und speichert sie als neue.
         */
        if (had is not null)
        {
            await using var keep = new SqlCommand("""
                INSERT INTO app.library_entry_version (entry_id, version, kind, epoch, sealed, written_at, written_by_account_id)
                SELECT id, version, kind, epoch, sealed, updated_at, written_by_account_id
                  FROM app.library_entry
                 WHERE id = @id AND sealed IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM app.library_entry_version v WHERE v.entry_id = @id AND v.version = app.library_entry.version);
                """, connection, tx);
            keep.Parameters.AddWithValue("@id", entryId);
            await keep.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await using (var save = new SqlCommand(had is null
            ? """
              INSERT INTO app.library_entry (id, library_id, kind, epoch, sealed, version, created_at, updated_at, written_by_account_id)
              VALUES (@id, @library, @kind, @epoch, @sealed, 1, @now, @now, @account);
              """
            : """
              UPDATE app.library_entry
                 SET kind = @kind, epoch = @epoch, sealed = @sealed, version = version + 1,
                     updated_at = @now, deleted_at = NULL, written_by_account_id = @account
               WHERE id = @id;
              """, connection, tx))
        {
            save.Parameters.AddWithValue("@id", entryId);
            save.Parameters.AddWithValue("@library", id);
            save.Parameters.AddWithValue("@kind", body.Kind!);
            save.Parameters.AddWithValue("@epoch", body.Epoch);
            save.Parameters.AddBlob("@sealed", sealedBytes);
            save.Parameters.AddWithValue("@now", now);
            save.Parameters.AddWithValue("@account", who.Value.AccountId);
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
            /* 0109 — die letzte Hülle bleibt als Fassung: ein gelöschter Eintrag lässt sich wiederholen. */
            INSERT INTO app.library_entry_version (entry_id, version, kind, epoch, sealed, written_at, written_by_account_id)
            SELECT id, version, kind, epoch, sealed, updated_at, written_by_account_id
              FROM app.library_entry
             WHERE id = @entry AND library_id = @library AND sealed IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM app.library_entry_version v WHERE v.entry_id = @entry AND v.version = app.library_entry.version);
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

private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
