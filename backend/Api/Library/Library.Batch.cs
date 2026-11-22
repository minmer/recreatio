using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-11-03 — VIELE EINTRÄGE IN EINEM ZUG, ALLE ODER KEINER (der Import einer Baza wiedzy).
///
/// <para>
/// Ein Import legt neue Rodzaje und Einträge an und ändert bestehende, die auf sie zeigen. Einzeln
/// gespeichert, blieb nach einem Fehler die Hälfte stehen — ein Feld, das auf einen Rodzaj zeigt, den
/// es nie gab. Hier geht der ganze Zapis in EINER Transaktion: jeder Eintrag wird geprüft (gehört er
/// dieser Bibliothek, ist sein Stand noch der, auf dem der Browser geändert hat), und nur, wenn alle
/// stimmen, wird geschrieben — in der Reihenfolge, in der sie kommen. Sonst bleibt alles, wie es war,
/// und die Antwort nennt jeden Eintrag, der nicht ging.
/// </para>
///
/// <para>
/// Wie <see cref="SaveAsync"/> je Eintrag: die alte Hülle bleibt als Fassung, der Dienst liest nichts.
/// </para>
///
/// <para>
/// 2026-11-03 — AUCH LÖSCHEN IM SELBEN ZUG (`remove`: Kennung und Stand): ein Import, der Einträge anlegt, ändert und
/// löscht, geht ganz oder gar nicht. Gelöscht wird wie bei <see cref="RemoveAsync"/> — die letzte Hülle bleibt als
/// Fassung (wiederherstellbar), ein Grabstein für den Abgleich —, und nur, was in dieser Bibliothek liegt, noch nicht
/// gelöscht ist und den Stand hat, den der Browser sah.
/// </para>
/// </summary>
public static partial class Library
{
    /// <summary>Höchstens so viele Einträge in einem Zapis.</summary>
    public const int MaxSaveBatch = 5000;
    /// <summary>Höchstens so viele Bytes versiegelter Hüllen zusammen.</summary>
    public const long MaxSaveBatchBytes = 40L * 1024 * 1024;
    /// <summary>Wie gross die Anfrage sein darf (base64 und JSON um die Hüllen).</summary>
    private const long MaxSaveBatchRequest = 64L * 1024 * 1024;

    /*
     * 2026-11-22 (A4) — EIN GROSSER IMPORT IN STÜCKEN (0143): der Browser legt die versiegelten Einträge Stück für Stück
     * ab (`…/entries/save/stage`, je Anfrage unter der Grenze des IIS von 30 MB), das letzte `…/entries/save` mit
     * `"stage"` schreibt alle in EINER Transaktion — mit denselben Prüfungen wie ein Zapis aus einem Guss.
     */
    /// <summary>Höchstens so viele Einträge (mit Löschungen) in einem Zapis aus Stücken.</summary>
    public const int MaxStagedItems = 20_000;
    /// <summary>Höchstens so viele Bytes versiegelter Hüllen in einem Zapis aus Stücken.</summary>
    public const long MaxStagedBytes = 160L * 1024 * 1024;
    /// <summary>Ein Stück: so viele Einträge, so viele Bytes Hüllen (der Browser schickt höchstens 2000 und ~12 MB).</summary>
    public const int MaxStagePartItems = 5000;
    public const long MaxStagePartBytes = 24L * 1024 * 1024;
    /// <summary>Ein Stück bleibt unter der Grenze des IIS (30 000 000 Bytes je Anfrage).</summary>
    private const long MaxStageRequest = 30_000_000;
    private const int MaxStageParts = 1000;
    /// <summary>Was so lange liegt (ein abgebrochener Import), räumt das nächste Stück fort.</summary>
    private static readonly TimeSpan StageLife = TimeSpan.FromHours(1);

    public sealed record SaveManyEntry(string? EntryId, string? Kind, int Epoch, string? Sealed, int Version);
    public sealed record SaveManyRemove(string? EntryId, int Version);
    /// <summary>2026-11-22 — `Stage`: das Zeichen der abgelegten Stücke (0143); sie kommen vor `Entries` und `Remove`.</summary>
    public sealed record SaveManyRequest(List<SaveManyEntry>? Entries, List<SaveManyRemove>? Remove = null, string? Stage = null);
    /// <summary>2026-11-22 — ein Stück: ohne `Token` beginnt es einen neuen Zapis (dann `Part` 0); dasselbe Stück zweimal ersetzt das erste.</summary>
    public sealed record SaveStageRequest(string? Token, int Part, List<SaveManyEntry>? Entries, List<SaveManyRemove>? Remove = null);

    /// <summary>Ein geprüfter Eintrag, der in diesem Zapis gelöscht wird.</summary>
    public sealed record SaveManyGone(Guid Id, int Version);

    /// <summary>Ein geprüfter Eintrag eines Zapis.</summary>
    public sealed record SaveManyRow(Guid Id, string Kind, int Epoch, byte[] Sealed, int Version);

    private static void MapBatch(WebApplication app)
    {
        app.MapPost("/workspace/library/{id:guid}/entries/save", SaveManyAsync)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaxSaveBatchRequest));
        app.MapPost("/workspace/library/{id:guid}/entries/save/stage", StageAsync)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaxStageRequest));
    }

    /// <summary>
    /// Was hereinkommt, ohne Datenbank geprüft (<c>Api.Tests/LibraryChecks.cs</c>): 1 bis <see cref="MaxSaveBatch"/>
    /// Einträge, jeder einmal, mit Art, Epoche, Hülle (48 Bytes bis 4 MB) und Stand; zusammen höchstens
    /// <see cref="MaxSaveBatchBytes"/>. Die Reihenfolge bleibt.
    /// </summary>
    public static (List<SaveManyRow>? Rows, string? Error) ReadSaveMany(SaveManyRequest? body) => ReadSaveMany(body, MaxSaveBatch, MaxSaveBatchBytes);

    /// <summary>2026-11-22 — dasselbe mit anderen Grenzen: ein Stück (<see cref="MaxStagePartItems"/>), ein Zapis aus Stücken (<see cref="MaxStagedItems"/>).</summary>
    public static (List<SaveManyRow>? Rows, string? Error) ReadSaveMany(SaveManyRequest? body, int maxItems, long maxBytes)
    {
        var list = body?.Entries ?? (body?.Remove is { Count: > 0 } ? [] : null);
        var all = (list?.Count ?? 0) + (body?.Remove?.Count ?? 0);
        if (list is null || all == 0 || all > maxItems) return (null, $"Od 1 do {maxItems} wpisów w jednym zapisie.");
        var rows = new List<SaveManyRow>(list.Count);
        var seen = new HashSet<Guid>();
        long total = 0;
        foreach (var one in list)
        {
            if (one is null || !Guid.TryParse(one.EntryId, out var id)) return (null, "Nieczytelny identyfikator wpisu.");
            var name = Ids.ToText(id);
            if (!seen.Add(id)) return (null, $"Wpis {name} stoi w zapisie dwa razy.");
            if (!IsKind(one.Kind)) return (null, $"Nieznany rodzaj wpisu {name}.");
            if (one.Epoch < 1) return (null, "Nie ma takiej epoki obszaru.");
            if (one.Version < 0) return (null, $"Nieczytelny stan wpisu {name}.");
            if (!Base64Url.TryDecode(one.Sealed, out var bytes) || bytes.Length is < 48 or > (int)MaxSealed)
                return (null, $"Zapieczętowany wpis {name} musi mieć najwyżej 4 MB.");
            total += bytes.Length;
            if (total > maxBytes) return (null, $"Zapis jest za duży (więcej niż {maxBytes / (1024 * 1024)} MB) — podziel go na mniejsze części.");
            rows.Add(new SaveManyRow(id, one.Kind!, one.Epoch, bytes, one.Version));
        }
        return (rows, null);
    }

    /// <summary>
    /// 2026-11-03 — was gelöscht wird, ohne Datenbank geprüft: jede Kennung einmal, nicht zugleich gespeichert, ein Stand
    /// ab 1 (es gibt ihn). Leer, wenn nichts gelöscht wird.
    /// </summary>
    public static (List<SaveManyGone>? Gone, string? Error) ReadSaveRemove(SaveManyRequest? body, IReadOnlyList<SaveManyRow> rows)
    {
        var gone = new List<SaveManyGone>();
        var saved = rows.Select(r => r.Id).ToHashSet();
        var seen = new HashSet<Guid>();
        foreach (var one in body?.Remove ?? [])
        {
            if (one is null || !Guid.TryParse(one.EntryId, out var id)) return (null, "Nieczytelny identyfikator wpisu do usunięcia.");
            var name = Ids.ToText(id);
            if (!seen.Add(id)) return (null, $"Wpis {name} stoi na liście do usunięcia dwa razy.");
            if (saved.Contains(id)) return (null, $"Wpis {name} jest w tym zapisie i do zapisania, i do usunięcia.");
            if (one.Version < 1) return (null, $"Nieczytelny stan wpisu {name} do usunięcia.");
            gone.Add(new SaveManyGone(id, one.Version));
        }
        return (gone, null);
    }

    /// <summary>
    /// 2026-11-03 — welche Löschungen nicht gehen (<paramref name="had"/>: Bibliothek, Stand, schon gelöscht) — ohne
    /// Datenbank prüfbar.
    /// </summary>
    public static List<SaveManyProblem> RemoveManyProblems(Guid library, IReadOnlyList<SaveManyGone> gone, IReadOnlyDictionary<Guid, (Guid Library, int Version, bool Deleted)> had)
    {
        var problems = new List<SaveManyProblem>();
        foreach (var one in gone)
        {
            var name = Ids.ToText(one.Id);
            if (!had.TryGetValue(one.Id, out var now) || now.Deleted) problems.Add(new SaveManyProblem(name, "nie ma go już w bibliotece (nie ma czego usunąć)", 0));
            else if (now.Library != library) problems.Add(new SaveManyProblem(name, "należy do innej biblioteki", null));
            else if (now.Version != one.Version) problems.Add(new SaveManyProblem(name, "ktoś zmienił go w międzyczasie", now.Version));
        }
        return problems;
    }

    /// <summary>Ein Problem eines Eintrags, wie die Antwort es nennt.</summary>
    public sealed record SaveManyProblem(string EntryId, string Error, int? Version);

    /// <summary>
    /// Welche Einträge nicht gehen, aus dem, was die Datenbank für sie hält (<paramref name="had"/>: Bibliothek und Stand
    /// der vorhandenen) — leer, wenn alle gehen. Ohne Datenbank prüfbar.
    /// </summary>
    public static List<SaveManyProblem> SaveManyProblems(Guid library, IReadOnlyList<SaveManyRow> rows, IReadOnlyDictionary<Guid, (Guid Library, int Version)> had)
    {
        var problems = new List<SaveManyProblem>();
        foreach (var row in rows)
        {
            var name = Ids.ToText(row.Id);
            if (had.TryGetValue(row.Id, out var now))
            {
                if (now.Library != library) problems.Add(new SaveManyProblem(name, "należy do innej biblioteki", null));
                else if (now.Version != row.Version) problems.Add(new SaveManyProblem(name, "ktoś zmienił go w międzyczasie", now.Version));
            }
            else if (row.Version != 0)
            {
                problems.Add(new SaveManyProblem(name, "nie ma go już w bibliotece", 0));
            }
        }
        return problems;
    }

    private static async Task SaveManyAsync(HttpContext ctx, Db db, Guid id, SaveManyRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        /* 2026-11-22 (A4) — mit "stage": erst die abgelegten Stücke dieses Kontos und dieser Bibliothek, dann der Rest dieser Anfrage. */
        Guid? token = null;
        if (!string.IsNullOrEmpty(body?.Stage))
        {
            if (!Guid.TryParse(body.Stage, out var parsed))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nic nie zapisano: nieczytelny znacznik części zapisu.");
                return;
            }
            token = parsed;
        }

        List<SaveManyRow>? rows = null;
        List<SaveManyGone>? gone = null;
        if (token is null)
        {
            (rows, var error) = ReadSaveMany(body);
            if (rows is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: {error}");
                return;
            }
            (gone, var goneError) = ReadSaveRemove(body, rows);
            if (gone is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: {goneError}");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write);
        if (library is null) return;
        if (token is Guid stage)
        {
            var parts = await StagedPartsAsync(connection, stage, id, who.Value.AccountId, ctx.RequestAborted);
            if (parts.Count == 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Nic nie zapisano: części tego zapisu już nie ma (minęła godzina albo zapis się zakończył) — zapisz jeszcze raz.");
                return;
            }
            var merged = MergeStage(parts, body);
            (rows, var error) = ReadSaveMany(merged, MaxStagedItems, MaxStagedBytes);
            if (rows is not null) (gone, error) = ReadSaveRemove(merged, rows);
            if (rows is null || gone is null)
            {
                await DropStageAsync(connection, null, stage, ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: {error}");
                return;
            }
        }
        if (rows is null || gone is null) return;
        if (rows.Any(r => r.Epoch > library.Value.CurrentEpoch))
        {
            if (token is Guid stale) await DropStageAsync(connection, null, stale, ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nic nie zapisano: nie ma takiej epoki obszaru.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        /* Was es schon gibt — gesperrt bis zum Ende, damit niemand dazwischen schreibt (auch keinen neuen mit derselben Kennung). */
        var had = new Dictionary<Guid, (Guid Library, int Version)>();
        var hadGone = new Dictionary<Guid, (Guid Library, int Version, bool Deleted)>();
        foreach (var chunk in rows.Select(r => r.Id).Concat(gone.Select(g => g.Id)).Chunk(500))
        {
            var names = string.Join(", ", chunk.Select((_, i) => $"@i{i}"));
            await using var read = new SqlCommand(
                $"SELECT id, library_id, version, CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END FROM app.library_entry WITH (UPDLOCK, HOLDLOCK) WHERE id IN ({names});", connection, tx);
            for (var i = 0; i < chunk.Length; i++) read.Parameters.AddWithValue($"@i{i}", chunk[i]);
            await using var reader = await read.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                had[reader.GetGuid(0)] = (reader.GetGuid(1), reader.GetInt32(2));
                hadGone[reader.GetGuid(0)] = (reader.GetGuid(1), reader.GetInt32(2), reader.GetInt32(3) == 1);
            }
        }

        var problems = SaveManyProblems(id, rows, had);
        problems.AddRange(RemoveManyProblems(id, gone, hadGone));
        if (problems.Count > 0)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            if (token is Guid conflicted) await DropStageAsync(connection, null, conflicted, ctx.RequestAborted);
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            var stale = problems.Any(p => p.Version is not null);
            await ctx.Response.WriteAsJsonAsync(new
            {
                error = $"Nic nie zapisano: {problems.Count} {(problems.Count == 1 ? "wpis nie może" : "wpisów nie może")} być zapisanych ({string.Join("; ", problems.Take(5).Select(p => $"{p.EntryId}: {p.Error}"))}{(problems.Count > 5 ? "; …" : "")}).",
                verdict = stale ? "stale" : "conflict",
                problems = problems.Select(p => new { entryId = p.EntryId, error = p.Error, version = p.Version })
            });
            return;
        }

        var added = rows.Count(r => !had.ContainsKey(r.Id));
        if (added > 0)
        {
            await using var count = new SqlCommand("SELECT COUNT(*) FROM app.library_entry WHERE library_id = @library;", connection, tx);
            count.Parameters.AddWithValue("@library", id);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! + added > MaxEntries)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                if (token is Guid full) await DropStageAsync(connection, null, full, ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: biblioteka miałaby więcej niż {MaxEntries} wpisów.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        var saved = new List<object>(rows.Count);
        foreach (var row in rows)
        {
            var exists = had.TryGetValue(row.Id, out var before);
            /* 0109 — was überschrieben wird, bleibt als Fassung (wie beim einzelnen Speichern). */
            await using var save = new SqlCommand(exists
                ? """
                  INSERT INTO app.library_entry_version (entry_id, version, kind, epoch, sealed, written_at, written_by_account_id)
                  SELECT id, version, kind, epoch, sealed, updated_at, written_by_account_id
                    FROM app.library_entry
                   WHERE id = @id AND sealed IS NOT NULL
                     AND NOT EXISTS (SELECT 1 FROM app.library_entry_version v WHERE v.entry_id = @id AND v.version = app.library_entry.version);
                  UPDATE app.library_entry
                     SET kind = @kind, epoch = @epoch, sealed = @sealed, version = version + 1,
                         updated_at = @now, deleted_at = NULL, written_by_account_id = @account
                   WHERE id = @id;
                  """
                : """
                  INSERT INTO app.library_entry (id, library_id, kind, epoch, sealed, version, created_at, updated_at, written_by_account_id)
                  VALUES (@id, @library, @kind, @epoch, @sealed, 1, @now, @now, @account);
                  """, connection, tx);
            save.Parameters.AddWithValue("@id", row.Id);
            save.Parameters.AddWithValue("@library", id);
            save.Parameters.AddWithValue("@kind", row.Kind);
            save.Parameters.AddWithValue("@epoch", row.Epoch);
            save.Parameters.AddBlob("@sealed", row.Sealed);
            save.Parameters.AddWithValue("@now", now);
            save.Parameters.AddWithValue("@account", who.Value.AccountId);
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
            saved.Add(new { entryId = Ids.ToText(row.Id), version = (exists ? before.Version : 0) + 1, updatedAt = now });
        }

        /* 2026-11-03 — die Löschungen dieses Zapis, wie RemoveAsync: die letzte Hülle bleibt als Fassung, ein Grabstein. */
        var removed = new List<object>(gone.Count);
        foreach (var one in gone)
        {
            await using var drop = new SqlCommand("""
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
                """, connection, tx);
            drop.Parameters.AddWithValue("@entry", one.Id);
            drop.Parameters.AddWithValue("@library", id);
            drop.Parameters.AddWithValue("@now", now);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            removed.Add(new { entryId = Ids.ToText(one.Id), version = one.Version + 1, updatedAt = now });
        }

        /* 2026-11-22 — die Stücke gehen mit derselben Transaktion: geschrieben ist, was sie trugen. */
        if (token is Guid done) await DropStageAsync(connection, tx, done, ctx.RequestAborted);

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { saved = saved.Count, entries = saved, removed });
    }

    /* -- 2026-11-22 (A4): die Stücke eines grossen Zapis (0143) ------------------------------------------------------- */

    private static readonly System.Text.Json.JsonSerializerOptions StageJson = new(System.Text.Json.JsonSerializerDefaults.Web);

    /// <summary>
    /// Die Stücke in ihrer Reihenfolge, dann der Rest der letzten Anfrage — ein Zapis, wie er aus einem Guss gekommen
    /// wäre. Ohne Datenbank prüfbar (<c>Api.Tests/LibraryChecks.cs</c>).
    /// </summary>
    public static SaveManyRequest MergeStage(IEnumerable<SaveManyRequest?> parts, SaveManyRequest? tail)
    {
        var entries = new List<SaveManyEntry>();
        var remove = new List<SaveManyRemove>();
        foreach (var part in parts.Append(tail))
        {
            if (part is null) continue;
            if (part.Entries is not null) entries.AddRange(part.Entries);
            if (part.Remove is not null) remove.AddRange(part.Remove);
        }
        return new SaveManyRequest(entries, remove);
    }

    /// <summary>Ein Stück, gelesen wie ein Zapis (mit den Grenzen eines Stücks) — <c>null</c>, oder warum nicht.</summary>
    public static string? ReadStagePart(SaveStageRequest? body)
    {
        if (body is null) return "Pusta część zapisu.";
        if (body.Part < 0 || body.Part >= MaxStageParts) return $"Część zapisu musi mieć numer od 0 do {MaxStageParts - 1}.";
        if (string.IsNullOrEmpty(body.Token) && body.Part != 0) return "Nowy zapis zaczyna się od części 0.";
        if (!string.IsNullOrEmpty(body.Token) && !Guid.TryParse(body.Token, out _)) return "Nieczytelny znacznik części zapisu.";
        var asBatch = new SaveManyRequest(body.Entries, body.Remove);
        var (rows, error) = ReadSaveMany(asBatch, MaxStagePartItems, MaxStagePartBytes);
        if (rows is null) return error;
        var (gone, goneError) = ReadSaveRemove(asBatch, rows);
        return gone is null ? goneError : null;
    }

    private static async Task<List<SaveManyRequest?>> StagedPartsAsync(SqlConnection connection, Guid token, Guid library, Guid account, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT payload FROM app.library_save_stage
             WHERE token = @token AND library_id = @library AND account_id = @account AND created_at >= @since
             ORDER BY part;
            """, connection);
        cmd.Parameters.AddWithValue("@token", token);
        cmd.Parameters.AddWithValue("@library", library);
        cmd.Parameters.AddWithValue("@account", account);
        cmd.Parameters.AddWithValue("@since", DateTimeOffset.UtcNow - StageLife);
        var parts = new List<SaveManyRequest?>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) parts.Add(System.Text.Json.JsonSerializer.Deserialize<SaveManyRequest>((byte[])reader[0], StageJson));
        return parts;
    }

    private static async Task DropStageAsync(SqlConnection connection, SqlTransaction? tx, Guid token, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("DELETE FROM app.library_save_stage WHERE token = @token;", connection, tx);
        cmd.Parameters.AddWithValue("@token", token);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// EIN STÜCK ABLEGEN. Ohne <c>token</c>: ein neuer Zapis (Teil 0), die Antwort nennt sein Zeichen. Mit: ein weiteres
    /// Stück desselben Kontos und derselben Bibliothek; dasselbe Stück noch einmal ersetzt das erste. Was zusammen mehr
    /// wäre als ein Zapis aus Stücken tragen darf, wird schon hier abgelehnt. Gespeichert ist damit noch nichts.
    /// </summary>
    private static async Task StageAsync(HttpContext ctx, Db db, Guid id, SaveStageRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        var problem = ReadStagePart(body);
        if (problem is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: {problem}");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write);
        if (library is null) return;

        await using (var old = new SqlCommand("DELETE FROM app.library_save_stage WHERE created_at < @before;", connection))
        {
            old.Parameters.AddWithValue("@before", DateTimeOffset.UtcNow - StageLife);
            await old.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        var items = (body.Entries?.Count ?? 0) + (body.Remove?.Count ?? 0);
        long bytes = 0;
        foreach (var one in body.Entries ?? []) bytes += Base64Url.TryDecode(one.Sealed, out var raw) ? raw.Length : 0;
        var token = string.IsNullOrEmpty(body.Token) ? Guid.NewGuid() : Guid.Parse(body.Token);
        if (!string.IsNullOrEmpty(body.Token))
        {
            int count, hadItems;
            long hadBytes;
            await using (var sum = new SqlCommand("""
                SELECT COUNT(*), COALESCE(SUM(CASE WHEN part <> @part THEN items END), 0), COALESCE(SUM(CASE WHEN part <> @part THEN bytes END), CAST(0 AS bigint))
                  FROM app.library_save_stage
                 WHERE token = @token AND library_id = @library AND account_id = @account;
                """, connection))
            {
                sum.Parameters.AddWithValue("@token", token);
                sum.Parameters.AddWithValue("@part", body.Part);
                sum.Parameters.AddWithValue("@library", id);
                sum.Parameters.AddWithValue("@account", who.Value.AccountId);
                await using var reader = await sum.ExecuteReaderAsync(ctx.RequestAborted);
                await reader.ReadAsync(ctx.RequestAborted);
                (count, hadItems, hadBytes) = (reader.GetInt32(0), reader.GetInt32(1), reader.GetInt64(2));
            }
            if (count == 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Nic nie zapisano: części tego zapisu już nie ma (minęła godzina) — zapisz jeszcze raz.");
                return;
            }
            if (hadItems + items > MaxStagedItems || hadBytes + bytes > MaxStagedBytes)
            {
                await DropStageAsync(connection, null, token, ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: najwyżej {MaxStagedItems} wpisów i {MaxStagedBytes / (1024 * 1024)} MB w jednym zapisie.");
                return;
            }
        }

        var payload = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(new SaveManyRequest(body.Entries, body.Remove), StageJson);
        await using (var put = new SqlCommand("""
            DELETE FROM app.library_save_stage WHERE token = @token AND part = @part;
            INSERT INTO app.library_save_stage (token, part, library_id, account_id, items, bytes, payload, created_at)
            VALUES (@token, @part, @library, @account, @items, @bytes, @payload, @now);
            """, connection))
        {
            put.Parameters.AddWithValue("@token", token);
            put.Parameters.AddWithValue("@part", body.Part);
            put.Parameters.AddWithValue("@library", id);
            put.Parameters.AddWithValue("@account", who.Value.AccountId);
            put.Parameters.AddWithValue("@items", items);
            put.Parameters.AddWithValue("@bytes", bytes);
            put.Parameters.AddBlob("@payload", payload);
            put.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await put.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await ctx.Response.WriteAsJsonAsync(new { token = token.ToString(), part = body.Part, items, bytes });
    }
}
